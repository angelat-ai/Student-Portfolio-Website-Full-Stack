import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '../utils/api'
import './AuthPage.css'

export default function LoginPage() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function doLogin(ev) {
    ev.preventDefault()
    setError('')
    if (!email || !password) { 
      setError('Please fill in all fields.'); 
      return 
    }
    setLoading(true)
    try {
      const user = await login(email, password)
      if (!user || !user.role) {
        setError('Invalid email or password.')
        return
      }
      nav(user.role === 'admin' ? '/admin' : '/student')
    } catch (e) {
      setError('Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <nav className="auth-nav">
        <Link to="/" className="auth-brand">Student Digital Portfolio Management System</Link>
      </nav>
      <div className="auth-wrap">
        <div className="auth-panel">
          <h1>Welcome</h1>
          <p className="auth-sub">Sign in to your SDPMS account</p>
          <form className="auth-card" onSubmit={doLogin}>
            <div className="field-group">
              <label>Email</label>
              <input type="email" placeholder="you@school.edu" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="field-group">
              <label>Password</label>
              <div className="pass-wrap">
                <input type={showPass ? 'text' : 'password'} placeholder="" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
                <button type="button" className="toggle-pass" onClick={() => setShowPass(s => !s)}>
                  <i className={`fa-solid fa-${showPass ? 'eye-slash' : 'eye'}`} />
                </button>
              </div>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Signing in...' : 'Log In'}
            </button>
            <div className="auth-switch">
              Don't have an account? <Link to="/register">Sign Up</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}