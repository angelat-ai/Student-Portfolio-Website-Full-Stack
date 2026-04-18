import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import FigmaEditor from '../components/FigmaEditor'
import {
  getSession, clearSession, calcAge, ALL_SKILLS,
  fetchMe, updateMe, getProfile, saveProfile,
  getProjects, addProject, updateProject, softDeleteProject, restoreProject, permanentDeleteProject,
  incrementProjectViews, toggleLike, getComments, addComment,
  getPortfolioDesign, savePortfolioDesign,
  getStudentStats, getTemplates, getAnnouncements, getDiscover, getPublicProfile,
} from '../utils/api'
import './StudentDashboard.css'

const RESUME_TEMPLATES = [
  { name: 'Modern',    icon: 'fa-solid fa-file-alt',  color: '#2563eb' },
  { name: 'Classic',   icon: 'fa-solid fa-file',       color: '#0f766e' },
  { name: 'Technical', icon: 'fa-solid fa-code',       color: '#7c3aed' },
  { name: 'Creative',  icon: 'fa-solid fa-palette',    color: '#db2777' },
]

const UPLOAD_TYPES = [
  { key: 'image', icon: 'fa-regular fa-image', label: 'Photo', accept: 'image/*' },
  { key: 'doc', icon: 'fa-regular fa-file-lines', label: 'Document', accept: '.pdf,.doc,.docx,.txt' },
  { key: 'ppt', icon: 'fa-regular fa-file-powerpoint', label: 'PowerPoint', accept: '.ppt,.pptx' },
  { key: 'canva', icon: 'fa-solid fa-link', label: 'Canva', accept: null },
  { key: 'video', icon: 'fa-solid fa-video', label: 'Video', accept: 'video/*' },
  { key: 'gif', icon: 'fa-regular fa-file-image', label: 'GIF', accept: 'image/gif' },
  { key: 'code', icon: 'fa-solid fa-code', label: 'Code', accept: '.js,.jsx,.ts,.tsx,.py,.html,.css,.java,.cpp,.c,.php,.zip' },
  { key: 'art', icon: 'fa-solid fa-paintbrush', label: 'Art', accept: 'image/*,.svg,.ai,.psd' },
]

const BLANK_UPLOAD = { title:'', description:'', category:'', status:'Completed', image_url:'', imageFile:null, fileType:'image', canvaUrl:'', skills:[], githubUrl:'', deployUrl:'', figmaUrl:'', adobeUrl:'', completion_date:'', privacy:'public' }

function getImageSrc(p) {
  if (!p) return ''
  return p.effective_image || p.image_url || ''
}

function ProjectThumb({ p, style = {} }) {
  const [err, setErr] = useState(false)
  const src = getImageSrc(p)
  if (src && !err) {
    return <img src={src} alt={p.title} onError={() => setErr(true)} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', ...style }} />
  }
  return <i className="fa-regular fa-image" style={{ fontSize: '2rem', color: 'var(--text-dim)', ...style }} />
}

function PortfolioCanvas({ data }) {
  if (!data || !data.elements) return null
  const els = data.elements[0] || data.elements['0'] || []
  const bg = data.bg || '#ffffff'
  return (
    <div style={{ position:'relative', width:800, height:560, background:bg, borderRadius:8, overflow:'hidden', flexShrink:0 }}>
      {els.map(el => {
        const rot = el.rotation || 0
        const rotStyle = rot ? { transform:`rotate(${rot}deg)`, transformOrigin:'center center' } : {}
        const base = { position:'absolute', left:el.x, top:el.y, boxSizing:'border-box', ...rotStyle }
        if (el.type==='text') return <div key={el.id} style={{...base, fontSize:(el.fontSize||20)+'px', color:el.color||'#000', fontWeight:el.fontWeight||'400', fontFamily:el.fontFamily||'Arial', padding:'2px 4px', whiteSpace:'pre-wrap', lineHeight:1.3}}>{el.content}</div>
        if (el.type==='image') return (
          <div key={el.id} style={{...base, width:(el.w||200)+'px', height:(el.h||150)+'px', overflow:'hidden'}}>
            {el.src ? <img src={el.src} alt="" style={{width:'100%',height:'100%',objectFit:el.objectFit||'cover',pointerEvents:'none'}} onError={e=>e.target.style.display='none'} /> : null}
          </div>
        )
        if (el.type==='triangle') { const sz=Math.min(el.w||80,el.h||80); return <div key={el.id} style={{...base,width:sz+'px',height:sz+'px'}}><div style={{width:0,height:0,borderLeft:`${sz/2}px solid transparent`,borderRight:`${sz/2}px solid transparent`,borderBottom:`${sz}px solid ${el.fill||'#2563eb'}`}}/></div> }
        if (el.type==='line') return <div key={el.id} style={{...base,width:(el.w||150)+'px',height:Math.max(2,el.strokeWidth||2)+'px',background:el.fill||'#2563eb',borderRadius:'2px'}} />
        const s={...base,width:(el.w||120)+'px',height:(el.h||80)+'px'}
        if (el.type==='frame'){s.background=el.fill||'rgba(37,99,235,0.04)';s.border=`${el.strokeWidth||1}px dashed ${el.stroke||'#2563eb'}`;s.borderRadius='3px'}
        else if(el.type==='circle'){s.background=el.fill||'#2563eb';s.borderRadius='50%';if(el.stroke&&el.stroke!=='none')s.border=`${el.strokeWidth||1}px solid ${el.stroke}`}
        else if(el.type==='rounded'){s.background=el.fill||'#2563eb';s.borderRadius='14px';if(el.stroke&&el.stroke!=='none')s.border=`${el.strokeWidth||1}px solid ${el.stroke}`}
        else{s.background=el.fill||'#2563eb';if(el.stroke&&el.stroke!=='none')s.border=`${el.strokeWidth||1}px solid ${el.stroke}`}
        return <div key={el.id} style={s} />
      })}
    </div>
  )
}

function FullscreenPortfolio({ data, onClose }) {
  return (
    <div className="fullscreen-overlay" onClick={onClose}>
      <div className="fullscreen-topbar" onClick={e => e.stopPropagation()}>
        <span style={{fontFamily:'var(--font-display)',fontWeight:700}}>Portfolio Preview</span>
        <button className="btn-outline" onClick={onClose}><i className="fa-solid fa-compress" /> Exit Fullscreen</button>
      </div>
      <div className="fullscreen-content" onClick={e => e.stopPropagation()}>
        <div style={{transform:'scale(0.95)',transformOrigin:'top center'}}>
          <PortfolioCanvas data={data} />
        </div>
      </div>
    </div>
  )
}

function DiscoverGrid({ onViewPost, onViewProfile }) {
  const [allPosts, setAllPosts] = useState([])
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [hoveredId, setHoveredId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getDiscover().then(data => { setAllPosts(data || []) }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const categories = ['All', ...new Set(allPosts.map(p => p.category).filter(Boolean))]

  const filtered = allPosts.filter(p => {
    const matchCat = filter === 'All' || p.category === filter
    const q = search.toLowerCase()
    const matchSearch = !q || p.title?.toLowerCase().includes(q) || p.owner_name?.toLowerCase().includes(q)
    return matchCat && matchSearch
  })

  return (
    <div className="sd-section">
      <div className="sd-section-header">
        <div><h2 className="sd-section-title">Discover Projects</h2><p className="sd-section-sub">Explore student work from all accounts</p></div>
      </div>
      <div className="discover-search-row">
        <div className="discover-search-bar">
          <i className="fa-solid fa-magnifying-glass" />
          <input placeholder="Search by project name or student name..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')}><i className="fa-solid fa-xmark" /></button>}
        </div>
      </div>
      <div className="land-filters" style={{marginBottom:22}}>
        {categories.map(cat => (
          <button key={cat} className={`land-filter-btn${filter===cat?' active':''}`} onClick={()=>setFilter(cat)}>{cat}</button>
        ))}
      </div>
      {loading ? (
        <div className="empty-state"><i className="fa-solid fa-spinner fa-spin"/><p>Loading...</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><i className="fa-regular fa-compass" /><p>{search ? `No results for "${search}"` : 'No public projects yet.'}</p></div>
      ) : (
        <div className="discover-grid">
          {filtered.map(post => {
            const imgSrc = getImageSrc(post)
            return (
              <div key={post.id} className="discover-grid-card" onMouseEnter={()=>setHoveredId(post.id)} onMouseLeave={()=>setHoveredId(null)} onClick={()=>onViewPost(post)}>
                <div className="discover-grid-thumb">
                  {imgSrc
                    ? <img src={imgSrc} alt={post.title} onError={e => { e.target.style.display='none' }} />
                    : null
                  }
                  {!imgSrc && <div className="discover-grid-placeholder"><i className="fa-regular fa-image" /></div>}
                  {hoveredId === post.id && (
                    <div className="discover-grid-hover">
                      <div className="discover-hover-stats">
                        <span><i className="fa-solid fa-heart" /> {post.like_count}</span>
                        <span><i className="fa-regular fa-comment" /> {post.comment_count}</span>
                        <span><i className="fa-solid fa-eye" /> {post.views || 0}</span>
                      </div>
                      <div className="discover-hover-actions">
                        <button className="discover-hover-btn" onClick={e=>{e.stopPropagation();onViewProfile(post)}}><i className="fa-solid fa-user" /> Profile</button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="discover-grid-info">
                  <div className="discover-grid-title">{post.title}</div>
                  <div className="discover-grid-author" onClick={e=>{e.stopPropagation();onViewProfile(post)}}>
                    <div className="discover-mini-avatar">
                      {post.owner_avatar ? <img src={post.owner_avatar} alt="" onError={e=>e.target.style.display='none'} /> : <i className="fa-solid fa-user" />}
                    </div>
                    {post.owner_name}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DiscoverPostModal({ post, onClose, onViewProfile }) {
  const [comments, setComments] = useState(post.comments || [])
  const [likeCount, setLikeCount] = useState(post.like_count || 0)
  const [liked, setLiked] = useState(post.liked_by_me || false)
  const [commentText, setCommentText] = useState('')
  const imgSrc = getImageSrc(post)

  async function handleLike() {
    try { const data = await toggleLike(post.id); setLiked(data.liked); setLikeCount(data.count) } catch {}
  }
  async function handleComment() {
    if (!commentText.trim()) return
    try { const c = await addComment(post.id, commentText); setComments(prev => [...prev, c]); setCommentText('') } catch {}
  }
  function handleShare() {
    navigator.clipboard.writeText(window.location.origin + '/student').catch(()=>{})
    alert('Link copied!')
  }

  return (
    <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="discover-modal">
        <button className="discover-modal-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        <div className="discover-modal-left">
          {imgSrc
            ? <img src={imgSrc} alt={post.title} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }} />
            : null
          }
          <div style={{width:'100%',height:'100%',background:'linear-gradient(135deg,#1a3a8f,#2563eb44)',display: imgSrc ? 'none' : 'flex',alignItems:'center',justifyContent:'center',fontSize:'4rem',color:'rgba(255,255,255,0.2)'}}><i className="fa-regular fa-image"/></div>
        </div>
        <div className="discover-modal-right">
          <div className="discover-modal-header" onClick={()=>onViewProfile(post)} style={{cursor:'pointer'}}>
            <div className="discover-avatar">
              {post.owner_avatar ? <img src={post.owner_avatar} alt="" onError={e=>e.target.style.display='none'} /> : <i className="fa-solid fa-user" />}
            </div>
            <div>
              <div className="discover-author">{post.owner_name}</div>
              <div className="discover-meta">{post.category} · {post.status}</div>
            </div>
            <div style={{marginLeft:'auto',fontSize:'.74rem',color:'var(--accent-light)'}}>View Profile →</div>
          </div>
          <div className="discover-modal-body">
            <div className="discover-title" style={{fontSize:'1.1rem',marginBottom:8}}>{post.title}</div>
            {post.description && <p style={{color:'var(--text-muted)',fontSize:'.86rem',marginBottom:12,lineHeight:1.6}}>{post.description}</p>}
            {post.skills && post.skills.length > 0 && (
              <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:12}}>
                {post.skills.map(s=><span key={s} className="sd-skill-pill">{s}</span>)}
              </div>
            )}
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>
              {post.github_url && <a href={post.github_url} target="_blank" rel="noreferrer" className="sd-proj-link"><i className="fa-brands fa-github"/> GitHub</a>}
              {post.deploy_url && <a href={post.deploy_url} target="_blank" rel="noreferrer" className="sd-proj-link"><i className="fa-solid fa-globe"/> Live</a>}
              {post.figma_url  && <a href={post.figma_url}  target="_blank" rel="noreferrer" className="sd-proj-link"><i className="fa-solid fa-pen-ruler"/> Figma</a>}
            </div>
            <div className="discover-actions">
              <button className={`discover-action-btn${liked?' reacted':''}`} onClick={handleLike}>
                <i className={`fa-${liked?'solid':'regular'} fa-heart`} /> {likeCount}
              </button>
              <button className="discover-action-btn" onClick={handleShare}>
                <i className="fa-solid fa-share-nodes" /> Share
              </button>
            </div>
            <div className="discover-comments-section">
              <div className="discover-comments-list">
                {comments.length === 0 && <div style={{color:'var(--text-dim)',fontSize:'.82rem',textAlign:'center',padding:'12px 0'}}>No comments yet</div>}
                {comments.map((c,i) => (
                  <div key={i} className="discover-comment">
                    <span className="discover-comment-author">{c.author_name}</span>
                    <span className="discover-comment-text">{c.text}</span>
                    <span className="discover-comment-date">{new Date(c.at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="discover-comment-form">
                <input placeholder="Add a comment..." value={commentText} onChange={e=>setCommentText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleComment()} />
                <button className="btn-primary" onClick={handleComment}><i className="fa-solid fa-paper-plane" /></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProfileModal({ user, onClose }) {
  const [data, setData] = useState(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ownerId = user.owner || user.owner_id || user.id
    if (!ownerId) { setLoading(false); return }
    getPublicProfile(ownerId).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [user])

  if (fullscreen && data?.design) return <FullscreenPortfolio data={data.design} onClose={() => setFullscreen(false)} />

  const profile = data?.profile_extra || data?.extra || {}

  return (
    <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="profile-modal">
        <button className="discover-modal-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        <div className="profile-modal-cover" style={data?.user?.cover_url?{backgroundImage:`url(${data.user.cover_url})`,backgroundSize:'cover',backgroundPosition:'center'}:{}} />
        <div className="profile-modal-header">
          <div className="profile-modal-avatar">
            {data?.user?.avatar_url ? <img src={data.user.avatar_url} alt="avatar" onError={e=>e.target.style.display='none'} /> : <i className="fa-solid fa-user" style={{fontSize:'2rem'}} />}
          </div>
          <div style={{flex:1}}>
            <div style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:'1.2rem'}}>{data?.user?.name || user.owner_name}</div>
            <div style={{color:'var(--text-muted)',fontSize:'.84rem'}}>{data?.user?.program || 'Student'}</div>
            {profile.about_bio && <p style={{color:'var(--text-muted)',fontSize:'.8rem',marginTop:6,lineHeight:1.5}}>{profile.about_bio}</p>}
          </div>
          {data?.design && <button className="btn-outline" onClick={()=>setFullscreen(true)}><i className="fa-solid fa-expand" /> Portfolio</button>}
        </div>
        {loading && <div style={{padding:24,textAlign:'center',color:'var(--text-dim)'}}><i className="fa-solid fa-spinner fa-spin"/> Loading...</div>}
        {!loading && (
          <div className="profile-modal-body">
            {data?.design && (data.design.elements?.['0']?.length > 0 || data.design.elements?.[0]?.length > 0) ? (
              <div style={{overflowX:'auto',marginBottom:24}}>
                <div style={{transform:'scale(0.55)',transformOrigin:'top left',height:308,width:'100%'}}>
                  <PortfolioCanvas data={data.design} />
                </div>
              </div>
            ) : <div style={{color:'var(--text-dim)',fontSize:'.84rem',marginBottom:18,textAlign:'center'}}>No portfolio design yet</div>}

            <h4 style={{fontFamily:'var(--font-display)',marginBottom:12}}>Public Projects</h4>
            <div className="sd-projects-grid" style={{marginBottom:24}}>
              {(data?.projects || []).map((p,i) => (
                <div className="sd-project-card" key={p.id||i}>
                  <div className="sd-project-thumb"><ProjectThumb p={p} /></div>
                  <div className="sd-project-info">
                    <div className="sd-project-title">{p.title}</div>
                    <div className="sd-project-cat">{p.category}</div>
                  </div>
                </div>
              ))}
            </div>
            {(!data?.projects || data.projects.length === 0) && <div className="empty-state" style={{padding:'14px 0'}}><i className="fa-regular fa-folder-open"/><p>No public projects</p></div>}

            {(profile.about_bio || profile.about_interests || profile.about_github) && (
              <>
                <h4 style={{fontFamily:'var(--font-display)',marginBottom:10,marginTop:8}}>About</h4>
                <div style={{background:'var(--card-bg)',border:'1px solid var(--card-border)',borderRadius:10,padding:14,marginBottom:20,fontSize:'.86rem',color:'var(--text-muted)',lineHeight:1.7}}>
                  {profile.about_bio && <p style={{marginBottom:8}}>{profile.about_bio}</p>}
                  {profile.about_interests && <p><strong style={{color:'var(--accent-light)'}}>Interests:</strong> {profile.about_interests}</p>}
                  {profile.about_languages && <p><strong style={{color:'var(--accent-light)'}}>Languages:</strong> {profile.about_languages}</p>}
                  <div style={{display:'flex',gap:10,marginTop:10,flexWrap:'wrap'}}>
                    {profile.about_github && <a href={profile.about_github} target="_blank" rel="noreferrer" className="sd-proj-link"><i className="fa-brands fa-github"/> GitHub</a>}
                    {profile.about_linkedin && <a href={profile.about_linkedin} target="_blank" rel="noreferrer" className="sd-proj-link"><i className="fa-brands fa-linkedin"/> LinkedIn</a>}
                  </div>
                </div>
              </>
            )}

            {profile.resume_data && Object.keys(profile.resume_data).length > 0 && (() => {
              const r = profile.resume_data
              return (
                <>
                  <h4 style={{fontFamily:'var(--font-display)',marginBottom:10}}>Resume</h4>
                  <div style={{background:'var(--card-bg)',border:'1px solid var(--card-border)',borderRadius:10,padding:16,fontSize:'.84rem',color:'var(--text-muted)',lineHeight:1.6}}>
                    {r.name && <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:'1rem',color:'var(--text)',marginBottom:4}}>{r.name}</div>}
                    {(r.role || r.email) && <div style={{marginBottom:8}}>{r.role}{r.email ? ` · ${r.email}` : ''}{r.phone ? ` · ${r.phone}` : ''}</div>}
                    {r.summary && <div style={{marginBottom:10,fontStyle:'italic'}}>{r.summary}</div>}
                    {r.skills && <div style={{marginBottom:8}}><strong style={{color:'var(--accent-light)'}}>Skills:</strong> {r.skills}</div>}
                    {r.edu && <div style={{marginBottom:6}}><strong style={{color:'var(--accent-light)'}}>Education:</strong><br/>{r.edu}</div>}
                    {r.exp && <div><strong style={{color:'var(--accent-light)'}}>Experience:</strong><br/>{r.exp}</div>}
                  </div>
                </>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

function NotifToast({ notif, onClose, onClick }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [onClose, notif])
  return (
    <div className="notif-toast" onClick={onClick}>
      <div className="notif-toast-icon"><i className="fa-solid fa-bell" /></div>
      <div className="notif-toast-body">
        <div className="notif-toast-title">{notif.title}</div>
        <div className="notif-toast-msg">{notif.message?.slice(0, 80)}{notif.message?.length > 80 ? '...' : ''}</div>
      </div>
      <button className="notif-toast-close" onClick={e=>{e.stopPropagation();onClose()}}><i className="fa-solid fa-xmark" /></button>
    </div>
  )
}

function UploadSuccessModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="modal-box" style={{textAlign:'center',padding:'40px 32px'}}>
        <div style={{fontSize:'3.5rem',marginBottom:16}}>🎉</div>
        <h2 style={{fontFamily:'var(--font-display)',fontSize:'1.4rem',fontWeight:800,marginBottom:8}}>Project Uploaded!</h2>
        <p style={{color:'var(--text-muted)',marginBottom:24}}>Your project has been successfully uploaded and is now visible to others.</p>
        <button className="btn-primary" onClick={onClose} style={{padding:'10px 32px'}}>Done</button>
      </div>
    </div>
  )
}

export default function StudentDashboard() {
  const nav = useNavigate()
  const session = getSession()
  const [section, setSection] = useState('dashboard')
  const [portfolioTab, setPortfolioTab] = useState('pprojects')
  const [stats, setStats] = useState({ projects:0, views:0, clicks:0, reviews:0 })
  const [user, setUser] = useState(session)
  const [profile, setProfile] = useState({ about_bio:'', about_interests:'', about_languages:'', about_github:'', about_linkedin:'', resume_data:{}, resume_template:0, avatar_data_url:'', cover_data_url:'' })
  const [alerts, setAlerts] = useState([])
  const [seenAlertIds, setSeenAlertIds] = useState(() => { try { return JSON.parse(localStorage.getItem('sdpms_seen_alerts') || '[]') } catch { return [] } })
  const [toastAlert, setToastAlert] = useState(null)
  const [viewAlert, setViewAlert] = useState(null)
  const [deletedAlerts, setDeletedAlerts] = useState(() => { try { return JSON.parse(localStorage.getItem('sdpms_deleted_alerts') || '[]') } catch { return [] } })
  const [templates, setTemplates] = useState([])
  const [portfolioDesign, setPortfolioDesign] = useState(null)
  const [showFigmaEditor, setShowFigmaEditor] = useState(false)
  const [figmaMode, setFigmaMode] = useState('portfolio')
  const [figmaInitData, setFigmaInitData] = useState(null)
  const [fullscreenPortfolio, setFullscreenPortfolio] = useState(false)
  const [resumeTemplate, setResumeTemplate] = useState(0)
  const [resumeData, setResumeData] = useState({})
  const [uploadForm, setUploadForm] = useState(BLANK_UPLOAD)
  const [uploadFb, setUploadFb] = useState('')
  const [showUploadSuccess, setShowUploadSuccess] = useState(false)
  const [editProjectModal, setEditProjectModal] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [editProjectForm, setEditProjectForm] = useState({})
  const [settingsForm, setSettingsForm] = useState({ name:'', dob:'', sex:'Male', program:'', address:'', bio:'', skills:'' })
  const [settingsFb, setSettingsFb] = useState('')
  const [resumeFb, setResumeFb] = useState('')
  const [aboutData, setAboutData] = useState({ bio:'', interests:'', languages:'', github:'', linkedin:'' })
  const [aboutFb, setAboutFb] = useState('')
  const [shareFb, setShareFb] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [showTrash, setShowTrash] = useState(false)
  const [skillSearch, setSkillSearch] = useState('')
  const [discoverPost, setDiscoverPost] = useState(null)
  const [discoverProfile, setDiscoverProfile] = useState(null)
  const [tplPreviewModal, setTplPreviewModal] = useState(null)
  const [allProjects, setAllProjects] = useState([])
  const [showImageModal, setShowImageModal] = useState(null)
  const [imgUrl, setImgUrl] = useState('')
  const [imgPreview, setImgPreview] = useState('')
  const canvasRef = useRef(null)
  const imgRef = useRef({ img:null, x:0, y:0, w:0, h:0, dragging:false, dx:0, dy:0 })
  const prevAlertCount = useRef(0)

  const activeProjects = allProjects.filter(p => !p.deleted)
  const trashedProjects = allProjects.filter(p => p.deleted)
  const filteredSkills = ALL_SKILLS.filter(s => s.toLowerCase().includes(skillSearch.toLowerCase()) && !uploadForm.skills.includes(s))
  const visibleAlerts = alerts.filter(a => !deletedAlerts.includes(a.id))

  async function loadAll() {
    try {
      const [u, prof, projs, st, ann, tpl, design] = await Promise.all([
        fetchMe(), getProfile(), getProjects(true), getStudentStats(),
        getAnnouncements(), getTemplates(), getPortfolioDesign(),
      ])
      setUser(u)
      setProfile(prof)
      setAllProjects(projs)
      setStats(st)
      setAlerts(ann)
      setTemplates(tpl)
      setPortfolioDesign(design)
      setSettingsForm({ name:u.name||'', dob:u.dob||'', sex:u.sex||'Male', program:u.program||'', address:u.address||'', bio:u.bio||'', skills:u.skills||'' })
      setResumeData(prof.resume_data || {})
      setResumeTemplate(prof.resume_template || 0)
      setAboutData({ bio:prof.about_bio||'', interests:prof.about_interests||'', languages:prof.about_languages||'', github:prof.about_github||'', linkedin:prof.about_linkedin||'' })

      if (ann.length > prevAlertCount.current && prevAlertCount.current > 0) {
        const newest = ann[0]
        if (newest && !seenAlertIds.includes(newest.id)) {
          setToastAlert(newest)
          const updated = [...seenAlertIds, newest.id]
          setSeenAlertIds(updated)
          localStorage.setItem('sdpms_seen_alerts', JSON.stringify(updated))
        }
      }
      prevAlertCount.current = ann.length
    } catch {}
  }

  useEffect(() => { loadAll() }, [])
  useEffect(() => { if (section === 'discover') return; loadAll() }, [section])

  useEffect(() => {
    const interval = setInterval(() => {
      getAnnouncements().then(ann => {
        if (ann.length > prevAlertCount.current) {
          const newest = ann[0]
          if (newest && !seenAlertIds.includes(newest.id)) {
            setToastAlert(newest)
            const updated = [...seenAlertIds, newest.id]
            setSeenAlertIds(updated)
            localStorage.setItem('sdpms_seen_alerts', JSON.stringify(updated))
          }
          prevAlertCount.current = ann.length
          setAlerts(ann)
        }
      }).catch(() => {})
    }, 30000)
    return () => clearInterval(interval)
  }, [seenAlertIds])

  function deleteAlert(id) {
    const updated = [...deletedAlerts, id]
    setDeletedAlerts(updated)
    localStorage.setItem('sdpms_deleted_alerts', JSON.stringify(updated))
  }

  function logout() { clearSession(); nav('/login') }
  function nav2(s) { setSection(s); document.getElementById('student-main')?.scrollTo(0,0) }

  async function doUpload(e) {
    e.preventDefault()
    if (!uploadForm.title.trim()) { setUploadFb('⚠ Title is required.'); return }
    try {
      const payload = {
        title: uploadForm.title, description: uploadForm.description,
        category: uploadForm.category, status: uploadForm.status,
        privacy: uploadForm.privacy, image_url: uploadForm.image_url || uploadForm.canvaUrl || '',
        githubUrl: uploadForm.githubUrl, deployUrl: uploadForm.deployUrl,
        figmaUrl: uploadForm.figmaUrl, adobeUrl: uploadForm.adobeUrl,
        completion_date: uploadForm.completion_date, skills: uploadForm.skills,
      }
      await addProject(payload, uploadForm.imageFile)
      setUploadForm(BLANK_UPLOAD)
      const projs = await getProjects(true); setAllProjects(projs)
      const st = await getStudentStats(); setStats(st)
      setShowUploadSuccess(true)
    } catch (err) { setUploadFb('⚠ ' + (err.message || 'Upload failed')) }
  }

  function openEditProject(p) {
    setEditingProject(p)
    setEditProjectForm({...p, image_url: p.image_url || p.effective_image || ''})
    setEditProjectModal(true)
  }

  async function saveEditProject(e) {
    e.preventDefault()
    try {
      const payload = {
        title: editProjectForm.title, description: editProjectForm.description,
        category: editProjectForm.category, status: editProjectForm.status,
        privacy: editProjectForm.privacy, image_url: editProjectForm.image_url || '',
        githubUrl: editProjectForm.github_url || editProjectForm.githubUrl || '',
        deployUrl: editProjectForm.deploy_url || editProjectForm.deployUrl || '',
        figmaUrl: editProjectForm.figma_url || editProjectForm.figmaUrl || '',
        adobeUrl: editProjectForm.adobe_url || editProjectForm.adobeUrl || '',
      }
      await updateProject(editingProject.id, payload)
      const projs = await getProjects(true); setAllProjects(projs)
      setEditProjectModal(false)
    } catch {}
  }

  async function saveSettings(e) {
    e.preventDefault()
    try { await updateMe(settingsForm); setSettingsFb('✓ Settings saved!'); setTimeout(()=>setSettingsFb(''), 2500) }
    catch (err) { setSettingsFb('⚠ ' + err.message) }
  }

  async function saveResume(e) {
    e.preventDefault()
    try { await saveProfile({ resume_data: resumeData, resume_template: resumeTemplate }); setResumeFb('✓ Saved!'); setTimeout(()=>setResumeFb(''), 2500) } catch {}
  }

  async function saveAboutMe(e) {
    e.preventDefault()
    try {
      await saveProfile({ about_bio: aboutData.bio, about_interests: aboutData.interests, about_languages: aboutData.languages, about_github: aboutData.github, about_linkedin: aboutData.linkedin })
      setAboutFb('✓ Saved!'); setTimeout(()=>setAboutFb(''), 2500)
    } catch {}
  }

  function copyShareLink() {
    navigator.clipboard.writeText(`${window.location.origin}/portfolio/${user.id || 'student'}`)
    setShareFb('✓ Copied!'); setTimeout(()=>setShareFb(''), 2500)
  }

  function openImageModal(type) {
    setShowImageModal(type)
    setImgUrl(type==='cover'?(profile.cover_data_url||''):(profile.avatar_data_url||''))
    setImgPreview('')
    imgRef.current = { img:null, x:0, y:0, w:0, h:0, dragging:false, dx:0, dy:0 }
    setTimeout(() => {
      const canvas = canvasRef.current; if (!canvas) return
      canvas.width = type==='cover' ? 1200 : 400
      canvas.height = type==='cover' ? 400 : 400
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#111b2e'; ctx.fillRect(0,0,canvas.width,canvas.height)
    }, 80)
  }

  function loadImgToCanvas(src) {
    const img = new Image(); img.crossOrigin = 'anonymous'
    img.onload = () => {
      const d = imgRef.current, canvas = canvasRef.current; if (!canvas) return
      d.img = img
      const ratio = Math.min(canvas.width/img.width, canvas.height/img.height)
      d.w = img.width*ratio; d.h = img.height*ratio
      d.x = (canvas.width-d.w)/2; d.y = (canvas.height-d.h)/2
      drawCanvas(); setImgPreview(src)
    }
    img.src = src
  }

  function loadImgFromFile(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { setImgUrl(ev.target.result); loadImgToCanvas(ev.target.result) }
    reader.readAsDataURL(file)
  }

  function drawCanvas() {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'), d = imgRef.current
    ctx.fillStyle = '#111b2e'; ctx.fillRect(0,0,canvas.width,canvas.height)
    if (d.img) { ctx.drawImage(d.img, d.x, d.y, d.w, d.h); ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 2; ctx.strokeRect(d.x,d.y,d.w,d.h); ctx.fillStyle = '#60a5fa'; ctx.fillRect(d.x+d.w-10,d.y+d.h-10,10,10) }
  }

  async function applyImage() {
    const d = imgRef.current; if (!d.img) { alert('Load an image first.'); return }
    const canvas = canvasRef.current; if (!canvas) return
    const outW = showImageModal==='cover' ? 1400 : 400, outH = showImageModal==='cover' ? 420 : 400
    const sx = outW/canvas.width, sy = outH/canvas.height
    const tmp = document.createElement('canvas'); tmp.width = outW; tmp.height = outH
    const ctx = tmp.getContext('2d')
    ctx.fillStyle = '#111b2e'; ctx.fillRect(0,0,outW,outH)
    ctx.drawImage(d.img, d.x*sx, d.y*sy, d.w*sx, d.h*sy)
    const url = tmp.toDataURL('image/jpeg', 0.95)
    try {
      if (showImageModal==='cover') { await saveProfile({ cover_data_url: url }); setProfile(p => ({...p, cover_data_url: url})) }
      else { await saveProfile({ avatar_data_url: url }); setProfile(p => ({...p, avatar_data_url: url})) }
    } catch {}
    setShowImageModal(null)
  }

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas || !showImageModal) return
    function onDown(e) {
      const rect = canvas.getBoundingClientRect()
      const mx = (e.clientX-rect.left)*(canvas.width/rect.width), my = (e.clientY-rect.top)*(canvas.height/rect.height)
      const d = imgRef.current
      if (mx>=d.x&&mx<=d.x+d.w&&my>=d.y&&my<=d.y+d.h) { d.dragging=true; d.dx=mx-d.x; d.dy=my-d.y }
    }
    function onMove(e) {
      const d = imgRef.current; if (!d.dragging) return
      const rect = canvas.getBoundingClientRect()
      d.x=(e.clientX-rect.left)*(canvas.width/rect.width)-d.dx
      d.y=(e.clientY-rect.top)*(canvas.height/rect.height)-d.dy
      drawCanvas()
    }
    function onUp() { imgRef.current.dragging = false }
    function onWheel(e) {
      e.preventDefault(); const d = imgRef.current; if (!d.img) return
      const delta = e.deltaY>0 ? 0.92 : 1.08, newW = d.w*delta
      if (newW<40||newW>2000) return
      const cx=d.x+d.w/2, cy=d.y+d.h/2, asp=d.h/d.w
      d.w=newW; d.h=newW*asp; d.x=cx-d.w/2; d.y=cy-d.h/2; drawCanvas()
    }
    canvas.addEventListener('mousedown',onDown); window.addEventListener('mousemove',onMove)
    window.addEventListener('mouseup',onUp); canvas.addEventListener('wheel',onWheel,{passive:false})
    return () => { canvas.removeEventListener('mousedown',onDown); window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); canvas.removeEventListener('wheel',onWheel) }
  }, [showImageModal])

  const computedAge = settingsForm.dob ? calcAge(settingsForm.dob) : ''
  const shareUrl = `${window.location.origin}/portfolio/${user.id || 'student'}`
  const avatarUrl = profile.avatar_data_url || user.avatar_url || null
  const coverUrl = profile.cover_data_url || user.cover_url || null
  const selectedUploadType = UPLOAD_TYPES.find(t => t.key === uploadForm.fileType) || UPLOAD_TYPES[0]

  const sideItems = [
    { key:'dashboard', icon:'gauge', label:'Dashboard', group:'Main' },
    { key:'discover', icon:'compass', label:'Discover Projects' },
    { key:'projects', icon:'folder', label:'My Projects' },
    { key:'editor', icon:'images', label:'Portfolio Editor' },
    { key:'upload', icon:'cloud-arrow-up', label:'Upload Project' },
    { key:'_port', label:'Portfolio', group:true },
    { key:'templates', icon:'copy', label:'Templates' },
    { key:'public-view', icon:'eye', label:'Public View' },
    { key:'analytics', icon:'chart-line', label:'Analytics' },
    { key:'share', icon:'link', label:'Share Link' },
    { key:'_acc', label:'Account', group:true },
    { key:'settings', icon:'gear', label:'Settings' },
  ]

  if (fullscreenPortfolio) return <FullscreenPortfolio data={portfolioDesign} onClose={()=>setFullscreenPortfolio(false)} />

  if (showFigmaEditor) {
    const handleFigmaSave = async (data) => {
      if (figmaMode === 'project') {
        const canvas = document.createElement('canvas')
        canvas.width = 400; canvas.height = 280
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = data.bg || '#1a2744'; ctx.fillRect(0, 0, 400, 280)
        const els = data.elements[0] || data.elements['0'] || []
        const scaleX = 400/800; const scaleY = 280/560
        els.forEach(el => {
          if (el.type === 'text') {
            ctx.fillStyle = el.color || '#000'
            ctx.font = `${el.fontWeight || '400'} ${(el.fontSize || 20) * scaleX}px ${el.fontFamily || 'Arial'}`
            ctx.fillText(el.content || '', el.x * scaleX, (el.y + (el.fontSize || 20)) * scaleY)
          } else if (el.type === 'image' && el.src) {
            const img = new Image()
            img.src = el.src
            img.onload = () => { ctx.drawImage(img, el.x * scaleX, el.y * scaleY, el.w * scaleX, el.h * scaleY) }
          } else if (el.type !== 'line' && el.fill && !el.fill.startsWith('url')) {
            ctx.fillStyle = el.fill
            if (el.type === 'circle') { ctx.beginPath(); ctx.ellipse((el.x+el.w/2)*scaleX, (el.y+el.h/2)*scaleY, (el.w/2)*scaleX, (el.h/2)*scaleY, 0, 0, Math.PI*2); ctx.fill() }
            else { ctx.fillRect(el.x*scaleX, el.y*scaleY, el.w*scaleX, el.h*scaleY) }
          }
        })
        const thumbnail = canvas.toDataURL('image/jpeg', 0.9)
        const payload = {
          title: `Design Project ${new Date().toLocaleDateString()}`,
          description: 'Created with the built-in designer',
          category: 'Design',
          status: 'Completed',
          privacy: 'public',
          image_url: thumbnail,
          skills: [],
          completion_date: new Date().toISOString().split('T')[0],
        }
        try {
          const blob = await (await fetch(thumbnail)).blob()
          const file = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' })
          await addProject(payload, file)
          const projs = await getProjects(true); setAllProjects(projs)
          const st = await getStudentStats(); setStats(st)
          setShowFigmaEditor(false); setFigmaInitData(null)
          nav2('projects')
        } catch (err) { alert('Failed to save project: ' + err.message) }
      } else {
        try { await savePortfolioDesign(data); setPortfolioDesign(data) } catch {}
        setShowFigmaEditor(false); setFigmaInitData(null)
        nav2('editor'); setPortfolioTab('portfolio')
      }
    }

    return (
      <FigmaEditor
        initialData={figmaInitData || (figmaMode === 'project' ? { pages:['Page 1'], elements:{0:[]}, bg:'#1a2744' } : portfolioDesign) || { pages:['Page 1'], elements:{0:[]}, bg:'#1a2744' }}
        canvasLabel={figmaMode === 'project' ? 'Project Designer' : 'Portfolio Designer'}
        onClose={() => { setShowFigmaEditor(false); setFigmaInitData(null) }}
        onSave={handleFigmaSave}
      />
    )
  }

  return (
    <div className="sd-wrap">
      {toastAlert && (
        <NotifToast
          notif={toastAlert}
          onClose={() => setToastAlert(null)}
          onClick={() => { setViewAlert(toastAlert); setToastAlert(null) }}
        />
      )}

      <header className="sd-topnav">
        <div className="sd-topnav-left">
          <div className="sd-logo">SDMS</div>
          <nav className="sd-toplinks">
            <button className={`sd-toplink${section==='dashboard'?' active':''}`} onClick={()=>nav2('dashboard')}>Dashboard</button>
          </nav>
        </div>
        <div className="sd-topnav-right">
          <button className="sd-notif-btn" onClick={()=>nav2('dashboard')} title="Notifications">
            <i className="fa-regular fa-bell" />
            {visibleAlerts.length > 0 && <span className="sd-notif-badge">{visibleAlerts.length}</span>}
          </button>
          <span className="sd-role-badge">Student</span>
          <div className="sd-avatar" onClick={()=>nav2('settings')} style={{cursor:'pointer'}}>
            {avatarUrl ? <img src={avatarUrl} alt="avatar" onError={e=>e.target.style.display='none'} /> : <i className="fa-solid fa-user" />}
          </div>
        </div>
      </header>

      <div className="sd-layout">
        <aside className="sd-sidebar">
          {sideItems.map(item => {
            if (item.group===true) return <div key={item.key} className="sd-sidebar-label">{item.label}</div>
            if (item.group==='Main') return (
              <React.Fragment key={item.key}>
                <div className="sd-sidebar-label">Main</div>
                <button className={`sd-sidebar-item${section===item.key?' active':''}`} onClick={()=>nav2(item.key)}>
                  <i className={`fa-solid fa-${item.icon}`} /> {item.label}
                </button>
              </React.Fragment>
            )
            return (
              <button key={item.key} className={`sd-sidebar-item${section===item.key?' active':''}`} onClick={()=>nav2(item.key)}>
                <i className={`fa-solid fa-${item.icon}`} /> {item.label}
              </button>
            )
          })}
          <button className="sd-sidebar-item sd-logout" onClick={logout}><i className="fa-solid fa-right-from-bracket" /> Log Out</button>
        </aside>

        <main className="sd-main" id="student-main">

          {section === 'dashboard' && (
            <div className="sd-section">
              <div className="sd-section-header">
                <div><h2 className="sd-section-title">Welcome, {user.name || 'User'} 👋</h2><p className="sd-section-sub">Here's your Portfolio Overview</p></div>
                <div className="sd-date-badge"><i className="fa-regular fa-calendar" /> {new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
              </div>
              <div className="sd-stats-grid">
                {[{icon:'folder',val:stats.projects,label:'Total Projects'},{icon:'eye',val:stats.views,label:'Portfolio Views'},{icon:'link',val:stats.clicks,label:'Link Clicks'},{icon:'star',val:stats.reviews,label:'Reviews'}].map(s=>(
                  <div className="sd-stat-card" key={s.label}><div className="sd-stat-icon"><i className={`fa-solid fa-${s.icon}`}/></div><div className="sd-stat-val">{s.val}</div><div className="sd-stat-name">{s.label}</div></div>
                ))}
              </div>
              <div className="sd-card" style={{marginBottom:20}}>
                <h3 className="sd-card-title">My Projects</h3>
                <div className="sd-projects-grid">
                  {activeProjects.slice(0,5).map((p,i)=>(
                    <div className="sd-project-card" key={p.id||i}>
                      <div className="sd-project-thumb"><ProjectThumb p={p} /></div>
                      <div className="sd-project-info"><div className="sd-project-title">{p.title}</div><div className="sd-project-cat">{p.category}</div></div>
                    </div>
                  ))}
                  <div className="sd-upload-card" onClick={()=>nav2('upload')}><i className="fa-solid fa-plus"/><span>Upload Project</span></div>
                </div>
              </div>
              <div className="sd-alerts-card">
                <div className="sd-alerts-header"><h3><i className="fa-regular fa-bell"/> Recent Alerts</h3><span className="sd-alerts-badge">{visibleAlerts.length}</span></div>
                {visibleAlerts.length===0 ? <div className="sd-alerts-empty"><i className="fa-regular fa-bell-slash"/><p>No alerts yet</p><span>Admin notifications appear here</span></div> : (
                  <div className="sd-alerts-list">
                    {visibleAlerts.map((a,i)=>(
                      <div className="sd-alert-item" key={a.id||i}>
                        <div className="sd-alert-dot"/>
                        <div style={{flex:1,cursor:'pointer'}} onClick={()=>setViewAlert(a)}>
                          <div className="sd-alert-title">{a.title}</div>
                          <div className="sd-alert-msg">{a.message}</div>
                          <div className="sd-alert-date">{new Date(a.created_at).toLocaleString()}</div>
                        </div>
                        <button style={{background:'none',border:'none',color:'var(--text-dim)',cursor:'pointer',padding:'4px 8px',borderRadius:5}} onClick={()=>deleteAlert(a.id)} title="Delete"><i className="fa-solid fa-xmark"/></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {section === 'discover' && <DiscoverGrid onViewPost={setDiscoverPost} onViewProfile={setDiscoverProfile} />}

          {section === 'projects' && (
            <div className="sd-section">
              <div className="sd-section-header">
                <div><h2 className="sd-section-title">My Projects</h2></div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  <button className="btn-outline" onClick={()=>setShowTrash(t=>!t)}><i className="fa-regular fa-trash-can"/> Trash ({trashedProjects.length})</button>
                  <button className="btn-primary" onClick={()=>nav2('upload')}><i className="fa-solid fa-plus"/> Upload</button>
                </div>
              </div>
              {activeProjects.length===0 ? <div className="empty-state"><i className="fa-regular fa-folder-open"/><p>No projects yet.</p></div> : (
                <div className="sd-projects-grid">
                  {activeProjects.map((p,i)=>(
                    <div className="sd-project-card" key={p.id||i}>
                      <div className="sd-project-thumb">
                        <ProjectThumb p={p} />
                        <div className="sd-project-privacy-badge"><i className={`fa-solid fa-${p.privacy==='private'?'lock':p.privacy==='unlisted'?'eye-slash':'globe'}`}/> {p.privacy||'public'}</div>
                      </div>
                      <div className="sd-project-info">
                        <div className="sd-project-title">{p.title}</div>
                        <div className="sd-project-cat">{p.category}</div>
                        <div className="sd-project-status">{p.status}</div>
                        {p.skills&&p.skills.length>0&&<div className="sd-project-skills">{p.skills.slice(0,3).map(sk=><span key={sk} className="sd-skill-pill">{sk}</span>)}</div>}
                        <div className="sd-project-actions">
                          <button className="sd-proj-btn" onClick={()=>openEditProject(p)}><i className="fa-regular fa-pen-to-square"/> Edit</button>
                          <button className="sd-proj-btn sd-proj-btn-danger" onClick={()=>setDeleteConfirm({type:'project',id:p.id})}><i className="fa-regular fa-trash-can"/> Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="sd-upload-card" onClick={()=>nav2('upload')}><i className="fa-solid fa-plus"/><span>Upload Project</span></div>
                </div>
              )}
              {showTrash && (
                <div style={{marginTop:24}}>
                  <h3 style={{fontFamily:'var(--font-display)',fontSize:'1rem',fontWeight:700,marginBottom:14,color:'var(--red)',display:'flex',alignItems:'center',gap:8}}><i className="fa-regular fa-trash-can"/> Trash Bin</h3>
                  {trashedProjects.length===0 ? <div className="empty-state" style={{padding:'24px 0'}}><p>Trash is empty</p></div> : (
                    <div className="sd-projects-grid">
                      {trashedProjects.map(p=>(
                        <div className="sd-project-card" key={p.id} style={{opacity:.6,filter:'grayscale(40%)'}}>
                          <div className="sd-project-thumb"><ProjectThumb p={p} /></div>
                          <div className="sd-project-info">
                            <div className="sd-project-title">{p.title}</div>
                            <div className="sd-project-actions">
                              <button className="sd-proj-btn" onClick={async()=>{await restoreProject(p.id);const projs=await getProjects(true);setAllProjects(projs)}}><i className="fa-solid fa-rotate-left"/> Restore</button>
                              <button className="sd-proj-btn sd-proj-btn-danger" onClick={()=>setDeleteConfirm({type:'project_permanent',id:p.id})}><i className="fa-regular fa-trash-can"/> Forever</button>
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

          {section === 'editor' && (
            <div className="sd-section">
              <div className="sd-portfolio-banner">
                <div className="sd-cover" style={coverUrl?{backgroundImage:`url(${coverUrl})`,backgroundSize:'cover',backgroundPosition:'center top'}:{}} />
                <div className="sd-portfolio-header-content">
                  <div className="sd-avatar-large" onClick={()=>openImageModal('avatar')}>
                    {avatarUrl?<img src={avatarUrl} alt="avatar" onError={e=>e.target.style.display='none'} />:<i className="fa-solid fa-user" style={{fontSize:'2rem'}}/>}
                    <div className="sd-avatar-edit"><i className="fa-regular fa-camera"/></div>
                  </div>
                  <div className="sd-portfolio-info">
                    <h2>{(user.name||'Your Name').toUpperCase()}</h2>
                    <p>{user.program||'Technical Portfolio'}</p>
                    <div className="sd-ph-meta"><span>{user.role||'Student'}</span><span><i className="fa-regular fa-eye"/> Views: {stats.views}</span></div>
                  </div>
                  <div className="sd-portfolio-actions">
                    <button className="btn-primary" onClick={()=>{ setFigmaMode('portfolio'); setFigmaInitData(null); setShowFigmaEditor(true) }}><i className="fa-regular fa-pen-to-square"/> Edit Portfolio</button>
                    <button className="btn-outline" onClick={()=>openImageModal('cover')}><i className="fa-regular fa-camera"/> Edit Cover</button>
                    <button className="btn-outline" onClick={()=>setFullscreenPortfolio(true)}><i className="fa-solid fa-expand"/> Fullscreen</button>
                    <button className="btn-outline" style={{borderColor:'var(--red)',color:'var(--red)'}} onClick={()=>{ if(window.confirm('Clear portfolio design and start fresh?')){ savePortfolioDesign({pages:['Page 1'],elements:{0:[]},bg:'#1a2744'}).then(()=>{ setPortfolioDesign({pages:['Page 1'],elements:{0:[]},bg:'#1a2744'}); setFigmaInitData({pages:['Page 1'],elements:{0:[]},bg:'#1a2744'}); setShowFigmaEditor(true) }).catch(()=>{}) } }}>
                      <i className="fa-regular fa-trash-can"/> New Design
                    </button>
                  </div>
                </div>
              </div>
              <div className="sd-portfolio-tabs">
                {[['portfolio','Portfolio'],['pprojects','Projects'],['resume','Resume'],['aboutme','About Me']].map(([t,label])=>(
                  <button key={t} className={`sd-ptab${portfolioTab===t?' active':''}`} onClick={()=>setPortfolioTab(t)}>{label}</button>
                ))}
              </div>
              {portfolioTab==='portfolio' && (
                <div className="sd-ptab-content">
                  {portfolioDesign&&(portfolioDesign.elements?.['0']?.length>0||portfolioDesign.elements?.[0]?.length>0) ? (
                    <>
                      <div style={{overflowX:'auto',padding:'20px 0'}}><div style={{margin:'0 auto',width:'fit-content'}}><PortfolioCanvas data={portfolioDesign}/></div></div>
                      <div style={{display:'flex',justifyContent:'center',gap:10,marginTop:16}}>
                        <button className="btn-primary" onClick={()=>{setFigmaMode('portfolio'); setFigmaInitData(null); setShowFigmaEditor(true)}}><i className="fa-regular fa-pen-to-square"/> Edit Design</button>
                        <button className="btn-outline" onClick={()=>setFullscreenPortfolio(true)}><i className="fa-solid fa-expand"/> Fullscreen</button>
                      </div>
                    </>
                  ) : (
                    <div className="sd-ptab-placeholder"><i className="fa-regular fa-palette"/><p>Open Portfolio Editor to design your page.</p><button className="btn-primary" onClick={()=>{setFigmaMode('portfolio'); setFigmaInitData(null); setShowFigmaEditor(true)}}>Open Editor</button></div>
                  )}
                </div>
              )}
              {portfolioTab==='pprojects' && (
                <div className="sd-ptab-content">
                  <div className="sd-projects-grid">
                    {activeProjects.map((p,i)=>(
                      <div className="sd-project-card" key={p.id||i}>
                        <div className="sd-project-thumb"><ProjectThumb p={p} /></div>
                        <div className="sd-project-info"><div className="sd-project-title">{p.title}</div><div className="sd-project-cat">{p.category}</div></div>
                      </div>
                    ))}
                    <div className="sd-upload-card" onClick={()=>nav2('upload')}><i className="fa-solid fa-plus"/><span>Upload Project</span></div>
                  </div>
                </div>
              )}
              {portfolioTab==='resume' && (
                <div className="sd-ptab-content">
                  <div className="sd-resume-templates-row">
                    {RESUME_TEMPLATES.map((t,i)=>(
                      <div key={t.name} className={`sd-resume-thumb${resumeTemplate===i?' selected':''}`} onClick={()=>setResumeTemplate(i)}>
                        <i className={t.icon} style={{color:t.color,fontSize:'1.4rem'}}/><span>{t.name}</span>
                      </div>
                    ))}
                  </div>
                  <div className="sd-resume-editor">
                    <div className="sd-resume-preview">
                      {(()=>{const r=resumeData,tpl=RESUME_TEMPLATES[resumeTemplate];return(<div style={{borderTop:`4px solid ${tpl.color}`,padding:16}}><h2 style={{color:tpl.color,fontFamily:'Syne,sans-serif',marginBottom:4}}>{r.name||'Your Name'}</h2><p style={{color:'var(--text-muted)',fontSize:'.84rem',marginBottom:12}}>{r.role||'Student'}{r.email?` · ${r.email}`:''}{r.phone?` · ${r.phone}`:''}</p>{r.address&&<p style={{color:'var(--text-muted)',fontSize:'.8rem',marginBottom:12}}>📍 {r.address}</p>}{r.summary&&<div style={{background:'rgba(255,255,255,.04)',borderLeft:`3px solid ${tpl.color}`,padding:10,borderRadius:4,marginBottom:14,fontSize:'.86rem'}}>{r.summary}</div>}{r.skills&&<div style={{marginBottom:14}}><strong style={{color:tpl.color,fontSize:'.78rem',textTransform:'uppercase'}}>Skills</strong><div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:6}}>{r.skills.split(',').map(s=><span key={s} style={{background:'rgba(37,99,235,.15)',border:'1px solid rgba(37,99,235,.25)',padding:'2px 10px',borderRadius:20,fontSize:'.76rem'}}>{s.trim()}</span>)}</div></div>}{r.edu&&<div style={{marginBottom:12}}><strong style={{color:tpl.color,fontSize:'.78rem',textTransform:'uppercase'}}>Education</strong><p style={{marginTop:6,fontSize:'.86rem',whiteSpace:'pre-line'}}>{r.edu}</p></div>}{r.exp&&<div style={{marginBottom:12}}><strong style={{color:tpl.color,fontSize:'.78rem',textTransform:'uppercase'}}>Experience</strong><p style={{marginTop:6,fontSize:'.86rem',whiteSpace:'pre-line'}}>{r.exp}</p></div>}</div>)})()}
                    </div>
                    <form className="sd-resume-fields" onSubmit={saveResume}>
                      <h4>Personal Information</h4>
                      <div className="field-row"><div className="field-group"><label>Full Name</label><input value={resumeData.name||''} onChange={e=>setResumeData(d=>({...d,name:e.target.value}))}/></div><div className="field-group"><label>Date of Birth</label><input type="date" value={resumeData.dob||''} onChange={e=>setResumeData(d=>({...d,dob:e.target.value}))}/>{resumeData.dob&&<div className="sd-age-note">Age: {calcAge(resumeData.dob)}</div>}</div></div>
                      <div className="field-row"><div className="field-group"><label>Email</label><input value={resumeData.email||''} onChange={e=>setResumeData(d=>({...d,email:e.target.value}))}/></div><div className="field-group"><label>Phone</label><input value={resumeData.phone||''} onChange={e=>setResumeData(d=>({...d,phone:e.target.value}))}/></div></div>
                      <div className="field-group"><label>Address</label><input value={resumeData.address||''} onChange={e=>setResumeData(d=>({...d,address:e.target.value}))}/></div>
                      <div className="field-group"><label>Role / Program</label><input value={resumeData.role||''} onChange={e=>setResumeData(d=>({...d,role:e.target.value}))}/></div>
                      <hr className="sd-divider"/><h4>Academic & Professional</h4>
                      <div className="field-group"><label>Skills</label><input value={resumeData.skills||''} onChange={e=>setResumeData(d=>({...d,skills:e.target.value}))}/></div>
                      <div className="field-group"><label>Education</label><textarea rows={3} value={resumeData.edu||''} onChange={e=>setResumeData(d=>({...d,edu:e.target.value}))}/></div>
                      <div className="field-group"><label>Experience</label><textarea rows={4} value={resumeData.exp||''} onChange={e=>setResumeData(d=>({...d,exp:e.target.value}))}/></div>
                      <div className="field-group"><label>Summary</label><textarea rows={3} value={resumeData.summary||''} onChange={e=>setResumeData(d=>({...d,summary:e.target.value}))}/></div>
                      <button type="submit" className="btn-primary"><i className="fa-regular fa-floppy-disk"/> Save Resume</button>
                      {resumeFb&&<div className="save-feedback">{resumeFb}</div>}
                    </form>
                  </div>
                </div>
              )}
              {portfolioTab==='aboutme' && (
                <div className="sd-ptab-content">
                  <div className="sd-aboutme-wrap">
                    <form className="sd-aboutme-fields" onSubmit={saveAboutMe}>
                      <div className="field-group"><label>Bio</label><textarea rows={5} value={aboutData.bio||''} onChange={e=>setAboutData(d=>({...d,bio:e.target.value}))}/></div>
                      <div className="field-row"><div className="field-group"><label>Interests</label><input value={aboutData.interests||''} onChange={e=>setAboutData(d=>({...d,interests:e.target.value}))}/></div><div className="field-group"><label>Languages</label><input value={aboutData.languages||''} onChange={e=>setAboutData(d=>({...d,languages:e.target.value}))}/></div></div>
                      <div className="field-group"><label>GitHub URL</label><input value={aboutData.github||''} onChange={e=>setAboutData(d=>({...d,github:e.target.value}))}/></div>
                      <div className="field-group"><label>LinkedIn URL</label><input value={aboutData.linkedin||''} onChange={e=>setAboutData(d=>({...d,linkedin:e.target.value}))}/></div>
                      <button type="submit" className="btn-primary"><i className="fa-regular fa-floppy-disk"/> Save About Me</button>
                      {aboutFb&&<div className="save-feedback">{aboutFb}</div>}
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {section === 'templates' && (
            <div className="sd-section">
              <div className="sd-section-header">
                <div><h2 className="sd-section-title">Portfolio Templates</h2><p className="sd-section-sub">Preview, edit, or apply admin-created templates</p></div>
              </div>
              {templates.filter(t=>!t.deleted).length===0 ? (
                <div className="empty-state"><i className="fa-regular fa-palette"/><p>No templates yet. Admin will create some soon.</p></div>
              ) : (
                <div className="sd-templates-grid">
                  {templates.filter(t=>!t.deleted).map(t=>(
                    <div className="sd-template-card" key={t.id}>
                      <div className="sd-template-preview" style={{background:`linear-gradient(135deg,${t.color||'#2563eb'},${t.color||'#2563eb'}88)`}}>
                        {t.thumbnail?<img src={t.thumbnail} alt={t.name} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>e.target.style.display='none'}/>:<i className={`${t.preview_icon||'fa-regular fa-palette'}`} style={{fontSize:'3rem',color:'#fff',opacity:.9}}/>}
                      </div>
                      <div className="sd-template-info">
                        <div className="sd-template-title">{t.name}</div>
                        <div className="sd-template-cat">{t.category}</div>
                        <div className="sd-template-desc">{t.desc||''}</div>
                        <div style={{display:'flex',gap:7,marginTop:10}}>
                          <button className="btn-outline" style={{flex:1,justifyContent:'center'}} onClick={()=>setTplPreviewModal(t)}><i className="fa-regular fa-eye"/> Preview</button>
                          <button className="btn-primary" style={{flex:1,justifyContent:'center'}} onClick={()=>{
                            const design={pages:t.pages||['Page 1'],elements:{0:JSON.parse(JSON.stringify(t.elements||[]))},bg:t.bg||'#1a2744'}
                            setFigmaMode('portfolio'); setFigmaInitData(design); setShowFigmaEditor(true)
                          }}><i className="fa-regular fa-pen-to-square"/> Use Template</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {section === 'upload' && (
            <div className="sd-section">
              <div className="sd-section-header"><div><h2 className="sd-section-title">Upload Project</h2></div></div>
              <div className="upload-layout">
                <form className="sd-form-card upload-form-main" onSubmit={doUpload}>
                  <div className="field-group"><label>Project Title *</label><input value={uploadForm.title} onChange={e=>setUploadForm(f=>({...f,title:e.target.value}))} placeholder="My Awesome Project"/></div>
                  <div className="field-group"><label>Description</label><textarea rows={3} value={uploadForm.description} onChange={e=>setUploadForm(f=>({...f,description:e.target.value}))}/></div>
                  <div className="field-row">
                    <div className="field-group"><label>Category</label><input value={uploadForm.category} onChange={e=>setUploadForm(f=>({...f,category:e.target.value}))} placeholder="Web Development"/></div>
                    <div className="field-group"><label>Status</label><select value={uploadForm.status} onChange={e=>setUploadForm(f=>({...f,status:e.target.value}))}><option>Completed</option><option>In Progress</option><option>Concept</option></select></div>
                  </div>
                  <div className="field-group"><label>Privacy</label>
                    <select value={uploadForm.privacy} onChange={e=>setUploadForm(f=>({...f,privacy:e.target.value}))}>
                      <option value="public">Public — visible to everyone</option>
                      <option value="unlisted">Unlisted — only with link</option>
                      <option value="private">Private — only you</option>
                    </select>
                  </div>
                  <hr className="sd-divider"/>
                  <h4 style={{fontFamily:'var(--font-display)',fontSize:'.92rem',color:'var(--accent-light)',marginBottom:12}}>File Type</h4>
                  <div className="upload-type-grid">
                    {UPLOAD_TYPES.map(t => (
                      <button type="button" key={t.key} className={`upload-type-btn${uploadForm.fileType===t.key?' active':''}`} onClick={()=>setUploadForm(f=>({...f,fileType:t.key,imageFile:null}))}>
                        <i className={t.icon}/><span>{t.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="field-group" style={{marginTop:14}}>
                    <label>Project Image / Thumbnail URL</label>
                    <input value={uploadForm.image_url} onChange={e=>setUploadForm(f=>({...f,image_url:e.target.value}))} placeholder="https://..."/>
                  </div>
                  {uploadForm.fileType === 'canva' ? (
                    <div className="field-group">
                      <label>Canva Share Link</label>
                      <input value={uploadForm.canvaUrl||''} onChange={e=>setUploadForm(f=>({...f,canvaUrl:e.target.value}))} placeholder="https://www.canva.com/..."/>
                    </div>
                  ) : selectedUploadType.accept && (
                    <div className="field-group">
                      <label>Upload {selectedUploadType.label}</label>
                      <label className="sd-file-upload-btn">
                        <i className={selectedUploadType.icon}/> {uploadForm.imageFile?uploadForm.imageFile.name:`Choose ${selectedUploadType.label}`}
                        <input type="file" accept={selectedUploadType.accept} style={{display:'none'}} onChange={e=>{const f=e.target.files[0];if(!f)return;setUploadForm(uf=>({...uf,imageFile:f}))}}/>
                      </label>
                    </div>
                  )}
                  <hr className="sd-divider"/>
                  <h4 style={{fontFamily:'var(--font-display)',fontSize:'.92rem',color:'var(--accent-light)',marginBottom:12}}>Links</h4>
                  <div className="field-row">
                    <div className="field-group"><label><i className="fa-brands fa-github"/> GitHub</label><input value={uploadForm.githubUrl} onChange={e=>setUploadForm(f=>({...f,githubUrl:e.target.value}))} placeholder="https://github.com/..."/></div>
                    <div className="field-group"><label><i className="fa-solid fa-globe"/> Live URL</label><input value={uploadForm.deployUrl} onChange={e=>setUploadForm(f=>({...f,deployUrl:e.target.value}))} placeholder="https://..."/></div>
                  </div>
                  <hr className="sd-divider"/>
                  <h4 style={{fontFamily:'var(--font-display)',fontSize:'.92rem',color:'var(--accent-light)',marginBottom:12}}>Skills Used</h4>
                  <div className="sd-skills-picker">
                    <div className="sd-skills-selected">
                      {uploadForm.skills.map(sk=><span key={sk} className="sd-skill-tag">{sk}<button type="button" onClick={()=>setUploadForm(f=>({...f,skills:f.skills.filter(s=>s!==sk)}))}><i className="fa-solid fa-xmark"/></button></span>)}
                      {uploadForm.skills.length===0&&<span style={{color:'var(--text-dim)',fontSize:'.82rem'}}>No skills selected yet</span>}
                    </div>
                    <input className="sd-skill-search" placeholder="Search skills..." value={skillSearch} onChange={e=>setSkillSearch(e.target.value)}/>
                    <div className="sd-skills-list">
                      {filteredSkills.slice(0,24).map(sk=>(
                        <button type="button" key={sk} className="sd-skill-option" onClick={()=>{setUploadForm(f=>({...f,skills:[...f.skills,sk]}));setSkillSearch('')}}>{sk}</button>
                      ))}
                    </div>
                  </div>
                  <div className="field-group" style={{marginTop:14}}><label>Completion Date</label><input type="date" value={uploadForm.completion_date} onChange={e=>setUploadForm(f=>({...f,completion_date:e.target.value}))}/></div>
                  <button type="submit" className="btn-primary"><i className="fa-solid fa-cloud-arrow-up"/> Upload Project</button>
                  {uploadFb&&<div className="save-feedback" style={{color:'var(--red)'}}>{uploadFb}</div>}
                </form>

                <div className="upload-create-panel">
                  <div className="upload-create-card">
                    <div className="upload-create-icon"><i className="fa-solid fa-pen-ruler"/></div>
                    <h3>Create Your Own Project</h3>
                    <p>Design a custom portfolio piece using our built-in Figma-like editor. Add shapes, text, images and create something unique.</p>
                    <button className="btn-primary" style={{width:'100%',justifyContent:'center',marginTop:8}} onClick={()=>{setFigmaMode('project'); setFigmaInitData({pages:['Page 1'],elements:{0:[]},bg:'#1a2744'}); setShowFigmaEditor(true)}}>
                      <i className="fa-solid fa-plus"/> Open Designer
                    </button>
                    <div style={{marginTop:16,padding:'12px',background:'rgba(37,99,235,.08)',borderRadius:8,fontSize:'.78rem',color:'var(--text-muted)'}}>
                      <i className="fa-solid fa-circle-info" style={{color:'var(--accent-light)',marginRight:6}}/>
                      This is optional. You can also just fill the form on the left to upload an existing project.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {section === 'public-view' && (
            <div className="sd-section">
              <div className="sd-section-header"><div><h2 className="sd-section-title">Public View</h2></div></div>
              <div className="sd-public-view">
                <div className="sd-pv-banner">
                  <div className="sd-pv-profile">{avatarUrl?<img src={avatarUrl} alt="avatar" onError={e=>e.target.style.display='none'} />:<i className="fa-solid fa-user"/>}</div>
                  <div><h3>{user.name||'Your Name'}</h3><p>{user.program||'Portfolio'}</p><div style={{display:'flex',alignItems:'center',gap:8,marginTop:6,color:'rgba(255,255,255,.7)',fontSize:'.82rem'}}><i className="fa-regular fa-eye"/> {stats.views} portfolio views</div></div>
                </div>
                <div className="sd-pv-projects">
                  {activeProjects.filter(p=>p.privacy!=='private').length===0 ? <div className="empty-state"><p>No public projects yet.</p></div> : (
                    <div className="sd-projects-grid">
                      {activeProjects.filter(p=>p.privacy!=='private').map((p,i)=>(
                        <div className="sd-project-card" key={p.id||i} onClick={()=>incrementProjectViews(p.id)} style={{cursor:'pointer'}}>
                          <div className="sd-project-thumb"><ProjectThumb p={p} /></div>
                          <div className="sd-project-info"><div className="sd-project-title">{p.title}</div><div className="sd-project-cat">{p.category}</div></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {section === 'analytics' && (
            <div className="sd-section"><div className="sd-section-header"><div><h2 className="sd-section-title">Analytics</h2></div></div>
              <div className="sd-analytics-grid">
                {[{icon:'chart-area',title:'Portfolio Views'},{icon:'chart-bar',title:'Project Popularity'}].map(c=>(
                  <div className="sd-analytics-card" key={c.title}><h3>{c.title}</h3><div className="sd-chart-placeholder"><i className={`fa-solid fa-${c.icon}`}/><p>Coming soon</p></div></div>
                ))}
              </div>
            </div>
          )}

          {section === 'share' && (
            <div className="sd-section"><div className="sd-section-header"><div><h2 className="sd-section-title">Share Link</h2></div></div>
              <div className="sd-share-card">
                <div className="sd-share-icon"><i className="fa-solid fa-link"/></div>
                <h3>Your Portfolio Link</h3>
                <div className="sd-share-row"><input readOnly value={shareUrl}/><button className="btn-primary" onClick={copyShareLink}><i className="fa-regular fa-copy"/> Copy</button></div>
                {shareFb&&<div className="save-feedback">{shareFb}</div>}
              </div>
            </div>
          )}

          {section === 'settings' && (
            <div className="sd-section"><div className="sd-section-header"><div><h2 className="sd-section-title">Account Settings</h2></div></div>
              <form className="sd-form-card" onSubmit={saveSettings}>
                <div className="field-row">
                  <div className="field-group"><label>Full Name</label><input value={settingsForm.name} onChange={e=>setSettingsForm(f=>({...f,name:e.target.value}))}/></div>
                  <div className="field-group"><label>Date of Birth</label><input type="date" value={settingsForm.dob||''} onChange={e=>setSettingsForm(f=>({...f,dob:e.target.value}))}/>{computedAge!==''&&<div className="sd-age-note">Age: <strong>{computedAge}</strong></div>}</div>
                </div>
                <div className="field-row">
                  <div className="field-group"><label>Sex</label><select value={settingsForm.sex} onChange={e=>setSettingsForm(f=>({...f,sex:e.target.value}))}><option>Male</option><option>Female</option><option>Prefer not to say</option></select></div>
                  <div className="field-group"><label>Program</label><input value={settingsForm.program} onChange={e=>setSettingsForm(f=>({...f,program:e.target.value}))} placeholder="BSIT, 3rd Year"/></div>
                </div>
                <div className="field-group"><label>Address</label><input value={settingsForm.address} onChange={e=>setSettingsForm(f=>({...f,address:e.target.value}))}/></div>
                <div className="field-group"><label>Bio</label><textarea rows={3} value={settingsForm.bio} onChange={e=>setSettingsForm(f=>({...f,bio:e.target.value}))}/></div>
                <div className="field-group"><label>Skills</label><input value={settingsForm.skills} onChange={e=>setSettingsForm(f=>({...f,skills:e.target.value}))} placeholder="HTML, CSS, React..."/></div>
                <button type="submit" className="btn-primary"><i className="fa-regular fa-floppy-disk"/> Save Settings</button>
                {settingsFb&&<div className="save-feedback">{settingsFb}</div>}
              </form>
            </div>
          )}
        </main>
      </div>

      {discoverPost && <DiscoverPostModal post={discoverPost} onClose={()=>setDiscoverPost(null)} onViewProfile={p=>{setDiscoverPost(null);setDiscoverProfile(p)}} />}
      {discoverProfile && <ProfileModal user={discoverProfile} onClose={()=>setDiscoverProfile(null)} />}

      {viewAlert && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setViewAlert(null)}}>
          <div className="modal-box">
            <div className="modal-header"><h3><i className="fa-regular fa-bell" style={{color:'var(--accent-light)',marginRight:8}}/>{viewAlert.title}</h3><button className="modal-close" onClick={()=>setViewAlert(null)}><i className="fa-solid fa-xmark"/></button></div>
            <div className="modal-body"><p style={{color:'var(--text-muted)',lineHeight:1.7}}>{viewAlert.message}</p><div style={{color:'var(--text-dim)',fontSize:'.74rem',marginTop:12}}>{new Date(viewAlert.created_at).toLocaleString()}</div></div>
            <div className="modal-footer"><button className="btn-cancel" onClick={()=>setViewAlert(null)}>Close</button><button className="btn-danger" onClick={()=>{deleteAlert(viewAlert.id);setViewAlert(null)}}><i className="fa-regular fa-trash-can"/> Delete</button></div>
          </div>
        </div>
      )}

      {tplPreviewModal && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setTplPreviewModal(null)}}>
          <div className="modal-box wide">
            <div className="modal-header"><h3>Preview: {tplPreviewModal.name}</h3><button className="modal-close" onClick={()=>setTplPreviewModal(null)}><i className="fa-solid fa-xmark"/></button></div>
            <div className="modal-body" style={{overflowX:'auto'}}>
              <div style={{transform:'scale(0.7)',transformOrigin:'top left',height:392}}>
                <PortfolioCanvas data={{elements:{0:tplPreviewModal.elements||[]},bg:tplPreviewModal.bg||'#fff'}}/>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={()=>setTplPreviewModal(null)}>Close</button>
              <button className="btn-primary" onClick={()=>{const design={pages:tplPreviewModal.pages||['Page 1'],elements:{0:JSON.parse(JSON.stringify(tplPreviewModal.elements||[]))},bg:tplPreviewModal.bg||'#1a2744'};setFigmaMode('portfolio'); setFigmaInitData(design); setShowFigmaEditor(true); setTplPreviewModal(null)}}>
                <i className="fa-regular fa-pen-to-square"/> Use Template
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setDeleteConfirm(null)}}>
          <div className="modal-box">
            <div className="modal-header"><h3><i className="fa-solid fa-triangle-exclamation" style={{color:'var(--red)',marginRight:8}}/>Confirm Delete</h3><button className="modal-close" onClick={()=>setDeleteConfirm(null)}><i className="fa-solid fa-xmark"/></button></div>
            <div className="modal-body">
              {deleteConfirm.type==='project'&&<p style={{color:'var(--text-muted)'}}>Move this project to trash? You can restore it later.</p>}
              {deleteConfirm.type==='project_permanent'&&<p style={{color:'var(--red)'}}>Permanently delete? This <strong>cannot be undone.</strong></p>}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={()=>setDeleteConfirm(null)}>Cancel</button>
              <button className="btn-danger" onClick={async()=>{
                if(deleteConfirm.type==='project') await softDeleteProject(deleteConfirm.id)
                if(deleteConfirm.type==='project_permanent') await permanentDeleteProject(deleteConfirm.id)
                const projs = await getProjects(true); setAllProjects(projs)
                const st = await getStudentStats(); setStats(st)
                setDeleteConfirm(null)
              }}>{deleteConfirm.type==='project_permanent'?'Delete Forever':'Move to Trash'}</button>
            </div>
          </div>
        </div>
      )}

      {showUploadSuccess && <UploadSuccessModal onClose={()=>{ setShowUploadSuccess(false); nav2('projects') }} />}

      {showImageModal && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowImageModal(null)}}>
          <div className="modal-box wide">
            <div className="modal-header"><h3>{showImageModal==='cover'?'Edit Cover Photo':'Edit Profile Photo'}</h3><button className="modal-close" onClick={()=>setShowImageModal(null)}><i className="fa-solid fa-xmark"/></button></div>
            <div className="modal-body">
              <div className="sd-img-editor-wrap">
                <div className="sd-img-editor-left">
                  <div className="sd-img-canvas-wrap"><canvas ref={canvasRef} style={{display:'block',maxWidth:'100%',cursor:'move',background:'#111b2e'}}/></div>
                  <p className="sd-img-hint"><i className="fa-regular fa-circle-info"/> Drag to reposition · Scroll to zoom</p>
                </div>
                <div className="sd-img-editor-right">
                  <div className="field-group">
                    <label className="img-url-label">Paste Image URL</label>
                    <div className="sd-img-url-row">
                      <input type="text" value={imgUrl} onChange={e=>setImgUrl(e.target.value)} placeholder="https://..." onKeyDown={e=>e.key==='Enter'&&loadImgToCanvas(imgUrl.trim())}/>
                      <button type="button" className="btn-primary" onClick={()=>loadImgToCanvas(imgUrl.trim())}><i className="fa-solid fa-arrow-right"/></button>
                    </div>
                  </div>
                  {imgPreview&&<div className="sd-img-thumb-wrap"><img src={imgPreview} alt="preview" className="sd-img-thumb"/><div className="sd-img-thumb-label">✓ Image loaded</div></div>}
                  <div className="sd-img-divider"><span>or</span></div>
                  <label className="sd-img-file-btn"><i className="fa-regular fa-folder-open"/> Open from Device<input type="file" accept="image/*" style={{display:'none'}} onChange={loadImgFromFile}/></label>
                  <div className="sd-img-actions">
                    <button className="btn-primary" onClick={applyImage}><i className="fa-solid fa-check"/> Apply</button>
                    <button className="btn-danger" onClick={()=>setShowImageModal(null)}><i className="fa-solid fa-xmark"/> Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {editProjectModal && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setEditProjectModal(false)}}>
          <div className="modal-box wide">
            <div className="modal-header"><h3>Edit Project</h3><button className="modal-close" onClick={()=>setEditProjectModal(false)}><i className="fa-solid fa-xmark"/></button></div>
            <form onSubmit={saveEditProject}>
              <div className="modal-body">
                {editProjectForm.image_url && (
                  <div style={{marginBottom:14,borderRadius:10,overflow:'hidden',height:180}}>
                    <img src={editProjectForm.image_url} alt="preview" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} onError={e=>e.target.style.display='none'} />
                  </div>
                )}
                <div className="field-group"><label>Title *</label><input value={editProjectForm.title||''} onChange={e=>setEditProjectForm(f=>({...f,title:e.target.value}))}/></div>
                <div className="field-group"><label>Description</label><textarea rows={3} value={editProjectForm.description||''} onChange={e=>setEditProjectForm(f=>({...f,description:e.target.value}))}/></div>
                <div className="field-row">
                  <div className="field-group"><label>Category</label><input value={editProjectForm.category||''} onChange={e=>setEditProjectForm(f=>({...f,category:e.target.value}))}/></div>
                  <div className="field-group"><label>Status</label><select value={editProjectForm.status||'Completed'} onChange={e=>setEditProjectForm(f=>({...f,status:e.target.value}))}><option>Completed</option><option>In Progress</option><option>Concept</option></select></div>
                </div>
                <div className="field-group"><label>Privacy</label><select value={editProjectForm.privacy||'public'} onChange={e=>setEditProjectForm(f=>({...f,privacy:e.target.value}))}><option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option></select></div>
                <div className="field-group"><label>Image URL</label><input value={editProjectForm.image_url||''} onChange={e=>setEditProjectForm(f=>({...f,image_url:e.target.value}))} placeholder="https://..."/></div>
                <div className="field-row">
                  <div className="field-group"><label>GitHub URL</label><input value={editProjectForm.github_url||editProjectForm.githubUrl||''} onChange={e=>setEditProjectForm(f=>({...f,github_url:e.target.value}))}/></div>
                  <div className="field-group"><label>Live URL</label><input value={editProjectForm.deploy_url||editProjectForm.deployUrl||''} onChange={e=>setEditProjectForm(f=>({...f,deploy_url:e.target.value}))}/></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={()=>setEditProjectModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary"><i className="fa-regular fa-floppy-disk"/> Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}