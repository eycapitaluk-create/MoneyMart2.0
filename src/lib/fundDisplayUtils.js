/**
 * Decodes HTML entities in plain-text labels (e.g. "S&amp;P" → "S&P").
 * For React text nodes only — do not use the result as HTML.
 */
export function decodeHtmlEntities(value = '') {
  const s = String(value ?? '')
  if (!s || !/&[#a-z0-9]+;/i.test(s)) return s
  if (typeof document !== 'undefined') {
    const el = document.createElement('textarea')
    el.innerHTML = s
    return el.value
  }
  return s
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x([0-9a-f]{1,6});/gi, (full, h) => {
      const code = parseInt(h, 16)
      if (!Number.isFinite(code) || code < 0) return full
      try {
        return String.fromCodePoint(code)
      } catch {
        return full
      }
    })
    .replace(/&#(\d{1,7});/g, (full, d) => {
      const code = parseInt(d, 10)
      if (!Number.isFinite(code) || code < 0) return full
      try {
        return String.fromCodePoint(code)
      } catch {
        return full
      }
    })
}

/**
 * Normalizes fund display names for consistent rendering.
 * - Decodes HTML entities (e.g. from DB/API)
 * - Converts full-width (zenkaku) alphanumeric to half-width to prevent "spaced apart" letters
 * - Joins single-letter tokens (e.g. "T O P I X" -> "TOPIX")
 */
export const normalizeFundDisplayName = (value = '') => {
  let s = decodeHtmlEntities(String(value || '').trim())
  if (!s) return ''
  // Full-width to half-width: U+FF01-FF5E -> U+0021-007E (prevents "ｉＳ" "ＴＯＰＩＸ" from rendering wide)
  s = s.replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
  s = s.normalize('NFKC').replace(/\s+/g, ' ').trim()
  // Join single-letter latin/digit tokens (e.g. "T O P I X" -> "TOPIX", "i S" -> "iS")
  return s.replace(/\b([A-Za-z0-9])\s+(?=[A-Za-z0-9]\b)/g, '$1')
}
