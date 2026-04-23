import { useRef, useEffect } from 'react'
import { nextId } from '../utils'

const GRID = 20
const snap = v => Math.round(v / GRID) * GRID

export function useDrag(zoomRef, blocksRef, setBlocks, setSelected, pushHistory, editingIdRef) {
  const dragRef = useRef(null)
  const suppressNextClickRef = useRef(false)

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragRef.current) return
      const { type, id, startMouseX, startMouseY, startBlock } = dragRef.current
      const z = zoomRef.current
      let dx = (e.clientX - startMouseX) / z
      let dy = (e.clientY - startMouseY) / z
      if (e.shiftKey && type === 'move') {
        if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0
      }
      setBlocks(prev => prev.map(b => {
        if (b.id !== id) return b
        if (type === 'move')   return { ...b, x: snap(Math.max(0, startBlock.x + dx)), y: snap(Math.max(0, startBlock.y + dy)) }
        if (type === 'resize') return { ...b, w: Math.max(GRID * 4, snap(startBlock.w + dx)), h: Math.max(GRID * 2, snap(startBlock.h + dy)) }
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
      dragRef.current = { type: 'move', id: newId, startMouseX: e.clientX, startMouseY: e.clientY, startBlock: { ...block } }
      return
    }
    setSelected(id)
    const block = blocks.find(b => b.id === id)
    pushHistory()
    dragRef.current = { type: 'move', id, startMouseX: e.clientX, startMouseY: e.clientY, startBlock: { ...block } }
  }

  const startResize = (e, id) => {
    e.stopPropagation()
    const block = blocksRef.current.find(b => b.id === id)
    pushHistory()
    dragRef.current = { type: 'resize', id, startMouseX: e.clientX, startMouseY: e.clientY, startBlock: { ...block } }
  }

  return { suppressNextClickRef, startMove, startResize }
}
