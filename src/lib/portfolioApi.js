import { supabase } from './supabase'

const normalizeAllocations = (arr = [], assetType = 'fund') =>
  (Array.isArray(arr) ? arr : [])
    .map((item) => {
      const id = String(item?.id || item?.symbol || '').trim()
      const name = String(item?.name || item?.id || item?.symbol || '').trim() || id
      const weightPct = Number.isFinite(Number(item?.weightPct)) ? Number(item.weightPct) : 0
      return assetType === 'stock' ? { symbol: id, name, weightPct } : { id, name, weightPct }
    })
    .filter((x) => (x.id || x.symbol) && x.weightPct > 0)

/**
 * 포트폴리오 저장 (신규 또는 업데이트)
 * @param {object} payload - { id?, name, allocations, isPublic, return1y?, fee?, risk?, assetType?: 'fund'|'stock' }
 * @returns {Promise<{ id, ... }>}
 */
export async function savePortfolio({
  id,
  name,
  allocations,
  isPublic = false,
  return1y,
  fee,
  risk,
  assetType = 'fund',
  userId,
}) {
  const uid = userId || (await supabase.auth.getUser()).data?.user?.id
  if (!uid) throw new Error('ログインが必要です')

  const norm = normalizeAllocations(allocations, assetType)
  if (norm.length < 2) throw new Error(assetType === 'stock' ? '2銘柄以上が必要です' : '2件以上のファンドが必要です')
  const total = norm.reduce((s, x) => s + x.weightPct, 0)
  if (Math.abs(total - 100) > 0.5) throw new Error('配分の合計は100%にしてください')

  const row = {
    user_id: uid,
    name: String(name || '').trim() || 'ポートフォリオ',
    allocations: norm,
    is_public: Boolean(isPublic),
    asset_type: assetType === 'stock' ? 'stock' : 'fund',
    return_1y: Number.isFinite(Number(return1y)) ? Number(return1y) : null,
    fee: Number.isFinite(Number(fee)) ? Number(fee) : null,
    risk: Number.isFinite(Number(risk)) ? Number(risk) : null,
    fund_count: norm.length,
  }

  if (id) {
    const { data, error } = await supabase
      .from('portfolios')
      .update(row)
      .eq('id', id)
      .eq('user_id', uid)
      .select()
      .single()
    if (error) throw error
    // 이력 저장
    await supabase.from('portfolio_allocation_history').insert({
      portfolio_id: id,
      allocations: norm,
    })
    return data
  }

  const { data, error } = await supabase.from('portfolios').insert(row).select().single()
  if (error) throw error
  return data
}

/**
 * 공개 포트폴리오 목록 (팔로워순/최신순)
 * @param {object} opts - { limit?, orderBy?: 'followers'|'recent' }
 */
export async function fetchPublicPortfolios({ limit = 20, orderBy = 'followers' } = {}) {
  let query = supabase
    .from('portfolios')
    .select('id,user_id,name,allocations,return_1y,fee,risk,fund_count,follower_count,updated_at,created_at,asset_type')
    .eq('is_public', true)
    .limit(limit)

  if (orderBy === 'followers') {
    query = query.order('follower_count', { ascending: false }).order('updated_at', { ascending: false })
  } else {
    query = query.order('updated_at', { ascending: false })
  }

  const { data, error } = await query
  if (error) throw error

  const userIds = [...new Set((data || []).map((r) => r.user_id).filter(Boolean))]
  const profileMap = await fetchProfileNames(userIds)

  return (data || []).map((r) => ({
    ...r,
    author_name: profileMap.get(r.user_id) || 'Member',
  }))
}

async function fetchProfileNames(userIds) {
  if (userIds.length === 0) return new Map()
  const { data } = await supabase
    .from('user_profiles')
    .select('user_id,nickname,full_name')
    .in('user_id', userIds)
  return new Map(
    (data || []).map((row) => [row.user_id, row.nickname || row.full_name || 'Member'])
  )
}

/**
 * 팔로우/언팔로우 (参考にする)
 */
export async function togglePortfolioFollow({ portfolioId, userId }) {
  const uid = userId || (await supabase.auth.getUser()).data?.user?.id
  if (!uid) throw new Error('ログインが必要です')

  const { data: existing } = await supabase
    .from('portfolio_follows')
    .select('id')
    .eq('user_id', uid)
    .eq('portfolio_id', portfolioId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('portfolio_follows')
      .delete()
      .eq('user_id', uid)
      .eq('portfolio_id', portfolioId)
    if (error) throw error
    return false
  }

  const { error } = await supabase.from('portfolio_follows').insert({
    user_id: uid,
    portfolio_id: portfolioId,
  })
  if (error) throw error
  return true
}

/**
 * 다른 사람 포트폴리오를 내 것으로 복사
 * @returns {Promise<{ id, ... }>} 새로 생성된 포트폴리오
 */
export async function copyPortfolioToMine({ portfolioId, userId }) {
  const uid = userId || (await supabase.auth.getUser()).data?.user?.id
  if (!uid) throw new Error('ログインが必要です')

  const { data: source, error: fetchErr } = await supabase
    .from('portfolios')
    .select('name,allocations,return_1y,fee,risk,asset_type')
    .eq('id', portfolioId)
    .eq('is_public', true)
    .single()
  if (fetchErr || !source) throw new Error('ポートフォリオが見つかりません')

  return savePortfolio({
    name: `${source.name} (コピー)`,
    allocations: source.allocations || [],
    isPublic: false,
    assetType: source.asset_type || 'fund',
    return1y: source.return_1y,
    fee: source.fee,
    risk: source.risk,
    userId: uid,
  })
}

/**
 * 내 포트폴리오 목록
 */
export async function fetchMyPortfolios(userId) {
  const uid = userId || (await supabase.auth.getUser()).data?.user?.id
  if (!uid) return []

  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .eq('user_id', uid)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data || []
}

/**
 * 단일 포트폴리오 조회 (공개 또는 본인)
 */
export async function fetchPortfolioById(portfolioId, userId) {
  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .eq('id', portfolioId)
    .single()
  if (error) throw error
  if (!data) return null
  if (!data.is_public && data.user_id !== userId) return null
  return data
}

/**
 * 내가 팔로우 중인 포트폴리오 ID 목록
 */
export async function fetchMyFollowedPortfolioIds(userId) {
  const uid = userId || (await supabase.auth.getUser()).data?.user?.id
  if (!uid) return new Set()

  const { data, error } = await supabase
    .from('portfolio_follows')
    .select('portfolio_id')
    .eq('user_id', uid)
  if (error) throw error
  return new Set((data || []).map((r) => r.portfolio_id))
}
