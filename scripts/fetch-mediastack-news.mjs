import fs from 'node:fs'
import path from 'node:path'
import {
  fetchTheNewsApiArticles,
  normalizeTheNewsApiArticle,
  toIsoDateDaysAgo,
} from '../api/_lib/the-news-api.js'

const ROOT = process.cwd()
const ENV_PATH = path.join(ROOT, '.env.local')
const OUT_PATH = path.join(ROOT, 'src/data/newsManual.js')

const readEnvFile = () => {
  const env = {}
  if (!fs.existsSync(ENV_PATH)) return env
  const lines = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

const toJpTime = (iso) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '00:00'
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const escapeJs = (value) => JSON.stringify(value ?? '')

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

const detectTopic = (article = {}) => {
  const text = `${article.title || ''} ${article.description || ''}`.toLowerCase()
  if (text.includes('ai') || text.includes('人工知能')) return 'AI'
  if (text.includes('金融') || text.includes('bank') || text.includes('金利') || text.includes('為替') || text.includes('finance') || text.includes('financial')) return 'Financial'
  if (text.includes('決算') || text.includes('earnings')) return 'Earnings'
  if (text.includes('株') || text.includes('market') || text.includes('日経') || text.includes('topix')) return 'Market'
  return 'Business'
}

const toListLiteral = (rows) => rows.map((row) => `  {
    source: ${escapeJs(row.source)},
    title: ${escapeJs(row.title)},
    time: ${escapeJs(row.time)},
    topic: ${escapeJs(row.topic)},
    url: ${escapeJs(row.url)},
    imageUrl: ${escapeJs(row.imageUrl)},
    publishedAt: ${escapeJs(row.publishedAt)},
    description: ${escapeJs(row.description)},
    language: ${escapeJs(row.language)},
  }`).join(',\n')

const inferBriefTone = (headline = '') => {
  const h = String(headline).toLowerCase()
  if (/(反発|上昇|続伸|回復|改善|堅調)/.test(h)) return 'やや強気'
  if (/(下落|反落|懸念|悪化|減速|弱含み)/.test(h)) return 'やや慎重'
  return '中立'
}

const main = async () => {
  const envFile = readEnvFile()
  const accessKey = process.env.THENEWSAPI_API_TOKEN
    || process.env.THE_NEWS_API_TOKEN
    || envFile.THENEWSAPI_API_TOKEN
    || envFile.THE_NEWS_API_TOKEN
  if (!accessKey) {
    throw new Error('THENEWSAPI_API_TOKEN is missing.')
  }

  const raw = await fetchTheNewsApiArticles({
    apiToken: accessKey,
    search: '経済 | 株式 | 日経 | TOPIX | 金利 | 半導体 | AI | 投資信託 | ETF',
    searchFields: 'title,description,keywords',
    language: 'ja',
    locale: 'jp',
    categories: 'business,tech',
    limit: 18,
    sort: 'published_at',
    publishedAfter: toIsoDateDaysAgo(5),
  })

  const normalized = uniqueByTitle(raw.map((article) => {
    const row = normalizeTheNewsApiArticle(article, detectTopic)
    return {
      source: row.source,
      title: row.title,
      time: row.time_text || toJpTime(row.published_at),
      topic: row.topic,
      url: row.url,
      imageUrl: row.image_url,
      publishedAt: row.published_at || '',
      description: row.description,
      language: row.language,
    }
  }).filter((a) => a.title))
  if (normalized.length === 0) throw new Error('No articles returned from TheNewsAPI.')
  const japaneseOnly = normalized.filter((a) => String(a.language || '').toLowerCase() === 'ja')
  const baseRows = japaneseOnly.length > 0
    ? japaneseOnly
    : [{
      source: 'MoneyMart News Desk',
      title: '日本語ニュースを取得中です。',
      time: '--:--',
      topic: 'News',
      url: '',
      imageUrl: '',
      publishedAt: '',
      description: 'TheNewsAPI の language=ja 記事が未取得のため、表示を保留しています。',
      language: 'ja',
    }]

  const withImage = baseRows.filter((a) => /^https?:\/\//i.test(a.imageUrl || ''))
  const pickupPool = [...withImage, ...baseRows.filter((a) => !withImage.includes(a))]
  const marketTicker = baseRows.slice(0, 10)
  const marketPickup = uniqueByTitle(pickupPool).slice(0, 6)

  const fundKeywords = ['投信', '投資信託', 'etf', 'nisa', '資産運用', 'ファンド', '年金']
  const stockKeywords = ['株', '企業', '決算', '市場', '日経', '東証', '上場', 'セクター']

  const fundPickup = uniqueByTitle(pickByKeywords(baseRows, fundKeywords, 4)).slice(0, 6)
  const stockDisclosure = uniqueByTitle(pickByKeywords(baseRows, stockKeywords, 4)).slice(0, 6)

  const lead = baseRows[0]
  const tone = inferBriefTone(lead.title)
  const brief = {
    tone,
    headline: lead.title,
    note: (lead.description || normalized[1]?.title || '').slice(0, 120),
    source: lead.source || 'TheNewsAPI',
  }

  const content = `export const NEWS_MANUAL_UPDATED_AT = ${escapeJs(new Date().toISOString())}

export const NEWS_MARKET_TICKER = [
${toListLiteral(marketTicker)}
]

export const NEWS_MARKET_PICKUP = [
${toListLiteral(marketPickup)}
]

export const NEWS_FUND_PICKUP = [
${toListLiteral(fundPickup)}
]

export const NEWS_STOCK_DISCLOSURES = [
${toListLiteral(stockDisclosure)}
]

export const NEWS_DAILY_BRIEF = {
  tone: ${escapeJs(brief.tone)},
  headline: ${escapeJs(brief.headline)},
  note: ${escapeJs(brief.note)},
  source: ${escapeJs(brief.source)},
}
`

  fs.writeFileSync(OUT_PATH, content, 'utf8')
  console.log(`Updated ${OUT_PATH}`)
  console.log(`Fetched ${japaneseOnly.length} Japanese articles (raw: ${normalized.length}).`)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
