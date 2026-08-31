import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  REQUIRED_DEFINER_FNS,
  auditLoungeTriggerSql,
  functionIsSecurityDefinerWithSafeSearchPath,
  sqlHasOwnNotificationInsertPolicy,
} from '../src/lib/loungeTriggerRlsSafety.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (name) => readFileSync(join(root, name), 'utf8')

test('patch SQL marks lounge/portfolio trigger functions SECURITY DEFINER', () => {
  const sql = read('SUPABASE_FIX_LOUNGE_TRIGGER_RLS.sql')
  const audit = auditLoungeTriggerSql(sql)
  assert.deepEqual(audit.missingSecurityDefiner, [])
  assert.equal(audit.hasOwnNotificationInsertPolicy, true)
  assert.equal(audit.ok, true)
})

test('setup SQL matches the same definer + insert-policy contract', () => {
  const lounge = read('SUPABASE_SETUP_LOUNGE_SOCIAL.sql')
  const portfolio = read('SUPABASE_SETUP_PORTFOLIO.sql')
  const combined = `${lounge}\n${portfolio}`
  for (const fn of REQUIRED_DEFINER_FNS) {
    assert.equal(
      functionIsSecurityDefinerWithSafeSearchPath(combined, fn),
      true,
      `${fn} must be SECURITY DEFINER with search_path=public`,
    )
  }
  assert.equal(sqlHasOwnNotificationInsertPolicy(lounge), true)
})

test('SECURITY INVOKER (or missing definer) is rejected', () => {
  const bad = `
create or replace function public.refresh_lounge_post_stats()
returns trigger
language plpgsql
as $$
begin
  return new;
end;
$$;
`
  assert.equal(functionIsSecurityDefinerWithSafeSearchPath(bad, 'refresh_lounge_post_stats'), false)
})
