/**
 * 初回ペイントやクリティカルなフェッチを優先するため、低優先タスクを遅延実行する。
 * requestIdleCallback が無い環境では setTimeout にフォールバック。
 *
 * @param {() => void} fn
 * @param {{ timeoutMs?: number }} [options]
 * @returns {() => void} cancel
 */
export function scheduleIdleTask(fn, options = {}) {
  const timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Math.max(0, Number(options.timeoutMs)) : 2000
  if (typeof window === 'undefined') {
    fn()
    return () => {}
  }
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(() => fn(), { timeout: timeoutMs })
    return () => window.cancelIdleCallback?.(id)
  }
  const id = window.setTimeout(fn, Math.min(800, timeoutMs))
  return () => window.clearTimeout(id)
}
