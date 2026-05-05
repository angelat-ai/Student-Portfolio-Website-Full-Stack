import React, { useState, useRef, useEffect, useCallback } from 'react'
import './FigmaEditor.css'

const TYPE_ICONS = {
  text: 'font', frame: 'border-all', circle: 'circle', rounded: 'square',
  triangle: 'play', line: 'minus', rect: 'square', image: 'image'
}

let idCounter = Date.now()
function makeId() { return idCounter++ }

const SNAP_THRESHOLD = 6
const CANVAS_W = 800
const CANVAS_H = 560

export default function FigmaEditor({ initialData, onSave, onClose, canvasLabel = 'Canvas' }) {
  const [pages, setPages] = useState(initialData?.pages || ['Page 1'])
  const [currentPage, setCurrentPage] = useState(0)
  const [elements, setElements] = useState(() => {
    const d = initialData?.elements || {}
    if (!d[0] && !d['0']) return { 0: [] }
    return d
  })
  const [selected, setSelected] = useState(null)
  const [tool, setTool] = useState('cursor')
  const toolRef = useRef('cursor')
  const [zoom, setZoom] = useState(1)
  const [canvasBg, setCanvasBg] = useState(initialData?.bg || '#ffffff')
  const [fillColor, setFillColor] = useState('#2563eb')
  const [strokeColor, setStrokeColor] = useState('none')
  const fillRef = useRef('#2563eb')
  const strokeRef = useRef('none')
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const imgUrlInputRef = useRef(null)
  const historyRef = useRef([])
  const redoRef = useRef([])
  const elementsRef = useRef(elements)
  const [saveFeedback, setSaveFeedback] = useState('')
  const [showGrid, setShowGrid] = useState(true)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [pageNameEdit, setPageNameEdit] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [imgUrlInput, setImgUrlInput] = useState('')
  const [showImgUrlPanel, setShowImgUrlPanel] = useState(false)
  const canvasAreaRef = useRef(null)

  const pageEls = elements[currentPage] || []

  const setPageEls = useCallback((fn) => {
    setElements(prev => {
      const cur = prev[currentPage] || []
      const next = typeof fn === 'function' ? fn(cur) : fn
      const newState = { ...prev, [currentPage]: next }
      elementsRef.current = newState
      redoRef.current = []
      historyRef.current = [...historyRef.current.slice(-60), JSON.stringify(prev)]
      return newState
    })
  }, [currentPage])

  function pushHistory() {
    redoRef.current = []
    historyRef.current = [...historyRef.current.slice(-60), JSON.stringify(elementsRef.current)]
  }

  function undo() {
    if (!historyRef.current.length) return
    const prev = historyRef.current.pop()
    try {
      const p = JSON.parse(prev)
      redoRef.current.push(JSON.stringify(elementsRef.current))
      elementsRef.current = p
      setElements(p)
      setSelected(null)
    } catch {}
  }

  function redo() {
    if (!redoRef.current.length) return
    const next = redoRef.current.pop()
    try {
      const p = JSON.parse(next)
      historyRef.current.push(JSON.stringify(elementsRef.current))
      elementsRef.current = p
      setElements(p)
      setSelected(null)
    } catch {}
  }

  function setToolAndRef(t) { setTool(t); toolRef.current = t; setContextMenu(null) }
  function setFillAndRef(v) { setFillColor(v); fillRef.current = v }
  function setStrokeAndRef(v) { setStrokeColor(v); strokeRef.current = v }

  function getSnapX(x, excludeId) {
    if (!snapEnabled) return x
    const guides = [0, CANVAS_W / 2, CANVAS_W]
    const els = (elementsRef.current[currentPage] || []).filter(e => e.id !== excludeId)
    els.forEach(el => { guides.push(el.x, el.x + (el.w || 0) / 2, el.x + (el.w || 0)) })
    for (const g of guides) {
      if (Math.abs(x - g) < SNAP_THRESHOLD) return g
    }
    return x
  }

  function getSnapY(y, excludeId) {
    if (!snapEnabled) return y
    const guides = [0, CANVAS_H / 2, CANVAS_H]
    const els = (elementsRef.current[currentPage] || []).filter(e => e.id !== excludeId)
    els.forEach(el => { guides.push(el.y, el.y + (el.h || 0) / 2, el.y + (el.h || 0)) })
    for (const g of guides) {
      if (Math.abs(y - g) < SNAP_THRESHOLD) return g
    }
    return y
  }

  function addElement(type, x, y, extra = {}) {
    const id = makeId()
    const fill = fillRef.current
    const stroke = strokeRef.current
    const maxZ = pageEls.reduce((m, el) => Math.max(m, el.zIndex || 0), 0)
    let data
    switch (type) {
      case 'rect':     data = { id, type, x, y, w: 120, h: 80,  fill, stroke, strokeWidth: 1, rotation: 0, zIndex: maxZ + 1 }; break
      case 'rounded':  data = { id, type, x, y, w: 120, h: 80,  fill, stroke, strokeWidth: 1, rotation: 0, zIndex: maxZ + 1 }; break
      case 'circle':   data = { id, type, x, y, w: 80,  h: 80,  fill, stroke, strokeWidth: 1, rotation: 0, zIndex: maxZ + 1 }; break
      case 'triangle': data = { id, type, x, y, w: 80,  h: 80,  fill, stroke: 'none', strokeWidth: 0, rotation: 0, zIndex: maxZ + 1 }; break
      case 'line':     data = { id, type, x, y, w: 150, h: 2,   fill, stroke: fill, strokeWidth: 2, rotation: 0, zIndex: maxZ + 1 }; break
      case 'frame':    data = { id, type, x, y, w: 240, h: 160, fill: 'rgba(37,99,235,0.04)', stroke: '#2563eb', strokeWidth: 1, rotation: 0, zIndex: maxZ + 1 }; break
      case 'text':     data = { id, type, x, y, content: 'Text', fontSize: 20, color: '#000000', fontWeight: '400', fontFamily: 'Arial', rotation: 0, zIndex: maxZ + 1 }; break
      case 'image':    data = { id, type, x, y, w: 200, h: 150, src: extra.src || '', objectFit: 'cover', rotation: 0, zIndex: maxZ + 1 }; break
      default: return
    }
    setPageEls(els => [...els, data])
    setSelected(data)
    return data
  }

  function bringToFront(el) {
    const target = el || selected; if (!target) return
    const maxZ = pageEls.reduce((m, e) => Math.max(m, e.zIndex || 0), 0)
    setPageEls(els => els.map(e => e.id === target.id ? { ...e, zIndex: maxZ + 1 } : e))
    if (!el) setSelected(s => s ? { ...s, zIndex: maxZ + 1 } : s)
  }

  function sendToBack(el) {
    const target = el || selected; if (!target) return
    const minZ = pageEls.reduce((m, e) => Math.min(m, e.zIndex || 0), 0)
    setPageEls(els => els.map(e => e.id === target.id ? { ...e, zIndex: minZ - 1 } : e))
    if (!el) setSelected(s => s ? { ...s, zIndex: minZ - 1 } : s)
  }

  function handleCanvasClick(e) {
    const t = toolRef.current
    if (t === 'cursor') return
    const canvas = canvasRef.current; if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = Math.max(0, (e.clientX - rect.left) / zoom)
    const y = Math.max(0, (e.clientY - rect.top) / zoom)
    if (t === 'image') {
      setShowImgUrlPanel(true)
      setImgUrlInput('')
      imgRef_pending.current = { x, y }
    } else {
      const cx = x - (t === 'text' ? 0 : 60)
      const cy = y - (t === 'text' ? 0 : 40)
      addElement(t, Math.max(0, cx), Math.max(0, cy))
      setToolAndRef('cursor')
    }
    e.stopPropagation()
  }

  const imgRef_pending = useRef({ x: 0, y: 0 })

  function handleCanvasMouseDown(e) {
    if (e.target === canvasRef.current && toolRef.current === 'cursor') setSelected(null)
    setContextMenu(null)
  }

  function startDrag(e, data) {
    if (toolRef.current !== 'cursor') return
    e.stopPropagation()
    setSelected(data)
    const startX = e.clientX - data.x * zoom
    const startY = e.clientY - data.y * zoom
    let moved = false
    function onMove(mv) {
      if (!moved) { pushHistory(); moved = true }
      const rawX = (mv.clientX - startX) / zoom
      const rawY = (mv.clientY - startY) / zoom
      const nx = getSnapX(rawX, data.id)
      const ny = getSnapY(rawY, data.id)
      setPageEls(els => els.map(el => el.id === data.id ? { ...el, x: nx, y: ny } : el))
      setSelected(s => s ? { ...s, x: nx, y: ny } : s)
    }
    function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function startResize(e, data, handle = 'se') {
    e.stopPropagation(); e.preventDefault()
    const startW = data.w || 100, startH = data.h || 60
    const startX = e.clientX, startY = e.clientY
    const startElX = data.x, startElY = data.y
    pushHistory()
    function onMove(mv) {
      const dx = (mv.clientX - startX) / zoom
      const dy = (mv.clientY - startY) / zoom
      let updates = {}
      if (handle === 'se') { updates = { w: Math.max(20, startW + dx), h: Math.max(20, startH + dy) } }
      if (handle === 'sw') { updates = { x: startElX + dx, w: Math.max(20, startW - dx), h: Math.max(20, startH + dy) } }
      if (handle === 'ne') { updates = { y: startElY + dy, w: Math.max(20, startW + dx), h: Math.max(20, startH - dy) } }
      if (handle === 'nw') { updates = { x: startElX + dx, y: startElY + dy, w: Math.max(20, startW - dx), h: Math.max(20, startH - dy) } }
      setPageEls(els => els.map(el => el.id === data.id ? { ...el, ...updates } : el))
      setSelected(s => s ? { ...s, ...updates } : s)
    }
    function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function startRotate(e, data) {
    e.stopPropagation(); e.preventDefault()
    pushHistory()
    const canvas = canvasRef.current; if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const cx = (data.x + (data.w || 80) / 2) * zoom + rect.left
    const cy = (data.y + (data.h || 80) / 2) * zoom + rect.top
    function onMove(mv) {
      const angle = Math.atan2(mv.clientY - cy, mv.clientX - cx) * (180 / Math.PI) + 90
      const snapped = e.shiftKey ? Math.round(angle / 15) * 15 : Math.round(angle)
      setPageEls(els => els.map(el => el.id === data.id ? { ...el, rotation: snapped } : el))
      setSelected(s => s ? { ...s, rotation: snapped } : s)
    }
    function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function updateProp(prop, val) {
    const sel = selected; if (!sel) return
    const parsed = ['x', 'y', 'w', 'h', 'fontSize', 'strokeWidth', 'rotation', 'zIndex', 'opacity'].includes(prop)
      ? parseFloat(val) : val
    setPageEls(els => els.map(el => el.id === sel.id ? { ...el, [prop]: parsed } : el))
    setSelected(prev => prev ? { ...prev, [prop]: parsed } : prev)
  }

  function deleteSelected() {
    if (!selected) return
    pushHistory()
    setPageEls(els => els.filter(el => el.id !== selected.id))
    setSelected(null)
  }

  function duplicate() {
    if (!selected) return
    pushHistory()
    const maxZ = pageEls.reduce((m, el) => Math.max(m, el.zIndex || 0), 0)
    const clone = { ...selected, id: makeId(), x: selected.x + 20, y: selected.y + 20, zIndex: maxZ + 1 }
    setPageEls(els => [...els, clone])
    setSelected(clone)
  }

  function groupSelected() { }

  function addPage() {
    const idx = pages.length
    const newPages = [...pages, `Page ${idx + 1}`]
    setPages(newPages)
    setElements(prev => ({ ...prev, [idx]: [] }))
    setCurrentPage(idx)
    setSelected(null)
  }

  function deletePage(i) {
    if (pages.length <= 1) return
    const newPages = pages.filter((_, idx) => idx !== i)
    const newElements = {}
    Object.keys(elements).forEach(k => {
      const ki = parseInt(k)
      if (ki < i) newElements[ki] = elements[k]
      else if (ki > i) newElements[ki - 1] = elements[k]
    })
    setPages(newPages)
    setElements(newElements)
    setCurrentPage(Math.min(currentPage, newPages.length - 1))
    setSelected(null)
  }

  function switchPage(i) { setCurrentPage(i); setSelected(null) }

  function handleSave() {
    onSave({ pages, elements, allElements: Object.values(elements).flat(), bg: canvasBg })
    setSaveFeedback('Saved!')
    setTimeout(() => setSaveFeedback(''), 2000)
  }

  function fitZoom() {
    const area = canvasAreaRef.current
    if (!area) return
    const { width, height } = area.getBoundingClientRect()
    const zx = (width - 80) / CANVAS_W
    const zy = (height - 80) / CANVAS_H
    setZoom(Math.min(zx, zy, 1))
  }

  function processImageFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const x = imgRef_pending.current.x || 100
      const y = imgRef_pending.current.y || 100
      addElement('image', x - 100, y - 75, { src: ev.target.result })
      setToolAndRef('cursor')
      setShowImgUrlPanel(false)
    }
    reader.readAsDataURL(file)
  }

  function handleFileUpload(e) { processImageFile(e.target.files?.[0]); e.target.value = '' }

  function handleDrop(e) {
    e.preventDefault()
    const canvas = canvasRef.current; if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    imgRef_pending.current = {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    }
    const files = e.dataTransfer?.files
    if (files && files[0]?.type.startsWith('image/')) processImageFile(files[0])
  }

  function addImageFromUrl() {
    if (!imgUrlInput.trim()) return
    const x = imgRef_pending.current.x || 100
    const y = imgRef_pending.current.y || 100
    addElement('image', x - 100, y - 75, { src: imgUrlInput.trim() })
    setToolAndRef('cursor')
    setShowImgUrlPanel(false)
    setImgUrlInput('')
  }

  function handleContextMenu(e, data) {
    e.preventDefault()
    e.stopPropagation()
    if (data) setSelected(data)
    setContextMenu({ x: e.clientX, y: e.clientY, el: data })
  }

  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement.tagName
      const isInput = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA'
      const isEditable = document.activeElement.isContentEditable
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo(); return }
      if (isInput) return
      if (isEditable) { if (e.key === 'Escape') { document.activeElement.blur(); setSelected(null) } return }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected() }
      if ((e.key === 'd' || e.key === 'D') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); duplicate() }
      if (e.key === 'Escape') { setSelected(null); setToolAndRef('cursor'); setShowImgUrlPanel(false); setContextMenu(null) }
      if (!e.ctrlKey && !e.metaKey) {
        if (e.key === 'v') setToolAndRef('cursor')
        if (e.key === 'r') setToolAndRef('rect')
        if (e.key === 'u') setToolAndRef('rounded')
        if (e.key === 'o') setToolAndRef('circle')
        if (e.key === 't') setToolAndRef('text')
        if (e.key === 'f') setToolAndRef('frame')
        if (e.key === 'i') setToolAndRef('image')
        if (e.key === 'l') setToolAndRef('line')
        if (e.key === ']') bringToFront()
        if (e.key === '[') sendToBack()
        if (e.key === 'g') setShowGrid(g => !g)
        if (e.key === '+' || e.key === '=') setZoom(z => Math.min(3, +(z + 0.1).toFixed(1)))
        if (e.key === '-') setZoom(z => Math.max(0.15, +(z - 0.1).toFixed(1)))
        if (e.key === '0') fitZoom()
        if (selected) {
          const step = e.shiftKey ? 10 : 1
          if (e.key === 'ArrowLeft') { e.preventDefault(); updateProp('x', (selected.x || 0) - step) }
          if (e.key === 'ArrowRight') { e.preventDefault(); updateProp('x', (selected.x || 0) + step) }
          if (e.key === 'ArrowUp') { e.preventDefault(); updateProp('y', (selected.y || 0) - step) }
          if (e.key === 'ArrowDown') { e.preventDefault(); updateProp('y', (selected.y || 0) + step) }
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, currentPage, pageEls, showGrid])

  useEffect(() => {
    function closeCtx() { setContextMenu(null) }
    window.addEventListener('click', closeCtx)
    return () => window.removeEventListener('click', closeCtx)
  }, [])

  const currentSel = selected ? pageEls.find(e => e.id === selected.id) || null : null
  const isCursorTool = tool === 'cursor'
  const sortedEls = [...pageEls].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))

  function renderElement(data) {
    const isSelected = currentSel?.id === data.id
    const rot = data.rotation || 0
    const opacity = data.opacity !== undefined ? data.opacity : 1

    const baseStyle = {
      position: 'absolute',
      left: data.x + 'px',
      top: data.y + 'px',
      userSelect: 'none',
      boxSizing: 'border-box',
      pointerEvents: isCursorTool ? 'auto' : 'none',
      transform: rot ? `rotate(${rot}deg)` : undefined,
      transformOrigin: 'center center',
      zIndex: data.zIndex || 0,
      opacity,
    }

    const selectionRing = isSelected && isCursorTool ? {
      outline: '2px solid #3b82f6',
      outlineOffset: '2px',
    } : {}

    const onElClick = (e) => { if (!isCursorTool) return; e.stopPropagation(); setSelected(data) }
    const onElDown = (e) => { if (!isCursorTool) return; startDrag(e, data) }
    const onCtx = (e) => { if (!isCursorTool) return; handleContextMenu(e, data) }

    const resizeHandles = isSelected && isCursorTool ? (
      <>
        <div className="fe-resize-handle nw" onMouseDown={e => startResize(e, data, 'nw')} />
        <div className="fe-resize-handle ne" onMouseDown={e => startResize(e, data, 'ne')} />
        <div className="fe-resize-handle sw" onMouseDown={e => startResize(e, data, 'sw')} />
        <div className="fe-resize-handle se" onMouseDown={e => startResize(e, data, 'se')} />
      </>
    ) : null

    const rotateHandle = isSelected && isCursorTool ? (
      <div className="fe-rotate-handle" onMouseDown={e => startRotate(e, data)} title="Rotate">
        <i className="fa-solid fa-rotate" />
      </div>
    ) : null

    if (data.type === 'text') {
      return (
        <div
          key={data.id}
          style={{
            ...baseStyle,
            ...selectionRing,
            fontSize: (data.fontSize || 20) + 'px',
            color: data.color || '#000',
            fontWeight: data.fontWeight || '400',
            fontFamily: data.fontFamily || 'Arial',
            minWidth: '40px',
            padding: '2px 4px',
            whiteSpace: 'pre-wrap',
            cursor: isCursorTool ? 'move' : 'default',
            lineHeight: 1.3,
            textDecoration: data.underline ? 'underline' : 'none',
            fontStyle: data.italic ? 'italic' : 'normal',
          }}
          contentEditable={isCursorTool}
          suppressContentEditableWarning
          spellCheck={false}
          onMouseDown={onElDown}
          onContextMenu={onCtx}
          onBlur={e => { updateProp('content', e.target.innerText) }}
          onClick={e => { if (!isCursorTool) return; e.stopPropagation(); setSelected(data) }}
        >
          {data.content || 'Text'}
          {rotateHandle}
        </div>
      )
    }

    if (data.type === 'image') {
      return (
        <div
          key={data.id}
          style={{ ...baseStyle, ...selectionRing, width: (data.w || 200) + 'px', height: (data.h || 150) + 'px', overflow: 'visible', cursor: isCursorTool ? 'move' : 'default' }}
          onMouseDown={onElDown}
          onClick={onElClick}
          onContextMenu={onCtx}
        >
          <div style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: data.borderRadius ? data.borderRadius + 'px' : 0 }}>
            {data.src
              ? <img src={data.src} alt="" draggable={false} onError={e => e.target.style.display = 'none'}
                style={{ width: '100%', height: '100%', objectFit: data.objectFit || 'cover', pointerEvents: 'none', display: 'block' }} />
              : <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', flexDirection: 'column', gap: 6 }}>
                <i className="fa-regular fa-image" style={{ fontSize: '2rem' }} />
                <span style={{ fontSize: '.7rem' }}>No image</span>
              </div>
            }
          </div>
          {resizeHandles}
          {rotateHandle}
        </div>
      )
    }

    if (data.type === 'triangle') {
      const size = Math.min(data.w || 80, data.h || 80)
      return (
        <div
          key={data.id}
          style={{ ...baseStyle, ...selectionRing, width: size + 'px', height: size + 'px', cursor: isCursorTool ? 'move' : 'default' }}
          onMouseDown={onElDown}
          onClick={onElClick}
          onContextMenu={onCtx}
        >
          <div style={{ width: 0, height: 0, borderLeft: `${size / 2}px solid transparent`, borderRight: `${size / 2}px solid transparent`, borderBottom: `${size}px solid ${data.fill || '#2563eb'}` }} />
          {resizeHandles}
          {rotateHandle}
        </div>
      )
    }

    if (data.type === 'line') {
      return (
        <div
          key={data.id}
          style={{ ...baseStyle, ...selectionRing, width: (data.w || 150) + 'px', height: Math.max(2, data.strokeWidth || 2) + 'px', background: data.fill || '#2563eb', borderRadius: '2px', cursor: isCursorTool ? 'move' : 'default' }}
          onMouseDown={onElDown}
          onClick={onElClick}
          onContextMenu={onCtx}
        >
          {resizeHandles}
          {rotateHandle}
        </div>
      )
    }

    const s = {
      ...baseStyle,
      ...selectionRing,
      width: (data.w || 120) + 'px',
      height: (data.h || 80) + 'px',
      cursor: isCursorTool ? 'move' : 'default',
    }

    if (data.type === 'frame') {
      s.background = data.fill || 'rgba(37,99,235,0.04)'
      s.border = `${data.strokeWidth || 1}px dashed ${data.stroke || '#2563eb'}`
      s.borderRadius = '3px'
    } else if (data.type === 'circle') {
      s.background = data.fill || '#2563eb'
      s.borderRadius = '50%'
      if (data.stroke && data.stroke !== 'none') s.border = `${data.strokeWidth || 1}px solid ${data.stroke}`
    } else if (data.type === 'rounded') {
      s.background = data.fill || '#2563eb'
      s.borderRadius = (data.cornerRadius || 14) + 'px'
      if (data.stroke && data.stroke !== 'none') s.border = `${data.strokeWidth || 1}px solid ${data.stroke}`
    } else {
      s.background = data.fill || '#2563eb'
      if (data.stroke && data.stroke !== 'none') s.border = `${data.strokeWidth || 1}px solid ${data.stroke}`
    }

    if (data.shadow) {
      s.boxShadow = `${data.shadowX || 0}px ${data.shadowY || 4}px ${data.shadowBlur || 12}px ${data.shadowColor || 'rgba(0,0,0,0.3)'}`
    }

    return (
      <div
        key={data.id}
        style={s}
        onMouseDown={onElDown}
        onClick={onElClick}
        onContextMenu={onCtx}
      >
        {resizeHandles}
        {rotateHandle}
      </div>
    )
  }

  const TOOLS = [
    { t: 'cursor', icon: 'arrow-pointer', label: 'Select (V)' },
    null,
    { t: 'rect', icon: 'square-full', label: 'Rectangle (R)', iconPre: 'fa-regular' },
    { t: 'rounded', icon: 'square', label: 'Rounded (U)', iconPre: 'fa-regular' },
    { t: 'circle', icon: 'circle', label: 'Circle (O)', iconPre: 'fa-regular' },
    { t: 'triangle', icon: 'play', label: 'Triangle', extraIconStyle: { transform: 'rotate(-90deg)' } },
    { t: 'line', icon: 'minus', label: 'Line (L)' },
    { t: 'frame', icon: 'border-all', label: 'Frame (F)' },
    null,
    { t: 'text', icon: 't', label: 'Text (T)' },
    { t: 'image', icon: 'image', label: 'Image (I)' },
  ]

  return (
    <div className="fe-fullscreen">
      {/* TOPBAR */}
      <div className="fe-topbar">
        <div className="fe-topbar-left">
          <button className="fe-close-btn" onClick={onClose} title="Close (Esc)">
            <i className="fa-solid fa-xmark" />
          </button>
          <div className="fe-title-wrap">
            <span className="fe-title">{canvasLabel}</span>
          </div>
        </div>

        <div className="fe-toolbar">
          {TOOLS.map((item, i) => {
            if (!item) return <div key={i} className="fe-sep" />
            return (
              <button
                key={item.t}
                className={`fe-tool-btn${tool === item.t ? ' active' : ''}`}
                onClick={() => setToolAndRef(item.t)}
                title={item.label}
              >
                <i className={`${item.iconPre || 'fa-solid'} fa-${item.icon}`} style={item.extraIconStyle || {}} />
              </button>
            )
          })}

          <div className="fe-sep" />

          <label className="fe-color-wrap" title="Fill Color">
            <div className="fe-color-swatch" style={{ background: fillColor }} />
            <input type="color" value={fillColor} onChange={e => {
              setFillAndRef(e.target.value)
              if (currentSel && currentSel.type !== 'image') {
                updateProp(currentSel.type === 'text' ? 'color' : 'fill', e.target.value)
              }
            }} />
            <span>Fill</span>
          </label>

          <label className="fe-color-wrap" title="Stroke Color">
            <div className="fe-color-swatch" style={{ background: strokeColor === 'none' ? 'transparent' : strokeColor, border: '1px solid rgba(255,255,255,0.2)' }} />
            <input type="color" value={strokeColor === 'none' ? '#ffffff' : strokeColor} onChange={e => {
              setStrokeAndRef(e.target.value)
              if (currentSel && currentSel.type !== 'image') updateProp('stroke', e.target.value)
            }} />
            <span>Stroke</span>
          </label>

          <label className="fe-color-wrap" title="Canvas Background">
            <div className="fe-color-swatch" style={{ background: canvasBg }} />
            <input type="color" value={canvasBg} onChange={e => setCanvasBg(e.target.value)} />
            <span>BG</span>
          </label>

          <div className="fe-sep" />

          <button className="fe-tool-btn" onClick={() => bringToFront()} title="Bring to Front (])">
            <i className="fa-solid fa-layer-group" />
          </button>
          <button className="fe-tool-btn" onClick={() => sendToBack()} title="Send to Back ([)">
            <i className="fa-solid fa-layer-group" style={{ opacity: .4 }} />
          </button>

          <div className="fe-sep" />

          <button className="fe-tool-btn" onClick={undo} title="Undo (Ctrl+Z)">
            <i className="fa-solid fa-rotate-left" />
          </button>
          <button className="fe-tool-btn" onClick={redo} title="Redo (Ctrl+Y)">
            <i className="fa-solid fa-rotate-right" />
          </button>
          <button className="fe-tool-btn" onClick={duplicate} title="Duplicate (Ctrl+D)">
            <i className="fa-solid fa-copy" />
          </button>
          <button className="fe-tool-btn fe-delete-btn" onClick={deleteSelected} title="Delete">
            <i className="fa-solid fa-trash" />
          </button>

          <div className="fe-sep" />

          <button
            className={`fe-tool-btn${showGrid ? ' active' : ''}`}
            onClick={() => setShowGrid(g => !g)}
            title="Toggle Grid (G)"
          >
            <i className="fa-solid fa-hashtag" />
          </button>
          <button
            className={`fe-tool-btn${snapEnabled ? ' active' : ''}`}
            onClick={() => setSnapEnabled(s => !s)}
            title="Toggle Snap"
          >
            <i className="fa-solid fa-magnet" />
          </button>
        </div>

        <div className="fe-topbar-right">
          <div className="fe-zoom-row">
            <button onClick={() => setZoom(z => Math.max(0.15, +(z - 0.1).toFixed(1)))} title="Zoom Out (-)">
              <i className="fa-solid fa-minus" />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(3, +(z + 0.1).toFixed(1)))} title="Zoom In (+)">
              <i className="fa-solid fa-plus" />
            </button>
            <button onClick={fitZoom} title="Fit to screen (0)">Fit</button>
          </div>

          <button className="fe-save-btn" onClick={handleSave}>
            <i className="fa-solid fa-floppy-disk" />
            {saveFeedback ? <span style={{ color: '#4ade80' }}>{saveFeedback}</span> : 'Save'}
          </button>
        </div>
      </div>

      <div className="fe-body">
        {/* LEFT PANEL */}
        <div className="fe-left">
          <div className="fe-panel-label">Pages</div>
          {pages.map((p, i) => (
            <div
              key={i}
              className={`fe-page-item${i === currentPage ? ' active' : ''}`}
              onClick={() => switchPage(i)}
              onDoubleClick={() => setPageNameEdit(i)}
            >
              <i className="fa-regular fa-file" />
              {pageNameEdit === i ? (
                <input
                  autoFocus
                  defaultValue={p}
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: '.82rem' }}
                  onBlur={e => {
                    const newPages = [...pages]; newPages[i] = e.target.value || p
                    setPages(newPages); setPageNameEdit(null)
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                  onClick={e => e.stopPropagation()}
                />
              ) : <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p}</span>}
              {pages.length > 1 && (
                <button
                  onClick={e => { e.stopPropagation(); deletePage(i) }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '2px 4px', opacity: 0, transition: 'opacity .15s' }}
                  className="fe-page-delete"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              )}
            </div>
          ))}
          <button className="fe-add-page-btn" onClick={addPage}>
            <i className="fa-solid fa-plus" /> Add Page
          </button>

          <div className="fe-panel-label" style={{ marginTop: 14 }}>Layers</div>
          {[...sortedEls].reverse().map(el => (
            <div
              key={el.id}
              className={`fe-layer-item${currentSel?.id === el.id ? ' selected' : ''}`}
              onClick={() => setSelected(el)}
              onDoubleClick={() => { }}
            >
              <i className={`fa-solid fa-${TYPE_ICONS[el.type] || 'square'}`} style={{ fontSize: '.72rem', opacity: .7 }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '.78rem' }}>
                {el.type}{el.type === 'text' ? ` — "${(el.content || '').slice(0, 10)}"` : ''}
              </span>
              <span style={{ fontSize: '.6rem', color: 'var(--text-dim)' }}>z{el.zIndex || 0}</span>
            </div>
          ))}
          {sortedEls.length === 0 && (
            <div style={{ padding: '12px', color: 'var(--text-dim)', fontSize: '.74rem', textAlign: 'center' }}>No layers</div>
          )}
        </div>

        {/* CANVAS AREA */}
        <div className="fe-canvas-area" ref={canvasAreaRef}>
          <div
            className="fe-canvas-wrapper"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
          >
            <div
              ref={canvasRef}
              className={`fe-canvas${!isCursorTool ? ' fe-canvas--drawing' : ''}${showGrid ? ' fe-canvas--grid' : ''}`}
              style={{ background: canvasBg, '--canvas-bg': canvasBg }}
              onClick={handleCanvasClick}
              onMouseDown={handleCanvasMouseDown}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onContextMenu={e => { e.preventDefault(); handleContextMenu(e, null) }}
            >
              {showGrid && (
                <svg className="fe-grid-overlay" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
                  <defs>
                    <pattern id="smallgrid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
                    </pattern>
                    <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
                      <rect width="100" height="100" fill="url(#smallgrid)" />
                      <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
              )}
              {pageEls.length === 0 && (
                <div className="fe-canvas-empty">
                  <i className="fa-solid fa-pen-ruler" style={{ fontSize: '2rem', opacity: .2, display: 'block', marginBottom: 8 }} />
                  <span>Select a tool and click to start designing</span>
                </div>
              )}
              {sortedEls.map(renderElement)}
            </div>
          </div>

          {!isCursorTool && (
            <div className="fe-tool-hint">
              <span className="fe-tool-active-hint">
                <i className="fa-solid fa-crosshairs" />
                <strong>{tool}</strong> — click canvas to place · <kbd>Esc</kbd> to cancel
              </span>
            </div>
          )}

          {/* Canvas size indicator */}
          <div className="fe-canvas-info">
            {CANVAS_W} × {CANVAS_H}px · {Math.round(zoom * 100)}%
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="fe-right">
          <div className="fe-panel-label">Properties</div>
          {!currentSel ? (
            <div className="fe-props-empty">
              <i className="fa-regular fa-hand-pointer" />
              <p>Select an element to edit its properties</p>
            </div>
          ) : (
            <div>
              {/* Type badge */}
              <div style={{ padding: '8px 12px 0', display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ background: 'rgba(59,130,246,.15)', color: 'var(--accent-light)', padding: '2px 9px', borderRadius: 20, fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  <i className={`fa-solid fa-${TYPE_ICONS[currentSel.type] || 'square'}`} style={{ marginRight: 5 }} />
                  {currentSel.type}
                </div>
              </div>

              <div className="fe-prop-section">Layer Order</div>
              <div className="fe-prop-row">
                <button className="fe-layer-order-btn fe-layer-order-front" onClick={() => bringToFront()}>
                  <i className="fa-solid fa-up-long" /> Front
                </button>
                <button className="fe-layer-order-btn" onClick={() => sendToBack()}>
                  <i className="fa-solid fa-down-long" /> Back
                </button>
              </div>

              <div className="fe-prop-section">Position</div>
              <div className="fe-prop-row">
                <div className="fe-prop-item">
                  <label>X</label>
                  <input type="number" value={Math.round(currentSel.x)} onChange={e => updateProp('x', e.target.value)} />
                </div>
                <div className="fe-prop-item">
                  <label>Y</label>
                  <input type="number" value={Math.round(currentSel.y)} onChange={e => updateProp('y', e.target.value)} />
                </div>
              </div>

              {currentSel.type !== 'text' && (
                <>
                  <div className="fe-prop-section">Size</div>
                  <div className="fe-prop-row">
                    <div className="fe-prop-item">
                      <label>W</label>
                      <input type="number" value={Math.round(currentSel.w || 120)} onChange={e => updateProp('w', e.target.value)} />
                    </div>
                    <div className="fe-prop-item">
                      <label>H</label>
                      <input type="number" value={Math.round(currentSel.h || 80)} onChange={e => updateProp('h', e.target.value)} />
                    </div>
                  </div>
                </>
              )}

              <div className="fe-prop-section">Transform</div>
              <div className="fe-prop-row">
                <div className="fe-prop-item">
                  <label>Rotate °</label>
                  <input type="number" value={Math.round(currentSel.rotation || 0)} onChange={e => updateProp('rotation', e.target.value)} />
                </div>
                <div className="fe-prop-item">
                  <label>Opacity %</label>
                  <input type="number" min="0" max="100" value={Math.round((currentSel.opacity !== undefined ? currentSel.opacity : 1) * 100)} onChange={e => updateProp('opacity', parseFloat(e.target.value) / 100)} />
                </div>
              </div>

              {currentSel.type !== 'image' && (
                <>
                  <div className="fe-prop-section">Appearance</div>
                  <div className="fe-prop-row">
                    <div className="fe-prop-item">
                      <label>{currentSel.type === 'text' ? 'Text Color' : 'Fill'}</label>
                      <input type="color"
                        value={currentSel.type === 'text' ? (currentSel.color || '#000000') : (currentSel.fill && !currentSel.fill.startsWith('rgba') ? currentSel.fill : '#2563eb')}
                        onChange={e => updateProp(currentSel.type === 'text' ? 'color' : 'fill', e.target.value)}
                      />
                    </div>
                    {currentSel.type !== 'text' && currentSel.type !== 'line' && (
                      <div className="fe-prop-item">
                        <label>Stroke</label>
                        <input type="color"
                          value={currentSel.stroke && currentSel.stroke !== 'none' && !currentSel.stroke.startsWith('rgba') ? currentSel.stroke : '#ffffff'}
                          onChange={e => updateProp('stroke', e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  {currentSel.type !== 'text' && currentSel.type !== 'line' && currentSel.type !== 'triangle' && (
                    <div className="fe-prop-row">
                      <div className="fe-prop-item">
                        <label>Stroke Width</label>
                        <input type="number" min="0" max="20" value={currentSel.strokeWidth || 0} onChange={e => updateProp('strokeWidth', e.target.value)} />
                      </div>
                      {(currentSel.type === 'rounded') && (
                        <div className="fe-prop-item">
                          <label>Corner Radius</label>
                          <input type="number" min="0" max="100" value={currentSel.cornerRadius || 14} onChange={e => updateProp('cornerRadius', e.target.value)} />
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {currentSel.type === 'image' && (
                <>
                  <div className="fe-prop-section">Image</div>
                  <div style={{ padding: '8px 9px' }}>
                    <label style={{ fontSize: '.67rem', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>URL</label>
                    <input
                      style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--card-border)', borderRadius: 5, padding: '5px 7px', color: 'var(--text)', fontSize: '.76rem', outline: 'none', boxSizing: 'border-box' }}
                      type="text"
                      value={currentSel.src || ''}
                      onChange={e => updateProp('src', e.target.value)}
                      placeholder="https://..."
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{ marginTop: 6, width: '100%', background: 'rgba(37,99,235,0.15)', border: '1px solid var(--accent)', color: 'var(--accent-light)', padding: '6px', borderRadius: 5, cursor: 'pointer', fontSize: '.76rem', boxSizing: 'border-box' }}
                    >
                      <i className="fa-solid fa-folder-open" /> Browse
                    </button>
                  </div>
                  <div className="fe-prop-row">
                    <div className="fe-prop-item">
                      <label>Fit</label>
                      <select value={currentSel.objectFit || 'cover'} onChange={e => updateProp('objectFit', e.target.value)}>
                        <option value="cover">Cover</option>
                        <option value="contain">Contain</option>
                        <option value="fill">Fill</option>
                      </select>
                    </div>
                    <div className="fe-prop-item">
                      <label>Radius</label>
                      <input type="number" min="0" value={currentSel.borderRadius || 0} onChange={e => updateProp('borderRadius', e.target.value)} />
                    </div>
                  </div>
                </>
              )}

              {currentSel.type === 'text' && (
                <>
                  <div className="fe-prop-section">Typography</div>
                  <div className="fe-prop-row">
                    <div className="fe-prop-item">
                      <label>Size</label>
                      <input type="number" min="6" max="200" value={currentSel.fontSize || 20} onChange={e => updateProp('fontSize', e.target.value)} />
                    </div>
                    <div className="fe-prop-item">
                      <label>Weight</label>
                      <select value={currentSel.fontWeight || '400'} onChange={e => updateProp('fontWeight', e.target.value)}>
                        <option value="300">Light</option>
                        <option value="400">Regular</option>
                        <option value="600">Semi</option>
                        <option value="700">Bold</option>
                        <option value="800">Extra</option>
                        <option value="900">Black</option>
                      </select>
                    </div>
                  </div>
                  <div className="fe-prop-row">
                    <div className="fe-prop-item">
                      <label>Font</label>
                      <select value={currentSel.fontFamily || 'Arial'} onChange={e => updateProp('fontFamily', e.target.value)}>
                        <option value="Arial">Arial</option>
                        <option value="Syne, sans-serif">Syne</option>
                        <option value="DM Sans, sans-serif">DM Sans</option>
                        <option value="Georgia, serif">Georgia</option>
                        <option value="'Playfair Display', serif">Playfair</option>
                        <option value="'Courier New', monospace">Courier</option>
                        <option value="monospace">Mono</option>
                        <option value="Impact, sans-serif">Impact</option>
                      </select>
                    </div>
                  </div>
                  <div className="fe-prop-row">
                    <div className="fe-prop-item" style={{ display: 'flex', flexDirection: 'row', gap: 6, gridColumn: 'span 2' }}>
                      <button
                        className={`fe-text-style-btn${currentSel.italic ? ' on' : ''}`}
                        onClick={() => updateProp('italic', !currentSel.italic)}
                        title="Italic"
                      ><i className="fa-solid fa-italic" /></button>
                      <button
                        className={`fe-text-style-btn${currentSel.underline ? ' on' : ''}`}
                        onClick={() => updateProp('underline', !currentSel.underline)}
                        title="Underline"
                      ><i className="fa-solid fa-underline" /></button>
                    </div>
                  </div>
                </>
              )}

              {/* Shadow */}
              {currentSel.type !== 'text' && currentSel.type !== 'line' && (
                <>
                  <div className="fe-prop-section">Shadow</div>
                  <div className="fe-prop-row">
                    <div className="fe-prop-item" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <label style={{ marginBottom: 0 }}>Enable</label>
                      <input type="checkbox" checked={currentSel.shadow || false} onChange={e => updateProp('shadow', e.target.checked)} />
                    </div>
                  </div>
                  {currentSel.shadow && (
                    <div className="fe-prop-row">
                      <div className="fe-prop-item"><label>Blur</label><input type="number" min="0" max="50" value={currentSel.shadowBlur || 12} onChange={e => updateProp('shadowBlur', e.target.value)} /></div>
                      <div className="fe-prop-item"><label>Color</label><input type="color" value={currentSel.shadowColor?.replace(/rgba?\(.*?\)/, '#000000') || '#000000'} onChange={e => updateProp('shadowColor', e.target.value)} /></div>
                    </div>
                  )}
                </>
              )}

              <div style={{ padding: '12px 10px' }}>
                <button className="fe-delete-el-btn" onClick={deleteSelected}>
                  <i className="fa-solid fa-trash" /> Delete Element
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Image URL panel */}
      {showImgUrlPanel && (
        <div className="fe-img-url-panel">
          <div className="fe-img-url-box">
            <h4 style={{ fontFamily: 'var(--font-display)', marginBottom: 14, fontSize: '.95rem' }}>
              <i className="fa-regular fa-image" style={{ marginRight: 7, color: 'var(--accent-light)' }} />
              Add Image
            </h4>
            <div style={{ display: 'flex', gap: 7, marginBottom: 14 }}>
              <input
                ref={imgUrlInputRef}
                autoFocus
                value={imgUrlInput}
                onChange={e => setImgUrlInput(e.target.value)}
                placeholder="Paste image URL..."
                style={{ flex: 1, fontSize: '.84rem' }}
                onKeyDown={e => { if (e.key === 'Enter') addImageFromUrl() }}
              />
              <button className="btn-primary" onClick={addImageFromUrl}>Add</button>
            </div>
            {imgUrlInput && (
              <div style={{ marginBottom: 12, borderRadius: 8, overflow: 'hidden', height: 80, background: 'rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={imgUrlInput} alt="" style={{ height: '100%', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-dim)', fontSize: '.78rem', marginBottom: 12 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--card-border)' }} />
              <span>or</span>
              <div style={{ flex: 1, height: 1, background: 'var(--card-border)' }} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px', background: 'rgba(255,255,255,.05)', border: '1.5px dashed var(--card-border)', borderRadius: 8, cursor: 'pointer', fontSize: '.84rem', color: 'var(--text-muted)' }}>
              <i className="fa-regular fa-folder-open" /> Browse from device
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
            </label>
            <button
              style={{ marginTop: 10, width: '100%', background: 'none', border: '1px solid var(--card-border)', borderRadius: 7, padding: '7px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '.8rem' }}
              onClick={() => { setShowImgUrlPanel(false); setToolAndRef('cursor') }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fe-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          {contextMenu.el ? (
            <>
              <button onClick={() => { duplicate(); setContextMenu(null) }}><i className="fa-solid fa-copy" /> Duplicate</button>
              <button onClick={() => { bringToFront(contextMenu.el); setContextMenu(null) }}><i className="fa-solid fa-layer-group" /> Bring to Front</button>
              <button onClick={() => { sendToBack(contextMenu.el); setContextMenu(null) }}><i className="fa-solid fa-layer-group" style={{ opacity: .5 }} /> Send to Back</button>
              <div className="fe-ctx-divider" />
              <button className="fe-ctx-danger" onClick={() => { deleteSelected(); setContextMenu(null) }}><i className="fa-solid fa-trash" /> Delete</button>
            </>
          ) : (
            <>
              <button onClick={() => { setToolAndRef('rect'); setContextMenu(null) }}><i className="fa-regular fa-square-full" /> Add Rectangle</button>
              <button onClick={() => { setToolAndRef('circle'); setContextMenu(null) }}><i className="fa-regular fa-circle" /> Add Circle</button>
              <button onClick={() => { setToolAndRef('text'); setContextMenu(null) }}><i className="fa-solid fa-t" /> Add Text</button>
              <button onClick={() => { setToolAndRef('image'); setContextMenu(null) }}><i className="fa-regular fa-image" /> Add Image</button>
            </>
          )}
        </div>
      )}

      <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
    </div>
  )
}