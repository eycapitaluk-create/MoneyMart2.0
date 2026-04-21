#!/usr/bin/env node
/**
 * CSV → MarketStack 검증 → stockList400.js 병합
 * utn worktree 기준 - 반드시 utn 디렉토리에서 실행
 * MARKETSTACK_ACCESS_KEY 필요. --dry-run: 검증/쓰기 생략
 */
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const DRY_RUN = process.argv.includes('--dry-run')
const JP_CSV = args[0] || path.join(process.env.HOME || '', 'Downloads', 'jp_prices_final.csv')
const US_CSV = args[1] || path.join(process.env.HOME || '', 'Downloads', 'us_prices_final.csv')
const MARKETSTACK_KEY = process.env.MARKETSTACK_ACCESS_KEY || process.env.MARKETSTACK_APIKEY
const BATCH_SIZE = 20
const DELAY_MS = 250

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function extractSymbols(csvPath) {
  const raw = fsSync.readFileSync(csvPath, 'utf8')
  const firstLine = raw.split(/\r?\n/)[0]
  const cols = firstLine.split(',')
  const symbols = cols.slice(1).map((s) => s.trim().replace(/\.\d+$/, '')).filter((s) => s && s !== 'Date')
  return [...new Set(symbols)]
}

async function validateWithMarketStack(symbols) {
  if (!MARKETSTACK_KEY) {
    if (DRY_RUN) return new Set(symbols)
    console.error('MARKETSTACK_ACCESS_KEY required.')
    process.exit(1)
  }
  const supported = new Set()
  const batches = []
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) batches.push(symbols.slice(i, i + BATCH_SIZE))
  console.log('Validating', symbols.length, 'symbols...')
  for (let i = 0; i < batches.length; i++) {
    const res = await fetch('https://api.marketstack.com/v2/eod/latest?access_key=' + encodeURIComponent(MARKETSTACK_KEY) + '&symbols=' + encodeURIComponent(batches[i].join(',')))
    const json = await res.json()
    const data = Array.isArray(json?.data) ? json.data : []
    for (const row of data) { const s = row?.symbol || row?.ticker; if (s) supported.add(s) }
    process.stdout.write('\r  ' + (i+1) + '/' + batches.length + ', ' + supported.size + ' supported')
    await sleep(DELAY_MS)
  }
  console.log('')
  return supported
}

async function run() {
  const jpRaw = await fs.readFile(JP_CSV, 'utf8').catch(() => '')
  const usRaw = await fs.readFile(US_CSV, 'utf8').catch(() => '')
  if (!jpRaw || !usRaw) { console.error('Cannot read CSV'); process.exit(1) }

  const jpSymbols = extractSymbols(JP_CSV)
  const usSymbols = extractSymbols(US_CSV)
  const allNew = [...jpSymbols.map((s) => ({ symbol: s, region: 'JP' })), ...usSymbols.map((s) => ({ symbol: s, region: 'US' }))]
  const unique = []; const seen = new Set()
  for (const x of allNew) { if (seen.has(x.symbol)) continue; seen.add(x.symbol); unique.push(x) }
  console.log('JP:', jpSymbols.length, 'US:', usSymbols.length, 'unique:', unique.length)

  const supported = await validateWithMarketStack(unique.map((x) => x.symbol))
  const filtered = unique.filter((x) => supported.has(x.symbol))
  if (unique.length - filtered.length > 0) console.log('Dropped', unique.length - filtered.length, 'not in MarketStack')

  const stockListPath = path.resolve('src/data/stockList400.js')
  let existing = []
  try {
    const content = await fs.readFile(stockListPath, 'utf8')
    const match = content.match(/export const STOCK_LIST_400 = (\[[\s\S]*?\])\s*(?=export|$)/m)
    if (match) existing = JSON.parse(match[1])
  } catch (_) {}

  const existingBySymbol = new Map(existing.map((r) => [r.symbol, r]))
  const merged = []; const mergedSeen = new Set()
  for (const row of existing) { if (mergedSeen.has(row.symbol)) continue; mergedSeen.add(row.symbol); merged.push(row) }
  for (const { symbol, region } of filtered) {
    if (mergedSeen.has(symbol)) continue
    mergedSeen.add(symbol)
    const prev = existingBySymbol.get(symbol)
    merged.push({ symbol, name: prev?.name || symbol, region, index_tag: prev?.index_tag || (region === 'JP' ? 'NIKKEI225' : 'SP500'), market_cap: prev?.market_cap ?? 0, sector: prev?.sector || '未分類' })
  }

  const js = 'export const STOCK_LIST_400 = ' + JSON.stringify(merged, null, 2) + '\nexport const STOCK_LIST_400_SYMBOLS = new Set(STOCK_LIST_400.map((r) => r.symbol))\nexport const STOCK_LIST_400_BY_SYMBOL = new Map(STOCK_LIST_400.map((r) => [r.symbol, r]))\n'
  if (DRY_RUN) { console.log('DRY RUN: Would write', merged.length, 'stocks'); return }
  await fs.writeFile(stockListPath, js, 'utf8')
  console.log('Wrote', stockListPath, ':', merged.length, 'stocks')
}

run().catch((e) => { console.error(e); process.exit(1) })
