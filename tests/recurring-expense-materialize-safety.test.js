import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  RECURRING_EXISTING_DATES_PAGE_SIZE,
  addDaysIso,
  collectExistingSpentOnDates,
  endOfMonthAfterMonthsIso,
  fetchAllSpentOnDatesPaged,
  planRecurringChildRows,
  toIsoDate,
} from '../src/lib/recurringExpenseMaterialize.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const buildWeeklySeries = (startIso, count) => {
  const rows = [{ spent_on: startIso }]
  let cursor = startIso
  for (let i = 0; i < count; i += 1) {
    cursor = addDaysIso(cursor, 7)
    rows.push({ spent_on: cursor })
  }
  return rows
}

test('truncated existingDates (old .limit(500) behavior) re-plans duplicate weekly children', () => {
  // Concrete trigger: weekly recurring expense starting 2016-01-01 through 2026-08
  // produces ~554 child dates. A 500-row probe misses ~54 dates; next MyPage load
  // re-inserts them and permanently inflates stored expense totals.
  const startIso = '2016-01-01'
  const endIso = '2026-08-31'
  const fullRows = buildWeeklySeries(startIso, 560)
  const fullDates = collectExistingSpentOnDates(fullRows)
  assert.ok(fullDates.size > 500, `expected >500 dates, got ${fullDates.size}`)

  const truncated = collectExistingSpentOnDates(fullRows.slice(0, 500))
  assert.equal(truncated.size, 500)

  const template = {
    id: 'tpl-weekly',
    user_id: 'user-1',
    category: '交通',
    merchant: '通勤定期',
    amount: 18000,
    payment_method: 'カード',
    notes: '',
  }

  const withFull = planRecurringChildRows({
    type: 'weekly',
    startIso,
    endIso,
    template,
    existingDates: fullDates,
  })
  assert.equal(withFull.length, 0, 'full date set must not re-insert children')

  const withTruncated = planRecurringChildRows({
    type: 'weekly',
    startIso,
    endIso,
    template,
    existingDates: truncated,
  })
  assert.ok(
    withTruncated.length > 0,
    'truncated probe must produce duplicate inserts (documents the regression)',
  )
  assert.equal(withTruncated[0].recurring_parent_id, 'tpl-weekly')
  assert.equal(withTruncated[0].amount, 18000)
})

test('planRecurringChildRows inserts only missing future periods once', () => {
  const startIso = '2026-07-01'
  const endIso = endOfMonthAfterMonthsIso(1, new Date('2026-08-02T00:00:00Z'))
  const template = {
    id: 'tpl-monthly',
    user_id: 'user-2',
    category: '住居',
    merchant: '家賃',
    amount: 120000,
    payment_method: '',
    notes: '',
    recurring_anchor_day: 1,
  }
  const existing = new Set([startIso, '2026-08-01'])
  const planned = planRecurringChildRows({
    type: 'monthly',
    startIso,
    endIso,
    template,
    existingDates: existing,
  })
  // endIso for Aug 2026 + 1 month ahead from fixed now in endOfMonthAfterMonthsIso call above
  // is 2026-09-30, so Sep 1 should be planned once.
  assert.deepEqual(
    planned.map((r) => r.spent_on),
    ['2026-09-01'],
  )
  assert.equal(planned[0].recurring_parent_id, 'tpl-monthly')
})

test('fetchAllSpentOnDatesPaged merges pages past a 500-row silent cap', async () => {
  const pageSize = 500
  const total = 560
  const all = Array.from({ length: total }, (_, i) => ({
    spent_on: addDaysIso('2016-01-01', i * 7),
  }))
  const calls = []
  const { dates, error } = await fetchAllSpentOnDatesPaged(
    async (from, to) => {
      calls.push([from, to])
      return { data: all.slice(from, to + 1), error: null }
    },
    { pageSize },
  )
  assert.equal(error, null)
  assert.equal(dates.size, total)
  assert.deepEqual(calls, [
    [0, 499],
    [500, 999],
  ])
})

test('toIsoDate rejects invalid values', () => {
  assert.equal(toIsoDate('2026-08-02'), '2026-08-02')
  assert.equal(toIsoDate(''), '')
  assert.equal(toIsoDate('not-a-date'), '')
})

test('materializeRecurringExpenses pages existing spent_on with .range() (no .limit(500))', () => {
  const source = readFileSync(join(root, 'src/lib/myPageApi.js'), 'utf8')
  assert.match(source, /fetchAllSpentOnDatesPaged/)
  assert.match(source, /planRecurringChildRows/)
  assert.match(
    source,
    /from\('user_expenses'\)[\s\S]*\.or\(`id\.eq\.\$\{tpl\.id\},recurring_parent_id\.eq\.\$\{tpl\.id\}`\)[\s\S]*\.range\(from,\s*to\)/,
  )
  assert.doesNotMatch(source, /\.limit\(500\)/)
  assert.equal(RECURRING_EXISTING_DATES_PAGE_SIZE, 1000)
})
