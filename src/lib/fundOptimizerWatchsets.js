/**
 * 펀드 옵티마이저 세트 — Supabase 우선, localStorage fallback
 *
 * 테이블: user_fund_optimizer_sets
 *   primary key: (user_id, id)
 *   columns: id, user_id, name, source, funds(jsonb), summary(jsonb), created_at, updated_at
 *
 * localStorage is user-scoped when a userId is provided. The shared
 * `mm_fund_optimizer_watchsets_v2` key is only for logged-out/guest use and is
 * cleared on authenticated saves and logout so it cannot seed another account.
 */
import { supabase } from './supabase'
import {
  LEGACY_STORAGE_KEYS,
  PRIMARY_STORAGE_KEY,
  planFundOptimizerDbMigration,
  planFundOptimizerLocalSave,
  scopedFundOptimizerStorageKey,
} from './fundOptimizerWatchsetsStorage'

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

const readStorageRows = (key, source) => {
  if (typeof window === 'undefined') return []
  return safeParse(window.localStorage.getItem(key))
    .map((row) => normalizeFundOptimizerWatchset(row, source))
    .filter(Boolean)
}

const mergeNormalizedSets = (buckets = []) => {
  const merged = []
  const seen = new Set()
  buckets.flat().forEach((normalized) => {
    if (!normalized) return
    const sig = `${normalized.name}::${normalized.funds.map((f) => `${f.id}:${f.weightPct.toFixed(1)}`).join('|')}`
    if (seen.has(sig)) return
    seen.add(sig)
    merged.push(normalized)
  })
  return merged
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, MAX_SETS)
}

export const clearUnscopedFundOptimizerWatchsets = () => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(PRIMARY_STORAGE_KEY)
}

const writeStorageSets = (key, sets = []) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(sets))
}

const loadUserScopedFundOptimizerWatchsets = (userId) => {
  const id = String(userId || '').trim()
  if (!id) return []
  return mergeNormalizedSets([
    readStorageRows(scopedFundOptimizerStorageKey(id), 'optimizer'),
  ])
}

const loadUnscopedFundOptimizerWatchsets = () => mergeNormalizedSets([
  readStorageRows(PRIMARY_STORAGE_KEY, 'optimizer'),
  ...LEGACY_STORAGE_KEYS.map((key) => (
    readStorageRows(key, key.includes('compare') ? 'compare' : 'fund_page')
  )),
])

// ── localStorage 읽기 (로그인 전 / fallback) ────────────────────────────────
export const loadFundOptimizerWatchsets = (userId) => {
  if (typeof window === 'undefined') return []
  const id = String(userId || '').trim()
  if (id) {
    // Authenticated reads never fall back to the shared key — that is how a
    // previous user's leftovers used to seed the next empty cloud account.
    return loadUserScopedFundOptimizerWatchsets(id)
  }
  return loadUnscopedFundOptimizerWatchsets()
}

export const saveFundOptimizerWatchsets = (sets = [], userId) => {
  if (typeof window === 'undefined') return
  const plan = planFundOptimizerLocalSave({ userId, sets })
  writeStorageSets(plan.writeKey, plan.sets)
  if (plan.clearUnscopedPrimary) clearUnscopedFundOptimizerWatchsets()
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
  const userScopedSets = loadUserScopedFundOptimizerWatchsets(userId)
  const { data: existing } = await loadFundOptimizerWatchsetsFromDb(userId)
  const plan = planFundOptimizerDbMigration({
    userId,
    userScopedSets,
    existingDbSets: existing || [],
  })
  if (plan.action !== 'migrate') {
    // Even when skipping migrate, drop shared leftovers so they cannot be
    // read by a later guest session after this authenticated user touched sync.
    if (plan.reason === 'db_already_has_sets') clearUnscopedFundOptimizerWatchsets()
    return
  }
  await replaceFundOptimizerWatchsetsInDb(userId, plan.sets)
  saveFundOptimizerWatchsets(plan.sets, userId)
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

export {
  PRIMARY_STORAGE_KEY,
  scopedFundOptimizerStorageKey,
  planFundOptimizerDbMigration,
  planFundOptimizerLocalSave,
} from './fundOptimizerWatchsetsStorage'
