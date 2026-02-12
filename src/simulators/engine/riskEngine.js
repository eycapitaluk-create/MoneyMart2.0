import { SIM_ASSUMPTIONS } from '../config/assumptions.default'

const clamp = (v, min = 0, max = 100) => Math.min(max, Math.max(min, Number(v || 0)))

export const calculateRiskScore = ({
  volatilityRisk,
  breadthRisk,
  flowRisk,
  fxRisk,
}) => {
  const w = SIM_ASSUMPTIONS.risk.weights
  const weightedRisk =
    clamp(volatilityRisk) * w.volatility +
    clamp(breadthRisk) * w.breadth +
    clamp(flowRisk) * w.flow +
    clamp(fxRisk) * w.fx

  const score = Math.round(clamp(100 - weightedRisk))
  if (score >= 70) {
    return { score, status: 'Risk On', desc: 'リスク許容が高い局面。成長資産の比率を検討。' }
  }
  if (score >= 40) {
    return { score, status: 'Neutral', desc: '中立局面。分散を維持しつつ段階的に配分調整。' }
  }
  return { score, status: 'Risk Off', desc: '守り重視局面。ボラティリティ管理を優先。' }
}
