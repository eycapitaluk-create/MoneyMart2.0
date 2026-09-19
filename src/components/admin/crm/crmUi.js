/** Shared CRM workbench visual tokens (Linear/Amplitude-style). */

export const panelClass =
  'rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'

export const panelPad = 'p-4 sm:p-5'

export const labelClass = 'text-[11px] font-medium text-gray-500 dark:text-gray-400'

export const titleClass = 'text-sm font-semibold text-gray-900 dark:text-white'

export const monoNum = 'tabular-nums font-semibold text-gray-900 dark:text-white'

export const subTabBtn = (active) =>
  `px-2.5 py-1.5 rounded-md text-xs font-medium border transition ${
    active
      ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
      : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
  }`

export const rangeBtn = (active) =>
  `px-2.5 py-1 rounded-md text-xs font-medium border transition ${
    active
      ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
      : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
  }`

export const thClass =
  'px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400'

export const tdClass = 'px-3 py-2 text-xs text-gray-700 dark:text-gray-300'

export const fmt = (n) => Number(n || 0).toLocaleString('en-US')

export const pctOrDash = (v) => (v == null || !Number.isFinite(Number(v)) ? '—' : `${Number(v)}%`)
