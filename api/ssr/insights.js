import { createClient } from '@supabase/supabase-js'
import { buildHeadBlock, webApplicationLd } from './lib/seoHead.js'

const normalizeToolKey = (s) =>
  String(s || '')
    .trim()
    .normalize('NFKC')
    .replace(/\s+/g, ' ')

const TOOL_ROUTE_MAP = new Map(
  [
    ['ETF比較ツール', '/etf-compare'],
    ['ETF 比較', '/etf-compare'],
    ['ETF比較', '/etf-compare'],
    ['ファンド比較', '/etf-compare'],
    ['配当カレンダー', '/dividend-calendar'],
    ['市場インジケーター', '/market-indicator'],
    ['ポートフォリオ最適化', '/tools'],
    ['分散', '/funds'],
  ].map(([k, v]) => [normalizeToolKey(k), v]),
)

const escapeHtml = (value = '') => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const toDateText = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

const normalizeInsight = (row) => ({
  id: Number(row?.id || 0),
  featured: Boolean(row?.featured),
  target: String(row?.target || ''),
  category: String(row?.category || ''),
  headline: String(row?.headline || ''),
  summary: String(row?.summary || ''),
  idea: String(row?.idea || ''),
  rationale: String(row?.rationale || ''),
  data: Array.isArray(row?.data) ? row.data : [],
  dataNote: String(row?.data_note || ''),
  risk: String(row?.risk || ''),
  relatedTools: Array.isArray(row?.related_tools) ? row.related_tools.map((x) => String(x || '').trim()).filter(Boolean) : [],
  date: toDateText(row?.published_at),
  readTime: String(row?.read_time || ''),
  sortOrder: Number(row?.sort_order || 0),
})

const isExternalUrl = (value = '') => /^https?:\/\//i.test(String(value || '').trim())

const toExternalLabel = (raw = '') => {
  try {
    const u = new URL(String(raw || '').trim())
    const host = u.hostname.replace(/^www\./, '')
    const path = (u.pathname || '/').replace(/\/$/, '')
    if (!path || path === '/') return host
    return `${host}${path.length > 18 ? `${path.slice(0, 18)}…` : path}`
  } catch {
    return String(raw || '').trim()
  }
}

const renderTextBlock = (text, style) => {
  const normalized = String(text || '').replace(/\r\n?/g, '\n').trim()
  if (!normalized) return ''
  const paragraphs = normalized.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean)
  return paragraphs.map((part) => (
    `<p style="margin:0 0 12px 0;${style}">${escapeHtml(part).replace(/\n/g, '<br />')}</p>`
  )).join('')
}

const renderToolPills = (tools = []) => tools.map((toolRaw) => {
  const tool = String(toolRaw || '').trim()
  if (!tool) return ''

  if (isExternalUrl(tool)) {
    return `<a href="${escapeHtml(tool)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:10px;border:1px solid #cbd5e1;background:#ffffff;color:#334155;font-weight:700;font-size:12px;text-decoration:none;"><span style="font-size:10px;">LINK</span><span>${escapeHtml(toExternalLabel(tool))}</span><span>↗</span></a>`
  }

  const mapped = TOOL_ROUTE_MAP.get(normalizeToolKey(tool))
  let href = mapped || '/tools'
  if (tool.startsWith('/') && !tool.startsWith('//')) {
    href = tool.split(/\s+/)[0]
  }

  return `<a href="${escapeHtml(href)}" style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:10px;border:1px solid #fdba74;background:#fff7ed;color:#c2410c;font-weight:700;font-size:12px;text-decoration:none;">${escapeHtml(tool)} <span>→</span></a>`
}).join('')

const renderListItem = (insight) => `
  <a href="/insights?id=${encodeURIComponent(String(insight.id))}" style="display:block;text-decoration:none;border:1px solid #e2e8f0;border-radius:16px;padding:18px;background:#ffffff;color:#0f172a;box-shadow:0 1px 2px rgba(15,23,42,.05);margin-top:12px;">
    <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#64748b;margin-bottom:8px;">
      <span style="padding:2px 8px;border-radius:8px;background:#f1f5f9;font-weight:700;">${escapeHtml(insight.category)}</span>
      <span>${escapeHtml(insight.date)}</span>
      <span>・</span>
      <span>${escapeHtml(insight.readTime)}</span>
    </div>
    <h3 style="font-size:17px;line-height:1.5;margin:0 0 8px 0;font-weight:800;">${escapeHtml(insight.headline)}</h3>
    <div style="color:#475569;font-size:14px;line-height:1.8;">${renderTextBlock(insight.summary, 'color:#475569;font-size:14px;line-height:1.8;')}</div>
  </a>
`

const renderArticle = (insight) => {
  const metrics = Array.isArray(insight.data) ? insight.data : []
  const metricHtml = metrics.map((row) => `
    <div style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
      <p style="margin:0;font-size:11px;color:#64748b;font-weight:700;">${escapeHtml(row?.label || '')}</p>
      <p style="margin:4px 0 0 0;font-size:20px;color:#0f172a;font-weight:800;">${escapeHtml(row?.value || '')}</p>
      ${(row?.note ? `<p style="margin:2px 0 0 0;font-size:11px;color:#64748b;">${escapeHtml(row.note)}</p>` : '')}
    </div>
  `).join('')

  return `
    <a href="/insights" style="display:inline-block;margin-bottom:14px;font-size:13px;color:#64748b;text-decoration:none;font-weight:700;">← インサイト一覧に戻る</a>
    <article style="border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;background:#ffffff;box-shadow:0 1px 2px rgba(15,23,42,.06);">
      <div style="height:4px;background:linear-gradient(90deg,#f97316,#f59e0b,transparent)"></div>
      <div style="padding:24px;border-bottom:1px solid #e2e8f0;">
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:11px;color:#64748b;margin-bottom:12px;">
          <span style="padding:2px 8px;border-radius:8px;background:#f1f5f9;font-weight:700;">${escapeHtml(insight.category)}</span>
          <span>${escapeHtml(insight.date)}</span>
          <span>・</span>
          <span>読了 ${escapeHtml(insight.readTime)}</span>
        </div>
        <h1 style="font-size:30px;line-height:1.35;margin:0;color:#0f172a;font-weight:900;">${escapeHtml(insight.headline)}</h1>
        <div style="margin-top:12px;">${renderTextBlock(insight.summary, 'color:#475569;font-size:15px;line-height:1.8;')}</div>
        <div style="margin-top:14px;border:1px solid #fdba74;background:#fff7ed;padding:10px 12px;border-radius:12px;">
          <p style="margin:0;font-size:14px;font-weight:900;color:#0f172a;">MoneyMart リサーチ</p>
          <p style="margin:3px 0 0 0;font-size:12px;color:#64748b;">中立・データドリブンの投資分析</p>
        </div>
      </div>
      <div style="padding:24px;display:grid;gap:18px;">
        <section>
          <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:.08em;font-weight:900;color:#059669;">投資テーゼ</p>
          <div>${renderTextBlock(insight.idea, 'color:#1e293b;font-size:15px;line-height:1.95;')}</div>
        </section>
        <section>
          <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:.08em;font-weight:900;color:#2563eb;">根拠</p>
          <div>${renderTextBlock(insight.rationale, 'color:#1e293b;font-size:15px;line-height:1.95;')}</div>
        </section>
        <section style="border:1px solid #e2e8f0;background:#f8fafc;border-radius:14px;padding:16px;">
          <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:.08em;font-weight:900;color:#64748b;">主要データ</p>
          ${metricHtml}
          ${insight.dataNote ? `<p style="margin:10px 0 0 0;font-size:12px;color:#64748b;">${escapeHtml(insight.dataNote)}</p>` : ''}
        </section>
        <section style="border:1px solid #fcd34d;background:#fffbeb;border-radius:14px;padding:16px;">
          <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:.08em;font-weight:900;color:#b45309;">リスク要因</p>
          <div>${renderTextBlock(insight.risk, 'color:#1e293b;font-size:15px;line-height:1.95;')}</div>
        </section>
        <section style="border:1px solid #fdba74;background:#fff7ed;border-radius:14px;padding:16px;">
          <p style="margin:0 0 8px 0;font-size:14px;font-weight:900;color:#c2410c;">この分析に関連するツール</p>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">${renderToolPills(insight.relatedTools)}</div>
          <p style="margin:8px 0 0 0;font-size:12px;color:#c2410c;">インサイト → データ確認 の順で使うと、判断精度が上がります。</p>
        </section>
      </div>
    </article>
  `
}

const renderListPage = (insights = [], featured = null) => `
  ${featured ? `
    <a href="/insights?id=${encodeURIComponent(String(featured.id))}" style="display:block;text-decoration:none;border:1px solid #e2e8f0;border-radius:18px;padding:22px;background:#ffffff;color:#0f172a;box-shadow:0 1px 2px rgba(15,23,42,.06);">
      <div style="display:flex;align-items:center;gap:8px;font-size:11px;margin-bottom:10px;">
        <span style="padding:2px 8px;border-radius:8px;border:1px solid #fdba74;background:#fff7ed;color:#c2410c;font-weight:900;">FEATURED</span>
        <span style="padding:2px 8px;border-radius:8px;background:#f1f5f9;color:#64748b;font-weight:700;">${escapeHtml(featured.category)}</span>
        <span style="color:#64748b;">${escapeHtml(featured.date)}</span>
        <span style="color:#cbd5e1;">·</span>
        <span style="color:#64748b;">${escapeHtml(featured.readTime)}</span>
      </div>
      <h2 style="font-size:28px;line-height:1.35;margin:0;font-weight:900;">${escapeHtml(featured.headline)}</h2>
      <div style="margin-top:12px;">${renderTextBlock(featured.summary, 'color:#475569;font-size:15px;line-height:1.8;')}</div>
      <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;">${renderToolPills(featured.relatedTools)}</div>
    </a>
  ` : ''}

  <section style="margin-top:20px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
      <p style="margin:0;font-size:11px;letter-spacing:.12em;font-weight:900;color:#64748b;">最近の分析</p>
      <div style="height:1px;background:#e2e8f0;flex:1;"></div>
    </div>
    ${insights.filter((item) => !item.featured).map((item) => renderListItem(item)).join('')}
  </section>
`

function sendHtml(res, status, html) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(html)
}

export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return sendHtml(res, 500, '<h1>Insights unavailable</h1><p>Missing Supabase environment variables.</p>')
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
    const { data, error } = await supabase
      .from('insights_editorial')
      .select('id,featured,target,category,headline,summary,idea,rationale,data,data_note,risk,related_tools,published_at,read_time,sort_order,is_active')
      .eq('is_active', true)
      .order('featured', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('published_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(200)

    if (error) throw error

    const insights = (data || []).map(normalizeInsight).filter((row) => row.headline && row.summary)
    const featured = insights.find((row) => row.featured) || insights[0] || null
    const selectedId = Number(req?.query?.id || 0)
    const selected = selectedId > 0 ? insights.find((item) => Number(item.id) === selectedId) : null

    const bodyContent = selected ? renderArticle(selected) : renderListPage(insights, featured)

    const listTitle = '投資インサイト一覧・相場分析 | MoneyMart'
    const listDescription = 'データに基づく投資インサイトを無料で配信。ETF比較ツールやマーケット指標と併用し、NISA・分散投資の判断に役立つ分析記事を読めます。'
    const pageTitle = selected ? `${selected.headline} | MoneyMart` : listTitle
    const pageDescription = selected ? selected.summary : listDescription
    const canonicalPath = selected && selectedId > 0 ? `/insights?id=${selectedId}` : '/insights'
    const articleLd = selected
      ? {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: selected.headline,
        description: selected.summary,
        datePublished: selected.date || undefined,
      }
      : null
    const jsonLd = articleLd
      ? [articleLd]
      : [webApplicationLd({ name: 'MoneyMart 投資インサイト', url: '/insights' })]

    const head = buildHeadBlock({
      title: pageTitle,
      description: pageDescription,
      canonicalPath,
      jsonLd,
    })

    const html = `<!doctype html>
<html lang="ja">
  <head>${head}
  </head>
  <body style="margin:0;background:#f8fafc;font-family:'Noto Sans JP',system-ui,-apple-system,sans-serif;color:#0f172a;">
    <main style="max-width:960px;margin:0 auto;padding:28px 16px 40px 16px;">
      <header style="margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11px;letter-spacing:.18em;font-weight:900;color:#64748b;">MONEYMART RESEARCH</p>
        <h1 style="margin:8px 0 0 0;font-size:42px;line-height:1.15;font-weight:900;">投資インサイト</h1>
        <p style="margin:10px 0 0 0;font-size:14px;line-height:1.8;color:#475569;">
          コミュニティ投稿ではなく、編集コンテンツとして公開する分析記事です。データと根拠に基づく判断材料を提供します。
        </p>
      </header>
      ${bodyContent}
      <footer style="margin-top:22px;border-top:1px solid #e2e8f0;padding-top:12px;font-size:11px;color:#64748b;line-height:1.7;">
        本コンテンツは情報提供のみを目的としており、特定の金融商品の購入・売却を推奨するものではありません。投資判断はご自身の責任でお願いいたします。
      </footer>
    </main>
  </body>
</html>`

    return sendHtml(res, 200, html)
  } catch (e) {
    const message = escapeHtml(e?.message || 'Unknown error')
    return sendHtml(res, 500, `<!doctype html><html lang="ja"><body><h1>Insights unavailable</h1><p>${message}</p></body></html>`)
  }
}

