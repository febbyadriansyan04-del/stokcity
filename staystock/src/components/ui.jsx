export const inp = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-2 focus:outline-teal-600'
export const btn = 'rounded bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-40'
export const btn2 = 'rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50'
export const rp = n => 'Rp' + new Intl.NumberFormat('id-ID').format(Math.round(n || 0))
export const num = n => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n || 0)
export const Card = ({ title, children }) => (
  <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
    {title && <h2 className="mb-3 font-semibold">{title}</h2>}{children}
  </section>
)
export const Err = ({ e }) => e ? <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{e}</p> : null
export function Table({ head, rows }) {
  if (!rows.length) return <p className="py-4 text-center text-sm text-slate-500">Belum ada data.</p>
  return (
    <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm">
      <thead><tr>{head.map(h => <th key={h} className="border-b border-slate-200 p-2 text-left font-medium text-slate-500">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="border-b border-slate-100 p-2">{c}</td>)}</tr>)}</tbody>
    </table></div>
  )
}
