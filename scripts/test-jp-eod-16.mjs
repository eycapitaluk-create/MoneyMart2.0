#!/usr/bin/env node
/**
 * JP 주식 3월 16일 EOD 테스트 (eod/2026-03-16&exchange=XTKS)
 * 실행: node scripts/test-jp-eod-16.mjs
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

try {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch (_) {}

const KEY = process.env.MARKETSTACK_ACCESS_KEY || process.env.MARKETSTACK_APIKEY
if (!KEY) {
  console.error('MARKETSTACK_ACCESS_KEY 필요')
  process.exit(1)
}

const SYMBOLS = ['7203.T']
const TARGET_DATE = '2026-03-16'
const CHUNK_SIZE = 50

const chunk = (arr, size) => {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

console.log(`JP 주식 ${SYMBOLS.length}종목, ${TARGET_DATE} XTKS 호출 (${Math.ceil(SYMBOLS.length / CHUNK_SIZE)}청크)`)
console.log('')

const allRows = []
const chunks = chunk(SYMBOLS, CHUNK_SIZE)
for (let i = 0; i < chunks.length; i++) {
  const symbols = chunks[i]
  const url = `https://api.marketstack.com/v2/eod/${TARGET_DATE}?access_key=${encodeURIComponent(KEY)}&symbols=${encodeURIComponent(symbols.join(','))}&exchange=XTKS`
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) {
    console.error(`청크 ${i + 1} 에러:`, res.status, json?.error || json)
    continue
  }
  const rows = Array.isArray(json?.data) ? json.data : []
  allRows.push(...rows)
  console.log(`  청크 ${i + 1}/${chunks.length}: ${rows.length}건`)
  if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 500))
}

console.log('')
console.log(`총 응답: ${allRows.length}건`)
const withClose = allRows.filter((r) => (r.close ?? r.last ?? 0) > 0)
const withZero = allRows.filter((r) => (r.close ?? r.last ?? 0) === 0)
console.log(`  close>0: ${withClose.length}건`)
console.log(`  close=0: ${withZero.length}건`)
if (allRows.length > 0) {
  console.log('\nraw:', JSON.stringify(allRows[0], null, 2))
}
