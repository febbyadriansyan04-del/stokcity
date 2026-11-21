import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useData } from '../lib/useData.js'
import { Card, Err, inp, btn } from '../components/ui.jsx'
export default function Movements() {
  const items = useData(() => supabase.from('items').select('id,code,name').eq('active', true).order('code'))
  const whs = useData(() => supabase.from('warehouses').select('id,name').order('name'))
  const [f, setF] = useState({ type: 'in', item: '', wh: '', to: '', qty: 1, ref: '' }), [msg, setMsg] = useState(null), [busy, setBusy] = useState(false)
  const key = useRef(crypto.randomUUID()) // idempotency key: klik ganda / retry tidak memposting dua kali
  const set = k => e => setF({ ...f, [k]: e.target.value })
  async function submit(e) {
    e.preventDefault(); setBusy(true); setMsg(null)
    const qty = Number(f.qty)
    const r = f.type === 'transfer'
      ? await supabase.rpc('transfer_stock', { p_item: f.item, p_from: f.wh, p_to: f.to, p_qty: qty, p_key: key.current })
      : await supabase.rpc('post_movement', { p_type: f.type, p_item: f.item, p_wh: f.wh, p_qty: qty, p_ref: f.ref, p_key: key.current })
    setBusy(false)
    if (r.error) setMsg({ e: r.error.message }); else { setMsg({ ok: 'Transaksi diposting.' }); key.current = crypto.randomUUID() }
  }
  const W = ({ v, on }) => <select className={inp} value={v} onChange={on} required><option value="">Gudang…</option>{(whs.data || []).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
  return (<Card title="Pergerakan stok">
    <Err e={msg?.e || items.error} />{msg?.ok && <p className="mb-3 text-sm text-teal-700">{msg.ok}</p>}
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <select className={inp} value={f.type} onChange={set('type')}><option value="in">Stok masuk</option><option value="out">Stok keluar</option><option value="transfer">Transfer</option></select>
      <select className={inp} value={f.item} onChange={set('item')} required><option value="">Item…</option>{(items.data || []).map(i => <option key={i.id} value={i.id}>{i.code} · {i.name}</option>)}</select>
      <W v={f.wh} on={set('wh')} />{f.type === 'transfer' && <W v={f.to} on={set('to')} />}
      <input className={inp + ' w-24'} type="number" min="0.0001" step="any" value={f.qty} onChange={set('qty')} required />
      {f.type !== 'transfer' && <input className={inp} placeholder="Referensi dokumen" value={f.ref} onChange={set('ref')} required />}
      <button className={btn} disabled={busy}>Posting</button>
    </form>
  </Card>)
}
