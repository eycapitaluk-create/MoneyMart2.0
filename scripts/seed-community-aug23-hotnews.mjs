/**
 * Community: Sat Aug 22 afternoon–evening + Sun Aug 23 (weekend, no 寄り).
 * Prices are Marketstack EOD 2026-08-20 / 2026-08-21 only. No invented prints.
 *
 *   node scripts/seed-community-aug23-hotnews.mjs
 *   node scripts/seed-community-aug23-hotnews.mjs --dry-run
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
    author: 6,
    postedAt: '2026-08-22T12:42:00+09:00',
    likeSlots: 16,
    title: '土曜昼 — 金曜コアETF、VTI 378.24 / VEA 73.42',
    content:
      '休場の昼。金曜EODだけ確認。VTIは376.58→378.24、VEAは72.84→73.42、VWOは60.02→60.45、VTは159.93→160.77。VOOは701.01→703.71、QQQは710.93→713.44。株式コアは小幅プラス。日本は金曜日経66016.36（前日66216.79）。今日はウォッチリスト整理だけ。サイズはいじらない。',
    ticker: 'VTI',
    sentiment: 'neutral',
    tags: ['土曜', 'VTI', 'VEA', 'コアETF'],
    comments: [
      {
        text: 'VTIとVOOを同じ週に両方いじる必要はない',
        replies: ['コアはVTI一本で足りる', 'QQQはサテライト扱い'],
      },
      { text: 'VEAがVTIより戻してるのは先進国の相対。一括しない' },
      {
        text: '日経は200円安なのに米株ETFはプラス。ねじれは月曜まで放置',
        replies: ['ギャップ予想で夜チャート見ない'],
      },
      { text: '積立設定は触らない。数字はメモだけ' },
    ],
  },
  {
    author: 3,
    postedAt: '2026-08-22T15:18:00+09:00',
    likeSlots: 15,
    title: '債券側 — BND 72.23、LQD 105.92、IEF 92.82',
    content:
      '金曜債券EOD。BND 72.2721→72.23、LQD 106.06→105.92、IEF 92.9665→92.82。株式コアが戻した日に債券は小幅マイナス。金利の結論は一日では出ない。高配当目線でもLQDを金曜の-0.14でスポットしない。コアはBND、残存を寄せたいならIEF。今日は注文なし。',
    ticker: 'BND',
    sentiment: 'neutral',
    tags: ['債券', 'BND', 'LQD', 'IEF'],
    comments: [
      {
        text: '株式戻し＋債券小安はよくある。リバランスしない',
        replies: ['比率が崩れてからでいい', 'IEFをLQDの代わりにしない'],
      },
      { text: 'BNDの前日差は数セント。ノイズ' },
      { text: '社債LQDを金利イベント前に厚くしない' },
      {
        text: '自分はBNDのみ。IEFは触らない',
        replies: ['それが一番わかりやすい'],
      },
    ],
  },
  {
    author: 1,
    postedAt: '2026-08-22T18:51:00+09:00',
    likeSlots: 13,
    title: '土曜夜 — チャート閉じて月曜のルールだけ残す',
    content:
      '夜。休場なのに米国ETFを何周も見ない。金曜のメモ：VTI 378.24、VEA 73.42、VNQ 98.50、BND 72.23。S&P500は7641.16→7674.37。AAPL 311.30→309.35、NVDA 216.85→214.72。コアETFと個別は別。来週の新規は寄り30分禁止。積立だけ淡々と。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['土曜', '休場', 'ルール', 'NISA'],
    comments: [
      {
        text: 'NVDAとAAPLの陰線でVTIを売らない',
        replies: ['コアと個別を混ぜると負ける', '同じ'],
      },
      { text: 'S&P戻しても日経は安。月曜に結論を急がない' },
      { text: '夜はアプリ閉じる。それがルール' },
    ],
  },
  {
    author: 4,
    postedAt: '2026-08-23T09:14:00+09:00',
    likeSlots: 15,
    title: '日曜朝 — コアは金曜終値のまま。積立は弄らない',
    content:
      '日曜。東京も米国も休場。金曜のコア：VTI 378.24、VT 160.77、VOO 703.71。新興国VWO 60.45。債券BND 72.23。数字はもう変わらない。朝から「月曜ギャップ」を取りにいく計画を立てない。NISAの積立額も今日はいじらない。',
    ticker: 'TOPIC',
    sentiment: 'bullish',
    tags: ['日曜', '積立', 'VTI', 'VT'],
    comments: [
      {
        text: '正しい。休場日の朝に設定変更するのが一番危ない',
        replies: ['スポット追加もしない', '全世界を止めない'],
      },
      { text: 'VTIとVTを同じ朝に両方買う必要はない' },
      {
        text: 'VWOは一日+0.43。テーマ買いしない',
        replies: ['新興国はコアの一部として淡々と'],
      },
      { text: '家族優先。チャートは夕方でいい' },
    ],
  },
  {
    author: 7,
    postedAt: '2026-08-23T13:36:00+09:00',
    likeSlots: 14,
    title: 'VNQ — 金曜98.50、前日98.60。REITは横ばい',
    content:
      'VNQ金曜終値98.50（前日98.60）。ほぼ横ばい。VTIが378.24まで戻した日にREITはついていかない。金利感応の結論を一日で出さない。不動産をコア株式の代わりに厚くしない。休場の午後にVNQだけスポットしない。',
    ticker: 'VNQ',
    sentiment: 'neutral',
    tags: ['VNQ', 'REIT', '日曜', '分散'],
    comments: [
      {
        text: '10セント差を材料にしない',
        replies: ['REITは週次で見る', 'VTIの代わりにしない'],
      },
      { text: '分配金目線でも金曜の終値で追わない' },
      { text: 'コアは株式＋債券。VNQはサテライト' },
      {
        text: '月曜にギャップしてもサイズは維持',
        replies: ['それが正解'],
      },
    ],
  },
  {
    author: 6,
    postedAt: '2026-08-23T16:48:00+09:00',
    likeSlots: 16,
    title: '全世界の分解 — VT 160.77 / VEA 73.42 / VWO 60.45',
    content:
      '日曜夕方。金曜EODの分解。VT 159.93→160.77。中身の代理：米国VTI 378.24、先進国ex-USのVEA 73.42、新興国VWO 60.45。金曜は三つともプラス。VT一本で足りる人と、VTI+VEA+VWOに分ける人。休場日にどちらへ乗り換える判断はしない。自分はVT据え置き。',
    ticker: 'VT',
    sentiment: 'neutral',
    tags: ['VT', 'VEA', 'VWO', '全世界'],
    comments: [
      {
        text: 'VTがあるのにVTIとVEAを同時に増やすと重複',
        replies: ['同じ。どちらかに寄せる', '乗り換えは平日の冷静な時'],
      },
      { text: 'VWOだけ金曜強すいで厚くしない' },
      {
        text: '自分はVTI+VEA。VTは持たない',
        replies: ['それも一本化されていればOK'],
      },
      { text: '数字はメモしてアプリ閉じる' },
    ],
  },
  {
    author: 11,
    postedAt: '2026-08-23T19:52:00+09:00',
    likeSlots: 17,
    title: '日曜夜 — 月曜は寄り30分触らない。コアは据え置き',
    content:
      '20時前。来週のルールだけ残す。①寄り30分新規禁止②VTI/VEA/VNQ/BND/LQD/IEFを金曜終値でスポットしない③NVDA・AAPLの陰線でコアを売らない④積立は淡々と。金曜のメモ：日経66016.36、S&P7674.37、VTI 378.24、VEA 73.42、VNQ 98.50、LQD 105.92、IEF 92.82。予想は書かない。休む。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['日曜', 'ルール', 'リスク管理', 'コアETF'],
    comments: [
      {
        text: '①＋④。それ以外は全部見送り',
        replies: ['コアETFのスポットもしない', '同じ'],
      },
      { text: '債券3本を月曜に並べて買わない' },
      {
        text: '日経とS&Pのねじれは寄りで解消しない前提',
        replies: ['ギャップを取りにいかない'],
      },
      { text: '夜更かし禁止。それが一番のエッジ' },
      { text: '番号で残す。予想はいらない' },
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Aug 22 afternoon + Aug 23 weekend posts…`)

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

    const { data: existing } = await admin
      .from('lounge_posts')
      .select('id')
      .eq('author_id', mapped.userId)
      .eq('title', row.title)
      .eq('created_at', payload.created_at)
      .maybeSingle()
    if (existing?.id) {
      console.log(`skip duplicate: ${row.title}`)
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
