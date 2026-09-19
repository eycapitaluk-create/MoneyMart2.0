import { supabase } from './supabase'

const CATEGORY_SPEC_LABELS = {
  savings: ['金利', '期間', '最低預入'],
  cards: ['年会費', '還元率', '特典'],
  loans: ['金利', '限度額', '無利息期間'],
  insurance: ['保険料', '治療救援', 'サポート'],
  points: ['還元率', '獲得条件', '付与時期'],
  /** 株式ページ「執行先比較」用（Admin で category=brokerage） */
  brokerage: ['手数料', 'ポイント', '特徴'],
}

const toText = (value) => String(value ?? '').trim()

const guessProviderFromName = (name = '') => {
  const trimmed = toText(name)
  if (!trimmed) return ''
  const [head] = trimmed.split(/\s+/)
  return head || trimmed
}

const normalizeSpecs = (category, rawSpec) => {
  if (Array.isArray(rawSpec)) {
    return rawSpec
      .map((item) => ({
        label: toText(item?.label),
        value: toText(item?.value),
      }))
      .filter((item) => item.label && item.value)
  }

  const rawText = toText(rawSpec)
  if (!rawText) return []

  try {
    const parsed = JSON.parse(rawText)
    if (Array.isArray(parsed)) return normalizeSpecs(category, parsed)
  } catch {
    // fall through to text parsing
  }

  const labels = CATEGORY_SPEC_LABELS[category] || ['項目1', '項目2', '項目3']
  const parts = rawText
    .split(/\r?\n|[|｜]|・|\/(?!\/)/)
    .map((part) => toText(part))
    .filter(Boolean)
    .slice(0, labels.length)

  return parts.map((value, index) => ({
    label: labels[index] || `項目${index + 1}`,
    value,
  }))
}

const normalizeProductRow = (row) => {
  const category = toText(row?.category) || 'cards'
  const name = toText(row?.name)
  return {
    id: String(row?.id ?? ''),
    category,
    name,
    provider: toText(row?.provider) || guessProviderFromName(name),
    image: toText(row?.image_url),
    badge: toText(row?.badge) || '公式',
    specs: normalizeSpecs(category, row?.spec),
    description: toText(row?.description),
    apply_url: toText(row?.link),
    affiliate_url: toText(row?.affiliate_url),
    is_sponsored: Boolean(row?.is_sponsored),
    ad_provider: toText(row?.ad_provider),
    created_at: row?.created_at || null,
  }
}

export async function fetchActiveProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('id,category,name,provider,link,description,spec,is_active,created_at,image_url,badge')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) throw error

  return (data || [])
    .map(normalizeProductRow)
    .filter((item) => item.id && item.name)
}

/** category=brokerage の商品のみ。株式ページ執行先比較で利用 */
export async function fetchActiveBrokeragePartners() {
  const { data, error } = await supabase
    .from('products')
    .select('id,category,name,provider,link,description,spec,is_active,created_at,image_url,badge')
    .eq('is_active', true)
    .eq('category', 'brokerage')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw error

  return (data || [])
    .map(normalizeProductRow)
    .filter((item) => item.id && item.name)
}

/** normalizeProductRow 済みの1件 → 執行先カード用 */
export function mapProductToExecutionPartnerCard(product) {
  const specs = Array.isArray(product?.specs) ? product.specs : []
  const fee =
    specs.find((s) => /手数料|fee|コスト|売買/i.test(String(s.label || '')))?.value
    || specs[0]?.value
    || '要確認'
  const points =
    specs.find((s) => /ポイント|還元|特典/i.test(String(s.label || '')))?.value
    || specs[1]?.value
    || '—'
  const third = specs[2]
  const noteExtra = third && third.value ? `${third.label}: ${third.value}` : ''
  const url = String(product.apply_url || '').trim() || '#'
  return {
    id: String(product.id),
    name: product.name,
    fee,
    points,
    note: String(product.description || '').trim() || noteExtra || '',
    url,
  }
}

export async function fetchProductById(productId) {
  const products = await fetchActiveProducts()
  const raw = String(productId ?? '').trim()
  return products.find((item) => String(item.id) === raw) || null
}
