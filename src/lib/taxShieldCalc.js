const toNum = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const toNonNegative = (value, fallback = 0) => Math.max(0, toNum(value, fallback))

const roundYen = (value) => Math.round(toNum(value, 0))

const toDateSafe = (year, month, day) => {
  const y = Math.max(2024, Math.floor(toNum(year, new Date().getFullYear())))
  const m = Math.min(12, Math.max(1, Math.floor(toNum(month, 12))))
  const d = Math.min(31, Math.max(1, Math.floor(toNum(day, 31))))
  return new Date(Date.UTC(y, m - 1, d))
}

export const normalizeTaxShieldRules = (rules = [], taxYear = new Date().getFullYear()) => {
  const year = Math.floor(toNum(taxYear, new Date().getFullYear()))
  const rows = Array.isArray(rules) ? rules : []
  const byType = {
    ideco: null,
    nisa: null,
    insurance: null,
  }
  rows.forEach((row) => {
    const type = String(row?.deduction_type || '').toLowerCase()
    if (!(type in byType)) return
    if (Number(row?.tax_year) !== year) return
    if (!row?.is_active) return
    byType[type] = row
  })
  return byType
}

function evaluateTaxShieldCore({
  taxYear = new Date().getFullYear(),
  annualIncomeYen = 0,
  idecoPaidYen = 0,
  nisaPaidYen = 0,
  insurancePaidYen = 0,
  deductionReflected = false,
  rules = [],
}) {
  const year = Math.floor(toNum(taxYear, new Date().getFullYear()))
  const income = toNonNegative(annualIncomeYen, 0)
  const paid = {
    ideco: toNonNegative(idecoPaidYen, 0),
    nisa: toNonNegative(nisaPaidYen, 0),
    insurance: toNonNegative(insurancePaidYen, 0),
  }
  const ruleMap = normalizeTaxShieldRules(rules, year)
  const typeOrder = ['ideco', 'nisa', 'insurance']

  const lineItems = typeOrder.map((type) => {
    const rule = ruleMap[type]
    const capYen = toNonNegative(rule?.cap_yen, 0)
    const rate = Math.max(0, Math.min(1, toNum(rule?.deduction_rate, 0)))
    const usedYen = paid[type]
    const eligibleYen = Math.min(usedYen, capYen)
    const remainingCapYen = Math.max(0, capYen - usedYen)
    const deductibleYen = roundYen(eligibleYen * rate)
    const potentialExtraDeductibleYen = roundYen(remainingCapYen * rate)
    return {
      type,
      capYen,
      rate,
      usedYen,
      eligibleYen,
      remainingCapYen,
      deductibleYen,
      potentialExtraDeductibleYen,
      deadlineMonth: Math.floor(toNum(rule?.deadline_month, 12)),
      deadlineDay: Math.floor(toNum(rule?.deadline_day, 31)),
      note: String(rule?.note || ''),
      hasRule: Boolean(rule),
    }
  })

  const estimatedDeductionYen = roundYen(lineItems.reduce((acc, row) => acc + row.deductibleYen, 0))
  const potentialExtraDeductionYen = roundYen(lineItems.reduce((acc, row) => acc + row.potentialExtraDeductibleYen, 0))

  const inferredTaxRate = income >= 10000000 ? 0.30 : income >= 6000000 ? 0.20 : income >= 3300000 ? 0.10 : 0.05
  const potentialTaxSavingYen = roundYen(potentialExtraDeductionYen * inferredTaxRate)

  const now = new Date()
  const allDeadlines = lineItems
    .filter((row) => row.hasRule)
    .map((row) => toDateSafe(year, row.deadlineMonth, row.deadlineDay))
  const nearestDeadline = allDeadlines.length > 0
    ? allDeadlines.sort((a, b) => a.getTime() - b.getTime())[0]
    : toDateSafe(year, 12, 31)
  const daysLeft = Math.max(0, Math.ceil((nearestDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

  const anyExceeded = lineItems.some((row) => row.usedYen > row.capYen && row.capYen > 0)
  const totalRemainingCapYen = lineItems.reduce((acc, row) => acc + row.remainingCapYen, 0)

  let status = 'opportunity'
  if (anyExceeded) {
    status = 'limit_exceeded'
  } else if (daysLeft <= 30 && totalRemainingCapYen > 0) {
    status = 'deadline_soon'
  } else if (totalRemainingCapYen <= 0 || deductionReflected) {
    status = 'optimized'
  }

  const todo = []
  if (status === 'limit_exceeded') {
    todo.push('一部項目が上限を超えています。控除対象金額を確認してください。')
  }
  if (totalRemainingCapYen > 0) {
    todo.push(`今年の控除余地は合計 ¥${roundYen(totalRemainingCapYen).toLocaleString()} です。`)
  } else {
    todo.push('今年の控除枠はほぼ使い切っています。')
  }
  if (!deductionReflected) {
    todo.push('年末調整/確定申告への反映ステータスを確認してください。')
  }
  if (daysLeft <= 30) {
    todo.push(`締切まで ${daysLeft} 日です。優先して手続きを進めてください。`)
  }

  return {
    taxYear: year,
    estimatedDeductionYen,
    potentialExtraDeductionYen,
    potentialTaxSavingYen,
    inferredTaxRate,
    daysLeft,
    status,
    totalRemainingCapYen: roundYen(totalRemainingCapYen),
    deductionReflected: Boolean(deductionReflected),
    lineItems,
    todo,
  }
}

export function evaluateTaxShield({ taxRules = [], taxProfile = {} }) {
  const year = Math.floor(toNum(taxProfile?.tax_year, new Date().getFullYear()))
  const annualIncomeYen =
    typeof taxProfile?.annual_income_yen === 'number' && taxProfile.annual_income_yen >= 0
      ? taxProfile.annual_income_yen
      : toNonNegative(taxProfile?.annual_income_manwon, 0) * 10000
  const core = evaluateTaxShieldCore({
    taxYear: year,
    annualIncomeYen,
    idecoPaidYen: toNonNegative(taxProfile?.ideco_paid_yen, 0),
    nisaPaidYen: toNonNegative(taxProfile?.nisa_paid_yen, 0),
    insurancePaidYen: toNonNegative(taxProfile?.insurance_paid_yen, 0),
    deductionReflected: Boolean(taxProfile?.deduction_reflected),
    rules: taxRules,
  })
  return {
    ...core,
    expectedDeductionYen: core.estimatedDeductionYen,
    expectedTaxSavingYen: roundYen(core.estimatedDeductionYen * core.inferredTaxRate),
    potentialSavingYen: core.potentialTaxSavingYen,
    tasks: core.todo,
    badges: {
      opportunity: core.potentialTaxSavingYen > 0 || core.totalRemainingCapYen > 0,
      deadline: core.daysLeft <= 30 && core.daysLeft >= 0,
      overLimit: core.status === 'limit_exceeded',
    },
  }
}
