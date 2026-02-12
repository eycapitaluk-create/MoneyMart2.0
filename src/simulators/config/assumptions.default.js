export const SIM_ASSUMPTIONS = {
  goal: {
    conservativeAnnualReturn: 0.03,
    balancedAnnualReturn: 0.05,
    aggressiveAnnualReturn: 0.08,
  },
  risk: {
    weights: {
      volatility: 0.35,
      breadth: 0.25,
      flow: 0.25,
      fx: 0.15,
    },
  },
}

export const getAnnualReturnByProfile = (profile = 'balanced') => {
  if (profile === 'conservative') return SIM_ASSUMPTIONS.goal.conservativeAnnualReturn
  if (profile === 'aggressive') return SIM_ASSUMPTIONS.goal.aggressiveAnnualReturn
  return SIM_ASSUMPTIONS.goal.balancedAnnualReturn
}
