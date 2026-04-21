const THE_NEWS_API_BASE_URL = 'https://api.thenewsapi.com/v1/news/all'

const toJpTime = (value) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '--:--'
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const normalizeLanguage = (value = '') => {
  const v = String(value || '').toLowerCase()
  return v === 'japanese' ? 'ja' : v
}

export const getTheNewsApiToken = (getEnv) => (
  getEnv('THENEWSAPI_API_TOKEN')
  || getEnv('THE_NEWS_API_TOKEN')
  || getEnv('NEWS_API_KEY')
)

export const normalizeTheNewsApiSearch = (value = '') => (
  String(value || '').replace(/\s+OR\s+/gi, ' | ').trim()
)

export const toIsoDateDaysAgo = (days = 0) => {
  const date = new Date(Date.now() - Math.max(0, Number(days) || 0) * 24 * 60 * 60 * 1000)
  return date.toISOString().slice(0, 10)
}

export const fetchTheNewsApiArticles = async ({
  apiToken,
  search = '',
  searchFields = 'title,description,keywords',
  language = '',
  locale = '',
  categories = 'business,tech',
  limit = 10,
  sort = 'published_at',
  publishedAfter = '',
}) => {
  const params = new URLSearchParams({
    api_token: apiToken,
    limit: String(limit),
    sort,
  })
  if (search) params.set('search', search)
  if (search && searchFields) params.set('search_fields', searchFields)
  if (language) params.set('language', language)
  if (locale) params.set('locale', locale)
  if (categories) params.set('categories', categories)
  if (publishedAfter) params.set('published_after', publishedAfter)

  const res = await fetch(`${THE_NEWS_API_BASE_URL}?${params.toString()}`)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`TheNewsAPI unavailable (${res.status}) ${text.slice(0, 200)}`.trim())
  }

  const payload = await res.json()
  if (payload?.error || payload?.message) {
    throw new Error(payload?.error || payload?.message || 'TheNewsAPI returned an error.')
  }

  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.articles)) return payload.articles
  return []
}

export const normalizeTheNewsApiArticle = (article, detectTopic) => {
  const normalized = {
    source: article?.source || 'TheNewsAPI',
    title: article?.title || '',
    description: article?.description || article?.snippet || '',
    url: article?.url || '',
    image_url: article?.image_url || '',
    language: normalizeLanguage(article?.language),
    published_at: article?.published_at || null,
    time_text: toJpTime(article?.published_at),
    locale: String(article?.locale || '').toLowerCase(),
    categories: Array.isArray(article?.categories) ? article.categories : [],
  }
  return {
    ...normalized,
    topic: typeof detectTopic === 'function' ? detectTopic(normalized) : 'Business',
  }
}
