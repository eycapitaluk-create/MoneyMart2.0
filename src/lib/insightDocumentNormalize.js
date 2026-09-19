/**
 * insight_articles.document は管理画面や過去データで形がぶれることがある。
 * 表示側で必ず正規化し、React レンダー中の TypeError（例: 文字列に .map）を防ぐ。
 */

function normalizeTitleLineSegments(line) {
  if (Array.isArray(line)) {
    return line
      .map((seg) => {
        if (seg && typeof seg === 'object' && !Array.isArray(seg)) {
          return { text: String(seg.text ?? ''), accent: seg.accent }
        }
        return { text: String(seg ?? ''), accent: undefined }
      })
      .filter((s) => String(s.text || '').trim().length > 0)
  }
  if (line && typeof line === 'object' && !Array.isArray(line) && 'text' in line) {
    const t = String(line.text ?? '').trim()
    return t ? [{ text: t, accent: line.accent }] : []
  }
  const s = String(line ?? '').trim()
  return s ? [{ text: s, accent: undefined }] : []
}

export function normalizeInsightTitleLines(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((line) => normalizeTitleLineSegments(line))
    .filter((segments) => segments.length > 0)
}

export function normalizeInsightTicker(raw) {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    if (!item || typeof item !== 'object') {
      return { label: '', value: '', change: '', up: true }
    }
    return {
      label: String(item.label ?? ''),
      value: String(item.value ?? ''),
      change: String(item.change ?? ''),
      up: item.up !== false,
    }
  })
}

function normalizeCompareRows(rows) {
  if (!Array.isArray(rows)) return []
  return rows.map((row) => {
    if (Array.isArray(row)) {
      return [
        row[0] == null ? '' : String(row[0]),
        row[1] == null ? '' : String(row[1]),
      ]
    }
    if (row && typeof row === 'object' && ('left' in row || 'right' in row)) {
      return [String(row.left ?? ''), String(row.right ?? '')]
    }
    const s = row == null ? '' : String(row)
    return [s, '']
  })
}

function normalizeSectionBlock(block) {
  if (!block || typeof block !== 'object') return null
  const type = String(block.type || '').trim()
  if (!type) return null
  if (type === 'compare') {
    return { ...block, type: 'compare', rows: normalizeCompareRows(block.rows) }
  }
  if (type === 'prose') {
    const paras = block.paragraphs
    const paragraphs = Array.isArray(paras)
      ? paras.map((p) => (p == null ? '' : typeof p === 'string' ? p : String(p)))
      : []
    return { ...block, type: 'prose', paragraphs }
  }
  if (type === 'assets') {
    const items = Array.isArray(block.items)
      ? block.items.map((asset) => (asset && typeof asset === 'object' ? asset : null)).filter(Boolean)
      : []
    return { ...block, type: 'assets', items }
  }
  if (type === 'timeline') {
    const items = Array.isArray(block.items)
      ? block.items.map((it) => (it && typeof it === 'object' ? it : null)).filter(Boolean)
      : []
    return { ...block, type: 'timeline', items }
  }
  return { ...block, type }
}

/**
 * @param {unknown} doc raw document object
 * @returns {Record<string, unknown>} safe shallow-ish clone for render
 */
export function normalizeInsightDocumentForRender(doc) {
  const d = doc && typeof doc === 'object' && !Array.isArray(doc) ? { ...doc } : {}
  const heroRaw = d.hero && typeof d.hero === 'object' && !Array.isArray(d.hero) ? { ...d.hero } : {}
  let meta = heroRaw.meta
  if (meta != null && !Array.isArray(meta)) {
    meta = [String(meta)]
  }
  const hero = {
    ...heroRaw,
    titleLines: normalizeInsightTitleLines(heroRaw.titleLines),
    meta: Array.isArray(meta) ? meta.map((m) => String(m ?? '')).filter(Boolean) : [],
  }
  const sections = Array.isArray(d.sections)
    ? d.sections.map(normalizeSectionBlock).filter(Boolean)
    : []
  return {
    ...d,
    hero,
    ticker: normalizeInsightTicker(d.ticker),
    sections,
    footer: d.footer && typeof d.footer === 'object' && !Array.isArray(d.footer) ? { ...d.footer } : {},
  }
}
