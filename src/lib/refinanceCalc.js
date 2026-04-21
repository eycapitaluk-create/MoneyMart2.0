const toNumber = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const toNonNegative = (value, fallback = 0) => Math.max(0, toNumber(value, fallback))

const roundYen = (value) => Math.round(toNumber(value, 0))

export const normalizeOfferApr = (offer = {}) => {
  const min = toNonNegative(offer.apr_min, 0)
  const max = toNonNegative(offer.apr_max, min)
  if (max < min) return min
  return (min + max) / 2
}

export const simulateCostTimeline = ({
  principalYen = 0,
  aprPct = 0,
  monthlyPaymentYen = 0,
  upfrontFeeYen = 0,
  horizonMonths = 24,
}) => {
  const months = Math.max(1, Math.floor(toNumber(horizonMonths, 24)))
  const monthlyRate = toNonNegative(aprPct, 0) / 100 / 12
  const scheduledPayment = toNonNegative(monthlyPaymentYen, 0)
  const upfrontFee = toNonNegative(upfrontFeeYen, 0)
  let remain = toNonNegative(principalYen, 0)
  let cumulativePaid = upfrontFee
  const timeline = []

  for (let month = 1; month <= months; month += 1) {
    const interest = remain > 0 ? remain * monthlyRate : 0
    const payment = remain <= 0 ? 0 : Math.min(scheduledPayment, remain + interest)
    remain = Math.max(0, remain + interest - payment)
    cumulativePaid += payment
    const economicCost = cumulativePaid + remain
    timeline.push({
      month,
      interestYen: roundYen(interest),
      paymentYen: roundYen(payment),
      remainingYen: roundYen(remain),
      cumulativePaidYen: roundYen(cumulativePaid),
      economicCostYen: roundYen(economicCost),
    })
  }

  const last = timeline[timeline.length - 1] || {
    month: months,
    remainingYen: roundYen(remain),
    cumulativePaidYen: roundYen(cumulativePaid),
    economicCostYen: roundYen(cumulativePaid + remain),
  }

  return {
    timeline,
    totalEconomicCostYen: last.economicCostYen,
    totalPaidYen: last.cumulativePaidYen,
    remainingYen: last.remainingYen,
  }
}

export const buildOfferComparison = ({
  principalYen = 0,
  currentAprPct = 0,
  monthlyPaymentYen = 0,
  refinanceFeeYen = 0,
  offer = null,
}) => {
  if (!offer) return null
  const minAmount = toNonNegative(offer.min_amount_yen, 0)
  const maxAmount = toNonNegative(offer.max_amount_yen, Number.MAX_SAFE_INTEGER)
  const principal = toNonNegative(principalYen, 0)
  if (principal < minAmount || principal > maxAmount) return null

  const current = simulateCostTimeline({
    principalYen: principal,
    aprPct: currentAprPct,
    monthlyPaymentYen,
    upfrontFeeYen: 0,
    horizonMonths: 24,
  })
  const totalFee = toNonNegative(refinanceFeeYen, 0) + toNonNegative(offer.fees_yen, 0)
  const refinanceApr = normalizeOfferApr(offer)
  const refinance = simulateCostTimeline({
    principalYen: principal,
    aprPct: refinanceApr,
    monthlyPaymentYen,
    upfrontFeeYen: totalFee,
    horizonMonths: 24,
  })
  const savingsYen = roundYen(current.totalEconomicCostYen - refinance.totalEconomicCostYen)
  let breakEvenMonth = null
  for (let i = 0; i < Math.min(current.timeline.length, refinance.timeline.length); i += 1) {
    const currentCost = toNumber(current.timeline[i]?.economicCostYen, 0)
    const refinanceCost = toNumber(refinance.timeline[i]?.economicCostYen, 0)
    if (currentCost - refinanceCost >= 0) {
      breakEvenMonth = i + 1
      break
    }
  }

  const series = current.timeline.map((row, idx) => ({
    month: row.month,
    currentCostYen: row.economicCostYen,
    refinanceCostYen: refinance.timeline[idx]?.economicCostYen ?? row.economicCostYen,
  }))

  return {
    offerId: offer.id,
    bankName: offer.bank_name || '',
    productName: offer.product_name || '',
    applyUrl: offer.apply_url || '',
    aprMin: toNonNegative(offer.apr_min, 0),
    aprMax: toNonNegative(offer.apr_max, 0),
    representativeApr: refinanceApr,
    offerFeeYen: toNonNegative(offer.fees_yen, 0),
    totalFeeYen: totalFee,
    currentTotalCost24mYen: current.totalEconomicCostYen,
    refinanceTotalCost24mYen: refinance.totalEconomicCostYen,
    savings24mYen: savingsYen,
    breakEvenMonth,
    series,
  }
}

export const rankRefinanceOffers = ({
  principalYen = 0,
  currentAprPct = 0,
  monthlyPaymentYen = 0,
  refinanceFeeYen = 0,
  offers = [],
  topN = 3,
}) => {
  const compared = (Array.isArray(offers) ? offers : [])
    .filter((offer) => Boolean(offer?.is_active))
    .map((offer) => buildOfferComparison({
      principalYen,
      currentAprPct,
      monthlyPaymentYen,
      refinanceFeeYen,
      offer,
    }))
    .filter(Boolean)
    .sort((a, b) => {
      if (b.savings24mYen !== a.savings24mYen) return b.savings24mYen - a.savings24mYen
      return a.representativeApr - b.representativeApr
    })

  return compared.slice(0, Math.max(1, Math.floor(toNumber(topN, 3))))
}
