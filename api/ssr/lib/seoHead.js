/**
 * Shared SEO helpers for Vercel SSR HTML responses.
 */

export function getSiteOrigin() {
  const explicit = process.env.PUBLIC_SITE_URL || process.env.VITE_PUBLIC_SITE_ORIGIN
  if (explicit) return String(explicit).replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`.replace(/\/$/, '')
  return 'https://www.moneymart.co.jp'
}

export function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.description
 * @param {string} opts.canonicalPath - path only, e.g. /etf-compare
 * @param {string} [opts.ogImagePath='/icon.png']
 * @param {object[]} [opts.jsonLd=[]] - extra schema.org objects (already as plain objects)
 */
export function buildHeadBlock(opts) {
  const base = getSiteOrigin()
  const path = opts.canonicalPath.startsWith('/') ? opts.canonicalPath : `/${opts.canonicalPath}`
  const canonical = `${base}${path}`
  const ogPath = opts.ogImagePath?.startsWith('/') ? opts.ogImagePath : `/${opts.ogImagePath || 'icon.png'}`
  const ogImage = `${base}${ogPath}`
  const title = escapeHtml(opts.title)
  const description = escapeHtml(opts.description)
  const canonicalEsc = escapeHtml(canonical)
  const ogImageEsc = escapeHtml(ogImage)

  const ldScripts = (opts.jsonLd || [])
    .filter(Boolean)
    .map((obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`)
    .join('\n    ')

  return `
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${canonicalEsc}" />
    <meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="MoneyMart" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonicalEsc}" />
    <meta property="og:image" content="${ogImageEsc}" />
    <meta property="og:locale" content="ja_JP" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${ogImageEsc}" />
    ${ldScripts ? `${ldScripts}\n    ` : ''}`
}

export function webApplicationLd({ name, url }) {
  const base = getSiteOrigin()
  const pageUrl = url.startsWith('http') ? url : `${base}${url.startsWith('/') ? url : `/${url}`}`
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    url: pageUrl,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Any',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'JPY',
    },
  }
}
