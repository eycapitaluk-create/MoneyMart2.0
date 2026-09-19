/**
 * Historical FX rates (USD/JPY) by date.
 * Provider strategy:
 * 1) Snapshot table fx_daily_usdjpy（cron で日次 upsert）— FX_READ_USDJPY_FROM_DB=true のとき読む
 * 2) Frankfurter (ECB-based, no key)
 * 3) Twelve Data (if FX_TWELVEDATA_API_KEY is set)
 * 4) Static fallback rate via FX_FALLBACK_USDJPY
 */

import {
  fetchFrankfurterByDate,
  fetchFrankfurterRange,
  fetchTwelveDataByDate,
  fetchTwelveDataRange,
  fillMissingDates,
  toIsoDate,
  dayRange,
  DEFAULT_FALLBACK_USDJPY,
} from './_lib/fx-usdjpy-providers.js'
import { getFxSupabaseAdmin, selectUsdJpyOne, selectUsdJpyRange } from './_lib/fx-usdjpy-db.js'

const FX_FALLBACK_USDJPY = Number(process.env.FX_FALLBACK_USDJPY || DEFAULT_FALLBACK_USDJPY)
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
          const rowRate = await selectUsdJpyOne(admin, date)
          if (rowRate != null) {
            return res.status(200).json({ date, rates: { USD: rowRate }, source: 'database' })
          }
        }
      }

      const fromFrankfurter = await fetchFrankfurterByDate(date)
      if (fromFrankfurter != null) {
        return res.status(200).json({ date, rates: { USD: fromFrankfurter }, source: 'frankfurter' })
      }

      const fromTwelveData = await fetchTwelveDataByDate(date, FX_TWELVEDATA_API_KEY)
      if (fromTwelveData != null) {
        return res.status(200).json({ date, rates: { USD: fromTwelveData }, source: 'twelvedata' })
      }

      return res.status(200).json({ date, rates: { USD: FX_FALLBACK_USDJPY }, source: 'fallback' })
    }

    if (start && end) {
      let fromDb = {}
      if (useDb) {
        const admin = getFxSupabaseAdmin()
        if (admin) fromDb = await selectUsdJpyRange(admin, start, end)
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

      if (!merged || Object.keys(merged).length === 0) {
        return res.status(200).json({ ratesByDate: {}, source: 'fallback' })
      }

      const filled = fillMissingDates(merged, start, end)
      const withFallback = {}
      for (const d of dayRange(start, end)) {
        withFallback[d] = Number(filled[d] || FX_FALLBACK_USDJPY)
      }
      return res.status(200).json({ ratesByDate: withFallback, source })
    }

    return res.status(400).json({ error: 'Provide date or start_date & end_date' })
  } catch (e) {
    console.error('fx api error', e)
    return res.status(500).json({ error: 'FX fetch failed' })
  }
}
