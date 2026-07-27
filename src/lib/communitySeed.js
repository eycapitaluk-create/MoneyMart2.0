/** Internal markers embedded in seeded community posts (hidden from UI) */
export const COMMUNITY_SEED_MARKER = 'mm-community-seed-v1'
export const COMMUNITY_SEED_MARKER_JULY4 = 'mm-community-seed-july4-v1'

const SEED_MARKER_RE = /mm-community-seed[\w-]*/i
const SEED_HTML_COMMENT_RE = /<!--\s*mm-community-seed[\w-]*\s*-->/gi
const SEED_ONLY_LINE_RE = /^\s*mm-community-seed[\w-]*\s*$/gim
const SEED_INLINE_RE = /\s*mm-community-seed[\w-]*\s*/gi
const SEED_TAG_PREFIX = '_seed:'

export function containsCommunitySeedMarker(content = '') {
  return SEED_MARKER_RE.test(String(content ?? ''))
}

/** Hide internal seed tag from post body shown in the UI */
export function stripCommunitySeedMarker(content = '') {
  let text = String(content ?? '')
  if (!containsCommunitySeedMarker(text)) return text

  text = text.replace(SEED_HTML_COMMENT_RE, '')
  text = text.replace(SEED_ONLY_LINE_RE, '')
  text = text.replace(SEED_INLINE_RE, ' ')
  text = text.replace(/[ \t]+\n/g, '\n')
  text = text.replace(/\n{3,}/g, '\n\n')
  return text.replace(/\s+$/, '').trim()
}

/** Hide internal `_seed:…` / seed-marker tags from UI chip lists */
export function filterPublicCommunityTags(tags = []) {
  return (tags || []).filter((tag) => {
    const t = String(tag || '').trim()
    if (!t) return false
    const lower = t.toLowerCase()
    if (lower.startsWith(SEED_TAG_PREFIX)) return false
    if (lower.includes('mm-community-seed')) return false
    if (lower.includes('<!--') || lower.includes('-->')) return false
    if (SEED_MARKER_RE.test(t)) return false
    return true
  })
}

export function getCommunityPostTitle(post = {}) {
  const strippedContent = stripCommunitySeedMarker(post.content || '')
  const strippedTitle = stripCommunitySeedMarker(post.title || '')
  if (strippedTitle) return strippedTitle
  const firstLine = strippedContent.split('\n').find((line) => line.trim())
  return (firstLine || 'コミュニティ投稿').slice(0, 80)
}

export function getCommunityPostBody(post = {}) {
  return stripCommunitySeedMarker(post.displayContent || post.content || '')
}
