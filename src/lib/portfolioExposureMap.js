/**
 * Portfolio ↔ News Exposure Mapping (rule-based).
 * Scores = how much of YOUR holdings touch a market factor — not price direction.
 * Never emit buy/sell or “will fall” language from this module.
 */

import { normalizeSectorName } from './stockSectorNormalize.js'
import {
  isTrueCommodityName,
  isEquityFinancialSectorName,
  normalizeDbCountryToken,
} from './fundSubcategoryHeuristics.js'

/** @typedef {'HIGH'|'MEDIUM'|'LOW'|'NONE'} ExposureLevel */

export const EXPOSURE_LEVEL_META = {
  HIGH: { id: 'HIGH', labelJa: '高', color: 'red', hintJa: '保有資産の露出が大きい要因' },
  MEDIUM: { id: 'MEDIUM', labelJa: '中', color: 'orange', hintJa: '保有資産の一部が関連' },
  LOW: { id: 'LOW', labelJa: '低', color: 'emerald', hintJa: '関連はあるが保有比率は小さめ' },
  NONE: { id: 'NONE', labelJa: '—', color: 'slate', hintJa: '保有との直接関連は検出されず' },
}

/** Score = share of portfolio value touching the factor (not price direction). */
export const EXPOSURE_SCORE_THRESHOLDS = {
  HIGH_MIN_PCT: 25,
  MEDIUM_MIN_PCT: 10,
  LOW_MIN_PCT: 0.5,
  definitionJa: [
    '関連度は「その市場要因に触れている保有の割合」です。',
    '高：露出 25%以上（またはニュース銘柄を保有）',
    '中：露出 10%以上〜25%未満',
    '低：露出 0.5%超〜10%未満',
    '価格の上下予測・売買の勧誘ではありません。',
  ],
}

/** Market factors that news can be tagged with */
export const MARKET_FACTORS = {
  US_RATE: {
    id: 'US_RATE',
    labelJa: '米国金利',
    emoji: '🇺🇸',
    pathJa: ['米国金利', '長期金利', '成長株のバリュエーション', 'あなたの米国・テック等の保有'],
  },
  BOJ_RATE: {
    id: 'BOJ_RATE',
    labelJa: '日銀金利',
    emoji: '🇯🇵',
    pathJa: ['日銀金利', '円相場', '日本株・円建て資産', 'あなたの保有資産'],
  },
  JPY: {
    id: 'JPY',
    labelJa: '円',
    emoji: '💴',
    pathJa: ['円相場', '日本株・輸出関連', '円建て資産', 'あなたの保有'],
  },
  USD: {
    id: 'USD',
    labelJa: 'ドル',
    emoji: '💵',
    pathJa: ['ドル相場', '米国資産の円換算', 'あなたのドル建て保有'],
  },
  OIL: {
    id: 'OIL',
    labelJa: '原油',
    emoji: '🛢️',
    pathJa: ['原油', 'エネルギー・輸送', 'インフレ感応資産', 'あなたの関連保有'],
  },
  US_EQUITY: {
    id: 'US_EQUITY',
    labelJa: '米国株',
    emoji: '🇺🇸',
    pathJa: ['米国株式市場', 'あなたの米国株・米国株ファンド'],
  },
  JP_EQUITY: {
    id: 'JP_EQUITY',
    labelJa: '日本株',
    emoji: '🇯🇵',
    pathJa: ['日本株式市場', 'あなたの日本株・国内ファンド'],
  },
  TECH: {
    id: 'TECH',
    labelJa: 'テクノロジー',
    emoji: '💻',
    pathJa: ['テック・半導体テーマ', 'あなたのテクノロジー関連保有'],
  },
  FINANCIALS: {
    id: 'FINANCIALS',
    labelJa: '金融',
    emoji: '🏦',
    pathJa: ['金融セクター', 'あなたの金融関連保有'],
  },
  ENERGY: {
    id: 'ENERGY',
    labelJa: 'エネルギー',
    emoji: '⚡',
    pathJa: ['エネルギーセクター', 'あなたのエネルギー関連保有'],
  },
}

/**
 * Factor → portfolio exposure tags (weights are relative match strength).
 * Tags are produced by classifyHolding().
 */
export const FACTOR_TO_EXPOSURE_TAGS = {
  US_RATE: [
    { tag: 'us_bond', w: 1.4 },
    { tag: 'technology', w: 1.25 },
    { tag: 'us_equity', w: 1.0 },
    { tag: 'us_growth', w: 1.2 },
    { tag: 'usd', w: 0.45 },
  ],
  BOJ_RATE: [
    { tag: 'jp_equity', w: 1.2 },
    { tag: 'jpy', w: 1.1 },
    { tag: 'financials', w: 1.15 },
    { tag: 'jp_exporters', w: 0.9 },
  ],
  JPY: [
    { tag: 'jpy', w: 1.3 },
    { tag: 'jp_equity', w: 1.0 },
    { tag: 'jp_exporters', w: 1.1 },
  ],
  USD: [
    { tag: 'usd', w: 1.3 },
    { tag: 'us_equity', w: 0.9 },
    { tag: 'us_bond', w: 0.8 },
  ],
  OIL: [
    { tag: 'energy', w: 1.4 },
    { tag: 'commodity', w: 1.2 },
    { tag: 'transport', w: 0.9 },
  ],
  US_EQUITY: [{ tag: 'us_equity', w: 1.3 }, { tag: 'usd', w: 0.4 }],
  JP_EQUITY: [{ tag: 'jp_equity', w: 1.3 }, { tag: 'jpy', w: 0.4 }],
  TECH: [{ tag: 'technology', w: 1.4 }, { tag: 'us_growth', w: 0.8 }],
  FINANCIALS: [{ tag: 'financials', w: 1.4 }],
  ENERGY: [{ tag: 'energy', w: 1.4 }, { tag: 'commodity', w: 0.8 }],
}

const FACTOR_KEYWORD_RULES = [
  {
    id: 'US_RATE',
    re: /米国(?:10年|長期)?債|米10年|米長期金利|FOMC|FRB|Fed\b|米国?\s*利上げ|米国?\s*利下げ|イールドカーブ|treasury|Treasur|US\s*rates?|federal\s*funds|米政策金利/i,
  },
  {
    id: 'BOJ_RATE',
    re: /日銀|日本銀行|BOJ|マイナス金利|YCC|金融政策決定会合|日銀.*金利|金利.*日銀/i,
  },
  {
    id: 'JPY',
    re: /円安|円高|ドル円|USD\/JPY|為替|円相場/i,
  },
  {
    id: 'USD',
    re: /ドル高|ドル安|米ドル|USD\b(?!\/JPY)/i,
  },
  {
    id: 'OIL',
    re: /原油|WTI|ブレント|BRENT|石油|OPEC/i,
  },
  {
    id: 'TECH',
    re: /半導体|ハイテク|テクノロジー|Nasdaq|ナスダック|Magnificent|AI\s*関連|GPU|エヌビディア|NVIDIA/i,
  },
  {
    id: 'FINANCIALS',
    re: /銀行株|金融株|金融セクター|メガバンク|地銀/i,
  },
  {
    id: 'ENERGY',
    re: /エネルギー株|石油株|ガス株/i,
  },
  {
    id: 'US_EQUITY',
    re: /米国株|S&P\s*500|ダウ|NYダウ|ウォール街|ウォール・ストリート/i,
  },
  {
    id: 'JP_EQUITY',
    re: /日本株|日経平均|日経225|TOPIX|東証/i,
  },
]

const TECH_SECTOR_RE = /テクノロジ|technology|tech|半導体|software|情報・通信|コミュニケーション/i
const FIN_SECTOR_RE = /金融|financ|bank|保険/i
const ENERGY_SECTOR_RE = /エネルギー|energy|原油|石油|ガス/i
const BOND_RE = /債|bond|fixed\s*income|国債|社債/i
const REIT_RE = /reit|リート|不動産/i
const TRANSPORT_RE = /航空|運輸|輸送|airline|transport/i

function isJpSymbol(symbol = '') {
  const s = String(symbol || '').toUpperCase()
  return /\.T$/.test(s) || /^\d{4}A?$/.test(s)
}

function isUsLikeSymbol(symbol = '') {
  const s = String(symbol || '').toUpperCase()
  if (!s || isJpSymbol(s)) return false
  if (/\.(L|DE|PA|HK)$/.test(s)) return false
  return /^[A-Z]{1,5}$/.test(s) || /\.US$/.test(s)
}

/**
 * Classify one holding into exposure tags + display fields.
 * @param {{ symbol?:string,name?:string,valueJpy?:number,sector?:string,region?:string,assetClass?:string,kind?:string}} h
 */
export function classifyHolding(h = {}) {
  const symbol = String(h.symbol || h.ticker || '').trim().toUpperCase()
  const name = String(h.name || '').trim()
  const valueJpy = Math.max(0, Number(h.valueJpy ?? h.value ?? 0) || 0)
  const sectorRaw = normalizeSectorName(h.sector || '')
  const nameU = name.normalize('NFKC').toUpperCase()
  const tags = new Set()

  let region = String(h.region || '').toUpperCase()
  if (!region) {
    if (isJpSymbol(symbol)) region = 'JP'
    else if (isUsLikeSymbol(symbol)) region = 'US'
    else {
      const cc = normalizeDbCountryToken(h.country || '')
      if (cc === 'JP') region = 'JP'
      else if (cc === 'US') region = 'US'
      else if (cc) region = 'GLOBAL'
      else region = isJpSymbol(symbol) ? 'JP' : 'US'
    }
  }

  const looksBond = BOND_RE.test(name) || BOND_RE.test(sectorRaw) || String(h.assetClass || '').toLowerCase() === 'bond'
  const looksReit = REIT_RE.test(name) || REIT_RE.test(sectorRaw)
  const looksCommodity = isTrueCommodityName(nameU) || /commodity|コモディティ|金ETF|銀ETF/i.test(name)
  const looksFin = isEquityFinancialSectorName(nameU, name) || FIN_SECTOR_RE.test(sectorRaw)
  const looksTech = TECH_SECTOR_RE.test(sectorRaw) || TECH_SECTOR_RE.test(name)
  const looksEnergy = ENERGY_SECTOR_RE.test(sectorRaw) || ENERGY_SECTOR_RE.test(name)
  const looksTransport = TRANSPORT_RE.test(name) || TRANSPORT_RE.test(sectorRaw)

  if (region === 'JP' || isJpSymbol(symbol)) {
    tags.add('jpy')
    if (!looksBond && !looksCommodity) tags.add('jp_equity')
    if (/輸出|自動車|機械|電機|精密/i.test(name) || /資本財|一般消費財/i.test(sectorRaw)) tags.add('jp_exporters')
  }
  if (region === 'US' || isUsLikeSymbol(symbol) || /米国|アメリカ|S&P|NASDAQ|ナスダック/i.test(name)) {
    tags.add('usd')
    if (!looksBond && !looksCommodity) tags.add('us_equity')
  }
  if (region === 'GLOBAL' || /全世界|オール.?カントリー|ACWI|グローバル/i.test(name)) {
    if (!looksBond && !looksCommodity) {
      tags.add('us_equity')
      tags.add('usd')
    }
  }

  if (looksBond) {
    if (region === 'JP') tags.add('jpy')
    else tags.add('us_bond')
    tags.add(region === 'JP' ? 'jpy' : 'usd')
  }
  if (looksReit) tags.add('reit')
  if (looksCommodity) tags.add('commodity')
  if (looksFin) tags.add('financials')
  if (looksTech) {
    tags.add('technology')
    tags.add('us_growth')
  }
  if (looksEnergy) tags.add('energy')
  if (looksTransport) tags.add('transport')

  // Nasdaq / growth fund heuristics
  if (/NASDAQ|ナスダック|QQQ|テック|ハイテク|成長/i.test(name)) {
    tags.add('technology')
    tags.add('us_growth')
    tags.add('us_equity')
    tags.add('usd')
  }

  if (tags.size === 0) {
    if (region === 'JP') tags.add('jp_equity')
    else tags.add('us_equity')
  }

  return {
    symbol,
    name: name || symbol,
    valueJpy,
    region,
    sector: sectorRaw || 'その他',
    tags: [...tags],
  }
}

/**
 * Aggregate portfolio exposure weights (0–100) by tag.
 * @param {Array} holdings
 */
export function buildExposureProfile(holdings = []) {
  const classified = (Array.isArray(holdings) ? holdings : [])
    .map(classifyHolding)
    .filter((h) => h.valueJpy > 0 && h.symbol)

  const total = classified.reduce((s, h) => s + h.valueJpy, 0)
  const byTag = {}
  const byRegion = { US: 0, JP: 0, GLOBAL: 0, OTHER: 0 }
  const bySector = {}

  for (const h of classified) {
    const w = total > 0 ? (h.valueJpy / total) * 100 : 0
    const regionKey = h.region === 'US' || h.region === 'JP' || h.region === 'GLOBAL' ? h.region : 'OTHER'
    byRegion[regionKey] = (byRegion[regionKey] || 0) + w
    const sec = h.sector || 'その他'
    bySector[sec] = (bySector[sec] || 0) + w
    for (const tag of h.tags) {
      byTag[tag] = (byTag[tag] || 0) + w
    }
  }

  return {
    totalValueJpy: total,
    holdings: classified,
    byTag,
    byRegion,
    bySector,
    empty: classified.length === 0 || total <= 0,
  }
}

/**
 * Detect market factors from news fields (rule-based only).
 */
export function detectNewsFactors(news = {}) {
  const text = [
    news.headline,
    news.title,
    news.summary,
    news.description,
    news.analysis,
    news.impact,
    news.sector,
    news.topic,
    ...(Array.isArray(news.keywords) ? news.keywords : []),
  ]
    .map((s) => String(s || ''))
    .join(' ')

  const found = new Set()
  for (const rule of FACTOR_KEYWORD_RULES) {
    if (rule.re.test(text)) found.add(rule.id)
  }
  // Disambiguate: BOJ news should not also count as US_RATE from generic rate words
  if (found.has('BOJ_RATE')) found.delete('US_RATE')
  if (/日銀|日本銀行|BOJ/.test(text) && /利上げ|利下げ|政策金利/.test(text)) {
    found.add('BOJ_RATE')
    found.delete('US_RATE')
  }

  const market = String(news.market || news.market_region || '').toLowerCase()
  if (market === 'us' || market === 'usa') found.add('US_EQUITY')
  if (market === 'jp' || market === 'japan') found.add('JP_EQUITY')

  const sector = String(news.sector || '')
  if (TECH_SECTOR_RE.test(sector)) found.add('TECH')
  if (FIN_SECTOR_RE.test(sector)) found.add('FINANCIALS')
  if (ENERGY_SECTOR_RE.test(sector)) found.add('ENERGY')

  // Direct ticker ownership is handled at score time; still tag market from ticker suffix
  const ticker = String(news.ticker || '').toUpperCase()
  if (ticker) {
    if (isJpSymbol(ticker)) found.add('JP_EQUITY')
    else if (isUsLikeSymbol(ticker)) found.add('US_EQUITY')
  }

  if (found.size === 0 && text.trim()) {
    // soft default by market only
    if (market === 'jp') found.add('JP_EQUITY')
    else if (market === 'us') found.add('US_EQUITY')
  }

  return [...found].filter((id) => MARKET_FACTORS[id])
}

function levelFromMatchedWeightPct(pct, hasDirectTicker) {
  if (hasDirectTicker || pct >= EXPOSURE_SCORE_THRESHOLDS.HIGH_MIN_PCT) return 'HIGH'
  if (pct >= EXPOSURE_SCORE_THRESHOLDS.MEDIUM_MIN_PCT) return 'MEDIUM'
  if (pct > EXPOSURE_SCORE_THRESHOLDS.LOW_MIN_PCT) return 'LOW'
  return 'NONE'
}

/**
 * Score one news item against a portfolio exposure profile.
 */
export function scoreNewsExposure(news = {}, exposureProfile = null) {
  const factors = detectNewsFactors(news)
  const profile = exposureProfile && !exposureProfile.empty ? exposureProfile : null
  const ticker = String(news.ticker || '').toUpperCase()

  if (!profile) {
    return {
      level: 'NONE',
      matchedWeightPct: 0,
      factors,
      factorScores: [],
      matchedHoldings: [],
      breakdown: [],
      hasDirectTicker: false,
      whyLines: ['保有資産が未登録のため、関連度は表示できません。'],
      pathJa: factors[0] ? MARKET_FACTORS[factors[0]].pathJa : [],
      disclaimerJa:
        '関連度は保有構成との重なりを示す指標です。将来の価格や売買の助言ではありません。',
    }
  }

  const holdings = profile.holdings || []
  const directMatches = ticker
    ? holdings.filter((h) => {
        const a = h.symbol.replace(/\.T$/i, '')
        const b = ticker.replace(/\.T$/i, '')
        return a === b || h.symbol === ticker
      })
    : []
  const hasDirectTicker = directMatches.length > 0

  const factorScores = factors.map((fid) => {
    const links = FACTOR_TO_EXPOSURE_TAGS[fid] || []
    // Primary tags only (w >= 1) — soft links must not pull in entire equity book
    const primaryTags = new Set(links.filter((l) => Number(l.w) >= 1).map((l) => l.tag))
    const tagSet = primaryTags.size > 0 ? primaryTags : new Set(links.map((l) => l.tag))
    const hitTags = []
    for (const tag of tagSet) {
      const pct = Number(profile.byTag?.[tag] || 0)
      if (pct > 0) hitTags.push({ tag, pct })
    }
    // Unique holdings that touch any primary linked tag (no double-count across tags)
    let matchedWeightPct = 0
    if (profile.totalValueJpy > 0) {
      matchedWeightPct = holdings
        .filter((h) => h.tags.some((t) => tagSet.has(t)))
        .reduce((s, h) => s + (h.valueJpy / profile.totalValueJpy) * 100, 0)
    }
    matchedWeightPct = Math.min(100, matchedWeightPct)
    return {
      factorId: fid,
      factor: MARKET_FACTORS[fid],
      matchedWeightPct,
      hitTags,
      level: levelFromMatchedWeightPct(matchedWeightPct, false),
    }
  })

  const best = factorScores.reduce(
    (acc, row) => (row.matchedWeightPct > acc.matchedWeightPct ? row : acc),
    { matchedWeightPct: 0, factorId: null, factor: null, hitTags: [], level: 'NONE' },
  )

  let matchedWeightPct = best.matchedWeightPct
  if (hasDirectTicker) {
    const directPct = directMatches.reduce((s, h) => s + (h.valueJpy / profile.totalValueJpy) * 100, 0)
    matchedWeightPct = Math.max(matchedWeightPct, directPct)
  }

  const level = levelFromMatchedWeightPct(matchedWeightPct, hasDirectTicker)

  // Holdings related to any hit tag or direct ticker
  const relatedTagSet = new Set()
  for (const fs of factorScores) {
    for (const t of fs.hitTags) relatedTagSet.add(t.tag)
  }
  const matchedHoldings = holdings
    .filter((h) => hasDirectTicker && directMatches.some((d) => d.symbol === h.symbol)
      || h.tags.some((t) => relatedTagSet.has(t)))
    .sort((a, b) => b.valueJpy - a.valueJpy)
    .slice(0, 12)
    .map((h) => ({
      symbol: h.symbol,
      name: h.name,
      valueJpy: h.valueJpy,
      weightPct: profile.totalValueJpy > 0 ? (h.valueJpy / profile.totalValueJpy) * 100 : 0,
      sector: h.sector,
      region: h.region,
    }))

  const breakdown = []
  if (profile.byTag.us_equity > 0.5) breakdown.push({ label: '米国株', pct: profile.byTag.us_equity })
  if (profile.byTag.jp_equity > 0.5) breakdown.push({ label: '日本株', pct: profile.byTag.jp_equity })
  if (profile.byTag.technology > 0.5) breakdown.push({ label: 'テクノロジー', pct: profile.byTag.technology })
  if (profile.byTag.us_bond > 0.5) breakdown.push({ label: '米国債・債券', pct: profile.byTag.us_bond })
  if (profile.byTag.jpy > 0.5) breakdown.push({ label: '円建て資産', pct: profile.byTag.jpy })
  if (profile.byTag.financials > 0.5) breakdown.push({ label: '金融セクター', pct: profile.byTag.financials })
  if (profile.byTag.energy > 0.5) breakdown.push({ label: 'エネルギー', pct: profile.byTag.energy })
  breakdown.sort((a, b) => b.pct - a.pct)

  const whyLines = []
  if (hasDirectTicker) {
    whyLines.push(`ニュース銘柄 ${ticker} を保有しています。`)
  }
  if (best.factorId && best.matchedWeightPct > 0) {
    whyLines.push(
      `要因「${best.factor.labelJa}」に対応する保有露出は約 ${best.matchedWeightPct.toFixed(0)}% です。`,
    )
  }
  for (const row of breakdown.slice(0, 4)) {
    whyLines.push(`${row.label}：約 ${row.pct.toFixed(0)}%`)
  }
  if (whyLines.length === 0) {
    whyLines.push('このニュースと重なる保有タグはほぼありません。')
  }

  return {
    level,
    matchedWeightPct,
    factors,
    factorScores: factorScores.sort((a, b) => b.matchedWeightPct - a.matchedWeightPct),
    matchedHoldings,
    breakdown: breakdown.slice(0, 6),
    hasDirectTicker,
    primaryFactor: best.factor || (factors[0] ? MARKET_FACTORS[factors[0]] : null),
    whyLines,
    pathJa: (best.factor || (factors[0] ? MARKET_FACTORS[factors[0]] : null))?.pathJa || [],
    disclaimerJa:
      '関連度は「価格がどう動くか」ではなく、保有資産がその市場要因にどれだけ触れているかを示します。売買の勧誘や将来リターンの保証ではありません。',
  }
}

/**
 * Rank today's factors by portfolio exposure (for MyPage / Home).
 * @param {string[]} factorIds
 */
export function rankFactorsForPortfolio(exposureProfile, factorIds = Object.keys(MARKET_FACTORS)) {
  if (!exposureProfile || exposureProfile.empty) return []
  const holdings = exposureProfile.holdings || []
  const total = exposureProfile.totalValueJpy || 0
  return factorIds
    .map((fid) => {
      const links = FACTOR_TO_EXPOSURE_TAGS[fid] || []
      const primaryTags = new Set(links.filter((l) => Number(l.w) >= 1).map((l) => l.tag))
      const tagSet = primaryTags.size > 0 ? primaryTags : new Set(links.map((l) => l.tag))
      let matchedWeightPct = 0
      if (total > 0) {
        matchedWeightPct = holdings
          .filter((h) => h.tags.some((t) => tagSet.has(t)))
          .reduce((s, h) => s + (h.valueJpy / total) * 100, 0)
      }
      matchedWeightPct = Math.min(100, matchedWeightPct)
      return {
        factorId: fid,
        factor: MARKET_FACTORS[fid],
        matchedWeightPct,
        level: levelFromMatchedWeightPct(matchedWeightPct, false),
      }
    })
    .filter((r) => r.level !== 'NONE')
    .sort((a, b) => b.matchedWeightPct - a.matchedWeightPct)
}

export function scoreManyNews(newsList = [], exposureProfile) {
  return (Array.isArray(newsList) ? newsList : [])
    .map((n) => ({ news: n, score: scoreNewsExposure(n, exposureProfile) }))
    .sort((a, b) => {
      const order = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 }
      const d = (order[b.score.level] || 0) - (order[a.score.level] || 0)
      if (d !== 0) return d
      return (b.score.matchedWeightPct || 0) - (a.score.matchedWeightPct || 0)
    })
}
