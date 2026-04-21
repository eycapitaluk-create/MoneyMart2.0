/**
 * dividendCalendarDetail.generated.json 内の米国株(USD)について、
 * 月別シート由来の不整合（irregular / 年間合計不一致）を
 * src/lib/usDividendScheduleInference.js で正規化する。
 *
 *   node scripts/normalize-dividend-calendar-detail-json.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { rebuildUsDividendScheduleFromRecord, shouldNormalizeUsDividendRecord } from '../src/lib/usDividendScheduleInference.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const JSON_PATH = path.join(ROOT, 'src/data/dividendCalendarDetail.generated.json')

function main() {
  const raw = fs.readFileSync(JSON_PATH, 'utf8')
  const pack = JSON.parse(raw)
  const records = Array.isArray(pack?.records) ? pack.records : []
  let changed = 0
  const samples = []

  for (const rec of records) {
    const prev = rec.dividends
    if (!shouldNormalizeUsDividendRecord({ ...rec, dividends: prev }, prev)) continue
    const next = rebuildUsDividendScheduleFromRecord(rec)
    if (!Array.isArray(next) || next.length === 0) continue
    const prevStr = JSON.stringify(prev)
    const nextStr = JSON.stringify(next)
    if (prevStr === nextStr) continue
    rec.dividends = next
    changed += 1
    if (samples.length < 12) samples.push({ symbol: rec.symbol, name: rec.name, before: prev, after: next })
  }

  fs.writeFileSync(JSON_PATH, `${JSON.stringify(pack, null, 0)}\n`, 'utf8')
  console.log('Wrote', JSON_PATH)
  console.log('Normalized records:', changed, '/', records.length)
  if (samples.length) {
    console.log('Sample changes:')
    for (const s of samples) console.log(JSON.stringify(s, null, 2))
  }
}

main()
