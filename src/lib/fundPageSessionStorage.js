/**
 * Fund list page sessionStorage keys — cleared on logout so the next account
 * does not inherit another user's filter/cache snapshot.
 */
export const FUND_PAGE_SESSION_KEYS = [
  'moneymart.fund.page.cache.v12',
  'moneymart.fund.page.ui.v1',
  'moneymart.fund.universe.snapshot.v1',
]

export function clearFundListPageSessionStorage() {
  if (typeof window === 'undefined') return
  for (const key of FUND_PAGE_SESSION_KEYS) {
    try {
      window.sessionStorage.removeItem(key)
    } catch {
      // ignore
    }
  }
}
