/**
 * Community: Wed Sep 2 session + Thu Sep 3 morning — hot topics + real closes.
 *   node scripts/seed-community-sep2-sep3-hotnews.mjs
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
    author: 3,
    postedAt: '2026-09-02T09:14:00+09:00',
    likeSlots: 17,
    title: '水曜寄り — 日経65885スタート。原油・金利警戒で様子見',
    content:
      '水曜寄り（Marketstack）。日経平均始値65885.47円。6857アドバンテ32380円、9984ソフトバンクG5026円。原油高・金利上昇への警戒が話題。①寄り30分は触らない。65576安値圏まで下げても追わない。',
    ticker: 'N225',
    sentiment: 'bearish',
    tags: ['N225', '原油', '金利', '6857'],
    comments: [
      { text: '65885で寄り買い禁止', replies: ['65576安値も追わない', '9984も同じ'] },
      { text: 'イベント前は上限ゼロ' },
      { text: '1306 TOPIX429.6は指数。個別半導体と混ぜない' },
    ],
  },
  {
    author: 10,
    postedAt: '2026-09-02T10:28:00+09:00',
    likeSlots: 16,
    title: '前場 — 6857が32790円高値も、9984は5056まで戻した後軟調',
    content:
      '前場。6857は高値32790円、安値31840円圏まで試す。9984は高5056・安4911。285Aキオクシア50000円始値。値幅は広いが、原油・金利テーマでは新規を厚くしない。',
    ticker: '6857.T',
    sentiment: 'neutral',
    tags: ['6857', '9984', '285A', '半導体'],
    comments: [
      { text: '32790で枚数を戻さない', replies: ['31840で逆張りも禁止', 'NVDAは別'] },
      { text: '5056高値を「戻し」と決めない' },
      { text: '寄り30分ルール維持' },
    ],
  },
  {
    author: 1,
    postedAt: '2026-09-02T11:42:00+09:00',
    likeSlots: 15,
    title: '前引け — 日経66525円高値圏。前引けにサイズを足さない',
    content:
      '前引け。日経は高値66525.70円まで戻したが、安値65576.61円も付いた幅の広い日。685732540方向、99844924円。前引けに半導体セット買い禁止。昼休みも注文しない。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['前引け', 'N225', '6857', '9984'],
    comments: [
      { text: '66525で追いかけ禁止', replies: ['昼は見るだけ', '285Aも'] },
      { text: '65576安値で「底」と決めない' },
      { text: '積立は触らない' },
    ],
  },
  {
    author: 6,
    postedAt: '2026-09-02T12:18:00+09:00',
    likeSlots: 14,
    title: 'ランチ — 四本値はまだ後場。原油・金利ニュースだけ見る',
    content:
      '昼休み。終値はまだ後場。朝の66525円高値だけ見て「戻した」としない。6857・9984の確定前にスポットしない。NVDA前日217.44ドルは参考。ランチに触らない。',
    ticker: 'NVDA',
    sentiment: 'neutral',
    tags: ['ランチ', '原油', 'NVDA', '様子見'],
    comments: [
      { text: '昼の板で結論を出さない', replies: ['後場まで見るだけ'] },
      { text: '217.44を買い理由にしない' },
      { text: '積立勢は今日も淡々と' },
    ],
  },
  {
    author: 8,
    postedAt: '2026-09-02T14:12:00+09:00',
    likeSlots: 16,
    title: '後場 — 大幅安の日はルール優先。安値拾いしない',
    content:
      '後場入り。原油高・金利警戒で日経は幅広く下落。6857は31840円安値圏、9984も4911円安値圏を試した動き。安値で逆張り禁止。大引けまで新規ゼロ。サイズは維持。',
    ticker: '6857.T',
    sentiment: 'bearish',
    tags: ['後場', '6857', '9984', '大幅安'],
    comments: [
      { text: '安値拾い禁止', replies: ['大引けまで見送り', '1306も'] },
      { text: '半導体セット買いしない' },
      { text: 'ルールが一番大事' },
    ],
  },
  {
    author: 7,
    postedAt: '2026-09-02T15:26:00+09:00',
    likeSlots: 15,
    title: '後場 — NVDA224.41ドル（米時間）。日本半導体と方向がズレる日',
    content:
      '米時間参考。NVDAは224.41ドルまで戻す動き（前日217.44）。一方685732540、99844924円は軟調。日本と米で半導体の方向がズレる日は、連想買い禁止。224.41で追わない。',
    ticker: 'NVDA',
    sentiment: 'neutral',
    tags: ['NVDA', '半導体', '6857', '9984'],
    comments: [
      { text: '224.41で枚数を戻さない', replies: ['32540で6857も禁止', '285Aも'] },
      { text: '米株と日経をセットで買わない' },
      { text: '確定後も寄り30分待つ' },
    ],
  },
  {
    author: 2,
    postedAt: '2026-09-02T17:54:00+09:00',
    likeSlots: 18,
    title: '大引け — 日経66215円、6857終値32540円、9984終値4924円',
    content:
      '大引け確定（Marketstack）。日経平均66215.34円（始65885・高66525・安65576）。6857終値32540円（始32380・高32790・安31840）。9984終値4924円（始5026・高5056・安4911）。1306 TOPIX ETF424.5円。NVDA224.41ドル。①確定後も追いかけない。',
    ticker: 'N225',
    sentiment: 'bearish',
    tags: ['大引け', 'N225', '6857', '9984'],
    comments: [
      { text: '66215で週末買い理由を作らない', replies: ['32540で6857も禁止', '4924で9984も'] },
      { text: '66525高値を「戻し」と決めない' },
      { text: '424.5 TOPIXは指数だけ見る' },
    ],
  },
  {
    author: 0,
    postedAt: '2026-09-02T19:18:00+09:00',
    likeSlots: 14,
    title: '夕 — 285A51000円で引け。半導体は銘柄ごとに分ける',
    content:
      '夕方。285Aキオクシア51000円引け（高51640・安49830）。685732540、99844924、NVDA224.41。同じ半導体でも銘柄で方向が違う日。51000で285Aを追わない。セット買い禁止。',
    ticker: '285A.T',
    sentiment: 'neutral',
    tags: ['285A', '半導体', 'NVDA', '6857'],
    comments: [
      { text: '51000で追わない', replies: ['32540の6857も', '4924の9984も'] },
      { text: '銘柄ごとに判断しない' },
      { text: '積立は継続派' },
    ],
  },
  {
    author: 11,
    postedAt: '2026-09-02T20:36:00+09:00',
    likeSlots: 15,
    title: '夜の雑談 — 話題タグ：原油・金利・NVDA・6857・9984',
    content:
      '今夜の話題整理：原油・金利、N22566215、685732540、99844924、NVDA224.41、285A51000。どれも「買い」ではなく「位置の確認」。木曜寄り30分ルールを先に決める。',
    ticker: 'NVDA',
    sentiment: 'neutral',
    tags: ['原油', '金利', 'NVDA', '6857', '9984', 'N225'],
    comments: [
      { text: '①ルール。それ以外触らない', replies: ['②は木曜寄り', '③6857も'] },
      { text: '66215日経は指数' },
      { text: '週末前に新規増やさない派', replies: ['同感'] },
      { text: '224.41 NVDAは参考値' },
    ],
  },
  {
    author: 4,
    postedAt: '2026-09-03T07:24:00+09:00',
    likeSlots: 16,
    title: '木曜朝 — 水曜確定値メモ。寄り30分待つ',
    content:
      '木曜朝チェック。水曜確定：日経66215.34円、685732540円、99844924円、285A51000円、1306 TOPIX424.5円、NVDA224.41ドル。原油・金利テーマは続く可能性。寄り30分は触らない。サイズ維持。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['N225', '6857', 'NVDA', '原油'],
    comments: [
      { text: '66215で買い理由を作らない', replies: ['寄り30分待つ', '9984も'] },
      { text: '32540を「安い」と決めない' },
      { text: '積立は触らない' },
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Sep 2–3 posts…`)

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
