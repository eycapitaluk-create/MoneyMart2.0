import { supabase } from './supabase'

const toDateText = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

const normalizeDataRows = (rows) => {
  if (!Array.isArray(rows)) return []
  return rows
    .map((row) => ({
      label: String(row?.label || '').trim(),
      value: String(row?.value || '').trim(),
      note: String(row?.note || '').trim(),
    }))
    .filter((row) => row.label && row.value)
}

const normalizeTools = (tools) => {
  if (!Array.isArray(tools)) return []
  return tools
    .map((tool) => String(tool || '').trim())
    .filter(Boolean)
}

const normalizeInsightRow = (row) => ({
  id: Number(row?.id || 0),
  featured: Boolean(row?.featured),
  target: String(row?.target || '').trim(),
  category: String(row?.category || '').trim(),
  headline: String(row?.headline || '').trim(),
  summary: String(row?.summary || '').trim(),
  idea: String(row?.idea || '').trim(),
  rationale: String(row?.rationale || '').trim(),
  data: normalizeDataRows(row?.data),
  dataNote: String(row?.data_note || '').trim(),
  risk: String(row?.risk || '').trim(),
  relatedTools: normalizeTools(row?.related_tools),
  date: toDateText(row?.published_at),
  readTime: String(row?.read_time || '').trim(),
  sortOrder: Number(row?.sort_order || 0),
  isActive: Boolean(row?.is_active),
})

export async function fetchPublishedInsights() {
  const { data, error } = await supabase
    .from('insights_editorial')
    .select('id,featured,target,category,headline,summary,idea,rationale,data,data_note,risk,related_tools,published_at,read_time,sort_order,is_active')
    .eq('is_active', true)
    .order('featured', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('published_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(200)

  if (error) throw error
  return (data || []).map(normalizeInsightRow).filter((row) => row.headline && row.summary)
}

