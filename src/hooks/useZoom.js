import { useState, useRef, useEffect, useCallback } from 'react'

export function useZoom(canvasRef) {
  const [zoom, setZoom] = useState(1)
  const zoomRef = useRef(1)
  useEffect(() => { zoomRef.current = zoom }, [zoom])

  useEffect(() => {
    const el = canvasRef.current
    const onWheel = (e) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const prevZoom = zoomRef.current
      const newZoom = parseFloat(Math.min(3, Math.max(0.1, prevZoom + (e.deltaY > 0 ? -0.1 : 0.1))).toFixed(2))
      const rect = el.getBoundingClientRect()
      const mouseScreenX = e.clientX - rect.left
      const mouseScreenY = e.clientY - rect.top
      const designX = (el.scrollLeft + mouseScreenX) / prevZoom
      const designY = (el.scrollTop  + mouseScreenY) / prevZoom
      zoomRef.current = newZoom; setZoom(newZoom)
      requestAnimationFrame(() => { el.scrollLeft = designX * newZoom - mouseScreenX; el.scrollTop = designY * newZoom - mouseScreenY })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [canvasRef])

  const changeZoom = useCallback((delta) => {
    const newZoom = parseFloat(Math.min(3, Math.max(0.1, zoomRef.current + delta)).toFixed(2))
    zoomRef.current = newZoom; setZoom(newZoom)
  }, [])

  const resetZoom = useCallback(() => { zoomRef.current = 1; setZoom(1) }, [])

  const fitAll = useCallback((blocks, canvasEl) => {
    if (!blocks.length) return
    const pad = 60
    const minX = Math.min(...blocks.map(b => b.x)), minY = Math.min(...blocks.map(b => b.y))
    const maxX = Math.max(...blocks.map(b => b.x + b.w)), maxY = Math.max(...blocks.map(b => b.y + b.h))
    const newZoom = parseFloat(Math.min(canvasEl.clientWidth / (maxX - minX + pad * 2), canvasEl.clientHeight / (maxY - minY + pad * 2), 1.5).toFixed(2))
    zoomRef.current = newZoom; setZoom(newZoom)
    setTimeout(() => canvasEl.scrollTo({ left: Math.max(0, (minX - pad) * newZoom), top: Math.max(0, (minY - pad) * newZoom), behavior: 'smooth' }), 50)
  }, [])

  return { zoom, zoomRef, changeZoom, resetZoom, fitAll }
}
