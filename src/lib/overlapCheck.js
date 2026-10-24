/**
 * 重なりチェック — iOS OverlapCheck.swift / ETFOverlap.swift と同じ規則・文言 (2026-10).
 * 共通カタログ: src/data/overlapCheckCatalog.json (= iOS docs/overlap_check_catalog.json のコピー).
 * 連動指数の構成ルールにもとづく事実だけを表示する. 金額は使わない. 売買の勧誘・評価はしない.
 */
import catalog from '../data/overlapCheckCatalog.js'

export const OVERLAP_FUNDS = catalog.funds

export const POPULAR_IDS = ['emaxis-slim-acwi', 'emaxis-slim-sp500', 'sbi-v-sp500', 'rakuten-vti', 'emaxis-slim-topix', 'ifreenext-ndx']

const CANONICAL = new Set([
  'S&P 500', 'S&P 500 均等加重', 'NASDAQ-100', 'ダウ平均', '米国株式市場全体', 'FTSE Global All Cap',
  'MSCI ACWI', 'MSCI ACWI 除く日本', 'MSCI コクサイ', 'MSCI エマージング',
  'TOPIX', 'TOPIX Core30', '日経平均', 'JPX日経400', 'MSCI ジャパン',
])

export function canonicalIndex(raw) {
  if (raw == null) return null
  if (CANONICAL.has(raw)) return raw
  const k = String(raw).toUpperCase().replace(/ /g, '').replace(/-/g, '')
  if (k.includes('ACWIEXJAPAN') || k.includes('ACWIEXJP')) return 'MSCI ACWI 除く日本'
  if (k.includes('MSCIEMERGING') || k === 'MSCIEM') return 'MSCI エマージング'
  if (k.includes('EQUALWEIGHT')) return 'S&P 500 均等加重'
  if (k.startsWith('S&P500')) return 'S&P 500'
  if (k.includes('NASDAQ100')) return 'NASDAQ-100'
  if (k.includes('DOWJONESINDUSTRIAL') || k === 'DOW30') return 'ダウ平均'
  if (k.includes('CRSPUSTOTAL') || k.includes('S&PTOTALMARKET')) return '米国株式市場全体'
  if (k.includes('FTSEGLOBALALLCAP')) return 'FTSE Global All Cap'
  if (k === 'MSCIACWI') return 'MSCI ACWI'
  if (k === 'MSCIKOKUSAI') return 'MSCI コクサイ'
  if (k.includes('TOPIXCORE30')) return 'TOPIX Core30'
  if (k === 'TOPIX' || k === 'ONEETFTOPIX') return 'TOPIX'
  if (k.includes('NIKKEI225') && !k.includes('ENTERTAINMENT')) return '日経平均'
  if (k.includes('JPXNIKKEI400')) return 'JPX日経400'
  if (k === 'MSCIJAPAN') return 'MSCI ジャパン'
  return null
}

/** child の銘柄が parent にも含まれる. mostly = 多くの銘柄 (すべてではない). iOS の containment と同じ順序. */
const CONTAINMENT = (() => {
  const world = ['MSCI ACWI', 'FTSE Global All Cap']
  const usBroad = ['米国株式市場全体']
  const kokusai = ['MSCI コクサイ']
  const out = []
  const add = (child, parent, mostly) => out.push({ child, parent, mostly })
  for (const p of [...world, ...kokusai]) { add('S&P 500', p, true); add('S&P 500 均等加重', p, true) }
  for (const p of usBroad) { add('S&P 500', p, false); add('S&P 500 均等加重', p, false) }
  for (const p of ['S&P 500', 'S&P 500 均等加重', ...world, ...kokusai]) add('ダウ平均', p, true)
  for (const p of usBroad) add('ダウ平均', p, false)
  for (const p of ['S&P 500', ...world, ...kokusai, ...usBroad]) add('NASDAQ-100', p, true)
  for (const p of [...world, ...kokusai]) add('米国株式市場全体', p, true)
  for (const p of world) add('MSCI コクサイ', p, false)
  for (const c of ['日経平均', 'JPX日経400', 'TOPIX Core30', 'MSCI ジャパン']) {
    add(c, 'TOPIX', true)
    for (const p of world) add(c, p, true)
  }
  for (const p of world) add('TOPIX', p, true)
  add('TOPIX Core30', 'JPX日経400', true)
  const acwiExJp = 'MSCI ACWI 除く日本'
  for (const c of ['S&P 500', 'S&P 500 均等加重', 'NASDAQ-100', 'ダウ平均', '米国株式市場全体']) add(c, acwiExJp, true)
  add('MSCI コクサイ', acwiExJp, false)
  add(acwiExJp, 'MSCI ACWI', false)
  add('MSCI エマージング', 'MSCI ACWI', false)
  add('MSCI エマージング', acwiExJp, false)
  add('MSCI エマージング', 'FTSE Global All Cap', true)
  return out
})()

export function fundById(id) {
  return OVERLAP_FUNDS.find((f) => f.id === id) || null
}

/** URL の ?f=a,b,c や /check/a-vs-b を商品の配列に. 未知の ID は捨てる・重複除去・最大 8 本. */
export function parseFundIds(raw) {
  const ids = String(raw || '').split(/,|-vs-/).map((s) => s.trim()).filter(Boolean)
  const out = []
  for (const id of ids) {
    const f = fundById(id)
    if (f && !out.includes(f)) out.push(f)
    if (out.length >= 8) break
  }
  return out
}

export function normalizeQuery(s) {
  return String(s || '')
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ')
    .toLowerCase()
    .replace(/ /g, '')
}

export function searchFunds(q) {
  const k = normalizeQuery(q)
  if (!k) return OVERLAP_FUNDS
  return OVERLAP_FUNDS.filter((f) => normalizeQuery(`${f.name} ${f.short} ${f.index} ${f.symbol || ''}`).includes(k))
}

/** iOS ETFOverlapLogic.analyze と同じ (金額は全て 1 として扱う). */
function analyze(funds) {
  const byIndex = new Map()
  for (const f of funds) {
    const idx = canonicalIndex(f.index)
    if (!idx) continue
    if (!byIndex.has(idx)) byIndex.set(idx, [])
    byIndex.get(idx).push(f)
  }
  const same = [...byIndex.entries()].filter(([, v]) => v.length >= 2).map(([index, list]) => ({ index, list }))
  const pairs = []
  for (const r of CONTAINMENT) {
    const c = byIndex.get(r.child)?.[0]
    const p = byIndex.get(r.parent)?.[0]
    if (!c || !p) continue
    pairs.push({ child: c, parent: p, childIndex: r.child, parentIndex: r.parent, mostly: r.mostly })
  }
  return { same, pairs }
}

/** 事実の文 (最大 6 行). iOS OverlapCheckLogic.lines と同じ文言. */
export function overlapLines(funds) {
  const { same, pairs } = analyze(funds)
  const out = []
  for (const g of same) {
    out.push({
      title: `${g.list.map((f) => `「${f.short}」`).join('と')} は同じ指数に連動`,
      detail: `どちらも ${g.index} に連動しています。値動きはほぼ同じです。`,
    })
  }
  for (const p of pairs) {
    out.push({
      title: `「${p.child.short}」の銘柄は、${p.mostly ? '多くが' : 'すべて'}「${p.parent.short}」にも含まれます`,
      detail: `${p.childIndex} の${p.mostly ? '多くの' : ''}銘柄は ${p.parentIndex} の構成銘柄でもあります。`,
    })
  }
  return out.slice(0, 6)
}

export function overlapHeadline(funds) {
  if (funds.length < 2) return '2本以上選ぶと、重なりを確認できます'
  const n = overlapLines(funds).length
  return n === 0 ? '連動指数の重なりは見つかりませんでした' : `重なりが ${n} か所 見つかりました`
}

export function shareUrl(funds, origin = 'https://www.moneymart.co.jp') {
  return `${origin}/check?f=${funds.map((f) => f.id).join(',')}`
}

/** 検索ページ (SEO) にする人気の組み合わせ. /check/<a>-vs-<b> */
export const POPULAR_PAIRS = [
  ['emaxis-slim-acwi', 'emaxis-slim-sp500'],
  ['emaxis-slim-acwi', 'sbi-v-sp500'],
  ['emaxis-slim-acwi', 'emaxis-slim-topix'],
  ['emaxis-slim-acwi', 'ifreenext-ndx'],
  ['emaxis-slim-acwi', 'emaxis-slim-kokusai'],
  ['emaxis-slim-acwi', 'emaxis-slim-em'],
  ['emaxis-slim-acwi', 'rakuten-vt'],
  ['emaxis-slim-sp500', 'sbi-v-sp500'],
  ['emaxis-slim-sp500', 'rakuten-vti'],
  ['emaxis-slim-sp500', 'ifreenext-ndx'],
  ['emaxis-slim-sp500', 'emaxis-slim-kokusai'],
  ['emaxis-slim-sp500', 'emaxis-slim-topix'],
  ['rakuten-vti', 'rakuten-vt'],
  ['sbi-v-vti', 'sbi-v-sp500'],
  ['emaxis-slim-kokusai', 'emaxis-slim-acwi-exjp'],
  ['emaxis-slim-topix', 'emaxis-slim-n225'],
  ['voo', 'vti'],
  ['voo', 'qqq'],
  ['vt', 'voo'],
  ['2559', '2558'],
]

export function pairSlug(a, b) {
  return `${a}-vs-${b}`
}
