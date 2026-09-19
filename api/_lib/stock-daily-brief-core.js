import { STOCK_LIST_400 } from '../../src/data/stockList400.js'
import { STOCK_MARKET_PAGE_EXTRA_SYMBOLS } from '../../src/data/stockMarketPageExtras.js'
import { getStockNameFallback, STOCK_NAME_FALLBACK } from '../../src/data/stockNameFallback.js'
import { fetchGoogleNewsRssHeadlines } from './google-news-rss.js'

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'
const GENERIC_NAME_SKIP = new Set(['inc', 'corp', 'corporation', 'technologies', 'company', 'holdings', 'group', 'llc'])
const MEDIA_OUTLET_RE = /yahoo\s*finance|investing\.com|thestreet|reuters|bloomberg|cnbc|marketwatch|wall\s*street\s*journal|financial\s*times|google\s*news|m\.?sn\.?bc|forbes|barron'?s|benzinga|seeking\s*alpha|tipranks|fool\.com|pr\s*newswire|business\s*wire/i

function stripMediaAttribution(text = '') {
  let s = String(text || '').trim()
  if (!s) return ''
  s = s.replace(/\[[^\]]{1,80}\]\s*/g, '')
  s = s.replace(/（[^）]{0,80}(?:確認|報道|掲載|より|source|via)[^）]*）/gi, '')
  s = s.replace(/(?:^|[\s、。])(?:Yahoo\s*Finance|Investing\.com|TheStreet|Reuters|Bloomberg|CNBC|MarketWatch|Google\s*News)[^.、。]{0,40}(?:で|より|according\s+to|reports?)?/gi, ' ')
  s = s.replace(MEDIA_OUTLET_RE, '')
  s = s.replace(/\s{2,}/g, ' ').replace(/\s+([、。])/g, '$1').trim()
  return s
}

function sanitizeHeadlineInput(text = '') {
  return stripMediaAttribution(text).slice(0, 360)
}

function sanitizeBriefCopy(text = '') {
  return stripMediaAttribution(text)
    .replace(/関連ニュースとして「[^」]+」が確認できます。?/g, '')
    .replace(/公開情報では「[^」]+」などが確認できます。?/g, '')
    .trim()
}

function briefContainsMediaCitation(row) {
  const blob = [
    row?.headline,
    row?.summary,
    ...(Array.isArray(row?.drivers) ? row.drivers.map((d) => `${d?.label || ''} ${d?.detail || ''}`) : []),
  ].join(' ')
  return MEDIA_OUTLET_RE.test(blob)
    || /（[^）]{0,40}確認）/.test(blob)
    || /\[[^\]]+\]/.test(blob)
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stockListName(symbol) {
  const row = STOCK_LIST_400.find((item) => String(item?.symbol || '').trim() === symbol)
  const name = String(row?.name || '').trim()
  return name && name !== symbol ? name : ''
}

function nameSearchTokens(...names) {
  const tokens = new Set()
  for (const raw of names) {
    const parts = String(raw || '').split(/[/／|]/).map((s) => s.trim()).filter(Boolean)
    for (const part of parts) {
      if (part.length >= 3) tokens.add(part)
      const en = part.replace(/[^\x20-\x7E]/g, ' ').trim()
      if (en.length >= 4) tokens.add(en)
      const ja = part.replace(/[^\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/g, '').trim()
      if (ja.length >= 2) tokens.add(ja)
    }
  }
  return [...tokens].slice(0, 6)
}

function textMentionsSymbolOrCompany(text, symbol, tokens) {
  const t = String(text || '')
  if (!t.trim()) return false
  const upper = t.toUpperCase()
  const sym = String(symbol || '').trim().toUpperCase()
  if (sym && upper.includes(sym)) return true
  const base = sym.replace(/\.T$/, '')
  if (base && base !== sym && new RegExp(`(^|[^0-9A-Z])${escapeRegExp(base)}([^0-9A-Z]|$)`).test(upper)) return true
  for (const token of tokens) {
    if (token.length < 3) continue
    if (t.includes(token)) return true
    if (/^[A-Za-z]/.test(token) && new RegExp(`\\b${escapeRegExp(token)}\\b`, 'i').test(t)) return true
  }
  return false
}

function isStaleWeakBrief(row) {
  if (!row) return false
  const model = String(row.model || '')
  const summary = String(row.summary || '')
  if (model.startsWith('rule_based')) return true
  if (model.includes('+live')) return true
  if (!model.includes('+sanitized')) return true
  if (summary.includes('明確な材料は限定的')) return true
  if (summary.includes('直接紐づく明確な材料')) return true
  if (briefContainsMediaCitation(row)) return true
  return false
}

function rssBriefEnabled(getEnv) {
  const get = typeof getEnv === 'function' ? getEnv : (k) => process.env[k]
  return String(get('STOCK_BRIEF_ENABLE_GOOGLE_RSS') ?? '1').trim() !== '0'
}

function normalizeExtraSymbol(sym) {
  const raw = String(sym || '').trim().toUpperCase()
  if (!raw) return ''
  if (/^\d{4}$/.test(raw)) return `${raw}.T`
  return raw
}

function buildSymbolUniverse() {
  const us = new Set()
  const jp = new Set()
  for (const row of STOCK_LIST_400) {
    const sym = String(row?.symbol || '').trim()
    if (!sym) continue
    if (row.region === 'US') us.add(sym)
    if (row.region === 'JP') jp.add(sym)
  }
  for (const raw of STOCK_MARKET_PAGE_EXTRA_SYMBOLS) {
    const sym = normalizeExtraSymbol(raw)
    if (!sym) continue
    if (sym.endsWith('.T')) jp.add(sym)
    else us.add(sym)
  }
  for (const [sym] of STOCK_NAME_FALLBACK.entries()) {
    if (sym.endsWith('.T') || /^\d{4}\.T$/.test(sym)) jp.add(sym)
    else us.add(sym)
  }
  const usList = [...us].sort((a, b) => b.length - a.length)
  const jpList = [...jp].sort((a, b) => b.length - a.length)
  return { us, jp, usList, jpList }
}

function detectSymbolsInText(text, region, universe) {
  const t = String(text || '')
  if (!t.trim()) return new Set()
  const list = region === 'JP' ? universe.jpList : universe.usList
  const allowed = region === 'JP' ? universe.jp : universe.us
  const found = new Set()
  const upper = t.toUpperCase()

  for (const sym of list) {
    if (!allowed.has(sym)) continue
    if (region === 'JP') {
      const base = sym.replace(/\.T$/i, '')
      if (!/^\d{4}$/.test(base)) continue
      if (new RegExp(`(^|[^0-9])${base}([^0-9]|$)`).test(t)) found.add(sym)
      if (new RegExp(escapeRegExp(sym), 'i').test(t)) found.add(sym)
    } else if (sym.length >= 2) {
      const re = new RegExp(`(^|[^A-Z0-9])${escapeRegExp(sym)}([^A-Z0-9]|$)`)
      if (re.test(upper)) found.add(sym)
    }
  }

  if (region === 'US') {
    for (const [sym, name] of STOCK_NAME_FALLBACK.entries()) {
      if (!allowed.has(sym)) continue
      const n = String(name || '').trim()
      if (n.length < 5) continue
      const re = new RegExp(`\\b${escapeRegExp(n)}\\b`, 'i')
      if (re.test(t)) found.add(sym)
    }
  }

  return found
}

export function jstDateSlug(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const d = parts.find((p) => p.type === 'day')?.value
  return y && m && d ? `${y}-${m}-${d}` : new Date().toISOString().slice(0, 10)
}

export function inferStockRegion(symbol) {
  const sym = String(symbol || '').trim().toUpperCase()
  if (/^\d{4}(\.T)?$/.test(sym) || sym.endsWith('.T')) return 'JP'
  return 'US'
}

export function normalizeStockSymbol(symbol) {
  const raw = String(symbol || '').trim().toUpperCase()
  if (!raw) return ''
  if (/^\d{4}$/.test(raw)) return `${raw}.T`
  return raw
}

function extractJsonObject(text = '') {
  const cleaned = String(text).replace(/```json|```/gi, '').trim()
  try {
    const v = JSON.parse(cleaned)
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        const v = JSON.parse(cleaned.slice(start, end + 1))
        return v && typeof v === 'object' && !Array.isArray(v) ? v : null
      } catch {
        return null
      }
    }
  }
  return null
}

async function fetchRecentDisclosures(admin, hoursBack) {
  const cutoff = Date.now() - Math.max(6, Number(hoursBack) || 168) * 60 * 60 * 1000
  const { data, error } = await admin
    .from('news_manual')
    .select('title,description,published_at,updated_at,bucket')
    .in('bucket', ['stock_disclosures', 'daily_brief', 'market_major'])
    .eq('is_active', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(420)
  if (error) throw error
  return (Array.isArray(data) ? data : []).filter((row) => {
    const ts = new Date(row?.published_at || row?.updated_at || 0).getTime()
    return Number.isFinite(ts) && ts >= cutoff
  })
}

async function fetchAiNewsForSymbol(admin, symbol, hoursBack, companyContext = null) {
  const cutoff = Date.now() - Math.max(24, Number(hoursBack) || 336) * 60 * 60 * 1000
  const base = symbol.replace(/\.T$/i, '')
  const variants = [...new Set([symbol, base, symbol.replace(/\./g, '-'), symbol.replace(/-/g, '.')])]
  const orParts = variants.flatMap((v) => [
    `ticker.eq.${v}`,
    `ticker.ilike.${v}`,
  ])
  const tokens = companyContext?.searchTokens || []
  for (const token of tokens) {
    const t = String(token || '').trim()
    if (t.length < 4 || !/^[A-Za-z]/.test(t)) continue
    if (GENERIC_NAME_SKIP.has(t.toLowerCase())) continue
    orParts.push(`company_name.ilike.%${t}%`)
    orParts.push(`headline.ilike.%${t}%`)
    orParts.push(`summary.ilike.%${t}%`)
  }
  const { data, error } = await admin
    .from('ai_news_summaries')
    .select('ticker,company_name,headline,summary,analysis,reason,impact,published_at,updated_at,is_active')
    .eq('is_active', true)
    .or([...new Set(orParts)].join(','))
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(24)
  if (error) throw error
  return (Array.isArray(data) ? data : []).filter((row) => {
    const ts = new Date(row?.published_at || row?.updated_at || 0).getTime()
    if (!Number.isFinite(ts) || ts < cutoff) return false
    const text = `${row?.headline || ''} ${row?.summary || ''} ${row?.ticker || ''}`
    return textMentionsSymbolOrCompany(text, symbol, tokens)
  })
}

function buildRssSearchQuery(symbol, searchTokens, withFinanceTerms = false) {
  const terms = new Set([symbol])
  for (const raw of searchTokens) {
    const t = String(raw || '').trim()
    if (!t || GENERIC_NAME_SKIP.has(t.toLowerCase())) continue
    if (/space\s*x|spacex|スペース\s*x/i.test(t)) terms.add('SpaceX')
    if (/^[A-Za-z]/.test(t) && t.length >= 4) terms.add(t.split(/\s+/)[0])
  }
  const base = [...terms].slice(0, 5).join(' OR ')
  if (!withFinanceTerms) return base
  return `(${base}) (bond OR debt OR offering OR 社債)`
}

async function fetchFreeRssHeadlines(symbol, companyContext, getEnv) {
  if (!rssBriefEnabled(getEnv)) return []
  const searchTokens = companyContext?.searchTokens || []
  const headlines = []
  const seen = new Set()
  const push = (line) => {
    const t = sanitizeHeadlineInput(line)
    if (!t || seen.has(t)) return
    seen.add(t)
    headlines.push(t)
  }

  const queries = [
    buildRssSearchQuery(symbol, searchTokens, false),
    buildRssSearchQuery(symbol, searchTokens, true),
  ]

  for (const q of queries) {
    try {
      const items = await fetchGoogleNewsRssHeadlines(q, { limit: 6 })
      for (const item of items) {
        const text = `${item.title || ''} ${item.description || ''}`
        if (!textMentionsSymbolOrCompany(text, symbol, searchTokens)) continue
        push(item.title)
        if (String(item.description || '').trim().length >= 20) push(item.description)
      }
    } catch {
      // optional free RSS fallback
    }
    if (headlines.length >= 6) break
  }

  return headlines.slice(0, 8)
}

async function fetchCompanyNewsCardPoint(admin, symbol, region) {
  const { data, error } = await admin
    .from('stock_page_company_news_briefs')
    .select('region,display_cards')
    .eq('region', region)
    .maybeSingle()
  if (error || !data) return ''
  const cards = Array.isArray(data.display_cards) ? data.display_cards : []
  const hit = cards.find((row) => String(row?.symbol || '').trim().toUpperCase() === symbol)
  return String(hit?.point || '').trim()
}

export async function fetchCompanyContext(admin, symbol) {
  const fallbackName = getStockNameFallback(symbol) || stockListName(symbol) || symbol
  let nameJp = ''
  let nameEn = ''
  let sector = ''
  let industry = ''
  try {
    const { data, error } = await admin
      .from('stock_symbol_profiles')
      .select('name_jp,name_en,sector,industry')
      .eq('symbol', symbol)
      .maybeSingle()
    if (!error && data) {
      nameJp = String(data.name_jp || '').trim()
      nameEn = String(data.name_en || '').trim()
      sector = String(data.sector || '').trim()
      industry = String(data.industry || '').trim()
    }
  } catch {
    // optional enrichment
  }
  const displayName = nameJp && nameEn
    ? `${nameJp} / ${nameEn}`
    : nameJp || nameEn || fallbackName
  const searchTokens = nameSearchTokens(displayName, fallbackName, nameJp, nameEn, stockListName(symbol))
  return {
    displayName,
    nameJp,
    nameEn,
    sector,
    industry,
    searchTokens,
  }
}

async function fetchRecentAiNews(admin, hoursBack) {
  const cutoff = Date.now() - Math.max(24, Number(hoursBack) || 168) * 60 * 60 * 1000
  const { data, error } = await admin
    .from('ai_news_summaries')
    .select('ticker,headline,summary,published_at,updated_at,is_active')
    .eq('is_active', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(400)
  if (error) throw error
  return (Array.isArray(data) ? data : []).filter((row) => {
    const ts = new Date(row?.published_at || row?.updated_at || 0).getTime()
    return Number.isFinite(ts) && ts >= cutoff
  })
}

export async function fetchHeadlinesForSymbol(admin, symbol, region, companyContext = null, getEnv = null) {
  const universe = buildSymbolUniverse()
  const ctx = companyContext || await fetchCompanyContext(admin, symbol)
  const searchTokens = ctx.searchTokens || []
  const headlines = []
  const seen = new Set()
  const push = (line) => {
    const t = sanitizeHeadlineInput(line)
    if (!t || seen.has(t)) return
    seen.add(t)
    headlines.push(t)
  }

  let usedRss = false

  const cardPoint = await fetchCompanyNewsCardPoint(admin, symbol, region)
  if (cardPoint) push(cardPoint)

  const aiRows = await fetchAiNewsForSymbol(admin, symbol, 336, ctx)
  for (const row of aiRows) {
    push(row?.headline)
    for (const field of [row?.summary, row?.analysis, row?.reason, row?.impact]) {
      const text = String(field || '').trim()
      if (text.length >= 20) push(text)
    }
  }

  const disclosures = await fetchRecentDisclosures(admin, 168)
  for (const row of disclosures) {
    const text = `${row?.title || ''}\n${row?.description || ''}`
    const syms = detectSymbolsInText(text, region, universe)
    const directHit = textMentionsSymbolOrCompany(text, symbol, searchTokens)
    if (!syms.has(symbol) && !directHit) continue
    push(row?.title)
    const desc = String(row?.description || '').trim()
    if (desc.length >= 16) push(desc)
  }

  if (headlines.length < 4) {
    const before = headlines.length
    const rssRows = await fetchFreeRssHeadlines(symbol, ctx, getEnv)
    for (const line of rssRows) push(line)
    if (headlines.length > before) usedRss = true
  }

  if (headlines.length < 4) {
    const allowed = region === 'JP' ? universe.jp : universe.us
    const fallbackAi = await fetchRecentAiNews(admin, 336)
    for (const row of fallbackAi) {
      let raw = String(row?.ticker || '').trim().toUpperCase()
      if (!raw) continue
      if (region === 'JP') {
        if (/^\d{4}$/.test(raw)) raw = `${raw}.T`
        if (!/^\d{4}\.T$/.test(raw)) continue
      } else {
        raw = raw.replace(/-/g, '.')
      }
      if (raw !== symbol || !allowed.has(raw)) continue
      push(row?.headline)
      const summary = String(row?.summary || '').trim()
      if (summary.length >= 16) push(summary)
    }
  }

  return { headlines: headlines.slice(0, 12), usedRss }
}

export async function fetchPriceContext(admin, symbol) {
  const { data: latestRows, error: latestErr } = await admin
    .from('v_stock_latest')
    .select('symbol,trade_date,close')
    .eq('symbol', symbol)
    .limit(1)
  if (latestErr) throw latestErr
  const latest = latestRows?.[0]
  if (!latest?.trade_date) {
    return {
      tradeDate: null,
      latestClose: null,
      prevClose: null,
      changePct: null,
      changeAbs: null,
    }
  }

  const { data: histRows, error: histErr } = await admin
    .from('stock_daily_prices')
    .select('trade_date,close,source,fetched_at')
    .eq('symbol', symbol)
    .lte('trade_date', latest.trade_date)
    .order('trade_date', { ascending: false })
    .limit(280)
  if (histErr) throw histErr

  const byDate = new Map()
  for (const row of histRows || []) {
    const d = String(row?.trade_date || '').slice(0, 10)
    if (!d) continue
    const close = Number(row?.close)
    if (!Number.isFinite(close)) continue
    const sourceRank = row?.source === 'marketstack' ? 0 : row?.source === 'yfinance' ? 1 : 2
    const fetchedAt = new Date(row?.fetched_at || 0).getTime()
    const cur = byDate.get(d)
    if (!cur || sourceRank < cur.sourceRank || (sourceRank === cur.sourceRank && fetchedAt > cur.fetchedAt)) {
      byDate.set(d, { close, sourceRank, fetchedAt })
    }
  }

  const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a))
  const closes = dates.map((d) => byDate.get(d)?.close).filter((v) => Number.isFinite(v))
  const latestClose = closes[0] ?? Number(latest.close)
  const prevClose = closes[1] ?? null
  let changePct = null
  let changeAbs = null
  if (Number.isFinite(latestClose) && Number.isFinite(prevClose) && prevClose !== 0) {
    changeAbs = latestClose - prevClose
    changePct = (changeAbs / prevClose) * 100
  }

  const pctFrom = (idx) => {
    if (!Number.isFinite(closes[0]) || !Number.isFinite(closes[idx]) || closes[idx] === 0) return null
    return ((closes[0] - closes[idx]) / closes[idx]) * 100
  }

  const rangeCloses = closes.slice(0, Math.min(closes.length, 252))
  const high52w = rangeCloses.length ? Math.max(...rangeCloses) : null
  const low52w = rangeCloses.length ? Math.min(...rangeCloses) : null

  return {
    tradeDate: String(latest.trade_date).slice(0, 10),
    latestClose: Number.isFinite(latestClose) ? latestClose : null,
    prevClose: Number.isFinite(prevClose) ? prevClose : null,
    changePct: Number.isFinite(changePct) ? changePct : null,
    changeAbs: Number.isFinite(changeAbs) ? changeAbs : null,
    change5dPct: pctFrom(4),
    change20dPct: pctFrom(19),
    high52wClose: Number.isFinite(high52w) ? high52w : null,
    low52wClose: Number.isFinite(low52w) ? low52w : null,
  }
}

function buildBriefPrompt({
  symbol,
  companyName,
  region,
  dateSlug,
  price,
  headlines,
  companyContext,
}) {
  const regionLabel = region === 'JP' ? '日本株' : '米国株'
  const priceBlock = {
    trade_date: price.tradeDate,
    latest_close: price.latestClose,
    prev_close: price.prevClose,
    change_pct: price.changePct != null ? Number(price.changePct.toFixed(2)) : null,
    change_abs: price.changeAbs != null ? Number(price.changeAbs.toFixed(4)) : null,
    change_5d_pct: price.change5dPct != null ? Number(price.change5dPct.toFixed(2)) : null,
    change_20d_pct: price.change20dPct != null ? Number(price.change20dPct.toFixed(2)) : null,
    high_52w_close: price.high52wClose,
    low_52w_close: price.low52wClose,
  }
  const companyBlock = {
    display_name: companyName || symbol,
    sector: companyContext?.sector || null,
    industry: companyContext?.industry || null,
  }
  const headlineInputs = headlines.map(sanitizeHeadlineInput).filter(Boolean)
  const promptHeadlines = headlineInputs
  return `
あなたは日本の個人投資家向け金融メディアの編集者です。

${regionLabel}の銘柄 ${symbol}（${companyName || symbol}）について、株式ページ「本日のAI解説」用の短い整理を日本語で書いてください（対象日: ${dateSlug} JST）。

厳守:
- 出力は **JSONオブジェクトのみ**（前後に説明・Markdown禁止）。
- キー必須: headline, summary, drivers, price_context
- headline: 1行（株価の方向と背景を簡潔に）
- summary: 2〜4文。読者が「いま何が起きているか」が分かる実用的な整理にする
- drivers: 配列（0〜3件）。各要素は { "label": "短い要因名", "detail": "1文の説明" }
- price_context: 前日比など数値を含む1文（price ブロックの数値と矛盾しない）
- **売買推奨・買い時/売り時の指示は禁止**
- headlines にない具体的イベント（決算数値・M&A・社債発行など）を断定しない
- **第三者メディア名の引用・出典表示は禁止**（Yahoo Finance、Investing.com、Reuters、Bloomberg、TheStreet、Google News 等を本文・drivers に書かない）
- 「〜で確認」「〜報道」など他社記事の転載・引用調の表現は禁止。MoneyMart AIによる整理・分析として書く
- drivers の label は「背景」「資金調達」「市場環境」など中立的な語を使い、「ニュース」で媒体名を繰り返さない
- headlines が英語でも、summary/drivers は日本語で要約してよい（出典名は一切付けない）
- headlines が空でも、price と company の範囲で「前日比の大きさ」「直近5日/20日の推移」「52週高値・安値からの位置」「セクター確認の観点」を整理して書く
- 「明確な材料は限定的です」だけで終わる短文は禁止。必ず価格データに基づく具体的な整理を含める
- 不確実な点は「各社IR・適時開示・一次情報で要確認」と書く

company:
${JSON.stringify(companyBlock)}

price:
${JSON.stringify(priceBlock)}

headlines (${promptHeadlines.length}件・内部参考・出典名なし):
${JSON.stringify(promptHeadlines)}
`.trim()
}

function ruleBasedBrief({ symbol, companyName, price, headlines, dateSlug, companyContext }) {
  const pct = price.changePct
  const dir = pct == null ? '横ばい圏' : pct > 0.05 ? '上昇' : pct < -0.05 ? '下落' : '小幅な動き'
  const pctLabel = pct != null ? `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%` : '—'
  const headline = `${companyName || symbol}は前営業日比${pctLabel}の${dir}`
  const top = sanitizeHeadlineInput(headlines[0] || '')
  const sector = String(companyContext?.sector || '').trim()
  const parts = []
  if (price.latestClose != null && price.prevClose != null) {
    parts.push(`最新終値は ${price.latestClose} で、前営業日比 ${pctLabel}です（参照日: ${price.tradeDate || dateSlug}）。`)
  }
  if (price.change5dPct != null) {
    parts.push(`直近5営業日では ${price.change5dPct > 0 ? '+' : ''}${price.change5dPct.toFixed(2)}% の推移です。`)
  }
  if (price.high52wClose != null && price.low52wClose != null && price.latestClose != null) {
    parts.push(`過去1年程度の終値レンジは ${price.low52wClose}〜${price.high52wClose} です。`)
  }
  if (top) {
    parts.push(`公開情報をもとに、直近の話題として資金調達・市場動向などが議論されている可能性があります（AI整理）。`)
  } else if (sector) {
    parts.push(`${sector}セクター銘柄として、同業他社や市場全体の動きも併せて確認すると整理しやすくなります。`)
  } else {
    parts.push('銘柄固有の一次ニュースは限られているため、決算・開示・セクター動向は各社IRで確認してください。')
  }
  const summary = parts.join(' ')
  const drivers = []
  if (top) drivers.push({ label: '背景', detail: '直近の公開情報をAIが要約した結果、銘柄関連の話題が出ています。詳細は各社IRでご確認ください。' })
  if (price.change5dPct != null) {
    drivers.push({
      label: '短期推移',
      detail: `直近5営業日の変化率は ${price.change5dPct > 0 ? '+' : ''}${price.change5dPct.toFixed(2)}% です。`,
    })
  }
  if (sector) {
    drivers.push({ label: 'セクター', detail: `${sector}に分類される銘柄です。同セクター比較が有効です。` })
  }
  const priceContext = price.latestClose != null && price.prevClose != null
    ? `最新終値 ${price.latestClose}、前営業日比 ${pctLabel}（${price.tradeDate || dateSlug}）。`
    : `価格データの参照営業日: ${price.tradeDate || '未取得'}。`
  return {
    headline: headline.slice(0, 160),
    summary: summary.slice(0, 900),
    drivers: drivers.slice(0, 3),
    price_context: priceContext.slice(0, 280),
  }
}

async function generateBriefWithClaude(prompt, apiKey, model) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      temperature: 0.25,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error?.message || `Anthropic ${res.status}`)
  }
  const text = Array.isArray(data?.content)
    ? data.content.map((row) => String(row?.text || '')).join('\n')
    : ''
  const parsed = extractJsonObject(text)
  if (!parsed) throw new Error('Claude returned no JSON object')
  return parsed
}

function normalizeDrivers(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((row) => ({
      label: sanitizeBriefCopy(String(row?.label || '').trim()).slice(0, 48),
      detail: sanitizeBriefCopy(String(row?.detail || '').trim()).slice(0, 280),
    }))
    .filter((row) => row.label && row.detail)
    .slice(0, 3)
}

function sanitizeParsedBrief(parsed) {
  return {
    headline: sanitizeBriefCopy(parsed?.headline || '').slice(0, 200),
    summary: sanitizeBriefCopy(parsed?.summary || '').slice(0, 900),
    drivers: normalizeDrivers(parsed?.drivers),
    price_context: sanitizeBriefCopy(parsed?.price_context || '').slice(0, 280),
  }
}

export async function getOrCreateStockDailyBrief(admin, {
  symbol: rawSymbol,
  anthropicKey,
  model = DEFAULT_MODEL,
  getEnv = null,
}) {
  const symbol = normalizeStockSymbol(rawSymbol)
  if (!symbol) {
    const err = new Error('symbol is required')
    err.status = 400
    throw err
  }

  const region = inferStockRegion(symbol)
  const briefDateJst = jstDateSlug()
  const companyContext = await fetchCompanyContext(admin, symbol)
  const companyName = companyContext.displayName || getStockNameFallback(symbol) || symbol

  const { data: existing, error: readErr } = await admin
    .from('stock_symbol_daily_briefs')
    .select('*')
    .eq('symbol', symbol)
    .eq('brief_date_jst', briefDateJst)
    .maybeSingle()
  if (readErr) throw readErr
  if ((existing?.status === 'ready' || existing?.status === 'empty') && !isStaleWeakBrief(existing)) {
    return formatBriefRow(existing)
  }

  const [price, headlineResult] = await Promise.all([
    fetchPriceContext(admin, symbol),
    fetchHeadlinesForSymbol(admin, symbol, region, companyContext, getEnv),
  ])
  const headlines = headlineResult?.headlines || []
  const usedRssNews = Boolean(headlineResult?.usedRss)
  const headlineInputs = headlines.map(sanitizeHeadlineInput).filter(Boolean)

  if (!price.tradeDate && !price.latestClose) {
    const emptyRow = {
      symbol,
      brief_date_jst: briefDateJst,
      region,
      company_name: companyName,
      trade_date: null,
      latest_close: null,
      prev_close: null,
      change_pct: null,
      headline: `${companyName}の価格データを取得できませんでした`,
      summary: '終値データが未登録のため、本日のAI解説を生成できません。時間をおいて再度お試しください。',
      drivers: [],
      source_headlines: headlineInputs,
      model: null,
      status: 'empty',
      error_message: null,
      updated_at: new Date().toISOString(),
    }
    const { data: saved, error: saveErr } = await admin
      .from('stock_symbol_daily_briefs')
      .upsert(emptyRow, { onConflict: 'symbol,brief_date_jst' })
      .select('*')
      .single()
    if (saveErr) throw saveErr
    return formatBriefRow(saved)
  }

  let parsed
  let usedModel = null
  if (anthropicKey) {
    try {
      const prompt = buildBriefPrompt({
        symbol,
        companyName,
        region,
        dateSlug: briefDateJst,
        price,
        headlines: headlineInputs,
        companyContext,
      })
      parsed = await generateBriefWithClaude(prompt, anthropicKey, model)
      usedModel = `${model}${usedRssNews ? '+rss' : ''}`
    } catch {
      parsed = ruleBasedBrief({
        symbol,
        companyName,
        price,
        headlines,
        dateSlug: briefDateJst,
        companyContext,
      })
      usedModel = `rule_based_fallback${usedRssNews ? '+rss' : ''}`
    }
  } else {
    parsed = ruleBasedBrief({
      symbol,
      companyName,
      price,
      headlines,
      dateSlug: briefDateJst,
      companyContext,
    })
    usedModel = `rule_based${usedRssNews ? '+rss' : ''}`
  }

  const cleaned = sanitizeParsedBrief(parsed)

  const row = {
    symbol,
    brief_date_jst: briefDateJst,
    region,
    company_name: companyName,
    trade_date: price.tradeDate,
    latest_close: price.latestClose,
    prev_close: price.prevClose,
    change_pct: price.changePct != null ? Number(price.changePct.toFixed(4)) : null,
    headline: cleaned.headline,
    summary: cleaned.summary,
    drivers: cleaned.drivers,
    source_headlines: headlineInputs,
    model: `${usedModel}+sanitized`,
    status: 'ready',
    error_message: null,
    updated_at: new Date().toISOString(),
  }

  if (!row.headline || !row.summary || row.summary.includes('明確な材料は限定的') || briefContainsMediaCitation(row)) {
    const fallback = sanitizeParsedBrief(ruleBasedBrief({
      symbol,
      companyName,
      price,
      headlines,
      dateSlug: briefDateJst,
      companyContext,
    }))
    row.headline = fallback.headline
    row.summary = fallback.summary
    row.drivers = fallback.drivers
  }

  const { data: saved, error: saveErr } = await admin
    .from('stock_symbol_daily_briefs')
    .upsert(row, { onConflict: 'symbol,brief_date_jst' })
    .select('*')
    .single()
  if (saveErr) throw saveErr
  return formatBriefRow(saved)
}

function formatBriefRow(row) {
  const cleaned = sanitizeParsedBrief({
    headline: row.headline,
    summary: row.summary,
    drivers: row.drivers,
  })
  return {
    symbol: row.symbol,
    briefDateJst: row.brief_date_jst,
    region: row.region,
    companyName: row.company_name,
    tradeDate: row.trade_date,
    latestClose: row.latest_close != null ? Number(row.latest_close) : null,
    prevClose: row.prev_close != null ? Number(row.prev_close) : null,
    changePct: row.change_pct != null ? Number(row.change_pct) : null,
    headline: cleaned.headline,
    summary: cleaned.summary,
    drivers: cleaned.drivers,
    sourceHeadlines: [],
    model: row.model || null,
    status: row.status || 'ready',
    updatedAt: row.updated_at || null,
  }
}
