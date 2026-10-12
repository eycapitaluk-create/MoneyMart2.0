/**
 * 사용자 표준 테이블 → dividendCalendarDetail.generated.json 동기화 (일회·재실행 안전)
 * node scripts/patch-dividend-detail-user-table.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const detailPath = path.join(ROOT, 'src/data/dividendCalendarDetail.generated.json')

const round6 = (n) => Math.round(Math.max(0, Number(n) || 0) * 1e6) / 1e6

const applyYield = (rec, prevHy = false) => {
  const price = Number(rec?.price) || 0
  const annual = Number(rec?.annualDividend) || 0
  if (price > 0 && annual > 0) {
    rec.yieldPct = Math.round((annual / price) * 10000) / 100
  } else {
    rec.yieldPct = 0
  }
  const y = Number(rec.yieldPct)
  rec.highYield = (Number.isFinite(y) && y >= 4) || Boolean(prevHy)
}

const patchQuarterly = (rec, months, last) => {
  const per = round6(last)
  rec.lastAmount = per
  rec.dividends = months.map((month) => ({ month, amount: per }))
  rec.annualDividend = round6(per * 4)
  applyYield(rec, rec.highYield)
}

const patchCustom = (rec, pairs, lastHint) => {
  rec.dividends = pairs.map(([month, amount]) => ({ month, amount: round6(amount) }))
  rec.annualDividend = round6(rec.dividends.reduce((s, d) => s + d.amount, 0))
  rec.lastAmount = round6(lastHint ?? rec.dividends.at(-1)?.amount ?? 0)
  applyYield(rec, rec.highYield)
}

const pack = JSON.parse(fs.readFileSync(detailPath, 'utf8'))
const records = Array.isArray(pack.records) ? pack.records : []
const by = new Map(records.map((r) => [r.symbol, r]))

const q = (sym, months, last) => {
  const rec = by.get(sym)
  if (!rec) throw new Error(`detail 레코드 없음: ${sym}`)
  patchQuarterly(rec, months, last)
}

q('ARES', [3, 6, 9, 12], 1.18)
q('BXP', [3, 6, 9, 12], 0.77)
q('CASY', [2, 5, 8, 11], 0.695)
q('ERIE', [1, 4, 7, 10], 1.46)
q('EXE', [3, 6, 9, 12], 0.575)
q('FIX', [3, 6, 8, 11], 0.7)
q('IBKR', [3, 6, 9, 12], 0.1)
q('MRSH', [1, 4, 7, 10], 1.1)
q('TPL', [3, 6, 9, 12], 0.55)

patchCustom(by.get('CRH'), [[3, 0.39], [9, 0.37]], 0.39)
patchCustom(by.get('Q'), [[2, 0.08], [11, 0.06]], 0.08)

if (!by.get('PLTR')) {
  records.push({
    symbol: 'PLTR',
    name: 'Palantir Technologies Inc',
    category: '米国株',
    currency: 'USD',
    price: 0,
    annualDividend: 0.2,
    yieldPct: 0,
    lastAmount: 0.05,
    lastExDate: null,
    nextExDate: null,
    dividends: [3, 6, 9, 12].map((month) => ({ month, amount: 0.05 })),
    highYield: false,
  })
}

records.sort((a, b) => String(a.symbol).localeCompare(String(b.symbol)))
pack.records = records
pack.recordCount = records.length
const prevFrom = String(pack.generatedFrom || '')
pack.generatedFrom = prevFrom.includes('user div table')
  ? prevFrom
  : `${prevFrom}; user div table (ARES…WSM) 2026-05`.replace(/^; /, '')

fs.writeFileSync(detailPath, `${JSON.stringify(pack, null, 2)}\n`)
console.log('patched', detailPath, 'records', records.length)
