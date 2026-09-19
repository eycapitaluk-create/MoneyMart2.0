/**
 * Shared SEO helpers for Vercel SSR HTML responses.
 */
import {
  articleJsonLd,
  breadcrumbListJsonLd,
  organizationJsonLd,
  softwareApplicationJsonLd,
  webSiteJsonLd,
} from '../../../src/lib/seoJsonLd.js'

export {
  articleJsonLd,
  breadcrumbListJsonLd,
  organizationJsonLd,
  softwareApplicationJsonLd,
  webSiteJsonLd,
}

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
 * @param {string} opts.canonicalPath - path only, e.g. /etf-compare（canonicalAbsoluteUrl 指定時は URL 生成に使わない）
 * @param {string} [opts.canonicalAbsoluteUrl] - フル canonical（クエリ付き URL 用）
 * @param {string} [opts.ogImagePath='/og-card.png'] — used when ogImageAbsoluteUrl is empty
 * @param {string} [opts.ogImageAbsoluteUrl] — full https URL for og:image / twitter:image (e.g. Supabase Storage)
 * @param {string} [opts.ogType='website']
 * @param {object[]} [opts.jsonLd=[]] - extra schema.org objects (already as plain objects)
 * @param {boolean} [opts.noIndex=false]
 */
export function buildHeadBlock(opts) {
  const base = getSiteOrigin().replace(/\/$/, '')
  const rawPath =
    opts.canonicalPath != null && String(opts.canonicalPath).trim() !== ''
      ? String(opts.canonicalPath).trim()
      : '/'
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  let canonical = String(opts.canonicalAbsoluteUrl || '').trim()
  if (!canonical) {
    canonical = `${base}${path}`
    if (canonical.length > base.length + 1 && canonical.endsWith('/')) {
      canonical = canonical.slice(0, -1)
    }
  }

  const absIn = String(opts.ogImageAbsoluteUrl || '').trim()
  let ogImage = ''
  if (/^https?:\/\//i.test(absIn)) {
    ogImage = absIn
  } else if (absIn.startsWith('//')) {
    ogImage = `https:${absIn}`
  } else if (absIn.startsWith('/')) {
    ogImage = `${base}${absIn}`
  } else if (absIn) {
    ogImage = `${base}/${absIn}`
  } else {
    const ogPath = opts.ogImagePath?.startsWith('/') ? opts.ogImagePath : `/${opts.ogImagePath || 'og-card.png'}`
    ogImage = `${base}${ogPath}`
  }

  const ogType = String(opts.ogType || 'website').trim() || 'website'
  const title = escapeHtml(opts.title)
  const description = escapeHtml(opts.description)
  const canonicalEsc = escapeHtml(canonical)
  const ogImageEsc = escapeHtml(ogImage)
  const robots = opts.noIndex
    ? 'noindex,nofollow'
    : String(opts.robots || 'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1')

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
    <meta name="robots" content="${robots}" />
    <meta property="og:type" content="${escapeHtml(ogType)}" />
    <meta property="og:site_name" content="MoneyMart" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonicalEsc}" />
    <meta property="og:image" content="${ogImageEsc}" />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />
    <meta property="og:image:alt" content="MoneyMart" />
    <meta property="og:locale" content="ja_JP" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${ogImageEsc}" />
    <meta name="twitter:image:alt" content="MoneyMart" />
    ${ldScripts ? `${ldScripts}\n    ` : ''}`
}

export function webApplicationLd({ name, url, description }) {
  return softwareApplicationJsonLd({
    name,
    url,
    base: getSiteOrigin(),
    description,
  })
}

export function homeJsonLd() {
  const origin = getSiteOrigin()
  return [
    organizationJsonLd(origin),
    webSiteJsonLd(origin),
    softwareApplicationJsonLd({
      name: 'MoneyMart',
      url: '/',
      origin,
      description:
        'ポートフォリオの見える化、投資信託とETFの重なり、集中度、NISA、配当管理を一つの画面で確認できる無料ツール。',
    }),
  ]
}

export function ssrTrustNavHtml() {
  return `
      <nav aria-label="関連ページ" style="margin-top:22px;display:flex;flex-wrap:wrap;gap:10px 14px;font-size:13px;">
        <a href="/etf-compare" style="color:#c2410c;font-weight:800;text-decoration:none;">ETF比較で重複を確認</a>
        <a href="/tools/nisa-etf-checklist" style="color:#c2410c;font-weight:800;text-decoration:none;">NISA・ETFチェックリスト</a>
        <a href="/dividend-calendar" style="color:#c2410c;font-weight:800;text-decoration:none;">配当カレンダー</a>
        <a href="/insights" style="color:#c2410c;font-weight:800;text-decoration:none;">編集インサイト</a>
        <a href="/legal/methodology" style="color:#475569;font-weight:700;text-decoration:none;">編集・データ方針</a>
        <a href="/legal/disclaimer" style="color:#475569;font-weight:700;text-decoration:none;">免責事項</a>
        <a href="mailto:support@moneymart.co.jp" style="color:#475569;font-weight:700;text-decoration:none;">訂正・お問い合わせ</a>
      </nav>
      <p style="margin:14px 0 0 0;font-size:11px;line-height:1.7;color:#64748b;">
        掲載情報は情報提供のみを目的としており、特定の金融商品の購入・売却を推奨するものではありません。将来の運用成果や配当を保証しません。MoneyMartは投資助言業の登録を受けていません。
      </p>`
}
