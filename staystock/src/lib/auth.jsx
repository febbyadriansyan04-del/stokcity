import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase.js'
const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null), [ready, setReady] = useState(false)
  const [profile, setProfile] = useState(null), [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!ready) return
    if (!session) { setProfile(null); setLoading(false); return }
    supabase.from('profiles').select('*').eq('id', session.user.id).single()
      .then(({ data }) => { setProfile(data); setLoading(false) })
  }, [session, ready])
  return <Ctx.Provider value={{ session, profile, loading, role: profile?.role, signOut: () => supabase.auth.signOut() }}>{children}</Ctx.Provider>
}
