/**
 * One-off integrity fixes for flagged dividend records.
 * Sources: issuer IR / Yahoo events. Does not invent amounts.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const detailPath = path.join(__dirname, '..', 'src/data/dividendCalendarDetail.generated.json')

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const applyYield = (rec) => {
  const price = Number(rec.price) || 0
  const annual = Number(rec.annualDividend) || 0
  rec.yieldPct = price > 0 && annual > 0 ? round2((annual / price) * 100) : 0
  rec.highYield = rec.yieldPct >= 4
}

const pack = JSON.parse(fs.readFileSync(detailPath, 'utf8'))
const by = new Map(pack.records.map((r) => [r.symbol, r]))

const rec2867 = by.get('2867.T')
if (!rec2867) throw new Error('missing 2867.T')
rec2867.annualDividend = 5
rec2867.lastAmount = 3
rec2867.lastExDate = '2025-09-24'
rec2867.dividends = [
  { month: 3, amount: 2 },
  { month: 9, amount: 3 },
]
applyYield(rec2867)

const rec7205 = by.get('7205.T')
if (!rec7205) throw new Error('missing 7205.T')
rec7205.annualDividend = 0
rec7205.lastAmount = 7
rec7205.lastExDate = '2021-09-29'
rec7205.nextExDate = null
rec7205.dividends = []
applyYield(rec7205)

const recTdg = by.get('TDG')
if (!recTdg) throw new Error('missing TDG')
recTdg.annualDividend = 0
recTdg.lastAmount = 90
recTdg.lastExDate = '2025-09-02'
recTdg.nextExDate = null
recTdg.dividends = []
applyYield(recTdg)

const recHst = by.get('HST')
if (!recHst) throw new Error('missing HST')
recHst.lastAmount = 0.92
recHst.lastExDate = '2026-06-30'
recHst.dividends = [
  { month: 3, amount: 0.2 },
  { month: 6, amount: 0.2 },
  { month: 9, amount: 0.2 },
  { month: 12, amount: 0.35 },
]
recHst.annualDividend = 0.95
applyYield(recHst)

pack.integrityFlagsPatchedAt = new Date().toISOString()
fs.writeFileSync(detailPath, `${JSON.stringify(pack)}\n`)

for (const s of ['2867.T', '7205.T', 'TDG', 'HST']) {
  const r = by.get(s)
  console.log(s, {
    last: r.lastAmount,
    lastEx: r.lastExDate,
    ann: r.annualDividend,
    yld: r.yieldPct,
    months: r.dividends,
    high: r.highYield,
  })
}
