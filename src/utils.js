export const VALIGN_STYLE = {
  top:    { alignItems: 'flex-start', paddingTop: 6 },
  center: { alignItems: 'center' },
  bottom: { alignItems: 'flex-end', paddingBottom: 6 },
}

export const PRESETS = [
  { label: 'Desktop',  w: 1280, h: 720 },
  { label: 'Full HD',  w: 1920, h: 1080 },
  { label: 'Tablet',   w: 768,  h: 1024 },
  { label: 'Mobile',   w: 375,  h: 812 },
]

export const CANVAS_MIN_W = 1600
export const CANVAS_MIN_H = 900
export const CANVAS_PAD = 300

let _nextId = 1
export const nextId = () => _nextId++
export const setNextId = (n) => { _nextId = n }
export const resetNextId = () => { _nextId = 1 }

export function buildHierarchy(blocks) {
  const sorted = [...blocks].sort((a, b) => (b.w * b.h) - (a.w * a.h))
  const parentOf = {}, childrenOf = {}
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const p = sorted[i], c = sorted[j]
      if (!parentOf[c.id] && c.x >= p.x && c.y >= p.y &&
          c.x + c.w <= p.x + p.w && c.y + c.h <= p.y + p.h) {
        parentOf[c.id] = p.id
        ;(childrenOf[p.id] ??= []).push(c)
      }
    }
  }
  return { childrenOf, roots: sorted.filter(b => !parentOf[b.id]) }
}

export function generateLayoutMd(blocks, layoutName) {
  const frame = blocks.find(b => b.type === 'frame')
  const lines = [`# ${layoutName}`]
  if (!frame) {
    lines.push('viewport: none', '')
    for (const b of [...blocks].sort((a, b) => a.y - b.y || a.x - b.x))
      lines.push(`- "${b.label}"  x:${Math.round(b.x)} y:${Math.round(b.y)}  ${Math.round(b.w)}×${Math.round(b.h)}`)
    return lines.join('\n') + '\n'
  }
  lines.push(`viewport: ${frame.label}`, '')
  const { w: fW, h: fH } = frame
  const TOL = 10
  const inner = blocks.filter(b =>
    b.type !== 'frame' &&
    b.x >= frame.x - TOL && b.y >= frame.y - TOL &&
    b.x + b.w <= frame.x + fW + TOL && b.y + b.h <= frame.y + fH + TOL
  )
  if (!inner.length) { lines.push('(empty)'); return lines.join('\n') + '\n' }
  const rel = inner.map(b => ({
    id: b.id, label: b.label,
    rx: b.x - frame.x, ry: b.y - frame.y,
    w: b.w, h: b.h,
    wPct:   Math.round(b.w / fW * 100),
    hPct:   Math.round(b.h / fH * 100),
    topPct:  Math.round((b.y - frame.y) / fH * 100),
    leftPct: Math.round((b.x - frame.x) / fW * 100),
  }))
  const rowThreshold = fH * 0.05, assigned = new Set(), rows = []
  for (const b of [...rel].sort((a, b) => a.ry - b.ry)) {
    if (assigned.has(b.id)) continue
    const row = [b]; assigned.add(b.id)
    for (const other of rel)
      if (!assigned.has(other.id) && Math.abs(other.ry - b.ry) <= rowThreshold)
        { row.push(other); assigned.add(other.id) }
    rows.push(row.sort((a, b) => a.rx - b.rx))
  }
  for (const row of rows) {
    const avgTop = Math.round(row.reduce((s, b) => s + b.topPct, 0) / row.length)
    const avgH   = Math.round(row.reduce((s, b) => s + b.hPct,  0) / row.length)
    if (row.length === 1) {
      const b = row[0], lbl = b.label !== 'Block' ? `"${b.label}" ` : ''
      lines.push(b.wPct >= 70
        ? `- ${lbl}full-width bar   top:${b.topPct}%  height:${b.hPct}%`
        : `- ${lbl}block   left:${b.leftPct}%  top:${b.topPct}%  width:${b.wPct}%  height:${b.hPct}%`)
    } else {
      const wPcts = row.map(b => b.wPct)
      lines.push(Math.max(...wPcts) - Math.min(...wPcts) <= 15
        ? `- ${row.length} equal columns   top:${avgTop}%  height:${avgH}%`
        : `- columns [${row.map(b => b.label !== 'Block' ? `"${b.label}" ${b.wPct}%` : `${b.wPct}%`).join(' | ')}]   top:${avgTop}%  height:${avgH}%`)
    }
  }
  return lines.join('\n') + '\n'
}

export function downloadBlob(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  Object.assign(document.createElement('a'), { href: url, download: filename }).click()
  URL.revokeObjectURL(url)
}
