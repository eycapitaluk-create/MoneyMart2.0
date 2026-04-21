import { supabase } from './supabase'

// Keep progression meaningful for power users.
const EXP_LEVELS = [0, 300, 900, 2500, 6000] // 0→Lv1, 300→Lv2, ...
const BADGE_BY_LEVEL = {
  1: { id: 'rookie', label: 'Rookie' },
  2: { id: 'active', label: 'Active' },
  3: { id: 'core', label: 'Core Member' },
  4: { id: 'veteran', label: 'Veteran' },
  5: { id: 'legend', label: 'Legend' },
}

export function expToLevel(totalExp) {
  const exp = Number(totalExp) || 0
  for (let i = EXP_LEVELS.length - 1; i >= 0; i--) {
    if (exp >= EXP_LEVELS[i]) return i + 1
  }
  return 1
}

export function expToStage(totalExp) {
  return Math.min(5, expToLevel(totalExp))
}

export function getBadgeByExp(totalExp) {
  const level = expToLevel(totalExp)
  return BADGE_BY_LEVEL[level] || BADGE_BY_LEVEL[1]
}

export function expForNextLevel(totalExp) {
  const level = expToLevel(totalExp)
  if (level >= 5) return null
  return EXP_LEVELS[level]
}

export function expProgressInLevel(totalExp) {
  const level = expToLevel(totalExp)
  if (level >= 5) return { current: 1, need: 1 }
  const low = EXP_LEVELS[level - 1] ?? 0
  const high = EXP_LEVELS[level]
  const current = Number(totalExp) || 0
  return {
    current: current - low,
    need: high - low,
    percent: Math.min(100, ((current - low) / (high - low)) * 100),
  }
}

/**
 * Fetch character stats for multiple user IDs.
 * @param {string[]} userIds
 * @returns {Promise<Map<string, { total_exp: number, level: number, character_stage: number }>>}
 */
export async function fetchCharacterStats(userIds = []) {
  const ids = [...new Set((userIds || []).filter(Boolean))]
  if (ids.length === 0) return new Map()

  const { data, error } = await supabase
    .from('lounge_character_stats')
    .select('user_id, total_exp, level, character_stage')
    .in('user_id', ids)

  if (error) return new Map()
  const map = new Map()
  for (const row of data || []) {
    const totalExp = Number(row.total_exp || 0)
    map.set(row.user_id, {
      total_exp: totalExp,
      level: expToLevel(totalExp),
      character_stage: expToStage(totalExp),
    })
  }
  return map
}

/**
 * Fetch single user's character stats (for "my character" panel).
 * @param {string} userId
 * @returns {Promise<{ total_exp: number, level: number, character_stage: number } | null>}
 */
export async function fetchMyCharacterStats(userId) {
  if (!userId) return null
  const map = await fetchCharacterStats([userId])
  return map.get(userId) ?? { total_exp: 0, level: 1, character_stage: 1 }
}

/**
 * Top users by EXP for leaderboard (optional).
 */
export async function fetchCharacterLeaderboard(limit = 10) {
  const { data, error } = await supabase
    .from('lounge_character_stats')
    .select('user_id, total_exp, level, character_stage')
    .order('total_exp', { ascending: false })
    .limit(limit)
  if (error) return []
  return (data || []).map((row) => ({
    user_id: row.user_id,
    total_exp: Number(row.total_exp || 0),
    level: expToLevel(Number(row.total_exp || 0)),
    character_stage: expToStage(Number(row.total_exp || 0)),
  }))
}

/**
 * Leaderboard with display names from user_profiles.
 */
export async function fetchCharacterLeaderboardWithNames(limit = 5) {
  const rows = await fetchCharacterLeaderboard(limit)
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.user_id)
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('user_id, nickname, full_name')
    .in('user_id', ids)
  const nameByUserId = new Map(
    (profiles || []).map((p) => [p.user_id, p.nickname || p.full_name || 'メンバー'])
  )
  return rows.map((r) => ({
    ...r,
    name: nameByUserId.get(r.user_id) || 'メンバー',
  }))
}
