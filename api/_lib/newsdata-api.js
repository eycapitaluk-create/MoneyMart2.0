const NEWSDATA_API_BASE_URL = 'https://newsdata.io/api/1/news'

const toJpTime = (value) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '--:--'
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const normalizeLanguage = (value = '') => {
  const v = String(value || '').toLowerCase()
  if (v === 'japanese') return 'ja'
  if (v === 'english') return 'en'
  return v
}

export const getNewsDataIoToken = (getEnv) => (
  getEnv('NEWSDATA_API_KEY')
  || getEnv('NEWSDATAIO_API_KEY')
)

export const fetchNewsDataIoArticles = async ({
  apiToken,
  q = '',
  language = 'ja,en',
  country = 'jp,us',
  category = 'business',
  size = 20,
}) => {
  const params = new URLSearchParams({
    apikey: apiToken,
    size: String(size),
  })
  if (q) params.set('q', q)
  if (language) params.set('language', language)
  if (country) params.set('country', country)
  if (category) params.set('category', category)

  const res = await fetch(`${NEWSDATA_API_BASE_URL}?${params.toString()}`)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`NewsData.io unavailable (${res.status}) ${text.slice(0, 200)}`.trim())
  }

  const payload = await res.json()
  if (payload?.status === 'error') {
    throw new Error(payload?.results?.message || payload?.message || 'NewsData.io returned an error.')
  }

  return Array.isArray(payload?.results) ? payload.results : []
}

export const normalizeNewsDataIoArticle = (article, detectTopic) => {
  const normalized = {
    source: article?.source_id || article?.source_name || 'NewsData.io',
    title: article?.title || '',
    description: article?.description || article?.content || '',
    url: article?.link || '',
    image_url: article?.image_url || '',
    language: normalizeLanguage(article?.language),
    published_at: article?.pubDate || null,
    time_text: toJpTime(article?.pubDate),
    locale: Array.isArray(article?.country) ? article.country.join(',').toLowerCase() : String(article?.country || '').toLowerCase(),
    categories: Array.isArray(article?.category) ? article.category : [],
  }
  return {
    ...normalized,
    topic: typeof detectTopic === 'function' ? detectTopic(normalized) : 'Business',
  }
}
