import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { displayedMonthEndSpending, projectMonthEndSpending, samePeriodExpenseBounds, spentOnInBounds } from '../src/lib/mypageBudgetAlerts.js'
import { insertRowsSkippingDuplicates, isDuplicateChildInsertError } from '../src/lib/expenseChildInsert.js'
import { householdMemoText } from '../src/lib/householdExpenseMemo.js'

const march31 = new Date(2026, 2, 31, 12)
const march = samePeriodExpenseBounds(march31)
assert.equal(march.prevEnd.getFullYear(), 2026)
assert.equal(march.prevEnd.getMonth(), 1)
assert.equal(march.prevEnd.getDate(), 28)
assert.equal(march.prevEnd.getHours(), 23)
assert.equal(spentOnInBounds('2026-02-28', march.prevStart, march.prevEnd), true)
assert.equal(spentOnInBounds('2026-03-01', march.prevStart, march.prevEnd), false)
assert.equal(spentOnInBounds('2026-03-31', march.curStart, march.todayEnd), true)
assert.equal(spentOnInBounds('2026-04-01', march.curStart, march.todayEnd), false)

const oct10 = samePeriodExpenseBounds(new Date(2026, 9, 10, 15))
assert.equal(spentOnInBounds('2026-09-10', oct10.prevStart, oct10.prevEnd), true)
assert.equal(spentOnInBounds('2026-09-11', oct10.prevStart, oct10.prevEnd), false)
assert.equal(spentOnInBounds('2026-10-10', oct10.curStart, oct10.todayEnd), true)
assert.equal(spentOnInBounds('2026-10-11', oct10.curStart, oct10.todayEnd), false)

assert.equal(isDuplicateChildInsertError({ code: '23505' }), true)
assert.equal(isDuplicateChildInsertError({ status: 409 }), true)
assert.equal(isDuplicateChildInsertError({ code: '42P10' }), false)

const calls = []
const mixed = await insertRowsSkippingDuplicates(
  [{ spent_on: '2026-11-01' }, { spent_on: '2026-12-01' }],
  async (batch) => {
    calls.push(batch.map((row) => row.spent_on).join(','))
    if (batch.length > 1) return { error: { code: '23505' } }
    if (batch[0].spent_on === '2026-11-01') return { error: { status: 409 } }
    return { error: null }
  },
)
assert.deepEqual(calls, ['2026-11-01,2026-12-01', '2026-11-01', '2026-12-01'])
assert.deepEqual(mixed, { inserted: 1, skipped: 1 })

await assert.rejects(
  () => insertRowsSkippingDuplicates([{ spent_on: '2026-11-01' }], async () => ({ error: { code: '42P10' } })),
  (error) => error?.code === '42P10',
)

const api = readFileSync(new URL('../src/lib/myPageApi.js', import.meta.url), 'utf8')
const page = readFileSync(new URL('../src/pages/MyPage.jsx', import.meta.url), 'utf8')
const materialize = api.slice(api.indexOf('const materializeRecurringExpenses'), api.indexOf('export const loadMyPageData'))
assert.ok(materialize.includes('insertRowsSkippingDuplicates'))
assert.equal(materialize.includes('onConflict'), false)
assert.equal(page.includes('prevMonthTotalSameCalendar'), false)
assert.ok(page.includes('householdInsightMetrics.totalPrev'))
assert.ok(page.includes('samePeriodExpenseBounds'))
assert.equal(householdMemoText({ merchant: '맥도', notes: '' }), '맥도')
assert.equal(householdMemoText({ merchant: '', notes: '우히하ㅏ' }), '우히하ㅏ')
assert.equal(householdMemoText({ merchant: '맥도', notes: '우히하ㅏ' }), '맥도')
assert.equal(householdMemoText({ merchant: '   ', notes: '우히하ㅏ' }), '우히하ㅏ')
assert.equal(householdMemoText({ merchant: '', notes: '' }), '')
assert.ok(page.includes('householdMemoText(row)'))
assert.ok(page.includes('householdMemoText(tx)'))

const projectionRows = [
  { spent_on: '2026-10-05', amount: 10000 },
  { spent_on: '2026-10-25', amount: 85000, recurring_parent_id: 't1' },
  { spent_on: '2026-10-20', amount: 3000 },
  { spent_on: '2026-09-05', amount: 99999 },
]
const projectionDay = new Date(2026, 9, 10, 12)
assert.equal(projectMonthEndSpending(projectionRows, projectionDay), 119000)
assert.equal(displayedMonthEndSpending(projectionRows, '2026-09', projectionDay), 99999)
assert.equal(Math.round(98000 / 10 * 31), 303800)

console.log('kakeibo sync checks passed')
