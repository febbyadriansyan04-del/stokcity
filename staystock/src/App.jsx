import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Items from './pages/Items.jsx'
import Stock from './pages/Stock.jsx'
import Movements from './pages/Movements.jsx'
import Procurement from './pages/Procurement.jsx'

function Guard({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <p className="p-6">Memuat…</p>
  return session ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Guard><Layout /></Guard>}>
            <Route index element={<Dashboard />} />
            <Route path="items" element={<Items />} />
            <Route path="stock" element={<Stock />} />
            <Route path="movements" element={<Movements />} />
            <Route path="procurement" element={<Procurement />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
