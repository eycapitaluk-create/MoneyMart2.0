/** Classify referrer domains / UTM into acquisition channels for admin CRM + analytics. */

import { isInternalReferrerDomain } from './crmInternalUsers'

const CHANNEL_META = {
  twitter: { id: 'twitter', label: 'X (Twitter)' },
  instagram: { id: 'instagram', label: 'Instagram' },
  facebook: { id: 'facebook', label: 'Facebook' },
  youtube: { id: 'youtube', label: 'YouTube' },
  note: { id: 'note', label: 'note.com' },
  line: { id: 'line', label: 'LINE' },
  email: { id: 'email', label: 'Email / newsletter' },
  user_share: { id: 'user_share', label: 'User share' },
  paid_search: { id: 'paid_search', label: 'Paid search' },
  utm_tagged: { id: 'utm_tagged', label: 'UTM tagged (other)' },
  smartnews: { id: 'smartnews', label: 'SmartNews' },
  google: { id: 'google', label: 'Google' },
  social: { id: 'social', label: 'Other social' },
  search_other: { id: 'search_other', label: 'Other search' },
  referral: { id: 'referral', label: 'Referral / media' },
  direct: { id: 'direct', label: 'Direct / no referrer' },
}

/**
 * utm_source aliases → channel. Tagged and untagged traffic from the same
 * channel must land in the same bucket, otherwise rolling out UTM tagging
 * looks like old channels vanishing and new ones appearing.
 */
const SOURCE_ALIASES = {
  x: 'twitter',
  'x.com': 'twitter',
  twitter: 'twitter',
  'twitter.com': 'twitter',
  't.co': 'twitter',
  ig: 'instagram',
  instagram: 'instagram',
  'instagram.com': 'instagram',
  fb: 'facebook',
  meta: 'facebook',
  facebook: 'facebook',
  'facebook.com': 'facebook',
  yt: 'youtube',
  youtube: 'youtube',
  'youtube.com': 'youtube',
  'youtu.be': 'youtube',
  note: 'note',
  'note.com': 'note',
  line: 'line',
  'line.me': 'line',
  newsletter: 'email',
  email: 'email',
  mail: 'email',
  smartnews: 'smartnews',
  google: 'google',
}

const DOMAIN_CHANNELS = [
  ['t.co', 'twitter'],
  ['twitter.com', 'twitter'],
  ['x.com', 'twitter'],
  ['instagram.com', 'instagram'],
  ['facebook.com', 'facebook'],
  ['youtube.com', 'youtube'],
  ['youtu.be', 'youtube'],
  ['note.com', 'note'],
  ['line.me', 'line'],
]

const OTHER_SOCIAL_HOSTS = ['linkedin.com', 'threads.net', 'discord.com', 'reddit.com']

const PAID_MEDIUMS = ['cpc', 'ppc', 'paid', 'paidsearch', 'paid_search', 'sem']

/** User pressed share / copy-link; the destination app is unknowable. */
const SHARE_MEDIUMS = ['copy_link', 'native_share']

export const REFERRER_CHANNEL_NOTES = {
  smartnews:
    'When users open MoneyMart from the SmartNews app or in-app browser, document.referrer is recorded as www.smartnews.com. '
    + 'Without UTM/ref tags we cannot tell which article or campaign drove the visit — add ?utm_source=smartnews&utm_medium=article (etc.) to shared links.',
}

function normalizeDomain(raw) {
  const s = String(raw || '').trim().toLowerCase()
  if (!s || s === '(direct / unknown)' || s === '(unknown)' || s === 'direct / none') return ''
  return s.replace(/^www\./, '')
}

export function isSmartNewsReferrerDomain(domain) {
  return normalizeDomain(domain).includes('smartnews')
}

export function classifyReferrerChannel({
  referrerDomain,
  utmSource,
  utmMedium,
  utmCampaign,
} = {}) {
  const utmSrc = String(utmSource || '').trim().toLowerCase()
  const utmMed = String(utmMedium || '').trim().toLowerCase()
  const utmCamp = String(utmCampaign || '').trim().toLowerCase()
  const domain = normalizeDomain(referrerDomain)

  if (utmSrc || utmMed || utmCamp) {
    if (utmSrc.includes('smartnews') || utmMed.includes('smartnews') || utmCamp.includes('smartnews')) {
      return { ...CHANNEL_META.smartnews, detail: 'UTM-tagged SmartNews link' }
    }
    const detail = [utmSource, utmMedium].filter(Boolean).join(' / ') || 'UTM present'
    const aliasKey = utmSrc.replace(/^www\./, '')
    const mapped = SOURCE_ALIASES[aliasKey]
    if (mapped === 'google') {
      return PAID_MEDIUMS.includes(utmMed)
        ? { ...CHANNEL_META.paid_search, detail }
        : { ...CHANNEL_META.google, detail }
    }
    if (mapped) return { ...CHANNEL_META[mapped], detail }
    // Shared by a user to an unknown destination — word of mouth, not Direct.
    if (SHARE_MEDIUMS.includes(utmMed)) return { ...CHANNEL_META.user_share, detail }
    if (utmMed === 'email') return { ...CHANNEL_META.email, detail }
    if (PAID_MEDIUMS.includes(utmMed)) return { ...CHANNEL_META.paid_search, detail }
    // `?ref=` shorthand lands here as ref / community / <ref value>.
    if (utmSrc === 'ref') {
      return { ...CHANNEL_META.referral, detail: utmCampaign || 'community ref link' }
    }
    return { ...CHANNEL_META.utm_tagged, detail }
  }

  const domainChannel = DOMAIN_CHANNELS.find(
    ([host]) => domain === host || domain.endsWith(`.${host}`),
  )
  if (domainChannel) {
    return { ...CHANNEL_META[domainChannel[1]], detail: domain }
  }

  if (domain.includes('smartnews')) {
    return {
      ...CHANNEL_META.smartnews,
      detail: 'In-app browser referrer (article/campaign unknown without UTM)',
    }
  }
  if (domain.includes('google.') || domain === 'google.com') {
    return { ...CHANNEL_META.google, detail: domain || 'google' }
  }

  if (OTHER_SOCIAL_HOSTS.some((host) => domain === host || domain.endsWith(`.${host}`))) {
    return { ...CHANNEL_META.social, detail: domain }
  }

  const searchHosts = ['bing.', 'yahoo.', 'duckduckgo.', 'baidu.', 'yandex.']
  if (searchHosts.some((host) => domain.includes(host))) {
    return { ...CHANNEL_META.search_other, detail: domain }
  }

  if (!domain) {
    return { ...CHANNEL_META.direct, detail: 'No referrer or UTM on first touch' }
  }

  return { ...CHANNEL_META.referral, detail: domain }
}

export function formatTrafficReferrerLabel(row) {
  const channel = classifyReferrerChannel({
    referrerDomain: row?.referrer_domain,
    utmSource: row?.utm_source,
    utmMedium: row?.utm_medium,
  })
  const raw = [row?.referrer_domain, row?.utm_source, row?.utm_medium].filter(Boolean).join(' · ')
    || '(direct / unknown)'
  return { channel, raw }
}

export function formatSignupReferrerKey(key) {
  const channel = classifyReferrerChannel({ referrerDomain: key })
  return { channel, raw: String(key || '').trim() || '(direct / unknown)' }
}

export function aggregateTrafficReferrerChannels(referrerRows) {
  const buckets = new Map()
  for (const row of referrerRows || []) {
    if (isInternalReferrerDomain(row?.referrer_domain)) continue
    const { channel } = formatTrafficReferrerLabel(row)
    const weight = Number(row?.sessions || row?.unique_sessions || row?.landing_views || row?.count || 0)
    if (!weight) continue
    const prev = buckets.get(channel.id) || { ...channel, count: 0 }
    prev.count += weight
    buckets.set(channel.id, prev)
  }
  return [...buckets.values()].sort((a, b) => b.count - a.count)
}

export function aggregateSignupReferrerChannels(rows) {
  const buckets = new Map()
  for (const row of rows || []) {
    const channel = classifyReferrerChannel({
      referrerDomain: row?.signup_referrer_domain,
      utmSource: row?.signup_utm_source,
      utmMedium: row?.signup_utm_medium,
      utmCampaign: row?.signup_utm_campaign,
    })
    const prev = buckets.get(channel.id) || { id: channel.id, label: channel.label, count: 0 }
    prev.count += 1
    buckets.set(channel.id, prev)
  }
  return [...buckets.values()].sort((a, b) => b.count - a.count)
}
