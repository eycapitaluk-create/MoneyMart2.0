import { supabase } from './supabase'

const FEED_LIMIT = 30

const normalizePost = (post, tags = [], likeMap = new Set(), bookmarkMap = new Set(), followMap = new Set()) => ({
  ...post,
  tags,
  isLiked: likeMap.has(post.id),
  isBookmarked: bookmarkMap.has(post.id),
  isFollowingAuthor: followMap.has(post.author_id),
})

const getUserProfileName = async (userId, fallbackEmail = '') => {
  if (!userId) return 'Guest'
  const { data } = await supabase
    .from('user_profiles')
    .select('nickname, full_name')
    .eq('user_id', userId)
    .maybeSingle()
  if (data?.nickname) return data.nickname
  if (data?.full_name) return data.full_name
  return fallbackEmail ? fallbackEmail.split('@')[0] : 'Member'
}

export async function getCurrentLoungeUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) {
    const msg = String(error.message || '').toLowerCase()
    if (msg.includes('auth session missing')) return null
    throw error
  }
  const user = data?.user || null
  if (!user) return null
  const displayName = await getUserProfileName(user.id, user.email)
  return {
    id: user.id,
    email: user.email || '',
    displayName,
  }
}

export async function fetchTrendingTags(limit = 8) {
  const { data, error } = await supabase
    .from('lounge_post_tags')
    .select('tag, post_id, lounge_posts!inner(status)')
    .eq('lounge_posts.status', 'published')
    .limit(500)
  if (error) throw error

  const tagStats = new Map()
  for (const row of data || []) {
    const key = (row.tag || '').trim()
    if (!key) continue
    tagStats.set(key, (tagStats.get(key) || 0) + 1)
  }

  return Array.from(tagStats.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export async function fetchFeed({ tab = 'popular', search = '', userId = null, limit = FEED_LIMIT } = {}) {
  let postIdsFilter = null
  let authorIdsFilter = null

  if (tab === 'saved') {
    if (!userId) return []
    const { data: saved, error: savedErr } = await supabase
      .from('lounge_post_bookmarks')
      .select('post_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (savedErr) throw savedErr
    postIdsFilter = (saved || []).map((r) => r.post_id)
    if (postIdsFilter.length === 0) return []
  } else if (tab === 'following') {
    if (!userId) return []
    const { data: follows, error: followErr } = await supabase
      .from('lounge_user_follows')
      .select('following_id')
      .eq('follower_id', userId)
    if (followErr) throw followErr
    authorIdsFilter = (follows || []).map((r) => r.following_id)
    if (authorIdsFilter.length === 0) return []
  }

  let query = supabase
    .from('lounge_posts')
    .select('*')
    .eq('status', 'published')

  if (postIdsFilter) query = query.in('id', postIdsFilter)
  if (authorIdsFilter) query = query.in('author_id', authorIdsFilter)
  if (search.trim()) {
    const keyword = search.trim().replace(/,/g, ' ')
    query = query.or(`title.ilike.%${keyword}%,content.ilike.%${keyword}%,ticker.ilike.%${keyword}%`)
  }

  query = tab === 'new'
    ? query.order('created_at', { ascending: false })
    : query.order('hot_score', { ascending: false }).order('created_at', { ascending: false })
  query = query.limit(limit)

  const { data: posts, error } = await query
  if (error) throw error
  if (!posts || posts.length === 0) return []

  const postIds = posts.map((p) => p.id)
  const authorIds = [...new Set(posts.map((p) => p.author_id))]

  const { data: tagRows, error: tagError } = await supabase
    .from('lounge_post_tags')
    .select('post_id, tag')
    .in('post_id', postIds)
  if (tagError) throw tagError

  const tagsByPost = new Map()
  for (const row of tagRows || []) {
    const prev = tagsByPost.get(row.post_id) || []
    tagsByPost.set(row.post_id, [...prev, row.tag])
  }

  let likeSet = new Set()
  let bookmarkSet = new Set()
  let followSet = new Set()
  if (userId) {
    const [likeRes, bookmarkRes, followRes] = await Promise.all([
      supabase.from('lounge_post_likes').select('post_id').eq('user_id', userId).in('post_id', postIds),
      supabase.from('lounge_post_bookmarks').select('post_id').eq('user_id', userId).in('post_id', postIds),
      supabase.from('lounge_user_follows').select('following_id').eq('follower_id', userId).in('following_id', authorIds),
    ])
    if (likeRes.error) throw likeRes.error
    if (bookmarkRes.error) throw bookmarkRes.error
    if (followRes.error) throw followRes.error
    likeSet = new Set((likeRes.data || []).map((r) => r.post_id))
    bookmarkSet = new Set((bookmarkRes.data || []).map((r) => r.post_id))
    followSet = new Set((followRes.data || []).map((r) => r.following_id))
  }

  return posts.map((post) =>
    normalizePost(
      post,
      tagsByPost.get(post.id) || [],
      likeSet,
      bookmarkSet,
      followSet
    )
  )
}

export async function fetchComments(postId) {
  const { data, error } = await supabase
    .from('lounge_comments')
    .select('*')
    .eq('post_id', postId)
    .eq('status', 'published')
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) throw error
  return data || []
}

export async function createPost({ userId, title, content, ticker = '', assetType = 'general', sentiment = 'neutral', tags = [] }) {
  const authorName = await getUserProfileName(userId)
  const { data, error } = await supabase
    .from('lounge_posts')
    .insert({
      author_id: userId,
      author_name: authorName,
      title,
      content,
      ticker: ticker || null,
      asset_type: assetType,
      sentiment,
    })
    .select('*')
    .single()
  if (error) throw error

  const tagPayload = [...new Set((tags || []).map((t) => t.trim()).filter(Boolean))].map((tag) => ({
    post_id: data.id,
    tag,
  }))
  if (tagPayload.length > 0) {
    const { error: tagError } = await supabase.from('lounge_post_tags').insert(tagPayload)
    if (tagError) throw tagError
  }

  return data
}

export async function createComment({ postId, userId, content }) {
  const authorName = await getUserProfileName(userId)
  const { data, error } = await supabase
    .from('lounge_comments')
    .insert({
      post_id: postId,
      author_id: userId,
      author_name: authorName,
      content,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function toggleLike({ postId, userId }) {
  const { data: targetPost, error: postErr } = await supabase
    .from('lounge_posts')
    .select('author_id')
    .eq('id', postId)
    .maybeSingle()
  if (postErr) throw postErr
  if (targetPost?.author_id && targetPost.author_id === userId) {
    throw new Error('自分の投稿にはいいねできません。')
  }

  const { data: existing, error: findErr } = await supabase
    .from('lounge_post_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle()
  if (findErr) throw findErr

  if (existing?.id) {
    const { error } = await supabase.from('lounge_post_likes').delete().eq('id', existing.id)
    if (error) throw error
    return false
  }
  const { error } = await supabase.from('lounge_post_likes').insert({ post_id: postId, user_id: userId })
  if (error) throw error
  return true
}

export async function deleteOwnPost({ postId, userId }) {
  const { error } = await supabase
    .from('lounge_posts')
    .delete()
    .eq('id', postId)
    .eq('author_id', userId)
  if (error) throw error
}

export async function toggleBookmark({ postId, userId }) {
  const { data: existing, error: findErr } = await supabase
    .from('lounge_post_bookmarks')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle()
  if (findErr) throw findErr

  if (existing?.id) {
    const { error } = await supabase.from('lounge_post_bookmarks').delete().eq('id', existing.id)
    if (error) throw error
    return false
  }
  const { error } = await supabase.from('lounge_post_bookmarks').insert({ post_id: postId, user_id: userId })
  if (error) throw error
  return true
}

export async function toggleFollow({ targetUserId, userId }) {
  const { data: existing, error: findErr } = await supabase
    .from('lounge_user_follows')
    .select('id')
    .eq('follower_id', userId)
    .eq('following_id', targetUserId)
    .maybeSingle()
  if (findErr) throw findErr

  if (existing?.id) {
    const { error } = await supabase.from('lounge_user_follows').delete().eq('id', existing.id)
    if (error) throw error
    return false
  }
  const { error } = await supabase.from('lounge_user_follows').insert({
    follower_id: userId,
    following_id: targetUserId,
  })
  if (error) throw error
  return true
}

export async function submitReport({ reporterId, targetType, targetPostId = null, targetCommentId = null, reason, details = '' }) {
  const { error } = await supabase.from('lounge_reports').insert({
    reporter_id: reporterId,
    target_type: targetType,
    target_post_id: targetPostId,
    target_comment_id: targetCommentId,
    reason,
    details: details || null,
  })
  if (error) throw error
}

export async function fetchNotifications(userId, limit = 50) {
  const { data, error } = await supabase
    .from('lounge_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function markNotificationRead(notificationId) {
  const { error } = await supabase
    .from('lounge_notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
  if (error) throw error
}

export async function fetchAdminReports(status = 'all', limit = 200) {
  let query = supabase
    .from('lounge_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (status !== 'all') query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function updateReportStatus(reportId, status) {
  const { error } = await supabase
    .from('lounge_reports')
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq('id', reportId)
  if (error) throw error
}

export async function updatePostStatus(postId, status) {
  const { error } = await supabase
    .from('lounge_posts')
    .update({ status })
    .eq('id', postId)
  if (error) throw error
}

export async function updateCommentStatus(commentId, status) {
  const { error } = await supabase
    .from('lounge_comments')
    .update({ status })
    .eq('id', commentId)
  if (error) throw error
}
