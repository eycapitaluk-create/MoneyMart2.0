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
  'MU','REGN','VRTX','VRT','PANW','SNPS','CDNS','KLAC','ASML','PYPL','MELI',
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

// Data integrity quarantine list.
// Some symbols may temporarily carry obviously broken values from the provider.
// We skip ingesting them until source quality is restored.
const MARKETSTACK_TEMP_BAD_SYMBOLS = new Set([
  'BKNG',
])

// Always keep MarketPage heatmap/Fear&Greed symbols in tier1 so they are not dropped in budget mode.
// EU/UK 제외 (EUNK.DE 등)
const REQUIRED_HEATMAP_SYMBOLS = [
  'ACWI', 'MCHI', '1329.T', '1475.T', 'AAXJ', 'EEM', 'IVV', 'IJH', 'IJR',
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

// MarketStack returns XTKS/XLON/XTSE 등 → FundPage/StockPage는 .T/.L 사용. 저장 시 정규화
const normalizeSymbolForStorage = (symbol) => {
  if (!symbol || typeof symbol !== 'string') return symbol
  const s = symbol.trim()
  if (s.endsWith('.XTKS')) return s.slice(0, -5) + '.T'
  if (s.endsWith('.XLON')) return s.slice(0, -5) + '.L'
  if (s.endsWith('.XTSE')) return s.slice(0, -5) // DAY.XTSE → DAY
  return s
}

// DAY: Toronto (XTSE) 데이터 사용. NYSE DAY는 잘못된 데이터 가능
const XTSE_SYMBOLS = new Set(['DAY'])

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

// Timeout mitigation: fewer API requests per run while staying below MarketStack max(100)
const CHUNK_SIZE = 80
const estimateChunkCount = (symbols) => Math.ceil(uniqueSymbols(symbols).length / CHUNK_SIZE)

const parsePositiveInt = (raw, fallback) => {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.floor(n)
}

const parseBoolLike = (raw) => ['1', 'true', 'yes'].includes(String(raw || '').toLowerCase())

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

const pickReliableClose = (row = {}) => {
  const close = normalizePriceNumber(row?.close)
  const marketstackLast = normalizePriceNumber(row?.marketstack_last)
  const last = normalizePriceNumber(row?.last)
  const mid = normalizePriceNumber(row?.mid)
  // Prefer canonical close first. Some symbols return inconsistent marketstack_last.
  return close ?? marketstackLast ?? last ?? mid
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

const CONCURRENCY = 4 // Keep under 5 req/sec while reducing total wall-clock time
const fetchXtseChunk = async (marketstackKey, symbols) => {
  const xtseOnly = symbols.filter((s) => XTSE_SYMBOLS.has((s || '').toUpperCase()))
  if (xtseOnly.length === 0) return { rows: [], endpoint: null }
  const encodedKey = encodeURIComponent(marketstackKey)
  const encodedSymbols = encodeURIComponent(xtseOnly.join(','))
  const authQuery = `access_key=${encodedKey}&`
  const url = `https://api.marketstack.com/v2/eod/latest?${authQuery}symbols=${encodedSymbols}&exchange=XTSE`
  const json = await getJson(url)
  const rows = Array.isArray(json?.data) ? json.data : []
  return { rows, endpoint: 'v2:latest:XTSE' }
}
const fetchMarketstackRows = async (marketstackKey, symbols, opts = {}) => {
  const xtseSymbols = symbols.filter((s) => XTSE_SYMBOLS.has((s || '').toUpperCase()))
  const restSymbols = symbols.filter((s) => !XTSE_SYMBOLS.has((s || '').toUpperCase()))
  const allRows = []
  const endpointStats = {}

  if (xtseSymbols.length > 0) {
    const { rows: xtseRows, endpoint } = await fetchXtseChunk(marketstackKey, xtseSymbols)
    if (endpoint) endpointStats[endpoint] = 1
    allRows.push(...xtseRows)
  }

  if (restSymbols.length > 0) {
    const chunks = chunk(restSymbols, CHUNK_SIZE)
    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
      const batch = chunks.slice(i, i + CONCURRENCY)
      const results = await Promise.all(batch.map((c) => fetchChunkRows(marketstackKey, c, opts)))
      for (const r of results) {
        allRows.push(...r.rows)
        endpointStats[r.endpoint] = (endpointStats[r.endpoint] || 0) + 1
      }
      if (i + CONCURRENCY < chunks.length) await new Promise((r) => setTimeout(r, 400))
    }
  }

  return { rows: allRows, endpointStats, chunks: Math.ceil(restSymbols.length / CHUNK_SIZE) + (xtseSymbols.length > 0 ? 1 : 0) }
}



const getLastUSTradingDate = () => {
  const d = new Date()
  const utcDay = d.getUTCDay()
  const utcDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  if (utcDay === 0) utcDate.setUTCDate(utcDate.getUTCDate() - 2)
  else if (utcDay === 6) utcDate.setUTCDate(utcDate.getUTCDate() - 1)
  return utcDate.toISOString().slice(0, 10)
}

/** 東京市場の最終営業日 (Asia/Tokyo) */
const getLastJPTradingDate = () => {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' })
  const [y, m, d] = fmt.format(new Date()).split('-').map(Number)
  const jstDate = new Date(Date.UTC(y, m - 1, d))
  const day = jstDate.getUTCDay()
  if (day === 0) jstDate.setUTCDate(jstDate.getUTCDate() - 2)
  else if (day === 6) jstDate.setUTCDate(jstDate.getUTCDate() - 1)
  return jstDate.toISOString().slice(0, 10)
}

const isUSSymbol = (s) => {
  if (!s || typeof s !== 'string') return false
  const u = s.toUpperCase()
  if (u.endsWith('.T') || u.endsWith('.L')) return false
  if (/\.(AS|DE|PA|MC|BR|OL|SW|HE|IR|CO|SE|MI|MC|ST|VX)$/.test(u)) return false
  return true
}

/** jp / jp_etf / us / all — 같은 scope 내에서만 8h 중복 스킵 (US·JP 크론이 서로 막히지 않게) */
const jobMetaMatchesRunScope = (meta, scope) => {
  if (!meta || typeof meta !== 'object') return false
  if (meta.scope === scope) return true
  const bm = String(meta.budgetMode || '')
  if (scope === 'jp') return bm.includes('_jp_only') && !bm.includes('_jp_etf')
  if (scope === 'jp_etf') return bm.includes('_jp_etf')
  if (scope === 'us') return bm.includes('_us_only')
  if (scope === 'all') return !bm.includes('_jp_only') && !bm.includes('_us_only')
  return false
}

const fetchChunkRows = async (marketstackKey, symbols, opts = {}) => {
  const encodedKey = encodeURIComponent(marketstackKey)
  const encodedSymbols = encodeURIComponent(symbols.join(','))
  const safeOpts = opts && typeof opts === 'object' ? opts : {}

  const tryFetch = async ({ version, authMode }) => {
    const useHeaderAuth = authMode === 'header'
    const authQuery = useHeaderAuth ? '' : `access_key=${encodedKey}&`
    const init = useHeaderAuth ? { headers: { apikey: marketstackKey } } : undefined

    // v2 + US 청크: intraday 먼저 (IEX)
    const allUS = symbols.every((s) => isUSSymbol(s))
    if (version === 'v2' && allUS) {
      try {
        const tradeDate = safeOpts.usTradeDateOverride || getLastUSTradingDate()
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
            close: pickReliableClose(r),
          }))
          return { rows: normalized, endpoint: `v2:intraday:${authMode}` }
        }
      } catch (_) { /* intraday fallback to EOD */ }
    }

    // EOD: US 청크는 eod/{US날짜}, JP 전용 청크는 eod/{JP날짜}&exchange=XTKS로 날짜 지정 조회
    const usTradeDate = safeOpts.usTradeDateOverride || getLastUSTradingDate()
    const jpTradeDate = safeOpts.jpTradeDateOverride || getLastJPTradingDate()
    const hasNonUS = symbols.some((s) => !isUSSymbol(s))
    const allJP = symbols.every((s) => s?.toUpperCase().endsWith('.T'))

    if (!hasNonUS) {
      const dateUrl = `https://api.marketstack.com/${version}/eod/${usTradeDate}?${authQuery}symbols=${encodedSymbols}`
      try {
        const dateJson = await getJson(dateUrl, init)
        const dateRows = Array.isArray(dateJson?.data) ? dateJson.data : []
        if (dateRows.length > 0) {
          return { rows: dateRows, endpoint: `${version}:eod:${usTradeDate}:${authMode}` }
        }
      } catch (_) { /* fallback to latest */ }
    }

    if (allJP) {
      const jpDateUrl = `https://api.marketstack.com/${version}/eod/${jpTradeDate}?${authQuery}symbols=${encodedSymbols}&exchange=XTKS`
      try {
        const jpDateJson = await getJson(jpDateUrl, init)
        const jpDateRows = Array.isArray(jpDateJson?.data) ? jpDateJson.data : []
        if (jpDateRows.length > 0) {
          return { rows: jpDateRows, endpoint: `${version}:eod:${jpTradeDate}:XTKS:${authMode}` }
        }
      } catch (_) { /* fallback to latest */ }
    }

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

  // API v1 は廃止方向のため v2 のみ（https://api.marketstack.com/v2/...）
  const attempts = [
    { version: 'v2', authMode: 'query' },
    { version: 'v2', authMode: 'header' },
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
  // Default false: Vercel crons are daily: JP Fri close is ingested on Sat UTC runs.
  const onlyWeekdays = String(process.env.MARKETSTACK_WEEKDAYS_ONLY || 'false').toLowerCase() !== 'false'
  const skipIfAlreadyRanToday = String(process.env.MARKETSTACK_SKIP_IF_TODAY_SUCCESS || 'true').toLowerCase() !== 'false'
  const requestUrl = new URL(req.url || '/api/cron/marketstack-daily', 'http://localhost')
  const forceRun = parseBoolLike(requestUrl.searchParams.get('force'))
  const overrideSymbols = parseSymbols(requestUrl.searchParams.get('symbols') || '')
  const tradeDateOverride = requestUrl.searchParams.get('trade_date') || ''
  const jpEtfOnly = parseBoolLike(requestUrl.searchParams.get('jp_etf_only'))
  const jpOnly = parseBoolLike(requestUrl.searchParams.get('jp_only')) || jpEtfOnly
  const hasUsOnlyParam = requestUrl.searchParams.has('us_only')
  const usOnly = hasUsOnlyParam
    ? parseBoolLike(requestUrl.searchParams.get('us_only'))
    : String(process.env.MARKETSTACK_US_ONLY || 'true').toLowerCase() !== 'false'
  const runScope = jpEtfOnly ? 'jp_etf' : jpOnly ? 'jp' : usOnly ? 'us' : 'all'
  const monthlyBudgetRequests = parsePositiveInt(
    process.env.MARKETSTACK_MONTHLY_BUDGET_REQUESTS,
    10000
  )
  // usage 절약: 심볼 수 상한. 0이면 제한 없음. 데이터 유입 확인 전엔 100~200 권장
  const maxSymbolsPerRun = parsePositiveInt(process.env.MARKETSTACK_MAX_SYMBOLS, 0)

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
        reason: 'Weekend skip (MARKETSTACK_WEEKDAYS_ONLY is truthy)',
      })
    }

    // If a previous run was terminated unexpectedly, mark stale "started" jobs as failed
    // so they don't hide real failures in monitoring.
    const STALE_STARTED_MINUTES = 90
    const staleCutoff = new Date(Date.now() - STALE_STARTED_MINUTES * 60 * 1000).toISOString()
    const { data: staleJobs, error: staleJobsErr } = await supabase
      .from('ingestion_jobs')
      .select('id')
      .eq('source', 'marketstack')
      .eq('dataset', 'stock_daily_prices')
      .eq('status', 'started')
      .lt('started_at', staleCutoff)
      .limit(200)
    if (staleJobsErr) throw staleJobsErr
    const staleIds = (staleJobs || []).map((x) => x.id).filter(Boolean)
    if (staleIds.length > 0) {
      const { error: staleUpdateErr } = await supabase
        .from('ingestion_jobs')
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          error_message: `Marked failed by watchdog: stale started job exceeded ${STALE_STARTED_MINUTES} minutes without completion.`,
        })
        .in('id', staleIds)
      if (staleUpdateErr) throw staleUpdateErr
    }

    // 같은 scope(jp / us / all)에서만 최근 성공 시 스킵. US(00 UTC) 직후 JP(07 UTC=KST16)가 막히지 않게 함.
    const SKIP_IF_SUCCESS_WITHIN_HOURS = 8
    if (skipIfAlreadyRanToday && !forceRun) {
      const cutoff = new Date(Date.now() - SKIP_IF_SUCCESS_WITHIN_HOURS * 60 * 60 * 1000)
      const { data: recentJobs, error: recentJobErr } = await supabase
        .from('ingestion_jobs')
        .select('id,started_at,meta')
        .eq('source', 'marketstack')
        .eq('dataset', 'stock_daily_prices')
        .eq('status', 'success')
        .gte('started_at', cutoff.toISOString())
        .order('started_at', { ascending: false })
        .limit(25)
      if (recentJobErr) throw recentJobErr
      const recentHit = (recentJobs || []).find((j) => jobMetaMatchesRunScope(j.meta, runScope))
      if (recentHit) {
        return res.status(200).json({
          ok: true,
          skipped: true,
          reason: `Already succeeded (${runScope}) within ${SKIP_IF_SUCCESS_WITHIN_HOURS}h`,
          last_success_started_at: recentHit.started_at,
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
      // ETF는 자동 크론 수집 대상에서 제외한다.
      // (JP/US 개별주식만 수집)
    ])
    const tier2Symbols = uniqueSymbols(configuredTier2Symbols)
    const rawAllSymbols = overrideSymbols.length > 0 ? overrideSymbols : uniqueSymbols([...tier1Symbols, ...tier2Symbols])
    const isEU = (s) => /\.(PA|AS|DE|MI|MC|SW|BR|OL|HE|IR|CO|SE|ST|VX)$/i.test(s || '')
    const isUK = (s) => (s || '').endsWith('.L')
    const etfUpper = new Set(
      ETF_SYMBOLS_FROM_XLSX.map((s) => String(s || '').toUpperCase())
    )
    const allSymbols = rawAllSymbols
      .filter((s) => !MARKETSTACK_BLOCKLIST_EXPORT.has(s))
      .filter((s) => !etfUpper.has(String(s || '').toUpperCase()))
      .filter((s) => !MARKETSTACK_TEMP_BAD_SYMBOLS.has(String(s || '').toUpperCase()))
      .filter((s) => !isEU(s) && !isUK(s))

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
    const tier1Pool = tier1Symbols
      .filter((s) => !MARKETSTACK_BLOCKLIST_EXPORT.has(s))
      .filter((s) => !etfUpper.has(String(s || '').toUpperCase()))
      .filter((s) => !isEU(s) && !isUK(s))
    const etfUpperStatic = new Set(ETF_SYMBOLS_FROM_XLSX.map((s) => String(s).toUpperCase()))
    const jpTier1List = tier1Pool.filter((s) => (s || '').toUpperCase().endsWith('.T'))
    const jpEtfTier1List = jpTier1List.filter((s) => etfUpperStatic.has(String(s).toUpperCase()))
    const usTier1List = tier1Pool.filter((s) => isUSSymbol(s))
    const jpTier1Requests = estimateChunkCount(jpTier1List)
    const jpEtfTier1Requests = estimateChunkCount(jpEtfTier1List)
    const usTier1Requests = estimateChunkCount(usTier1List)

    let selectedSymbols = allSymbols
    let budgetMode = 'all_tiers'
    if (monthRemainingRequests < allSymbolsRequests) {
      if (monthRemainingRequests >= tier1Requests) {
        selectedSymbols = tier1Pool
        budgetMode = 'tier1_only'
      } else if (jpEtfOnly && monthRemainingRequests >= jpEtfTier1Requests) {
        selectedSymbols = jpEtfTier1List
        budgetMode = 'tier1_jp_etf_budget'
      } else if (jpOnly && monthRemainingRequests >= jpTier1Requests) {
        selectedSymbols = jpTier1List
        budgetMode = 'tier1_jp_budget'
      } else if (usOnly && monthRemainingRequests >= usTier1Requests) {
        selectedSymbols = usTier1List
        budgetMode = 'tier1_us_budget'
      } else {
        selectedSymbols = []
        budgetMode = 'budget_skip'
      }
    }
    // jp/us 필터는 MARKETSTACK_MAX_SYMBOLS 슬라이스보다 먼저 적용해야 함.
    // (슬라이스가 앞에 오면 tier1 앞쪽의 미국 심볼만 남고 .T 필터 후 ETF가 전부 빠질 수 있음)
    if (jpOnly) {
      selectedSymbols = selectedSymbols.filter((s) => (s || '').toUpperCase().endsWith('.T'))
      budgetMode = `${budgetMode}_jp_only`
      if (jpEtfOnly) {
        selectedSymbols = selectedSymbols.filter((s) => etfUpperStatic.has(String(s).toUpperCase()))
        budgetMode = `${budgetMode}_jp_etf`
      }
    } else if (usOnly) {
      selectedSymbols = selectedSymbols.filter((s) => isUSSymbol(s))
      budgetMode = `${budgetMode}_us_only`
    }
    // MARKETSTACK_MAX_SYMBOLS: 통합(비지역) 실행에만 적용. jp_only / us_only 크론은 지역 심볼 전부 수집.
    const regionDedicatedRun = jpOnly || usOnly
    if (!regionDedicatedRun && maxSymbolsPerRun > 0 && selectedSymbols.length > maxSymbolsPerRun) {
      selectedSymbols = selectedSymbols.slice(0, maxSymbolsPerRun)
      budgetMode = budgetMode === 'all_tiers' ? 'all_tiers_capped' : `${budgetMode}_capped`
    }

    const { data: startedJob, error: startedErr } = await supabase
      .from('ingestion_jobs')
      .insert([
        {
          source: 'marketstack',
          dataset: 'stock_daily_prices',
          status: 'started',
          meta: {
            scope: runScope,
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

    const fetchOpts = {}
    if (/^\d{4}-\d{2}-\d{2}$/.test(tradeDateOverride)) {
      fetchOpts.usTradeDateOverride = tradeDateOverride
      fetchOpts.jpTradeDateOverride = tradeDateOverride
    }
    const { rows, endpointStats, chunks } = await fetchMarketstackRows(
      marketstackKey,
      selectedSymbols,
      fetchOpts
    )
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

      // 종가는 시가/고가/저가로 보간하지 않음. API가 close 계열을 비우면 open으로 채워져
      // 「시가=종가인데 고저는 큰 폭」 같은 모순 OHLC가 DB에 남는 경우가 있음.
      const rawClose = pickReliableClose(r)
      const close = normalizePriceNumber(rawClose)
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
            scope: runScope,
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

