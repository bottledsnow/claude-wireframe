export const ASCII_COLS = 60
export const asciiRows = (vW, vH) =>
  Math.min(40, Math.max(6, Math.round(ASCII_COLS * (vH / vW) * 0.5)))
export const getAsciiSnap = frame => {
  if (!frame) return { snapX: 20, snapY: 20 }
  const rows = asciiRows(frame.w, frame.h)
  return {
    snapX: Math.max(1, Math.round(frame.w / ASCII_COLS)),
    snapY: Math.max(1, Math.round(frame.h / rows)),
  }
}

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

// ── 低階：畫一張 ASCII 方塊圖 ──────────────────────────────
function drawAscii(viewport, innerBlocks) {
  const COLS = ASCII_COLS
  const { w: vW, h: vH, x: vX = 0, y: vY = 0 } = viewport
  const ROWS = asciiRows(vW, vH)
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(' '))

  const toCol = px => Math.min(COLS - 1, Math.max(0, Math.round(px / vW * (COLS - 1))))
  const toRow = py => Math.min(ROWS - 1, Math.max(0, Math.round(py / vH * (ROWS - 1))))

  const BOX_DIRS = {
    '─': [1,1,0,0], '│': [0,0,1,1],
    '┌': [0,1,0,1], '┐': [1,0,0,1], '└': [0,1,1,0], '┘': [1,0,1,0],
    '├': [0,1,1,1], '┤': [1,0,1,1], '┬': [1,1,0,1], '┴': [1,1,1,0], '┼': [1,1,1,1],
  }
  const FROM_DIRS = {}
  for (const [ch, d] of Object.entries(BOX_DIRS)) FROM_DIRS[d.join('')] = ch
  const put = (r, c, ch) => {
    const ex = grid[r][c]
    if (ex === ' ') { grid[r][c] = ch; return }
    const a = BOX_DIRS[ex], b = BOX_DIRS[ch]
    grid[r][c] = (a && b) ? (FROM_DIRS[[a[0]|b[0],a[1]|b[1],a[2]|b[2],a[3]|b[3]].join('')] ?? ch) : ch
  }

  const drawBox = (r1, c1, r2, c2, label) => {
    if (c2 <= c1 || r2 <= r1) return
    for (let c = c1 + 1; c < c2; c++) { put(r1, c, '─'); put(r2, c, '─') }
    for (let r = r1 + 1; r < r2; r++) { put(r, c1, '│'); put(r, c2, '│') }
    put(r1, c1, '┌'); put(r1, c2, '┐')
    put(r2, c1, '└'); put(r2, c2, '┘')
    const midR = Math.round((r1 + r2) / 2)
    const innerW = c2 - c1 - 1
    if (innerW > 0 && label) {
      const text = label.length > innerW ? label.slice(0, innerW - 1) + '…' : label
      const startC = c1 + 1 + Math.floor((innerW - text.length) / 2)
      for (let i = 0; i < text.length; i++) grid[midR][startC + i] = text[i]
    }
  }

  drawBox(0, 0, ROWS - 1, COLS - 1, '')
  for (const b of [...innerBlocks].sort((a, b) => (b.w * b.h) - (a.w * a.h))) {
    drawBox(
      Math.max(1, toRow(b.y - vY)),
      Math.max(1, toCol(b.x - vX)),
      Math.min(ROWS - 2, toRow(b.y - vY + b.h)),
      Math.min(COLS - 2, toCol(b.x - vX + b.w)),
      b.label
    )
  }
  return grid.map(row => row.join('')).join('\n')
}

// ── 低階：產生區塊的文字描述 ────────────────────────────────
function blockDesc(b, parentW, parentH, parentX = 0, parentY = 0) {
  const wPct  = Math.round(b.w / parentW * 100)
  const hPct  = Math.round(b.h / parentH * 100)
  const topPct  = Math.round((b.y - parentY) / parentH * 100)
  const leftPct = Math.round((b.x - parentX) / parentW * 100)
  const parts = []
  parts.push(wPct >= 90 ? 'full-width' : `width: ${wPct}%`)
  parts.push(`height: ${hPct}%`)
  if (topPct > 0)  parts.push(`top: ${topPct}%`)
  if (leftPct > 0 && wPct < 90) parts.push(`left: ${leftPct}%`)
  return `${b.label.padEnd(14)}${parts.join('  ')}`
}

// ── 公開：單張 ASCII（原有功能保留）────────────────────────
export function generateLayoutAscii(blocks, layoutName) {
  const frame = blocks.find(b => b.type === 'frame')
  if (!frame) return '(no frame — add a viewport frame first)\n'
  const TOL = 10
  const inner = blocks.filter(b => b.type !== 'frame' &&
    b.x >= frame.x - TOL && b.y >= frame.y - TOL &&
    b.x + b.w <= frame.x + frame.w + TOL && b.y + b.h <= frame.y + frame.h + TOL)
  return [`# ${layoutName}`, '', drawAscii(frame, inner)].join('\n') + '\n'
}

// ── 公開：整體 + 分區完整文件 ──────────────────────────────
export function generateFullDocument(blocks, layoutName) {
  const frame = blocks.find(b => b.type === 'frame')
  if (!frame) return '(no frame — add a viewport frame first)\n'

  const { childrenOf } = buildHierarchy(blocks)
  const topLevel = (childrenOf[frame.id] || []).sort((a, b) => a.y - b.y || a.x - b.x)
  if (!topLevel.length) return `# ${layoutName}\n\n(frame is empty)\n`

  const lines = [
    `# ${layoutName}`,
    '',
    `> 環境：${frame.label}  ${frame.w}×${frame.h}`,
    '',
    '---',
    '',
    '## 整體架構',
    '',
    drawAscii(frame, topLevel),
    '',
  ]

  for (const b of topLevel)
    lines.push(blockDesc(b, frame.w, frame.h, frame.x, frame.y))

  for (const b of topLevel) {
    const children = (childrenOf[b.id] || []).sort((a, c) => a.y - c.y || a.x - c.x)
    if (!children.length) continue
    lines.push('', '---', '', `## ${b.label}`, '', drawAscii(b, children), '')
    for (const c of children)
      lines.push(blockDesc(c, b.w, b.h, b.x, b.y))
  }

  return lines.join('\n') + '\n'
}

export function downloadBlob(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  Object.assign(document.createElement('a'), { href: url, download: filename }).click()
  URL.revokeObjectURL(url)
}
