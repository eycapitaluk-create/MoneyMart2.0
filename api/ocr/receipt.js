import { GoogleAuth } from 'google-auth-library'
import { TextractClient, AnalyzeExpenseCommand } from '@aws-sdk/client-textract'
import { createClient } from '@supabase/supabase-js'

const coerceText = (v) => String(v || '').trim()
const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0))
const MAX_REASONABLE_RECEIPT_AMOUNT = 2_000_000
const MAX_RECEIPT_BASE64_LENGTH = 15 * 1024 * 1024

const isValidDateString = (value = '') => {
  const t = coerceText(value)
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return false
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  return Number.isFinite(y) && Number.isFinite(mo) && Number.isFinite(d)
    && y >= 2020 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31
}

const normalizeLikelyOcrDate = (value = '') => {
  const t = coerceText(value)
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ''
  let y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return ''
  // Common OCR issue: 2026 -> 2016. Nudge by +10 years for recent receipts.
  if (y >= 2010 && y <= 2019) {
    const candidate = y + 10
    const nowYear = new Date().getFullYear()
    if (candidate <= nowYear + 1) y = candidate
  }
  const normalized = `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return isValidDateString(normalized) ? normalized : ''
}

const normalizeMerchantText = (value = '') => (
  coerceText(value)
    .replace(/\s+\d{1,3}\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
)

const mergeParsedResults = (primary = {}, secondary = {}) => {
  const pAmount = Number(coerceText(primary?.amount))
  const sAmount = Number(coerceText(secondary?.amount))
  const pAmountOk = Number.isFinite(pAmount) && pAmount > 0 && pAmount <= MAX_REASONABLE_RECEIPT_AMOUNT
  const sAmountOk = Number.isFinite(sAmount) && sAmount > 0 && sAmount <= MAX_REASONABLE_RECEIPT_AMOUNT
  const amount = pAmountOk
    ? String(Math.round(pAmount))
    : (sAmountOk ? String(Math.round(sAmount)) : '')

  const pMerchant = normalizeMerchantText(primary?.merchant)
  const sMerchant = normalizeMerchantText(secondary?.merchant)
  const pMerchantOk = pMerchant.length >= 2
  const sMerchantOk = sMerchant.length >= 2
  const merchant = pMerchantOk ? pMerchant : (sMerchantOk ? sMerchant : '')

  const pDate = coerceText(primary?.spent_on)
  const sDate = coerceText(secondary?.spent_on)
  const spent_on = isValidDateString(pDate)
    ? pDate
    : (isValidDateString(sDate) ? sDate : '')

  return {
    merchant,
    amount,
    spent_on,
    payment_method: coerceText(primary?.payment_method || secondary?.payment_method),
    raw_entities_count: Math.max(
      Number(primary?.raw_entities_count || 0),
      Number(secondary?.raw_entities_count || 0),
    ),
    confidence: {
      merchant: Math.max(
        Number(primary?.confidence?.merchant || 0),
        Number(secondary?.confidence?.merchant || 0),
      ),
      amount: Math.max(
        Number(primary?.confidence?.amount || 0),
        Number(secondary?.confidence?.amount || 0),
      ),
      spent_on: Math.max(
        Number(primary?.confidence?.spent_on || 0),
        Number(secondary?.confidence?.spent_on || 0),
      ),
    },
  }
}

const parseServiceAccount = () => {
  const rawJson = process.env.GCP_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (rawJson) {
    const parsed = JSON.parse(rawJson)
    if (parsed?.private_key && parsed?.client_email) return parsed
  }
  const rawB64 = process.env.GCP_SERVICE_ACCOUNT_JSON_BASE64 || process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64
  if (rawB64) {
    const decoded = Buffer.from(rawB64, 'base64').toString('utf8')
    const parsed = JSON.parse(decoded)
    if (parsed?.private_key && parsed?.client_email) return parsed
  }
  return null
}

const moneyFromEntity = (entity) => {
  const mv = entity?.normalizedValue?.moneyValue
  if (mv && (mv.units != null || mv.nanos != null)) {
    const units = Number(mv.units || 0)
    const nanos = Number(mv.nanos || 0)
    const value = units + (nanos / 1_000_000_000)
    if (Number.isFinite(value) && value > 0) return Math.round(value)
  }
  const t = coerceText(entity?.mentionText)
  const n = Number(t.replace(/[^\d]/g, ''))
  if (Number.isFinite(n) && n > 0) return n
  return 0
}

const dateFromEntity = (entity) => {
  const dv = entity?.normalizedValue?.dateValue
  if (dv?.year && dv?.month && dv?.day) {
    return `${String(dv.year).padStart(4, '0')}-${String(dv.month).padStart(2, '0')}-${String(dv.day).padStart(2, '0')}`
  }
  const t = coerceText(entity?.mentionText)
  const m = t.match(/(20\d{2})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/)
  if (m) {
    return `${m[1]}-${String(Number(m[2])).padStart(2, '0')}-${String(Number(m[3])).padStart(2, '0')}`
  }
  return ''
}

const pickBestEntity = (entities, acceptedTypes) => {
  const filtered = entities.filter((e) => acceptedTypes.includes(String(e?.type || '').toLowerCase()))
  if (filtered.length === 0) return null
  filtered.sort((a, b) => Number(b?.confidence || 0) - Number(a?.confidence || 0))
  return filtered[0]
}

const buildResultFromEntities = (entities = []) => {
  const normalized = entities.map((e) => ({
    ...e,
    type: String(e?.type || '').toLowerCase(),
  }))
  const merchantEntity = pickBestEntity(normalized, ['supplier_name', 'merchant_name', 'vendor_name', 'retailer_name'])
  const amountEntity = pickBestEntity(normalized, ['total_amount', 'amount_due', 'net_amount'])
  const dateEntity = pickBestEntity(normalized, ['receipt_date', 'transaction_date', 'invoice_date', 'due_date'])
  const paymentEntity = pickBestEntity(normalized, ['payment_method', 'payment_type'])

  const merchant = coerceText(merchantEntity?.normalizedValue?.text || merchantEntity?.mentionText)
  const amount = moneyFromEntity(amountEntity)
  const spentOn = dateFromEntity(dateEntity)
  const paymentMethod = coerceText(paymentEntity?.normalizedValue?.text || paymentEntity?.mentionText)
  const confidence = {
    merchant: Number(merchantEntity?.confidence || 0),
    amount: Number(amountEntity?.confidence || 0),
    spent_on: Number(dateEntity?.confidence || 0),
  }

  return {
    merchant,
    amount: amount > 0 ? String(amount) : '',
    spent_on: spentOn,
    payment_method: paymentMethod,
    raw_entities_count: normalized.length,
    confidence,
  }
}

const parseAwsDate = (value = '') => {
  const t = coerceText(value)
  if (!t) return ''
  const iso = t.match(/(20\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/)
  if (iso) return `${iso[1]}-${String(Number(iso[2])).padStart(2, '0')}-${String(Number(iso[3])).padStart(2, '0')}`
  const jp = t.match(/(20\d{2})年(\d{1,2})月(\d{1,2})日/)
  if (jp) return `${jp[1]}-${String(Number(jp[2])).padStart(2, '0')}-${String(Number(jp[3])).padStart(2, '0')}`
  return ''
}

const parseAwsAmount = (value = '') => {
  const raw = coerceText(value)
  if (!raw) return ''
  const tokens = raw.match(/\d{1,3}(?:[.,]\d{3})+|\d{1,7}/g) || []
  if (tokens.length === 0) return ''
  const values = []
  for (const originalToken of tokens) {
    let token = originalToken
    // OCR often reads thousands separators inconsistently (e.g. "2.006" for 2006).
    if (/^\d{1,3}(?:[.,]\d{3})+$/.test(token)) {
      token = token.replace(/[.,]/g, '')
    } else if (token.includes('.') && !token.includes(',')) {
      const [a, b] = token.split('.')
      if (/^\d{1,3}$/.test(a) && /^\d{3}$/.test(b)) token = `${a}${b}`
    } else if (token.includes(',') && !token.includes('.')) {
      const [a, b] = token.split(',')
      if (/^\d{1,3}$/.test(a) && /^\d{3}$/.test(b)) token = `${a}${b}`
    }
    const digits = token.replace(/[^\d]/g, '')
    const n = Number(digits)
    if (!Number.isFinite(n) || n <= 0 || n > MAX_REASONABLE_RECEIPT_AMOUNT) continue
    values.push(n)
  }
  if (values.length === 0) return ''
  return String(Math.max(...values))
}

const extractLikelyTotalFromRawText = (rawText = '') => {
  const lines = String(rawText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return ''

  const parseLooseAmount = (text) => {
    const matches = [...String(text).matchAll(/(?:¥|￥)?\s*([0-9][0-9,.\s]{1,12})/g)]
    const values = matches
      .map((m) => parseAwsAmount(m?.[1] || ''))
      .map((v) => Number(v || 0))
      .filter((n) => Number.isFinite(n) && n > 0)
    if (values.length === 0) return 0
    return Math.max(...values)
  }

  const entries = []
  let best = { amount: 0, score: -1 }
  for (const line of lines) {
    const amount = parseLooseAmount(line)
    if (!amount) continue
    let score = 0
    const isTotalLike = /(^|[\s:])合計([\s:]|$)|総計|総額|お買上.?計|請求額|支払金額|ご利用額|(^|[\s:])total([\s:]|$)|amount due|grand total|balance due/i.test(line)
    const isPaidLike = /(お預り|預り|現金|cash|received|tender)/i.test(line)
    const isChangeLike = /(お釣|釣銭|つり|change)/i.test(line)
    const isTaxLike = /(tax|税|内税|外税)/i.test(line)
    // Prefer explicit "total amount" style labels.
    if (/(^|[\s:])合計([\s:]|$)|総計|総額|お買上.?計|請求額|支払金額|ご利用額/i.test(line)) score += 120
    if (/(^|[\s:])total([\s:]|$)|amount due|grand total|balance due/i.test(line)) score += 70
    // Penalize non-total monetary lines.
    if (/(預り|現金|cash|割引|値引)/i.test(line)) score -= 120
    if (isChangeLike) score -= 160
    if (isTaxLike) score -= 90
    if (amount < 100) score -= 60
    if (amount > 2_000_000) score -= 80
    entries.push({ amount, line, score, isTotalLike, isPaidLike, isChangeLike, isTaxLike })
    if (score > best.score) best = { amount, score }
  }
  if (entries.length >= 3) {
    const uniqueAmounts = [...new Set(entries.map((e) => e.amount))].sort((a, b) => a - b)
    const totalLike = entries
      .filter((e) => e.isTotalLike && !e.isChangeLike)
      .sort((a, b) => b.score - a.score)[0]
    // OCR can misread "現金" as "TAX"; treat tax-like high amounts as "paid amount" candidates too.
    const paidLikeCandidates = entries
      .filter((e) => (e.isPaidLike || e.isTaxLike) && e.amount > 0)
      .sort((a, b) => b.amount - a.amount)
    if (totalLike && paidLikeCandidates.length > 0) {
      for (const paid of paidLikeCandidates) {
        if (paid.amount <= totalLike.amount) continue
        const diff = paid.amount - totalLike.amount
        if (diff <= 0) continue
        if (!uniqueAmounts.includes(diff)) continue
        if (diff < 100 || diff > 2_000_000) continue
        // If paid - total equals another observed amount, total is likely change.
        // Choose the arithmetic remainder as the actual purchase total.
        return String(diff)
      }
    }
  }
  // Pattern like "4 ¥3,614" (item count + total) often survives OCR even when labels break.
  const countAmountCandidates = []
  for (const line of lines) {
    const m = line.match(/(?:^|\s)\d{1,2}\s*(?:点|個)?\s*[¥￥]\s*([0-9][0-9,.\s]{2,})/i)
    if (!m?.[1]) continue
    const amount = Number(parseAwsAmount(m[1]) || 0)
    if (!Number.isFinite(amount) || amount <= 0) continue
    if (amount > MAX_REASONABLE_RECEIPT_AMOUNT) continue
    countAmountCandidates.push(amount)
  }
  if (countAmountCandidates.length > 0) {
    return String(Math.max(...countAmountCandidates))
  }
  const freqMap = new Map()
  for (const e of entries) {
    if (e.isChangeLike || e.isTaxLike) continue
    if (e.amount < 100 || e.amount > MAX_REASONABLE_RECEIPT_AMOUNT) continue
    const prev = freqMap.get(e.amount) || 0
    freqMap.set(e.amount, prev + 1)
  }
  const repeated = [...freqMap.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => (b[1] - a[1]) || (b[0] - a[0]))
  if (repeated.length > 0) {
    const [amount] = repeated[0]
    return String(amount)
  }
  return best.score >= 20 && best.amount > 0 ? String(best.amount) : ''
}

const buildAwsAmountCandidate = (field = {}) => {
  const typeText = coerceText(field?.Type?.Text).toUpperCase()
  const labelText = coerceText(field?.LabelDetection?.Text)
  const valueText = coerceText(field?.ValueDetection?.Text)
  const amount = parseAwsAmount(valueText)
  if (!amount) return null
  let score = Number(field?.ValueDetection?.Confidence || 0)
  const merged = `${typeText} ${labelText}`.toLowerCase()
  if (typeText === 'TOTAL') score += 120
  if (typeText === 'AMOUNT_DUE') score += 95
  if (typeText === 'SUBTOTAL') score += 40
  if (/(合計|総計|総額|ご利用額|請求額|total|amount due)/i.test(merged)) score += 85
  if (/(小計|subtotal)/i.test(merged)) score -= 20
  if (/(税|tax|tip|change|釣銭|お預り|discount|値引)/i.test(merged)) score -= 80
  if (Number(amount) < 100) score -= 120
  return { amount, score, typeText, labelText, valueText }
}

const collectAwsRawText = (expense = {}) => {
  const summary = Array.isArray(expense?.SummaryFields) ? expense.SummaryFields : []
  const lineItemGroups = Array.isArray(expense?.LineItemGroups) ? expense.LineItemGroups : []
  const lines = []
  const words = []

  for (const field of summary) {
    const label = coerceText(field?.LabelDetection?.Text || field?.Type?.Text)
    const value = coerceText(field?.ValueDetection?.Text)
    if (!label && !value) continue
    const line = [label, value].filter(Boolean).join(': ')
    if (line) lines.push(line)
    if (label) words.push({ text: label })
    if (value) words.push({ text: value })
  }

  for (const group of lineItemGroups) {
    const items = Array.isArray(group?.LineItems) ? group.LineItems : []
    for (const item of items) {
      const fields = Array.isArray(item?.LineItemExpenseFields) ? item.LineItemExpenseFields : []
      const itemParts = []
      for (const field of fields) {
        const v = coerceText(field?.ValueDetection?.Text)
        if (!v) continue
        itemParts.push(v)
        words.push({ text: v })
      }
      if (itemParts.length > 0) lines.push(itemParts.join(' '))
    }
  }

  const blocks = Array.isArray(expense?.Blocks) ? expense.Blocks : []
  for (const block of blocks) {
    if (String(block?.BlockType || '').toUpperCase() !== 'LINE') continue
    const t = coerceText(block?.Text)
    if (!t) continue
    lines.push(t)
    words.push({ text: t })
  }

  return {
    rawText: lines.join('\n'),
    words,
  }
}

const sumAwsLineItemAmounts = (expense = {}) => {
  const groups = Array.isArray(expense?.LineItemGroups) ? expense.LineItemGroups : []
  let sum = 0
  let itemCount = 0
  for (const group of groups) {
    const items = Array.isArray(group?.LineItems) ? group.LineItems : []
    for (const item of items) {
      const fields = Array.isArray(item?.LineItemExpenseFields) ? item.LineItemExpenseFields : []
      const candidates = []
      for (const field of fields) {
        const typeText = coerceText(field?.Type?.Text).toUpperCase()
        const valueText = coerceText(field?.ValueDetection?.Text)
        if (!valueText) continue
        if (/(QUANTITY|QTY|ITEM|DESCRIPTION|PRODUCT_CODE|CODE)/i.test(typeText)) continue
        if (/(TAX|DISCOUNT|CHANGE|CASH|PAYMENT|ROUNDING)/i.test(typeText)) continue
        const hasCurrency = /[¥￥円]/.test(valueText)
        const amountTypeHint = /(AMOUNT|PRICE|TOTAL|SUBTOTAL|UNIT_PRICE|LINE_TOTAL)/i.test(typeText)
        if (!hasCurrency && !amountTypeHint) continue
        const amount = Number(parseAwsAmount(valueText) || 0)
        if (!Number.isFinite(amount) || amount <= 0) continue
        candidates.push(amount)
      }
      if (candidates.length === 0) continue
      const lineAmount = Math.max(...candidates)
      if (lineAmount <= 0) continue
      sum += lineAmount
      itemCount += 1
    }
  }
  if (itemCount === 0 || sum <= 0) return null
  return { sum: String(Math.round(sum)), itemCount }
}

const parseAwsExpense = (expense) => {
  const summary = Array.isArray(expense?.SummaryFields) ? expense.SummaryFields : []
  const getBest = (types) => {
    const matched = summary
      .filter((f) => types.includes(String(f?.Type?.Text || '').toUpperCase()))
      .sort((a, b) => Number(b?.ValueDetection?.Confidence || 0) - Number(a?.ValueDetection?.Confidence || 0))
    return matched[0] || null
  }
  const merchantField = getBest(['VENDOR_NAME', 'SUPPLIER_NAME'])
  const amountField = getBest(['TOTAL', 'AMOUNT_DUE', 'SUBTOTAL'])
  const dateField = getBest(['INVOICE_RECEIPT_DATE'])
  const amountCandidates = summary
    .map((field) => buildAwsAmountCandidate(field))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
  const bestAmountCandidate = amountCandidates[0] || null

  const merchant = coerceText(merchantField?.ValueDetection?.Text)
  const summaryAmount = parseAwsAmount(amountField?.ValueDetection?.Text) || coerceText(bestAmountCandidate?.amount)
  const spentOn = parseAwsDate(dateField?.ValueDetection?.Text)
  const { rawText, words } = collectAwsRawText(expense)
  const textTotal = extractLikelyTotalFromRawText(rawText)
  const lineItemSum = sumAwsLineItemAmounts(expense)
  const summaryAmountNum = Number(summaryAmount || 0)
  const textTotalNum = Number(textTotal || 0)
  const lineItemSumNum = Number(lineItemSum?.sum || 0)
  let amount = textTotal || summaryAmount
  // If summary total looks like "change" but line items produce a plausible sum, prefer line-item sum.
  if (lineItemSumNum > 0 && lineItemSum?.itemCount >= 2) {
    const rawAmountSet = new Set(
      [...String(rawText || '').matchAll(/(?:¥|￥)?\s*([0-9][0-9,.\s]{1,12})/g)]
        .map((m) => Number(parseAwsAmount(m?.[1] || '') || 0))
        .filter((n) => Number.isFinite(n) && n > 0)
    )
    const rawHasLineItemSum = rawAmountSet.has(lineItemSumNum)
    const summaryLooksTooSmall = summaryAmountNum > 0 && summaryAmountNum < Math.round(lineItemSumNum * 0.8)
    const textMissingOrCloseToLine = !textTotalNum || Math.abs(textTotalNum - lineItemSumNum) <= Math.max(30, lineItemSumNum * 0.03)
    if (rawHasLineItemSum && summaryLooksTooSmall && textMissingOrCloseToLine) {
      amount = String(lineItemSumNum)
    }
  }

  return {
    parsed: {
      merchant,
      amount,
      spent_on: spentOn,
      payment_method: '',
      raw_entities_count: summary.length,
      confidence: {
        merchant: clamp01(Number(merchantField?.ValueDetection?.Confidence || 0) / 100),
        amount: clamp01(Number(amountField?.ValueDetection?.Confidence || 0) / 100),
        spent_on: clamp01(Number(dateField?.ValueDetection?.Confidence || 0) / 100),
      },
    },
    rawText,
    words,
    entitiesCount: summary.length,
    provider: 'aws_textract',
  }
}

const processByAwsTextract = async ({ content }) => {
  const region = coerceText(
    process.env.AWS_TEXTRACT_REGION
    || process.env.AWS_REGION
    || process.env.AWS_DEFAULT_REGION
    || 'ap-northeast-2'
  )
  const accessKeyId = coerceText(process.env.AWS_ACCESS_KEY_ID)
  const secretAccessKey = coerceText(process.env.AWS_SECRET_ACCESS_KEY)
  if (!region || !accessKeyId || !secretAccessKey) return null

  const client = new TextractClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
      sessionToken: coerceText(process.env.AWS_SESSION_TOKEN) || undefined,
    },
  })
  const bytes = Uint8Array.from(Buffer.from(content, 'base64'))
  const response = await client.send(new AnalyzeExpenseCommand({
    Document: { Bytes: bytes },
  }))
  const doc = Array.isArray(response?.ExpenseDocuments) ? response.ExpenseDocuments[0] : null
  if (!doc) throw new Error('AWS Textract returned no ExpenseDocuments')
  return parseAwsExpense(doc)
}

const processByDocumentAi = async ({ content, mimeType }) => {
  const projectId = process.env.GCP_PROJECT_ID
  const location = process.env.GCP_DOCAI_LOCATION || 'us'
  const processorId = process.env.GCP_DOCAI_PROCESSOR_ID
  const serviceAccount = parseServiceAccount()
  if (!projectId || !processorId || !serviceAccount) return null

  const auth = new GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })
  const client = await auth.getClient()
  const accessTokenResponse = await client.getAccessToken()
  const accessToken = typeof accessTokenResponse === 'string'
    ? accessTokenResponse
    : accessTokenResponse?.token
  if (!accessToken) throw new Error('Failed to get Google access token')

  const endpoint = `https://${location}-documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors/${processorId}:process`
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rawDocument: {
        content,
        mimeType,
      },
    }),
  })
  const payload = await resp.json()
  if (!resp.ok) {
    throw new Error(payload?.error?.message || `Document AI failed: ${resp.status}`)
  }

  const entities = Array.isArray(payload?.document?.entities) ? payload.document.entities : []
  const entityParsed = buildResultFromEntities(entities)
  const rawText = coerceText(payload?.document?.text)
  const textAmount = coerceText(
    rawText.match(/(?:合計|現計|総額|請求額|total|amount due)[^\n]*?([0-9][0-9,]{1,})/i)?.[1]
  ).replace(/[^\d]/g, '')
  const textDateMatch = rawText.match(/(20\d{2})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/)
  const textDate = textDateMatch
    ? normalizeLikelyOcrDate(
      `${textDateMatch[1]}-${String(Number(textDateMatch[2])).padStart(2, '0')}-${String(Number(textDateMatch[3])).padStart(2, '0')}`
    )
    : ''
  const mergedParsed = {
    ...entityParsed,
    amount: entityParsed.amount || textAmount || '',
    spent_on: (() => {
      const entityDate = normalizeLikelyOcrDate(entityParsed.spent_on)
      if (!entityDate) return textDate || ''
      return entityDate
    })(),
  }
  return {
    parsed: mergedParsed,
    rawText,
    entitiesCount: entities.length,
    provider: 'document_ai',
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, error: 'Server misconfigured' })
  }
  const authHeader = String(req.headers.authorization || '')
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data: userData, error: userErr } = await adminClient.auth.getUser(token)
  if (userErr || !userData?.user) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }

  const { imageBase64, mimeType } = req.body || {}
  const content = coerceText(imageBase64).replace(/^data:[^;]+;base64,/, '')
  if (!content) return res.status(400).json({ ok: false, error: 'imageBase64 is required' })
  if (content.length > MAX_RECEIPT_BASE64_LENGTH) {
    return res.status(413).json({ ok: false, error: 'Receipt image too large' })
  }
  const safeMime = coerceText(mimeType) || 'image/jpeg'

  const wrapResult = (promise) => promise
    .then((data) => ({ ok: true, data }))
    .catch((error) => ({ ok: false, error }))

  // Start both providers in parallel. Return fast when Document AI is strong enough.
  const docTask = wrapResult(processByDocumentAi({ content, mimeType: safeMime }))
  const awsTask = wrapResult(processByAwsTextract({ content, mimeType: safeMime }))

  const docResult = await docTask
  if (docResult.ok && docResult.data) {
    const docAiResult = docResult.data
    const docParsed = docAiResult.parsed || {}
    const docNeedsSupplement = !coerceText(docParsed.merchant)
      || !coerceText(docParsed.amount)
      || !isValidDateString(docParsed.spent_on)

    if (!docNeedsSupplement) {
      return res.status(200).json({
        ok: true,
        parsed: docAiResult.parsed,
        rawText: docAiResult.rawText,
        entitiesCount: docAiResult.entitiesCount,
        provider: docAiResult.provider,
      })
    }

    const awsResult = await awsTask
    if (awsResult.ok && awsResult.data?.parsed) {
      const awsSupplement = awsResult.data
      const merged = mergeParsedResults(docParsed, awsSupplement.parsed)
      return res.status(200).json({
        ok: true,
        parsed: merged,
        rawText: [coerceText(docAiResult.rawText), coerceText(awsSupplement.rawText)].filter(Boolean).join('\n'),
        words: awsSupplement.words || [],
        entitiesCount: Math.max(
          Number(docAiResult.entitiesCount || 0),
          Number(awsSupplement.entitiesCount || 0),
        ),
        provider: 'document_ai+aws_fallback',
      })
    }

    return res.status(200).json({
      ok: true,
      parsed: docAiResult.parsed,
      rawText: docAiResult.rawText,
      entitiesCount: docAiResult.entitiesCount,
      provider: docAiResult.provider,
    })
  }

  const awsResult = await awsTask
  if (awsResult.ok && awsResult.data) {
    const aws = awsResult.data
    return res.status(200).json({
      ok: true,
      parsed: aws.parsed,
      rawText: aws.rawText,
      words: aws.words || [],
      entitiesCount: aws.entitiesCount,
      provider: aws.provider,
    })
  }

  const message = docResult.error?.message || awsResult.error?.message || 'OCR processing failed'
  console.error('OCR processing failed:', message)
  return res.status(500).json({
    ok: false,
    error: 'OCR processing failed',
  })
}
