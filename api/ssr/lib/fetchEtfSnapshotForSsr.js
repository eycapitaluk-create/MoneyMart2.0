import { createClient } from '@supabase/supabase-js'
import { ETF_LIST_FROM_XLSX, ETF_SYMBOLS_FROM_XLSX } from '../../../src/data/etfListFromXlsx.js'

const BATCH = 80
/** Crawler-visible table size (memo: top 20–30). */
export const ETF_SSR_TABLE_LIMIT = 28

/**
 * Top ETFs by latest volume for server-rendered compare HTML.
 * @returns {{ rows: Array<{ symbol: string, name: string, trustFee: string|null, category: string|null, country: string|null, close: number|null, tradeDate: string|null, volume: number|null }>, dataDate: string|null, error: string|null }}
 */
export async function fetchEtfSnapshotForSsr() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) {
    return { rows: [], dataDate: null, error: 'missing_supabase_env' }
  }

  const xlsxMeta = new Map(ETF_LIST_FROM_XLSX.map((item) => [item.symbol, item]))
  const symbols = [...new Set((ETF_SYMBOLS_FROM_XLSX || []).filter(Boolean))]
  if (symbols.length === 0) {
    return { rows: [], dataDate: null, error: 'no_symbols' }
  }

  const supabase = createClient(url, key)
  const latestRows = []
  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH)
    const { data, error } = await supabase
      .from('v_stock_latest')
      .select('symbol,trade_date,close,volume')
      .in('symbol', batch)
    if (error) {
      return { rows: [], dataDate: null, error: error.message }
    }
    latestRows.push(...(data || []))
  }

  const byVol = [...latestRows].sort((a, b) => Number(b.volume || 0) - Number(a.volume || 0))
  const top = byVol.slice(0, ETF_SSR_TABLE_LIMIT)
  const topSyms = top.map((r) => r.symbol).filter(Boolean)
  if (topSyms.length === 0) {
    return { rows: [], dataDate: null, error: null }
  }

  const { data: metaRows, error: metaErr } = await supabase
    .from('stock_symbols')
    .select('symbol,name,trust_fee,category,country')
    .in('symbol', topSyms)

  if (metaErr) {
    return { rows: [], dataDate: null, error: metaErr.message }
  }

  const metaMap = new Map((metaRows || []).map((m) => [m.symbol, m]))

  const rows = top.map((r) => {
    const m = metaMap.get(r.symbol) || {}
    const x = xlsxMeta.get(r.symbol) || {}
    const name = String(x.jpName || m.name || r.symbol || '').trim() || r.symbol
    const tf = m.trust_fee != null && m.trust_fee !== '' ? String(m.trust_fee) : x.trustFee != null ? String(x.trustFee) : null
    return {
      symbol: r.symbol,
      name,
      trustFee: tf,
      category: m.category != null ? String(m.category) : null,
      country: m.country != null ? String(m.country) : null,
      close: r.close != null ? Number(r.close) : null,
      tradeDate: r.trade_date != null ? String(r.trade_date) : null,
      volume: r.volume != null ? Number(r.volume) : null,
    }
  })

  const dataDate = rows.reduce((best, row) => {
    const d = row.tradeDate
    if (!d) return best
    if (!best || d > best) return d
    return best
  }, null)

  return { rows, dataDate, error: null }
}
