/**
 * Boost likes + comments on recent lounge posts using seed personas.
 *
 *   node scripts/boost-community-engagement.mjs
 *   node scripts/boost-community-engagement.mjs --days 3 --min-likes 12 --min-comments 8
 *   node scripts/boost-community-engagement.mjs --dry-run
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  COMMUNITY_SEED_PERSONAS,
  ensureAllPersonas,
} from '../api/_lib/community-hourly-seed.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[key] == null || process.env[key] === '') process.env[key] = val
  }
}

loadEnvFile(path.resolve(__dirname, '..', '.env.local'))
loadEnvFile(path.resolve(__dirname, '..', '.env'))

const DRY_RUN = process.argv.includes('--dry-run')
const daysIdx = process.argv.indexOf('--days')
const minLikesIdx = process.argv.indexOf('--min-likes')
const minCommentsIdx = process.argv.indexOf('--min-comments')
const DAYS = daysIdx >= 0 ? Number(process.argv[daysIdx + 1]) : 3
const MIN_LIKES = minLikesIdx >= 0 ? Number(process.argv[minLikesIdx + 1]) : 12
const MIN_COMMENTS = minCommentsIdx >= 0 ? Number(process.argv[minCommentsIdx + 1]) : 8

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim()
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim()

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const GENERIC_COMMENTS = [
  '同意です',
  'わかる',
  'サイズだけ見直します',
  '全額はやめます',
  '分割でいきます',
  'メモしました',
  '寄り後に再判定',
  'レバは触りません',
  '積立は継続',
  '偏り確認します',
  'おもしろい議論',
  '損切り線だけ更新',
  '現金比率メモ',
  'ウォッチリスト整理した',
  'コアETFは触らない',
]

const TOPIC_COMMENTS = {
  kioxia: [
    '285Aは分割のみ派',
    '中国DUVが怖い',
    '韓国と連動しすぎ',
    '②まだ逃げ',
    '①押し目だがサイズ小さめ',
    '8035も重い',
  ],
  kospi: [
    '韓国が先に反発?',
    '日本はもう調整した',
    '連動で午後も軟調',
    'サムスン決算も今週',
    'KOSPI6000割れは印象強い',
  ],
  nikkei: [
    '62000割れは心理的にキツい',
    '寄り30分待ち',
    '現金比率上げた',
    '戻り売り続く派',
    '底打ちはまだ早い',
  ],
  sk: [
    '過去最高でもサプライズは弱い',
    'HBMは強いはず',
    '予想下振れでギャップダウン?',
    '決算後に方向感',
  ],
  fomc: [
    '据え置きがベース',
    '会見の文言が怖い',
    '今夜は増やさない',
    'レバ禁止',
  ],
  vote: [
    '③積立のみ',
    '①現金増やした',
    '正解ない週',
    'お互い様',
  ],
}

function pick(arr, seed) {
  return arr[Math.abs(seed) % arr.length]
}

function commentPoolForPost(post) {
  const blob = `${post.title || ''} ${post.ticker || ''}`.toLowerCase()
  const extra = []
  if (/キオクシア|285a|cxmt|東エレク|8035/i.test(blob)) extra.push(...TOPIC_COMMENTS.kioxia)
  if (/kospi|韓国|kosdaq|サムスン|skハイニックス/i.test(blob)) {
    extra.push(...TOPIC_COMMENTS.kospi, ...TOPIC_COMMENTS.sk)
  }
  if (/日経|n225|62365|62000/i.test(blob)) extra.push(...TOPIC_COMMENTS.nikkei)
  if (/fomc|msft|meta|fed/i.test(blob)) extra.push(...TOPIC_COMMENTS.fomc)
  if (/投票|討論/i.test(blob)) extra.push(...TOPIC_COMMENTS.vote)
  return [...extra, ...GENERIC_COMMENTS]
}

function hashSeed(str) {
  let h = 0
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0
  return h
}

async function fetchRecentPosts(sinceIso) {
  const { data, error } = await admin
    .from('lounge_posts')
    .select('id,author_id,title,ticker,like_count,comment_count,created_at')
    .gte('created_at', sinceIso)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(80)
  if (error) throw error
  return data || []
}

async function boostPost(post, personaMap, now) {
  const seed = hashSeed(post.id)
  const authorId = post.author_id

  const { data: existingLikes } = await admin
    .from('lounge_post_likes')
    .select('user_id')
    .eq('post_id', post.id)
  const liked = new Set((existingLikes || []).map((r) => r.user_id))

  const { data: existingComments } = await admin
    .from('lounge_comments')
    .select('content,author_id')
    .eq('post_id', post.id)
    .eq('status', 'published')
  const usedTexts = new Set((existingComments || []).map((r) => String(r.content || '').trim()))
  const commentedAuthors = new Set((existingComments || []).map((r) => r.author_id))

  const currentLikes = Number(post.like_count || liked.size || 0)
  const currentComments = Number(post.comment_count || existingComments?.length || 0)
  const likesNeeded = Math.max(0, MIN_LIKES - Math.max(currentLikes, liked.size))
  const commentsNeeded = Math.max(0, MIN_COMMENTS - Math.max(currentComments, existingComments?.length || 0))

  let addedLikes = 0
  let addedComments = 0
  const pool = commentPoolForPost(post)

  if (DRY_RUN) {
    return {
      addedLikes: likesNeeded,
      addedComments: commentsNeeded,
      wouldEnrich: likesNeeded > 0 || commentsNeeded > 0,
    }
  }

  for (let i = 0; i < COMMUNITY_SEED_PERSONAS.length && addedLikes < likesNeeded; i += 1) {
    const p = COMMUNITY_SEED_PERSONAS[Math.abs(seed + i) % COMMUNITY_SEED_PERSONAS.length]
    const mapped = personaMap.get(p.email)
    if (!mapped || mapped.userId === authorId || liked.has(mapped.userId)) continue
    const likeAt = new Date(now.getTime() - (addedLikes + 1) * 3 * 60 * 1000).toISOString()
    const { error: likeErr } = await admin.from('lounge_post_likes').insert({
      post_id: post.id,
      user_id: mapped.userId,
      created_at: likeAt,
    })
    if (!likeErr) {
      addedLikes += 1
      liked.add(mapped.userId)
    }
  }

  let ci = 0
  while (addedComments < commentsNeeded && ci < pool.length * 3) {
    const text = pick(pool, seed + ci + currentComments)
    ci += 1
    if (!text || usedTexts.has(text)) continue
    const cp = COMMUNITY_SEED_PERSONAS[Math.abs(seed + ci + 2) % COMMUNITY_SEED_PERSONAS.length]
    const cm = personaMap.get(cp.email)
    if (!cm || cm.userId === authorId || commentedAuthors.has(cm.userId)) continue
    const commentAt = new Date(now.getTime() - (addedComments + 1) * 4 * 60 * 1000).toISOString()
    const { error: cErr } = await admin.from('lounge_comments').insert({
      post_id: post.id,
      author_id: cm.userId,
      author_name: cm.nickname,
      content: text,
      status: 'published',
      created_at: commentAt,
      updated_at: commentAt,
    })
    if (!cErr) {
      addedComments += 1
      usedTexts.add(text)
      commentedAuthors.add(cm.userId)
    }
  }

  if (addedLikes > 0 || addedComments > 0) {
    const newLikes = currentLikes + addedLikes
    const newComments = currentComments + addedComments
    await admin.from('lounge_posts').update({
      like_count: newLikes,
      comment_count: newComments,
      hot_score: newLikes * 2 + newComments * 3 + 35,
      updated_at: now.toISOString(),
    }).eq('id', post.id)
  }

  return { addedLikes, addedComments, wouldEnrich: addedLikes > 0 || addedComments > 0 }
}

async function main() {
  const now = new Date()
  const since = new Date(now.getTime() - DAYS * 24 * 60 * 60 * 1000)
  const sinceIso = since.toISOString()

  console.log(
    DRY_RUN ? 'Dry run —' : 'Boosting —',
    `last ${DAYS} days, minLikes=${MIN_LIKES}, minComments=${MIN_COMMENTS}, since=${sinceIso}`,
  )

  const personaMap = DRY_RUN ? null : await ensureAllPersonas(admin)
  const posts = await fetchRecentPosts(sinceIso)

  let enriched = 0
  let totalLikes = 0
  let totalComments = 0
  const samples = []

  for (const post of posts) {
    const result = await boostPost(post, personaMap, now)
    const touched = DRY_RUN
      ? result.wouldEnrich
      : result.addedLikes > 0 || result.addedComments > 0
    if (!touched) continue
    enriched += 1
    totalLikes += result.addedLikes
    totalComments += result.addedComments
    if (samples.length < 12) {
      samples.push({
        title: post.title?.slice(0, 72),
        addedLikes: result.addedLikes,
        addedComments: result.addedComments,
      })
    }
    if (!DRY_RUN) {
      console.log(
        `+${result.addedLikes} likes, +${result.addedComments} comments — ${post.title?.slice(0, 64)}`,
      )
    }
  }

  const summary = {
    ok: true,
    dryRun: DRY_RUN,
    days: DAYS,
    minLikes: MIN_LIKES,
    minComments: MIN_COMMENTS,
    postsScanned: posts.length,
    postsEnriched: enriched,
    totalLikesAdded: totalLikes,
    totalCommentsAdded: totalComments,
    sampleTitles: samples,
  }
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
