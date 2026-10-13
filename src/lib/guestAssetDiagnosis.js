/** Guest / pre-signup 3-question answer summary. Not a score and not portfolio advice. */

import {
  ONBOARDING_ASSET_MIX_OPTIONS,
  ONBOARDING_HORIZON_OPTIONS,
  ONBOARDING_RISK_TOLERANCE_OPTIONS,
} from './investorOnboardingOptions'

export const GUEST_DIAG_DRAFT_KEY = 'mm_guest_diag_draft_v1'
export const GUEST_DIAG_RESULT_KEY = 'mm_guest_diag_result_v1'

function labelFor(options, value) {
  return options.find((opt) => opt.value === value)?.label || '未回答'
}

export function buildGuestDiagnosisResult(answers) {
  const { assetMix, riskTolerance, horizon } = answers || {}
  return {
    headline: '回答の整理',
    summary: '保有銘柄は見ていません。下は今回の3つの回答です。',
    assetMixLabel: labelFor(ONBOARDING_ASSET_MIX_OPTIONS, assetMix),
    riskLabel: labelFor(ONBOARDING_RISK_TOLERANCE_OPTIONS, riskTolerance),
    horizonLabel: labelFor(ONBOARDING_HORIZON_OPTIONS, horizon),
    answers: { assetMix, riskTolerance, horizon },
    computedAt: new Date().toISOString(),
  }
}

export function saveGuestDiagnosisDraft(answers) {
  try {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(GUEST_DIAG_DRAFT_KEY, JSON.stringify(answers))
  } catch {
    // ignore
  }
}

export function loadGuestDiagnosisDraft() {
  try {
    if (typeof window === 'undefined') return null
    const raw = window.sessionStorage.getItem(GUEST_DIAG_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function saveGuestDiagnosisResult(result) {
  try {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(GUEST_DIAG_RESULT_KEY, JSON.stringify(result))
  } catch {
    // ignore
  }
}

export function clearGuestDiagnosisSession() {
  try {
    if (typeof window === 'undefined') return
    window.sessionStorage.removeItem(GUEST_DIAG_DRAFT_KEY)
    window.sessionStorage.removeItem(GUEST_DIAG_RESULT_KEY)
  } catch {
    // ignore
  }
}
