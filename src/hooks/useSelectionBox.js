import { useRef, useState, useCallback } from 'react'

export function useSelectionBox(zoomRef, designRef, blocksRef, suppressNextClickRef, setMultiSelected, setSelected) {
  const [selectionBox, setSelectionBox] = useState(null)
  const stateRef = useRef(null)
  const currentBoxRef = useRef(null)

  const onCanvasMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    if (e.target.closest('.wf-block')) return

    const rect = designRef.current.getBoundingClientRect()
    const z = zoomRef.current
    const startX = (e.clientX - rect.left) / z
    const startY = (e.clientY - rect.top) / z

    stateRef.current = { startX, startY, moved: false }

    const onMove = (ev) => {
      if (!stateRef.current) return
      const cx = (ev.clientX - rect.left) / z
      const cy = (ev.clientY - rect.top) / z
      const dx = cx - stateRef.current.startX
      const dy = cy - stateRef.current.startY

      if (!stateRef.current.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return
      stateRef.current.moved = true
      suppressNextClickRef.current = true

      const box = {
        x: Math.min(stateRef.current.startX, cx),
        y: Math.min(stateRef.current.startY, cy),
        w: Math.abs(dx),
        h: Math.abs(dy),
      }
      currentBoxRef.current = box
      setSelectionBox({ ...box })
    }

    const onUp = () => {
      if (stateRef.current?.moved && currentBoxRef.current) {
        const box = currentBoxRef.current
        const intersecting = blocksRef.current.filter(b =>
          b.x < box.x + box.w && b.x + b.w > box.x &&
          b.y < box.y + box.h && b.y + b.h > box.y
        )
        if (intersecting.length === 1) {
          setSelected(intersecting[0].id)
          setMultiSelected(new Set())
        } else if (intersecting.length > 1) {
          setMultiSelected(new Set(intersecting.map(b => b.id)))
          setSelected(null)
        } else {
          setMultiSelected(new Set())
          setSelected(null)
        }
      } else if (!stateRef.current?.moved) {
        setMultiSelected(new Set())
        setSelected(null)
      }
      stateRef.current = null
      currentBoxRef.current = null
      setSelectionBox(null)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [zoomRef, designRef, blocksRef, suppressNextClickRef, setMultiSelected, setSelected])

  return { selectionBox, onCanvasMouseDown }
}
