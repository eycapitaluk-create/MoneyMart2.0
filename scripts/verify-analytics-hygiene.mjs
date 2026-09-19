/**
 * Verify the analytics hygiene patch and size its impact.
 *
 *   node scripts/verify-analytics-hygiene.mjs
 *
 * Reports what SUPABASE_PATCH_ANALYTICS_EXCLUDE_DEV_AND_BOT_TRAFFIC.sql removes
 * from customer analytics, and how session / page-view totals shift because of it.
 * Read-only.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

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
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvFile(path.join(ROOT, '.env.local'))
loadEnvFile(path.join(ROOT, '.env'))

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false } })
const DAYS = 30
const since = new Date(Date.now() - DAYS * 86400_000).toISOString()
const int = (v) => Number(v || 0).toLocaleString('en-US')

const countRows = async (table, build = (q) => q) => {
  const { count, error } = await build(
    db.from(table).select('*', { count: 'exact', head: true }).gte('created_at', since),
  )
  if (error) throw new Error(`${table}: ${error.message}`)
  return Number(count || 0)
}

const distinctSessions = async (table) => {
  const seen = new Set()
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from(table)
      .select('session_id')
      .gte('created_at', since)
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) break
    for (const r of data) if (r.session_id) seen.add(r.session_id)
    if (data.length < pageSize) break
  }
  return seen.size
}

async function main() {
  console.log(`\nAnalytics hygiene check — last ${DAYS} days\n${'='.repeat(46)}\n`)

  const { data: audit, error: auditErr } = await db.from('v_mm_traffic_exclusion_audit').select('*')
  if (auditErr) {
    console.error('Audit view unavailable — is the patch applied?')
    console.error(`  ${auditErr.message}`)
    process.exit(1)
  }

  console.log('Removed from customer analytics:')
  console.log(`  ${'reason'.padEnd(18)} ${'sessions'.padStart(9)} ${'page views'.padStart(11)}`)
  for (const row of audit || []) {
    console.log(`  ${String(row.reason).padEnd(18)} ${int(row.sessions).padStart(9)} ${int(row.page_views).padStart(11)}`)
  }

  const { data: candidates, error: candErr } = await db
    .from('v_mm_bot_session_candidates')
    .select('*')
    .order('page_views', { ascending: false })
    .limit(20)
  if (candErr) throw candErr

  console.log(`\nBot-like session candidates: ${candidates?.length || 0}`)
  for (const c of candidates || []) {
    console.log(
      `  ${String(c.referrer_domain).padEnd(24)} ${int(c.page_views).padStart(6)} views`
      + ` · ${int(c.distinct_paths).padStart(4)} paths · ${c.interaction_events} interactions`,
    )
  }

  const { data: staff, error: staffErr } = await db
    .from('v_mm_staff_session_candidates')
    .select('*')
    .order('page_views', { ascending: false })
    .limit(20)
  if (staffErr) throw staffErr

  console.log(`\nStaff session candidates: ${staff?.length || 0}`)
  for (const s of staff || []) {
    const days = (new Date(s.last_at) - new Date(s.first_at)) / 86400_000
    console.log(
      `  ${int(s.page_views).padStart(6)} views · ${int(s.admin_views).padStart(4)} admin`
      + ` · ${String(s.interaction_events).padStart(4)} interactions · spans ${days.toFixed(1)}d`,
    )
  }

  const { count: registered } = await db
    .from('mm_excluded_sessions')
    .select('*', { count: 'exact', head: true })
  console.log(`\nRegistered in mm_excluded_sessions: ${int(registered)}`)
  const pending = (candidates?.length || 0) + (staff?.length || 0)
  if (Number(registered || 0) < pending) {
    console.log('  -> unregistered candidates remain. Run: select public.mm_refresh_excluded_sessions();')
  }

  const rawEvents = await countRows('site_analytics_events')
  const cleanEvents = await countRows('v_customer_site_analytics_events')
  const rawSessions = await distinctSessions('site_analytics_events')
  const cleanSessions = await distinctSessions('v_customer_site_analytics_events')
  const drop = (a, b) => (a > 0 ? `${(((a - b) / a) * 100).toFixed(1)}%` : '—')

  console.log(`\nImpact on reported totals:\n${'-'.repeat(46)}`)
  console.log(`  ${'metric'.padEnd(12)} ${'raw'.padStart(9)} ${'clean'.padStart(9)} ${'removed'.padStart(9)}`)
  console.log(`  ${'events'.padEnd(12)} ${int(rawEvents).padStart(9)} ${int(cleanEvents).padStart(9)} ${drop(rawEvents, cleanEvents).padStart(9)}`)
  console.log(`  ${'sessions'.padEnd(12)} ${int(rawSessions).padStart(9)} ${int(cleanSessions).padStart(9)} ${drop(rawSessions, cleanSessions).padStart(9)}`)
  console.log('')
}

main().catch((err) => {
  console.error(`\nFailed: ${err.message}\n`)
  process.exit(1)
})
