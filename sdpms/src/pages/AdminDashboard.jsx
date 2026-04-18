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
} from '../utils/api'
import './AdminDashboard.css'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function buildCalendar(year, month) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return { firstDay, daysInMonth }
}

export default function AdminDashboard() {
  const nav = useNavigate()
  const [section, setSection] = useState('dashboard')
  const [stats, setStats] = useState({ users:0, projects:0, views:0, flags:0 })
  const [users, setUsers] = useState([])
  const [templates, setTemplates] = useState([])
  const [trashedTemplates, setTrashedTemplates] = useState([])
  const [categories, setCategories] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [templateFilter, setTemplateFilter] = useState('all')
  const [userSearch, setUserSearch] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10
  const [userModal, setUserModal] = useState(null)
  const [userForm, setUserForm] = useState({ name:'', dob:'', sex:'Male', role:'student', address:'', email:'', password:'' })
  const [userFb, setUserFb] = useState('')
  const [catModal, setCatModal] = useState(false)
  const [catForm, setCatForm] = useState({ name:'', icon:'fa-solid fa-folder', desc:'' })
  const [catFb, setCatFb] = useState('')
  const [annForm, setAnnForm] = useState({ title:'', message:'', audience:'all' })
  const [annFb, setAnnFb] = useState('')
  const [contentForm, setContentForm] = useState({})
  const [contentFb, setContentFb] = useState('')
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [calDay, setCalDay] = useState(null)
  const [showCal, setShowCal] = useState(false)
  const [showFigmaEditor, setShowFigmaEditor] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [tplNameModal, setTplNameModal] = useState(null)
  const [tplSaveData, setTplSaveData] = useState(null)
  const [tplMeta, setTplMeta] = useState({ name:'', category:'presentation', desc:'' })
  const [showTplTrash, setShowTplTrash] = useState(false)
  const [tplDeleteConfirm, setTplDeleteConfirm] = useState(null)

  const dateStr = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })

  async function loadAll() {
    try {
      const [st, us, tpl, trash, cats, ann, content] = await Promise.all([
        getAdminStats(),
        adminGetUsers(),
        getTemplates(),
        getTrashedTemplates(),
        getCategories(),
        getAnnouncements(),
        getSiteContent(),
      ])
      setStats(st)
      setUsers(us)
      setTemplates(tpl)
      setTrashedTemplates(trash)
      setCategories(cats)
      setAnnouncements(ann)
      setContentForm(content)
    } catch {}
  }

  useEffect(() => { loadAll() }, [section])

  function logout() { clearSession(); nav('/login') }
  function nav2(s) { setSection(s); document.getElementById('admin-main')?.scrollTo(0,0) }

  const filteredUsers = users.filter(u =>
    (u.name||'').toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.email||'').toLowerCase().includes(userSearch.toLowerCase())
  )
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
  const pagedUsers = filteredUsers.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)

  function openAddUser() { setUserForm({ name:'', dob:'', sex:'Male', role:'student', address:'', email:'', password:'' }); setUserFb(''); setUserModal('add') }
  function openEditUser(u) { setUserForm({ name:u.name||'', dob:u.dob||'', sex:u.sex||'Male', role:u.role||'student', address:u.address||'', email:u.email||'', password:'' }); setUserFb(''); setUserModal(u.id) }

  async function doSaveUser(e) {
    e.preventDefault()
    if (!userForm.name || !userForm.email) { setUserFb('Name and email are required.'); return }
    try {
      if (userModal === 'add') {
        await adminCreateUser(userForm)
      } else {
        await adminUpdateUser(userModal, userForm)
      }
      const us = await adminGetUsers()
      setUsers(us)
      setUserModal(null)
    } catch (err) {
      setUserFb(err.message || 'Error saving user.')
    }
  }

  async function toggleSuspend(id) {
    try {
      await adminToggleSuspend(id)
      const us = await adminGetUsers()
      setUsers(us)
    } catch {}
  }

  async function doSendAnnouncement(e) {
    e.preventDefault()
    if (!annForm.title || !annForm.message) { setAnnFb('error:Please fill in all fields.'); return }
    try {
      await addAnnouncement(annForm)
      const ann = await getAnnouncements()
      setAnnouncements(ann)
      setAnnForm({ title:'', message:'', audience:'all' })
      setAnnFb('✓ Announcement sent to students!')
      setTimeout(() => setAnnFb(''), 3000)
    } catch (err) {
      setAnnFb('error:' + err.message)
    }
  }

  async function doSaveContent(e) {
    e.preventDefault()
    try {
      await saveSiteContent(contentForm)
      setContentFb('✓ Content saved!')
      setTimeout(() => setContentFb(''), 3000)
    } catch {}
  }

  async function doAddCategory(e) {
    e.preventDefault()
    if (!catForm.name) { setCatFb('Name is required.'); return }
    try {
      await addCategory(catForm)
      const cats = await getCategories()
      setCategories(cats)
      setCatModal(false)
      setCatForm({ name:'', icon:'fa-solid fa-folder', desc:'' })
    } catch (err) {
      setCatFb(err.message)
    }
  }

  async function doDeleteCategory(id) {
    try {
      await deleteCategory(id)
      const cats = await getCategories()
      setCategories(cats)
    } catch {}
  }

  function openCreateTemplate() { setEditingTemplate(null); setShowFigmaEditor(true) }
  function openEditTemplate(tpl) { setEditingTemplate(tpl); setShowFigmaEditor(true) }

  function onEditorSave(data) {
    setShowFigmaEditor(false)
    setTplSaveData(data)
    setTplMeta({ name:editingTemplate?.name||'New Template', category:editingTemplate?.category||'presentation', desc:editingTemplate?.desc||'' })
    setTplNameModal(true)
  }

  async function doFinalSaveTemplate(e) {
    e.preventDefault()
    if (!tplMeta.name) return
    const allEls = Object.values(tplSaveData.elements || {}).flat()
    const thumbnail = generateThumbnail(allEls, tplSaveData.bg)
    const payload = {
      name: tplMeta.name,
      category: tplMeta.category,
      desc: tplMeta.desc,
      preview_icon: 'fa-solid fa-palette',
      color: '#2563eb',
      elements: allEls,
      pages: tplSaveData.pages,
      bg: tplSaveData.bg,
      thumbnail,
    }
    try {
      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, payload)
      } else {
        await createTemplate(payload)
      }
      const [tpl, trash] = await Promise.all([getTemplates(), getTrashedTemplates()])
      setTemplates(tpl)
      setTrashedTemplates(trash)
      setTplNameModal(false)
      setTplSaveData(null)
      setEditingTemplate(null)
    } catch {}
  }

  function generateThumbnail(elements, bg) {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 400; canvas.height = 280
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = bg || '#ffffff'; ctx.fillRect(0, 0, 400, 280)
      const scaleX = 400/800, scaleY = 280/560
      elements.forEach(el => {
        if (el.type==='text') {
          ctx.fillStyle = el.color||'#000'
          ctx.font = `${el.fontWeight||'400'} ${(el.fontSize||20)*scaleX}px ${el.fontFamily||'Arial'}`
          ctx.fillText(el.content||'', el.x*scaleX, (el.y+(el.fontSize||20))*scaleY)
        } else if (el.type!=='triangle'&&el.type!=='line'&&el.fill&&!el.fill.startsWith('url')) {
          ctx.fillStyle = el.fill
          if (el.type==='circle') { ctx.beginPath(); ctx.ellipse((el.x+el.w/2)*scaleX,(el.y+el.h/2)*scaleY,(el.w/2)*scaleX,(el.h/2)*scaleY,0,0,Math.PI*2); ctx.fill() }
          else { const r = el.type==='rounded'?8:el.type==='frame'?4:0; ctx.beginPath(); ctx.roundRect(el.x*scaleX,el.y*scaleY,el.w*scaleX,el.h*scaleY,r); ctx.fill() }
        }
      })
      return canvas.toDataURL()
    } catch { return '' }
  }

  const { firstDay, daysInMonth } = buildCalendar(calYear, calMonth)
  const today = new Date()
  const activeTemplates = templates.filter(t => !t.deleted)
  const filteredTemplates = templateFilter==='all' ? activeTemplates : activeTemplates.filter(t => t.category===templateFilter)
  const TPL_CATS = ['all','marketing','business','video','social','education','presentation','poster','resume','logo']

  const sideItems = [
    { key:'dashboard', icon:'gauge', label:'Dashboard', group:'Overview' },
    { key:'users', icon:'users', label:'User Management' },
    { key:'content', icon:'images', label:'Content Management' },
    { key:'announcements', icon:'bullhorn', label:'Announcement' },
    { key:'_sys', label:'System', group:true },
    { key:'templates', icon:'table-cells-large', label:'Templates' },
    { key:'categories', icon:'list', label:'Categories' },
    { key:'reports', icon:'clipboard-list', label:'Reports' },
    { key:'settings', icon:'gear', label:'Settings' },
  ]

  if (showFigmaEditor) {
    const initData = editingTemplate
      ? { pages:editingTemplate.pages||['Page 1'], elements:{0:JSON.parse(JSON.stringify(editingTemplate.elements||[]))}, bg:editingTemplate.bg||'#ffffff' }
      : { pages:['Page 1'], elements:{0:[]}, bg:'#ffffff' }
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
      <header className="ad-topnav">
        <div className="ad-topnav-left">
          <div className="ad-logo">SDMS</div>
          <nav className="ad-toplinks">
            <button className={section==='dashboard'?'ad-toplink active':'ad-toplink'} onClick={()=>nav2('dashboard')}>Dashboard</button>
          </nav>
        </div>
        <div className="ad-topnav-right">
          <span className="ad-role-badge">Admin</span>
          <button className="ad-cal-btn" onClick={()=>setShowCal(true)} title="Calendar"><i className="fa-regular fa-calendar" /></button>
        </div>
      </header>

      <div className="ad-layout">
        <aside className="ad-sidebar">
          {sideItems.map(item => {
            if (item.group===true) return <div key={item.key} className="ad-sidebar-label">{item.label}</div>
            if (item.group==='Overview') return (
              <React.Fragment key={item.key}>
                <div className="ad-sidebar-label">Overview</div>
                <button className={`ad-sidebar-item${section===item.key?' active':''}`} onClick={()=>nav2(item.key)}>
                  <i className={`fa-solid fa-${item.icon}`} /> {item.label}
                </button>
              </React.Fragment>
            )
            return (
              <button key={item.key} className={`ad-sidebar-item${section===item.key?' active':''}`} onClick={()=>nav2(item.key)}>
                <i className={`fa-solid fa-${item.icon}`} /> {item.label}
              </button>
            )
          })}
          <button className="ad-sidebar-item ad-logout" onClick={logout}><i className="fa-solid fa-right-from-bracket" /> Log Out</button>
        </aside>

        <main className="ad-main" id="admin-main">

          {section==='dashboard' && (
            <div className="ad-section">
              <div className="ad-section-header">
                <div><h2 className="ad-section-title">Admin Dashboard</h2><p className="ad-section-sub">System Overview &nbsp;{dateStr}</p></div>
              </div>
              <div className="ad-stats-grid">
                {[
                  { icon:'user', color:'#e879f9', val:stats.users, label:'Total Users', sub:'0 Today' },
                  { icon:'folder', color:'#f9a8d4', val:stats.projects, label:'Projects Uploaded', sub:'0 Today' },
                  { icon:'eye', color:'#38bdf8', val:stats.views, label:'Portfolio Views', sub:'0 today' },
                  { icon:'flag', color:'#f87171', val:stats.flags, label:'Flagged Content', sub:'Needs Review' },
                ].map(s=>(
                  <div className="ad-stat-card" key={s.label}>
                    <div className="ad-stat-icon" style={{color:s.color}}><i className={`fa-solid fa-${s.icon}`}/></div>
                    <div className="ad-stat-val">{s.val}</div>
                    <div className="ad-stat-name">{s.label}</div>
                    <div className="ad-stat-sub">{s.sub}</div>
                  </div>
                ))}
              </div>
              <div className="ad-dashboard-bottom">
                <div className="ad-card"><h3 className="ad-card-title">Moderation Queue</h3><div className="empty-state" style={{padding:'20px 0'}}><i className="fa-solid fa-check-circle"/><p>No items to review</p></div></div>
                <div className="ad-card">
                  <h3 className="ad-card-title">Activity Feed</h3>
                  {announcements.slice(0,5).map((a,i)=>(
                    <div className="ad-activity-item" key={i}>
                      <div className="ad-activity-dot"/>
                      <div><div className="ad-activity-text">Announcement: {a.title}</div><div className="ad-activity-time">{new Date(a.created_at).toLocaleString()}</div></div>
                    </div>
                  ))}
                  {announcements.length===0&&<div className="empty-state" style={{padding:'20px 0'}}><i className="fa-solid fa-list"/><p>No recent activity</p></div>}
                </div>
              </div>
              <div className="ad-card">
                <div className="ad-um-header">
                  <h3 className="ad-card-title">User Management</h3>
                  <div className="ad-um-actions">
                    <div className="ad-search-bar">
                      <i className="fa-solid fa-magnifying-glass"/>
                      <input placeholder="Search users..." value={userSearch} onChange={e=>{setUserSearch(e.target.value);setPage(1)}}/>
                    </div>
                    <button className="btn-primary" onClick={openAddUser}><i className="fa-solid fa-plus"/> Add User</button>
                  </div>
                </div>
                <UsersTable users={pagedUsers} onEdit={openEditUser} onSuspend={toggleSuspend}/>
                <div className="ad-pagination">
                  <button onClick={()=>setPage(p=>Math.max(1,p-1))}><i className="fa-solid fa-chevron-left"/></button>
                  <span>{page} / {totalPages}</span>
                  <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))}><i className="fa-solid fa-chevron-right"/></button>
                </div>
              </div>
            </div>
          )}

          {section==='users' && (
            <div className="ad-section">
              <div className="ad-section-header"><div><h2 className="ad-section-title">User Management</h2><p className="ad-section-sub">Manage all platform users</p></div><button className="btn-primary" onClick={openAddUser}><i className="fa-solid fa-plus"/> Add User</button></div>
              <div className="ad-search-bar" style={{marginBottom:18}}><i className="fa-solid fa-magnifying-glass"/><input placeholder="Search users..." value={userSearch} onChange={e=>{setUserSearch(e.target.value);setPage(1)}}/></div>
              <UsersTable users={pagedUsers} onEdit={openEditUser} onSuspend={toggleSuspend}/>
              <div className="ad-pagination">
                <button onClick={()=>setPage(p=>Math.max(1,p-1))}><i className="fa-solid fa-chevron-left"/></button>
                <span>{page} / {totalPages}</span>
                <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))}><i className="fa-solid fa-chevron-right"/></button>
              </div>
            </div>
          )}

          {section==='content' && (
            <div className="ad-section">
              <div className="ad-section-header"><div><h2 className="ad-section-title">Content Management</h2><p className="ad-section-sub">Edit the landing page content</p></div><button className="btn-primary" onClick={doSaveContent}><i className="fa-solid fa-save"/> Save Changes</button></div>
              <form className="ad-form-card" onSubmit={doSaveContent}>
                <div className="field-group"><label>Hero Title</label><input value={contentForm.heroTitle||''} onChange={e=>setContentForm(f=>({...f,heroTitle:e.target.value}))}/></div>
                <div className="field-group"><label>Hero Subtitle</label><textarea rows={3} value={contentForm.heroSub||''} onChange={e=>setContentForm(f=>({...f,heroSub:e.target.value}))}/></div>
                <div className="field-row">
                  <div className="field-group"><label>Student Portfolios Count</label><input type="number" value={contentForm.stat1||0} onChange={e=>setContentForm(f=>({...f,stat1:e.target.value}))}/></div>
                  <div className="field-group"><label>Departments Count</label><input type="number" value={contentForm.stat2||0} onChange={e=>setContentForm(f=>({...f,stat2:e.target.value}))}/></div>
                  <div className="field-group"><label>Project Uploads Count</label><input type="number" value={contentForm.stat3||0} onChange={e=>setContentForm(f=>({...f,stat3:e.target.value}))}/></div>
                </div>
                <div className="field-group"><label>CTA Heading</label><input value={contentForm.ctaHead||''} onChange={e=>setContentForm(f=>({...f,ctaHead:e.target.value}))}/></div>
                <div className="field-group"><label>CTA Subtext</label><textarea rows={2} value={contentForm.ctaSub||''} onChange={e=>setContentForm(f=>({...f,ctaSub:e.target.value}))}/></div>
                <div className="field-group"><label>Featured Categories (comma-separated)</label><input value={contentForm.cats||''} onChange={e=>setContentForm(f=>({...f,cats:e.target.value}))}/></div>
                {contentFb&&<div className="save-feedback">{contentFb}</div>}
              </form>
            </div>
          )}

          {section==='announcements' && (
            <div className="ad-section">
              <div className="ad-section-header"><div><h2 className="ad-section-title">Announcements</h2><p className="ad-section-sub">Send notifications to students</p></div></div>
              <form className="ad-form-card" style={{maxWidth:600,marginBottom:32}} onSubmit={doSendAnnouncement}>
                <div className="field-group"><label>Title</label><input value={annForm.title} onChange={e=>setAnnForm(f=>({...f,title:e.target.value}))} placeholder="Announcement title..."/></div>
                <div className="field-group"><label>Message</label><textarea rows={5} value={annForm.message} onChange={e=>setAnnForm(f=>({...f,message:e.target.value}))} placeholder="Write your announcement here..."/></div>
                <div className="field-group"><label>Audience</label>
                  <select value={annForm.audience} onChange={e=>setAnnForm(f=>({...f,audience:e.target.value}))}>
                    <option value="all">All Users</option>
                    <option value="students">Students Only</option>
                  </select>
                </div>
                <button type="submit" className="btn-primary"><i className="fa-solid fa-paper-plane"/> Send Announcement</button>
                {annFb&&<div className={`save-feedback${annFb.startsWith('error:')?' error':''}`}>{annFb.replace('error:','')}</div>}
              </form>
              <h3 style={{fontFamily:'var(--font-display)',fontSize:'1rem',fontWeight:700,marginBottom:14}}>Sent Announcements</h3>
              {announcements.length===0 ? <div className="empty-state"><i className="fa-solid fa-bullhorn"/><p>No announcements yet</p></div> : (
                announcements.map((a,i)=>(
                  <div className="ad-ann-item" key={i}>
                    <div className="ad-ann-header"><div className="ad-ann-title">{a.title}</div><span className="ad-ann-audience">{a.audience}</span></div>
                    <div className="ad-ann-msg">{a.message}</div>
                    <div className="ad-ann-date">{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {section==='templates' && (
            <div className="ad-section">
              <div className="ad-section-header">
                <div><h2 className="ad-section-title">Templates</h2><p className="ad-section-sub">Create and manage portfolio templates for students</p></div>
                <div style={{display:'flex',gap:8}}>
                  <button className="btn-outline" onClick={()=>setShowTplTrash(t=>!t)}><i className="fa-solid fa-trash-can"/> {showTplTrash?'Active':'Trash'} ({trashedTemplates.length})</button>
                  <button className="btn-primary" onClick={openCreateTemplate}><i className="fa-solid fa-plus"/> Create Template</button>
                </div>
              </div>
              <div className="ad-tpl-cats">
                {TPL_CATS.map(cat=>(
                  <button key={cat} className={`ad-tpl-cat-btn${templateFilter===cat?' active':''}`} onClick={()=>setTemplateFilter(cat)}>{cat.charAt(0).toUpperCase()+cat.slice(1)}</button>
                ))}
              </div>
              {filteredTemplates.length===0 ? <div className="empty-state"><i className="fa-solid fa-palette"/><p>No templates yet. Create one!</p></div> : (
                <div className="ad-tpl-grid">
                  {filteredTemplates.map(t=>(
                    <div className="ad-tpl-card" key={t.id}>
                      <div className="ad-tpl-preview" style={{background:`linear-gradient(135deg,${t.color||'#2563eb'},${t.color||'#2563eb'}88)`}}>
                        {t.thumbnail?<img src={t.thumbnail} alt={t.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<i className={`${t.preview_icon||'fa-solid fa-palette'}`} style={{fontSize:'3rem',color:'#fff',opacity:.9}}/>}
                      </div>
                      <div className="ad-tpl-info">
                        <div className="ad-tpl-title">{t.name}</div>
                        <div className="ad-tpl-cat">{t.category}</div>
                        <div className="ad-tpl-desc">{t.desc}</div>
                        <div className="ad-tpl-actions">
                          <button onClick={()=>setTplDeleteConfirm(t.id)} className="btn-danger"><i className="fa-solid fa-trash"/> Delete</button>
                          <button onClick={()=>openEditTemplate(t)} className="btn-outline"><i className="fa-solid fa-pen"/> Edit</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {showTplTrash && (
                <div style={{marginTop:28}}>
                  <h3 style={{fontFamily:'var(--font-display)',fontSize:'1rem',fontWeight:700,marginBottom:14,color:'var(--red)',display:'flex',alignItems:'center',gap:8}}><i className="fa-solid fa-trash-can"/> Trash Bin ({trashedTemplates.length})</h3>
                  {trashedTemplates.length===0 ? <div className="empty-state" style={{padding:'24px 0'}}><i className="fa-solid fa-trash-can"/><p>Trash is empty</p></div> : (
                    <div className="ad-tpl-grid">
                      {trashedTemplates.map(t=>(
                        <div className="ad-tpl-card" key={t.id} style={{opacity:.6,filter:'grayscale(40%)'}}>
                          <div className="ad-tpl-preview" style={{background:`linear-gradient(135deg,${t.color||'#2563eb'},${t.color||'#2563eb'}88)`}}>
                            {t.thumbnail?<img src={t.thumbnail} alt={t.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<i className="fa-solid fa-palette" style={{fontSize:'2.5rem',color:'#fff',opacity:.7}}/>}
                          </div>
                          <div className="ad-tpl-info">
                            <div className="ad-tpl-title">{t.name}</div>
                            <div style={{fontSize:'.72rem',color:'var(--text-dim)',marginBottom:8}}>Deleted {t.deleted_at?new Date(t.deleted_at).toLocaleDateString():''}</div>
                            <div className="ad-tpl-actions">
                              <button className="btn-outline" onClick={async()=>{await deleteTemplate(t.id,'restore');const [tpl,trash]=await Promise.all([getTemplates(),getTrashedTemplates()]);setTemplates(tpl);setTrashedTemplates(trash)}}><i className="fa-solid fa-rotate-left"/> Restore</button>
                              <button className="btn-danger" onClick={async()=>{await deleteTemplate(t.id,'permanent');const [tpl,trash]=await Promise.all([getTemplates(),getTrashedTemplates()]);setTemplates(tpl);setTrashedTemplates(trash)}}><i className="fa-solid fa-trash"/> Delete Forever</button>
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

          {section==='categories' && (
            <div className="ad-section">
              <div className="ad-section-header"><div><h2 className="ad-section-title">Categories</h2><p className="ad-section-sub">Manage portfolio categories</p></div><button className="btn-primary" onClick={()=>setCatModal(true)}><i className="fa-solid fa-plus"/> Add Category</button></div>
              {categories.map((c,i)=>(
                <div className="ad-cat-item" key={c.id||i}>
                  <div className="ad-cat-info">
                    <div className="ad-cat-icon"><i className={c.icon||'fa-solid fa-folder'}/></div>
                    <div><div className="ad-cat-name">{c.name}</div><div className="ad-cat-desc">{c.desc}</div></div>
                  </div>
                  <button className="btn-danger" onClick={()=>doDeleteCategory(c.id)}><i className="fa-solid fa-trash"/></button>
                </div>
              ))}
            </div>
          )}

          {section==='reports' && (
            <div className="ad-section"><div className="ad-section-header"><div><h2 className="ad-section-title">Reports</h2></div></div><div className="ad-placeholder"><i className="fa-solid fa-chart-line"/><p>Reports & Analytics coming soon.</p></div></div>
          )}

          {section==='settings' && (
            <div className="ad-section"><div className="ad-section-header"><div><h2 className="ad-section-title">Settings</h2></div></div><div className="ad-placeholder"><i className="fa-solid fa-gear"/><p>System settings panel coming soon.</p></div></div>
          )}
        </main>
      </div>

      {tplDeleteConfirm && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setTplDeleteConfirm(null)}}>
          <div className="modal-box">
            <div className="modal-header"><h3><i className="fa-solid fa-triangle-exclamation" style={{color:'var(--red)',marginRight:8}}/>Confirm Delete</h3><button className="modal-close" onClick={()=>setTplDeleteConfirm(null)}><i className="fa-solid fa-xmark"/></button></div>
            <div className="modal-body"><p style={{color:'var(--text-muted)'}}>Move this template to trash? You can restore it from the Trash Bin.</p></div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={()=>setTplDeleteConfirm(null)}>Cancel</button>
              <button className="btn-danger" onClick={async()=>{await deleteTemplate(tplDeleteConfirm,'soft');const[tpl,trash]=await Promise.all([getTemplates(),getTrashedTemplates()]);setTemplates(tpl);setTrashedTemplates(trash);setTplDeleteConfirm(null)}}>Move to Trash</button>
            </div>
          </div>
        </div>
      )}

      {showCal && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowCal(false)}}>
          <div className="modal-box">
            <div className="modal-header"><h3><i className="fa-regular fa-calendar"/> Calendar</h3><button className="modal-close" onClick={()=>setShowCal(false)}><i className="fa-solid fa-xmark"/></button></div>
            <div className="modal-body">
              <div className="ad-cal-nav">
                <button onClick={()=>{let m=calMonth-1,y=calYear;if(m<0){m=11;y--}setCalMonth(m);setCalYear(y)}}>&#8249;</button>
                <span className="ad-cal-month">{MONTHS[calMonth]} {calYear}</span>
                <button onClick={()=>{let m=calMonth+1,y=calYear;if(m>11){m=0;y++}setCalMonth(m);setCalYear(y)}}>&#8250;</button>
              </div>
              <div className="ad-cal-grid">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className="ad-cal-header">{d}</div>)}
                {Array(firstDay).fill(null).map((_,i)=><div key={`e${i}`}/>)}
                {Array(daysInMonth).fill(null).map((_,i)=>{
                  const d=i+1
                  const isToday=d===today.getDate()&&calMonth===today.getMonth()&&calYear===today.getFullYear()
                  return <div key={d} className={`ad-cal-day${isToday?' today':''}${calDay===d?' selected':''}`} onClick={()=>setCalDay(d)}>{d}</div>
                })}
              </div>
              {calDay&&<div className="ad-cal-day-view"><h4>{MONTHS[calMonth]} {calDay}, {calYear}</h4><p style={{color:'var(--text-dim)',fontSize:'.84rem'}}>No events for this day.</p></div>}
            </div>
            <div className="modal-footer"><button className="btn-cancel" onClick={()=>setShowCal(false)}>Close</button></div>
          </div>
        </div>
      )}

      {userModal !== null && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setUserModal(null)}}>
          <div className="modal-box">
            <div className="modal-header"><h3>{userModal==='add'?'Add New User':'Edit User'}</h3><button className="modal-close" onClick={()=>setUserModal(null)}><i className="fa-solid fa-xmark"/></button></div>
            <form onSubmit={doSaveUser}>
              <div className="modal-body">
                <div className="field-row">
                  <div className="field-group"><label>Full Name *</label><input value={userForm.name} onChange={e=>setUserForm(f=>({...f,name:e.target.value}))}/></div>
                  <div className="field-group"><label>Date of Birth</label><input type="date" value={userForm.dob} onChange={e=>setUserForm(f=>({...f,dob:e.target.value}))}/>{userForm.dob&&<div style={{fontSize:'.74rem',color:'var(--accent-light)',marginTop:4}}>Age: {calcAge(userForm.dob)}</div>}</div>
                </div>
                <div className="field-row">
                  <div className="field-group"><label>Sex</label><select value={userForm.sex} onChange={e=>setUserForm(f=>({...f,sex:e.target.value}))}><option>Male</option><option>Female</option><option>Other</option></select></div>
                  <div className="field-group"><label>Role</label><select value={userForm.role} onChange={e=>setUserForm(f=>({...f,role:e.target.value}))}><option value="student">Student</option><option value="admin">Admin</option></select></div>
                </div>
                <div className="field-group"><label>Address</label><input value={userForm.address} onChange={e=>setUserForm(f=>({...f,address:e.target.value}))}/></div>
                <div className="field-group"><label>Email *</label><input type="email" value={userForm.email} onChange={e=>setUserForm(f=>({...f,email:e.target.value}))}/></div>
                <div className="field-group"><label>Password</label><input type="password" value={userForm.password} onChange={e=>setUserForm(f=>({...f,password:e.target.value}))} placeholder="Leave blank to keep current"/></div>
                {userFb&&<div className="save-feedback error">{userFb}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={()=>setUserModal(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Save User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {catModal && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setCatModal(false)}}>
          <div className="modal-box">
            <div className="modal-header"><h3>Add Category</h3><button className="modal-close" onClick={()=>setCatModal(false)}><i className="fa-solid fa-xmark"/></button></div>
            <form onSubmit={doAddCategory}>
              <div className="modal-body">
                <div className="field-group"><label>Category Name *</label><input value={catForm.name} onChange={e=>setCatForm(f=>({...f,name:e.target.value}))} placeholder="e.g. IT, Arts"/></div>
                <div className="field-group"><label>Icon (FA class)</label><input value={catForm.icon} onChange={e=>setCatForm(f=>({...f,icon:e.target.value}))} placeholder="fa-solid fa-laptop"/></div>
                <div className="field-group"><label>Description</label><textarea rows={2} value={catForm.desc} onChange={e=>setCatForm(f=>({...f,desc:e.target.value}))}/></div>
                {catFb&&<div className="save-feedback error">{catFb}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={()=>setCatModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Add Category</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tplNameModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header"><h3>Save Template</h3><button className="modal-close" onClick={()=>setTplNameModal(false)}><i className="fa-solid fa-xmark"/></button></div>
            <form onSubmit={doFinalSaveTemplate}>
              <div className="modal-body">
                <div className="field-group"><label>Template Name *</label><input value={tplMeta.name} onChange={e=>setTplMeta(m=>({...m,name:e.target.value}))}/></div>
                <div className="field-group"><label>Category</label>
                  <select value={tplMeta.category} onChange={e=>setTplMeta(m=>({...m,category:e.target.value}))}>
                    {['presentation','resume','logo','marketing','business','social','video','education','poster'].map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field-group"><label>Description</label><input value={tplMeta.desc} onChange={e=>setTplMeta(m=>({...m,desc:e.target.value}))}/></div>
              </div>
              <div style={{display:'flex',gap:9,justifyContent:'flex-end',padding:'14px 20px',borderTop:'1px solid var(--card-border)'}}>
                <button type="button" className="btn-cancel" onClick={()=>setTplNameModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary"><i className="fa-solid fa-save"/> Save Template</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function UsersTable({ users, onEdit, onSuspend }) {
  if (users.length===0) return <div className="empty-state"><i className="fa-solid fa-users"/><p>No users found</p></div>
  return (
    <table className="ad-users-table">
      <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Age</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        {users.map(u=>(
          <tr key={u.id}>
            <td>{u.name||'-'}</td>
            <td>{u.email||'-'}</td>
            <td><span className={`ad-role-pill ${u.role||'student'}`}>{u.role||'student'}</span></td>
            <td>{u.dob ? calcAge(u.dob) : u.age||'-'}</td>
            <td><span className={`ad-status-pill ${u.is_active!==false?'active':'suspended'}`}>{u.is_active!==false?'active':'suspended'}</span></td>
            <td>
              <div style={{display:'flex',gap:7}}>
                <button className="ad-btn-edit" onClick={()=>onEdit(u)}>Edit</button>
                <button className="ad-btn-suspend" onClick={()=>onSuspend(u.id)}>{u.is_active!==false?'Suspend':'Restore'}</button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}