const SYSTEM_PROMPT = [
  'You are MoneyMart AI assistant.',
  'Respond in Japanese by default.',
  'Keep answers concise and practical for personal finance users.',
  'Do not provide legal/tax guarantees. Suggest users verify latest official sources.',
  'If asked about unavailable account-specific data, state limitation clearly.',
].join(' ')

const toText = (value) => String(value || '').trim()

/** Ollama (OpenAI-compatible). Returns { reply } or null on failure. */
async function callOllama(message, messages, env = process.env) {
  const base = toText(env.OLLAMA_BASE_URL || env.VITE_OLLAMA_BASE_URL)
  if (!base) return null
  const model = toText(env.OLLAMA_MODEL || env.VITE_OLLAMA_MODEL || 'qwen2.5:7b-instruct')
  const recent = Array.isArray(messages) ? messages.slice(-10) : []
  const ollamaMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...recent.map((m) => ({
      role: m?.sender === 'bot' ? 'assistant' : 'user',
      content: toText(m?.text),
    })),
    { role: 'user', content: message },
  ].filter((m) => m.content !== '')

  const url = `${base.replace(/\/$/, '')}/v1/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: ollamaMessages,
      stream: false,
      max_tokens: 420,
      temperature: 0.4,
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  const text = toText(data?.choices?.[0]?.message?.content)
  return text ? { reply: text } : null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { message, messages } = req.body || {}
    const userMessage = toText(message)
    if (!userMessage) return res.status(400).json({ error: 'message is required' })

    const result = await callOllama(userMessage, messages)
    if (result) return res.status(200).json(result)

    const base = toText(process.env.OLLAMA_BASE_URL || process.env.VITE_OLLAMA_BASE_URL)
    if (!base) {
      return res.status(503).json({
        error: 'OLLAMA_BASE_URL を設定してください。チャットは自社AI（Ollama）のみ利用可能です。',
      })
    }
    return res.status(503).json({
      error: 'AIが一時的に利用できません。Ollamaが起動しているか確認してください。',
    })
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Unexpected error' })
  }
}
