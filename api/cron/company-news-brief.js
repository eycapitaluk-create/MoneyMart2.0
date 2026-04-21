/**
 * GET/POST /api/cron/company-news-brief
 * Bearer CRON_SECRET
 *
 * 1日1回: news_manual.stock_disclosures から「ニュースに名前が出た銘柄」を抽出し、
 * 地域ごとにランダムで N 件を選び、Gemini で右カラム「企業ニュース」用のフルカード JSON を生成して
 * Supabase stock_page_company_news_briefs.display_cards に保存します。
 * display_cards が空のときのみ StockPage は静的マスタ + brief_points マージにフォールバックします。
 */
import { createClient } from '@supabase/supabase-js'
import { STOCK_LIST_400 } from '../../src/data/stockList400.js'
import { getStockNameFallback, STOCK_NAME_FALLBACK } from '../../src/data/stockNameFallback.js'

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function normalizeSecret(value) {
  const raw = String(value || '').trim()
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1).trim()
  }
  return raw
}

const DEFAULT_MODEL = 'claude-3-5-haiku-20241022'
const GEMINI_DEFAULT_MODEL = 'gemini-2.0-flash'

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractJsonArray(text = '') {
  const cleaned = String(text).replace(/```json|```/gi, '').trim()
  try {
    const v = JSON.parse(cleaned)
    return Array.isArray(v) ? v : null
  } catch {
    const start = cleaned.indexOf('[')
    const end = cleaned.lastIndexOf(']')
    if (start >= 0 && end > start) {
      try {
        const v = JSON.parse(cleaned.slice(start, end + 1))
        return Array.isArray(v) ? v : null
      } catch {
        return null
      }
    }
  }
  return null
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
  const usList = [...us].sort((a, b) => b.length - a.length)
  const jpList = [...jp].sort((a, b) => b.length - a.length)
  return { us, jp, usList, jpList }
}

/** @param {string} text @param {'US'|'JP'} region @param {ReturnType<typeof buildSymbolUniverse>} u */
function detectSymbolsInText(text, region, u) {
  const t = String(text || '')
  if (!t.trim()) return new Set()
  const list = region === 'JP' ? u.jpList : u.usList
  const allowed = region === 'JP' ? u.jp : u.us
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

function shuffleInPlace(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function jstDateSlug() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const d = parts.find((p) => p.type === 'day')?.value
  return y && m && d ? `${y}-${m}-${d}` : new Date().toISOString().slice(0, 10)
}

async function fetchRecentDisclosures(admin, hoursBack) {
  const cutoff = Date.now() - Math.max(6, Number(hoursBack) || 72) * 60 * 60 * 1000
  const { data, error } = await admin
    .from('news_manual')
    .select('title,description,published_at,updated_at')
    .eq('bucket', 'stock_disclosures')
    .eq('is_active', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(280)
  if (error) throw error
  return (Array.isArray(data) ? data : []).filter((row) => {
    const ts = new Date(row?.published_at || row?.updated_at || 0).getTime()
    return Number.isFinite(ts) && ts >= cutoff
  })
}

async function fetchRecentAiNews(admin, hoursBack) {
  const cutoff = Date.now() - Math.max(24, Number(hoursBack) || 720) * 60 * 60 * 1000
  const { data, error } = await admin
    .from('ai_news_summaries')
    .select('ticker,headline,summary,published_at,updated_at,market,is_active')
    .eq('is_active', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(360)
  if (error) throw error
  return (Array.isArray(data) ? data : []).filter((row) => {
    const ts = new Date(row?.published_at || row?.updated_at || 0).getTime()
    return Number.isFinite(ts) && ts >= cutoff
  })
}

/** @param {Awaited<ReturnType<typeof fetchRecentDisclosures>>} rows */
function aggregateBySymbol(rows, region, universe) {
  /** @type {Map<string, { headlines: string[], latest: number }>} */
  const map = new Map()
  for (const row of rows) {
    const text = `${row?.title || ''}\n${row?.description || ''}`
    const syms = detectSymbolsInText(text, region, universe)
    const ts = new Date(row?.published_at || row?.updated_at || 0).getTime()
    for (const sym of syms) {
      const title = String(row?.title || '').trim()
      if (!title) continue
      const cur = map.get(sym) || { headlines: [], latest: 0 }
      if (!cur.headlines.includes(title)) cur.headlines.push(title)
      if (Number.isFinite(ts) && ts > cur.latest) cur.latest = ts
      map.set(sym, cur)
    }
  }
  return map
}

/** @param {Awaited<ReturnType<typeof fetchRecentAiNews>>} rows */
function aggregateFromAiNews(rows, region, universe) {
  /** @type {Map<string, { headlines: string[], latest: number }>} */
  const map = new Map()
  const allowed = region === 'JP' ? universe.jp : universe.us
  for (const row of rows) {
    let raw = String(row?.ticker || '').trim().toUpperCase()
    if (!raw) continue
    if (region === 'JP') {
      if (/^\d{4}$/.test(raw)) raw = `${raw}.T`
      if (!/^\d{4}\.T$/.test(raw)) continue
    } else {
      raw = raw.replace(/-/g, '.')
    }
    if (!allowed.has(raw)) continue
    const title = String(row?.headline || '').trim()
    const summary = String(row?.summary || '').trim()
    const ts = new Date(row?.published_at || row?.updated_at || 0).getTime()
    const cur = map.get(raw) || { headlines: [], latest: 0 }
    if (title && !cur.headlines.includes(title)) cur.headlines.push(title)
    if (summary && summary.length >= 12 && !cur.headlines.includes(summary)) {
      cur.headlines.push(summary)
    }
    if (Number.isFinite(ts) && ts > cur.latest) cur.latest = ts
    map.set(raw, cur)
  }
  return map
}

function buildCardsPrompt(regionKey, regionLabel, dateSlug, picks) {
  const compact = picks.map((p) => ({
    symbol: p.symbol,
    company_hint: p.companyHint,
    headlines: p.headlines.slice(0, 6),
  }))
  return `
あなたは日本の個人投資家向け金融メディアの編集者です。

${regionLabel}株のうち、直近ニュース見出しが付いた銘柄だけを入力しています（本日の選定: ${dateSlug} JST）。
各 symbol について、株式ページ右カラム用のカード1枚分を日本語で出力してください。

厳守:
- 出力は **JSON配列のみ**（前後に説明・Markdown禁止）。
- 各要素の形は次のキー必須: id, symbol, company, when, phase, point
- id は英数字とハイフンのみ。例: daily-${regionKey.toLowerCase()}-AAPL-${dateSlug}（symbol と日付を含む）
- symbol は入力と **完全一致**
- company は日本語で一般的な社名（company_hint を優先してよい）
- when は1行・短く（例: 「${dateSlug.replace(/-/g, '/')} 前後の開示・ニュース」）
- phase は「ニュース」または「開示」など短いラベル（実績・決算予定の断定はしない）
- point は1〜2文。**入力 headlines に書かれた内容だけ**を要約。新しい数値・未確認の業績・憶測の断定を追加しない。不明なら「詳細は各社リリースで要確認」と書く。

入力:
${JSON.stringify(compact, null, 0)}
`.trim()
}

function buildRuleBasedCards(regionKey, picks) {
  const dateSlug = jstDateSlug()
  const day = dateSlug.replace(/-/g, '/')
  const seed = regionKey.toLowerCase()
  return picks
    .map((p, idx) => {
      const symbol = String(p?.symbol || '').trim()
      if (!symbol) return null
      const company = String(p?.companyHint || symbol).trim().slice(0, 120)
      const sourceLine = String(p?.headlines?.[0] || '').trim()
      if (!sourceLine) return null
      const point = sourceLine.length > 160
        ? `${sourceLine.slice(0, 156)}...`
        : sourceLine
      return {
        id: `daily-${seed}-${symbol}-${dateSlug}-${idx + 1}`.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 120),
        symbol,
        company,
        when: `${day} 前後のニュース`,
        phase: 'ニュース',
        point: point.slice(0, 480),
      }
    })
    .filter(Boolean)
}

async function generateDisplayCards(regionKey, picks, apiKey, model) {
  if (picks.length === 0) return []
  const regionLabel = regionKey === 'JP' ? '日本' : '米国'
  const dateSlug = jstDateSlug()
  const prompt = buildCardsPrompt(regionKey, regionLabel, dateSlug, picks)
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 6144,
      temperature: 0.35,
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
  const arr = extractJsonArray(text)
  if (!arr || arr.length === 0) throw new Error('Claude returned no JSON array')

  const allowed = new Set(picks.map((p) => p.symbol))
  const out = []
  const seen = new Set()
  for (const item of arr) {
    const id = String(item?.id || '').trim()
    const symbol = String(item?.symbol || '').trim()
    const company = String(item?.company || '').trim()
    const when = String(item?.when || '').trim()
    const phase = String(item?.phase || '').trim()
    const point = String(item?.point || '').trim()
    if (!id || !symbol || !company || !when || !phase || !point) continue
    if (!allowed.has(symbol) || seen.has(symbol)) continue
    seen.add(symbol)
    out.push({
      id: id.slice(0, 120),
      symbol,
      company: company.slice(0, 120),
      when: when.slice(0, 120),
      phase: phase.slice(0, 32),
      point: point.slice(0, 480),
    })
  }
  return out
}

function geminiResponseText(data) {
  const c = data?.candidates?.[0]
  if (!c) throw new Error('Gemini returned no candidates')
  const parts = Array.isArray(c?.content?.parts) ? c.content.parts : []
  const text = parts.map((p) => String(p?.text || '')).join('')
  if (!String(text).trim()) throw new Error('Gemini returned empty text')
  return text
}

async function generateDisplayCardsWithGemini(regionKey, picks, apiKey, model) {
  if (picks.length === 0) return []
  const regionLabel = regionKey === 'JP' ? '日本' : '米国'
  const dateSlug = jstDateSlug()
  const prompt = buildCardsPrompt(regionKey, regionLabel, dateSlug, picks)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
      },
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error?.message || `Gemini ${res.status}`)
  const text = geminiResponseText(data)
  const arr = extractJsonArray(text)
  if (!arr || arr.length === 0) throw new Error('Gemini returned no JSON array')

  const allowed = new Set(picks.map((p) => p.symbol))
  const out = []
  const seen = new Set()
  for (const item of arr) {
    const id = String(item?.id || '').trim()
    const symbol = String(item?.symbol || '').trim()
    const company = String(item?.company || '').trim()
    const when = String(item?.when || '').trim()
    const phase = String(item?.phase || '').trim()
    const point = String(item?.point || '').trim()
    if (!id || !symbol || !company || !when || !phase || !point) continue
    if (!allowed.has(symbol) || seen.has(symbol)) continue
    seen.add(symbol)
    out.push({
      id: id.slice(0, 120),
      symbol,
      company: company.slice(0, 120),
      when: when.slice(0, 120),
      phase: phase.slice(0, 32),
      point: point.slice(0, 480),
    })
  }
  return out
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }

  const cronSecret = normalizeSecret(process.env.CRON_SECRET)
  if (!cronSecret) {
    return sendJson(res, 500, { ok: false, error: 'CRON_SECRET is required' })
  }
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (token !== cronSecret) {
    return sendJson(res, 401, { ok: false, error: 'Unauthorized cron request' })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey =
    normalizeSecret(process.env.SUPABASE_SERVICE_ROLE_KEY)
    || normalizeSecret(process.env.SUPABASE_SECRET_KEY)
  const anthropicKey = normalizeSecret(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY)
  const geminiKey = normalizeSecret(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY)
  if (!supabaseUrl || !serviceRoleKey || (!geminiKey && !anthropicKey)) {
    return sendJson(res, 500, {
      ok: false,
      error: 'Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY), and at least one of GEMINI_API_KEY / ANTHROPIC_API_KEY',
    })
  }

  const claudeModel = String(
    process.env.COMPANY_NEWS_BRIEF_MODEL || DEFAULT_MODEL,
  ).trim() || DEFAULT_MODEL
  const geminiModel = String(
    process.env.COMPANY_NEWS_BRIEF_GEMINI_MODEL || process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL,
  ).trim() || GEMINI_DEFAULT_MODEL

  const lookbackHours = Math.min(168, Math.max(12, Number(process.env.COMPANY_NEWS_LOOKBACK_HOURS) || 72))
  const dailyPick = Math.min(20, Math.max(3, Number(process.env.COMPANY_NEWS_DAILY_PICK) || 8))
  const aiFallbackHours = Math.min(
    24 * 45,
    Math.max(24, Number(process.env.COMPANY_NEWS_AI_FALLBACK_HOURS) || 24 * 30),
  )

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const universe = buildSymbolUniverse()
  const preErrors = []

  let disclosures = []
  let aiNewsRows = []
  try {
    disclosures = await fetchRecentDisclosures(admin, lookbackHours)
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: `news_manual fetch: ${e?.message || 'failed'}` })
  }
  try {
    aiNewsRows = await fetchRecentAiNews(admin, aiFallbackHours)
  } catch (e) {
    preErrors.push(`ai-news fallback fetch: ${e?.message || 'failed'}`)
  }

  const summary = {
    US: { ok: false, count: 0, pool: 0 },
    JP: { ok: false, count: 0, pool: 0 },
    disclosures: disclosures.length,
    lookbackHours,
    dailyPick,
    errors: preErrors,
  }

  for (const regionKey of ['US', 'JP']) {
    const disclosureAgg = aggregateBySymbol(disclosures, regionKey, universe)
    const agg = disclosureAgg.size > 0 ? disclosureAgg : aggregateFromAiNews(aiNewsRows, regionKey, universe)
    const sourceType = disclosureAgg.size > 0 ? 'stock_disclosures' : 'ai_news_fallback'
    const pool = [...agg.keys()]
    summary[regionKey].pool = pool.length
    const shuffled = shuffleInPlace(pool)
    const chosen = shuffled.slice(0, dailyPick)
    const picks = chosen.map((symbol) => {
      const meta = agg.get(symbol) || { headlines: [], latest: 0 }
      const companyHint = getStockNameFallback(symbol) || symbol
      return { symbol, companyHint, headlines: meta.headlines }
    })

    if (picks.length === 0) {
      try {
        const { error } = await admin
          .from('stock_page_company_news_briefs')
          .upsert(
            {
              region: regionKey,
              display_cards: [],
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'region' },
          )
        if (error) throw error
        summary[regionKey] = { ok: true, count: 0, pool: 0, skipped: 'no_symbols_matched', source: sourceType }
      } catch (e) {
        summary.errors.push(`${regionKey} clear: ${e?.message || 'failed'}`)
        summary[regionKey] = { ok: false, count: 0, pool: 0 }
      }
      continue
    }

    try {
      let cards = []
      let provider = ''
      const providerErrors = []
      if (geminiKey) {
        try {
          cards = await generateDisplayCardsWithGemini(regionKey, picks, geminiKey, geminiModel)
          provider = 'gemini'
        } catch (e) {
          providerErrors.push(`gemini: ${e?.message || 'failed'}`)
        }
      }
      if (!cards.length && anthropicKey) {
        try {
          cards = await generateDisplayCards(regionKey, picks, anthropicKey, claudeModel)
          provider = 'anthropic'
        } catch (e) {
          providerErrors.push(`anthropic: ${e?.message || 'failed'}`)
        }
      }
      if (!cards.length) {
        cards = buildRuleBasedCards(regionKey, picks)
        provider = 'rule_based'
      }
      if (!cards.length) throw new Error('No display cards generated')
      const { error } = await admin
        .from('stock_page_company_news_briefs')
        .upsert(
          {
            region: regionKey,
            display_cards: cards,
            brief_points: [],
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'region' },
        )
      if (error) throw error
      summary[regionKey] = {
        ok: true,
        count: cards.length,
        pool: pool.length,
        provider,
        source: sourceType,
        providerErrors,
      }
    } catch (e) {
      summary.errors.push(`${regionKey}: ${e?.message || 'failed'}`)
      summary[regionKey] = { ok: false, count: 0, pool: pool.length }
    }
  }

  const partial = summary.US.ok || summary.JP.ok
  const allOk = summary.US.ok && summary.JP.ok && summary.errors.length === 0
  return sendJson(res, partial ? 200 : 500, { ok: allOk, summary })
}
