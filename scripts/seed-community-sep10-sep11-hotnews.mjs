/**
 * Community: Thu Sep 10 session – Fri Sep 11 morning.
 * Prices: Marketstack 2026-09-09 JP+US+N225; 2026-09-10 dashboard N225/1306 only (no Sep10 individual equity EOD yet).
 *
 *   node scripts/seed-community-sep10-sep11-hotnews.mjs
 *   node scripts/seed-community-sep10-sep11-hotnews.mjs --dry-run
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

/** Confirmed EOD only — no fabricated Sep 10/11 equity closes. */
const POSTS = [
  {
    author: 5,
    postedAt: '2026-09-10T10:24:00+09:00',
    likeSlots: 15,
    title: '木曜前場 — 直近確定は水曜。板は見るだけ',
    content:
      '木曜前場。直近確定（Marketstack 2026-09-09）：日経65269.33円（高66791.84・安65269.33）、99846810円、685732840円、285A57000円、NVDA223.67ドル。本日の個別終値は大引けまで書かない。寄り後も上限ゼロ。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['前場', 'N225', '9984', '6857'],
    comments: [
      { text: '6810で追わない', replies: ['32840も', '大引けまで'] },
      { text: '223.67と日本をセットにしない' },
      { text: 'サイズ維持' },
    ],
  },
  {
    author: 10,
    postedAt: '2026-09-10T12:48:00+09:00',
    likeSlots: 14,
    title: '昼 — 半導体は水曜位置メモ。セット買い禁止',
    content:
      '昼。水曜確定：99846810・685732840・285A57000。銘柄差が大きい日だった。今日の板で枚数を揃えない。分割のみ。',
    ticker: '9984.T',
    sentiment: 'neutral',
    tags: ['昼', '9984', '半導体', 'ルール'],
    comments: [
      { text: 'セット買いは禁止', replies: ['同感', '損切り線だけ'] },
      { text: '未確定の数字は書かない' },
      { text: '積立は淡々と' },
    ],
  },
  {
    author: 1,
    postedAt: '2026-09-10T15:32:00+09:00',
    likeSlots: 17,
    title: '木曜大引け — 日経64665.34円。続落メモ',
    content:
      '木曜大引け確定（dashboard 2026-09-10）：日経64665.34円、1306 TOPIX連動419.3円。個別株の木曜終値はDB未取込のため書かない。水曜位置（99846810・685732840・NVDA223.67）は参考のみ。飛び乗り禁止。',
    ticker: 'N225',
    sentiment: 'bearish',
    tags: ['大引け', 'N225', '様子見', 'ルール'],
    comments: [
      { text: '64665で逆張り禁止', replies: ['落ちるナイフ', 'サイズ'] },
      { text: '個別終値が出るまで枚数触らない' },
      { text: '金曜寄り30分' },
    ],
  },
  {
    author: 8,
    postedAt: '2026-09-10T18:16:00+09:00',
    likeSlots: 15,
    title: '木曜夕 — 指数は64665。個別は水曜メモのまま',
    content:
      '木曜夕。確定済みは日経64665.34・1306419.3。個別は水曜：99846810・685732840・285A57000・72032971。指数だけ見て個別を増やさない。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['夕方', 'N225', '9984', 'ルール'],
    comments: [
      { text: '指数と個別を混ぜない', replies: ['同感', '6810も'] },
      { text: 'レバ触らない' },
      { text: '損切り線だけ確認' },
    ],
  },
  {
    author: 2,
    postedAt: '2026-09-10T20:40:00+09:00',
    likeSlots: 14,
    title: '夜 — NVDA223.67と日経64665。連想買い禁止',
    content:
      '木曜夜。米水曜確定NVDA223.67ドル（高226.18・安223.46）、AAPL315.34、S&P7636.36。日本は日経64665.34。連想で枚数を戻さない。金曜寄りまで新規慎重。',
    ticker: 'NVDA',
    sentiment: 'neutral',
    tags: ['夜', 'NVDA', 'N225', 'ルール'],
    comments: [
      { text: '223.67で追わない', replies: ['64665も', '積立だけ'] },
      { text: '話題タグ＝ウォッチ' },
      { text: '全額禁止' },
    ],
  },
  {
    author: 6,
    postedAt: '2026-09-10T22:12:00+09:00',
    likeSlots: 14,
    title: '木曜深夜前 — 週中メモ：65269→64665。サイズ確認',
    content:
      '木曜22時。水曜日経65269.33→木曜64665.34。個別は水曜確定のまま。サイズと偏りだけ確認して寝る。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['夜', 'N225', 'ルール', '様子見'],
    comments: [
      { text: '①触らない②金曜寄り30分', replies: ['同感'] },
      { text: '未取込の個別は書かない' },
      { text: '寝る' },
    ],
  },
  {
    author: 5,
    postedAt: '2026-09-11T05:48:00+09:00',
    likeSlots: 15,
    title: '金曜早朝 — 直近確定は木曜64665。寄り前は触らない',
    content:
      '金曜早朝。直近確定：日経64665.34円（2026-09-10）、個別は水曜（99846810・685732840・NVDA223.67）。寄り前に枚数を戻さない。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['朝', 'N225', '様子見', 'ルール'],
    comments: [
      { text: '寄り前は新規ゼロ', replies: ['サイズ確認だけ'] },
      { text: '64665で逆張りしない' },
      { text: 'レバ禁止' },
    ],
  },
  {
    author: 9,
    postedAt: '2026-09-11T07:22:00+09:00',
    likeSlots: 15,
    title: '金曜朝 — 半導体は水曜位置。セット買い禁止',
    content:
      '金曜朝。水曜確定：99846810・685732840・285A57000。木曜は指数64665のみ確定。セットで枚数を揃えない。寄り30分ルール。',
    ticker: '6857.T',
    sentiment: 'neutral',
    tags: ['朝', '6857', '9984', '半導体', 'ルール'],
    comments: [
      { text: 'セット買いは禁止', replies: ['分割のみ', '損切り線'] },
      { text: '未確定の金曜は書かない' },
      { text: '積立継続' },
    ],
  },
  {
    author: 7,
    postedAt: '2026-09-11T08:36:00+09:00',
    likeSlots: 16,
    title: '金曜寄り前 — 64665を買い理由にしない。寄り30分',
    content:
      '寄り前。直近確定（2026-09-10）：日経64665.34円、1306419.3円。個別は水曜メモ。①寄り30分②逆張り禁止③サイズ上限。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['寄り', 'N225', 'ルール', '様子見'],
    comments: [
      { text: '64665ギャップ追わない', replies: ['30分待つ', '全額禁止'] },
      { text: '偏り確認だけ' },
      { text: '大引けまで数字更新しない' },
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Sep 10–11 posts…`)

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
