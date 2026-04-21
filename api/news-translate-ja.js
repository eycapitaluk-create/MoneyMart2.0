const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash'
const GEMINI_FALLBACK_MODELS = ['gemini-1.5-flash', 'gemini-1.5-flash-latest']
const DEFAULT_ANTHROPIC_MODEL = 'claude-3-5-haiku-20241022'
const ANTHROPIC_FALLBACK_MODELS = ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest', 'claude-sonnet-4-20250514']
const TRANSLATION_CONCURRENCY = 3

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function normalizeSecret(value) {
  const raw = String(value || '').trim()
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1).trim()
  }
  return raw
}

function hasJapaneseScript(text = '') {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(String(text || ''))
}

function buildPrompt(item) {
  const headline = String(item?.headline || '').slice(0, 400)
  const summary = String(item?.summary || '').slice(0, 1600)
  return `
Translate the following financial news text into natural Japanese.
Return JSON only.
Do not add any claims or numbers not present in the source.

headline_en: ${headline}
summary_en: ${summary}

{"headline_ja":"自然な日本語見出し（最大90字）","summary_ja":"自然な日本語要約（最大320字）"}
`.trim()
}

function extractJsonObject(text = '') {
  const cleaned = String(text || '').replace(/```json|```/gi, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('No JSON object in model output')
  const core = cleaned.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1')
  return JSON.parse(core)
}

async function callGeminiTranslate(item, apiKey, model) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(item) }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1400,
      },
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const msg = String(data?.error?.message || `Gemini request failed (${response.status})`)
    throw new Error(msg)
  }
  const parts = data?.candidates?.[0]?.content?.parts
  const text = Array.isArray(parts) ? parts.map((p) => String(p?.text || '')).join('\n') : ''
  if (!text.trim()) throw new Error('Gemini returned empty response')
  const parsed = extractJsonObject(text)
  return {
    headlineJa: String(parsed?.headline_ja || '').trim().slice(0, 120),
    summaryJa: String(parsed?.summary_ja || '').trim().slice(0, 380),
  }
}

function extractAnthropicText(data = {}) {
  const blocks = Array.isArray(data?.content) ? data.content : []
  const text = blocks
    .map((b) => (b && b.type === 'text' ? String(b.text || '') : ''))
    .filter(Boolean)
    .join('\n')
    .trim()
  if (!text) throw new Error('Anthropic returned empty response')
  return text
}

async function callAnthropicTranslate(item, apiKey, model) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      temperature: 0.1,
      messages: [{ role: 'user', content: buildPrompt(item) }],
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const msg = String(data?.error?.message || `Anthropic request failed (${response.status})`)
    throw new Error(msg)
  }
  const parsed = extractJsonObject(extractAnthropicText(data))
  return {
    headlineJa: String(parsed?.headline_ja || '').trim().slice(0, 120),
    summaryJa: String(parsed?.summary_ja || '').trim().slice(0, 380),
  }
}

async function callGeminiTranslateWithFallback(item, apiKey, preferredModel) {
  const models = [...new Set([String(preferredModel || '').trim(), DEFAULT_GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS].filter(Boolean))]
  let lastErr = null
  for (const model of models) {
    try {
      return await callGeminiTranslate(item, apiKey, model)
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr || new Error('Gemini translate failed')
}

async function callAnthropicTranslateWithFallback(item, apiKey, preferredModel) {
  const models = [...new Set([String(preferredModel || '').trim(), DEFAULT_ANTHROPIC_MODEL, ...ANTHROPIC_FALLBACK_MODELS].filter(Boolean))]
  let lastErr = null
  for (const model of models) {
    try {
      return await callAnthropicTranslate(item, apiKey, model)
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr || new Error('Anthropic translate failed')
}

async function mapWithConcurrency(items, worker, concurrency = TRANSLATION_CONCURRENCY) {
  const queue = Array.isArray(items) ? items : []
  if (queue.length === 0) return []
  const limit = Math.max(1, Math.min(queue.length, Number(concurrency) || 1))
  const results = new Array(queue.length)
  let cursor = 0

  const run = async () => {
    while (cursor < queue.length) {
      const idx = cursor
      cursor += 1
      results[idx] = await worker(queue[idx], idx)
    }
  }

  await Promise.all(Array.from({ length: limit }, () => run()))
  return results
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' })
  }

  let body = {}
  try {
    body = await readJsonBody(req)
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON body' })
  }

  const rawItems = Array.isArray(body?.items) ? body.items : []
  const items = rawItems
    .map((row) => ({
      id: String(row?.id || '').trim(),
      headline: String(row?.headline || '').trim(),
      summary: String(row?.summary || '').trim(),
    }))
    .filter((row) => row.id && (row.headline || row.summary))
    .slice(0, 10)

  if (items.length === 0) return sendJson(res, 200, { translations: {} })

  const geminiKey = normalizeSecret(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY)
  const anthropicKey = normalizeSecret(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY)
  if (!geminiKey && !anthropicKey) return sendJson(res, 200, { translations: {} })
  const model = String(process.env.AI_NEWS_GEMINI_MODEL || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim() || DEFAULT_GEMINI_MODEL
  const anthropicModel = String(process.env.ANTHROPIC_CHATBOT_MODEL || process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL).trim() || DEFAULT_ANTHROPIC_MODEL

  const translations = {}
  await mapWithConcurrency(items, async (item) => {
    const sourceProbe = `${item.headline} ${item.summary}`
    if (hasJapaneseScript(sourceProbe)) return
    try {
      let t = null
      if (geminiKey) {
        try {
          t = await callGeminiTranslateWithFallback(item, geminiKey, model)
        } catch {
          t = null
        }
      }
      if (!t && anthropicKey) {
        t = await callAnthropicTranslateWithFallback(item, anthropicKey, anthropicModel)
      }
      if (!t) return
      if (t.headlineJa || t.summaryJa) {
        translations[item.id] = {
          headlineJa: t.headlineJa,
          summaryJa: t.summaryJa,
        }
      }
    } catch {
      // skip failed row; keep page responsive
    }
  })

  return sendJson(res, 200, { translations })
}

