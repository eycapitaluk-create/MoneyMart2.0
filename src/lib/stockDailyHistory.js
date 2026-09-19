/**
 * stock_daily_prices を複数 source から取ったとき、同一 trade_date を 1 行に潰す。
 *
 * - 既定 (continuity): 同一日は manual_close 最優先。それ以外は直前終値に加え、直近ウィンドウの中央値とも対数距離が小さい方を採る。
 *   直前のみ参照すると一回の誤採で「指数級の誤終値」列にロックインすることがあるため、中央値もアンカーにする。
 *   さらに銘柄全体のロバスト中央値から 15 倍超の終値は同一日候補から除外（1545.T 等で jp_etf_csv / 誤 marketstack が混ざる）。
 * - fetched_then_source: manual_close があれば常に優先。それ以外は fetched_at 優先（レガシー）。
 */

const fetchedAtMs = (row) => {
  const t = row?.fetched_at ? new Date(row.fetched_at).getTime() : 0
  return Number.isFinite(t) ? t : 0
}

const isManualCloseSource = (src) => String(src || '').toLowerCase() === 'manual_close'

const medianOfSorted = (sortedNums) => {
  const nums = sortedNums.filter((n) => Number.isFinite(n) && n > 0)
  if (nums.length === 0) return null
  const mid = nums.length >>> 1
  if (nums.length % 2) return nums[mid]
  return (nums[mid - 1] + nums[mid]) / 2
}

/** 同一銘柄の raw 行から「ETF 円建 ~200」と「指数点位 ~40000」が混在するときの代表レンジ中央値 */
const computeRobustCloseMedian = (rows = [], maxRatio = 15) => {
  const closes = rows
    .map((r) => Number(r?.close))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b)
  if (closes.length === 0) return null
  let med = medianOfSorted(closes)
  if (med == null || med <= 0) return null
  const filtered = closes.filter((c) => c <= med * maxRatio && c >= med / maxRatio)
  if (filtered.length >= Math.max(3, Math.floor(closes.length * 0.4))) {
    med = medianOfSorted(filtered)
  }
  return med
}

const isClosePlausibleVsAnchor = (close, anchor, maxRatio = 15) => {
  const c = Number(close)
  const a = Number(anchor)
  if (!Number.isFinite(c) || c <= 0) return false
  if (!Number.isFinite(a) || a <= 0) return true
  const ratio = c / a
  return ratio <= maxRatio && ratio >= 1 / maxRatio
}

/** 前日終値からの対数リターンが極端な単一 source 行（2629.T 等の誤 EOD）を除外 */
const isClosePlausibleVsPrevClose = (close, prevClose, maxLogJump = Math.log(1.5)) => {
  const c = Number(close)
  const p = Number(prevClose)
  if (!Number.isFinite(c) || c <= 0) return false
  if (!Number.isFinite(p) || p <= 0) return true
  if (detectLikelyStockSplitRatio(p, c) != null) return true
  return Math.abs(Math.log(c / p)) <= maxLogJump
}

/** 受益権分割・株式分割らしい整数比（価格が一気に 1/n になる）を検出 */
const STANDARD_SPLIT_RATIOS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20]

export const detectLikelyStockSplitRatio = (prevClose, close, tolerance = 0.1) => {
  const p = Number(prevClose)
  const c = Number(close)
  if (!Number.isFinite(p) || !Number.isFinite(c) || p <= 0 || c <= 0) return null
  const forward = p / c
  const reverse = c / p
  for (const ratio of STANDARD_SPLIT_RATIOS) {
    if (forward >= 1.4 && Math.abs(forward - ratio) / ratio <= tolerance) return ratio
    if (reverse >= 1.4 && Math.abs(reverse - ratio) / ratio <= tolerance) return -ratio
  }
  return null
}

/**
 * trade_date 昇順の deduped 日足から N 営業日前終値比の騰落率（%）を返す。
 * latestClose は省略時に最終行の close を使う（v_stock_latest と履歴の不整合を避ける）。
 */
export const tradingSessionReturnPct = (rows = [], sessionOffset = 5, latestClose = null) => {
  const sorted = [...rows]
    .filter((row) => Number.isFinite(Number(row?.close)) && Number(row.close) > 0)
    .sort((a, b) => String(a.trade_date || a.tradeDate || '').localeCompare(String(b.trade_date || b.tradeDate || '')))
  if (sorted.length < sessionOffset + 1) return null
  const last = sorted[sorted.length - 1]
  const base = sorted[sorted.length - 1 - sessionOffset]
  const latest = Number.isFinite(Number(latestClose)) && Number(latestClose) > 0
    ? Number(latestClose)
    : Number(last?.close)
  const baseClose = Number(base?.close)
  if (!Number.isFinite(latest) || !Number.isFinite(baseClose) || baseClose <= 0) return null
  return ((latest - baseClose) / baseClose) * 100
}

const filterCandidatesByAnchors = (candidates, anchors, maxRatio = 15) => {
  const aa = Array.isArray(anchors) ? anchors.filter((x) => Number.isFinite(Number(x)) && Number(x) > 0) : []
  if (aa.length === 0) return candidates
  const filtered = candidates.filter((row) => {
    const close = Number(row?.close)
    return aa.some((a) => isClosePlausibleVsAnchor(close, a, maxRatio))
  })
  return filtered.length > 0 ? filtered : []
}

/** 小さいほど v_stock_latest の case 順に近い */
const sourcePriority = (src) => {
  const s = String(src || '').toLowerCase()
  if (s === 'marketstack') return 0
  if (s === 'yfinance') return 1
  if (s === 'jp_etf_csv') return 3
  return 2
}

/** b が a より「勝つ」べきなら true（後から Map に入れて上書きする想定） */
const shouldPreferRow = (candidate, incumbent) => {
  const cm = isManualCloseSource(candidate.source)
  const im = isManualCloseSource(incumbent.source)
  if (cm !== im) return cm
  if (cm && im) return fetchedAtMs(candidate) > fetchedAtMs(incumbent)
  const fc = fetchedAtMs(candidate)
  const fi = fetchedAtMs(incumbent)
  if (fc !== fi) return fc > fi
  return sourcePriority(candidate.source) < sourcePriority(incumbent.source)
}

/** 前日比が取れない先頭日など: manual_close > marketstack > yfinance、同順位なら fetched_at */
const preferSourceFirst = (candidate, incumbent) => {
  const cm = isManualCloseSource(candidate.source)
  const im = isManualCloseSource(incumbent.source)
  if (cm !== im) return cm
  const sp = sourcePriority(candidate.source) - sourcePriority(incumbent.source)
  if (sp !== 0) return sp < 0
  return fetchedAtMs(candidate) > fetchedAtMs(incumbent)
}

/** 直近の採用済み終値から中央値を取り、異常な prev と併せたときでもスパイク列にロックインされないようにする */
const medianLastChosenCloses = (acceptedAscending = [], maxWindow = 21) => {
  const sliced = acceptedAscending.slice(-Math.max(1, maxWindow))
  const nums = sliced
    .map((r) => Number(r.close))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b)
  if (nums.length === 0) return null
  const mid = nums.length >>> 1
  if (nums.length % 2) return nums[mid]
  return (nums[mid - 1] + nums[mid]) / 2
}

/** 「前日との対数距離」が複数のアンカー（直前終値や直近中央値）のうち最小になる行を選ぶ */
const pickClosestToAnchors = (candidates, anchors) => {
  const aa = Array.isArray(anchors) ? anchors.filter((x) => Number.isFinite(Number(x)) && Number(x) > 0) : []
  let best = null
  let bestScore = Infinity
  for (const c of candidates) {
    const close = Number(c.close)
    if (!Number.isFinite(close) || close <= 0) continue
    let score = Infinity
    for (const a of aa) {
      score = Math.min(score, Math.abs(Math.log(close / a)))
    }
    if (best == null || score < bestScore - 1e-12) {
      best = c
      bestScore = score
    } else if (best != null && Math.abs(score - bestScore) <= 1e-12 && preferSourceFirst(c, best)) {
      best = c
    }
  }
  return best || candidates[0]
}

/** 直前終値が直近レンジの中央値から極端に外れているときは、アンカーから外してスパイク連鎖を切る（JP ETF で index 級の誤 close が混ざるケース） */
const buildContinuityAnchors = (acceptedSoFarAscending, prevClose) => {
  const med = medianLastChosenCloses(acceptedSoFarAscending, 21)
  const anchors = []
  const prev = Number.isFinite(Number(prevClose)) && Number(prevClose) ? Number(prevClose) : NaN
  const m = Number.isFinite(Number(med)) && Number(med) ? Number(med) : NaN
  if (m > 0) anchors.push(m)
  const ratio = prev > 0 && m > 0 ? prev / m : NaN
  const prevPlausible =
    !(Number.isFinite(ratio)) || (ratio <= 15 && ratio >= 1 / 15)
  if (prev > 0 && prevPlausible && !anchors.includes(prev)) anchors.push(prev)
  if (anchors.length === 0 && prev > 0) anchors.push(prev)
  return anchors
}

/**
 * @param {Array<{ trade_date?: string, close?: number, source?: string, fetched_at?: string }>} rows
 * @param {object} [options]
 * @param {'fetched_then_source'|'continuity'} [options.mode] 既定は continuity
 * @returns {Array} trade_date 昇順、日付ごとに 1 行
 */
export function dedupeStockDailyPricesByTradeDate(rows = [], options = {}) {
  const mode = options.mode || 'continuity'
  if (!Array.isArray(rows) || rows.length === 0) return []
  const valid = rows.filter(
    (row) => row?.trade_date && Number.isFinite(Number(row?.close)) && Number(row.close) > 0,
  )

  if (mode === 'fetched_then_source') {
    const byDate = new Map()
    for (const row of valid) {
      const d = String(row.trade_date).slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue
      const prev = byDate.get(d)
      if (!prev || shouldPreferRow(row, prev)) byDate.set(d, row)
    }
    return [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, row]) => row)
  }

  const byDateLists = new Map()
  for (const row of valid) {
    const d = String(row.trade_date).slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue
    if (!byDateLists.has(d)) byDateLists.set(d, [])
    byDateLists.get(d).push(row)
  }
  const sortedDates = [...byDateLists.keys()].sort()
  const seriesMedian = computeRobustCloseMedian(valid)
  const maxLogJumpFromPrev = Number.isFinite(Number(options.maxLogJumpFromPrev))
    ? Number(options.maxLogJumpFromPrev)
    : Math.log(1.5)
  const out = []
  let prevClose = null
  for (const d of sortedDates) {
    const candidates = byDateLists.get(d)
    const manualRows = candidates.filter((r) => isManualCloseSource(r.source))
    const continuityAnchors = [
      ...buildContinuityAnchors(out, prevClose),
      ...(seriesMedian != null && seriesMedian > 0 ? [seriesMedian] : []),
    ]
    let plausibleCandidates = manualRows.length > 0
      ? manualRows
      : filterCandidatesByAnchors(candidates, continuityAnchors)
    if (plausibleCandidates.length === 0) continue
    if (manualRows.length === 0 && prevClose != null && prevClose > 0) {
      plausibleCandidates = plausibleCandidates.filter((row) => (
        isClosePlausibleVsPrevClose(Number(row?.close), prevClose, maxLogJumpFromPrev)
      ))
      if (plausibleCandidates.length === 0) continue
    }

    let chosen
    if (manualRows.length > 0) {
      chosen = manualRows.reduce(
        (best, row) => (best == null || fetchedAtMs(row) > fetchedAtMs(best) ? row : best),
        null,
      )
    } else if (plausibleCandidates.length === 1) {
      chosen = plausibleCandidates[0]
    } else if (prevClose != null && prevClose > 0) {
      chosen = pickClosestToAnchors(plausibleCandidates, buildContinuityAnchors(out, prevClose))
    } else {
      chosen = plausibleCandidates.reduce(
        (best, row) => (best == null || preferSourceFirst(row, best) ? row : best),
        null,
      )
    }
    if (!chosen) continue
    const chosenVol = Number(chosen.volume)
    if (!Number.isFinite(chosenVol) || chosenVol <= 0) {
      const volDonor = candidates.find((row) => {
        const v = Number(row?.volume)
        return Number.isFinite(v) && v > 0
      })
      if (volDonor) chosen = { ...chosen, volume: Number(volDonor.volume) }
    }
    out.push(chosen)
    prevClose = Number(chosen.close)
  }
  return out
}

const chunkSymbols = (symbols, size) => {
  const out = []
  for (let i = 0; i < symbols.length; i += size) out.push(symbols.slice(i, i + size))
  return out
}

/**
 * Multi-symbol history: paginate by trade_date order so Supabase row caps (often 1000) do not truncate 1Y metrics.
 * JP (.T) chunks optionally filter source / dedupe; non-JP chunks use rows as returned (sorted by date).
 *
 * @param {*} supabase Supabase client
 * @param {string[]} symbols
 * @param {string} cutoffStr YYYY-MM-DD
 * @param {object} [options]
 * @param {string} [options.select]
 * @param {boolean} [options.jpDedupe]
 * @param {string[]|null} [options.jpSourceFilter] if non-null, applied only to .T chunks
 * @param {number} [options.jpChunkSize]
 * @param {number} [options.nonJpChunkSize]
 * @param {number} [options.parallelChunks] parallel multi-symbol chunk queries per wave
 * @param {number} [options.pageSize] PostgREST page size (max rows per request)
 * @returns {Promise<Map<string, Array>>}
 */
export async function fetchStockDailyHistoryBySymbolMap(supabase, symbols, cutoffStr, options = {}) {
  const historyBySymbol = new Map()
  if (!supabase || !Array.isArray(symbols) || symbols.length === 0) return historyBySymbol

  const {
    select = 'symbol,trade_date,close,volume,source,fetched_at',
    jpDedupe = false,
    jpSourceFilter = null,
    jpChunkSize = 20,
    nonJpChunkSize = 28,
    parallelChunks = 8,
    pageSize = 1000,
  } = options

  const jp = symbols.filter((s) => String(s || '').endsWith('.T'))
  const nonJp = symbols.filter((s) => !String(s || '').endsWith('.T'))

  const workItems = [
    ...chunkSymbols(jp, jpChunkSize).map((symChunk) => ({
      symChunk,
      sourceIn: jpSourceFilter,
      dedupe: jpDedupe,
      dedupeMode: 'continuity',
    })),
    ...chunkSymbols(nonJp, nonJpChunkSize).map((symChunk) => ({
      symChunk,
      sourceIn: null,
      dedupe: true,
      dedupeMode: 'continuity',
    })),
  ]

  const fetchChunkRows = async (symChunk, sourceIn) => {
    const merged = []
    let from = 0
    while (true) {
      let q = supabase
        .from('stock_daily_prices')
        .select(select)
        .in('symbol', symChunk)
        .gte('trade_date', cutoffStr)
        .order('symbol', { ascending: true })
        .order('trade_date', { ascending: true })
        .range(from, from + pageSize - 1)
      if (Array.isArray(sourceIn) && sourceIn.length) q = q.in('source', sourceIn)
      const { data, error } = await q
      if (error) throw error
      const rows = data || []
      merged.push(...rows)
      if (rows.length < pageSize) break
      from += pageSize
    }
    return merged
  }

  for (let i = 0; i < workItems.length; i += parallelChunks) {
    const wave = workItems.slice(i, i + parallelChunks)
    const results = await Promise.all(
      wave.map(({ symChunk, sourceIn }) => fetchChunkRows(symChunk, sourceIn)),
    )
    for (let w = 0; w < wave.length; w += 1) {
      const { symChunk, dedupe, dedupeMode } = wave[w]
      const rows = results[w] || []
      const bySym = new Map()
      for (const row of rows) {
        const s = row?.symbol
        if (!s) continue
        if (!bySym.has(s)) bySym.set(s, [])
        bySym.get(s).push(row)
      }
      for (const s of symChunk) {
        let arr = bySym.get(s) || []
        if (dedupe) {
          arr = dedupeStockDailyPricesByTradeDate(arr, dedupeMode ? { mode: dedupeMode } : {})
        } else {
          arr.sort((a, b) => String(a.trade_date || '').localeCompare(String(b.trade_date || '')))
        }
        historyBySymbol.set(s, arr)
      }
    }
  }

  return historyBySymbol
}
