/**
 * Cross-tab watchlist hints (localStorage `storage` fires only in *other* tabs).
 * Logged-in stock watch: DB is truth; bump rev after writes so MyPage / other surfaces refetch.
 */
export const LS_STOCK_WATCHLIST_SYNC_KEY = 'mm_stock_watchlist_rev'

/** Guest + legacy keys still use prefixed keys — listen for those too. */
export const LS_STOCK_WATCHLIST_LEGACY_PREFIX = 'mm_stock_watchlist_v1'

export function bumpStockWatchlistSyncVersion() {
  try {
    window.localStorage.setItem(LS_STOCK_WATCHLIST_SYNC_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
}

export function shouldReloadStockWatchlistFromStorageKey(key) {
  if (!key) return false
  if (key === LS_STOCK_WATCHLIST_SYNC_KEY) return true
  if (String(key).startsWith(LS_STOCK_WATCHLIST_LEGACY_PREFIX)) return true
  return false
}
