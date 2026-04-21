// Split-adjusted daily closes (ascending trade_date) — same logic as Fund detail / list.

/**
 * 東証 .T 銘柄※は通常ノイズで「分割」と誤検知しやすいため raw のみ。
 * 例外: 実際の株式分割で EOD にスケール段差が残っている銘柄のみ、連続終値比から調整係数を推定する。
 *
 * ※1306.T（ＴＯＰＩＸ連動型）は分割起因で未調整履歴だと 1M リターンが -90% 級に欠陥化する。
 */
const TOKYO_SYMBOLS_USE_SPLIT_ADJUST_HEURISTIC = new Set(['1306.T'])

export function skipEodSplitHeuristicForSymbol(symbol) {
  const s = String(symbol || '').toUpperCase()
  if (TOKYO_SYMBOLS_USE_SPLIT_ADJUST_HEURISTIC.has(s)) return false
  return s.endsWith('.T')
}

/**
 * @param {Array} history - trade_date 昇順
 * @param {{ skipSplitHeuristic?: boolean }} [options] - true なら分割推定を行わず終値のみ
 */
export const buildSplitAdjustedCloses = (history = [], options = {}) => {
  if (options.skipSplitHeuristic) {
    return history.map((r) => {
      const v = Number(r?.close)
      if (Number.isFinite(v) && v > 0) return Number(v.toFixed(4))
      return 0
    })
  }
  const closes = history.map((r) => Number(r.close)).map((v) => (Number.isFinite(v) && v > 0 ? v : null))
  if (closes.length <= 1) return closes.map((v) => (Number.isFinite(v) ? v : 0))
  const factors = new Array(closes.length).fill(1)
  const isLikelySplitRatio = (ratio) => Number.isFinite(ratio) && ratio >= 0.05 && ratio <= 20 && (ratio <= 0.58 || ratio >= 1.7)
  for (let i = closes.length - 2; i >= 0; i -= 1) {
    const cur = closes[i]
    const next = closes[i + 1]
    const ratio = (Number.isFinite(cur) && Number.isFinite(next) && cur > 0) ? (next / cur) : NaN
    factors[i] = factors[i + 1] * (isLikelySplitRatio(ratio) ? ratio : 1)
  }
  return closes.map((value, idx) => (Number.isFinite(value) ? Number((value * factors[idx]).toFixed(4)) : 0))
}

/**
 * 前営業日終値比（直近2本の分割調整済み終値）。マーケットヒートマップと同じ「前日実データ終値」基準。
 * 履歴が足りないときのみ (終値−寄り付き)/寄り付き にフォールバック。
 */
export const dayOverDayCloseChangeFromAdjustedSeries = (adjustedClosesAsc = [], sessionOpen = NaN) => {
  const arr = (Array.isArray(adjustedClosesAsc) ? adjustedClosesAsc : []).map(Number)
  const n = arr.length
  const open = Number(sessionOpen)
  if (n >= 2) {
    const prevClose = arr[n - 2]
    const close = arr[n - 1]
    if (Number.isFinite(prevClose) && prevClose > 0 && Number.isFinite(close)) {
      const change = close - prevClose
      return { change, changePct: (change / prevClose) * 100 }
    }
  }
  if (n >= 1 && Number.isFinite(open) && open > 0) {
    const close = arr[n - 1]
    if (Number.isFinite(close)) {
      const change = close - open
      return { change, changePct: (change / open) * 100 }
    }
  }
  return { change: null, changePct: null }
}

/**
 * チャート間引き用の index。最終2営業日は常に含め、終点近傍の線分が前日比と逆方向に見えるのを防ぐ。
 * @param {number} historyLength
 * @param {number} [approxBuckets=70] — おおよそ何本に1点取るか（全件数に応じ stride を決める）
 */
export function chartDownsampleIndices(historyLength, approxBuckets = 70) {
  const n = Number(historyLength) || 0
  if (n <= 0) return []
  const stride = Math.max(1, Math.floor(n / Math.max(1, approxBuckets)))
  const idxSet = new Set()
  for (let i = 0; i < n; i += stride) idxSet.add(i)
  idxSet.add(n - 1)
  if (n >= 2) idxSet.add(n - 2)
  return [...idxSet].sort((a, b) => a - b)
}

/**
 * v_stock_latest が stock_daily_prices より新しい trade_date のとき、ヘッドライン終値と前日比を実データで揃える。
 * （日次履歴のみで算定すると「表示日は最新だが系列は1日前」でグラフ・数値が食い違う）
 *
 * @param {Array<{ trade_date?: string, close?: number }>} historyAsc
 * @param {number[]} adjustedClosesAsc — history と同じ長さ
 * @param {{ trade_date?: string, close?: number, open?: number }} latestRow
 */
export function resolveSpotCloseAndSessionChange(historyAsc, adjustedClosesAsc, latestRow = {}) {
  const hist = Array.isArray(historyAsc) ? historyAsc : []
  const adjusted = Array.isArray(adjustedClosesAsc) ? adjustedClosesAsc : []
  const histLastRow = hist.length > 0 ? hist[hist.length - 1] : null
  const histLastDate = String(histLastRow?.trade_date || '')
  const latestDate = String(latestRow?.trade_date || '')
  const latestAhead = Boolean(latestDate && histLastDate && latestDate > histLastDate)
  const latestCloseNum = Number(latestRow?.close)
  const histLastClose = hist.length > 0
    ? Number(adjusted[hist.length - 1] ?? histLastRow?.close ?? NaN)
    : NaN

  let close = Number(adjusted[adjusted.length - 1] || latestCloseNum || 0)
  if (latestAhead && Number.isFinite(latestCloseNum) && latestCloseNum > 0) {
    close = latestCloseNum
  }

  const open = Number(latestRow?.open ?? NaN)
  let sessionDod
  if (
    latestAhead
    && Number.isFinite(histLastClose)
    && histLastClose > 0
    && Number.isFinite(latestCloseNum)
  ) {
    const ch = latestCloseNum - histLastClose
    sessionDod = { change: ch, changePct: (ch / histLastClose) * 100 }
  } else {
    sessionDod = dayOverDayCloseChangeFromAdjustedSeries(adjusted, open)
  }

  return {
    close,
    sessionDod,
    latestAhead,
    latestDate,
    latestCloseNum,
  }
}
