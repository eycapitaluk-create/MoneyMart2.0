import { supabase } from './supabase'

export async function fetchCommunitySentimentSummary(limit = 200) {
  const { data, error } = await supabase
    .from('lounge_posts')
    .select('sentiment')
    .eq('status', 'published')
    .limit(Math.max(20, Math.min(500, limit)))

  if (error) throw error

  const counts = { bullish: 0, bearish: 0, neutral: 0 }
  for (const row of data || []) {
    const key = row.sentiment === 'bullish' || row.sentiment === 'bearish' ? row.sentiment : 'neutral'
    counts[key] += 1
  }
  const total = counts.bullish + counts.bearish + counts.neutral
  return { counts, total }
}

export async function fetchTrendingTickersFromPosts(limit = 8) {
  const { data, error } = await supabase
    .from('lounge_posts')
    .select('ticker')
    .eq('status', 'published')
    .not('ticker', 'is', null)
    .limit(400)

  if (error) throw error

  const stats = new Map()
  for (const row of data || []) {
    const sym = String(row.ticker || '').trim().toUpperCase()
    if (!sym || sym === 'TOPIC' || sym === 'GENERAL') continue
    stats.set(sym, (stats.get(sym) || 0) + 1)
  }

  return [...stats.entries()]
    .map(([ticker, count]) => ({ ticker, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}
