/**
 * 検索・プレビュー向けクローラには主要ページでサーバー組み立て HTML を返し、
 * 実ユーザーは従来どおり SPA（index.html）へ通します。
 *
 * - /insights → api/ssr/insights（記事本文・JSON-LD）
 * - ホーム・ニュース・マーケット・株式・ファンド・ETF比較・ツール等 → api/ssr/*（各種静的本文）
 *
 * @see api/ssr/*.js
 * @see api/ssr/lib/mmPathAllowlist.js — `__mm_path` は各 SSR が allowlist で検証
 *
 * 【508 対策】通常ブラウザを `fetch(request)` で処理すると、環境により同一パスへ Edge Middleware
 * が再入りして INFINITE_LOOP になる。そのためユーザー向けおよび SSR 迂回時は `next()` を返す。
 */
import { next } from '@vercel/functions'

export const config = {
  matcher: [
    '/',
    '/news',
    '/market',
    '/market-indicator',
    '/stocks',
    '/etf-compare',
    '/funds',
    '/funds/:path*',
    '/tools',
    '/tools/:path*',
    '/check',
    '/check/:path*',
    '/dividend-calendar',
    '/budget-tracker',
    '/insights',
    '/insights/:path*',
    '/about',
    '/faq',
    '/careers',
    '/legal/:path*',
    '/premium',
    '/products',
  ],
}

/** Search / preview crawlers — extend cautiously (do not match normal browsers). */
const BOT_RE =
  /Googlebot|Google-InspectionTool|GoogleOther|Storebot-Google|Googlebot-News|Googlebot-Image|FeedFetcher-Google|Mediapartners-Google|AdsBot-Google|bingbot|Slurp|DuckDuckBot|Yandex|Baiduspider|Bytespider|facebookexternalhit|PetalBot|Twitterbot|LinkedInBot|Slackbot|Discordbot|TelegramBot|Pinterestbot|vkShare|SkypeUriPreview|redditbot/i

function normalizePathname(raw) {
  let p = raw || '/'
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  return p || '/'
}

/**
 * @returns {URL | null} Same-origin SSR invoke URL, or null to fall through to SPA.
 */
function resolveBotSsrInvoke(url) {
  const pathname = normalizePathname(url.pathname)

  if (pathname.startsWith('/insights')) {
    const invoke = new URL('/api/ssr/insights', url.origin)
    invoke.searchParams.set('__mm_path', `${pathname}${url.search}`)
    return invoke
  }

  if (pathname === '/check' || pathname.startsWith('/check/')) {
    const invoke = new URL('/api/ssr/check', url.origin)
    invoke.searchParams.set('__mm_path', pathname)
    return invoke
  }

  if (pathname.startsWith('/tools')) {
    const invoke = new URL('/api/ssr/tools', url.origin)
    invoke.searchParams.set('__mm_path', `${pathname}${url.search}`)
    return invoke
  }

  if (pathname === '/funds') {
    return new URL('/api/ssr/funds', url.origin)
  }

  if (pathname.startsWith('/funds/')) {
    const seg = pathname.slice('/funds/'.length).split('/')[0]
    if (!seg) return null
    try {
      const decoded = decodeURIComponent(seg)
      if (decoded.toLowerCase() === 'compare') return null
    } catch {
      return null
    }
    const invoke = new URL('/api/ssr/fund-detail', url.origin)
    invoke.searchParams.set('__mm_path', `${pathname}${url.search}`)
    return invoke
  }

  if (pathname === '/stocks') {
    const invoke = new URL('/api/ssr/stocks', url.origin)
    invoke.searchParams.set('__mm_path', `${pathname}${url.search}`)
    return invoke
  }

  const staticMap = {
    '/': '/api/ssr/home',
    '/news': '/api/ssr/news',
    '/market': '/api/ssr/market',
    '/market-indicator': '/api/ssr/market',
    '/etf-compare': '/api/ssr/etf-compare',
    '/dividend-calendar': '/api/ssr/dividend-calendar',
    '/budget-tracker': '/api/ssr/budget-tracker',
    '/premium': '/api/ssr/static-public',
    '/products': '/api/ssr/static-public',
    '/about': '/api/ssr/static-public',
    '/faq': '/api/ssr/static-public',
    '/careers': '/api/ssr/static-public',
  }

  if (pathname.startsWith('/legal/')) {
    const invoke = new URL('/api/ssr/static-public', url.origin)
    invoke.searchParams.set('__mm_path', pathname)
    return invoke
  }

  const dest = staticMap[pathname]
  if (!dest) return null
  if (dest === '/api/ssr/static-public') {
    const invoke = new URL(dest, url.origin)
    invoke.searchParams.set('__mm_path', pathname)
    return invoke
  }
  return new URL(dest, url.origin)
}

export default async function middleware(request) {
  const ua = request.headers.get('user-agent') || ''
  if (!BOT_RE.test(ua)) {
    return next()
  }

  const url = new URL(request.url)
  const invoke = resolveBotSsrInvoke(url)
  if (!invoke) {
    return next()
  }

  const headers = new Headers(request.headers)
  headers.set('x-mm-bot-ssr', '1')

  return fetch(invoke.toString(), {
    method: 'GET',
    headers,
    redirect: 'manual',
  })
}
