/**
 * 顧客チャット: /api/chatbot（Claude Haiku）へ POST
 * @param {string} message
 * @param {{ sender: 'user' | 'bot', text: string }[]} messages 直近の会話（クライアント保持）
 * @returns {Promise<{ reply: string, usage?: { input_tokens: number, output_tokens: number } }>}
 */
export async function sendChatbotMessage(message, messages = []) {
  const res = await fetch('/api/chatbot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: String(message || '').trim(),
      messages: Array.isArray(messages) ? messages : [],
    }),
  })
  let data = {}
  try {
    data = await res.json()
  } catch {
    data = {}
  }
  if (!res.ok) {
    const serverError = String(data?.error || '').trim()
    const knownAuthError = /api key|unauthorized|forbidden|permission|401|403/i.test(serverError)
    if (knownAuthError) {
      throw new Error('チャット接続設定に問題があります。管理者にお問い合わせください。')
    }
    const err = serverError || `HTTP ${res.status}`
    throw new Error(typeof err === 'string' ? err : '現在チャットを利用できません。しばらくしてからお試しください。')
  }
  const reply = String(data?.reply || '').trim()
  if (!reply) throw new Error('応答が空でした')
  return { reply, usage: data?.usage }
}
