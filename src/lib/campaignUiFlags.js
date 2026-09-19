import {
  CAMPAIGN_CP2026_SNS_SEP_END_MS,
  CAMPAIGN_CP2026_SNS_SEP_START_MS,
  isCampaignCp2026StaffTester,
} from '../constants/campaignCp2026SnsSep.js'

const readPreviewFlag = () => {
  try {
    return String(import.meta.env?.VITE_CAMPAIGN_CP2026_SNS_PREVIEW || '').trim().toLowerCase() === 'true'
  } catch {
    return false
  }
}

function inCampaignWindow(now = new Date()) {
  const t = now.getTime()
  return t >= CAMPAIGN_CP2026_SNS_SEP_START_MS && t <= CAMPAIGN_CP2026_SNS_SEP_END_MS
}

/**
 * 公開導線の表示判定
 * - 本番期間（2026/10/1〜10/30 JST）
 * - VITE_CAMPAIGN_CP2026_SNS_PREVIEW=true（全員プレビュー）
 * - allowStaffReview=true かつ社内テストメール → 期間前でもバナー等レビュー用に表示
 *
 * ナビ/フッターは allowStaffReview なし（一般ユーザーと同じく期間まで非表示）
 */
export function isCampaignCp2026SnsSepUiVisible({
  now = new Date(),
  userEmail = '',
  allowStaffReview = false,
} = {}) {
  if (readPreviewFlag()) return true
  if (inCampaignWindow(now)) return true
  if (allowStaffReview && isCampaignCp2026StaffTester(userEmail)) return true
  return false
}

/**
 * キャンペーンページ直アクセス可否（社内テストメールは期間外でも可）
 */
export function isCampaignCp2026SnsSepPageAccessible({ now = new Date(), userEmail = '' } = {}) {
  return isCampaignCp2026SnsSepUiVisible({ now, userEmail, allowStaffReview: true })
}
