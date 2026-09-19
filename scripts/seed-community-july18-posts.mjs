/**
 * Seed community posts for 2026-07-18 (JST) — Marine Day 3-day weekend.
 * Spread posts / comments / likes evenly across the day (morning → night).
 * Topics: Jul 17 historic drop aftermath, overnight futures rebound, weekend wait.
 *
 *   node scripts/seed-community-july18-posts.mjs
 *   node scripts/seed-community-july18-posts.mjs --dry-run
 *   node scripts/seed-community-july18-posts.mjs --replace
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"'))
      || (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = val
    }
  }
}

loadEnvFile(path.resolve(__dirname, '..', '.env.local'))
loadEnvFile(path.resolve(__dirname, '..', '.env'))

const DRY_RUN = process.argv.includes('--dry-run')
const REPLACE = process.argv.includes('--replace')
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim()
const SERVICE_KEY = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '',
).trim()

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const SEED_MARKER = 'mm-community-seed-july18-v1'

/** @type {{ email: string, name: string, exp: number }[]} */
const PERSONAS = [
  { email: 'mm-seed-01@community.seed', name: '田中健太', exp: 4200 },
  { email: 'mm-seed-02@community.seed', name: '佐藤美咲', exp: 3100 },
  { email: 'mm-seed-03@community.seed', name: '鈴木大輔', exp: 2800 },
  { email: 'mm-seed-04@community.seed', name: '高橋翔', exp: 5200 },
  { email: 'mm-seed-05@community.seed', name: '伊藤恵', exp: 1900 },
  { email: 'mm-seed-06@community.seed', name: '渡辺直樹', exp: 1500 },
  { email: 'mm-seed-07@community.seed', name: '山本涼', exp: 3600 },
  { email: 'mm-seed-08@community.seed', name: '中村さくら', exp: 2400 },
  { email: 'mm-seed-09@community.seed', name: '小林拓海', exp: 4800 },
  { email: 'mm-seed-10@community.seed', name: '加藤悠真', exp: 2700 },
  { email: 'mm-seed-11@community.seed', name: '吉田隼人', exp: 3300 },
  { email: 'mm-seed-12@community.seed', name: '松本彩', exp: 2100 },
]

/**
 * Evenly spaced through 2026-07-18 JST (holiday / 3-day weekend).
 * likeSlots = actual persona likes inserted (trigger overwrites like_count).
 */
const POSTS = [
  {
    author: 3, postedAt: '2026-07-18T07:20:00+09:00', likeSlots: 9,
    title: '朝活 — 17日は2694円安の64141円、連休入りの頭の整理',
    content: '歴史的急落の翌日は海の日連休。数字だけメモ：終値64141円、-2694円（約4%）。一時4100円超安から戻した形。今日は現物なしで、先物と海外ニュースだけ見る。積立は触らない。',
    ticker: 'N225', sentiment: 'neutral', tags: ['日経平均', '連休', '振り返り'],
    comments: [
      '64141、覚えておく。',
      '連休で整理する日。',
      '積立は触らない、同意。',
      '先物だけ見る。',
      'お疲れさま。',
    ],
  },
  {
    author: 8, postedAt: '2026-07-18T08:35:00+09:00', likeSlots: 5,
    title: '先物が急反発？ — 夜間に1000円高の報道、どう読む',
    content: '18日未明の日経225先物が前日比1000円高付近との報道。現物終値64141に対してプレミアムが乗る形。連休中の戻りは「本物」か「ショートカバー」か。週明け寄付きのギャップに備えてサイズだけ決めておく。',
    ticker: 'N225', sentiment: 'bullish', tags: ['先物', '反発', 'ギャップ'],
    comments: [
      '1000円高は大きい。',
      'ショートカバー説あり。',
      '週明けサイズ決め。',
      '本物かはまだ不明。',
    ],
  },
  {
    author: 1, postedAt: '2026-07-18T09:50:00+09:00', likeSlots: 11,
    title: '海の日連休 — 3連休の過ごし方（現金 vs 持ち越し）議論',
    content: '金曜大引け前に現金比率を上げた人と、コアETFを持ち越した人で分かれている。私はサテライト半分・コア継続。連休中はニュースだけ見て、月曜にルール実行。FOMOで追加買いはやらない。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['連休', '海の日', 'ポジション'],
    comments: [
      'コア継続、同じ。',
      'サテライト半分、やった。',
      '月曜ルール実行。',
      'FOMOやめ。',
      '現金多めで安心。',
      '議論ありがたい。',
      '持ち越し派です。',
    ],
  },
  {
    author: 6, postedAt: '2026-07-18T11:05:00+09:00', likeSlots: 4,
    title: '半導体バスケット — 連休中にチャートだけ見直すリスト',
    content: '285A・6857・8035・SKHY周りをウォッチリストに固定。ファンダより「週明けの値幅」想定。買い増しラインと損切りラインをメモ。決算週に入る銘柄もあるので、サイズは小さく。',
    ticker: '285A.T', sentiment: 'bearish', tags: ['半導体', 'ウォッチリスト', 'チャート'],
    comments: [
      'ラインメモした。',
      'サイズ小さく、同意。',
      '決算週注意。',
    ],
  },
  {
    author: 10, postedAt: '2026-07-18T12:20:00+09:00', likeSlots: 7,
    title: '昼ごはん議論 — 「健全な調整」派、まだ勝ち残ってる？',
    content: '17日の下落で「トレンド終了」派が増えたが、先物反発で健全調整派も息を吹き返している。私は中立：分割1回ルールは維持、全額突っ込みは禁止。連休明けの寄付きで再判定。',
    ticker: 'N225', sentiment: 'neutral', tags: ['議論', '調整', 'トレンド'],
    comments: [
      '中立、同じ。',
      '健全調整派です。',
      'トレンド終了派。',
      '寄付きで再判定。',
      '分割ルール大事。',
    ],
  },
  {
    author: 0, postedAt: '2026-07-18T13:40:00+09:00', likeSlots: 10,
    title: 'NISA成長枠 — 連休中に偏りチェックだけやる',
    content: 'やること：セクター偏り（半導体比率）を確認、コア（1306/2559）の積立継続確認。やらない：積立停止、レバ追加、SNSの今が底。連休はメンタルメンテの日。',
    ticker: '1306.T', sentiment: 'bullish', tags: ['NISA', '積立', 'メンタル'],
    comments: [
      '偏りチェックした。',
      '積立止めない。',
      'レバ触らない。',
      'メンタルメンテ、刺さる。',
      'コア確認済み。',
      '同じリスト。',
    ],
  },
  {
    author: 4, postedAt: '2026-07-18T14:55:00+09:00', likeSlots: 6,
    title: '銀行・商社 — 下げ日に粘ったセクターのメモ',
    content: '17日は8306・8058あたりが指数対比で粘った印象。AI一色からのローテ議論は続く。全部乗り換えはやりすぎだが、成長枠の偏り是正の材料にはなる。連休に比率だけ見直す。',
    ticker: '8306.T', sentiment: 'bullish', tags: ['銀行', '商社', 'セクターローテ'],
    comments: [
      '銀行粘った。',
      '偏り是正メモ。',
      '全部乗り換えはやりすぎ。',
      '比率見直す。',
    ],
  },
  {
    author: 9, postedAt: '2026-07-18T16:10:00+09:00', likeSlots: 8,
    title: '来週の材料カレンダー — 決算と海外イベントを先に書く',
    content: '連休明けは日米のAI・装置関連の決算が続きやすい週。材料前にサイズを膨らませない。カレンダーに「見ない日／触らない日」を先に書くとメンタルが楽。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['決算', '来週', 'カレンダー'],
    comments: [
      'カレンダー書いた。',
      '触らない日、いい。',
      'サイズ膨らませない。',
      '材料待ち。',
      '同意。',
    ],
  },
  {
    author: 2, postedAt: '2026-07-18T17:25:00+09:00', likeSlots: 5,
    title: 'ドル円と輸出株 — 連休中の為替ウォッチポイント',
    content: '円高が進むと輸出・半導体のEPS期待も下がりやすい。145円割れは心理線としてメモ。為替ヘッジなしの個別はサイズ確認。円建てコアは相対的に楽。',
    ticker: 'USDJPY', sentiment: 'bearish', tags: ['為替', 'ドル円', '円高'],
    comments: [
      '145割れ注意。',
      '円建てコア助かる。',
      'サイズ確認した。',
    ],
  },
  {
    author: 11, postedAt: '2026-07-18T18:40:00+09:00', likeSlots: 11,
    title: '夜の投票 — 週明け寄付き、買い派？様子見派？',
    content: '先物反発を見て「押し目買い」派と「騙し上げ警戒」派が割れている。私は様子見＋分割1回だけ。全額は連休明けの値動きを見てから。投票コメント歓迎。',
    ticker: 'N225', sentiment: 'neutral', tags: ['投票', '寄付き', '押し目'],
    comments: [
      '様子見派。',
      '押し目買い派。',
      '騙し上げ警戒。',
      '分割1回、同じ。',
      '全額はやらない。',
      '投票おもしろい。',
      '月曜まで待つ。',
      '先物だけ見る。',
    ],
  },
  {
    author: 5, postedAt: '2026-07-18T19:55:00+09:00', likeSlots: 4,
    title: 'ASML・TSMC — 海外装置の材料待ち、日本はどう動く',
    content: '海外ファウンドリ・装置の材料が出るまで、日本の連想売りは続きやすい。サテライトは半分で十分。コアETFは予定通り。連休中にニュースだけ拾う。',
    ticker: 'ASML', sentiment: 'bearish', tags: ['ASML', 'TSMC', '装置'],
    comments: [
      '半分で様子見。',
      'コアは積立。',
      '連想売り続きそう。',
    ],
  },
  {
    author: 7, postedAt: '2026-07-18T21:10:00+09:00', likeSlots: 9,
    title: '7/18夜まとめ — 連休中のルール再掲',
    content: 'やらない：積立停止、レバ、SNS飛び乗り。やる：現金比率メモ、コア継続、個別の損切り線確認。17日は過去級の下落、18日は先物が戻した。月曜はサイズだけ確認してから動く。お疲れさまでした。',
    ticker: 'TOPIC', sentiment: 'bullish', tags: ['連休', 'ルール', 'メンタル'],
    comments: [
      'ルール再掲ありがたい。',
      'お疲れさま。',
      '月曜サイズ確認。',
      '積立継続。',
      'レバ触らない。',
      '現金メモした。',
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
  let userId = await findUserIdByEmail(email)
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: `MmSeed!${persona.name.length}99`,
      email_confirm: true,
      user_metadata: { full_name: persona.name, display_name: persona.name, seed: SEED_MARKER },
    })
    if (error) throw error
    userId = data.user.id
    console.log(`  created user ${persona.name}`)
  }

  await admin.from('user_profiles').upsert({
    user_id: userId,
    nickname: persona.name,
    full_name: persona.name,
  }, { onConflict: 'user_id' })

  const level = persona.exp >= 6000 ? 5 : persona.exp >= 2500 ? 4 : persona.exp >= 900 ? 3 : persona.exp >= 300 ? 2 : 1
  await admin.from('lounge_character_stats').upsert({
    user_id: userId,
    total_exp: persona.exp,
    level,
    character_stage: level,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  return { userId, name: persona.name }
}

async function findSeedPostIds() {
  const ids = new Set()
  const times = POSTS.map((p) => new Date(p.postedAt).getTime()).filter(Number.isFinite)
  if (!times.length) return []
  const minAt = new Date(Math.min(...times) - 60_000).toISOString()
  const maxAt = new Date(Math.max(...times) + 60_000).toISOString()
  const authorEmails = new Set(POSTS.map((p) => PERSONAS[p.author]?.email).filter(Boolean))
  const authorIds = []
  for (const persona of PERSONAS) {
    if (!authorEmails.has(persona.email)) continue
    const id = await findUserIdByEmail(persona.email.toLowerCase())
    if (id) authorIds.push(id)
  }
  if (authorIds.length) {
    const { data: byWindow } = await admin
      .from('lounge_posts')
      .select('id')
      .in('author_id', authorIds)
      .gte('created_at', minAt)
      .lte('created_at', maxAt)
    for (const row of byWindow || []) ids.add(row.id)
  }
  return [...ids]
}

async function purgeExisting() {
  const seedIds = await findSeedPostIds()
  if (seedIds.length === 0) return
  if (DRY_RUN) {
    console.log(`  would remove ${seedIds.length} existing july18 posts`)
    return
  }
  await admin.from('lounge_comments').delete().in('post_id', seedIds)
  await admin.from('lounge_post_tags').delete().in('post_id', seedIds)
  await admin.from('lounge_post_likes').delete().in('post_id', seedIds)
  await admin.from('lounge_post_bookmarks').delete().in('post_id', seedIds)
  await admin.from('lounge_posts').delete().in('id', seedIds)
  console.log(`  removed ${seedIds.length} old july18 posts`)
}

async function main() {
  const existingIds = await findSeedPostIds()
  if (existingIds.length && !REPLACE) {
    console.log('July 18 seed already exists. Use --replace to rebuild.')
    return
  }

  console.log(DRY_RUN ? 'Dry run (July 18)…' : REPLACE ? 'Replace July 18 seed…' : 'Seeding July 18 posts…')
  if (REPLACE || existingIds.length) await purgeExisting()

  const personaMap = new Map()
  for (const persona of PERSONAS) {
    personaMap.set(persona.email, await ensurePersona(persona))
  }

  let posts = 0
  let comments = 0
  let likes = 0

  for (let i = 0; i < POSTS.length; i += 1) {
    const row = POSTS[i]
    const persona = PERSONAS[row.author]
    const mapped = personaMap.get(persona.email)
    if (!mapped) continue

    const createdAt = new Date(row.postedAt).toISOString()
    const commentTexts = row.comments || []
    const commentTotal = commentTexts.length
    const likeSlots = Math.min(
      PERSONAS.length - 1,
      Math.max(1, Number(row.likeSlots || 5)),
    )
    const hotScore = likeSlots * 2 + commentTotal * 3 + 40
    const content = String(row.content || '')

    const payload = {
      author_id: mapped.userId,
      author_name: mapped.name,
      title: row.title,
      content,
      ticker: row.ticker || null,
      asset_type: 'stock',
      sentiment: row.sentiment || 'neutral',
      like_count: likeSlots,
      comment_count: commentTotal,
      bookmark_count: Math.floor(likeSlots / 3),
      view_count: 0,
      hot_score: hotScore,
      status: 'published',
      created_at: createdAt,
      updated_at: createdAt,
    }

    if (DRY_RUN) {
      console.log(`[dry-run] ${row.postedAt} ${row.title} (+${commentTotal}c / ${likeSlots}♥)`)
      posts += 1
      comments += commentTotal
      likes += likeSlots
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
      const likeAt = new Date(new Date(row.postedAt).getTime() + (li + 1) * 7 * 60 * 1000).toISOString()
      await admin.from('lounge_post_likes').insert({
        post_id: post.id,
        user_id: likerMapped.userId,
        created_at: likeAt,
      })
    }

    for (let c = 0; c < commentTexts.length; c += 1) {
      const commentPersona = PERSONAS[(row.author + c + 2) % PERSONAS.length]
      const commentMapped = personaMap.get(commentPersona.email)
      if (!commentMapped) continue
      const commentAt = new Date(new Date(row.postedAt).getTime() + (c + 1) * 11 * 60 * 1000).toISOString()
      await admin.from('lounge_comments').insert({
        post_id: post.id,
        author_id: commentMapped.userId,
        author_name: commentMapped.name,
        content: commentTexts[c],
        status: 'published',
        created_at: commentAt,
        updated_at: commentAt,
      })
      comments += 1
    }

    posts += 1
    likes += likeSlots
  }

  console.log(`Done. ${posts} posts, ${comments} comments, ${likes} likes (2026-07-18 all-day).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
