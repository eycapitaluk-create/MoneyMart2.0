import {
  ONBOARDING_ASSET_MIX_OPTIONS,
  ONBOARDING_HORIZON_OPTIONS,
  ONBOARDING_RISK_TOLERANCE_OPTIONS,
  isCompleteOnboardingRow,
} from './investorOnboardingOptions'
import { isCrmInternalUser } from './crmInternalUsers'

const JST = 'Asia/Tokyo'
const DOW_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const HOUR_BLOCK_LABELS = ['12am', '4am', '8am', '12pm', '4pm', '8pm']

const labelMap = (options) => Object.fromEntries(
  options.map((o) => [o.value, o.label]),
)

const ASSET_LABELS = labelMap(ONBOARDING_ASSET_MIX_OPTIONS)
const RISK_LABELS = labelMap(ONBOARDING_RISK_TOLERANCE_OPTIONS)
const HORIZON_LABELS = labelMap(ONBOARDING_HORIZON_OPTIONS)

const shortEn = (value, map, max = 42) => {
  const key = String(value || '').trim()
  if (!key) return '(not set)'
  const ja = map[key]
  if (!ja) return key.replace(/_/g, ' ')
  if (ja.length <= max) return ja
  const cuts = {
    mostly_cash: 'Mostly cash / savings',
    little_invested: 'Some investing',
    balanced: 'Cash & invest ~50/50',
    mostly_invested: 'Investments-focused',
    unsure_asset: 'Unsure (assets)',
    very_conservative: 'Very conservative',
    conservative: 'Conservative',
    moderate: 'Moderate risk',
    growth_seeking: 'Growth-oriented',
    aggressive: 'Aggressive',
    unsure_risk: 'Unsure (risk)',
    under_3y: 'Under 3 years',
    years_3_10: '3–10 years',
    years_10_plus: '10+ years',
    retired_drawdown: 'Retirement / drawdown',
    unsure_horizon: 'Unsure (horizon)',
  }
  return cuts[key] || ja.slice(0, max)
}

const toJstDowHour = (iso) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: JST,
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  })
  const parts = fmt.formatToParts(d)
  const wd = parts.find((p) => p.type === 'weekday')?.value || ''
  const hour = Number(parts.find((p) => p.type === 'hour')?.value)
  const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const dow = dowMap[wd]
  if (!Number.isInteger(dow) || !Number.isFinite(hour)) return null
  const monIndex = dow === 0 ? 6 : dow - 1
  const block = Math.min(5, Math.max(0, Math.floor(hour / 4)))
  return { monIndex, block, hour }
}

const isExternalEvent = (row) => {
  if (row?.user_id && row?.is_internal_user) return false
  return true
}

export const emptyCrmAudience = () => ({
  source: '',
  heatmap: [],
  heatmapMax: 0,
  peakLabel: '',
  deviceBreakdown: [],
  localeBreakdown: [],
  hourHistogram: [],
  onboarding: {
    totalCustomers: 0,
    withProfile: 0,
    assetMix: [],
    riskTolerance: [],
    horizon: [],
  },
  meta: { days: 28, timezone: JST },
})

const buildHeatmapGrid = (cells) => {
  const grid = Array.from({ length: 6 }, (_, block) => (
    Array.from({ length: 7 }, (_, monIndex) => ({
      monIndex,
      block,
      dowLabel: DOW_LABELS[monIndex],
      hourLabel: HOUR_BLOCK_LABELS[block],
      count: 0,
    }))
  ))
  let max = 0
  for (const c of cells) {
    const b = Number(c.block)
    const m = Number(c.mon_index ?? c.monIndex)
    const n = Number(c.count ?? c.events ?? 0)
    if (b >= 0 && b < 6 && m >= 0 && m < 7) {
      grid[b][m].count += n
      if (grid[b][m].count > max) max = grid[b][m].count
    }
  }
  const flat = grid.flat()
  const peak = flat.reduce((best, cell) => (cell.count > (best?.count || 0) ? cell : best), null)
  const peakLabel = peak?.count
    ? `${peak.dowLabel} ${peak.hourLabel}–${HOUR_BLOCK_LABELS[Math.min(5, peak.block + 1)] || '12am'} JST`
    : ''
  return { heatmap: flat, heatmapMax: max, peakLabel }
}

const pctRows = (entries, total) => {
  const t = Math.max(1, total)
  return entries
    .map(([key, count]) => ({
      key,
      label: key,
      count: Number(count) || 0,
      pct: Math.round(((Number(count) || 0) / t) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count)
}

export const aggregateAudienceFromEvents = (events = [], { internalUserIds = new Set() } = {}) => {
  const heatmapMap = new Map()
  const deviceMap = new Map()
  const localeMap = new Map()
  const hourMap = new Map()

  for (const row of events) {
    if (String(row?.event_name || '') !== 'page_view') continue
    if (row?.user_id && internalUserIds.has(row.user_id)) continue

    const parts = toJstDowHour(row.created_at)
    if (parts) {
      const hk = `${parts.monIndex}-${parts.block}`
      heatmapMap.set(hk, (heatmapMap.get(hk) || 0) + 1)
      hourMap.set(parts.hour, (hourMap.get(parts.hour) || 0) + 1)
    }

    const meta = row?.event_meta && typeof row.event_meta === 'object' ? row.event_meta : {}
    const device = String(meta.device_type || 'unknown').trim() || 'unknown'
    deviceMap.set(device, (deviceMap.get(device) || 0) + 1)

    const localeRaw = String(meta.locale || '').trim()
    const localeKey = localeRaw
      ? localeRaw.split('-')[0].toUpperCase()
      : 'unknown'
    localeMap.set(localeKey, (localeMap.get(localeKey) || 0) + 1)
  }

  const heatmapCells = [...heatmapMap.entries()].map(([k, count]) => {
    const [monIndex, block] = k.split('-').map(Number)
    return { mon_index: monIndex, block, count }
  })

  const totalPv = [...deviceMap.values()].reduce((s, n) => s + n, 0) || [...heatmapMap.values()].reduce((s, n) => s + n, 0)
  const { heatmap, heatmapMax, peakLabel } = buildHeatmapGrid(heatmapCells)

  const deviceBreakdown = pctRows([...deviceMap.entries()], totalPv).map((r) => ({
    ...r,
    label: ({ desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet', unknown: 'Unknown' })[r.key] || r.key,
  }))

  const localeBreakdown = pctRows([...localeMap.entries()], totalPv).slice(0, 8)

  const hourHistogram = [...hourMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, count]) => ({
      hour,
      label: `${hour}:00`,
      count,
    }))

  return {
    source: 'client',
    heatmap,
    heatmapMax,
    peakLabel,
    deviceBreakdown,
    localeBreakdown,
    hourHistogram,
    onboarding: emptyCrmAudience().onboarding,
    meta: { days: null, timezone: JST, pageViews: totalPv },
  }
}

export const mapAudienceRpcPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return emptyCrmAudience()
  const heatRaw = Array.isArray(payload.active_times) ? payload.active_times : []
  const { heatmap, heatmapMax, peakLabel } = buildHeatmapGrid(heatRaw)
  const n = (v) => Number(v || 0)
  const totalPv = n(payload?.meta?.page_views)

  const mapRows = (arr, labelFn) => (
    Array.isArray(arr) ? arr : []
  ).map((row) => ({
    key: String(row?.key || row?.device_type || row?.locale || ''),
    label: labelFn ? labelFn(row) : String(row?.label || row?.key || ''),
    count: n(row?.count ?? row?.events),
    pct: n(row?.pct) || (totalPv ? Math.round((n(row?.count ?? row?.events) / totalPv) * 1000) / 10 : 0),
  }))

  const onboard = payload.onboarding || {}
  const mapOnboardList = (arr, labelFn) => (
    Array.isArray(arr) ? arr : []
  ).map((row) => ({
    key: String(row?.value || row?.key || ''),
    label: labelFn(String(row?.value || row?.key || '')),
    count: n(row?.count),
    pct: n(row?.pct),
  }))

  return {
    source: 'rpc',
    heatmap,
    heatmapMax,
    peakLabel: String(payload?.peak_label || peakLabel || ''),
    deviceBreakdown: mapRows(payload.device_breakdown, (row) => {
      const k = String(row?.device_type || row?.key || 'unknown')
      return ({ desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet', unknown: 'Unknown' })[k] || k
    }),
    localeBreakdown: mapRows(payload.locale_breakdown),
    hourHistogram: (Array.isArray(payload.hour_histogram) ? payload.hour_histogram : []).map((row) => ({
      hour: n(row?.hour),
      label: `${n(row?.hour)}:00`,
      count: n(row?.count ?? row?.events),
    })),
    onboarding: {
      totalCustomers: n(onboard.total_customers),
      withProfile: n(onboard.with_profile),
      assetMix: mapOnboardList(onboard.asset_mix, (v) => shortEn(v, ASSET_LABELS)),
      riskTolerance: mapOnboardList(onboard.risk_tolerance, (v) => shortEn(v, RISK_LABELS)),
      horizon: mapOnboardList(onboard.horizon, (v) => shortEn(v, HORIZON_LABELS)),
    },
    meta: {
      days: n(payload?.meta?.days),
      timezone: String(payload?.meta?.timezone || JST),
      pageViews: totalPv,
    },
  }
}

export const buildOnboardingAudienceFromCrmRows = (rows = []) => {
  const customers = rows.filter((r) => !isCrmInternalUser(r))
  const withProfile = customers.filter(isCompleteOnboardingRow)
  const countField = (field) => {
    const map = new Map()
    for (const r of withProfile) {
      const k = String(r[field] || '').trim() || '(not set)'
      map.set(k, (map.get(k) || 0) + 1)
    }
    const total = withProfile.length || 1
    const labelFn = field === 'onboarding_asset_mix'
      ? (v) => shortEn(v, ASSET_LABELS)
      : field === 'onboarding_risk_tolerance'
        ? (v) => shortEn(v, RISK_LABELS)
        : (v) => shortEn(v, HORIZON_LABELS)
    return [...map.entries()]
      .map(([key, count]) => ({
        key,
        label: labelFn(key),
        count,
        pct: Math.round((count / total) * 1000) / 10,
      }))
      .sort((a, b) => b.count - a.count)
  }

  return {
    totalCustomers: customers.length,
    withProfile: withProfile.length,
    assetMix: countField('onboarding_asset_mix'),
    riskTolerance: countField('onboarding_risk_tolerance'),
    horizon: countField('onboarding_investment_horizon'),
  }
}

export const mergeAudienceWithOnboarding = (audience, onboarding) => ({
  ...audience,
  onboarding: onboarding || audience.onboarding,
})

export { DOW_LABELS, HOUR_BLOCK_LABELS, JST }
