/** Community badge tiers — shared with lounge_character_stats EXP */

import { getCommunityPostBody, stripCommunitySeedMarker } from './communitySeed'

export const COMMUNITY_EXP_LEVELS = [0, 300, 900, 2500, 6000]

/** Lucide icon keys used by CommunityTierBadge */
export const COMMUNITY_TIER_ICON_IDS = ['eye', 'book', 'users', 'pen', 'crown']

export const COMMUNITY_TIERS = [
  {
    level: 1,
    id: 'lurker',
    labelJa: 'ビギナー',
    labelEn: 'Lurker',
    minExp: 0,
    icon: 'eye',
    canReadBody: true,
    canLike: true,
    canComment: false,
    canPost: false,
    color: 'slate',
  },
  {
    level: 2,
    id: 'reader',
    labelJa: 'リーダー',
    labelEn: 'Reader',
    minExp: 300,
    icon: 'book',
    canReadBody: true,
    canLike: true,
    canComment: false,
    canPost: false,
    color: 'sky',
  },
  {
    level: 3,
    id: 'member',
    labelJa: 'メンバー',
    labelEn: 'Member',
    minExp: 900,
    icon: 'users',
    canReadBody: true,
    canLike: true,
    canComment: true,
    canPost: false,
    color: 'emerald',
  },
  {
    level: 4,
    id: 'writer',
    labelJa: 'ライター',
    labelEn: 'Writer',
    minExp: 2500,
    icon: 'pen',
    canReadBody: true,
    canLike: true,
    canComment: true,
    canPost: true,
    color: 'orange',
  },
  {
    level: 5,
    id: 'core',
    labelJa: 'コア',
    labelEn: 'Core',
    minExp: 6000,
    icon: 'crown',
    canReadBody: true,
    canLike: true,
    canComment: true,
    canPost: true,
    color: 'amber',
  },
]

export const COMMUNITY_EXP_REWARDS = [
  { action: 'daily_login', points: 5, labelJa: '毎日ログイン' },
  { action: 'email_verified', points: 20, labelJa: 'メール認証' },
  { action: 'asset_register', points: 30, labelJa: '資産・銘柄1件登録' },
  { action: 'portfolio_3', points: 50, labelJa: '3銘柄以上ボーナス' },
  { action: 'first_post', points: 40, labelJa: '初投稿' },
]

/** 投稿解放 — EXPライターに加え、保有資産1件以上でも可 */
export const COMMUNITY_POST_UNLOCK_LINES = [
  'マイページで関心銘柄・株式・ファンド・資産のいずれかを1件以上登録',
  'または ライターバッジ（2,500 EXP）',
]

export function getTierForExp(totalExp) {
  const exp = Number(totalExp) || 0
  let tier = COMMUNITY_TIERS[0]
  for (const row of COMMUNITY_TIERS) {
    if (exp >= row.minExp) tier = row
  }
  return tier
}

export function getNextTier(totalExp) {
  const exp = Number(totalExp) || 0
  return COMMUNITY_TIERS.find((row) => row.minExp > exp) || null
}

export function expProgressToNextTier(totalExp) {
  const tier = getTierForExp(totalExp)
  const next = getNextTier(totalExp)
  if (!next) {
    return { current: 0, need: 0, percent: 100, nextTier: null }
  }
  const low = tier.minExp
  const high = next.minExp
  const current = Number(totalExp) || 0
  const span = high - low
  return {
    current: current - low,
    need: span,
    percent: span > 0 ? Math.min(100, ((current - low) / span) * 100) : 100,
    nextTier: next,
  }
}

export function permissionsFromExp(totalExp) {
  const tier = getTierForExp(totalExp)
  return {
    tier,
    canReadBody: tier.canReadBody,
    canLike: tier.canLike,
    canComment: tier.canComment,
    canPost: tier.canPost,
  }
}

/** Strip post bodies for users below Reader tier */
export function applyFeedTierGating(posts, totalExp, { isLoggedIn = true } = {}) {
  if (isLoggedIn) {
    return (posts || []).map((post) => {
      const cleanContent = getCommunityPostBody(post)
      return {
        ...post,
        title: stripCommunitySeedMarker(post.title || ''),
        content: cleanContent,
        contentLocked: false,
        displayContent: cleanContent,
      }
    })
  }
  return (posts || []).map((post) => ({
    ...post,
    contentLocked: true,
    displayContent: '',
    content: '',
  }))
}

export function tierBadgeClass(color = 'slate') {
  const map = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    sky: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
    emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    orange: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
    amber: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
  }
  return map[color] || map.slate
}

/** メダル型バッジのグラデーション（CommunityTierBadge） */
export function tierMedalClass(color = 'slate') {
  const map = {
    slate: 'bg-gradient-to-br from-slate-400 to-slate-600 ring-slate-300/70 dark:ring-slate-500/50 shadow-slate-500/25',
    sky: 'bg-gradient-to-br from-sky-400 to-sky-600 ring-sky-300/70 dark:ring-sky-500/40 shadow-sky-500/30',
    emerald: 'bg-gradient-to-br from-emerald-400 to-emerald-600 ring-emerald-300/70 dark:ring-emerald-500/40 shadow-emerald-500/30',
    orange: 'bg-gradient-to-br from-orange-400 to-orange-600 ring-orange-300/70 dark:ring-orange-500/40 shadow-orange-500/35',
    amber: 'bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 ring-amber-300/80 dark:ring-amber-400/50 shadow-amber-500/40',
  }
  return map[color] || map.slate
}
