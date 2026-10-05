/**
 * Fill empty JST 05–22 community hours. Uses DB closes only.
 *   node scripts/backfill-community-hourly-gaps.mjs --dry-run
 *   node scripts/backfill-community-hourly-gaps.mjs --since 2026-09-13
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  COMMUNITY_HOURLY_JST_END,
  COMMUNITY_HOURLY_JST_START,
  ensureAllPersonas,
  runCommunityHourlySeed,
} from '../api/_lib/community-hourly-seed.js'

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
const sinceArg = process.argv.find((arg) => arg.startsWith('--since='))
const SINCE = sinceArg ? sinceArg.slice('--since='.length) : '2026-09-13'
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim()
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim()
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

function jstStamp(date) {
  const j = new Date(date.getTime() + 9 * 3600000)
  return { day: j.toISOString().slice(0, 10), hour: j.getUTCHours() }
}

async function coveredHours(sinceIso) {
  const hours = new Set()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from('lounge_posts')
      .select('created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .range(from, from + 999)
    if (error) throw error
    for (const row of data || []) {
      const stamp = jstStamp(new Date(row.created_at))
      hours.add(`${stamp.day}:${stamp.hour}`)
    }
    if (!data || data.length < 1000) break
  }
  return hours
}

function missingHours(covered) {
  const now = jstStamp(new Date())
  const missing = []
  const cursor = new Date(`${SINCE}T00:00:00+09:00`)
  for (;;) {
    const day = jstStamp(cursor).day
    if (day > now.day) break
    for (let hour = COMMUNITY_HOURLY_JST_START; hour <= COMMUNITY_HOURLY_JST_END; hour += 1) {
      if (day === now.day && hour > now.hour) continue
      const key = `${day}:${hour}`
      if (!covered.has(key)) missing.push(key)
    }
    cursor.setTime(cursor.getTime() + 24 * 3600000)
  }
  return missing
}

const covered = await coveredHours(new Date(`${SINCE}T00:00:00+09:00`).toISOString())
const missing = missingHours(covered)
console.log(JSON.stringify({ since: SINCE, dryRun: DRY_RUN, missing: missing.length, first: missing[0] || null, last: missing.at(-1) || null }))

if (missing.length === 0) process.exit(0)

const personaMap = DRY_RUN ? null : await ensureAllPersonas(admin)
let created = 0
let skipped = 0
for (const key of missing) {
  const [day, hourStr] = key.split(':')
  const now = new Date(`${day}T${hourStr.padStart(2, '0')}:10:00+09:00`)
  const result = await runCommunityHourlySeed(admin, { now, dryRun: DRY_RUN, personaMap })
  if (result.action === 'created_post') created += 1
  else skipped += 1
  if (created % 20 === 0 || skipped) {
    console.log(JSON.stringify({ key, action: result.action || result.reason || 'dry', title: result.draft?.title || result.title || null }))
  }
}
console.log(JSON.stringify({ created, skipped, missing: missing.length }))
