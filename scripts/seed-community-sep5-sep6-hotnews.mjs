/**
 * Community: Sat Sep 5 afternoon – Sun Sep 6 morning.
 * Prices: Marketstack 2026-09-03 / 2026-09-04 closes (latest EOD in DB).
 *
 *   node scripts/seed-community-sep5-sep6-hotnews.mjs
 *   node scripts/seed-community-sep5-sep6-hotnews.mjs --dry-run
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { COMMUNITY_SEED_PERSONAS } from '../api/_lib/community-seed-personas.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PERSONAS = COMMUNITY_SEED_PERSONAS

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
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim()
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim()

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const POSTS = [
  {
    author: 5,
    postedAt: '2026-09-05T09:22:00+09:00',
    likeSlots: 16,
    title: '土曜朝 — 金曜確定を整理。板はない',
    content:
      '土曜朝チェック。金曜確定（Marketstack 2026-09-04）：日経64214.48円、6857アドバンテ33090円（高33100・安32090）、9984ソフトバンクG5590円（高5611・安5181）。NVDA230.36ドル。週末は板がない。①確定値メモ②月曜寄り30分③サイズ維持。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['週末', 'N225', '6857', '9984'],
    comments: [
      { text: '64214で週末に買い理由を作らない', replies: ['月曜寄り30分', '33090も同じ'] },
      { text: '5590は急騰後。追いかけ禁止' },
      { text: '積立は触らない' },
    ],
  },
  {
    author: 10,
    postedAt: '2026-09-05T11:08:00+09:00',
    likeSlots: 17,
    title: '99845590円金曜大引け — 急騰後は週末に枚数を戻さない',
    content:
      '金曜9984終値5590円（始5197・高5611・安5181）。前日5001円から大きく戻した位置。685733090、285A54460円も半導体側。週末に「戻し」を追わない。月曜ギャップは寄り30分後。',
    ticker: '9984.T',
    sentiment: 'neutral',
    tags: ['9984', '半導体', '6857', '週末'],
    comments: [
      { text: '5590で追わない', replies: ['5611高値も', '月曜まで'] },
      { text: '5181安値で逆張りも禁止' },
      { text: 'セット買いしない' },
    ],
  },
  {
    author: 1,
    postedAt: '2026-09-05T13:36:00+09:00',
    likeSlots: 15,
    title: 'NVDA230.36ドル — 金曜米終値。日本半導体と分けて見る',
    content:
      '金曜米時間。NVDA終値230.36ドル（高234.76・安229.63）。前日228.45から小幅高。日本は685733090・99845590・285A54460。連想で枚数を戻さない。週末は新規ゼロ。',
    ticker: 'NVDA',
    sentiment: 'neutral',
    tags: ['NVDA', '半導体', '285A', '週末'],
    comments: [
      { text: '230.36で追わない', replies: ['234.76高値も禁止', '6857も'] },
      { text: '米と日本をセット買いしない' },
      { text: '月曜寄りまで見るだけ' },
    ],
  },
  {
    author: 8,
    postedAt: '2026-09-05T16:18:00+09:00',
    likeSlots: 14,
    title: '285A54460円 — 金曜高値55200。半導体メモリも幅が広い',
    content:
      '285Aキオクシア金曜54460円引け（始51830・高55200・安51330）。木曜51670からの戻り。週末に55200ブレイクを連想しない。月曜寄り30分ルール。',
    ticker: '285A.T',
    sentiment: 'neutral',
    tags: ['285A', '半導体', '週末', '様子見'],
    comments: [
      { text: '54460でスポットしない', replies: ['55200追わない', '9984も'] },
      { text: '51330で逆張り禁止' },
      { text: 'サイズ維持' },
    ],
  },
  {
    author: 7,
    postedAt: '2026-09-05T18:45:00+09:00',
    likeSlots: 15,
    title: '土曜夕 — 週次メモ：64214・33090・5590・230.36',
    content:
      '土曜夕。週次確定メモ：日経64214.48（木・金）、685733090、99845590、285A54460、1306 TOPIX427.2、NVDA230.36。月曜寄り前にサイズだけ確認。新規は増やさない。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['週末', 'N225', '6857', 'NVDA', '9984'],
    comments: [
      { text: '①サイズ②寄り30分③触らない', replies: ['同感', '積立だけ'] },
      { text: '5590を週末の買い理由にしない' },
      { text: '原油・金利は一次情報で' },
    ],
  },
  {
    author: 2,
    postedAt: '2026-09-05T20:32:00+09:00',
    likeSlots: 14,
    title: '夜の雑談 — 話題タグ：9984急騰・NVDA・6857・週末ルール',
    content:
      '土曜夜。今週の話題：99845590円の急騰、NVDA230.36、685733090、日経64214。どれも「買い」ではなく位置確認。月曜寄り30分まで新規禁止。',
    ticker: '9984.T',
    sentiment: 'neutral',
    tags: ['9984', 'NVDA', '6857', '週末', 'ルール'],
    comments: [
      { text: '①ルール。触らない', replies: ['②は月曜寄り', '③9984も'] },
      { text: '急騰後はサイズ意識' },
      { text: '週末はアプリ閉じる派', replies: ['同感'] },
    ],
  },
  {
    author: 6,
    postedAt: '2026-09-06T07:18:00+09:00',
    likeSlots: 16,
    title: '日曜朝 — 月曜プレビュー。寄り30分・サイズ維持',
    content:
      '日曜朝。金曜確定：日経64214.48円、685733090円、99845590円、285A54460円、NVDA230.36ドル、1306427.2円。月曜は寄り30分待つ。5590/33090でギャップを追わない。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['週末', 'N225', '9984', '6857', 'ルール'],
    comments: [
      { text: '月曜寄りまで新規ゼロ', replies: ['5590追わない', '230.36も'] },
      { text: '積立は淡々と' },
      { text: 'サイズ確認だけ' },
    ],
  },
]

async function findUserIdByEmail(emailNorm) {
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => String(u.email || '').toLowerCase() === emailNorm)
    if (hit) return hit.id
    if (!data.users?.length || data.users.length < 200) return null
    page += 1
  }
}

async function ensurePersona(persona) {
  const email = persona.email.toLowerCase()
  const nickname = String(persona.nickname || '').trim()
  let userId = await findUserIdByEmail(email)
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: `MmSeed!${nickname.length}99`,
      email_confirm: true,
      user_metadata: { nickname, display_name: nickname },
    })
    if (error) throw error
    userId = data.user.id
  }
  await admin.from('user_profiles').upsert({
    user_id: userId,
    nickname,
    full_name: null,
  }, { onConflict: 'user_id' })
  const level = persona.exp >= 6000 ? 5 : persona.exp >= 2500 ? 4 : persona.exp >= 900 ? 3 : persona.exp >= 300 ? 2 : 1
  await admin.from('lounge_character_stats').upsert({
    user_id: userId,
    total_exp: persona.exp,
    level,
    character_stage: level,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  return { userId, nickname }
}

function normalizeCommentTree(comments) {
  return (comments || []).map((c) => {
    if (typeof c === 'string') return { text: c, replies: [] }
    return {
      text: String(c.text || ''),
      author: c.author,
      replies: (c.replies || []).map((r) => (typeof r === 'string' ? { text: r } : r)),
    }
  })
}

function countAllComments(tree) {
  let n = 0
  for (const c of tree) {
    n += 1
    n += (c.replies || []).length
  }
  return n
}

async function main() {
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Sep 5–6 posts…`)

  const personaMap = new Map()
  for (const persona of PERSONAS) {
    personaMap.set(persona.email, await ensurePersona(persona))
  }

  let posts = 0
  let comments = 0
  let replies = 0

  for (const row of POSTS) {
    const persona = PERSONAS[row.author]
    const mapped = personaMap.get(persona.email)
    if (!mapped) continue

    const tree = normalizeCommentTree(row.comments)
    const totalComments = countAllComments(tree)
    const likeSlots = Math.min(PERSONAS.length - 1, Math.max(4, Number(row.likeSlots || 8)))

    const payload = {
      author_id: mapped.userId,
      author_name: mapped.nickname,
      title: row.title,
      content: String(row.content || ''),
      ticker: row.ticker || null,
      asset_type: 'stock',
      sentiment: row.sentiment || 'neutral',
      like_count: likeSlots,
      comment_count: totalComments,
      bookmark_count: Math.floor(likeSlots / 3),
      view_count: 0,
      hot_score: likeSlots * 2 + totalComments * 3 + 55,
      status: 'published',
      created_at: new Date(row.postedAt).toISOString(),
      updated_at: new Date(row.postedAt).toISOString(),
    }

    if (DRY_RUN) {
      console.log(`[dry-run] ${row.postedAt.slice(0, 16)} ${mapped.nickname}: ${row.title}`)
      posts += 1
      comments += totalComments
      continue
    }

    const { data: post, error } = await admin.from('lounge_posts').insert(payload).select('id').single()
    if (error) {
      console.error('insert failed:', row.title, error.message)
      continue
    }

    for (const tag of row.tags || []) {
      await admin.from('lounge_post_tags').insert({ post_id: post.id, tag })
    }

    for (let li = 0; li < likeSlots; li += 1) {
      const liker = PERSONAS[(row.author + li + 1) % PERSONAS.length]
      const likerMapped = personaMap.get(liker.email)
      if (!likerMapped || likerMapped.userId === mapped.userId) continue
      const likeAt = new Date(new Date(row.postedAt).getTime() + (li + 1) * 5 * 60 * 1000).toISOString()
      const { error: lErr } = await admin.from('lounge_post_likes').insert({
        post_id: post.id,
        user_id: likerMapped.userId,
        created_at: likeAt,
      })
      if (lErr) console.error('like insert failed:', lErr.message)
    }

    let commentRows = 0
    let replyRows = 0
    let cursor = 0

    for (let c = 0; c < tree.length; c += 1) {
      const node = tree[c]
      let commentPersona = PERSONAS[
        Number.isFinite(node.author) ? node.author : (row.author + c + 2) % PERSONAS.length
      ]
      let commentMapped = personaMap.get(commentPersona.email)
      if (commentMapped?.userId === mapped.userId) {
        commentPersona = PERSONAS[(row.author + c + 3) % PERSONAS.length]
        commentMapped = personaMap.get(commentPersona.email)
      }
      if (!commentMapped?.userId) continue

      cursor += 1
      const commentAt = new Date(new Date(row.postedAt).getTime() + cursor * 7 * 60 * 1000).toISOString()
      const { data: parentComment, error: cErr } = await admin.from('lounge_comments').insert({
        post_id: post.id,
        author_id: commentMapped.userId,
        author_name: commentMapped.nickname,
        content: node.text,
        status: 'published',
        created_at: commentAt,
        updated_at: commentAt,
      }).select('id').single()

      if (cErr || !parentComment) {
        console.error('comment insert failed:', cErr?.message)
        continue
      }
      commentRows += 1

      for (let r = 0; r < (node.replies || []).length; r += 1) {
        const reply = node.replies[r]
        let replyPersona = PERSONAS[
          Number.isFinite(reply.author)
            ? reply.author
            : (row.author + c + r + 4) % PERSONAS.length
        ]
        let replyMapped = personaMap.get(replyPersona.email)
        if (
          !replyMapped
          || replyMapped.userId === mapped.userId
          || replyMapped.userId === commentMapped.userId
        ) {
          replyPersona = PERSONAS[(row.author + c + r + 5) % PERSONAS.length]
          replyMapped = personaMap.get(replyPersona.email)
        }
        if (!replyMapped?.userId) continue

        cursor += 1
        const replyAt = new Date(new Date(row.postedAt).getTime() + cursor * 7 * 60 * 1000).toISOString()
        const replyText = `@${commentMapped.nickname} ${reply.text}`
        const nestedPayload = {
          post_id: post.id,
          author_id: replyMapped.userId,
          author_name: replyMapped.nickname,
          content: replyText,
          parent_comment_id: parentComment.id,
          status: 'published',
          created_at: replyAt,
          updated_at: replyAt,
        }
        let { error: rErr } = await admin.from('lounge_comments').insert(nestedPayload)
        if (rErr && /parent_comment_id/i.test(String(rErr.message || ''))) {
          delete nestedPayload.parent_comment_id
          nestedPayload.content = `↳ @${commentMapped.nickname} ${reply.text}`
          ;({ error: rErr } = await admin.from('lounge_comments').insert(nestedPayload))
        }
        if (rErr) console.error('reply insert failed:', rErr.message)
        else {
          commentRows += 1
          replyRows += 1
        }
      }
    }

    const { count: likeRows } = await admin
      .from('lounge_post_likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post.id)

    await admin.from('lounge_posts').update({
      like_count: likeRows ?? likeSlots,
      comment_count: commentRows,
      hot_score: (likeRows ?? likeSlots) * 2 + commentRows * 3 + 55,
    }).eq('id', post.id)

    comments += commentRows
    replies += replyRows
    posts += 1
    console.log(
      `posted: ${row.postedAt.slice(5, 16)} ${mapped.nickname} — ${row.title.slice(0, 42)}… (c=${commentRows}, replies=${replyRows})`,
    )
  }

  console.log(`Done. ${posts} posts, ${comments} comments (${replies} replies).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
