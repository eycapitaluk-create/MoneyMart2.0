/**
 * Schedule non-critical work via requestIdleCallback when available.
 * Returns a cancel function (always safe to call).
 */
export function scheduleIdleTask(task, { timeoutMs = 2000 } = {}) {
  if (typeof task !== 'function') {
    return () => {}
  }

  const timeout = Math.max(0, Number(timeoutMs) || 0)

  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(() => {
      try {
        task()
      } catch {
        // ignore idle-task failures
      }
    }, timeout > 0 ? { timeout } : undefined)
    return () => {
      if (typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(id)
      }
    }
  }

  const timer = setTimeout(() => {
    try {
      task()
    } catch {
      // ignore idle-task failures
    }
  }, timeout > 0 ? timeout : 0)

  return () => clearTimeout(timer)
}
