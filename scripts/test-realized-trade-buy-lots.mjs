import assert from 'node:assert/strict'
import {
  nextRealizedStockColumns,
  realizedSchemaMiss,
  serializeBuyLots,
} from '../src/lib/realizedTradeBuyLots.js'

const sellFxMissing = {
  code: '42703',
  message: 'column user_stock_realized_trades.sell_fx_rate does not exist',
}
const buyLotsMissing = {
  code: 'PGRST204',
  message: "Could not find the 'buy_lots' column of 'user_stock_realized_trades' in the schema cache",
}

assert.deepEqual(realizedSchemaMiss(sellFxMissing), { buyLots: false, sellFx: true })
assert.equal(nextRealizedStockColumns('full', sellFxMissing), 'buyLotsOnly')
assert.equal(nextRealizedStockColumns('full', buyLotsMissing), 'sellFxOnly')
assert.equal(
  nextRealizedStockColumns('full', { code: '42703', message: 'column sell_fx_rate does not exist' }),
  'buyLotsOnly',
)

const stored = serializeBuyLots([
  { buyDate: '2026-08-01', qty: 40, costJpy: 40000 },
  { buy_date: 'not-a-date', qty: 1, cost_jpy: 1 },
])
assert.deepEqual(stored, [{ buy_date: '2026-08-01', qty: 40, cost_jpy: 40000 }])
assert.equal(serializeBuyLots([]), null)
assert.equal(serializeBuyLots(null), null)

console.log('realized trade buy_lots checks passed')
