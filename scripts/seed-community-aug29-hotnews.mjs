/**
 * Community: Sat Aug 29 morning (JST) — Jackson Hole weekend wrap + hot tags refresh.
 * JP/US prints: Marketstack (2026-08-28 close). Boosts sidebar 話題のタグ / 話題の銘柄.
 *
 *   node scripts/seed-community-aug29-hotnews.mjs
 *   node scripts/seed-community-aug29-hotnews.mjs --dry-run
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
    postedAt: '2026-08-29T07:18:00+09:00',
    likeSlots: 18,
    title: '土曜朝 — ジャクソンホール翌日。金曜確定値だけ整理',
    content:
      '土曜朝チェック。金曜確定（Marketstack）：日経66131.98円（始66775・高66954・安65782）。6857アドバンテ35270円、9984ソフトバンクG5161円。米NVDA217.55ドル（始227.33・安216.82）。週末は板がない。①確定値をメモ②月曜寄り30分は触らない③ジャクソンホール要約は一次情報で。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['ジャクソンホール', 'N225', 'NVDA', '6857'],
    comments: [
      { text: '66132で週末に買い理由を作らない', replies: ['月曜寄り30分待つ', '285Aも同じ'] },
      { text: '217.55は確定。憶測で枚数を戻さない' },
      { text: '99845161はイベント前の位置。セット禁止' },
    ],
  },
  {
    author: 10,
    postedAt: '2026-08-29T07:52:00+09:00',
    likeSlots: 17,
    title: 'NVDA217.55ドル — 金曜-4%超。半導体は週明けまで様子見',
    content:
      '金曜米時間。NVDA終値217.55ドル（高229.26・安216.82）。前日227.98から約-4.6%。285Aキオクシア47900円（高52190・安47800）も値幅大。685735270、99845161とセットで見るが、週末に半導体を厚くしない。決算後の戻りを追わない。',
    ticker: 'NVDA',
    sentiment: 'bearish',
    tags: ['NVDA', '半導体', '285A', '6857'],
    comments: [
      { text: '217.55で逆張り禁止', replies: ['216.82安値も追わない', 'ALABも同じ'] },
      { text: '47900を「底」と決めない' },
      { text: '35270で6857を埋めない' },
    ],
  },
  {
    author: 1,
    postedAt: '2026-08-29T08:24:00+09:00',
    likeSlots: 16,
    title: '285A47900円大引け — 半導体メモリはイベント日に幅が出やすい',
    content:
      '285Aキオクシア金曜47900円引け（始51780）。685735270、99845161と同じ半導体バスケット。NVDA217.55も参考。ジャクソンホール週末は新規ゼロ。月曜ギャップは寄り30分後に判断。47800安値でスポットしない。',
    ticker: '285A.T',
    sentiment: 'neutral',
    tags: ['285A', '半導体', 'NVDA', 'ジャクソンホール'],
    comments: [
      { text: '51780始値を「高値圏」と決めない', replies: ['47900で追わない', '6857セット禁止'] },
      { text: 'イベント週はサイズ維持' },
      { text: '1306 TOPIX429.4も月曜まで触らない' },
    ],
  },
  {
    author: 6,
    postedAt: '2026-08-29T08:56:00+09:00',
    likeSlots: 15,
    title: 'N22566132円 — 金曜は65782安値まで試した週',
    content:
      '日経平均66131.98円で金曜引け。週内は66954高値→65782安値まで幅。1306 TOPIX ETF429.4円。半導体寄与（6857・9984・285A）と指数を分けて見る。ジャクソンホール要約が出ても、月曜寄り前に枚数を増やさない。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['N225', '6857', '9984', 'ジャクソンホール'],
    comments: [
      { text: '65782安値で週末に逆張りしない', replies: ['66132で買わない', 'TOPIXも同じ'] },
      { text: '66954高値を「ブレイク」と決めない' },
      { text: 'NVDA217.55は米側の参考値' },
    ],
  },
  {
    author: 8,
    postedAt: '2026-08-29T09:30:00+09:00',
    likeSlots: 16,
    title: '6857/9984 — 月曜ギャップ想定メモ（実行はしない）',
    content:
      '週末メモのみ。6857終35270円、9984終5161円。NVDA217.55、285A47900円。月曜寄りでギャップが出ても①寄り30分待つ②35270/5161を「安い」と決めない③半導体セット買い禁止。ジャクソンホール要約は見るが、結果で枚数を変えない。',
    ticker: '6857.T',
    sentiment: 'neutral',
    tags: ['6857', '9984', 'NVDA', '半導体'],
    comments: [
      { text: '35270を月曜の買い理由にしない', replies: ['5161も同じ', '285Aも禁止'] },
      { text: 'ギャップダウンでも追わない' },
      { text: '積立は触らない派', replies: ['同感'] },
    ],
  },
  {
    author: 7,
    postedAt: '2026-08-29T10:05:00+09:00',
    likeSlots: 14,
    title: 'ALAB289.47ドル — AI半導体はNVDAとセットで見る',
    content:
      'ALAB金曜289.47ドル（高300.97・安287.01）。NVDA217.55と同じAI半導体テーマ。6857・285Aの日本側と方向が揃う日もあるが、週末は連想買い禁止。ジャクソンホール後もルール維持：上限ゼロ、寄り30分待ち。',
    ticker: 'ALAB',
    sentiment: 'neutral',
    tags: ['ALAB', 'NVDA', '半導体', 'ジャクソンホール'],
    comments: [
      { text: '289.47で週末に枚数を戻さない', replies: ['287.01安値も追わない', '6857も'] },
      { text: 'NVDA決算後の値動きを追わない' },
      { text: '月曜までアプリを閉じてもいい' },
    ],
  },
  {
    author: 2,
    postedAt: '2026-08-29T10:38:00+09:00',
    likeSlots: 15,
    title: '決算後のNVDA — 217.55を「割安」と決めない週末',
    content:
      'NVDA決算後の金曜217.55ドル。ガイダンスや説明会の要約は週末に読むが、217.55を買い値にしない。685735270、285A47900、99845161も同様。半導体はイベント週。月曜寄り30分ルールを先に決める。',
    ticker: 'NVDA',
    sentiment: 'neutral',
    tags: ['NVDA', '決算', '半導体', '6857'],
    comments: [
      { text: '決算後の-4%を追わない', replies: ['285Aも', 'ALABも'] },
      { text: '35270で日本半導体を埋めない' },
      { text: 'ジャクソンホール要約は①だけ見る' },
    ],
  },
  {
    author: 0,
    postedAt: '2026-08-29T11:12:00+09:00',
    likeSlots: 13,
    title: '1306 TOPIX429.4 — 指数ETFは半導体と分けて考える',
    content:
      '1306 TOPIX ETF金曜429.4円。日経66131.98円と比べ指数側は相対的に落ち着き。6857・9984・285Aの半導体個別と1306をセットで買い戻さない。NVDA217.55も参考。週末チェック：①ルール②サイズ③月曜寄り30分。',
    ticker: '1306.T',
    sentiment: 'neutral',
    tags: ['TOPIX', 'N225', '半導体', 'NVDA'],
    comments: [
      { text: '429.4で週末スポットしない', replies: ['6857セット禁止', '9984も'] },
      { text: '66132日経と1306を同時に厚くしない' },
      { text: 'ジャクソンホールは月曜寄り後' },
    ],
  },
  {
    author: 11,
    postedAt: '2026-08-29T11:45:00+09:00',
    likeSlots: 14,
    title: '週末雑談 — 今週の話題：ジャクソンホール・NVDA・285A',
    content:
      '今週の話題タグ整理：ジャクソンホール、NVDA217.55、285A47900、685735270、99845161、N22566132。どれも「買い」ではなく「位置の確認」。月曜は寄り30分待つ。番号で一番気になる銘柄を。',
    ticker: 'NVDA',
    sentiment: 'neutral',
    tags: ['ジャクソンホール', 'NVDA', '285A', '6857', '9984', 'N225'],
    comments: [
      { text: '①NVDA。それ以外触らない', replies: ['②285Aは月曜', '③6857も'] },
      { text: '9984はSBG5161で見送り' },
      { text: '週末はサイズを増やさない派', replies: ['同感', '+1'] },
      { text: '66132日経は指数。個別半導体と混ぜない' },
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Aug 29 morning posts…`)

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
      console.log(`[dry-run] ${row.postedAt.slice(0, 16)} ${mapped.nickname}: ${row.title} (c=${totalComments}) tags=${(row.tags || []).join(',')}`)
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
