import { createClient } from '@supabase/supabase-js'

function sendJson(res, status, payload) {
  if (typeof res.status === 'function') {
    return res.status(status).json(payload)
  }
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

async function verifyCronOrAdmin(req, adminClient) {
  const authHeader = String(req.headers.authorization || '')
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) {
    return { ok: false, status: 401, payload: { ok: false, error: 'Unauthorized' } }
  }

  const cronSecret = normalizeSecret(process.env.CRON_SECRET)
  if (cronSecret && token === cronSecret) {
    return { ok: true }
  }

  const { data: userData, error: userErr } = await adminClient.auth.getUser(token)
  if (userErr || !userData?.user) {
    return { ok: false, status: 401, payload: { ok: false, error: 'Unauthorized' } }
  }

  const { data: roleData, error: roleErr } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userData.user.id)
    .maybeSingle()
  if (roleErr) {
    return { ok: false, status: 500, payload: { ok: false, error: 'Failed to verify role' } }
  }
  if (roleData?.role !== 'admin') {
    return { ok: false, status: 403, payload: { ok: false, error: 'Forbidden' } }
  }
  return { ok: true }
}

const DIGEST_BUCKET = 'community_digest'
const NEWS_SOURCE_BUCKETS = ['market_pickup', 'fund_pickup', 'stock_disclosures', 'daily_brief']

const toJstHour = (date = new Date()) => {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    hour12: false,
  })
  return Number(fmt.format(date))
}

const getSlot = (date = new Date()) => (toJstHour(date) < 12 ? 'am' : 'pm')

const buildTaxShieldLine = (stats = null) => {
  if (!stats) return '・Tax-Shield: 本日の節税シグナルは集計準備中です。'
  const opportunity = Number(stats.opportunity || 0)
  const deadlineSoon = Number(stats.deadlineSoon || 0)
  const overLimit = Number(stats.overLimit || 0)
  const optimized = Number(stats.optimized || 0)
  const total = opportunity + deadlineSoon + overLimit + optimized
  if (total === 0) return '・Tax-Shield: 本日はシグナルなし。iDeCo/NISAの設定をマイページで確認できます。'
  return `・Tax-Shield: 💚節税機会 ${opportunity} / ⏰締切注意 ${deadlineSoon} / 🚨上限超過 ${overLimit} / ✅最適化済み ${optimized}`
}

const buildCashFlowLine = (stats = null) => {
  if (!stats) return '・Cash Flow: 本日の遊休現金シグナルは集計準備中です。'
  const opportunity = Number(stats.opportunity || 0)
  const shortage = Number(stats.shortage || 0)
  const optimized = Number(stats.optimized || 0)
  const total = opportunity + shortage + optimized
  if (total === 0) return '・Cash Flow: 本日は遊休現金シグナルなし。'
  return `・Cash Flow: 💸移動余地あり ${opportunity} / ⚠️要注意 ${shortage} / ✅最適化済み ${optimized}`
}

const buildSummary = (newsRows = [], taxShieldStats = null, cashFlowStats = null) => {
  if (!Array.isArray(newsRows) || newsRows.length === 0) {
    return [
      '・本日の経済/金融ニュースは更新準備中です。',
      buildTaxShieldLine(taxShieldStats),
      buildCashFlowLine(cashFlowStats),
      '・次回更新（午前/午後）までしばらくお待ちください。',
    ].join('\n')
  }

  const text = newsRows.map((r) => String(r.title || '')).join(' ').toLowerCase()
  let macro = '・マクロ: 市場全体は様子見ムード。主要指標と中央銀行発言に注目。'
  if (/(利上げ|利下げ|金利|日銀|frb|fomc|インフレ|cpi|雇用統計)/.test(text)) {
    macro = '・マクロ: 金利・インフレ関連ヘッドラインが中心。政策スタンスの変化に注意。'
  } else if (/(決算|業績|ガイダンス|売上|利益)/.test(text)) {
    macro = '・企業: 決算/業績ニュースが主導。セクターごとの強弱が出やすい局面。'
  } else if (/(為替|円安|円高|ドル円)/.test(text)) {
    macro = '・為替: 為替材料への反応が強め。輸出入関連セクターの値動きに注意。'
  }

  const rawTitles = newsRows.slice(0, 3).map((r) => String(r.title || '').replace(/\s+/g, ' ').replace(/\s*\(VAGUE\)\s*/gi, '').trim()).filter(Boolean)
  const seen = new Set()
  const topTitles = rawTitles.filter((t) => {
    if (!t || seen.has(t)) return false
    seen.add(t)
    return true
  }).slice(0, 2)
  const oneLiner = (t) => (t.length > 72 ? t.slice(0, 72) + '…' : t)
  const highlights = topTitles.length > 0
    ? `・主要トピック: ${topTitles.map(oneLiner).join(' / ')}`
    : '・主要トピック: 更新直後のため要約対象を収集中です。'

  return [macro, highlights, buildTaxShieldLine(taxShieldStats), buildCashFlowLine(cashFlowStats)].join('\n')
}

const aggregateTaxShieldStats = (rows = []) => {
  const base = { opportunity: 0, deadlineSoon: 0, overLimit: 0, optimized: 0 }
  if (!Array.isArray(rows) || rows.length === 0) return base
  rows.forEach((row) => {
    const status = String(row?.status || '')
    if (status === 'opportunity') base.opportunity += 1
    if (status === 'deadline_soon') base.deadlineSoon += 1
    if (status === 'limit_exceeded') base.overLimit += 1
    if (status === 'optimized') base.optimized += 1
  })
  return base
}

const aggregateCashFlowStats = (rows = []) => {
  const base = { opportunity: 0, shortage: 0, optimized: 0 }
  if (!Array.isArray(rows) || rows.length === 0) return base
  rows.forEach((row) => {
    const status = String(row?.status || '')
    if (status === 'opportunity') base.opportunity += 1
    if (status === 'buffer_shortage') base.shortage += 1
    if (status === 'optimized') base.optimized += 1
  })
  return base
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return sendJson(res, 500, { ok: false, error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const authResult = await verifyCronOrAdmin(req, adminClient)
  if (!authResult.ok) {
    return sendJson(res, authResult.status, authResult.payload)
  }

  try {
    const slot = getSlot(new Date())

    const { data: newsRows, error: newsErr } = await adminClient
      .from('news_manual')
      .select('bucket,title,description,published_at,updated_at,is_active')
      .in('bucket', NEWS_SOURCE_BUCKETS)
      .eq('is_active', true)
      .order('published_at', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(30)
    if (newsErr) throw newsErr

    // Latest simulation per user in recent window (anonymized aggregate for digest)
    let taxShieldStats = null
    const taxShieldSince = new Date(Date.now() - (1000 * 60 * 60 * 24 * 45)).toISOString()
    const { data: taxShieldRows, error: taxShieldErr } = await adminClient
      .from('tax_shield_simulations')
      .select('user_id,status,created_at')
      .gte('created_at', taxShieldSince)
      .order('created_at', { ascending: false })
      .limit(1500)
    if (!taxShieldErr && Array.isArray(taxShieldRows)) {
      const latestByUser = new Map()
      taxShieldRows.forEach((row) => {
        const uid = String(row?.user_id || '')
        if (!uid || latestByUser.has(uid)) return
        latestByUser.set(uid, row)
      })
      taxShieldStats = aggregateTaxShieldStats(Array.from(latestByUser.values()))
    }

    let cashFlowStats = null
    const { data: cashFlowRows, error: cashFlowErr } = await adminClient
      .from('cashflow_optimizer_simulations')
      .select('user_id,status,created_at')
      .gte('created_at', taxShieldSince)
      .order('created_at', { ascending: false })
      .limit(1500)
    if (!cashFlowErr && Array.isArray(cashFlowRows)) {
      const latestByUser = new Map()
      cashFlowRows.forEach((row) => {
        const uid = String(row?.user_id || '')
        if (!uid || latestByUser.has(uid)) return
        latestByUser.set(uid, row)
      })
      cashFlowStats = aggregateCashFlowStats(Array.from(latestByUser.values()))
    }

    const summary = buildSummary(newsRows || [], taxShieldStats, cashFlowStats)
    const nowIso = new Date().toISOString()
    const rows = [
      {
        bucket: DIGEST_BUCKET,
        sort_order: 1,
        source: `lounge-${slot}`,
        title: slot === 'am' ? 'その日のキー要約（午前版）' : 'その日のキー要約（午後版）',
        description: summary,
        url: '',
        image_url: '',
        topic: 'Lounge Digest',
        time_text: slot === 'am' ? '09:00 JST' : '18:00 JST',
        language: 'ja',
        published_at: nowIso,
        tone: 'neutral',
        is_active: true,
        updated_at: nowIso,
      },
      {
        bucket: DIGEST_BUCKET,
        sort_order: 2,
        source: `lounge-${slot}`,
        title: 'Tax-Shield 今日の節税シグナル',
        description: buildTaxShieldLine(taxShieldStats),
        url: '/mypage?tab=coach',
        image_url: '',
        topic: 'Tax Shield',
        time_text: '',
        language: 'ja',
        published_at: nowIso,
        tone: 'neutral',
        is_active: true,
        updated_at: nowIso,
      },
      {
        bucket: DIGEST_BUCKET,
        sort_order: 3,
        source: `lounge-${slot}`,
        title: 'Cash Flow Optimizer 今日の資金配置シグナル',
        description: buildCashFlowLine(cashFlowStats),
        url: '/mypage?tab=coach',
        image_url: '',
        topic: 'Cash Flow Optimizer',
        time_text: '',
        language: 'ja',
        published_at: nowIso,
        tone: 'neutral',
        is_active: true,
        updated_at: nowIso,
      },
    ]

    const { error: delErr } = await adminClient
      .from('news_manual')
      .delete()
      .eq('bucket', DIGEST_BUCKET)
    if (delErr) throw delErr

    const { error: insErr } = await adminClient
      .from('news_manual')
      .insert(rows)
    if (insErr) throw insErr

    return sendJson(res, 200, { ok: true, slot, inserted: rows.length })
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: error?.message || 'digest generation failed' })
  }
}
