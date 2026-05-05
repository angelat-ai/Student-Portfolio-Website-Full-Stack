import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import FigmaEditor from '../components/FigmaEditor'
import {
  getSession, clearSession, calcAge,
  adminGetUsers, adminCreateUser, adminUpdateUser, adminToggleSuspend,
  getTemplates, getTrashedTemplates, createTemplate, updateTemplate, deleteTemplate,
  getAnnouncements, addAnnouncement,
  getCategories, addCategory, deleteCategory,
  getAdminStats, getSiteContent, saveSiteContent,
  getFlaggedContent, resolveFlag, getNotifications, markNotificationsRead,
  ALL_CATEGORIES,
} from '../utils/api'
import './AdminDashboard.css'

/* ── INLINE LINE GRAPH ─────────────────────────────── */
function AdminLineGraph({ data = [], color = '#3b82f6', label, icon, total = 0, sub = '', mini = false }) {
  const vals = data.map(d => d.views || d.count || d.value || d.users || d.projects || d.flags || 0)
  const max = Math.max(...vals, 1)
  const W = mini ? 180 : 260, H = mini ? 50 : 72, pad = 6

  const pts = vals.length < 2 ? '' : vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * (W - pad * 2)
    const y = H - pad - ((v / max) * (H - pad * 2))
    return `${x},${y}`
  }).join(' ')

  const areaPath = vals.length < 2 ? '' : (() => {
    const pArr = vals.map((v, i) => {
      const x = pad + (i / (vals.length - 1)) * (W - pad * 2)
      const y = H - pad - ((v / max) * (H - pad * 2))
      return [x, y]
    })
    const first = pArr[0], last = pArr[pArr.length - 1]
    return `M${first[0]},${H} ${pArr.map(p => `L${p[0]},${p[1]}`).join(' ')} L${last[0]},${H} Z`
  })()

  const last7 = vals.slice(-7)
  const prev7 = vals.slice(-14, -7)
  const ls = last7.reduce((a, b) => a + b, 0)
  const ps = prev7.reduce((a, b) => a + b, 0)
  const trend = ps === 0 ? null : Math.round(((ls - ps) / ps) * 100)

  if (mini) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', flexShrink: 0 }}>
          <defs>
            <linearGradient id={`mg-${label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {areaPath && <path d={areaPath} fill={`url(#mg-${label})`} />}
          {pts && <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, color }}>{total.toLocaleString()}</div>
          <div style={{ fontSize: '.7rem', color: 'var(--text-dim)' }}>{label}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="ad-graph-card">
      <div className="ad-graph-header">
        <div className="ad-graph-icon" style={{ background: `${color}18`, color }}>
          <i className={`fa-solid ${icon}`} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="ad-graph-label">{label}</div>
          {sub && <div className="ad-graph-sub">{sub}</div>}
        </div>
        {trend !== null && (
          <div className={`ad-graph-trend ${trend >= 0 ? 'up' : 'down'}`}>
            <i className={`fa-solid fa-arrow-trend-${trend >= 0 ? 'up' : 'down'}`} />
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="ad-graph-total" style={{ color }}>{total.toLocaleString()}</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', marginTop: 6 }}>
        <defs>
          <linearGradient id={`ag-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {areaPath && <path d={areaPath} fill={`url(#ag-${label})`} />}
        {pts && (
          <>
            <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {vals.map((v, i) => {
              const x = pad + (i / Math.max(vals.length - 1, 1)) * (W - pad * 2)
              const y = H - pad - ((v / max) * (H - pad * 2))
              return <circle key={i} cx={x} cy={y} r={i === vals.length - 1 ? 4 : 2.5} fill={color} opacity={i === vals.length - 1 ? 1 : 0.45} />
            })}
          </>
        )}
        {vals.length < 2 && (
          <text x={W / 2} y={H / 2} textAnchor="middle" fill="rgba(255,255,255,0.12)" fontSize="11">No data yet</text>
        )}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, padding: '0 4px' }}>
        {data.slice(-5).map((d, i) => (
          <span key={i} style={{ fontSize: '.56rem', color: 'var(--text-dim)' }}>{(d.date || '').slice(5)}</span>
        ))}
      </div>
    </div>
  )
}

/* ── CATEGORY BAR CHART ──────────────────────────── */
function CategoryBars({ data = [] }) {
  if (!data.length) return null
  const max = data[0]?.count || 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map((c, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 120, fontSize: '.78rem', color: 'var(--text-muted)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.category || 'Uncategorized'}
          </span>
          <div style={{ flex: 1, background: 'rgba(255,255,255,.05)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
            <div style={{
              width: `${(c.count / max) * 100}%`, height: '100%',
              background: `hsl(${220 + i * 18}, 80%, 60%)`,
              borderRadius: 4, transition: 'width .5s ease'
            }} />
          </div>
          <span style={{ fontSize: '.76rem', color: 'var(--accent-light)', minWidth: 22, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.count}</span>
        </div>
      ))}
    </div>
  )
}

export default function AdminDashboard() {
  const nav = useNavigate()
  const [section, setSection] = useState('dashboard')
  const [stats, setStats] = useState({ users: 0, projects: 0, flags: 0, users_today: 0, projects_today: 0, views_by_day: [], category_stats: [], projects_by_day: [], users_by_day: [], flags_by_day: [] })
  const [users, setUsers] = useState([])
  const [templates, setTemplates] = useState([])
  const [trashedTemplates, setTrashedTemplates] = useState([])
  const [categories, setCategories] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [flagged, setFlagged] = useState([])
  const [notifications, setNotifications] = useState([])
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const [templateFilter, setTemplateFilter] = useState('all')
  const [userSearch, setUserSearch] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10
  const [userModal, setUserModal] = useState(null)
  const [userForm, setUserForm] = useState({ name: '', dob: '', sex: 'Male', role: 'student', address: '', email: '', password: '' })
  const [userFb, setUserFb] = useState('')
  const [catModal, setCatModal] = useState(false)
  const [catForm, setCatForm] = useState({ name: '', icon: 'fa-solid fa-folder', desc: '' })
  const [catFb, setCatFb] = useState('')
  const [annForm, setAnnForm] = useState({ title: '', message: '', audience: 'all' })
  const [annFb, setAnnFb] = useState('')
  const [contentForm, setContentForm] = useState({})
  const [contentFb, setContentFb] = useState('')
  const [showFigmaEditor, setShowFigmaEditor] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [tplNameModal, setTplNameModal] = useState(null)
  const [tplSaveData, setTplSaveData] = useState(null)
  const [tplMeta, setTplMeta] = useState({ name: '', category: 'presentation', desc: '' })
  const [showTplTrash, setShowTplTrash] = useState(false)
  const [tplDeleteConfirm, setTplDeleteConfirm] = useState(null)
  const [settingsSection, setSettingsSection] = useState('site')
  const [siteSettings, setSiteSettings] = useState({ siteName: 'SDMS', siteTagline: 'Student Digital Portfolio Management System', maintenanceMode: false, allowRegistration: true, contactEmail: '' })
  const [siteSettingsFb, setSiteSettingsFb] = useState('')
  const [secSettings, setSecSettings] = useState({ minPasswordLength: 8, sessionTimeout: 60, maxLoginAttempts: 5, twoFactor: false })
  const [secFb, setSecFb] = useState('')
  const [auditLog] = useState([
    { action: 'User login', user: 'admin@sdms.edu', time: new Date(Date.now() - 5 * 60000).toISOString(), type: 'info' },
    { action: 'Template created: "Modern Portfolio"', user: 'admin@sdms.edu', time: new Date(Date.now() - 22 * 60000).toISOString(), type: 'success' },
    { action: 'User suspended: student_02', user: 'admin@sdms.edu', time: new Date(Date.now() - 60 * 60000).toISOString(), type: 'warning' },
    { action: 'Announcement sent to all users', user: 'admin@sdms.edu', time: new Date(Date.now() - 3 * 3600000).toISOString(), type: 'info' },
    { action: 'Flagged comment resolved', user: 'admin@sdms.edu', time: new Date(Date.now() - 5 * 3600000).toISOString(), type: 'success' },
    { action: 'Category deleted: "Uncategorized"', user: 'admin@sdms.edu', time: new Date(Date.now() - 86400000).toISOString(), type: 'warning' },
    { action: 'New user registered: angel@student.edu', user: 'system', time: new Date(Date.now() - 90000000).toISOString(), type: 'info' },
    { action: 'Template deleted permanently', user: 'admin@sdms.edu', time: new Date(Date.now() - 172800000).toISOString(), type: 'danger' },
  ])

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  async function loadAll() {
    try {
      const [st, us, tpl, trash, cats, ann, content, flags, notifs] = await Promise.all([
        getAdminStats(), adminGetUsers(), getTemplates(), getTrashedTemplates(),
        getCategories(), getAnnouncements(), getSiteContent(), getFlaggedContent(), getNotifications(),
      ])
      setStats(st)
      setUsers(us)
      setTemplates(tpl)
      setTrashedTemplates(trash)
      setCategories(cats)
      setAnnouncements(ann)
      setContentForm(content)
      setFlagged(flags)
      setNotifications(notifs)
    } catch {}
  }

  useEffect(() => { loadAll() }, [section])

  function logout() { clearSession(); nav('/login') }
  function nav2(s) { setSection(s); document.getElementById('admin-main')?.scrollTo(0, 0) }

  const filteredUsers = users.filter(u =>
    (u.name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(userSearch.toLowerCase())
  )
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
  const pagedUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function openAddUser() { setUserForm({ name: '', dob: '', sex: 'Male', role: 'student', address: '', email: '', password: '' }); setUserFb(''); setUserModal('add') }
  function openEditUser(u) { setUserForm({ name: u.name || '', dob: u.dob || '', sex: u.sex || 'Male', role: u.role || 'student', address: u.address || '', email: u.email || '', password: '' }); setUserFb(''); setUserModal(u.id) }

  async function doSaveUser(e) {
    e.preventDefault()
    if (!userForm.name || !userForm.email) { setUserFb('Name and email are required.'); return }
    try {
      if (userModal === 'add') await adminCreateUser(userForm)
      else await adminUpdateUser(userModal, userForm)
      const us = await adminGetUsers()
      setUsers(us)
      setUserModal(null)
    } catch (err) { setUserFb(err.message || 'Error saving user.') }
  }

  async function toggleSuspend(id) {
    try { await adminToggleSuspend(id); const us = await adminGetUsers(); setUsers(us) } catch {}
  }

  async function doSendAnnouncement(e) {
    e.preventDefault()
    if (!annForm.title || !annForm.message) { setAnnFb('error:Please fill in all fields.'); return }
    try {
      await addAnnouncement(annForm)
      const ann = await getAnnouncements()
      setAnnouncements(ann)
      setAnnForm({ title: '', message: '', audience: 'all' })
      setAnnFb('✓ Announcement sent!')
      setTimeout(() => setAnnFb(''), 3000)
    } catch (err) { setAnnFb('error:' + err.message) }
  }

  async function doSaveContent(e) {
    e.preventDefault()
    try {
      await saveSiteContent(contentForm)
      setContentFb('✓ Content saved!')
      setTimeout(() => setContentFb(''), 3000)
      window.dispatchEvent(new Event('siteContentUpdated'))
    } catch (err) { setContentFb('⚠ ' + (err.message || 'Failed to save')) }
  }

  async function doAddCategory(e) {
    e.preventDefault()
    if (!catForm.name) { setCatFb('Name is required.'); return }
    try {
      await addCategory(catForm)
      const cats = await getCategories()
      setCategories(cats)
      setCatModal(false)
      setCatForm({ name: '', icon: 'fa-solid fa-folder', desc: '' })
    } catch (err) { setCatFb(err.message) }
  }

  async function doDeleteCategory(id) {
    try { await deleteCategory(id); const cats = await getCategories(); setCategories(cats) } catch {}
  }

  function openCreateTemplate() { setEditingTemplate(null); setShowFigmaEditor(true) }
  function openEditTemplate(tpl) { setEditingTemplate(tpl); setShowFigmaEditor(true) }

  function onEditorSave(data) {
    setShowFigmaEditor(false)
    setTplSaveData(data)
    setTplMeta({ name: editingTemplate?.name || 'New Template', category: editingTemplate?.category || 'presentation', desc: editingTemplate?.desc || '' })
    setTplNameModal(true)
  }

  async function doFinalSaveTemplate(e) {
    e.preventDefault()
    if (!tplMeta.name) return
    const allEls = Object.values(tplSaveData.elements || {}).flat()
    const thumbnail = generateThumbnail(allEls, tplSaveData.bg)
    const payload = { name: tplMeta.name, category: tplMeta.category, desc: tplMeta.desc, preview_icon: 'fa-solid fa-palette', color: '#2563eb', elements: allEls, pages: tplSaveData.pages, bg: tplSaveData.bg, thumbnail }
    try {
      if (editingTemplate) await updateTemplate(editingTemplate.id, payload)
      else await createTemplate(payload)
      const [tpl, trash] = await Promise.all([getTemplates(), getTrashedTemplates()])
      setTemplates(tpl); setTrashedTemplates(trash)
      setTplNameModal(false); setTplSaveData(null); setEditingTemplate(null)
    } catch {}
  }

  function generateThumbnail(elements, bg) {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 400; canvas.height = 280
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = bg || '#ffffff'; ctx.fillRect(0, 0, 400, 280)
      const scaleX = 400 / 800, scaleY = 280 / 560
      elements.forEach(el => {
        if (el.type === 'text') {
          ctx.fillStyle = el.color || '#000'
          ctx.font = `${el.fontWeight || '400'} ${(el.fontSize || 20) * scaleX}px ${el.fontFamily || 'Arial'}`
          ctx.fillText(el.content || '', el.x * scaleX, (el.y + (el.fontSize || 20)) * scaleY)
        } else if (el.type !== 'triangle' && el.type !== 'line' && el.fill && !el.fill.startsWith('url')) {
          ctx.fillStyle = el.fill
          if (el.type === 'circle') { ctx.beginPath(); ctx.ellipse((el.x + el.w / 2) * scaleX, (el.y + el.h / 2) * scaleY, (el.w / 2) * scaleX, (el.h / 2) * scaleY, 0, 0, Math.PI * 2); ctx.fill() }
          else { const r = el.type === 'rounded' ? 8 : el.type === 'frame' ? 4 : 0; ctx.beginPath(); ctx.roundRect(el.x * scaleX, el.y * scaleY, el.w * scaleX, el.h * scaleY, r); ctx.fill() }
        }
      })
      return canvas.toDataURL()
    } catch { return '' }
  }

  const activeTemplates = templates.filter(t => !t.deleted)
  const filteredTemplates = templateFilter === 'all' ? activeTemplates : activeTemplates.filter(t => t.category === templateFilter)
  const TPL_CATS = ['all', 'marketing', 'business', 'video', 'social', 'education', 'presentation', 'poster', 'resume', 'logo']
  const unreadNotifs = notifications.filter(n => !n.is_read).length

  const sideItems = [
    { key: 'dashboard', icon: 'gauge', label: 'Dashboard', group: 'Overview' },
    { key: 'users', icon: 'users', label: 'User Management' },
    { key: 'content', icon: 'images', label: 'Content Management' },
    { key: 'announcements', icon: 'bullhorn', label: 'Announcement' },
    { key: '_sys', label: 'System', group: true },
    { key: 'templates', icon: 'table-cells-large', label: 'Templates' },
    { key: 'categories', icon: 'list', label: 'Categories' },
    { key: 'reports', icon: 'clipboard-list', label: 'Reports' },
    { key: 'settings', icon: 'gear', label: 'Settings' },
  ]

  if (showFigmaEditor) {
    const initData = editingTemplate
      ? { pages: editingTemplate.pages || ['Page 1'], elements: { 0: JSON.parse(JSON.stringify(editingTemplate.elements || [])) }, bg: editingTemplate.bg || '#ffffff' }
      : { pages: ['Page 1'], elements: { 0: [] }, bg: '#ffffff' }
    return (
      <FigmaEditor
        initialData={initData}
        canvasLabel={editingTemplate ? `Edit: ${editingTemplate.name}` : 'New Template'}
        onClose={() => setShowFigmaEditor(false)}
        onSave={onEditorSave}
      />
    )
  }

  return (
    <div className="ad-wrap">
      {/* NOTIF PANEL */}
      {showNotifPanel && (
        <div className="ad-notif-panel">
          <div className="ad-notif-panel-header">
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '.95rem' }}>Notifications</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={async () => { await markNotificationsRead(); const n = await getNotifications(); setNotifications(n) }} style={{ background: 'none', border: 'none', color: 'var(--accent-light)', fontSize: '.72rem', cursor: 'pointer' }}>Mark all read</button>
              <button onClick={() => setShowNotifPanel(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><i className="fa-solid fa-xmark" /></button>
            </div>
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {notifications.length === 0 && <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '.84rem' }}>No notifications yet</div>}
            {notifications.map((n, i) => (
              <div key={n.id || i} style={{ padding: '11px 16px', borderBottom: '1px solid var(--card-border)', display: 'flex', gap: 10, alignItems: 'flex-start', background: n.is_read ? 'none' : 'rgba(37,99,235,.05)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(37,99,235,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--accent-light)', fontSize: '.82rem' }}>
                  <i className={`fa-solid fa-${n.notif_type === 'like' ? 'heart' : n.notif_type === 'comment' ? 'comment' : 'eye'}`} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '.82rem', marginBottom: 2 }}>{n.message}</div>
                  <div style={{ fontSize: '.68rem', color: 'var(--text-dim)' }}>{new Date(n.created_at).toLocaleString()}</div>
                </div>
                {!n.is_read && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 5 }} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TOPNAV */}
      <header className="ad-topnav">
        <div className="ad-topnav-left">
          <div className="ad-logo">SDMS</div>
          <nav className="ad-toplinks">
            <button className={section === 'dashboard' ? 'ad-toplink active' : 'ad-toplink'} onClick={() => nav2('dashboard')}>Dashboard</button>
          </nav>
        </div>
        <div className="ad-topnav-right">
          <button className="ad-notif-btn" onClick={() => setShowNotifPanel(o => !o)} title="Notifications">
            <i className="fa-regular fa-bell" />
            {unreadNotifs > 0 && <span className="ad-notif-badge">{unreadNotifs}</span>}
          </button>
          <span className="ad-role-badge">Admin</span>
        </div>
      </header>

      <div className="ad-layout">
        <aside className="ad-sidebar">
          {sideItems.map(item => {
            if (item.group === true) return <div key={item.key} className="ad-sidebar-label">{item.label}</div>
            if (item.group === 'Overview') return (
              <React.Fragment key={item.key}>
                <div className="ad-sidebar-label">Overview</div>
                <button className={`ad-sidebar-item${section === item.key ? ' active' : ''}`} onClick={() => nav2(item.key)}>
                  <i className={`fa-solid fa-${item.icon}`} /> {item.label}
                </button>
              </React.Fragment>
            )
            return (
              <button key={item.key} className={`ad-sidebar-item${section === item.key ? ' active' : ''}`} onClick={() => nav2(item.key)}>
                <i className={`fa-solid fa-${item.icon}`} /> {item.label}
              </button>
            )
          })}
          <button className="ad-sidebar-item ad-logout" onClick={logout}><i className="fa-solid fa-right-from-bracket" /> Log Out</button>
        </aside>

        <main className="ad-main" id="admin-main">

          {/* ── DASHBOARD ── */}
          {section === 'dashboard' && (
            <div className="ad-section">
              <div className="ad-section-header">
                <div>
                  <h2 className="ad-section-title">Admin Dashboard</h2>
                  <p className="ad-section-sub">System Overview &nbsp;·&nbsp; {dateStr}</p>
                </div>
              </div>

              {/* STAT CARDS — no portfolio views, that's student-only */}
              <div className="ad-stats-grid">
                {[
                  { icon: 'fa-user', color: '#a78bfa', val: stats.users, label: 'Total Users', sub: `+${stats.users_today || 0} today` },
                  { icon: 'fa-folder', color: '#34d399', val: stats.projects, label: 'Projects Uploaded', sub: `+${stats.projects_today || 0} today` },
                  { icon: 'fa-flag', color: '#f87171', val: stats.flags, label: 'Flagged Content', sub: 'Needs review' },
                  { icon: 'fa-bullhorn', color: '#fbbf24', val: announcements.length, label: 'Announcements', sub: 'Sent this session' },
                ].map(s => (
                  <div className="ad-stat-card" key={s.label} style={{ borderTop: `3px solid ${s.color}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div className="ad-stat-icon" style={{ color: s.color, background: `${s.color}18` }}>
                        <i className={`fa-solid ${s.icon}`} />
                      </div>
                    </div>
                    <div className="ad-stat-val">{s.val}</div>
                    <div className="ad-stat-name">{s.label}</div>
                    <div className="ad-stat-sub">{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* LINE GRAPHS */}
              <div className="ad-graphs-grid">
                <AdminLineGraph
                  data={stats.views_by_day || []}
                  color="#3b82f6"
                  label="Portfolio Views"
                  icon="fa-eye"
                  total={stats.total_views || 0}
                  sub="Last 14 days"
                />
                <AdminLineGraph
                  data={stats.projects_by_day || []}
                  color="#34d399"
                  label="Projects Uploaded"
                  icon="fa-folder"
                  total={stats.projects || 0}
                  sub="Last 14 days"
                />
                <AdminLineGraph
                  data={stats.users_by_day || []}
                  color="#a78bfa"
                  label="New Users"
                  icon="fa-user-plus"
                  total={stats.users || 0}
                  sub="Last 14 days"
                />
                <AdminLineGraph
                  data={stats.flags_by_day || []}
                  color="#f87171"
                  label="Flagged Content"
                  icon="fa-flag"
                  total={stats.flags || 0}
                  sub="Last 14 days"
                />
              </div>

              {/* CATEGORY BARS */}
              {stats.category_stats && stats.category_stats.length > 0 && (
                <div className="ad-card" style={{ marginBottom: 18 }}>
                  <h3 className="ad-card-title">Projects by Category</h3>
                  <CategoryBars data={stats.category_stats} />
                </div>
              )}

              {/* BOTTOM ROW */}
              <div className="ad-dashboard-bottom">
                <div className="ad-card">
                  <h3 className="ad-card-title">Moderation Queue</h3>
                  {flagged.length === 0 ? (
                    <div className="empty-state" style={{ padding: '20px 0' }}>
                      <i className="fa-solid fa-shield-halved" />
                      <p>All clear — no items to review</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {flagged.slice(0, 5).map((f, i) => (
                        <div key={f.id || i} className="ad-flag-item">
                          <div style={{ fontSize: '.74rem', color: 'var(--red)', marginBottom: 4 }}>
                            <i className="fa-solid fa-triangle-exclamation" /> {f.reason}
                          </div>
                          <div style={{ fontSize: '.82rem', marginBottom: 4 }}>"{f.comment_text}"</div>
                          <div style={{ fontSize: '.72rem', color: 'var(--text-dim)', marginBottom: 8 }}>
                            by {f.author_name} on "{f.project_title}"
                          </div>
                          <div style={{ display: 'flex', gap: 7 }}>
                            <button className="btn-outline" style={{ fontSize: '.72rem', padding: '4px 10px' }}
                              onClick={async () => { await resolveFlag(f.id, 'resolve'); const fl = await getFlaggedContent(); setFlagged(fl); const st = await getAdminStats(); setStats(st) }}>
                              Dismiss
                            </button>
                            <button className="btn-danger" style={{ fontSize: '.72rem', padding: '4px 10px' }}
                              onClick={async () => { await resolveFlag(f.id, 'delete'); const fl = await getFlaggedContent(); setFlagged(fl); const st = await getAdminStats(); setStats(st) }}>
                              Delete Comment
                            </button>
                          </div>
                        </div>
                      ))}
                      {flagged.length > 5 && <div style={{ fontSize: '.78rem', color: 'var(--text-dim)', textAlign: 'center' }}>+{flagged.length - 5} more in Reports</div>}
                    </div>
                  )}
                </div>

                <div className="ad-card">
                  <h3 className="ad-card-title">Activity Feed</h3>
                  {announcements.slice(0, 6).map((a, i) => (
                    <div className="ad-activity-item" key={i}>
                      <div className="ad-activity-dot" />
                      <div>
                        <div className="ad-activity-text">Announcement: {a.title}</div>
                        <div className="ad-activity-time">{new Date(a.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                  {announcements.length === 0 && (
                    <div className="empty-state" style={{ padding: '20px 0' }}>
                      <i className="fa-solid fa-list" /><p>No recent activity</p>
                    </div>
                  )}
                </div>
              </div>

              {/* USER TABLE QUICK LOOK */}
              <div className="ad-card">
                <div className="ad-um-header">
                  <h3 className="ad-card-title" style={{ marginBottom: 0 }}>User Management</h3>
                  <div className="ad-um-actions">
                    <div className="ad-search-bar">
                      <i className="fa-solid fa-magnifying-glass" />
                      <input placeholder="Search users..." value={userSearch} onChange={e => { setUserSearch(e.target.value); setPage(1) }} />
                    </div>
                    <button className="btn-primary" onClick={openAddUser}><i className="fa-solid fa-plus" /> Add User</button>
                  </div>
                </div>
                <UsersTable users={pagedUsers} onEdit={openEditUser} onSuspend={toggleSuspend} />
                <div className="ad-pagination">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))}><i className="fa-solid fa-chevron-left" /></button>
                  <span>Page {page} of {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))}><i className="fa-solid fa-chevron-right" /></button>
                </div>
              </div>
            </div>
          )}

          {/* ── USERS ── */}
          {section === 'users' && (
            <div className="ad-section">
              <div className="ad-section-header">
                <div><h2 className="ad-section-title">User Management</h2><p className="ad-section-sub">Manage all platform users</p></div>
                <button className="btn-primary" onClick={openAddUser}><i className="fa-solid fa-plus" /> Add User</button>
              </div>
              <div className="ad-search-bar" style={{ marginBottom: 18, maxWidth: 400 }}>
                <i className="fa-solid fa-magnifying-glass" />
                <input placeholder="Search by name or email..." value={userSearch} onChange={e => { setUserSearch(e.target.value); setPage(1) }} />
              </div>
              <UsersTable users={pagedUsers} onEdit={openEditUser} onSuspend={toggleSuspend} />
              <div className="ad-pagination">
                <button onClick={() => setPage(p => Math.max(1, p - 1))}><i className="fa-solid fa-chevron-left" /></button>
                <span>Page {page} of {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))}><i className="fa-solid fa-chevron-right" /></button>
              </div>
            </div>
          )}

          {/* ── CONTENT ── */}
          {section === 'content' && (
            <div className="ad-section">
              <div className="ad-section-header">
                <div><h2 className="ad-section-title">Content Management</h2><p className="ad-section-sub">Edit the landing page content</p></div>
                <button className="btn-primary" onClick={doSaveContent}><i className="fa-solid fa-save" /> Save Changes</button>
              </div>
              <form className="ad-form-card" onSubmit={doSaveContent}>
                <div className="field-group"><label>Hero Title</label><input value={contentForm.heroTitle || ''} onChange={e => setContentForm(f => ({ ...f, heroTitle: e.target.value }))} /></div>
                <div className="field-group"><label>Hero Subtitle</label><textarea rows={3} value={contentForm.heroSub || ''} onChange={e => setContentForm(f => ({ ...f, heroSub: e.target.value }))} /></div>
                <div className="field-row">
                  <div className="field-group"><label>Student Portfolios Count</label><input type="number" value={contentForm.stat1 || 0} onChange={e => setContentForm(f => ({ ...f, stat1: e.target.value }))} /></div>
                  <div className="field-group"><label>Departments Count</label><input type="number" value={contentForm.stat2 || 0} onChange={e => setContentForm(f => ({ ...f, stat2: e.target.value }))} /></div>
                  <div className="field-group"><label>Project Uploads Count</label><input type="number" value={contentForm.stat3 || 0} onChange={e => setContentForm(f => ({ ...f, stat3: e.target.value }))} /></div>
                </div>
                <div className="field-group"><label>CTA Heading</label><input value={contentForm.ctaHead || ''} onChange={e => setContentForm(f => ({ ...f, ctaHead: e.target.value }))} /></div>
                <div className="field-group"><label>CTA Subtext</label><textarea rows={2} value={contentForm.ctaSub || ''} onChange={e => setContentForm(f => ({ ...f, ctaSub: e.target.value }))} /></div>
                <div className="field-group"><label>Featured Categories (comma-separated)</label><input value={contentForm.cats || ''} onChange={e => setContentForm(f => ({ ...f, cats: e.target.value }))} /></div>
                {contentFb && <div className="save-feedback">{contentFb}</div>}
              </form>
            </div>
          )}

          {/* ── ANNOUNCEMENTS ── */}
          {section === 'announcements' && (
            <div className="ad-section">
              <div className="ad-section-header"><div><h2 className="ad-section-title">Announcements</h2><p className="ad-section-sub">Send notifications to students</p></div></div>
              <form className="ad-form-card" style={{ maxWidth: 620, marginBottom: 32 }} onSubmit={doSendAnnouncement}>
                <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 18 }}>New Announcement</h3>
                <div className="field-group"><label>Title</label><input value={annForm.title} onChange={e => setAnnForm(f => ({ ...f, title: e.target.value }))} placeholder="Announcement title..." /></div>
                <div className="field-group"><label>Message</label><textarea rows={5} value={annForm.message} onChange={e => setAnnForm(f => ({ ...f, message: e.target.value }))} placeholder="Write your announcement here..." /></div>
                <div className="field-group"><label>Audience</label>
                  <select value={annForm.audience} onChange={e => setAnnForm(f => ({ ...f, audience: e.target.value }))}>
                    <option value="all">All Users</option>
                    <option value="students">Students Only</option>
                  </select>
                </div>
                <button type="submit" className="btn-primary"><i className="fa-solid fa-paper-plane" /> Send Announcement</button>
                {annFb && <div className={`save-feedback${annFb.startsWith('error:') ? ' error' : ''}`}>{annFb.replace('error:', '')}</div>}
              </form>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, marginBottom: 14 }}>Sent Announcements ({announcements.length})</h3>
              {announcements.length === 0 ? <div className="empty-state"><i className="fa-solid fa-bullhorn" /><p>No announcements yet</p></div> : (
                announcements.map((a, i) => (
                  <div className="ad-ann-item" key={i}>
                    <div className="ad-ann-header"><div className="ad-ann-title">{a.title}</div><span className="ad-ann-audience">{a.audience}</span></div>
                    <div className="ad-ann-msg">{a.message}</div>
                    <div className="ad-ann-date">{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── TEMPLATES ── */}
          {section === 'templates' && (
            <div className="ad-section">
              <div className="ad-section-header">
                <div><h2 className="ad-section-title">Templates</h2><p className="ad-section-sub">Create and manage portfolio templates for students</p></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-outline" onClick={() => setShowTplTrash(t => !t)}><i className="fa-solid fa-trash-can" /> {showTplTrash ? 'Active' : 'Trash'} ({trashedTemplates.length})</button>
                  <button className="btn-primary" onClick={openCreateTemplate}><i className="fa-solid fa-plus" /> Create Template</button>
                </div>
              </div>
              <div className="ad-tpl-cats">
                {TPL_CATS.map(cat => (
                  <button key={cat} className={`ad-tpl-cat-btn${templateFilter === cat ? ' active' : ''}`} onClick={() => setTemplateFilter(cat)}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>
              {filteredTemplates.length === 0 ? <div className="empty-state"><i className="fa-solid fa-palette" /><p>No templates yet. Create one!</p></div> : (
                <div className="ad-tpl-grid">
                  {filteredTemplates.map(t => (
                    <div className="ad-tpl-card" key={t.id}>
                      <div className="ad-tpl-preview" style={{ background: `linear-gradient(135deg,${t.color || '#2563eb'},${t.color || '#2563eb'}88)` }}>
                        {t.thumbnail ? <img src={t.thumbnail} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <i className={`${t.preview_icon || 'fa-solid fa-palette'}`} style={{ fontSize: '3rem', color: '#fff', opacity: .9 }} />}
                      </div>
                      <div className="ad-tpl-info">
                        <div className="ad-tpl-title">{t.name}</div>
                        <div className="ad-tpl-cat">{t.category}</div>
                        <div className="ad-tpl-desc">{t.desc}</div>
                        <div className="ad-tpl-actions">
                          <button onClick={() => setTplDeleteConfirm(t.id)} className="btn-danger"><i className="fa-solid fa-trash" /> Delete</button>
                          <button onClick={() => openEditTemplate(t)} className="btn-outline"><i className="fa-solid fa-pen" /> Edit</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {showTplTrash && (
                <div style={{ marginTop: 28 }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, marginBottom: 14, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="fa-solid fa-trash-can" /> Trash Bin ({trashedTemplates.length})
                  </h3>
                  {trashedTemplates.length === 0 ? <div className="empty-state" style={{ padding: '24px 0' }}><p>Trash is empty</p></div> : (
                    <div className="ad-tpl-grid">
                      {trashedTemplates.map(t => (
                        <div className="ad-tpl-card" key={t.id} style={{ opacity: .6, filter: 'grayscale(40%)' }}>
                          <div className="ad-tpl-preview" style={{ background: `linear-gradient(135deg,${t.color || '#2563eb'},${t.color || '#2563eb'}88)` }}>
                            {t.thumbnail ? <img src={t.thumbnail} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <i className="fa-solid fa-palette" style={{ fontSize: '2.5rem', color: '#fff', opacity: .7 }} />}
                          </div>
                          <div className="ad-tpl-info">
                            <div className="ad-tpl-title">{t.name}</div>
                            <div style={{ fontSize: '.72rem', color: 'var(--text-dim)', marginBottom: 8 }}>Deleted {t.deleted_at ? new Date(t.deleted_at).toLocaleDateString() : ''}</div>
                            <div className="ad-tpl-actions">
                              <button className="btn-outline" onClick={async () => { await deleteTemplate(t.id, 'restore'); const [tpl, trash] = await Promise.all([getTemplates(), getTrashedTemplates()]); setTemplates(tpl); setTrashedTemplates(trash) }}>
                                <i className="fa-solid fa-rotate-left" /> Restore
                              </button>
                              <button className="btn-danger" onClick={async () => { await deleteTemplate(t.id, 'permanent'); const [tpl, trash] = await Promise.all([getTemplates(), getTrashedTemplates()]); setTemplates(tpl); setTrashedTemplates(trash) }}>
                                <i className="fa-solid fa-trash" /> Delete Forever
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── CATEGORIES ── */}
          {section === 'categories' && (
            <div className="ad-section">
              <div className="ad-section-header">
                <div><h2 className="ad-section-title">Categories</h2><p className="ad-section-sub">Manage portfolio categories visible to students</p></div>
                <button className="btn-primary" onClick={() => setCatModal(true)}><i className="fa-solid fa-plus" /> Add Category</button>
              </div>
              {categories.length === 0 && <div className="empty-state"><i className="fa-solid fa-list" /><p>No categories yet. Add some!</p></div>}
              {categories.map((c, i) => (
                <div className="ad-cat-item" key={c.id || i}>
                  <div className="ad-cat-info">
                    <div className="ad-cat-icon"><i className={c.icon || 'fa-solid fa-folder'} /></div>
                    <div><div className="ad-cat-name">{c.name}</div><div className="ad-cat-desc">{c.desc}</div></div>
                  </div>
                  <button className="btn-danger" onClick={() => doDeleteCategory(c.id)}><i className="fa-solid fa-trash" /></button>
                </div>
              ))}
            </div>
          )}

          {/* ── REPORTS ── */}
          {section === 'reports' && (
            <div className="ad-section">
              <div className="ad-section-header"><div><h2 className="ad-section-title">Reports & Moderation</h2></div></div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, marginBottom: 14, color: 'var(--red)' }}>Flagged Content ({flagged.length})</h3>
              {flagged.length === 0 ? (
                <div className="empty-state"><i className="fa-solid fa-shield-halved" /><p>No flagged content. All clear!</p></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {flagged.map((f, i) => (
                    <div key={f.id || i} className="ad-flag-item" style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <span style={{ fontSize: '.72rem', color: 'var(--red)', background: 'rgba(248,113,113,.1)', padding: '2px 8px', borderRadius: 20, marginRight: 8 }}>
                            <i className="fa-solid fa-triangle-exclamation" /> {f.reason}
                          </span>
                          <span style={{ fontSize: '.72rem', color: 'var(--text-dim)' }}>{f.detected_words}</span>
                        </div>
                        <span style={{ fontSize: '.68rem', color: 'var(--text-dim)' }}>{new Date(f.created_at).toLocaleString()}</span>
                      </div>
                      <div style={{ fontSize: '.88rem', marginBottom: 4, padding: '8px 12px', background: 'rgba(255,255,255,.03)', borderRadius: 7, borderLeft: '3px solid rgba(248,113,113,.4)' }}>"{f.comment_text}"</div>
                      <div style={{ fontSize: '.74rem', color: 'var(--text-dim)', marginBottom: 10 }}>
                        by <strong style={{ color: 'var(--text-muted)' }}>{f.author_name}</strong> on "<strong style={{ color: 'var(--text-muted)' }}>{f.project_title}</strong>"
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-outline" style={{ fontSize: '.76rem', padding: '5px 12px' }} onClick={async () => { await resolveFlag(f.id, 'resolve'); const fl = await getFlaggedContent(); setFlagged(fl); const st = await getAdminStats(); setStats(st) }}>✓ Dismiss</button>
                        <button className="btn-danger" style={{ fontSize: '.76rem', padding: '5px 12px' }} onClick={async () => { await resolveFlag(f.id, 'delete'); const fl = await getFlaggedContent(); setFlagged(fl); const st = await getAdminStats(); setStats(st) }}>
                          <i className="fa-solid fa-trash" /> Delete Comment
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── SETTINGS ── */}
          {section === 'settings' && (
            <div className="ad-section">
              <div className="ad-section-header"><div><h2 className="ad-section-title">Settings</h2><p className="ad-section-sub">Platform configuration and administration</p></div></div>
              <div className="ad-settings-layout">
                <div className="ad-settings-sidebar">
                  {[
                    ['site', 'fa-solid fa-globe', 'Site Configuration'],
                    ['security', 'fa-solid fa-shield-halved', 'Security'],
                    ['audit', 'fa-solid fa-scroll', 'Audit Log'],
                  ].map(([key, icon, label]) => (
                    <button key={key} className={`ad-settings-tab${settingsSection === key ? ' active' : ''}`} onClick={() => setSettingsSection(key)}>
                      <i className={icon} /> {label}
                    </button>
                  ))}
                </div>
                <div className="ad-settings-content">

                  {settingsSection === 'site' && (
                    <div className="ad-form-card">
                      <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 20 }}>Site Configuration</h3>
                      <div className="field-group">
                        <label>Platform Name</label>
                        <input value={siteSettings.siteName} onChange={e => setSiteSettings(s => ({ ...s, siteName: e.target.value }))} />
                      </div>
                      <div className="field-group">
                        <label>Tagline / Subtitle</label>
                        <input value={siteSettings.siteTagline} onChange={e => setSiteSettings(s => ({ ...s, siteTagline: e.target.value }))} />
                      </div>
                      <div className="field-group">
                        <label>Administrator Contact Email</label>
                        <input type="email" value={siteSettings.contactEmail} onChange={e => setSiteSettings(s => ({ ...s, contactEmail: e.target.value }))} placeholder="admin@school.edu" />
                      </div>
                      <hr className="sd-divider" />
                      <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '.9rem', color: 'var(--accent-light)', marginBottom: 14 }}>Platform Controls</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {[
                          ['maintenanceMode', 'Maintenance Mode', 'When enabled, non-admin users will see a maintenance page.'],
                          ['allowRegistration', 'Allow New Registrations', 'When disabled, new users cannot sign up.'],
                        ].map(([key, label, desc]) => (
                          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'rgba(255,255,255,.03)', borderRadius: 10, border: '1px solid var(--card-border)' }}>
                            <div>
                              <div style={{ fontSize: '.88rem', fontWeight: 600 }}>{label}</div>
                              <div style={{ fontSize: '.76rem', color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
                            </div>
                            <label className="ad-toggle">
                              <input type="checkbox" checked={siteSettings[key]} onChange={e => setSiteSettings(s => ({ ...s, [key]: e.target.checked }))} />
                              <span className="ad-toggle-slider" />
                            </label>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 20 }}>
                        <button className="btn-primary" onClick={() => { setSiteSettingsFb('✓ Settings saved!'); setTimeout(() => setSiteSettingsFb(''), 2500) }}>
                          <i className="fa-solid fa-save" /> Save Configuration
                        </button>
                        {siteSettingsFb && <div className="save-feedback">{siteSettingsFb}</div>}
                      </div>
                    </div>
                  )}

                  {settingsSection === 'security' && (
                    <div className="ad-form-card">
                      <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 20 }}>Security Settings</h3>
                      <div className="field-row">
                        <div className="field-group">
                          <label>Minimum Password Length</label>
                          <input type="number" min="6" max="32" value={secSettings.minPasswordLength} onChange={e => setSecSettings(s => ({ ...s, minPasswordLength: parseInt(e.target.value) }))} />
                        </div>
                        <div className="field-group">
                          <label>Max Login Attempts</label>
                          <input type="number" min="3" max="20" value={secSettings.maxLoginAttempts} onChange={e => setSecSettings(s => ({ ...s, maxLoginAttempts: parseInt(e.target.value) }))} />
                        </div>
                      </div>
                      <div className="field-group">
                        <label>Session Timeout (minutes)</label>
                        <input type="number" min="15" max="1440" value={secSettings.sessionTimeout} onChange={e => setSecSettings(s => ({ ...s, sessionTimeout: parseInt(e.target.value) }))} />
                        <p style={{ fontSize: '.74rem', color: 'var(--text-dim)', marginTop: 4 }}>Users will be automatically logged out after this period of inactivity.</p>
                      </div>
                      <hr className="sd-divider" />
                      <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '.9rem', color: 'var(--accent-light)', marginBottom: 14 }}>Advanced</h4>
                      <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,.03)', borderRadius: 10, border: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '.88rem', fontWeight: 600 }}>Two-Factor Authentication (2FA)</div>
                          <div style={{ fontSize: '.76rem', color: 'var(--text-muted)', marginTop: 2 }}>Require 2FA for all admin accounts.</div>
                        </div>
                        <label className="ad-toggle">
                          <input type="checkbox" checked={secSettings.twoFactor} onChange={e => setSecSettings(s => ({ ...s, twoFactor: e.target.checked }))} />
                          <span className="ad-toggle-slider" />
                        </label>
                      </div>
                      <div style={{ marginTop: 20 }}>
                        <button className="btn-primary" onClick={() => { setSecFb('✓ Security settings saved!'); setTimeout(() => setSecFb(''), 2500) }}>
                          <i className="fa-solid fa-shield-halved" /> Save Security Settings
                        </button>
                        {secFb && <div className="save-feedback">{secFb}</div>}
                      </div>
                    </div>
                  )}

                  {settingsSection === 'audit' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div>
                          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700 }}>Audit Log</h3>
                          <p style={{ color: 'var(--text-muted)', fontSize: '.8rem', marginTop: 2 }}>All admin actions are recorded here for accountability and security.</p>
                        </div>
                        <button className="btn-outline" style={{ fontSize: '.78rem' }}>
                          <i className="fa-solid fa-download" /> Export Log
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {auditLog.map((entry, i) => (
                          <div key={i} className="ad-audit-entry">
                            <div className={`ad-audit-dot ${entry.type}`} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '.84rem', color: 'var(--text)' }}>{entry.action}</div>
                              <div style={{ fontSize: '.72rem', color: 'var(--text-dim)', marginTop: 2 }}>
                                <i className="fa-solid fa-user" style={{ marginRight: 4 }} />{entry.user}
                              </div>
                            </div>
                            <div style={{ fontSize: '.7rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                              {new Date(entry.time).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── MODALS ── */}

      {tplDeleteConfirm && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setTplDeleteConfirm(null) }}>
          <div className="modal-box">
            <div className="modal-header">
              <h3><i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--red)', marginRight: 8 }} />Confirm Delete</h3>
              <button className="modal-close" onClick={() => setTplDeleteConfirm(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body"><p style={{ color: 'var(--text-muted)' }}>Move this template to trash? Students will no longer be able to use it.</p></div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setTplDeleteConfirm(null)}>Cancel</button>
              <button className="btn-danger" onClick={async () => { await deleteTemplate(tplDeleteConfirm, 'soft'); const [tpl, trash] = await Promise.all([getTemplates(), getTrashedTemplates()]); setTemplates(tpl); setTrashedTemplates(trash); setTplDeleteConfirm(null) }}>
                Move to Trash
              </button>
            </div>
          </div>
        </div>
      )}

      {userModal !== null && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setUserModal(null) }}>
          <div className="modal-box">
            <div className="modal-header">
              <h3>{userModal === 'add' ? 'Add New User' : 'Edit User'}</h3>
              <button className="modal-close" onClick={() => setUserModal(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <form onSubmit={doSaveUser}>
              <div className="modal-body">
                <div className="field-row">
                  <div className="field-group"><label>Full Name *</label><input value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} /></div>
                  <div className="field-group"><label>Date of Birth</label><input type="date" value={userForm.dob} onChange={e => setUserForm(f => ({ ...f, dob: e.target.value }))} />{userForm.dob && <div style={{ fontSize: '.74rem', color: 'var(--accent-light)', marginTop: 4 }}>Age: {calcAge(userForm.dob)}</div>}</div>
                </div>
                <div className="field-row">
                  <div className="field-group"><label>Sex</label><select value={userForm.sex} onChange={e => setUserForm(f => ({ ...f, sex: e.target.value }))}><option>Male</option><option>Female</option><option>Other</option></select></div>
                  <div className="field-group"><label>Role</label><select value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}><option value="student">Student</option><option value="admin">Admin</option></select></div>
                </div>
                <div className="field-group"><label>Address</label><input value={userForm.address} onChange={e => setUserForm(f => ({ ...f, address: e.target.value }))} /></div>
                <div className="field-group"><label>Email *</label><input type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div className="field-group"><label>Password</label><input type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} placeholder="Leave blank to keep current" /></div>
                {userFb && <div className="save-feedback error">{userFb}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setUserModal(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Save User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {catModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setCatModal(false) }}>
          <div className="modal-box">
            <div className="modal-header"><h3>Add Category</h3><button className="modal-close" onClick={() => setCatModal(false)}><i className="fa-solid fa-xmark" /></button></div>
            <form onSubmit={doAddCategory}>
              <div className="modal-body">
                <div className="field-group"><label>Category Name *</label><input value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. IT, Arts" /></div>
                <div className="field-group"><label>Icon (FA class)</label><input value={catForm.icon} onChange={e => setCatForm(f => ({ ...f, icon: e.target.value }))} placeholder="fa-solid fa-laptop" /><div style={{ marginTop: 6, fontSize: '.72rem', color: 'var(--text-dim)' }}>Preview: <i className={catForm.icon} /></div></div>
                <div className="field-group"><label>Description</label><textarea rows={2} value={catForm.desc} onChange={e => setCatForm(f => ({ ...f, desc: e.target.value }))} /></div>
                <div style={{ marginTop: 10, padding: '10px', background: 'rgba(37,99,235,.06)', borderRadius: 8 }}>
                  <div style={{ fontSize: '.72rem', color: 'var(--text-dim)', marginBottom: 6 }}>Quick add from presets:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {ALL_CATEGORIES.slice(0, 20).map(c => (
                      <button type="button" key={c} onClick={() => setCatForm(f => ({ ...f, name: c }))} style={{ fontSize: '.68rem', padding: '2px 8px', borderRadius: 20, border: '1px solid var(--card-border)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>{c}</button>
                    ))}
                  </div>
                </div>
                {catFb && <div className="save-feedback error">{catFb}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setCatModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Add Category</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tplNameModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header"><h3>Save Template</h3><button className="modal-close" onClick={() => setTplNameModal(false)}><i className="fa-solid fa-xmark" /></button></div>
            <form onSubmit={doFinalSaveTemplate}>
              <div className="modal-body">
                <div className="field-group"><label>Template Name *</label><input value={tplMeta.name} onChange={e => setTplMeta(m => ({ ...m, name: e.target.value }))} /></div>
                <div className="field-group"><label>Category</label>
                  <select value={tplMeta.category} onChange={e => setTplMeta(m => ({ ...m, category: e.target.value }))}>
                    {['presentation', 'resume', 'logo', 'marketing', 'business', 'social', 'video', 'education', 'poster'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field-group"><label>Description</label><input value={tplMeta.desc} onChange={e => setTplMeta(m => ({ ...m, desc: e.target.value }))} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setTplNameModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary"><i className="fa-solid fa-save" /> Save Template</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function UsersTable({ users, onEdit, onSuspend }) {
  if (users.length === 0) return <div className="empty-state"><i className="fa-solid fa-users" /><p>No users found</p></div>
  return (
    <table className="ad-users-table">
      <thead>
        <tr>
          <th>Name</th><th>Email</th><th>Role</th><th>Age</th><th>Status</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {users.map(u => (
          <tr key={u.id}>
            <td>{u.name || '-'}</td>
            <td style={{ color: 'var(--text-muted)' }}>{u.email || '-'}</td>
            <td><span className={`ad-role-pill ${u.role || 'student'}`}>{u.role || 'student'}</span></td>
            <td>{u.dob ? calcAge(u.dob) : u.age || '-'}</td>
            <td><span className={`ad-status-pill ${u.is_active !== false ? 'active' : 'suspended'}`}>{u.is_active !== false ? 'Active' : 'Suspended'}</span></td>
            <td>
              <div style={{ display: 'flex', gap: 7 }}>
                <button className="ad-btn-edit" onClick={() => onEdit(u)}>Edit</button>
                <button className="ad-btn-suspend" onClick={() => onSuspend(u.id)}>{u.is_active !== false ? 'Suspend' : 'Restore'}</button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}