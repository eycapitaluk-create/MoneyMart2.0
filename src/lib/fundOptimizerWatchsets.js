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

const normalizeFunds = (funds = []) => (
  (Array.isArray(funds) ? funds : [])
    .map((fund) => {
      const id = String(fund?.id || fund?.symbol || '').trim().toUpperCase()
      if (!id) return null
      return {
        id,
        name: String(fund?.name || '').trim() || id,
        weightPct: Number.isFinite(Number(fund?.weightPct)) ? Number(fund.weightPct) : 0,
      }
    })
    .filter(Boolean)
)

export const normalizeFundOptimizerWatchset = (row = {}, fallbackSource = 'fund_page') => {
  const funds = normalizeFunds(row?.funds)
  if (funds.length < 2) return null
  return {
    id: String(row?.id || `set-${Date.now()}`).trim(),
    name: String(row?.name || '配分セット').trim() || '配分セット',
    createdAt: String(row?.createdAt || row?.created_at || new Date().toISOString()),
    source: String(row?.source || fallbackSource || 'fund_page'),
    funds,
    summary: row?.summary && typeof row.summary === 'object'
      ? {
        ret: Number.isFinite(Number(row.summary?.ret)) ? Number(row.summary.ret) : null,
        risk: Number.isFinite(Number(row.summary?.risk)) ? Number(row.summary.risk) : null,
        fee: Number.isFinite(Number(row.summary?.fee)) ? Number(row.summary.fee) : null,
      }
      : null,
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
