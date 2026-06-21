/**
 * Admin「Keywords」入力 → document.admin.keywords 配列。
 * カンマ・読点・改行に加え、スペース区切り（#タグ列など）も個別キーワードに分割する。
 */
export function parseInsightKeywordsText(value) {
  const raw = String(value || '').trim()
  if (!raw) return []

  const parts = raw
    .split(/[,、\n]/g)
    .map((item) => item.trim())
    .filter(Boolean)

  const out = []
  for (const part of parts) {
    if (!/\s/.test(part)) {
      out.push(part)
      continue
    }
    const tokens = part.split(/\s+/).map((t) => t.trim()).filter(Boolean)
    if (tokens.length > 1) out.push(...tokens)
    else out.push(part)
  }

  const seen = new Set()
  return out.filter((kw) => {
    const k = String(kw || '').trim()
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** 表示側: 保存済み keywords が1要素に連結されている古いデータも展開 */
export function normalizeInsightKeywordList(keywords) {
  if (!Array.isArray(keywords)) return []
  return parseInsightKeywordsText(
    keywords.map((k) => String(k || '').trim()).filter(Boolean).join('\n'),
  )
}
