import { useEffect, useState } from 'react'
import { fetchDividendMasterScheduleForMonth } from '../lib/dividendMasterScheduleApi'
import { loadDividendWatchlist } from '../lib/myPageApi'
import { getDividendCalendarDetailRecord } from '../lib/dividendCalendarDetailLookup'
import { isDividendBellAckedForUserMonth } from '../lib/dividendBellAck'
import { getDividendNetJpyApprox } from '../lib/dividendCalendar'

function userSchedulesPayoutThisMonth(w, month) {
  return (w?.dividends || []).some(
    (d) => Number(d?.month) === month && Number(d?.amount) > 0,
  )
}

/** This month: user row exists & amount ≈ xlsx master for that month */
function userMonthAmountMatchesJsonMaster(rec, w, month, eps = 0.03) {
  if (!rec?.dividends?.length || !userSchedulesPayoutThisMonth(w, month)) return false
  const u = (w.dividends || []).find((d) => Number(d?.month) === month)
  const m = (rec.dividends || []).find((d) => Number(d?.month) === month)
  if (!u || !m) return false
  return Math.abs(Number(u.amount) - Number(m.amount)) <= eps
}

/**
 * Logged-in: watchlist symbols where **this calendar month** is a payout month and
 * **saved user schedule** matches the source (not 「マスターだけで通知」).
 *
 * 1) Supabase `dividend_master_schedule` has this month AND user dividends include this month (金額>0).
 * 2) Else JSON master: this month on file AND user's amount for that month ≒ master.
 *
 * Listen for `mm-dividend-bell-refresh` (e.g. after MyPage save) to re-fetch.
 */
export function useDividendMonthBellAlerts(session) {
  const [alerts, setAlerts] = useState([])
  const [refreshTick, setRefreshTick] = useState(0)
  const userId = session?.user?.id ?? null

  useEffect(() => {
    const bump = () => setRefreshTick((t) => t + 1)
    window.addEventListener('mm-dividend-bell-refresh', bump)
    window.addEventListener('mm-dividend-bell-ack', bump)
    return () => {
      window.removeEventListener('mm-dividend-bell-refresh', bump)
      window.removeEventListener('mm-dividend-bell-ack', bump)
    }
  }, [])

  useEffect(() => {
    if (!userId) {
      setAlerts([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const now = new Date()
        const year = now.getFullYear()
        const month = now.getMonth() + 1
        if (isDividendBellAckedForUserMonth(userId, year, month)) {
          setAlerts([])
          return
        }
        const [masterRows, watchlist] = await Promise.all([
          fetchDividendMasterScheduleForMonth(year, month),
          loadDividendWatchlist(userId),
        ])
        if (cancelled) return
        const byStock = new Map()
        for (const r of masterRows) {
          const sid = String(r?.stock_id ?? '').trim()
          if (!sid) continue
          if (!byStock.has(sid)) byStock.set(sid, r)
        }
        const out = []
        const seen = new Set()
        let monthNetJpyTotal = 0
        for (const w of watchlist || []) {
          const sid = String(w?.stock_id ?? '').trim()
          if (!sid || !byStock.has(sid)) continue
          if (!userSchedulesPayoutThisMonth(w, month)) continue
          const meta = byStock.get(sid)
          const title = String(w?.stock_name || meta?.name_hint || sid).trim() || sid
          const rowThisMonth = (w?.dividends || []).find((d) => Number(d?.month) === month)
          const perShare = Math.max(0, Number(rowThisMonth?.amount || 0))
          const qty = Math.max(1, Number(w?.qty || 10))
          monthNetJpyTotal += getDividendNetJpyApprox(perShare * qty, w, 150)
          out.push({
            stock_id: sid,
            title,
            asset_kind: meta?.asset_kind || null,
          })
          seen.add(sid)
        }
        for (const w of watchlist || []) {
          const sid = String(w?.stock_id ?? '').trim()
          if (!sid || seen.has(sid)) continue
          let rec
          try {
            rec = getDividendCalendarDetailRecord(sid)
          } catch {
            rec = null
          }
          const rows = rec?.dividends
          if (!Array.isArray(rows) || !rows.some((d) => Number(d?.month) === month)) continue
          if (!userMonthAmountMatchesJsonMaster(rec, w, month)) continue
          const title = String(w?.stock_name || rec?.name || sid).trim() || sid
          const rowThisMonth = (w?.dividends || []).find((d) => Number(d?.month) === month)
          const perShare = Math.max(0, Number(rowThisMonth?.amount || 0))
          const qty = Math.max(1, Number(w?.qty || 10))
          monthNetJpyTotal += getDividendNetJpyApprox(perShare * qty, w, 150)
          let assetKind = 'us_stock'
          const cat = String(rec?.category || '')
          if (cat.includes('日本')) assetKind = cat.includes('ETF') ? 'jp_fund' : 'jp_stock'
          out.push({
            stock_id: sid,
            title,
            asset_kind: assetKind,
          })
          seen.add(sid)
        }
        out.sort((a, b) => a.title.localeCompare(b.title, 'ja'))
        // Add summary alert first for premium-only rendering in navbar.
        out.unshift({
          stock_id: '__MONTH_NET_SUMMARY__',
          title: `今月の配当税引後入金予定額は ¥${Math.round(monthNetJpyTotal).toLocaleString()} です。`,
          asset_kind: 'summary',
        })
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
    return () => {
      cancelled = true
    }
  }, [userId, refreshTick])

  return alerts
}
