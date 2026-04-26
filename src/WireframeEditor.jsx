import { useState, useRef, useCallback, useEffect } from 'react'
import './WireframeEditor.css'
import { PRESETS, CANVAS_MIN_W, CANVAS_MIN_H, CANVAS_PAD, nextId, setNextId, resetNextId, generateFullDocument, downloadBlob, GRID } from './utils'
import { useDrag } from './hooks/useDrag'
import { useKeyboard } from './hooks/useKeyboard'
import { useZoom } from './hooks/useZoom'
import { useLiveMode } from './hooks/useLiveMode'
import { useSelectionBox } from './hooks/useSelectionBox'
import Block from './components/Block'

export default function WireframeEditor() {
  const [blocks, setBlocks] = useState([])
  const [selected, setSelected] = useState(null)
  const [multiSelected, setMultiSelected] = useState(new Set())
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const [layoutName, setLayoutName] = useState('wireframe')
  const [editingName, setEditingName] = useState(false)
  const [editNameText, setEditNameText] = useState('')
  const [showUI, setShowUI] = useState(true)
  const [liveMode, setLiveMode] = useState(false)
  const [labelSize, setLabelSize] = useState(13)

  const canvasRef = useRef(null)
  const designRef = useRef(null)
  const blocksRef = useRef([])
  const selectedRef = useRef(null)
  const editingIdRef = useRef(null)
  const clipboardRef = useRef(null)
  const historyRef = useRef([])
  const multiSelectedRef = useRef(new Set())

  useEffect(() => { blocksRef.current = blocks }, [blocks])
  useEffect(() => { selectedRef.current = selected }, [selected])
  useEffect(() => { editingIdRef.current = editingId }, [editingId])
  useEffect(() => { multiSelectedRef.current = multiSelected }, [multiSelected])

  const pushHistory = useCallback(() => {
    historyRef.current.push({ blocks: blocksRef.current, selected: selectedRef.current })
    if (historyRef.current.length > 50) historyRef.current.shift()
  }, [])

  const { zoom, zoomRef, changeZoom, resetZoom, fitAll } = useZoom(canvasRef)
  const { suppressNextClickRef, startMove, startResize } = useDrag(zoomRef, blocksRef, setBlocks, setSelected, pushHistory, editingIdRef, multiSelectedRef, setMultiSelected)
  const { selectionBox, onCanvasMouseDown } = useSelectionBox(zoomRef, designRef, blocksRef, suppressNextClickRef, setMultiSelected, setSelected)
  useKeyboard({ selected, editingId, editingName, historyRef, clipboardRef, pushHistory, setBlocks, setSelected, setShowUI, setLabelSize, multiSelected, setMultiSelected })
  useLiveMode(liveMode, setBlocks)

  const addBlock = useCallback((e) => {
    if (suppressNextClickRef.current) { suppressNextClickRef.current = false; return }
    if (e.target.closest('.wf-block:not(.frame)')) return
    const rect = designRef.current.getBoundingClientRect()
    const z = zoomRef.current
    const snap = v => Math.round(v / GRID) * GRID
    const x = snap((e.clientX - rect.left) / z)
    const y = snap((e.clientY - rect.top)  / z)
    const id = nextId()
    pushHistory()
    setMultiSelected(new Set())
    setBlocks(prev => [...prev, { id, label: 'Block', x: Math.max(0, x), y: Math.max(0, y), w: 160, h: 80, valign: 'center' }])
    setSelected(id)
  }, [pushHistory, suppressNextClickRef, zoomRef])

  const startEdit = useCallback((e, id, label) => {
    e.stopPropagation(); pushHistory(); setEditingId(id); setEditText(label)
  }, [pushHistory])

  const commitEdit = useCallback(() => {
    setBlocks(prev => prev.map(b => b.id === editingId ? { ...b, label: editText || 'Block' } : b))
    setEditingId(null)
  }, [editingId, editText])

  const setValign = useCallback((valign) => {
    pushHistory(); setBlocks(prev => prev.map(b => b.id === selected ? { ...b, valign } : b))
  }, [selected, pushHistory])

  const insertFrame = useCallback((preset) => {
    pushHistory()
    const id = nextId()
    setBlocks(prev => [...prev, { id, label: `${preset.label} ${preset.w}×${preset.h}`, x: 40, y: 40, w: preset.w, h: preset.h, valign: 'top', type: 'frame' }])
    setSelected(id)
    setMultiSelected(new Set())
    canvasRef.current?.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  }, [pushHistory])

  const saveLayout = useCallback(() => {
    downloadBlob(JSON.stringify(blocks, null, 2), `${layoutName}.json`, 'application/json')
    setSaveStatus('已儲存'); setTimeout(() => setSaveStatus(''), 2000)
  }, [blocks, layoutName])

  const exportMd = useCallback(() => {
    const today = new Date(); const d = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
    downloadBlob(generateFullDocument(blocks, layoutName), `${layoutName}-${d}.md`, 'text/markdown')
    setSaveStatus('已輸出'); setTimeout(() => setSaveStatus(''), 2000)
  }, [blocks, layoutName])

  const loadLayout = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.json'
    input.onchange = (e) => {
      const file = e.target.files[0]; if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        const data = JSON.parse(ev.target.result)
        setBlocks(data); setLayoutName(file.name.replace(/\.json$/, ''))
        setNextId(data.length ? Math.max(...data.map(b => b.id)) + 1 : 1)
        setSaveStatus('已載入'); setTimeout(() => setSaveStatus(''), 2000)
      }
      reader.readAsText(file)
    }
    input.click()
  }, [])

  const clearAll = useCallback(() => {
    if (!blocks.length) return
    pushHistory(); setBlocks([]); setSelected(null); setMultiSelected(new Set()); resetNextId()
  }, [blocks, pushHistory])

  const startEditName = useCallback(() => { setEditNameText(layoutName); setEditingName(true) }, [layoutName])
  const commitEditName = useCallback(() => { setLayoutName(editNameText.trim() || 'wireframe'); setEditingName(false) }, [editNameText])

  const selectedBlock = blocks.find(b => b.id === selected)
  const sortedBlocks = [...blocks].sort((a, b) => (b.type === 'frame' ? 1 : 0) - (a.type === 'frame' ? 1 : 0))
  const canvasW = blocks.length ? Math.max(CANVAS_MIN_W, ...blocks.map(b => b.x + b.w)) + CANVAS_PAD : CANVAS_MIN_W
  const canvasH = blocks.length ? Math.max(CANVAS_MIN_H, ...blocks.map(b => b.y + b.h)) + CANVAS_PAD : CANVAS_MIN_H

  return (
    <div className="wf-root">
      {!showUI && <button className="wf-ui-toggle" onClick={() => setShowUI(true)} title="顯示工具列 (`)">☰</button>}
      {showUI && <div className="wf-toolbar">
        <div className="wf-left">
          <span className="wf-hint">點擊畫布新增 · 拖拉框選多選 · Shift+拖拉鎖軸 · Ctrl+Shift+拖拉複製 · 雙擊改名 · Delete 刪除 · Ctrl+C 複製 · Ctrl+X 剪下 · Ctrl+V 貼上 · Ctrl+Z 復原 · Esc 取消選取</span>
        </div>
        <div className="wf-center">
          {editingName
            ? <input className="wf-name-input" value={editNameText} autoFocus onChange={e => setEditNameText(e.target.value)} onBlur={commitEditName} onKeyDown={e => e.key === 'Enter' && commitEditName()} />
            : <span className="wf-name" title="點擊編輯名稱" onClick={startEditName}>{layoutName}</span>}
        </div>
        <div className="wf-actions">
          {selectedBlock && selectedBlock.type !== 'frame' && multiSelected.size === 0 && (
            <div className="wf-valign">
              <span className="wf-valign-label">文字：</span>
              {['top', 'center', 'bottom'].map(v => (
                <button key={v} className={`wf-valign-btn${selectedBlock.valign === v ? ' active' : ''}`} onClick={() => setValign(v)}
                  title={v === 'top' ? '靠上' : v === 'center' ? '置中' : '靠下'}>
                  {v === 'top' ? '↑' : v === 'center' ? '≡' : '↓'}
                </button>
              ))}
              <span className="wf-divider" />
            </div>
          )}
          {multiSelected.size > 0 && (
            <span className="wf-multi-count">{multiSelected.size} 個已選取</span>
          )}
          {saveStatus && <span className="wf-status">{saveStatus}</span>}
          <div className="wf-fontsize">
            <button onClick={() => setLabelSize(s => Math.max(8, s - 1))} title="縮小字體">A−</button>
            <span className="wf-fontsize-val">{labelSize}</span>
            <button onClick={() => setLabelSize(s => Math.min(36, s + 1))} title="放大字體">A+</button>
          </div>
          <button onClick={() => setLiveMode(v => !v)} className={liveMode ? 'wf-live-btn active' : 'wf-live-btn'} title="監聽 /layouts/live.json 自動更新">
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
          <div className="wf-canvas-wrapper" onClick={addBlock} style={{ width: canvasW * zoom, height: canvasH * zoom }}>
            <div className="wf-canvas-inner" ref={designRef} onMouseDown={onCanvasMouseDown}
              style={{ transform: `scale(${zoom})`, transformOrigin: '0 0', width: canvasW, height: canvasH, '--label-size': `${labelSize}px` }}>
              {sortedBlocks.map(b => (
                <Block key={b.id} b={b} selected={selected} multiSelected={multiSelected} editingId={editingId} editText={editText}
                  setEditText={setEditText} commitEdit={commitEdit}
                  startMove={startMove} startResize={startResize} startEdit={startEdit} />
              ))}
              {selectionBox && (
                <div className="wf-selection-box" style={{
                  left: selectionBox.x,
                  top: selectionBox.y,
                  width: selectionBox.w,
                  height: selectionBox.h,
                }} />
              )}
            </div>
          </div>
        </div>

        {showUI && <div className="wf-sidebar">
          <div className="wf-sidebar-section">
            <div className="wf-sidebar-title">縮放</div>
            <div className="wf-zoom-row">
              <button className="wf-zoom-btn" onClick={() => changeZoom(-0.1)}>−</button>
              <span className="wf-zoom-pct" onClick={resetZoom} title="點擊重設為 100%">{Math.round(zoom * 100)}%</span>
              <button className="wf-zoom-btn" onClick={() => changeZoom(0.1)}>+</button>
            </div>
            <button className="wf-sidebar-btn" onClick={() => fitAll(blocks, canvasRef.current)}>符合畫面</button>
          </div>
          <div className="wf-sidebar-divider" />
          <div className="wf-sidebar-section">
            <div className="wf-sidebar-title">插入視窗框</div>
            {PRESETS.map(p => (
              <button key={p.label} className="wf-sidebar-btn" onClick={() => insertFrame(p)}>
                <span>{p.label}</span><span className="wf-preset-size">{p.w}×{p.h}</span>
              </button>
            ))}
          </div>
        </div>}
      </div>
    </div>
  )
}
