/**
 * Google News RSS — APIキー不要（銘柄ブリフ用の無料フォールバック）
 * https://news.google.com/rss/search?q=...
 */

function decodeXmlEntities(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, '')
    .trim()
}

export function buildGoogleNewsRssSearchUrl(query) {
  const q = encodeURIComponent(String(query || '').trim())
  return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`
}

export function parseGoogleNewsRssItems(xml, limit = 8) {
  const items = []
  const blocks = String(xml).split(/<item\b/i).slice(1)
  for (const block of blocks) {
    const titleM = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const descM = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)
    const sourceM = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)
    const title = decodeXmlEntities(titleM?.[1])
    const description = decodeXmlEntities(descM?.[1])
    const source = decodeXmlEntities(sourceM?.[1])
    if (!title) continue
    items.push({
      title,
      description,
      source: source || 'Google News',
    })
    if (items.length >= limit) break
  }
  return items
}

export async function fetchGoogleNewsRssHeadlines(searchQuery, { limit = 8 } = {}) {
  const q = String(searchQuery || '').trim()
  if (!q) return []
  const url = buildGoogleNewsRssSearchUrl(q)
  const res = await fetch(url, {
    headers: {
      Accept: 'application/rss+xml, application/xml, text/xml, */*',
      'User-Agent': 'MoneyMart/1.0 (stock-brief-rss)',
    },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Google News RSS ${res.status}`)
  const xml = await res.text()
  return parseGoogleNewsRssItems(xml, limit)
}
