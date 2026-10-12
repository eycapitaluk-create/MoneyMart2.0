/**
 * Community: Tue Sep 8 evening refresh notes + Wed Sep 9 session.
 * Prices: Marketstack 2026-09-08 (JP+US) / 2026-09-09 JP only (^N225 not in DB yet).
 *
 *   node scripts/seed-community-sep8-sep9-hotnews.mjs
 *   node scripts/seed-community-sep8-sep9-hotnews.mjs --dry-run
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

/** Confirmed EOD: 2026-09-08 JP+US; 2026-09-09 JP equities/ETFs (no ^N225 row yet). */
const POSTS = [
  {
    author: 1,
    postedAt: '2026-09-08T18:22:00+09:00',
    likeSlots: 16,
    title: '火曜大引け確定 — 日経66399.84。半導体は銘柄差',
    content:
      '火曜確定（Marketstack 2026-09-08）：日経66399.84円、685733800円（高35690・安33800）、99846556円（高6745・安6111）、285A57410円、803554000円、72032968.5円、1306430.1円。米：NVDA225.73ドル、S&P7673.52。急騰銘柄と押し目銘柄をセット買いしない。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['大引け', 'N225', '9984', '6857', 'NVDA'],
    comments: [
      { text: '66399で飛び乗り禁止', replies: ['35690高値も', 'サイズ維持'] },
      { text: '99846556は強いが枚数戻さない' },
      { text: 'NVDA225.73と日本を混ぜない' },
    ],
  },
  {
    author: 8,
    postedAt: '2026-09-08T20:40:00+09:00',
    likeSlots: 15,
    title: '火曜夜 — 99846556・NVDA225.73。水曜は寄り30分',
    content:
      '火曜夜メモ。火曜確定：99846556円、685733800円、285A57410円、NVDA225.73ドル（高233.71・安224.85）、日経66399.84。話題でも買い理由にしない。水曜寄り30分まで新規ゼロ寄り。',
    ticker: '9984.T',
    sentiment: 'neutral',
    tags: ['夜', '9984', 'NVDA', 'ルール'],
    comments: [
      { text: '6556追わない', replies: ['225.73も', '積立だけ'] },
      { text: '33800安値で逆張り禁止' },
      { text: '損切り線だけ更新' },
    ],
  },
  {
    author: 5,
    postedAt: '2026-09-09T08:16:00+09:00',
    likeSlots: 16,
    title: '水曜寄り — 直近確定は火曜66399。寄り30分',
    content:
      '水曜寄り。直近確定（Marketstack 2026-09-08）：日経66399.84円、685733800円、99846556円、285A57410円、NVDA225.73ドル。本日の板が出るまで①寄り30分②6556/33800で追いかけない③サイズ上限。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['寄り', 'N225', '9984', '6857'],
    comments: [
      { text: '火曜高を追わない', replies: ['30分待つ', '285Aも'] },
      { text: '全額禁止' },
      { text: '偏り確認だけ' },
    ],
  },
  {
    author: 10,
    postedAt: '2026-09-09T10:38:00+09:00',
    likeSlots: 15,
    title: '前場 — 9984が動く。確定は大引けまで書かない',
    content:
      '前場。半導体サイドが動いているが、数値は大引け確定までメモしない。火曜位置（99846556・685733800・285A57410）は参考のみ。分割のみ・セット買い禁止。',
    ticker: '9984.T',
    sentiment: 'neutral',
    tags: ['前場', '9984', '半導体', '様子見'],
    comments: [
      { text: '板で枚数増やさない', replies: ['大引けまで', 'ルール'] },
      { text: '6857とセットにしない' },
      { text: '損切り線は維持' },
    ],
  },
  {
    author: 2,
    postedAt: '2026-09-09T12:42:00+09:00',
    likeSlots: 14,
    title: '昼 — 7203/個別は火曜位置メモ。指数と混ぜない',
    content:
      '昼休み。火曜確定：72032968.5円、803554000円、692034910円、1306430.1円。個別は個別。指数のイメージだけで枚数を戻さない。寄り後も上限ゼロ。',
    ticker: '7203.T',
    sentiment: 'neutral',
    tags: ['昼', '7203', '8035', '様子見'],
    comments: [
      { text: '2968.5でスポット禁止', replies: ['54000も', 'サイズ'] },
      { text: 'コアは積立継続' },
      { text: 'レバ触らない' },
    ],
  },
  {
    author: 7,
    postedAt: '2026-09-09T15:28:00+09:00',
    likeSlots: 17,
    title: '水曜大引け — 99846810円。6857は32840へ押し',
    content:
      '水曜大引け確定（Marketstack 2026-09-09）：99846810円（始6600・高6959・安6560）、685732840円（高34210・安32590）、285A57000円、803553700円、692035280円、72032971円、1306421.4円、1321日経連動67350円。日経指数行は未取込のため個別・ETFのみメモ。急騰9984を追いかけない。',
    ticker: '9984.T',
    sentiment: 'neutral',
    tags: ['大引け', '9984', '6857', '285A', '半導体'],
    comments: [
      { text: '6810で飛び乗り禁止', replies: ['6959高値も', 'サイズ維持'] },
      { text: '32840押しで逆張りも禁止', replies: ['32590安値も'] },
      { text: '日経は132167350を位置参考。指数終値は書かない' },
    ],
  },
  {
    author: 9,
    postedAt: '2026-09-09T17:46:00+09:00',
    likeSlots: 15,
    title: '水曜夕 — 半導体は銘柄差。セットで増やさない',
    content:
      '水曜夕。確定：99846810・685732840・285A57000・803553700・692035280。強い9984と押した6857をセット買いしない。1306421.4・132167350は指数連動ETFの位置確認だけ。',
    ticker: '6857.T',
    sentiment: 'neutral',
    tags: ['夕方', '6857', '9984', '半導体', 'ルール'],
    comments: [
      { text: 'セット買いは禁止', replies: ['同感', '枚数維持'] },
      { text: '57000でスポットしない' },
      { text: '損切り線だけ見直す' },
    ],
  },
  {
    author: 4,
    postedAt: '2026-09-09T19:18:00+09:00',
    likeSlots: 14,
    title: '夜 — 話題タグ9984。6810は位置確認だけ',
    content:
      '水曜夜。話題は99846810円の高値圏と685732840の押し。どちらも「買い」ではなく位置。火曜NVDA225.73とも混ぜない。新規は半分ルール。',
    ticker: '9984.T',
    sentiment: 'neutral',
    tags: ['夜', '9984', '6857', 'NVDA', 'ルール'],
    comments: [
      { text: '6810追わない', replies: ['32840も', '積立だけ'] },
      { text: '話題＝ウォッチ' },
      { text: '木曜寄りまで慎重' },
    ],
  },
  {
    author: 6,
    postedAt: '2026-09-09T21:08:00+09:00',
    likeSlots: 15,
    title: '夜更け — 週中メモ：66399→個別押し上げ。サイズ確認',
    content:
      '水曜夜更け。火曜日経66399.84、水曜個別：99846810・685732840・285A57000・1306421.4。指数終値（水曜）はDB未取込なので書かない。サイズと偏りだけ確認して終了。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['夜', 'N225', '9984', 'ルール', '様子見'],
    comments: [
      { text: '①サイズ②触らない③明日寄り30分', replies: ['同感'] },
      { text: '未確定の日経は書かない' },
      { text: 'レバは使わない' },
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Sep 8–9 posts…`)

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
