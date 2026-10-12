/**
 * Dev/staging: create or reset Supabase Auth user for MoneyMart QA login.
 *
 * Default account (override with env):
 *   MM_TEST_USER_EMAIL=test@moneymart.co.jp
 *   MM_TEST_USER_PASSWORD=Mmtest123456
 * （Supabase の「最低 8 文字」ポリシーで 123456 が拒否されることがあるため、既定は 8 文字以上）
 *
 * Usage (env from .env.local 등):
 *   node scripts/create-test-auth-user.mjs
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY
 */
import { createClient } from '@supabase/supabase-js'

const EMAIL = String(process.env.MM_TEST_USER_EMAIL || 'test@moneymart.co.jp').trim().toLowerCase()
const PASSWORD = String(process.env.MM_TEST_USER_PASSWORD || 'Mmtest123456')
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim()
const SERVICE_KEY = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '',
).trim()

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY).')
  process.exit(1)
}

if (!EMAIL.includes('@')) {
  console.error('Invalid MM_TEST_USER_EMAIL:', EMAIL)
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function findUserIdByEmail(emailNorm) {
  let page = 1
  const perPage = 200
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const hit = data.users.find((u) => String(u.email || '').toLowerCase() === emailNorm)
    if (hit) return hit.id
    if (!data.users?.length || data.users.length < perPage) return null
    page += 1
  }
}

try {
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'MoneyMart Test', display_name: 'Test' },
  })

  if (!createErr && created?.user?.id) {
    console.log(`Created user ${EMAIL} (${created.user.id}).`)
    process.exit(0)
  }

  const msg = String(createErr?.message || '')
  const exists =
    createErr?.code === 'email_exists'
    || createErr?.status === 422
    || /already registered|already been registered|duplicate/i.test(msg)

  if (!exists) {
    console.error('createUser failed:', createErr)
    process.exit(1)
  }

  const userId = await findUserIdByEmail(EMAIL)
  if (!userId) {
    console.error('User exists but could not resolve id for', EMAIL)
    process.exit(1)
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
    password: PASSWORD,
    email_confirm: true,
  })

  if (updErr) {
    console.error('updateUserById failed:', updErr)
    process.exit(1)
  }

  console.log(`Updated password & confirmed email for existing user ${EMAIL} (${userId}).`)
  process.exit(0)
} catch (e) {
  console.error(e)
  process.exit(1)
}
