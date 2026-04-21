const toNum = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const roundYen = (value) => Math.round(toNum(value, 0))

const mean = (arr = []) => {
  if (!Array.isArray(arr) || arr.length === 0) return 0
  return arr.reduce((acc, v) => acc + toNum(v, 0), 0) / arr.length
}

const stdDev = (arr = []) => {
  if (!Array.isArray(arr) || arr.length === 0) return 0
  const avg = mean(arr)
  const variance = arr.reduce((acc, v) => acc + ((toNum(v, 0) - avg) ** 2), 0) / arr.length
  return Math.sqrt(Math.max(0, variance))
}

export function evaluateCashFlowOptimizer({
  monthlyExpensesYen = [],
  cashFlowProfile = {},
}) {
  const monthly = (Array.isArray(monthlyExpensesYen) ? monthlyExpensesYen : [])
    .map((v) => Math.max(0, toNum(v, 0)))
    .slice(0, 3)
  while (monthly.length < 3) monthly.push(0)

  const avgExpenseYen = mean(monthly)
  const volBufferYen = stdDev(monthly)
  const reserveMonthMultiplier = Math.min(6, Math.max(0.5, toNum(cashFlowProfile?.reserve_month_multiplier, 1.5)))

  const reserveTargetYen = roundYen(avgExpenseYen * reserveMonthMultiplier + volBufferYen)
  const cashBalanceYen = Math.max(0, toNum(cashFlowProfile?.cash_balance_yen, 0))
  const idleCashYen = Math.max(0, cashBalanceYen - reserveTargetYen)
  const shortageYen = Math.max(0, reserveTargetYen - cashBalanceYen)

  const currentRate = Math.max(0, Math.min(1, toNum(cashFlowProfile?.current_cash_rate, 0.001)))
  const highYieldRate = Math.max(0, Math.min(1, toNum(cashFlowProfile?.high_yield_cash_rate, 0.003)))
  const rateGap = Math.max(0, highYieldRate - currentRate)
  const additionalInterestYen = roundYen(idleCashYen * rateGap)

  let status = 'optimized'
  if (shortageYen > 0) status = 'buffer_shortage'
  else if (idleCashYen >= 100000 && rateGap > 0) status = 'opportunity'

  const tasks = []
  if (status === 'buffer_shortage') {
    tasks.push(`予備資金が不足しています。まずは ¥${shortageYen.toLocaleString()} を確保しましょう。`)
  } else if (idleCashYen > 0) {
    tasks.push(`余剰現金 ¥${idleCashYen.toLocaleString()} の移動余地があります。`)
  } else {
    tasks.push('現金配分は概ね最適化されています。')
  }
  if (rateGap > 0) {
    tasks.push(`高金利口座との差分は年 ${(rateGap * 100).toFixed(2)}% です。`)
  }
  tasks.push('自動振替を設定して毎月の余剰資金を運用待機口座へ移しましょう。')

  const insight = `過去3ヶ月で平均 ¥${idleCashYen.toLocaleString()} の余剰現金がありました。連携済み高金利普通預金へ移していれば、年+${(rateGap * 100).toFixed(1)}%で約¥${additionalInterestYen.toLocaleString()}の追加利息が見込めました。`

  return {
    reserveTargetYen,
    idleCashYen,
    additionalInterestYen,
    shortageYen,
    avgExpenseYen: roundYen(avgExpenseYen),
    volBufferYen: roundYen(volBufferYen),
    currentRate,
    highYieldRate,
    rateGap,
    status,
    insight,
    tasks,
    badges: {
      opportunity: status === 'opportunity',
      shortage: status === 'buffer_shortage',
      optimized: status === 'optimized',
    },
  }
}
