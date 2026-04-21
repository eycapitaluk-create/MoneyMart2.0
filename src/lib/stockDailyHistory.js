/**
 * stock_daily_prices を複数 source から取ったとき、同一 trade_date を 1 行に潰す。
 * v_stock_latest と同様: fetched_at が新しい行を優先し、同時刻なら marketstack > yfinance > その他。
 * （jp_etf_csv と marketstack が同日に並ぶと「直近2本が同じ営業日」になり前日比 0% になる不具合を防ぐ）
 */

const fetchedAtMs = (row) => {
  const t = row?.fetched_at ? new Date(row.fetched_at).getTime() : 0
  return Number.isFinite(t) ? t : 0
}

/** 小さいほど v_stock_latest の case 順に近い */
const sourcePriority = (src) => {
  const s = String(src || '').toLowerCase()
  if (s === 'marketstack') return 0
  if (s === 'yfinance') return 1
  return 2
}

/** b が a より「勝つ」べきなら true（後から Map に入れて上書きする想定） */
const shouldPreferRow = (candidate, incumbent) => {
  const fc = fetchedAtMs(candidate)
  const fi = fetchedAtMs(incumbent)
  if (fc !== fi) return fc > fi
  return sourcePriority(candidate.source) < sourcePriority(incumbent.source)
}

/**
 * @param {Array<{ trade_date?: string, close?: number, source?: string, fetched_at?: string }>} rows
 * @returns {Array} trade_date 昇順、日付ごとに 1 行
 */
export function dedupeStockDailyPricesByTradeDate(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return []
  const valid = rows.filter(
    (row) => row?.trade_date && Number.isFinite(Number(row?.close)) && Number(row.close) > 0,
  )
  const byDate = new Map()
  for (const row of valid) {
    const d = String(row.trade_date).slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue
    const prev = byDate.get(d)
    if (!prev || shouldPreferRow(row, prev)) byDate.set(d, row)
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, row]) => row)
}

const chunkSymbols = (symbols, size) => {
  const out = []
  for (let i = 0; i < symbols.length; i += size) out.push(symbols.slice(i, i + size))
  return out
}

/**
 * Multi-symbol history: paginate by trade_date order so Supabase row caps (often 1000) do not truncate 1Y metrics.
 * JP (.T) chunks optionally filter source / dedupe; non-JP chunks use rows as returned (sorted by date).
 *
 * @param {*} supabase Supabase client
 * @param {string[]} symbols
 * @param {string} cutoffStr YYYY-MM-DD
 * @param {object} [options]
 * @param {string} [options.select]
 * @param {boolean} [options.jpDedupe]
 * @param {string[]|null} [options.jpSourceFilter] if non-null, applied only to .T chunks
 * @param {number} [options.jpChunkSize]
 * @param {number} [options.nonJpChunkSize]
 * @param {number} [options.parallelChunks] parallel multi-symbol chunk queries per wave
 * @param {number} [options.pageSize] PostgREST page size (max rows per request)
 * @returns {Promise<Map<string, Array>>}
 */
export async function fetchStockDailyHistoryBySymbolMap(supabase, symbols, cutoffStr, options = {}) {
  const historyBySymbol = new Map()
  if (!supabase || !Array.isArray(symbols) || symbols.length === 0) return historyBySymbol

  const {
    select = 'symbol,trade_date,close,volume,source,fetched_at',
    jpDedupe = false,
    jpSourceFilter = null,
    jpChunkSize = 20,
    nonJpChunkSize = 28,
    parallelChunks = 8,
    pageSize = 1000,
  } = options

  const jp = symbols.filter((s) => String(s || '').endsWith('.T'))
  const nonJp = symbols.filter((s) => !String(s || '').endsWith('.T'))

  const workItems = [
    ...chunkSymbols(jp, jpChunkSize).map((symChunk) => ({
      symChunk,
      sourceIn: jpSourceFilter,
      dedupe: jpDedupe,
    })),
    ...chunkSymbols(nonJp, nonJpChunkSize).map((symChunk) => ({
      symChunk,
      sourceIn: null,
      dedupe: false,
    })),
  ]

  const fetchChunkRows = async (symChunk, sourceIn) => {
    const merged = []
    let from = 0
    while (true) {
      let q = supabase
        .from('stock_daily_prices')
        .select(select)
        .in('symbol', symChunk)
        .gte('trade_date', cutoffStr)
        .order('symbol', { ascending: true })
        .order('trade_date', { ascending: true })
        .range(from, from + pageSize - 1)
      if (Array.isArray(sourceIn) && sourceIn.length) q = q.in('source', sourceIn)
      const { data, error } = await q
      if (error) throw error
      const rows = data || []
      merged.push(...rows)
      if (rows.length < pageSize) break
      from += pageSize
    }
    return merged
  }

  for (let i = 0; i < workItems.length; i += parallelChunks) {
    const wave = workItems.slice(i, i + parallelChunks)
    const results = await Promise.all(
      wave.map(({ symChunk, sourceIn }) => fetchChunkRows(symChunk, sourceIn)),
    )
    for (let w = 0; w < wave.length; w += 1) {
      const { symChunk, dedupe } = wave[w]
      const rows = results[w] || []
      const bySym = new Map()
      for (const row of rows) {
        const s = row?.symbol
        if (!s) continue
        if (!bySym.has(s)) bySym.set(s, [])
        bySym.get(s).push(row)
      }
      for (const s of symChunk) {
        let arr = bySym.get(s) || []
        if (dedupe) arr = dedupeStockDailyPricesByTradeDate(arr)
        else arr.sort((a, b) => String(a.trade_date || '').localeCompare(String(b.trade_date || '')))
        historyBySymbol.set(s, arr)
      }
    }
  }

  return historyBySymbol
}
