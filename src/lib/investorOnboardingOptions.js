/** 登録時アンケ用（助言ではなく自己申告の分類）。DB / analytics は value を使用 */

export const ONBOARDING_ASSET_MIX_OPTIONS = [
  { value: 'mostly_cash', label: '預金・現金がほとんど（投資経験はほぼない）' },
  { value: 'little_invested', label: '投資・積立を一部行っている' },
  { value: 'balanced', label: '預金と投資がだいたい半々くらい' },
  { value: 'mostly_invested', label: '投資・証券が中心（預金は運用資金程度）' },
  { value: 'unsure_asset', label: 'はっきり分けていない・分からない' },
]

export const ONBOARDING_RISK_TOLERANCE_OPTIONS = [
  { value: 'very_conservative', label: '元本欠損は極力避けたい' },
  { value: 'conservative', label: '少しの変動は許容し、安定寄り' },
  { value: 'moderate', label: '損益のブレはある程度許容する' },
  { value: 'growth_seeking', label: '長期的な成長を重視（変動も許容）' },
  { value: 'aggressive', label: '高いリターン志向（大きな下落も許容しうる）' },
  { value: 'unsure_risk', label: 'まだ分からない' },
]

export const ONBOARDING_HORIZON_OPTIONS = [
  { value: 'under_3y', label: '3年未満' },
  { value: 'years_3_10', label: '3〜10年程度' },
  { value: 'years_10_plus', label: '10年以上' },
  { value: 'retired_drawdown', label: '退休後・取り崩し中心' },
  { value: 'unsure_horizon', label: 'まだ決めていない' },
]

export function isCompleteOnboardingRow(row) {
  if (!row) return false
  const a = String(row.onboarding_asset_mix || '').trim()
  const r = String(row.onboarding_risk_tolerance || '').trim()
  const h = String(row.onboarding_investment_horizon || '').trim()
  return Boolean(a && r && h)
}
