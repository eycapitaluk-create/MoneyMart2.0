/**
 * ai_news_summaries 상세 확인
 */
import fs from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const loadEnv = async () => {
  for (const f of ['.env.local', '.env']) {
    try {
      const raw = await fs.readFile(f, 'utf8')
      for (const line of raw.split(/\r?\n/)) {
        const t = line.trim()
        if (!t || t.startsWith('#') || !t.includes('=')) continue
        const eq = t.indexOf('=')
        const k = t.slice(0, eq).trim()
        const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
        if (k && !process.env[k]) process.env[k] = v
      }
    } catch {}
  }
}

const run = async () => {
  await loadEnv()
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  )

  const { count: total } = await supabase
    .from('ai_news_summaries')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recent } = await supabase
    .from('ai_news_summaries')
    .select('id,headline,ticker,company_name,updated_at,published_at')
    .eq('is_active', true)
    .gte('updated_at', weekAgo)
    .order('updated_at', { ascending: false })
    .limit(30)

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: last24h } = await supabase
    .from('ai_news_summaries')
    .select('id')
    .eq('is_active', true)
    .gte('updated_at', dayAgo)

  console.log('\n=== ai_news_summaries 상세 ===\n')
  console.log('전체 활성 건수:', total)
  console.log('최근 24시간 내 갱신:', (last24h || []).length, '건')
  console.log('최근 7일 내 갱신:', (recent || []).length, '건\n')
  console.log('최근 항목 (updated_at 기준):')
  ;(recent || []).slice(0, 15).forEach((r, i) => {
    const h = (r.headline || '').slice(0, 45)
    console.log(`  ${i + 1}. [${r.ticker}] ${h}${h.length >= 45 ? '...' : ''}`)
    console.log(`      updated: ${r.updated_at}`)
  })
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
