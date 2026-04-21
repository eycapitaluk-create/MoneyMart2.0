import { supabase } from './supabase'
import { isMarketRelevantManualNews } from './marketNewsRelevance'

/** 手動ニュースの更新日表示に使う下限（null→Date(null)→1970年問題の除外） */
const MIN_VALID_MANUAL_NEWS_MS = Date.UTC(2000, 0, 1)

export const isValidManualNewsTimestamp = (value) => {
  if (value == null || value === '') return false
  const t = new Date(value).getTime()
  return Number.isFinite(t) && t >= MIN_VALID_MANUAL_NEWS_MS
}

export const formatManualNewsUpdatedAtJa = (value) => {
  if (!isValidManualNewsTimestamp(value)) return null
  return new Date(value).toLocaleString('ja-JP')
}

/** 配信元名が見出し末尾に重複して付くケースを整理（例: 「… All About」「… | All About」） */
export const stripTrailingPublisherFromNewsTitle = (title = '') => {
  let t = String(title || '').trim()
  const patterns = [
    /\s*【\s*All About\s*】\s*$/i,
    /\s*（\s*All About\s*）\s*$/i,
    /\s*[\|｜]\s*All About\s*$/i,
    /\s+All About\s*$/i,
  ]
  for (const re of patterns) {
    t = t.replace(re, '').trim()
  }
  return t
}

const toTimeText = (value) => {
  if (!value) return '--:--'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '--:--'
  return d.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tokyo',
  })
}

const normalizeRow = (row) => ({
  source: row?.source || 'Unknown',
  title: stripTrailingPublisherFromNewsTitle(row?.title || ''),
  time: row?.time_text || toTimeText(row?.published_at),
  topic: row?.topic || 'News',
  url: row?.url || '',
  imageUrl: row?.image_url || '',
  publishedAt: row?.published_at || '',
  description: row?.description || '',
  language: String(row?.language || '').toLowerCase() || 'ja',
})

export const getFallbackNewsData = () => ({
  updatedAt: null,
  marketTicker: [],
  marketPickup: [],
  fundPickup: [],
  stockDisclosures: [],
  marketMajorEvents: [],
  marketWeeklySummary: [],
  dailyBrief: null,
})

export const fetchNewsManualData = async () => {
  const fallback = getFallbackNewsData()
  const { data, error } = await supabase
    .from('news_manual')
    .select('bucket,source,title,description,url,image_url,topic,time_text,language,published_at,updated_at,tone')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('published_at', { ascending: false })
    .limit(300)
  if (error || !Array.isArray(data) || data.length === 0) return fallback

  const byBucket = {
    market_ticker: [],
    market_pickup: [],
    fund_pickup: [],
    stock_disclosures: [],
    market_major_event: [],
    market_weekly_summary: [],
  }
  let dailyBrief = null
  let latestUpdated = null

  const bumpLatestTimestamp = (ts) => {
    if (!isValidManualNewsTimestamp(ts)) return
    const t = new Date(ts).getTime()
    if (!latestUpdated || t > new Date(latestUpdated).getTime()) {
      latestUpdated = ts
    }
  }

  for (const row of data) {
    bumpLatestTimestamp(row?.updated_at)
    bumpLatestTimestamp(row?.published_at)
    if (row?.bucket === 'daily_brief') {
      if (!isMarketRelevantManualNews(row)) continue
      if (!dailyBrief) {
        dailyBrief = {
          tone: row?.tone || '中立',
          headline: row?.title || '',
          note: row?.description || '',
          source: row?.source || 'TheNewsAPI',
        }
      }
      continue
    }
    if (!byBucket[row?.bucket]) continue
    if (!isMarketRelevantManualNews(row)) continue
    byBucket[row.bucket].push(normalizeRow(row))
  }

  return {
    updatedAt: latestUpdated || null,
    marketTicker: byBucket.market_ticker,
    marketPickup: byBucket.market_pickup,
    fundPickup: byBucket.fund_pickup,
    stockDisclosures: byBucket.stock_disclosures,
    marketMajorEvents: byBucket.market_major_event,
    marketWeeklySummary: byBucket.market_weekly_summary,
    dailyBrief: dailyBrief || fallback.dailyBrief,
  }
}

export const fetchDailyBriefArchive = async (limit = 30) => {
  const { data, error } = await supabase
    .from('news_manual')
    .select('id,source,title,description,tone,topic,url,updated_at,published_at,is_active')
    .eq('bucket', 'daily_brief')
    .eq('is_active', true)
    .order('published_at', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error || !Array.isArray(data) || data.length === 0) return []
  return data
}
