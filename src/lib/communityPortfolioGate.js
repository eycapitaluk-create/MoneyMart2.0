import { supabase } from './supabase'

/** コミュニティ投稿解放 — マイページで1件以上登録済みか */
export async function userHasCommunityPortfolioAsset(userId) {
  const uid = String(userId || '').trim()
  if (!uid) return false

  const tables = [
    'user_watchlists',
    'user_owned_stocks',
    'user_owned_funds',
    'user_asset_positions',
  ]

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('id').eq('user_id', uid).limit(1)
    if (error) {
      if (/does not exist|relation|permission denied/i.test(String(error.message || ''))) continue
      throw error
    }
    if (Array.isArray(data) && data.length > 0) return true
  }
  return false
}
