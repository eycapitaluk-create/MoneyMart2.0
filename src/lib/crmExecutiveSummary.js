/** Rule-based CRM narrative driven by advanced analysis (no API). */

export function buildCrmExecutiveSummary({
  rangeDays = 30,
  sales = {},
  signupChannels = [],
  trafficSummary = {},
  analysis = null,
} = {}) {
  const range = Number(rangeDays) || 30
  const signups = Number(sales.signups || analysis?.current?.n || 0)
  const sessions = Number(trafficSummary.uniqueSessions || 0)
  const bullets = []
  const actions = []

  if (signups === 0) {
    return {
      headline: `No customer signups in ${range}d`,
      bullets: [
        `${sessions.toLocaleString('en-US')} sessions in range — the gap is visit→signup, not traffic volume.`,
      ],
      actions: ['Trace the signup path from the top landing pages; do not scale untagged spend.'],
      severity: 'warn',
    }
  }

  const pop = analysis?.pop
  const signupDelta = pop?.signups?.deltaPct
  const constraint = analysis?.constraint
  const top = analysis?.concentration?.topChannel
  const topShare = analysis?.concentration?.top1Share
  const best = analysis?.bestReliable
  const hhi = analysis?.concentration?.hhi
  const act = analysis?.current?.activationWilson

  const deltaBit = signupDelta == null ? '' : ` · ${signupDelta >= 0 ? '+' : ''}${signupDelta}% vs prior ${range}d`
  const headline = constraint
    ? `${signups} signups${deltaBit} · constraint: ${constraint}`
    : `${signups} signups in ${range}d`

  if (analysis?.constraintNote) bullets.push(analysis.constraintNote)
  if (top && topShare != null) {
    bullets.push(`Concentration: ${top} is ${topShare}% of signups (HHI ${hhi}).`)
  }
  if (act) {
    bullets.push(
      act.unreliable
        ? `Activation ${act.ratePct}% but n=${analysis.current.n} < ${analysis.minN} — interval is wide (${act.lowPct}–${act.highPct}%).`
        : `Activation ${act.ratePct}% (95% Wilson ${act.lowPct}–${act.highPct}%).`,
    )
  }
  if (best) {
    bullets.push(`Best reliable channel: ${best.label} (quality ${best.quality}, ${best.activationPct}% activated, n=${best.signups}).`)
  }
  if (pop?.truncated) {
    bullets.push('Prior-period compare may be truncated — CRM load is a recent-user batch, not a full history.')
  }

  if (constraint === 'measurement') actions.push('Stop optimizing channel mix until UTM/first-touch coverage is above 60%.')
  if (constraint === 'activation') actions.push('Hold acquisition spend; fix Day-0 onboarding on the largest signup channel.')
  if (constraint === 'conversion') actions.push('Audit the mobile landing → signup path before buying more sessions.')
  if (constraint === 'concentration' && analysis?.bestReliable && analysis.bestReliable.label !== top) {
    actions.push(`Shift incremental spend toward ${analysis.bestReliable.label}, not the largest volume channel.`)
  }
  if (constraint === 'scale' && best) {
    actions.push(`Scale ${best.label} with tagged links; keep Direct/unknown under 40%.`)
  }
  if (!actions.length) actions.push('Keep tagging every outbound link; re-read weekly cohorts before changing mix.')

  return {
    headline,
    bullets: bullets.slice(0, 5),
    actions: [...new Set(actions)].slice(0, 3),
    severity: constraint === 'measurement' || constraint === 'activation' || (sales.attributionPct ?? 100) < 45
      ? 'warn'
      : 'ok',
  }
}
