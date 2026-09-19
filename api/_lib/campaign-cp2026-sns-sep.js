import {
  CAMPAIGN_CP2026_SNS_SEP_END_MS,
  CAMPAIGN_CP2026_SNS_SEP_ID,
  CAMPAIGN_CP2026_SNS_SEP_START_MS,
  CAMPAIGN_CP2026_SNS_SEP_SURVEY_QUESTIONS,
  isCampaignCp2026StaffTester,
} from '../../src/constants/campaignCp2026SnsSep.js'
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

export function parseSnsSubmission({ sns_url: snsUrlRaw, sns_platform: platformRaw }) {
  const urlText = String(snsUrlRaw || '').trim()
  if (!urlText) {
    const err = new Error('投稿URLを入力してください')
    err.status = 400
    throw err
  }
  let parsed
  try {
    parsed = new URL(urlText.startsWith('http') ? urlText : `https://${urlText}`)
  } catch {
    const err = new Error('投稿URLの形式が正しくありません')
    err.status = 400
    throw err
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
  let platform = String(platformRaw || '').trim().toLowerCase()
  if (host === 'note.com' || host.endsWith('.note.com')) {
    platform = 'note'
  } else if (host === 'x.com' || host === 'twitter.com' || host.endsWith('.x.com')) {
    platform = 'twitter'
  } else {
    const err = new Error('X または Note の公開投稿URLを入力してください')
    err.status = 400
    throw err
  }
  if (platform !== 'twitter' && platform !== 'note') {
    const err = new Error('プラットフォームを選択してください')
    err.status = 400
    throw err
  }
  return {
    sns_url: parsed.toString().slice(0, 1000),
    sns_platform: platform,
  }
}

export async function loadOrCreateCampaignEntry(admin, userId) {
  const { data: existing, error: selErr } = await admin
    .from('campaign_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('campaign_id', CAMPAIGN_CP2026_SNS_SEP_ID)
    .maybeSingle()
  if (selErr) throw selErr
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
  if (insErr) throw insErr
  return inserted
}

export function buildCampaignStatusPayload({ entry, hasAsset, windowMeta }) {
  const surveyDone = Boolean(entry?.survey_completed_at)
  const snsDone = Boolean(entry?.sns_submitted_at)
  const applied = Boolean(entry?.applied_at) || entry?.status === 'eligible' || entry?.status === 'rewarded'
  return {
    ok: true,
    window: windowMeta,
    steps: {
      signedUp: true,
      hasAsset,
      surveyDone,
      snsDone,
      applied,
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
