import { useEffect, useState } from 'react'
import { isDividendBellAckedForUserMonth } from '../lib/dividendBellAck'
import { scheduleIdleTask } from '../lib/scheduleIdle'

// Match only announced issuer payment dates for registered symbols.
// Historical ex-date month buckets are never proof of a cash payment month.
export function useDividendMonthBellAlerts(session, enabled = true) {
  const [alerts, setAlerts] = useState([])
  const [refreshTick, setRefreshTick] = useState(0)
  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (!enabled) return undefined
    const bump = () => setRefreshTick((t) => t + 1)
    window.addEventListener('mm-dividend-bell-refresh', bump)
    window.addEventListener('mm-dividend-bell-ack', bump)
    return () => {
      window.removeEventListener('mm-dividend-bell-refresh', bump)
      window.removeEventListener('mm-dividend-bell-ack', bump)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || !userId) {
      setAlerts([])
      return
    }
    let cancelled = false
    const cancelIdle = scheduleIdleTask(() => {
    ;(async () => {
      try {
        const now = new Date()
        const year = now.getFullYear()
        const month = now.getMonth() + 1
        if (isDividendBellAckedForUserMonth(userId, year, month)) {
          setAlerts([])
          return
        }
        const [{ loadDividendWatchlist }, { listVerifiedPaymentEvents }, paymentPack] = await Promise.all([
          import('../lib/myPageApi'),
          import('../lib/verifiedDividendPayments'),
          import('../data/dividendVerifiedPayments.generated.json'),
        ])
        const watchlist = await loadDividendWatchlist(userId)
        if (cancelled) return
        const symbols = (watchlist || []).map(w => w.stock_id)
        const official = symbols.length ? listVerifiedPaymentEvents(paymentPack.default, { symbols, year }) : []
        const seen = new Set()
        const out = official.filter(e => Number(e.payment_date.slice(5, 7)) === month).flatMap(e => {
          if (seen.has(e.symbol)) return []
          seen.add(e.symbol)
          return [{ stock_id: e.symbol, title: e.name || e.symbol, asset_kind: e.symbol.endsWith('.T') ? 'jp_fund' : 'us_stock' }]
        })
        out.sort((a, b) => a.title.localeCompare(b.title, 'ja'))
        const nextKey = out.map((r) => `${r.stock_id}\t${r.title}\t${r.asset_kind || ''}`).join('\n')
        setAlerts((prev) => {
          const prevKey = (prev || []).map((r) => `${r.stock_id}\t${r.title}\t${r.asset_kind || ''}`).join('\n')
          return prevKey === nextKey ? prev : out
        })
      } catch (e) {
        if (cancelled) return
        console.warn('[useDividendMonthBellAlerts]', e)
        setAlerts([])
      }
    })()
    }, { timeoutMs: 2200 })
    return () => {
      cancelled = true
      cancelIdle()
    }
  }, [enabled, userId, refreshTick])

  return alerts
}
