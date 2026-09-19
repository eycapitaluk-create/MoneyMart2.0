const DEFAULT_ORIGIN = 'https://www.moneymart.co.jp'

/**
 * Canonical utm_source values. These must stay in sync with SOURCE_ALIASES in
 * referrerBuckets.js — a source spelled off-registry ("X", "insta") still gets
 * captured, but falls into the "UTM tagged (other)" bucket instead of its own
 * channel, which is exactly the blind spot tagging is meant to remove.
 */
export const UTM_SOURCES = [
  { source: 'twitter', medium: 'social', label: 'X (Twitter)' },
  { source: 'instagram', medium: 'social', label: 'Instagram' },
  { source: 'facebook', medium: 'social', label: 'Facebook' },
  { source: 'youtube', medium: 'social', label: 'YouTube' },
  { source: 'note', medium: 'article', label: 'note.com' },
  { source: 'line', medium: 'social', label: 'LINE' },
  { source: 'smartnews', medium: 'article', label: 'SmartNews' },
  { source: 'newsletter', medium: 'email', label: 'Email / newsletter' },
  { source: 'google', medium: 'cpc', label: 'Google Ads' },
]

const SOURCE_BY_KEY = new Map(UTM_SOURCES.map((s) => [s.source, s]))

export function isCanonicalUtmSource(source) {
  return SOURCE_BY_KEY.has(String(source || '').trim().toLowerCase())
}

/**
 * Build a tracked MoneyMart URL for social / community / ads.
 * @example appendUtm('/premium', { source: 'instagram', medium: 'social', campaign: 'profile_link' })
 */
export function appendUtm(pathOrUrl, {
  source = '',
  medium = '',
  campaign = '',
  term = '',
  content = '',
  ref = '',
  origin = DEFAULT_ORIGIN,
} = {}) {
  const base = String(pathOrUrl || '/').startsWith('http')
    ? String(pathOrUrl)
    : `${String(origin).replace(/\/$/, '')}/${String(pathOrUrl || '/').replace(/^\//, '')}`
  const url = new URL(base)
  const set = (k, v) => {
    const s = String(v || '').trim()
    if (s) url.searchParams.set(k, s)
  }
  set('utm_source', source)
  set('utm_medium', medium)
  set('utm_campaign', campaign)
  set('utm_term', term)
  set('utm_content', content)
  if (ref && !source) set('ref', ref)
  return url.toString()
}

/**
 * Build a link from the canonical registry so medium never has to be typed by
 * hand. `content` separates placements within one campaign (bio vs pinned post).
 */
export function buildUtmLink({
  source,
  path = '/',
  campaign = '',
  content = '',
  medium = '',
  origin = DEFAULT_ORIGIN,
} = {}) {
  const key = String(source || '').trim().toLowerCase()
  const known = SOURCE_BY_KEY.get(key)
  return appendUtm(path, {
    source: key,
    medium: medium || known?.medium || 'referral',
    campaign,
    content,
    origin,
  })
}

/** Copy-paste examples for ops / marketing. */
export const UTM_LINK_EXAMPLES = [
  {
    label: 'X (Twitter) — bio link',
    url: buildUtmLink({ source: 'twitter', campaign: 'bio_link' }),
  },
  {
    label: 'X (Twitter) — reply / post',
    url: buildUtmLink({ source: 'twitter', campaign: 'reply_strategy', content: 'post' }),
  },
  {
    label: 'note.com — article footer',
    url: buildUtmLink({ source: 'note', campaign: 'replace_with_article_slug' }),
  },
  {
    label: 'Instagram — profile link',
    url: buildUtmLink({ source: 'instagram', campaign: 'profile_link' }),
  },
  {
    label: 'YouTube — video description',
    url: buildUtmLink({ source: 'youtube', campaign: 'replace_with_video_slug' }),
  },
  {
    label: 'SmartNews — article / in-app link',
    url: buildUtmLink({ source: 'smartnews', campaign: 'replace_with_article_slug' }),
  },
  {
    label: 'Premium LP — newsletter',
    url: buildUtmLink({ source: 'newsletter', path: '/premium', campaign: 'premium_launch' }),
  },
  {
    label: 'Community share (ref fallback, no UTM handy)',
    url: appendUtm('/signup', { ref: 'community_x' }),
  },
]
