/**
 * Community topics: Sat Sep 12 afternoon – Sun Sep 13 midday.
 * News: FOMC hike odds ~90%, BOJ hike expected, oil near $100, JP selloff (報道 N225 64011).
 * DB: Marketstack 2026-09-11 individual closes + dashboard WTI/US10Y/USDJPY/VIX/GSPC.
 * Do not cite loaded ^N225 65270.95 as Friday close — it conflicts with wire reports (64011.34).
 *
 *   node scripts/seed-community-sep12-sep13-topics-hotnews.mjs
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
    author: 5,
    postedAt: '2026-09-12T10:18:00+09:00',
    likeSlots: 16,
    title: '土曜：話題はFOMC利上げ観測。週明けは追わない',
    content:
      '土曜昼。話題①米8月コアCPI上振れ後、報道では9/15–16 FOMCの利上げ確率がおおむね90%近辺。dashboard金曜：US10Y4.97、VIX15.84、USD/JPY153.55。確定個別（Marketstack 2026-09-11）：685731720・99846540・285A54030・NVDA218.29・S&P7656.98。週末に「利上げ前の押し目」を作らない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['FOMC', 'CPI', '金利', '話題', '週末'],
    comments: [
      { text: '利上げ織り込みで追わない', replies: ['月曜まで', 'サイズ維持'] },
      { text: '218.29も触らない' },
      { text: '一次情報はFOMC声明待ち' },
    ],
  },
  {
    author: 8,
    postedAt: '2026-09-12T13:36:00+09:00',
    likeSlots: 15,
    title: '話題：日銀も利上げ予想。円と株をセット買いしない',
    content:
      '土曜午後。報道では17–18日の日銀会合で利上げ（1.25%観測）が意識。米FOMCと連続する週。USD/JPY153.55は位置確認だけ。金利テーマで銀行を買う・成長株を売る、と週末に決めない。個別確定は金曜：72033031・1306419.7。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['日銀', '為替', '金利', '話題', 'ルール'],
    comments: [
      { text: 'セット売買禁止', replies: ['同感', '積立だけ'] },
      { text: '153.55で円高円安を決めない' },
      { text: '会見までサイズ維持' },
    ],
  },
  {
    author: 2,
    postedAt: '2026-09-12T16:22:00+09:00',
    likeSlots: 16,
    title: '話題：原油は100ドル前後。104ドル急騰のあと',
    content:
      '土曜夕。中東・供給懸念で原油は一時104ドル台、その後dashboard金曜WTI99.99（-2.43%）。100ドル前後の高止まりが来週の金利・株の重し、との解説が多い。エネルギー連想で枚数を増やさない。金はdashboard4390。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['原油', '中東', '金', '話題', '様子見'],
    comments: [
      { text: '99.99でスポット禁止', replies: ['104も追わない', 'サイズ'] },
      { text: '地政学ニュースで全額禁止' },
      { text: '一次情報はIEA・通信社' },
    ],
  },
  {
    author: 10,
    postedAt: '2026-09-12T19:08:00+09:00',
    likeSlots: 17,
    title: '話題：半導体は金曜確定で押し。逆張り禁止',
    content:
      '土曜夜。金曜確定（Marketstack）：685731720（高32220・安30980）、99846540（高6555・安6358）、285A54030（高55360・安53150）。報道では日経は大幅安（64011.34円、約1259円安）との市況。指数の取込値と報道がズレているので、指数終値は報道としてメモし、個別はDB確定だけ使う。30980安値で逆張りしない。',
    ticker: '6857.T',
    sentiment: 'bearish',
    tags: ['半導体', '6857', '9984', '285A', '話題'],
    comments: [
      { text: '31720で落ちるナイフ禁止', replies: ['6540も', '54030も'] },
      { text: '指数と個別を混ぜない' },
      { text: '損切り線だけ確認' },
    ],
  },
  {
    author: 1,
    postedAt: '2026-09-12T21:40:00+09:00',
    likeSlots: 14,
    title: '土曜夜：米株はS&P7656.98。日本半導体と分けて見る',
    content:
      '土曜夜。金曜米確定S&P7656.98・NVDA218.29。報道ではCPI後に原油一服で米株が戻した、との解説。日本の685731720・99846540とは別枠。連想で枚数を揃えない。月曜寄り30分。',
    ticker: 'NVDA',
    sentiment: 'neutral',
    tags: ['NVDA', 'N225', '半導体', '話題', 'ルール'],
    comments: [
      { text: '218.29で追わない', replies: ['7656も位置確認', 'セット禁止'] },
      { text: '週末はアプリ閉じる' },
      { text: 'FOMCまで慎重' },
    ],
  },
  {
    author: 6,
    postedAt: '2026-09-13T06:12:00+09:00',
    likeSlots: 15,
    title: '日曜朝：来週はFOMCと日銀。サイズ確認だけ',
    content:
      '日曜朝チェックリスト。①FOMC（15–16日）利上げ織り込み②日銀会合（17–18日）利上げ観測③原油WTI99.99④金曜個別：685731720・99846540・285A54030・NVDA218.29。日経の報道終値は64011.34。週末に買い理由を作らない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['週末', 'FOMC', '日銀', '原油', 'ルール'],
    comments: [
      { text: '①〜④全部ウォッチ', replies: ['月曜寄り30分', '積立だけ'] },
      { text: 'ギャップ追わない' },
      { text: 'レバ禁止' },
    ],
  },
  {
    author: 9,
    postedAt: '2026-09-13T09:28:00+09:00',
    likeSlots: 14,
    title: '日曜：話題タグは金利と原油。99846540は位置確認',
    content:
      '日曜午前。話題の中心は金利（米利上げ確率上昇・国内3%接近報道）と原油。9984は金曜6540円（安6358）。ブリッジ返済IRは既知でも、6540を週末の買い理由にしない。',
    ticker: '9984.T',
    sentiment: 'neutral',
    tags: ['9984', '金利', '原油', '週末', 'ルール'],
    comments: [
      { text: '6540追わない', replies: ['6358で逆張りも禁止'] },
      { text: 'IRと株価をセットにしない' },
      { text: '月曜まで見るだけ' },
    ],
  },
  {
    author: 7,
    postedAt: '2026-09-13T12:16:00+09:00',
    likeSlots: 15,
    title: '日曜昼：月曜プレビュー。寄り30分・新規ゼロ',
    content:
      '日曜昼。来週前半はFOMC、後半は日銀。板が出るまで①寄り30分②報道の大幅安（64011）で逆張りしない③半導体セット買い禁止。確定は金曜個別とS&P7656.98、WTI99.99、USD/JPY153.55。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['週末', 'N225', 'FOMC', 'ルール', '様子見'],
    comments: [
      { text: '寄り前は新規ゼロ', replies: ['サイズ確認だけ', '全額禁止'] },
      { text: '未確定の日曜は書かない' },
      { text: '一次情報は声明待ち' },
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Sep12–13 topic posts…`)

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
