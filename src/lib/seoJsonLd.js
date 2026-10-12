/**
 * Shared schema.org builders for SPA Helmet and Vercel SSR.
 * Facts only: legal entity, support mailbox, address, public social URLs.
 * Do not add ratings, review counts, Premium prices, or invented credentials.
 */
import {
  COMPANY_ADDRESS,
  COMPANY_NAME_EN,
  COMPANY_NAME_JA,
  COMPANY_SUPPORT_EMAIL,
} from '../constants/companyLegal.js'

export const EDITORIAL_AUTHOR_NAME = 'MoneyMart 編集部'
export const SITE_NAME = 'MoneyMart'
export const SOCIAL_SAME_AS = [
  'https://x.com/moneymartjp',
  'https://www.instagram.com/moneymart.insights/',
]

function originOf(origin) {
  return String(origin || 'https://www.moneymart.co.jp').replace(/\/$/, '')
}

/** Parse the published company address string into PostalAddress parts. */
export function companyPostalAddress() {
  const raw = String(COMPANY_ADDRESS || '').trim()
  const m = raw.match(/^〒?\s*(\d{3}-?\d{4})\s+(.+)$/)
  const postalCode = m ? m[1] : ''
  const rest = m ? m[2] : raw
  const regionMatch = rest.match(/^(東京都|北海道|(?:京都|大阪)府|.{2,3}県)(.+)$/)
  return {
    '@type': 'PostalAddress',
    postalCode: postalCode || undefined,
    addressRegion: regionMatch ? regionMatch[1] : undefined,
    streetAddress: regionMatch ? regionMatch[2].trim() : rest,
    addressCountry: 'JP',
  }
}

export function organizationJsonLd(origin) {
  const base = originOf(origin)
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    legalName: COMPANY_NAME_JA,
    alternateName: COMPANY_NAME_EN,
    url: `${base}/`,
    logo: `${base}/icon.png`,
    email: COMPANY_SUPPORT_EMAIL,
    address: companyPostalAddress(),
    sameAs: SOCIAL_SAME_AS,
  }
}

export function webSiteJsonLd(origin) {
  const base = originOf(origin)
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: `${base}/`,
    inLanguage: 'ja-JP',
    publisher: { '@type': 'Organization', name: SITE_NAME, legalName: COMPANY_NAME_JA, url: `${base}/` },
  }
}

/**
 * Free web tools. Do not attach aggregateRating.
 * price 0 reflects the publicly usable free tier — not Premium.
 */
export function softwareApplicationJsonLd({ name, url, origin, base, description } = {}) {
  const site = originOf(origin || base)
  const pageUrl = url
    ? (String(url).startsWith('http') ? url : `${site}${String(url).startsWith('/') ? url : `/${url}`}`)
    : `${site}/`
  const obj = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: name || SITE_NAME,
    url: pageUrl,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    inLanguage: 'ja',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'JPY',
    },
    publisher: { '@type': 'Organization', name: SITE_NAME, legalName: COMPANY_NAME_JA, url: `${site}/` },
  }
  if (description) obj.description = String(description)
  return obj
}

export function breadcrumbListJsonLd(itemsOrOrigin, originOrItems) {
  const originFirst = !Array.isArray(itemsOrOrigin)
  const items = originFirst ? originOrItems : itemsOrOrigin
  const origin = originFirst ? itemsOrOrigin : originOrItems
  const site = originOf(origin)
  const list = (Array.isArray(items) ? items : []).filter((it) => it?.name && it?.path)
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: list.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.path.startsWith('http') ? it.path : `${site}${it.path.startsWith('/') ? it.path : `/${it.path}`}`,
    })),
  }
}

export function articleJsonLd(first = {}, second) {
  const merged = (typeof first === 'string') ? { origin: first, ...(second || {}) } : (first || {})
  const site = originOf(merged.origin)
  const pageUrl = merged.url
    ? (String(merged.url).startsWith('http') ? merged.url : `${site}${String(merged.url).startsWith('/') ? merged.url : `/${merged.url}`}`)
    : `${site}/`
  const published = merged.datePublished ? String(merged.datePublished) : undefined
  const modified = merged.dateModified ? String(merged.dateModified) : published
  const img = merged.image
    ? (String(merged.image).startsWith('http') ? merged.image : `${site}${String(merged.image).startsWith('/') ? merged.image : `/${merged.image}`}`)
    : undefined
  const obj = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: merged.headline || SITE_NAME,
    inLanguage: 'ja-JP',
    mainEntityOfPage: pageUrl,
    url: pageUrl,
    author: {
      '@type': 'Organization',
      name: String(merged.authorName || '').trim() || EDITORIAL_AUTHOR_NAME,
    },
    publisher: organizationJsonLd(site),
  }
  if (merged.description) obj.description = merged.description
  if (published) obj.datePublished = published
  if (modified) obj.dateModified = modified
  if (img) obj.image = img
  return obj
}
