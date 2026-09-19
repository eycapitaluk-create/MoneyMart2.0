/**
 * Community topics: Wed Sep 16 afternoon–evening (FOMC decision still pending in US hours).
 * News: 25bp hike to 3.75–4.00% widely expected; decision ~14:00 ET (= ~03:00 JST Sep 17).
 * Do NOT invent the decision before the statement — 観測 / 声明待ち only.
 * DB Marketstack 2026-09-15: N225 63484.10, S&P 7585.73, VIX 17.2, NVDA 212.17,
 * AAPL 331.34, 6857 30160, 9984 6279, 285A 51750, 7203 3021, ^TNX 4.996.
 * Dashboard 2026-09-16: 日経63396, US10Y 5.00, USD/JPY 155.33, WTI 104.36, Gold 4378.5.
 *
 *   node scripts/seed-community-sep16-fomc-eve-hotnews.mjs
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
    author: 2,
    postedAt: '2026-09-16T13:18:00+09:00',
    likeSlots: 15,
    title: '水曜後場：昨日確定を更新。日経は63484',
    content:
      '水曜後場。朝メモの64011は古い。Marketstack確定（2026-09-15）：日経63484.10・S&P7585.73・NVDA212.17・685730160・99846279・285A51750。dashboard今日：日経63396・ドル円155.33・WTI104.36。数字を差し替えてからウォッチ。FOMCは米時間14時発表予定（日本は未明）なので、今は枚数増やさない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['日経', 'FOMC', '話題', '更新', 'ルール'],
    comments: [
      { text: '64011は破棄', replies: ['63484に更新', '同感'] },
      { text: '30160もメモ' },
      { text: '声明までサイズ維持' },
    ],
  },
  {
    author: 7,
    postedAt: '2026-09-16T15:05:00+09:00',
    likeSlots: 16,
    title: '話題：米10年は5%。金利の重しが続く',
    content:
      '水曜後場。dashboard US10Y5.00（+0.71%）、Marketstack ^TNX4.996（9/15）。報道ではFOMC25bp利上げ（3.75–4.00%帯）がほぼ織り込み。原油WTI104.36も重し。金利テーマで銀行ロング・テックショートを「今夜決めて」は禁止。確定個別：AAPL331.34・MSFT497.12。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['US10Y', '金利', 'FOMC', '話題', '原油'],
    comments: [
      { text: '5%で金利トレード禁止', replies: ['104も触らない', '積立だけ'] },
      { text: '織り込み済みでも飛びつき禁止' },
      { text: '一次情報は声明' },
    ],
  },
  {
    author: 10,
    postedAt: '2026-09-16T16:42:00+09:00',
    likeSlots: 15,
    title: '半導体：6857は30160。FOMC前の逆張り禁止',
    content:
      '水曜夕。確定（Marketstack 2026-09-15）：685730160、99846279、285A51750。前日比で押し。金利イベント前に「押し目」で枚数を戻さない。NVDA212.17も別枠。損切り線だけ確認。',
    ticker: '6857.T',
    sentiment: 'bearish',
    tags: ['半導体', '6857', '9984', 'FOMC', '話題'],
    comments: [
      { text: '30160で落ちるナイフ禁止', replies: ['6279も', '51750も'] },
      { text: '金利連想でセット売買禁止' },
      { text: '声明後に再判定' },
    ],
  },
  {
    author: 4,
    postedAt: '2026-09-16T18:20:00+09:00',
    likeSlots: 14,
    title: '為替155.33。金利と円をセットで動かない',
    content:
      '水曜夜寄り。dashboardドル円155.33（+0.61%）。FOMC結果で振れやすいが、今は方向決め禁止。日経確定63484.10・S&P7585.73は位置確認だけ。円高＝銀行買い／成長株売り、のセットは今夜やらない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['為替', 'FOMC', '金利', '話題', 'ルール'],
    comments: [
      { text: 'セット売買禁止', replies: ['同感', '待機'] },
      { text: '155.33でナンピン禁止' },
      { text: '未明の声明まで見るだけ' },
    ],
  },
  {
    author: 1,
    postedAt: '2026-09-16T19:35:00+09:00',
    likeSlots: 16,
    title: '今夜〜未明：FOMCは結果待ち。レバ禁止',
    content:
      '水曜夜。米FOMC発表は現地14時＝日本時間あす未明3時前後が目安（報道）。織り込みは25bp利上げだが、ドット・声明の文言で振れる。前日確定VIX17.2・S&P7585.73・NVDA212.17。イベント前レバ・信用は禁止。一次情報はFRB声明・会見。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['FOMC', 'VIX', '話題', 'リスク管理', 'ルール'],
    comments: [
      { text: '17.2でもレバ禁止', replies: ['212.17触らない', '睡眠優先'] },
      { text: 'SNS速報で飛びつき禁止' },
      { text: '声明・ドット・会見の3点' },
    ],
  },
  {
    author: 8,
    postedAt: '2026-09-16T20:48:00+09:00',
    likeSlots: 15,
    title: '原油104と金4378。エネルギー連想で全額禁止',
    content:
      '水曜夜。dashboard WTI104.36（+2.93%）・Gold4378.5・Brent107.58。インフレ再加速懸念の解説が多いが、スポットでエネルギーを買わない。金利イベントと同日に枚数を増やさない。位置確認だけ。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['原油', '金', 'FOMC', '話題', '様子見'],
    comments: [
      { text: '104でスポット禁止', replies: ['4378も追わない', 'サイズ'] },
      { text: '地政学ニュースで全額禁止' },
      { text: '一次情報は通信社' },
    ],
  },
  {
    author: 5,
    postedAt: '2026-09-16T21:22:00+09:00',
    likeSlots: 14,
    title: '夜チェックリスト：声明まで執行しない',
    content:
      '水曜夜チェック。①数字更新済みか（日経63484.10／S&P7585.73／685730160／ドル円155.33／US10Y5.00）②FOMCは未明の一次情報待ち③予想でポジを作っていないか。話題と執行を分ける。明日朝に再判定。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['FOMC', 'チェックリスト', 'ルール', '話題', '金利'],
    comments: [
      { text: 'チェック同意', replies: ['執行しない', '積立のみ'] },
      { text: '未明は睡眠優先' },
      { text: '朝にサイズ確認' },
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Sep16 FOMC-eve topic posts…`)

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
