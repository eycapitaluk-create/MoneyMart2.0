import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import {
  fetchTheNewsApiArticles,
  getTheNewsApiToken,
  normalizeTheNewsApiArticle,
  toIsoDateDaysAgo,
} from './the-news-api.js'
import {
  fetchNewsDataIoArticles,
  getNewsDataIoToken,
  normalizeNewsDataIoArticle,
} from './newsdata-api.js'

const readLocalEnvMap = () => {
  const candidates = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), 'utn/.env.local'),
  ]
  for (const envPath of candidates) {
    try {
      if (!fs.existsSync(envPath)) continue
      const raw = fs.readFileSync(envPath, 'utf8')
      const map = {}
      raw.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) return
        const equalIdx = trimmed.indexOf('=')
        if (equalIdx <= 0) return
        const key = trimmed.slice(0, equalIdx).replace(/^export\s+/, '').trim()
        let value = trimmed.slice(equalIdx + 1).trim()
        if (
          (value.startsWith('"') && value.endsWith('"'))
          || (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        map[key] = value
      })
      return map
    } catch {
      // Ignore local env read errors and fall back to process.env only.
    }
  }
  return {}
}

const localEnvMap = readLocalEnvMap()
export const getServerEnv = (key) => process.env[key] || localEnvMap[key]

const toJpTime = (value) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '--:--'
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const normalizeLanguage = (value = '') => {
  const v = String(value || '').toLowerCase()
  return v === 'japanese' ? 'ja' : v
}

const detectTopic = (article = {}) => {
  const text = `${article.title || ''} ${article.description || ''}`.toLowerCase()
  if (text.includes('ai') || text.includes('人工知能')) return 'AI'
  if (text.includes('関税') || text.includes('tariff') || text.includes('制裁') || text.includes('sanction') || text.includes('選挙') || text.includes('election') || text.includes('ホワイトハウス') || text.includes('white house') || text.includes('財務省') || text.includes('treasury')) return 'Policy'
  if (text.includes('金融') || text.includes('bank') || text.includes('金利') || text.includes('為替') || text.includes('finance') || text.includes('financial')) return 'Financial'
  if (text.includes('決算') || text.includes('earnings')) return 'Earnings'
  if (text.includes('株') || text.includes('market') || text.includes('日経') || text.includes('topix')) return 'Market'
  return 'Business'
}

const uniqueByTitle = (rows) => {
  const used = new Set()
  const out = []
  for (const row of rows) {
    const key = String(row?.title || '').trim().toLowerCase()
    if (!key || used.has(key)) continue
    used.add(key)
    out.push(row)
  }
  return out
}

const pickByKeywords = (rows, keywords, min = 4) => {
  const hits = rows.filter((row) => {
    const text = `${row.title || ''} ${row.description || ''}`.toLowerCase()
    return keywords.some((k) => text.includes(k))
  })
  if (hits.length >= min) return hits
  return rows
}

const normalizeSecret = (value = '') => {
  const raw = String(value || '').trim()
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1).trim()
  }
  return raw
}

const inferBriefTone = (headline = '') => {
  const h = String(headline).toLowerCase()
  if (/(反発|上昇|続伸|回復|改善|堅調)/.test(h)) return 'やや強気'
  if (/(下落|反落|懸念|悪化|減速|弱含み)/.test(h)) return 'やや慎重'
  return '中立'
}

const MARKET_NEWS_SEARCH_QUERY = '((日経平均 | TOPIX | 株価 | 日本株 | 米国株 | 投資 | 投資信託 | ETF | ファンド | NISA) | (為替 | ドル円 | 円安 | 円高 | 金利 | 利下げ | 利上げ | CPI | インフレ | 物価 | GDP | 雇用 | 景気) | (日銀 | BOJ | FOMC | Fed | FRB | 米連邦準備制度 | 財務省 | Treasury | S&P500 | "S&P 500" | 関税 | 通商 | 制裁 | 地政学 | 外交 | 選挙 | 政策 | ホワイトハウス | White House | recession | inflation | "Japan economy" | "Japan stock" | "US economy" | tariff | sanctions | geopolitics))'
const MARKET_NEWS_LANGUAGES = 'ja,en'
const MARKET_NEWS_LOCALES = 'jp,us'
// TheNewsAPI does not support an "economy" category, so macro coverage is handled via the search query.
const MARKET_NEWS_CATEGORIES = 'business,politics'
const MARKET_NEWS_RELEVANCE_KEYWORDS = [
  '日経平均', '日経', 'topix', 'nikkei', '株価', '日本株', '米国株', '投資', 'ファンド', 'etf',
  '為替', 'ドル円', 'yen', '円安', '円高', '金利', '利下げ', '利上げ', 'インフレ', 'inflation',
  '景気後退', 'recession', '日銀', 'boj', 'fed', 'fomc', '関税', 'tariff', 'trump tariff',
  's&p 500', '経済', 'japan economy', 'japan stock', '債券', '政策', 'politics', 'political',
  'ホワイトハウス', 'white house', '財務省', 'treasury', '制裁', 'sanction', 'geopolitics',
  '地政学', '選挙', 'election', '通商', 'trade', 'gdp', '雇用', 'cpi', 'インフレ率',
]
const TARGET_MARKET_NEWS_ITEMS = 6

const isRelevantMarketNews = (article = {}) => {
  const text = `${article.title || ''} ${article.description || ''}`.toLowerCase()
  const categoryText = Array.isArray(article?.categories) ? article.categories.join(' ').toLowerCase() : ''
  return MARKET_NEWS_RELEVANCE_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()))
    || /(politic|policy|economy|business|finance|market|financial)/.test(categoryText)
}

const hasUsableArticleUrl = (row = {}) => /^https?:\/\//i.test(String(row?.url || '').trim())

const translateArticleToJapanese = async (article, apiKey) => {
  const prompt = `
You are translating financial market news for a Japanese investment app.
Return JSON only. No markdown.
Write natural Japanese.

Source title: "${article.title || ''}"
Source description: "${article.description || ''}"
Source: ${article.source || 'Unknown'}

Rules:
- Translate the title into concise Japanese suitable for a news card.
- Rewrite the description into Japanese in 1-2 sentences, max 120 characters.
- Preserve finance and macro terms accurately.
- Do not invent facts not present in the source.

Return exactly:
{
  "title": "日本語タイトル",
  "description": "日本語要約"
}
  `.trim()

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const payload = await res.json()
  if (!res.ok) {
    throw new Error(payload?.error?.message || `Anthropic request failed (${res.status})`)
  }

  const text = Array.isArray(payload?.content)
    ? payload.content.map((row) => String(row?.text || '')).join('\n')
    : ''

  const cleaned = String(text).replace(/```json|```/gi, '').trim()
  let parsed = null
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) parsed = JSON.parse(cleaned.slice(start, end + 1))
  }

  const title = String(parsed?.title || '').trim()
  const description = String(parsed?.description || '').trim()
  if (!title) throw new Error('Anthropic translation did not return a title')

  return {
    ...article,
    title,
    description: description || String(article.description || '').slice(0, 120),
    language: 'ja',
    time_text: article.time_text || toJpTime(article.published_at),
  }
}

export const refreshMarketNewsManualFeed = async () => {
  const SUPABASE_URL = getServerEnv('SUPABASE_URL')
  const SUPABASE_SERVICE_ROLE_KEY = getServerEnv('SUPABASE_SERVICE_ROLE_KEY') || getServerEnv('SUPABASE_SECRET_KEY')
  const THE_NEWS_API_TOKEN = getTheNewsApiToken(getServerEnv)
  const NEWSDATA_API_KEY = getNewsDataIoToken(getServerEnv)
  const ANTHROPIC_API_KEY = normalizeSecret(getServerEnv('ANTHROPIC_API_KEY') || getServerEnv('CLAUDE_API_KEY'))
  const missingEnv = []
  if (!SUPABASE_URL) missingEnv.push('SUPABASE_URL')
  if (!SUPABASE_SERVICE_ROLE_KEY) missingEnv.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!THE_NEWS_API_TOKEN && !NEWSDATA_API_KEY) missingEnv.push('THENEWSAPI_API_TOKEN or NEWSDATA_API_KEY')
  if (missingEnv.length > 0) {
    return { status: 500, body: { ok: false, error: `Missing server env vars: ${missingEnv.join(', ')}` } }
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  let normalized = []
  const sourceRows = []
  const sourceErrors = []

  const publishedAfter = toIsoDateDaysAgo(5)
  const extendedPublishedAfter = toIsoDateDaysAgo(10)

  if (THE_NEWS_API_TOKEN) {
    try {
      const primary = await fetchTheNewsApiArticles({
        apiToken: THE_NEWS_API_TOKEN,
        search: MARKET_NEWS_SEARCH_QUERY,
        searchFields: 'title,description,keywords',
        language: MARKET_NEWS_LANGUAGES,
        locale: MARKET_NEWS_LOCALES,
        categories: MARKET_NEWS_CATEGORIES,
        limit: 50,
        sort: 'published_at',
        publishedAfter,
      })
      const fallback = primary.length >= 20
        ? []
        : await fetchTheNewsApiArticles({
          apiToken: THE_NEWS_API_TOKEN,
          search: '日経平均 | TOPIX | 日本株 | 米国株 | 為替 | ドル円 | 円安 | 円高 | 金利 | インフレ | 物価 | 日銀 | FOMC | FRB | S&P500 | 関税 | トランプ関税 | 財務省 | 政策 | 通商 | 制裁 | 地政学 | 選挙',
          searchFields: 'title,description,keywords',
          language: MARKET_NEWS_LANGUAGES,
          locale: MARKET_NEWS_LOCALES,
          categories: MARKET_NEWS_CATEGORIES,
          limit: 50,
          sort: 'published_at',
          publishedAfter,
        })
      const broadFallback = primary.length + fallback.length >= 30
        ? []
        : await fetchTheNewsApiArticles({
          apiToken: THE_NEWS_API_TOKEN,
          search: 'Japan economy | Japan stock | US economy | Nikkei | TOPIX | BOJ | yen | dollar yen | interest rate | inflation | recession | tariff | sanctions | geopolitics | election | White House | Treasury | trade policy | S&P 500',
          searchFields: 'title,description,keywords',
          language: MARKET_NEWS_LANGUAGES,
          locale: MARKET_NEWS_LOCALES,
          categories: MARKET_NEWS_CATEGORIES,
          limit: 50,
          sort: 'published_at',
          publishedAfter,
        })
      const globalFallback = primary.length + fallback.length + broadFallback.length >= 45
        ? []
        : await fetchTheNewsApiArticles({
          apiToken: THE_NEWS_API_TOKEN,
          search: 'global markets | wall street | treasury yield | bond yield | oil prices | geopolitics | trade war | sanctions | White House | Congress | China tariff | Fed | BOJ | ECB | inflation | recession | election | global economy | stock market',
          searchFields: 'title,description,keywords',
          language: MARKET_NEWS_LANGUAGES,
          locale: '',
          categories: MARKET_NEWS_CATEGORIES,
          limit: 80,
          sort: 'published_at',
          publishedAfter: extendedPublishedAfter,
        })

      sourceRows.push(...primary, ...fallback, ...broadFallback, ...globalFallback)
    } catch (error) {
      sourceErrors.push(error?.message || 'TheNewsAPI request failed')
    }
  }

  if (NEWSDATA_API_KEY) {
    try {
      const ndPrimary = await fetchNewsDataIoArticles({
        apiToken: NEWSDATA_API_KEY,
        q: '日経平均 OR TOPIX OR 日本株 OR 米国株 OR 為替 OR ドル円 OR 金利 OR inflation OR tariff OR geopolitics',
        language: 'ja,en',
        country: 'jp,us',
        category: 'business,politics',
        size: 10,
      })
      const ndFallback = ndPrimary.length >= 20
        ? []
        : await fetchNewsDataIoArticles({
          apiToken: NEWSDATA_API_KEY,
          q: 'Japan economy OR US economy OR Nikkei OR S&P 500 OR BOJ OR Fed OR recession OR sanctions',
          language: 'ja,en',
          country: 'jp,us',
          category: 'business,politics',
          size: 10,
        })
      sourceRows.push(...ndPrimary, ...ndFallback)
    } catch (error) {
      sourceErrors.push(error?.message || 'NewsData.io request failed')
    }
  }

  normalized = uniqueByTitle(
    sourceRows
      .map((article) => (article?.link ? normalizeNewsDataIoArticle(article, detectTopic) : normalizeTheNewsApiArticle(article, detectTopic)))
      .filter((row) => row.title && hasUsableArticleUrl(row)),
  )

  if (normalized.length === 0 && sourceErrors.length > 0) {
    return {
      status: 502,
      body: {
        ok: false,
        error: sourceErrors.join(' | '),
      },
    }
  }

  // UI requirement: only persist Japanese-language articles for display.
  const relevantRows = normalized.filter((row) => isRelevantMarketNews(row))
  const candidateRows = relevantRows.length >= TARGET_MARKET_NEWS_ITEMS ? relevantRows : normalized
  const japanese = candidateRows.filter((r) => r.language === 'ja')
  const englishFallbackPool = candidateRows.filter((r) => r.language === 'en')
  const translatedEnglish = []
  if (japanese.length < TARGET_MARKET_NEWS_ITEMS && ANTHROPIC_API_KEY && englishFallbackPool.length > 0) {
    for (const row of englishFallbackPool.slice(0, 24)) {
      try {
        translatedEnglish.push(await translateArticleToJapanese(row, ANTHROPIC_API_KEY))
      } catch {
        // Skip failed translations and continue with direct Japanese coverage.
      }
    }
  }

  const now = new Date().toISOString()
  const displayRows = uniqueByTitle([...japanese, ...translatedEnglish])
    .filter((item) => hasUsableArticleUrl(item))
    .sort((a, b) => new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime())
  if (displayRows.length === 0) {
    return { status: 200, body: { ok: true, inserted: 0, note: 'No Japanese or translatable news returned' } }
  }

  const withImage = displayRows.filter((a) => /^https?:\/\//i.test(a.image_url || ''))
  const marketTicker = displayRows.slice(0, 10)
  const marketPickup = uniqueByTitle([...withImage, ...displayRows]).slice(0, TARGET_MARKET_NEWS_ITEMS)
  const fundKeywords = ['投信', '投資信託', 'etf', 'nisa', '資産運用', 'ファンド', '金融', '金利']
  const fundPickup = uniqueByTitle([
    ...pickByKeywords(displayRows, fundKeywords, TARGET_MARKET_NEWS_ITEMS),
    ...displayRows,
  ]).slice(0, TARGET_MARKET_NEWS_ITEMS)
  // stock_disclosures は Supabase へ手動投入のみ（TheNewsAPI 等の自動投入・全件削除はしない）
  const lead = displayRows[0]
  const dailyBrief = {
    tone: inferBriefTone(lead.title),
    title: lead.title,
    description: String(lead.description || '').slice(0, 200),
    source: lead.source || 'TheNewsAPI',
  }

  const rows = []
  const pushBucketRows = (bucket, items) => {
    items.forEach((item, idx) => {
      rows.push({
        bucket,
        sort_order: idx + 1,
        source: item.source,
        title: item.title,
        description: item.description,
        url: item.url,
        image_url: item.image_url || '',
        topic: item.topic,
        time_text: item.time_text,
        language: item.language || 'ja',
        published_at: item.published_at || null,
        tone: null,
        is_active: true,
        updated_at: now,
      })
    })
  }

  pushBucketRows('market_ticker', marketTicker)
  pushBucketRows('market_pickup', marketPickup)
  pushBucketRows('fund_pickup', fundPickup)
  rows.push({
    bucket: 'daily_brief',
    sort_order: 1,
    source: dailyBrief.source,
    title: dailyBrief.title,
    description: dailyBrief.description,
    url: '',
    image_url: '',
    topic: 'Brief',
    time_text: '',
    language: 'ja',
    published_at: lead.published_at || null,
    tone: dailyBrief.tone,
    is_active: true,
    updated_at: now,
  })

  const buckets = ['market_ticker', 'market_pickup', 'fund_pickup', 'daily_brief']
  const { error: deleteErr } = await adminClient.from('news_manual').delete().in('bucket', buckets)
  if (deleteErr) return { status: 500, body: { ok: false, error: deleteErr.message } }

  const { error: insertErr } = await adminClient.from('news_manual').insert(rows)
  if (insertErr) return { status: 500, body: { ok: false, error: insertErr.message } }

  return {
    status: 200,
    body: {
      ok: true,
      inserted: rows.length,
      japaneseCount: japanese.length,
      translatedCount: translatedEnglish.length,
      preview: marketTicker.slice(0, 3).map((r) => ({ title: r.title, source: r.source })),
    },
  }
}
