import { supabase } from './supabase'
import { INSIGHT_DOCUMENT_TEMPLATE } from '../data/insightDocumentTemplate'

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
    pageTitle: row.page_title || 'Insight',
    document: normalizeDocument(row.document),
    isPublished: Boolean(row.is_published),
    publishedAt: row.published_at || null,
    updatedAt: row.updated_at || null,
    createdAt: row.created_at || null,
  }
}

export function getFallbackInsight() {
  return {
    id: null,
    slug: 'sample',
    pageTitle: 'マーケット・インサイト（サンプル）',
    document: INSIGHT_DOCUMENT_TEMPLATE,
    isPublished: true,
    publishedAt: null,
    updatedAt: null,
    createdAt: null,
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
      if (msg.includes("Could not find the table") || msg.includes('insight_articles')) return null
      if (code === 'PGRST116' || code === '42P01') return null
      console.warn('[insight] fetchInsightBySlug:', msg)
      return null
    }

    return mapRow(data)
  } catch (e) {
    console.warn('[insight] fetchInsightBySlug failed:', e?.message || e)
    return null
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

    return mapRow(data)
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
      if (msg.includes("Could not find the table") || msg.includes('insight_articles') || code === '42P01') return []
      console.warn('[insight] fetchPublishedInsights:', msg)
      return []
    }

    return (data || []).map(mapRow)
  } catch (e) {
    console.warn('[insight] fetchPublishedInsights failed:', e?.message || e)
    return []
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
