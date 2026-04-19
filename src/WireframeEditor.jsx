import { useState, useRef, useCallback, useEffect } from 'react'
import './WireframeEditor.css'

let nextId = 1

const VALIGN_STYLE = {
  top:    { alignItems: 'flex-start', paddingTop: 6 },
  center: { alignItems: 'center' },
  bottom: { alignItems: 'flex-end', paddingBottom: 6 },
}

const PRESETS = [
  { label: 'Desktop',  w: 1280, h: 720 },
  { label: 'Full HD',  w: 1920, h: 1080 },
  { label: 'Tablet',   w: 768,  h: 1024 },
  { label: 'Mobile',   w: 375,  h: 812 },
]

function buildHierarchy(blocks) {
  const sorted = [...blocks].sort((a, b) => (b.w * b.h) - (a.w * a.h))
  const parentOf = {}
  const childrenOf = {}
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const p = sorted[i], c = sorted[j]
      if (!parentOf[c.id] &&
          c.x >= p.x && c.y >= p.y &&
          c.x + c.w <= p.x + p.w &&
          c.y + c.h <= p.y + p.h) {
        parentOf[c.id] = p.id
        if (!childrenOf[p.id]) childrenOf[p.id] = []
        childrenOf[p.id].push(c)
      }
    }
  }
  return { childrenOf, roots: sorted.filter(b => !parentOf[b.id]) }
}

const CANVAS_MIN_W = 1600
const CANVAS_MIN_H = 900
const CANVAS_PAD = 300

function generateLayoutMd(blocks, layoutName) {
  const frame = blocks.find(b => b.type === 'frame')
  const lines = [`# ${layoutName}`]

  if (!frame) {
    lines.push('viewport: none', '')
    const sorted = [...blocks].sort((a, b) => a.y - b.y || a.x - b.x)
    for (const b of sorted) {
      lines.push(`- "${b.label}"  x:${Math.round(b.x)} y:${Math.round(b.y)}  ${Math.round(b.w)}×${Math.round(b.h)}`)
    }
    return lines.join('\n') + '\n'
  }

  lines.push(`viewport: ${frame.label}`, '')
  const fW = frame.w, fH = frame.h
  const TOL = 10
  const inner = blocks.filter(b =>
    b.type !== 'frame' &&
    b.x >= frame.x - TOL && b.y >= frame.y - TOL &&
    b.x + b.w <= frame.x + fW + TOL &&
    b.y + b.h <= frame.y + fH + TOL
  )
  if (inner.length === 0) { lines.push('(empty)'); return lines.join('\n') + '\n' }

  const rel = inner.map(b => ({
    id: b.id, label: b.label,
    rx: b.x - frame.x, ry: b.y - frame.y,
    w: b.w, h: b.h,
    wPct: Math.round(b.w / fW * 100),
    hPct: Math.round(b.h / fH * 100),
    topPct: Math.round((b.y - frame.y) / fH * 100),
    leftPct: Math.round((b.x - frame.x) / fW * 100),
  }))

  const rowThreshold = fH * 0.05
  const assigned = new Set()
  const rows = []
  for (const b of [...rel].sort((a, b) => a.ry - b.ry)) {
    if (assigned.has(b.id)) continue
    const row = [b]
    assigned.add(b.id)
    for (const other of rel) {
      if (!assigned.has(other.id) && Math.abs(other.ry - b.ry) <= rowThreshold) {
        row.push(other)
        assigned.add(other.id)
      }
    }
    rows.push(row.sort((a, b) => a.rx - b.rx))
  }

  for (const row of rows) {
    const avgTop = Math.round(row.reduce((s, b) => s + b.topPct, 0) / row.length)
    const avgH   = Math.round(row.reduce((s, b) => s + b.hPct,  0) / row.length)
    if (row.length === 1) {
      const b = row[0]
      const lbl = b.label !== 'Block' ? `"${b.label}" ` : ''
      if (b.wPct >= 70) {
        lines.push(`- ${lbl}full-width bar   top:${b.topPct}%  height:${b.hPct}%`)
      } else {
        lines.push(`- ${lbl}block   left:${b.leftPct}%  top:${b.topPct}%  width:${b.wPct}%  height:${b.hPct}%`)
      }
    } else {
      const wPcts = row.map(b => b.wPct)
      const isEqual = Math.max(...wPcts) - Math.min(...wPcts) <= 15
      if (isEqual) {
        lines.push(`- ${row.length} equal columns   top:${avgTop}%  height:${avgH}%`)
      } else {
        const cols = row.map(b => b.label !== 'Block' ? `"${b.label}" ${b.wPct}%` : `${b.wPct}%`).join(' | ')
        lines.push(`- columns [${cols}]   top:${avgTop}%  height:${avgH}%`)
      }
    }
  }

  return lines.join('\n') + '\n'
}

export default function WireframeEditor() {
  const [blocks, setBlocks] = useState([])
  const [selected, setSelected] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const [layoutName, setLayoutName] = useState('Untitled')
  const [editingName, setEditingName] = useState(false)
  const [editNameText, setEditNameText] = useState('')
  const [zoom, setZoom] = useState(1)
  const [showUI, setShowUI] = useState(true)
  const [liveMode, setLiveMode] = useState(false)
  const [labelSize, setLabelSize] = useState(13)
  const liveEtagRef = useRef(null)

  const canvasRef = useRef(null)
  const wrapperRef = useRef(null)
  const designRef = useRef(null)
  const dragRef = useRef(null)
  const suppressNextClickRef = useRef(false)
  const zoomRef = useRef(1)
  const clipboardRef = useRef(null)
  const historyRef = useRef([])
  const blocksRef = useRef([])
  const selectedRef = useRef(null)

  useEffect(() => { zoomRef.current = zoom }, [zoom])
  useEffect(() => { blocksRef.current = blocks }, [blocks])
  useEffect(() => { selectedRef.current = selected }, [selected])

  const pushHistory = useCallback(() => {
    historyRef.current.push({ blocks: blocksRef.current, selected: selectedRef.current })
    if (historyRef.current.length > 50) historyRef.current.shift()
  }, [])

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragRef.current) return
      const { type, id, startMouseX, startMouseY, startBlock } = dragRef.current
      const z = zoomRef.current
      let dx = (e.clientX - startMouseX) / z
      let dy = (e.clientY - startMouseY) / z
      if (e.shiftKey && type === 'move') {
        if (Math.abs(dx) >= Math.abs(dy)) dy = 0
        else dx = 0
      }
      setBlocks(prev => prev.map(b => {
        if (b.id !== id) return b
        if (type === 'move')   return { ...b, x: Math.max(0, startBlock.x + dx), y: Math.max(0, startBlock.y + dy) }
        if (type === 'resize') return { ...b, w: Math.max(80, startBlock.w + dx), h: Math.max(36, startBlock.h + dy) }
        return b
      }))
    }
    const onMouseUp = () => {
      if (dragRef.current) suppressNextClickRef.current = true
      dragRef.current = null
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (editingId || editingName) return

      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        pushHistory()
        setBlocks(prev => prev.filter(b => b.id !== selected))
        setSelected(null)
        return
      }

      if (e.key === 'c' && (e.ctrlKey || e.metaKey) && selected) {
        e.preventDefault()
        pushHistory()
        setBlocks(prev => {
          const src = prev.find(b => b.id === selected)
          if (!src) return prev
          const newId = nextId++
          setSelected(newId)
          return [...prev, { ...src, id: newId, x: src.x + 20, y: src.y + 20 }]
        })
        return
      }

      if (e.key === 'x' && (e.ctrlKey || e.metaKey) && selected) {
        e.preventDefault()
        pushHistory()
        setBlocks(prev => {
          const src = prev.find(b => b.id === selected)
          if (!src) return prev
          clipboardRef.current = { ...src }
          return prev.filter(b => b.id !== selected)
        })
        setSelected(null)
        return
      }

      if (e.key === 'v' && (e.ctrlKey || e.metaKey) && clipboardRef.current) {
        e.preventDefault()
        pushHistory()
        const src = clipboardRef.current
        const newId = nextId++
        setBlocks(prev => [...prev, { ...src, id: newId, x: src.x + 20, y: src.y + 20 }])
        setSelected(newId)
        return
      }

      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault()
        const snap = historyRef.current.pop()
        if (!snap) return
        setBlocks(snap.blocks)
        setSelected(snap.selected)
      }

      if (e.key === '`') {
        setShowUI(v => !v)
      }

      if (selected && (e.key === '1' || e.key === '2' || e.key === '3')) {
        const valignMap = { '1': 'top', '2': 'center', '3': 'bottom' }
        pushHistory()
        setBlocks(prev => prev.map(b => b.id === selected ? { ...b, valign: valignMap[e.key] } : b))
      }

      if (e.key === '4') {
        setLabelSize(s => Math.max(8, s - 1))
      }
      if (e.key === '5') {
        setLabelSize(s => Math.min(36, s + 1))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selected, editingId, editingName, pushHistory])

  useEffect(() => {
    if (!liveMode) { liveEtagRef.current = null; return }
    let initialized = false
    const poll = async () => {
      try {
        const res = await fetch('/layouts/live.json', { cache: 'no-store' })
        if (!res.ok) return
        const etag = res.headers.get('etag') + res.headers.get('last-modified')
        if (etag === liveEtagRef.current) return
        liveEtagRef.current = etag
        if (!initialized) { initialized = true; return }
        const data = await res.json()
        setBlocks(data)
        nextId = data.length ? Math.max(...data.map(b => b.id)) + 1 : 1
      } catch {}
    }
    poll()
    const id = setInterval(poll, 1000)
    return () => clearInterval(id)
  }, [liveMode])

  useEffect(() => {
    const el = canvasRef.current
    const onWheel = (e) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const prevZoom = zoomRef.current
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      const newZoom = parseFloat(Math.min(3, Math.max(0.1, prevZoom + delta)).toFixed(2))

      const rect = el.getBoundingClientRect()
      const mouseScreenX = e.clientX - rect.left
      const mouseScreenY = e.clientY - rect.top
      const designX = (el.scrollLeft + mouseScreenX) / prevZoom
      const designY = (el.scrollTop  + mouseScreenY) / prevZoom

      zoomRef.current = newZoom
      setZoom(newZoom)

      requestAnimationFrame(() => {
        el.scrollLeft = designX * newZoom - mouseScreenX
        el.scrollTop  = designY * newZoom - mouseScreenY
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const addBlock = useCallback((e) => {
    if (suppressNextClickRef.current) { suppressNextClickRef.current = false; return }
    if (e.target.closest('.wf-block:not(.frame)')) return
    const rect = designRef.current.getBoundingClientRect()
    const z = zoomRef.current
    const x = Math.round(((e.clientX - rect.left) / z - 75) / 10) * 10
    const y = Math.round(((e.clientY - rect.top)  / z - 30) / 10) * 10
    const id = nextId++
    pushHistory()
    setBlocks(prev => [...prev, { id, label: 'Block', x: Math.max(0, x), y: Math.max(0, y), w: 150, h: 60, valign: 'center' }])
    setSelected(id)
  }, [pushHistory])

  const startMove = useCallback((e, id) => {
    e.stopPropagation()
    if (editingId) return

    if (e.ctrlKey && e.shiftKey) {
      const block = blocks.find(b => b.id === id)
      if (!block) return
      pushHistory()
      const newId = nextId++
      setBlocks(prev => [...prev, { ...block, id: newId }])
      setSelected(newId)
      dragRef.current = { type: 'move', id: newId, startMouseX: e.clientX, startMouseY: e.clientY, startBlock: { ...block } }
      return
    }

    setSelected(id)
    const block = blocks.find(b => b.id === id)
    pushHistory()
    dragRef.current = { type: 'move', id, startMouseX: e.clientX, startMouseY: e.clientY, startBlock: { ...block } }
  }, [blocks, editingId, pushHistory])

  const startResize = useCallback((e, id) => {
    e.stopPropagation()
    const block = blocks.find(b => b.id === id)
    pushHistory()
    dragRef.current = { type: 'resize', id, startMouseX: e.clientX, startMouseY: e.clientY, startBlock: { ...block } }
  }, [blocks, pushHistory])

  const startEdit = useCallback((e, id, label) => {
    e.stopPropagation()
    pushHistory()
    setEditingId(id)
    setEditText(label)
  }, [pushHistory])

  const commitEdit = useCallback(() => {
    setBlocks(prev => prev.map(b => b.id === editingId ? { ...b, label: editText || 'Block' } : b))
    setEditingId(null)
  }, [editingId, editText])

  const setValign = useCallback((valign) => {
    pushHistory()
    setBlocks(prev => prev.map(b => b.id === selected ? { ...b, valign } : b))
  }, [selected, pushHistory])

  const insertFrame = useCallback((preset) => {
    pushHistory()
    const id = nextId++
    setBlocks(prev => [...prev, {
      id,
      label: `${preset.label} ${preset.w}×${preset.h}`,
      x: 40, y: 40,
      w: preset.w, h: preset.h,
      valign: 'top',
      type: 'frame',
    }])
    setSelected(id)
    canvasRef.current?.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  }, [pushHistory])

  const fitAll = useCallback(() => {
    if (blocks.length === 0) return
    const canvas = canvasRef.current
    const viewW = canvas.clientWidth
    const viewH = canvas.clientHeight
    const pad = 60
    const minX = Math.min(...blocks.map(b => b.x))
    const minY = Math.min(...blocks.map(b => b.y))
    const maxX = Math.max(...blocks.map(b => b.x + b.w))
    const maxY = Math.max(...blocks.map(b => b.y + b.h))
    const newZoom = parseFloat(Math.min(viewW / (maxX - minX + pad * 2), viewH / (maxY - minY + pad * 2), 1.5).toFixed(2))
    zoomRef.current = newZoom
    setZoom(newZoom)
    setTimeout(() => {
      canvas.scrollTo({
        left: Math.max(0, (minX - pad) * newZoom),
        top:  Math.max(0, (minY - pad) * newZoom),
        behavior: 'smooth',
      })
    }, 50)
  }, [blocks])

  const changeZoom = useCallback((delta) => {
    const newZoom = parseFloat(Math.min(3, Math.max(0.1, zoomRef.current + delta)).toFixed(2))
    zoomRef.current = newZoom
    setZoom(newZoom)
  }, [])

  const copySummary = useCallback(() => {
    if (blocks.length === 0) return
    const { childrenOf, roots } = buildHierarchy(blocks)
    const lines = [`# ${layoutName}\n`]
    const renderNode = (block, parent, indent) => {
      if (parent) {
        const rx = block.x - parent.x, ry = block.y - parent.y
        const pW = v => Math.round(v / parent.w * 100)
        const pH = v => Math.round(v / parent.h * 100)
        lines.push(`${indent}[${block.label}]  left:${pW(rx)}% top:${pH(ry)}%  ${block.w}×${block.h}  (w:${pW(block.w)}% h:${pH(block.h)}%)`)
      } else {
        lines.push(`${indent}[${block.label}]  x:${block.x} y:${block.y}  ${block.w}×${block.h}`)
      }
      for (const child of (childrenOf[block.id] || [])) renderNode(child, block, indent + '  ')
    }
    for (const root of roots) renderNode(root, null, '')
    navigator.clipboard.writeText(lines.join('\n'))
    setSaveStatus('摘要已複製')
    setTimeout(() => setSaveStatus(''), 2000)
  }, [blocks, layoutName])

  const saveLayout = useCallback(() => {
    const blob = new Blob([JSON.stringify(blocks, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${layoutName}.json`
    a.click()
    URL.revokeObjectURL(url)
    setSaveStatus('已儲存')
    setTimeout(() => setSaveStatus(''), 2000)
  }, [blocks, layoutName])

  const exportMd = useCallback(() => {
    const blob = new Blob([generateLayoutMd(blocks, layoutName)], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${layoutName}.md`
    a.click()
    URL.revokeObjectURL(url)
    setSaveStatus('已輸出')
    setTimeout(() => setSaveStatus(''), 2000)
  }, [blocks, layoutName])

  // Web version: open file via browser input instead of Electron file dialog
  const loadLayout = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        const data = JSON.parse(ev.target.result)
        const name = file.name.replace(/\.json$/, '')
        setBlocks(data)
        setLayoutName(name)
        nextId = data.length ? Math.max(...data.map(b => b.id)) + 1 : 1
        setSaveStatus('已載入')
        setTimeout(() => setSaveStatus(''), 2000)
      }
      reader.readAsText(file)
    }
    input.click()
  }, [])

  const clearAll = useCallback(() => {
    if (blocks.length === 0) return
    pushHistory()
    setBlocks([])
    setSelected(null)
    nextId = 1
  }, [blocks, pushHistory])

  const startEditName = useCallback(() => {
    setEditNameText(layoutName)
    setEditingName(true)
  }, [layoutName])

  const commitEditName = useCallback(() => {
    setLayoutName(editNameText.trim() || 'Untitled')
    setEditingName(false)
  }, [editNameText])

  const selectedBlock = blocks.find(b => b.id === selected)
  const sortedBlocks = [...blocks].sort((a, b) => {
    if (a.type === 'frame' && b.type !== 'frame') return -1
    if (b.type === 'frame' && a.type !== 'frame') return 1
    return 0
  })

  const canvasW = blocks.length ? Math.max(CANVAS_MIN_W, ...blocks.map(b => b.x + b.w)) + CANVAS_PAD : CANVAS_MIN_W
  const canvasH = blocks.length ? Math.max(CANVAS_MIN_H, ...blocks.map(b => b.y + b.h)) + CANVAS_PAD : CANVAS_MIN_H

  return (
    <div className="wf-root">
      {!showUI && (
        <button className="wf-ui-toggle" onClick={() => setShowUI(true)} title="顯示工具列 (`)">
          ☰
        </button>
      )}
      {showUI && <div className="wf-toolbar">
        <div className="wf-left">
          <span className="wf-hint">點擊畫布新增 · 拖拉移動 · Shift+拖拉鎖軸 · Ctrl+Shift+拖拉複製 · 雙擊改名 · Delete 刪除 · Ctrl+C 複製 · Ctrl+X 剪下 · Ctrl+V 貼上 · Ctrl+Z 復原 · Ctrl+滾輪縮放</span>
        </div>

        <div className="wf-center">
          {editingName ? (
            <input
              className="wf-name-input"
              value={editNameText}
              autoFocus
              onChange={e => setEditNameText(e.target.value)}
              onBlur={commitEditName}
              onKeyDown={e => { if (e.key === 'Enter') commitEditName() }}
            />
          ) : (
            <span className="wf-name" title="點擊編輯名稱" onClick={startEditName}>
              {layoutName}
            </span>
          )}
        </div>

        <div className="wf-actions">
          {selectedBlock && selectedBlock.type !== 'frame' && (
            <div className="wf-valign">
              <span className="wf-valign-label">文字：</span>
              {['top', 'center', 'bottom'].map(v => (
                <button
                  key={v}
                  className={`wf-valign-btn${selectedBlock.valign === v ? ' active' : ''}`}
                  onClick={() => setValign(v)}
                  title={v === 'top' ? '靠上' : v === 'center' ? '置中' : '靠下'}
                >
                  {v === 'top' ? '↑' : v === 'center' ? '≡' : '↓'}
                </button>
              ))}
              <span className="wf-divider" />
            </div>
          )}
          {saveStatus && <span className="wf-status">{saveStatus}</span>}
          <div className="wf-fontsize">
            <button onClick={() => setLabelSize(s => Math.max(8, s - 1))} title="縮小字體">A−</button>
            <span className="wf-fontsize-val">{labelSize}</span>
            <button onClick={() => setLabelSize(s => Math.min(36, s + 1))} title="放大字體">A+</button>
          </div>
          <button
            onClick={() => setLiveMode(v => !v)}
            className={liveMode ? 'wf-live-btn active' : 'wf-live-btn'}
            title="監聽 /layouts/live.json 自動更新"
          >
            {liveMode ? '● Live' : '○ Live'}
          </button>
          <button onClick={loadLayout}>載入</button>
          <button onClick={saveLayout} className="wf-save">儲存</button>
          <button onClick={exportMd} className="wf-export">輸出</button>
          <button onClick={clearAll} className="wf-clear">清除</button>
        </div>
      </div>}

      <div className="wf-body">
        <div className="wf-canvas" ref={canvasRef}>
          <div
            className="wf-canvas-wrapper"
            ref={wrapperRef}
            onClick={addBlock}
            style={{ width: canvasW * zoom, height: canvasH * zoom }}
          >
            <div
              className="wf-canvas-inner"
              ref={designRef}
              style={{ transform: `scale(${zoom})`, transformOrigin: '0 0', width: canvasW, height: canvasH, '--label-size': `${labelSize}px` }}
            >
              {sortedBlocks.map(b => (
                b.type === 'frame' ? (
                  <div
                    key={b.id}
                    className={`wf-block frame${selected === b.id ? ' selected' : ''}`}
                    style={{ left: b.x, top: b.y, width: b.w, height: b.h }}
                  >
                    <div
                      className="wf-frame-header"
                      onMouseDown={(e) => { if (e.ctrlKey) startMove(e, b.id) }}
                      onDoubleClick={(e) => startEdit(e, b.id, b.label)}
                    >
                      {editingId === b.id ? (
                        <input
                          className="wf-frame-input"
                          value={editText}
                          autoFocus
                          onChange={e => setEditText(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={e => e.key === 'Enter' && commitEdit()}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : b.label}
                    </div>
                    <div className="wf-resize" onMouseDown={(e) => startResize(e, b.id)} />
                  </div>
                ) : (
                  <div
                    key={b.id}
                    className={`wf-block${selected === b.id ? ' selected' : ''}`}
                    style={{ left: b.x, top: b.y, width: b.w, height: b.h, ...VALIGN_STYLE[b.valign ?? 'center'] }}
                    onMouseDown={(e) => startMove(e, b.id)}
                    onDoubleClick={(e) => startEdit(e, b.id, b.label)}
                  >
                    {editingId === b.id ? (
                      <input
                        className="wf-input"
                        value={editText}
                        autoFocus
                        onChange={e => setEditText(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={e => e.key === 'Enter' && commitEdit()}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span className="wf-label">{b.label}</span>
                    )}
                    <div className="wf-resize" onMouseDown={(e) => startResize(e, b.id)} />
                  </div>
                )
              ))}
            </div>
          </div>
        </div>

        {showUI && <div className="wf-sidebar">
          <div className="wf-sidebar-section">
            <div className="wf-sidebar-title">縮放</div>
            <div className="wf-zoom-row">
              <button className="wf-zoom-btn" onClick={() => changeZoom(-0.1)}>−</button>
              <span className="wf-zoom-pct" onClick={() => { zoomRef.current = 1; setZoom(1) }} title="點擊重設為 100%">
                {Math.round(zoom * 100)}%
              </span>
              <button className="wf-zoom-btn" onClick={() => changeZoom(0.1)}>+</button>
            </div>
            <button className="wf-sidebar-btn" onClick={fitAll}>符合畫面</button>
          </div>

          <div className="wf-sidebar-divider" />

          <div className="wf-sidebar-section">
            <div className="wf-sidebar-title">插入視窗框</div>
            {PRESETS.map(p => (
              <button key={p.label} className="wf-sidebar-btn" onClick={() => insertFrame(p)}>
                <span>{p.label}</span>
                <span className="wf-preset-size">{p.w}×{p.h}</span>
              </button>
            ))}
          </div>

          <div className="wf-sidebar-divider" />

          <div className="wf-sidebar-section">
            <div className="wf-sidebar-title">匯出</div>
            <button className="wf-sidebar-btn wf-copy-btn" onClick={copySummary}>
              複製摘要
            </button>
            <div className="wf-sidebar-note">
              階層結構文字<br />省 Token、Claude 好讀
            </div>
          </div>
        </div>}
      </div>
    </div>
  )
}
