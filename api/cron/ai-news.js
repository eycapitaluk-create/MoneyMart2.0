import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import {
  fetchTheNewsApiArticles,
  getTheNewsApiToken,
  normalizeTheNewsApiSearch,
  toIsoDateDaysAgo,
} from '../_lib/the-news-api.js'
import {
  fetchNewsDataIoArticles,
  getNewsDataIoToken,
} from '../_lib/newsdata-api.js'

/** 取得クエリの軸。件数が少ないと毎日同じ超大手に偏りやすいので、JP を多めに持つ。 */
const NEWS_TARGETS = [
  { ticker: '7203', companyName: 'トヨタ自動車', flag: '🇯🇵', sector: '自動車', market: 'jp', query: 'トヨタ OR Toyota Motor' },
  { ticker: '8306', companyName: '三菱UFJフィナンシャル・グループ', flag: '🇯🇵', sector: '金融', market: 'jp', query: '三菱UFJ OR MUFG' },
  { ticker: '9433', companyName: 'KDDI', flag: '🇯🇵', sector: '通信', market: 'jp', query: 'KDDI' },
  { ticker: '4502', companyName: '武田薬品工業', flag: '🇯🇵', sector: 'ヘルスケア', market: 'jp', query: '武田薬品 OR Takeda' },
  { ticker: '6758', companyName: 'ソニーグループ', flag: '🇯🇵', sector: 'テック', market: 'jp', query: 'ソニー OR Sony Group' },
  { ticker: '9984', companyName: 'ソフトバンクグループ', flag: '🇯🇵', sector: '通信・投資', market: 'jp', query: 'ソフトバンク OR SoftBank Group' },
  { ticker: '4063', companyName: '信越化学工業', flag: '🇯🇵', sector: '素材', market: 'jp', query: '信越化学 OR Shin-Etsu Chemical' },
  { ticker: '6098', companyName: 'リクルートホールディングス', flag: '🇯🇵', sector: 'サービス', market: 'jp', query: 'リクルート OR Recruit Holdings' },
  { ticker: '6920', companyName: 'レーザーテック', flag: '🇯🇵', sector: '半導体装置', market: 'jp', query: 'レーザーテック OR Lasertec' },
  { ticker: '8035', companyName: '東京エレクトロン', flag: '🇯🇵', sector: '半導体装置', market: 'jp', query: '東京エレクトロン OR Tokyo Electron' },
  { ticker: 'AAPL', companyName: 'Apple', flag: '🇺🇸', sector: 'テック', market: 'us', query: 'Apple' },
  { ticker: 'MSFT', companyName: 'Microsoft', flag: '🇺🇸', sector: 'テック', market: 'us', query: 'Microsoft' },
  { ticker: 'NVDA', companyName: 'NVIDIA', flag: '🇺🇸', sector: '半導体', market: 'us', query: 'NVIDIA' },
  { ticker: 'KO', companyName: 'Coca-Cola', flag: '🇺🇸', sector: '消費財', market: 'us', query: 'Coca-Cola OR Coca Cola' },
]


const NEWSDATA_BACKUP_QUERIES = [
  'Japan stock market Nikkei TOPIX dividend',
  'US stock market S&P 500 Nasdaq dividend',
  'BOJ Fed inflation interest rate market outlook',
  'earnings guidance share buyback dividend announcement',
]

const FINANCE_KEYWORDS = [
  // Core topic keywords requested by product direction (KR/JP/EN)
  '투자', '경제', '정치', 'ai', '비즈니스',
  '投資', '経済', '政治', 'ビジネス',
  'investment', 'economy', 'politics', 'business',

  '株', '株価', '市場', '投資', '投信', '投資信託', 'etf', 'fund', 'market', 'stock',
  'earnings', 'guidance', 'forecast', 'revenue', 'profit', 'dividend', 'buyback',
  'interest rate', 'bond', 'yield', 'inflation', 'cpi', 'gdp', 'fomc', 'fed', 'boj',
  '日銀', '利上げ', '利下げ', '金融', '為替', 'ドル円', 'topix', 'nikkei', 's&p',
]

const LOW_QUALITY_SOURCE_PATTERNS = [
  'kaiten-heiten',
  'radiko',
  'startuplog',
]

const pickTargetForFallbackArticle = (headline = '') => {
  const normalized = String(headline || '').toLowerCase()
  if (!normalized) return NEWS_TARGETS[0]
  for (const target of NEWS_TARGETS) {
    const company = String(target.companyName || '').toLowerCase()
    const ticker = String(target.ticker || '').toLowerCase()
    if ((company && normalized.includes(company)) || (ticker && normalized.includes(ticker))) {
      return target
    }
  }
  return null
}

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
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        map[key] = value
      })
      return map
    } catch {
      // ignore
    }
  }
  return {}
}

const localEnvMap = readLocalEnvMap()
const env = (key) => process.env[key] || localEnvMap[key] || ''

const normalizeSecret = (value) => {
  const raw = String(value || '').trim()
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1).trim()
  }
  return raw
}

const normalizeText = (value = '') => String(value || '').toLowerCase()

const isFreshPublished = (value, maxHours = 72) => {
  if (!value) return false
  const ts = new Date(value).getTime()
  if (!Number.isFinite(ts)) return false
  return (Date.now() - ts) <= (Math.max(1, Number(maxHours) || 72) * 60 * 60 * 1000)
}

const isLikelyLowQualitySource = (source = '', url = '') => {
  const text = `${normalizeText(source)} ${normalizeText(url)}`
  return LOW_QUALITY_SOURCE_PATTERNS.some((pattern) => text.includes(pattern))
}

const financeKeywordScore = (title = '', description = '') => {
  const text = `${normalizeText(title)} ${normalizeText(description)}`
  let score = 0
  for (const keyword of FINANCE_KEYWORDS) {
    if (text.includes(normalizeText(keyword))) score += 1
  }
  return score
}

const isRelevantForTarget = (row, target) => {
  const title = String(row?.title || '')
  const description = String(row?.description || '')
  const source = String(row?.source || '')
  const url = String(row?.url || '')
  if (!title || !url) return false
  if (isLikelyLowQualitySource(source, url)) return false

  const text = `${normalizeText(title)} ${normalizeText(description)}`
  const targetMentions = [
    normalizeText(target?.ticker),
    ...String(target?.companyName || '').toLowerCase().split(/[\s・・]/).filter((x) => x.length >= 2),
  ].filter(Boolean)
  const hasTargetHit = targetMentions.some((token) => text.includes(token))
  const financeScore = financeKeywordScore(title, description)

  if (hasTargetHit && financeScore >= 1) return true
  if (financeScore >= 3) return true
  return false
}

const sortByPublishedDesc = (rows = []) => [...rows].sort((a, b) => {
  const at = new Date(a?.publishedAt || a?.published_at || 0).getTime()
  const bt = new Date(b?.publishedAt || b?.published_at || 0).getTime()
  return bt - at
})

function sendJson(res, status, payload) {
  if (typeof res.status === 'function') {
    return res.status(status).json(payload)
  }
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

const toJstHour = (date = new Date()) => {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    hour12: false,
  })
  return Number(fmt.format(date))
}

const getSlot = (date = new Date()) => (toJstHour(date) < 12 ? 'am' : 'pm')

const toTimeText = (value) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '--:--'
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const uniqueByTitle = (rows = []) => {
  const used = new Set()
  return rows.filter((row) => {
    const headlineKey = String(row?.headline || '').trim().toLowerCase()
    const urlKey = String(row?.sourceUrl || row?.url || '').trim().toLowerCase()
    const key = `${headlineKey}::${urlKey}`
    if (!headlineKey || used.has(key)) return false
    used.add(key)
    return true
  })
}

const toHeadlineKey = (ticker = '', headline = '') => `${String(ticker || '').trim().toUpperCase()}::${String(headline || '').trim().toLowerCase()}`

const extractRawSnippet = (article) => {
  const t = String(article?.description || article?.headline || '').trim()
  if (!t) return ''
  return t.length > 520 ? `${t.slice(0, 520)}…` : t
}

const hasJapaneseScript = (text = '') => /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(String(text || ''))

const isJapaneseArticle = (article = {}) => {
  const lang = String(article?.language || '').toLowerCase()
  if (lang === 'ja') return true
  const probe = `${article?.headline || ''} ${article?.description || ''} ${article?.source || ''}`
  return hasJapaneseScript(probe)
}

const diversifyByTicker = (articles = [], maxPerTicker = 1) => {
  const byTicker = new Map()
  for (const a of articles) {
    const ticker = String(a?.ticker || '').trim().toUpperCase()
    if (!ticker) continue
    const list = byTicker.get(ticker) || []
    if (list.length < maxPerTicker) list.push(a)
    byTicker.set(ticker, list)
  }
  return Array.from(byTicker.values()).flat()
}

/** 日本語ニュースを優先しつつ、銘柄偏りを抑えて最大件数を選ぶ。 */
const selectLanguagePrioritizedArticles = (
  articles = [],
  { maxTotal = 6, minJapanese = 4, maxPerTicker = 1 } = {},
) => {
  const sorted = sortByPublishedDesc(uniqueByTitle(articles))
  const japanese = sorted.filter((row) => isJapaneseArticle(row))
  const nonJapanese = sorted.filter((row) => !isJapaneseArticle(row))

  const chosen = []
  const tickerCounts = new Map()
  const seen = new Set()
  const keyOf = (row) => `${String(row?.headline || '').trim().toLowerCase()}::${String(row?.sourceUrl || '').trim().toLowerCase()}`

  const canTakeTicker = (row) => {
    const ticker = String(row?.ticker || '').trim().toUpperCase()
    if (!ticker) return true
    return (tickerCounts.get(ticker) || 0) < maxPerTicker
  }
  const markTaken = (row) => {
    const k = keyOf(row)
    seen.add(k)
    chosen.push(row)
    const ticker = String(row?.ticker || '').trim().toUpperCase()
    if (ticker) tickerCounts.set(ticker, (tickerCounts.get(ticker) || 0) + 1)
  }
  const addFrom = (rows = [], limit = Infinity, ignoreTickerCap = false) => {
    let added = 0
    for (const row of rows) {
      if (chosen.length >= maxTotal || added >= limit) break
      const k = keyOf(row)
      if (!k || seen.has(k)) continue
      if (!ignoreTickerCap && !canTakeTicker(row)) continue
      markTaken(row)
      added += 1
    }
    return added
  }

  // 1) 日本語を最低件数まで優先
  addFrom(japanese, Math.max(0, minJapanese))
  // 2) まだ枠があれば、日本語→非日本語の順で埋める
  addFrom(japanese)
  addFrom(nonJapanese)
  // 3) 銘柄上限で欠けた場合のみ、上限を緩めて埋める
  if (chosen.length < maxTotal) addFrom(japanese, Infinity, true)
  if (chosen.length < maxTotal) addFrom(nonJapanese, Infinity, true)

  return chosen.slice(0, maxTotal)
}

/** 時系列だけだと米国超大手ばかり先頭に来るので、JP / US を交互に混ぜてから 6 件に絞る。 */
const pickStratifiedNewsPool = (articles = [], maxTotal = 12) => {
  const uniq = uniqueByTitle(articles)
  const jp = sortByPublishedDesc(uniq.filter((a) => a?.market === 'jp'))
  const us = sortByPublishedDesc(uniq.filter((a) => a?.market === 'us'))
  const other = sortByPublishedDesc(uniq.filter((a) => a?.market !== 'jp' && a?.market !== 'us'))
  const out = []
  let ji = 0
  let ui = 0
  let oi = 0
  while (out.length < maxTotal) {
    const before = out.length
    if (ji < jp.length) out.push(jp[ji++])
    if (out.length >= maxTotal) break
    if (ui < us.length) out.push(us[ui++])
    if (out.length >= maxTotal) break
    if (oi < other.length) out.push(other[oi++])
    if (out.length === before) break
  }
  if (out.length < maxTotal) {
    const keyOf = (row) => `${String(row?.headline || '')}::${String(row?.sourceUrl || '')}`
    const keys = new Set(out.map(keyOf))
    for (const row of sortByPublishedDesc(uniq)) {
      if (out.length >= maxTotal) break
      const k = keyOf(row)
      if (keys.has(k)) continue
      keys.add(k)
      out.push(row)
    }
  }
  return out.slice(0, maxTotal)
}

const normalizeArticleLanguage = (value = '') => {
  const raw = Array.isArray(value) ? value.join(',') : String(value || '')
  const v = raw.toLowerCase()
  if (v.includes('ja') || v.includes('japanese')) return 'ja'
  if (v.includes('en') || v.includes('english')) return 'en'
  return ''
}

const simplifyNewsDataQuery = (query = '') => String(query || '')
  .replace(/\s+OR\s+/gi, ' ')
  .replace(/[()"']/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

function buildTranslationPrompt(article) {
  const headline = String(article?.headline || '').slice(0, 500)
  const description = String(article?.description || '').slice(0, 3000)
  return `
Translate the following financial news into natural Japanese.
Return JSON only. No markdown.
Keep facts exactly; do not add or remove claims.

Headline: ${headline}
Description: ${description}

{"headline_ja":"60字以内の自然な日本語見出し","description_ja":"本文要約ではなく、元説明文の内容を日本語で忠実に翻訳（最大600字）"}
`.trim()
}


async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    const data = await res.json()
    return { res, data }
  } finally {
    clearTimeout(timer)
  }
}

async function fetchNewsArticles(target, apiKey, newsDataKey) {
  const normalizedTargetQuery = normalizeTheNewsApiSearch(target.query)
  const safeNewsDataQuery = simplifyNewsDataQuery(target.query)

  const [theNewsRows, newsDataPrimaryRows] = await Promise.all([
    apiKey
      ? fetchTheNewsApiArticles({
        apiToken: apiKey,
        search: normalizedTargetQuery,
        searchFields: 'title,description,keywords',
        language: 'ja,en',
        locale: 'jp,us',
        categories: 'business,politics',
        limit: 30,
        sort: 'published_at',
        publishedAfter: toIsoDateDaysAgo(3),
      }).catch(() => [])
      : Promise.resolve([]),
    newsDataKey
      ? fetchNewsDataIoArticles({
        apiToken: newsDataKey,
        q: safeNewsDataQuery,
        language: 'ja,en',
        country: 'jp,us',
        category: 'business,politics',
        size: 10,
      }).catch(() => [])
      : Promise.resolve([]),
  ])

  const newsDataFallbackRows = (
    newsDataKey && (newsDataPrimaryRows || []).length < 8
      ? await fetchNewsDataIoArticles({
        apiToken: newsDataKey,
        q: simplifyNewsDataQuery(`${target.companyName} ${target.ticker}`),
        language: 'ja,en',
        country: 'jp,us',
        category: 'business,politics',
        size: 10,
      }).catch(() => [])
      : []
  )

  const rows = [
    ...(theNewsRows || []).map((item) => ({
      title: item?.title || '',
      description: item?.description || item?.snippet || item?.title || '',
      source: item?.source || 'TheNewsAPI',
      provider: 'the_news_api',
      url: item?.url || '',
      published_at: item?.published_at || null,
      language: normalizeArticleLanguage(item?.language),
    })),
    ...[...(newsDataPrimaryRows || []), ...(newsDataFallbackRows || [])].map((item) => ({
      title: item?.title || '',
      description: item?.description || item?.content || item?.title || '',
      source: item?.source_id || item?.source_name || 'NewsData.io',
      provider: 'newsdata_io',
      url: item?.link || '',
      published_at: item?.pubDate || null,
      language: normalizeArticleLanguage(item?.language),
    })),
  ]

  const candidates = (rows || []).filter((item) => item?.title && item?.url)
  const freshCandidates = candidates.filter((item) => isFreshPublished(item?.published_at, 72))
  const recencyPool = freshCandidates.length >= 4 ? freshCandidates : candidates
  const relevanceFiltered = recencyPool.filter((item) => isRelevantForTarget(item, target))
  const qualityPool = relevanceFiltered.length >= 3
    ? relevanceFiltered
    : recencyPool.filter((item) => !isLikelyLowQualitySource(item?.source, item?.url))
  const filteredCandidates = qualityPool.length > 0 ? qualityPool : recencyPool

  const japanese = filteredCandidates.filter((item) => item?.language === 'ja')
  const english = filteredCandidates.filter((item) => item?.language === 'en')
  const otherLanguage = filteredCandidates.filter((item) => item?.language !== 'ja' && item?.language !== 'en')
  const prioritized = [...japanese, ...english, ...otherLanguage]

  const picked = sortByPublishedDesc(
    uniqueByTitle(prioritized.map((row) => ({
      headline: String(row?.title || ''),
      description: String(row?.description || row?.snippet || row?.title || ''),
      source: row?.source || 'TheNewsAPI',
      sourceUrl: row?.url || '',
      provider: row?.provider || 'the_news_api',
      publishedAt: row?.published_at || null,
      language: row?.language || '',
    })))
  ).slice(0, 5)

  return picked.map((row) => ({
    ticker: target.ticker,
    companyName: target.companyName,
    flag: target.flag,
    sector: target.sector,
    market: target.market,
    headline: row.headline,
    description: row.description,
    source: row.source,
    sourceUrl: row.sourceUrl,
    provider: row.provider,
    publishedAt: row.publishedAt,
    language: row.language || '',
  }))
}


async function fetchNewsDataBackupArticles(newsDataKey, limit = 18) {
  if (!newsDataKey) return []

  const bucket = []
  for (const query of NEWSDATA_BACKUP_QUERIES) {
    const rows = await fetchNewsDataIoArticles({
      apiToken: newsDataKey,
      q: query,
      language: 'ja,en',
      country: 'jp,us',
      category: 'business,politics',
      size: 10,
    }).catch(() => [])

    for (const item of rows || []) {
      const headline = String(item?.title || '').trim()
      const sourceUrl = String(item?.link || '').trim()
      if (!headline || !sourceUrl) continue
      if (!isFreshPublished(item?.pubDate, 72)) continue
      if (isLikelyLowQualitySource(item?.source_id || item?.source_name || '', sourceUrl)) continue
      if (financeKeywordScore(headline, item?.description || item?.content || '') <= 0) continue

      const matched = pickTargetForFallbackArticle(headline)
      const fallbackTarget = matched || NEWS_TARGETS[bucket.length % NEWS_TARGETS.length]
      bucket.push({
        ticker: fallbackTarget.ticker,
        companyName: fallbackTarget.companyName,
        flag: fallbackTarget.flag,
        sector: fallbackTarget.sector,
        market: fallbackTarget.market,
        headline,
        description: String(item?.description || item?.content || headline),
        source: item?.source_id || item?.source_name || 'NewsData.io',
        sourceUrl,
        provider: 'newsdata_io',
        publishedAt: item?.pubDate || null,
        language: normalizeArticleLanguage(item?.language),
      })
    }

    if (bucket.length >= limit) break
  }

  return uniqueByTitle(bucket).slice(0, limit)
}

function buildPrompt(article) {
  const desc = String(article?.description || '').slice(0, 2400)
  return `
You are MoneyMart's financial news analyst.
Return JSON only. No markdown.
Write all fields in Japanese.

Headline: "${article.headline}"
Description: "${desc}"
Company: ${article.companyName} (${article.ticker})
Sector: ${article.sector}

Strict rules:
- Use ONLY facts that appear in Headline or Description above. Do not invent numbers, dates, quotes, or unnamed sources.
- Do NOT give investment advice, price targets, buy/sell recommendations, or "what investors should do."
- "summary" must be two complete Japanese sentences that state WHO did WHAT and WHY it matters per the text (not generic filler). If the source text is thin, still paraphrase what is explicitly written—never output placeholder text.
- If the text is too thin to explain safely, write analysis as 2 short paragraphs that paraphrase only what is given and one sentence saying detail is limited—link to the original article for more.
- "analysis" must be 2–5 short paragraphs (blank line between paragraphs), plain text: context and rewording only from the given lines—not new reporting.

Return exactly this shape:
{
  "headline_jp": "日本語の見出し 40字以内",
  "summary": "2文でわかりやすく要約",
  "analysis": "上記ルールに従った解説本文（2〜5段落、段落間は空行）",
  "sentiment": "好材料" or "悪材料" or "中立",
  "keywords": ["キーワード1", "キーワード2", "キーワード3"],
  "discussion_title": "ラウンジ投稿タイトル 40字以内",
  "discussion_body": "ニュース要約 + 意見を聞く質問を含む 150字以内"
}
`.trim()
}

/** 本番でタイムアウトしやすい場合の短いプロンプト（JSON 破損・空欄時の再試行用） */
function buildPromptMinimal(article) {
  const desc = String(article?.description || article?.headline || '').slice(0, 2400)
  return `
英語の金融ニュースを読み、次のキーだけを持つ JSON を1つだけ返す。マークダウン禁止。本文はすべて日本語。

Headline: ${String(article?.headline || '')}
Description: ${desc}
Company: ${article.companyName} (${article.ticker})

ルール: 見出しと説明文に書かれている内容のみ。投資助言・売買指示は書かない。summaryは2文で具体的内容（誰が何をしたか）を書く。プレースホルダ禁止。

{"headline_jp":"40字以内","summary":"2文の要約","analysis":"解説は2〜4段落（段落の間は空行）","sentiment":"好材料|悪材料|中立","keywords":["k1","k2","k3"],"discussion_title":"40字以内","discussion_body":"150字以内"}
`.trim()
}

function extractJsonObject(text = '') {
  const cleaned = String(text).replace(/```json|```/gi, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1))
      } catch {
        // trailing commas などの軽微な欠陥を除去して再試行
        const slice = cleaned.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1')
        return JSON.parse(slice)
      }
    }
    throw new Error('Claude response was not valid JSON')
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Sonnet 3.5 が JSON 指示に強い。環境で上書き可。 */
const AI_NEWS_DEFAULT_MODEL = 'claude-3-5-sonnet-20241022'
const AI_NEWS_FALLBACK_MODEL = 'claude-3-5-haiku-20241022'

const isRetriableAnthropicError = (status, message = '') => {
  const m = String(message || '').toLowerCase()
  if ([422, 429, 500, 503, 529].includes(Number(status))) return true
  if (m.includes('timeout') || m.includes('timed out') || m.includes('overloaded') || m.includes('rate')) return true
  if (m.includes('max_tokens') || m.includes('truncated')) return true
  return false
}

function anthropicMessageText(data) {
  const blocks = Array.isArray(data?.content) ? data.content : []
  return blocks
    .map((row) => {
      if (!row) return ''
      if (typeof row.text === 'string') return row.text
      if (row.type === 'text' && typeof row.text === 'string') return row.text
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function parseClaudeJsonResponse(data) {
  const text = anthropicMessageText(data)
  if (!String(text).trim()) throw new Error('Claude returned empty message content')
  return extractJsonObject(text)
}

async function callAnthropicOnce(article, apiKey, model, timeoutMs, { minimal = false } = {}) {
  const prompt = minimal ? buildPromptMinimal(article) : buildPrompt(article)
  const { res, data } = await fetchJsonWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: minimal ? 2800 : 4096,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    }),
  }, timeoutMs)
  if (!res.ok) {
    const msg = data?.error?.message || `Anthropic request failed (${res.status})`
    const err = new Error(msg)
    err.status = res.status
    throw err
  }
  if (String(data?.stop_reason || '') === 'max_tokens') {
    const err = new Error('Claude hit max_tokens (truncated JSON)')
    err.status = 422
    throw err
  }
  return parseClaudeJsonResponse(data)
}

function mapParsedToSummary(article, parsed) {
  return {
    headlineJp: String(parsed?.headline_jp || article.headline || '').slice(0, 120),
    summary: String(parsed?.summary || '').slice(0, 240),
    analysis: String(parsed?.analysis || '').trim().slice(0, 4800),
    sentiment: ['好材料', '悪材料', '中立'].includes(String(parsed?.sentiment || '')) ? String(parsed.sentiment) : '中立',
    reason: '',
    impact: '',
    keywords: Array.isArray(parsed?.keywords) ? parsed.keywords.slice(0, 5).map((x) => String(x).slice(0, 40)) : [],
    discussionTitle: String(parsed?.discussion_title || `${article.companyName}のニュース、どう見る？`).slice(0, 80),
    discussionBody: String(parsed?.discussion_body || `${article.companyName}の最新ニュースです。みなさんはどう考えますか？`).slice(0, 220),
  }
}

function isUsableAiSummary(mapped) {
  const summary = String(mapped?.summary || '').trim()
  if (summary.length < 28) return false
  const bad = /要約が利用|利用不可|生成できません|N\/A|不明です|詳細は不明/i
  if (bad.test(summary)) return false
  return true
}

const POSITIVE_SENTIMENT_HINTS = [
  'beats',
  'beat',
  'surge',
  'rally',
  'jump',
  'gain',
  'gains',
  'up',
  'upgrade',
  'record high',
  'dividend',
  'buyback',
  'raises guidance',
  'strong demand',
  'increase',
  'growth',
  '反発',
  '上昇',
  '増配',
  '上方修正',
  '最高益',
  '成長',
]

const NEGATIVE_SENTIMENT_HINTS = [
  'misses',
  'miss',
  'drop',
  'fall',
  'falls',
  'plunge',
  'slump',
  'down',
  'downgrade',
  'cuts guidance',
  'lawsuit',
  'probe',
  'fraud',
  'scandal',
  'arrested',
  'warning',
  'decline',
  '下落',
  '急落',
  '減益',
  '下方修正',
  '不正',
  '逮捕',
  '訴訟',
]

function inferFallbackSentiment(article, snippet = '') {
  const probe = `${article?.headline || ''} ${article?.description || ''} ${snippet || ''}`.toLowerCase()
  let pos = 0
  let neg = 0
  for (const token of POSITIVE_SENTIMENT_HINTS) {
    if (probe.includes(String(token).toLowerCase())) pos += 1
  }
  for (const token of NEGATIVE_SENTIMENT_HINTS) {
    if (probe.includes(String(token).toLowerCase())) neg += 1
  }
  if (neg > pos) return '悪材料'
  if (pos > neg) return '好材料'
  return '中立'
}

/**
 * 本番は要約成功率優先: 未指定時は Sonnet → Haiku。軽量優先なら AI_NEWS_MODEL=claude-3-5-haiku-20241022 等。
 */
async function summarizeWithClaude(article, apiKey, timeoutMs = 45000) {
  const fromEnv = String(env('AI_NEWS_MODEL') || '').trim()
  const candidates = fromEnv
    ? [...new Set([fromEnv, AI_NEWS_DEFAULT_MODEL, AI_NEWS_FALLBACK_MODEL])].filter(Boolean)
    : [AI_NEWS_DEFAULT_MODEL, AI_NEWS_FALLBACK_MODEL]

  let lastErr = null
  for (const model of candidates) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const parsed = await callAnthropicOnce(article, apiKey, model, timeoutMs, { minimal: false })
        const mapped = mapParsedToSummary(article, parsed)
        if (!isUsableAiSummary(mapped)) throw new Error('Claude returned empty summary fields')
        return mapped
      } catch (err) {
        lastErr = err
        const status = err?.status
        const msg = String(err?.message || '')
        const retriable = isRetriableAnthropicError(status, msg) || msg.includes('JSON') || msg.includes('empty')
        if (attempt === 0 && retriable) {
          await sleep(900)
          continue
        }
        break
      }
    }
    try {
      const parsed = await callAnthropicOnce(article, apiKey, model, timeoutMs, { minimal: true })
      const mapped = mapParsedToSummary(article, parsed)
      if (!isUsableAiSummary(mapped)) throw new Error('Claude minimal prompt still empty')
      return mapped
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr || new Error('Claude summarize failed')
}

const GEMINI_DEFAULT_MODEL = 'gemini-2.0-flash'

function geminiResponseText(data) {
  const c = data?.candidates?.[0]
  if (!c) {
    const br = data?.promptFeedback?.blockReason
    if (br) throw new Error(`Gemini blocked: ${br}`)
    throw new Error('Gemini returned no candidates')
  }
  const parts = c?.content?.parts
  const text = Array.isArray(parts) ? parts.map((p) => p?.text || '').join('') : ''
  if (!String(text).trim()) throw new Error('Gemini returned empty text')
  return text
}

async function callGeminiOnce(article, apiKey, model, timeoutMs, { minimal = false } = {}) {
  const prompt = minimal ? buildPromptMinimal(article) : buildPrompt(article)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: minimal ? 2800 : 8192,
    },
  }
  const { res, data } = await fetchJsonWithTimeout(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }, timeoutMs)
  if (!res.ok) {
    const msg = data?.error?.message || `Gemini request failed (${res.status})`
    const err = new Error(msg)
    err.status = res.status
    throw err
  }
  const fr = String(data?.candidates?.[0]?.finishReason || '')
  if (fr === 'MAX_TOKENS') {
    const err = new Error('Gemini hit MAX_TOKENS (truncated)')
    err.status = 422
    throw err
  }
  const text = geminiResponseText(data)
  return extractJsonObject(text)
}

/** 英語記事を Gemini で日本語へ下訳（要約前の前処理）。 */
async function translateArticleWithGemini(article, apiKey, timeoutMs = 15000) {
  if (!apiKey || isJapaneseArticle(article)) return article
  const model = String(env('AI_NEWS_GEMINI_MODEL') || env('GEMINI_MODEL') || GEMINI_DEFAULT_MODEL).trim() || GEMINI_DEFAULT_MODEL
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const body = {
    contents: [{ parts: [{ text: buildTranslationPrompt(article) }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 1600 },
  }
  try {
    const { res, data } = await fetchJsonWithTimeout(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }, timeoutMs)
    if (!res.ok) return article
    const text = geminiResponseText(data)
    const parsed = extractJsonObject(text)
    const headlineJa = String(parsed?.headline_ja || '').trim().slice(0, 120)
    const descriptionJa = String(parsed?.description_ja || '').trim().slice(0, 2400)
    if (!headlineJa && !descriptionJa) return article
    return {
      ...article,
      headline: headlineJa || article.headline,
      description: descriptionJa || article.description,
      language: 'ja',
      translated_by: 'gemini',
    }
  } catch {
    return article
  }
}

/**
 * Anthropic 失敗時のフォールバック。AI_NEWS_GEMINI_MODEL / GEMINI_MODEL で上書き可。
 */
async function summarizeWithGemini(article, apiKey, timeoutMs = 45000) {
  const model = String(env('AI_NEWS_GEMINI_MODEL') || env('GEMINI_MODEL') || GEMINI_DEFAULT_MODEL).trim() || GEMINI_DEFAULT_MODEL
  let lastErr = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const parsed = await callGeminiOnce(article, apiKey, model, timeoutMs, { minimal: attempt === 1 })
      const mapped = mapParsedToSummary(article, parsed)
      if (!isUsableAiSummary(mapped)) throw new Error('Gemini returned empty summary fields')
      return mapped
    } catch (err) {
      lastErr = err
      if (attempt === 0) await sleep(700)
    }
  }
  throw lastErr || new Error('Gemini summarize failed')
}

/**
 * Gemini を優先し、失敗時は Anthropic にフォールバック。
 * AI_NEWS_PROVIDER_PRIORITY=anthropic_first を指定すると旧順序で実行可能。
 */
function getAiNewsProviderPriority() {
  const raw = String(env('AI_NEWS_PROVIDER_PRIORITY') || '').trim().toLowerCase()
  if (raw === 'anthropic_first' || raw === 'claude_first') return 'anthropic_first'
  return 'gemini_first'
}

async function summarizeNewsArticle(article, anthropicKey, geminiKey, timeoutMs) {
  const priority = getAiNewsProviderPriority()
  const providers = priority === 'anthropic_first'
    ? ['anthropic', 'gemini']
    : ['gemini', 'anthropic']
  let lastErr = null

  for (const provider of providers) {
    try {
      if (provider === 'gemini' && geminiKey) {
        const mapped = await summarizeWithGemini(article, geminiKey, timeoutMs)
        return { mapped, provider: 'gemini' }
      }
      if (provider === 'anthropic' && anthropicKey) {
        const mapped = await summarizeWithClaude(article, anthropicKey, timeoutMs)
        return { mapped, provider: 'anthropic' }
      }
    } catch (err) {
      lastErr = err
      const label = provider === 'gemini' ? 'Gemini' : 'Anthropic'
      console.error(`[ai-news] ${label} failed`, article?.ticker, String(err?.message || err))
    }
  }

  if (!anthropicKey && !geminiKey) {
    throw new Error('No LLM key: set ANTHROPIC_API_KEY and/or GEMINI_API_KEY')
  }
  throw lastErr || new Error('All summarizers failed')
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }

  const cronSecret = env('CRON_SECRET')
  if (!cronSecret) {
    return sendJson(res, 500, { ok: false, error: 'CRON_SECRET is required' })
  }
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (token !== cronSecret) {
    return sendJson(res, 401, { ok: false, error: 'Unauthorized cron request' })
  }

  const supabaseUrl = env('SUPABASE_URL') || env('VITE_SUPABASE_URL')
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_SECRET_KEY')
  const newsApiKey = getTheNewsApiToken(env)
  const newsDataKey = getNewsDataIoToken(env)
  const anthropicKey = normalizeSecret(env('ANTHROPIC_API_KEY') || env('CLAUDE_API_KEY'))
  const geminiKey = normalizeSecret(env('GEMINI_API_KEY') || env('GOOGLE_AI_API_KEY') || env('GOOGLE_API_KEY'))
  if (!supabaseUrl || !serviceRoleKey || (!newsApiKey && !newsDataKey) || (!anthropicKey && !geminiKey)) {
    return sendJson(res, 500, {
      ok: false,
      error: 'Missing env. Need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY), TheNewsAPI or NewsData.io token, and at least one of ANTHROPIC_API_KEY or GEMINI_API_KEY (or GOOGLE_AI_API_KEY).',
    })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const slot = getSlot(new Date())
  const batchKey = `${new Date().toISOString().slice(0, 10)}:${slot}`

  try {
    const fetched = []
    for (const target of NEWS_TARGETS) {
      try {
        const articles = await fetchNewsArticles(target, newsApiKey, newsDataKey)
        fetched.push(...articles)
      } catch {
        // skip individual failures
      }
    }

    if (newsDataKey && fetched.length < 12) {
      const backupArticles = await fetchNewsDataBackupArticles(newsDataKey, 18)
      fetched.push(...backupArticles)
    }

    const uniqueArticles = sortByPublishedDesc(uniqueByTitle(fetched)).slice(0, 40)

    const dedupeHours = Math.max(6, Number(env('AI_NEWS_DEDUPE_HOURS') || 24))
    const dedupeSince = new Date(Date.now() - (dedupeHours * 60 * 60 * 1000)).toISOString()
    const { data: recentRows } = await admin
      .from('ai_news_summaries')
      .select('ticker,headline,updated_at')
      .gte('updated_at', dedupeSince)
      .limit(800)

    const recentKeySet = new Set((recentRows || []).map((row) => toHeadlineKey(row?.ticker, row?.headline)))
    const freshArticles = uniqueArticles
      .filter((row) => !recentKeySet.has(toHeadlineKey(row?.ticker, row?.headline)))
      .filter((row) => isFreshPublished(row?.publishedAt, 72))
      .slice(0, 14)

    const pool = freshArticles.length > 0 ? freshArticles : uniqueArticles.slice(0, 28)
    const candidates = pickStratifiedNewsPool(pool, 12)
    const minJapanese = Math.max(2, Math.min(6, Number(env('AI_NEWS_MIN_JAPANESE') || 4)))
    const selectedArticles = selectLanguagePrioritizedArticles(candidates, {
      maxTotal: 6,
      minJapanese,
      maxPerTicker: 1,
    })

    const summaryTimeoutMs = Math.max(12000, Number(env('AI_NEWS_SUMMARY_TIMEOUT_MS') || 45000))

    /** ①ニュース取得 → ②LLM 分析 を分離。LLM 失敗時もニュース行は保存（ai_analysis_status=failed）。 */
    const summarized = []
    let skipped = 0
    const skippedReasons = []
    const llmMix = { anthropic: 0, gemini: 0 }
    let translationApplied = 0
    for (let i = 0; i < selectedArticles.length; i += 1) {
      const article = selectedArticles[i]
      const preparedArticle = await translateArticleWithGemini(article, geminiKey, Math.min(20000, summaryTimeoutMs))
      if (preparedArticle?.translated_by === 'gemini') translationApplied += 1
      const snippet = extractRawSnippet(preparedArticle)
      const sharedBase = {
        run_slot: slot,
        market: preparedArticle.market,
        ticker: preparedArticle.ticker,
        company_name: preparedArticle.companyName,
        flag: preparedArticle.flag,
        sector: preparedArticle.sector,
        source: preparedArticle.source,
        source_url: preparedArticle.sourceUrl,
        published_at: preparedArticle.publishedAt,
        time_text: toTimeText(preparedArticle.publishedAt),
        language: String(preparedArticle?.language || (isJapaneseArticle(preparedArticle) ? 'ja' : 'en') || 'ja'),
        is_active: true,
        batch_key: batchKey,
      }
      try {
        const { mapped: ai, provider } = await summarizeNewsArticle(preparedArticle, anthropicKey, geminiKey, summaryTimeoutMs)
        if (provider === 'gemini') llmMix.gemini += 1
        else llmMix.anthropic += 1
        summarized.push({
          ...sharedBase,
          headline: ai.headlineJp || preparedArticle.headline,
          is_hot: summarized.length < 3,
          summary: ai.summary,
          analysis: ai.analysis || '',
          sentiment: ai.sentiment,
          reason: ai.reason,
          impact: ai.impact,
          keywords: ai.keywords,
          discussion_title: ai.discussionTitle,
          discussion_body: ai.discussionBody,
          sort_order: summarized.length + 1,
          ai_analysis_status: 'complete',
          raw_snippet: null,
        })
      } catch (err) {
        skipped += 1
        const detail = `${preparedArticle.ticker || '?'}: ${String(err?.message || 'LLM summarize failed')}`
        console.error('[ai-news]', detail)
        if (skippedReasons.length < 12) skippedReasons.push(detail)
        summarized.push({
          ...sharedBase,
          headline: preparedArticle.headline,
          is_hot: summarized.length < 3,
          summary: snippet,
          analysis: '',
          sentiment: inferFallbackSentiment(preparedArticle, snippet),
          reason: '',
          impact: '',
          keywords: [],
          discussion_title: '',
          discussion_body: '',
          sort_order: summarized.length + 1,
          ai_analysis_status: 'failed',
          raw_snippet: snippet,
        })
      }
    }

    const rowsToInsert = summarized.map((row, idx) => ({
      ...row,
      sort_order: idx + 1,
      is_hot: idx < 3,
    }))

    if (rowsToInsert.length > 0) {
      const { error: deactivateErr } = await admin
        .from('ai_news_summaries')
        .update({ is_active: false })
        .eq('is_active', true)
      if (deactivateErr) throw deactivateErr

      const { error: insertErr } = await admin.from('ai_news_summaries').insert(rowsToInsert)
      if (insertErr) throw insertErr
    }

    const analysisComplete = rowsToInsert.filter((r) => r?.ai_analysis_status === 'complete').length
    const newsOnly = rowsToInsert.filter((r) => r?.ai_analysis_status === 'failed').length

    return sendJson(res, 200, {
      ok: true,
      slot,
      batchKey,
      fetchedCandidates: uniqueArticles.length,
      deduped: Math.max(0, uniqueArticles.length - freshArticles.length),
      fallbackUsed: freshArticles.length === 0 && selectedArticles.length > 0,
      inserted: rowsToInsert.length,
      analysisComplete,
      newsOnly,
      attempted: selectedArticles.length,
      skipped,
      skippedReasons,
      dbUpdated: rowsToInsert.length > 0,
      noAiRowsInserted: rowsToInsert.length === 0,
      sourceMix: {
        theNewsApi: selectedArticles.filter((row) => row?.provider === 'the_news_api').length,
        newsDataIo: selectedArticles.filter((row) => row?.provider === 'newsdata_io').length,
      },
      languageMix: {
        ja: selectedArticles.filter((row) => isJapaneseArticle(row)).length,
        nonJa: selectedArticles.filter((row) => !isJapaneseArticle(row)).length,
        minJapaneseTarget: minJapanese,
      },
      translationApplied,
      llmMix,
      preview: rowsToInsert.slice(0, 3).map((row) => ({ ticker: row.ticker, headline: row.headline, source: row.source })),
    })
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: error?.message || 'ai news cron failed' })
  }
}
