import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const auth = req.headers.authorization || ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const { data: rows, error } = await supabase
    .from('ai_news_summaries')
    .select('id, ticker, company_name, headline, summary, reason')
    .order('published_at', { ascending: false })
    .limit(30)

  if (error) return res.status(500).json({ ok: false, error: error.message })

  const needsSummary = (rows || []).filter(
    (r) => !r.summary || r.reason?.includes('短縮表示') || r.summary.length > 200
  )

  let updated = 0
  for (const row of needsSummary) {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `以下のニュースを日本語で3文以内に要約してください。投資家向けに簡潔・中立的に。\n\n銘柄: ${row.ticker} (${row.company_name})\n見出し: ${row.headline}\n内容: ${row.summary}\n\n日本語要約のみ出力:`,
        }],
      })
      const jaSummary = msg.content[0]?.text?.trim() || ''
      if (!jaSummary) continue
      await supabase
        .from('ai_news_summaries')
        .update({ summary: jaSummary, reason: 'AI要約済み', updated_at: new Date().toISOString() })
        .eq('id', row.id)
      updated++
      await new Promise((r) => setTimeout(r, 300))
    } catch (e) {
      console.error(`Failed ${row.ticker}:`, e.message)
    }
  }

  return res.status(200).json({ ok: true, updated, total: needsSummary.length })
}
