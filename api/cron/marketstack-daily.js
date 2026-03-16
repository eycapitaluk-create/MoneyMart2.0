import { createClient } from '@supabase/supabase-js'
import { STOCK_LIST_400 } from '../../src/data/stockList400.js'
import { MARKETSTACK_BLOCKLIST_EXPORT, ETF_SYMBOLS_FROM_XLSX } from '../../src/data/etfListFromXlsx.js'

// Fallback when env not set - US+JP from stockList400 (us/jp_prices_final.csv 기반)
const STOCK_LIST_US_JP_SYMBOLS = STOCK_LIST_400
  .filter((r) => r?.region === 'US' || r?.region === 'JP')
  .map((r) => r.symbol)
  .filter(Boolean)

// Stock list 400 - NASDAQ100/SP500/EUROSTOXX/FTSE100/NIKKEI225 (마켓캡 순 100개씩)
const DEFAULT_MARKETSTACK_SYMBOLS = [
  // US NASDAQ100
  'NVDA','AAPL','MSFT','AMZN','GOOGL','META','TSLA','AVGO','GOOG','COST',
  'NFLX','TMUS','ADBE','AMD','PEP','LIN','CSCO','INTU','ISRG','AMGN',
  'QCOM','TXN','HON','AMAT','BKNG','ADP','SBUX','MDLZ','GILD','ADI',
  'MU','REGN','VRTX','PANW','SNPS','CDNS','KLAC','ASML','PYPL','MELI',
  'MAR','LRCX','NXPI','CTAS','ORLY','FTNT','MNST','ADSK','WDAY','PDD',
  'AEP','MCHP','KDP','CPRT','CHTR','KHC','IDXX','EXC','ROST','PAYX',
  'PCAR','DXCM','MRVL','CSX','GEHC','TEAM','AZN','BKR','ON',
  'DASH','EXPE','MDB','ROP','ODFL','DDOG','FAST','VRSK','BIIB','WBD',
  'DLTR','EBAY','TTD','ZS','ALGN','CEG','GFS','ILMN','ENPH',
  'LULU','JD','ZBRA','ALNY','OKTA','SIRI','LCID',
  // US SP500 (NASDAQ100 제외)
  'BRK.B','LLY','JPM','V','UNH','MA','XOM','WMT','PG','JNJ',
  'ORCL','HD','ABBV','MRK','BAC','CVX','KO','CRM','ABT','MCD',
  'TMO','WFC','AXP','DHR','DIS','PM','GE','IBM','CAT','VZ',
  'NEE','RTX','UNP','SPGI','TJX','SYK','MS','PLD','SCHW','UPS',
  'GS','INTC','BLK','ELV','C','T','PGR','COP','AMT','DE',
  'BA','CI','LMT','ZTS','CB','BSX','MMC','SYY','ICE',
  'EQIX','MO','SHW','CME','EOG','SLB','WM',
  // EU EUROSTOXX (exchange suffix 포함)
  'ASML.AS','MC.PA','RMS.PA','OR.PA','SAP.DE','SIE.DE','ITX.MC','DTE.DE','AIR.PA','SAN.MC',
  'SCHN.PA','SAF.PA','ALV.DE','TTE.PA','IBE.MC','ABI.BR','EL.PA','UCG.MI','BBVA.MC','BNP.PA',
  'ISP.MI','AI.PA','SASY.PA','ADYEN.AS','RACE.MI','DANO.PA','INGA.AS','ENEL.MI','IFX.DE','MBG.DE',
  'ENI.MI','MUV2.DE','DHL.DE','BAS.DE','BMW.DE','BAYN.DE','DB1.DE','AD.AS','AXAF.PA','SGEF.PA',
  'KER.PA','VOW3.DE','PRX.AS','FLTR.IR','ADS.DE','KNEBV.HE','PHG.AS','STLAM.MI','PERP.PA','VOLVB.ST',
  'NOVO-B.CO','ROG.SW','NESN.SW','NOVN.SW','UBSG.SW','ZURN.SW','ABBN.SW','CFR.SW','LONN.SW','GIVN.SW',
  'EQNR.OL','DNB.OL','ERIC.B','HM.B','SAND.SE','ASSA.B','DSV.CO','ORSTED.CO','VWS.CO','GEN.CO',
  'UPM.HE','NESTE.HE','HEI.DE','RHM.DE','ENR.DE','CBK.DE','BN.PA','ORA.PA','GLE.PA','VIE.PA',
  'EN.PA','VIV.PA','PUB.PA','SGO.PA','TEF.MC','REP.MC','GRF.MC','GASI.MI','SRG.MI','TRN.MI',
  'PRY.MI','KBC.BR','SOLB.BR','UCB.BR','HEIA.AS','AKZA.AS','WKL.AS','DSM.AS','RYA.IR','CRH.L',
  // UK FTSE100 (.L suffix)
  'AZN.L','HSBA.L','SHEL.L','ULVR.L','RR.L','BATS.L','GSK.L','BP.L','BARC.L','LLOY.L',
  'NG.L','BA.L','RIO.L','REL.L','GLEN.L','DGE.L','PRU.L','LSEG.L','STAN.L','III.L',
  'CPG.L','CCEP.L','SSE.L','EXPN.L','TSCO.L','ADM.L','AHT.L','AV.L','SN.L','MNTN.L',
  'LGEN.L','SGE.L','BDEV.L','SPX.L','ABF.L','MKS.L','NXT.L','SMIN.L','INF.L','SGRO.L',
  'ENT.L','WPP.L','AAF.L','ITRK.L','BNZL.L','STJ.L','KGF.L','PHNX.L','WEIR.L','CNA.L',
  'IAG.L','SVT.L','UU.L','SMT.L','ABDN.L','BEZ.L','IMB.L','PSH.L','FRAS.L','DPLM.L',
  'IMI.L','RSW.L','HLMA.L','HISC.L','IGG.L','SDR.L','MNG.L','BME.L','TW.L','PSN.L',
  'LNDL.L','BLND.L','HWDN.L','SMDS.L','SKG.L','JMAT.L','EDV.L','HBR.L','RTO.L','VIV.L',
  'GNS.L','BBY.L','IDS.L','FRES.L','MONY.L','DARK.L','INDV.L','HIK.L','UTG.L','OCDO.L',
  'SJP.L','BKG.L','ANTO.L','CNIC.L','ASC.L','JET.L','DRV.L','KIE.L','RNK.L','WIZZ.L',
  // JP NIKKEI225 (.T suffix)
  '7203.T','8306.T','6501.T','6758.T','8316.T','6857.T','8411.T','8035.T','8058.T','9983.T',
  '9984.T','7011.T','8031.T','4519.T','8001.T','6861.T','9432.T','8766.T','6503.T','6301.T',
  '7267.T','4502.T','8801.T','6954.T','7751.T','8053.T','4063.T','6902.T','9433.T','4568.T',
  '8725.T','6098.T','8015.T','6273.T','6146.T','6367.T','8802.T','6506.T','8267.T','6981.T',
  '7201.T','9020.T','2802.T','5108.T','4543.T','9022.T','4901.T','7733.T','3382.T','1925.T',
  '9201.T','8591.T','8604.T','6702.T','6723.T','9101.T','2502.T','4523.T','6701.T','1605.T',
  '7012.T','7261.T','2503.T','4452.T','6594.T','9503.T','1801.T','4911.T','9104.T','9502.T',
  '1928.T','4188.T','5020.T','6326.T','7270.T','9021.T','1802.T','4503.T','8308.T','2413.T',
  '7741.T','9005.T','5401.T','9531.T','4704.T','4661.T','8051.T','6471.T','9202.T',
  '4324.T','6762.T','3407.T','9532.T','1803.T','4005.T','5802.T','7202.T','9735.T','5713.T',
]

// Always keep MarketPage heatmap/Fear&Greed symbols in tier1 so they are not dropped in budget mode.
const REQUIRED_HEATMAP_SYMBOLS = [
  'ACWI', 'MCHI', '1329.T', '1475.T', 'EUNK.DE', 'AAXJ', 'EEM', 'IVV', 'IJH', 'IJR',
  'IYE', 'IYM', 'IYJ', 'IYC', 'IYK', 'IYH', 'IYF', 'IYW', 'IYZ', 'IDU', 'IYR',
  'TLT', '2621.T',
  // 원자재 (Commodities via ETF proxies, fallback when commodity_daily_prices empty)
  'GLD', 'SLV', 'CPER', 'USO',
]

const toDateOnly = (value) => {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

// MarketStack returns XTKS/XLON 등 → FundPage/StockPage는 .T/.L 사용. 저장 시 정규화
const normalizeSymbolForStorage = (symbol) => {
  if (!symbol || typeof symbol !== 'string') return symbol
  const s = symbol.trim()
  if (s.endsWith('.XTKS')) return s.slice(0, -5) + '.T'
  if (s.endsWith('.XLON')) return s.slice(0, -5) + '.L'
  return s
}

const parseSymbols = (raw) => {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

const uniqueSymbols = (symbols) => [...new Set((symbols || []).filter(Boolean))]
const MAX_PRICE = 10_000_000
const MAX_VOLUME = 1_000_000_000_000

const estimateChunkCount = (symbols) => Math.ceil(uniqueSymbols(symbols).length / 20)

const parsePositiveInt = (raw, fallback) => {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.floor(n)
}

const monthStartIsoUtc = () => {
  const now = new Date()
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return utc.toISOString()
}

const isWeekendUtc = (date = new Date()) => {
  const d = date.getUTCDay()
  return d === 0 || d === 6
}

const estimateJobRequestCount = (meta) => {
  if (!meta || typeof meta !== 'object') return 0
  const chunkVal = Number(meta.chunks)
  if (Number.isFinite(chunkVal) && chunkVal > 0) return Math.floor(chunkVal)
  const symbols = Array.isArray(meta.symbols) ? meta.symbols : []
  return estimateChunkCount(symbols)
}

const chunk = (arr, size) => {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const normalizePriceNumber = (value, { min = 0.000001, max = MAX_PRICE } = {}) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  if (n < min || n > max) return null
  return n
}

const normalizeVolumeNumber = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  if (n < 0 || n > MAX_VOLUME) return null
  return Math.round(n)
}

const getJson = async (url, init) => {
  const res = await fetch(url, init)
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json?.error?.message || `marketstack request failed: ${res.status}`)
  }
  if (json?.error) {
    throw new Error(json.error.message || 'marketstack returned error')
  }
  return json
}

const CONCURRENCY = 8 // MarketStack 5 req/sec, 8병렬로 처리 시간 단축
const fetchMarketstackRows = async (marketstackKey, symbols) => {
  const chunks = chunk(symbols, 20)
  const allRows = []
  const endpointStats = {}

  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY)
    const results = await Promise.all(batch.map((c) => fetchChunkRows(marketstackKey, c)))
    for (const r of results) {
      allRows.push(...r.rows)
      endpointStats[r.endpoint] = (endpointStats[r.endpoint] || 0) + 1
    }
  }

  return { rows: allRows, endpointStats, chunks: chunks.length }
}



const getLastUSTradingDate = () => {
  const d = new Date()
  const utcDay = d.getUTCDay()
  const utcDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  if (utcDay === 0) utcDate.setUTCDate(utcDate.getUTCDate() - 2)
  else if (utcDay === 6) utcDate.setUTCDate(utcDate.getUTCDate() - 1)
  return utcDate.toISOString().slice(0, 10)
}

const isUSSymbol = (s) => {
  if (!s || typeof s !== 'string') return false
  const u = s.toUpperCase()
  if (u.endsWith('.T') || u.endsWith('.L')) return false
  if (/\.(AS|DE|PA|MC|BR|OL|SW|HE|IR|CO|SE|MI|MC|ST|VX)$/.test(u)) return false
  return true
}

const fetchChunkRows = async (marketstackKey, symbols) => {
  const encodedKey = encodeURIComponent(marketstackKey)
  const encodedSymbols = encodeURIComponent(symbols.join(','))

  const tryFetch = async ({ version, authMode }) => {
    const useHeaderAuth = authMode === 'header'
    const authQuery = useHeaderAuth ? '' : `access_key=${encodedKey}&`
    const init = useHeaderAuth ? { headers: { apikey: marketstackKey } } : undefined

    // v2 + US 청크: intraday 먼저 (IEX)
    const allUS = symbols.every((s) => isUSSymbol(s))
    if (version === 'v2' && allUS) {
      try {
        const tradeDate = getLastUSTradingDate()
        const intradayUrl = `https://api.marketstack.com/v2/intraday/${tradeDate}?${authQuery}symbols=${encodedSymbols}&interval=15min&limit=100&sort=DESC`
        const intradayJson = await getJson(intradayUrl, init)
        const intradayRows = Array.isArray(intradayJson?.data) ? intradayJson.data : []
        if (intradayRows.length > 0) {
          const seen = new Set()
          const deduped = intradayRows.filter((r) => {
            const s = r?.symbol || r?.ticker
            if (!s || seen.has(s)) return false
            seen.add(s)
            return true
          })
          const normalized = deduped.map((r) => ({
            ...r,
            close: r?.marketstack_last ?? r?.last ?? r?.close ?? r?.mid ?? r?.close,
          }))
          return { rows: normalized, endpoint: `v2:intraday:${authMode}` }
        }
      } catch (_) { /* intraday fallback to EOD */ }
    }

    // EOD: latest는 시장 마감 직후 당일 데이터를 즉시 안 줄 수 있음. 명시적 날짜 먼저 시도
    const tradeDate = getLastUSTradingDate()
    const dateUrl = `https://api.marketstack.com/${version}/eod/${tradeDate}?${authQuery}symbols=${encodedSymbols}`
    try {
      const dateJson = await getJson(dateUrl, init)
      const dateRows = Array.isArray(dateJson?.data) ? dateJson.data : []
      if (dateRows.length > 0) {
        return { rows: dateRows, endpoint: `${version}:eod:${tradeDate}:${authMode}` }
      }
    } catch (_) { /* fallback to latest */ }

    const latestUrl = `https://api.marketstack.com/${version}/eod/latest?${authQuery}symbols=${encodedSymbols}`
    const latestJson = await getJson(latestUrl, init)
    const latestRows = Array.isArray(latestJson?.data) ? latestJson.data : []
    if (latestRows.length > 0) {
      return { rows: latestRows, endpoint: `${version}:latest:${authMode}` }
    }

    // Fallback: standard EOD endpoint
    const eodUrl = `https://api.marketstack.com/${version}/eod?${authQuery}symbols=${encodedSymbols}&limit=100&sort=DESC`
    const eodJson = await getJson(eodUrl, init)
    const eodRows = Array.isArray(eodJson?.data) ? eodJson.data : []
    if (eodRows.length > 0) {
      return { rows: eodRows, endpoint: `${version}:eod:${authMode}` }
    }

    return { rows: [], endpoint: `${version}:none:${authMode}` }
  }

  const attempts = [
    { version: 'v2', authMode: 'query' },
    { version: 'v2', authMode: 'header' },
    { version: 'v1', authMode: 'query' },
    { version: 'v1', authMode: 'header' },
  ]
  const errors = []

  for (const attempt of attempts) {
    try {
      return await tryFetch(attempt)
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase()
      errors.push(`${attempt.version}/${attempt.authMode}: ${e.message}`)
      if (msg.includes('not available in the v1 endpoint')) continue
      if (msg.includes('access key') || msg.includes('apikey') || msg.includes('invalid')) continue
    }
  }

  throw new Error(`Marketstack fetch failed: ${errors.join(' | ')}`)
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return res.status(500).json({ ok: false, error: 'CRON_SECRET is required' })
  }
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (token !== cronSecret) {
    return res.status(401).json({ ok: false, error: 'Unauthorized cron request' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const marketstackKey =
    process.env.MARKETSTACK_ACCESS_KEY ||
    process.env.MARKETSTACK_APIKEY ||
    process.env.MARKETSTACK_API_KEY
  const configuredTier1Symbols = parseSymbols(process.env.MARKETSTACK_SYMBOLS_TIER1)
  const configuredTier2Symbols = parseSymbols(process.env.MARKETSTACK_SYMBOLS_TIER2)
  const configuredSymbols = parseSymbols(process.env.MARKETSTACK_SYMBOLS)
  const onlyWeekdays = String(process.env.MARKETSTACK_WEEKDAYS_ONLY || 'true').toLowerCase() !== 'false'
  const skipIfAlreadyRanToday = String(process.env.MARKETSTACK_SKIP_IF_TODAY_SUCCESS || 'true').toLowerCase() !== 'false'
  const requestUrl = new URL(req.url || '/api/cron/marketstack-daily', 'http://localhost')
  const forceRun = ['1', 'true', 'yes'].includes(
    String(requestUrl.searchParams.get('force') || '').toLowerCase()
  )
  const overrideSymbols = parseSymbols(requestUrl.searchParams.get('symbols') || '')
  const monthlyBudgetRequests = parsePositiveInt(
    process.env.MARKETSTACK_MONTHLY_BUDGET_REQUESTS,
    10000
  )

  if (!supabaseUrl || !serviceRoleKey || !marketstackKey) {
    return res.status(500).json({
      ok: false,
      error:
        'Missing env. Required: SUPABASE_URL, SUPABASE_SECRET_KEY(or SUPABASE_SERVICE_ROLE_KEY), MARKETSTACK_ACCESS_KEY',
    })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  let jobId = null

  try {
    if (onlyWeekdays && !forceRun && isWeekendUtc()) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: 'Weekend skip (MARKETSTACK_WEEKDAYS_ONLY=true)',
      })
    }

    // 09:00 UTC와 21:00 UTC 둘 다 같은 UTC일이라 "오늘 성공" 스킵 시 21:00(미국 마감 직후) 실행이 막힘.
    // 최소 8시간 간격으로만 스킵해 두 번 모두 실행되도록 함.
    const SKIP_IF_SUCCESS_WITHIN_HOURS = 8
    if (skipIfAlreadyRanToday && !forceRun) {
      const cutoff = new Date(Date.now() - SKIP_IF_SUCCESS_WITHIN_HOURS * 60 * 60 * 1000)
      const { data: recentJob, error: recentJobErr } = await supabase
        .from('ingestion_jobs')
        .select('id,started_at')
        .eq('source', 'marketstack')
        .eq('dataset', 'stock_daily_prices')
        .eq('status', 'success')
        .gte('started_at', cutoff.toISOString())
        .order('started_at', { ascending: false })
        .limit(1)
      if (recentJobErr) throw recentJobErr
      if (Array.isArray(recentJob) && recentJob.length > 0) {
        return res.status(200).json({
          ok: true,
          skipped: true,
          reason: `Already succeeded within ${SKIP_IF_SUCCESS_WITHIN_HOURS}h`,
          last_success_started_at: recentJob[0].started_at,
        })
      }
    }

    // 주식 717 + 펀드 335 = 1052개. env로 소수만 설정돼 있으면 전체 사용
    const fullStockSymbols = STOCK_LIST_US_JP_SYMBOLS.length > 0 ? STOCK_LIST_US_JP_SYMBOLS : DEFAULT_MARKETSTACK_SYMBOLS
    const baseFallbackSymbols =
      configuredSymbols.length > 0 && configuredSymbols.length >= 500
        ? configuredSymbols
        : fullStockSymbols
    const tier1Symbols = uniqueSymbols([
      ...(configuredTier1Symbols.length >= 500 ? configuredTier1Symbols : baseFallbackSymbols),
      ...REQUIRED_HEATMAP_SYMBOLS,
      ...ETF_SYMBOLS_FROM_XLSX, // 펀드(ETF)는 tier1에 포함해 예산 모드에서도 수집
    ])
    const tier2Symbols = uniqueSymbols(configuredTier2Symbols)
    const rawAllSymbols = overrideSymbols.length > 0 ? overrideSymbols : uniqueSymbols([...tier1Symbols, ...tier2Symbols])
    const allSymbols = rawAllSymbols.filter((s) => !MARKETSTACK_BLOCKLIST_EXPORT.has(s))

    const { data: monthJobs, error: monthJobsErr } = await supabase
      .from('ingestion_jobs')
      .select('meta,status,started_at')
      .eq('source', 'marketstack')
      .eq('dataset', 'stock_daily_prices')
      .in('status', ['success', 'failed'])
      .gte('started_at', monthStartIsoUtc())
      .limit(500)
    if (monthJobsErr) throw monthJobsErr

    const monthUsedRequests = (monthJobs || []).reduce(
      (sum, row) => sum + estimateJobRequestCount(row?.meta),
      0
    )
    const monthRemainingRequests = Math.max(0, monthlyBudgetRequests - monthUsedRequests)

    const allSymbolsRequests = estimateChunkCount(allSymbols)
    const tier1Requests = estimateChunkCount(tier1Symbols)

    let selectedSymbols = allSymbols
    let budgetMode = 'all_tiers'
    if (monthRemainingRequests < allSymbolsRequests) {
      if (monthRemainingRequests >= tier1Requests) {
        selectedSymbols = tier1Symbols.filter((s) => !MARKETSTACK_BLOCKLIST_EXPORT.has(s))
        budgetMode = 'tier1_only'
      } else {
        selectedSymbols = []
        budgetMode = 'budget_skip'
      }
    }

    const { data: startedJob, error: startedErr } = await supabase
      .from('ingestion_jobs')
      .insert([
        {
          source: 'marketstack',
          dataset: 'stock_daily_prices',
          status: 'started',
          meta: {
            symbols: selectedSymbols,
            budgetMode,
            monthlyBudgetRequests,
            monthUsedRequests,
            monthRemainingRequests,
            tier1Count: tier1Symbols.length,
            tier2Count: tier2Symbols.length,
          },
        },
      ])
      .select('id')
      .single()
    if (!startedErr) jobId = startedJob?.id ?? null

    if (selectedSymbols.length === 0) {
      if (jobId) {
        await supabase
          .from('ingestion_jobs')
          .update({
            status: 'success',
            finished_at: new Date().toISOString(),
            rows_processed: 0,
            meta: {
              symbols: [],
              chunks: 0,
              budgetMode,
              monthlyBudgetRequests,
              monthUsedRequests,
              monthRemainingRequests,
              skipped: true,
              reason: 'Monthly Marketstack request budget reached. Skipped this run.',
            },
          })
          .eq('id', jobId)
      }
      return res.status(200).json({
        ok: true,
        skipped: true,
        budget_mode: budgetMode,
        budget: {
          monthly: monthlyBudgetRequests,
          used: monthUsedRequests,
          remaining: monthRemainingRequests,
        },
      })
    }

    const { rows, endpointStats, chunks } = await fetchMarketstackRows(marketstackKey, selectedSymbols)
    if (rows.length === 0) {
      throw new Error(
        'No rows returned from marketstack. Check MARKETSTACK_SYMBOLS and your plan coverage.'
      )
    }

    const symbolRows = []
    const priceRows = []
    const droppedPriceRowsByQuality = {}
    let droppedPriceRows = 0

    for (const r of rows) {
      const symbol = normalizeSymbolForStorage(r?.symbol || r?.ticker)
      const tradeDate = toDateOnly(r?.date)
      if (!symbol || !tradeDate) continue

      symbolRows.push({
        symbol,
        name: r?.name || null,
        exchange: r?.exchange || null,
        currency: r?.currency || null,
        is_active: true,
      })

      const close = normalizePriceNumber(r?.close)
      if (close == null) {
        droppedPriceRows += 1
        droppedPriceRowsByQuality[symbol] = (droppedPriceRowsByQuality[symbol] || 0) + 1
        continue
      }

      priceRows.push({
        source: 'marketstack',
        symbol,
        trade_date: tradeDate,
        open: normalizePriceNumber(r?.open),
        high: normalizePriceNumber(r?.high),
        low: normalizePriceNumber(r?.low),
        close,
        volume: normalizeVolumeNumber(r?.volume),
        raw: r,
      })
    }

    const qualitySummary = {
      sourceRows: rows.length,
      acceptedPriceRows: priceRows.length,
      droppedPriceRows,
      droppedSymbolsTop10: Object.entries(droppedPriceRowsByQuality)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
    }

    if (symbolRows.length > 0) {
      const { error: symbolErr } = await supabase
        .from('stock_symbols')
        .upsert(symbolRows, { onConflict: 'symbol' })
      if (symbolErr) throw symbolErr
    }

    if (priceRows.length > 0) {
      const { error: priceErr } = await supabase
        .from('stock_daily_prices')
        .upsert(priceRows, { onConflict: 'source,symbol,trade_date' })
      if (priceErr) throw priceErr
    } else {
      throw new Error(`No valid price rows after quality filter. ${JSON.stringify(qualitySummary)}`)
    }

    if (jobId) {
      await supabase
        .from('ingestion_jobs')
        .update({
          status: 'success',
          finished_at: new Date().toISOString(),
          rows_processed: priceRows.length,
          meta: {
            symbols: selectedSymbols,
            chunks,
            endpointStats,
            qualitySummary,
            budgetMode,
            monthlyBudgetRequests,
            monthUsedRequests,
            monthRemainingRequests,
          },
        })
        .eq('id', jobId)
    }

    return res.status(200).json({
      ok: true,
      budget_mode: budgetMode,
      symbols: selectedSymbols.length,
      chunks,
      rows_processed: priceRows.length,
      endpoint_stats: endpointStats,
      quality_summary: qualitySummary,
      budget: {
        monthly: monthlyBudgetRequests,
        used: monthUsedRequests,
        remaining: monthRemainingRequests,
      },
    })
  } catch (error) {
    if (jobId) {
      await supabase
        .from('ingestion_jobs')
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          error_message: error.message,
        })
        .eq('id', jobId)
    }
    return res.status(500).json({ ok: false, error: error.message })
  }
}

