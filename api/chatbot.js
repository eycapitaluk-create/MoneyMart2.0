/**
 * POST /api/chatbot
 * Multi-provider customer chatbot (Anthropic primary, Gemini fallback)
 *
 * Body: { message: string, messages?: { sender: 'user'|'bot', text: string }[] }
 * Response: { reply: string, usage?: { input_tokens, output_tokens } }
 */
import Anthropic from '@anthropic-ai/sdk'

const DEFAULT_MODEL = 'claude-3-5-haiku-20241022'
const DEFAULT_ANTHROPIC_FALLBACKS = [
  'claude-3-5-haiku-latest',
  'claude-3-5-sonnet-latest',
  'claude-sonnet-4-20250514',
]
const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash'
const OFF_TOPIC_REPLY = 'MoneyMartサポートは、投資・金融・税制（一般情報）およびサービス利用方法に関するご質問を中心にご案内しています。恐れ入りますが、投資・金融に関する内容（例：新NISA、ETF、積立、手数料、配当、ポートフォリオ）をご質問ください。'
const HIGH_RISK_ADVICE_REPLY = '個別銘柄の売買推奨や、いつ買う/売るべきかといった投資判断の指示はご案内できません。MoneyMartでは一般的な情報整理（制度の違い、確認ポイント、リスクの見方）をお手伝いします。必要に応じて、金融機関の公式情報や専門家へご相談ください。'
const IN_SCOPE_KEYWORDS = [
  // Japanese
  '投資', '金融', '株', '株式', '銘柄', 'ファンド', '投信', '投資信託', 'etf', 'nisa', '新nisa', 'ideco',
  '配当', '利回り', '手数料', '税金', '税務', 'ポートフォリオ', '資産', '積立', '運用', '市場', 'マーケット',
  // English
  'invest', 'investment', 'stock', 'stocks', 'fund', 'etf', 'dividend', 'portfolio', 'asset', 'market', 'tax',
  // Korean (for mixed users)
  '투자', '주식', '펀드', '배당', '세금', '포트폴리오', '자산', '시장', 'etf', 'nisa',
  // Product/support scope
  'moneymart', 'マネーマート', '회원', '가입', '로그인', 'login', 'signup', 'mypage', 'マイページ', '프리미엄', 'プレミアム',
]
const HIGH_RISK_ADVICE_KEYWORDS = [
  // Japanese
  '何を買う', '何買う', '買うべき', '売るべき', 'おすすめ銘柄', '推奨銘柄', '今買い', '今売り', '買い時', '売り時',
  'どれ買う', '利確タイミング', '損切りタイミング', 'この銘柄どう',
  // Korean
  '뭐 사', '뭘 사', '추천 종목', '추천해줘', '사도 돼', '팔아야', '매수 타이밍', '매도 타이밍', '언제 사',
  // English
  'what should i buy', 'which stock should i buy', 'buy or sell', 'should i buy', 'should i sell', 'entry point', 'exit point',
]

function modelId() {
  return String(process.env.ANTHROPIC_CHATBOT_MODEL || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL
}

function anthropicModelCandidates() {
  const preferred = modelId()
  const fromEnvRaw = String(process.env.ANTHROPIC_CHATBOT_MODEL_FALLBACKS || '').trim()
  const fromEnv = fromEnvRaw
    ? fromEnvRaw.split(',').map((s) => String(s || '').trim()).filter(Boolean)
    : DEFAULT_ANTHROPIC_FALLBACKS
  return [...new Set([preferred, ...fromEnv])]
}

function normalizeSecret(value) {
  const raw = String(value || '').trim()
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1).trim()
  }
  return raw
}

function geminiApiKey() {
  return normalizeSecret(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY)
}

function geminiModelId() {
  return String(process.env.CHATBOT_GEMINI_MODEL || process.env.AI_NEWS_GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim() || DEFAULT_GEMINI_MODEL
}

function stripMarkdownArtifacts(text = '') {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/```([\s\S]*?)```/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function isInScopeQuestion(message = '') {
  const normalized = String(message || '').toLowerCase().trim()
  if (!normalized) return false
  return IN_SCOPE_KEYWORDS.some((k) => normalized.includes(String(k).toLowerCase()))
}

function isHighRiskAdviceRequest(message = '') {
  const normalized = String(message || '').toLowerCase().trim()
  if (!normalized) return false
  return HIGH_RISK_ADVICE_KEYWORDS.some((k) => normalized.includes(String(k).toLowerCase()))
}

const SYSTEM_PROMPT = [
  'You are a customer support assistant for MoneyMart (Japan-focused personal finance web service).',
  'Respond in Japanese unless the user writes clearly in another language; then mirror their language briefly or use Japanese with a short note.',
  'Scope: general education on investing, ETFs, funds, taxes at a high level, platform usage, and how to find information on the site.',
  'Tone: polite, concise, practical. Use bullet lists when it helps readability.',
  'Do not provide personalized legal, tax, or investment advice that could be construed as a recommendation to buy/sell specific securities for this user.',
  'Do not guarantee outcomes. For tax and regulations, tell the user to confirm with qualified professionals and official sources (e.g. 国税庁, 金融庁).',
  'You cannot see the user\'s account balance, holdings, or private data. If asked, explain that limitation and suggest using My Page or official statements.',
  'If unsure, say you are not sure rather than inventing facts.',
].join(' ')

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
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

function toAnthropicMessages(history, latestUserText) {
  const out = []
  const list = Array.isArray(history) ? history.slice(-24) : []
  for (const m of list) {
    const text = String(m?.text ?? '').trim()
    if (!text) continue
    const sender = String(m?.sender || m?.role || 'user').toLowerCase()
    const role = sender === 'bot' || sender === 'assistant' ? 'assistant' : 'user'
    const last = out[out.length - 1]
    if (last && last.role === role) {
      if (role === 'user') last.content = `${last.content}\n\n${text}`
      else last.content = `${last.content}\n\n${text}`
    } else {
      out.push({ role, content: text })
    }
  }
  if (!latestUserText) return out
  const last = out[out.length - 1]
  if (last && last.role === 'user') {
    last.content = last.content ? `${last.content}\n\n${latestUserText}` : latestUserText
  } else {
    out.push({ role: 'user', content: latestUserText })
  }
  return out
}

function shouldTryAnthropicNextModel(error) {
  const msg = String(error?.message || error || '')
  return /not[_\s-]?found|invalid[_\s-]?request|unsupported|model/i.test(msg)
}

async function callAnthropicWithFallback({ apiKey, messages }) {
  const client = new Anthropic({ apiKey })
  const tried = []
  let lastError = null
  for (const model of anthropicModelCandidates()) {
    tried.push(model)
    try {
      const resp = await client.messages.create({
        model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages,
      })
      const textBlock = (resp.content || []).find((b) => b.type === 'text')
      const reply = textBlock && textBlock.type === 'text'
        ? stripMarkdownArtifacts(String(textBlock.text || ''))
        : ''
      if (!reply) throw new Error('モデルから本文が返りませんでした。')
      const usage = resp.usage
        ? { input_tokens: resp.usage.input_tokens, output_tokens: resp.usage.output_tokens }
        : undefined
      return { reply, usage, provider: 'anthropic', model }
    } catch (error) {
      lastError = error
      if (!shouldTryAnthropicNextModel(error)) break
    }
  }
  const e = new Error(`Anthropic failed (tried: ${tried.join(', ')})`)
  e.cause = lastError
  throw e
}

async function callGemini({ apiKey, messages }) {
  const model = geminiModelId()
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content || '') }],
  }))
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const msg = String(data?.error?.message || `Gemini request failed (${response.status})`)
    throw new Error(msg)
  }
  const parts = data?.candidates?.[0]?.content?.parts
  const reply = Array.isArray(parts)
    ? stripMarkdownArtifacts(parts.map((p) => String(p?.text || '')).join('\n'))
    : ''
  if (!reply) throw new Error('Gemini response was empty')
  return { reply, provider: 'gemini', model }
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

  const message = String(body?.message || '').trim()
  if (!message) {
    return sendJson(res, 400, { error: 'message is required' })
  }
  if (isHighRiskAdviceRequest(message)) {
    return sendJson(res, 200, { reply: HIGH_RISK_ADVICE_REPLY, provider: 'rule', model: 'risk-guard-v1' })
  }
  if (!isInScopeQuestion(message)) {
    return sendJson(res, 200, { reply: OFF_TOPIC_REPLY, provider: 'rule', model: 'scope-guard-v1' })
  }

  const anthropicKey = normalizeSecret(process.env.ANTHROPIC_API_KEY)
  const geminiKey = geminiApiKey()
  if (!anthropicKey && !geminiKey) {
    return sendJson(res, 503, {
      error: 'チャットAPIキーが設定されていません。サーバー設定を確認してください。',
    })
  }

  const history = Array.isArray(body?.messages) ? body.messages : []
  const anthropicMessages = toAnthropicMessages(history, message)

  if (anthropicMessages.length === 0 || anthropicMessages[anthropicMessages.length - 1].role !== 'user') {
    return sendJson(res, 400, { error: 'Invalid message sequence' })
  }

  try {
    if (anthropicKey) {
      try {
        const result = await callAnthropicWithFallback({ apiKey: anthropicKey, messages: anthropicMessages })
        return sendJson(res, 200, { reply: result.reply, usage: result.usage, provider: result.provider, model: result.model })
      } catch (anthropicError) {
        if (!geminiKey) throw anthropicError
        // Continue to Gemini fallback.
      }
    }
    const geminiResult = await callGemini({ apiKey: geminiKey, messages: anthropicMessages })
    return sendJson(res, 200, { reply: geminiResult.reply, provider: geminiResult.provider, model: geminiResult.model })
  } catch (error) {
    const msg = String(error?.message || error || 'Chat request failed')
    const status = /401|403|invalid api key|permission|unauthorized/i.test(msg) ? 401 : 500
    console.error('[chatbot] provider request failed:', msg)
    return sendJson(res, status, {
      error: '現在チャット応答を生成できません。しばらくしてから再度お試しください。',
    })
  }
}
