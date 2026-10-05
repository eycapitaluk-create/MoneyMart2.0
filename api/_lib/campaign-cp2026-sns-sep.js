import {
  CAMPAIGN_APPLY_ACCEPTED_MESSAGE,
  CAMPAIGN_APPLY_REJECTED_MESSAGE,
  CAMPAIGN_CP2026_SNS_SEP_END_MS,
  CAMPAIGN_CP2026_SNS_SEP_ID,
  CAMPAIGN_CP2026_SNS_SEP_START_MS,
  CAMPAIGN_CP2026_SNS_SEP_SURVEY_QUESTIONS,
  isCampaignCp2026StaffTester,
} from '../../src/constants/campaignCp2026SnsSep.js'

export {
  CAMPAIGN_APPLY_ACCEPTED_MESSAGE,
  CAMPAIGN_APPLY_REJECTED_MESSAGE,
}
import { surveyQuestionVisible } from '../../src/lib/campaignSurveyUtils.js'

export { CAMPAIGN_CP2026_SNS_SEP_ID }

export function isCampaignPreviewEnabled() {
  return String(process.env.CAMPAIGN_CP2026_SNS_PREVIEW || '').trim().toLowerCase() === 'true'
}

export function getCampaignWindowMeta(now = new Date(), userEmail = '') {
  const t = now.getTime()
  const preview = isCampaignPreviewEnabled()
  const inWindow = t >= CAMPAIGN_CP2026_SNS_SEP_START_MS && t <= CAMPAIGN_CP2026_SNS_SEP_END_MS
  const staffTest = isCampaignCp2026StaffTester(userEmail)
  const active = preview || inWindow || staffTest
  return {
    campaignId: CAMPAIGN_CP2026_SNS_SEP_ID,
    active,
    preview,
    staffTest,
    inWindow,
    startsAt: new Date(CAMPAIGN_CP2026_SNS_SEP_START_MS).toISOString(),
    endsAt: new Date(CAMPAIGN_CP2026_SNS_SEP_END_MS).toISOString(),
    now: now.toISOString(),
  }
}

export function assertCampaignActive(now = new Date(), userEmail = '') {
  const { active } = getCampaignWindowMeta(now, userEmail)
  if (!active) {
    const err = new Error('キャンペーン期間外です（2026年10月1日〜10月30日）')
    err.status = 403
    throw err
  }
}

export async function userHasCampaignAsset(admin, userId) {
  const tables = [
    'user_watchlists',
    'user_owned_stocks',
    'user_owned_funds',
    'user_asset_positions',
  ]
  for (const table of tables) {
    const { data, error } = await admin.from(table).select('id').eq('user_id', userId).limit(1)
    if (error && !/does not exist|relation/i.test(String(error.message || ''))) {
      throw error
    }
    if (Array.isArray(data) && data.length > 0) return true
  }
  return false
}

export function normalizeSurveyAnswers(raw = {}) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const out = {}
  for (const q of CAMPAIGN_CP2026_SNS_SEP_SURVEY_QUESTIONS) {
    if (q.type === 'section') continue
    if (!surveyQuestionVisible(q, src)) continue

    const val = src[q.id]

    if (q.type === 'multiselect') {
      const allowed = (q.options || []).map((o) => o.value)
      const arr = Array.isArray(val) ? val : (val ? [val] : [])
      const cleaned = [...new Set(arr.map((v) => String(v).trim()).filter((v) => allowed.includes(v)))]
      if (q.required && cleaned.length === 0) {
        const err = new Error(`アンケート「${q.label}」が未入力です`)
        err.status = 400
        throw err
      }
      if (cleaned.length > 0) out[q.id] = cleaned
      if (q.otherFieldId && cleaned.includes('other')) {
        const otherText = String(src[q.otherFieldId] ?? '').trim().slice(0, 300)
        if (otherText) out[q.otherFieldId] = otherText
      }
      continue
    }

    if (q.type === 'scale') {
      const n = Number(val)
      if (!Number.isFinite(n) || n < q.min || n > q.max) {
        if (q.required) {
          const err = new Error(`アンケート「${q.label}」が未入力です`)
          err.status = 400
          throw err
        }
        continue
      }
      out[q.id] = n
      continue
    }

    if (q.type === 'text') {
      const s = String(val ?? '').trim().slice(0, q.maxLength || 500)
      if (!s && q.required) {
        const err = new Error(`アンケート「${q.label}」が未入力です`)
        err.status = 400
        throw err
      }
      if (s) out[q.id] = s
      continue
    }

    const s = String(val ?? '').trim()
    const allowed = (q.options || []).map((o) => o.value)
    if (!s || !allowed.includes(s)) {
      if (q.required) {
        const err = new Error(`アンケート「${q.label}」が未入力です`)
        err.status = 400
        throw err
      }
      continue
    }
    out[q.id] = s
  }
  return out
}

const TWITTER_POST_HOSTS = new Set(['x.com', 'twitter.com'])
const NOTE_POST_HOSTS = new Set(['note.com'])

function campaignSnsError(message) {
  const err = new Error(message)
  err.status = 400
  return err
}

/** X/Twitter status id, or a Note article path. Domain home and profile URLs are not posts. */
export function parseSnsSubmission({ sns_url: snsUrlRaw }) {
  const urlText = String(snsUrlRaw || '').trim()
  if (!urlText) throw campaignSnsError('投稿URLを入力してください')
  let parsed
  try {
    parsed = new URL(urlText.startsWith('http') ? urlText : `https://${urlText}`)
  } catch {
    throw campaignSnsError('投稿URLの形式が正しくありません')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw campaignSnsError('投稿URLの形式が正しくありません')
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
  const path = parsed.pathname || '/'
  let platform = ''
  if (NOTE_POST_HOSTS.has(host)) {
    if (!/\/n\/n[a-z0-9]{6,}(?:\/|$)/i.test(path)) {
      throw campaignSnsError('Noteの記事URLを入力してください（note.comのホームやプロフィールは対象外です）')
    }
    platform = 'note'
  } else if (TWITTER_POST_HOSTS.has(host)) {
    if (!/\/status\/\d{10,}(?:\/|$)/.test(path)) {
      throw campaignSnsError('Xの投稿URLを入力してください（x.comのホームやプロフィールは対象外です）')
    }
    platform = 'twitter'
  } else {
    throw campaignSnsError('X または Note の公開投稿URLを入力してください')
  }
  return {
    sns_url: parsed.toString().slice(0, 1000),
    sns_platform: platform,
  }
}

export function applicationInstantMs(entry) {
  const parsed = Date.parse(entry?.applied_at || '')
  return Number.isFinite(parsed) ? parsed : null
}

/** July (and any pre-window) rows stay stored. They are not this October application. */
export function isPriorCampaignApplication(entry, startMs = CAMPAIGN_CP2026_SNS_SEP_START_MS) {
  const appliedMs = applicationInstantMs(entry)
  return appliedMs != null && appliedMs < startMs
}

export function isCurrentWindowApplication(
  entry,
  startMs = CAMPAIGN_CP2026_SNS_SEP_START_MS,
  endMs = CAMPAIGN_CP2026_SNS_SEP_END_MS,
) {
  const appliedMs = applicationInstantMs(entry)
  if (appliedMs == null || appliedMs < startMs || appliedMs > endMs) return false
  const status = String(entry?.status || '')
  return status === 'eligible' || status === 'rewarded'
}

export function decideCampaignApply(entry) {
  const status = String(entry?.status || '')
  if (status === 'rejected') {
    return { action: 'reject', httpStatus: 409, code: 'apply_rejected', message: CAMPAIGN_APPLY_REJECTED_MESSAGE }
  }
  if (isCurrentWindowApplication(entry)) {
    return {
      action: 'noop',
      httpStatus: 200,
      message: status === 'rewarded' ? 'すでに特典付与済みです' : CAMPAIGN_APPLY_ACCEPTED_MESSAGE,
    }
  }
  return { action: 'promote', httpStatus: 200, message: CAMPAIGN_APPLY_ACCEPTED_MESSAGE }
}

export function isCampaignEntryUniqueViolation(error) {
  const code = String(error?.code || '')
  const msg = String(error?.message || '')
  return code === '23505' || /duplicate key|unique constraint/i.test(msg)
}

async function selectCampaignEntry(admin, userId) {
  const { data, error } = await admin
    .from('campaign_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('campaign_id', CAMPAIGN_CP2026_SNS_SEP_ID)
    .maybeSingle()
  if (error) throw error
  return data || null
}

export async function loadOrCreateCampaignEntry(admin, userId) {
  const existing = await selectCampaignEntry(admin, userId)
  if (existing) return existing

  const { data: profile } = await admin
    .from('user_profiles')
    .select('signup_utm_source,signup_utm_medium,signup_utm_campaign')
    .eq('user_id', userId)
    .maybeSingle()

  const row = {
    user_id: userId,
    campaign_id: CAMPAIGN_CP2026_SNS_SEP_ID,
    status: 'draft',
    signup_utm_source: profile?.signup_utm_source || null,
    signup_utm_medium: profile?.signup_utm_medium || null,
    signup_utm_campaign: profile?.signup_utm_campaign || null,
  }
  const { data: inserted, error: insErr } = await admin
    .from('campaign_entries')
    .insert(row)
    .select('*')
    .single()
  if (!insErr) return inserted
  if (isCampaignEntryUniqueViolation(insErr)) {
    const raced = await selectCampaignEntry(admin, userId)
    if (raced) return raced
  }
  throw insErr
}

export function buildCampaignStatusPayload({ entry, hasAsset, windowMeta }) {
  const surveyDone = Boolean(entry?.survey_completed_at)
  const snsDone = Boolean(entry?.sns_submitted_at)
  const applied = isCurrentWindowApplication(entry)
  const awarded = applied && entry?.status === 'rewarded'
  return {
    ok: true,
    window: windowMeta,
    steps: {
      signedUp: true,
      hasAsset,
      surveyDone,
      snsDone,
      applied,
      awarded,
    },
    entry: entry
      ? {
          status: entry.status,
          survey_completed_at: entry.survey_completed_at,
          survey_answers: entry.survey_answers || null,
          sns_submitted_at: entry.sns_submitted_at,
          sns_url: entry.sns_url,
          sns_platform: entry.sns_platform,
          applied_at: entry.applied_at,
        }
      : null,
  }
}
