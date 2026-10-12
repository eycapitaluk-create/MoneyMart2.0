/**
 * stockMarketPageExtras 43종목 × CSV 의 2026-05-05 vs 2026-05-06 종가 비교（동일·결측 플래그）
 *
 *   node scripts/audit-stock-extras-may5-may6-from-csv.mjs [/path/to/Close Prices-Table 1.csv]
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { STOCK_MARKET_PAGE_EXTRA_SYMBOLS } from '../src/data/stockMarketPageExtras.js'

const parseCsvLine = (line) => {
  const cells = []
  let i = 0
  while (i < line.length) {
    if (line[i] === '"') {
      i += 1
      let cell = ''
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            cell += '"'
            i += 2
            continue
          }
          i += 1
          break
        }
        cell += line[i]
        i += 1
      }
      cells.push(cell)
      if (line[i] === ',') i += 1
      continue
    }
    const start = i
    while (i < line.length && line[i] !== ',') i += 1
    cells.push(line.slice(start, i).trim())
    if (line[i] === ',') i += 1
  }
  return cells
}

const normalizeDbSymbol = (rawHeader) => {
  const u = String(rawHeader ?? '').trim().toUpperCase()
  if (!u) return ''
  if (u === 'BRK/B' || u === 'BRK-B') return 'BRK.B'
  if (u === 'BF/B' || u === 'BF-B' || u === 'BF.B') return 'BF-B'
  if (u.includes('/')) return u.replace(/\//g, '-')
  return u
}

const toNum = (v) => {
  const s = String(v ?? '').trim().replace(/^"|"$/g, '').replace(/,/g, '')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const dateKey = (cell) => String(cell ?? '').trim().slice(0, 10)

async function main() {
  const csvPath =
    process.argv[2]
    || path.join(process.env.HOME || '', 'Desktop/Close Prices-Table 1.csv')

  const rawText = await fs.readFile(csvPath, 'utf8')
  const lines = rawText.split(/\r?\n/).filter((l) => l.length > 0)
  const rows = lines.map(parseCsvLine)
  const hdr = rows[0] || []

  let symbolStartIdx = 1
  const normH = (h) => String(h ?? '').normalize('NFKC').trim().toLowerCase()
  const h0 = normH(hdr[0])
  const h1 = normH(hdr[1])
  if (h0 === 'ticker' && (h1 === 'date (text)' || h1.includes('date'))) {
    symbolStartIdx = 2
  }

  const symToCol = new Map()
  for (let ci = symbolStartIdx; ci < hdr.length; ci += 1) {
    symToCol.set(normalizeDbSymbol(hdr[ci]), ci)
  }

  let dataStart = 2
  for (; dataStart < rows.length; dataStart += 1) {
    const dk = dateKey(rows[dataStart]?.[0])
    if (/^\d{4}-\d{2}-\d{2}$/.test(dk)) break
  }

  let row05
  let row06
  for (let ri = dataStart; ri < rows.length; ri += 1) {
    const dk = dateKey(rows[ri]?.[0])
    if (dk === '2026-05-05') row05 = rows[ri]
    if (dk === '2026-05-06') row06 = rows[ri]
  }

  if (!row05 || !row06) {
    console.error('CSV 에서 2026-05-05 또는 2026-05-06 행을 찾지 못함:', csvPath)
    process.exit(1)
  }

  const linesOut = []
  let sameCt = 0
  let missingCt = 0

  for (const sym of STOCK_MARKET_PAGE_EXTRA_SYMBOLS) {
    const ci = symToCol.get(sym)
    if (ci == null) {
      linesOut.push(`${sym}\tNO_COL\t-\t-`)
      missingCt += 1
      continue
    }
    const c5 = toNum(row05[ci])
    const c6 = toNum(row06[ci])
    if (c5 == null || c6 == null) {
      linesOut.push(`${sym}\tMISS\t${c5 ?? '?'}\t${c6 ?? '?'}`)
      missingCt += 1
      continue
    }
    const same = Math.abs(c5 - c6) < 1e-9
    if (same) sameCt += 1
    const flag = same ? 'SAME' : 'OK'
    linesOut.push(`${sym}\t${flag}\t${c5}\t${c6}`)
  }

  console.log(`파일: ${csvPath}`)
  console.log(`종목 수: ${STOCK_MARKET_PAGE_EXTRA_SYMBOLS.length}`)
  console.log('')
  console.log('symbol\tflag\t2026-05-05\t2026-05-06')
  for (const ln of linesOut) console.log(ln)
  console.log('')
  console.log(`요약: OK=${linesOut.filter((l) => l.includes('\tOK\t')).length}, SAME=${sameCt}, 문제(NO_COL|MISS)=${missingCt}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
