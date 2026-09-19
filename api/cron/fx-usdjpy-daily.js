/**
 * POST/GET /api/cron/fx-usdjpy-daily
 *
 * Bearer CRON_SECRET
 *
 * USD/JPY 日次終値ベースレートを直近ウィンドウ分まとめて取得し、`fx_daily_usdjpy` に upsert。
 * Vercel スケジュールは vercel.json（UTC）。米・金曜クローズ〜歳末調整まで余裕ある時刻。
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY（または SUPABASE_SECRET_KEY）、CRON_SECRET、
 * 任意 FX_TWELVEDATA_API_KEY（Frankfurter 失敗時）
 */
import { createClient } from '@supabase/supabase-js'

import {
  fetchFrankfurterRange,
  fetchTwelveDataRange,
} from '../_lib/fx-usdjpy-providers.js'

function getServerEnv(name) {
  return String(process.env[name] ?? '').trim()
}

function utcIsoDaysAgoFromToday(days) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const cronSecret = getServerEnv('CRON_SECRET')
  if (!cronSecret) {
    return res.status(500).json({ ok: false, error: 'CRON_SECRET is required' })
  }

  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (token !== cronSecret) {
    return res.status(401).json({ ok: false, error: 'Unauthorized cron request' })
  }

  const supabaseUrl = getServerEnv('SUPABASE_URL') || getServerEnv('VITE_SUPABASE_URL')
  const supabaseKey = getServerEnv('SUPABASE_SERVICE_ROLE_KEY') || getServerEnv('SUPABASE_SECRET_KEY')
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ ok: false, error: 'Supabase service credentials missing' })
  }

  const end = utcIsoDaysAgoFromToday(0)
  const start = utcIsoDaysAgoFromToday(14)

  const twelveKey = getServerEnv('FX_TWELVEDATA_API_KEY')

  try {
    let ratesByDate = await fetchFrankfurterRange(start, end)
    let provider = 'frankfurter'
    if (!ratesByDate || Object.keys(ratesByDate).length === 0) {
      ratesByDate = await fetchTwelveDataRange(start, end, twelveKey)
      provider = twelveKey ? 'twelvedata' : ''
    }

    const keys = ratesByDate && typeof ratesByDate === 'object' ? Object.keys(ratesByDate) : []
    if (keys.length === 0) {
      return res.status(502).json({
        ok: false,
        error: 'No FX quotes from providers',
        window: { start, end },
      })
    }

    const nowIso = new Date().toISOString()
    const rows = keys.sort().map((asOfDate) => ({
      as_of_date: asOfDate,
      usd_jpy: Number(ratesByDate[asOfDate]),
      provider,
      updated_at: nowIso,
    })).filter((r) => Number.isFinite(r.usd_jpy) && r.usd_jpy > 0)

    const admin = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
    const { error: upErr } = await admin.from('fx_daily_usdjpy').upsert(rows, {
      onConflict: 'as_of_date',
    })

    if (upErr) {
      return res.status(500).json({ ok: false, error: upErr.message || 'upsert failed' })
    }

    return res.status(200).json({
      ok: true,
      provider,
      upserted: rows.length,
      window: { start, end },
    })
  } catch (e) {
    console.error('fx-usdjpy-daily cron', e)
    return res.status(500).json({ ok: false, error: e?.message || 'Unexpected error' })
  }
}
