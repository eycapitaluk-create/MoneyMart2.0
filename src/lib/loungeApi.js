import { supabase } from './supabase'
import { expToLevel, getBadgeByExp } from './loungeCharacterApi'

const FEED_LIMIT = 30

let communitySchemaAvailablePromise = null

const isMissingTableError = (error) => {
  const msg = String(error?.message || '').toLowerCase()
  return msg.includes('does not exist') || msg.includes('relation') || msg.includes('not found')
}

const hasCommunitySchema = async () => {
  if (!communitySchemaAvailablePromise) {
    communitySchemaAvailablePromise = (async () => {
      const { error } = await supabase.from('community_posts').select('id').limit(1)
      return !error
    })()
  }
  return communitySchemaAvailablePromise
}

const fetchProfileNameMap = async (userIds = []) => {
  const ids = [...new Set((userIds || []).filter(Boolean))]
  if (ids.length === 0) return new Map()
  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id,nickname,full_name')
    .in('user_id', ids)
  if (error) return new Map()
  return new Map(
    (data || []).map((row) => [
      row.user_id,
      row.nickname || row.full_name || 'Member',
    ])
  )
}

const buildTitleFromContent = (content = '') => {
  const firstLine = String(content).split('\n').find((line) => line.trim())
  return (firstLine || 'ラウンジ投稿').slice(0, 80)
}

const LOUNGE_IMAGES_BUCKET = 'lounge-images'

export async function uploadLoungeImages(userId, files) {
  if (!files?.length) return []
  const urls = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z]/g, 'jpg')
    const path = `${userId}/${Date.now()}-${i}.${ext}`
    const { data, error } = await supabase.storage.from(LOUNGE_IMAGES_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })
    if (error) continue
    const { data: urlData } = supabase.storage.from(LOUNGE_IMAGES_BUCKET).getPublicUrl(data.path)
    if (urlData?.publicUrl) urls.push(urlData.publicUrl)
  }
  return urls
}

const parseNotificationLevel = (payload) => {
  if (!payload) return 0
  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload)
      return Number(parsed?.level || 0)
    } catch {
      return 0
    }
  }
  return Number(payload?.level || 0)
}

const recordLevelBadgeNotificationIfEarned = async (userId) => {
  if (!userId) return null

  const { data: stats, error: statsErr } = await supabase
    .from('lounge_character_stats')
    .select('total_exp')
    .eq('user_id', userId)
    .maybeSingle()
  if (statsErr) return null

  const totalExp = Number(stats?.total_exp || 0)
  const level = expToLevel(totalExp)
  if (level <= 1) return null

  const { data: existing, error: existingErr } = await supabase
    .from('lounge_notifications')
    .select('id,payload')
    .eq('user_id', userId)
    .eq('type', 'badge_level')
    .order('created_at', { ascending: false })
    .limit(50)
  if (existingErr) return null

  const alreadyHasLevel = (existing || []).some((row) => parseNotificationLevel(row?.payload) === level)
  if (alreadyHasLevel) return null

  const badge = getBadgeByExp(totalExp)
  const { error: insertErr } = await supabase.from('lounge_notifications').insert({
    user_id: userId,
    type: 'badge_level',
    payload: {
      level,
      total_exp: totalExp,
      badge_id: badge?.id || 'rookie',
      badge_label: badge?.label || 'Rookie',
    },
  })
  if (insertErr) return null

  return { level, totalExp, badge }
}

const normalizePost = (post, tags = [], likeMap = new Set(), bookmarkMap = new Set(), followMap = new Set()) => ({
  ...post,
  tags,
  isLiked: likeMap.has(post.id),
  isBookmarked: bookmarkMap.has(post.id),
  isFollowingAuthor: followMap.has(post.author_id || post.user_id),
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
  // Preferred path: new community aggregation source
  const { data: newRows, error: newErr } = await supabase
    .from('trending_assets')
    .select('*')
    .limit(Math.max(limit * 2, 16))
  if (!newErr && Array.isArray(newRows)) {
    const normalized = newRows
      .map((row) => ({
        tag: row.asset_tag || row.tag || '',
        count: Number(row.mention_count || row.post_count || row.count || 0),
      }))
      .filter((row) => row.tag)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
    if (normalized.length > 0) return normalized
  }

  // Community schema fallback: aggregate from community_posts.asset_tag
  if (await hasCommunitySchema()) {
    const { data: cpRows, error: cpErr } = await supabase
      .from('community_posts')
      .select('asset_tag')
      .limit(500)
    if (!cpErr && Array.isArray(cpRows)) {
      const tagStats = new Map()
      for (const row of cpRows) {
        const tag = String(row.asset_tag || '').trim() || 'TOPIC'
        tagStats.set(tag, (tagStats.get(tag) || 0) + 1)
      }
      const result = [...tagStats.entries()]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
      if (result.length > 0) return result
    }
  }

  // Preferred path: DB-side aggregation view
  const { data: viewRows, error: viewErr } = await supabase
    .from('v_lounge_trending_tags')
    .select('tag,post_count,last_posted_at')
    .order('post_count', { ascending: false })
    .order('last_posted_at', { ascending: false })
    .limit(limit)
  if (!viewErr && Array.isArray(viewRows)) {
    return viewRows
      .filter((row) => row?.tag)
      .map((row) => ({ tag: row.tag, count: Number(row.post_count || 0) }))
  }

  // Fallback path: client-side aggregation for backward compatibility
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
  if (await hasCommunitySchema()) {
    let postIdsFilter = null
    let authorIdsFilter = null

    if (tab === 'saved') {
      if (!userId) return []
      const { data: saved, error: savedErr } = await supabase
        .from('post_engagements')
        .select('post_id,created_at')
        .eq('user_id', userId)
        .eq('type', 'bookmark')
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

    let query = supabase.from('community_posts').select('*')
    if (postIdsFilter) query = query.in('id', postIdsFilter)
    if (authorIdsFilter) query = query.in('user_id', authorIdsFilter)
    if (search.trim()) {
      const keyword = search.trim().replace(/,/g, ' ')
      query = query.or(`content.ilike.%${keyword}%,asset_tag.ilike.%${keyword}%`)
    }
    query = query.order('created_at', { ascending: false }).limit(limit)

    const { data: communityPosts, error: postErr } = await query
    if (postErr) throw postErr
    if (!communityPosts || communityPosts.length === 0) return []

    const postIds = communityPosts.map((p) => p.id)
    const authorIds = [...new Set(communityPosts.map((p) => p.user_id).filter(Boolean))]
    const [engRes, followRes, profileMap] = await Promise.all([
      supabase.from('post_engagements').select('*').in('post_id', postIds),
      userId
        ? supabase.from('lounge_user_follows').select('following_id').eq('follower_id', userId).in('following_id', authorIds)
        : Promise.resolve({ data: [], error: null }),
      fetchProfileNameMap(authorIds),
    ])
    if (engRes.error) throw engRes.error
    if (followRes.error) throw followRes.error

    const likeCountMap = new Map()
    const bookmarkCountMap = new Map()
    const commentCountMap = new Map()
    const likedSet = new Set()
    const bookmarkedSet = new Set()
    const engagements = engRes.data || []

    engagements.forEach((row) => {
      if (row.type === 'insightful') {
        likeCountMap.set(row.post_id, Number(likeCountMap.get(row.post_id) || 0) + 1)
        if (userId && row.user_id === userId) likedSet.add(row.post_id)
      } else if (row.type === 'bookmark') {
        bookmarkCountMap.set(row.post_id, Number(bookmarkCountMap.get(row.post_id) || 0) + 1)
        if (userId && row.user_id === userId) bookmarkedSet.add(row.post_id)
      } else if (row.type === 'comment') {
        commentCountMap.set(row.post_id, Number(commentCountMap.get(row.post_id) || 0) + 1)
      }
    })

    const followSet = new Set((followRes.data || []).map((r) => r.following_id))
    return communityPosts.map((post) => {
      const authorId = post.user_id || null
      const authorName = post.author_name || profileMap.get(authorId) || 'Member'
      const tag = String(post.asset_tag || '').trim()
      const item = {
        id: post.id,
        author_id: authorId,
        author_name: authorName,
        title: buildTitleFromContent(post.content),
        content: post.content || '',
        ticker: tag || null,
        sentiment: post.sentiment || 'neutral',
        tags: tag ? [tag] : [],
        image_urls: Array.isArray(post.image_urls) ? post.image_urls : [],
        like_count: Number(likeCountMap.get(post.id) || 0),
        comment_count: Number(commentCountMap.get(post.id) || 0),
        bookmark_count: Number(bookmarkCountMap.get(post.id) || 0),
        view_count: Number(post.view_count || 0),
        hot_score: Number(post.hot_score || 0),
        created_at: post.created_at,
        isLiked: likedSet.has(post.id),
        isBookmarked: bookmarkedSet.has(post.id),
        isFollowingAuthor: followSet.has(authorId),
      }
      return item
    })
  }

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
  if (await hasCommunitySchema()) {
    const { data, error } = await supabase
      .from('post_engagements')
      .select('*')
      .eq('post_id', postId)
      .eq('type', 'comment')
      .order('created_at', { ascending: true })
      .limit(200)
    if (!error) {
      const authorIds = [...new Set((data || []).map((r) => r.user_id).filter(Boolean))]
      const nameMap = await fetchProfileNameMap(authorIds)
      return (data || []).map((row) => {
        const p = row.payload || {}
        return {
          id: row.id,
          post_id: row.post_id,
          author_id: row.user_id,
          author_name: nameMap.get(row.user_id) || 'Member',
          content: row.content || p.content || '',
          created_at: row.created_at,
          parent_comment_id: p.parent_id || null,
          reply_to_user_id: p.reply_to_user_id || null,
          reply_to_name: p.reply_to_name || null,
        }
      })
    }
    if (!isMissingTableError(error)) throw error
  }

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

export async function createPost({ userId, title, content, ticker = '', assetType = 'general', sentiment = 'neutral', tags = [], imageFiles = [] }) {
  let imageUrls = []
  if (imageFiles?.length) {
    try {
      imageUrls = await uploadLoungeImages(userId, imageFiles)
    } catch {
      // continue without images
    }
  }

  if (await hasCommunitySchema()) {
    const payload = {
      user_id: userId,
      type: 'insight',
      content,
      asset_tag: ticker || tags?.[0] || null,
      sentiment: sentiment || 'neutral',
    }
    if (imageUrls.length) payload.image_urls = imageUrls
    const { data, error } = await supabase
      .from('community_posts')
      .insert(payload)
      .select('*')
      .single()
    if (!error) {
      await recordWeeklyBadgeIfEarned(userId)
      await recordLevelBadgeNotificationIfEarned(userId)
      return data
    }
    if (!isMissingTableError(error)) throw error
  }

  const authorName = await getUserProfileName(userId)
  const insertPayload = {
    author_id: userId,
    author_name: authorName,
    title,
    content,
    ticker: ticker || null,
    asset_type: assetType,
    sentiment,
  }
  if (imageUrls.length) insertPayload.image_urls = imageUrls
  const { data, error } = await supabase
    .from('lounge_posts')
    .insert(insertPayload)
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

  await recordWeeklyBadgeIfEarned(userId)
  await recordLevelBadgeNotificationIfEarned(userId)
  return data
}

export async function createComment({ postId, userId, content, parentCommentId = null, replyToUserId = null, replyToName = null }) {
  if (await hasCommunitySchema()) {
    const payload = { content }
    if (parentCommentId) payload.parent_id = parentCommentId
    if (replyToUserId) payload.reply_to_user_id = replyToUserId
    if (replyToName) payload.reply_to_name = replyToName

    const rich = await supabase
      .from('post_engagements')
      .insert({
        post_id: postId,
        user_id: userId,
        type: 'comment',
        content,
        payload,
      })
      .select('*')
      .single()
    if (!rich.error) {
      await recordLevelBadgeNotificationIfEarned(userId)
      return rich.data
    }

    const minimal = await supabase
      .from('post_engagements')
      .insert({
        post_id: postId,
        user_id: userId,
        type: 'comment',
      })
      .select('*')
      .single()
    if (!minimal.error) {
      await recordLevelBadgeNotificationIfEarned(userId)
      return minimal.data
    }

    if (!isMissingTableError(minimal.error)) throw minimal.error
  }

  const authorName = await getUserProfileName(userId)
  const insertPayload = {
    post_id: postId,
    author_id: userId,
    author_name: authorName,
    content,
  }
  if (parentCommentId) insertPayload.parent_comment_id = parentCommentId
  if (replyToUserId) insertPayload.reply_to_user_id = replyToUserId
  if (replyToName) insertPayload.reply_to_name = replyToName

  const { data, error } = await supabase
    .from('lounge_comments')
    .insert(insertPayload)
    .select('*')
    .single()
  if (error) throw error
  await recordLevelBadgeNotificationIfEarned(userId)
  return data
}

export async function toggleLike({ postId, userId }) {
  if (await hasCommunitySchema()) {
    const { data: targetPost, error: postErr } = await supabase
      .from('community_posts')
      .select('user_id')
      .eq('id', postId)
      .maybeSingle()
    if (postErr) throw postErr
    if (targetPost?.user_id && targetPost.user_id === userId) {
      throw new Error('自分の投稿にはいいねできません。')
    }

    const { data: existing, error: findErr } = await supabase
      .from('post_engagements')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .eq('type', 'insightful')
      .maybeSingle()
    if (findErr) throw findErr

    if (existing?.id) {
      const { error } = await supabase.from('post_engagements').delete().eq('id', existing.id)
      if (error) throw error
      return false
    }

    const { error } = await supabase
      .from('post_engagements')
      .insert({ post_id: postId, user_id: userId, type: 'insightful' })
    if (error) throw error
    await recordLevelBadgeNotificationIfEarned(userId)
    return true
  }

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
  await recordLevelBadgeNotificationIfEarned(userId)
  return true
}

export async function deleteOwnPost({ postId, userId }) {
  if (await hasCommunitySchema()) {
    const { error } = await supabase
      .from('community_posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', userId)
    if (!error) return
    if (!isMissingTableError(error)) throw error
  }

  const { error } = await supabase
    .from('lounge_posts')
    .delete()
    .eq('id', postId)
    .eq('author_id', userId)
  if (error) throw error
}

export async function updateOwnPost({
  postId,
  userId,
  content,
  ticker = '',
  sentiment = 'neutral',
  imageUrls = [],
  imageFiles = [],
}) {
  let finalImageUrls = Array.isArray(imageUrls) ? [...imageUrls] : []
  if (imageFiles?.length) {
    try {
      const uploaded = await uploadLoungeImages(userId, imageFiles)
      finalImageUrls = [...finalImageUrls, ...uploaded]
    } catch {
      // continue without new images
    }
  }

  const updatePayload = (base) => {
    const p = { ...base }
    p.image_urls = finalImageUrls
    return p
  }

  if (await hasCommunitySchema()) {
    const { data, error } = await supabase
      .from('community_posts')
      .update(updatePayload({
        content,
        asset_tag: ticker || null,
        sentiment,
      }))
      .eq('id', postId)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle()
    if (!error) return data
    if (!isMissingTableError(error)) throw error
  }

  const { data, error } = await supabase
    .from('lounge_posts')
    .update(updatePayload({
      title: buildTitleFromContent(content),
      content,
      ticker: ticker || null,
      sentiment,
    }))
    .eq('id', postId)
    .eq('author_id', userId)
    .select('*')
    .maybeSingle()
  if (error) throw error
  return data
}

export async function toggleBookmark({ postId, userId }) {
  if (await hasCommunitySchema()) {
    const { data: existing, error: findErr } = await supabase
      .from('post_engagements')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .eq('type', 'bookmark')
      .maybeSingle()
    if (findErr) throw findErr

    if (existing?.id) {
      const { error } = await supabase.from('post_engagements').delete().eq('id', existing.id)
      if (error) throw error
      return false
    }
    const { error } = await supabase
      .from('post_engagements')
      .insert({ post_id: postId, user_id: userId, type: 'bookmark' })
    if (error) throw error
    return true
  }

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

export async function fetchSuggestedUsers({ userId = null, limit = 3 } = {}) {
  const maxRows = Math.max(limit * 8, 40)
  const followPromise = userId
    ? supabase.from('lounge_user_follows').select('following_id').eq('follower_id', userId)
    : Promise.resolve({ data: [], error: null })

  if (await hasCommunitySchema()) {
    const [postsRes, followRes, profileRes] = await Promise.all([
      supabase
        .from('community_posts')
        .select('user_id,created_at,hot_score,view_count')
        .order('created_at', { ascending: false })
        .limit(maxRows),
      followPromise,
      supabase.from('user_profiles').select('user_id,nickname,full_name').limit(1000),
    ])
    if (postsRes.error) throw postsRes.error
    if (followRes.error) throw followRes.error

    const followSet = new Set((followRes.data || []).map((row) => row.following_id))
    const profileMap = new Map((profileRes.data || []).map((row) => [
      row.user_id,
      row.nickname || row.full_name || '',
    ]))
    const aggregated = new Map()

    for (const row of postsRes.data || []) {
      const authorId = row.user_id
      if (!authorId || authorId === userId) continue
      const entry = aggregated.get(authorId) || {
        id: authorId,
        name: profileMap.get(authorId) || 'Member',
        handle: '',
        postCount: 0,
        score: 0,
        isFollowing: followSet.has(authorId),
      }
      entry.postCount += 1
      entry.score += Number(row.hot_score || 0) + (Number(row.view_count || 0) / 100)
      aggregated.set(authorId, entry)
    }

    return [...aggregated.values()]
      .sort((a, b) => (Number(b.score || 0) - Number(a.score || 0)) || (Number(b.postCount || 0) - Number(a.postCount || 0)))
      .slice(0, limit)
      .map((row) => ({
        ...row,
        handle: `@${String(row.name || 'member').replace(/\s+/g, '_').toLowerCase()}`,
        badge: Number(row.postCount || 0) >= 3,
      }))
  }

  const [postsRes, followRes] = await Promise.all([
    supabase
      .from('lounge_posts')
      .select('author_id,author_name,like_count,view_count,created_at')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(maxRows),
    followPromise,
  ])
  if (postsRes.error) throw postsRes.error
  if (followRes.error) throw followRes.error

  const followSet = new Set((followRes.data || []).map((row) => row.following_id))
  const aggregated = new Map()
  for (const row of postsRes.data || []) {
    const authorId = row.author_id
    if (!authorId || authorId === userId) continue
    const entry = aggregated.get(authorId) || {
      id: authorId,
      name: row.author_name || 'Member',
      handle: '',
      postCount: 0,
      score: 0,
      isFollowing: followSet.has(authorId),
    }
    entry.postCount += 1
    entry.score += Number(row.like_count || 0) + (Number(row.view_count || 0) / 100)
    aggregated.set(authorId, entry)
  }

  return [...aggregated.values()]
    .sort((a, b) => (Number(b.score || 0) - Number(a.score || 0)) || (Number(b.postCount || 0) - Number(a.postCount || 0)))
    .slice(0, limit)
    .map((row) => ({
      ...row,
      handle: `@${String(row.name || 'member').replace(/\s+/g, '_').toLowerCase()}`,
      badge: Number(row.postCount || 0) >= 3,
    }))
}

export async function toggleFollow({ targetUserId, userId }) {
  if (!userId || !targetUserId || userId === targetUserId) {
    throw new Error('無効なフォロー操作です。')
  }
  const { data: existing, error: findErr } = await supabase
    .from('lounge_user_follows')
    .select('id')
    .eq('follower_id', userId)
    .eq('following_id', targetUserId)
    .maybeSingle()
  if (findErr) {
    const msg = findErr?.message || String(findErr)
    if (/relation "lounge_user_follows" does not exist/i.test(msg)) {
      throw new Error('フォロー機能を利用するには、Supabaseで lounge_user_follows テーブルを作成してください。SUPABASE_SETUP_LOUNGE_SOCIAL.sql を実行してください。')
    }
    throw new Error(msg)
  }

  if (existing?.id) {
    const { error } = await supabase.from('lounge_user_follows').delete().eq('id', existing.id)
    if (error) throw new Error(error?.message || 'フォロー解除に失敗しました。')
    return false
  }
  const { error } = await supabase.from('lounge_user_follows').insert({
    follower_id: userId,
    following_id: targetUserId,
  })
  if (error) {
    const msg = error?.message || String(error)
    if (/violates check constraint|follower_id <> following_id/i.test(msg)) {
      throw new Error('自分自身をフォローすることはできません。')
    }
    throw new Error(msg)
  }
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

export async function fetchWeeklyPostCount(userId) {
  if (!userId) return 0
  const now = new Date()
  const day = now.getDay() // 0:Sun ... 6:Sat
  const diffToMonday = day === 0 ? 6 : day - 1
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - diffToMonday)
  weekStart.setHours(0, 0, 0, 0)
  const iso = weekStart.toISOString()

  const { count, error } = await supabase
    .from('lounge_posts')
    .select('*', { head: true, count: 'exact' })
    .eq('author_id', userId)
    .eq('status', 'published')
    .gte('created_at', iso)
  if (error) throw error
  return Number(count || 0)
}

export async function searchTagSuggestions(query, limit = 8) {
  const q = String(query || '').trim()
  if (!q || q.length < 1) return []
  const { data, error } = await supabase
    .from('v_lounge_trending_tags')
    .select('tag,post_count,last_posted_at')
    .ilike('tag', `%${q}%`)
    .order('post_count', { ascending: false })
    .order('last_posted_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return (data || []).map((r) => ({ tag: r.tag, count: Number(r.post_count || 0) }))
}

export async function searchTickerSuggestions(query, limit = 8) {
  const q = String(query || '').trim().toUpperCase()
  if (!q || q.length < 1) return []
  const { data, error } = await supabase
    .from('stock_symbols')
    .select('symbol,name')
    .or(`symbol.ilike.%${q}%,name.ilike.%${q}%`)
    .limit(limit)
  if (error) return []
  return (data || []).map((r) => ({
    symbol: String(r.symbol || '').toUpperCase(),
    name: r.name || '',
  }))
}

export async function fetchReactionCommentAlerts(userId, limit = 5) {
  if (!userId) return []
  const since = new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString()

  const [likeRes, bookmarkRes] = await Promise.all([
    supabase.from('lounge_post_likes').select('post_id').eq('user_id', userId).limit(500),
    supabase.from('lounge_post_bookmarks').select('post_id').eq('user_id', userId).limit(500),
  ])
  if (likeRes.error) throw likeRes.error
  if (bookmarkRes.error) throw bookmarkRes.error
  const reactedPostIds = [
    ...new Set([...(likeRes.data || []), ...(bookmarkRes.data || [])].map((r) => r.post_id).filter(Boolean)),
  ]
  if (reactedPostIds.length === 0) return []

  const targetPostIds = reactedPostIds.slice(0, 100)
  const { data: comments, error: commentErr } = await supabase
    .from('lounge_comments')
    .select('id,post_id,author_id,author_name,content,created_at')
    .in('post_id', targetPostIds)
    .eq('status', 'published')
    .neq('author_id', userId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(120)
  if (commentErr) throw commentErr
  if (!comments || comments.length === 0) return []

  const postIdSet = [...new Set(comments.map((c) => c.post_id))]
  const { data: posts, error: postErr } = await supabase
    .from('lounge_posts')
    .select('id,title,status')
    .in('id', postIdSet)
  if (postErr) throw postErr
  const titleMap = new Map((posts || []).map((p) => [p.id, p.title]))

  return comments
    .filter((c) => titleMap.has(c.post_id))
    .slice(0, limit)
    .map((c) => ({
      id: c.id,
      postId: c.post_id,
      postTitle: titleMap.get(c.post_id) || '投稿',
      authorName: c.author_name || 'メンバー',
      content: c.content || '',
      createdAt: c.created_at,
    }))
}

function getWeekStartIso() {
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = day === 0 ? 6 : day - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - diffToMonday)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().slice(0, 10)
}

export async function recordWeeklyBadgeIfEarned(userId) {
  if (!userId) return
  const weekStart = getWeekStartIso()
  const { count } = await supabase
    .from('lounge_posts')
    .select('*', { count: 'exact', head: true })
    .eq('author_id', userId)
    .eq('status', 'published')
    .gte('created_at', `${weekStart}T00:00:00.000Z`)
  if (Number(count || 0) < 3) return

  const { data: existing } = await supabase
    .from('lounge_notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'badge')
    .gte('created_at', `${weekStart}T00:00:00.000Z`)
    .limit(1)
  if (existing && existing.length > 0) return

  await supabase.from('lounge_notifications').insert({
    user_id: userId,
    type: 'badge',
    payload: { badge: 'weekly_3', week_start: weekStart },
  })
}

export async function fetchTickerPrices(symbols) {
  const list = [...new Set((symbols || []).map((s) => String(s).trim()).filter(Boolean))]
  if (list.length === 0) return {}
  const out = {}
  for (let i = 0; i < list.length; i += 80) {
    const batch = list.slice(i, i + 80)
    const { data, error } = await supabase
      .from('v_stock_latest')
      .select('symbol,trade_date,open,close')
      .in('symbol', batch)
    if (error) continue
    for (const row of data || []) {
      const open = Number(row.open)
      const close = Number(row.close)
      const rate = Number.isFinite(open) && open > 0 && Number.isFinite(close)
        ? ((close - open) / open) * 100
        : null
      out[row.symbol] = { close, open, rate, trade_date: row.trade_date }
    }
  }
  return out
}

export async function fetchCommunityDigest() {
  const { data, error } = await supabase
    .from('news_manual')
    .select('id,source,title,description,url,published_at,sort_order,updated_at')
    .eq('bucket', 'community_digest')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(10)
  if (error || !Array.isArray(data) || data.length === 0) return null
  const header = data[0]
  return {
    slot: String(header.source || '').includes('-pm') ? 'pm' : 'am',
    title: header.title || 'Community Digest',
    summary: header.description || '',
    items: data.slice(1).map((row) => ({
      id: row.id,
      title: row.title || '',
      url: row.url || '',
    })),
    updatedAt: header.updated_at || header.published_at || null,
  }
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
