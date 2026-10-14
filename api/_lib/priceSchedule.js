import { dashboardTargets } from './yahooPricePlan.js'
export function priceScheduleGate(params, now = new Date()) {
  const date = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const start = params.get('start_date')
  const only = params.get('only_date')
  if ((start && !/^\d{4}-\d{2}-\d{2}$/.test(start)) || (only && !/^\d{4}-\d{2}-\d{2}$/.test(only))) return { run: false, reason: 'invalid_schedule_date' }
  if (only && date !== only) return { run: false, reason: 'transition_expired' }
  if (start && date < start) return { run: false, reason: 'new_schedule_starts_tomorrow' }
  return { run: true }
}
export function scopedDashboardTargets(scope, now = new Date()) {
  return dashboardTargets(now).filter(row => scope === 'fx' ? row.category === 'fx' : row.category !== 'fx')
}

// A partially collected session needs source review, not another same-session batch.
// Match the exact symbols and trade dates so the next trading session still runs.
export function incompleteBatchAlreadyAttempted(jobs, targets, scope, batch) {
  if (!['us', 'jp', 'etf'].includes(scope)) return false
  const expected = targets.filter(t => !t.held && t.symbol && t.expectedDate)
  if (!expected.length) return false
  return (jobs || []).some(job => {
    const meta = job?.meta || {}
    if (meta.scope !== scope || Number(meta.batch || 0) !== batch) return false
    if (!['partial', 'failed'].includes(meta.completeness) || !Array.isArray(meta.backup)) return false
    const review = meta.price_source_review
    if (review?.decision === 'allow_one_recovery_after_source_review'
      && ['regular_session_quote_close_v1', 'regular_session_quote_close_v2'].includes(review?.parser_version)
      && review?.reviewed_at && review?.evidence_url
      && expected.every(t => t.expectedDate === review.trade_date)) return false
    const attempted = new Set(meta.backup.map(row => `${row.symbol}|${String(row.trade_date).slice(0, 10)}`))
    return expected.every(t => attempted.has(`${t.symbol}|${t.expectedDate}`))
  })
}
