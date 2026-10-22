/** Evidence-led CRM narrative. No external API call or automatic spend decision. */
export function buildCrmExecutiveSummary({ rangeDays = 30, analysis = null } = {}) {
  if (!analysis?.coverage?.customerReady) return { headline: 'Customer data is not confirmed',
    bullets: analysis?.coverage?.issues || ['Load CRM data before interpreting signup counts.'], actions: ['Refresh the failed or missing source; do not interpret it as zero customers.'], severity: 'warn' }
  const c = analysis.current, cov = analysis.coverage, sessions = analysis.sessions
  const partial = cov.currentComplete ? '' : 'at least '
  const headline = `${partial}${c.n} signups in ${rangeDays}d · ${analysis.constraint === 'observation' ? '7-day observation in progress' : `review: ${analysis.constraint}`}`
  const bullets = [analysis.constraintNote]
  if (sessions != null) bullets.push(`${sessions.toLocaleString('en-US')} sessions and ${c.n} signups recorded. Session/signup ratios are directional, not matched-user conversion.`)
  const m = c.matured
  if (m.n) bullets.push(`7-day activation: ${m.activated}/${m.n} (${m.activationPct}%). ${c.pending} recent signups still observing.`)
  if (m.activationWilson) bullets.push(`Activation 95% interval ${m.activationWilson.lowPct}–${m.activationWilson.highPct}%${m.n < analysis.minN ? '; sample too small for channel ranking' : ''}.`)
  if (analysis.pop.comparable && analysis.pop.signups.deltaPct != null) bullets.push(`Signups ${analysis.pop.signups.deltaPct >= 0 ? '+' : ''}${analysis.pop.signups.deltaPct}% vs the prior ${rangeDays}d. Rate changes use percentage points.`)
  const actionsByConstraint = {
    measurement: ['Check source availability and loaded date coverage first; then confirm UTM and first-touch capture.'],
    volume: ['Review the leading landing pages and tagged acquisition links; collect more observations before changing spend.'],
    conversion: ['Walk through the leading mobile landing → registration path and record the exact step that fails.'],
    observation: ['Recheck after the pending signups complete their 7-day window; compare eligible cohorts only.'],
    activation: ['Inspect the first search, product view or watchlist action for eligible signups; test one onboarding improvement.'],
    concentration: ['Check whether concentration reflects known sources or missing attribution; test one alternative channel with tagged links.'],
    experiment: ['Run one small, tagged experiment and define its eligible cohort and success metric before changing spend.'],
  }
  return { headline, bullets: [...bullets, ...cov.issues].slice(0, 6), actions: actionsByConstraint[analysis.constraint] || actionsByConstraint.volume,
    severity: ['measurement','conversion','activation'].includes(analysis.constraint) ? 'warn' : 'ok' }
}
