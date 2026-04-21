/**
 * stock_symbols.name を Marketstack API から 복원
 * name が null または symbol と 같은 행만 업데이트
 *
 * 실행: node scripts/backfill-stock-names-from-marketstack.mjs [--dry-run]
 * 필요: MARKETSTACK_ACCESS_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import fs from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const BATCH_SIZE = 20
const DELAY_MS = 350

const loadEnv = async () => {
  for (const f of ['.env.local', '.env']) {
    try {
      const raw = await fs.readFile(f, 'utf8')
      for (const line of raw.split(/\r?\n/)) {
        const t = line.trim()
        if (!t || t.startsWith('#') || !t.includes('=')) continue
        const eq = t.indexOf('=')
        const k = t.slice(0, eq).trim()
        const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
        if (k && !process.env[k]) process.env[k] = v
      }
    } catch {}
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const run = async () => {
  await loadEnv()
  const key = process.env.MARKETSTACK_ACCESS_KEY || process.env.MARKETSTACK_APIKEY
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const dryRun = process.argv.includes('--dry-run')

  if (!key || !url || !serviceKey) {
    throw new Error('Missing MARKETSTACK_ACCESS_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  }

  const supabase = createClient(url, serviceKey)

  // name が null または symbol と同じ行を取得
  const { data: rows, error: fetchErr } = await supabase
    .from('stock_symbols')
    .select('symbol,name')
  if (fetchErr) throw fetchErr

  const symbols = (rows || [])
    .filter((r) => r.symbol && (!r.name || r.name.trim() === r.symbol))
    .map((r) => r.symbol)
  if (symbols.length === 0) {
    console.log('No symbols to update (all have real names)')
    return
  }

  console.log(`Fetching names for ${symbols.length} symbols from Marketstack...`)

  const updates = []
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE)
    const encoded = encodeURIComponent(batch.join(','))
    const apiUrl = `https://api.marketstack.com/v2/eod/latest?access_key=${key}&symbols=${encoded}`
    const res = await fetch(apiUrl)
    const json = await res.json()
    const data = Array.isArray(json?.data) ? json.data : []

    for (const r of data) {
      const symbol = r?.symbol || r?.ticker
      const name = r?.name
      if (!symbol || !name || name === symbol) continue
      updates.push({ symbol, name })
    }

    process.stdout.write(`\r  ${Math.min(i + BATCH_SIZE, symbols.length)}/${symbols.length} (${updates.length} names)`)
    await sleep(DELAY_MS)
  }
  console.log('')

  if (updates.length === 0) {
    console.log('No valid names returned from Marketstack')
    return
  }

  if (dryRun) {
    console.log(`Dry run: would update ${updates.length} symbols`)
    console.log('Sample:', updates.slice(0, 5))
    return
  }

  let updated = 0
  for (const { symbol, name } of updates) {
    const { error } = await supabase
      .from('stock_symbols')
      .update({ name })
      .eq('symbol', symbol)
    if (!error) updated += 1
  }
  console.log(`Updated ${updated}/${updates.length} stock_symbols.name`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
