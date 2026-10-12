/**
 * /funds/:symbol のクローラ向け HTML（ログイン不要の ETF 詳細と同一 URL）。
 */
import { createClient } from '@supabase/supabase-js'
import { ETF_LIST_FROM_XLSX, ETF_SYMBOLS_FROM_XLSX } from '../../src/data/etfListFromXlsx.js'
import { FUND_ISIN_BY_SYMBOL } from '../../src/data/fundIsinBySymbol.js'
import { getFundDescription } from '../../src/lib/fundDetailDescription.js'
import {
  fundSymbolLookupVariants,
  pickStockMetaRow,
  resolveFundDisplayName,
  resolveFundNisaCategory,
} from '../../src/lib/fundDisplayUtils.js'
import { buildHeadBlock, escapeHtml, getSiteOrigin, webApplicationLd } from './lib/seoHead.js'
import { formatTrustFeePercent, parseTrustFeePercent } from '../../src/lib/trustFee.js'
import { MM_PATH_PREFIXES_FUNDS_DETAIL, parseMmPathForSsr } from './lib/mmPathAllowlist.js'

function sendHtml(res, status, html) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(html)
}

const FUND_SYMBOL_SET = new Set(ETF_SYMBOLS_FROM_XLSX.map((s) => String(s || '').toUpperCase()))
const ETF_META_MAP = new Map(ETF_LIST_FROM_XLSX.map((item) => [item.symbol, item]))

/** URL の 2631 → ユニバースキー 2631.T などへ寄せる */
function resolveUniverseSymbol(raw) {
  const s = String(raw || '').trim().toUpperCase()
  if (!s) return ''
  if (FUND_SYMBOL_SET.has(s)) return s
  if (!s.includes('.') && FUND_SYMBOL_SET.has(`${s}.T`)) return `${s}.T`
  for (const v of fundSymbolLookupVariants(s)) {
    const u = String(v || '').trim().toUpperCase()
    if (FUND_SYMBOL_SET.has(u)) return u
  }
  return ''
}

function readFundDetailRoute(req) {
  const full = String(req.url || '')
  const qIdx = full.indexOf('?')
  const search = qIdx >= 0 ? full.slice(qIdx + 1) : ''
  const outerQs = new URLSearchParams(search)
  const mm = outerQs.get('__mm_path')
  let target = '/funds'
  if (mm) {
    const parsed = parseMmPathForSsr(mm, MM_PATH_PREFIXES_FUNDS_DETAIL)
    if (parsed.ok) {
      const q = parsed.queryParams.toString()
      target = q ? `${parsed.pathname}?${q}` : parsed.pathname
    }
  }
  try {
    const u = new URL(target, 'https://www.moneymart.co.jp')
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts[0] !== 'funds' || !parts[1]) return { symbol: '' }
    const symbol = resolveUniverseSymbol(decodeURIComponent(parts[1]))
    return { symbol }
  } catch {
    return { symbol: '' }
  }
}

const fmtPrice = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? `¥${Number(v).toLocaleString('ja-JP')}` : null)
const fmtTrust = (v) => (parseTrustFeePercent(v) == null ? null : formatTrustFeePercent(v))

export default async function handler(req, res) {
  const { symbol } = readFundDetailRoute(req)
  if (!symbol) {
    res.statusCode = 302
    res.setHeader('Location', '/funds')
    res.end()
    return
  }

  const base = getSiteOrigin()
  const pathEncoded = `/funds/${encodeURIComponent(symbol)}`
  const canonicalAbsoluteUrl = `${base}${pathEncoded}`

  const xlsxMeta = ETF_META_MAP.get(symbol)
  const dbSymVariants = fundSymbolLookupVariants(symbol)

  let profile = {}
  let profileRow = {}
  let latest = null

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
      const [{ data: symbolRows }, { data: profileRows }, { data: latestRows }] = await Promise.all([
        supabase.from('stock_symbols').select('symbol,name,trust_fee,nisa_category,aum,isin').in('symbol', dbSymVariants),
        supabase.from('stock_symbol_profiles').select('symbol,name_jp,name_en').in('symbol', dbSymVariants),
        supabase.from('v_stock_latest').select('symbol,trade_date,close').in('symbol', dbSymVariants).limit(1),
      ])
      profile = pickStockMetaRow(symbolRows || [], symbol)
      profileRow = pickStockMetaRow(profileRows || [], symbol)
      latest = Array.isArray(latestRows) ? latestRows[0] || null : latestRows || null
    } catch {
      profile = {}
      profileRow = {}
      latest = null
    }
  }

  const jpName = resolveFundDisplayName(symbol, profile, xlsxMeta, profileRow)
  const isinFallback = FUND_ISIN_BY_SYMBOL[symbol]
  const isin = String(profile?.isin || xlsxMeta?.isin || isinFallback || '').trim() || '-'
  const trustFee = Number.isFinite(Number(profile.trust_fee)) ? Number(profile.trust_fee) : Number(xlsxMeta?.trustFee)
  const trustLabel = fmtTrust(trustFee)
  const nisaCategory = resolveFundNisaCategory(symbol, profile.nisa_category, xlsxMeta?.nisaCategory)
  const descriptionText = getFundDescription(symbol, isin === '-' ? '' : isin, jpName)
  const descMeta = descriptionText.length > 158 ? `${descriptionText.slice(0, 157)}…` : descriptionText

  const closeLabel = fmtPrice(latest?.close)
  const tradeDate = String(latest?.trade_date || '').trim()

  const priceBlock = closeLabel && tradeDate
    ? `<p style="margin:12px 0 0 0;font-size:15px;line-height:1.75;"><strong>終値（参考）</strong>：${escapeHtml(closeLabel)}（${escapeHtml(tradeDate)}）</p>`
    : `<p style="margin:12px 0 0 0;font-size:14px;line-height:1.75;color:#64748b;">直近の終値はデータ更新状況により表示できない場合があります。アプリ内では取得できる範囲の実データのみを表示します。</p>`

  const trustBlock = trustLabel
    ? `<p style="margin:8px 0 0 0;font-size:14px;"><strong>信託報酬（参考）</strong>：${escapeHtml(trustLabel)}</p>`
    : ''
  const nisaBlock = nisaCategory && nisaCategory !== '-'
    ? `<p style="margin:6px 0 0 0;font-size:14px;"><strong>NISA区分（参考）</strong>：${escapeHtml(nisaCategory)}</p>`
    : ''

  const head = buildHeadBlock({
    title: `${jpName}（${symbol}）｜ETF・信託報酬 | MoneyMart`,
    description: descMeta,
    canonicalPath: pathEncoded,
    canonicalAbsoluteUrl,
    jsonLd: [
      webApplicationLd({ name: `MoneyMart ETF: ${symbol}`, url: pathEncoded }),
    ],
  })

  const html = `<!doctype html>
<html lang="ja">
  <head>${head}
  </head>
  <body style="margin:0;background:#f8fafc;font-family:'Noto Sans JP',system-ui,-apple-system,sans-serif;color:#0f172a;">
    <main style="max-width:920px;margin:0 auto;padding:28px 16px 42px 16px;">
      <header style="margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11px;letter-spacing:.14em;font-weight:900;color:#f59e0b;">MONEYMART ETF</p>
        <h1 style="margin:8px 0 0 0;font-size:28px;line-height:1.2;font-weight:900;">${escapeHtml(jpName)}</h1>
        <p style="margin:8px 0 0 0;font-size:13px;color:#64748b;font-weight:700;">${escapeHtml(symbol)}${isin !== '-' ? ` · ${escapeHtml(isin)}` : ''}</p>
        ${priceBlock}
        ${trustBlock}
        ${nisaBlock}
      </header>
      <section style="margin-top:16px;padding:16px;border-radius:16px;border:1px solid #e2e8f0;background:#fff;">
        <h2 style="margin:0 0 8px 0;font-size:14px;font-weight:900;color:#475569;">ファンド説明</h2>
        <p style="margin:0;font-size:14px;line-height:1.85;color:#334155;white-space:pre-line;">${escapeHtml(descriptionText)}</p>
      </section>
      <section style="margin-top:18px;display:grid;gap:10px;">
        <a href="${escapeHtml(canonicalAbsoluteUrl)}" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#ea580c;text-decoration:none;font-weight:900;">詳細チャート・指標をアプリで見る（同一URL）</a>
        <a href="/etf-compare" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">ETF一覧・比較へ</a>
      </section>
    </main>
  </body>
</html>`

  return sendHtml(res, 200, html)
}
