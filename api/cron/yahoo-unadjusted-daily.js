import { createClient } from '@supabase/supabase-js'
import {
  assessUnadjustedBar,
  barsFromChart,
  fetchYahooChart,
  PRICE_BASIS,
  shouldRetryYahoo,
} from '../_lib/yahooUnadjustedBar.js'
import { writePriceQuarantine } from '../_lib/price-ingest-guard.js'
import {
  applyDashboardVerdict,
  approveDashboardUpdate,
  PROVIDER,
  STORAGE_SOURCE,
  UNIVERSE_COUNTS,
  dashboardTargets,
  decidePriceWrite,
  equityTargets,
  jobOutcome,
} from '../_lib/yahooPricePlan.js'
import {
  CHUNK_SIZE,
  VERIFIED_MARKETSTACK_USAGE,
  assessmentFromMarketstackRow,
  enforcedQuota,
  marketstackCandidates,
  marketstackHoldReason,
  requestsForSymbols,
  usageSinceVerifiedBaseline,
} from '../_lib/marketstackSupplement.js'
import {
  commitFxPair,
  fxConcurrentChange,
  planFxPublication,
  planUsdJpyWrites,
  previousFxAlign,
} from '../_lib/fxYahooSync.js'

const HELD_REPORT = ['VXTLT', 'Gold', 'Silver', 'WTI', 'Brent', 'Risk-On/Off Score']

async function mapPool(items, limit, worker) {
  const out = new Array(items.length)
  let cursor = 0
  async function run() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      out[index] = await worker(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()))
  return out
}

async function classifyTarget(target, deadline) {
  if (target.held) return { ...target, assessment: { status: 'held', trade_date: null, price_basis: PRICE_BASIS } }
  if (!target.expectedDate) {
    return { ...target, assessment: { status: 'calendar_hold', trade_date: null, price_basis: PRICE_BASIS, note: '거래일 달력에 확정 세션이 없습니다.' } }
  }
  let lastError = null
  let lastAssessment = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (Date.now() > deadline) {
      lastError = 'time_budget'
      break
    }
    try {
      const fetched = await fetchYahooChart(target.yahoo)
      if (!fetched.ok) {
        lastError = `http_${fetched.status}`
      } else {
        const parsed = barsFromChart(fetched.payload, 'UTC')
        if (parsed.error) {
          lastError = parsed.error
        } else {
          const assessment = assessUnadjustedBar({
            bars: parsed.bars,
            events: parsed.events,
            timeZone: parsed.timeZone,
            expectedDate: target.expectedDate,
            expectedPreviousDate: target.expectedPreviousDate,
            requireOhlc: target.requireOhlc,
          })
          if (!shouldRetryYahoo(assessment.status)) return { ...target, assessment }
          lastAssessment = assessment
          lastError = assessment.note
        }
      }
    } catch (error) {
      lastError = error.message
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 400))
  }
  if (lastAssessment && shouldRetryYahoo(lastAssessment.status)) {
    return { ...target, assessment: { ...lastAssessment, note: lastError || 'retry_exhausted' } }
  }
  return {
    ...target,
    assessment: {
      status: 'pending_yahoo',
      trade_date: null,
      expected_trade_date: target.expectedDate,
      expected_previous_date: target.expectedPreviousDate || null,
      price_basis: PRICE_BASIS,
      note: lastError || 'retry_exhausted',
    },
  }
}

async function supplementFailures(rows, apiKey) {
  const plan = marketstackCandidates(rows)
  if (!plan.eligible.length || !apiKey) return { rows, billedSymbols: 0, skipped: plan.skipped }
  const groups = new Map()
  for (const row of plan.eligible) {
    const market = String(row.symbol).toUpperCase().endsWith('.T') ? 'XTKS' : 'US'
    const key = `${row.expectedDate}|${market}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  let billedSymbols = 0
  const next = rows.map((row) => ({ ...row }))
  const indexBySymbol = new Map(next.filter((row) => row.symbol).map((row) => [row.symbol, row]))
  for (const [key, group] of groups) {
    const [expectedDate, market] = key.split('|')
    for (let offset = 0; offset < group.length; offset += CHUNK_SIZE) {
      const chunk = group.slice(offset, offset + CHUNK_SIZE)
      const symbols = chunk.map((row) => row.yahoo || row.symbol).join(',')
      const exchange = market === 'XTKS' ? '&exchange=XTKS' : ''
      const url = `https://api.marketstack.com/v2/eod/${expectedDate}?access_key=${encodeURIComponent(apiKey)}&symbols=${encodeURIComponent(symbols)}${exchange}`
      billedSymbols += chunk.length
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 12000)
      try {
        const response = await fetch(url, { signal: controller.signal })
        const json = await response.json()
        if (json?.error?.code === 'no_valid_symbols_provided') {
          for (const row of chunk) {
            const current = indexBySymbol.get(row.symbol)
            if (!current) continue
            current.assessment = {
              ...current.assessment,
              status: 'marketstack_unsupported',
              trade_date: null,
              note: 'Marketstack가 이 심볼을 받지 않습니다. 다시 호출하지 않습니다.',
            }
          }
          continue
        }
        const data = Array.isArray(json?.data) ? json.data : []
        for (const item of data) {
          const symbol = String(item.symbol || item.ticker || '')
          const assessment = assessmentFromMarketstackRow(item, expectedDate)
          const current = indexBySymbol.get(symbol)
          if (!current || !assessment) continue
          current.assessment = {
            ...assessment,
            expected_previous_date: current.expectedPreviousDate || null,
          }
        }
      } catch (_) {
        // The attempt is already billed. Keep the Yahoo failure and the same trade date.
      } finally {
        clearTimeout(timer)
      }
    }
  }
  return { rows: next, billedSymbols, skipped: plan.skipped }
}

async function readReservedUsage(supabase, now) {
  const { data, error } = await supabase
    .from('ingestion_jobs')
    .select('source,meta,status,started_at')
    .in('source', ['marketstack', 'yahoo'])
    .gt('started_at', VERIFIED_MARKETSTACK_USAGE.observedAt)
    .limit(500)
  return usageSinceVerifiedBaseline(data, {
    truncated: Boolean(error) || (data || []).length >= 500,
    now,
  })
}

function summaryOf(rows) {
  const counts = {}
  for (const row of rows) {
    const key = row.decision?.reason || row.assessment.status
    counts[key] = (counts[key] || 0) + 1
  }
  const failures = rows
    .filter((row) => {
      const action = row.decision?.action
      if (['keep', 'insert', 'fill_ohlc'].includes(action)) return false
      if (action === 'dashboard_only' && row.assessment?.status === 'ok') return false
      return true
    })
    .slice(0, 80)
    .map((row) => ({
      item: row.item,
      symbol: row.symbol,
      status: row.assessment.status,
      reason: row.decision?.reason || null,
      expected: row.expectedDate,
      latest: row.assessment.latest_available_date || null,
    }))
  return { counts, failures }
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return res.status(500).json({ ok: false, error: 'CRON_SECRET is required' })
  const token = String(req.headers.authorization || '')
  if (token !== `Bearer ${cronSecret}`) return res.status(401).json({ ok: false, error: 'Unauthorized cron request' })

  const requestUrl = new URL(req.url || '/api/cron/yahoo-unadjusted-daily', 'http://localhost')
  const scope = requestUrl.searchParams.get('scope') || ''
  const dryRun = requestUrl.searchParams.get('dry_run') === '1'
  const batch = Number(requestUrl.searchParams.get('batch') || '0')
  const batches = Number(requestUrl.searchParams.get('batches') || '1')
  const now = new Date()
  const targets = scope === 'dashboard'
    ? dashboardTargets(now)
    : ['us', 'jp', 'etf'].includes(scope)
      ? equityTargets(scope, batch, batches, now)
      : []
  if (!targets.length) return res.status(400).json({ ok: false, error: 'scope must be us, jp, etf, or dashboard' })

  const deadline = Date.now() + 240000
  const classified = await mapPool(targets, 5, (target) => classifyTarget(target, deadline))
  const supplementPlan = marketstackCandidates(classified)
  const needed = requestsForSymbols(supplementPlan.eligible.length)
  const hasMarketstackKey = Boolean(process.env.MARKETSTACK_ACCESS_KEY || process.env.MARKETSTACK_APIKEY || process.env.MARKETSTACK_API_KEY)
  const monthlyBudget = enforcedQuota(process.env.MARKETSTACK_MONTHLY_BUDGET_REQUESTS)
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!dryRun && (!supabaseUrl || !serviceRoleKey)) {
    return res.status(500).json({ ok: false, completed_write: false, error: 'SUPABASE_URL is required' })
  }
  let usage = {
    used: null,
    reason: 'usage_unconfirmed',
    baseline_used: VERIFIED_MARKETSTACK_USAGE.usedRequests,
    extra: null,
  }
  let supabase = null
  if (supabaseUrl && serviceRoleKey) {
    supabase = createClient(supabaseUrl, serviceRoleKey)
    usage = await readReservedUsage(supabase, now)
  }
  const marketstackHold = marketstackHoldReason({
    needed,
    classifiedCount: classified.length,
    usage,
    hasKey: hasMarketstackKey,
    now,
    budget: monthlyBudget,
  })
  const usageReport = {
    usage_reason: usage.reason,
    usage_baseline: usage.baseline_used,
    usage_extra_after_baseline: usage.extra,
    usage_total: usage.used,
    usage_quota: monthlyBudget,
    usage_period_end: VERIFIED_MARKETSTACK_USAGE.periodEnd,
  }
  if (dryRun) {
    return res.status(200).json({
      ok: true,
      dry_run: true,
      completed_write: false,
      provider: PROVIDER,
      price_basis: PRICE_BASIS,
      storage_source_key: STORAGE_SOURCE,
      marketstack_called: false,
      marketstack_would_request: needed,
      marketstack_hold: marketstackHold,
      marketstack_skipped: supplementPlan.skipped.slice(0, 40),
      ...usageReport,
      scope,
      batch,
      universe: UNIVERSE_COUNTS,
      held_not_written: HELD_REPORT,
      fx_table: 'untouched',
      ...summaryOf(classified.map((row) => ({ ...row, decision: { action: 'dry_run', reason: row.assessment.status } }))),
      sample: classified.slice(0, 8).map((row) => ({
        item: row.item,
        expected: row.expectedDate,
        status: row.assessment.status,
        trade_date: row.assessment.trade_date || null,
        ohlc_ok: row.assessment.ohlc_ok || false,
      })),
    })
  }

  const activeSince = new Date(Date.now() - 20 * 60 * 1000).toISOString()
  const { data: activeJobs, error: activeErr } = await supabase
    .from('ingestion_jobs')
    .select('id,meta')
    .eq('source', PROVIDER)
    .eq('status', 'started')
    .gte('started_at', activeSince)
    .limit(20)
  if (activeErr) return res.status(500).json({ ok: false, completed_write: false, error: activeErr.message })
  if ((activeJobs || []).some((job) => job.meta?.scope === scope && Number(job.meta?.batch) === batch)) {
    return res.status(409).json({ ok: false, completed_write: false, error: '같은 배치가 이미 진행 중입니다.' })
  }

  const marketstackKey = process.env.MARKETSTACK_ACCESS_KEY || process.env.MARKETSTACK_APIKEY || process.env.MARKETSTACK_API_KEY
  const willCallMarketstack = needed > 0 && !marketstackHold
  const { data: startedJob, error: startErr } = await supabase.from('ingestion_jobs').insert([{
    source: PROVIDER,
    dataset: 'stock_daily_prices',
    status: 'started',
    rows_processed: 0,
    meta: {
      provider: PROVIDER,
      price_basis: PRICE_BASIS,
      storage_source_key: STORAGE_SOURCE,
      scope,
      batch,
      universe: UNIVERSE_COUNTS,
      completeness: 'pending',
      marketstack_billed_symbols: willCallMarketstack ? needed : 0,
      marketstack_hold: marketstackHold,
    },
  }]).select('id').single()
  if (startErr || !startedJob?.id) {
    return res.status(500).json({ ok: false, completed_write: false, error: startErr?.message || 'ingestion job start failed' })
  }

  let classifiedAfter = classified
  let marketstackBilled = willCallMarketstack ? needed : 0
  if (willCallMarketstack) {
    const supplemented = await supplementFailures(classified, marketstackKey)
    classifiedAfter = supplemented.rows
    marketstackBilled = supplemented.billedSymbols
  }
  const symbols = [...new Set(classifiedAfter.map((row) => row.symbol).filter(Boolean))]
  const dates = [...new Set(classifiedAfter.map((row) => row.expectedDate).filter(Boolean))]
  const previousDates = [...new Set(classifiedAfter.map((row) => row.expectedPreviousDate || row.assessment.expected_previous_date).filter(Boolean))]
  const { data: existingRows, error: existingErr } = symbols.length
    ? await supabase.from('stock_daily_prices').select('symbol,trade_date,open,high,low,close,volume,source,raw').in('symbol', symbols).in('trade_date', dates)
    : { data: [], error: null }
  if (existingErr) {
    await supabase.from('ingestion_jobs').update({ status: 'failed', finished_at: new Date().toISOString(), error_message: existingErr.message }).eq('id', startedJob.id)
    return res.status(500).json({ ok: false, completed_write: false, error: existingErr.message })
  }
  const { data: previousRows, error: previousErr } = symbols.length && previousDates.length
    ? await supabase.from('stock_daily_prices').select('symbol,trade_date,close,raw').in('symbol', symbols).in('trade_date', previousDates)
    : { data: [], error: null }
  if (previousErr) {
    await supabase.from('ingestion_jobs').update({ status: 'failed', finished_at: new Date().toISOString(), error_message: previousErr.message }).eq('id', startedJob.id)
    return res.status(500).json({ ok: false, completed_write: false, error: previousErr.message })
  }
  const dashboardDates = [...new Set([...dates, ...previousDates])]
  const { data: dashboardExisting, error: dashboardReadErr } = dashboardDates.length
    ? await supabase.from('market_dashboard_daily').select('*').in('trade_date', dashboardDates)
    : { data: [], error: null }
  if (dashboardReadErr) {
    await supabase.from('ingestion_jobs').update({ status: 'failed', finished_at: new Date().toISOString(), error_message: dashboardReadErr.message }).eq('id', startedJob.id)
    return res.status(500).json({ ok: false, completed_write: false, error: dashboardReadErr.message })
  }

  const existingByKey = new Map((existingRows || []).map((row) => [`${row.symbol}|${row.trade_date}`, row]))
  const previousByKey = new Map((previousRows || []).map((row) => [`${row.symbol}|${row.trade_date}`, row]))
  let decided = classifiedAfter.map((row) => {
    if (!row.symbol || row.dashboardOnly) return { ...row, decision: { action: 'dashboard_only', reason: row.assessment.status } }
    const existing = existingByKey.get(`${row.symbol}|${row.expectedDate}`) || null
    const expectedPrev = row.expectedPreviousDate || row.assessment.expected_previous_date
    const previous = previousByKey.get(`${row.symbol}|${expectedPrev}`) || null
    const dbPreviousClose = previous ? previous.close : null
    const verifiedPrevious = previous?.raw?.price_basis === PRICE_BASIS
      ? {
        trade_date: previous.trade_date,
        close: previous.close,
        price_basis: previous.raw.price_basis,
        provider: previous.raw.provider || null,
      }
      : null
    return {
      ...row,
      decision: decidePriceWrite({ existing, assessment: row.assessment, dbPreviousClose, verifiedPrevious }),
      existing,
    }
  })

  const report = summaryOf(decided)
  const backup = decided
    .filter((row) => row.symbol)
    .map((row) => {
      const existing = row.existing
      if (!existing) return { symbol: row.symbol, trade_date: row.expectedDate, missing: true, volume: null, raw: null }
      return {
        symbol: existing.symbol,
        trade_date: existing.trade_date,
        open: existing.open,
        high: existing.high,
        low: existing.low,
        close: existing.close,
        volume: existing.volume ?? null,
        source: existing.source ?? null,
        raw: existing.raw ?? null,
        missing: false,
      }
    })
  const dashboardBackup = dashboardExisting || []
  const fxDates = scope === 'dashboard' ? dashboardDates : []
  const { data: fxExisting, error: fxReadErr } = fxDates.length
    ? await supabase.from('fx_daily_usdjpy').select('as_of_date,usd_jpy,provider,updated_at').in('as_of_date', fxDates)
    : { data: [], error: null }
  if (fxReadErr) {
    await supabase.from('ingestion_jobs').update({ status: 'failed', finished_at: new Date().toISOString(), error_message: fxReadErr.message }).eq('id', startedJob.id)
    return res.status(500).json({ ok: false, completed_write: false, error: fxReadErr.message })
  }
  const fxBackup = fxExisting || []
  const baseMeta = {
    provider: PROVIDER,
    price_basis: PRICE_BASIS,
    storage_source_key: STORAGE_SOURCE,
    scope,
    batch,
    universe: UNIVERSE_COUNTS,
    marketstack_called: marketstackBilled > 0,
    marketstack_billed_symbols: marketstackBilled,
    marketstack_hold: marketstackHold,
    held_not_written: HELD_REPORT,
    backup,
    dashboard_backup: dashboardBackup,
    fx_backup: fxBackup,
    failures: report.failures,
  }
  const { error: backupErr } = await supabase.from('ingestion_jobs').update({ meta: { ...baseMeta, completeness: 'pending' } }).eq('id', startedJob.id)
  if (backupErr) {
    await supabase.from('ingestion_jobs').update({ status: 'failed', finished_at: new Date().toISOString(), error_message: backupErr.message }).eq('id', startedJob.id)
    return res.status(500).json({ ok: false, completed_write: false, error: backupErr.message })
  }

  let wrote = 0
  const quarantined = []
  for (const row of decided) {
    if (row.decision.action === 'quarantine') {
      quarantined.push({
        source: STORAGE_SOURCE,
        symbol: row.symbol,
        trade_date: row.assessment.trade_date,
        open: row.assessment.open,
        high: row.assessment.high,
        low: row.assessment.low,
        close: row.assessment.close,
        volume: row.assessment.volume,
        reason: 'extreme_vs_prev_close',
      })
      continue
    }
    const raw = {
      provider: row.assessment.provider || PROVIDER,
      price_basis: PRICE_BASIS,
      yahoo_symbol: row.yahoo,
      adjusted_close: 'not_used',
    }
    if (row.decision.action === 'insert') {
      const { error } = await supabase.from('stock_daily_prices').insert([{
        source: STORAGE_SOURCE,
        symbol: row.symbol,
        trade_date: row.assessment.trade_date,
        open: row.assessment.open,
        high: row.assessment.high,
        low: row.assessment.low,
        close: row.assessment.close,
        volume: row.assessment.volume,
        raw,
      }])
      if (error && error.code !== '23505') {
        await supabase.from('ingestion_jobs').update({ status: 'failed', finished_at: new Date().toISOString(), error_message: error.message, meta: baseMeta }).eq('id', startedJob.id)
        return res.status(500).json({ ok: false, completed_write: false, error: error.message, wrote })
      }
      if (!error) wrote += 1
    } else if (row.decision.action === 'fill_ohlc') {
      const { error } = await supabase.from('stock_daily_prices').update({
        open: row.assessment.open,
        high: row.assessment.high,
        low: row.assessment.low,
        volume: row.assessment.volume,
        raw,
      }).eq('symbol', row.symbol).eq('trade_date', row.assessment.trade_date).is('open', null).is('high', null).is('low', null)
      if (error) {
        await supabase.from('ingestion_jobs').update({ status: 'failed', finished_at: new Date().toISOString(), error_message: error.message, meta: baseMeta }).eq('id', startedJob.id)
        return res.status(500).json({ ok: false, completed_write: false, error: error.message, wrote })
      }
      wrote += 1
    }
  }
  if (quarantined.length) {
    try {
      await writePriceQuarantine(supabase, quarantined)
    } catch (error) {
      await supabase.from('ingestion_jobs').update({ status: 'failed', finished_at: new Date().toISOString(), error_message: error.message, meta: baseMeta }).eq('id', startedJob.id)
      return res.status(500).json({ ok: false, completed_write: false, error: error.message, wrote })
    }
  }

  let dashboardRows = []
  let fxTableRows = []
  if (scope === 'dashboard') {
    const { data: currentDashboard, error: currentDashErr } = dashboardDates.length
      ? await supabase.from('market_dashboard_daily').select('*').in('trade_date', dashboardDates)
      : { data: [], error: null }
    const { data: currentFx, error: currentFxErr } = fxDates.length
      ? await supabase.from('fx_daily_usdjpy').select('as_of_date,usd_jpy,provider,updated_at').in('as_of_date', fxDates)
      : { data: [], error: null }
    if (currentDashErr || currentFxErr) {
      const message = currentDashErr?.message || currentFxErr?.message
      await supabase.from('ingestion_jobs').update({ status: 'failed', finished_at: new Date().toISOString(), error_message: message, meta: baseMeta }).eq('id', startedJob.id)
      return res.status(500).json({ ok: false, completed_write: false, error: message, wrote })
    }
    const snapshotByKey = new Map(dashboardBackup.map((row) => [`${row.trade_date}|${row.item}`, row]))
    const currentByKey = new Map((currentDashboard || []).map((row) => [`${row.trade_date}|${row.item}`, row]))
    const fxSnapshotByDate = new Map(fxBackup.map((row) => [String(row.as_of_date).slice(0, 10), row]))
    const fxCurrentByDate = new Map((currentFx || []).map((row) => [String(row.as_of_date).slice(0, 10), row]))
    decided = decided.map((row) => {
      const fxPlan = row.category === 'fx' ? planFxPublication({ assessment: row.assessment }) : null
      if (fxPlan?.action === 'hold') return applyDashboardVerdict(row, fxPlan)
      const verdict = approveDashboardUpdate({
        snapshot: snapshotByKey.get(`${row.assessment.trade_date}|${row.item}`) || null,
        current: currentByKey.get(`${row.assessment.trade_date}|${row.item}`) || null,
        assessment: row.assessment,
        decision: row.decision,
        replaceClose: row.category === 'fx',
      })
      if (!verdict.ok) return applyDashboardVerdict(row, verdict)
      if (!fxPlan) return { ...row, dashboardApproved: true }
      const prevSnap = snapshotByKey.get(`${fxPlan.previousDate}|${row.item}`) || null
      const prevCur = currentByKey.get(`${fxPlan.previousDate}|${row.item}`) || null
      if (fxConcurrentChange(prevSnap, prevCur)) return applyDashboardVerdict(row, { ok: false, reason: 'concurrent_change' })
      if (row.item === 'USD/JPY') {
        const watched = [fxPlan.tradeDate, fxPlan.previousDate]
        if (watched.some((date) => fxConcurrentChange(fxSnapshotByDate.get(date) || null, fxCurrentByDate.get(date) || null))) {
          return applyDashboardVerdict(row, { ok: false, reason: 'concurrent_change' })
        }
        const pair = planUsdJpyWrites({
          plan: fxPlan,
          dashboardPrevious: prevCur,
          fxCurrent: fxCurrentByDate.get(fxPlan.tradeDate) || null,
          fxPrevious: fxCurrentByDate.get(fxPlan.previousDate) || null,
        })
        for (const fxRow of pair.fxRows) fxTableRows.push({ ...fxRow, updated_at: now.toISOString() })
        const fxExtraRows = pair.dashboardPreviousRow
          ? [{
            trade_date: pair.dashboardPreviousRow.trade_date,
            item: row.item,
            category: 'fx',
            value: pair.dashboardPreviousRow.value,
            change_pct: null,
            status: 'ok',
            updated_at: now.toISOString(),
          }]
          : []
        return { ...row, dashboardApproved: true, fxPlan, fxExtraRows }
      }
      const align = previousFxAlign(
        prevCur ? { trade_date: prevCur.trade_date, value: prevCur.value, change_pct: prevCur.change_pct ?? null } : null,
        fxPlan.previousDate,
        fxPlan.previousClose,
      )
      const fxExtraRows = align.action === 'insert' || align.action === 'replace'
        ? [{
          trade_date: fxPlan.previousDate,
          item: row.item,
          category: 'fx',
          value: fxPlan.previousClose,
          change_pct: null,
          status: 'ok',
          updated_at: now.toISOString(),
        }]
        : []
      return { ...row, dashboardApproved: true, fxPlan, fxExtraRows }
    })
    dashboardRows = decided.filter((row) => row.dashboardApproved).flatMap((row) => {
      const current = {
        trade_date: row.assessment.trade_date,
        item: row.item,
        category: row.category,
        value: row.fxPlan?.close ?? row.assessment.close,
        change_pct: row.fxPlan?.changePct ?? row.assessment.change_pct,
        status: 'ok',
        updated_at: now.toISOString(),
      }
      return [current, ...(row.fxExtraRows || [])]
    })
  }
  if (fxTableRows.length || dashboardRows.length) {
    const committed = await commitFxPair({
      fxRows: fxTableRows,
      dashboardRows,
      fxBackup,
      writeFx: async (rows) => {
        const { error } = await supabase.from('fx_daily_usdjpy').upsert(rows, { onConflict: 'as_of_date' })
        if (error) throw error
      },
      deleteFx: async (dates) => {
        const { error } = await supabase.from('fx_daily_usdjpy').delete().in('as_of_date', dates)
        if (error) throw error
      },
      writeDashboard: async (rows) => {
        const { error } = await supabase.from('market_dashboard_daily').upsert(rows, { onConflict: 'trade_date,item' })
        if (error) throw error
      },
    })
    if (!committed.ok) {
      const message = committed.restoreError?.message || committed.error?.message || 'fx pair commit failed'
      await supabase.from('ingestion_jobs').update({ status: 'failed', finished_at: new Date().toISOString(), error_message: message, meta: { ...baseMeta, fx_compensated: committed.compensated } }).eq('id', startedJob.id)
      return res.status(500).json({ ok: false, completed_write: false, error: message, fx_compensated: committed.compensated, wrote })
    }
  }

  const outcome = jobOutcome(decided)
  const { error: finishErr } = await supabase.from('ingestion_jobs').update({
    status: outcome.status,
    finished_at: new Date().toISOString(),
    rows_processed: wrote,
    error_message: outcome.completeness === 'partial' ? 'incomplete price collection' : null,
    meta: { ...baseMeta, completeness: outcome.completeness },
  }).eq('id', startedJob.id)
  if (finishErr) return res.status(500).json({ ok: false, completed_write: false, error: finishErr.message, wrote })

  return res.status(200).json({
    ok: outcome.status === 'success',
    dry_run: false,
    completed_write: outcome.status === 'success',
    job_status: outcome.status,
    completeness: outcome.completeness,
    provider: PROVIDER,
    marketstack_called: marketstackBilled > 0,
    marketstack_billed_symbols: marketstackBilled,
    marketstack_hold: marketstackHold,
    scope,
    wrote,
    quarantined: quarantined.length,
    dashboard_upserts: dashboardRows.length,
    fx_table: fxTableRows.length ? 'yahoo' : 'untouched',
    universe: UNIVERSE_COUNTS,
    ...report,
  })
}
