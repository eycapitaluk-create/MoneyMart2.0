/** Reporting cap: ignore tab-idle / background inflation beyond 30 minutes per page_exit. */
export const ANALYTICS_DWELL_REPORT_CAP_MS = 30 * 60 * 1000

export const capDwellMsForReport = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(Math.round(n), ANALYTICS_DWELL_REPORT_CAP_MS)
}

export const medianDwellMs = (values = []) => {
  const nums = (Array.isArray(values) ? values : [])
    .map((v) => capDwellMsForReport(v))
    .filter((n) => n > 0)
    .sort((a, b) => a - b)
  if (nums.length === 0) return 0
  const mid = Math.floor(nums.length / 2)
  if (nums.length % 2) return nums[mid]
  return Math.round((nums[mid - 1] + nums[mid]) / 2)
}

export const avgCappedDwellMs = (values = []) => {
  const nums = (Array.isArray(values) ? values : [])
    .map((v) => capDwellMsForReport(v))
    .filter((n) => n > 0)
  if (nums.length === 0) return 0
  return Math.round(nums.reduce((sum, n) => sum + n, 0) / nums.length)
}

export const aggregateDwellStats = (values = []) => ({
  avg_dwell_ms: avgCappedDwellMs(values),
  median_dwell_ms: medianDwellMs(values),
  dwell_sample_count: (Array.isArray(values) ? values : []).filter((v) => capDwellMsForReport(v) > 0).length,
})
