/**
 * Full stock-watchlist replace is delete-then-insert. Empty snapshots are refused by default
 * so a pre-hydration UI race cannot wipe the cloud list.
 */
export const prepareStockWatchlistReplace = ({ symbols = [], allowEmptyReplace = false } = {}) => {
  const unique = [...new Set((symbols || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean))]
  if (unique.length === 0 && !allowEmptyReplace) {
    return { skip: true, reason: 'empty_replace_blocked', symbols: [] }
  }
  return { skip: false, reason: null, symbols: unique }
}
