/**
 * GET /api/admin/campaign-cp2026-entries
 * Read-only October applications (cp2026_sns_oct). Legacy rows are not updated.
 * service_role stays on the server. No draws or status changes.
 */
import { createClient } from '@supabase/supabase-js'
import { adminAuthFailure } from '../_lib/admin-basic-auth.js'
import { applyPrivateNoStore } from '../_lib/private-no-store.js'
import { getSupabaseEnv } from '../_lib/supabase-bearer-auth.js'
import {
  CAMPAIGN_CP2026_SNS_LEGACY_ID,
  CAMPAIGN_CP2026_SNS_SEP_END_MS,
  CAMPAIGN_CP2026_SNS_SEP_ID,
  CAMPAIGN_CP2026_SNS_SEP_START_MS,
  CAMPAIGN_CP2026_SNS_SEP_TEST_EMAILS,
} from '../../src/constants/campaignCp2026SnsSep.js'
import {
  CAMPAIGN_ADMIN_CSV_MAX_ROWS,
  buildCampaignEntriesCsv,
  classifyCampaignEntry,
  csvExportDecision,
} from '../../src/lib/campaignEntryClassify.js'
import {
  applyCampaignEntryOrder,
  decorateCampaignRow,
  resolveStaffIdsViaListUsers,
} from '../../src/lib/campaignStaffLookup.js'

const LIST_COLUMNS = 'id,user_id,campaign_id,status,survey_completed_at,sns_url,sns_platform,sns_submitted_at,applied_at,signup_utm_source,signup_utm_medium,signup_utm_campaign,created_at'
const EMAIL_LOOKUP_CONCURRENCY = 4
const START_ISO = new Date(CAMPAIGN_CP2026_SNS_SEP_START_MS).toISOString()
const END_ISO = new Date(CAMPAIGN_CP2026_SNS_SEP_END_MS).toISOString()

function sendJson(res, status, payload) {
  applyPrivateNoStore(res)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function pageParams(req) {
  const url = new URL(req.url || '/', 'https://www.moneymart.co.jp')
  const page = Math.max(1, Number(url.searchParams.get('page') || 1) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize') || 25) || 25))
  const bucket = String(url.searchParams.get('bucket') || 'all')
  const id = String(url.searchParams.get('id') || '').trim()
  const format = String(url.searchParams.get('format') || '').trim().toLowerCase()
  return { page, pageSize, bucket, id, format }
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      out[index] = await fn(items[index], index)
    }
  })
  await Promise.all(workers)
  return out
}

async function resolveStaffIds(admin) {
  return resolveStaffIdsViaListUsers(
    (args) => admin.auth.admin.listUsers(args),
    CAMPAIGN_CP2026_SNS_SEP_TEST_EMAILS,
  )
}

function baseQuery(admin, columns, withCount = false) {
  const query = admin.from('campaign_entries').select(columns, withCount ? { count: 'exact' } : undefined)
  return query.eq('campaign_id', CAMPAIGN_CP2026_SNS_SEP_ID)
}

function applyReceiptFilters(query) {
  return query
    .gte('applied_at', START_ISO)
    .lte('applied_at', END_ISO)
    .not('survey_completed_at', 'is', null)
    .not('sns_submitted_at', 'is', null)
    .not('sns_url', 'is', null)
    .neq('sns_url', '')
}

function excludeStaff(query, staffIds) {
  if (!staffIds.length) return query
  return query.not('user_id', 'in', `(${staffIds.join(',')})`)
}

function applyBucket(query, bucket, staffIds) {
  if (bucket === 'receipt') return excludeStaff(applyReceiptFilters(query).eq('status', 'eligible'), staffIds)
  if (bucket === 'awarded') return excludeStaff(applyReceiptFilters(query).eq('status', 'rewarded'), staffIds)
  if (bucket === 'prewindow') return query.lt('applied_at', START_ISO)
  if (bucket === 'afterwindow') return query.gt('applied_at', END_ISO)
  if (bucket === 'staff') return staffIds.length ? query.in('user_id', staffIds) : query.eq('user_id', '00000000-0000-0000-0000-000000000000')
  return query
}

async function countFiltered(admin, bucket, staffIds) {
  const { count, error } = await applyBucket(
    admin.from('campaign_entries').select('id', { count: 'exact', head: true }).eq('campaign_id', CAMPAIGN_CP2026_SNS_SEP_ID),
    bucket,
    staffIds,
  )
  if (error) throw error
  return Number(count) || 0
}

function decorateWithStaffIds(row, emailsById) {
  return decorateCampaignRow(row, emailsById)
}

async function emailsForPage(admin, rows) {
  const ids = [...new Set(rows.map((row) => row.user_id).filter(Boolean))]
  const found = new Map()
  await mapPool(ids, EMAIL_LOOKUP_CONCURRENCY, async (userId) => {
    try {
      const { data, error } = await admin.auth.admin.getUserById(userId)
      if (error) found.set(userId, { email: '', failed: true })
      else found.set(userId, { email: String(data?.user?.email || ''), failed: false })
    } catch {
      found.set(userId, { email: '', failed: true })
    }
  })
  return rows.map((row) => {
    const hit = found.get(row.user_id) || { email: '', failed: true }
    const mark = classifyCampaignEntry({ ...row, email: hit.email, emailLookupFailed: hit.failed })
    return {
      ...row,
      email: hit.failed ? '' : hit.email,
      emailLookupFailed: hit.failed,
      survey_completed: Boolean(row.survey_completed_at),
      ...mark,
    }
  })
}

export default async function handler(req, res) {
  applyPrivateNoStore(res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }

  const failure = adminAuthFailure(req)
  if (failure) {
    if (failure === 401) res.setHeader('WWW-Authenticate', 'Basic realm="MoneyMart Admin"')
    return sendJson(res, failure, { ok: false, error: failure === 403 ? 'Forbidden' : 'Unauthorized' })
  }

  const { supabaseUrl, serviceKey } = getSupabaseEnv()
  if (!supabaseUrl || !serviceKey) {
    return sendJson(res, 500, { ok: false, error: 'Supabase service env missing' })
  }
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { page, pageSize, bucket, id, format } = pageParams(req)

  try {
    const staff = await resolveStaffIds(admin)
    if (id) {
      const { data, error } = await admin
        .from('campaign_entries')
        .select(`${LIST_COLUMNS},survey_answers`)
        .eq('campaign_id', CAMPAIGN_CP2026_SNS_SEP_ID)
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      if (!data) return sendJson(res, 404, { ok: false, error: 'Not found' })
      const [decorated] = await emailsForPage(admin, [data])
      return sendJson(res, 200, { ok: true, entry: decorated, staffExclusion: staff.ok ? 'resolved' : 'unresolved' })
    }

    if (!staff.ok && (bucket === 'receipt' || bucket === 'awarded' || bucket === 'staff' || format === 'csv')) {
      return sendJson(res, 503, {
        ok: false,
        error: 'Staff lookup failed. Customer totals are withheld so unresolved staff are not counted as customers.',
        staffExclusion: 'unresolved',
      })
    }

    const filteredCount = await countFiltered(admin, bucket, staff.ok ? staff.ids : [])
    if (format === 'csv') {
      const decision = csvExportDecision(filteredCount)
      if (!decision.ok) {
        return sendJson(res, 400, {
          ok: false,
          error: `CSV stops at ${decision.limit} rows. ${decision.total} rows match. Narrow the filter.`,
          total: decision.total,
          limit: decision.limit,
        })
      }
      const collected = []
      const chunk = 100
      for (let offset = 0; offset < filteredCount; offset += chunk) {
        const { data, error } = await applyCampaignEntryOrder(
          applyBucket(baseQuery(admin, LIST_COLUMNS), bucket, staff.ids),
        ).range(offset, offset + chunk - 1)
        if (error) throw error
        collected.push(...(data || []).map((row) => decorateWithStaffIds(row, staff.emailsById)))
      }
      applyPrivateNoStore(res)
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="campaign-cp2026-oct-entries.csv"')
      res.end(buildCampaignEntriesCsv(collected))
      return
    }

    const from = (page - 1) * pageSize
    const { data, error } = await applyCampaignEntryOrder(
      applyBucket(baseQuery(admin, LIST_COLUMNS), bucket, staff.ok ? staff.ids : []),
    ).range(from, from + pageSize - 1)
    if (error) throw error
    const entries = await emailsForPage(admin, data || [])

    let summary = {
      campaignId: CAMPAIGN_CP2026_SNS_SEP_ID,
      legacyCampaignId: CAMPAIGN_CP2026_SNS_LEGACY_ID,
      staffExclusion: staff.ok ? 'resolved' : 'unresolved',
      autoReceipt: null,
      awarded: null,
      note: 'autoReceipt is eligible paperwork inside the window. awarded is rewarded and is not a receipt count.',
    }
    if (staff.ok) {
      const [autoReceipt, awarded, legacyCount] = await Promise.all([
        countFiltered(admin, 'receipt', staff.ids),
        countFiltered(admin, 'awarded', staff.ids),
        admin.from('campaign_entries').select('id', { count: 'exact', head: true }).eq('campaign_id', CAMPAIGN_CP2026_SNS_LEGACY_ID),
      ])
      summary = {
        ...summary,
        autoReceipt,
        awarded,
        legacyRows: Number(legacyCount.count) || 0,
      }
    }

    return sendJson(res, 200, {
      ok: true,
      summary,
      page,
      pageSize,
      total: filteredCount,
      entries,
    })
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err.message || 'Failed to read entries' })
  }
}

export { CAMPAIGN_ADMIN_CSV_MAX_ROWS }
