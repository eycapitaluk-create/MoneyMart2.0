export const calculateTotalCost = ({
  broker,
  brokers,
  initialYen,
  monthlyYen,
  years,
  tradesPerMonth,
  fxRatio,
}) => {
  const safeYears = Math.max(1, Number(years || 1))
  const months = safeYears * 12
  const totalInvested = Number(initialYen || 0) + Number(monthlyYen || 0) * months
  const managedBalanceApprox = Number(initialYen || 0) + (Number(monthlyYen || 0) * months * 0.5)
  const calcOne = (b) => {
    const domesticFeeTotal = Number(b.domesticFeePerTrade || 0) * Number(tradesPerMonth || 0) * months
    const fxCostTotal = totalInvested * (Number(b.fxSpreadBps || 0) / 10000) * (Number(fxRatio || 0) / 100)
    const trustFeeTotal = managedBalanceApprox * (Number(b.trustFeeAnnualPct || 0) / 100) * safeYears
    return {
      domesticFeeTotal,
      fxCostTotal,
      trustFeeTotal,
      totalCost: domesticFeeTotal + fxCostTotal + trustFeeTotal,
    }
  }

  const selected = calcOne(broker || {})
  const avgTotal = Array.isArray(brokers) && brokers.length > 0
    ? brokers.reduce((acc, b) => acc + calcOne(b).totalCost, 0) / brokers.length
    : selected.totalCost

  return {
    totalInvested,
    domesticFeeTotal: selected.domesticFeeTotal,
    fxCostTotal: selected.fxCostTotal,
    trustFeeTotal: selected.trustFeeTotal,
    totalCost: selected.totalCost,
    savingsVsAvg: avgTotal - selected.totalCost,
  }
}
