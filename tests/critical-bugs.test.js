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
