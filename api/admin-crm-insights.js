/**
 * Admin-only: CRM / growth snapshot → Claude JSON executive insights.
 * Auth: HTTP Basic (ADMIN_BASIC_USER / ADMIN_BASIC_PASS), same as AdminIpGuard.
 * Body: { snapshot: <aggregated object> } — must not contain raw emails (client strips PII).
 */
import { adminAuthFailure } from './_lib/admin-basic-auth.js'
import { sendRateLimitJson } from './_lib/rate-limit.js'

const MODEL =
  process.env.ANTHROPIC_ADMIN_INSIGHTS_MODEL
  || 'claude-sonnet-4-6'

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

function clampDeep(obj, depth = 0) {
  if (depth > 8) return '[truncated]'
  if (obj == null) return obj
  if (typeof obj !== 'object') {
    const s = String(obj)
    return s.length > 400 ? `${s.slice(0, 400)}…` : s
  }
  if (Array.isArray(obj)) {
    return obj.slice(0, 40).map((item) => clampDeep(item, depth + 1))
  }
  const out = {}
  const keys = Object.keys(obj).slice(0, 60)
  keys.forEach((k) => {
    out[String(k).slice(0, 80)] = clampDeep(obj[k], depth + 1)
  })
  return out
}

export function buildPrompt(snapshot) {
  const safe = clampDeep(snapshot)
  return `You are a growth / CRM analyst for MoneyMart, a consumer-facing comparison & portfolio visualization web product (informational only).

Below are **pre-aggregated dashboard metrics only** — no raw emails or names.

STRICT RULES
- Do NOT invent metrics not present. Say "insufficient data" when unsure.
- No personalised investment advice, return guarantees, or regulated solicitation language.
- Distinguish observations, hypotheses, and points to check.
- Prioritize material growth constraints: acquisition efficiency, funnel loss, activation, premium intent, attribution quality, and sample-size risk.
- Compare stages and channels only when denominators are available. Call out small samples explicitly.
- Sessions and first-touch signups are not matched people; their ratio is directional, never a measured funnel conversion or causal loss.
- Use analysis.current.matured for 7-day activation. Pending signups are still observing, not failures. Premium intent is independent of activation.
- Rate differences are percentage points (pp); count differences are relative percentages. Withhold comparisons when coverage is incomplete.
- Missing or failed measurements are unknown, never zero. Exploratory channel quality is not ROI. Do not recommend scaling spend from this score or a tiny sample.
- Every recommendation is a testable hypothesis with a denominator and next check, not a proven cause.

RESPONSE FORMAT
Return **only** a JSON object with the keys below. No Markdown fences or preamble.
Write every string in concise, decision-ready **English** for executives and growth operators.
Treat "Direct / unknown" as an attribution limitation with multiple possible causes: bookmarks, typed URLs, missing UTM tags, in-app browsers, privacy restrictions, or registrations predating measurement.

OUTPUT KEYS:
{
  "headline": "One concise executive conclusion",
  "segments": ["Up to 5 high-value customer or acquisition segment hypotheses"],
  "bullets": ["3-6 material findings grounded in supplied metrics and denominators"],
  "experiments": ["2-5 specific experiments executable in the next 7-14 days, each tied to a metric"],
  "watchouts": ["1-4 measurement, attribution, or sample-size risks"],
  "questions": ["2-5 analyses or data points management should request next"]
}

INPUT JSON:
${JSON.stringify(safe, null, 2)}`
}

async function callAnthropicJson({ apiKey, prompt }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      temperature: 0.25,
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

  return extractJsonObject(text)
}

function normalizeInsights(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('AI analysis returned an empty result')
  }
  const headline = String(raw.headline || '').trim().slice(0, 120)
  const segments = Array.isArray(raw.segments)
    ? raw.segments.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 8)
    : []
  const bullets = Array.isArray(raw.bullets) ? raw.bullets.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 8) : []
  const experiments = Array.isArray(raw.experiments)
    ? raw.experiments.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 8)
    : []
  const watchouts = Array.isArray(raw.watchouts)
    ? raw.watchouts.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 8)
    : []
  const questions = Array.isArray(raw.questions)
    ? raw.questions.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 8)
    : []
  if (!headline && bullets.length === 0 && segments.length === 0) {
    throw new Error('AI analysis did not include a headline, finding, or segment')
  }
  return {
    headline: headline || 'CRM executive analysis',
    segments,
    bullets,
    experiments,
    watchouts,
    questions,
    model: MODEL,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })

  const authFail = adminAuthFailure(req)
  if (authFail === 429) {
    return sendRateLimitJson(res, 60, '管理画面への試行が多すぎます。しばらくしてから再度お試しください。')
  }
  if (authFail) {
    res.setHeader('WWW-Authenticate', 'Basic realm="MoneyMart Admin"')
    return sendJson(res, authFail, { error: 'Unauthorized' })
  }

  const apiKey =
    normalizeSecret(process.env.ANTHROPIC_API_KEY)
    || normalizeSecret(process.env.CLAUDE_API_KEY)
  if (!apiKey) {
    return sendJson(res, 503, {
      error: 'ANTHROPIC_API_KEY (or CLAUDE_API_KEY) is not set. Check Vercel environment variables.',
    })
  }

  let body = {}
  try {
    body = await readJsonBody(req)
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON body' })
  }

  const snapshot = body?.snapshot && typeof body.snapshot === 'object' ? body.snapshot : null
  if (!snapshot) {
    return sendJson(res, 400, { error: 'snapshot object is required' })
  }

  try {
    const prompt = buildPrompt(snapshot)
    const rawInsights = await callAnthropicJson({ apiKey, prompt })
    const insights = normalizeInsights(rawInsights)
    const generatedAt = new Date().toISOString()
    return sendJson(res, 200, { ok: true, generatedAt, insights })
  } catch (error) {
    return sendJson(res, 500, {
      error: error?.message || 'admin-crm-insights failed',
    })
  }
}
