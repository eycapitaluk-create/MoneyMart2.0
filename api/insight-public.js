/**
 * Published insight_articles for anon browsers (service role; published rows only).
 * GET ?slug=...  — single article
 * GET ?catalog=1&limit=40 — list (newest first)
 */
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return null
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
}

const ARTICLE_SELECT = 'id,slug,page_title,document,is_published,published_at,updated_at,created_at'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const admin = getAdmin()
  if (!admin) {
    return res.status(503).json({ error: 'Insight API unavailable' })
  }

  const slug = String(req.query.slug || '').trim()
  const catalog = req.query.catalog === '1' || req.query.catalog === 'true'
  const limitRaw = parseInt(String(req.query.limit || '40'), 10)
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 40

  try {
    if (slug) {
      const { data, error } = await admin
        .from('insight_articles')
        .select(ARTICLE_SELECT)
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle()
      if (error) throw error
      if (!data) return res.status(404).json({ error: 'not_found' })
      return res.status(200).json({ row: data })
    }

    if (catalog) {
      const { data, error } = await admin
        .from('insight_articles')
        .select(ARTICLE_SELECT)
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return res.status(200).json({ rows: data || [] })
    }

    return res.status(400).json({ error: 'Provide slug or catalog=1' })
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Insight fetch failed' })
  }
}
