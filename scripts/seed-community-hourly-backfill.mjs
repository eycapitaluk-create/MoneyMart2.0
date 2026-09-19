/**
 * Backfill empty JST hour buckets (05–22) using hourly seed logic + real DB prices.
 *
 *   node scripts/seed-community-hourly-backfill.mjs
 *   node scripts/seed-community-hourly-backfill.mjs --from 2026-07-26 --to 2026-07-27
 *   node scripts/seed-community-hourly-backfill.mjs --dry-run
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCommunityHourlySeed } from '../api/_lib/community-hourly-seed.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[key] == null || process.env[key] === '') process.env[key] = val
  }
}

loadEnvFile(path.resolve(__dirname, '..', '.env.local'))
loadEnvFile(path.resolve(__dirname, '..', '.env'))

const DRY_RUN = process.argv.includes('--dry-run')
const fromIdx = process.argv.indexOf('--from')
const toIdx = process.argv.indexOf('--to')
const FROM_DAY = fromIdx >= 0 ? process.argv[fromIdx + 1] : '2026-07-26'
const TO_DAY = toIdx >= 0 ? process.argv[toIdx + 1] : '2026-07-27'

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim()
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim()

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

function* iterDays(fromDay, toDay) {
  const start = new Date(`${fromDay}T12:00:00+09:00`)
  const end = new Date(`${toDay}T12:00:00+09:00`)
  for (let t = start.getTime(); t <= end.getTime(); t += 24 * 3600000) {
    const jst = new Date(t + 9 * 3600000)
    yield jst.toISOString().slice(0, 10)
  }
}

async function main() {
  const results = []
  const nowReal = new Date()

  for (const day of iterDays(FROM_DAY, TO_DAY)) {
    for (let hour = 5; hour <= 22; hour += 1) {
      const slot = new Date(`${day}T${String(hour).padStart(2, '0')}:30:00+09:00`)
      if (slot.getTime() > nowReal.getTime() + 5 * 60 * 1000) continue

      const result = await runCommunityHourlySeed(admin, { now: slot, dryRun: DRY_RUN })
      results.push({ day, hour, ...result })
      const label = `${day} ${hour}時`
      if (result.skipped) {
        console.log(`skip ${label}: ${result.reason}`)
      } else if (result.dryRun) {
        console.log(`dry ${label}: hasPost=${result.hourHasPost} title=${result.draft?.title?.slice(0, 48) || '-'}`)
      } else {
        console.log(`ok   ${label}: ${result.action} post=${result.postId || '-'} likes+${result.addedLikes ?? result.likes ?? 0}`)
      }
    }
  }

  const created = results.filter((r) => r.action === 'created_post').length
  const enriched = results.filter((r) => r.action === 'enriched_existing').length
  const skipped = results.filter((r) => r.skipped).length
  console.log(`\nDone. created=${created} enriched=${enriched} skipped=${skipped} total=${results.length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
