const BASE = window.location.hostname === 'localhost' 
  ? 'http://127.0.0.1:8000/api' 
  : 'https://sdpms-backend.onrender.com/api'

function getToken() { return localStorage.getItem('sdpms_access') }
function setTokens(access, refresh) { localStorage.setItem('sdpms_access', access); localStorage.setItem('sdpms_refresh', refresh) }
function clearTokens() { localStorage.removeItem('sdpms_access'); localStorage.removeItem('sdpms_refresh'); localStorage.removeItem('sdpms_user') }

async function request(path, options = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (options.body instanceof FormData) delete headers['Content-Type']

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (res.status === 401) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getToken()}`
      const retry = await fetch(`${BASE}${path}`, { ...options, headers })
      if (!retry.ok) throw new Error(await retry.text())
      return retry.status === 204 ? null : retry.json()
    } else {
      clearTokens()
      window.location.href = '/login'
      return
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || JSON.stringify(err))
  }
  return res.status === 204 ? null : res.json()
}

async function tryRefresh() {
  const refresh = localStorage.getItem('sdpms_refresh')
  if (!refresh) return false
  try {
    const res = await fetch(`${BASE}/auth/refresh/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh }) })
    if (!res.ok) return false
    const data = await res.json()
    localStorage.setItem('sdpms_access', data.access)
    return true
  } catch { return false }
}

export function getSession() { try { return JSON.parse(localStorage.getItem('sdpms_user') || '{}') } catch { return {} } }
export function clearSession() { clearTokens() }
export function isLoggedIn() { return !!getToken() }

export async function login(email, password) {
  const data = await request('/auth/login/', { method: 'POST', body: JSON.stringify({ email, password }) })
  setTokens(data.tokens.access, data.tokens.refresh)
  localStorage.setItem('sdpms_user', JSON.stringify(data.user))
  return data.user
}

export async function register(payload) {
  const data = await request('/auth/register/', { method: 'POST', body: JSON.stringify(payload) })
  setTokens(data.tokens.access, data.tokens.refresh)
  localStorage.setItem('sdpms_user', JSON.stringify(data.user))
  return data.user
}

export function calcAge(dob) {
  if (!dob) return ''
  const b = new Date(dob), n = new Date()
  let age = n.getFullYear() - b.getFullYear()
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) age--
  return age
}

export async function fetchMe() {
  const user = await request('/auth/me/')
  localStorage.setItem('sdpms_user', JSON.stringify(user))
  return user
}

export async function updateMe(payload) {
  const user = await request('/auth/me/update/', { method: 'PATCH', body: JSON.stringify(payload) })
  localStorage.setItem('sdpms_user', JSON.stringify(user))
  return user
}

export async function getProfile() { return request('/profile/') }
export async function saveProfile(payload) { return request('/profile/', { method: 'PATCH', body: JSON.stringify(payload) }) }

export async function getPublicProfile(userId) {
  if (!userId) return null
  return request(`/profile/${userId}/`)
}

export async function getProjects(includeDeleted = false) {
  return request(`/projects/${includeDeleted ? '?include_deleted=true' : ''}`)
}

export async function addProject(payload, imageFile) {
  if (imageFile) {
    const form = new FormData()
    Object.entries(payload).forEach(([k, v]) => { if (Array.isArray(v)) form.append(k, JSON.stringify(v)); else form.append(k, v ?? '') })
    form.append('image_file', imageFile)
    return request('/projects/', { method: 'POST', body: form })
  }
  return request('/projects/', { method: 'POST', body: JSON.stringify(payload) })
}

export async function updateProject(id, payload) { return request(`/projects/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }) }
export async function softDeleteProject(id) { return request(`/projects/${id}/?action=soft`, { method: 'DELETE' }) }
export async function restoreProject(id) { return request(`/projects/${id}/?action=restore`, { method: 'DELETE' }) }
export async function permanentDeleteProject(id) { return request(`/projects/${id}/?action=permanent`, { method: 'DELETE' }) }
export async function incrementProjectViews(id) { return request(`/projects/${id}/views/`, { method: 'POST' }) }
export async function toggleLike(projectId) { return request(`/projects/${projectId}/like/`, { method: 'POST' }) }
export async function getComments(projectId) { return request(`/projects/${projectId}/comments/`) }
export async function addComment(projectId, text) { return request(`/projects/${projectId}/comments/`, { method: 'POST', body: JSON.stringify({ text }) }) }

export async function getDiscover(category, sort) {
  const params = new URLSearchParams()
  if (category && category !== 'All') params.set('category', category)
  if (sort) params.set('sort', sort)
  const qs = params.toString()
  return request(`/discover/${qs ? '?' + qs : ''}`)
}

export async function getTopProjects() { return request('/discover/top/') }
export async function getPortfolioDesign() { return request('/portfolio/') }
export async function savePortfolioDesign(payload) { return request('/portfolio/', { method: 'POST', body: JSON.stringify(payload) }) }
export async function incrementPortfolioView(userId) { return request(`/profile/${userId}/view/`, { method: 'POST' }) }
export async function getStudentStats() { return request('/stats/') }
export async function getAdminStats() { return request('/admin/stats/') }

export async function getTemplates(category) {
  return request(`/templates/${category && category !== 'all' ? '?category=' + category : ''}`)
}
export async function getTrashedTemplates() { return request('/templates/trashed/') }
export async function createTemplate(payload) { return request('/templates/create/', { method: 'POST', body: JSON.stringify(payload) }) }
export async function updateTemplate(id, payload) { return request(`/templates/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }) }
export async function deleteTemplate(id, action = 'soft') { return request(`/templates/${id}/?action=${action}`, { method: 'DELETE' }) }
export async function getAnnouncements() { return request('/announcements/') }
export async function addAnnouncement(payload) { return request('/announcements/', { method: 'POST', body: JSON.stringify(payload) }) }
export async function getCategories() { return request('/categories/') }
export async function addCategory(payload) { return request('/categories/', { method: 'POST', body: JSON.stringify(payload) }) }
export async function deleteCategory(id) { return request(`/categories/${id}/`, { method: 'DELETE' }) }
export async function getSiteContent() { return request('/content/') }
export async function saveSiteContent(payload) { return request('/content/', { method: 'POST', body: JSON.stringify(payload) }) }
export async function adminGetUsers(search = '') { return request(`/admin/users/${search ? '?search=' + search : ''}`) }
export async function adminCreateUser(payload) { return request('/admin/users/create/', { method: 'POST', body: JSON.stringify(payload) }) }
export async function adminUpdateUser(id, payload) { return request(`/admin/users/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }) }
export async function adminToggleSuspend(id) { return request(`/admin/users/${id}/suspend/`, { method: 'PATCH' }) }

export const ALL_SKILLS = [
  'HTML','CSS','JavaScript','TypeScript','React','Vue','Angular','Next.js','Node.js',
  'Python','Java','C++','C#','PHP','Laravel','Django','Flask','SQL','MySQL','PostgreSQL',
  'MongoDB','Firebase','Supabase','Git','GitHub','Figma','Adobe XD','Photoshop','Illustrator',
  'After Effects','Premiere Pro','Blender','Unity','Unreal Engine','Swift','Kotlin','Flutter',
  'React Native','Docker','AWS','Linux','Networking','Cybersecurity','Machine Learning','AI',
  'Data Analysis','Excel','PowerBI','Tableau','Arduino','IoT','Robotics','3D Modeling',
]