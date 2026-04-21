/**
 * MoneyMart 共通: 騰落・リターンの色（上昇=赤系、下落=青系）
 * 成功/エラー・ニュースセンチメント等には使わない。
 */

export const MARKET_UP_HEX = '#ef4444'
export const MARKET_DOWN_HEX = '#2563eb'

/** Recharts / SVG 用 */
export function signedReturnBarHex(value) {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? MARKET_UP_HEX : MARKET_DOWN_HEX
}

/** ヒートマップタイル（前日比% の段階） */
export function heatmapChangeBgClass(change) {
  const c = Number(change)
  if (c >= 2) return 'bg-red-600'
  if (c >= 1) return 'bg-red-500'
  if (c > 0.5) return 'bg-red-400'
  if (c >= -0.5) return 'bg-amber-500'
  if (c >= -1) return 'bg-blue-400'
  if (c >= -2) return 'bg-blue-600'
  return 'bg-blue-800'
}

/** 本文・表の騰落テキスト */
export function signedReturnTextClass(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 'text-slate-400'
  return n >= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'
}

/** 強調（大きい数字・チャートラインなど） */
export function signedReturnTextClassStrong(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 'text-slate-400'
  return n >= 0 ? 'text-red-500 dark:text-red-400' : 'text-blue-500 dark:text-blue-400'
}

/** 暗いパネル上の指数テロップなど（-400 系） */
export function signedReturnTextClassOnDarkPanel(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 'text-slate-500'
  return n >= 0 ? 'text-red-400' : 'text-blue-400'
}

/** 3 値（正/負/ゼロ）でゼロはニュートラル */
export function signedReturnTextClassTri(value, neutralClass = 'text-slate-900 dark:text-white') {
  const n = Number(value)
  if (!Number.isFinite(n)) return 'text-slate-400'
  if (n > 0) return 'text-red-500 dark:text-red-400'
  if (n < 0) return 'text-blue-500 dark:text-blue-400'
  return neutralClass
}
