/**
 * Campaign rule checks that do not write campaign_entries.
 * Usage: node scripts/verify-cp2026-campaign-rules.mjs
 */
import {
  CAMPAIGN_APPLY_ACCEPTED_MESSAGE,
  CAMPAIGN_APPLY_PENDING_DRAW_MESSAGE,
  CAMPAIGN_APPLY_REJECTED_MESSAGE,
  CAMPAIGN_CP2026_SNS_LEGACY_ID,
  CAMPAIGN_CP2026_SNS_SEP_END_MS,
  CAMPAIGN_CP2026_SNS_SEP_ID,
  CAMPAIGN_CP2026_SNS_SEP_START_MS,
  CAMPAIGN_CP2026_SNS_SEP_SURVEY_INTRO,
} from '../src/constants/campaignCp2026SnsSep.js'
import {
  classifyCampaignEntry,
  csvExportDecision,
  summarizeCampaignEntries,
} from '../src/lib/campaignEntryClassify.js'
import { readFileSync } from 'node:fs'
import { authNextMetadata } from '../src/lib/authReturnPath.js'
import { buildCampaignLaunchCohort } from '../src/lib/campaignLaunchCohort.js'
import {
  applyCampaignEntryOrder,
  campaignEntryStatusLabel,
  decorateCampaignRow,
  resolveStaffIdsViaListUsers,
  snsPostReviewLabel,
  STAFF_LIST_USERS_PER_PAGE,
} from '../src/lib/campaignStaffLookup.js'
import { buildCampaignEntriesCsv } from '../src/lib/campaignEntryClassify.js'
import {
  decideCampaignApply,
  getCampaignWindowMeta,
  isCampaignEntryUniqueViolation,
  loadOrCreateCampaignEntry,
  parseSnsSubmission,
} from '../api/_lib/campaign-cp2026-sns-sep.js'
import { allowlistedCampaignUtm } from '../src/lib/campaignUtm.js'
import { buildCampaignStatusPayload } from '../api/_lib/campaign-cp2026-sns-sep.js'

const results = []
const pass = (name, detail = '') => results.push({ ok: true, name, detail })
const fail = (name, detail = '') => results.push({ ok: false, name, detail })

function expectThrow(name, fn) {
  try {
    fn()
    fail(name, 'expected throw')
  } catch (err) {
    pass(name, err.message)
  }
}

const savedPreview = process.env.CAMPAIGN_CP2026_SNS_PREVIEW
delete process.env.CAMPAIGN_CP2026_SNS_PREVIEW

const bounds = [
  ['before start', '2026-09-30T14:59:59.999Z', false],
  ['start inclusive', '2026-09-30T15:00:00.000Z', true],
  ['mid', '2026-10-15T03:00:00.000Z', true],
  ['end inclusive', '2026-10-30T14:59:59.999Z', true],
  ['after end', '2026-10-30T15:00:00.000Z', false],
]
for (const [label, iso, open] of bounds) {
  const meta = getCampaignWindowMeta(new Date(iso), 'guest@example.com')
  if (meta.inWindow === open && meta.active === open) pass(`JST ${label}`)
  else fail(`JST ${label}`, JSON.stringify(meta))
}

const staff = getCampaignWindowMeta(new Date('2026-09-28T00:00:00.000Z'), 'kelly.nam@moneymart.co.jp')
if (staff.active && staff.staffTest && !staff.inWindow) pass('Staff tester is active before the window')
else fail('Staff tester window', JSON.stringify(staff))

if (savedPreview == null) delete process.env.CAMPAIGN_CP2026_SNS_PREVIEW
else process.env.CAMPAIGN_CP2026_SNS_PREVIEW = savedPreview

const acceptUrls = [
  'https://x.com/moneymart/status/1234567890123',
  'https://twitter.com/moneymart/status/1234567890123?s=20',
  'https://x.com/i/web/status/1234567890123',
  'https://note.com/moneymart/n/nabc1234',
  'note.com/moneymart/n/nABC1234',
]
for (const url of acceptUrls) {
  try {
    const parsed = parseSnsSubmission({ sns_url: url, sns_platform: 'note' })
    const expectNote = /note\.com/i.test(url)
    if (parsed.sns_platform === (expectNote ? 'note' : 'twitter')) pass(`SNS accept ${url}`)
    else fail(`SNS accept ${url}`, parsed.sns_platform)
  } catch (err) {
    fail(`SNS accept ${url}`, err.message)
  }
}

const rejectUrls = [
  'https://x.com',
  'https://x.com/',
  'https://x.com/home',
  'https://x.com/moneymart',
  'https://twitter.com/explore',
  'https://x.com/moneymart/status/1',
  'https://note.com',
  'https://note.com/',
  'https://note.com/moneymart',
  'https://evil.note.com/moneymart/n/nabc1234',
  'https://notx.com/moneymart/status/1234567890123',
  'https://instagram.com/p/abc',
]
for (const url of rejectUrls) {
  expectThrow(`SNS reject ${url}`, () => parseSnsSubmission({ sns_url: url }))
}

const draft = { status: 'draft', applied_at: null }
const promoted = decideCampaignApply(draft)
if (promoted.action === 'promote' && promoted.message === CAMPAIGN_APPLY_ACCEPTED_MESSAGE) {
  pass('Draft apply promotes with lottery copy')
} else fail('Draft apply', JSON.stringify(promoted))

const rejected = decideCampaignApply({ status: 'rejected', applied_at: '2026-10-02T00:00:00.000Z' })
if (rejected.action === 'reject' && rejected.httpStatus === 409) pass('Rejected stays rejected')
else fail('Rejected reapply', JSON.stringify(rejected))

const eligible = decideCampaignApply({ status: 'eligible', applied_at: '2026-10-02T00:00:00.000Z' })
if (eligible.action === 'noop') pass('October eligible retry does not rewrite status')
else fail('October eligible retry', JSON.stringify(eligible))

const octoberDraft = decideCampaignApply({ status: 'draft', applied_at: null, campaign_id: CAMPAIGN_CP2026_SNS_SEP_ID })
if (octoberDraft.action === 'promote') pass('October draft can be submitted, including for a July legacy member')
else fail('October draft promote', JSON.stringify(octoberDraft))

if (CAMPAIGN_CP2026_SNS_SEP_ID === 'cp2026_sns_oct' && CAMPAIGN_CP2026_SNS_LEGACY_ID === 'cp2026_sns_sep') {
  pass('October id is separate from the legacy id')
} else fail('Campaign ids', `${CAMPAIGN_CP2026_SNS_SEP_ID} ${CAMPAIGN_CP2026_SNS_LEGACY_ID}`)

const complete = {
  campaign_id: 'cp2026_sns_oct',
  status: 'eligible',
  applied_at: new Date(CAMPAIGN_CP2026_SNS_SEP_START_MS).toISOString(),
  survey_completed_at: '2026-10-01T00:00:00.000Z',
  sns_submitted_at: '2026-10-01T00:00:00.000Z',
  sns_url: 'https://x.com/moneymart/status/1234567890123',
  email: 'guest@example.com',
}
const startEdge = classifyCampaignEntry(complete)
if (startEdge.autoReceipt && startEdge.countable && !startEdge.awarded) pass('Start boundary is auto receipt, not a win')
else fail('Start boundary', JSON.stringify(startEdge))

const endEdge = classifyCampaignEntry({ ...complete, applied_at: new Date(CAMPAIGN_CP2026_SNS_SEP_END_MS).toISOString() })
if (endEdge.inWindow && endEdge.autoReceipt) pass('End boundary inclusive is auto receipt')
else fail('End boundary', JSON.stringify(endEdge))

const afterEnd = classifyCampaignEntry({ ...complete, applied_at: new Date(CAMPAIGN_CP2026_SNS_SEP_END_MS + 1).toISOString() })
if (afterEnd.afterWindow && !afterEnd.countable && !afterEnd.autoReceipt) pass('After end is not countable')
else fail('After end', JSON.stringify(afterEnd))

const beforeStart = classifyCampaignEntry({ ...complete, applied_at: new Date(CAMPAIGN_CP2026_SNS_SEP_START_MS - 1).toISOString() })
if (beforeStart.beforeWindow && !beforeStart.countable) pass('Before start is not countable')
else fail('Before start', JSON.stringify(beforeStart))

const legacy = classifyCampaignEntry({ ...complete, campaign_id: 'cp2026_sns_sep', applied_at: '2026-07-05T03:00:00.000Z' })
if (!legacy.rightCampaign && !legacy.countable && !legacy.autoReceipt) pass('Legacy July row is not an October receipt')
else fail('Legacy July row', JSON.stringify(legacy))

const missingSns = classifyCampaignEntry({ ...complete, sns_url: '', sns_submitted_at: null })
if (!missingSns.countable) pass('Missing SNS is not a receipt')
else fail('Missing SNS', JSON.stringify(missingSns))

const missingSurvey = classifyCampaignEntry({ ...complete, survey_completed_at: null })
if (!missingSurvey.countable && !missingSurvey.surveyDone) pass('Missing survey is not a receipt')
else fail('Missing survey', JSON.stringify(missingSurvey))

const duplicates = summarizeCampaignEntries([complete, { ...complete, id: 'second' }])
if (duplicates.autoReceipt === 2 && duplicates.countable === 2) pass('Two complete rows are counted separately')
else fail('Duplicate rows', JSON.stringify(duplicates))

const cohort = buildCampaignLaunchCohort([
  { session_id: 's1', event_name: 'campaign_view', source: 'x', medium: 'social', created_at: '2026-10-01T00:00:00.000Z' },
  { session_id: 's1', event_name: 'campaign_view', source: 'google', medium: 'cpc', created_at: '2026-10-01T00:05:00.000Z' },
  { session_id: 's1', event_name: 'campaign_apply', created_at: '2026-10-01T00:06:00.000Z' },
  { session_id: 's1', event_name: 'campaign_apply', created_at: '2026-10-01T00:07:00.000Z' },
])
if (cohort.totals.view === 1 && cohort.totals.apply === 1 && cohort.channels[0]?.key?.startsWith('x /')) {
  pass('Duplicate session events count once and keep the first view channel')
} else fail('Cohort duplicates', JSON.stringify(cohort))

const awarded = classifyCampaignEntry({ ...complete, status: 'rewarded' })
if (awarded.awarded && !awarded.autoReceipt && !awarded.countable) pass('Rewarded is a separate award, not auto receipt')
else fail('Award split', JSON.stringify(awarded))

const unresolved = classifyCampaignEntry({ ...complete, emailLookupFailed: true, email: 'kelly.nam@moneymart.co.jp' })
if (unresolved.staffUnresolved && !unresolved.staff && !unresolved.countable && !unresolved.autoReceipt) {
  pass('Failed staff lookup is not treated as a customer')
} else fail('Staff lookup failure', JSON.stringify(unresolved))

const staffMark = classifyCampaignEntry({ ...complete, email: 'kelly.nam@moneymart.co.jp' })
if (staffMark.staff && !staffMark.countable) pass('Known staff is excluded from receipt')
else fail('Staff exclusion', JSON.stringify(staffMark))

const summary = summarizeCampaignEntries([complete, { ...complete, status: 'rewarded' }, { ...complete, emailLookupFailed: true }])
if (summary.autoReceipt === 1 && summary.awarded === 1 && summary.countable === null) {
  pass('Summary hides customer total when any staff lookup failed')
} else fail('Summary', JSON.stringify(summary))

const csvOver = csvExportDecision(2001)
if (!csvOver.ok && csvOver.limit === 2000) pass('CSV over the cap is refused instead of truncated')
else fail('CSV cap', JSON.stringify(csvOver))

const staffDecorated = decorateCampaignRow(
  { ...complete, id: 'staff-row', user_id: 'staff-1', email: '' },
  { 'staff-1': 'kelly.nam@moneymart.co.jp' },
)
const customerDecorated = decorateCampaignRow(
  { ...complete, id: 'customer-row', user_id: 'customer-1', email: '' },
  {},
)
const csv = buildCampaignEntriesCsv([staffDecorated, customerDecorated])
const csvLines = csv.split('\n')
const staffCsv = csvLines.find((line) => line.startsWith('staff-row,')) || ''
const customerCsv = csvLines.find((line) => line.startsWith('customer-row,')) || ''
const staffCols = staffCsv.split(',')
const customerCols = customerCsv.split(',')
if (
  staffDecorated.email === 'kelly.nam@moneymart.co.jp'
  && staffDecorated.staff
  && staffCols[3] === '0'
  && staffCols[11] === '1'
  && customerCols[3] === '1'
  && customerCols[11] === '0'
) {
  pass('CSV keeps staff exclusion after reclassification')
} else fail('CSV staff', JSON.stringify({ staffCsv, customerCsv }))

const urlOnly = campaignEntryStatusLabel({
  status: 'eligible',
  sns_url: 'https://x.com/moneymart/status/1234567890123',
  autoReceipt: false,
  awarded: false,
})
if (!/当選|自動検証/.test(urlOnly) && snsPostReviewLabel({ sns_url: 'https://x.com/a' }) === '投稿内容は未確認') {
  pass('An unverified post URL is not labeled as reviewed or a win')
} else fail('URL label', `${urlOnly} / ${snsPostReviewLabel({ sns_url: 'https://x.com/a' })}`)

if (campaignEntryStatusLabel({ awarded: true, status: 'rewarded' }) === '当選（最終）'
  && campaignEntryStatusLabel({ autoReceipt: true, status: 'eligible' }) === '書類受付（抽選前）') {
  pass('Receipt and award labels stay separate')
} else fail('Status labels')

const orders = []
applyCampaignEntryOrder({
  order(column, options) {
    orders.push([column, options])
    return this
  },
})
if (orders[0]?.[0] === 'applied_at' && orders[1]?.[0] === 'id' && orders[1]?.[1]?.ascending === true) {
  pass('Page order uses id as a tie-breaker')
} else fail('Entry order', JSON.stringify(orders))

const staffPage = Array.from({ length: STAFF_LIST_USERS_PER_PAGE }, (_, index) => ({ id: `u${index}`, email: `u${index}@example.com` }))
const foundOnSecond = await resolveStaffIdsViaListUsers(async ({ page }) => {
  if (page === 1) return { data: { users: staffPage }, error: null }
  return { data: { users: [{ id: 'kelly-id', email: 'Kelly.Nam@moneymart.co.jp' }] }, error: null }
}, ['kelly.nam@moneymart.co.jp', 'justin.nam@moneymart.co.jp'])
if (foundOnSecond.ok && foundOnSecond.ids.includes('kelly-id') && foundOnSecond.emailsById['kelly-id'] === 'kelly.nam@moneymart.co.jp') {
  pass('Staff ids come from listUsers pagination')
} else fail('listUsers pagination', JSON.stringify(foundOnSecond))

const listError = await resolveStaffIdsViaListUsers(async () => ({ data: null, error: { message: 'schema' } }), ['kelly.nam@moneymart.co.jp'])
if (!listError.ok && listError.ids.length === 0) pass('listUsers failure stays unresolved')
else fail('listUsers failure', JSON.stringify(listError))

const adminSource = readFileSync(new URL('../api/admin/campaign-cp2026-entries.js', import.meta.url), 'utf8')
const adminUi = readFileSync(new URL('../src/components/admin/dashboard/CampaignEntriesAdminCard.jsx', import.meta.url), 'utf8')
if (!adminSource.includes(".schema('auth')") && adminSource.includes('listUsers') && adminUi.includes('/api/admin/campaign-cp2026-entries')) {
  pass('Admin list uses Auth Admin listUsers and the dashboard calls it')
} else fail('Admin wiring')

const callbackSource = readFileSync(new URL('../src/lib/authCallbackUrl.js', import.meta.url), 'utf8')
const callbackFn = callbackSource.slice(callbackSource.indexOf('export function getAuthCallbackUrl'))
if (callbackFn.includes("AUTH_CALLBACK_PATH") && !callbackFn.includes('?next') && !callbackFn.includes('encodeURIComponent')) {
  pass('Callback URL stays exact, without a next query')
} else fail('Callback URL', callbackFn.slice(0, 240))

const meta = authNextMetadata('/campaign/sns-2026?utm_source=x&token=secret&email=a@b.c')
if (meta.mm_auth_next === '/campaign/sns-2026?utm_source=x' && !JSON.stringify(meta).includes('token')) {
  pass('Return path is metadata, with allowlisted UTM only')
} else fail('Auth metadata', JSON.stringify(meta))

const rewarded = decideCampaignApply({ status: 'rewarded', applied_at: '2026-10-02T00:00:00.000Z' })
if (rewarded.action === 'noop' && rewarded.message.includes('付与済み')) pass('Rewarded retry is a no-op')
else fail('Rewarded retry', JSON.stringify(rewarded))

if (!/特典をお送り|審査後|特典付与まで/.test(CAMPAIGN_APPLY_ACCEPTED_MESSAGE + CAMPAIGN_APPLY_PENDING_DRAW_MESSAGE)) {
  pass('Completion copy does not promise a payout')
} else fail('Completion copy still promises a payout')

if (CAMPAIGN_APPLY_REJECTED_MESSAGE.includes('再応募はできません')) pass('Rejected copy blocks another application')
else fail('Rejected copy')

function fakeAdmin({ onInsert }) {
  let entryReads = 0
  return {
    from(table) {
      const api = {
        select() { return api },
        eq() { return api },
        maybeSingle: async () => {
          if (table === 'user_profiles') return { data: null, error: null }
          entryReads += 1
          if (entryReads === 1) return { data: null, error: null }
          return {
            data: { id: 'row-1', user_id: 'user-1', status: 'draft', campaign_id: 'cp2026_sns_sep' },
            error: null,
          }
        },
        insert(row) {
          return {
            select() {
              return {
                single: async () => onInsert(row),
              }
            },
          }
        },
      }
      return api
    },
  }
}

const raced = await loadOrCreateCampaignEntry(fakeAdmin({
  onInsert() {
    return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } }
  },
}), 'user-1')
if (raced?.id === 'row-1' && isCampaignEntryUniqueViolation({ code: '23505' })) {
  pass('loadOrCreate returns the existing row after a unique conflict')
} else fail('loadOrCreate race', JSON.stringify(raced))

let inserted = false
let insertedId = ''
const created = await loadOrCreateCampaignEntry(fakeAdmin({
  onInsert(row) {
    inserted = true
    insertedId = row?.campaign_id
    return { data: { id: 'new-1', status: 'draft' }, error: null }
  },
}), 'user-2')
if (inserted && created?.id === 'new-1' && insertedId === 'cp2026_sns_oct') pass('loadOrCreate inserts the October campaign id')
else fail('loadOrCreate insert', JSON.stringify({ created, insertedId }))

const utm = allowlistedCampaignUtm('?utm_source=x&utm_medium=social&utm_campaign=cp2026&email=person@example.com&token=secret&ref=friend', {})
if (utm.utm_source === 'x' && utm.utm_medium === 'social' && utm.utm_campaign === 'cp2026' && !utm.page_query.includes('email') && !utm.page_query.includes('token') && !utm.page_query.includes('ref')) {
  pass('Campaign UTM allowlist drops email, token, and ref')
} else fail('Campaign UTM allowlist', JSON.stringify(utm))

const badStored = allowlistedCampaignUtm('', { utm_source: 'person@example.com', utm_medium: 'social' })
if (!badStored.utm_source && badStored.utm_medium === 'social') pass('Stored UTM drops values that look like email')
else fail('Stored UTM', JSON.stringify(badStored))

const CAMPAIGN_DRAW_DESCRIPTION = '応募条件を満たした方の中から抽選で、Amazonギフトカード1,000円分を50名様、MoneyMart Premium 1か月利用クーポンを1,000名様に。'
const seoSource = readFileSync(new URL('../src/lib/seoConfig.js', import.meta.url), 'utf8')
const pageSource = readFileSync(new URL('../src/pages/CampaignCp2026SnsSepPage.jsx', import.meta.url), 'utf8')
const layoutSource = readFileSync(new URL('../src/components/layout/Layout.jsx', import.meta.url), 'utf8')
if (
  seoSource.includes(CAMPAIGN_DRAW_DESCRIPTION)
  && pageSource.includes(CAMPAIGN_DRAW_DESCRIPTION)
  && !seoSource.includes('条件達成でプレミアム')
  && !seoSource.includes('レビューキャンペーン')
  && !pageSource.includes('レビューキャンペーン')
  && layoutSource.includes('og:description')
  && layoutSource.includes('twitter:description')
  && layoutSource.includes('seo.description')
) pass('Campaign meta description states both prizes are a draw')
else fail('Campaign meta description')

if (
  CAMPAIGN_CP2026_SNS_SEP_SURVEY_INTRO.includes('公開投稿')
  && CAMPAIGN_CP2026_SNS_SEP_SURVEY_INTRO.includes('投稿URLの提出')
  && CAMPAIGN_CP2026_SNS_SEP_SURVEY_INTRO.includes('50名様にAmazonギフトカード（1,000円分）')
  && CAMPAIGN_CP2026_SNS_SEP_SURVEY_INTRO.includes('1000名様にMoneyMart Premium 1か月利用クーポン')
  && !CAMPAIGN_CP2026_SNS_SEP_SURVEY_INTRO.includes('アンケートにご回答いただいた方の中から抽選で')
  && !CAMPAIGN_CP2026_SNS_SEP_SURVEY_INTRO.includes('レビューキャンペーン')
) pass('Survey intro includes the public post and URL, and keeps the prize counts')
else fail('Survey intro')

console.log('--- Campaign rules ---')
for (const row of results) {
  console.log(`${row.ok ? '✓' : '✗'} ${row.name}${row.detail ? ` — ${row.detail}` : ''}`)
}
const failed = results.filter((row) => !row.ok).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed > 0 ? 1 : 0)
