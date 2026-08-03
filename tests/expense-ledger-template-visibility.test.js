import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  EXPENSE_LEDGER_LIMIT,
  mergeExpenseLedgerRows,
} from '../src/lib/expenseLedgerLoad.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readRepoFile = (rel) => readFile(path.join(root, rel), 'utf8')

describe('expense ledger template visibility', () => {
  test('merge keeps recurring template when it ages out of the newest-N window', () => {
    // Concrete trigger: weekly series from 2016 → 500+ children; newest 300 omit the parent.
    const children = Array.from({ length: EXPENSE_LEDGER_LIMIT }, (_, i) => ({
      id: `child-${i}`,
      spent_on: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
      created_at: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`,
      recurring_parent_id: 'tpl-weekly',
      recurring_type: null,
      amount: 5000,
    }))
    const template = {
      id: 'tpl-weekly',
      spent_on: '2016-01-01',
      created_at: '2016-01-01T00:00:00Z',
      recurring_type: 'weekly',
      recurring_parent_id: null,
      amount: 5000,
    }

    const withoutMerge = children
    assert.equal(withoutMerge.some((r) => r.id === 'tpl-weekly'), false)

    const merged = mergeExpenseLedgerRows(children, [template])
    assert.equal(merged.some((r) => r.id === 'tpl-weekly'), true)
    assert.equal(merged.length, EXPENSE_LEDGER_LIMIT + 1)
    assert.equal(merged.find((r) => r.id === 'tpl-weekly')?.recurring_type, 'weekly')
  })

  test('merge does not duplicate a template already present in the ledger window', () => {
    const template = {
      id: 'tpl-monthly',
      spent_on: '2026-07-01',
      created_at: '2026-07-01T00:00:00Z',
      recurring_type: 'monthly',
      recurring_parent_id: null,
    }
    const child = {
      id: 'child-1',
      spent_on: '2026-08-01',
      created_at: '2026-08-01T00:00:00Z',
      recurring_type: null,
      recurring_parent_id: 'tpl-monthly',
    }
    const merged = mergeExpenseLedgerRows([template, child], [template])
    assert.equal(merged.filter((r) => r.id === 'tpl-monthly').length, 1)
    assert.equal(merged.length, 2)
  })

  test('merge sorts by spent_on descending so the ledger order stays stable', () => {
    const merged = mergeExpenseLedgerRows(
      [{ id: 'a', spent_on: '2026-01-01', created_at: '2026-01-01T00:00:00Z' }],
      [{ id: 'b', spent_on: '2026-03-01', created_at: '2026-03-01T00:00:00Z' }],
    )
    assert.deepEqual(merged.map((r) => r.id), ['b', 'a'])
  })

  test('fetchExpensesRows loads recurring templates and merges them into the ledger', async () => {
    const source = await readRepoFile('src/lib/myPageApi.js')
    assert.match(source, /mergeExpenseLedgerRows/)
    assert.match(source, /EXPENSE_LEDGER_LIMIT/)
    assert.match(source, /RECURRING_TEMPLATE_FETCH_LIMIT/)
    assert.match(
      source,
      /\.in\('recurring_type',\s*RECURRING_TYPES\)[\s\S]*\.is\('recurring_parent_id',\s*null\)/,
    )
    assert.match(source, /mergeExpenseLedgerRows\(latest\.data \|\| \[\],\s*templates\.data \|\| \[\]\)/)
  })
})
