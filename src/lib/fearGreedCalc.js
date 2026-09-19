/**
 * Fear & Greed — stock_daily_prices + market_dashboard 由来データ（VIX/MOVE/商品/FX）のみ。
 * 外部 CNN / Alternative.me API は使わない。
 *
 * stock_daily_prices は PostgREST の行上限（多くは 1000）があるため、
 * fetchStockDailyHistoryBySymbolMap でページング取得する（125日・52週指標が切れないように）。
 */

import { fetchStockDailyHistoryBySymbolMap } from './stockDailyHistory.js'

export const JP_SYMBOLS = [
  '7203.T', '8306.T', '6501.T', '6758.T', '8316.T', '6857.T', '8411.T', '8035.T', '8058.T', '9983.T',
  '9984.T', '7011.T', '8031.T', '4519.T', '8001.T', '6861.T', '9432.T', '8766.T', '6503.T', '6301.T',
  '7267.T', '4502.T', '6954.T', '7751.T', '8053.T', '4063.T', '6902.T', '9433.T', '4568.T', '8725.T',
  '6098.T', '8015.T', '6273.T', '6146.T', '6367.T', '8802.T', '6506.T', '6981.T', '7201.T', '9020.T',
  '2802.T', '5108.T', '4543.T', '4901.T', '7733.T', '3382.T', '9201.T', '8591.T', '8604.T', '6702.T',
]

export const US_SYMBOLS = [
  'NVDA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AVGO', 'COST', 'NFLX',
  'ADBE', 'AMD', 'PEP', 'CSCO', 'INTU', 'AMGN', 'QCOM', 'TXN', 'HON', 'AMAT',
  'BKNG', 'ADP', 'SBUX', 'GILD', 'ADI', 'MU', 'REGN', 'VRTX', 'VRT', 'PANW', 'KLAC',
  'LRCX', 'NXPI', 'ORLY', 'FTNT', 'ADSK', 'WDAY', 'AEP', 'MCHP', 'CPRT', 'ROST',
  'BRK.B', 'LLY', 'JPM', 'V', 'UNH', 'MA', 'XOM', 'WMT', 'PG', 'JNJ',
]

const MARKET_CFG = {
  JP: {
    symbols: JP_SYMBOLS,
    idxSym: '1329.T',
    bondSym: '2621.T',
    dashboardIdxSym: '^N225',
    dashboardIdxLabel: '日経225',
  },
  US: {
    symbols: US_SYMBOLS,
    idxSym: 'IVV',
    bondSym: 'TLT',
    dashboardIdxSym: '^GSPC',
    dashboardIdxLabel: 'S&P500',
  },
}

/** 52週近似に必要な最低営業日数（これ未満は strength を未計算扱い） */
const MIN_STRENGTH_DAYS = 120
/** モメンタム・ボラ等に必要な最低営業日数 */
const MIN_TREND_DAYS = 20

export function getGrade(score) {
  if (score <= 20) return { label: '極度の恐怖', en: 'Extreme Fear', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', emoji: '😱', desc: '市場心理が大きく不安方向に傾いています。価格変動と分散状況の確認が重要です。' }
  if (score <= 40) return { label: '恐怖', en: 'Fear', color: '#f97316', bg: '#fff7ed', border: '#fed7aa', emoji: '😨', desc: '投資家心理に慎重さが見られます。市場環境と保有比率を落ち着いて確認しましょう。' }
  if (score <= 60) return { label: '中立', en: 'Neutral', color: '#eab308', bg: '#fefce8', border: '#fde68a', emoji: '😐', desc: '市場心理は中立圏です。短期の動きだけでなく、複数指標をあわせて確認しましょう。' }
  if (score <= 80) return { label: '強欲', en: 'Greed', color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0', emoji: '😏', desc: '投資家心理に楽観が見られます。過熱感や保有比率の偏りに注意が必要です。' }
  return { label: '極度の強欲', en: 'Extreme Greed', color: '#16a34a', bg: '#dcfce7', border: '#86efac', emoji: '🤑', desc: '市場心理が大きく楽観方向に傾いています。リスク許容度と分散状況を確認しましょう。' }
}

/** 高スコア＝強欲圏でも「過熱時は慎重」というアドバイス用 */
export function getFearGreedStance(score) {
  if (score >= 81) {
    return {
      label: 'リスク管理優先',
      hint: '極端な楽観圏です。利確・分散・サイズ上限の再確認を。',
      icon: '🛡️',
    }
  }
  if (score >= 61) {
    return {
      label: 'やや慎重',
      hint: '強欲圏。モメンタムは良好でも過熱・集中リスクに注意。',
      icon: '🛡️',
    }
  }
  if (score >= 41) {
    return {
      label: 'バランス確認',
      hint: '中立圏。複数指標の方向が揃っているか確認。',
      icon: '⚖️',
    }
  }
  if (score >= 21) {
    return {
      label: '冷静に機会探索',
      hint: '恐怖圏。パニック売りに追随せず、ルール内で検討。',
      icon: '🔍',
    }
  }
  return {
    label: '防御的スタンス',
    hint: '極端な恐怖圏。現金比率・分散を最優先に。',
    icon: '🧊',
  }
}

const clampScore = (n) => Math.max(10, Math.min(90, Math.round(Number(n) || 50)))

/** VIX 低→強欲、高→恐怖（dashboard ^VIX） */
export function vixLevelToScore(vix) {
  const v = Number(vix)
  if (!Number.isFinite(v) || v <= 0) return null
  return clampScore(100 - (v - 12) * 3.5)
}

/** MOVE 低→強欲、高→恐怖（dashboard ^MOVE） */
export function moveLevelToScore(move) {
  const m = Number(move)
  if (!Number.isFinite(m) || m <= 0) return null
  return clampScore(100 - (m - 55) * 1.1)
}

/** dashboard Risk-On/Off Score（高いほどリスクオン＝強欲寄り） */
export function riskOnLevelToScore(val) {
  const n = Number(val)
  if (!Number.isFinite(n)) return null
  return clampScore(n)
}

function ymdCutoffDaysAgo(days) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function mapToBySymbol(historyMap) {
  const bySymbol = {}
  for (const [sym, rows] of historyMap.entries()) {
    bySymbol[sym] = Array.isArray(rows) ? rows : []
  }
  return bySymbol
}

function pctDayFromRaw(row) {
  const raw = row?.raw
  if (raw && Number.isFinite(Number(raw.pct_day))) return Number(raw.pct_day)
  return null
}

/** 直近2営業日の終値比（%）。raw.pct_day が無ければ終値から算出 */
function pctDayFromSeries(series) {
  if (!Array.isArray(series) || series.length < 2) return null
  const fromRaw = pctDayFromRaw(series[series.length - 1])
  if (Number.isFinite(fromRaw)) return fromRaw
  const last = Number(series[series.length - 1]?.close)
  const prev = Number(series[series.length - 2]?.close)
  if (!(prev > 0) || !Number.isFinite(last)) return null
  return ((last - prev) / prev) * 100
}

function rowsOnOrBefore(rows, ymd) {
  if (!ymd) return rows || []
  return (rows || []).filter((r) => String(r.trade_date).slice(0, 10) <= ymd)
}

function renormalizeIndicators(indicators) {
  const active = indicators.filter((i) => i.realData)
  const sum = active.reduce((s, i) => s + i.weight, 0)
  if (sum <= 0) return { indicators: [], totalScore: 50 }
  const normalized = active.map((i) => ({ ...i, weight: i.weight / sum }))
  const totalScore = clampScore(normalized.reduce((s, i) => s + i.score * i.weight, 0))
  return { indicators: normalized, totalScore }
}

/**
 * asOfYmd 時点までの系列だけで総合点を再計算（前日比・1週間前・30日推移用）。
 * 金・Risk-On は日次スナップが無いので当日フル点でのみ使い、履歴点では VIX/MOVE/EOD を主にする。
 */
function computeSnapshotScore({
  bySymbol,
  symbols,
  idxSym,
  bondSym,
  dashIdxData,
  vixByDate,
  moveByDate,
  asOfYmd,
  goldPct,
  riskOnScore,
  includeDashboardExtras = false,
}) {
  const idxData = rowsOnOrBefore(bySymbol[idxSym], asOfYmd)
  const bondData = rowsOnOrBefore(bySymbol[bondSym], asOfYmd)
  const dashSlice = rowsOnOrBefore(dashIdxData, asOfYmd)

  let momentumScore = null
  if (idxData.length >= MIN_TREND_DAYS) {
    const recent = idxData.slice(-125)
    const ma125 = recent.reduce((s, r) => s + Number(r.close), 0) / recent.length
    const latest = Number(idxData[idxData.length - 1].close)
    const pct = ma125 > 0 ? ((latest - ma125) / ma125) * 100 : 0
    momentumScore = clampScore(50 + pct * 3)
  }

  let strengthScore = null
  let newHighCount = 0
  let newLowCount = 0
  let totalChecked = 0
  for (const sym of symbols) {
    const data = rowsOnOrBefore(bySymbol[sym], asOfYmd)
    if (!data || data.length < MIN_STRENGTH_DAYS) continue
    const recent252 = data.slice(-252)
    const prices = recent252.map((r) => Number(r.close)).filter((n) => Number.isFinite(n) && n > 0)
    if (prices.length < MIN_STRENGTH_DAYS) continue
    const high52 = Math.max(...prices)
    const low52 = Math.min(...prices)
    const latestP = prices[prices.length - 1]
    totalChecked += 1
    if (latestP >= high52 * 0.995) newHighCount += 1
    else if (latestP <= low52 * 1.005) newLowCount += 1
  }
  if (totalChecked > 0) {
    const ratio = (newHighCount - newLowCount) / totalChecked
    strengthScore = clampScore(50 + ratio * 60)
  }

  let breadthScore = null
  let upCount = 0
  let totalBreadth = 0
  for (const sym of symbols) {
    const data = rowsOnOrBefore(bySymbol[sym], asOfYmd)
    if (!data || data.length < 2) continue
    const last = Number(data[data.length - 1].close)
    const prev = Number(data[data.length - 2].close)
    if (last > 0 && prev > 0) {
      totalBreadth += 1
      if (last > prev) upCount += 1
    }
  }
  if (totalBreadth > 0) {
    breadthScore = clampScore((upCount / totalBreadth) * 100)
  }

  let volatilityScore = null
  const idxData20 = idxData.slice(-21)
  if (idxData20.length >= MIN_TREND_DAYS) {
    const returns = []
    for (let i = 1; i < idxData20.length; i += 1) {
      const prev = Number(idxData20[i - 1].close)
      const cur = Number(idxData20[i].close)
      if (prev > 0) returns.push((cur - prev) / prev)
    }
    if (returns.length > 0) {
      const mean = returns.reduce((s, v) => s + v, 0) / returns.length
      const variance = returns.reduce((s, v) => s + (v - mean) ** 2, 0) / returns.length
      const stdDev = Math.sqrt(variance) * 100
      volatilityScore = clampScore(80 - stdDev * 25)
    }
  }

  let safeHavenScore = null
  if (bondData.length >= MIN_TREND_DAYS && idxData.length >= MIN_TREND_DAYS) {
    const bondRecent = bondData.slice(-20)
    const equityRecent = idxData.slice(-20)
    const bondReturn = (Number(bondRecent[bondRecent.length - 1].close) - Number(bondRecent[0].close)) / Number(bondRecent[0].close)
    const equityReturn = (Number(equityRecent[equityRecent.length - 1].close) - Number(equityRecent[0].close)) / Number(equityRecent[0].close)
    const spread = equityReturn - bondReturn
    safeHavenScore = clampScore(50 + spread * 200)
  }
  const indexPct = pctDayFromSeries(dashSlice.length >= 2 ? dashSlice : idxData)
  if (includeDashboardExtras && Number.isFinite(goldPct) && Number.isFinite(indexPct)) {
    const goldTilt = clampScore(50 - goldPct * 4 + indexPct * 3)
    safeHavenScore = safeHavenScore != null
      ? clampScore(safeHavenScore * 0.6 + goldTilt * 0.4)
      : goldTilt
  }

  let momentumAccelScore = null
  if (idxData.length >= MIN_TREND_DAYS) {
    const ma5 = idxData.slice(-5).reduce((s, r) => s + Number(r.close), 0) / 5
    const ma20 = idxData.slice(-20).reduce((s, r) => s + Number(r.close), 0) / 20
    const ratio = ma20 > 0 ? ((ma5 - ma20) / ma20) * 100 : 0
    momentumAccelScore = clampScore(50 + ratio * 8)
  }

  const vixS = asOfYmd && vixByDate.has(asOfYmd) ? vixLevelToScore(vixByDate.get(asOfYmd)) : null
  const moveS = asOfYmd && moveByDate.has(asOfYmd) ? moveLevelToScore(moveByDate.get(asOfYmd)) : null

  let volumeScore = null
  const volRows = idxData.slice(-21).filter((r) => Number(r.volume) > 0)
  if (volRows.length >= 10) {
    const vols = volRows.map((r) => Number(r.volume))
    const recent5 = vols.slice(-5).reduce((s, v) => s + v, 0) / Math.min(5, vols.slice(-5).length)
    const avg20 = vols.reduce((s, v) => s + v, 0) / vols.length
    if (avg20 > 0) {
      const ratio = recent5 / avg20
      volumeScore = clampScore(50 + (ratio - 1) * 80)
    }
  }

  const indicators = [
    { id: 'momentum', score: momentumScore, weight: 0.16, realData: momentumScore != null },
    { id: 'strength', score: strengthScore, weight: 0.12, realData: strengthScore != null },
    { id: 'breadth', score: breadthScore, weight: 0.12, realData: breadthScore != null },
    { id: 'volatility', score: volatilityScore, weight: 0.08, realData: volatilityScore != null },
    { id: 'safe_haven', score: safeHavenScore, weight: 0.1, realData: safeHavenScore != null },
    { id: 'momentum_accel', score: momentumAccelScore, weight: 0.08, realData: momentumAccelScore != null },
    { id: 'vix', score: vixS, weight: 0.14, realData: vixS != null },
    { id: 'move', score: moveS, weight: 0.08, realData: moveS != null },
    { id: 'volume', score: volumeScore, weight: 0.08, realData: volumeScore != null },
    {
      id: 'risk_on',
      score: includeDashboardExtras ? riskOnScore : null,
      weight: 0.1,
      realData: includeDashboardExtras && riskOnScore != null,
    },
  ].map((i) => ({ ...i, score: i.score ?? 50 }))

  return renormalizeIndicators(indicators)
}

function buildHistoryFromSnapshots(args, days = 30) {
  const idx = args.dashIdxData?.length ? args.dashIdxData : (args.bySymbol[args.idxSym] || [])
  const slice = idx.slice(-Math.max(days, 5))
  const history = []
  for (const row of slice) {
    const d = String(row.trade_date).slice(0, 10)
    const { totalScore } = computeSnapshotScore({
      ...args,
      asOfYmd: d,
      includeDashboardExtras: false,
    })
    history.push({ day: d, score: totalScore })
  }
  while (history.length < 30) history.unshift({ day: '', score: 50 })
  return history.slice(-30)
}

async function fetchSymbolPricesPaged(supabase, symbols) {
  // ~18ヶ月分（営業日 ~260+α）。PostgREST 1000行上限は内部でページング。
  const cutoff = ymdCutoffDaysAgo(400)
  const historyMap = await fetchStockDailyHistoryBySymbolMap(supabase, symbols, cutoff, {
    select: 'symbol,trade_date,close,open,volume,raw,source,fetched_at',
    jpDedupe: true,
    jpSourceFilter: ['marketstack', 'manual_close'],
    jpChunkSize: 16,
    nonJpChunkSize: 20,
    parallelChunks: 6,
    pageSize: 1000,
  })
  return mapToBySymbol(historyMap)
}

async function fetchIndexSeries(supabase, symbol, limit = 90) {
  const cutoff = ymdCutoffDaysAgo(Math.max(limit * 2, 120))
  const historyMap = await fetchStockDailyHistoryBySymbolMap(supabase, [symbol], cutoff, {
    select: 'symbol,trade_date,close,raw,source,fetched_at',
    jpDedupe: true,
    jpSourceFilter: ['marketstack', 'manual_close'],
    nonJpChunkSize: 1,
    pageSize: 1000,
  })
  const rows = historyMap.get(symbol) || []
  return rows.slice(-limit)
}

async function fetchCommodityLatest(supabase, name) {
  const { data, error } = await supabase
    .from('commodity_daily_prices')
    .select('trade_date,price,percentage_day,raw')
    .eq('commodity_name', name)
    .order('trade_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

async function fetchFxLatest(supabase) {
  const { data, error } = await supabase
    .from('fx_daily_usdjpy')
    .select('as_of_date,usd_jpy')
    .order('as_of_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {'JP'|'US'} market
 */
export async function calcFearGreedFromDB(supabase, market = 'JP') {
  const cfg = MARKET_CFG[market] || MARKET_CFG.JP
  const symbols = cfg.symbols
  const idxSym = cfg.idxSym
  const bondSym = cfg.bondSym
  const dashSym = cfg.dashboardIdxSym
  const allSyms = [...new Set([...symbols, idxSym, bondSym, '^VIX', '^MOVE', dashSym])]

  const [bySymbol, vixSeries, moveSeries, dashIdxSeries, goldRow, riskOnRow, fxRow] = await Promise.all([
    fetchSymbolPricesPaged(supabase, allSyms),
    fetchIndexSeries(supabase, '^VIX', 45),
    fetchIndexSeries(supabase, '^MOVE', 45),
    fetchIndexSeries(supabase, dashSym, 45),
    fetchCommodityLatest(supabase, 'gold'),
    fetchCommodityLatest(supabase, 'risk_on_off'),
    fetchFxLatest(supabase),
  ])

  const hasAny = Object.values(bySymbol).some((rows) => Array.isArray(rows) && rows.length > 0)
  if (!hasAny) throw new Error('DB fetch failed')

  const idxData = bySymbol[idxSym] || []
  const bondData = bySymbol[bondSym] || []
  const dashIdxData = dashIdxSeries.length ? dashIdxSeries : (bySymbol[dashSym] || [])

  const vixByDate = new Map(
    (vixSeries || []).map((r) => [String(r.trade_date).slice(0, 10), Number(r.close)]),
  )
  const moveByDate = new Map(
    (moveSeries || []).map((r) => [String(r.trade_date).slice(0, 10), Number(r.close)]),
  )

  const goldPctRaw = Number(goldRow?.percentage_day)
  const goldPct = Number.isFinite(goldPctRaw) ? goldPctRaw : null
  const riskOnScore = riskOnRow?.price != null ? riskOnLevelToScore(riskOnRow.price) : null

  const latestYmd = String(
    dashIdxData[dashIdxData.length - 1]?.trade_date
    || idxData[idxData.length - 1]?.trade_date
    || '',
  ).slice(0, 10) || null

  const snap = computeSnapshotScore({
    bySymbol,
    symbols,
    idxSym,
    bondSym,
    dashIdxData,
    vixByDate,
    moveByDate,
    asOfYmd: latestYmd,
    goldPct,
    riskOnScore,
    includeDashboardExtras: true,
  })

  const idxLatest = idxData[idxData.length - 1]
  const vixLatest = vixSeries[vixSeries.length - 1]
  const moveLatest = moveSeries[moveSeries.length - 1]
  const dashLatest = dashIdxData[dashIdxData.length - 1]
  const indexPct = pctDayFromSeries(dashIdxData.length >= 2 ? dashIdxData : idxData)

  const byId = Object.fromEntries((snap.indicators || []).map((i) => [i.id, i]))
  const scoreOf = (id, fallback = 50) => (byId[id] ? byId[id].score : fallback)
  const realOf = (id) => Boolean(byId[id])

  const indicators = [
    {
      id: 'momentum',
      name: '株価モメンタム',
      icon: '📈',
      desc: market === 'JP' ? '日経225連動ETFと125日移動平均' : 'S&P500連動ETFと125日移動平均',
      score: scoreOf('momentum'),
      weight: 0.16,
      realData: realOf('momentum'),
      source: 'EOD',
    },
    {
      id: 'strength',
      name: '株価強度',
      icon: '💪',
      desc: '52週高値・安値圏の銘柄比率',
      score: scoreOf('strength'),
      weight: 0.12,
      realData: realOf('strength'),
      source: 'EOD',
    },
    {
      id: 'breadth',
      name: '市場の幅',
      icon: '🌊',
      desc: '前営業日比の上昇銘柄割合',
      score: scoreOf('breadth'),
      weight: 0.12,
      realData: realOf('breadth'),
      source: 'EOD',
    },
    {
      id: 'volatility',
      name: '実現ボラティリティ',
      icon: '⚡',
      desc: '直近20営業日リターンの標準偏差',
      score: scoreOf('volatility'),
      weight: 0.08,
      realData: realOf('volatility'),
      source: 'EOD',
    },
    {
      id: 'safe_haven',
      name: '安全資産需要',
      icon: '🏦',
      desc: '国債ETF vs 株式 + 金（dashboard）',
      score: scoreOf('safe_haven'),
      weight: 0.1,
      realData: realOf('safe_haven'),
      source: bondData.length >= MIN_TREND_DAYS ? 'EOD+dashboard' : 'dashboard',
    },
    {
      id: 'momentum_accel',
      name: '短期モメンタム',
      icon: '🚀',
      desc: '5日 vs 20日移動平均の乖離',
      score: scoreOf('momentum_accel'),
      weight: 0.08,
      realData: realOf('momentum_accel'),
      source: 'EOD',
    },
    {
      id: 'vix',
      name: 'VIX（恐怖指数）',
      icon: '🌪️',
      desc: vixLatest
        ? `dashboard ${String(vixLatest.trade_date).slice(0, 10)} · 終値 ${Number(vixLatest.close).toFixed(2)}`
        : 'market_dashboard の VIX 行',
      score: scoreOf('vix'),
      weight: 0.14,
      realData: realOf('vix'),
      source: 'dashboard',
    },
    {
      id: 'move',
      name: '債券ボラ（MOVE）',
      icon: '📉',
      desc: moveLatest
        ? `dashboard ${String(moveLatest.trade_date).slice(0, 10)} · ${Number(moveLatest.close).toFixed(1)}`
        : 'market_dashboard の MOVE 行',
      score: scoreOf('move'),
      weight: 0.08,
      realData: realOf('move'),
      source: 'dashboard',
    },
    {
      id: 'volume',
      name: '取引量',
      icon: '📊',
      desc: market === 'JP' ? '日経連動ETFの出来高（5日/20日）' : 'S&P500 ETFの出来高（5日/20日）',
      score: scoreOf('volume'),
      weight: 0.08,
      realData: realOf('volume'),
      source: 'EOD',
    },
    {
      id: 'risk_on',
      name: 'Risk-On/Off',
      icon: '🎯',
      desc: riskOnRow
        ? `dashboard ${String(riskOnRow.trade_date).slice(0, 10)} · ${Number(riskOnRow.price).toFixed(1)}`
        : 'market_dashboard の Risk-On/Off Score',
      score: scoreOf('risk_on'),
      weight: 0.1,
      realData: realOf('risk_on'),
      source: 'dashboard',
    },
  ]

  const { indicators: normalizedIndicators, totalScore } = renormalizeIndicators(indicators)

  const history = buildHistoryFromSnapshots({
    bySymbol,
    symbols,
    idxSym,
    bondSym,
    dashIdxData: dashIdxData.length >= 5 ? dashIdxData : idxData,
    vixByDate,
    moveByDate,
    goldPct: null,
    riskOnScore: null,
  }, 30)

  // 当日点はフル指標（金・Risk-On 込み）に揃える
  if (history.length > 0 && latestYmd) {
    history[history.length - 1] = { day: latestYmd, score: totalScore }
  }

  const yesterday = history[history.length - 2]?.score ?? totalScore
  const weekAgo = history[history.length - 8]?.score ?? totalScore
  const latestTradeDate = dashLatest?.trade_date || idxLatest?.trade_date || null

  const dashboard = {
    tradeDate: latestTradeDate,
    indexLabel: cfg.dashboardIdxLabel,
    indexClose: dashLatest ? Number(dashLatest.close) : null,
    indexPctDay: indexPct,
    vix: vixLatest ? Number(vixLatest.close) : null,
    move: moveLatest ? Number(moveLatest.close) : null,
    riskOnOff: riskOnRow?.price != null ? Number(riskOnRow.price) : null,
    goldPctDay: goldPct,
    usdJpy: fxRow?.usd_jpy != null ? Number(fxRow.usd_jpy) : null,
    fxDate: fxRow?.as_of_date || null,
  }

  return {
    score: totalScore,
    yesterday,
    weekAgo,
    indicators: normalizedIndicators,
    history,
    latestTradeDate,
    dashboard,
    stance: getFearGreedStance(totalScore),
  }
}
