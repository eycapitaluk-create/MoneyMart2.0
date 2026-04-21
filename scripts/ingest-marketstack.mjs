/**
 * Marketstack → Supabase 직접 인제스트 스크립트
 * 실행: node scripts/ingest-marketstack.mjs [--region US|JP|UK|EU] [--dry-run]
 */
import { createClient } from '@supabase/supabase-js'
import { STOCK_LIST_400 } from '../src/data/stockList400.js'

const MARKETSTACK_KEY =
  process.env.MARKETSTACK_ACCESS_KEY ||
  process.env.MARKETSTACK_APIKEY ||
  process.env.MARKETSTACK_API_KEY
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

if (!MARKETSTACK_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing env. Required: MARKETSTACK_ACCESS_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY(or SUPABASE_SECRET_KEY)')
}

const MAX_PRICE = 10_000_000
const MAX_VOLUME = 1_000_000_000_000

const args = process.argv.slice(2)
const regionFilter = args.includes('--region') ? args[args.indexOf('--region') + 1] : null
const dryRun = args.includes('--dry-run')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Stock list symbol -> Marketstack query symbol overrides
// Keep StockPage symbol as-is, but fetch via known exchange aliases.
const MARKETSTACK_SYMBOL_OVERRIDES = {
  // UK
  'HISC.L': 'HSX.L',
  'LNDL.L': 'LAND.L',
  'VIV.L': 'VTY.L',
  'SJP.L': 'STJ.L',
  // EU
  'SCHN.PA': 'SU.PA',
  'SASY.PA': 'SAN.PA',
  'DANO.PA': 'BN.PA',
  'AXAF.PA': 'CS.PA',
  'SGEF.PA': 'DG.PA',
  'FLTR.IR': 'FLTR.L',
  'PHG.AS': 'PHIA.AS',
  'PERP.PA': 'RI.PA',
  'VOLVB.ST': 'VOLV-B.ST',
  'ERIC.B': 'ERIC-B.ST',
  'HM.B': 'HM-B.ST',
  'SAND.SE': 'SAND.ST',
  'ASSA.B': 'ASSA-B.ST',
  'GEN.CO': 'GMAB.CO',
  'GASI.MI': 'G.MI',
  'DSM.AS': 'DSFIR.AS',
}

// Marketstack 심볼 포맷 변환
// UK는 .XLON이 수집률이 높아 변환, JP/EU는 원본 접미사를 유지
const toMarketstackSymbol = (sym, region) => {
  if (MARKETSTACK_SYMBOL_OVERRIDES[sym]) return MARKETSTACK_SYMBOL_OVERRIDES[sym]
  // JP: .T 그대로 사용 (XTKS 미지원)
  if (region === 'EU') return sym
  if (region === 'UK') return sym.replace(/\.L$/, '.XLON')
  return sym
}

const chunk = (arr, size) => {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const fetchLatest = async (symbols) => {
  const encoded = encodeURIComponent(symbols.join(','))
  for (const ver of ['v2']) {
    const url = `https://api.marketstack.com/${ver}/eod/latest?access_key=${MARKETSTACK_KEY}&symbols=${encoded}`
    const res = await fetch(url)
    const json = await res.json()
    if (json?.error) {
      const msg = json.error.message || ''
      if (msg.includes('not available in the V1') || msg.includes('V1 endpoint')) continue
      throw new Error(msg)
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const rows = Array.isArray(json?.data) ? json.data : []
    if (rows.length > 0) return rows
  }
  return []
}

const upsertToSupabase = async (rows) => {
  if (rows.length === 0) return { symbolCount: 0, priceCount: 0 }

  const validRows = rows.filter(r => r.symbol && typeof r.symbol === 'string')
  if (validRows.length < rows.length) {
    console.warn(`  ⚠ null symbol 제거: ${rows.length - validRows.length}개`)
  }

  const symbolRows = validRows.map(r => ({
    symbol: r.symbol,
    name: r.name || null,
    exchange: r.exchange || null,
  }))

  const safeNum = (v, max, min = 0) => {
    const n = Number(v)
    if (!Number.isFinite(n)) return null
    if (n < min || n > max) return null
    return n
  }
  let droppedPriceRows = 0
  const droppedPriceRowsByQuality = {}
  const priceRows = validRows
    .map((r) => {
      const tradeDate = r.date?.slice(0, 10)
      const open = safeNum(r.open, MAX_PRICE, 0.000001)
      const high = safeNum(r.high, MAX_PRICE, 0.000001)
      const low = safeNum(r.low, MAX_PRICE, 0.000001)
      const close = safeNum(r.close, MAX_PRICE, 0.000001)
      const volume = safeNum(r.volume, MAX_VOLUME, 0)
      if (!tradeDate || close == null) {
        droppedPriceRows += 1
        droppedPriceRowsByQuality[r.symbol] = (droppedPriceRowsByQuality[r.symbol] || 0) + 1
        return null
      }
      return {
        symbol: r.symbol,
        trade_date: tradeDate,
        open,
        high,
        low,
        close,
        volume,
      }
    })
    .filter(Boolean)

  const { error: symErr } = await supabase
    .from('stock_symbols')
    .upsert(symbolRows, { onConflict: 'symbol', ignoreDuplicates: true })
  if (symErr) console.warn('  ⚠ stock_symbols upsert:', symErr.message)

  // symbol+trade_date 기준으로 기존 데이터 삭제 후 재삽입
  const datesBySymbol = {}
  for (const r of priceRows) {
    if (!datesBySymbol[r.symbol]) datesBySymbol[r.symbol] = []
    datesBySymbol[r.symbol].push(r.trade_date)
  }
  for (const [sym, dates] of Object.entries(datesBySymbol)) {
    await supabase.from('stock_daily_prices')
      .delete()
      .eq('symbol', sym)
      .in('trade_date', dates)
  }
  const { error: priceErr } = await supabase
    .from('stock_daily_prices')
    .insert(priceRows)
  if (priceErr) console.warn('  ⚠ stock_daily_prices insert:', priceErr.message)

  return {
    symbolCount: symbolRows.length,
    priceCount: priceRows.length,
    qualitySummary: {
      sourceRows: rows.length,
      acceptedPriceRows: priceRows.length,
      droppedPriceRows,
      droppedSymbolsTop10: Object.entries(droppedPriceRowsByQuality)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
    },
  }
}

const run = async () => {
  const allStocks = regionFilter
    ? STOCK_LIST_400.filter(s => s.region === regionFilter)
    : STOCK_LIST_400

  console.log(`\n🚀 Marketstack Ingest`)
  console.log(`   Region: ${regionFilter || 'ALL'}`)
  console.log(`   Stocks: ${allStocks.length}`)
  console.log(`   Dry run: ${dryRun}`)
  console.log(`   API key: ${MARKETSTACK_KEY.slice(0, 8)}...`)
  console.log()

  // Marketstack 심볼로 변환
  const symbolMap = new Map() // marketstackSymbol -> original symbols[]
  for (const s of allStocks) {
    const msSym = toMarketstackSymbol(s.symbol, s.region)
    const current = symbolMap.get(msSym) || []
    current.push(s.symbol)
    symbolMap.set(msSym, current)
  }
  const msSymbols = [...symbolMap.keys()]
  const chunks = chunk(msSymbols, 20)

  let totalRows = 0
  let totalErrors = 0
  const failedSymbols = []
  const regionStats = {}

  for (let i = 0; i < chunks.length; i++) {
    const batch = chunks[i]
    console.log(`📦 Chunk ${i + 1}/${chunks.length}: ${batch.slice(0,3).join(',')}... (${batch.length}개)`)

    try {
      const rows = await fetchLatest(batch)
      console.log(`   → ${rows.length}개 수신`)

      const normalizedRows = rows.flatMap((r) => {
        const originals = symbolMap.get(r.symbol) || [r.symbol]
        return originals.map((symbol) => ({ ...r, symbol }))
      })

      if (normalizedRows.length > 0 && !dryRun) {
        const { priceCount, qualitySummary } = await upsertToSupabase(normalizedRows)
        totalRows += priceCount
        if (qualitySummary?.droppedPriceRows > 0) {
          console.warn(
            `   ⚠ quality drop: ${qualitySummary.droppedPriceRows}/${qualitySummary.sourceRows} rows`
          )
        }
        for (const r of normalizedRows) {
          const origSym = r.symbol
          const stock = STOCK_LIST_400.find(s => s.symbol === origSym || s.symbol === r.symbol)
          const region = stock?.region || 'US'
          regionStats[region] = (regionStats[region] || 0) + 1
        }
      } else if (dryRun && normalizedRows.length > 0) {
        console.log(`   [DRY-RUN] ${normalizedRows.map(r => r.symbol).join(', ')}`)
      }

      // 받은 심볼 vs 요청 비교 → 없는건 실패 처리
      const receivedSet = new Set(rows.map(r => r.symbol))
      for (const sym of batch) {
        if (!receivedSet.has(sym)) failedSymbols.push(sym)
      }

    } catch (err) {
      console.warn(`   ❌ Chunk error: ${err.message}`)
      totalErrors++
      // Fallback: salvage this chunk symbol-by-symbol
      const rescuedRows = []
      for (const sym of batch) {
        try {
          const oneRows = await fetchLatest([sym])
          if (oneRows.length > 0) rescuedRows.push(...oneRows)
          else failedSymbols.push(sym)
        } catch {
          failedSymbols.push(sym)
        }
      }
      if (rescuedRows.length > 0) {
        const normalizedRows = rescuedRows.flatMap((r) => {
          const originals = symbolMap.get(r.symbol) || [r.symbol]
          return originals.map((symbol) => ({ ...r, symbol }))
        })
        if (!dryRun) {
          const { priceCount, qualitySummary } = await upsertToSupabase(normalizedRows)
          totalRows += priceCount
          if (qualitySummary?.droppedPriceRows > 0) {
            console.warn(
              `   ⚠ quality drop(rescue): ${qualitySummary.droppedPriceRows}/${qualitySummary.sourceRows} rows`
            )
          }
          for (const r of normalizedRows) {
            const stock = STOCK_LIST_400.find((s) => s.symbol === r.symbol)
            const region = stock?.region || 'US'
            regionStats[region] = (regionStats[region] || 0) + 1
          }
        }
      }
    }

    // Rate limit 방지 (무료 플랜: 초당 5req)
    if (i < chunks.length - 1) await sleep(300)
  }

  console.log('\n📊 결과 요약')
  console.log(`   성공 rows: ${totalRows}`)
  console.log(`   에러 청크: ${totalErrors}`)
  console.log(`   데이터 없는 심볼: ${failedSymbols.length}개`)
  if (Object.keys(regionStats).length > 0) {
    console.log(`   리전별:`, regionStats)
  }
  if (failedSymbols.length > 0 && failedSymbols.length <= 30) {
    console.log(`   실패:`, failedSymbols.join(', '))
  }
}

run().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
