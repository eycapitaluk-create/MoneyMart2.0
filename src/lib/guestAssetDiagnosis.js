/** Guest / pre-signup 3-question profile diagnosis (not full portfolio AI). */

export const GUEST_DIAG_DRAFT_KEY = 'mm_guest_diag_draft_v1'
export const GUEST_DIAG_RESULT_KEY = 'mm_guest_diag_result_v1'

const clamp = (n, min, max) => Math.min(max, Math.max(min, n))

export function computeGuestDiagnosisScore({ assetMix = '', riskTolerance = '', horizon = '' }) {
  let score = 52
  const growthAsset = ['little_invested', 'balanced', 'mostly_invested'].includes(assetMix)
  const cashHeavy = assetMix === 'mostly_cash'
  const growthRisk = ['moderate', 'growth_seeking', 'aggressive'].includes(riskTolerance)
  const conservativeRisk = ['very_conservative', 'conservative'].includes(riskTolerance)
  const longHorizon = ['years_3_10', 'years_10_plus'].includes(horizon)
  const shortHorizon = horizon === 'under_3y'

  if (cashHeavy && conservativeRisk) score += 20
  if (growthAsset && growthRisk && longHorizon) score += 24
  if (assetMix === 'balanced' && riskTolerance === 'moderate') score += 16
  if (cashHeavy && growthRisk) score -= 10
  if (growthAsset && conservativeRisk && !longHorizon) score -= 8
  if (growthAsset && riskTolerance === 'aggressive' && shortHorizon) score -= 14
  if (assetMix === 'unsure_asset' || riskTolerance === 'unsure_risk' || horizon === 'unsure_horizon') score -= 6

  return clamp(Math.round(score), 40, 86)
}

export function getGuestDiagnosisGrade(score) {
  const s = clamp(Number(score) || 0, 0, 100)
  if (s >= 75) return 'B+'
  if (s >= 65) return 'B'
  if (s >= 55) return 'C+'
  return 'C'
}

export function buildGuestDiagnosisResult(answers) {
  const { assetMix, riskTolerance, horizon } = answers || {}
  const score = computeGuestDiagnosisScore(answers)
  const grade = getGuestDiagnosisGrade(score)

  const growthAsset = ['little_invested', 'balanced', 'mostly_invested'].includes(assetMix)
  const cashHeavy = assetMix === 'mostly_cash'
  const growthRisk = ['moderate', 'growth_seeking', 'aggressive'].includes(riskTolerance)
  const conservativeRisk = ['very_conservative', 'conservative'].includes(riskTolerance)
  const longHorizon = ['years_3_10', 'years_10_plus'].includes(horizon)

  let headline = 'バランスを確認する余地があります'
  let summary = '回答内容をもとに、いまの資産プロフィールの方向性を整理しました。無料マイページで結果を保存し、保有を登録するとより具体的な分析が可能です。'
  let focus = '分散とリスクの見直し'

  if (cashHeavy && conservativeRisk) {
    headline = '安定志向のプロフィールです'
    summary = '現金・低リスク寄りの構成に合うスタンスと読み取れます。長期目標に合わせて、段階的な分散を検討する余地があります。'
    focus = '段階的な資産配分'
  } else if (growthAsset && growthRisk && longHorizon) {
    headline = '成長志向と期間がよく揃っています'
    summary = '投資中心・長期志向の組み合わせです。ボラティリティ許容と保有銘柄の分散を、マイページで継続確認するのがおすすめです。'
    focus = 'セクター・地域分散'
  } else if (growthAsset && conservativeRisk) {
    headline = 'リスク許容と資産構成にギャップがありそうです'
    summary = '投資比率はある一方、リスク許容は控えめです。下落時の心理的負担を想定し、配分や商品選定を見直す余地があります。'
    focus = 'リスクと配分の整合'
  } else if (cashHeavy && growthRisk) {
    headline = '攻めのスタンスに対し、現金比率が高めです'
    summary = 'リスク許容は高めですが、資産は現金中心に見えます。目的と期間に合わせて、投資比率を少しずつ整える選択肢があります。'
    focus = '投資比率のステップアップ'
  }

  return {
    score,
    grade,
    headline,
    summary,
    focus,
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
