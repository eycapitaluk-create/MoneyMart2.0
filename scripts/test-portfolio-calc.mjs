import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { monthlyChange, summarizePortfolio } from '../src/lib/portfolioCalc.js'

const doc = JSON.parse(readFileSync(new URL('../docs/portfolio_calc_cases.json', import.meta.url), 'utf8'))

const MONTHLY_KEYS = new Set(['base_date', 'base_pnl', 'monthly_delta', 'monthly_pct'])

const near = (actual, expected, label) => {
  if (typeof expected === 'number' && typeof actual === 'number') {
    assert.ok(Math.abs(actual - expected) < 0.001, `${label}: ${actual} !== ${expected}`)
    return
  }
  assert.equal(actual, expected, label)
}

for (const row of doc.cases) {
  const snap = summarizePortfolio(row)
  for (const [key, expected] of Object.entries(row.expected)) {
    if (MONTHLY_KEYS.has(key)) continue
    if (key === 'adjusted_qty') {
      near(snap.adjusted_qty, expected, `${row.id}.${key}`)
      continue
    }
    near(snap[key], expected, `${row.id}.${key}`)
  }
  if (row.expected.monthly_delta != null || row.id.startsWith('monthly_')) {
    const month = monthlyChange(row, { includeBuyLots: true })
    for (const key of ['base_date', 'base_pnl', 'pnl', 'monthly_delta', 'monthly_pct']) {
      if (row.expected[key] == null) continue
      near(month[key], row.expected[key], `${row.id}.${key}`)
    }
  }
  if (row.without_buy_lots_expected) {
    const month = monthlyChange(row, { includeBuyLots: false })
    for (const [key, expected] of Object.entries(row.without_buy_lots_expected)) {
      near(month[key], expected, `${row.id}.without_buy_lots.${key}`)
    }
  }
  console.log('ok', row.id)
}

const usdSale = doc.cases.find((row) => row.id === 'monthly_change_usd_sale_buy_lots')
const latestOnly = monthlyChange({ ...usdSale, fx_by_date: {} }, { includeBuyLots: true })
near(latestOnly.base_pnl, 20500, 'usd sale falls back to fx_latest')
near(latestOnly.monthly_delta, 15500, 'usd sale falls back to fx_latest delta')
console.log('ok usd sale fx_latest fallback')

console.log('portfolio calc cases passed')
