/**
 * Realized-trade buy_lots (jsonb) round-trip.
 * A missing sell_fx column must not be treated as a missing buy_lots column:
 * the reader would drop the lots, and the next delete-and-insert would null them.
 */

export function realizedSchemaMiss(error) {
  const msg = String(error?.message || '')
  const code = String(error?.code || '')
  const schemaMiss = code === '42703' || code === 'PGRST204'
  if (!schemaMiss && !/buy_lots|sell_fx_rate|sell_fx_date/.test(msg)) {
    return { buyLots: false, sellFx: false }
  }
  return {
    buyLots: /buy_lots/.test(msg),
    sellFx: /sell_fx_rate|sell_fx_date/.test(msg),
  }
}

/** Next SELECT shape after `current` failed. null means stop and surface the error. */
export function nextRealizedStockColumns(current, error) {
  const miss = realizedSchemaMiss(error)
  if (!miss.buyLots && !miss.sellFx) return null
  if (current === 'full') {
    if (miss.sellFx && miss.buyLots) return 'base'
    if (miss.sellFx) return 'buyLotsOnly'
    if (miss.buyLots) return 'sellFxOnly'
  }
  if (current === 'buyLotsOnly' && miss.buyLots) return 'base'
  if (current === 'sellFxOnly' && miss.sellFx) return 'base'
  return null
}

export function serializeBuyLots(raw) {
  const lots = (Array.isArray(raw) ? raw : [])
    .map((lot) => {
      const buyDate = String(lot?.buy_date || lot?.buyDate || '').slice(0, 10)
      const qty = Number(lot?.qty)
      const costJpy = Number(lot?.cost_jpy ?? lot?.costJpy)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(buyDate) || !(qty > 0)) return null
      return {
        buy_date: buyDate,
        qty,
        cost_jpy: Number.isFinite(costJpy) ? costJpy : 0,
      }
    })
    .filter(Boolean)
  return lots.length > 0 ? lots : null
}
