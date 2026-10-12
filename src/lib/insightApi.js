import { supabase } from './supabase'
import { INSIGHT_DOCUMENT_TEMPLATE } from '../data/insightDocumentTemplate'
import { normalizeInsightDocumentForRender } from './insightDocumentNormalize'

function normalizeDocument(raw) {
  if (raw == null) return {}
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw)
      return p && typeof p === 'object' ? p : {}
    } catch {
      return {}
    }
  }
  return {}
}

function mapRow(row) {
  if (!row) return null
  return {
    id: row.id,
    slug: row.slug || '',
    pageTitle: row.page_title || row.pageTitle || 'Insight',
    document: normalizeInsightDocumentForRender(normalizeDocument(row.document)),
    isPublished: Boolean(row.is_published ?? row.isPublished ?? true),
    publishedAt: row.published_at || row.publishedAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
    createdAt: row.created_at || row.createdAt || null,
  }
}

function mapPublicPreviewRow(row) {
  if (!row) return null
  return {
    slug: String(row.slug || '').trim(),
    pageTitle: String(row.page_title || row.pageTitle || 'Insight').trim() || 'Insight',
    publishedAt: row.published_at || row.publishedAt || null,
    previewText: String(row.preview_text || row.previewText || '').trim(),
    categoryLabel: String(row.category_label || row.categoryLabel || 'インサイト').trim() || 'インサイト',
    coverImageUrl: String(row.cover_image_url || row.coverImageUrl || '').trim(),
  }
}

async function fetchInsightFromPublicApi(slug) {
  const safe = String(slug || '').trim()
  if (!safe) return null
  try {
    const res = await fetch(`/api/insight-public?slug=${encodeURIComponent(safe)}`)
    if (!res.ok) return null
    const json = await res.json()
    return mapRow(json?.row)
  } catch (e) {
    console.warn('[insight] fetchInsightFromPublicApi failed:', e?.message || e)
    return null
  }
}

async function fetchPublishedInsightsFromPublicApi(limit = 40) {
  try {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.trunc(limit))) : 40
    const res = await fetch(`/api/insight-public?catalog=1&limit=${safeLimit}`)
    if (!res.ok) return []
    const json = await res.json()
    return (json?.rows || []).map(mapRow).filter((r) => r?.slug)
  } catch (e) {
    console.warn('[insight] fetchPublishedInsightsFromPublicApi failed:', e?.message || e)
    return []
  }
}

/** anon / 未ログイン: タイトル・リードのみ（RLS で本文不可のとき） */
export async function fetchInsightPublicPreview(slug) {
  const safe = String(slug || '').trim()
  if (!safe) return null
  try {
    const { data, error } = await supabase.rpc('get_insight_public_preview', { p_slug: safe })
    if (error) {
      const msg = String(error.message || '')
      if (msg.includes('get_insight_public_preview') || msg.includes('Could not find the function')) {
        return null
      }
      console.warn('[insight] fetchInsightPublicPreview:', msg)
      return null
    }
    const row = Array.isArray(data) ? data[0] : data
    return mapPublicPreviewRow(row)
  } catch (e) {
    console.warn('[insight] fetchInsightPublicPreview failed:', e?.message || e)
    return null
  }
}

/** anon 向け一覧カタログ（タイトル・リードのみ） */
export async function fetchInsightPublicCatalog(limit = 40) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.trunc(limit))) : 40

  const mapFullRowsToPreview = (fullRows) =>
    fullRows.map((r) => mapPublicPreviewRow({
      slug: r.slug,
      page_title: r.pageTitle,
      published_at: r.publishedAt,
      preview_text: r.document?.hero?.sub || '',
      category_label: r.document?.admin?.category || r.document?.hero?.badge || 'インサイト',
      cover_image_url: r.document?.admin?.coverImageUrl || r.document?.hero?.coverImageUrl || '',
    })).filter((r) => r?.slug)

  try {
    const { data, error } = await supabase.rpc('list_insight_public_catalog', { p_limit: safeLimit })
    if (error) {
      const msg = String(error.message || '')
      if (msg.includes('list_insight_public_catalog') || msg.includes('Could not find the function')) {
        return mapFullRowsToPreview(await fetchPublishedInsightsFromPublicApi(safeLimit))
      }
      console.warn('[insight] fetchInsightPublicCatalog:', msg)
      return mapFullRowsToPreview(await fetchPublishedInsightsFromPublicApi(safeLimit))
    }
    const rows = (data || []).map(mapPublicPreviewRow).filter((r) => r?.slug)
    if (rows.length) return rows
    return mapFullRowsToPreview(await fetchPublishedInsightsFromPublicApi(safeLimit))
  } catch (e) {
    console.warn('[insight] fetchInsightPublicCatalog failed:', e?.message || e)
    return mapFullRowsToPreview(await fetchPublishedInsightsFromPublicApi(safeLimit))
  }
}

export function mapPublicPreviewToInsightRow(preview) {
  if (!preview) return null
  const title = String(preview.pageTitle || '').trim() || 'Insight'
  return {
    id: null,
    slug: preview.slug,
    pageTitle: title,
    document: normalizeInsightDocumentForRender({
      hero: {
        titleLines: [[{ text: title }]],
        badge: preview.categoryLabel,
        coverImageUrl: preview.coverImageUrl || undefined,
      },
      admin: {
        category: preview.categoryLabel,
        coverImageUrl: preview.coverImageUrl || undefined,
      },
    }),
    isPublished: true,
    publishedAt: preview.publishedAt,
    updatedAt: preview.publishedAt,
    createdAt: preview.publishedAt,
    membersPreviewOnly: true,
  }
}

export function getFallbackInsight() {
  return {
    id: null,
    slug: 'sample',
    pageTitle: 'マーケット・インサイト（サンプル）',
    document: normalizeInsightDocumentForRender(INSIGHT_DOCUMENT_TEMPLATE),
    isPublished: true,
    publishedAt: null,
    updatedAt: null,
    createdAt: null,
  }
}

async function fetchInsightBySlugViaRpc(slug) {
  try {
    const { data, error } = await supabase.rpc('get_insight_public_article', { p_slug: slug })
    if (error) {
      const msg = String(error.message || '')
      if (msg.includes('get_insight_public_article') || msg.includes('Could not find the function')) return null
      console.warn('[insight] fetchInsightBySlug rpc:', msg)
      return null
    }
    const row = Array.isArray(data) ? data[0] : data
    return mapRow(row)
  } catch (e) {
    console.warn('[insight] fetchInsightBySlug rpc failed:', e?.message || e)
    return null
  }
}

/** @param {string} slug */
export async function fetchInsightBySlug(slug) {
  const safe = String(slug || '').trim()
  if (!safe) return null
  try {
    const { data, error } = await supabase
      .from('insight_articles')
      .select('id,slug,page_title,document,is_published,published_at,updated_at,created_at')
      .eq('slug', safe)
      .eq('is_published', true)
      .maybeSingle()

    if (error) {
      const msg = String(error.message || '')
      const code = String(error.code || '')
      if (msg.includes("Could not find the table") || msg.includes('insight_articles')) {
        return fetchInsightBySlugViaRpc(safe) || fetchInsightFromPublicApi(safe)
      }
      if (code === 'PGRST116' || code === '42P01') {
        return fetchInsightBySlugViaRpc(safe) || fetchInsightFromPublicApi(safe)
      }
      console.warn('[insight] fetchInsightBySlug:', msg)
      return fetchInsightBySlugViaRpc(safe) || fetchInsightFromPublicApi(safe)
    }

    if (data) return mapRow(data)
    return fetchInsightBySlugViaRpc(safe) || fetchInsightFromPublicApi(safe)
  } catch (e) {
    console.warn('[insight] fetchInsightBySlug failed:', e?.message || e)
    return fetchInsightBySlugViaRpc(safe) || fetchInsightFromPublicApi(safe)
  }
}

export async function fetchLatestInsight() {
  try {
    const { data, error } = await supabase
      .from('insight_articles')
      .select('id,slug,page_title,document,is_published,published_at,updated_at,created_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      const msg = String(error?.message || '')
      const code = String(error?.code || '')
      if (msg.includes("Could not find the table") || msg.includes('insight_articles')) return null
      if (code === 'PGRST116' || code === '42P01') return null
      console.warn('[insight] fetchLatestInsight:', msg)
      return null
    }

    if (data) return mapRow(data)
    const fromApi = await fetchPublishedInsightsFromPublicApi(1)
    return fromApi[0] || null
  } catch (e) {
    console.warn('[insight] fetchLatestInsight failed:', e?.message || e)
    return null
  }
}

/** Public list: published rows only */
export async function fetchPublishedInsights(limit = 24) {
  try {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.trunc(limit))) : 24
    const { data, error } = await supabase
      .from('insight_articles')
      .select('id,slug,page_title,document,is_published,published_at,updated_at,created_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(safeLimit)

    if (error) {
      const msg = String(error?.message || '')
      const code = String(error?.code || '')
      if (msg.includes("Could not find the table") || msg.includes('insight_articles') || code === '42P01') {
        return fetchPublishedInsightsFromPublicApi(safeLimit)
      }
      console.warn('[insight] fetchPublishedInsights:', msg)
      const fromApi = await fetchPublishedInsightsFromPublicApi(safeLimit)
      return fromApi.length ? fromApi : []
    }

    const rows = (data || []).map(mapRow)
    if (rows.length) return rows
    return fetchPublishedInsightsFromPublicApi(safeLimit)
  } catch (e) {
    console.warn('[insight] fetchPublishedInsights failed:', e?.message || e)
    return fetchPublishedInsightsFromPublicApi(limit)
  }
}

/** Admin: all rows */
export async function fetchAllInsightsAdmin() {
  const { data, error } = await supabase
    .from('insight_articles')
    .select('id,slug,page_title,document,is_published,published_at,updated_at,created_at')
    .order('updated_at', { ascending: false })
    .limit(100)

  if (error) throw error
  return (data || []).map(mapRow)
}
