/**
 * Pure helpers for MyPage expense ledger loading.
 * Keeps recurring templates visible even when child volume exceeds the ledger window.
 */

export const EXPENSE_LEDGER_LIMIT = 300
export const RECURRING_TEMPLATE_FETCH_LIMIT = 300

/**
 * Merge the newest ledger window with recurring template (parent) rows.
 * Templates with old spent_on dates otherwise fall out of `.limit(300)` and become
 * uneditable in the UI, so the series cannot be ended or updated.
 */
export function mergeExpenseLedgerRows(latestRows = [], templateRows = []) {
  const byId = new Map()
  for (const row of Array.isArray(latestRows) ? latestRows : []) {
    const id = String(row?.id || '').trim()
    if (!id) continue
    byId.set(id, row)
  }
  for (const row of Array.isArray(templateRows) ? templateRows : []) {
    const id = String(row?.id || '').trim()
    if (!id) continue
    if (!byId.has(id)) byId.set(id, row)
  }
  return [...byId.values()].sort((a, b) => {
    const da = String(a?.spent_on || '')
    const db = String(b?.spent_on || '')
    if (da !== db) return da < db ? 1 : -1
    const ca = String(a?.created_at || '')
    const cb = String(b?.created_at || '')
    if (ca === cb) return 0
    return ca < cb ? 1 : -1
  })
}
