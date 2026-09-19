import { createClient } from '@supabase/supabase-js'
import { buildHeadBlock, escapeHtml, getSiteOrigin, webApplicationLd } from './lib/seoHead.js'
import { MM_PATH_PREFIXES_STOCKS, parseMmPathForSsr } from './lib/mmPathAllowlist.js'
import { isIndexableStockSymbol } from '../../src/lib/indexableStockSymbolsForSeo.js'
import { formatStockJaEnListLabel } from '../../src/data/stockNameFallback.js'

function sendHtml(res, status, html) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(html)
}

/** middleware から渡す `/stocks` + query を読む（insights と同様）。 */
function readStocksRoute(req) {
  const full = String(req.url || '')
  const qIdx = full.indexOf('?')
  const search = qIdx >= 0 ? full.slice(qIdx + 1) : ''
  const outerQs = new URLSearchParams(search)
  const mm = outerQs.get('__mm_path')
  let target = '/stocks'
  if (mm) {
    const parsed = parseMmPathForSsr(mm, MM_PATH_PREFIXES_STOCKS)
    if (parsed.ok) {
      const q = parsed.queryParams.toString()
      target = q ? `${parsed.pathname}?${q}` : parsed.pathname
    }
  }
  try {
    const u = new URL(target, 'https://www.moneymart.co.jp')
    const symbol = String(u.searchParams.get('symbol') || '').trim().toUpperCase()
    return { symbol }
  } catch {
    return { symbol: '' }
  }
}

function renderHubPage() {
  const head = buildHeadBlock({
    title: '株式マーケット・注目銘柄 | MoneyMart',
    description:
      '株価・チャート・ウォッチリストをまとめて確認できる無料ツール。ETFとの比較や、NISA成長投資枠での銘柄検討に活用できます。',
    canonicalPath: '/stocks',
    jsonLd: [webApplicationLd({ name: 'MoneyMart 株式ツール', url: '/stocks' })],
  })

  return `<!doctype html>
<html lang="ja">
  <head>${head}
  </head>
  <body style="margin:0;background:#f8fafc;font-family:'Noto Sans JP',system-ui,-apple-system,sans-serif;color:#0f172a;">
    <main style="max-width:920px;margin:0 auto;padding:28px 16px 42px 16px;">
      <header style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11px;letter-spacing:.14em;font-weight:900;color:#0ea5e9;">MONEYMART STOCKS</p>
        <h1 style="margin:8px 0 0 0;font-size:34px;line-height:1.15;font-weight:900;">株式ページ</h1>
        <p style="margin:10px 0 0 0;font-size:14px;line-height:1.8;color:#475569;">
          主要銘柄の価格推移やウォッチリストを確認できます。実際の比較表・チャートUIはJavaScript有効時に読み込まれます。
          データ不足時は推定値を出さず、取得できる情報のみを表示します。
        </p>
      </header>
      <section style="display:grid;gap:10px;">
        <a href="/market-indicator" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">マーケット指標へ</a>
        <a href="/news" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">AIニュースへ</a>
        <a href="/insights" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">投資インサイトへ</a>
      </section>
    </main>
  </body>
</html>`
}

export default async function handler(req, res) {
  const { symbol } = readStocksRoute(req)
  if (!symbol) {
    return sendHtml(res, 200, renderHubPage())
  }

  if (!isIndexableStockSymbol(symbol)) {
    return sendHtml(res, 200, renderHubPage())
  }

  const base = getSiteOrigin()
  const qs = new URLSearchParams({ symbol })
  const canonicalAbsoluteUrl = `${base}/stocks?${qs.toString()}`

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY

  let profileRow = null
  let latestRow = null
  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
      const [{ data: prof }, { data: latest }] = await Promise.all([
        supabase
          .from('stock_symbol_profiles')
          .select('symbol,name_jp,name_en,sector,industry')
          .eq('symbol', symbol)
          .maybeSingle(),
        supabase
          .from('v_stock_latest')
          .select('symbol,trade_date,close')
          .eq('symbol', symbol)
          .maybeSingle(),
      ])
      profileRow = prof || null
      latestRow = latest || null
    } catch {
      profileRow = null
      latestRow = null
    }
  }

  const label = formatStockJaEnListLabel({
    code: symbol,
    name_jp: profileRow?.name_jp,
    name_en: profileRow?.name_en,
    name: '',
  })
  const safeLabel = escapeHtml(label)
  const safeSym = escapeHtml(symbol)

  const close = Number(latestRow?.close)
  const hasClose = Number.isFinite(close) && close > 0
  const tradeDate = String(latestRow?.trade_date || '').trim()

  const priceLine = hasClose && tradeDate
    ? `<p style="margin:12px 0 0 0;font-size:15px;line-height:1.75;color:#0f172a;"><strong>終値（参考）</strong>：${escapeHtml(String(close))}（取引日 ${escapeHtml(tradeDate)}）</p>`
    : `<p style="margin:12px 0 0 0;font-size:14px;line-height:1.75;color:#64748b;">直近の終値はデータ更新状況により表示できない場合があります。アプリ内では取得できる範囲の実データのみを表示します（推定値は出しません）。</p>`

  const sectorBits = [profileRow?.sector, profileRow?.industry].map((s) => String(s || '').trim()).filter(Boolean)
  const sectorLine = sectorBits.length
    ? `<p style="margin:10px 0 0 0;font-size:13px;line-height:1.7;color:#475569;">セクター・業種（参考）：${escapeHtml(sectorBits.join(' / '))}</p>`
    : ''

  const description = `${label}（${symbol}）の株価・チャート・関連ニュースをMoneyMartで確認。終値はデータベースで取得できる場合のみ表示します。`

  const head = buildHeadBlock({
    title: `${label}（${symbol}）株価・チャート | MoneyMart`,
    description,
    canonicalPath: '/stocks',
    canonicalAbsoluteUrl,
    jsonLd: [webApplicationLd({ name: `MoneyMart 株式: ${symbol}`, url: `/stocks?${qs.toString()}` })],
  })

  const html = `<!doctype html>
<html lang="ja">
  <head>${head}
  </head>
  <body style="margin:0;background:#f8fafc;font-family:'Noto Sans JP',system-ui,-apple-system,sans-serif;color:#0f172a;">
    <main style="max-width:920px;margin:0 auto;padding:28px 16px 42px 16px;">
      <header style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11px;letter-spacing:.14em;font-weight:900;color:#0ea5e9;">MONEYMART STOCKS</p>
        <h1 style="margin:8px 0 0 0;font-size:30px;line-height:1.2;font-weight:900;">${safeLabel} <span style="color:#64748b;font-weight:800;">(${safeSym})</span></h1>
        <p style="margin:10px 0 0 0;font-size:14px;line-height:1.8;color:#475569;">
          チャート・ウォッチリスト・ニュース連携などはブラウザでJavaScriptを有効にすると利用できます。
        </p>
        ${priceLine}
        ${sectorLine}
      </header>
      <section style="display:grid;gap:10px;margin-top:18px;">
        <a href="${escapeHtml(canonicalAbsoluteUrl)}" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#ea580c;text-decoration:none;font-weight:900;">この銘柄をアプリで開く（同一URL）</a>
        <a href="/etf-compare" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">ETF比較へ</a>
        <a href="/news" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">AIニュースへ</a>
      </section>
    </main>
  </body>
</html>`

  return sendHtml(res, 200, html)
}
