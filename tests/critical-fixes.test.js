import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')

test('news_manual replacement inserts before deleting old bucket rows', () => {
  const src = read('api/_lib/refresh-market-news.js')
  const start = src.indexOf('export async function replaceNewsManualBucketRows')
  const end = src.indexOf('const toJpTime', start)
  assert.notEqual(start, -1)
  assert.notEqual(end, -1)
  const helper = src.slice(start, end)
  assert(helper.indexOf(".insert(safeRows)") !== -1)
  assert(helper.indexOf(".delete()") !== -1)
  assert(helper.indexOf(".insert(safeRows)") < helper.indexOf(".delete()"))
  assert.match(helper, /\.lt\('updated_at', batchUpdatedAt\)/)
})

test('AI news replacement inserts the new active batch before deactivating older rows', () => {
  const src = read('api/cron/ai-news.js')
  const insertIdx = src.indexOf("const { error: insertErr } = await admin.from('ai_news_summaries').insert(rowsToInsert)")
  const deactivateIdx = src.indexOf('const { error: deactivateErr } = await admin', insertIdx)
  assert.notEqual(insertIdx, -1)
  assert.notEqual(deactivateIdx, -1)
  assert(insertIdx < deactivateIdx)
  assert.match(src, /updated_at: batchUpdatedAt/)
  assert.match(src, /\.lt\('updated_at', batchUpdatedAt\)/)
})

test('profile display names use a narrow RPC instead of broad user_profiles reads', () => {
  const sql = read('SUPABASE_FIX_LOUNGE_DISPLAY.sql')
  const loungeApi = read('src/lib/loungeApi.js')
  assert.match(sql, /drop policy if exists "user_profiles_public_read_display"/)
  assert.doesNotMatch(sql, /create policy "user_profiles_public_read_display"[\s\S]*using \(true\)/i)
  assert.match(sql, /get_user_profile_display_names\(p_user_ids uuid\[\]\)/)
  assert.match(loungeApi, /\.rpc\('get_user_profile_display_names'/)
  assert.doesNotMatch(loungeApi, /from\('user_profiles'\)\.select\('user_id,nickname,full_name'\)/)
})

test('profile entitlement fields are guarded and user metadata is not trusted for paid access', () => {
  const sql = read('SUPABASE_ADD_PREMIUM_SUBSCRIPTION.sql')
  const app = read('src/App.jsx')
  const fundPage = read('src/pages/FundPage.jsx')
  const fundCompare = read('src/pages/FundComparePage.jsx')
  const membership = read('src/lib/membership.js')
  assert.match(sql, /prevent_user_profile_entitlement_tampering/)
  assert.match(sql, /before insert or update on public\.user_profiles/)
  assert.match(sql, /new\.is_premium is distinct from old\.is_premium/)
  assert.doesNotMatch(app, /user_metadata\?\.(plan_tier|membership_tier)/)
  assert.doesNotMatch(fundPage, /user_metadata\?\.(plan_tier|membership_tier)/)
  assert.doesNotMatch(fundCompare, /user_metadata\?\.(plan_tier|membership_tier)/)
  assert.doesNotMatch(membership, /profile\.(plan_tier|membership_tier|is_prime|prime_member)/)
})

test('storage writes are restricted to admins or caller-owned lounge paths', () => {
  const newsStorage = read('SUPABASE_SETUP_NEWS_IMAGES_STORAGE.sql')
  const loungeStorage = read('SUPABASE_ADD_LOUNGE_IMAGES.sql')
  assert.match(newsStorage, /ur\.role = 'admin'/)
  assert.doesNotMatch(newsStorage, /with check \(bucket_id = 'news-images'\);/)
  assert.match(loungeStorage, /\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/)
  assert.doesNotMatch(loungeStorage, /with check \(bucket_id = 'lounge-images'\);/)
})

test('ETF symbols use the full universe and JP ETF-only Marketstack runs select from it', async () => {
  const etfModule = await import(resolve(root, 'src/data/etfListFromXlsx.js'))
  const marketstack = read('api/cron/marketstack-daily.js')
  assert(etfModule.ETF_SYMBOLS_FROM_XLSX.length > 100)
  assert(etfModule.ETF_SYMBOLS_FROM_XLSX.includes('1306.T'))
  assert.match(marketstack, /const jpEtfSymbolPool = uniqueSymbols\(jpEtfSourceSymbols\)/)
  assert.match(marketstack, /let selectedSymbols = jpEtfOnly \? jpEtfSymbolPool : allSymbols/)
})

test('ETF compare links preserve query params on the canonical route', () => {
  const vercel = read('vercel.json')
  const watchsets = read('src/lib/fundOptimizerWatchsets.js')
  assert.doesNotMatch(vercel, /\^\/funds\/compare\/\?\$/)
  assert.match(watchsets, /return `\/etf-compare\?\$\{params\.toString\(\)\}`/)
})
