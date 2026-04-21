import { supabase } from './supabase'

// Referral qualification (SUPABASE_SETUP_REFERRALS_MVP.sql bump_referral_qualification_on_activity) counts these names toward qualifying_event_count.
const TOOL_XP_THRESHOLDS = [0, 120, 320, 700, 1300]

const scoreEvent = (eventName, eventMeta = {}) => {
  const name = String(eventName || '').toLowerCase()
  const section = String(eventMeta?.section || '').toLowerCase()

  if (name === 'fund_compare_open') return 24
  if (name === 'fund_compose_open') return 16
  if (name === 'fund_watchset_saved') return 28
  if (name === 'dividend_watch_add') return 14
  if (name === 'refinance_simulated') return 22
  if (name === 'refinance_offer_clicked') return 12
  if (name === 'insight_read_complete') return 10

  if (name === 'mypage_save_success') {
    if (section.includes('expense') || section.includes('point')) return 10
    if (section.includes('asset') || section.includes('fund') || section.includes('stock')) return 12
    if (section.includes('finance_profile') || section.includes('budget')) return 8
    return 7
  }
  return 0
}

const expToLevel = (exp = 0) => {
  const n = Number(exp) || 0
  for (let i = TOOL_XP_THRESHOLDS.length - 1; i >= 0; i -= 1) {
    if (n >= TOOL_XP_THRESHOLDS[i]) return i + 1
  }
  return 1
}

const levelProgress = (exp = 0) => {
  const level = expToLevel(exp)
  if (level >= TOOL_XP_THRESHOLDS.length) {
    return { current: 1, need: 1, percent: 100 }
  }
  const low = TOOL_XP_THRESHOLDS[level - 1] || 0
  const high = TOOL_XP_THRESHOLDS[level] || low + 1
  const cur = Math.max(0, Number(exp) - low)
  const need = Math.max(1, high - low)
  return { current: cur, need, percent: Math.max(0, Math.min(100, (cur / need) * 100)) }
}

const computeStreakDays = (rows = []) => {
  const uniqueDays = [...new Set((rows || []).map((row) => String(row?.created_at || '').slice(0, 10)).filter(Boolean))]
    .sort((a, b) => (a > b ? -1 : 1))
  if (uniqueDays.length === 0) return 0

  let streak = 0
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  const today = d.toISOString().slice(0, 10)

  const daySet = new Set(uniqueDays)
  let cursor = today
  while (daySet.has(cursor)) {
    streak += 1
    const curDate = new Date(`${cursor}T00:00:00Z`)
    curDate.setUTCDate(curDate.getUTCDate() - 1)
    cursor = curDate.toISOString().slice(0, 10)
  }
  return streak
}

export async function recordUserActivityEvent(userId, eventName, eventMeta = {}) {
  if (!userId || !eventName) return false
  try {
    const { error } = await supabase.from('user_activity_events').insert({
      user_id: userId,
      event_name: eventName,
      event_meta: eventMeta || {},
    })
    return !error
  } catch {
    return false
  }
}

export async function fetchToolXpSummary(userId, { days = 45 } = {}) {
  if (!userId) return null
  const cutoff = new Date(Date.now() - Math.max(1, Number(days) || 45) * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('user_activity_events')
    .select('event_name,event_meta,created_at')
    .eq('user_id', userId)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1500)

  if (error) return null
  const rows = data || []
  const totalXp = rows.reduce((sum, row) => sum + scoreEvent(row.event_name, row.event_meta || {}), 0)
  const level = expToLevel(totalXp)
  const stage = Math.min(5, level)
  return {
    totalXp,
    level,
    stage,
    progress: levelProgress(totalXp),
    streakDays: computeStreakDays(rows),
    recentEvents: rows.slice(0, 6),
  }
}

