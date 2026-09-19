/**
 * CP2026 SNS campaign verification (window, API, DB).
 * Usage: node scripts/verify-cp2026-campaign-e2e.mjs
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import handler from '../api/campaign/cp2026-sns-sep.js'
import {
  getCampaignWindowMeta,
  parseSnsSubmission,
  userHasCampaignAsset,
} from '../api/_lib/campaign-cp2026-sns-sep.js'
import { CAMPAIGN_CP2026_SNS_SEP_ID } from '../src/constants/campaignCp2026SnsSep.js'

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

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
const ANON_KEY = String(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim()
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim()
const TEST_EMAIL = String(process.env.MM_TEST_USER_EMAIL || 'test@moneymart.co.jp').trim().toLowerCase()
const TEST_PASSWORD = String(process.env.MM_TEST_USER_PASSWORD || 'Mmtest123456')

const results = []
const pass = (name, detail = '') => results.push({ ok: true, name, detail })
const fail = (name, detail = '') => results.push({ ok: false, name, detail })

function createMockReq({ method = 'GET', body = null, token = '' } = {}) {
  const payload = body != null ? JSON.stringify(body) : ''
  return {
    method,
    headers: {
      authorization: token ? `Bearer ${token}` : '',
      'content-type': 'application/json',
    },
    on(event, fn) {
      if (event === 'data' && payload) {
        process.nextTick(() => fn(payload))
      }
      if (event === 'end') {
        process.nextTick(() => fn())
      }
    },
  }
}

function createMockRes() {
  const state = { statusCode: 200, body: '', headers: {} }
  return {
    get statusCode() { return state.statusCode },
    set statusCode(v) { state.statusCode = v },
    setHeader(k, v) { state.headers[k] = v },
    end(data) { state.body = data || '' },
    get json() {
      try { return JSON.parse(state.body || '{}') } catch { return { raw: state.body } }
    },
    get status() { return state.statusCode },
  }
}

async function callHandler({ method, body, token }) {
  const req = createMockReq({ method, body, token })
  const res = createMockRes()
  await handler(req, res)
  return { status: res.status, json: res.json }
}

async function ensureTestUser(admin) {
  const { data: created, error } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: 'Campaign QA' },
  })
  if (!error && created?.user?.id) return created.user.id

  const msg = String(error?.message || '')
  const exists = error?.code === 'email_exists' || /already registered|duplicate/i.test(msg)
  if (!exists) throw error || new Error('createUser failed')

  let page = 1
  for (;;) {
    const { data, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (listErr) throw listErr
    const hit = data.users.find((u) => String(u.email || '').toLowerCase() === TEST_EMAIL)
    if (hit) {
      await admin.auth.admin.updateUserById(hit.id, { password: TEST_PASSWORD, email_confirm: true })
      return hit.id
    }
    if (!data.users?.length || data.users.length < 200) break
    page += 1
  }
  throw new Error(`Test user not found: ${TEST_EMAIL}`)
}

async function signIn() {
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
  const { data, error } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  })
  if (error) throw error
  return data.session.access_token
}

async function main() {
  console.log('=== CP2026 SNS Campaign E2E Verification ===\n')

  // 1) Static assets
  const popupPath = path.join(ROOT, 'public/banners/campaign-cp2026-sns-sep-home-popup.png')
  if (fs.existsSync(popupPath) && fs.statSync(popupPath).size > 10_000) {
    pass('Home popup image', `${(fs.statSync(popupPath).size / 1024).toFixed(0)} KB`)
  } else {
    fail('Home popup image', 'missing or too small')
  }

  // 2) Window dates (ignore preview flag for boundary checks)
  const savedPreview = process.env.CAMPAIGN_CP2026_SNS_PREVIEW
  delete process.env.CAMPAIGN_CP2026_SNS_PREVIEW
  const before = getCampaignWindowMeta(new Date('2026-08-31T14:59:59Z'), 'user@example.com')
  const start = getCampaignWindowMeta(new Date('2026-08-31T15:00:00Z'), 'user@example.com')
  const mid = getCampaignWindowMeta(new Date('2026-09-15T12:00:00Z'), 'user@example.com')
  const after = getCampaignWindowMeta(new Date('2026-09-30T15:00:00Z'), 'user@example.com')
  const staff = getCampaignWindowMeta(new Date('2026-07-25T00:00:00Z'), 'justin.nam@moneymart.co.jp')
  if (savedPreview == null) delete process.env.CAMPAIGN_CP2026_SNS_PREVIEW
  else process.env.CAMPAIGN_CP2026_SNS_PREVIEW = savedPreview

  if (!before.active && !before.inWindow) pass('Window: before Sep 1')
  else fail('Window: before Sep 1', JSON.stringify(before))
  if (start.active && start.inWindow) pass('Window: Sep 1 start')
  else fail('Window: Sep 1 start', JSON.stringify(start))
  if (mid.active && mid.inWindow) pass('Window: mid September')
  else fail('Window: mid September', JSON.stringify(mid))
  if (!after.active && !after.inWindow) pass('Window: after Sep 30')
  else fail('Window: after Sep 30', JSON.stringify(after))
  if (staff.active && staff.staffTest) pass('Staff tester bypass (justin)')
  else fail('Staff tester bypass', JSON.stringify(staff))

  // 3) SNS URL parsing
  const snsCases = [
    ['https://x.com/u/status/1', true],
    ['https://note.com/u/n/nabc', true],
    ['https://instagram.com/p/x', false],
  ]
  for (const [url, shouldPass] of snsCases) {
    try {
      parseSnsSubmission({ sns_url: url, sns_platform: 'twitter' })
      if (shouldPass) pass(`SNS URL OK: ${url}`)
      else fail(`SNS URL should reject: ${url}`)
    } catch (e) {
      if (!shouldPass) pass(`SNS URL rejected: ${url}`)
      else fail(`SNS URL should accept: ${url}`, e.message)
    }
  }

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    fail('Supabase env', 'missing URL/keys — skipping live API tests')
    printResults()
    process.exit(1)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  let userId
  let token
  try {
    userId = await ensureTestUser(admin)
    token = await signIn()
    pass('Auth: test user sign-in', TEST_EMAIL)
  } catch (e) {
    fail('Auth: test user sign-in', e.message)
    printResults()
    process.exit(1)
  }

  // Outside window without preview → 403
  const prevPreview = process.env.CAMPAIGN_CP2026_SNS_PREVIEW
  delete process.env.CAMPAIGN_CP2026_SNS_PREVIEW
  const blocked = await callHandler({ method: 'GET', token })
  if (blocked.status === 403) pass('API GET blocked outside window (non-staff)')
  else fail('API GET should 403 outside window', `status=${blocked.status}`)

  // Preview mode → full flow
  process.env.CAMPAIGN_CP2026_SNS_PREVIEW = 'true'
  const statusRes = await callHandler({ method: 'GET', token })
  if (statusRes.status === 200 && statusRes.json?.window?.active) {
    pass('API GET status (preview)', `steps=${JSON.stringify(statusRes.json.steps)}`)
  } else {
    fail('API GET status (preview)', `status=${statusRes.status} ${JSON.stringify(statusRes.json)}`)
  }

  // Ensure watchlist asset for apply
  const { data: existingWl } = await admin
    .from('user_watchlists')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
  let tempWatchId = null
  if (!existingWl?.length) {
    const { data: ins, error: wlErr } = await admin.from('user_watchlists').insert({
      user_id: userId,
      item_type: 'stock',
      item_id: 'AAPL',
      item_name: 'AAPL',
      metadata: {},
    }).select('id').single()
    if (wlErr) fail('Seed watchlist for asset check', wlErr.message)
    else {
      tempWatchId = ins.id
      pass('Seed watchlist for asset check', 'AAPL')
    }
  } else {
    pass('User already has asset', existingWl[0].id)
  }

  const hasAsset = await userHasCampaignAsset(admin, userId)
  if (hasAsset) pass('userHasCampaignAsset')
  else fail('userHasCampaignAsset', 'expected true')

  const surveyRes = await callHandler({
    method: 'POST',
    token,
    body: {
      action: 'survey',
      answers: {
        discovery: 'search',
        manage_how: ['broker_app'],
        pain_points: ['overview'],
        usage_freq: 'weekly_1_2',
        usability: 'agree',
        features_used: ['compare'],
        features_improve: ['community'],
        nps: 'likely',
        nps_reason: 'E2E verify script — useful portfolio view',
        premium_interest: 'definitely',
        gender: 'male',
        age_band: '30_39',
        invest_exp: '3_5y',
        asset_types: ['stocks'],
        decision_factor: 'growth',
      },
    },
  })
  if (surveyRes.status === 200 && surveyRes.json?.steps?.surveyDone) {
    pass('API POST survey')
  } else {
    fail('API POST survey', `${surveyRes.status} ${JSON.stringify(surveyRes.json)}`)
  }

  const snsRes = await callHandler({
    method: 'POST',
    token,
    body: {
      action: 'sns',
      sns_url: 'https://x.com/moneymart_verify/status/1999999999999999999',
      sns_platform: 'twitter',
    },
  })
  if (snsRes.status === 200 && snsRes.json?.steps?.snsDone) {
    pass('API POST sns URL')
  } else {
    fail('API POST sns URL', `${snsRes.status} ${JSON.stringify(snsRes.json)}`)
  }

  const applyRes = await callHandler({ method: 'POST', token, body: { action: 'apply' } })
  if (applyRes.status === 200 && (applyRes.json?.steps?.applied || applyRes.json?.entry?.status === 'eligible')) {
    pass('API POST apply', applyRes.json?.message || 'eligible')
  } else {
    fail('API POST apply', `${applyRes.status} ${JSON.stringify(applyRes.json)}`)
  }

  // DB row check
  const { data: entry, error: entryErr } = await admin
    .from('campaign_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('campaign_id', CAMPAIGN_CP2026_SNS_SEP_ID)
    .maybeSingle()
  if (entryErr) fail('DB campaign_entries', entryErr.message)
  else if (entry?.survey_completed_at && entry?.sns_url && entry?.applied_at) {
    pass('DB campaign_entries row', `status=${entry.status}`)
  } else {
    fail('DB campaign_entries row', JSON.stringify(entry))
  }

  // Cleanup temp watchlist only
  if (tempWatchId) {
    await admin.from('user_watchlists').delete().eq('id', tempWatchId)
    pass('Cleanup temp watchlist')
  }

  if (prevPreview == null) delete process.env.CAMPAIGN_CP2026_SNS_PREVIEW
  else process.env.CAMPAIGN_CP2026_SNS_PREVIEW = prevPreview

  printResults()
  const failed = results.filter((r) => !r.ok).length
  process.exit(failed > 0 ? 1 : 0)
}

function printResults() {
  console.log('\n--- Results ---')
  for (const r of results) {
    const mark = r.ok ? '✓' : '✗'
    console.log(`${mark} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
  }
  const ok = results.filter((r) => r.ok).length
  console.log(`\n${ok}/${results.length} passed`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
