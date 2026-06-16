import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('premium profile migration blocks client entitlement changes', async () => {
  const sql = await readFile(new URL('../SUPABASE_ADD_PREMIUM_SUBSCRIPTION.sql', import.meta.url), 'utf8')

  assert.match(sql, /prevent_client_entitlement_profile_changes/)
  assert.match(sql, /before insert or update on public\.user_profiles/i)
  assert.match(sql, /auth\.role\(\)\s*=\s*'service_role'/)
  assert.match(sql, /from public\.user_roles ur/)

  for (const column of [
    'is_premium',
    'subscription_tier',
    'stripe_customer_id',
    'stripe_subscription_id',
  ]) {
    assert.match(sql, new RegExp(`new\\.${column}`))
  }
})

test('stripe webhook profile write errors are not acknowledged', async () => {
  const source = await readFile(new URL('../api/billing/stripe-webhook.js', import.meta.url), 'utf8')

  assert.match(source, /if \(selErr\) \{[\s\S]*throw selErr[\s\S]*\}/)
  assert.match(source, /stripe-webhook profile update[\s\S]*throw error/)
  assert.match(source, /stripe-webhook profile insert[\s\S]*throw error/)
  assert.match(source, /res\.statusCode = 500[\s\S]*res\.end\('handler error'\)/)
})

test('market news replacement inserts before deleting older rows', async () => {
  const source = await readFile(new URL('../api/_lib/refresh-market-news.js', import.meta.url), 'utf8')
  const insertIdx = source.indexOf("from('news_manual').insert(rows)")
  const deleteIdx = source.indexOf(".delete()\n    .in('bucket', buckets)")

  assert.notEqual(insertIdx, -1)
  assert.notEqual(deleteIdx, -1)
  assert.ok(insertIdx < deleteIdx)
  assert.match(source, /\.lt\('updated_at', now\)/)
})

test('lounge digest replacement inserts before deleting older rows', async () => {
  const source = await readFile(new URL('../api/cron/lounge-digest.js', import.meta.url), 'utf8')
  const insertIdx = source.indexOf(".from('news_manual')\n      .insert(rows)")
  const deleteIdx = source.indexOf(".delete()\n      .eq('bucket', DIGEST_BUCKET)")

  assert.notEqual(insertIdx, -1)
  assert.notEqual(deleteIdx, -1)
  assert.ok(insertIdx < deleteIdx)
  assert.match(source, /\.lt\('updated_at', nowIso\)/)
})

test('ai news replacement inserts before deactivating older active rows', async () => {
  const source = await readFile(new URL('../api/cron/ai-news.js', import.meta.url), 'utf8')
  const insertIdx = source.indexOf("from('ai_news_summaries').insert(rowsToInsert)")
  const deactivateIdx = source.indexOf(".update({ is_active: false })")

  assert.notEqual(insertIdx, -1)
  assert.notEqual(deactivateIdx, -1)
  assert.ok(insertIdx < deactivateIdx)
  assert.match(source, /updated_at: batchUpdatedAt/)
  assert.match(source, /\.lt\('updated_at', batchUpdatedAt\)/)
})

test('jp_etf_only marketstack runs use the ETF pool before stock ETF exclusions', async () => {
  const source = await readFile(new URL('../api/cron/marketstack-daily.js', import.meta.url), 'utf8')

  assert.match(source, /const jpEtfSymbols = uniqueSymbols\(overrideSymbols\.length > 0 \? overrideSymbols : ETF_SYMBOLS_FROM_XLSX\)/)
  assert.match(source, /const stockSymbols = rawAllSymbols[\s\S]*?\.filter\(\(s\) => !etfUpper\.has/)
  assert.match(source, /const allSymbols = jpEtfOnly \? jpEtfSymbols : stockSymbols/)
  assert.match(source, /const tier1Pool = jpEtfOnly\s*\?\s*jpEtfSymbols/)
})
