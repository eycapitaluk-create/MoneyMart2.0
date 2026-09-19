/** 手動ニュースの更新日表示に使う下限（null→Date(null)→1970年問題の除外） */
export const MIN_VALID_MANUAL_NEWS_MS = Date.UTC(2000, 0, 1)

export const isValidManualNewsTimestamp = (value) => {
  if (value == null || value === '') return false
  const t = new Date(value).getTime()
  return Number.isFinite(t) && t >= MIN_VALID_MANUAL_NEWS_MS
}

/** published_at / updated_at のうち有効なより新しいほうのエポック ms（どちらも無効なら 0） */
export const manualNewsRowRecencyMs = (publishedAt, updatedAt) => {
  let best = 0
  for (const ts of [publishedAt, updatedAt]) {
    if (!isValidManualNewsTimestamp(ts)) continue
    const t = new Date(ts).getTime()
    if (t > best) best = t
  }
  return best
}

/**
 * 見出し内の「2026年4月23日」「4月23日(木曜)」などの暦日表記を除く（一覧・要約の見やすさ用）。
 * 除去後が空になる場合は元文字列を返す。
 */
export const stripJapaneseCalendarPhrasesFromTitle = (title = '') => {
  const raw = String(title || '').trim()
  if (!raw) return ''
  let t = raw
  t = t.replace(/\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日(?:\s*[（(][^）)]*[）)])?/g, '')
  t = t.replace(/\d{1,2}\s*月\s*\d{1,2}\s*日(?:\s*[（(][^）)]*[）)])?/g, '')
  t = t.replace(/([:：])\s*の+/g, '$1')
  t = t.replace(/\s+/g, ' ').trim()
  return t || raw
}
