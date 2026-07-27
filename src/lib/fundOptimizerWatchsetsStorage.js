/**
 * Pure helpers for fund-optimizer watchset localStorage scoping / migration.
 * Kept free of Vite/supabase imports so Node regression tests can load them.
 */

export const PRIMARY_STORAGE_KEY = 'mm_fund_optimizer_watchsets_v2'
export const LEGACY_STORAGE_KEYS = ['mm_fund_watchset_v1', 'moneymart.fund.compare.watchsets.v1']

export const scopedFundOptimizerStorageKey = (userId) => {
  const id = String(userId || '').trim()
  return id ? `${PRIMARY_STORAGE_KEY}:${id}` : PRIMARY_STORAGE_KEY
}

/**
 * Decide whether local sets may be pushed into an empty cloud account.
 *
 * Only user-scoped local rows are eligible. Migrating the shared/unscoped
 * `mm_fund_optimizer_watchsets_v2` key would copy the previous browser user's
 * allocations into the next empty account.
 */
export const planFundOptimizerDbMigration = ({
  userId,
  userScopedSets = [],
  existingDbSets = [],
} = {}) => {
  if (!String(userId || '').trim()) {
    return { action: 'skip', reason: 'no_user', sets: [] }
  }
  if (Array.isArray(existingDbSets) && existingDbSets.length > 0) {
    return { action: 'skip', reason: 'db_already_has_sets', sets: [] }
  }
  const sets = (Array.isArray(userScopedSets) ? userScopedSets : []).filter(Boolean)
  if (sets.length === 0) {
    return { action: 'skip', reason: 'no_user_scoped_sets', sets: [] }
  }
  return { action: 'migrate', reason: 'user_scoped', sets }
}

/**
 * Authenticated saves must write a user-scoped key and clear the shared primary
 * key so a later empty-account login cannot adopt another user's leftovers.
 */
export const planFundOptimizerLocalSave = ({ userId, sets = [] } = {}) => {
  const id = String(userId || '').trim()
  const normalizedSets = Array.isArray(sets) ? sets : []
  if (id) {
    return {
      writeKey: scopedFundOptimizerStorageKey(id),
      sets: normalizedSets,
      clearUnscopedPrimary: true,
    }
  }
  return {
    writeKey: PRIMARY_STORAGE_KEY,
    sets: normalizedSets,
    clearUnscopedPrimary: false,
  }
}
