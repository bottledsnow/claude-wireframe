import { VALIGN_STYLE } from '../utils'

export default function Block({ b, selected, editingId, editText, setEditText, commitEdit, startMove, startResize, startEdit }) {
  const isEditing = editingId === b.id
  const editInput = (className) => (
    <input className={className} value={editText} autoFocus
      onChange={e => setEditText(e.target.value)}
      onBlur={commitEdit}
      onKeyDown={e => e.key === 'Enter' && commitEdit()}
      onClick={e => e.stopPropagation()} />
  )

  if (b.type === 'frame') return (
    <div className={`wf-block frame${selected === b.id ? ' selected' : ''}`}
      style={{ left: b.x, top: b.y, width: b.w, height: b.h }}>
      <div className="wf-frame-header"
        onMouseDown={e => e.ctrlKey && startMove(e, b.id)}
        onDoubleClick={e => startEdit(e, b.id, b.label)}>
        {isEditing ? editInput('wf-frame-input') : b.label}
      </div>
      <div className="wf-resize" onMouseDown={e => startResize(e, b.id)} />
    </div>
  )

  return (
    <div className={`wf-block${selected === b.id ? ' selected' : ''}`}
      style={{ left: b.x, top: b.y, width: b.w, height: b.h, ...VALIGN_STYLE[b.valign ?? 'center'] }}
      onMouseDown={e => startMove(e, b.id)}
      onDoubleClick={e => startEdit(e, b.id, b.label)}>
      {isEditing ? editInput('wf-input') : <span className="wf-label">{b.label}</span>}
      <div className="wf-resize" onMouseDown={e => startResize(e, b.id)} />
    </div>
  )
}
