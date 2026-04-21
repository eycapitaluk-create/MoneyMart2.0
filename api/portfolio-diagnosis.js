import { createClient } from '@supabase/supabase-js'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'

function normalizeSecret(value) {
  const raw = String(value || '').trim()
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1).trim()
  }
  return raw
}

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
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function safeNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/** 保有があるのに総合0点になると誤解を招くため、極端な集中でも下限を設ける */
const MIN_DIAGNOSIS_SCORE = 22

function getGrade(score) {
  const s = clamp(safeNumber(score, 0), 0, 100)
  if (s >= 90) return 'A+'
  if (s >= 80) return 'A'
  if (s >= 70) return 'B+'
  if (s >= 60) return 'B'
  if (s >= 50) return 'C'
  return 'D'
}

function extractJsonObject(text = '') {
  const cleaned = String(text).replace(/```json|```/gi, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1))
    }
    throw new Error('Claude response was not valid JSON')
  }
}

/** Plain-text labels sometimes arrive HTML-escaped from DB (e.g. S&amp;P). */
function decodeHtmlEntities(value = '') {
  const s = String(value ?? '')
  if (!s || !/&[#a-z0-9]+;/i.test(s)) return s
  return s
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x([0-9a-f]{1,6});/gi, (full, h) => {
      const code = parseInt(h, 16)
      if (!Number.isFinite(code) || code < 0) return full
      try {
        return String.fromCodePoint(code)
      } catch {
        return full
      }
    })
    .replace(/&#(\d{1,7});/g, (full, d) => {
      const code = parseInt(d, 10)
      if (!Number.isFinite(code) || code < 0) return full
      try {
        return String.fromCodePoint(code)
      } catch {
        return full
      }
    })
}

function normalizeHoldings(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      ticker: String(row?.ticker || row?.symbol || '').trim().slice(0, 30),
      name: decodeHtmlEntities(String(row?.name || row?.ticker || '').trim()).slice(0, 80),
      flag: String(row?.flag || '').trim().slice(0, 8),
      sector: String(row?.sector || 'その他').trim().slice(0, 40),
      category: String(row?.category || '資産').trim().slice(0, 40),
      value: Math.max(0, safeNumber(row?.value, 0)),
      weight: Math.max(0, safeNumber(row?.weight, 0)),
    }))
    .filter((row) => row.ticker && row.name && row.value > 0)
}

function inferRegionFromHolding(row) {
  const flag = String(row?.flag || '')
  if (flag.includes('🇯🇵')) return '日本'
  if (flag.includes('🇺🇸')) return '米国'
  if (flag.includes('🇬🇧')) return '英国'
  if (flag.includes('🇪🇺')) return '欧州'

  const category = String(row?.category || '')
  const sector = String(row?.sector || '')
  const merged = `${category} ${sector}`.toLowerCase()
  if (/日本|国内|jp/.test(merged)) return '日本'
  if (/米国|us|usa/.test(merged)) return '米国'
  if (/英国|uk/.test(merged)) return '英国'
  if (/欧州|eu/.test(merged)) return '欧州'
  return 'その他'
}

function buildDistribution(holdings, keyGetter) {
  const map = new Map()
  const total = holdings.reduce((sum, row) => sum + Number(row.value || 0), 0)
  if (total <= 0) return []

  holdings.forEach((row) => {
    const key = String(keyGetter(row) || 'その他').trim() || 'その他'
    map.set(key, (map.get(key) || 0) + Number(row.value || 0))
  })
  return Array.from(map.entries())
    .map(([name, amount]) => ({ name, pct: (amount / total) * 100 }))
    .sort((a, b) => b.pct - a.pct)
}

function scoreFromDistribution(distribution, targetEffectiveCount) {
  if (!Array.isArray(distribution) || distribution.length === 0) return 0
  const weights = distribution.map((d) => clamp(Number(d.pct || 0) / 100, 0, 1))
  const hhi = weights.reduce((sum, p) => sum + (p ** 2), 0)
  const effectiveCount = hhi > 0 ? 1 / hhi : 1
  const top1 = Math.max(...distribution.map((d) => Number(d.pct || 0)), 0)
  const base = Math.min(100, (effectiveCount / Math.max(1, targetEffectiveCount)) * 100)
  const concentrationPenalty = top1 >= 70 ? 35 : top1 >= 55 ? 22 : top1 >= 45 ? 10 : 0
  const countBonus = distribution.length >= targetEffectiveCount ? 5 : 0
  return clamp(Math.round(base - concentrationPenalty + countBonus), 0, 100)
}

function getDeterministicSummary(score, top1Weight) {
  if (score >= 80) return '分散バランスは良好です'
  if (score >= 65) return top1Weight >= 40 ? '概ね良好だが集中注意' : '改善余地はあるが安定'
  if (score >= 50) return '集中リスクの改善が必要'
  return '集中リスクが高い構成です'
}

function buildDeterministicDiagnosis({ holdings, scopeLabel }) {
  const totalValue = holdings.reduce((sum, row) => sum + Number(row.value || 0), 0)
  const normalized = holdings
    .map((row) => ({
      ...row,
      weight: totalValue > 0 ? (Number(row.value || 0) / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.weight - a.weight)

  const top1Weight = Number(normalized[0]?.weight || 0)
  const top3Weight = normalized.slice(0, 3).reduce((sum, row) => sum + Number(row.weight || 0), 0)
  const sectorDist = buildDistribution(normalized, (row) => row.sector || 'その他')
  const assetDist = buildDistribution(normalized, (row) => row.category || '資産')
  const geoDist = buildDistribution(normalized, (row) => inferRegionFromHolding(row))

  const sectorScore = scoreFromDistribution(sectorDist, 6)
  const assetScore = scoreFromDistribution(assetDist, 3)
  const geographicScore = scoreFromDistribution(geoDist, 4)

  let score = Math.round((sectorScore * 0.45) + (geographicScore * 0.35) + (assetScore * 0.2))
  if (normalized.length < 4) score -= 8
  if (top1Weight >= 55) score -= 12
  else if (top1Weight >= 40) score -= 6
  if (top3Weight >= 80) score -= 6
  score = clamp(score, MIN_DIAGNOSIS_SCORE, 100)

  const strengths = []
  const weaknesses = []
  const risks = []
  const actions = []

  if (sectorScore >= 70) strengths.push('セクター配分が比較的分散され、単一業種依存が抑えられています。')
  if (geographicScore >= 70) strengths.push('地域分散が効いており、単一国ショックへの耐性があります。')
  if (assetScore >= 70) strengths.push('資産カテゴリの分散が効いており、値動きの偏りを抑えています。')
  if (top1Weight < 30) strengths.push('最大保有比率が抑えられており、個別銘柄リスクが過度ではありません。')

  if (top1Weight >= 45) {
    weaknesses.push(`最大保有の比率が${top1Weight.toFixed(1)}%と高く、単一資産への集中が見られます。`)
    risks.push({
      type: '単一銘柄集中',
      level: top1Weight >= 55 ? '高' : '中',
      desc: '最大保有銘柄の値動きがポートフォリオ全体を大きく左右します。',
    })
    actions.push({ priority: '即時', action: '最大保有銘柄の比率を段階的に圧縮し、複数銘柄へ分散してください。' })
  }

  if (sectorDist.length <= 2) {
    weaknesses.push('セクター数が少なく、業種要因による同方向下落の影響を受けやすい構成です。')
    risks.push({
      type: 'セクター偏重',
      level: '中',
      desc: '同一業種の悪材料が同時に効くと、下落幅が拡大しやすくなります。',
    })
    actions.push({ priority: '短期', action: '相関の低いセクターを1-2つ追加し、業種分散を強化してください。' })
  }

  if (geoDist.length <= 1) {
    weaknesses.push('地域分散が弱く、単一国の政策・景気変動リスクに偏っています。')
    risks.push({
      type: '地域集中',
      level: '中',
      desc: '単一地域の金利・為替・景気イベントにパフォーマンスが偏ります。',
    })
    actions.push({ priority: '短期', action: '投資先地域を分け、国内外の比率バランスを再調整してください。' })
  }

  if (assetDist.length <= 1) {
    weaknesses.push('資産カテゴリが単一寄りで、局面転換時のクッションが不足しています。')
    risks.push({
      type: '資産クラス偏重',
      level: '中',
      desc: '同じ資産クラスの下落局面で逃げ場が少なくなる可能性があります。',
    })
    actions.push({ priority: '長期', action: '株式・ファンドなど異なる資産クラスの比率を設計して維持してください。' })
  }

  if (strengths.length === 0) strengths.push('保有データを継続的に更新している点は、改善サイクル構築に有効です。')
  if (weaknesses.length === 0) weaknesses.push('大きな偏りは見えませんが、相場変化に応じた定期リバランスが必要です。')
  if (risks.length === 0) {
    risks.push({
      type: 'リバランス遅延',
      level: '低',
      desc: '相場上昇局面では意図せず比率が偏るため、定期的な再配分が必要です。',
    })
  }
  if (actions.length === 0) {
    actions.push({ priority: '長期', action: '四半期ごとに比率を点検し、目標配分からの乖離を補正してください。' })
  }

  return {
    scopeLabel,
    totalValue,
    holdings: normalized,
    score,
    grade: getGrade(score),
    summary: getDeterministicSummary(score, top1Weight),
    strengths: strengths.slice(0, 4),
    weaknesses: weaknesses.slice(0, 4),
    risks: risks.slice(0, 4),
    actions: actions.slice(0, 4),
    diversification: {
      geographic: geographicScore,
      sector: sectorScore,
      asset: assetScore,
    },
    comment: `分析対象は${normalized.length}件、最大保有比率は${top1Weight.toFixed(1)}%です。分散スコアは地域${geographicScore}・セクター${sectorScore}・資産${assetScore}で、総合スコアは${score}点です。`,
  }
}

function buildQualitativePrompt({ diagnosis }) {
  const holdingsSummary = diagnosis.holdings
    .slice(0, 12)
    .map((h) => `${h.name}(${h.ticker}) ${h.weight.toFixed(1)}% [${h.sector}/${h.category}]`)
    .join(', ')

  const summary = holdingsSummary || 'なし'

  return `
You are MoneyMart's portfolio analyst.
Return JSON only. No markdown, no prose outside JSON.
Write all user-facing strings in Japanese.

Important:
- Do NOT change numeric scores, grade, or diversification numbers.
- Rewrite only user-facing qualitative text so it is clearer and practical.

Scope: ${diagnosis.scopeLabel}
Portfolio: ${summary}
Total market value: ${Math.round(diagnosis.totalValue).toLocaleString()} JPY

Locked metrics:
- score: ${diagnosis.score}
- grade: ${diagnosis.grade}
- diversification.geographic: ${diagnosis.diversification.geographic}
- diversification.sector: ${diagnosis.diversification.sector}
- diversification.asset: ${diagnosis.diversification.asset}

Current strengths: ${JSON.stringify(diagnosis.strengths)}
Current weaknesses: ${JSON.stringify(diagnosis.weaknesses)}
Current risks: ${JSON.stringify(diagnosis.risks)}
Current actions: ${JSON.stringify(diagnosis.actions)}

Return exactly this shape:
{
  "summary": "25文字以内の一言要約",
  "strengths": ["強み1", "強み2", "強み3"],
  "weaknesses": ["弱み1", "弱み2"],
  "risks": [
    {"type": "リスク名", "level": "高/中/低", "desc": "説明1文"}
  ],
  "actions": [
    {"priority": "即時/短期/長期", "action": "具体的な改善行動1文"}
  ],
  "comment": "2-3文の総評"
}
`.trim()
}

function sanitizeQualitative(payload) {
  const risks = Array.isArray(payload?.risks) ? payload.risks.slice(0, 4).map((row) => ({
    type: String(row?.type || '集中リスク').slice(0, 40),
    level: ['高', '中', '低'].includes(String(row?.level || '')) ? String(row.level) : '中',
    desc: String(row?.desc || '').slice(0, 140),
  })) : []
  const actions = Array.isArray(payload?.actions) ? payload.actions.slice(0, 4).map((row) => ({
    priority: ['即時', '短期', '長期'].includes(String(row?.priority || '')) ? String(row.priority) : '短期',
    action: String(row?.action || '').slice(0, 140),
  })) : []

  return {
    summary: String(payload?.summary || '').slice(0, 60),
    strengths: Array.isArray(payload?.strengths) ? payload.strengths.slice(0, 4).map((x) => String(x).slice(0, 100)) : [],
    weaknesses: Array.isArray(payload?.weaknesses) ? payload.weaknesses.slice(0, 4).map((x) => String(x).slice(0, 100)) : [],
    risks,
    actions,
    comment: String(payload?.comment || '').slice(0, 300),
  }
}

const AGGRESSIVE_TONE_PATTERNS = [
  /urgent(ly)?/gi,
  /danger(ous)?/gi,
  /immediately/gi,
  /must\b/gi,
  /catastrophic/gi,
  /至急/g,
  /危険(です|だ)?/g,
  /今すぐ/g,
  /必須/g,
]

function softenTone(value = '') {
  let s = String(value || '')
  AGGRESSIVE_TONE_PATTERNS.forEach((pattern) => {
    s = s.replace(pattern, (m) => {
      if (/urgent|至急|今すぐ|immediately/i.test(m)) return '優先'
      if (/danger|危険|catastrophic/i.test(m)) return '注意'
      if (/must|必須/i.test(m)) return '推奨'
      return m
    })
  })
  return s
}

function isMostlyJapaneseText(value = '') {
  const s = String(value || '').trim()
  if (!s) return false
  const jaMatches = s.match(/[ぁ-んァ-ン一-龥]/g) || []
  const alphaNum = s.match(/[A-Za-z0-9]/g) || []
  return jaMatches.length >= Math.max(6, Math.floor(alphaNum.length * 0.35))
}

function hasSufficientJapaneseQualitative(payload) {
  if (!payload || typeof payload !== 'object') return false
  const samples = [
    String(payload.summary || ''),
    String(payload.comment || ''),
    ...((Array.isArray(payload.strengths) ? payload.strengths : []).slice(0, 2).map((x) => String(x || ''))),
    ...((Array.isArray(payload.weaknesses) ? payload.weaknesses : []).slice(0, 2).map((x) => String(x || ''))),
  ].filter(Boolean)
  if (samples.length === 0) return false
  const passCount = samples.filter((x) => isMostlyJapaneseText(x)).length
  return passCount >= Math.max(2, Math.ceil(samples.length * 0.5))
}

function softenQualitative(payload) {
  if (!payload || typeof payload !== 'object') return payload
  return {
    ...payload,
    summary: softenTone(payload.summary),
    comment: softenTone(payload.comment),
    strengths: Array.isArray(payload.strengths) ? payload.strengths.map((x) => softenTone(String(x || ''))) : [],
    weaknesses: Array.isArray(payload.weaknesses) ? payload.weaknesses.map((x) => softenTone(String(x || ''))) : [],
    risks: Array.isArray(payload.risks)
      ? payload.risks.map((r) => ({ ...r, type: softenTone(String(r?.type || '')), desc: softenTone(String(r?.desc || '')) }))
      : [],
    actions: Array.isArray(payload.actions)
      ? payload.actions.map((a) => ({ ...a, action: softenTone(String(a?.action || '')) }))
      : [],
  }
}

function mergeDiagnosis(base, qualitative) {
  if (!qualitative) return base
  return {
    ...base,
    summary: qualitative.summary || base.summary,
    strengths: qualitative.strengths.length > 0 ? qualitative.strengths : base.strengths,
    weaknesses: qualitative.weaknesses.length > 0 ? qualitative.weaknesses : base.weaknesses,
    risks: qualitative.risks.length > 0 ? qualitative.risks : base.risks,
    actions: qualitative.actions.length > 0 ? qualitative.actions : base.actions,
    comment: qualitative.comment || base.comment,
  }
}

async function callAnthropicQualitative({ apiKey, prompt }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1100,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error?.message || `Anthropic request failed (${response.status})`)
  }

  const text = Array.isArray(data?.content)
    ? data.content.map((row) => String(row?.text || '')).join('\n')
    : ''

  return sanitizeQualitative(extractJsonObject(text))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return sendJson(res, 500, { error: 'Server misconfigured' })
  }
  const authHeader = String(req.headers.authorization || '')
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!accessToken) {
    return sendJson(res, 401, { error: 'ログインが必要です' })
  }
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data: userData, error: userErr } = await adminClient.auth.getUser(accessToken)
  if (userErr || !userData?.user) {
    return sendJson(res, 401, { error: 'ログインが必要です' })
  }

  try {
    const body = await readJsonBody(req)
    const holdings = normalizeHoldings(body?.holdings)
    const scopeLabel = String(body?.scopeLabel || '総合').slice(0, 30)

    if (holdings.length === 0) {
      return sendJson(res, 400, { error: 'holdings is required' })
    }

    const deterministic = buildDeterministicDiagnosis({ holdings, scopeLabel })
    let result = deterministic
    const apiKey =
      normalizeSecret(process.env.ANTHROPIC_API_KEY) ||
      normalizeSecret(process.env.CLAUDE_API_KEY)

    if (apiKey) {
      try {
        const qualitativeRaw = await callAnthropicQualitative({
          apiKey,
          prompt: buildQualitativePrompt({ diagnosis: deterministic }),
        })
        const qualitative = softenQualitative(qualitativeRaw)
        if (hasSufficientJapaneseQualitative(qualitative)) {
          result = mergeDiagnosis(deterministic, qualitative)
        } else {
          result = deterministic
        }
      } catch {
        // Deterministic result is already available; keep endpoint stable.
      }
    }

    return sendJson(res, 200, { result })
  } catch (error) {
    return sendJson(res, 500, { error: error?.message || 'portfolio diagnosis failed' })
  }
}
