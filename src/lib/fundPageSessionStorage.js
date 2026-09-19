/** FundPage 一覧のフィルタ・ページ・比較選択など（sessionStorage）。並び替えは保持しない。ログアウト時にクリア。 */
export const FUND_PAGE_UI_STATE_KEY = 'moneymart.fund.page.ui.v1'
export const FUND_PAGE_CACHE_KEY = 'moneymart.fund.page.cache.v13'

export function clearFundListPageSessionStorage() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(FUND_PAGE_UI_STATE_KEY)
    window.sessionStorage.removeItem(FUND_PAGE_CACHE_KEY)
  } catch {
    // ignore
  }
}
