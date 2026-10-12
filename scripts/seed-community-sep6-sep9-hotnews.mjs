/**
 * Community: Sun Sep 6 afternoon – Wed Sep 9 morning.
 * Prices: Marketstack 2026-09-04 (weekend) / 2026-09-07 JP (Mon; US Labor Day holiday).
 * No fabricated Sep 8 EOD — Tue/Wed posts cite Mon JP closes only.
 *
 *   node scripts/seed-community-sep6-sep9-hotnews.mjs
 *   node scripts/seed-community-sep6-sep9-hotnews.mjs --dry-run
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

/** Confirmed EOD only: 2026-09-04 (weekend) / 2026-09-07 JP (Mon). US closed Labor Day Mon. */
const POSTS = [
  {
    author: 3,
    postedAt: '2026-09-06T10:24:00+09:00',
    likeSlots: 15,
    title: '日曜昼 — 金曜確定のまま。月曜は米休場（Labor Day）',
    content:
      '日曜昼メモ。金曜確定（Marketstack 2026-09-04）：日経64214.48円、685733090円、99845590円、285A54460円、NVDA230.36ドル。月曜は日本取引・米はLabor Day休場。連想で枚数を戻さない。寄り30分ルール。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['週末', 'N225', 'Labor Day', 'ルール'],
    comments: [
      { text: '米休場でも日本で追いかけない', replies: ['64214で寄り買い禁止', 'サイズ維持'] },
      { text: '5590/33090は位置確認だけ' },
      { text: '積立は淡々と' },
    ],
  },
  {
    author: 9,
    postedAt: '2026-09-06T14:52:00+09:00',
    likeSlots: 14,
    title: '日曜午後 — 半導体セット買い禁止。月曜ギャップ待ち',
    content:
      '日曜午後。金曜：685733090・99845590・285A54460・NVDA230.36。月曜は日本だけ動く日。米終値がないのに「追随」しない。寄り後30分まで新規ゼロ。',
    ticker: '6857.T',
    sentiment: 'neutral',
    tags: ['週末', '6857', '9984', '半導体'],
    comments: [
      { text: 'セット買いは禁止', replies: ['285Aも同じ', '月曜まで見る'] },
      { text: 'ギャップは追いかけない' },
      { text: '損切り線だけメモ' },
    ],
  },
  {
    author: 4,
    postedAt: '2026-09-06T19:18:00+09:00',
    likeSlots: 15,
    title: '日曜夜 — 週明けチェックリスト：寄り30分・サイズ・米休場',
    content:
      '日曜夜。月曜プレビュー：①寄り30分待つ②金曜確定64214/33090/5590を買い理由にしない③米Labor Day休場を忘れるな。新規は増やさない。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['週末', 'ルール', 'N225', '様子見'],
    comments: [
      { text: '①②③そのまま', replies: ['同感', 'アプリ閉じる'] },
      { text: 'レバは触らない' },
      { text: '1306427.2は指数。個別と混ぜない' },
    ],
  },
  {
    author: 5,
    postedAt: '2026-09-07T09:16:00+09:00',
    likeSlots: 17,
    title: '月曜寄り — 米休場。金曜位置から板だけ見る',
    content:
      '月曜寄り。米Labor Day休場。直近金曜確定：日経64214.48・685733090・99845590。本日の日本板が出るまで①寄り30分②ギャップ追わない③サイズ上限。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['寄り', 'N225', 'Labor Day', '6857'],
    comments: [
      { text: '休場日の連想買い禁止', replies: ['30分待つ', '5590も'] },
      { text: '寄り前に偏り確認だけ' },
      { text: '積立以外は触らない' },
    ],
  },
  {
    author: 10,
    postedAt: '2026-09-07T11:28:00+09:00',
    likeSlots: 16,
    title: '前場 — 6857/9984が動く。確定は大引けまで',
    content:
      '前場ウォッチ。半導体が動いているが、数値は大引け確定までメモしない。米休場なので「NY追随」理由は使わない。分割のみ・全額禁止。',
    ticker: '9984.T',
    sentiment: 'neutral',
    tags: ['前場', '9984', '6857', '半導体'],
    comments: [
      { text: '板で追わない', replies: ['大引けまで', 'サイズ'] },
      { text: '285Aも同じルール' },
      { text: 'セット買いは禁止' },
    ],
  },
  {
    author: 1,
    postedAt: '2026-09-07T15:22:00+09:00',
    likeSlots: 18,
    title: '月曜大引け — 日経65020.94円。半導体も強い',
    content:
      '月曜大引け確定（Marketstack 2026-09-07）：日経65020.94円（始64498.94・高65182.45・安64228.47）。685734480円（高34850・安33520）、99846217円（高6217・安5814）、285A59530円（高59790・安57650）、1306430.1円。米休場日の日本高。急騰後は追いかけ禁止。',
    ticker: 'N225',
    sentiment: 'bullish',
    tags: ['大引け', 'N225', '6857', '9984', '285A'],
    comments: [
      { text: '65020で飛び乗り禁止', replies: ['34850高値も', '6217も'] },
      { text: '金曜5590→6217。枚数戻さない', replies: ['急騰後ルール'] },
      { text: '米火曜まで新規は慎重' },
    ],
  },
  {
    author: 8,
    postedAt: '2026-09-07T17:48:00+09:00',
    likeSlots: 16,
    title: '99846217円・685734480円 — 月曜確定。セットで増やさない',
    content:
      '月曜確定：99846217円（始5842）、685734480円、285A59530円、8035東京エレク55840円、6920レーザーテック35590円。半導体全体が強い一日。位置メモだけ。枚数は増やさない。',
    ticker: '9984.T',
    sentiment: 'neutral',
    tags: ['9984', '6857', '半導体', '8035'],
    comments: [
      { text: '6217でスポット禁止', replies: ['59530も', 'サイズ維持'] },
      { text: '8035/6920も連想買いしない' },
      { text: '損切り線だけ更新' },
    ],
  },
  {
    author: 2,
    postedAt: '2026-09-07T20:36:00+09:00',
    likeSlots: 15,
    title: '月曜夜 — 米休場明けは火曜。日本確定65020を買い理由にしない',
    content:
      '月曜夜。日本確定：日経65020.94・685734480・99846217・285A59530。米はLabor Day休場のため米終値なし。火曜の米板が出るまで連想で枚数を戻さない。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['夜', 'N225', 'Labor Day', 'ルール'],
    comments: [
      { text: '火曜まで新規慎重', replies: ['同感', '積立だけ'] },
      { text: '65020を「安い」と決めない' },
      { text: '話題タグは位置確認' },
    ],
  },
  {
    author: 6,
    postedAt: '2026-09-08T09:14:00+09:00',
    likeSlots: 16,
    title: '火曜寄り — 直近確定は月曜65020。寄り30分',
    content:
      '火曜寄り。直近確定（Marketstack 2026-09-07）：日経65020.94円、685734480円、99846217円、285A59530円。本日の板が出るまで①寄り30分②6217/34480で追いかけない③サイズ上限。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['寄り', 'N225', '9984', '6857'],
    comments: [
      { text: '月曜高を追わない', replies: ['30分待つ', '285Aも'] },
      { text: '米板も別枠で見る' },
      { text: '全額禁止' },
    ],
  },
  {
    author: 7,
    postedAt: '2026-09-08T12:40:00+09:00',
    likeSlots: 14,
    title: '火曜昼 — 月曜半導体位置をメモ。確定値はまだ出ない',
    content:
      '火曜昼。月曜確定を位置メモ：685734480・99846217・285A59530・803555840・692035590。今日の終値は大引けまで書かない。分割のみ。',
    ticker: '6857.T',
    sentiment: 'neutral',
    tags: ['昼', '6857', '半導体', '様子見'],
    comments: [
      { text: '板で枚数増やさない', replies: ['大引けまで', 'ルール'] },
      { text: '72033096も個別で見る' },
      { text: '偏り確認だけ' },
    ],
  },
  {
    author: 11,
    postedAt: '2026-09-08T16:55:00+09:00',
    likeSlots: 15,
    title: '火曜夕 — 月曜確定のままサイズ確認。飛び乗り禁止',
    content:
      '火曜夕。DBの直近確定は月曜：日経65020.94・1306430.1・72033096。終値が出るまで数字を更新しない。サイズと損切り線だけ見直す。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['夕方', 'N225', 'ルール', '様子見'],
    comments: [
      { text: '未確定の数字は書かない', replies: ['同感', '月曜メモ維持'] },
      { text: 'レバは触らない' },
      { text: '積立継続' },
    ],
  },
  {
    author: 0,
    postedAt: '2026-09-08T20:12:00+09:00',
    likeSlots: 14,
    title: '火曜夜 — 話題は月曜の半導体急騰。追わない',
    content:
      '火曜夜雑談。話題の位置は月曜確定：99846217・685734480・285A59530・日経65020.94。どれも「買い」ではなく位置。新規は半分ルール。',
    ticker: '9984.T',
    sentiment: 'neutral',
    tags: ['夜', '9984', '半導体', '6857', 'ルール'],
    comments: [
      { text: '6217追わない', replies: ['34480も', '59530も'] },
      { text: '話題タグ＝ウォッチ' },
      { text: '水曜寄りまで慎重' },
    ],
  },
  {
    author: 5,
    postedAt: '2026-09-09T06:48:00+09:00',
    likeSlots: 15,
    title: '水曜朝 — 直近確定は月曜。寄り前に偏りだけ',
    content:
      '水曜早朝。直近確定（Marketstack 2026-09-07）：日経65020.94円、685734480円、99846217円、285A59530円、1306430.1円。火曜終値がまだないので数字は更新しない。寄り前は偏りとサイズだけ。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['朝', 'N225', 'ルール', '様子見'],
    comments: [
      { text: '未確定値は書かない', replies: ['月曜メモ維持', '寄り30分'] },
      { text: '全額エントリー禁止' },
      { text: '積立は継続' },
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Sep 6–9 posts…`)

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
