import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf8')

test('lounge profile display uses a narrow RPC instead of broad user_profiles reads', () => {
  const sql = read('SUPABASE_FIX_LOUNGE_DISPLAY.sql')
  const client = read('src/lib/loungeApi.js')

  assert.match(sql, /drop policy if exists "user_profiles_public_read_display"/)
  assert.doesNotMatch(sql, /create policy "user_profiles_public_read_display"/)
  assert.match(sql, /create or replace function public\.get_user_profile_display_names/)
  assert.match(sql, /returns table \(\s*user_id uuid,\s*display_name text\s*\)/)
  assert.match(sql, /grant execute on function public\.get_user_profile_display_names\(uuid\[\]\) to authenticated/)
  assert.match(client, /\.rpc\('get_user_profile_display_names', \{ user_ids: ids \}\)/)
  assert.doesNotMatch(client, /\.from\('user_profiles'\)\s*\n\s*\.select\('user_id,nickname,full_name'\)/)
})

test('user profile entitlement and billing columns are protected from owner writes', () => {
  const sql = read('SUPABASE_ADD_PREMIUM_SUBSCRIPTION.sql')

  assert.match(sql, /create or replace function public\.prevent_user_profile_entitlement_mutation/)
  assert.match(sql, /drop trigger if exists trg_prevent_user_profile_entitlement_mutation/)
  assert.match(sql, /before insert or update on public\.user_profiles/)
  for (const column of [
    'is_premium',
    'subscription_tier',
    'stripe_customer_id',
    'stripe_subscription_id',
    'plan_tier',
    'membership_tier',
  ]) {
    assert.match(sql, new RegExp(`'${column}'`))
  }
  assert.match(sql, /auth\.role\(\) = 'service_role'/)
  assert.match(sql, /ur\.role = 'admin'/)
})

test('storage write policies are scoped to owners or admins', () => {
  const loungeSql = read('SUPABASE_ADD_LOUNGE_IMAGES.sql')
  const newsSql = read('SUPABASE_SETUP_NEWS_IMAGES_STORAGE.sql')

  assert.match(loungeSql, /\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/)
  assert.doesNotMatch(loungeSql, /with check \(bucket_id = 'lounge-images'\);/)
  assert.doesNotMatch(loungeSql, /for (update|delete)[\s\S]{0,120}using \(bucket_id = 'lounge-images'\);/)

  assert.match(newsSql, /drop policy if exists "Authenticated upload news images"/)
  assert.match(newsSql, /drop policy if exists "Authenticated update news images"/)
  assert.match(newsSql, /drop policy if exists "Authenticated delete news images"/)
  assert.match(newsSql, /from public\.user_roles ur/)
  assert.match(newsSql, /ur\.role = 'admin'/)
  assert.doesNotMatch(newsSql, /with check \(bucket_id = 'news-images'\);/)
  assert.doesNotMatch(newsSql, /using \(bucket_id = 'news-images'\);/)
})

test('site analytics aggregate views run with invoker privileges', () => {
  const sql = read('SUPABASE_SETUP_SITE_ANALYTICS.sql')
  const matches = sql.match(/with \(security_invoker = true\)/g) || []

  assert.equal(matches.length, 4)
})

test('news replacement paths insert the new batch before removing old live rows', () => {
  const helper = read('api/_lib/news-manual-replace.js')
  const market = read('api/_lib/refresh-market-news.js')
  const lounge = read('api/cron/lounge-digest.js')
  const aiNews = read('api/cron/ai-news.js')

  assert.ok(helper.indexOf(".insert(stampedRows)") < helper.indexOf(".delete()"))
  assert.match(helper, /\.lt\('updated_at', batchUpdatedAt\)/)
  assert.match(market, /replaceNewsManualBucketRows\(adminClient, buckets, rows/)
  assert.match(lounge, /replaceNewsManualBucketRows\(adminClient, \[DIGEST_BUCKET\], rows/)

  assert.ok(aiNews.indexOf(".insert(rowsToInsert)") < aiNews.indexOf(".update({ is_active: false })"))
  assert.match(aiNews, /\.lt\('updated_at', batchUpdatedAt\)/)
})
