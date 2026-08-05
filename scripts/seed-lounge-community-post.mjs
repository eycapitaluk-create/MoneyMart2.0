/**
 * Lounge / community sample post + comment seed
 * Usage:
 *   node scripts/seed-lounge-community-post.mjs
 *
 * Env (.env.local):
 *   SUPABASE_URL
 *   SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY
 *   COMMUNITY_SEED_USER_EMAIL (optional; defaults to oldest auth user)
 *   COMMUNITY_SEED_COMMENT_USER_EMAIL (optional; defaults to post author)
 */
import fs from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const POST_CONTENT = `セクターヒートマップを見ながら週末レビュー。エネルギー・素材がリードしてリスクオン色が強めですが、情報技術は伸び悩み。来週の米CPIとFOMC前は、地域分散（IVV / 1329.T）を意識したいですね。#セクター #マーケット`

const COMMENT_CONTENT = `マーケットページの国家別ヒートマップと併せて見ると、地域ローテーションが読みやすいです。個人的には生活必需品とヘルスケアに一点足したいと思います。`

const loadEnv = async () => {
  for (const file of ['.env.local', '.env']) {
    try {
      const raw = await fs.readFile(file, 'utf8')
      for (const line of raw.split(/\r?\n/)) {
        const t = line.trim()
        if (!t || t.startsWith('#') || !t.includes('=')) continue
        const eq = t.indexOf('=')
        const k = t.slice(0, eq).trim()
        const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
        if (k && !process.env[k]) process.env[k] = v
      }
    } catch {}
  }
}

const resolveUserId = async (admin, email) => {
  if (email) {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (error) throw error
    const hit = (data?.users || []).find((u) => String(u.email || '').toLowerCase() === email.toLowerCase())
    if (!hit) throw new Error(`User not found for email: ${email}`)
    return hit.id
  }

  const { data: profile, error: profileErr } = await admin
    .from('user_profiles')
    .select('user_id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!profileErr && profile?.user_id) return profile.user_id

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
  if (error) throw error
  const user = (data?.users || [])[0]
  if (!user?.id) throw new Error('No auth users found. Create an account first or set COMMUNITY_SEED_USER_EMAIL.')
  return user.id
}

const hasTable = async (admin, table) => {
  const { error } = await admin.from(table).select('id').limit(1)
  return !error
}

const displayNameFor = async (admin, userId) => {
  const { data } = await admin
    .from('user_profiles')
    .select('nickname,full_name')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.nickname || data?.full_name || 'Member'
}

const seedCommunitySchema = async (admin, authorId, commenterId) => {
  const { data: post, error: postErr } = await admin
    .from('community_posts')
    .insert({
      user_id: authorId,
      type: 'insight',
      content: POST_CONTENT,
      asset_tag: 'IVV',
      sentiment: 'neutral',
    })
    .select('id,created_at')
    .single()
  if (postErr) throw postErr

  const { data: comment, error: commentErr } = await admin
    .from('post_engagements')
    .insert({
      post_id: post.id,
      user_id: commenterId,
      type: 'comment',
      content: COMMENT_CONTENT,
      payload: { content: COMMENT_CONTENT },
    })
    .select('id,created_at')
    .single()
  if (commentErr) throw commentErr

  return { schema: 'community_posts', post, comment }
}

const seedLoungeSchema = async (admin, authorId, commenterId) => {
  const authorName = await displayNameFor(admin, authorId)
  const commenterName = await displayNameFor(admin, commenterId)
  const title = POST_CONTENT.split('\n').find((line) => line.trim())?.slice(0, 80) || 'ラウンジ投稿'

  const { data: post, error: postErr } = await admin
    .from('lounge_posts')
    .insert({
      author_id: authorId,
      author_name: authorName,
      title,
      content: POST_CONTENT,
      ticker: 'IVV',
      asset_type: 'general',
      sentiment: 'neutral',
      status: 'published',
    })
    .select('id,created_at')
    .single()
  if (postErr) throw postErr

  const { error: tagErr } = await admin.from('lounge_post_tags').insert([
    { post_id: post.id, tag: 'セクター' },
    { post_id: post.id, tag: 'マーケット' },
  ])
  if (tagErr) throw tagErr

  const { data: comment, error: commentErr } = await admin
    .from('lounge_comments')
    .insert({
      post_id: post.id,
      author_id: commenterId,
      author_name: commenterName,
      content: COMMENT_CONTENT,
      status: 'published',
    })
    .select('id,created_at')
    .single()
  if (commentErr) throw commentErr

  return { schema: 'lounge_posts', post, comment }
}

const run = async () => {
  await loadEnv()
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing SUPABASE_URL and service role key. Add them to .env.local')
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const authorId = await resolveUserId(admin, process.env.COMMUNITY_SEED_USER_EMAIL)
  const commenterId = await resolveUserId(
    admin,
    process.env.COMMUNITY_SEED_COMMENT_USER_EMAIL || process.env.COMMUNITY_SEED_USER_EMAIL,
  )

  const useCommunity = await hasTable(admin, 'community_posts')
  const result = useCommunity
    ? await seedCommunitySchema(admin, authorId, commenterId)
    : await seedLoungeSchema(admin, authorId, commenterId)

  console.log('Community seed complete')
  console.log(JSON.stringify({
    schema: result.schema,
    postId: result.post.id,
    postCreatedAt: result.post.created_at,
    commentId: result.comment.id,
    commentCreatedAt: result.comment.created_at,
    authorId,
    commenterId,
  }, null, 2))
}

run().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
