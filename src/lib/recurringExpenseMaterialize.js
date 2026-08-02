/**
 * Pure helpers for recurring expense materialization.
 * Kept free of Vite/supabase imports so node:test can cover the planner.
 */

export const RECURRING_TYPES = ['weekly', 'monthly']
export const RECURRING_MATERIALIZE_AHEAD_MONTHS = 1
/** Default PostgREST page size used when loading existing spent_on dates. */
export const RECURRING_EXISTING_DATES_PAGE_SIZE = 1000

export const toIsoDate = (value) => {
  const base = String(value || '').slice(0, 10)
  if (!base) return ''
  const date = new Date(`${base}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

export const addDaysIso = (isoDate, days) => {
  const base = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(base.getTime())) return ''
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

const daysInMonthUtc = (year, monthIndex0) => {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate()
}

export const addMonthsAnchoredIso = (isoDate, months, anchorDay = 1) => {
  const base = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(base.getTime())) return ''
  const y = base.getUTCFullYear()
  const m = base.getUTCMonth()
  const next = new Date(Date.UTC(y, m + months, 1))
  const dim = daysInMonthUtc(next.getUTCFullYear(), next.getUTCMonth())
  next.setUTCDate(Math.max(1, Math.min(Number(anchorDay || 1), dim)))
  return next.toISOString().slice(0, 10)
}

export const endOfMonthAfterMonthsIso = (monthsAhead = 0, now = new Date()) => {
  const end = new Date(now.getFullYear(), now.getMonth() + Number(monthsAhead || 0) + 1, 0)
  return end.toISOString().slice(0, 10)
}

/**
 * Collect spent_on ISO dates from DB rows (template + children).
 */
export const collectExistingSpentOnDates = (rows) => {
  const dates = new Set()
  for (const row of rows || []) {
    const day = String(row?.spent_on || '').slice(0, 10)
    if (day) dates.add(day)
  }
  return dates
}

/**
 * Plan child expense rows that are missing between start and end.
 * Advances one period past the template start (template row itself is the first occurrence).
 */
export const planRecurringChildRows = ({
  type,
  startIso,
  endIso,
  template,
  existingDates,
  maxSteps = 1000,
}) => {
  if (!RECURRING_TYPES.includes(type)) return []
  if (!startIso || !endIso || startIso > endIso) return []

  const known = existingDates instanceof Set
    ? new Set(existingDates)
    : collectExistingSpentOnDates(existingDates)

  const pendingRows = []
  let cursor = startIso
  const anchorDay = Number(template?.recurring_anchor_day || startIso.slice(8, 10) || 1)
  let guard = 0

  while (guard < maxSteps) {
    guard += 1
    cursor = type === 'weekly' ? addDaysIso(cursor, 7) : addMonthsAnchoredIso(cursor, 1, anchorDay)
    if (!cursor || cursor > endIso) break
    if (known.has(cursor)) continue
    pendingRows.push({
      user_id: template.user_id,
      spent_on: cursor,
      category: template.category || 'その他',
      merchant: template.merchant || '',
      amount: Math.max(0, Number(template.amount || 0)),
      payment_method: template.payment_method || '',
      notes: template.notes || '',
      recurring_type: null,
      recurring_anchor_day: null,
      recurring_start_on: null,
      recurring_end_on: null,
      recurring_parent_id: template.id,
    })
    known.add(cursor)
  }

  return pendingRows
}

/**
 * Exhaustively page spent_on rows so materialize never misses dates past a silent cap.
 *
 * @param {(from: number, to: number) => PromiseLike<{ data?: any[]|null, error?: any }>} fetchPage
 * @param {{ pageSize?: number, maxPages?: number }} [options]
 */
export async function fetchAllSpentOnDatesPaged(fetchPage, options = {}) {
  const pageSize = Math.max(1, Math.floor(Number(options.pageSize) || RECURRING_EXISTING_DATES_PAGE_SIZE))
  const maxPages = Math.max(1, Math.floor(Number(options.maxPages) || 1000))
  const merged = []

  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize
    const to = from + pageSize - 1
    const result = await fetchPage(from, to)
    if (result?.error) {
      return { data: null, error: result.error, dates: null }
    }
    const rows = Array.isArray(result?.data) ? result.data : []
    merged.push(...rows)
    if (rows.length < pageSize) {
      return { data: merged, error: null, dates: collectExistingSpentOnDates(merged) }
    }
  }

  return { data: merged, error: null, dates: collectExistingSpentOnDates(merged) }
}
