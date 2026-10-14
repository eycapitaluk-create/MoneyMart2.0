import { priceScheduleGate, scopedDashboardTargets, incompleteBatchAlreadyAttempted } from '../_lib/priceSchedule.js'
import { createClient } from '@supabase/supabase-js'
import {
  assessUnadjustedBar,
  barsFromChart,
  fetchYahooChart,
  PRICE_BASIS,
  YAHOO_MIN_GAP_MS,
  mapUntilYahooLimit,
  yahooCooldownActive,
  yahooResponseHalt,
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
  marketstackAllowed,
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

const HELD_REPORT = ['TOPIX', 'VXTLT', 'Gold', 'Silver', 'WTI', 'Brent', 'Risk-On/Off Score']

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

function limitedAssessment(target, note) {
  return {
    ...target,
    assessment: {
      status: 'yahoo_access_limited',
      trade_date: null,
      expected_trade_date: target.expectedDate || null,
      expected_previous_date: target.expectedPreviousDate || null,
      price_basis: PRICE_BASIS,
      note,
    },
  }
}

async function classifyTarget(target, deadline, breaker) {
  if (breaker.tripped) return limitedAssessment(target, 'Yahoo 제한이 이미 열려 이 실행에서는 더 호출하지 않습니다.')
  if (target.held) return { ...target, assessment: { status: 'held', trade_date: null, price_basis: PRICE_BASIS } }
  if (!target.expectedDate) {
    return { ...target, assessment: { status: 'calendar_hold', trade_date: null, price_basis: PRICE_BASIS, note: '거래일 달력에 확정 세션이 없습니다.' } }
  }
  if (Date.now() > deadline) {
    return { ...target, assessment: { status: 'pending_yahoo', trade_date: null, expected_trade_date: target.expectedDate, price_basis: PRICE_BASIS, note: 'time_budget' } }
  }
  try {
    const fetched = await fetchYahooChart(target.yahoo)
    const halt = yahooResponseHalt(fetched.status)
    if (halt) {
      breaker.tripped = halt
      return limitedAssessment(target, `Yahoo HTTP ${fetched.status}. 같은 실행과 다음 배치의 호출을 멈춥니다.`)
    }
    if (Number(fetched.status) === 404) {
      return { ...target, assessment: { status: 'symbol_missing', trade_date: null, expected_trade_date: target.expectedDate, expected_previous_date: target.expectedPreviousDate || null, price_basis: PRICE_BASIS, note: 'http_404' } }
    }
    if (!fetched.ok) {
      return { ...target, assessment: { status: 'pending_yahoo', trade_date: null, expected_trade_date: target.expectedDate, expected_previous_date: target.expectedPreviousDate || null, price_basis: PRICE_BASIS, note: `http_${fetched.status}` } }
    }
    const parsed = barsFromChart(fetched.payload, 'UTC', { expectedDate: target.expectedDate, now: new Date() })
    if (parsed.error) {
      return { ...target, assessment: { status: 'pending_yahoo', trade_date: null, expected_trade_date: target.expectedDate, expected_previous_date: target.expectedPreviousDate || null, price_basis: PRICE_BASIS, note: parsed.error } }
    }
    return {
      ...target,
      assessment: assessUnadjustedBar({
        bars: parsed.bars,
        events: parsed.events,
        timeZone: parsed.timeZone,
        expectedDate: target.expectedDate,
        expectedPreviousDate: target.expectedPreviousDate,
        requireOhlc: target.requireOhlc,
      }),
    }
  } catch (error) {
    breaker.tripped = yahooResponseHalt(null, error)
    return limitedAssessment(target, `Yahoo ${error?.name || 'network'}. 같은 실행과 다음 배치의 호출을 멈춥니다.`)
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

async function presentPriceKeys(supabase, targets) {
  const dates = [...new Set(targets.flatMap((target) => [target.expectedDate, target.expectedPreviousDate]).filter(Boolean))]
  const symbols = [...new Set(targets.map((target) => target.symbol).filter(Boolean))]
  const items = [...new Set(targets.filter((target) => !target.symbol).map((target) => target.item).filter(Boolean))]
  const keys = new Set()
  for (let index = 0; index < symbols.length; index += 100) {
    const chunk = symbols.slice(index, index + 100)
    const { data, error } = await supabase.from('stock_daily_prices').select('symbol,trade_date').in('symbol', chunk).in('trade_date', dates)
    if (error) throw error
    for (const row of data || []) keys.add(`${row.symbol}|${String(row.trade_date).slice(0, 10)}`)
  }
  if (items.length && dates.length) {
    const { data, error } = await supabase.from('market_dashboard_daily').select('item,trade_date').in('item', items).in('trade_date', dates)
    if (error) throw error
    const dashboard = new Set((data || []).map((row) => `${row.item}|${String(row.trade_date).slice(0, 10)}`))
    let fxDates = new Set()
    if (items.includes('USD/JPY')) {
      const { data: fxRows, error: fxErr } = await supabase.from('fx_daily_usdjpy').select('as_of_date').in('as_of_date', dates)
      if (fxErr) throw fxErr
      fxDates = new Set((fxRows || []).map((row) => String(row.as_of_date).slice(0, 10)))
    }
    for (const item of items) {
      for (const date of dates) {
        const listed = dashboard.has(`${item}|${date}`)
        if (item === 'USD/JPY' ? listed && fxDates.has(date) : listed) keys.add(`${item}|${date}`)
      }
    }
  }
  return keys
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return res.status(500).json({ ok: false, error: 'CRON_SECRET is required' })
  const token = String(req.headers.authorization || '')
  if (token !== `Bearer ${cronSecret}`) return res.status(401).json({ ok: false, error: 'Unauthorized cron request' })

  const requestUrl = new URL(req.url || '/api/cron/yahoo-unadjusted-daily', 'http://localhost')
  const scope = requestUrl.searchParams.get('scope') || ''
  const dryRun = requestUrl.searchParams.get('dry_run') === '1'
  const gate = priceScheduleGate(requestUrl.searchParams, new Date())
  if (!gate.run) return res.status(200).json({ ok: true, schedule_skipped: gate.reason, yahoo_called: false, marketstack_called: false, completed_write: false })
  const catchup = requestUrl.searchParams.get('catchup') === '1'
  if (catchup) {
    return res.status(200).json({
      ok: false,
      catchup: 'disabled',
      yahoo_called: false,
      marketstack_called: false,
      completed_write: false,
      manual: 'Yahoo를 반복 호출하면 차단될 수 있습니다. 자동 catch-up은 꺼 두었고, 누락 종목은 같은 확정 거래일을 수동으로 확인하는 편이 안전합니다.',
    })
  }
  const batchSpecified = requestUrl.searchParams.has('batch')
  const batch = Number(requestUrl.searchParams.get('batch') || '0')
  const batches = Number(requestUrl.searchParams.get('batches') || '1')
  const now = new Date()
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null
  let targets = []
  const isDashboardScope = ['dashboard', 'fx'].includes(scope)
  if (isDashboardScope) targets = requestUrl.searchParams.get('only_date') === '2026-10-10' && scope === 'dashboard' ? dashboardTargets(now) : scopedDashboardTargets(scope, now)
  else if (['us', 'jp', 'etf'].includes(scope)) {
    const batchList = catchup && !batchSpecified ? Array.from({ length: batches }, (_, index) => index) : [batch]
    targets = batchList.flatMap((index) => equityTargets(scope, index, batches, now))
  }
  if (!targets.length) return res.status(400).json({ ok: false, error: 'scope must be us, jp, etf, dashboard, or fx' })
  if (!supabase) {
    return res.status(200).json({ ok: false, dry_run: dryRun, completed_write: false, yahoo_called: false, marketstack_called: false, yahoo_access_limited: 'unconfirmed', note: '제한 상태를 확인하지 못해 Yahoo를 호출하지 않습니다.' })
  }
  const { data: recentJobs, error: recentErr } = await supabase.from('ingestion_jobs').select('meta').eq('source', PROVIDER).order('id', { ascending: false }).limit(50)
  const { data: manualJobs, error: manualErr } = await supabase.from('ingestion_jobs').select('meta').eq('source', PROVIDER).filter('meta->>yahoo_manual_review_required', 'eq', 'true').order('id', { ascending: false }).limit(5)
  if (recentErr || manualErr) {
    return res.status(200).json({ ok: false, dry_run: dryRun, completed_write: false, yahoo_called: false, marketstack_called: false, yahoo_access_limited: 'unconfirmed', note: '제한 상태를 확인하지 못해 Yahoo를 호출하지 않습니다.' })
  }
  const cooldown = yahooCooldownActive([...(manualJobs || []), ...(recentJobs || [])], now.getTime())
  if (cooldown.active) {
    return res.status(200).json({
      ok: false,
      dry_run: dryRun,
      completed_write: false,
      yahoo_called: false,
      marketstack_called: false,
      yahoo_access_limited: true,
      yahoo_manual_review_required: cooldown.manual,
      yahoo_cooldown_until: cooldown.until,
      note: cooldown.manual
        ? '401/403은 수동 검토 전까지 자동 수집하지 않습니다. 누락은 수동 확인이 안전합니다.'
        : '429 이후 최소 24시간은 다음 배치도 Yahoo를 호출하지 않습니다. 누락은 수동 확인이 안전합니다.',
    })
  }
  const { data: activeJobs, error: activeErr } = await supabase
    .from('ingestion_jobs')
    .select('id,meta')
    .eq('source', PROVIDER)
    .eq('status', 'started')
    .order('id', { ascending: false })
    .limit(20)
  if (activeErr) {
    return res.status(200).json({ ok: false, dry_run: dryRun, completed_write: false, yahoo_called: false, marketstack_called: false, yahoo_access_limited: 'unconfirmed', note: '진행 중 작업을 확인하지 못해 Yahoo를 호출하지 않습니다.' })
  }
  if ((activeJobs || []).length) {
    return res.status(200).json({
      ok: false,
      dry_run: dryRun,
      completed_write: false,
      yahoo_called: false,
      marketstack_called: false,
      yahoo_manual_review_required: true,
      note: '끝나지 않은 Yahoo 작업이 있습니다. 20분이 지나도 자동으로 풀지 않습니다. 수동 점검 전까지 호출하지 않습니다.',
    })
  }
  let storedKeys
  try {
    storedKeys = await presentPriceKeys(supabase, targets)
  } catch (error) {
    return res.status(200).json({ ok: false, dry_run: dryRun, completed_write: false, yahoo_called: false, marketstack_called: false, error: error.message, note: '기존 가격을 확인하지 못해 Yahoo를 호출하지 않습니다.' })
  }
  const fetchTargets = targets.filter((target) => {
    if (target.held || !target.expectedDate) return true
    const id = target.symbol || target.item
    return !(id && storedKeys.has(`${id}|${target.expectedDate}`))
  })
  const alreadyStored = targets.length - fetchTargets.filter((target) => !target.held && target.expectedDate).length
  const uncollected = fetchTargets.filter(target => !target.held && target.expectedDate).length
  if (uncollected && incompleteBatchAlreadyAttempted(recentJobs, targets, scope, batch)) {
    return res.status(200).json({
      ok: false, dry_run: dryRun, completed_write: false,
      yahoo_called: false, marketstack_called: false,
      scope, batch, already_stored: alreadyStored,
      already_attempted_same_session: true,
      held_remaining: uncollected, would_fetch: 0, wrote: 0,
      completeness: 'partial',
      note: '같은 확정 거래일 배치는 이미 수집했습니다. 불완전한 원본은 검토 전까지 재호출하지 않습니다.',
    })
  }
  if (dryRun) {
    return res.status(200).json({
      ok: true,
      dry_run: true,
      completed_write: false,
      yahoo_called: false,
      marketstack_called: false,
      marketstack_would_request: 0,
      scope,
      batch,
      already_stored: alreadyStored,
      would_fetch: fetchTargets.filter((target) => !target.held && target.expectedDate).length,
      note: 'dry-run은 Yahoo와 Marketstack를 호출하지 않습니다.',
    })
  }
  const yahooTargets = fetchTargets.filter((target) => !target.held && target.expectedDate)
  if (!yahooTargets.length) {
    return res.status(200).json({
      ok: false,
      completed_write: false,
      yahoo_called: false,
      marketstack_called: false,
      scope,
      batch,
      already_stored: alreadyStored,
      wrote: 0,
      note: '확정 거래일 가격이 이미 있어 Yahoo를 호출하지 않았습니다.',
    })
  }
  const startMeta = {
    provider: PROVIDER,
    price_basis: PRICE_BASIS,
    storage_source_key: STORAGE_SOURCE,
    scope,
    batch,
    catchup: false,
    universe: UNIVERSE_COUNTS,
    completeness: 'pending',
    yahoo_called: false,
    marketstack_billed_symbols: 0,
  }
  const { data: startedJob, error: startErr } = await supabase.from('ingestion_jobs').insert([{
    source: PROVIDER,
    dataset: 'stock_daily_prices',
    status: 'started',
    rows_processed: 0,
    meta: startMeta,
  }]).select('id').single()
  if (startErr || !startedJob?.id) {
    return res.status(200).json({ ok: false, completed_write: false, yahoo_called: false, marketstack_called: false, error: startErr?.message || 'ingestion job start failed' })
  }

  const deadline = Date.now() + 240000
  const yahooRun = await mapUntilYahooLimit(yahooTargets, 1, async (target, breaker) => {
    const row = await classifyTarget(target, deadline, breaker)
    if (breaker.tripped && !breaker.persist) {
      breaker.persist = supabase.from('ingestion_jobs').update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_message: `yahoo_${breaker.tripped.yahoo_limit_status}`,
        meta: { ...startMeta, ...breaker.tripped, yahoo_called: true },
      }).eq('id', startedJob.id)
    }
    if (breaker.persist) {
      try { await breaker.persist } catch { /* 호출은 이미 멈춤. 기록 실패로 다시 호출하지 않습니다. */ }
    }
    return row
  }, { gapMs: YAHOO_MIN_GAP_MS, deadline })
  const classified = [
    ...fetchTargets.filter((target) => target.held || !target.expectedDate).map((target) => (
      target.held
        ? { ...target, assessment: { status: 'held', trade_date: null, price_basis: PRICE_BASIS } }
        : { ...target, assessment: { status: 'calendar_hold', trade_date: null, price_basis: PRICE_BASIS, note: '거래일 달력에 확정 세션이 없습니다.' } }
    )),
    ...yahooRun.rows,
  ]
  const yahooBreaker = yahooRun.breaker
  const supplementPlan = marketstackCandidates(classified)
  const needed = requestsForSymbols(supplementPlan.eligible.length)
  const hasMarketstackKey = Boolean(process.env.MARKETSTACK_ACCESS_KEY || process.env.MARKETSTACK_APIKEY || process.env.MARKETSTACK_API_KEY)
  const monthlyBudget = enforcedQuota(process.env.MARKETSTACK_MONTHLY_BUDGET_REQUESTS)
  let usage = {
    used: null,
    reason: 'usage_unconfirmed',
    baseline_used: VERIFIED_MARKETSTACK_USAGE.usedRequests,
    extra: null,
  }
  usage = await readReservedUsage(supabase, now)
  const marketstackHold = marketstackHoldReason({
    needed,
    classifiedCount: classified.length,
    usage,
    hasKey: hasMarketstackKey,
    now,
    budget: monthlyBudget,
  })
  const marketstackKey = process.env.MARKETSTACK_ACCESS_KEY || process.env.MARKETSTACK_APIKEY || process.env.MARKETSTACK_API_KEY
  const willCallMarketstack = !yahooBreaker.tripped && marketstackAllowed({ catchup: false, needed, hold: marketstackHold })
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
    return res.status(200).json({ ok: false, completed_write: false, yahoo_called: true, error: existingErr.message })
  }
  const { data: previousRows, error: previousErr } = symbols.length && previousDates.length
    ? await supabase.from('stock_daily_prices').select('symbol,trade_date,close,raw').in('symbol', symbols).in('trade_date', previousDates)
    : { data: [], error: null }
  if (previousErr) {
    await supabase.from('ingestion_jobs').update({ status: 'failed', finished_at: new Date().toISOString(), error_message: previousErr.message }).eq('id', startedJob.id)
    return res.status(200).json({ ok: false, completed_write: false, yahoo_called: true, error: previousErr.message })
  }
  const dashboardDates = [...new Set([...dates, ...previousDates])]
  const { data: dashboardExisting, error: dashboardReadErr } = dashboardDates.length
    ? await supabase.from('market_dashboard_daily').select('*').in('trade_date', dashboardDates)
    : { data: [], error: null }
  if (dashboardReadErr) {
    await supabase.from('ingestion_jobs').update({ status: 'failed', finished_at: new Date().toISOString(), error_message: dashboardReadErr.message }).eq('id', startedJob.id)
    return res.status(200).json({ ok: false, completed_write: false, yahoo_called: true, error: dashboardReadErr.message })
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
  const fxDates = isDashboardScope ? dashboardDates : []
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
    ...(yahooBreaker.tripped || {}),
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
      close_evidence: row.assessment.close_evidence || null,
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
  if (isDashboardScope) {
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
      return res.status(200).json({ ok: false, completed_write: false, yahoo_called: true, error: message, fx_compensated: committed.compensated, wrote })
    }
  }

  const outcome = yahooBreaker.tripped ? { status: 'failed', completeness: 'partial' } : jobOutcome(decided)
  const { error: finishErr } = await supabase.from('ingestion_jobs').update({
    status: outcome.status,
    finished_at: new Date().toISOString(),
    rows_processed: wrote,
    error_message: yahooBreaker.tripped ? `yahoo_${yahooBreaker.tripped.yahoo_limit_status}` : (outcome.completeness === 'partial' ? 'incomplete price collection' : null),
    meta: { ...baseMeta, completeness: outcome.completeness },
  }).eq('id', startedJob.id)
  if (finishErr) return res.status(200).json({ ok: false, completed_write: false, yahoo_called: true, error: finishErr.message, wrote })

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
    yahoo_access_limited: Boolean(yahooBreaker.tripped),
    yahoo_cooldown_until: yahooBreaker.tripped?.yahoo_cooldown_until || null,
    scope,
    wrote,
    quarantined: quarantined.length,
    dashboard_upserts: dashboardRows.length,
    fx_table: fxTableRows.length ? 'yahoo' : 'untouched',
    universe: UNIVERSE_COUNTS,
    ...report,
  })
}
