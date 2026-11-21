import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useData } from '../lib/useData.js'
import { useAuth } from '../lib/auth.jsx'
import { Card, Table, Err, inp, btn, btn2, rp, num } from '../components/ui.jsx'

export default function Procurement() {
  const { role, session } = useAuth(), uid = session.user.id
  const [tab, setTab] = useState('pr'), [err, setErr] = useState(null), [lines, setLines] = useState([]), [li, setLi] = useState({ item_id: '', qty: 1 }), [po, setPo] = useState({ pr: '', sup: '', wh: '' }), [rc, setRc] = useState({})
  const items = useData(() => supabase.from('items').select('id,code,name,purchase_uom,last_price').eq('active', true).order('code'))
  const prs = useData(() => supabase.from('purchase_requests').select('*').order('created_at', { ascending: false }))
  const pos = useData(() => supabase.from('purchase_orders').select('*, suppliers(name), po_lines(id,qty,received_qty,items(code))').order('created_at', { ascending: false }))
  const sups = useData(() => supabase.from('suppliers').select('id,name'))
  const whs = useData(() => supabase.from('warehouses').select('id,name'))
  const run = async (p, ok) => { setErr(null); const r = await p; if (r.error) setErr(r.error.message); else { prs.reload(); pos.reload(); ok && ok() } }
  const it = id => (items.data || []).find(i => i.id === id)
  const est = lines.reduce((a, l) => a + l.qty * Number(it(l.item_id)?.last_price || 0), 0)
  const reject = id => { const r = prompt('Alasan penolakan:'); if (r) run(supabase.rpc('approve_pr', { p_id: id, p_ok: false, p_reason: r })) }
  const T = ([k, l]) => <button key={k} onClick={() => setTab(k)} className={`rounded-full border px-3 py-1 text-sm ${tab === k ? 'bg-slate-900 text-white' : 'bg-white'}`}>{l}</button>
  return (<>
    <div className="mb-3 flex gap-2">{[['pr', 'Purchase Request'], ['po', 'Purchase Order'], ['grn', 'Terima Barang']].map(T)}</div>
    <Err e={err || prs.error} />
    {tab === 'pr' && <>
      {['dept_staff', 'dept_head', 'admin'].includes(role) && <Card title="Buat PR">
        <div className="mb-2 flex flex-wrap gap-2">
          <select className={inp} value={li.item_id} onChange={e => setLi({ ...li, item_id: e.target.value })}><option value="">Item…</option>{(items.data || []).map(i => <option key={i.id} value={i.id}>{i.code} · {i.name}</option>)}</select>
          <input className={inp + ' w-24'} type="number" min="1" value={li.qty} onChange={e => setLi({ ...li, qty: Number(e.target.value) })} />
          <button className={btn2} onClick={() => li.item_id && setLines([...lines, li])}>Tambah baris</button></div>
        {lines.length > 0 && <><Table head={['Item', 'Qty', 'Estimasi']} rows={lines.map(l => [it(l.item_id)?.code, `${l.qty} ${it(l.item_id)?.purchase_uom}`, rp(l.qty * Number(it(l.item_id)?.last_price))])} />
          <p className="my-2 text-sm">Total estimasi <b>{rp(est)}</b></p>
          <button className={btn} onClick={() => run(supabase.rpc('submit_pr', { p_lines: lines }), () => setLines([]))}>Ajukan PR</button></>}
      </Card>}
      <Card title="Daftar PR"><Table head={['No', 'Estimasi', 'Rantai persetujuan', 'Status', '']} rows={(prs.data || []).map(p => {
        const next = p.steps[p.approvals.length], mine = p.status === 'pending' && next === role && p.requested_by !== uid
        return [p.pr_no, rp(p.est_total), p.steps.map((s, i) => <span key={s} className={`mr-1 rounded px-1.5 text-xs ${i < p.approvals.length ? 'bg-green-100' : 'bg-slate-100'}`}>{s}</span>), p.status + (p.reason ? ` (${p.reason})` : ''),
          mine && <span className="flex gap-1"><button className={btn} onClick={() => run(supabase.rpc('approve_pr', { p_id: p.id, p_ok: true }))}>Setujui</button><button className={btn2} onClick={() => reject(p.id)}>Tolak</button></span>]
      })} /></Card></>}
    {tab === 'po' && <>
      {['purchasing', 'admin'].includes(role) && <Card title="Buat PO dari PR disetujui"><div className="flex flex-wrap gap-2">
        <select className={inp} value={po.pr} onChange={e => setPo({ ...po, pr: e.target.value })}><option value="">PR…</option>{(prs.data || []).filter(p => p.status === 'approved').map(p => <option key={p.id} value={p.id}>{p.pr_no} · {rp(p.est_total)}</option>)}</select>
        <select className={inp} value={po.sup} onChange={e => setPo({ ...po, sup: e.target.value })}><option value="">Supplier…</option>{(sups.data || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select className={inp} value={po.wh} onChange={e => setPo({ ...po, wh: e.target.value })}><option value="">Gudang tujuan…</option>{(whs.data || []).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
        <button className={btn} onClick={() => run(supabase.rpc('create_po', { p_pr: po.pr, p_supplier: po.sup, p_wh: po.wh }))}>Buat PO</button></div></Card>}
      <Card title="Daftar PO"><Table head={['No', 'Supplier', 'Total', 'Penerimaan', 'Status', '']} rows={(pos.data || []).map(p => [p.po_no, p.suppliers?.name, rp(p.total), p.po_lines.map(l => `${l.items.code} ${num(l.received_qty)}/${num(l.qty)}`).join(', '), p.status,
        p.status === 'menunggu_gm' && role === 'gm' && <button className={btn} onClick={() => run(supabase.rpc('approve_po', { p_id: p.id }))}>Setujui</button>])} /></Card></>}
    {tab === 'grn' && ['storekeeper', 'admin'].includes(role) && (pos.data || []).filter(p => ['open', 'partial'].includes(p.status)).map(p => (
      <Card key={p.id} title={`${p.po_no} · ${p.suppliers?.name}`}>
        <Table head={['Item', 'Dipesan', 'Diterima', 'Terima sekarang']} rows={p.po_lines.map(l => [l.items.code, num(l.qty), num(l.received_qty), <input key={l.id} className={inp + ' w-24'} type="number" min="0" value={rc[l.id] ?? ''} onChange={e => setRc({ ...rc, [l.id]: e.target.value })} />])} />
        <button className={btn + ' mt-2'} onClick={() => run(supabase.rpc('receive_po', { p_po: p.id, p_lines: p.po_lines.map(l => ({ line_id: l.id, received: Number(rc[l.id] || 0), rejected: 0 })) }), () => setRc({}))}>Posting GRN</button>
      </Card>))}
    {tab === 'grn' && !['storekeeper', 'admin'].includes(role) && <Card><p className="text-sm text-slate-500">Hanya Storekeeper yang dapat menerima barang.</p></Card>}
  </>)
}
