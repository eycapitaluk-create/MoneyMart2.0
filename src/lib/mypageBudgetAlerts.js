/**
 * 端末ローカル暦の「今月」(YYYY-MM) の支出合計と月次予算を照合。表示・通知判定のみに使う（副作用なし）。
 * spent_on の日付が当月に属する行のみ合算。
 */
export function getCurrentMonthBudgetUsage(expenses = [], budgetTargetYen = 0) {
  const target = Math.max(0, Number(budgetTargetYen || 0))
  const now = new Date()
  const y = now.getFullYear()
  const mo = now.getMonth() + 1
  const prefix = `${y}-${String(mo).padStart(2, '0')}`

  const spent = (Array.isArray(expenses) ? expenses : []).reduce((sum, row) => {
    const raw = String(row?.spent_on || row?.created_at || '').trim()
    const d = raw.slice(0, 10)
    if (!d || d.length < 7 || !d.startsWith(prefix)) return sum
    return sum + Math.max(0, Number(row?.amount || 0))
  }, 0)

  const pct = target > 0 ? Math.min(100, (spent / target) * 100) : null
  const over80 = target > 0 && pct >= 80

  return {
    spent,
    target,
    pct,
    over80,
    hasTarget: target > 0,
  }
}

/** 暦の今日まで vs 前月の同じ日まで。月末が短い月は前月最終日で打ち切る。 */
export function samePeriodExpenseBounds(now = new Date()) {
  const y = now.getFullYear()
  const mo = now.getMonth()
  const day = now.getDate()
  const curStart = new Date(y, mo, 1)
  const todayEnd = new Date(y, mo, day, 23, 59, 59, 999)
  const prevStart = new Date(y, mo - 1, 1)
  const lastDayPrev = new Date(y, mo, 0).getDate()
  const prevEnd = new Date(y, mo - 1, Math.min(day, lastDayPrev), 23, 59, 59, 999)
  return { curStart, todayEnd, prevStart, prevEnd }
}

export function spentOnInBounds(spentOn, start, end) {
  const dt = new Date(spentOn || '')
  if (Number.isNaN(dt.getTime())) return false
  return dt >= start && dt <= end
}

const SCHEDULED_EXPENSE_TYPES = new Set(['weekly', 'monthly'])

export function isScheduledExpenseRow(row) {
  return Boolean(row?.recurring_parent_id) || SCHEDULED_EXPENSE_TYPES.has(row?.recurring_type)
}

function expenseDateAndAmount(row) {
  const spent = String(row?.spent_on || row?.date || '').slice(0, 10)
  const amount = Number(row?.amount)
  return { spent, amount: Number.isFinite(amount) ? Math.max(0, amount) : 0 }
}

/** 定期・未来日付は1回だけ。今日までの一般支出だけ日割りで月末まで伸ばす。 */
export function projectMonthEndSpending(rows, now = new Date()) {
  const day = Math.max(1, now.getDate())
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  let variableToDate = 0
  let once = 0
  for (const row of Array.isArray(rows) ? rows : []) {
    const { spent, amount } = expenseDateAndAmount(row)
    if (!spent.startsWith(monthKey)) continue
    const spentDay = Number(spent.slice(8, 10))
    if (!isScheduledExpenseRow(row) && spentDay <= day) variableToDate += amount
    else once += amount
  }
  return Math.round((variableToDate / day) * days) + once
}

export function monthExpenseTotal(rows, monthKey) {
  if (!monthKey) return 0
  return (Array.isArray(rows) ? rows : []).reduce((sum, row) => {
    const { spent, amount } = expenseDateAndAmount(row)
    return spent.startsWith(monthKey) ? sum + amount : sum
  }, 0)
}

export function displayedMonthEndSpending(rows, viewedMonthKey, now = new Date()) {
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  if (!viewedMonthKey || viewedMonthKey === currentKey) return projectMonthEndSpending(rows, now)
  return monthExpenseTotal(rows, viewedMonthKey)
}
