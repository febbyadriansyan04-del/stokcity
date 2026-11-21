-- StayStock Phase 1: skema, aturan bisnis (RPC), RLS, audit trail.
-- Jalankan seluruh file ini di Supabase Dashboard > SQL Editor.

create type app_role as enum ('admin','gm','purchasing','storekeeper','dept_head','dept_staff','finance');
create sequence doc_seq;

create table profiles (id uuid primary key references auth.users on delete cascade, full_name text not null default '', role app_role not null default 'dept_staff', department text);
create table warehouses (id uuid primary key default gen_random_uuid(), code text unique not null, name text not null, active boolean default true);
create table suppliers (id uuid primary key default gen_random_uuid(), code text unique not null, name text not null, payment_terms text);
create table items (
  id uuid primary key default gen_random_uuid(), code text unique not null, name text not null, category text not null,
  base_uom text not null, purchase_uom text not null, conv numeric(18,6) not null default 1 check (conv > 0),
  min_stock numeric default 0, max_stock numeric default 0, last_price numeric default 0, avg_cost numeric default 0, active boolean default true);
create table settings (key text primary key, value numeric not null);
create table stock_ledger (
  id bigserial primary key, doc_no text not null, tx_type text not null, item_id uuid not null references items, warehouse_id uuid not null references warehouses,
  qty numeric not null, unit_cost numeric, created_by uuid default auth.uid(), created_at timestamptz default now(), idempotency_key text unique);
create view stock_balance with (security_invoker = true) as select item_id, warehouse_id, sum(qty) as qty from stock_ledger group by item_id, warehouse_id;

create table purchase_requests (id uuid primary key default gen_random_uuid(), pr_no text unique not null, requested_by uuid not null, department text, est_total numeric not null,
  steps text[] not null, approvals jsonb not null default '[]', status text not null default 'pending', reason text, created_at timestamptz default now());
create table pr_lines (id uuid primary key default gen_random_uuid(), pr_id uuid references purchase_requests on delete cascade, item_id uuid references items, qty numeric not null check (qty > 0), est_price numeric);
create table purchase_orders (id uuid primary key default gen_random_uuid(), po_no text unique not null, pr_id uuid references purchase_requests, supplier_id uuid references suppliers,
  warehouse_id uuid references warehouses, total numeric not null, status text not null, created_by uuid, created_at timestamptz default now());
create table po_lines (id uuid primary key default gen_random_uuid(), po_id uuid references purchase_orders on delete cascade, item_id uuid references items, qty numeric not null, price numeric not null, received_qty numeric not null default 0);
create table goods_receipts (id uuid primary key default gen_random_uuid(), grn_no text unique not null, po_id uuid references purchase_orders, created_by uuid, created_at timestamptz default now());
create table grn_lines (id uuid primary key default gen_random_uuid(), grn_id uuid references goods_receipts on delete cascade, po_line_id uuid references po_lines, received numeric, rejected numeric);
create table audit_log (id bigserial primary key, user_id uuid, table_name text, row_id text, op text, old_row jsonb, new_row jsonb, created_at timestamptz default now());

-- ---------- helper ----------
create function my_role() returns app_role language sql stable security definer set search_path = public as $$ select role from profiles where id = auth.uid() $$;
create function next_no(p text) returns text language sql as $$ select p || '-' || lpad(nextval('doc_seq')::text, 6, '0') $$;
create function _need(r text[]) returns void language plpgsql stable security definer set search_path = public as $$
begin if my_role() is null or not (my_role()::text = any(r)) then raise exception 'Peran Anda tidak diizinkan melakukan aksi ini.'; end if; end $$;
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into profiles(id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email)); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- ---------- ledger: satu-satunya jalan mengubah saldo ----------
create function _post(p_doc text, p_type text, p_item uuid, p_wh uuid, p_qty numeric, p_cost numeric, p_key text) returns void
language plpgsql security definer set search_path = public as $$
declare bal numeric; tq numeric; av numeric;
begin
  if p_key is not null and exists (select 1 from stock_ledger where idempotency_key = p_key) then return; end if;   -- idempotent
  perform pg_advisory_xact_lock(hashtext(p_item::text));
  select coalesce(sum(qty), 0) into bal from stock_ledger where item_id = p_item and warehouse_id = p_wh;
  if p_qty < 0 and bal + p_qty < 0 then raise exception 'Stok tidak cukup (tersedia %).', bal; end if;
  if p_qty > 0 and p_cost is not null then   -- moving weighted average
    select coalesce(sum(qty), 0) into tq from stock_ledger where item_id = p_item;
    select avg_cost into av from items where id = p_item;
    update items set avg_cost = (tq * av + p_qty * p_cost) / (tq + p_qty) where id = p_item;
  end if;
  insert into stock_ledger(doc_no, tx_type, item_id, warehouse_id, qty, unit_cost, idempotency_key)
  values (p_doc, p_type, p_item, p_wh, p_qty, (select avg_cost from items where id = p_item), p_key);
end $$;
revoke execute on function _post(text,text,uuid,uuid,numeric,numeric,text) from public, anon, authenticated;

create function post_movement(p_type text, p_item uuid, p_wh uuid, p_qty numeric, p_ref text, p_key text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _need(array['storekeeper','admin']);
  if p_qty <= 0 then raise exception 'Qty harus lebih dari 0.'; end if;
  if coalesce(trim(p_ref), '') = '' then raise exception 'Referensi dokumen wajib diisi.'; end if;
  if p_type = 'in' then perform _post(next_no('SIN') || ' / ' || p_ref, 'stock_in', p_item, p_wh, p_qty, null, p_key);
  elsif p_type = 'out' then perform _post(next_no('SOUT') || ' / ' || p_ref, 'stock_out', p_item, p_wh, -p_qty, null, p_key);
  else raise exception 'Jenis transaksi tidak dikenal.'; end if;
end $$;

create function transfer_stock(p_item uuid, p_from uuid, p_to uuid, p_qty numeric, p_key text) returns void
language plpgsql security definer set search_path = public as $$
declare d text := next_no('TRF');
begin
  perform _need(array['storekeeper','admin']);
  if p_from = p_to then raise exception 'Gudang asal dan tujuan harus berbeda.'; end if;
  if p_qty <= 0 then raise exception 'Qty harus lebih dari 0.'; end if;
  perform _post(d, 'transfer_out', p_item, p_from, -p_qty, null, p_key || ':out');
  perform _post(d, 'transfer_in', p_item, p_to, p_qty, null, p_key || ':in');
end $$;

-- ---------- procurement ----------
create function submit_pr(p_lines jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_est numeric; v_steps text[]; t1 numeric; t2 numeric;
begin
  perform _need(array['dept_staff','dept_head','admin']);
  if jsonb_array_length(p_lines) = 0 then raise exception 'PR harus memiliki minimal satu baris.'; end if;
  select value into t1 from settings where key = 'approval_t1'; select value into t2 from settings where key = 'approval_t2';
  select sum((x->>'qty')::numeric * i.last_price) into v_est from jsonb_array_elements(p_lines) x join items i on i.id = (x->>'item_id')::uuid;
  v_steps := case when v_est < t1 then array['dept_head'] when v_est <= t2 then array['dept_head','purchasing'] else array['dept_head','purchasing','gm'] end;
  insert into purchase_requests(pr_no, requested_by, department, est_total, steps)
  values (next_no('PR'), auth.uid(), (select department from profiles where id = auth.uid()), v_est, v_steps) returning id into v_id;
  insert into pr_lines(pr_id, item_id, qty, est_price)
  select v_id, (x->>'item_id')::uuid, (x->>'qty')::numeric, i.last_price from jsonb_array_elements(p_lines) x join items i on i.id = (x->>'item_id')::uuid;
  return v_id;
end $$;

create function approve_pr(p_id uuid, p_ok boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare pr purchase_requests;
begin
  select * into pr from purchase_requests where id = p_id for update;
  if pr.status <> 'pending' then raise exception 'PR sudah diproses.'; end if;
  if pr.requested_by = auth.uid() then raise exception 'Pembuat dokumen tidak boleh menyetujui dokumennya sendiri.'; end if;   -- segregation of duties
  if my_role()::text is distinct from pr.steps[jsonb_array_length(pr.approvals) + 1] then raise exception 'Bukan giliran peran Anda.'; end if;
  if not p_ok then
    update purchase_requests set status = 'rejected', reason = p_reason where id = p_id;
  else
    update purchase_requests set approvals = approvals || jsonb_build_object('role', my_role(), 'by', auth.uid(), 'at', now()),
      status = case when jsonb_array_length(approvals) + 1 >= array_length(steps, 1) then 'approved' else 'pending' end where id = p_id;
  end if;
end $$;

create function create_po(p_pr uuid, p_supplier uuid, p_wh uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_tot numeric; t2 numeric;
begin
  perform _need(array['purchasing','admin']);
  perform 1 from purchase_requests where id = p_pr and status = 'approved' for update;
  if not found then raise exception 'PR belum disetujui atau sudah dikonversi.'; end if;
  select sum(qty * est_price) into v_tot from pr_lines where pr_id = p_pr;
  select value into t2 from settings where key = 'approval_t2';
  insert into purchase_orders(po_no, pr_id, supplier_id, warehouse_id, total, status, created_by)
  values (next_no('PO'), p_pr, p_supplier, p_wh, v_tot, case when v_tot > t2 then 'menunggu_gm' else 'open' end, auth.uid()) returning id into v_id;
  insert into po_lines(po_id, item_id, qty, price) select v_id, item_id, qty, est_price from pr_lines where pr_id = p_pr;
  update purchase_requests set status = 'converted' where id = p_pr;
  return v_id;
end $$;

create function approve_po(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin perform _need(array['gm','admin']); update purchase_orders set status = 'open' where id = p_id and status = 'menunggu_gm'; end $$;

create function receive_po(p_po uuid, p_lines jsonb) returns text language plpgsql security definer set search_path = public as $$
declare po purchase_orders; x jsonb; pl po_lines; it items; v_grn uuid; v_no text; v_any boolean := false; r numeric; j numeric;
begin
  perform _need(array['storekeeper','admin']);
  select * into po from purchase_orders where id = p_po for update;
  if po.status not in ('open','partial') then raise exception 'PO belum dapat menerima barang.'; end if;
  v_no := next_no('GRN');
  insert into goods_receipts(grn_no, po_id, created_by) values (v_no, p_po, auth.uid()) returning id into v_grn;
  for x in select value from jsonb_array_elements(p_lines) loop
    r := coalesce((x->>'received')::numeric, 0); j := coalesce((x->>'rejected')::numeric, 0);
    if r < 0 or j < 0 then raise exception 'Qty tidak boleh negatif.'; end if;
    continue when r = 0 and j = 0;
    select * into pl from po_lines where id = (x->>'line_id')::uuid and po_id = p_po;
    if not found then raise exception 'Baris PO tidak valid.'; end if;
    if r > 0 then
      select * into it from items where id = pl.item_id;
      perform _post(v_no || ' / ' || po.po_no, 'grn', pl.item_id, po.warehouse_id, r * it.conv, pl.price / it.conv, v_no || ':' || pl.id);
      update po_lines set received_qty = received_qty + r where id = pl.id;
      update items set last_price = pl.price where id = pl.item_id;
      v_any := true;
    end if;
    insert into grn_lines(grn_id, po_line_id, received, rejected) values (v_grn, pl.id, r, j);
  end loop;
  if not v_any then raise exception 'Isi qty penerimaan.'; end if;
  update purchase_orders set status = case when exists (select 1 from po_lines where po_id = p_po and received_qty < qty) then 'partial' else 'closed' end where id = p_po;
  return v_no;
end $$;

-- ---------- audit trail & ledger append-only ----------
create function audit_row() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log(user_id, table_name, row_id, op, old_row, new_row)
  values (auth.uid(), tg_table_name, coalesce(to_jsonb(new)->>'id', to_jsonb(old)->>'id'), tg_op, to_jsonb(old), to_jsonb(new));
  return coalesce(new, old);
end $$;
create trigger a_items after insert or update on items for each row execute function audit_row();
create trigger a_pr after insert or update on purchase_requests for each row execute function audit_row();
create trigger a_po after insert or update on purchase_orders for each row execute function audit_row();
create trigger a_ledger after insert on stock_ledger for each row execute function audit_row();
create function ledger_immutable() returns trigger language plpgsql as $$ begin raise exception 'Ledger stok tidak dapat diubah atau dihapus. Gunakan transaksi koreksi.'; end $$;
create trigger ledger_lock before update or delete on stock_ledger for each row execute function ledger_immutable();

-- ---------- RLS: baca untuk semua pengguna login; tulis hanya lewat RPC atau policy di bawah ----------
do $$ declare t text; begin
  foreach t in array array['profiles','warehouses','items','suppliers','stock_ledger','settings','purchase_requests','pr_lines','purchase_orders','po_lines','goods_receipts','grn_lines','audit_log'] loop
    execute format('alter table %I enable row level security', t);
    if t <> 'audit_log' then execute format('create policy "read %1$s" on %1$I for select to authenticated using (true)', t); end if;
  end loop; end $$;
create policy "read audit" on audit_log for select to authenticated using (my_role() in ('admin','gm','finance'));
create policy "items write" on items for insert to authenticated with check (my_role() in ('admin','gm','purchasing'));
create policy "items edit" on items for update to authenticated using (my_role() in ('admin','gm','purchasing'));
create policy "suppliers write" on suppliers for all to authenticated using (my_role() in ('admin','gm','purchasing')) with check (my_role() in ('admin','gm','purchasing'));
create policy "warehouses write" on warehouses for all to authenticated using (my_role() = 'admin') with check (my_role() = 'admin');
create policy "settings write" on settings for update to authenticated using (my_role() in ('admin','gm'));
create policy "profiles admin" on profiles for update to authenticated using (my_role() = 'admin');

-- ---------- data awal ----------
insert into settings values ('approval_t1', 1000000), ('approval_t2', 10000000), ('count_tolerance_pct', 5);
insert into warehouses(code, name) values ('MAIN','Main Store'),('HK','Housekeeping Store'),('FB-DRY','F&B Dry Store'),('FB-CHL','F&B Chiller'),('FB-FRZ','F&B Freezer'),('KB','Kitchen & Bar Store'),('ENG','Engineering Store'),('LND','Laundry Store');
insert into suppliers(code, name, payment_terms) values ('S1','PT Amenities Prima','30 hari'),('S2','CV Tekstil Nusantara','14 hari'),('S3','UD Pasar Induk Sejahtera','COD');
insert into items(code, name, category, base_uom, purchase_uom, conv, min_stock, max_stock, last_price, avg_cost) values
 ('HK-001','Sabun mandi 30 g','Housekeeping','pcs','Box',100,400,1500,180000,1800),
 ('LN-001','Handuk mandi','Linen','pcs','Lusin',12,100,400,1500000,125000),
 ('FB-001','Beras premium','F&B Dry Goods','kg','Karung 25 kg',25,100,400,325000,13000),
 ('BV-001','Air mineral 600 ml','Beverage','botol','Dus',24,240,1200,48000,2000),
 ('EN-001','Lampu LED 12 W','Spare Parts','pcs','Box',10,30,100,450000,45000);
