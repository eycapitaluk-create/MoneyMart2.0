import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeAutofillDividendRows,
  planDividendWatchlistLoad,
  toCanonicalDividendRows,
} from '../src/lib/dividendAutofillNormalize.js'

test('autofill collapses bi-monthly US schedules to quarterly run-rate', () => {
  const biMonthly = [1, 3, 5, 7, 9, 11].map((month, i) => ({
    month,
    amount: 0.5 + i * 0.1,
  }))
  const out = normalizeAutofillDividendRows(biMonthly, {
    symbol: 'AAPL',
    category: '米国株式',
  })
  assert.deepEqual(out, [
    { month: 3, amount: 1 },
    { month: 5, amount: 1 },
    { month: 9, amount: 1 },
    { month: 11, amount: 1 },
  ])
})

test('autofill collapses quarter-boundary drift and equalizes to max amount', () => {
  const drift = [
    { month: 1, amount: 0.5 },
    { month: 2, amount: 0.6 },
    { month: 4, amount: 0.55 },
    { month: 5, amount: 0.7 },
    { month: 7, amount: 0.65 },
    { month: 8, amount: 0.8 },
    { month: 10, amount: 0.75 },
    { month: 11, amount: 0.9 },
  ]
  const out = normalizeAutofillDividendRows(drift, {
    symbol: 'MSFT',
    category: '米国株式',
  })
  assert.deepEqual(out, [
    { month: 2, amount: 0.9 },
    { month: 5, amount: 0.9 },
    { month: 8, amount: 0.9 },
    { month: 11, amount: 0.9 },
  ])
})

test('autofill leaves JP bi-monthly schedules untouched', () => {
  const biMonthly = [1, 3, 5, 7, 9, 11].map((month, i) => ({
    month,
    amount: 0.5 + i * 0.1,
  }))
  const out = normalizeAutofillDividendRows(biMonthly, {
    symbol: '8306',
    category: '日本株式',
  })
  assert.deepEqual(out, toCanonicalDividendRows(biMonthly).map((r) => ({
    month: r.month,
    amount: r.amount,
  })))
})

test('dividend tab load never schedules persistence of autofill mutations', () => {
  const stored = [{
    stock_id: 'AAPL',
    stock_name: 'Apple',
    dividends: [1, 3, 5, 7, 9, 11].map((month, i) => ({
      month,
      amount: 0.5 + i * 0.1,
    })),
  }]
  const { displayRows, persistRows } = planDividendWatchlistLoad(stored)
  assert.equal(persistRows.length, 0)
  assert.deepEqual(displayRows, stored)
  // Guard: even if autofill would mutate, load planner must not ask to upsert.
  const autofilled = normalizeAutofillDividendRows(stored[0].dividends, {
    symbol: 'AAPL',
    category: '米国株式',
  })
  assert.notDeepEqual(
    toCanonicalDividendRows(autofilled),
    toCanonicalDividendRows(stored[0].dividends),
  )
})
