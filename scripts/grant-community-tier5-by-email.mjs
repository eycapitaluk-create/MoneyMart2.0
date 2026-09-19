/**
 * Grant community badge LV5 (Core, 6000+ EXP) for staff emails.
 *
 *   node scripts/grant-community-tier5-by-email.mjs
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY
 *           (reads .env.local from repo root when unset)
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"'))
      || (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = val
    }
  }
}

loadEnvFile(path.join(ROOT, '.env.local'))
loadEnvFile(path.join(ROOT, '.env'))

const TIER5_MIN_EXP = 6000
const STAFF_EMAILS = [
  'justin.nam@moneymart.co.jp',
  'kelly.nam@moneymart.co.jp',
]

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim()
const SERVICE_KEY = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '',
).trim()

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY).')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function findUserIdByEmail(emailNorm) {
  let page = 1
  const perPage = 200
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const users = data?.users || []
    const hit = users.find((u) => String(u.email || '').trim().toLowerCase() === emailNorm)
    if (hit) return hit.id
    if (users.length < perPage) break
    page += 1
  }
  return null
}

async function grantTier5(email) {
  const emailNorm = String(email).trim().toLowerCase()
  const userId = await findUserIdByEmail(emailNorm)
  if (!userId) {
    console.warn(`skip (no auth user): ${emailNorm}`)
    return false
  }

  const { data: existing, error: readErr } = await admin
    .from('lounge_character_stats')
    .select('total_exp')
    .eq('user_id', userId)
    .maybeSingle()
  if (readErr) throw readErr

  const totalExp = Math.max(TIER5_MIN_EXP, Number(existing?.total_exp) || 0)
  const { error } = await admin.from('lounge_character_stats').upsert(
    {
      user_id: userId,
      total_exp: totalExp,
      level: 5,
      character_stage: 5,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error

  console.log(`ok LV5: ${emailNorm} (user_id=${userId}, total_exp=${totalExp})`)
  return true
}

let ok = 0
for (const email of STAFF_EMAILS) {
  if (await grantTier5(email)) ok += 1
}
console.log(`done: ${ok}/${STAFF_EMAILS.length} updated`)
