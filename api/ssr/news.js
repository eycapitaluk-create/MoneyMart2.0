import { createClient } from '@supabase/supabase-js'
import { buildHeadBlock, escapeHtml, webApplicationLd } from './lib/seoHead.js'

const toTimeLabel = (value) => {
  if (!value) return '--:--'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '--:--'
  return d.toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const normalizeAiRow = (row) => ({
  ticker: String(row?.ticker || ''),
  companyName: String(row?.company_name || ''),
  headline: String(row?.headline || ''),
  summary: String(row?.summary || ''),
  analysis: String(row?.analysis || ''),
  source: String(row?.source || ''),
  sourceUrl: String(row?.source_url || ''),
  sentiment: String(row?.sentiment || '中立'),
  updatedAt: row?.updated_at || row?.published_at || '',
})

const normalizeManualRow = (row) => ({
  id: row?.id,
  title: String(row?.title || ''),
  description: String(row?.description || ''),
  source: String(row?.source || 'MoneyMart'),
  publishedAt: row?.published_at || '',
})

function sendHtml(res, status, html) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(html)
}

export default async function handler(_req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return sendHtml(res, 500, '<h1>News unavailable</h1><p>Missing Supabase environment variables.</p>')
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

    const [{ data: aiRows, error: aiErr }, { data: manualRows, error: manualErr }] = await Promise.all([
      supabase
        .from('ai_news_summaries')
        .select('ticker,company_name,headline,summary,analysis,source,source_url,sentiment,published_at,updated_at,sort_order')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .order('sort_order', { ascending: true })
        .limit(12),
      supabase
        .from('news_manual')
        .select('id,title,description,source,published_at,sort_order')
        .eq('bucket', 'news_page_manual')
        .eq('is_active', true)
        .order('published_at', { ascending: false })
        .order('sort_order', { ascending: true })
        .limit(12),
    ])
    if (aiErr) throw aiErr
    if (manualErr) throw manualErr

    const ai = (aiRows || []).map(normalizeAiRow).filter((row) => row.headline)
    const manual = (manualRows || []).map(normalizeManualRow).filter((row) => row.title)
    const updatedAt = ai[0]?.updatedAt || manual[0]?.publishedAt || new Date().toISOString()

    const aiCards = ai.map((item) => `
      <article style="border:1px solid #e2e8f0;border-radius:16px;padding:16px;background:#fff;box-shadow:0 1px 2px rgba(15,23,42,.05);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;color:#64748b;">
          <span style="font-weight:800;">${escapeHtml(item.companyName || item.ticker || 'Market')}</span>
          <span>${escapeHtml(item.sentiment)}</span>
        </div>
        <h2 style="margin:8px 0 0 0;font-size:18px;line-height:1.45;font-weight:900;color:#0f172a;">${escapeHtml(item.headline)}</h2>
        <p style="margin:8px 0 0 0;font-size:14px;line-height:1.8;color:#334155;">${escapeHtml(item.summary)}</p>
        ${item.analysis ? `<p style="margin:10px 0 0 0;font-size:13px;line-height:1.85;color:#475569;white-space:pre-line;">${escapeHtml(item.analysis)}</p>` : ''}
        <div style="margin-top:10px;display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;color:#64748b;">
          <span>${escapeHtml(item.source)} · ${escapeHtml(toTimeLabel(item.updatedAt))}</span>
          ${item.sourceUrl ? `<a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer" style="color:#ea580c;font-weight:800;text-decoration:none;">元記事</a>` : ''}
        </div>
      </article>
    `).join('')

    const manualCards = manual.map((item) => `
      <article style="border:1px solid #e2e8f0;border-radius:14px;padding:14px;background:#fff;">
        <h3 style="margin:0;font-size:16px;line-height:1.45;font-weight:800;color:#0f172a;">${escapeHtml(item.title)}</h3>
        <p style="margin:8px 0 0 0;font-size:13px;line-height:1.7;color:#475569;">${escapeHtml(item.description)}</p>
        <p style="margin:8px 0 0 0;font-size:11px;color:#64748b;">${escapeHtml(item.source)} · ${escapeHtml(toTimeLabel(item.publishedAt))}</p>
      </article>
    `).join('')

    const head = buildHeadBlock({
      title: 'AIニュース・市況ヘッドライン | MoneyMart',
      description:
        '投資・経済ニュースをAIで要約し、日本語で整理して読める無料ニュースページ。ETF、個別株、NISA関連の主要トピックを横断チェックできます。',
      canonicalPath: '/news',
      jsonLd: [webApplicationLd({ name: 'MoneyMart AIニュース', url: '/news' })],
    })

    const html = `<!doctype html>
<html lang="ja">
  <head>${head}
  </head>
  <body style="margin:0;background:#f8fafc;font-family:'Noto Sans JP',system-ui,-apple-system,sans-serif;color:#0f172a;">
    <main style="max-width:980px;margin:0 auto;padding:28px 16px 42px 16px;">
      <header style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11px;letter-spacing:.14em;font-weight:900;color:#f97316;">MONEYMART NEWS</p>
        <h1 style="margin:8px 0 0 0;font-size:38px;line-height:1.15;font-weight:900;">AIニュース</h1>
        <p style="margin:10px 0 0 0;font-size:14px;line-height:1.8;color:#475569;">
          投資判断に関わるニュースを中心に、投資・経済・政治・AI・ビジネスの観点で要点を整理しています。
        </p>
        <p style="margin:8px 0 0 0;font-size:12px;color:#64748b;">最終更新: ${escapeHtml(toTimeLabel(updatedAt))}</p>
      </header>
      <section style="display:grid;gap:12px;">
        ${aiCards || '<p style="font-size:14px;color:#64748b;">現在表示できるAIニュースがありません。</p>'}
      </section>
      <section style="margin-top:22px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <p style="margin:0;font-size:11px;letter-spacing:.12em;font-weight:900;color:#64748b;">手動ニュース</p>
          <div style="height:1px;background:#e2e8f0;flex:1;"></div>
        </div>
        <div style="display:grid;gap:10px;">
          ${manualCards || '<p style="font-size:13px;color:#64748b;">手動ニュースはありません。</p>'}
        </div>
      </section>
      <footer style="margin-top:22px;border-top:1px solid #e2e8f0;padding-top:10px;font-size:11px;color:#64748b;line-height:1.7;">
        本コンテンツは情報提供のみを目的としており、特定の金融商品の購入・売却を推奨するものではありません。
      </footer>
    </main>
  </body>
</html>`

    return sendHtml(res, 200, html)
  } catch (e) {
    const message = escapeHtml(e?.message || 'Unknown error')
    return sendHtml(res, 500, `<!doctype html><html lang="ja"><body><h1>News unavailable</h1><p>${message}</p></body></html>`)
  }
}

