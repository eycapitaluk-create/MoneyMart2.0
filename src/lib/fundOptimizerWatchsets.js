/**
 * 펀드 옵티마이저 세트 — Supabase 우선, localStorage fallback
 *
 * 테이블: user_fund_optimizer_sets
 *   primary key: (user_id, id)
 *   columns: id, user_id, name, source, funds(jsonb), summary(jsonb), created_at, updated_at
 */
import { supabase } from './supabase'

const PRIMARY_STORAGE_KEY = 'mm_fund_optimizer_watchsets_v2'
const LEGACY_STORAGE_KEYS = ['mm_fund_watchset_v1', 'moneymart.fund.compare.watchsets.v1']
const TABLE = 'user_fund_optimizer_sets'
const MAX_SETS = 30

const safeParse = (raw) => {
  try {
    const parsed = JSON.parse(raw || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** iOS / 웹 혼재: 비중 키 이름·단위(퍼센트 vs 0~1) 정규화 */
function pickFundWeightPct(fund) {
  if (!fund || typeof fund !== 'object') return null
  const tryScalar = (raw) => {
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return null
    if (n > 1 || n === 0) return n
    if (n > 0 && n < 1) return n * 100
    return n
  }

  const pctLikeKeys = [
    'weightPct', 'weight_pct', 'weightPercent', 'allocationPct', 'allocation_pct', 'allocationPercent',
    'pct', 'percent', 'percentage', 'share', 'ratioPct', 'ratio_pct', 'targetPct', 'target_pct',
  ]
  for (const k of pctLikeKeys) {
    if (fund[k] == null || fund[k] === '') continue
    const n = Number(fund[k])
    if (!Number.isFinite(n) || n < 0) continue
    if (n > 1 || n === 0) return n
    if (n > 0 && n < 1) return n * 100
    return n
  }

  if (fund.weight != null && fund.weight !== '') return tryScalar(fund.weight)
  if (fund.allocation != null && fund.allocation !== '') return tryScalar(fund.allocation)

  return null
}

function mergeWeightsFromSummary(normalizedFunds, summary) {
  if (!summary || typeof summary !== 'object') return normalizedFunds
  const z = (f) => (!Number.isFinite(f.weightPct) || f.weightPct <= 0)

  const sw = summary.weights ?? summary.weightings ?? summary.allocations ?? summary.targetWeights
  if (Array.isArray(sw) && sw.length === normalizedFunds.length) {
    const useRow = normalizedFunds.some(z)
    if (!useRow) return normalizedFunds
    return normalizedFunds.map((f, i) => {
      if (!z(f)) return f
      const w = Number(sw[i])
      if (!Number.isFinite(w) || w < 0) return f
      let pct = w
      if (w > 0 && w < 1) pct = w * 100
      return { ...f, weightPct: pct }
    })
  }

  if (sw && typeof sw === 'object' && !Array.isArray(sw)) {
    const useRow = normalizedFunds.some(z)
    if (!useRow) return normalizedFunds
    return normalizedFunds.map((f) => {
      if (!z(f)) return f
      const keys = [
        f.id,
        String(f.id || '').replace(/\.T$/i, ''),
        String(f.id || '').toUpperCase(),
      ].filter(Boolean)
      let hit = null
      for (const k of keys) {
        if (sw[k] != null) {
          hit = sw[k]
          break
        }
        const ku = String(k).toUpperCase()
        const found = Object.keys(sw).find((sk) => String(sk).toUpperCase() === ku)
        if (found != null) {
          hit = sw[found]
          break
        }
      }
      if (hit == null) return f
      const w = Number(hit)
      if (!Number.isFinite(w) || w < 0) return f
      let pct = w
      if (w > 0 && w < 1) pct = w * 100
      return { ...f, weightPct: pct }
    })
  }

  return normalizedFunds
}

function pickFirstFinite(...vals) {
  for (const v of vals) {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

/** summary.ret / risk / fee — 웹 저장 형식 + iOS·중첩 객체 변형 */
function normalizeWatchsetSummary(summary) {
  if (!summary || typeof summary !== 'object') return null

  const perf = summary.performance || summary.metrics || summary.stats || summary.expected || {}

  let ret = pickFirstFinite(
    summary.ret,
    summary.return,
    summary.returnPct,
    summary.expectedReturn,
    summary.totalReturn,
    perf.ret,
    perf.return,
    perf.expectedReturn,
  )
  let risk = pickFirstFinite(
    summary.risk,
    summary.sigma,
    summary.volatility,
    summary.vol,
    summary.stddev,
    perf.risk,
    perf.sigma,
    perf.volatility,
  )
  let fee = pickFirstFinite(
    summary.fee,
    summary.expenseRatio,
    summary.cost,
    summary.ter,
    perf.fee,
    perf.expenseRatio,
  )

  const scaleFractionToPercent = (v) => {
    if (v == null || !Number.isFinite(v) || v === 0) return v
    if (v > -1 && v < 1) return v * 100
    return v
  }

  ret = scaleFractionToPercent(ret)
  risk = scaleFractionToPercent(risk)

  if (!Number.isFinite(ret) && !Number.isFinite(risk) && !Number.isFinite(fee)) return null
  return {
    ret: Number.isFinite(ret) ? ret : null,
    risk: Number.isFinite(risk) ? risk : null,
    fee: Number.isFinite(fee) ? fee : null,
  }
}

const normalizeFunds = (funds = []) => (
  (Array.isArray(funds) ? funds : [])
    .map((fund) => {
      const id = String(fund?.id || fund?.symbol || '').trim().toUpperCase()
      if (!id) return null
      const w = pickFundWeightPct(fund)
      return {
        id,
        name: String(fund?.name || '').trim() || id,
        weightPct: w != null ? w : 0,
      }
    })
    .filter(Boolean)
)

export const normalizeFundOptimizerWatchset = (row = {}, fallbackSource = 'fund_page') => {
  const rawFunds = Array.isArray(row?.funds) ? row.funds : []
  let funds = normalizeFunds(rawFunds)
  funds = mergeWeightsFromSummary(funds, row?.summary)
  if (funds.length < 2) return null
  return {
    id: String(row?.id || `set-${Date.now()}`).trim(),
    name: String(row?.name || '配分セット').trim() || '配分セット',
    createdAt: String(row?.createdAt || row?.created_at || new Date().toISOString()),
    source: String(row?.source || fallbackSource || 'fund_page'),
    funds,
    summary: normalizeWatchsetSummary(row?.summary),
  }
}

// ── localStorage 읽기 (로그인 전 / fallback) ────────────────────────────────
export const loadFundOptimizerWatchsets = () => {
  if (typeof window === 'undefined') return []
  const merged = []
  const seen = new Set()
  const rawBuckets = [
    [PRIMARY_STORAGE_KEY, 'optimizer'],
    ...LEGACY_STORAGE_KEYS.map((key) => [key, key.includes('compare') ? 'compare' : 'fund_page']),
  ]
  rawBuckets.forEach(([key, source]) => {
    const rows = safeParse(window.localStorage.getItem(key))
    rows.forEach((row) => {
      const normalized = normalizeFundOptimizerWatchset(row, source)
      if (!normalized) return
      const sig = `${normalized.name}::${normalized.funds.map((f) => `${f.id}:${f.weightPct.toFixed(1)}`).join('|')}`
      if (seen.has(sig)) return
      seen.add(sig)
      merged.push(normalized)
    })
  })
  return merged
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, MAX_SETS)
}

export const saveFundOptimizerWatchsets = (sets = []) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PRIMARY_STORAGE_KEY, JSON.stringify(sets))
}

/** ログアウト時: 別ユーザやゲストにローカルキャッシュを残さない */
export const clearFundOptimizerWatchsetsLocal = () => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(PRIMARY_STORAGE_KEY)
    LEGACY_STORAGE_KEYS.forEach((k) => window.localStorage.removeItem(k))
  } catch {
    // ignore
  }
}

// ── Supabase 읽기 ─────────────────────────────────────────────────────────────
export const loadFundOptimizerWatchsetsFromDb = async (userId) => {
  if (!userId) return { data: null, available: false }
  const { data, error } = await supabase
    .from(TABLE)
    .select('id,name,source,funds,summary,created_at,updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(MAX_SETS)
  if (error) {
    if (error.code === '42P01') return { data: null, available: false } // table missing
    throw error
  }
  const sets = (data || [])
    .map((row) => normalizeFundOptimizerWatchset({ ...row, createdAt: row.created_at }, row.source))
    .filter(Boolean)
  return { data: sets, available: true }
}

// ── Supabase upsert (1개 세트) ────────────────────────────────────────────────
export const upsertFundOptimizerWatchsetToDb = async (userId, watchset) => {
  if (!userId) return
  const normalized = normalizeFundOptimizerWatchset(watchset)
  if (!normalized) return
  const { error } = await supabase
    .from(TABLE)
    .upsert({
      id: normalized.id,
      user_id: userId,
      name: normalized.name,
      source: normalized.source,
      funds: normalized.funds,
      summary: normalized.summary ?? null,
    }, { onConflict: 'user_id,id' })
  if (error) throw error
}

// ── Supabase 전체 덮어쓰기 ───────────────────────────────────────────────────
export const replaceFundOptimizerWatchsetsInDb = async (userId, sets = []) => {
  if (!userId) return
  // 기존 전체 삭제 후 재삽입
  const { error: delErr } = await supabase
    .from(TABLE)
    .delete()
    .eq('user_id', userId)
  if (delErr) throw delErr

  const rows = sets
    .map((s) => normalizeFundOptimizerWatchset(s))
    .filter(Boolean)
    .slice(0, MAX_SETS)
    .map((s) => ({
      id: s.id,
      user_id: userId,
      name: s.name,
      source: s.source,
      funds: s.funds,
      summary: s.summary ?? null,
    }))

  if (rows.length === 0) return
  const { error } = await supabase.from(TABLE).insert(rows)
  if (error) throw error
}

// ── Supabase 삭제 (1개 세트) ──────────────────────────────────────────────────
export const deleteFundOptimizerWatchsetFromDb = async (userId, setId) => {
  if (!userId || !setId) return
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('user_id', userId)
    .eq('id', setId)
  if (error) throw error
}

// ── localStorage → Supabase 1회 마이그레이션 ─────────────────────────────────
export const migrateFundOptimizerSetsToDb = async (userId) => {
  if (!userId) return
  const localSets = loadFundOptimizerWatchsets()
  if (localSets.length === 0) return
  const { data: existing } = await loadFundOptimizerWatchsetsFromDb(userId)
  if (existing && existing.length > 0) return // 이미 DB에 데이터 있으면 스킵
  await replaceFundOptimizerWatchsetsInDb(userId, localSets)
}

export const buildFundOptimizerCompareUrl = (watchset) => {
  const normalized = normalizeFundOptimizerWatchset(watchset)
  if (!normalized) return '/funds/compare'
  const params = new URLSearchParams({
    ids: normalized.funds.map((f) => f.id).join(','),
    weights: normalized.funds.map((f) => Number(f.weightPct || 0).toFixed(1)).join(','),
  })
  return `/funds/compare?${params.toString()}`
}
