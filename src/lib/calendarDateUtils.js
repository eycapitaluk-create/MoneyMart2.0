/**
 * カレンダー基準で日付オフセットを計算し、シリーズ内で最も近い行を返す。
 * 株式・ファンド共通で同じロジックを使用。
 *
 * @param {Array<{ tradeDate?: string, trade_date?: string, close?: number }>} series - 日付昇順の履歴
 * @param {string} latestDateStr - 最新日付 'YYYY-MM-DD'
 * @param {{ days?: number, months?: number, years?: number }} offset
 * @returns {{ row: object, close: number } | null}
 */
export function findRowByCalendarOffset(series, latestDateStr, offset) {
  if (!Array.isArray(series) || series.length === 0 || !latestDateStr) return null
  const latestDate = new Date(latestDateStr + 'T00:00:00')
  if (Number.isNaN(latestDate.getTime())) return null

  const targetDate = new Date(latestDate)
  if (offset.years) targetDate.setFullYear(targetDate.getFullYear() - offset.years)
  if (offset.months) targetDate.setMonth(targetDate.getMonth() - offset.months)
  if (offset.days) targetDate.setDate(targetDate.getDate() - offset.days)

  let bestRow = null
  let bestDiff = Infinity
  for (const row of series) {
    const d = row.tradeDate ?? row.trade_date
    if (!d) continue
    const rowDate = new Date(String(d) + 'T00:00:00')
    if (Number.isNaN(rowDate.getTime())) continue
    const diff = Math.abs(rowDate.getTime() - targetDate.getTime())
    if (diff < bestDiff) {
      bestDiff = diff
      bestRow = row
    }
  }
  if (!bestRow) return null
  const close = Number(bestRow.close)
  return Number.isFinite(close) && close > 0 ? { row: bestRow, close } : null
}

/**
 * 日次 EOD シリーズ（日付昇順・1行=1営業日想定）で、最新行から数えて sessionsAgo 本前の行。
 * 例: sessionsAgo=5 → 直近終値と 5 営業日前の終値の比較（株ページ Top5 の fiveDayRate と同じ考え方）。
 *
 * @param {Array<{ tradeDate?: string, trade_date?: string, close?: number }>} series
 * @param {number} sessionsAgo - 1 以上
 * @returns {{ row: object, close: number } | null}
 */
export function findRowTradingSessionsBeforeLatest(series, sessionsAgo) {
  if (!Array.isArray(series) || sessionsAgo < 1) return null
  const n = series.length
  if (n < sessionsAgo + 1) return null
  const row = series[n - 1 - sessionsAgo]
  const close = Number(row?.close)
  if (!Number.isFinite(close) || close <= 0) return null
  return { row, close }
}

/** 株チャート TIMEFRAME_ROW_LIMITS と整合。1行=1営業日の EOD シリーズ用 */
export const TRADING_SESSION_OFFSETS = {
  DAY: 1,
  FIVE_D: 5,
  ONE_MONTH: 22,
  THREE_MONTH: 66,
  SIX_MONTH: 132,
  ONE_YEAR: 252,
}

/**
 * YTD 基準日: 最新行の年の 1/1 以降で最初の行（EOD のみならその年の最初の営業日）。
 * series は日付昇順。tradeDate または trade_date。
 */
export function findYtdBaseRowFromSeries(series) {
  if (!Array.isArray(series) || series.length === 0) return null
  const last = series[series.length - 1]
  const latestStr = String(last?.tradeDate ?? last?.trade_date ?? '')
  if (latestStr.length < 4) return null
  const year = latestStr.slice(0, 4)
  const yearStartStr = `${year}-01-01`
  for (const r of series) {
    const d = String(r?.tradeDate ?? r?.trade_date ?? '')
    if (d >= yearStartStr) return r
  }
  return null
}

/**
 * ファンド履歴用: trade_date を持つ history からカレンダー基準で基準終値を取得。
 * adjustedCloses を渡すとスプリット調整済み終値を使用（インデックス対応）。
 */
export function findBaseCloseByCalendarOffset(history, offset, adjustedCloses = null) {
  if (!Array.isArray(history) || history.length === 0) return null
  const lastRow = history[history.length - 1]
  const latestDateStr = lastRow?.trade_date ?? lastRow?.tradeDate
  if (!latestDateStr) return null
  const result = findRowByCalendarOffset(history, String(latestDateStr), offset)
  if (!result) return null
  if (Array.isArray(adjustedCloses) && adjustedCloses.length > 0) {
    const idx = history.indexOf(result.row)
    if (idx >= 0 && idx < adjustedCloses.length) {
      const adj = Number(adjustedCloses[idx])
      return Number.isFinite(adj) && adj > 0 ? adj : result.close
    }
  }
  return result.close
}

/**
 * 上場から1年未満の銘柄向け: 利用可能な履歴スパンから年率換算リターン(%)を算出。
 * 1年リターン / シャープ（リスク対リターン）が空になるのを防ぐ。
 * @param {{ close: number, baseClose: number, spanDays: number, minSpanDays?: number }} args
 * @returns {number | null}
 */
export function computeAnnualizedReturnPct({ close, baseClose, spanDays, minSpanDays = 90 } = {}) {
  const c = Number(close)
  const b = Number(baseClose)
  const days = Number(spanDays)
  const minDays = Number.isFinite(Number(minSpanDays)) ? Number(minSpanDays) : 90
  if (!Number.isFinite(c) || c <= 0) return null
  if (!Number.isFinite(b) || b <= 0) return null
  if (!Number.isFinite(days) || days < minDays) return null
  const total = (c - b) / b
  if (!Number.isFinite(total) || total <= -1) return null
  const years = days / 365.25
  if (!(years > 0)) return null
  const annualized = (Math.pow(1 + total, 1 / years) - 1) * 100
  return Number.isFinite(annualized) ? annualized : null
}

/** 履歴先頭の有効終値（分割調整済みがあればそちら） */
export function findFirstPositiveClose(history, adjustedCloses = null) {
  if (!Array.isArray(history) || history.length === 0) return null
  for (let i = 0; i < history.length; i += 1) {
    if (Array.isArray(adjustedCloses) && i < adjustedCloses.length) {
      const adj = Number(adjustedCloses[i])
      if (Number.isFinite(adj) && adj > 0) return adj
    }
    const raw = Number(history[i]?.close)
    if (Number.isFinite(raw) && raw > 0) return raw
  }
  return null
}
