import React, { useState, useRef, useEffect, useCallback } from 'react'
import './FigmaEditor.css'

const TYPE_ICONS = { text:'font', frame:'border-all', circle:'circle', rounded:'square', triangle:'play', line:'minus', rect:'square', image:'image' }

let idCounter = 1
function makeId() { return idCounter++ }

export default function FigmaEditor({ initialData, onSave, onClose, canvasLabel = 'Canvas' }) {
  const [pages, setPages] = useState(initialData?.pages || ['Page 1'])
  const [currentPage, setCurrentPage] = useState(0)
  const [elements, setElements] = useState(() => {
    const d = initialData?.elements || {}
    if (!d[0]) return { 0: [] }
    return d
  })
  const [selected, setSelected] = useState(null)
  const [tool, setTool] = useState('cursor')
  const toolRef = useRef('cursor')
  const [zoom, setZoom] = useState(1)
  const [canvasBg, setCanvasBg] = useState(initialData?.bg || '#ffffff')
  const [fillColor, setFillColor] = useState('#2563eb')
  const [strokeColor, setStrokeColor] = useState('#000000')
  const fillRef = useRef('#2563eb')
  const strokeRef = useRef('#000000')
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const historyRef = useRef([])
  const elementsRef = useRef(elements)

  const pageEls = elements[currentPage] || []

  const setPageEls = useCallback((fn) => {
    setElements(prev => {
      const cur = prev[currentPage] || []
      const next = typeof fn === 'function' ? fn(cur) : fn
      const newState = { ...prev, [currentPage]: next }
      elementsRef.current = newState
      historyRef.current = [...historyRef.current.slice(-40), JSON.stringify(prev)]
      return newState
    })
  }, [currentPage])

  function undo() {
    if (!historyRef.current.length) return
    const prev = historyRef.current.pop()
    try { const p = JSON.parse(prev); elementsRef.current = p; setElements(p); setSelected(null) } catch {}
  }

  function setToolAndRef(t) { setTool(t); toolRef.current = t }
  function setFillAndRef(v) { setFillColor(v); fillRef.current = v }
  function setStrokeAndRef(v) { setStrokeColor(v); strokeRef.current = v }

  function addElement(type, x, y, extra = {}) {
    const id = makeId()
    const fill = fillRef.current
    const stroke = strokeRef.current
    const maxZ = pageEls.reduce((m,el) => Math.max(m, el.zIndex||0), 0)
    let data
    switch (type) {
      case 'rect':     data = { id, type, x, y, w:120, h:80, fill, stroke, strokeWidth:1, rotation:0, zIndex:maxZ+1 }; break
      case 'rounded':  data = { id, type, x, y, w:120, h:80, fill, stroke, strokeWidth:1, rotation:0, zIndex:maxZ+1 }; break
      case 'circle':   data = { id, type, x, y, w:80, h:80, fill, stroke, strokeWidth:1, rotation:0, zIndex:maxZ+1 }; break
      case 'triangle': data = { id, type, x, y, w:80, h:80, fill, stroke:'none', strokeWidth:0, rotation:0, zIndex:maxZ+1 }; break
      case 'line':     data = { id, type, x, y, w:150, h:2, fill, stroke:fill, strokeWidth:2, rotation:0, zIndex:maxZ+1 }; break
      case 'frame':    data = { id, type, x, y, w:240, h:160, fill:'rgba(37,99,235,0.04)', stroke:'#2563eb', strokeWidth:1, rotation:0, zIndex:maxZ+1 }; break
      case 'text':     data = { id, type, x, y, content:'Text', fontSize:20, color:'#000000', fontWeight:'400', fontFamily:'Arial', rotation:0, zIndex:maxZ+1 }; break
      case 'image':    data = { id, type, x, y, w:200, h:150, src:extra.src||'', objectFit:'cover', rotation:0, zIndex:maxZ+1 }; break
      default: return
    }
    setPageEls(els => [...els, data])
    setSelected(data)
    return data
  }

  function bringToFront() {
    if (!selected) return
    const maxZ = pageEls.reduce((m,el) => Math.max(m, el.zIndex||0), 0)
    setPageEls(els => els.map(el => el.id === selected.id ? {...el, zIndex: maxZ+1} : el))
    setSelected(s => ({...s, zIndex: maxZ+1}))
  }

  function sendToBack() {
    if (!selected) return
    const minZ = pageEls.reduce((m,el) => Math.min(m, el.zIndex||0), 0)
    setPageEls(els => els.map(el => el.id === selected.id ? {...el, zIndex: minZ-1} : el))
    setSelected(s => ({...s, zIndex: minZ-1}))
  }

  function handleCanvasClick(e) {
    const t = toolRef.current
    if (t === 'cursor') return
    const canvas = canvasRef.current; if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / zoom
    const y = (e.clientY - rect.top) / zoom
    if (t === 'image') { fileInputRef.current?.click() }
    else { addElement(t, x, y); setToolAndRef('cursor') }
    e.stopPropagation()
  }

  function handleCanvasMouseDown(e) {
    if (e.target === canvasRef.current && toolRef.current === 'cursor') setSelected(null)
  }

  function startDrag(e, data) {
    if (toolRef.current !== 'cursor') return
    e.stopPropagation()
    setSelected(data)
    const startX = e.clientX - data.x
    const startY = e.clientY - data.y
    let moved = false
    function onMove(mv) {
      if (!moved) { historyRef.current = [...historyRef.current.slice(-40), JSON.stringify(elementsRef.current)]; moved = true }
      setPageEls(els => els.map(el => el.id === data.id ? {...el, x: mv.clientX - startX, y: mv.clientY - startY} : el))
    }
    function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function startResize(e, data) {
    e.stopPropagation(); e.preventDefault()
    const startW = data.w||100, startH = data.h||60
    const startX = e.clientX, startY = e.clientY
    historyRef.current = [...historyRef.current.slice(-40), JSON.stringify(elementsRef.current)]
    function onMove(mv) {
      setPageEls(els => els.map(el => el.id === data.id ? {...el, w: Math.max(20, startW + mv.clientX - startX), h: Math.max(20, startH + mv.clientY - startY)} : el))
    }
    function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  function startRotate(e, data) {
    e.stopPropagation(); e.preventDefault()
    historyRef.current = [...historyRef.current.slice(-40), JSON.stringify(elementsRef.current)]
    const canvas = canvasRef.current; if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const cx = (data.x + (data.w||80)/2) * zoom + rect.left
    const cy = (data.y + (data.h||80)/2) * zoom + rect.top
    function onMove(mv) {
      const angle = Math.atan2(mv.clientY - cy, mv.clientX - cx) * (180/Math.PI) + 90
      setPageEls(els => els.map(el => el.id === data.id ? {...el, rotation: Math.round(angle)} : el))
    }
    function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  function updateProp(prop, val) {
    if (!selected) return
    const parsed = ['x','y','w','h','fontSize','strokeWidth','rotation','zIndex'].includes(prop) ? parseFloat(val) : val
    setPageEls(els => els.map(el => el.id === selected.id ? {...el, [prop]: parsed} : el))
    setSelected(prev => ({...prev, [prop]: parsed}))
  }

  function deleteSelected() {
    if (!selected) return
    setPageEls(els => els.filter(el => el.id !== selected.id))
    setSelected(null)
  }

  function duplicate() {
    if (!selected) return
    const maxZ = pageEls.reduce((m,el) => Math.max(m, el.zIndex||0), 0)
    const clone = {...selected, id:makeId(), x:selected.x+20, y:selected.y+20, zIndex:maxZ+1}
    setPageEls(els => [...els, clone])
    setSelected(clone)
  }

  function addPage() {
    const newPages = [...pages, `Page ${pages.length + 1}`]
    setPages(newPages); setCurrentPage(newPages.length - 1); setSelected(null)
  }

  function switchPage(i) { setCurrentPage(i); setSelected(null) }

  function handleSave() {
    onSave({ pages, elements, allElements: Object.values(elements).flat(), bg: canvasBg })
  }

  function processImageFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const x = Math.max(10, (800/2 - 100)/zoom)
      const y = Math.max(10, (560/2 - 75)/zoom)
      addElement('image', x, y, { src: ev.target.result })
      setToolAndRef('cursor')
    }
    reader.readAsDataURL(file)
  }

  function handleFileUpload(e) { processImageFile(e.target.files?.[0]); e.target.value = '' }
  function handleDrop(e) {
    e.preventDefault()
    const files = e.dataTransfer?.files
    if (files && files[0]?.type.startsWith('image/')) processImageFile(files[0])
  }

  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement.tagName
      const isInput = tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA'
      const isEditable = document.activeElement.isContentEditable
      if ((e.ctrlKey||e.metaKey) && e.key==='z') { e.preventDefault(); undo(); return }
      if (isInput) return
      if (isEditable) { if (e.key==='Escape') { document.activeElement.blur(); setSelected(null) } return }
      if (e.key==='Delete'||e.key==='Backspace') { e.preventDefault(); deleteSelected() }
      if ((e.key==='d'||e.key==='D') && (e.ctrlKey||e.metaKey)) { e.preventDefault(); duplicate() }
      if (e.key==='Escape') { setSelected(null); setToolAndRef('cursor') }
      if (e.key==='v') setToolAndRef('cursor')
      if (e.key==='r') setToolAndRef('rect')
      if (e.key==='o') setToolAndRef('circle')
      if (e.key==='t') setToolAndRef('text')
      if (e.key==='f') setToolAndRef('frame')
      if (e.key==='i') setToolAndRef('image')
      if (e.key===']') bringToFront()
      if (e.key==='[') sendToBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, currentPage, pageEls])

  const currentSel = selected ? pageEls.find(e => e.id === selected.id) || null : null
  const isCursorTool = tool === 'cursor'
  const sortedEls = [...pageEls].sort((a,b) => (a.zIndex||0) - (b.zIndex||0))

  function renderElement(data) {
    const isSelected = currentSel?.id === data.id
    const rot = data.rotation || 0
    const baseStyle = {
      position:'absolute', left:data.x+'px', top:data.y+'px',
      userSelect:'none',
      outline: isSelected ? '2px solid #2563eb' : 'none',
      outlineOffset: '1px',
      boxSizing:'border-box',
      pointerEvents: isCursorTool ? 'auto' : 'none',
      transform: rot ? `rotate(${rot}deg)` : undefined,
      transformOrigin:'center center',
      zIndex: data.zIndex || 0,
    }
    const onElClick = (e) => { if (!isCursorTool) return; e.stopPropagation(); setSelected(data) }
    const onElDown = (e) => { if (!isCursorTool) return; startDrag(e, data) }

    const rotateHandle = isSelected && isCursorTool ? (
      <div className="fe-rotate-handle" onMouseDown={e => startRotate(e, data)} title="Rotate (drag)">
        <i className="fa-solid fa-rotate" />
      </div>
    ) : null

    if (data.type === 'text') {
      return (
        <div key={data.id} style={{
          ...baseStyle, fontSize:(data.fontSize||20)+'px', color:data.color||'#000',
          fontWeight:data.fontWeight||'400', fontFamily:data.fontFamily||'Arial',
          minWidth:'40px', padding:'2px 4px', whiteSpace:'pre-wrap',
          cursor: isCursorTool ? 'move' : 'default', lineHeight:1.3,
        }}
          contentEditable={isCursorTool} suppressContentEditableWarning spellCheck={false}
          onMouseDown={onElDown}
          onBlur={e => { data.content = e.target.innerText; updateProp('content', e.target.innerText) }}
          onClick={e => { if (!isCursorTool) return; e.stopPropagation(); setSelected(data) }}
        >
          {data.content || 'Text'}
          {rotateHandle}
        </div>
      )
    }

    if (data.type === 'image') {
      return (
        <div key={data.id} style={{...baseStyle, width:(data.w||200)+'px', height:(data.h||150)+'px', overflow:'visible', cursor: isCursorTool ? 'move' : 'default'}} onMouseDown={onElDown} onClick={onElClick}>
          <div style={{width:'100%', height:'100%', overflow:'hidden', borderRadius:2}}>
            {data.src
              ? <img src={data.src} alt="" draggable={false} onError={e => e.target.style.display='none'} style={{width:'100%',height:'100%',objectFit:data.objectFit||'cover',pointerEvents:'none',display:'block'}} />
              : <div style={{width:'100%',height:'100%',background:'#e5e7eb',display:'flex',alignItems:'center',justifyContent:'center',color:'#9ca3af',fontSize:'0.8rem'}}>No image</div>
            }
          </div>
          {isSelected && isCursorTool && <div className="fe-resize-handle" onMouseDown={e => startResize(e, data)} />}
          {rotateHandle}
        </div>
      )
    }

    if (data.type === 'triangle') {
      const size = Math.min(data.w||80, data.h||80)
      return (
        <div key={data.id} style={{...baseStyle, width:size+'px', height:size+'px', cursor: isCursorTool ? 'move' : 'default'}} onMouseDown={onElDown} onClick={onElClick}>
          <div style={{width:0,height:0,borderLeft:`${size/2}px solid transparent`,borderRight:`${size/2}px solid transparent`,borderBottom:`${size}px solid ${data.fill||'#2563eb'}`}} />
          {isSelected && isCursorTool && <div className="fe-resize-handle" onMouseDown={e => startResize(e, data)} />}
          {rotateHandle}
        </div>
      )
    }

    if (data.type === 'line') {
      return (
        <div key={data.id} style={{...baseStyle, width:(data.w||150)+'px', height:Math.max(2,data.strokeWidth||2)+'px', background:data.fill||'#2563eb', borderRadius:'2px', cursor: isCursorTool ? 'move' : 'default'}} onMouseDown={onElDown} onClick={onElClick}>
          {isSelected && isCursorTool && <div className="fe-resize-handle" style={{right:-5,bottom:-4}} onMouseDown={e => startResize(e, data)} />}
          {rotateHandle}
        </div>
      )
    }

    const s = {...baseStyle, width:(data.w||120)+'px', height:(data.h||80)+'px', cursor: isCursorTool ? 'move' : 'default'}
    if (data.type==='frame') { s.background=data.fill||'rgba(37,99,235,0.04)'; s.border=`${data.strokeWidth||1}px dashed ${data.stroke||'#2563eb'}`; s.borderRadius='3px' }
    else if (data.type==='circle') { s.background=data.fill||'#2563eb'; s.borderRadius='50%'; if(data.stroke&&data.stroke!=='none') s.border=`${data.strokeWidth||1}px solid ${data.stroke}` }
    else if (data.type==='rounded') { s.background=data.fill||'#2563eb'; s.borderRadius='14px'; if(data.stroke&&data.stroke!=='none') s.border=`${data.strokeWidth||1}px solid ${data.stroke}` }
    else { s.background=data.fill||'#2563eb'; if(data.stroke&&data.stroke!=='none') s.border=`${data.strokeWidth||1}px solid ${data.stroke}` }
    return (
      <div key={data.id} style={s} onMouseDown={onElDown} onClick={onElClick}>
        {isSelected && isCursorTool && <div className="fe-resize-handle" onMouseDown={e => startResize(e, data)} />}
        {rotateHandle}
      </div>
    )
  }

  return (
    <div className="fe-fullscreen">
      <div className="fe-topbar">
        <div className="fe-topbar-left">
          <button className="fe-close-btn" onClick={onClose} title="Close"><i className="fa-solid fa-xmark" /></button>
          <span className="fe-title">{canvasLabel}</span>
        </div>
        <div className="fe-toolbar">
          {[
            { t:'cursor', icon:'arrow-pointer', label:'Select (V)' }, null,
            { t:'rect', icon:'square', label:'Rect (R)' },
            { t:'rounded', icon:'square', label:'Rounded' },
            { t:'circle', icon:'circle', iconPre:'fa-regular', label:'Circle (O)' },
            { t:'triangle', icon:'play', label:'Triangle', extraIconStyle:{transform:'rotate(-90deg)'} },
            { t:'line', icon:'minus', label:'Line' },
            { t:'frame', icon:'square-full', iconPre:'fa-regular', label:'Frame (F)' }, null,
            { t:'text', icon:'t', label:'Text (T)' },
            { t:'image', icon:'image', label:'Image (I)' },
          ].map((item,i) => {
            if (!item) return <div key={i} className="fe-sep" />
            return (
              <button key={item.t} className={`fe-tool-btn${tool===item.t?' active':''}`} onClick={()=>setToolAndRef(item.t)} title={item.label}>
                <i className={`${item.iconPre||'fa-solid'} fa-${item.icon}`} style={item.extraIconStyle||{}} />
              </button>
            )
          })}
          <div className="fe-sep" />
          <label className="fe-color-wrap" title="Fill">
            <input type="color" value={fillColor} onChange={e => { setFillAndRef(e.target.value); if(currentSel&&currentSel.type!=='text'&&currentSel.type!=='image') updateProp('fill', e.target.value) }} />
            <span>Fill</span>
          </label>
          <label className="fe-color-wrap" title="Stroke">
            <input type="color" value={strokeColor} onChange={e => { setStrokeAndRef(e.target.value); if(currentSel&&currentSel.type!=='image') updateProp('stroke', e.target.value) }} />
            <span>Stroke</span>
          </label>
          <label className="fe-color-wrap" title="Canvas BG">
            <input type="color" value={canvasBg} onChange={e => setCanvasBg(e.target.value)} />
            <span>BG</span>
          </label>
          <div className="fe-sep" />
          <button className="fe-tool-btn" onClick={bringToFront} title="Bring to Front (])"><i className="fa-solid fa-layer-group" /></button>
          <button className="fe-tool-btn" onClick={sendToBack} title="Send to Back ([)"><i className="fa-solid fa-layer-group" style={{opacity:.5}} /></button>
          <div className="fe-sep" />
          <button className="fe-tool-btn fe-delete-btn" onClick={deleteSelected} title="Delete"><i className="fa-solid fa-trash" /></button>
          <button className="fe-tool-btn" onClick={undo} title="Undo (Ctrl+Z)"><i className="fa-solid fa-rotate-left" /></button>
          <button className="fe-tool-btn" onClick={duplicate} title="Duplicate (Ctrl+D)"><i className="fa-solid fa-copy" /></button>
        </div>
        <div className="fe-topbar-right">
          <div className="fe-zoom-row">
            <button onClick={()=>setZoom(z=>Math.max(0.25,+(z-0.1).toFixed(1)))}><i className="fa-solid fa-minus" /></button>
            <span>{Math.round(zoom*100)}%</span>
            <button onClick={()=>setZoom(z=>Math.min(3,+(z+0.1).toFixed(1)))}><i className="fa-solid fa-plus" /></button>
            <button onClick={()=>setZoom(1)}>Fit</button>
          </div>
          <button className="fe-save-btn" onClick={handleSave}><i className="fa-solid fa-save" /> Save</button>
        </div>
      </div>

      <div className="fe-body">
        <div className="fe-left">
          <div className="fe-panel-label">Pages</div>
          {pages.map((p,i) => (
            <div key={i} className={`fe-page-item${i===currentPage?' active':''}`} onClick={()=>switchPage(i)}>
              <i className="fa-regular fa-file" /> {p}
            </div>
          ))}
          <button className="fe-add-page-btn" onClick={addPage}><i className="fa-solid fa-plus" /> Add Page</button>
          <div className="fe-panel-label" style={{marginTop:14}}>Layers</div>
          {[...sortedEls].reverse().map(el => (
            <div key={el.id} className={`fe-layer-item${currentSel?.id===el.id?' selected':''}`} onClick={()=>setSelected(el)}>
              <i className={`fa-solid fa-${TYPE_ICONS[el.type]||'square'}`} />
              <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{el.type}{el.type==='text'?` — "${(el.content||'').slice(0,8)}"`:''}</span>
              <span style={{fontSize:'.6rem',color:'var(--text-dim)',marginLeft:4}}>z{el.zIndex||0}</span>
            </div>
          ))}
        </div>

        <div className="fe-canvas-area">
          <div className="fe-canvas-wrapper" style={{transform:`scale(${zoom})`}}>
            <div
              ref={canvasRef}
              className={`fe-canvas${!isCursorTool?' fe-canvas--drawing':''}`}
              style={{background:canvasBg}}
              onClick={handleCanvasClick}
              onMouseDown={handleCanvasMouseDown}
              onDrop={handleDrop}
              onDragOver={e=>e.preventDefault()}
            >
              {pageEls.length === 0 && <div className="fe-canvas-empty">Click a tool to start designing</div>}
              {sortedEls.map(renderElement)}
            </div>
          </div>
          <div className="fe-tool-hint">
            {!isCursorTool && <span className="fe-tool-active-hint"><i className="fa-solid fa-crosshairs" /> {tool} mode — click canvas to place · Esc to cancel</span>}
          </div>
        </div>

        <div className="fe-right">
          <div className="fe-panel-label">Properties</div>
          {!currentSel ? (
            <div className="fe-props-empty"><i className="fa-regular fa-hand-pointer" /><p>Select an element</p></div>
          ) : (
            <div>
              <div className="fe-prop-section">Layer</div>
              <div className="fe-prop-row" style={{gap:4}}>
                <button style={{flex:1,padding:'5px',background:'rgba(37,99,235,.15)',border:'1px solid var(--accent)',borderRadius:6,color:'var(--accent-light)',cursor:'pointer',fontSize:'.72rem'}} onClick={bringToFront}><i className="fa-solid fa-up-long"/> Front</button>
                <button style={{flex:1,padding:'5px',background:'rgba(255,255,255,.04)',border:'1px solid var(--card-border)',borderRadius:6,color:'var(--text-muted)',cursor:'pointer',fontSize:'.72rem'}} onClick={sendToBack}><i className="fa-solid fa-down-long"/> Back</button>
              </div>
              <div className="fe-prop-section">Position</div>
              <div className="fe-prop-row">
                <div className="fe-prop-item"><label>X</label><input type="number" value={Math.round(currentSel.x)} onChange={e=>updateProp('x',e.target.value)}/></div>
                <div className="fe-prop-item"><label>Y</label><input type="number" value={Math.round(currentSel.y)} onChange={e=>updateProp('y',e.target.value)}/></div>
              </div>
              <div className="fe-prop-section">Transform</div>
              <div className="fe-prop-row">
                <div className="fe-prop-item"><label>Rotate °</label><input type="number" value={Math.round(currentSel.rotation||0)} onChange={e=>updateProp('rotation',e.target.value)}/></div>
              </div>
              {currentSel.type !== 'text' && (
                <>
                  <div className="fe-prop-section">Size</div>
                  <div className="fe-prop-row">
                    <div className="fe-prop-item"><label>W</label><input type="number" value={Math.round(currentSel.w||120)} onChange={e=>updateProp('w',e.target.value)}/></div>
                    <div className="fe-prop-item"><label>H</label><input type="number" value={Math.round(currentSel.h||80)} onChange={e=>updateProp('h',e.target.value)}/></div>
                  </div>
                </>
              )}
              {currentSel.type === 'image' && (
                <>
                  <div className="fe-prop-section">Image</div>
                  <div style={{padding:'8px 9px'}}>
                    <label style={{fontSize:'.67rem',color:'var(--text-dim)',display:'block',marginBottom:4}}>URL</label>
                    <input style={{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid var(--card-border)',borderRadius:5,padding:'4px 6px',color:'var(--text)',fontSize:'.75rem',outline:'none'}} type="text" value={currentSel.src||''} onChange={e=>updateProp('src',e.target.value)} placeholder="https://..."/>
                    <button onClick={()=>fileInputRef.current?.click()} style={{marginTop:6,width:'100%',background:'rgba(37,99,235,0.15)',border:'1px solid var(--accent)',color:'var(--accent-light)',padding:'5px',borderRadius:5,cursor:'pointer',fontSize:'.76rem'}}>
                      <i className="fa-solid fa-folder-open"/> Browse
                    </button>
                  </div>
                  <div className="fe-prop-row">
                    <div className="fe-prop-item"><label>Fit</label>
                      <select value={currentSel.objectFit||'cover'} onChange={e=>updateProp('objectFit',e.target.value)}>
                        <option value="cover">Cover</option>
                        <option value="contain">Contain</option>
                        <option value="fill">Fill</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
              {currentSel.type !== 'image' && (
                <>
                  <div className="fe-prop-section">Color</div>
                  <div className="fe-prop-row">
                    <div className="fe-prop-item">
                      <label>{currentSel.type==='text'?'Text Color':'Fill'}</label>
                      <input type="color" value={currentSel.type==='text'?(currentSel.color||'#000000'):(currentSel.fill&&!currentSel.fill.startsWith('rgba')?currentSel.fill:'#2563eb')} onChange={e=>updateProp(currentSel.type==='text'?'color':'fill',e.target.value)}/>
                    </div>
                    {currentSel.type!=='text'&&currentSel.type!=='line'&&(
                      <div className="fe-prop-item">
                        <label>Stroke</label>
                        <input type="color" value={currentSel.stroke&&currentSel.stroke!=='none'&&!currentSel.stroke.startsWith('rgba')?currentSel.stroke:'#ffffff'} onChange={e=>updateProp('stroke',e.target.value)}/>
                      </div>
                    )}
                  </div>
                </>
              )}
              {currentSel.type === 'text' && (
                <>
                  <div className="fe-prop-section">Typography</div>
                  <div className="fe-prop-row">
                    <div className="fe-prop-item"><label>Size</label><input type="number" value={currentSel.fontSize||20} onChange={e=>updateProp('fontSize',e.target.value)}/></div>
                    <div className="fe-prop-item"><label>Weight</label>
                      <select value={currentSel.fontWeight||'400'} onChange={e=>updateProp('fontWeight',e.target.value)}>
                        <option value="400">Regular</option><option value="600">Semi</option><option value="700">Bold</option><option value="800">Extra</option>
                      </select>
                    </div>
                  </div>
                  <div className="fe-prop-row">
                    <div className="fe-prop-item"><label>Font</label>
                      <select value={currentSel.fontFamily||'Arial'} onChange={e=>updateProp('fontFamily',e.target.value)}>
                        <option value="Arial">Arial</option><option value="Syne, sans-serif">Syne</option><option value="DM Sans, sans-serif">DM Sans</option><option value="Georgia, serif">Georgia</option><option value="monospace">Mono</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
              <div style={{padding:'10px'}}>
                <button className="fe-delete-el-btn" onClick={deleteSelected}><i className="fa-solid fa-trash"/> Delete Element</button>
              </div>
            </div>
          )}
        </div>
      </div>
      <input type="file" accept="image/*" ref={fileInputRef} style={{display:'none'}} onChange={handleFileUpload}/>
    </div>
  )
}