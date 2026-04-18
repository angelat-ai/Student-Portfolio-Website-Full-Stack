export const DEMO_USERS = {
  'admin@school.edu':   { password: 'admin123',   role: 'admin',   name: 'Admin User' },
  'student@school.edu': { password: 'student123', role: 'student', name: 'Demo Student' },
}

export function ls(key, def) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : def } catch { return def }
}
export function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}

export function calcAge(dob) {
  if (!dob) return ''
  const b = new Date(dob), n = new Date()
  let age = n.getFullYear() - b.getFullYear()
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) age--
  return age
}

export function getSession() { return ls('sdpms_session', {}) }
export function setSession(role, email, name) { lsSet('sdpms_session', { role, email, name }) }
export function clearSession() { localStorage.removeItem('sdpms_session') }

export function getUsers() {
  return ls('sdpms_users', [
    { id: 'admin@school.edu', name: 'Admin User', email: 'admin@school.edu', role: 'admin', dob: '1990-01-01', sex: 'Male', address: '', is_active: true, last_active: 'just now' },
    { id: 'student@school.edu', name: 'Demo Student', email: 'student@school.edu', role: 'student', dob: '2003-05-15', sex: 'Male', address: '', is_active: true, last_active: 'just now' },
  ])
}

export function saveUser(user) {
  const users = getUsers()
  const idx = users.findIndex(u => u.id === user.id)
  if (idx >= 0) users[idx] = user; else users.push(user)
  lsSet('sdpms_users', users)
}

export function validateLogin(email, password) {
  const demo = DEMO_USERS[email]
  if (demo && demo.password === password) return { role: demo.role, name: demo.name }
  const user = getUsers().find(u => u.email === email && !DEMO_USERS[u.email])
  if (user && user.password === password && user.is_active !== false) return { role: user.role, name: user.name }
  return null
}

export function getProjects(ownerEmail) {
  const session = getSession()
  const email = ownerEmail || session.email
  return ls(`sdpms_projects_${email}`, [])
}

export function addProject(p, ownerEmail) {
  const session = getSession()
  const email = ownerEmail || session.email
  const projects = getProjects(email)
  lsSet(`sdpms_projects_${email}`, [p, ...projects])
}

export function updateProject(id, data, ownerEmail) {
  const session = getSession()
  const email = ownerEmail || session.email
  lsSet(`sdpms_projects_${email}`, getProjects(email).map(p => p.id === id ? { ...p, ...data } : p))
}

export function softDeleteProject(id, ownerEmail) {
  const session = getSession()
  const email = ownerEmail || session.email
  lsSet(`sdpms_projects_${email}`, getProjects(email).map(p => p.id === id ? { ...p, deleted: true, deletedAt: new Date().toISOString() } : p))
}

export function restoreProject(id, ownerEmail) {
  const session = getSession()
  const email = ownerEmail || session.email
  lsSet(`sdpms_projects_${email}`, getProjects(email).map(p => p.id === id ? { ...p, deleted: false, deletedAt: null } : p))
}

export function permanentDeleteProject(id, ownerEmail) {
  const session = getSession()
  const email = ownerEmail || session.email
  lsSet(`sdpms_projects_${email}`, getProjects(email).filter(p => p.id !== id))
}

export function getAllPublicProjects() {
  const users = getUsers()
  const result = []
  users.forEach(u => {
    const projects = getProjects(u.email)
    projects.filter(p => !p.deleted && p.privacy !== 'private').forEach(p => {
      result.push({ ...p, ownerEmail: u.email, ownerName: u.name, ownerAvatar: ls(`sdpms_profile_${u.email}`, {}).avatarImage || null })
    })
  })
  return result.sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0))
}

export function getProfile(ownerEmail) {
  const session = getSession()
  const email = ownerEmail || session.email
  return ls(`sdpms_profile_${email}`, {})
}

export function saveProfile(data, ownerEmail) {
  const session = getSession()
  const email = ownerEmail || session.email
  lsSet(`sdpms_profile_${email}`, data)
}

export function getPortfolioDesign(ownerEmail) {
  const session = getSession()
  const email = ownerEmail || session.email
  return ls(`sdpms_portfolio_design_${email}`, null)
}

export function savePortfolioDesign(data, ownerEmail) {
  const session = getSession()
  const email = ownerEmail || session.email
  lsSet(`sdpms_portfolio_design_${email}`, data)
}

export function getTemplates() { return ls('sdpms_templates', []) }
export function saveTemplate(tpl) {
  const templates = getTemplates()
  const idx = templates.findIndex(t => t.id === tpl.id)
  if (idx >= 0) templates[idx] = tpl; else templates.push(tpl)
  lsSet('sdpms_templates', templates)
}
export function softDeleteTemplate(id) {
  lsSet('sdpms_templates', getTemplates().map(t => t.id === id ? { ...t, deleted: true, deletedAt: new Date().toISOString() } : t))
}
export function restoreTemplate(id) {
  lsSet('sdpms_templates', getTemplates().map(t => t.id === id ? { ...t, deleted: false, deletedAt: null } : t))
}
export function permanentDeleteTemplate(id) {
  lsSet('sdpms_templates', getTemplates().filter(t => t.id !== id))
}

export function getAnnouncements() { return ls('sdpms_announcements', []) }
export function addAnnouncement(a) { lsSet('sdpms_announcements', [a, ...getAnnouncements()]) }

export function getCategories() {
  return ls('sdpms_categories', [
    { name: 'Arts',        icon: 'fa-solid fa-palette',      desc: 'Visual & creative arts' },
    { name: 'IT',          icon: 'fa-solid fa-laptop-code',  desc: 'Information technology' },
    { name: 'Engineering', icon: 'fa-solid fa-gear',          desc: 'Engineering projects' },
    { name: 'Nursing',     icon: 'fa-solid fa-heart-pulse',   desc: 'Health & nursing' },
  ])
}

export function getAdminStats() {
  const users = getUsers()
  let totalProjects = 0, totalViews = 0
  users.forEach(u => {
    const projects = getProjects(u.email)
    totalProjects += projects.filter(p => !p.deleted).length
    totalViews += projects.reduce((a, p) => a + (p.views || 0), 0)
  })
  return { users: users.length, projects: totalProjects, views: totalViews, flags: 0 }
}

export function getStudentStats(ownerEmail) {
  const projects = getProjects(ownerEmail).filter(p => !p.deleted)
  const session = getSession()
  const email = ownerEmail || session.email
  return {
    projects: projects.length,
    views: ls(`sdpms_portfolio_views_${email}`, 0),
    clicks: 0,
    reviews: 0,
  }
}

export function incrementPortfolioView(viewerEmail, ownerEmail) {
  const session = getSession()
  const owner = ownerEmail || session.email
  if (viewerEmail === owner) return
  const key = `sdpms_pv_${owner}`
  const viewed = ls(key, {})
  const dayKey = `${viewerEmail}_${new Date().toDateString()}`
  if (viewed[dayKey]) return
  viewed[dayKey] = true
  lsSet(key, viewed)
  lsSet(`sdpms_portfolio_views_${owner}`, ls(`sdpms_portfolio_views_${owner}`, 0) + 1)
}

export function incrementProjectViews(id, ownerEmail) {
  const session = getSession()
  const email = ownerEmail || session.email
  lsSet(`sdpms_projects_${email}`, getProjects(email).map(p => p.id === id ? { ...p, views: (p.views || 0) + 1 } : p))
}

export function getComments(projectId) { return ls(`sdpms_comments_${projectId}`, []) }
export function addComment(projectId, comment) { lsSet(`sdpms_comments_${projectId}`, [...getComments(projectId), comment]) }

export function getLikes(projectId) { return ls(`sdpms_likes_${projectId}`, { count: 0, users: [] }) }
export function toggleLike(projectId, userEmail) {
  const data = getLikes(projectId)
  const idx = data.users.indexOf(userEmail)
  if (idx >= 0) { data.users.splice(idx, 1); data.count = Math.max(0, data.count - 1) }
  else { data.users.push(userEmail); data.count++ }
  lsSet(`sdpms_likes_${projectId}`, data)
  return data
}

export const ALL_SKILLS = [
  'HTML','CSS','JavaScript','TypeScript','React','Vue','Angular','Next.js','Node.js',
  'Python','Java','C++','C#','PHP','Laravel','Django','Flask','SQL','MySQL','PostgreSQL',
  'MongoDB','Firebase','Supabase','Git','GitHub','Figma','Adobe XD','Photoshop','Illustrator',
  'After Effects','Premiere Pro','Blender','Unity','Unreal Engine','Swift','Kotlin','Flutter',
  'React Native','Docker','AWS','Linux','Networking','Cybersecurity','Machine Learning','AI',
  'Data Analysis','Excel','PowerBI','Tableau','Arduino','IoT','Robotics','3D Modeling',
]