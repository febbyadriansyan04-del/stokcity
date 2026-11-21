import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useData } from '../lib/useData.js'
import { Card, Table, Err, inp, num, rp } from '../components/ui.jsx'
export default function Stock() {
  const items = useData(() => supabase.from('items').select('id,code,name,base_uom,avg_cost').order('code'))
  const whs = useData(() => supabase.from('warehouses').select('id,name'))
  const bal = useData(() => supabase.from('stock_balance').select('item_id,warehouse_id,qty'))
  const [sel, setSel] = useState('')
  const card = useData(() => sel ? supabase.from('stock_ledger').select('id,doc_no,tx_type,qty,created_at,warehouses(name)').eq('item_id', sel).order('id') : Promise.resolve({ data: [] }), [sel])
  const wn = Object.fromEntries((whs.data || []).map(w => [w.id, w.name]))
  const rows = (items.data || []).map(i => {
    const b = (bal.data || []).filter(x => x.item_id === i.id && Number(x.qty) !== 0), t = b.reduce((a, x) => a + Number(x.qty), 0)
    return [i.code, i.name, b.map(x => `${wn[x.warehouse_id]}: ${num(x.qty)}`).join(', ') || '–', `${num(t)} ${i.base_uom}`, rp(t * Number(i.avg_cost))]
  })
  let run = 0
  const cr = (card.data || []).map(l => { run += Number(l.qty); return [new Date(l.created_at).toLocaleString('id-ID'), l.doc_no, l.tx_type, l.warehouses?.name, (l.qty > 0 ? '+' : '') + num(l.qty), num(run)] })
  return (<>
    <Err e={items.error || bal.error} />
    <Card title="Saldo stok per gudang"><Table head={['Kode', 'Item', 'Per gudang', 'Total', 'Nilai']} rows={rows} /></Card>
    <Card title="Kartu stok">
      <select className={inp + ' mb-3'} value={sel} onChange={e => setSel(e.target.value)}><option value="">Pilih item…</option>{(items.data || []).map(i => <option key={i.id} value={i.id}>{i.code} · {i.name}</option>)}</select>
      <Table head={['Waktu', 'Dokumen', 'Jenis', 'Gudang', 'Qty', 'Saldo berjalan']} rows={cr} />
    </Card>
  </>)
}
