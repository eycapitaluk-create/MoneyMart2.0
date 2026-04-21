/**
 * 뉴스 수집 상태 확인
 * 실행: node scripts/check-news-status.mjs
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
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or key. Set .env.local')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const today = new Date().toISOString().slice(0, 10)
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // news_manual (market-news cron)
  const { data: manualRows, error: manualErr } = await supabase
    .from('news_manual')
    .select('id,bucket,title,source,updated_at,published_at')
    .in('bucket', ['market_ticker', 'market_pickup', 'fund_pickup', 'stock_disclosures', 'daily_brief'])
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (manualErr) {
    console.error('news_manual error:', manualErr.message)
    return
  }

  const byBucket = {}
  let latestManual = null
  for (const row of manualRows || []) {
    byBucket[row.bucket] = (byBucket[row.bucket] || 0) + 1
    if (!latestManual || new Date(row.updated_at) > new Date(latestManual)) {
      latestManual = row.updated_at
    }
  }

  // ai_news_summaries (ai-news cron)
  const { data: aiRows, error: aiErr } = await supabase
    .from('ai_news_summaries')
    .select('id,headline,source,published_at,updated_at')
    .eq('is_active', true)
    .gte('published_at', threeDaysAgo)
    .order('published_at', { ascending: false })
    .limit(20)

  if (aiErr) {
    console.error('ai_news_summaries error:', aiErr.message)
  }

  let latestAi = null
  for (const row of aiRows || []) {
    if (!latestAi || new Date(row.updated_at) > new Date(latestAi)) {
      latestAi = row.updated_at
    }
  }

  console.log('\n📰 뉴스 수집 상태\n')
  console.log('=== news_manual (market-news cron) ===')
  console.log(`  최근 갱신: ${latestManual ? new Date(latestManual).toLocaleString('ja-JP') : '-'}`)
  console.log(`  bucket별 건수:`, byBucket)
  console.log(`  총: ${(manualRows || []).length}건 (최근 50건)\n`)

  console.log('=== ai_news_summaries (ai-news cron) ===')
  console.log(`  최근 갱신: ${latestAi ? new Date(latestAi).toLocaleString('ja-JP') : '-'}`)
  console.log(`  최근 3일: ${(aiRows || []).length}건\n`)

  if (latestManual) {
    const hoursSince = (Date.now() - new Date(latestManual).getTime()) / (1000 * 60 * 60)
    if (hoursSince > 24) {
      console.log('⚠️  news_manual이 24시간 이상 갱신되지 않았습니다. market-news cron 확인 필요.')
    } else {
      console.log('✅ 뉴스 수집 정상 (market-news)')
    }
  } else {
    console.log('⚠️  news_manual 데이터 없음. cron 미실행 또는 API 키 확인 필요.')
  }

  console.log('\nCron 스케줄: 22:00, 10:00 UTC (GitHub Actions → /api/cron/market-news, /api/cron/ai-news)')
  console.log('필요 env: THENEWSAPI_API_TOKEN 또는 NEWSDATA_API_KEY, ANTHROPIC_API_KEY(ai-news)\n')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
