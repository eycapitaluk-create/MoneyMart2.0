import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const readRepoFile = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('admin basic auth only accepts the exact session cookie', async () => {
  const source = await readRepoFile('api/admin/basic-auth.js')
  assert.match(source, /name === 'mm_admin_basic' && value === '1'/)
  assert.doesNotMatch(source, /\.includes\('mm_admin_basic=1'\)/)
})

test('cron auth fails closed when CRON_SECRET is missing', async () => {
  const source = await readRepoFile('api/cron/ai-news-summarize.js')
  assert.match(source, /CRON_SECRET is required/)
  assert.match(source, /const cronSecret = String\(process\.env\.CRON_SECRET \|\| ''\)\.trim\(\)/)
  assert.doesNotMatch(source, /Bearer \$\{process\.env\.CRON_SECRET\}/)
})

test('generated manual news buckets insert replacements before deleting old rows', async () => {
  const marketNews = await readRepoFile('api/_lib/refresh-market-news.js')
  assert.ok(marketNews.indexOf(".insert(rows)") < marketNews.indexOf(".delete()"))
  assert.match(marketNews, /\.lt\('updated_at', batchUpdatedAt\)/)

  const loungeDigest = await readRepoFile('api/cron/lounge-digest.js')
  assert.ok(loungeDigest.indexOf(".insert(rows)") < loungeDigest.indexOf(".delete()"))
  assert.match(loungeDigest, /\.lt\('updated_at', nowIso\)/)
})

test('ai news replacement keeps old active rows until insert succeeds', async () => {
  const source = await readRepoFile('api/cron/ai-news.js')
  assert.ok(
    source.indexOf(".insert(rowsToInsert)") < source.indexOf(".update({ is_active: false })"),
  )
  assert.match(source, /updated_at: batchUpdatedAt/)
  assert.match(source, /\.lt\('updated_at', batchUpdatedAt\)/)
})

test('premium access does not trust client-writable metadata aliases', async () => {
  const membership = await readRepoFile('src/lib/membership.js')
  const paidHelper = membership.slice(
    membership.indexOf('export function isPaidFromUserProfileRow'),
    membership.indexOf('export function canAddDistinctOwnedStock'),
  )
  assert.match(paidHelper, /profile\.is_premium === true/)
  assert.match(paidHelper, /profile\.subscription_tier/)
  assert.doesNotMatch(paidHelper, /plan_tier|membership_tier|prime_member|is_prime|profile\.plan/)

  const app = await readRepoFile('src/App.jsx')
  assert.doesNotMatch(app, /user_metadata\?\.(plan_tier|membership_tier)/)

  const fundPage = await readRepoFile('src/pages/FundPage.jsx')
  assert.doesNotMatch(fundPage, /user_metadata\?\.(plan_tier|membership_tier)/)

  const comparePage = await readRepoFile('src/pages/FundComparePage.jsx')
  assert.doesNotMatch(comparePage, /user_metadata\?\.(plan_tier|membership_tier)/)
})

test('portfolio diagnosis enforces premium entitlement server side', async () => {
  const source = await readRepoFile('api/portfolio-diagnosis.js')
  assert.match(source, /\.select\('is_premium,subscription_tier'\)/)
  assert.match(source, /isPaidFromUserProfileRow\(profile\)/)
  assert.match(source, /sendJson\(res, 403/)
})

test('profile display names and storage policies are narrowly scoped', async () => {
  const loungeDisplaySql = await readRepoFile('SUPABASE_FIX_LOUNGE_DISPLAY.sql')
  assert.match(loungeDisplaySql, /drop policy if exists "user_profiles_public_read_display"/)
  assert.match(loungeDisplaySql, /get_user_profile_display_names/)
  assert.doesNotMatch(loungeDisplaySql, /using \(true\);/)

  const premiumSql = await readRepoFile('SUPABASE_ADD_PREMIUM_SUBSCRIPTION.sql')
  assert.match(premiumSql, /revoke select, insert, update on public\.user_profiles from anon, authenticated/)
  assert.match(premiumSql, /'is_premium',\s+'subscription_tier'/)

  const loungeImagesSql = await readRepoFile('SUPABASE_ADD_LOUNGE_IMAGES.sql')
  assert.match(loungeImagesSql, /\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/)

  const newsImagesSql = await readRepoFile('SUPABASE_SETUP_NEWS_IMAGES_STORAGE.sql')
  assert.match(newsImagesSql, /ur\.role = 'admin'/)
  assert.doesNotMatch(newsImagesSql, /with check \(bucket_id = 'news-images'\);/)
})
