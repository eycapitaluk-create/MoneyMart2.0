/**
 * dividendStockUniverse + mockStocks에서 회사명 추출 → stock_symbols 업데이트
 * Marketstack API 없이 로컬 데이터로 회사명 복원
 */
import fs from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_ENV_FILES = ['.env.local', '.env']

const stripQuotes = (v = '') => {
  const t = String(v || '').trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))
    return t.slice(1, -1)
  return t
}

const loadEnv = async () => {
  for (const f of DEFAULT_ENV_FILES) {
    try {
      const raw = await fs.readFile(f, 'utf8')
      for (const line of raw.split(/\r?\n/)) {
        const t = line.trim()
        if (!t || t.startsWith('#') || !t.includes('=')) continue
        const eq = t.indexOf('=')
        const k = t.slice(0, eq).trim()
        const v = stripQuotes(t.slice(eq + 1))
        if (k && !process.env[k]) process.env[k] = v
      }
    } catch {}
  }
}

const run = async () => {
  await loadEnv()
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const dryRun = process.argv.includes('--dry-run')

  if (!url || !key) throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')

  const { DIVIDEND_STOCK_UNIVERSE } = await import('../src/data/dividendStockUniverse.js')

  const nameMap = new Map()
  for (const row of DIVIDEND_STOCK_UNIVERSE || []) {
    const sym = (row?.symbol || '').trim().toUpperCase()
    const name = (row?.name || '').trim()
    if (sym && name && name !== sym) nameMap.set(sym, name)
  }

  const usNames = {
    AAPL: 'Apple', MSFT: 'Microsoft', NVDA: 'NVIDIA', AMZN: 'Amazon', META: 'Meta',
    GOOGL: 'Alphabet', GOOG: 'Alphabet', TSLA: 'Tesla', AVGO: 'Broadcom', AMD: 'AMD',
    ORCL: 'Oracle', NFLX: 'Netflix', CRM: 'Salesforce', ADBE: 'Adobe', INTC: 'Intel',
    QCOM: 'Qualcomm', TXN: 'Texas Instruments', MU: 'Micron', CSCO: 'Cisco', IBM: 'IBM',
    JPM: 'JPMorgan Chase', GS: 'Goldman Sachs', MS: 'Morgan Stanley', BAC: 'Bank of America',
    WFC: 'Wells Fargo', C: 'Citigroup', BLK: 'BlackRock', V: 'Visa', MA: 'Mastercard',
    XOM: 'Exxon Mobil', CVX: 'Chevron', COP: 'ConocoPhillips', WMT: 'Walmart',
    COST: 'Costco', HD: 'Home Depot', MCD: "McDonald's", KO: 'Coca-Cola', PEP: 'PepsiCo',
    JNJ: 'Johnson & Johnson', PFE: 'Pfizer', MRK: 'Merck', UNH: 'UnitedHealth',
    ABBV: 'AbbVie', LLY: 'Eli Lilly', TMO: 'Thermo Fisher', ABT: 'Abbott', DHR: 'Danaher',
    CAT: 'Caterpillar', GE: 'General Electric', DE: 'Deere', HON: 'Honeywell',
    LMT: 'Lockheed Martin', RTX: 'RTX', NOC: 'Northrop Grumman', BA: 'Boeing',
    ASML: 'ASML', NVO: 'Novo Nordisk', SAP: 'SAP', SHEL: 'Shell', HSBC: 'HSBC',
    BP: 'BP', RIO: 'Rio Tinto', AZN: 'AstraZeneca', BRK: 'Berkshire Hathaway',
  }
  for (const [sym, name] of Object.entries(usNames)) {
    const s = sym.replace('BRK.B', 'BRK.B').replace('BRK-B', 'BRK.B')
    nameMap.set(s, name)
  }
  nameMap.set('BRK.B', 'Berkshire Hathaway')
  nameMap.set('BRK-B', 'Berkshire Hathaway')

  console.log(`Name map: ${nameMap.size} entries`)

  const supabase = createClient(url, key)
  const { data: rows } = await supabase.from('stock_symbols').select('symbol,name')
  const needsUpdate = (rows || []).filter(
    (r) => r.symbol && (!r.name || r.name.trim() === r.symbol) && nameMap.has(r.symbol.toUpperCase())
  )

  console.log(`Symbols to update: ${needsUpdate.length}`)

  if (dryRun) {
    console.log('Dry run. Sample:', needsUpdate.slice(0, 5).map((r) => ({ symbol: r.symbol, name: nameMap.get(r.symbol.toUpperCase()) })))
    return
  }

  let updated = 0
  for (const r of needsUpdate) {
    const name = nameMap.get(r.symbol.toUpperCase())
    const { error } = await supabase.from('stock_symbols').update({ name }).eq('symbol', r.symbol)
    if (!error) updated += 1
  }
  console.log(`Updated ${updated}/${needsUpdate.length} stock_symbols.name`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
