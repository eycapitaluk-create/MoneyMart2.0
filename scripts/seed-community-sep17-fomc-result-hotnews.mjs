/**
 * Community topics: Thu Sep 17 morning after FOMC (announced ~03:00 JST).
 * News (FRB / wire): +25bp to 3.75–4.00%, unanimous; Warsh inflation focus;
 * projections suggest possible additional hike this year — cite as 報道, not invent dots detail.
 * Confirmed prices: Marketstack 2026-09-15 individuals; dashboard/index 2026-09-16
 * (日経63396 / N225 EOD 63484.10 on 9/15, S&P7585.73, VIX17.2, US10Y5, USDJPY155.33,
 * WTI104.36, 6857 30160, 9984 6279, 285A 51750, NVDA212.17).
 * Do not invent overnight US individual closes we do not have in DB.
 *
 *   node scripts/seed-community-sep17-fomc-result-hotnews.mjs
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
    postedAt: '2026-09-16T22:15:00+09:00',
    likeSlots: 14,
    title: '水曜深夜：FOMCまであと数時間。予想トレード禁止',
    content:
      '水曜深夜。発表は米14時＝日本未明。織り込みは25bpだが、結果が出るまで新規禁止。位置の基準は確定済み：日経63484.10（9/15）／dashboard日経63396・S&P7585.73・VIX17.2・US10Y5.00・ドル円155.33・685730160。睡眠優先。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['FOMC', 'ルール', '話題', '様子見', '金利'],
    comments: [
      { text: '予想でポジ禁止', replies: ['睡眠', '朝に判定'] },
      { text: '一次情報は声明' },
      { text: '155.33触らない' },
    ],
  },
  {
    author: 6,
    postedAt: '2026-09-17T05:18:00+09:00',
    likeSlots: 17,
    title: '木曜早朝：FOMCは25bp利上げ。寄りで追わない',
    content:
      '木曜早朝。報道・FRB声明：FF金利を0.25%引き上げ、誘導目標3.75–4.00%（全会一致）。ウォーシュ議長はインフレが「高すぎ・長すぎ」との趣旨。位置確認は確定数字のみ：日経63396（dashboard）／9/15個別685730160・99846279・NVDA212.17・S&P7585.73。織り込み通りでもsell the newsがありうる。寄り30分・分割のみ。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['FOMC', '利上げ', '話題', '寄り付き', 'ルール'],
    comments: [
      { text: '25bpは織り込み', replies: ['30分ルール', 'サイズ小'] },
      { text: '声明・会見を一次情報に' },
      { text: '212.17追っかけ禁止' },
    ],
  },
  {
    author: 9,
    postedAt: '2026-09-17T06:12:00+09:00',
    likeSlots: 16,
    title: '話題：追加利上げ観測。ドットで売り浴びせ禁止',
    content:
      '木曜朝。報道では年内の追加利上げが意識される、との解説が多い。ドット詳細は一次資料で確認。金利テーマで成長株をまとめて売るのは禁止。確定位置：US10Y5.00・VIX17.2・ドル円155.33・WTI104.36。サイズ維持。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['FOMC', 'ドット', '金利', '話題', 'ルール'],
    comments: [
      { text: '次を織り込んで売らない', replies: ['ドット確認', '積立だけ'] },
      { text: '5%で金利トレード禁止' },
      { text: '一次情報はSEP・声明' },
    ],
  },
  {
    author: 0,
    postedAt: '2026-09-17T06:55:00+09:00',
    likeSlots: 15,
    title: '半導体：30160は金利ニュースでナンピン禁止',
    content:
      '木曜朝。確定（Marketstack 2026-09-15）：685730160・99846279・285A51750。利上げ発表を理由に押し目買いしない。日経はdashboard63396／9/15終値63484.10。イベント後ギャップ追いは禁止。損切り線だけ確認。',
    ticker: '6857.T',
    sentiment: 'bearish',
    tags: ['半導体', '6857', 'FOMC', '話題', 'ルール'],
    comments: [
      { text: '30160でナンピン禁止', replies: ['6279も', '51750も'] },
      { text: '金利連想でセット禁止' },
      { text: '寄り30分見るだけ' },
    ],
  },
  {
    author: 4,
    postedAt: '2026-09-17T07:20:00+09:00',
    likeSlots: 14,
    title: '朝チェック：話題と執行を分ける',
    content:
      '木曜朝チェック。①FOMC結果は25bp・3.75–4.00%（声明）②数字：S&P7585.73／日経63396／US10Y5.00／ドル円155.33／原油104.36／685730160③追加利上げ観測でサイズを増やしていないか。話題は金利、執行は後回し。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['チェックリスト', 'FOMC', 'ルール', '話題', '金利'],
    comments: [
      { text: 'チェック同意', replies: ['執行しない', '分割のみ'] },
      { text: '連想売買禁止' },
      { text: '一次情報以外信じない' },
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Sep17 FOMC-result topic posts…`)

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
