import { useEffect, useState } from 'react'
// fn mengembalikan promise Supabase ({ data, error })
export function useData(fn, deps = []) {
  const [data, setData] = useState(null), [error, setError] = useState(null), [n, setN] = useState(0)
  useEffect(() => {
    let live = true
    fn().then(r => { if (!live) return; if (r.error) setError(r.error.message); else { setError(null); setData(r.data) } })
    return () => { live = false }
  }, [...deps, n])
  return { data, error, reload: () => setN(x => x + 1) }
}
