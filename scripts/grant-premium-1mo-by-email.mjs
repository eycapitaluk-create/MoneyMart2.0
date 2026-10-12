/**
 * Grant 30-day Premium courtesy access by email.
 *
 *   node scripts/grant-premium-1mo-by-email.mjs create357@icloud.com
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
    if (process.env[key] == null || process.env[key] === '') process.env[key] = val
  }
}

loadEnvFile(path.join(ROOT, '.env.local'))
loadEnvFile(path.join(ROOT, '.env'))

const emailArg = String(process.argv[2] || '').trim().toLowerCase()
const DAYS = Number(process.env.MM_PREMIUM_GRANT_DAYS || 30)

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim()
const SERVICE_KEY = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '',
).trim()

if (!emailArg.includes('@')) {
  console.error('Usage: node scripts/grant-premium-1mo-by-email.mjs <email>')
  process.exit(1)
}
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function findUserByEmail(emailNorm) {
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = (data?.users || []).find((u) => String(u.email || '').trim().toLowerCase() === emailNorm)
    if (hit) return hit
    if ((data?.users || []).length < 200) break
    page += 1
  }
  return null
}

const user = await findUserByEmail(emailArg)
if (!user) {
  console.error(`No auth user: ${emailArg}`)
  process.exit(1)
}

const premiumUntil = new Date(Date.now() + DAYS * 24 * 60 * 60 * 1000).toISOString()

const { data: existing } = await admin
  .from('user_profiles')
  .select('premium_until')
  .eq('user_id', user.id)
  .maybeSingle()

const existingUntil = existing?.premium_until ? new Date(existing.premium_until).getTime() : 0
const newUntil = new Date(premiumUntil).getTime()
const finalUntil = new Date(Math.max(existingUntil, newUntil)).toISOString()

const meta = user.user_metadata || {}
const { error } = await admin.from('user_profiles').upsert(
  {
    user_id: user.id,
    full_name: String(meta.full_name || meta.display_name || '').trim(),
    nickname: String(meta.nickname || '').trim(),
    is_premium: true,
    plan_tier: 'premium',
    subscription_tier: 'premium',
    premium_until: finalUntil,
  },
  { onConflict: 'user_id' },
)
if (error) throw error

console.log(`ok Premium ${DAYS}d: ${emailArg}`)
console.log(`  user_id=${user.id}`)
console.log(`  premium_until=${finalUntil}`)
