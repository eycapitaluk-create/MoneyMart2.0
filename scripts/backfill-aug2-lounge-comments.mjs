/**
 * One-off: insert missing lounge_comments for Aug 2 hot-news seed posts.
 * Prerequisite: apply SUPABASE_PATCH_FIX_LOUNGE_COMMENT_NOTIFY_ACTOR_NAME.sql
 *   node scripts/backfill-aug2-lounge-comments.mjs
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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    if (process.env[key] == null || process.env[key] === '') process.env[key] = val
  }
}

loadEnvFile(path.resolve(__dirname, '..', '.env.local'))
loadEnvFile(path.resolve(__dirname, '..', '.env'))

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim()
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim()
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

// Keep in sync with scripts/seed-community-aug2-hotnews.mjs POSTS (title + comments only)
const POSTS = [
  {
    author: 1,
    postedAt: '2026-08-02T08:30:00+09:00',
    title: '7/31日経+4％（64362円）リバウンド — 週明けも続く？それとも利確？',
    comments: ['64362はまだ重い水準', 'ショートカバー説もある', '月曜は寄り30分待ち', '利確派と継続派が真っ二つ', '出来高見ないと判断できない', 'コアETFは触らない', 'わかる'],
  },
  {
    author: 5,
    postedAt: '2026-08-02T09:15:00+09:00',
    title: '日銀政策金利1.0％据え置き — 8対1のタカ派票、円と株はどう読む？',
    comments: ['据え置きは想定内', '8対1はややタカ派', '円は様子見', '銀行株は材料次第', 'REITは金利敏感', 'レバは触らない', 'メモした'],
  },
  {
    author: 3,
    postedAt: '2026-08-02T10:40:00+09:00',
    title: 'アドバンテスト+15％・東エレク+6％ — 半導体の「戻り」は追いかける？',
    comments: ['6857の上方修正は強い', '②まだ様子見派', '①は分割のみ', '8035は連動しやすい', '285Aはボラ高い', '全額禁止わかる', '③コアETF継続'],
  },
  {
    author: 7,
    postedAt: '2026-08-02T12:00:00+09:00',
    title: 'MSFT・AMZN決算後 — AI投資は「続く」に戻った？',
    comments: ['capex継続は安心材料', 'センチメントはまだ慎重', '日本半導体連動', 'テーマ全振りは危険', 'ガイダンス要チェック', '分割でいく', '同意'],
  },
  {
    author: 11,
    postedAt: '2026-08-02T13:20:00+09:00',
    title: 'ルネサス(6723)決算 — 営業利益率32.7％、自動車×AIの戻り？',
    comments: ['利益率は強い', '織り込み済み説も', '車載×AIはテーマ', 'サイズ小さめ', 'ウォッチリスト入り', '個別は難しい', 'メモした'],
  },
  {
    author: 4,
    postedAt: '2026-08-02T14:45:00+09:00',
    title: '投票 — 8月最初の週、あなたのポジション方針は？',
    comments: ['③コアETF継続', '②利確派', '①は分割のみ', '④ウォッチ', '⑤損切り済み', 'レバは触らない', '②に近い', '様子見'],
  },
  {
    author: 6,
    postedAt: '2026-08-02T16:10:00+09:00',
    title: '週末メモ — シタデル話題＋日銀＋半導体リバウンド、月曜は何を見る？',
    comments: ['月曜は3点セット', '韓国半導体要チェック', '円も見る', 'ルール守る', '無理に動かない', 'まとめ助かる'],
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

function commentPersonaFor(row, c) {
  let idx = (row.author + c + 2) % PERSONAS.length
  let persona = PERSONAS[idx]
  let mapped = personaMap.get(persona.email.toLowerCase())
  if (mapped?.userId === authorIdByPost.get(row.title)) {
    idx = (row.author + c + 3) % PERSONAS.length
    persona = PERSONAS[idx]
    mapped = personaMap.get(persona.email.toLowerCase())
  }
  return mapped
}

const personaMap = new Map()
const authorIdByPost = new Map()

for (const persona of PERSONAS) {
  const email = persona.email.toLowerCase()
  const userId = await findUserIdByEmail(email)
  if (!userId) console.error('missing auth user:', email)
  personaMap.set(email, { userId, nickname: String(persona.nickname || '').trim() })
}

const seedNicknames = PERSONAS.map((p) => p.nickname)
const { data: dbPosts, error: pErr } = await admin
  .from('lounge_posts')
  .select('id,title,author_id,comment_count')
  .gte('created_at', '2026-08-01T15:00:00.000Z')
  .lte('created_at', '2026-08-02T14:59:59.999Z')
  .in('author_name', seedNicknames)

if (pErr) throw pErr

for (const row of POSTS) {
  const hit = (dbPosts || []).find((p) => p.title === row.title)
  if (hit) authorIdByPost.set(row.title, hit.author_id)
}

const errors = []
const report = []

for (const row of POSTS) {
  const post = (dbPosts || []).find((p) => p.title === row.title)
  if (!post) {
    errors.push({ title: row.title, error: 'post not found' })
    continue
  }

  const { data: existing } = await admin.from('lounge_comments').select('content').eq('post_id', post.id)
  const existingTexts = new Set((existing || []).map((r) => String(r.content || '').trim()))

  let inserted = 0
  const commentTexts = row.comments || []

  for (let c = 0; c < commentTexts.length; c += 1) {
    const text = commentTexts[c]
    if (existingTexts.has(text)) continue

    const commentMapped = commentPersonaFor(row, c)
    if (!commentMapped?.userId) {
      const err = `no commenter for index ${c}`
      errors.push({ post: row.title.slice(0, 48), comment: text, error: err })
      console.error('ERROR:', err, row.title)
      continue
    }

    const commentAt = new Date(new Date(row.postedAt).getTime() + (c + 1) * 9 * 60 * 1000).toISOString()
    const { error: cErr } = await admin.from('lounge_comments').insert({
      post_id: post.id,
      author_id: commentMapped.userId,
      author_name: commentMapped.nickname,
      content: text,
      status: 'published',
      created_at: commentAt,
      updated_at: commentAt,
    })
    if (cErr) {
      errors.push({ post: row.title.slice(0, 48), comment: text, error: cErr.message, code: cErr.code, details: cErr.details })
      console.error('INSERT ERROR:', row.title.slice(0, 48), text, cErr.message, cErr.code, cErr.details)
    } else {
      inserted += 1
      existingTexts.add(text)
    }
  }

  const { count: finalCount } = await admin.from('lounge_comments').select('*', { count: 'exact', head: true }).eq('post_id', post.id).eq('status', 'published')
  report.push({ title: row.title.slice(0, 52), inserted, finalCount, expected: commentTexts.length, dbCommentCount: post.comment_count })
}

console.log('\n=== COMMENTS INSERTED PER POST ===')
for (const r of report) console.log(JSON.stringify(r))
console.log(`\nTotal inserted: ${report.reduce((s, r) => s + r.inserted, 0)}`)
console.log(`\n=== ERRORS (${errors.length}) ===`)
for (const e of errors) console.log(JSON.stringify(e))

if (errors.length) process.exit(1)
