import { getAnnualReturnByProfile } from '../config/assumptions.default'

export const calculateRequiredMonthlyContribution = ({
  targetAmount,
  currentAmount,
  years,
  riskProfile = 'balanced',
}) => {
  const annualRate = getAnnualReturnByProfile(riskProfile)
  const months = Math.max(1, Number(years || 0) * 12)
  const monthlyRate = annualRate / 12
  const safeTarget = Math.max(0, Number(targetAmount || 0))
  const safeCurrent = Math.max(0, Number(currentAmount || 0))
  const futureOfCurrent = safeCurrent * (1 + monthlyRate) ** months
  const requiredFutureFromContrib = Math.max(0, safeTarget - futureOfCurrent)
  if (monthlyRate === 0) return requiredFutureFromContrib / months
  const factor = ((1 + monthlyRate) ** months - 1) / monthlyRate
  return requiredFutureFromContrib / factor
}
