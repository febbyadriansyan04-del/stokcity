import { supabase } from '../lib/supabase.js'
import { useData } from '../lib/useData.js'
import { Card, Table, Err, rp, num } from '../components/ui.jsx'
const K = ({ l, v }) => <div className="rounded-lg border border-slate-200 bg-white p-3"><b className="block text-xl">{v}</b><span className="text-xs text-slate-500">{l}</span></div>
export default function Dashboard() {
  const items = useData(() => supabase.from('items').select('*').eq('active', true))
  const bal = useData(() => supabase.from('stock_balance').select('item_id,qty'))
  const pr = useData(() => supabase.from('purchase_requests').select('id').eq('status', 'pending'))
  const po = useData(() => supabase.from('purchase_orders').select('id').eq('status', 'menunggu_gm'))
  const tot = {}; (bal.data || []).forEach(b => { tot[b.item_id] = (tot[b.item_id] || 0) + Number(b.qty) })
  const list = items.data || []
  const value = list.reduce((a, i) => a + (tot[i.id] || 0) * Number(i.avg_cost), 0)
  const low = list.filter(i => (tot[i.id] || 0) <= Number(i.min_stock))
  return (<>
    <Err e={items.error || bal.error} />
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      <K l="Total nilai persediaan" v={rp(value)} /><K l="Item aktif" v={list.length} /><K l="Di bawah minimum" v={low.length} /><K l="Menunggu persetujuan" v={(pr.data?.length || 0) + (po.data?.length || 0)} />
    </div>
    <Card title="Stok rendah"><Table head={['Item', 'Stok', 'Minimum']} rows={low.map(i => [`${i.code} · ${i.name}`, `${num(tot[i.id])} ${i.base_uom}`, num(i.min_stock)])} /></Card>
  </>)
}
