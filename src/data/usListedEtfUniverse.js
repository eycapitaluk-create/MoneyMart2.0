/**
 * 미국 상장 ETF 판정. iOS moneymart/USETFCatalog.swift 와 같은 목록·이름 규칙.
 * 검색·목록·배당 캘린더·보유 추가 후보에서 숨긴다.
 * 이미 보유 중인 행의 평가 표시는 그대로 둔다.
 *
 * US_LISTED_ETFS 10행은 주식 화면 ETF 그룹의 수수료·순자산 적재용이다.
 * 숨김 판정은 US_LISTED_ETF_SYMBOLS 와 isUsListedEtfSymbol 이다.
 */

export const US_LISTED_ETFS = [
  { symbol: 'VOO', category: '米国株式', country: 'US' },
  { symbol: 'QQQ', category: '米国株式', country: 'US' },
  { symbol: 'VTI', category: '米国株式', country: 'US' },
  { symbol: 'VT', category: '全世界株式', country: 'GLOBAL' },
  { symbol: 'VEA', category: '先進国株式', country: 'GLOBAL' },
  { symbol: 'VWO', category: '新興国株式', country: 'EM' },
  { symbol: 'VNQ', category: 'REIT', country: 'US' },
  { symbol: 'BND', category: '債券', country: 'US' },
  { symbol: 'LQD', category: '債券', country: 'US' },
  { symbol: 'IEF', category: '債券', country: 'US' },
]

const US_BOND = ['BND', 'AGG', 'BLV', 'TLT', 'IEF', 'LQD', 'VCIT', 'JPST', 'SHY', 'BIL', 'SGOV', 'HYG', 'EMB', 'TIP', 'BNDX', 'VGSH', 'VGIT', 'VGLT', 'GOVT', 'MUB', 'SCHZ', 'IEI', 'SPTL', 'VTIP', 'JNK', 'VCSH']
const US_REIT = ['VNQ', 'VNQI', 'IYR', 'XLRE', 'SCHH', 'RWR', 'REET']
const US_COMMODITY = ['GLD', 'IAU', 'SLV', 'USO', 'DBC', 'CPER', 'GLDM', 'PDBC', 'UNG', 'PPLT', 'SGOL']
const US_EQUITY = ['VOO', 'IVV', 'SPY', 'SPLG', 'VTI', 'ITOT', 'SCHB', 'SCHX', 'IWB', 'RSP', 'QQQ', 'QQQM', 'VUG', 'VTV', 'IWF', 'IWD', 'MGK', 'SCHG', 'IWM', 'IJH', 'IJR', 'MDY', 'VO', 'VB', 'DIA', 'OEF', 'VV', 'ARKK', 'ARKF', 'ARKG', 'ARKW', 'ARKQ', 'ESGU']
const US_DIVIDEND = ['VYM', 'SCHD', 'HDV', 'SPYD', 'VIG', 'DGRO', 'NOBL', 'DVY', 'SDY', 'FDVV', 'SPHD', 'JEPI', 'JEPQ', 'QYLD', 'XYLD', 'RYLD', 'DIVO']
const US_SECTOR = ['XLK', 'XLF', 'XLE', 'XLV', 'XLY', 'XLP', 'XLI', 'XLU', 'XLB', 'XLC', 'IYE', 'IYM', 'IYJ', 'IYC', 'IYK', 'IYH', 'IYF', 'IYW', 'IYZ', 'IDU', 'SMH', 'SOXX', 'XBI', 'IBB', 'XOP', 'GDX', 'GDXJ', 'KRE', 'XHB', 'ITA', 'VGT', 'VHT', 'VFH', 'ICLN', 'TAN', 'LIT', 'BOTZ', 'HACK', 'SKYY']
const GLOBAL = ['VT', 'ACWI', 'URTH', 'BNDW']
const DEVELOPED_EX_US = ['VEA', 'EFA', 'IEFA', 'VXUS', 'IXUS', 'SPDW', 'EFV', 'VGK', 'EZU']
const EMERGING = ['VWO', 'EEM', 'IEMG', 'SCHE', 'SPEM', 'MCHI', 'FXI', 'KWEB', 'INDA', 'EWZ', 'EWT', 'EWY', 'AAXJ']
const JAPAN_LISTED_IN_US = ['EWJ', 'DXJ', 'BBJP']
const LEVERAGED = ['TQQQ', 'SQQQ', 'SOXL', 'SOXS', 'SPXL', 'SPXS', 'UPRO', 'SPXU', 'TMF', 'TNA', 'TZA', 'SH', 'PSQ', 'UVXY', 'VIXY', 'LABU', 'FAS', 'TECL']
const CRYPTO = ['BITO', 'IBIT', 'FBTC', 'GBTC', 'ETHE', 'ETHA', 'BITB', 'ARKB']
const EXTRA_BOND = ['IAGG', 'EMLC', 'VWOB', 'HYD', 'VTEB', 'SHV', 'STIP', 'FLOT', 'MINT', 'IGSB', 'IGIB', 'VMBS', 'MBB', 'TLH', 'ZROZ', 'EDV', 'VCLT', 'PFF', 'BKLN', 'SRLN', 'USHY']
const EXTRA_COMMODITY = ['GSG', 'DBA', 'SIVR']

const COMPANY_ALLOW = new Set(['IVZ', 'NTRS', 'BLK', 'STT', 'CPT', 'DLR', 'ESS', 'FRT', 'VNO', 'BEN', 'TROW', 'SCHW'])

const ETF_NAME_RE = /\bETF\b|Index Fund|iShares|SPDR|ProShares|Direxion|Select Sector|Invesco QQQ|\bVanguard\b/i

export const US_LISTED_ETF_SYMBOLS = [...new Set([
  ...US_BOND,
  ...US_REIT,
  ...US_COMMODITY,
  ...US_EQUITY,
  ...US_DIVIDEND,
  ...US_SECTOR,
  ...GLOBAL,
  ...DEVELOPED_EX_US,
  ...EMERGING,
  ...JAPAN_LISTED_IN_US,
  ...LEVERAGED,
  ...CRYPTO,
  ...EXTRA_BOND,
  ...EXTRA_COMMODITY,
])]

const BY_SYMBOL = new Set(US_LISTED_ETF_SYMBOLS)

const normalizeUsTicker = (symbol = '') => {
  let s = String(symbol || '').trim().toUpperCase()
  if (s.endsWith('.US')) s = s.slice(0, -3)
  return s
}

const looksLikeUsTicker = (symbol) => {
  if (!symbol || symbol.length > 7 || symbol.endsWith('.T')) return false
  return /^[A-Z][A-Z.-]*$/.test(symbol)
}

/** 심볼 목록 우선. 없으면 미국 티커 형태의 상품명으로 판정. IVZ·BLK·STT 등 운용사는 제외. */
export const isUsListedEtfSymbol = (symbol, name = '') => {
  const s = normalizeUsTicker(symbol)
  if (!looksLikeUsTicker(s)) return false
  if (BY_SYMBOL.has(s)) return true
  if (COMPANY_ALLOW.has(s)) return false
  const label = String(name || '').trim()
  if (!label) return false
  return ETF_NAME_RE.test(label)
}
