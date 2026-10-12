/**
 * Community topics: Mon Sep 14 EOD – Wed Sep 16 morning (FOMC week).
 * News: Sep FOMC 25bp hike odds high after Aug core CPI +0.3%; possible Dec follow-up.
 * DB closes (Marketstack / dashboard 2026-09-14): N225 64011.34, S&P 7619.98, NVDA 210.96,
 * 6857 31080, 9984 5839, 285A 50590, US10Y 4.96, VIX 17.1, USDJPY 154.36, WTI 101.99.
 * Do not invent the FOMC decision before the statement — cite as 観測 / 声明待ち only.
 *
 *   node scripts/seed-community-sep14-sep16-fomc-hotnews.mjs
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
    postedAt: '2026-09-14T15:12:00+09:00',
    likeSlots: 15,
    title: '月曜後場：話題は9月FOMC利上げ。寄り付き追いは禁止',
    content:
      '月曜後場。話題①9/15–16 FOMCで25bp利上げがほぼ確実視（報道・短資市場）。背景は8月コアCPI前月比+0.3%（予想0.2%超）。dashboard確定：US10Y4.96、VIX17.1、USD/JPY154.36、WTI101.99。個別確定（Marketstack 2026-09-14）：S&P7619.98・NVDA210.96・日経64011.34・685731080。金利イベント前に枚数を増やさない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['FOMC', '金利', 'CPI', '話題', 'ルール'],
    comments: [
      { text: '利上げ織り込みで追わない', replies: ['サイズ維持', '声明待ち'] },
      { text: '210.96も触らない' },
      { text: '一次情報はFOMC声明' },
    ],
  },
  {
    author: 7,
    postedAt: '2026-09-14T18:40:00+09:00',
    likeSlots: 16,
    title: '月曜夜：半導体は確定押し。金利連想で逆張り禁止',
    content:
      '月曜夜。確定（Marketstack 2026-09-14）：685731080、99845839、285A50590。金曜比で押し。FOMC前の「押し目買い」は禁止。S&P7619.98・NVDA210.96も別枠でサイズ維持。金利テーマで銀行ロング・テックショートを週末に決めない。',
    ticker: '6857.T',
    sentiment: 'bearish',
    tags: ['半導体', '6857', '9984', 'FOMC', '話題'],
    comments: [
      { text: '31080で落ちるナイフ禁止', replies: ['5839も', '50590も'] },
      { text: '金利連想で枚数揃え禁止' },
      { text: '損切り線だけ確認' },
    ],
  },
  {
    author: 1,
    postedAt: '2026-09-14T21:05:00+09:00',
    likeSlots: 14,
    title: '月曜夜メモ：US10Y4.96と原油101。金利の重し',
    content:
      '月曜夜。dashboard：米10年4.96・WTI101.99・VIX17.1・ドル円154.36。報道では原油高がインフレ再加速懸念を残し、9月利上げ後も12月追加が意識される、との解説。スポット売買禁止。明日はFOMC本番。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['US10Y', '原油', 'FOMC', '話題', '様子見'],
    comments: [
      { text: '4.96で金利トレード禁止', replies: ['101.99も', '積立だけ'] },
      { text: '12月追加は声明後に判断' },
      { text: '一次情報は通信社' },
    ],
  },
  {
    author: 9,
    postedAt: '2026-09-15T06:22:00+09:00',
    likeSlots: 15,
    title: '火曜朝：FOMC当日。寄り30分は見送り',
    content:
      '火曜朝。今夜〜あす未明がFOMC。前日確定位置だけ確認：日経64011.34、S&P7619.98、NVDA210.96、ドル円154.36、VIX17.1。利上げ「ほぼ確実」でもドット・声明の文言で振れる。寄り付き30分は注文しない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['FOMC', '寄り付き', 'ルール', '話題', '金利'],
    comments: [
      { text: '30分ルール厳守', replies: ['同感', 'ウォッチのみ'] },
      { text: '織り込み済みでも飛びつき禁止' },
      { text: '声明本文を一次情報に' },
    ],
  },
  {
    author: 4,
    postedAt: '2026-09-15T11:48:00+09:00',
    likeSlots: 16,
    title: '火曜昼：話題は25bp利上げ。結果発表までサイズ維持',
    content:
      '火曜昼。市場・報道の主トピックはFOMC25bp利上げ。政策金利は3.75–4.00%帯への引き上げが意識されている、との解説が多い。前日確定：685731080・99845839・285A50590。イベント前に「保険的利上げだから買い」と決めない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['FOMC', '利上げ', '話題', '半導体', 'ルール'],
    comments: [
      { text: '保険的でも全額禁止', replies: ['ドット次第', 'サイズ'] },
      { text: '31080でナンピン禁止' },
      { text: '一次情報は声明・ドット' },
    ],
  },
  {
    author: 6,
    postedAt: '2026-09-15T16:05:00+09:00',
    likeSlots: 14,
    title: '火曜後場：為替154.36。金利と円をセット買いしない',
    content:
      '火曜後場。FOMC待ち。dashboardドル円154.36・米10年4.96。利上げで円高・銀行・成長株、とセットで動かない。日経64011.34は位置確認だけ。今夜の声明まで新規禁止。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['為替', 'FOMC', '金利', '話題', 'ルール'],
    comments: [
      { text: 'セット売買禁止', replies: ['同感', '積立のみ'] },
      { text: '154.36で方向決めない' },
      { text: '声明まで待機' },
    ],
  },
  {
    author: 2,
    postedAt: '2026-09-15T19:30:00+09:00',
    likeSlots: 17,
    title: '火曜夜：FOMC直前。VIX17.1でもレバ禁止',
    content:
      '火曜夜。FOMC発表前。前日確定VIX17.1・S&P7619.98・NVDA210.96。ボラが「低め」でもイベント前レバ・信用は禁止。結果が出るまで現金比率を優先。一次情報はFRB声明・記者会見。',
    ticker: 'NVDA',
    sentiment: 'neutral',
    tags: ['FOMC', 'VIX', 'NVDA', '話題', 'リスク管理'],
    comments: [
      { text: '17.1でもレバ禁止', replies: ['210.96触らない', '待機'] },
      { text: '会見まで注文しない' },
      { text: 'SNS速報で飛びつき禁止' },
    ],
  },
  {
    author: 10,
    postedAt: '2026-09-15T21:55:00+09:00',
    likeSlots: 15,
    title: '火曜深夜前：金利イベントは「結果待ち」だけ',
    content:
      '火曜夜。あと数時間でFOMC結果。確認済み数字だけメモ：US10Y4.96、WTI101.99、日経64011.34、685731080。利上げ有無・ドット・声明の3点を見てから判断。予想でポジを作らない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['FOMC', '金利', '話題', 'ルール', '様子見'],
    comments: [
      { text: '3点確認ルール', replies: ['声明', 'ドット', '会見'] },
      { text: '予想トレード禁止' },
      { text: '睡眠優先・朝に再判定' },
    ],
  },
  {
    author: 5,
    postedAt: '2026-09-16T06:15:00+09:00',
    likeSlots: 16,
    title: '水曜朝：FOMC結果週。寄りで追わない',
    content:
      '水曜朝。米金利イベントの週明け（結果は通信社・FRB一次情報で確認）。位置の基準は月曜確定：S&P7619.98、NVDA210.96、日経64011.34、ドル円154.36、VIX17.1。結果が織り込み通りでもsell the newsがありうる。寄り30分・分割のみ。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['FOMC', '寄り付き', '話題', '金利', 'ルール'],
    comments: [
      { text: 'sell the news警戒', replies: ['30分', 'サイズ小'] },
      { text: '一次情報以外信じない' },
      { text: '210.96追っかけ禁止' },
    ],
  },
  {
    author: 8,
    postedAt: '2026-09-16T09:42:00+09:00',
    likeSlots: 15,
    title: '水曜午前：利上げ後の論点は「その次」',
    content:
      '水曜午前。話題は9月利上げの先——報道では12月追加やドットの分布が焦点、との解説が多い。確定価格は月曜まで：685731080・99845839・285A50590・US10Y4.96。追加利上げ織り込みで成長株を売り浴びせない。声明・会見の文言を読んでから。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['FOMC', 'ドット', '金利', '半導体', '話題'],
    comments: [
      { text: '次を織り込んで売らない', replies: ['ドット確認', 'サイズ'] },
      { text: '31080でナンピン禁止' },
      { text: '一次情報は声明' },
    ],
  },
  {
    author: 0,
    postedAt: '2026-09-16T12:08:00+09:00',
    likeSlots: 14,
    title: '水曜昼チェックリスト：金利イベント後のルール',
    content:
      '水曜昼。①FRB声明・ドット・会見を一次情報で読んだか②月曜確定（S&P7619.98／日経64011.34／NVDA210.96）からサイズを増やしていないか③原油101.99・ドル円154.36で連想売買していないか。金利テーマは「話題」と「執行」を分ける。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['FOMC', 'ルール', 'チェックリスト', '話題', '金利'],
    comments: [
      { text: 'チェックリスト同意', replies: ['執行しない', '積立のみ'] },
      { text: '連想売買禁止' },
      { text: '明日もサイズ維持' },
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Sep14–16 FOMC topic posts…`)

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
