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
