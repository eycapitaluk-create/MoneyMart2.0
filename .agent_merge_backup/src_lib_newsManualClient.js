/**
 * News manual client - fetches curated news from Supabase or returns fallback
 */
import { supabase } from './supabase'

export function getFallbackNewsData() {
  return {
    marketTicker: [],
    marketPickup: [],
    fundPickup: [],
    stockDisclosures: [],
  }
}

export async function fetchNewsManualData() {
  try {
    const { data, error } = await supabase
      .from('news_manual')
      .select('*')
      .limit(100)
    if (error) throw error
    const rows = data || []
    const marketTicker = rows.filter((r) => r?.category === 'marketTicker' || r?.type === 'ticker')
    const marketPickup = rows.filter((r) => r?.category === 'marketPickup' || r?.type === 'pickup')
    const fundPickup = rows.filter((r) => r?.category === 'fundPickup' || r?.type === 'fund')
    const stockDisclosures = rows.filter((r) => r?.category === 'stockDisclosures' || r?.type === 'disclosure')
    const mapRow = (r) => ({
      ...r,
      language: r?.language || 'ja',
      imageUrl: r?.image_url || null,
      time: r?.published_at ? new Date(r.published_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }) : (r?.time || '--:--'),
    })
    return {
      marketTicker: marketTicker.map(mapRow),
      marketPickup: marketPickup.map(mapRow),
      fundPickup: fundPickup.map(mapRow),
      stockDisclosures: stockDisclosures.map(mapRow),
    }
  } catch {
    return getFallbackNewsData()
  }
}
