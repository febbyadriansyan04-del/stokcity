import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useData } from '../lib/useData.js'
import { useAuth } from '../lib/auth.jsx'
import { Card, Table, Err, inp, btn, num, rp } from '../components/ui.jsx'
const CATS = ['General Supplies', 'Housekeeping', 'Linen', 'F&B Dry Goods', 'F&B Fresh Goods', 'Beverage', 'Kitchen Supplies', 'Bar Supplies', 'Engineering', 'Spare Parts', 'Tools', 'Fixed Assets']
const blank = { code: '', name: '', category: CATS[0], base_uom: 'pcs', purchase_uom: 'Box', conv: 1, min_stock: 0, max_stock: 0, last_price: 0 }
export default function Items() {
  const { role } = useAuth(), canEdit = ['admin', 'gm', 'purchasing'].includes(role)
  const { data, error, reload } = useData(() => supabase.from('items').select('*').order('code'))
  const [f, setF] = useState(blank), [q, setQ] = useState(''), [err, setErr] = useState(null)
  const set = k => e => setF({ ...f, [k]: e.target.value })
  async function add(e) {
    e.preventDefault(); setErr(null)
    const conv = Number(f.conv), price = Number(f.last_price)
    if (!(conv > 0)) return setErr('Konversi harus lebih dari 0.')
    const { error } = await supabase.from('items').insert({ ...f, code: f.code.trim().toUpperCase(), conv, min_stock: Number(f.min_stock), max_stock: Number(f.max_stock), last_price: price, avg_cost: price / conv })
    if (error) setErr(error.message); else { setF(blank); reload() }
  }
  const rows = (data || []).filter(i => (i.code + i.name + i.category).toLowerCase().includes(q.toLowerCase()))
    .map(i => [i.code, i.name, i.category, `1 ${i.purchase_uom} = ${num(i.conv)} ${i.base_uom}`, rp(i.avg_cost), `${num(i.min_stock)} / ${num(i.max_stock)}`])
  return (<>
    <Err e={error || err} />
    <div className="mb-3"><input className={inp} placeholder="Cari atau pindai kode item" value={q} onChange={e => setQ(e.target.value)} /></div>
    <Card><Table head={['Kode', 'Nama', 'Kategori', 'Konversi', 'Biaya rata-rata', 'Min / Maks']} rows={rows} /></Card>
    {canEdit && <Card title="Tambah item"><form onSubmit={add} className="flex flex-wrap items-end gap-2">
      <input className={inp} placeholder="Kode" value={f.code} onChange={set('code')} required />
      <input className={inp} placeholder="Nama" value={f.name} onChange={set('name')} required />
      <select className={inp} value={f.category} onChange={set('category')}>{CATS.map(c => <option key={c}>{c}</option>)}</select>
      <input className={inp + ' w-20'} placeholder="Satuan dasar" value={f.base_uom} onChange={set('base_uom')} />
      <input className={inp + ' w-24'} placeholder="Satuan beli" value={f.purchase_uom} onChange={set('purchase_uom')} />
      <input className={inp + ' w-20'} type="number" step="any" placeholder="Konversi" value={f.conv} onChange={set('conv')} />
      <input className={inp + ' w-20'} type="number" placeholder="Min" value={f.min_stock} onChange={set('min_stock')} />
      <input className={inp + ' w-20'} type="number" placeholder="Maks" value={f.max_stock} onChange={set('max_stock')} />
      <input className={inp + ' w-28'} type="number" placeholder="Harga beli" value={f.last_price} onChange={set('last_price')} />
      <button className={btn}>Simpan item</button></form></Card>}
  </>)
}
