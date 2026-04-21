import { createClient } from '@supabase/supabase-js'
import { buildHeadBlock, escapeHtml, webApplicationLd } from './lib/seoHead.js'
import { isMarketRelevantManualNews } from '../../src/lib/marketNewsRelevance.js'

const toTimeText = (value = '') => {
  if (!value) return '--:--'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '--:--'
  return d.toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const REGION_TICKER_LIST = ['ACWI', 'MCHI', '1329.T', '1475.T', 'IVV']

function sendHtml(res, status, html) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(html)
}

const calcChangePct = (latest, prev) => {
  const a = Number(latest)
  const b = Number(prev)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null
  return ((a - b) / b) * 100
}

export default async function handler(_req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return sendHtml(res, 500, '<h1>Market unavailable</h1><p>Missing Supabase environment variables.</p>')
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
    const historyFrom = new Date(Date.now() - (1000 * 60 * 60 * 24 * 10)).toISOString().slice(0, 10)

    const [
      { data: manualRows, error: manualErr },
      { data: latestRows, error: latestErr },
      { data: historyRows, error: historyErr },
    ] = await Promise.all([
      supabase
        .from('news_manual')
        .select('bucket,title,description,source,time_text,published_at,updated_at,language')
        .eq('is_active', true)
        .in('bucket', ['market_ticker', 'market_pickup', 'fund_pickup', 'daily_brief'])
        .order('sort_order', { ascending: true })
        .order('published_at', { ascending: false })
        .limit(120),
      supabase.from('v_stock_latest').select('symbol,trade_date,close').in('symbol', REGION_TICKER_LIST),
      supabase
        .from('stock_daily_prices')
        .select('symbol,trade_date,close')
        .in('symbol', REGION_TICKER_LIST)
        .gte('trade_date', historyFrom)
        .order('trade_date', { ascending: false }),
    ])
    if (manualErr) throw manualErr
    if (latestErr) throw latestErr
    if (historyErr) throw historyErr

    const rows = manualRows || []
    const tickerCandidates = rows.filter((r) => r.bucket === 'market_ticker').filter(isMarketRelevantManualNews)
    const pickupCandidates = rows.filter((r) => r.bucket === 'market_pickup').filter(isMarketRelevantManualNews)
    const fundCandidates = rows.filter((r) => r.bucket === 'fund_pickup').filter(isMarketRelevantManualNews)
    const briefRow = rows.find((r) => r.bucket === 'daily_brief') || null
    const dailyBrief =
      briefRow && isMarketRelevantManualNews(briefRow) ? briefRow : null
    const byBucket = {
      market_ticker: tickerCandidates.slice(0, 10),
      market_pickup: pickupCandidates.slice(0, 6),
      fund_pickup: fundCandidates.slice(0, 6),
      daily_brief: dailyBrief,
    }

    const latestMap = new Map((latestRows || []).map((r) => [String(r.symbol || '').toUpperCase(), r]))
    const historyMap = new Map()
    for (const row of historyRows || []) {
      const key = String(row?.symbol || '').toUpperCase()
      if (!historyMap.has(key)) historyMap.set(key, [])
      historyMap.get(key).push(row)
    }

    const regionCards = REGION_TICKER_LIST.map((symbol) => {
      const latest = latestMap.get(symbol)
      const latestDate = String(latest?.trade_date || '')
      const prev = (historyMap.get(symbol) || []).find((r) => String(r?.trade_date || '') < latestDate)
      const change = calcChangePct(latest?.close, prev?.close)
      if (!latest || change == null) return null
      return {
        symbol,
        close: Number(latest.close || 0),
        change,
        tradeDate: latestDate,
      }
    }).filter(Boolean)

    const tickerLine = byBucket.market_ticker
      .map((item) => `<span style="margin-right:20px;"><strong style="color:#f97316;">${escapeHtml(item.source || 'News')}</strong> ${escapeHtml(item.title || '')} <span style="color:#94a3b8;">${escapeHtml(item.time_text || '')}</span></span>`)
      .join('')

    const pickupCards = byBucket.market_pickup.map((item) => `
      <article style="border:1px solid #e2e8f0;border-radius:14px;padding:14px;background:#fff;">
        <h3 style="margin:0;font-size:15px;line-height:1.6;color:#0f172a;font-weight:800;">${escapeHtml(item.title || '')}</h3>
        <p style="margin:8px 0 0 0;font-size:13px;line-height:1.7;color:#475569;">${escapeHtml(item.description || '')}</p>
      </article>
    `).join('')

    const fundCards = byBucket.fund_pickup.map((item) => `
      <article style="border:1px solid #e2e8f0;border-radius:14px;padding:14px;background:#fff;">
        <h3 style="margin:0;font-size:15px;line-height:1.6;color:#0f172a;font-weight:800;">${escapeHtml(item.title || '')}</h3>
        <p style="margin:8px 0 0 0;font-size:13px;line-height:1.7;color:#475569;">${escapeHtml(item.description || '')}</p>
      </article>
    `).join('')

    const regionHtml = regionCards.map((item) => `
      <div style="border:1px solid #e2e8f0;border-radius:12px;padding:12px;background:#fff;">
        <p style="margin:0;font-size:12px;color:#64748b;font-weight:700;">${escapeHtml(item.symbol)}</p>
        <p style="margin:5px 0 0 0;font-size:18px;font-weight:900;color:#0f172a;">${item.close.toFixed(2)}</p>
        <p style="margin:4px 0 0 0;font-size:12px;font-weight:800;color:${item.change >= 0 ? '#059669' : '#dc2626'};">
          ${item.change >= 0 ? '+' : ''}${item.change.toFixed(2)}%
        </p>
      </div>
    `).join('')

    const latestUpdated = rows
      .map((r) => r?.updated_at || r?.published_at)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || new Date().toISOString()

    const head = buildHeadBlock({
      title: '日本マーケット指標・センチメント | MoneyMart',
      description:
        '日本市場のセンチメントや関連ニュースを整理する無料マーケット指標。ETF・株式のタイミング検討や、NISA枠の配分検討に活用できます。',
      canonicalPath: '/market-indicator',
      jsonLd: [webApplicationLd({ name: 'MoneyMart マーケット指標', url: '/market-indicator' })],
    })

    const html = `<!doctype html>
<html lang="ja">
  <head>${head}
  </head>
  <body style="margin:0;background:#f8fafc;font-family:'Noto Sans JP',system-ui,-apple-system,sans-serif;color:#0f172a;">
    <main style="max-width:980px;margin:0 auto;padding:28px 16px 42px 16px;">
      <header style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11px;letter-spacing:.14em;font-weight:900;color:#0ea5e9;">MONEYMART MARKET</p>
        <h1 style="margin:8px 0 0 0;font-size:38px;line-height:1.15;font-weight:900;">マーケット指標</h1>
        <p style="margin:10px 0 0 0;font-size:14px;line-height:1.8;color:#475569;">マーケットニュースと主要ETFシグナルをまとめて確認できます。</p>
        <p style="margin:8px 0 0 0;font-size:12px;color:#64748b;">最終更新: ${escapeHtml(toTimeText(latestUpdated))}</p>
      </header>

      ${byBucket.daily_brief
        ? `
        <section style="border:1px solid #fdba74;background:#fff7ed;border-radius:14px;padding:14px;margin-bottom:14px;">
          <p style="margin:0;font-size:11px;color:#9a3412;font-weight:900;">DAILY BRIEF</p>
          <p style="margin:6px 0 0 0;font-size:16px;line-height:1.6;font-weight:800;color:#0f172a;">${escapeHtml(byBucket.daily_brief.title || '')}</p>
          <p style="margin:6px 0 0 0;font-size:13px;line-height:1.7;color:#7c2d12;">${escapeHtml(byBucket.daily_brief.description || '')}</p>
        </section>
      `
        : ''}

      <section style="border:1px solid #0f172a;border-radius:14px;background:#111827;color:#e2e8f0;padding:12px;overflow:hidden;margin-bottom:14px;font-size:12px;white-space:nowrap;">
        ${tickerLine || 'ニュースティッカーは更新待ちです。'}
      </section>

      <section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:14px;">
        ${regionHtml || '<p style="font-size:13px;color:#64748b;">指数データがありません。</p>'}
      </section>

      <section>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <p style="margin:0;font-size:11px;letter-spacing:.12em;font-weight:900;color:#64748b;">ニュース・ピックアップ</p>
          <div style="height:1px;background:#e2e8f0;flex:1;"></div>
        </div>
        <div style="display:grid;gap:10px;">${pickupCards || '<p style="font-size:13px;color:#64748b;">ピックアップはありません。</p>'}</div>
      </section>

      <section style="margin-top:16px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <p style="margin:0;font-size:11px;letter-spacing:.12em;font-weight:900;color:#64748b;">ファンド関連ニュース</p>
          <div style="height:1px;background:#e2e8f0;flex:1;"></div>
        </div>
        <div style="display:grid;gap:10px;">${fundCards || '<p style="font-size:13px;color:#64748b;">ファンドニュースはありません。</p>'}</div>
      </section>
    </main>
  </body>
</html>`

    return sendHtml(res, 200, html)
  } catch (e) {
    const message = escapeHtml(e?.message || 'Unknown error')
    return sendHtml(res, 500, `<!doctype html><html lang="ja"><body><h1>Market unavailable</h1><p>${message}</p></body></html>`)
  }
}

