/** Free-plan fund watchlist display/save cap used by App sync + toggles. */
export const FREE_FUND_WATCHLIST_LIMIT = 3

/**
 * Apply the free-plan fund watchlist cap.
 * Pass an explicit `isPaid` boolean so async/idle sync closures never close over a
 * stale entitlement flag from before profile resolution.
 *
 * @param {unknown} items
 * @param {boolean} isPaid
 * @param {number} [limit]
 * @returns {unknown[]}
 */
export function applyFundWatchlistPlanLimit(items, isPaid, limit = FREE_FUND_WATCHLIST_LIMIT) {
  const list = Array.isArray(items) ? items : []
  const safeLimit = Math.max(0, Math.floor(Number(limit) || FREE_FUND_WATCHLIST_LIMIT))
  return isPaid ? list : list.slice(0, safeLimit)
}

/**
 * DB fund-watchlist sync must wait until display-profile entitlement is resolved.
 * Otherwise paid users are temporarily treated as free and capped to 3 items for
 * the rest of the session (effect deps historically ignored entitlement).
 */
export function shouldSyncFundWatchlistFromDb({ userId, displayProfileResolved } = {}) {
  return Boolean(userId) && displayProfileResolved === true
}
