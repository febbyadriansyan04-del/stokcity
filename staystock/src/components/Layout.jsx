import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
const NAV = [['/', 'Dashboard'], ['/items', 'Item Master'], ['/stock', 'Stok'], ['/movements', 'Pergerakan', ['admin', 'storekeeper']], ['/procurement', 'Procurement']]
export default function Layout() {
  const { profile, role, signOut } = useAuth()
  return (
    <div className="min-h-screen md:grid md:grid-cols-[200px_1fr]">
      <aside className="bg-slate-900 p-3 text-slate-200 md:min-h-screen">
        <h1 className="mb-3 px-2 text-lg font-bold text-white">StayStock</h1>
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          {NAV.filter(n => !n[2] || n[2].includes(role)).map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `whitespace-nowrap rounded px-3 py-2 text-sm ${isActive ? 'bg-teal-600 font-semibold text-white' : 'hover:bg-white/10'}`}>{label}</NavLink>
          ))}
        </nav>
      </aside>
      <main className="p-4">
        <div className="mb-4 flex items-center justify-end gap-3 text-sm text-slate-600">
          <span>{profile?.full_name} · <b>{role}</b></span>
          <button onClick={signOut} className="rounded border border-slate-300 bg-white px-2 py-1">Keluar</button>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
