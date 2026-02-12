import { supabase } from './supabase'

export async function fetchPublishedAcademyCourses(limit = 200) {
  const { data, error } = await supabase
    .from('academy_courses')
    .select('id,title,youtube_url,category_key,level,duration_seconds,thumbnail_style,tutor_name,view_count,tags,is_featured,display_order')
    .eq('is_published', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    const message = String(error.message || '')
    if (message.includes("Could not find the table 'public.academy_courses'")) return []
    throw error
  }

  return (data || []).map((row) => ({
    id: row.id,
    title: row.title || '',
    youtubeUrl: row.youtube_url || '',
    categoryKey: row.category_key || 'general',
    level: row.level || '初級',
    durationSeconds: Number(row.duration_seconds || 0),
    thumbnailStyle: row.thumbnail_style || 'bg-slate-500',
    tutorName: row.tutor_name || 'MoneyMart Academy',
    viewCount: Number(row.view_count || 0),
    tags: Array.isArray(row.tags) ? row.tags : [],
    isFeatured: Boolean(row.is_featured),
    displayOrder: Number(row.display_order || 999),
  }))
}
