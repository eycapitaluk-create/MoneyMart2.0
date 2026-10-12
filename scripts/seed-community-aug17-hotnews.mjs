/**
 * Community: Aug 17 (Mon) — 米週末安でも5日続伸スタート、前場失速、TOPIX弱い.
 * Times only up to current JST (~13:45). No future posts.
 *
 *   node scripts/seed-community-aug17-hotnews.mjs
 *   node scripts/seed-community-aug17-hotnews.mjs --dry-run
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
    author: 0,
    postedAt: '2026-08-17T07:18:00+09:00',
    likeSlots: 16,
    title: '月曜おはよう — 米週末はダウ反落、でも先物はほぼフラット',
    content:
      '前週末米：ダウ-107ドル、ナスダックも反落。7月小売売上高は前月比-0.6％、ミシガン消費者態度も予想下振れ（報道）。AMATは好決算でも期待未達で売られた流れ。シカゴ日経先物は大阪比+25円前後と大きくは崩れていない。自分のルールは①寄り30分見るだけ②ギャップ追っかけ禁止③半導体フルベットしない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['月曜', 'ダウ', 'マクロ', 'メンタル'],
    comments: [
      {
        text: '米安なのに先物フラットは意外',
        replies: ['好業績銘柄の買いが残ってる？', 'それでも①見るだけ'],
      },
      {
        text: '消費弱い＝利上げ後退？ストーリー固定しない',
        replies: ['先週それやって飛びついた人いそう'],
      },
      { text: '積立は淡々と。今日の正解はそれ' },
    ],
  },
  {
    author: 2,
    postedAt: '2026-08-17T08:42:00+09:00',
    likeSlots: 15,
    title: '寄り前 — AMAT連想で8035/6857を追いかける？',
    content:
      '週末スレの続き。AMATは予想超えでも売られた。日本の東エレク・アドテストは連想が出やすいが、月曜朝に飛びつくのは危険。チェック：①ドル円159円台前半②先物③半導体ギャップ④触らない。投票：寄り後は？①見るだけ②押し目分割③強気で少し。',
    ticker: '6857.T',
    sentiment: 'neutral',
    tags: ['AMAT', '半導体', '寄り前', '東エレク'],
    comments: [
      {
        text: '①一択。連想買い禁止',
        replies: ['同感。寄与銘柄の月曜は罠', 'ウォッチ更新だけ'],
      },
      {
        text: '285Aキオクシアは週末話題だった。見るけど追わない',
        replies: ['テーマ全振りしない'],
      },
      { text: '③欲しい気持ちある…我慢' },
    ],
  },
  {
    author: 8,
    postedAt: '2026-08-17T09:22:00+09:00',
    likeSlots: 17,
    title: '寄り — 米安なのに5日続伸スタート、+168円',
    content:
      '寄りは前営業日比+168円の6万8882円付近（報道）。米株安でも好業績・半導体の一角が指数を支える展開。285A・7974・6857・8035などが強いとの解説も。でも「米安無視して追っかけ」は危険。ギャップ追っかけ禁止、サイズ維持。',
    ticker: 'TOPIC',
    sentiment: 'bullish',
    tags: ['寄り', '日経平均', '半導体', 'キオクシア'],
    comments: [
      {
        text: '5日続伸スタートか…達成感売り出そう',
        replies: ['わかる。だから見送り', '気持ちいい寄りほど怖い'],
      },
      {
        text: '村田・太陽誘電は弱い？選別されてる',
        replies: ['全部半導体が強いわけじゃない'],
      },
      { text: 'ドル円159円台。円安だけで買わない' },
    ],
  },
  {
    author: 6,
    postedAt: '2026-08-17T11:05:00+09:00',
    likeSlots: 16,
    title: '前場中盤 — 一時6万9100円まで行って失速',
    content:
      '寄り後は上げ幅拡大→一時+386円・6万9100円台の話題も。その後失速してマイナス圏も（報道）。4日続伸のあとの急な戻り警戒で利確が出やすい日。半導体は下支えでも上値重い。自分はサイズ変えてない。後場も様子見でいい。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['前場', '利確', '日経平均', '半導体'],
    comments: [
      {
        text: '高値掴みしなくてよかった…',
        replies: ['ギャップ追いしてない人えらい', '失速あるある'],
      },
      {
        text: 'イラン情勢・インフレ警戒が上値を抑えてる話もある',
        replies: ['原油・地政学は残ってる'],
      },
      { text: '投票：後場は？①見るだけ②押し目③利確' },
    ],
  },
  {
    author: 3,
    postedAt: '2026-08-17T12:25:00+09:00',
    likeSlots: 15,
    title: '前引けメモ — 日経は小幅高、TOPIXはマイナス？歪み注意',
    content:
      '前引けは日経+7円前後の6万8721円付近でほぼフラット（報道）。半導体が下支えでも方向感乏しい。一方TOPIXはマイナスの解説も。指数強い≠幅広い買い。金融株がさえないとの声。後場は手掛かり難でもみ合い予想。無理に増やさない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['前引け', 'TOPIX', '半導体', '様子見'],
    comments: [
      {
        text: '日経とTOPIXのズレ、寄与銘柄依存だね',
        replies: ['6857見て判断しすぎ注意', '幅広い下落銘柄の方が多い日'],
      },
      {
        text: 'ランチ後に追いかける人、やめて',
        replies: ['後場も①見るだけ', '同意'],
      },
      { text: '積立だけやって仕事戻る' },
    ],
  },
  {
    author: 9,
    postedAt: '2026-08-17T13:28:00+09:00',
    likeSlots: 14,
    title: '後場入り — もみ合いなら「触らない」が正解',
    content:
      '後場は前引け水準を挟んだもみ合いになりやすい、との見方。米消費減速懸念は残る。半導体・非鉄の一角に資金、でも指数を押し上げる勢いは限定的。自分のルール：①後場に新規増やさない②寄与銘柄追いかけない③大引けまでサイズ維持。みんな後場どうする？',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['後場', 'メンタル', 'ルール', '様子見'],
    comments: [
      {
        text: '①守れそう。午前で十分見た',
        replies: ['正しい', '触ると負ける気がする'],
      },
      {
        text: 'ウォッチリスト整理だけする',
        replies: ['それが仕事'],
      },
      { text: '大引けスレでまた会おう' },
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Aug 17 Monday posts…`)

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
