import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { inp, btn, Err } from '../components/ui.jsx'
export default function Login() {
  const { session } = useAuth()
  const [f, setF] = useState({ email: '', password: '', name: '' }), [signup, setSignup] = useState(false), [err, setErr] = useState(null), [msg, setMsg] = useState(null)
  if (session) return <Navigate to="/" replace />
  async function go(e) {
    e.preventDefault(); setErr(null); setMsg(null)
    const r = signup
      ? await supabase.auth.signUp({ email: f.email, password: f.password, options: { data: { full_name: f.name } } })
      : await supabase.auth.signInWithPassword({ email: f.email, password: f.password })
    if (r.error) setErr(r.error.message); else if (signup && !r.data.session) setMsg('Cek email untuk konfirmasi akun.')
  }
  return (
    <div className="mx-auto mt-24 w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6">
      <h1 className="mb-4 text-xl font-bold">StayStock</h1>
      <Err e={err} />{msg && <p className="mb-3 text-sm text-teal-700">{msg}</p>}
      <form onSubmit={go} className="grid gap-3">
        {signup && <input className={inp} placeholder="Nama lengkap" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required />}
        <input className={inp} type="email" placeholder="Email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} required />
        <input className={inp} type="password" placeholder="Kata sandi" minLength={8} value={f.password} onChange={e => setF({ ...f, password: e.target.value })} required />
        <button className={btn}>{signup ? 'Daftar' : 'Masuk'}</button>
      </form>
      <button className="mt-3 text-sm text-teal-700 underline" onClick={() => setSignup(!signup)}>{signup ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}</button>
    </div>
  )
}
