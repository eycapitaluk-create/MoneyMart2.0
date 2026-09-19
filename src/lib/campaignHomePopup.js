import { isCampaignCp2026StaffTester } from '../constants/campaignCp2026SnsSep.js'

const DISMISS_DAY_KEY = 'mm_campaign_cp2026_popup_dismiss_day_v3'
const DISMISS_SESSION_KEY = 'mm_campaign_cp2026_popup_dismiss_session_v3'

function jstDayKey(now = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(now)
  } catch {
    return now.toISOString().slice(0, 10)
  }
}

export function isCampaignHomePopupForceOpen() {
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search || '')
    return params.get('mm_campaign_popup') === '1'
  } catch {
    return false
  }
}

export function shouldShowCampaignCp2026HomePopup({ userEmail = '' } = {}) {
  if (typeof window === 'undefined') return false
  if (isCampaignHomePopupForceOpen()) return true

  const staff = isCampaignCp2026StaffTester(userEmail)

  try {
    if (window.sessionStorage.getItem(DISMISS_SESSION_KEY) === '1') return false
    // 社内テスト中は「今日は表示しない」を無視（セッション閉じるまでのみ非表示）
    if (!staff && window.localStorage.getItem(DISMISS_DAY_KEY) === jstDayKey()) return false
  } catch {
    return true
  }
  return true
}

export function dismissCampaignCp2026HomePopupForSession() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(DISMISS_SESSION_KEY, '1')
  } catch {
    // ignore
  }
}

export function dismissCampaignCp2026HomePopupForToday() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DISMISS_DAY_KEY, jstDayKey())
    window.sessionStorage.setItem(DISMISS_SESSION_KEY, '1')
  } catch {
    // ignore
  }
}

export function clearCampaignCp2026HomePopupDismiss() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(DISMISS_SESSION_KEY)
    window.localStorage.removeItem(DISMISS_DAY_KEY)
    // 旧キーも掃除
    window.sessionStorage.removeItem('mm_campaign_cp2026_popup_dismiss_session_v1')
    window.localStorage.removeItem('mm_campaign_cp2026_popup_dismiss_day_v1')
    window.sessionStorage.removeItem('mm_campaign_cp2026_popup_dismiss_session_v2')
    window.localStorage.removeItem('mm_campaign_cp2026_popup_dismiss_day_v2')
  } catch {
    // ignore
  }
}
