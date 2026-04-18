import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register, calcAge } from '../utils/api'
import './AuthPage.css'

export default function RegisterPage() {
  const nav = useNavigate()
  const [form, setForm] = useState({
    surname: '', firstName: '', middleName: '', suffix: '',
    dob: '', sex: '', address: '', email: '', password: ''
  })
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function doRegister(e) {
    e.preventDefault()
    setError('')
    if (!form.surname || !form.firstName || !form.email || !form.password) {
      setError('Surname, first name, email and password are required.')
      return
    }
    if (!form.dob) { setError('Date of birth is required.'); return }
    setLoading(true)
    try {
      const fullName = [form.surname, form.firstName, form.middleName, form.suffix]
        .filter(Boolean).join(' ')
      await register({
        name: fullName,
        dob: form.dob,
        sex: form.sex,
        address: form.address,
        email: form.email,
        password: form.password,
        role: 'student',
      })
      nav('/student')
    } catch (e) {
      setError(e.message || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  const age = form.dob ? calcAge(form.dob) : null

  return (
    <div className="auth-page">
      <nav className="auth-nav">
        <Link to="/" className="auth-brand">Student Digital Portfolio Management System</Link>
      </nav>
      <div className="auth-wrap">
        <div className="auth-panel">
          <h1>Create Account</h1>
          <p className="auth-sub">Join the SDPMS community</p>
          <form className="auth-card" onSubmit={doRegister}>
            <div className="field-group">
              <label>Surname *</label>
              <input type="text" placeholder="Last name" value={form.surname} onChange={e => set('surname', e.target.value)} />
            </div>
            <div className="field-row">
              <div className="field-group">
                <label>First Name *</label>
                <input type="text" placeholder="Given name" value={form.firstName} onChange={e => set('firstName', e.target.value)} />
              </div>
              <div className="field-group">
                <label>Middle Name</label>
                <input type="text" placeholder="Optional" value={form.middleName} onChange={e => set('middleName', e.target.value)} />
              </div>
            </div>
            <div className="field-group">
              <label>Suffix</label>
              <select value={form.suffix} onChange={e => set('suffix', e.target.value)}>
                <option value="">None</option>
                <option>Jr.</option>
                <option>Sr.</option>
                <option>II</option>
                <option>III</option>
                <option>IV</option>
              </select>
            </div>
            <div className="field-row">
              <div className="field-group">
                <label>Date of Birth *</label>
                <input type="date" value={form.dob} onChange={e => set('dob', e.target.value)} max={new Date().toISOString().split('T')[0]} />
                {age !== null && <div className="age-display">Age: <strong>{age}</strong></div>}
              </div>
              <div className="field-group">
                <label>Sex</label>
                <select value={form.sex} onChange={e => set('sex', e.target.value)}>
                  <option value="">Select</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Prefer not to say</option>
                </select>
              </div>
            </div>
            <div className="field-group">
              <label>Address</label>
              <input type="text" placeholder="City, Country" value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
            <div className="field-group">
              <label>Email *</label>
              <input type="email" placeholder="you@gmail.com or you@school.edu" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="field-group">
              <label>Password *</label>
              <div className="pass-wrap">
                <input type={showPass ? 'text' : 'password'} placeholder="••••••••" value={form.password} onChange={e => set('password', e.target.value)} />
                <button type="button" className="toggle-pass" onClick={() => setShowPass(s => !s)}>
                  <i className={`fa-solid fa-${showPass ? 'eye-slash' : 'eye'}`} />
                </button>
              </div>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
            <div className="auth-switch">
              Already have an account? <Link to="/login">Sign In</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}