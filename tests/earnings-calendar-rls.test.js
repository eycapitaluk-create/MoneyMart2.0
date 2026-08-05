import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const readSql = (name) => readFile(new URL(`../${name}`, import.meta.url), 'utf8')

const assertAdminOnlyWritePolicy = (sql) => {
  assert.match(
    sql,
    /drop policy if exists "earnings_calendar_manual_write_authenticated"/i,
    'the legacy policy that allowed every signed-in user to write must be removed',
  )
  assert.doesNotMatch(
    sql,
    /create policy "earnings_calendar_manual_write_authenticated"/i,
    'the permissive authenticated-user write policy must not be recreated',
  )
  assert.match(sql, /create policy "earnings_calendar_manual_admin_write"/i)
  assert.match(sql, /ur\.user_id\s*=\s*auth\.uid\(\)/i)
  assert.match(sql, /ur\.role\s*=\s*'admin'/i)
}

test('earnings calendar setup grants writes only to admins', async () => {
  assertAdminOnlyWritePolicy(await readSql('SUPABASE_SETUP_EARNINGS_CALENDAR_MANUAL.sql'))
})

test('earnings calendar RLS patch removes the deployed permissive policy', async () => {
  assertAdminOnlyWritePolicy(await readSql('SUPABASE_FIX_EARNINGS_CALENDAR_RLS.sql'))
})
