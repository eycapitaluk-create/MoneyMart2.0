/**
 * Community: Thu Sep 3 session – Sat Sep 5 morning.
 * Prices: Marketstack 2026-09-02 close only (no newer EOD in DB yet).
 *
 *   node scripts/seed-community-sep3-sep5-hotnews.mjs
 *   node scripts/seed-community-sep3-sep5-hotnews.mjs --dry-run
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

/** Last confirmed Marketstack EOD in DB: 2026-09-02 */
const POSTS = [
  {
    author: 5,
    postedAt: '2026-09-03T09:18:00+09:00',
    likeSlots: 16,
    title: '木曜寄り — 直近確定は水曜。寄り30分は触らない',
    content:
      '木曜寄り。直近確定（Marketstack 2026-09-02）：日経66215.34円、6857アドバンテ32540円、9984ソフトバンクG4924円、285A51000円、NVDA224.41ドル。本日の板が出るまで①寄り30分待つ②32540/4924で追いかけない。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['寄り', 'N225', '6857', '9984'],
    comments: [
      { text: '66215で寄り買い禁止', replies: ['32540も同じ', 'NVDAも'] },
      { text: '原油・金利テーマは続いてもサイズ維持' },
      { text: '1306 TOPIX424.5は指数。個別と混ぜない' },
    ],
  },
  {
    author: 10,
    postedAt: '2026-09-03T10:42:00+09:00',
    likeSlots: 15,
    title: '前場 — 6857/9984は水曜位置をメモ。連想買い禁止',
    content:
      '前場メモ。水曜確定：685732540円（高32790・安31840）、99844924円（高5056・安4911）。NVDA224.41ドルと方向がズレた日だった。半導体セットで枚数を戻さない。寄り後も上限ゼロ。',
    ticker: '6857.T',
    sentiment: 'neutral',
    tags: ['前場', '6857', '9984', '半導体'],
    comments: [
      { text: '31840安値で逆張り禁止', replies: ['32790で追わない', '285Aも'] },
      { text: '4924を「安い」と決めない' },
      { text: 'ルール優先' },
    ],
  },
  {
    author: 1,
    postedAt: '2026-09-03T12:08:00+09:00',
    likeSlots: 14,
    title: 'ランチ — NVDA224.41ドルは参考。日本個別は分けて見る',
    content:
      '昼休み。直近米終値NVDA224.41ドル（高227.95・安218.48）。日本685732540・99844924は別判断。ランチにスポットしない。後場まで見るだけ。',
    ticker: 'NVDA',
    sentiment: 'neutral',
    tags: ['ランチ', 'NVDA', '半導体', '様子見'],
    comments: [
      { text: '224.41で枚数を戻さない', replies: ['昼の板で結論を出さない'] },
      { text: '積立は触らない' },
      { text: '285A51000も同じ' },
    ],
  },
  {
    author: 8,
    postedAt: '2026-09-03T14:22:00+09:00',
    likeSlots: 15,
    title: '後場 — 原油・金利警戒が残る日は安値拾いしない',
    content:
      '後場。水曜は原油・金利警戒で日経65576安値まで試した。今日もテーマが残るなら安値拾い禁止。6857・9984・1306はサイズ維持。大引けまで新規ゼロ。',
    ticker: 'N225',
    sentiment: 'bearish',
    tags: ['後場', '原油', '金利', 'N225'],
    comments: [
      { text: '安値拾い禁止', replies: ['大引けまで見送り', '6857も'] },
      { text: '65576を「底」と決めない' },
      { text: 'ルールが一番' },
    ],
  },
  {
    author: 7,
    postedAt: '2026-09-03T16:35:00+09:00',
    likeSlots: 16,
    title: '夕 — 285A51000円。銘柄ごとに分ける週末前チェック',
    content:
      '夕方。直近確定：285A51000円、685732540、99844924、NVDA224.41。同じ半導体でも銘柄で方向が違う。51000で追わない。金曜寄り30分ルールを先に決める。',
    ticker: '285A.T',
    sentiment: 'neutral',
    tags: ['285A', '半導体', '6857', 'NVDA'],
    comments: [
      { text: '51000で追わない', replies: ['32540も', '4924も'] },
      { text: 'セット買い禁止' },
      { text: '積立は継続' },
    ],
  },
  {
    author: 2,
    postedAt: '2026-09-03T19:48:00+09:00',
    likeSlots: 14,
    title: '夜の雑談 — 話題：原油・金利・NVDA・6857・9984',
    content:
      '木曜夜。話題タグ整理：原油・金利、N22566215、685732540、99844924、NVDA224.41、285A51000。金曜は寄り30分待つ。番号で一番気になる銘柄を。',
    ticker: 'NVDA',
    sentiment: 'neutral',
    tags: ['原油', '金利', 'NVDA', '6857', '9984'],
    comments: [
      { text: '①ルール。触らない', replies: ['②は金曜寄り', '③6857も'] },
      { text: '66215は指数' },
      { text: '週末前に増やさない派', replies: ['同感'] },
    ],
  },
  {
    author: 6,
    postedAt: '2026-09-04T09:12:00+09:00',
    likeSlots: 17,
    title: '金曜寄り — 週の最終セッション。寄り30分・サイズ維持',
    content:
      '金曜寄り。直近確定（2026-09-02）：日経66215.34円、685732540円、99844924円、NVDA224.41ドル。週末持ち越しはサイズ意識。①寄り30分待つ②新規を厚くしない③積立は淡々と。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['寄り', 'N225', '週末', 'ルール'],
    comments: [
      { text: '週末前に枚数を戻さない', replies: ['寄り30分', '6857も'] },
      { text: '66215で買い理由を作らない' },
      { text: '積立勢は今日も淡々と' },
    ],
  },
  {
    author: 11,
    postedAt: '2026-09-04T11:28:00+09:00',
    likeSlots: 15,
    title: '前場 — 1306 TOPIX424.5円。指数と半導体を分ける',
    content:
      '前場。直近1306 TOPIX ETF424.5円、日経66215.34円。6857・9984・285Aは個別。指数ETFと半導体セット買いを同時にしない。週末前はサイズ確認だけ。',
    ticker: '1306.T',
    sentiment: 'neutral',
    tags: ['TOPIX', 'N225', '半導体', '週末'],
    comments: [
      { text: '424.5でスポットしない', replies: ['6857セット禁止'] },
      { text: '指数と個別を混ぜない' },
      { text: '週末前チェックリスト' },
    ],
  },
  {
    author: 0,
    postedAt: '2026-09-04T14:05:00+09:00',
    likeSlots: 16,
    title: '後場 — NVDA224.41ドル。連想で日本半導体を埋めない',
    content:
      '後場。米直近NVDA224.41ドル。日本685732540・99844924は別。連想買い禁止。週末持ち越しは無理に増やさない。大引けまで新規ゼロでもいい。',
    ticker: 'NVDA',
    sentiment: 'neutral',
    tags: ['後場', 'NVDA', '6857', '週末'],
    comments: [
      { text: '224.41で追わない', replies: ['32540も禁止', '週末はサイズ'] },
      { text: '連想買いしない' },
      { text: 'ルール維持' },
    ],
  },
  {
    author: 4,
    postedAt: '2026-09-04T17:40:00+09:00',
    likeSlots: 18,
    title: '金曜夕 — 週次メモ：66215・32540・4924・224.41',
    content:
      '金曜夕チェック。直近確定値メモ：日経66215.34、685732540、99844924、285A51000、1306424.5、NVDA224.41。週末は板がない。月曜寄り30分まで新規禁止。原油・金利は一次情報で。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['大引け', 'N225', '6857', 'NVDA', '週末'],
    comments: [
      { text: '週末に買い理由を作らない', replies: ['月曜寄り30分', 'サイズ維持'] },
      { text: '32540を「底」と決めない' },
      { text: '積立は継続派', replies: ['同感'] },
    ],
  },
  {
    author: 9,
    postedAt: '2026-09-04T20:15:00+09:00',
    likeSlots: 14,
    title: '金曜夜 — 週末持ち越しはサイズだけ確認',
    content:
      '金曜夜。話題：原油・金利、半導体（6857/9984/285A/NVDA）、日経66215。持ち越し枚数だけ確認してアプリを閉じる。月曜までスポットしない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['週末', '原油', '金利', '半導体'],
    comments: [
      { text: 'サイズ確認して閉じる', replies: ['月曜まで触らない'] },
      { text: '新規ゼロ派' },
      { text: '224.41は参考値' },
    ],
  },
  {
    author: 3,
    postedAt: '2026-09-05T06:18:00+09:00',
    likeSlots: 15,
    title: '土曜朝 — 週次確定値の整理だけ。板はない',
    content:
      '土曜朝。直近確定（2026-09-02 Marketstack）：日経66215.34円、685732540円、99844924円、285A51000円、NVDA224.41ドル、1306424.5円。週末は板がない。①メモ②月曜寄り30分③サイズ維持。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['週末', 'N225', 'NVDA', '6857'],
    comments: [
      { text: '週末に買い理由を作らない', replies: ['月曜まで待つ', '9984も'] },
      { text: '積立設定は触らない' },
      { text: '原油・金利は一次情報で' },
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Sep 3–5 posts…`)

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
