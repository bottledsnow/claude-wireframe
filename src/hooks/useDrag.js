import { useRef, useEffect } from 'react'
import { nextId, getAsciiSnap } from '../utils'

const snapV = (v, s) => Math.round(v / s) * s

export function useDrag(zoomRef, blocksRef, setBlocks, setSelected, pushHistory, editingIdRef, multiSelectedRef, setMultiSelected) {
  const dragRef = useRef(null)
  const suppressNextClickRef = useRef(false)

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragRef.current) return
      const { type, id, startMouseX, startMouseY, startBlock, startBlocks } = dragRef.current
      const z = zoomRef.current
      let dx = (e.clientX - startMouseX) / z
      let dy = (e.clientY - startMouseY) / z
      if (e.shiftKey && (type === 'move' || type === 'multi-move')) {
        if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0
      }
      const frame = blocksRef.current.find(b => b.type === 'frame')
      const { snapX, snapY } = getAsciiSnap(frame)
      if (type === 'multi-move') {
        setBlocks(prev => prev.map(b => {
          const sb = startBlocks[b.id]
          if (!sb) return b
          return { ...b, x: snapV(Math.max(0, sb.x + dx), snapX), y: snapV(Math.max(0, sb.y + dy), snapY) }
        }))
        return
      }
      setBlocks(prev => prev.map(b => {
        if (b.id !== id) return b
        if (type === 'move')   return { ...b, x: snapV(Math.max(0, startBlock.x + dx), snapX), y: snapV(Math.max(0, startBlock.y + dy), snapY) }
        if (type === 'resize') return { ...b, w: Math.max(snapX * 2, snapV(startBlock.w + dx, snapX)), h: Math.max(snapY * 2, snapV(startBlock.h + dy, snapY)) }
        return b
      }))
    }
    const onMouseUp = () => { if (dragRef.current) suppressNextClickRef.current = true; dragRef.current = null }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp) }
  }, [setBlocks, zoomRef])

  const startMove = (e, id) => {
    e.stopPropagation()
    if (editingIdRef.current) return
    const blocks = blocksRef.current

    if (e.ctrlKey && e.shiftKey) {
      const block = blocks.find(b => b.id === id); if (!block) return
      pushHistory()
      const newId = nextId()
      setBlocks(prev => [...prev, { ...block, id: newId }])
      setSelected(newId)
      setMultiSelected(new Set())
      dragRef.current = { type: 'move', id: newId, startMouseX: e.clientX, startMouseY: e.clientY, startBlock: { ...block } }
      return
    }

    const isInMulti = multiSelectedRef.current.has(id)

    if (isInMulti) {
      pushHistory()
      const startBlocks = {}
      multiSelectedRef.current.forEach(sid => {
        const b = blocks.find(bb => bb.id === sid)
        if (b) startBlocks[sid] = { ...b }
      })
      dragRef.current = { type: 'multi-move', id, startMouseX: e.clientX, startMouseY: e.clientY, startBlocks }
    } else {
      setMultiSelected(new Set())
      setSelected(id)
      const block = blocks.find(b => b.id === id)
      pushHistory()
      dragRef.current = { type: 'move', id, startMouseX: e.clientX, startMouseY: e.clientY, startBlock: { ...block } }
    }
  }

  const startResize = (e, id) => {
    e.stopPropagation()
    const block = blocksRef.current.find(b => b.id === id)
    pushHistory()
    dragRef.current = { type: 'resize', id, startMouseX: e.clientX, startMouseY: e.clientY, startBlock: { ...block } }
  }

  return { suppressNextClickRef, startMove, startResize }
}
