import { createClient } from '@supabase/supabase-js'
import { ETF_SYMBOLS_FROM_XLSX } from '../src/data/etfListFromXlsx.js'
import { collectIndexableStockSymbols } from '../src/lib/indexableStockSymbolsForSeo.js'
import { getSiteOrigin } from './ssr/lib/seoHead.js'

function sendXml(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.end(body)
}

/** Indexable hub pages (auth / mypage / admin / community are omitted). */
const STATIC_PATHS = [
  '/',
  '/etf-compare',
  '/funds',
  '/stocks',
  '/tools',
  '/tools/nisa-etf-checklist',
  '/dividend-calendar',
  '/budget-tracker',
  '/market',
  '/news',
  '/insights',
  '/insights/category/nisa',
  '/insights/category/household',
  '/insights/category/mortgage',
  '/insights/category/market',
  '/insights/category/global',
  '/products',
  '/premium',
  '/campaign/sns-2026',
  '/faq',
  '/about',
  '/careers',
  '/legal/privacy',
  '/legal/terms',
  '/legal/commerce',
  '/legal/disclaimer',
  '/legal/security',
  '/legal/methodology',
  '/legal/solicitation',
  '/legal/antisocial',
]

function urlEntry(loc, lastmod) {
  const lm = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''
  return `  <url>
    <loc>${loc}</loc>${lm}
  </url>`
}

export default async function handler(_req, res) {
  const base = getSiteOrigin()
  const today = new Date().toISOString().slice(0, 10)
  const entries = STATIC_PATHS.map((p) => urlEntry(`${base}${p}`, today))

  // JP ETF 詳細 — `/funds/:symbol` はログイン不要で公開（FundDetailPage）。
  for (const sym of ETF_SYMBOLS_FROM_XLSX) {
    const s = String(sym || '').trim().toUpperCase()
    if (!s) continue
    entries.push(urlEntry(`${base}/funds/${encodeURIComponent(s)}`, today))
  }

  // `/funds/compare` は vercel で `/etf-compare` へリダイレクトされるためサイトマップには載せない。

  // Stock detail views — SPA uses `/stocks?symbol=` (matches StockPage).
  for (const sym of collectIndexableStockSymbols()) {
    const qs = new URLSearchParams({ symbol: sym })
    entries.push(urlEntry(`${base}/stocks?${qs.toString()}`, today))
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
      const { data: slugRows, error: slugErr } = await supabase
        .from('insight_articles')
        .select('slug,published_at,updated_at')
        .eq('is_published', true)
        .limit(5000)
      if (!slugErr && Array.isArray(slugRows)) {
        for (const row of slugRows) {
          const slug = String(row?.slug || '').trim()
          if (!slug) continue
          const mod = (row.updated_at || row.published_at || '').toString().slice(0, 10) || today
          entries.push(urlEntry(`${base}/insights/${encodeURIComponent(slug)}`, mod))
        }
      } else {
        const { data: legacyRows, error: legacyErr } = await supabase
          .from('insights_editorial')
          .select('id,published_at,updated_at')
          .eq('is_active', true)
          .limit(5000)
        if (!legacyErr && Array.isArray(legacyRows)) {
          for (const row of legacyRows) {
            const id = Number(row?.id || 0)
            if (!id) continue
            const mod = (row.updated_at || row.published_at || '').toString().slice(0, 10) || today
            entries.push(urlEntry(`${base}/insights?id=${id}`, mod))
          }
        }
      }
    } catch {
      // Supabase unavailable — still return static + fund + stock URLs.
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`

  return sendXml(res, 200, xml)
}
