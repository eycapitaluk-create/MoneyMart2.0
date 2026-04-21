#!/usr/bin/env node
/**
 * Stock list 400 CSV → src/data/stockList400.js
 * 
 * 사용법:
 * 1. Numbers에서 Stock list.numbers를 CSV로 내보내기 (파일 > 내보내기 > CSV)
 * 2. reports/stock_list_400.csv 로 저장
 * 3. node scripts/generate-stock-list-400.mjs
 * 
 * CSV 컬럼: symbol, name, region, sector (GICS 섹터)
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const csvPath = path.resolve('reports', 'stock_list_400.csv')
const outPath = path.resolve('src', 'data', 'stockList400.js')

const parseCsvLine = (line) => {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if ((c === ',' && !inQuotes) || c === '\n' || c === '\r') {
      result.push(current.trim())
      current = ''
      if (c !== ',') break
    } else {
      current += c
    }
  }
  if (current !== '' || result.length > 0) result.push(current.trim())
  return result
}

const run = async () => {
  let raw
  try {
    raw = await fs.readFile(csvPath, 'utf8')
  } catch (e) {
    console.error(`Cannot read ${csvPath}. Export Stock list.numbers to CSV first.`)
    process.exit(1)
  }

  const lines = raw.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) {
    console.error('CSV needs header + at least 1 row')
    process.exit(1)
  }

  const header = parseCsvLine(lines[0])
  const symbolIdx = header.findIndex((h) => /symbol/i.test(h))
  const nameIdx = header.findIndex((h) => /name/i.test(h))
  const regionIdx = header.findIndex((h) => /region/i.test(h))
  const sectorIdx = header.findIndex((h) => /sector|gics/i.test(h))

  if (symbolIdx < 0) {
    console.error('CSV must have "symbol" column')
    process.exit(1)
  }

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i])
    const symbol = (cells[symbolIdx] || '').trim()
    if (!symbol) continue
    rows.push({
      symbol,
      name: (cells[nameIdx] ?? '').trim() || symbol,
      region: (cells[regionIdx] ?? 'US').trim().toUpperCase().slice(0, 2) || 'US',
      sector: (cells[sectorIdx] ?? '').trim() || '未分類',
    })
  }

  const js = `/**
 * Stock list 400 - StockPage 전용 리스트
 * reports/stock_list_400.csv 에서 scripts/generate-stock-list-400.mjs 로 생성
 */
export const STOCK_LIST_400 = ${JSON.stringify(rows, null, 2)}

export const STOCK_LIST_400_SYMBOLS = new Set(STOCK_LIST_400.map((r) => r.symbol))

export const STOCK_LIST_400_BY_SYMBOL = new Map(STOCK_LIST_400.map((r) => [r.symbol, r]))
`

  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, js, 'utf8')
  console.log(`Wrote: ${outPath} (${rows.length} stocks)`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
