import { supabase } from './supabase'

export const getFallbackNewsData = () => ({
  marketTicker: [],
  marketPickup: [],
  fundPickup: [],
  stockDisclosures: [],
  dailyBrief: { headline: '' },
  updatedAt: null,
})

export const fetchNewsManualData = async () => {
  const { data, error } = await supabase
    .from('news_manual')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error || !data?.length) return getFallbackNewsData()

  const byBucket = (bucket) =>
    data.filter((r) => r.bucket === bucket).map((r) => ({
      source: r.source || '',
      title: r.title || '',
      description: r.description || '',
      url: r.url || '',
      imageUrl: r.image_url || '',
      topic: r.topic || '',
      time: r.time_text || '',
      language: r.language || 'ja',
    }))

  const dailyBriefRow = data.find((r) => r.bucket === 'daily_brief')

  return {
    marketTicker:     byBucket('market_ticker'),
    marketPickup:     byBucket('market_pickup'),
    fundPickup:       byBucket('fund_pickup'),
    stockDisclosures: byBucket('stock_disclosures'),
    dailyBrief: { headline: dailyBriefRow?.title || '' },
    updatedAt: data[0]?.updated_at || null,
  }
}
