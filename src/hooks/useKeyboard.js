import { useEffect } from 'react'
import { nextId } from '../utils'

export function useKeyboard({ selected, editingId, editingName, historyRef, clipboardRef, pushHistory, setBlocks, setSelected, setShowUI, setLabelSize }) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (editingId || editingName) return

      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        pushHistory(); setBlocks(prev => prev.filter(b => b.id !== selected)); setSelected(null); return
      }
      if (e.key === 'c' && (e.ctrlKey || e.metaKey) && selected) {
        e.preventDefault(); pushHistory()
        setBlocks(prev => {
          const src = prev.find(b => b.id === selected); if (!src) return prev
          const newId = nextId(); setSelected(newId)
          return [...prev, { ...src, id: newId, x: src.x + 20, y: src.y + 20 }]
        }); return
      }
      if (e.key === 'x' && (e.ctrlKey || e.metaKey) && selected) {
        e.preventDefault(); pushHistory()
        setBlocks(prev => {
          const src = prev.find(b => b.id === selected); if (!src) return prev
          clipboardRef.current = { ...src }
          return prev.filter(b => b.id !== selected)
        }); setSelected(null); return
      }
      if (e.key === 'v' && (e.ctrlKey || e.metaKey) && clipboardRef.current) {
        e.preventDefault(); pushHistory()
        const src = clipboardRef.current, newId = nextId()
        setBlocks(prev => [...prev, { ...src, id: newId, x: src.x + 20, y: src.y + 20 }])
        setSelected(newId); return
      }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault()
        const snap = historyRef.current.pop(); if (!snap) return
        setBlocks(snap.blocks); setSelected(snap.selected); return
      }
      if (e.key === '`') { setShowUI(v => !v); return }
      if (selected && '123'.includes(e.key)) {
        const map = { '1': 'top', '2': 'center', '3': 'bottom' }
        pushHistory(); setBlocks(prev => prev.map(b => b.id === selected ? { ...b, valign: map[e.key] } : b)); return
      }
      if (e.key === '4') setLabelSize(s => Math.max(8, s - 1))
      if (e.key === '5') setLabelSize(s => Math.min(36, s + 1))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selected, editingId, editingName, historyRef, clipboardRef, pushHistory, setBlocks, setSelected, setShowUI, setLabelSize])
}
