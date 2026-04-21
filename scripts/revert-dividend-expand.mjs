#!/usr/bin/env node
/**
 * Revert dividendStockUniverse to original 260 stocks.
 * Removes fake data (456 added + 1489) and dividendAmountPerShare.
 */
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import { pathToFileURL } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const divPath = path.join(root, 'src/data/dividendStockUniverse.js')

const divUrl = pathToFileURL(divPath).href
const { DIVIDEND_STOCK_UNIVERSE } = await import(divUrl)

// Keep only original 260, remove dividendAmountPerShare
const original = DIVIDEND_STOCK_UNIVERSE.slice(0, 260).map((r) => {
  const { dividendAmountPerShare, ...rest } = r
  return { ...rest, region: rest.region || '' }
})

const arrContent = 'export const DIVIDEND_STOCK_UNIVERSE = [\n' +
  original.map((r) => {
    const lines = [
      `  {`,
      `    "symbol": ${JSON.stringify(r.symbol)},`,
      `    "name": ${JSON.stringify(r.name)},`,
      `    "region": ${JSON.stringify(r.region || '')},`,
      `    "sector": ${JSON.stringify(r.sector)},`,
      `    "indexTag": ${JSON.stringify(r.indexTag)},`,
      `    "dividendMonths": ${JSON.stringify(r.dividendMonths || [])}`,
    ]
    lines.push(`  }`)
    return lines.join('\n')
  }).join(',\n') +
  '\n]'

const divContent = readFileSync(divPath, 'utf8')
const rest = divContent.replace(/export const DIVIDEND_STOCK_UNIVERSE = \[[\s\S]*\n\]\n\nconst normalizeLookupSymbol/, arrContent + '\n\nconst normalizeLookupSymbol')
writeFileSync(divPath, rest, 'utf8')

console.log('Reverted to 260 original stocks. Removed dividendAmountPerShare and 457 fake entries.')
