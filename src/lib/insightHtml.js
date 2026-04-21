import DOMPurify from 'dompurify'

/** Plain-text delimiter between thesis and rationale (legacy). */
export const INSIGHT_BODY_DELIM_PLAIN = '\n---\n'

/** Inserted in rich HTML mode between thesis and rationale (admin editor only). */
export const INSIGHT_SPLIT_HR = '<hr class="mm-insight-split" />'

export const INSIGHT_MAIN_SPLIT_HTML_RE = /<hr\b[^>]*\bclass\s*=\s*["'][^"']*\bmm-insight-split\b[^"']*["'][^>]*\/?>/i

const ALLOWED_INSIGHT_CLASSES = new Set([
  'insight-fs-sm',
  'insight-fs-lg',
  'insight-ff-sans',
  'insight-ff-serif',
  'insight-ff-mono',
  'mm-insight-split',
])

let sanitizeHooksInstalled = false

function installSanitizeHooks() {
  if (sanitizeHooksInstalled) return
  sanitizeHooksInstalled = true
  DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
    if (data.attrName === 'class') {
      const classes = String(data.attrValue || '')
        .split(/\s+/)
        .filter(Boolean)
      const filtered = classes.filter((c) => ALLOWED_INSIGHT_CLASSES.has(c))
      if (filtered.length) data.attrValue = filtered.join(' ')
      else data.keepAttr = false
    }
  })
}

/** True if string likely contains HTML tags (not e.g. "a < b"). */
export function looksLikeInsightHtml(s) {
  return /<\/?[a-z][a-z0-9]*\b/i.test(String(s || ''))
}

export function sanitizeInsightBodyHtml(dirty) {
  installSanitizeHooks()
  return DOMPurify.sanitize(String(dirty || ''), {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ol', 'ul', 'li', 'span', 'h2', 'h3', 'h4', 'a', 'div', 'blockquote',
      'img', 'hr',
    ],
    ALLOWED_ATTR: ['class', 'href', 'target', 'rel', 'src', 'alt', 'width', 'height', 'loading', 'decoding'],
    ALLOW_DATA_ATTR: false,
    // 先頭1文字だけ許可するデフォルト正規表現だと `/path/to` の2文字目以降で落ちるケースを防ぐ
    ALLOWED_URI_REGEXP:
      /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):[^\s#]*|\/(?!\/)#?[^\s#?]*(?:\?[^\s#]*)?(?:#[^\s#]*)?|[^a-z#?]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  })
}

export function plainTextFromInsightHtml(s) {
  const str = String(s || '')
  if (!str.trim()) return ''
  if (!looksLikeInsightHtml(str)) return str.replace(/\r\n?/g, '\n').trim()
  const clean = sanitizeInsightBodyHtml(str)
  if (typeof document !== 'undefined') {
    const div = document.createElement('div')
    div.innerHTML = clean
    return String(div.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
  }
  return clean.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function isEmptyInsightBodyHtml(s) {
  const t = String(s || '').trim()
  if (!t) return true
  if (!looksLikeInsightHtml(t)) return false
  // 画像のみのブロックはテキストが空でも「空」にしない（保存時に本文が消えるのを防ぐ）
  if (/<img\b/i.test(t)) return false
  return !plainTextFromInsightHtml(t)
}

export function splitInsightMainCombined(raw) {
  const text = String(raw ?? '').replace(/\r\n?/g, '\n')
  if (!text.trim()) return { idea: '', rationale: '' }
  const parts = text.split(INSIGHT_MAIN_SPLIT_HTML_RE)
  if (parts.length >= 2) {
    return {
      idea: parts[0].trim(),
      rationale: parts.slice(1).join('').trim(),
    }
  }
  const legacy = text.split(/\n---\s*\n/)
  const idea = String(legacy[0] ?? '').trim()
  const rationale = legacy.length > 1 ? legacy.slice(1).join('\n---\n').trim() : ''
  return { idea, rationale }
}

export function joinInsightMainCombined(idea, rationale) {
  const ideaT = String(idea ?? '').trim()
  const ratT = String(rationale ?? '').trim()
  if (!ideaT && !ratT) return ''
  if (ideaT && !ratT) return String(idea ?? '').trimEnd()
  if (!ideaT && ratT) return String(rationale ?? '').trimStart()
  const isHtml = looksLikeInsightHtml(ideaT) || looksLikeInsightHtml(ratT)
  if (isHtml) {
    return `${String(idea ?? '').trimEnd()}${INSIGHT_SPLIT_HR}${String(rationale ?? '').trimStart()}`
  }
  return `${ideaT}${INSIGHT_BODY_DELIM_PLAIN}${ratT}`
}
