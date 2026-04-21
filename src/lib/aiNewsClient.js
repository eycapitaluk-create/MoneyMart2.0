import { supabase } from './supabase'

/** 見出し・要約に日本語が含まれるか（英語のみの行を除外するヒューリスティック） */
const JP_CHAR_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/

/**
 * ニュース一覧に載せる AI 要約行か（一覧カードに出る見出し・要約・抜粋に日本語がある行のみ）
 * - DB の language=ja でも、見出し・要約が英語のみなら除外（誤タグで英語記事が混ざるのを防ぐ）
 * - analysis や discussion にだけ日本語があっても一覧の本文は英語に見えるため採用しない
 */
export function isAiNewsJapaneseRow(row) {
  if (!row || typeof row !== 'object') return false
  const mainProbe = [
    row.headline,
    row.summary,
    row.rawSnippet,
    row.raw_snippet,
  ]
    .map((s) => String(s || ''))
    .join(' ')
  return JP_CHAR_RE.test(mainProbe)
}

/** 記事日付（JST）— メタ行表示用 */
export function formatNewsDateTextJst(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })
}

/** DB 未マイグレーション時は complete 扱い（既存行） */
const normalizeRow = (row) => ({
  id: row?.id || `${row?.ticker || 'news'}-${row?.sort_order || 0}`,
  ticker: row?.ticker || '',
  companyName: row?.company_name || row?.companyName || '',
  flag: row?.flag || '',
  sector: row?.sector || 'その他',
  headline: row?.headline || '',
  source: row?.source || 'MoneyMart',
  sourceUrl: row?.source_url || row?.sourceUrl || '',
  timeText: row?.time_text || row?.timeText || '--:--',
  dateText: formatNewsDateTextJst(row?.published_at || row?.publishedAt),
  isHot: Boolean(row?.is_hot ?? row?.isHot),
  summary: row?.summary || '',
  analysis: row?.analysis || '',
  sentiment: row?.sentiment || '中立',
  reason: row?.reason || '',
  impact: row?.impact || '',
  keywords: Array.isArray(row?.keywords) ? row.keywords : [],
  discussionTitle: row?.discussion_title || row?.discussionTitle || '',
  discussionBody: row?.discussion_body || row?.discussionBody || '',
  publishedAt: row?.published_at || row?.publishedAt || '',
  language: String(row?.language || '').trim().toLowerCase(),
  aiAnalysisStatus: row?.ai_analysis_status || 'complete',
  rawSnippet: row?.raw_snippet || row?.rawSnippet || '',
})

export const getFallbackAiNewsData = () => ({
  updatedAt: new Date().toISOString(),
  rows: [],
})

/** マイグレーション前の DB には ai_analysis_status / raw_snippet が無く、select 全体が失敗する。 */
const AI_NEWS_SELECT_CORE =
  'id,ticker,company_name,flag,sector,headline,source,source_url,time_text,is_hot,summary,analysis,sentiment,reason,impact,keywords,discussion_title,discussion_body,published_at,updated_at,sort_order'
const AI_NEWS_SELECT_FULL = `${AI_NEWS_SELECT_CORE},ai_analysis_status,raw_snippet`
/** AI要約一覧の公開日フィルタ（日）。4日のみだと過去記事が一覧から消えるため、閲覧用に30日程度を確保 */
export const AI_NEWS_LOOKBACK_DAYS = 30
const AI_NEWS_FETCH_LIMIT = 300
const AI_NEWS_FALLBACK_LOOKBACK_DAYS = 90
/** 直近1週間は取得件数を広げ、最新枠が英語中心でも日本語行を取りこぼしにくくする */
const AI_NEWS_WEEK_LOOKBACK_DAYS = 7
const AI_NEWS_WEEK_FETCH_LIMIT = 800
/** language=ja/jp 行は日付順の上位N件に入らなくても必ずマージする */
const AI_NEWS_JA_LANG_LOOKBACK_DAYS = 30
const AI_NEWS_JA_LANG_FETCH_LIMIT = 500

function cutoffIsoDaysAgo(days) {
  return new Date(Date.now() - (1000 * 60 * 60 * 24 * days)).toISOString()
}

/** id で重複除去し published_at 降順（同日内は sort_order 昇順） */
function mergeAiNewsRowsById(primary, extra) {
  const map = new Map()
  const add = (row) => {
    if (!row || row.id == null) return
    const id = String(row.id)
    if (!id || map.has(id)) return
    map.set(id, row)
  }
  for (const row of primary || []) add(row)
  for (const row of extra || []) add(row)
  return [...map.values()].sort((a, b) => {
    const tb = Date.parse(b.published_at || '') || 0
    const ta = Date.parse(a.published_at || '') || 0
    if (tb !== ta) return tb - ta
    const sa = Number(a.sort_order) || 0
    const sb = Number(b.sort_order) || 0
    return sa - sb
  })
}

async function loadAiNewsSummaries(selectColumns) {
  const primaryCutoff = cutoffIsoDaysAgo(AI_NEWS_LOOKBACK_DAYS)

  const runQuery = async ({ publishedGte, limit }) => {
    let q = supabase
      .from('ai_news_summaries')
      .select(selectColumns)
      .eq('is_active', true)
    if (publishedGte) {
      q = q.gte('published_at', publishedGte)
    }
    return q
      .order('published_at', { ascending: false })
      .order('sort_order', { ascending: true })
      .limit(limit)
  }

  const recentRes = await runQuery({ publishedGte: primaryCutoff, limit: AI_NEWS_FETCH_LIMIT })

  if (recentRes.error) return { data: [], error: recentRes.error }

  let data = Array.isArray(recentRes.data) ? recentRes.data : []
  if (data.length === 0) {
    const fallbackCutoff = cutoffIsoDaysAgo(AI_NEWS_FALLBACK_LOOKBACK_DAYS)
    const wider = await runQuery({ publishedGte: fallbackCutoff, limit: AI_NEWS_FETCH_LIMIT })
    if (!wider.error && Array.isArray(wider.data) && wider.data.length > 0) {
      data = wider.data
    } else {
      const latestRes = await runQuery({ publishedGte: null, limit: AI_NEWS_FETCH_LIMIT })
      if (latestRes.error) return { data: [], error: latestRes.error }
      data = Array.isArray(latestRes.data) ? latestRes.data : []
    }
  }

  const weekRes = await runQuery({
    publishedGte: cutoffIsoDaysAgo(AI_NEWS_WEEK_LOOKBACK_DAYS),
    limit: AI_NEWS_WEEK_FETCH_LIMIT,
  })
  if (!weekRes.error && Array.isArray(weekRes.data) && weekRes.data.length > 0) {
    data = mergeAiNewsRowsById(data, weekRes.data)
  }

  /** DB で language が ja/jp と付いている行は、直近N件が英語でも一覧に載るよう別クエリで補完 */
  const jaLangRes = await supabase
    .from('ai_news_summaries')
    .select(selectColumns)
    .eq('is_active', true)
    .gte('published_at', cutoffIsoDaysAgo(AI_NEWS_JA_LANG_LOOKBACK_DAYS))
    .in('language', ['ja', 'jp', 'JA', 'JP', 'japanese', 'Japanese'])
    .order('published_at', { ascending: false })
    .order('sort_order', { ascending: true })
    .limit(AI_NEWS_JA_LANG_FETCH_LIMIT)
  if (!jaLangRes.error && Array.isArray(jaLangRes.data) && jaLangRes.data.length > 0) {
    data = mergeAiNewsRowsById(data, jaLangRes.data)
  }

  return { data, error: null }
}

export const fetchAiNewsData = async () => {
  const fallback = getFallbackAiNewsData()

  let { data, error } = await loadAiNewsSummaries(AI_NEWS_SELECT_FULL)
  if (error) {
    const legacy = await loadAiNewsSummaries(AI_NEWS_SELECT_CORE)
    data = legacy.data
    error = legacy.error
  }

  if (error || !Array.isArray(data) || data.length === 0) return fallback

  const latestUpdated = data
    .map((row) => row?.published_at || row?.updated_at)
    .filter(Boolean)
    .sort()
    .slice(-1)[0] || fallback.updatedAt

  return {
    updatedAt: latestUpdated,
    rows: data.map(normalizeRow),
  }
}

export const NEWS_PAGE_MANUAL_BUCKET = 'news_page_manual'
export const NEWS_PAGE_MANUAL_SOURCE = 'MoneyMart'

const supabaseOrigin = () => String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')

/** サーバ側 api/proxy/storage-public-image と同じ許可バケット */
const PROXY_STORAGE_BUCKETS = new Set(['news_page_manual', 'news-images'])

/**
 * Supabase Storage 公開URLを同一オリジンのプロキシURLへ（img src にプロジェクトホストを出さない）
 */
export function toProxiedPublicStorageUrl(resolved) {
  const s = String(resolved || '').trim()
  if (!s || s.startsWith('data:')) return s
  try {
    const abs = s.startsWith('//') ? `https:${s}` : s
    const u = new URL(abs)
    if (!u.hostname.toLowerCase().endsWith('.supabase.co')) return s
    const m = u.pathname.match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
    if (!m) return s
    const bucket = m[1]
    if (!PROXY_STORAGE_BUCKETS.has(bucket)) return s
    let objectPath = m[2]
    try {
      objectPath = decodeURIComponent(m[2])
    } catch {
      /* pathname は多くの環境で既にデコード済み */
    }
    const qs = new URLSearchParams()
    qs.set('bucket', bucket)
    qs.set('path', objectPath)
    return `/api/proxy/storage-public-image?${qs.toString()}`
  } catch {
    return s
  }
}

/** 手動ニュースの画像: フルURL / Storageパス / 相対パス をブラウザで表示できるURLへ */
export function normalizeNewsManualImageUrl(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  const low = s.toLowerCase()
  if (low.startsWith('data:')) return s
  if (low.startsWith('http://') || low.startsWith('https://') || s.startsWith('//')) {
    const abs = s.startsWith('//') ? `https:${s}` : s
    return toProxiedPublicStorageUrl(abs)
  }

  const origin = supabaseOrigin()
  if (s.startsWith('/storage/v1/') && origin) {
    return toProxiedPublicStorageUrl(`${origin}${s}`)
  }
  if (s.startsWith('storage/v1/') && origin) {
    return toProxiedPublicStorageUrl(`${origin}/${s}`)
  }

  const firstSlash = s.indexOf('/')
  if (firstSlash > 0 && !s.includes('://')) {
    const maybeBucket = s.slice(0, firstSlash)
    const objectPath = s.slice(firstSlash + 1)
    if (maybeBucket && objectPath) {
      try {
        const { data } = supabase.storage.from(maybeBucket).getPublicUrl(objectPath)
        if (data?.publicUrl) return toProxiedPublicStorageUrl(data.publicUrl)
      } catch {
        // fall through
      }
    }
  }

  if (!s.includes('/') && s.length > 0) {
    try {
      const { data } = supabase.storage.from(NEWS_PAGE_MANUAL_BUCKET).getPublicUrl(s)
      if (data?.publicUrl) return toProxiedPublicStorageUrl(data.publicUrl)
    } catch {
      // fall through
    }
  }

  return s
}

export const fetchNewsPageManual = async () => {
  const { data, error } = await supabase
    .from('news_manual')
    .select('id,title,description,published_at,source,sort_order,image_url,url')
    .eq('bucket', NEWS_PAGE_MANUAL_BUCKET)
    .eq('is_active', true)
    .order('published_at', { ascending: false })
    .order('sort_order', { ascending: true })
    .limit(50)
  if (error || !Array.isArray(data)) return []
  return data.map((row) => ({
    id: `manual-${row.id}`,
    manualRowId: row.id,
    type: 'manual',
    companyName: row.title || '',
    headline: row.title || '',
    summary: row.description || '',
    source: row.source || NEWS_PAGE_MANUAL_SOURCE,
    publishedAt: row.published_at || '',
    dateText: formatNewsDateTextJst(row.published_at),
    timeText: row.published_at
      ? new Date(row.published_at).toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Tokyo',
      })
      : '--:--',
    sector: 'その他',
    sentiment: '中立',
    flag: '🇯🇵',
    ticker: '',
    isHot: false,
    impact: '',
    reason: '',
    keywords: [],
    discussionTitle: '',
    discussionBody: '',
    imageUrl: normalizeNewsManualImageUrl(row.image_url || row.imageUrl),
    sourceUrl: String(row.url || row.source_url || row.sourceUrl || '').trim(),
  }))
}
