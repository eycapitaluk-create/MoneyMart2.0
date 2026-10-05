/**
 * GET  /api/campaign/cp2026-sns-sep — 進捗・窓情報
 * POST /api/campaign/cp2026-sns-sep — action: survey | sns | apply
 */
import {
  assertCampaignActive,
  buildCampaignStatusPayload,
  CAMPAIGN_APPLY_ACCEPTED_MESSAGE,
  CAMPAIGN_APPLY_REJECTED_MESSAGE,
  decideCampaignApply,
  getCampaignWindowMeta,
  loadOrCreateCampaignEntry,
  normalizeSurveyAnswers,
  parseSnsSubmission,
  userHasCampaignAsset,
  CAMPAIGN_CP2026_SNS_SEP_ID,
} from '../_lib/campaign-cp2026-sns-sep.js'
import { applyPrivateNoStore } from '../_lib/private-no-store.js'
import {
  readJsonBody,
  requireSupabaseUser,
  sendBillingJson,
} from '../_lib/supabase-bearer-auth.js'
import { CAMPAIGN_CP2026_SNS_SEP_SURVEY_QUESTIONS } from '../../src/constants/campaignCp2026SnsSep.js'

export default async function handler(req, res) {
  applyPrivateNoStore(res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (req.method === 'GET') {
    try {
      const { user, admin } = await requireSupabaseUser(req)
      const windowMeta = getCampaignWindowMeta(new Date(), user.email)
      if (!windowMeta.active) {
        return sendBillingJson(res, 403, { ok: false, error: 'キャンペーン期間外です' })
      }
      const [entry, hasAsset] = await Promise.all([
        loadOrCreateCampaignEntry(admin, user.id),
        userHasCampaignAsset(admin, user.id),
      ])
      return sendBillingJson(res, 200, {
        ...buildCampaignStatusPayload({ entry, hasAsset, windowMeta }),
        surveyQuestions: CAMPAIGN_CP2026_SNS_SEP_SURVEY_QUESTIONS,
        campaignId: CAMPAIGN_CP2026_SNS_SEP_ID,
      })
    } catch (err) {
      return sendBillingJson(res, err.status || 500, { ok: false, error: err.message })
    }
  }

  if (req.method !== 'POST') {
    return sendBillingJson(res, 405, { ok: false, error: 'Method not allowed' })
  }

  let user
  let admin
  try {
    const auth = await requireSupabaseUser(req)
    user = auth.user
    admin = auth.admin
  } catch (err) {
    return sendBillingJson(res, err.status || 401, { ok: false, error: err.message })
  }

  let body = {}
  try {
    body = await readJsonBody(req)
  } catch {
    return sendBillingJson(res, 400, { ok: false, error: 'Invalid JSON body' })
  }

  const action = String(body.action || '').trim().toLowerCase()

  try {
    const windowMeta = getCampaignWindowMeta(new Date(), user.email)
    assertCampaignActive(new Date(), user.email)
    const entry = await loadOrCreateCampaignEntry(admin, user.id)

    if (action === 'survey') {
      const answers = normalizeSurveyAnswers(body.answers || body.survey_answers)
      const { data: updated, error } = await admin
        .from('campaign_entries')
        .update({
          survey_answers: answers,
          survey_completed_at: new Date().toISOString(),
        })
        .eq('id', entry.id)
        .eq('user_id', user.id)
        .eq('campaign_id', CAMPAIGN_CP2026_SNS_SEP_ID)
        .select('*')
        .single()
      if (error) throw error
      const hasAsset = await userHasCampaignAsset(admin, user.id)
      return sendBillingJson(res, 200, {
        ...buildCampaignStatusPayload({ entry: updated, hasAsset, windowMeta }),
        ok: true,
        message: 'アンケートを保存しました',
      })
    }

    if (action === 'sns') {
      const sns = parseSnsSubmission(body)
      const { data: updated, error } = await admin
        .from('campaign_entries')
        .update({
          sns_url: sns.sns_url,
          sns_platform: sns.sns_platform,
          sns_submitted_at: new Date().toISOString(),
        })
        .eq('id', entry.id)
        .eq('user_id', user.id)
        .eq('campaign_id', CAMPAIGN_CP2026_SNS_SEP_ID)
        .select('*')
        .single()
      if (error) throw error
      const hasAsset = await userHasCampaignAsset(admin, user.id)
      return sendBillingJson(res, 200, {
        ...buildCampaignStatusPayload({ entry: updated, hasAsset, windowMeta }),
        ok: true,
        message: '投稿URLを保存しました',
      })
    }

    if (action === 'apply') {
      const hasAsset = await userHasCampaignAsset(admin, user.id)
      if (!hasAsset) {
        return sendBillingJson(res, 400, {
          ok: false,
          code: 'asset_required',
          error: '関心または投資資産を1件以上登録してください',
        })
      }
      const fresh = await loadOrCreateCampaignEntry(admin, user.id)
      if (!fresh.survey_completed_at) {
        return sendBillingJson(res, 400, { ok: false, code: 'survey_required', error: 'アンケートにご回答ください' })
      }
      if (!fresh.sns_submitted_at || !fresh.sns_url) {
        return sendBillingJson(res, 400, { ok: false, code: 'sns_required', error: 'X または Note の投稿URLを入力してください' })
      }
      const decision = decideCampaignApply(fresh)
      if (decision.action === 'reject') {
        return sendBillingJson(res, decision.httpStatus, {
          ok: false,
          code: decision.code || 'apply_rejected',
          error: decision.message || CAMPAIGN_APPLY_REJECTED_MESSAGE,
        })
      }
      if (decision.action === 'noop') {
        return sendBillingJson(res, 200, {
          ...buildCampaignStatusPayload({ entry: fresh, hasAsset, windowMeta }),
          ok: true,
          message: decision.message,
        })
      }
      const { data: updated, error } = await admin
        .from('campaign_entries')
        .update({
          status: 'eligible',
          applied_at: fresh.applied_at || new Date().toISOString(),
        })
        .eq('id', fresh.id)
        .eq('user_id', user.id)
        .eq('campaign_id', CAMPAIGN_CP2026_SNS_SEP_ID)
        .eq('status', 'draft')
        .select('*')
        .single()
      if (error) {
        const missed = String(error.code || '') === 'PGRST116'
          || /0 rows|multiple \(or no\) rows/i.test(String(error.message || ''))
        if (!missed) throw error
        const raced = await loadOrCreateCampaignEntry(admin, user.id)
        const again = decideCampaignApply(raced)
        if (again.action === 'reject') {
          return sendBillingJson(res, again.httpStatus, {
            ok: false,
            code: again.code || 'apply_rejected',
            error: again.message,
          })
        }
        return sendBillingJson(res, 200, {
          ...buildCampaignStatusPayload({ entry: raced, hasAsset, windowMeta }),
          ok: true,
          message: again.message,
        })
      }
      return sendBillingJson(res, 200, {
        ...buildCampaignStatusPayload({ entry: updated, hasAsset, windowMeta }),
        ok: true,
        message: decision.message || CAMPAIGN_APPLY_ACCEPTED_MESSAGE,
      })
    }

    return sendBillingJson(res, 400, { ok: false, error: 'Unknown action' })
  } catch (err) {
    return sendBillingJson(res, err.status || 500, { ok: false, error: err.message })
  }
}
