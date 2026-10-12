/**
 * GET /api/fear-greed?market=JP|US
 *
 * Web FearGreedIndex と iOS アプリが同一スコアになるよう、
 * src/lib/fearGreedCalc.js をサーバー側で1回だけ実行して返す。
 * 認証不要（公開マーケット指標）。
 */
import { createClient } from '@supabase/supabase-js'
import { calcFearGreedFromDB } from '../src/lib/fearGreedCalc.js'

const CACHE_TTL_MS = 5 * 60 * 1000
/** @type {Map<string, { at: number, payload: object }>} */
const memoryCache = new Map()

function getAdmin() {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  const key = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SECRET_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || '',
  ).trim()
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

function normalizeMarket(raw) {
  const m = String(raw || 'JP').trim().toUpperCase()
  return m === 'US' ? 'US' : 'JP'
}

function send(res, status, payload) {
  if (typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
  }
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(payload)
  }
  res.statusCode = status
  res.setHeader?.('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return send(res, 204, {})
  }
  if (req.method !== 'GET') {
    return send(res, 405, { ok: false, error: 'Method not allowed' })
  }

  const market = normalizeMarket(req.query?.market)
  const cached = memoryCache.get(market)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return send(res, 200, cached.payload)
  }

  const admin = getAdmin()
  if (!admin) {
    return send(res, 500, { ok: false, error: 'Missing Supabase env' })
  }

  try {
    const result = await calcFearGreedFromDB(admin, market)
    const payload = {
      ok: true,
      market,
      score: result.score,
      yesterday: result.yesterday,
      weekAgo: result.weekAgo,
      latestTradeDate: result.latestTradeDate || null,
      indicators: result.indicators || [],
      history: result.history || [],
      dashboard: result.dashboard || null,
      stance: result.stance || null,
      generatedAt: new Date().toISOString(),
    }
    memoryCache.set(market, { at: Date.now(), payload })
    return send(res, 200, payload)
  } catch (err) {
    console.error('[fear-greed]', err?.message || err)
    return send(res, 502, {
      ok: false,
      error: String(err?.message || err || 'Fear & Greed calc failed'),
    })
  }
}
