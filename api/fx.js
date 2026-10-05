/**
 * Historical FX rates (USD/JPY) by date.
 * Provider strategy:
 * 1) Snapshot table fx_daily_usdjpy（cron で日次 upsert）— FX_READ_USDJPY_FROM_DB=true のとき読む
 * 2) Frankfurter (ECB-based, no key)
 * 3) Twelve Data (if FX_TWELVEDATA_API_KEY is set)
 * 取得できない日は 150 固定を返さない。直前営業日も無いときは rates を空にする。
 */

import {
  fetchFrankfurterByDate,
  fetchFrankfurterRange,
  fetchTwelveDataByDate,
  fetchTwelveDataRange,
  fillMissingDates,
  toIsoDate,
  dayRange,
} from './_lib/fx-usdjpy-providers.js'
import { getFxSupabaseAdmin, selectUsdJpyOnOrBefore, selectUsdJpyRange } from './_lib/fx-usdjpy-db.js'

function isoDaysBefore(iso, days) {
  const dt = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(dt.getTime())) return ''
  dt.setUTCDate(dt.getUTCDate() - Number(days || 0))
  return dt.toISOString().slice(0, 10)
}

const FX_TWELVEDATA_API_KEY = process.env.FX_TWELVEDATA_API_KEY || ''

function readUsdJpyDbEnabled() {
  const raw = process.env.FX_READ_USDJPY_FROM_DB
  if (raw == null || raw === '') return false
  return String(raw).toLowerCase() === 'true' || String(raw) === '1'
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const date = toIsoDate(req.query.date)
  const start = toIsoDate(req.query.start_date || req.query.start)
  const end = toIsoDate(req.query.end_date || req.query.end)

  const useDb = readUsdJpyDbEnabled()

  try {
    if (date) {
      if (useDb) {
        const admin = getFxSupabaseAdmin()
        if (admin) {
          const row = await selectUsdJpyOnOrBefore(admin, date)
          if (row) {
            return res.status(200).json({
              date,
              fxAsOf: row.asOf,
              rates: { USD: row.rate },
              source: 'database',
            })
          }
        }
      }

      const fromFrankfurter = await fetchFrankfurterByDate(date)
      if (fromFrankfurter != null) {
        return res.status(200).json({ date, fxAsOf: date, rates: { USD: fromFrankfurter }, source: 'frankfurter' })
      }

      const priorWindow = await fetchFrankfurterRange(isoDaysBefore(date, 10), date)
      const priorKeys = Object.keys(priorWindow || {}).sort()
      const priorDay = priorKeys.length > 0 ? priorKeys[priorKeys.length - 1] : ''
      if (priorDay && priorWindow[priorDay] > 0) {
        return res.status(200).json({
          date,
          fxAsOf: priorDay,
          rates: { USD: priorWindow[priorDay] },
          source: 'frankfurter',
        })
      }

      const fromTwelveData = await fetchTwelveDataByDate(date, FX_TWELVEDATA_API_KEY)
      if (fromTwelveData != null) {
        return res.status(200).json({ date, fxAsOf: date, rates: { USD: fromTwelveData }, source: 'twelvedata' })
      }

      return res.status(200).json({ date, rates: {}, source: 'unavailable' })
    }

    if (start && end) {
      let fromDb = {}
      let seedRate = null
      const dayBefore = isoDaysBefore(start, 1)
      if (useDb) {
        const admin = getFxSupabaseAdmin()
        if (admin) {
          fromDb = await selectUsdJpyRange(admin, start, end)
          if (dayBefore) {
            const prior = await selectUsdJpyOnOrBefore(admin, dayBefore)
            if (prior?.rate > 0) seedRate = prior.rate
          }
        }
      }

      let merged = {}
      let source = 'frankfurter'

      const frank = (await fetchFrankfurterRange(start, end)) || {}
      const frankKeys = Object.keys(frank)

      if (fromDb && Object.keys(fromDb).length > 0 && frankKeys.length > 0) {
        merged = { ...frank, ...fromDb }
        source = 'database_merge_frankfurter'
      } else if (fromDb && Object.keys(fromDb).length > 0) {
        merged = fromDb
        source = 'database'
      } else if (frankKeys.length > 0) {
        merged = frank
        source = 'frankfurter'
      }

      if (Object.keys(merged).length === 0) {
        const td = (await fetchTwelveDataRange(start, end, FX_TWELVEDATA_API_KEY)) || {}
        const tdKeys = Object.keys(td)
        if (fromDb && Object.keys(fromDb).length > 0 && tdKeys.length > 0) {
          merged = { ...td, ...fromDb }
          source = 'database_merge_twelvedata'
        } else if (tdKeys.length > 0) {
          merged = td
          source = 'twelvedata'
        }
      }

      if (seedRate == null && dayBefore) {
        const priorWindow = (await fetchFrankfurterRange(isoDaysBefore(start, 10), dayBefore)) || {}
        const priorKeys = Object.keys(priorWindow).sort()
        const priorDay = priorKeys.length > 0 ? priorKeys[priorKeys.length - 1] : ''
        if (priorDay && priorWindow[priorDay] > 0) seedRate = priorWindow[priorDay]
      }

      if (!merged || Object.keys(merged).length === 0) {
        if (!(seedRate > 0)) return res.status(200).json({ ratesByDate: {}, source: 'unavailable' })
        merged = {}
      }

      const filled = fillMissingDates(merged, start, end, seedRate)
      const ratesByDate = {}
      for (const d of dayRange(start, end)) {
        if (filled[d] != null) ratesByDate[d] = Number(filled[d])
      }
      return res.status(200).json({ ratesByDate, source: Object.keys(ratesByDate).length ? source : 'unavailable' })
    }

    return res.status(400).json({ error: 'Provide date or start_date & end_date' })
  } catch (e) {
    console.error('fx api error', e)
    return res.status(500).json({ error: 'FX fetch failed' })
  }
}
