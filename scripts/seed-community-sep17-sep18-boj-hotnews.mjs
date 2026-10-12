/**
 * Community topics: Thu Sep 17 midday – Fri Sep 18 morning.
 * News: FOMC 25bp already done; BOJ MPM 9/17–18, hike to 1.25% widely expected (報道).
 * Result announcement is Fri — morning posts: 観測 / 声明待ち only (do not invent BOJ decision).
 * DB/dashboard 2026-09-17: N225 63923, S&P 7637.76, VIX 15.44, NVDA 219.34, AAPL 337,
 * 6857 30240, 9984 6247, 285A 49880, US10Y 4.95, USDJPY 155.95, WTI 101.21.
 *
 *   node scripts/seed-community-sep17-sep18-boj-hotnews.mjs
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
    postedAt: '2026-09-17T08:25:00+09:00',
    likeSlots: 15,
    title: '木曜朝：FOMC後。数字を9/16確定から更新待ち',
    content:
      '木曜朝。米はFOMCで25bp利上げ済み（声明）。今日〜あすは日銀会合。位置はまだ前営業のメモが多いので、引け後に確定を差し替える。寄り30分・サイズ維持。金利イベント連続でも全額禁止。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['FOMC', '日銀', '話題', 'ルール', '寄り付き'],
    comments: [
      { text: '日銀声明まで待機', replies: ['30分', '積立だけ'] },
      { text: '織り込み済みでも飛びつき禁止' },
      { text: '一次情報は日銀・通信社' },
    ],
  },
  {
    author: 7,
    postedAt: '2026-09-17T11:40:00+09:00',
    likeSlots: 14,
    title: '話題：日銀は1.25%観測。結果はあす',
    content:
      '木曜昼。報道では日銀が政策金利を1.25%へ0.25%引き上げる公算、との解説が多い。米FOMCに続く中銀ウィーク。円と株をセットで動かない。確定価格は引け後に更新。今はウォッチのみ。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['日銀', '金利', '話題', '為替', 'ルール'],
    comments: [
      { text: 'セット売買禁止', replies: ['同感', '声明待ち'] },
      { text: '1.25%織り込みで追わない' },
      { text: '会見までサイズ維持' },
    ],
  },
  {
    author: 1,
    postedAt: '2026-09-17T15:18:00+09:00',
    likeSlots: 16,
    title: '木曜後場：確定更新。日経63923・VIX15.44',
    content:
      '木曜後場〜引け。Marketstack/dashboard確定（2026-09-17）：日経63923（+0.69%）、S&P7637.76、VIX15.44、NVDA219.34、AAPL337、685730240、99846247、285A49880。ドル円155.95・US10Y4.95・WTI101.21。FOMC後にボラが沈静化した位置。日銀結果はあす——今夜は枚数増やさない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['日経', 'VIX', 'FOMC', '話題', '更新'],
    comments: [
      { text: '63923にメモ更新', replies: ['15.44も', 'サイズ維持'] },
      { text: '219.34追っかけ禁止' },
      { text: 'あす声明まで待機' },
    ],
  },
  {
    author: 10,
    postedAt: '2026-09-17T18:05:00+09:00',
    likeSlots: 15,
    title: '半導体：30240。日銀前の逆張り禁止',
    content:
      '木曜夕。確定（2026-09-17）：685730240、99846247、285A49880。前日比でまちまち。金利イベント前に「押し目」で枚数を揃えない。NVDA219.34も別枠。損切り線だけ確認。',
    ticker: '6857.T',
    sentiment: 'neutral',
    tags: ['半導体', '6857', '日銀', '話題', 'ルール'],
    comments: [
      { text: '30240でナンピン禁止', replies: ['6247も', '49880も'] },
      { text: '金利連想でセット禁止' },
      { text: 'あす朝に再判定' },
    ],
  },
  {
    author: 4,
    postedAt: '2026-09-17T20:22:00+09:00',
    likeSlots: 14,
    title: '夜メモ：米10年4.95・原油101。日銀待ち',
    content:
      '木曜夜。dashboard US10Y4.95・WTI101.21・ドル円155.95。米利上げ後も原油は100ドル前後。あすの日銀声明・会見が円と銀行・成長株の振れどころ。予想トレード禁止。睡眠優先。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['US10Y', '原油', '日銀', '話題', '様子見'],
    comments: [
      { text: '4.95で金利トレード禁止', replies: ['101も', '積立のみ'] },
      { text: '円と株をセットにしない' },
      { text: '一次情報は声明' },
    ],
  },
  {
    author: 8,
    postedAt: '2026-09-17T21:50:00+09:00',
    likeSlots: 15,
    title: '木曜夜：S&P7637・NASDAQ戻し。日本は別枠',
    content:
      '木曜夜。米確定S&P7637.76・NASDAQ26418.3・NVDA219.34。VIXは15.44まで低下。日本の685730240とは別枠で見る。連想で枚数を揃えない。あすは日銀イベント日。',
    ticker: 'NVDA',
    sentiment: 'neutral',
    tags: ['NVDA', 'S&P', '日銀', '話題', 'ルール'],
    comments: [
      { text: '米と日を分けて見る', replies: ['同感', '連想禁止'] },
      { text: '15.44でもレバ禁止' },
      { text: '声明まで注文しない' },
    ],
  },
  {
    author: 5,
    postedAt: '2026-09-18T05:20:00+09:00',
    likeSlots: 16,
    title: '金曜早朝：日銀結果日。寄りで追わない',
    content:
      '金曜早朝。日銀会合2日目・結果発表待ち（報道では1.25%利上げが意識）。位置の基準は木曜確定：日経63923、ドル円155.95、S&P7637.76、VIX15.44、685730240。織り込み通りでもsell the newsがありうる。寄り30分・分割のみ。一次情報は日銀声明・総裁会見。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['日銀', '寄り付き', '話題', '金利', 'ルール'],
    comments: [
      { text: 'sell the news警戒', replies: ['30分', 'サイズ小'] },
      { text: '予想でポジ禁止' },
      { text: '声明・会見の2点確認' },
    ],
  },
  {
    author: 0,
    postedAt: '2026-09-18T07:15:00+09:00',
    likeSlots: 15,
    title: '金曜朝チェック：話題は日銀、執行は後回し',
    content:
      '金曜朝チェック。①日銀結果は一次情報で確認したか（まだなら待つ）②木曜確定（日経63923／S&P7637.76／NVDA219.34／US10Y4.95／ドル円155.95）からサイズを増やしていないか③円高・銀行・成長株のセット売買をしていないか。話題と執行を分ける。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['チェックリスト', '日銀', 'ルール', '話題', '金利'],
    comments: [
      { text: 'チェック同意', replies: ['執行しない', '積立のみ'] },
      { text: '連想売買禁止' },
      { text: '会見までサイズ維持' },
    ],
  },
  {
    author: 9,
    postedAt: '2026-09-18T08:05:00+09:00',
    likeSlots: 14,
    title: '為替155.95。声明前に方向決めしない',
    content:
      '金曜寄り前後。dashboardドル円155.95。日銀利上げ観測で円が振れやすいが、声明・会見前に円ロング／株ショートを決め打ちしない。日経63923は位置確認だけ。新規は分割・小サイズ。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['為替', '日銀', '話題', 'ルール', '様子見'],
    comments: [
      { text: '155.95で方向禁止', replies: ['同感', '待機'] },
      { text: 'セット売買禁止' },
      { text: '一次情報待ち' },
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Sep17–18 BOJ topic posts…`)

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
