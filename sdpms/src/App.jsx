import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom'
import Loader from './components/Loader'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import StudentDashboard from './pages/StudentDashboard'
import AdminDashboard from './pages/AdminDashboard'
import { getSession, isLoggedIn } from './utils/api'

function ProtectedRoute({ children, role }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />
  const session = getSession()
  if (role && session.role !== role) return <Navigate to="/" replace />
  return children
}

function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20, padding: 40, textAlign: 'center'
    }}>
      <div style={{ fontSize: '6rem', lineHeight: 1 }}>🤔</div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', fontWeight: 800, color: '#fff' }}>404</h1>
      <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', maxWidth: 480 }}>
        Oops! Are you sure this is part of our website?
      </p>
      <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>
        The page you're looking for doesn't exist or may have been moved.
      </p>
      <Link to="/" style={{
        background: 'var(--accent)', color: '#fff', padding: '12px 28px',
        borderRadius: 10, fontWeight: 600, textDecoration: 'none', marginTop: 10,
        display: 'inline-flex', alignItems: 'center', gap: 8
      }}>
        <i className="fa-solid fa-house" /> Back to Home
      </Link>
    </div>
  )
}

export default function App() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const shown = sessionStorage.getItem('loaderShown')
    if (shown) { setLoading(false); return }
    sessionStorage.setItem('loaderShown', 'true')
    const t = setTimeout(() => setLoading(false), 2200)
    return () => clearTimeout(t)
  }, [])

  if (loading) return <Loader />

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/student" element={
        <ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>
      } />
      <Route path="/admin" element={
        <ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>
      } />
      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}