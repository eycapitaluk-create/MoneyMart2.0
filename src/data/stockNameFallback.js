import { getStockPageNameJa } from './stockPageDisplayNameJa.js'
import { normalizeStockSymbolForDb } from '../lib/stockSymbolNormalize.js'

/**
 * Client-side fallback for stock names when stock_symbol_profiles / stock_symbols lack name_jp/name_en
 * Used when DB has no company name to avoid showing only ticker code
 */

/** Override DB display names when DB has wrong/misleading data */
export const DISPLAY_NAME_OVERRIDE = new Map([
  ['DAY', 'デイフォース / Dayforce'], // Ceridian rebranded to Dayforce 2024, ticker CDAY→DAY
])

export const STOCK_NAME_FALLBACK = new Map([
  ['AAPL', 'Apple'], ['MSFT', 'Microsoft'], ['NVDA', 'NVIDIA'], ['AMZN', 'Amazon'], ['META', 'Meta'],
  ['GOOGL', 'Alphabet'], ['GOOG', 'Alphabet'], ['TSLA', 'Tesla'], ['AVGO', 'Broadcom'], ['AMD', 'AMD'],
  ['ORCL', 'Oracle'], ['NFLX', 'Netflix'], ['CRM', 'Salesforce'], ['ADBE', 'Adobe'], ['INTC', 'Intel'],
  ['QCOM', 'Qualcomm'], ['TXN', 'Texas Instruments'], ['MU', 'マイクロン・テクノロジー / Micron Technology Inc.'], ['CSCO', 'Cisco'], ['IBM', 'IBM'],
  ['JPM', 'JPMorgan Chase'], ['GS', 'Goldman Sachs'], ['MS', 'Morgan Stanley'], ['BAC', 'Bank of America'],
  ['WFC', 'Wells Fargo'], ['C', 'Citigroup'], ['BLK', 'BlackRock'], ['V', 'Visa'], ['MA', 'Mastercard'],
  ['XOM', 'Exxon Mobil'], ['CVX', 'Chevron'], ['COP', 'ConocoPhillips'], ['WMT', 'Walmart'],
  ['COST', 'Costco'], ['HD', 'Home Depot'], ['MCD', "McDonald's"], ['KO', 'Coca-Cola'], ['PEP', 'PepsiCo'],
  ['JNJ', 'Johnson & Johnson'], ['PFE', 'Pfizer'], ['MRK', 'Merck'], ['UNH', 'UnitedHealth'],
  ['HCA', 'HCA Healthcare'],
  ['ABBV', 'AbbVie'], ['LLY', 'Eli Lilly'], ['TMO', 'Thermo Fisher'], ['ABT', 'Abbott'], ['DHR', 'Danaher'],
  ['CAT', 'Caterpillar'], ['GE', 'General Electric'], ['GEV', 'ジーイー・ヴァーノヴァ / GE Vernova LLC'], ['DE', 'Deere'], ['HON', 'Honeywell'],
  ['LMT', 'Lockheed Martin'], ['RTX', 'RTX'], ['NOC', 'Northrop Grumman'], ['BA', 'Boeing'],
  ['ASML', 'ASML'], ['NVO', 'Novo Nordisk'], ['SAP', 'SAP'], ['SHEL', 'Shell'], ['HSBC', 'HSBC'],
  ['BP', 'BP'], ['RIO', 'Rio Tinto'], ['AZN', 'AstraZeneca'],
  ['BRK.B', 'バークシャー・ハサウェイ（B株） / Berkshire Hathaway Inc.'],
  ['BRK-B', 'バークシャー・ハサウェイ（B株） / Berkshire Hathaway Inc.'],
  ['NOW', 'ServiceNow'], ['LOW', "Lowe's"], ['SO', 'Southern Company'], ['ITW', 'Illinois Tool Works'],
  ['MCK', 'McKesson'], ['USB', 'U.S. Bancorp'], ['MOS', 'Mosaic'], ['WDC', 'Western Digital'],
  ['ULTA', 'Ulta Beauty'], ['CE', 'Celanese'], ['CF', 'CF Industries'], ['FICO', 'Fair Isaac'],
  ['CNC', 'Centene'], ['CPB', 'Campbell Soup'], ['CAG', 'Conagra Brands'],
  ['CI', 'Cigna'], ['SLB', 'Schlumberger'], ['BDX', 'Becton Dickinson'], ['EOG', 'EOG Resources'],
  ['PANW', 'Palo Alto Networks'], ['KLAC', 'KLA'], ['SNPS', 'Synopsys'], ['ZTS', 'Zoetis'],
  ['MO', 'Altria'], ['TJX', 'TJX Companies'],
  ['BKNG', 'ブッキング・ホールディングス / Booking Holdings Inc.'],
  ['ISRG', 'Intuitive Surgical'],
  ['SYK', 'Stryker'], ['AXP', 'American Express'], ['PLD', 'Prologis'], ['ELV', 'Elevance Health'],
  // DBに和名が無い銘柄: ウォッチリストでも「和 / 英」と揃える
  ['VRT', 'バーティブ / Vertiv Holdings'],
  ['CHRW', 'C.H.ロビンソン・ワールドワイド / C.H. Robinson Worldwide'],
  ['ADI', 'Analog Devices'], ['MDLZ', 'Mondelez'], ['REGN', 'Regeneron'],
  ['MMC', 'マーシュ・アンド・マックレナン / Marsh & McLennan Companies Inc.'],
  ['MRSH', 'マーシュ・アンド・マックレナン / Marsh & McLennan Companies Inc.'],
  ['NBIS', 'ネビウス / Nebius Group N.V.'],
  ['APO', 'アポロ・グローバル・マネジメント / Apollo Global Management Inc.'],
  ['ALAB', 'アステラ・ラボズ / Astera Labs, Inc.'],
  ['APP', 'アプラヴィン / AppLovin Corp.'],
  ['ARES', 'アレス・マネジメント / Ares Management Corp.'],
  ['BF-B', 'ブラウン・フォーマン / Brown-Forman Corp.'],
  ['BNY', 'ニューヨーク・メロン銀行 / Bank of New York Mellon Corp.'],
  ['BXP', 'ボストン・プロパティーズ / BXP Inc.'],
  ['CASY', 'ケイシーズ・ジェネラル・ストアーズ / Casey\'s General Stores Inc.'],
  ['CIEN', 'シエナ / Ciena Corp.'],
  ['CNP', 'センターポイント・エナジー / CenterPoint Energy Inc.'],
  ['COHR', 'コヒレント / Coherent Corp.'],
  ['COIN', 'コインベース・グローバル / Coinbase Global Inc.'],
  ['CRWV', 'コアウィーブ / CoreWeave, Inc.'],
  ['CRH', 'シー・アール・エイチ / CRH PLC'],
  ['CVNA', 'カーバナ / Carvana Co.'],
  ['DELL', 'デル・テクノロジーズ / Dell Technologies Inc.'],
  ['EME', 'エムコア・グループ / EMCOR Group Inc.'],
  ['ERIE', 'エリー・インデミニティ / Erie Indemnity Co.'],
  ['EXE', 'エキスパンド・エナジー / Expand Energy Corp.'],
  ['FLEX', 'フレックス / Flex Ltd.'],
  ['FISV', 'ファイサーヴ / Fiserv Inc.'],
  ['FIX', 'コンフォート・システムズUSA / Comfort Systems USA Inc.'],
  ['GDDY', 'ゴーダディ / GoDaddy Inc.'],
  ['GL', 'グローブ・ライフ / Globe Life Inc.'],
  ['GPN', 'グローバル・ペイメンツ / Global Payments Inc.'],
  ['HOOD', 'ロビンフッド・マーケッツ / Robinhood Markets Inc.'],
  ['IBKR', 'インタラクティブ・ブローカーズ / Interactive Brokers Group Inc.'],
  ['KKR', 'KKR / KKR & Co. Inc.'],
  ['LII', 'レノックス・インターナショナル / Lennox International Inc.'],
  ['LITE', 'ルメンタム・ホールディングス / Lumentum Holdings Inc.'],
  ['PLTR', 'パランティア・テクノロジーズ / Palantir Technologies Inc.'],
  ['PSKY', 'パラマウント・スカイダンス / Paramount Skydance Corp.'],
  ['Q', 'キュニティ・エレクトロニクス / Qnity Electronics Inc.'],
  ['RKLB', 'ロケット・ラボ / Rocket Lab USA, Inc.'],
  ['SATS', 'エコースター / EchoStar Corp.'],
  ['SKHY', 'SKハイニックス / SK hynix Inc.'],
  ['SNDK', 'サンディスク / Sandisk Corp.'],
  ['SPCX', 'スペースX / Space Exploration Technologies Corp.'],
  ['TKO', 'TKOグループ・ホールディングス / TKO Group Holdings Inc.'],
  ['TPL', 'テキサス・パシフィック・ランド / Texas Pacific Land Corp.'],
  ['TTD', 'トレード・デスク / The Trade Desk Inc.'],
  ['TXT', 'テクトロン / Textron Inc.'],
  ['VEEV', 'ヴィーヴァ・システムズ / Veeva Systems Inc.'],
  ['WSM', 'ウィリアムズ・ソノマ / Williams-Sonoma Inc.'],
  ['XYZ', 'ブロック（スクエア） / Block Inc.'],
  ['285A.T', 'キオクシアホールディングス / KIOXIA Holdings Corporation'],
  ['6976.T', '太陽誘電 / Taiyo Yuden Co., Ltd.'],
  ['4062.T', 'イビデン / Ibiden Co., Ltd.'],
  ['5706.T', '三井金属鉱業 / Mitsui Mining & Smelting Co., Ltd.'],
  ['6963.T', 'ローム / Rohm Co., Ltd.'],
  // 銘柄一覧・5営業日 Top movers などで和英併記を揃える（DB に name_jp が無い米国株）
  ['SMCI', 'スーパー・マイクロ・コンピュータ / Super Micro Computer Inc.'],
  ['DVA', 'ダヴィータ / DaVita Inc.'],
  ['TEAM', 'アトラシアン / Atlassian Corp.'],
  ['CDW', 'シーディーダブリュー / CDW Corp.'],
  ['COR', 'センコラ / Cencora Inc.'],
  ['WTW', 'ウィリス・タワーズ・ワトソン / Willis Towers Watson Public Ltd. Co.'],
  ['ANET', 'アリスタ・ネットワークス / Arista Networks Inc.'],
  ['HII', 'ハンティントン・インガルズ・インダストリーズ / Huntington Ingalls Industries Inc.'],
  ['GILD', 'Gilead'], ['CVS', 'CVS Health'], ['LIN', 'Linde'], ['ACN', 'Accenture'], ['NEE', 'NextEra Energy'],
  ['PM', 'Philip Morris'], ['INTU', 'Intuit'], ['AMGN', 'Amgen'], ['SPGI', 'S&P Global'],
])

/** Yahoo表記のスラッシュ等 → DBキー（BF/B→BF-B、BRK/B→BRK.B、BK→BNY） */
export const normalizeFallbackSymbolKey = (symbol) => normalizeStockSymbolForDb(symbol)

export const getStockNameFallback = (symbol) => {
  if (!symbol) return null
  const key = normalizeFallbackSymbolKey(symbol)
  return STOCK_NAME_FALLBACK.get(key) || STOCK_NAME_FALLBACK.get(String(symbol).trim().toUpperCase()) || null
}

const HAS_JA = /[\u3040-\u30ff\u3400-\u9fff]/

/**
 * 配当マスター・DB の英語正式名より、`STOCK_NAME_FALLBACK` の和英併記を優先する。
 * フォールバックが短い英語のみのときは masterName を優先（例: AAPL → 「Apple Inc.」）。
 */
export const resolveStockDisplayNameJaEn = (symbol, masterName = '') => {
  const m = String(masterName || '').trim()
  if (!symbol) return m
  const key = normalizeFallbackSymbolKey(symbol)
  const fb = STOCK_NAME_FALLBACK.get(key) || STOCK_NAME_FALLBACK.get(String(symbol).trim().toUpperCase())
  if (!fb) return m
  const f = String(fb).trim()
  if (f.includes(' / ') || HAS_JA.test(f)) return f
  return m || f
}

/**
 * 一覧・ランキング用。DB の name_jp/name_en を優先し、無いときは resolve + CLIENT_FALLBACK で和英併記に寄せる。
 */
const pickStockEnglishLabel = (stock, code) => {
  const en = String(stock?.name_en ?? '').trim()
  if (en && en.toUpperCase() !== code) return en
  const industry = String(stock?.industry ?? '').trim()
  if (industry && industry.toUpperCase() !== code && /[A-Za-z]/.test(industry)) return industry
  const merged = String(stock?.name ?? '').trim()
  if (merged && merged.toUpperCase() !== code) return merged
  return ''
}

export const formatStockJaEnListLabel = (stock) => {
  const code = String(stock?.code ?? stock?.id ?? '').trim()
  if (!code) return String(stock?.name ?? '').trim()
  const override = getDisplayNameOverride(code)
  if (override) return override
  const jp = String(stock?.name_jp ?? '').trim() || getStockPageNameJa(code)
  const en = pickStockEnglishLabel(stock, code)
  if (jp && en) return `${jp} / ${en}`
  const profileJoined = [jp, en].filter(Boolean).join(' / ')
  const mergedName = String(stock?.name ?? '').trim()
  const resolved = resolveStockDisplayNameJaEn(code, profileJoined || mergedName)
  if (HAS_JA.test(resolved) || resolved.includes(' / ')) return resolved
  return mergedName || resolved || code
}

export const getDisplayNameOverride = (symbol) => {
  if (!symbol) return null
  const key = normalizeFallbackSymbolKey(symbol)
  return DISPLAY_NAME_OVERRIDE.get(key) || DISPLAY_NAME_OVERRIDE.get(String(symbol).trim().toUpperCase()) || null
}

const pickJapaneseLabelPart = (text) => {
  const s = String(text || '').trim()
  if (!s) return ''
  if (s.includes(' / ')) return s.split(' / ')[0].trim()
  return HAS_JA.test(s) ? s : ''
}

/** ヒートマップの小さいタイル向けに社名を短縮（例: トヨタ自動車 → トヨタ） */
export const abbreviateHeatmapJaLabel = (name, maxChars = 8) => {
  let s = String(name || '').trim()
  if (!s) return ''
  s = s
    .replace(/株式会社/g, '')
    .replace(/ホールディングス/g, 'HD')
    .replace(/グループ/g, 'G')
    .replace(/（株）|\(株\)/g, '')
    .replace(/\s+/g, '')
    .trim()
  if (s.length <= maxChars) return s
  return `${s.slice(0, Math.max(1, maxChars - 1))}…`
}

/** ヒートマップタイル用。ティッカーではなく日本語社名を優先 */
export const formatStockHeatmapLabel = ({ symbol, stock, rowName, region } = {}) => {
  const code = String(symbol || '').trim()
  if (!code) return ''

  const fromOverride = pickJapaneseLabelPart(getDisplayNameOverride(code))
  if (fromOverride) return fromOverride

  const jpFromStock = String(stock?.name_jp ?? '').trim()
  const jpPage = getStockPageNameJa(code)
  if (jpFromStock) return jpFromStock
  if (jpPage) return jpPage

  const row = String(rowName || '').trim()
  const fromRow = pickJapaneseLabelPart(row)
  if (fromRow) return fromRow

  if (stock) {
    const fromList = pickJapaneseLabelPart(formatStockJaEnListLabel(stock))
    if (fromList) return fromList
  }

  const resolved = pickJapaneseLabelPart(resolveStockDisplayNameJaEn(code, row || stock?.name || ''))
  if (resolved) return resolved

  if (String(region || '').toUpperCase() === 'JP' && row && row.toUpperCase() !== code.toUpperCase()) return row

  const merged = String(stock?.name ?? row ?? '').trim()
  if (merged && merged.toUpperCase() !== code.toUpperCase()) return merged
  return code
}
