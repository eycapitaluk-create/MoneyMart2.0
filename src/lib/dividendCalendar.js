const uniqueSortedMonths = (dividends = []) => (
  [...new Set(
    (Array.isArray(dividends) ? dividends : [])
      .map((row) => Number(row?.month))
      .filter((month) => Number.isInteger(month) && month >= 1 && month <= 12)
  )].sort((a, b) => a - b)
)

export const getFirstDividendMonth = (dividends = []) => uniqueSortedMonths(dividends)[0] || null

export const getAnnualDividendPerShare = (dividends = []) => (
  (Array.isArray(dividends) ? dividends : [])
    .reduce((sum, row) => sum + Math.max(0, Number(row?.amount || 0)), 0)
)

export const getDividendYieldPct = (price = 0, dividends = []) => {
  const safePrice = Number(price || 0)
  if (!Number.isFinite(safePrice) || safePrice <= 0) return null
  const annualDividend = getAnnualDividendPerShare(dividends)
  if (!Number.isFinite(annualDividend) || annualDividend <= 0) return null
  return (annualDividend / safePrice) * 100
}

export const getDividendCadence = (dividends = []) => {
  const months = uniqueSortedMonths(dividends)
  if (months.length >= 10) return 'monthly'
  if (months.length === 4) {
    const gaps = months.map((month, idx) => {
      const next = months[(idx + 1) % months.length]
      return (next - month + 12) % 12 || 12
    })
    if (gaps.every((gap) => gap === 3)) return 'quarterly'
  }
  if (months.length === 2) {
    const gap = (months[1] - months[0] + 12) % 12 || 12
    if (gap === 6) return 'semiannual'
  }
  if (months.length === 1) return 'annual'
  if (months.length === 12) return 'monthly'
  return 'irregular'
}

/** US 株っぽいティッカー（配当表示の通貨ヒント用・保存フィールドがない場合） */
export const isLikelyUsdDivStock = (item) => {
  if (!item) return false
  if (item.flag === '🇺🇸') return true
  if (String(item.sector || '').includes('米国')) return true
  const id = String(item.stock_id ?? '').trim().toUpperCase()
  if (!id || id.endsWith('.T')) return false
  return /^[A-Z][A-Z0-9]*(?:\.[A-Z]+)?$/i.test(id)
}

export const formatDividendCash = (amount = 0, item = null) => {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '—'
  if (isLikelyUsdDivStock(item)) {
    const d = Math.abs(n) >= 100 ? 2 : 3
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: d })}`
  }
  const rounded = Math.abs(n - Math.round(n)) < 1e-6 ? Math.round(n) : Math.round(n * 100) / 100
  return `¥${rounded.toLocaleString()}`
}

/** 配当カレンダー用: USD建て株は rate で円換算、円建てはそのまま */
export const dividendCashToJpyApprox = (amountNative, item, usdJpyRate) => {
  const n = Math.max(0, Number(amountNative) || 0)
  const r = Number(usdJpyRate) > 0 ? Number(usdJpyRate) : 150
  if (isLikelyUsdDivStock(item)) return n * r
  return n
}

const JP_DIVIDEND_TAX_RATE = 0.20315
const US_DIVIDEND_WITHHOLDING_TAX_RATE = 0.1
const DIVIDEND_META_PREFIX = '[MMMETA]'

export const getDividendItemIsNisa = (item) => {
  if (typeof item?.is_nisa === 'boolean') return item.is_nisa
  const notes = String(item?.notes || '').trim()
  if (!notes.startsWith(DIVIDEND_META_PREFIX)) return false
  try {
    const parsed = JSON.parse(notes.slice(DIVIDEND_META_PREFIX.length))
    return Boolean(parsed?.is_nisa)
  } catch {
    return false
  }
}

export const getDividendNetCashInNative = (grossAmountNative = 0, item = null) => {
  const gross = Math.max(0, Number(grossAmountNative) || 0)
  const isNisa = getDividendItemIsNisa(item)
  if (isLikelyUsdDivStock(item)) {
    // US source tax always applies; JP side tax is exempt when NISA.
    const afterUs = gross * (1 - US_DIVIDEND_WITHHOLDING_TAX_RATE)
    return isNisa ? afterUs : afterUs * (1 - JP_DIVIDEND_TAX_RATE)
  }
  // JP-listed products: NISA exempts JP tax.
  return isNisa ? gross : gross * (1 - JP_DIVIDEND_TAX_RATE)
}

export const getDividendNetJpyApprox = (grossAmountNative = 0, item = null, usdJpyRate = 150) => (
  dividendCashToJpyApprox(getDividendNetCashInNative(grossAmountNative, item), item, usdJpyRate)
)

export const getDividendCadenceMeta = (dividends = []) => {
  const cadence = getDividendCadence(dividends)
  switch (cadence) {
    case 'monthly':
      return {
        id: cadence,
        label: '月配当',
        className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900',
      }
    case 'quarterly':
      return {
        id: cadence,
        label: '四半期配当',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900',
      }
    case 'semiannual':
      return {
        id: cadence,
        label: '半期配当',
        className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900',
      }
    case 'annual':
      return {
        id: cadence,
        label: '年1回配当',
        className: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-900',
      }
    default:
      return {
        id: cadence,
        label: '変則配当',
        className: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700',
      }
  }
}
