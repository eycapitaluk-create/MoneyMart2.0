import { supabase } from './supabase'

const DIGEST_BUCKET = 'community_digest'

const toJstHour = (date = new Date()) => {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    hour12: false,
  })
  return Number(fmt.format(date))
}

const getDigestSlot = (date = new Date()) => (toJstHour(date) < 12 ? 'am' : 'pm')

const buildDigestText = (posts = []) => {
  if (!Array.isArray(posts) || posts.length === 0) {
    return '今日はまだ目立った投稿がありません。最初の投稿をしてコミュニティを盛り上げましょう。'
  }
  const top = posts.slice(0, 3)
  const highlights = top.map((p, idx) => `${idx + 1}. ${p.title}`).join(' / ')
  return `注目投稿: ${highlights}`
}

const toRows = (slot, summary, posts = []) => ([
  {
    bucket: DIGEST_BUCKET,
    sort_order: 1,
    source: `lounge-${slot}`,
    title: slot === 'am' ? 'Morning Key Summary' : 'Afternoon Key Summary',
    description: summary,
    url: '',
    image_url: '',
    topic: 'Lounge Digest',
    time_text: slot === 'am' ? '09:00 JST' : '18:00 JST',
    language: 'ja',
    published_at: new Date().toISOString(),
    tone: 'neutral',
    is_active: true,
  },
  ...posts.slice(0, 3).map((p, idx) => ({
    bucket: DIGEST_BUCKET,
    sort_order: idx + 2,
    source: `lounge-${slot}`,
    title: p.title,
    description: String(p.content || '').slice(0, 180),
    url: `/lounge?post=${p.id}`,
    image_url: '',
    topic: 'Lounge Post',
    time_text: '',
    language: 'ja',
    published_at: p.created_at || new Date().toISOString(),
    tone: null,
    is_active: true,
  })),
])

export async function fetchLoungeDigest() {
  const { data, error } = await supabase
    .from('news_manual')
    .select('id,source,title,description,url,published_at,sort_order,updated_at')
    .eq('bucket', DIGEST_BUCKET)
    .order('sort_order', { ascending: true })
    .limit(10)
  if (error) return null
  if (!Array.isArray(data) || data.length === 0) return null
  const header = data[0]
  return {
    slot: String(header.source || '').includes('-pm') ? 'pm' : 'am',
    title: header.title || 'Community Digest',
    summary: header.description || '',
    items: data.slice(1).map((row) => ({ id: row.id, title: row.title, url: row.url })),
    updatedAt: header.updated_at || header.published_at || null,
  }
}

export async function generateAndSaveLoungeDigest() {
  const slot = getDigestSlot(new Date())

  const { data: posts, error: postErr } = await supabase
    .from('lounge_posts')
    .select('id,title,content,created_at,like_count,comment_count,view_count')
    .eq('status', 'published')
    .order('hot_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(20)
  if (postErr) throw postErr

  const summary = buildDigestText(posts || [])
  const rows = toRows(slot, summary, posts || [])

  const { error: deleteErr } = await supabase
    .from('news_manual')
    .delete()
    .eq('bucket', DIGEST_BUCKET)
  if (deleteErr) throw deleteErr

  const { error: insertErr } = await supabase
    .from('news_manual')
    .insert(rows)
  if (insertErr) throw insertErr

  return { slot, summary, count: rows.length }
}
