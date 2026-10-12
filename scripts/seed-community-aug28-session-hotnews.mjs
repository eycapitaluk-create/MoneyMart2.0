/**
 * Community: Fri Aug 28 Tokyo session (09:12–close) + evening — Jackson Hole day.
 * JP prints: Marketstack (2026-08-28). Fills hourly gaps after aug28 morning seeds.
 *
 *   node scripts/seed-community-aug28-session-hotnews.mjs
 *   node scripts/seed-community-aug28-session-hotnews.mjs --dry-run
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

/**
 * comments: string = top-level
 *   or { text, author?, replies?: [{ text, author? }] }
 */
const POSTS = [
  {
    author: 5,
    postedAt: '2026-08-28T09:14:00+09:00',
    likeSlots: 17,
    title: '金曜寄り — 6857始値34590円、ジャクソンホール当日',
    content:
      '金曜寄り（Marketstack）。6857アドバンテ始値34590円、9984ソフトバンクG5249円。昨日6857終値34610から小幅。本日パウエル演説。①寄り30分は触らない。34590で追いかけ禁止。NVDA前日227.98を連想で枚数を戻さない。',
    ticker: '6857.T',
    sentiment: 'neutral',
    tags: ['寄り', '6857', '9984', 'ジャクソンホール'],
    comments: [
      { text: '34590でイベント前に厚くしない', replies: ['寄り30分ルール', '9984も同じ'] },
      { text: '34610終値を「底」と決めない' },
      { text: '1306 TOPIX ETFは430始値。指数より個別半導体を見ない' },
    ],
  },
  {
    author: 10,
    postedAt: '2026-08-28T10:28:00+09:00',
    likeSlots: 16,
    title: '前場 — 6857が35600円高値、34230円安値まで往復',
    content:
      '前場。6857は高値35600円まで戻したが、安値34230円も付けた幅の広い日。9984は高5263・安5136。イベント日の値動きは材料として見るだけ。35600で決算後の戻しを追わない。',
    ticker: '6857.T',
    sentiment: 'neutral',
    tags: ['前場', '6857', '9984', 'ジャクソンホール'],
    comments: [
      { text: '35600で枚数を戻さない', replies: ['34230で逆張りも禁止', '285Aも同じ'] },
      { text: '高値と安値の両方見て、どちらも追わない' },
      { text: '7203トヨタ3090始値は内需。セット買いしない' },
    ],
  },
  {
    author: 1,
    postedAt: '2026-08-28T11:36:00+09:00',
    likeSlots: 15,
    title: '前引け — パウエル演説前。前引けにサイズを足さない',
    content:
      '前引け。6857は35600円高値圏から34230円安値まで試した後、引き上げ。本日最大イベントはパウエル演説。前引けに6857・9984を足さない。昼休みも注文しない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['前引け', 'ジャクソンホール', '6857', 'ルール'],
    comments: [
      { text: 'イベント前は上限ゼロ', replies: ['昼は見るだけ', '現金維持'] },
      { text: '34230安値で「押し目」と決めない' },
      { text: '積立設定は触らない' },
    ],
  },
  {
    author: 6,
    postedAt: '2026-08-28T12:22:00+09:00',
    likeSlots: 14,
    title: 'ランチ — 四本値はまだ後場。触らない',
    content:
      '昼休み。終値はまだ後場。朝の35600円高値だけ見て「戻した」としない。6857・9984の確定前にスポットしない。1306 TOPIX ETFは434高値圏。コアETFも日本株も、ランチに触らない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['ランチ', '様子見', 'ジャクソンホール'],
    comments: [
      { text: '昼の板で結論を出さない', replies: ['後場まで見るだけ'] },
      { text: '434 TOPIX高値を連想で1306を買わない' },
      { text: '積立勢は今日も淡々と' },
    ],
  },
  {
    author: 8,
    postedAt: '2026-08-28T13:56:00+09:00',
    likeSlots: 16,
    title: '後場 — 6857が34230円安値を再試す。大引けまで新規禁止',
    content:
      '後場。6857は34230円安値圏を再試した後、35270円終値方向へ。9984も5136円安値圏。パウエル演説前のポジション整理が中心。安値拾いはしない。大引けまで新規禁止。',
    ticker: '6857.T',
    sentiment: 'neutral',
    tags: ['後場', '6857', '9984', 'ジャクソンホール'],
    comments: [
      { text: '34230で逆張り禁止', replies: ['演説前は上限ゼロ', '大引けまで見送り'] },
      { text: '35600高値を「ブレイク」と決めない' },
      { text: 'SBG5136安値でセット買い禁止' },
    ],
  },
  {
    author: 7,
    postedAt: '2026-08-28T15:22:00+09:00',
    likeSlots: 18,
    title: '大引け — 6857終値35270円、前日34610から660円戻し',
    content:
      '大引け確定（Marketstack）。6857終値35270円（始34590・高35600・安34230）。9984終値5161円（始5249・高5263・安5136）。7203トヨタ3116円。1306 TOPIX ETF432円（高434）。前日685734610から660円戻し。本日パウエル演説。①確定後も追いかけない。',
    ticker: 'TOPIC',
    sentiment: 'bullish',
    tags: ['大引け', '6857', '9984', 'TOPIX'],
    comments: [
      { text: '660円戻しを「反転」と決めない', replies: ['イベント前の戻りはノイズ', 'コアは別'] },
      { text: '35270でスポットしない' },
      { text: '演説結果まで6857は見送り', replies: ['同じ'] },
    ],
  },
  {
    author: 2,
    postedAt: '2026-08-28T16:34:00+09:00',
    likeSlots: 15,
    title: '寄与度 — 6857・9984が指数を上下。イベント前はセット禁止',
    content:
      '大引け寄与度。685735270、99845161が半導体の中心。7203トヨタ3116は内需寄与。1306 TOPIX432。米前日NVDA227.98・S&P7730.99は参考値。半導体セットで指数を買い戻さない。',
    ticker: '6857.T',
    sentiment: 'neutral',
    tags: ['寄与度', '6857', '9984', 'NVDA'],
    comments: [
      { text: '35270を翌週の買いにしない', replies: ['演説後に動く', '285Aも禁止'] },
      { text: 'トヨタ3116が上位でもヘッジにしない' },
      { text: '227.98は参考。憶測しない' },
    ],
  },
  {
    author: 0,
    postedAt: '2026-08-28T17:48:00+09:00',
    likeSlots: 14,
    title: '夕 — パウエル演説は今夜。コア据え置き、個別は見送り',
    content:
      '夕方。本日685735270、99845161で引け。米前日NVDA227.98、QQQ721.11、S&P7730.99。今夜パウエル演説。結果は出ていないので予想しない。積立は淡々と。個別は演説後も急がない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['夕', 'ジャクソンホール', 'NVDA', '積立'],
    comments: [
      { text: '演説前に6857を足さない', replies: ['それが上限', '1306も今夜スポットしない'] },
      { text: '35270を「安い」と決めない' },
      { text: '夜は米時間までアプリを閉じてもいい' },
    ],
  },
  {
    author: 11,
    postedAt: '2026-08-28T20:12:00+09:00',
    likeSlots: 16,
    title: '米時間 — パウエル演説前。S&P7730.99で様子見',
    content:
      '金曜夜（米時間）。ジャクソンホール・パウエル演説前。S&P500前日7730.99、NVDA227.98、QQQ721.11。日本6857を35270で埋めない。演説が出るまで上限ゼロ。結果後も寄り30分は触らない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['米時間', 'ジャクソンホール', 'S&P500', 'NVDA'],
    comments: [
      { text: '演説前に227.98で逆張り禁止', replies: ['結果後も30分待つ', 'サイズ維持'] },
      { text: '7730は小動き。ノイズ' },
      { text: '月曜寄りまで見送り' },
    ],
  },
  {
    author: 4,
    postedAt: '2026-08-28T21:40:00+09:00',
    likeSlots: 13,
    title: '夜の雑談 — 週末前チェック：演説後もルール維持',
    content:
      '金曜夜チェック：①パウエル演説の要約②米株の反応③6857/9984のギャップ④1306 TOPIX432の位置⑤無理に増やさない。週末持ち越しはサイズ意識。番号で「一番見るもの」を。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['チェックリスト', 'ジャクソンホール', '半導体', '雑談'],
    comments: [
      { text: '①演説。それ以外触らない', replies: ['②はそのあと', '③は月曜'] },
      { text: '⑤が一番大事' },
      { text: '週末前に新規増やさない派', replies: ['同感'] },
      { text: '35270を週末の買い理由にしない' },
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Aug 28 session + evening posts…`)

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
      console.log(`[dry-run] ${row.postedAt.slice(0, 16)} ${mapped.nickname}: ${row.title} (c=${totalComments})`)
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

    // DB may not have parent_comment_id yet — flatten replies as X-style threaded lines.
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
