/**
 * /insights のクローラ向け HTML（middleware 経由で Bot UA のみ）。
 * insight_articles を優先し、無ければ insights_editorial にフォールバック。
 */
import { createClient } from '@supabase/supabase-js'
import { articleJsonLd, breadcrumbListJsonLd, buildHeadBlock, webApplicationLd, getSiteOrigin } from './lib/seoHead.js'
import { MM_PATH_PREFIXES_INSIGHTS, parseMmPathForSsr } from './lib/mmPathAllowlist.js'
import { normalizeInsightDocumentForRender } from '../../src/lib/insightDocumentNormalize.js'

const SITE_LIST_H1 = 'MoneyMart Insights｜市場・経済・テクノロジー最新インサイト'

const TOPIC_LINKS = [
  { key: 'nisa', label: '#新NISA' },
  { key: 'household', label: '#家計' },
  { key: 'mortgage', label: '#住宅ローン' },
  { key: 'market', label: '#マーケット' },
  { key: 'global', label: '#グローバル' },
]

function topicKeywords(key) {
  const k = String(key || '').toLowerCase()
  const map = {
    nisa: ['nisa', '新nisa', 'つみたて', '成長投資', '累積投資'],
    household: ['家計', '家計金融', '金融資産', '貯蓄'],
    mortgage: ['ローン', '住宅', '金利', '借入'],
    market: ['マーケット', '相場', '指数', 'sentiment', 'センチメント'],
    global: ['グローバル', '世界', '分散', '地政学', '為替'],
  }
  return map[k] || []
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function stripHtml(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sendHtml(res, status, html) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(html)
}

/** @returns {{ pathname: string, queryParams: URLSearchParams }} */
function readRoute(req) {
  const full = String(req.url || '')
  const qIdx = full.indexOf('?')
  const search = qIdx >= 0 ? full.slice(qIdx + 1) : ''
  const outerQs = new URLSearchParams(search)
  const mm = outerQs.get('__mm_path')
  if (mm) {
    const parsed = parseMmPathForSsr(mm, MM_PATH_PREFIXES_INSIGHTS)
    if (parsed.ok) {
      return { pathname: parsed.pathname, queryParams: parsed.queryParams }
    }
    return { pathname: '/insights', queryParams: new URLSearchParams() }
  }
  let pathname = qIdx >= 0 ? full.slice(0, qIdx) : full
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1)
  if (!pathname) pathname = '/insights'
  if (pathname.startsWith('/api/ssr/insights')) pathname = '/insights'
  return { pathname, queryParams: outerQs }
}

function normalizeDbDocument(raw) {
  if (raw == null) return {}
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw)
      return p && typeof p === 'object' ? p : {}
    } catch {
      return {}
    }
  }
  return {}
}

function mapInsightArticleRow(row) {
  const doc = normalizeInsightDocumentForRender(normalizeDbDocument(row?.document))
  return {
    kind: 'article',
    id: row?.id,
    slug: String(row?.slug || '').trim(),
    pageTitle: String(row?.page_title || '').trim() || 'インサイト',
    publishedAt: row?.published_at || null,
    updatedAt: row?.updated_at || null,
    document: doc,
  }
}

function buildPreviewText(doc) {
  const d = doc && typeof doc === 'object' ? doc : {}
  const heroSub = String(d.hero?.sub || '').trim()
  if (heroSub) return heroSub
  const prose = Array.isArray(d.sections) ? d.sections.find((s) => s?.type === 'prose') : null
  const lead = String(prose?.lead || '').trim()
  if (lead) return stripHtml(lead)
  const p = Array.isArray(prose?.paragraphs) ? prose.paragraphs.find(Boolean) : ''
  const raw = String(p || '').trim()
  return stripHtml(raw) || 'MoneyMartの編集インサイト記事です。'
}

function categoryLabelFromDoc(doc) {
  const admin = doc?.admin && typeof doc.admin === 'object' ? doc.admin : null
  const c = admin ? String(admin.category || '').trim() : ''
  if (c) return c
  const badge = String(doc?.hero?.badge || '').trim()
  if (badge) return badge.split(/[—\-–]/)[0].trim() || badge
  return 'インサイト'
}

function formatDateJp(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10)
  return d.toLocaleDateString('ja-JP')
}

function articleMatchesTopic(row, topicKey) {
  const keys = topicKeywords(topicKey)
  if (!keys.length) return true
  const doc = row.document || {}
  const cat = categoryLabelFromDoc(doc).toLowerCase()
  const title = String(row.pageTitle || '').toLowerCase()
  const prev = buildPreviewText(doc).toLowerCase()
  const blob = `${cat} ${title} ${prev}`
  return keys.some((k) => blob.includes(k.toLowerCase()))
}

/** 一覧ページ向け ItemList（クローラが記事 URL を構造化データでも拾えるように） */
function buildInsightsItemListLd(rows, topicKey = '') {
  const base = getSiteOrigin()
  const filtered = topicKey ? rows.filter((r) => articleMatchesTopic(r, topicKey)) : rows
  const slice = filtered.slice(0, 40)
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: topicKey
      ? `MoneyMart Insights — ${TOPIC_LINKS.find((t) => t.key === topicKey)?.label || topicKey}`
      : 'MoneyMart Insights 記事一覧',
    numberOfItems: slice.length,
    itemListElement: slice.map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${base}/insights/${encodeURIComponent(r.slug)}`,
      name: r.pageTitle,
    })),
  }
}

function toDateText(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

const normalizeLegacyInsight = (row) => ({
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

function renderLegacyListItem(insight) {
  return `
  <a href="/insights?id=${encodeURIComponent(String(insight.id))}" style="display:block;text-decoration:none;border:1px solid #e2e8f0;border-radius:16px;padding:18px;background:#ffffff;color:#0f172a;margin-top:12px;">
    <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#64748b;margin-bottom:8px;">
      <span style="padding:2px 8px;border-radius:8px;background:#f1f5f9;font-weight:700;">${escapeHtml(insight.category)}</span>
      <span>${escapeHtml(insight.date)}</span>
      <span>・</span>
      <span>${escapeHtml(insight.readTime)}</span>
    </div>
    <h2 style="font-size:17px;line-height:1.5;margin:0 0 8px 0;font-weight:800;">${escapeHtml(insight.headline)}</h2>
    <p style="margin:0;color:#475569;font-size:14px;line-height:1.8;">${escapeHtml(insight.summary)}</p>
  </a>`
}

function renderLegacyArticle(insight) {
  return `
    <a href="/insights" style="display:inline-block;margin-bottom:14px;font-size:13px;color:#64748b;text-decoration:none;font-weight:700;">← インサイト一覧に戻る</a>
    <article style="border:1px solid #e2e8f0;border-radius:18px;padding:24px;background:#ffffff;">
      <p style="margin:0 0 8px;font-size:11px;color:#64748b;font-weight:700;">${escapeHtml(insight.category)} · ${escapeHtml(insight.date)}</p>
      <h1 style="font-size:28px;line-height:1.35;margin:0;color:#0f172a;font-weight:900;">${escapeHtml(insight.headline)}</h1>
      <p style="margin-top:14px;font-size:15px;line-height:1.85;color:#334155;">${escapeHtml(insight.summary)}</p>
    </article>`
}

async function loadLegacyInsights(supabase) {
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
  return (data || []).map(normalizeLegacyInsight).filter((row) => row.headline && row.summary)
}

/** @param {{ slug: string, pageTitle: string, publishedAt: string|null, document: object }[]} rows */
function renderModernList(rows, { topicKey } = {}) {
  const filtered = topicKey ? rows.filter((r) => articleMatchesTopic(r, topicKey)) : rows
  const topicTitle = topicKey
    ? TOPIC_LINKS.find((t) => t.key === topicKey)?.label || `#${topicKey}`
    : null

  const cards = filtered.map((row) => {
    const prev = escapeHtml(buildPreviewText(row.document).slice(0, 220))
    const cat = escapeHtml(categoryLabelFromDoc(row.document))
    const date = escapeHtml(formatDateJp(row.publishedAt || row.updatedAt))
    const slugEnc = encodeURIComponent(row.slug)
    const url = `/insights/${slugEnc}`
    return `
  <article style="margin-top:14px;padding:18px;border:1px solid #e2e8f0;border-radius:16px;background:#fff;">
    <p style="margin:0 0 6px;font-size:11px;color:#64748b;font-weight:700;">${cat} · ${date}</p>
    <h2 style="margin:0 0 8px;font-size:18px;line-height:1.45;font-weight:900;">
      <a href="${escapeHtml(url)}" style="color:#0f172a;text-decoration:none;">${escapeHtml(row.pageTitle)}</a>
    </h2>
    <p style="margin:0;font-size:14px;line-height:1.75;color:#475569;">${prev}${prev.length >= 220 ? '…' : ''}</p>
    <p style="margin:10px 0 0;font-size:12px;font-weight:800;"><a href="${escapeHtml(url)}" style="color:#c2410c;">続きを読む →</a></p>
  </article>`
  }).join('')

  const tags = TOPIC_LINKS.map((t) => (
    `<a href="/insights/category/${escapeHtml(t.key)}" style="display:inline-block;margin:4px 8px 4px 0;padding:6px 12px;border-radius:999px;background:#fff7ed;color:#9a3412;font-weight:800;font-size:12px;text-decoration:none;border:1px solid #fdba74;">${escapeHtml(t.label)}</a>`
  )).join('')

  const topicBanner = topicTitle
    ? `<p style="margin:0 0 12px;font-size:13px;color:#475569;">カテゴリ <strong>${topicTitle}</strong> に関連する記事です。</p>`
    : ''

  return `
    ${topicBanner}
    <section aria-label="記事一覧">
      ${cards || '<p style="color:#64748b;">該当する記事がありません。</p>'}
    </section>
    <nav style="margin-top:22px;padding-top:18px;border-top:1px solid #e2e8f0;" aria-label="テーマタグ">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:.12em;font-weight:900;color:#64748b;">テーマ</p>
      <div>${tags}</div>
    </nav>
  `
}

function absolutePublicAssetUrl(rawUrl) {
  const base = getSiteOrigin().replace(/\/$/, '')
  const u = String(rawUrl || '').trim()
  if (!u) return ''
  if (/^https?:\/\//i.test(u)) return u
  if (u.startsWith('//')) return `https:${u}`
  const path = u.startsWith('/') ? u : `/${u}`
  return `${base}${path}`
}

function coverImageUrlFromInsightHit(hit) {
  const doc = hit?.document && typeof hit.document === 'object' ? hit.document : {}
  const admin = doc.admin && typeof doc.admin === 'object' ? doc.admin : {}
  const fromAdmin = String(admin.coverImageUrl || '').trim()
  if (fromAdmin) return absolutePublicAssetUrl(fromAdmin)
  const hero = doc.hero && typeof doc.hero === 'object' ? doc.hero : {}
  const fromHero = String(hero.coverImageUrl || '').trim()
  return absolutePublicAssetUrl(fromHero)
}

function renderModernArticle(row) {
  const prev = escapeHtml(buildPreviewText(row.document).slice(0, 520))
  const cat = escapeHtml(categoryLabelFromDoc(row.document))
  const date = escapeHtml(formatDateJp(row.publishedAt || row.updatedAt))
  return `
    <nav style="font-size:13px;color:#64748b;margin-bottom:14px;">
      <a href="/" style="color:#64748b;text-decoration:none;font-weight:700;">ホーム</a>
      ／ <a href="/insights" style="color:#64748b;text-decoration:none;font-weight:700;">インサイト</a>
    </nav>
    <article style="border:1px solid #e2e8f0;border-radius:18px;padding:24px;background:#ffffff;">
      <p style="margin:0 0 8px;font-size:11px;color:#64748b;font-weight:700;">${cat} · MoneyMart編集部 · ${date}</p>
      <h1 style="font-size:28px;line-height:1.35;margin:0;color:#0f172a;font-weight:900;">${escapeHtml(row.pageTitle)}</h1>
      <p style="margin-top:16px;font-size:15px;line-height:1.85;color:#334155;">${prev}${prev.length >= 520 ? '…' : ''}</p>
      <p style="margin-top:14px;font-size:13px;line-height:1.8;color:#475569;">
        全文・図表はブラウザでご覧ください。本記事は情報提供であり、投資助言ではありません。
        <a href="/legal/methodology" style="color:#c2410c;font-weight:800;">編集・データ方針</a>
      </p>
      <p style="margin-top:16px;font-size:14px;font-weight:800;">
        <a href="/etf-compare" style="color:#c2410c;margin-right:14px;">ETFを比較する</a>
        <a href="/tools/nisa-etf-checklist" style="color:#c2410c;margin-right:14px;">NISAの確認項目</a>
        <a href="/dividend-calendar" style="color:#c2410c;">配当予定を見る</a>
      </p>
    </article>`
}

function wrapInsightsPage(head, bodyInner) {
  return `<!doctype html>
<html lang="ja">
  <head>${head}</head>
  <body style="margin:0;background:#f8fafc;font-family:'Noto Sans JP',system-ui,-apple-system,sans-serif;color:#0f172a;">
    <main style="max-width:760px;margin:0 auto;padding:28px 16px 40px 16px;">
      ${bodyInner}
    </main>
  </body>
</html>`
}

export default async function handler(req, res) {
  const { pathname } = readRoute(req)
  const origin = getSiteOrigin()

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY

  const fallbackHead = buildHeadBlock({
    title: 'インサイト｜NISA・家計・マーケットの編集記事 | MoneyMart',
    description: '家計・資産・マーケットをデータで読み解く MoneyMart 編集インサイト。投資助言ではありません。',
    canonicalPath: pathname || '/insights',
    jsonLd: [
      webApplicationLd({ name: 'MoneyMart Insights', url: '/insights' }),
      breadcrumbListJsonLd(origin, [
        { name: 'ホーム', path: '/' },
        { name: 'インサイト', path: '/insights' },
      ]),
    ],
  })

  if (!supabaseUrl || !supabaseKey) {
    return sendHtml(res, 200, wrapInsightsPage(fallbackHead, `
      <h1 style="font-size:28px;font-weight:900;">MoneyMart Insights</h1>
      <p style="line-height:1.8;color:#475569;">編集インサイトの一覧は、ブラウザで本ページを開くとご覧いただけます。</p>
      <p><a href="/etf-compare" style="color:#c2410c;font-weight:800;">ETFを比較する</a></p>
    `))
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
    const { data, error } = await supabase
      .from('insight_articles')
      .select('id,slug,page_title,published_at,updated_at,document')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(200)
    if (error) throw error
    const rows = (data || []).map(mapInsightArticleRow).filter((r) => r.slug)

    const categoryMatch = String(pathname || '').match(/^\/insights\/category\/([^/]+)$/)
    const slugMatch = String(pathname || '').match(/^\/insights\/([^/]+)$/)
    const topicKey = categoryMatch ? decodeURIComponent(categoryMatch[1]) : ''
    const slug = (!categoryMatch && slugMatch && slugMatch[1] !== 'category')
      ? decodeURIComponent(slugMatch[1])
      : ''

    if (slug) {
      const row = rows.find((r) => r.slug === slug)
      if (!row) {
        const notHead = buildHeadBlock({
          title: '記事が見つかりません | MoneyMart',
          description: '指定のインサイト記事は公開されていないか、URLが異なります。',
          canonicalPath: '/insights',
          noIndex: true,
        })
        return sendHtml(res, 404, wrapInsightsPage(notHead, `
          <h1 style="font-size:26px;font-weight:900;">記事が見つかりません</h1>
          <p style="line-height:1.8;"><a href="/insights" style="color:#c2410c;font-weight:800;">インサイト一覧へ</a></p>
        `))
      }
      const desc = buildPreviewText(row.document).slice(0, 160)
      const cover = coverImageUrlFromInsightHit(row)
      const isoPub = toDateText(row.publishedAt) || undefined
      const isoMod = toDateText(row.updatedAt) || isoPub
      const pageUrl = `${origin}/insights/${encodeURIComponent(row.slug)}`
      const head = buildHeadBlock({
        title: `${row.pageTitle} | MoneyMart`,
        description: desc,
        canonicalPath: `/insights/${encodeURIComponent(row.slug)}`,
        ogType: 'article',
        ogImageAbsoluteUrl: cover || undefined,
        jsonLd: [
          articleJsonLd(origin, {
            headline: row.pageTitle,
            description: desc,
            url: pageUrl,
            datePublished: isoPub,
            dateModified: isoMod,
            image: cover || undefined,
          }),
          breadcrumbListJsonLd(origin, [
            { name: 'ホーム', path: '/' },
            { name: 'インサイト', path: '/insights' },
            { name: row.pageTitle, path: `/insights/${encodeURIComponent(row.slug)}` },
          ]),
        ],
      })
      return sendHtml(res, 200, wrapInsightsPage(head, renderModernArticle(row)))
    }

    const topicLabel = TOPIC_LINKS.find((t) => t.key === topicKey)?.label
    const listTitle = topicLabel
      ? `インサイト ${topicLabel} | MoneyMart`
      : SITE_LIST_H1
    const listDesc = topicLabel
      ? `${topicLabel} に関連する MoneyMart 編集インサイト。公開日とリードを掲載しています。`
      : '家計・資産・マーケットをデータで読み解く MoneyMart 編集インサイト。投資助言ではありません。'
    const listPath = topicKey ? `/insights/category/${topicKey}` : '/insights'
    const head = buildHeadBlock({
      title: listTitle,
      description: listDesc,
      canonicalPath: listPath,
      jsonLd: [
        buildInsightsItemListLd(rows, topicKey),
        breadcrumbListJsonLd(origin, [
          { name: 'ホーム', path: '/' },
          { name: 'インサイト', path: '/insights' },
          ...(topicLabel ? [{ name: topicLabel, path: listPath }] : []),
        ]),
      ],
    })
    const heading = topicLabel ? `インサイト ${topicLabel}` : SITE_LIST_H1
    const body = `
      <h1 style="margin:0 0 10px;font-size:30px;font-weight:900;">${escapeHtml(heading)}</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.8;color:#475569;">
        MoneyMart編集部が公開情報をもとに整理した分析です。著者名のない記事は編集部名義です。
        <a href="/legal/methodology" style="color:#c2410c;font-weight:800;">編集・データ方針</a>
      </p>
      ${renderModernList(rows, { topicKey })}
      <p style="margin-top:22px;font-size:14px;font-weight:800;">
        <a href="/etf-compare" style="color:#c2410c;margin-right:14px;">ETFを比較する</a>
        <a href="/tools/nisa-etf-checklist" style="color:#c2410c;">NISAの確認項目</a>
      </p>`
    return sendHtml(res, 200, wrapInsightsPage(head, body))
  } catch (e) {
    const message = escapeHtml(e?.message || 'Unknown error')
    return sendHtml(res, 200, wrapInsightsPage(fallbackHead, `
      <h1 style="font-size:26px;font-weight:900;">インサイト</h1>
      <p style="line-height:1.8;color:#475569;">記事一覧を取得できませんでした。ブラウザで再度お試しください。</p>
      <p style="display:none;">${message}</p>
    `))
  }
}

