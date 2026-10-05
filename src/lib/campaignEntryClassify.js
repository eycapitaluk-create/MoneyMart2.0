import {
  CAMPAIGN_CP2026_SNS_SEP_END_MS,
  CAMPAIGN_CP2026_SNS_SEP_ID,
  CAMPAIGN_CP2026_SNS_SEP_START_MS,
  isCampaignCp2026StaffTester,
} from '../constants/campaignCp2026SnsSep.js'

export const CAMPAIGN_ADMIN_CSV_MAX_ROWS = 2000

/**
 * October receipt is not a win.
 * autoReceipt = eligible paperwork inside the JST window.
 * awarded = rewarded, shown separately. After the window is neither.
 * A failed staff lookup is not treated as a regular customer.
 */
export function classifyCampaignEntry(entry, options = {}) {
  const startMs = typeof options === 'number' ? options : (options.startMs ?? CAMPAIGN_CP2026_SNS_SEP_START_MS)
  const endMs = typeof options === 'number' ? CAMPAIGN_CP2026_SNS_SEP_END_MS : (options.endMs ?? CAMPAIGN_CP2026_SNS_SEP_END_MS)
  const campaignId = typeof options === 'number' ? CAMPAIGN_CP2026_SNS_SEP_ID : (options.campaignId ?? CAMPAIGN_CP2026_SNS_SEP_ID)
  const emailLookupFailed = Boolean(entry?.emailLookupFailed || (typeof options === 'object' && options.emailLookupFailed))
  const email = emailLookupFailed ? '' : String(entry?.email || '')
  const staff = !emailLookupFailed && isCampaignCp2026StaffTester(email)
  const staffUnresolved = emailLookupFailed
  const status = String(entry?.status || '')
  const appliedMs = Date.parse(entry?.applied_at || '')
  const hasApplied = Number.isFinite(appliedMs)
  const beforeWindow = hasApplied && appliedMs < startMs
  const afterWindow = hasApplied && appliedMs > endMs
  const inWindow = hasApplied && appliedMs >= startMs && appliedMs <= endMs
  const rightCampaign = String(entry?.campaign_id || '') === campaignId
  const surveyDone = Boolean(entry?.survey_completed_at)
  const snsDone = Boolean(entry?.sns_submitted_at) && Boolean(String(entry?.sns_url || '').trim())
  const complete = rightCampaign && inWindow && surveyDone && snsDone && !staff && !staffUnresolved
  const autoReceipt = complete && status === 'eligible'
  const awarded = complete && status === 'rewarded'
  return {
    staff,
    staffUnresolved,
    beforeWindow,
    afterWindow,
    inWindow,
    rightCampaign,
    surveyDone,
    snsDone,
    autoReceipt,
    awarded,
    countable: autoReceipt,
  }
}

export function summarizeCampaignEntries(entries = [], options = {}) {
  const summary = {
    rows: entries.length,
    autoReceipt: 0,
    awarded: 0,
    beforeWindow: 0,
    afterWindow: 0,
    staffRows: 0,
    staffUnresolved: 0,
    countable: 0,
  }
  for (const entry of entries) {
    const mark = classifyCampaignEntry(entry, options)
    if (mark.staffUnresolved) summary.staffUnresolved += 1
    else if (mark.staff) summary.staffRows += 1
    if (mark.beforeWindow) summary.beforeWindow += 1
    if (mark.afterWindow) summary.afterWindow += 1
    if (mark.autoReceipt) summary.autoReceipt += 1
    if (mark.awarded) summary.awarded += 1
  }
  summary.countable = summary.staffUnresolved > 0 ? null : summary.autoReceipt
  return summary
}

export function csvExportDecision(total, max = CAMPAIGN_ADMIN_CSV_MAX_ROWS) {
  const count = Number(total) || 0
  if (count > max) return { ok: false, total: count, limit: max }
  return { ok: true, total: count, limit: max }
}

/** Stop spreadsheet formula injection in CSV cells. */
export function csvSafeCell(value) {
  let text = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`
  return text
}

export function buildCampaignEntriesCsv(rows = []) {
  const headers = [
    'id',
    'campaign_id',
    'status',
    'auto_receipt',
    'awarded',
    'survey_completed',
    'sns_url',
    'applied_at',
    'signup_utm_source',
    'signup_utm_medium',
    'signup_utm_campaign',
    'staff',
    'staff_unresolved',
    'before_window',
    'after_window',
  ]
  const lines = [headers.join(',')]
  for (const row of rows) {
    const mark = classifyCampaignEntry(row)
    lines.push([
      row.id,
      row.campaign_id,
      row.status,
      mark.autoReceipt ? '1' : '0',
      mark.awarded ? '1' : '0',
      row.survey_completed_at ? '1' : '0',
      row.sns_url,
      row.applied_at,
      row.signup_utm_source,
      row.signup_utm_medium,
      row.signup_utm_campaign,
      mark.staff ? '1' : '0',
      mark.staffUnresolved ? '1' : '0',
      mark.beforeWindow ? '1' : '0',
      mark.afterWindow ? '1' : '0',
    ].map(csvSafeCell).join(','))
  }
  return lines.join('\n')
}
