import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTopProjects, getDiscover, getSiteContent } from '../utils/api'
import './LandingPage.css'

const FEATURES = [
  { icon: 'palette', color: '#ff6b35', bg: 'rgba(255,107,53,0.12)', title: 'Full Customization', desc: 'Change colors, fonts, layouts, and sections. Every portfolio looks unique because it is.' },
  { icon: 'folder-open', color: '#3a86ff', bg: 'rgba(58,134,255,0.12)', title: 'Project Management', desc: 'Upload any file type — images, PDFs, videos, links. Organize by semester, subject, or category.' },
  { icon: 'shield-halved', color: '#457b9d', bg: 'rgba(69,123,157,0.12)', title: 'Privacy Controls', desc: 'Set your portfolio as Public, Instructor Only, or Private. Control per-project too.' },
  { icon: 'link', color: '#06d6a0', bg: 'rgba(6,214,160,0.12)', title: 'Shareable Link', desc: 'Get a clean personal URL. Share it with employers or instructors — no login required to view.' },
  { icon: 'chart-bar', color: '#f72585', bg: 'rgba(247,37,133,0.12)', title: 'Analytics', desc: 'See who viewed your portfolio, which projects got the most attention, and click counts.' },
  { icon: 'star', color: '#4361ee', bg: 'rgba(67,97,238,0.12)', title: 'Instructor Feedback', desc: 'Instructors can leave grades and written feedback directly on your projects — all in one place.' },
]

const CAT_ICONS = { Arts: 'palette', IT: 'laptop-code', Engineering: 'gear', Nursing: 'heart-pulse', Certificate: 'certificate', Creative: 'wand-magic-sparkles' }

export default function LandingPage() {
  const nav = useNavigate()
  const heroRef = useRef(null)
  const [discoverProjects, setDiscoverProjects] = useState([])
  const [activeFilter, setActiveFilter] = useState('All')
  const [categories, setCategories] = useState(['All'])
  const [content, setContent] = useState({})

  useEffect(() => {
    getTopProjects().then(data => {
      if (data && data.length > 0) {
        setDiscoverProjects(data)
        const cats = ['All', ...new Set(data.map(p => p.category).filter(Boolean))]
        setCategories(cats)
      }
    }).catch(() => {})
    getSiteContent().then(data => { if (data) setContent(data) }).catch(() => {})
  }, [])

  useEffect(() => {
    if (activeFilter === 'All') {
      getTopProjects().then(data => { if (data) setDiscoverProjects(data) }).catch(() => {})
    } else {
      getDiscover(activeFilter).then(data => { if (data) setDiscoverProjects(data) }).catch(() => {})
    }
  }, [activeFilter])

  const displayed = activeFilter === 'All' ? discoverProjects : discoverProjects.filter(p => p.category === activeFilter)

  return (
    <div className="land-wrap">
      <nav className="land-nav">
        <div className="land-container land-nav-inner">
          <div className="land-brand">
            <span className="land-brand-icon"><i className="fa-solid fa-layer-group" /></span>
            Student Digital Portfolio
          </div>
          <div className="land-nav-actions">
            <button className="btn-outline" onClick={() => nav('/login')}>Log In</button>
            <button className="btn-primary" onClick={() => nav('/register')}>Get Started</button>
          </div>
        </div>
      </nav>

      <section className="land-hero land-hero-centered">
        <div className="land-container land-hero-center" ref={heroRef}>
          <div className="land-badge"><i className="fa-solid fa-sparkles" /> Built for Students</div>
          <h1>
            {content.heroTitle || <>Your Academic<br /><span className="land-accent">Portfolio,</span><br /><em className="land-muted">Elevated.</em></>}
          </h1>
          <p>{content.heroSub || 'Create, manage, and showcase your academic and creative works in one beautifully organized platform. Built for students, loved by instructors.'}</p>
          <div className="land-hero-btns">
            <button className="btn-outline land-btn-lg" onClick={() => document.getElementById('portfolios')?.scrollIntoView({ behavior: 'smooth' })}>Browse Work</button>
            <button className="btn-primary land-btn-lg" onClick={() => nav('/register')}>Get Started Free</button>
          </div>
        </div>
      </section>

      <section className="land-stats">
        <div className="land-container land-stats-inner">
          <div className="land-stat-item"><div className="land-stat-num">{content.stat1 || discoverProjects.length}+</div><div className="land-stat-label">Student Portfolios</div></div>
          <div className="land-stat-div" />
          <div className="land-stat-item"><div className="land-stat-num">{content.stat2 || (categories.length - 1) || 4}</div><div className="land-stat-label">Departments</div></div>
          <div className="land-stat-div" />
          <div className="land-stat-item"><div className="land-stat-num">{content.stat3 || discoverProjects.length}+</div><div className="land-stat-label">Project Uploads</div></div>
        </div>
      </section>

      <section className="land-portfolios" id="portfolios">
        <div className="land-container">
          <div className="land-section-label">Featured Portfolios</div>
          <h2>Discover Student Work &amp; Achievements</h2>
          <div className="land-filters">
            {categories.map(cat => (
              <button key={cat} className={`land-filter-btn${activeFilter === cat ? ' active' : ''}`} onClick={() => setActiveFilter(cat)}>
                {cat !== 'All' && CAT_ICONS[cat] && <i className={`fa-solid fa-${CAT_ICONS[cat]}`} />} {cat}
              </button>
            ))}
          </div>
          {displayed.length === 0 ? (
            <div className="land-empty-state">
              <i className="fa-regular fa-folder-open" />
              <p>No public projects yet. Be the first!</p>
              <button className="btn-primary land-btn-lg" onClick={() => nav('/register')}>Get Started</button>
            </div>
          ) : (
            <div className="land-projects-grid">
              {displayed.map((p, i) => {
                const imgSrc = p.effective_image || p.image_url || ''
                return (
                  <div className="land-project-card" key={p.id || i}>
                    <div className="land-project-thumb">
                      {imgSrc
                        ? <img src={imgSrc} alt={p.title} onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }} />
                        : null
                      }
                      <div className="land-project-placeholder" style={{ display: imgSrc ? 'none' : 'flex' }}>
                        <i className="fa-regular fa-image" />
                      </div>
                      {i === 0 && activeFilter === 'All' && <div className="land-top-badge"><i className="fa-solid fa-fire" /> Top</div>}
                    </div>
                    <div className="land-project-info">
                      <div className="land-project-title">{p.title}</div>
                      <div className="land-project-meta">
                        <span className="land-project-cat">{p.category}</span>
                        <span className="land-project-views"><i className="fa-solid fa-eye" /> {p.views || 0}</span>
                      </div>
                      {p.skills && p.skills.length > 0 && (
                        <div className="land-project-skills">
                          {p.skills.slice(0, 3).map(s => <span key={s} className="land-skill-tag">{s}</span>)}
                        </div>
                      )}
                      <div className="land-project-links">
                        {p.github_url && <a href={p.github_url} target="_blank" rel="noreferrer"><i className="fa-brands fa-github" /></a>}
                        {p.deploy_url && <a href={p.deploy_url} target="_blank" rel="noreferrer"><i className="fa-solid fa-globe" /></a>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <section className="land-features">
        <div className="land-container">
          <div className="land-section-label">Why SDPMS?</div>
          <h2>Everything You Need to Shine</h2>
          <div className="land-features-grid">
            {FEATURES.map(f => (
              <div className="land-feature-card" key={f.title}>
                <div className="land-feature-icon" style={{ background: f.bg, color: f.color }}><i className={`fa-solid fa-${f.icon}`} /></div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="land-cta">
        <div className="land-container">
          <div className="land-cta-box">
            <div className="land-cta-label"><i className="fa-solid fa-rocket" /> Start today</div>
            <h2>{content.ctaHead || 'Ready to Build Your Portfolio?'}</h2>
            <p>{content.ctaSub || 'Join students already showcasing their best work on SDPMS. Free to use, always.'}</p>
            <div className="land-cta-btns">
              <button className="btn-outline land-btn-lg" onClick={() => document.getElementById('portfolios')?.scrollIntoView({ behavior: 'smooth' })}>Browse Portfolios</button>
              <button className="btn-primary land-btn-lg" onClick={() => nav('/register')}>Get Started Free</button>
            </div>
          </div>
        </div>
      </section>

      <footer className="land-footer">
        <div className="land-container land-footer-inner">
          <span>© 2026 SDPMS. All rights reserved.</span>
          <span>Elective 2 · Garcia · Liberty</span>
        </div>
      </footer>
    </div>
  )
}