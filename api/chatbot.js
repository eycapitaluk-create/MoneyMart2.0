import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `당신은 MoneyMart 고객 서비스 AI 챗봇입니다.
금융 및 투자 서비스에 대한 일반적인 질문에 친절하고 정보를 제공하며 답변합니다.

특징:
- 한국어와 영어로 유창하게 대응
- 친절하고 전문적인 톤 유지
- 투자 조언을 할 때는 면책 조항 추가
- 구체적인 계정 정보나 거래 내역은 Supabase 기반 인간 에이전트에게 전달 필요
- 간결하고 명확한 답변 제공

지원 범위:
- 상품 및 서비스 설명
- 일반적인 금융 상식
- 투자 기초 개념
- 계정 문제 해결 (사용자 인증 필요시)
- 기술적 문제 해결

특정 계정이나 거래 정보는 담당자 연결이 필요합니다.`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { messages } = req.body

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Missing or invalid messages' })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
    }

    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    })

    const assistantMessage = response.content[0]?.text || ''

    return res.status(200).json({
      ok: true,
      message: assistantMessage,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    })
  } catch (error) {
    console.error('Chatbot API error:', error)
    return res.status(500).json({
      error: 'Failed to process message',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    })
  }
}
