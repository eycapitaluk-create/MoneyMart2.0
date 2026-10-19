/**
 * iOS / Android / Web 共通の個人ポートフォリオ計算。
 * ルール: docs/PORTFOLIO_CALC_SPEC.md （iOS moneymart/docs と同一）
 * 損益 = (評価額 − 保有原価) + 実現損益
 * 元本 = 保有原価 + 売却済み原価
 * 損益率 = 損益 ÷ 元本
 */

const ISO = /^\d{4}-\d{2}-\d{2}$/

export function roundPct(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return null
  return Math.round(x * 100) / 100
}

export function normSymbol(symbol) {
  let s = String(symbol || '').trim().toUpperCase()
  if (s.endsWith('.JP')) s = `${s.slice(0, -3)}.T`
  if (/^\d{4}$/.test(s) || /^\d{3}[A-Z]$/.test(s)) s = `${s}.T`
  return s
}

function isoOk(value) {
  const s = String(value || '').slice(0, 10)
  return ISO.test(s) ? s : ''
}

export function addDaysIso(iso, days) {
  const base = isoOk(iso)
  if (!base) return ''
  const dt = new Date(`${base}T12:00:00`)
  dt.setDate(dt.getDate() + Number(days || 0))
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addMonthsIso(iso, months) {
  const base = isoOk(iso)
  if (!base) return ''
  const dt = new Date(`${base}T12:00:00`)
  const day = dt.getDate()
  dt.setDate(1)
  dt.setMonth(dt.getMonth() + Number(months || 0))
  const last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate()
  dt.setDate(Math.min(day, last))
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function splitRatioAfter(buyDate, symbol, splits) {
  const sym = normSymbol(symbol)
  const buy = isoOk(buyDate)
  let ratio = 1
  for (const row of Array.isArray(splits) ? splits : []) {
    if (normSymbol(row?.symbol) !== sym) continue
    const ex = isoOk(row?.ex_date || row?.exDate)
    const r = Number(row?.ratio)
    if (!ex || !(r > 0)) continue
    if (buy && ex > buy) ratio *= r
  }
  return ratio > 0 ? ratio : 1
}

function priceOnOrBefore(prices, symbol, asOf) {
  const rows = prices?.[symbol] || prices?.[normSymbol(symbol)] || []
  let best = null
  for (const row of rows) {
    const day = isoOk(Array.isArray(row) ? row[0] : row?.date || row?.trade_date)
    const close = Number(Array.isArray(row) ? row[1] : row?.close)
    if (!day || day > asOf || !(close > 0)) continue
    if (!best || day > best.day) best = { day, close }
  }
  return best?.close ?? null
}

function listingOf(lot) {
  const listed = String(lot?.listing || '').toUpperCase()
  if (listed === 'JPY' || listed === 'USD') return listed
  const sym = normSymbol(lot?.ticker || lot?.symbol)
  if (sym.endsWith('.T')) return 'JPY'
  return 'USD'
}

function storedBuyFx(lot) {
  const n = Number(lot?.buy_fx_rate ?? lot?.buyFxRate)
  return Number.isFinite(n) && n > 0 ? n : null
}

function usdJpyOn(asOf, fxByDate, fxLatest) {
  const day = isoOk(asOf)
  if (fxByDate && typeof fxByDate === 'object' && day) {
    let bestDate = ''
    let best = 0
    for (const [rawKey, raw] of Object.entries(fxByDate)) {
      const key = isoOk(rawKey)
      if (!key || key > day) continue
      const rate = Number(raw)
      if (!(rate > 0) || key <= bestDate) continue
      bestDate = key
      best = rate
    }
    if (best > 0) return best
  }
  const latest = Number(fxLatest)
  return latest > 0 ? latest : 0
}

/** 今日の評価はライブの USD/JPY。過去日は fx_by_date のその日以前のレート。 */
function marketUsdJpy(asOf, today, fxByDate, fxLatest) {
  const day = isoOk(asOf)
  const liveDay = isoOk(today)
  const latest = Number(fxLatest)
  if (liveDay && day && day >= liveDay && latest > 0) return latest
  return usdJpyOn(day, fxByDate, fxLatest)
}

/**
 * 1ロットの円評価。USD で buy_fx_rate が無いときは valued:false（固定レートで埋めない）。
 * 分割は数量×比率・単価÷比率。原価合計は変えない。
 * 時価の為替は評価日の USD/JPY。原価は保存した buy_fx_rate のまま。
 */
export function valueOpenLot(lot, { asOf, prices, fxLatest, fxByDate, today, splits }) {
  const symbol = normSymbol(lot?.ticker || lot?.symbol)
  const buyDate = isoOk(lot?.buy_date || lot?.buyDate)
  const rawQty = Number(lot?.qty)
  const rawBuy = Number(lot?.buy_price ?? lot?.buyPrice)
  if (!symbol || !(rawQty > 0) || !(rawBuy > 0)) {
    return { valued: false, valueJpy: 0, costJpy: 0, qty: 0 }
  }
  const ratio = splitRatioAfter(buyDate, symbol, splits)
  const qty = rawQty * ratio
  const listing = listingOf({ ...lot, ticker: symbol })
  const invest = Number(lot?.invest_amount ?? lot?.investAmount)
  const costNative = Number.isFinite(invest) && invest > 0 ? invest : rawQty * rawBuy
  const close = priceOnOrBefore(prices, symbol, asOf)
  const px = close != null ? close : rawBuy / ratio
  let valueFx = 1
  let costFx = 1
  if (listing === 'USD') {
    const now = marketUsdJpy(asOf, today, fxByDate, fxLatest)
    valueFx = now > 0 ? now : 0
    const fx = storedBuyFx(lot)
    if (fx == null) {
      return { valued: false, valueJpy: qty * px * valueFx, costJpy: 0, qty, symbol }
    }
    if (!(valueFx > 0)) return { valued: false, valueJpy: 0, costJpy: 0, qty, symbol }
    costFx = fx
  }
  return { valued: true, valueJpy: qty * px * valueFx, costJpy: costNative * costFx, qty, symbol }
}

function buyLotsOf(trade) {
  const rows = trade?.buy_lots || trade?.buyLots
  return Array.isArray(rows) ? rows : []
}

function realizedThrough(trades, asOf) {
  let realized = 0
  let soldCost = 0
  for (const trade of Array.isArray(trades) ? trades : []) {
    const sell = isoOk(trade?.sell_date || trade?.sellDate)
    if (!sell || sell > asOf) continue
    realized += Number(trade?.realized_pnl_jpy ?? trade?.realizedPnlJpy) || 0
    soldCost += Number(trade?.cost_basis_jpy ?? trade?.costBasisJpy) || 0
  }
  return { realized, soldCost }
}

function soldLotsValueOn(trades, { asOf, prices, includeBuyLots }) {
  if (!includeBuyLots) return { valueJpy: 0, costJpy: 0 }
  let valueJpy = 0
  let costJpy = 0
  for (const trade of Array.isArray(trades) ? trades : []) {
    const sell = isoOk(trade?.sell_date || trade?.sellDate)
    if (!sell || asOf >= sell) continue
    const symbol = normSymbol(trade?.symbol || trade?.ticker)
    for (const lot of buyLotsOf(trade)) {
      const buy = isoOk(lot?.buy_date || lot?.buyDate)
      if (!buy || buy > asOf) continue
      const qty = Number(lot?.qty)
      const cost = Number(lot?.cost_jpy ?? lot?.costJpy)
      if (!(qty > 0)) continue
      const close = priceOnOrBefore(prices, symbol, asOf)
      const px = close != null ? close : (Number.isFinite(cost) && cost > 0 ? cost / qty : 0)
      valueJpy += qty * px
      costJpy += Number.isFinite(cost) ? cost : 0
    }
  }
  return { valueJpy, costJpy }
}

export function positionOnDate(input, asOf, { includeBuyLots = true } = {}) {
  const day = isoOk(asOf)
  let displayValue = 0
  let pnlValue = 0
  let cost = 0
  let unvalued = 0
  for (const lot of Array.isArray(input?.lots) ? input.lots : []) {
    const buy = isoOk(lot?.buy_date || lot?.buyDate)
    if (buy && buy > day) continue
    const priced = valueOpenLot(lot, {
      asOf: day,
      prices: input?.prices,
      fxLatest: input?.fx_latest ?? input?.fxLatest,
      fxByDate: input?.fx_by_date ?? input?.fxByDate,
      today: input?.today,
      splits: input?.splits,
    })
    displayValue += priced.valueJpy
    if (!priced.valued) {
      unvalued += 1
      continue
    }
    pnlValue += priced.valueJpy
    cost += priced.costJpy
  }
  const sold = soldLotsValueOn(input?.trades, {
    asOf: day,
    prices: input?.prices,
    includeBuyLots,
  })
  displayValue += sold.valueJpy
  pnlValue += sold.valueJpy
  cost += sold.costJpy
  const { realized, soldCost } = realizedThrough(input?.trades, day)
  const principal = cost + soldCost
  const pnl = (pnlValue - cost) + realized
  return {
    asOf: day,
    total_value: displayValue,
    pnl_value: pnlValue,
    total_cost: cost,
    realized_pnl: realized,
    sold_cost: soldCost,
    principal,
    pnl,
    pct: principal > 0 ? roundPct((pnl / principal) * 100) : null,
    unvalued_lots: unvalued,
  }
}

export function summarizePortfolio(input) {
  const today = isoOk(input?.today)
  const snap = positionOnDate(input, today, { includeBuyLots: false })
  const first = Array.isArray(input?.lots) ? input.lots[0] : null
  const adjusted = first
    ? Number(first.qty) * splitRatioAfter(first.buy_date || first.buyDate, first.ticker || first.symbol, input?.splits)
    : null
  return {
    ...snap,
    adjusted_qty: adjusted,
  }
}

function firstBuyDate(input) {
  const dates = []
  for (const lot of input?.lots || []) {
    const d = isoOk(lot?.buy_date || lot?.buyDate)
    if (d) dates.push(d)
  }
  for (const trade of input?.trades || []) {
    for (const lot of buyLotsOf(trade)) {
      const d = isoOk(lot?.buy_date || lot?.buyDate)
      if (d) dates.push(d)
    }
  }
  dates.sort()
  return dates[0] || isoOk(input?.today)
}

export function dailyPnlSeries(input, { includeBuyLots = true, maxDays = 400 } = {}) {
  const today = isoOk(input?.today)
  let start = firstBuyDate(input)
  if (!today || !start) return []
  const earliest = addDaysIso(today, -(maxDays - 1))
  if (earliest && start < earliest) start = earliest
  const out = []
  for (let day = start; day && day <= today && out.length < maxDays; day = addDaysIso(day, 1)) {
    out.push(positionOnDate(input, day, { includeBuyLots }))
  }
  return out
}

export function monthlyChange(input, { includeBuyLots = true } = {}) {
  const today = isoOk(input?.today)
  const series = dailyPnlSeries(input, { includeBuyLots })
  const now = series.length ? series[series.length - 1] : positionOnDate(input, today, { includeBuyLots })
  const baseLimit = addMonthsIso(today, -1)
  let base = null
  for (const point of series) {
    if (point.asOf <= baseLimit) base = point
  }
  const delta = now.pnl - (base ? base.pnl : 0)
  return {
    base_date: base?.asOf || null,
    base_pnl: base ? base.pnl : 0,
    pnl: now.pnl,
    principal: now.principal,
    monthly_delta: delta,
    monthly_pct: now.principal > 0 ? roundPct((delta / now.principal) * 100) : null,
  }
}
