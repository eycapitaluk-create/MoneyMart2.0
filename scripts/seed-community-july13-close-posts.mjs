/**
 * Seed extra community posts for 2026-07-13 evening (closing wrap) —
 * Nikkei -1315, KOSPI CB, SK hynix dump, MUJI rally, Yaskawa limit-down.
 *
 *   node scripts/seed-community-july13-close-posts.mjs
 *   node scripts/seed-community-july13-close-posts.mjs --dry-run
 *   node scripts/seed-community-july13-close-posts.mjs --replace
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

const SEED_MARKER = 'mm-community-seed-july13-close-v1'

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

/** Closing / late-day posts — uneven likes & comment counts */
const POSTS = [
  {
    author: 3, postedAt: '2026-07-13T15:05:00+09:00',
    title: '大引け — 日経1315円安の67242円、半導体が指数を押し下げ',
    content: '終値イメージで日経は約1.9%安。一時1900円超安まで振れたあと戻したが重い。韓国急落とAI過熱感の巻き戻しが主因との解説が多い。個人は寄付きギャップの再現を恐れず、サイズと損切り線だけ確認。',
    ticker: 'N225', sentiment: 'bearish', tags: ['日経平均', '大引け', '半導体'],
    likes: 188,
    comments: [
      '1315円安、体感重い。',
      '一時1900円安は怖かった。',
      'サイズ確認しました。',
      '明日もボラ警戒。',
      '積立は触らない。',
      '現金比率メモった。',
    ],
  },
  {
    author: 8, postedAt: '2026-07-13T15:22:00+09:00',
    title: '韓国KOSPIサーキットブレーカー — ハイニクス売りが震源',
    content: 'KOSPIが一時8〜9%安で取引制限。SKハイニックスのナスダック上場後の利確＋AI過熱懸念が重なった形。日本のメモリ・装置も連れ安しやすい局面。連想売りは「翌日も同じ」とは限らないが、今日は無理しない。',
    ticker: 'SKHY', sentiment: 'bearish', tags: ['韓国株', 'サーキットブレーカー', 'ハイニクス'],
    likes: 241,
    comments: [
      'CB発動まで、異常値。',
      'ナスダック上場後の利確か。',
      '日本も逃げ場なし感。',
      '無理しない、同意。',
      'ウォッチだけ。',
      'メモリはまだボラ高そう。',
      '明日の寄付き注意。',
      '現金多めで様子見。',
    ],
  },
  {
    author: 1, postedAt: '2026-07-13T15:48:00+09:00',
    title: 'キオクシア・東エレク・アドテスト — 後場一段安の寄与',
    content: '後場はAI・半導体バスケットがさらに重い。285A・8035・6857あたりが指数押し下げ寄与の上位に。ファンダより需給の日。成長枠の主力にするなら、こういう日のメンタルルールを先に決めておく。',
    ticker: '285A.T', sentiment: 'bearish', tags: ['キオクシア', '東エレク', 'アドバンテスト'],
    likes: 97,
    comments: [
      '寄与度トップ級、重い。',
      '需給の日、わかる。',
      'メンタルルール大事。',
    ],
  },
  {
    author: 11, postedAt: '2026-07-13T16:12:00+09:00',
    title: '良品計画が急騰 — 下げ相場でも好決算は別物色',
    content: '通期見通し上方修正で良品計画が大幅高の報道。半導体一色の日に「決算のある世界」を思い出させる。下げ相場ほど、個別カタリストがある銘柄は相対的に目立つ。NISAでもセクター偏りチェックの材料。',
    ticker: '7453.T', sentiment: 'bullish', tags: ['良品計画', '決算', '物色'],
    likes: 132,
    comments: [
      '好決算は別物色、同意。',
      '半導体以外に目が行く。',
      '偏りチェックします。',
      'こういう日の支え銘柄。',
    ],
  },
  {
    author: 6, postedAt: '2026-07-13T16:35:00+09:00',
    title: '安川電機ストップ安 — 決算嫌気は個別リスクの教科書',
    content: '安川がストップ安気配で引けたとの報道。指数全体の半導体売りとは別に、個別決算ショックは別レイヤー。レバや信用でサイズを膨らませている人は今日の教訓。現金＋現物の方が眠れる。',
    ticker: '6506.T', sentiment: 'bearish', tags: ['安川電機', '決算', '個別リスク'],
    likes: 76,
    comments: [
      'ストップ安は痛い。',
      '個別リスクの教科書。',
      '信用は怖い。',
    ],
  },
  {
    author: 4, postedAt: '2026-07-13T17:05:00+09:00',
    title: 'メガバンクに資金流入 — AI疲れからのローテ？',
    content: '半導体から金融へマネーが流れる解説が多い。金利ある世界＋バリュエーション見直しのセット。8306など銀行を薄く持つ派には相対的に楽な日。ただし金利は両刃なので「全部乗り換え」はやりすぎ。',
    ticker: '8306.T', sentiment: 'bullish', tags: ['銀行', '三菱UFJ', 'セクターローテ'],
    likes: 155,
    comments: [
      'ローテ日っぽい。',
      '全部乗り換えはやりすぎ、同意。',
      '銀行薄く持ってて助かった。',
      '金利両刃、メモ。',
      'NISAで金融少し増やす。',
    ],
  },
  {
    author: 0, postedAt: '2026-07-13T17:40:00+09:00',
    title: 'ASML・TSMC決算前 — ポジション軽くする動きの匂い',
    content: '海外装置・ファウンドリの決算を控えて軽くする売り、との指摘。材料が出る前に日本関連が先行して売られるのはよくある。結果が出るまでサテライトは半分でも遅くない。コアETFは予定通り。',
    ticker: 'ASML', sentiment: 'neutral', tags: ['決算', 'ASML', 'ポジション'],
    likes: 64,
    comments: [
      '先行売り、あるある。',
      '半分で様子見。',
    ],
  },
  {
    author: 9, postedAt: '2026-07-13T18:18:00+09:00',
    title: 'NISA成長枠 — 下げ日に「やること／やらないこと」再掲',
    content: 'やらない：積立停止、レバ追加、SNSの今が底飛び乗り。やる：現金比率メモ、コア（1306/2559）継続、個別は損切り線だけ。長期では今日の下落より「続けた月数」。',
    ticker: '1306.T', sentiment: 'bullish', tags: ['NISA', '積立', 'メンタル'],
    likes: 219,
    comments: [
      '続けた月数、刺さる。',
      '積立止めない。',
      'レバ触らない。',
      '現金メモした。',
      '同じリスト使ってます。',
      '今日は触らない日。',
      'コアだけ見る。',
    ],
  },
  {
    author: 2, postedAt: '2026-07-13T19:05:00+09:00',
    title: '中東・原油高の残像 — グロースに冷水の構図は続くか',
    content: '地政学と原油が意識されると金利観測も動きやすい。半導体の需給とは別軸の逆風。ヒートマップで「電気機器以外に何が買われたか」を見るとローテの手がかりになる。',
    ticker: 'TOPIC', sentiment: 'bearish', tags: ['中東', '原油', '金利'],
    likes: 41,
    comments: [
      'ヒートマップ見る派。',
    ],
  },
  {
    author: 10, postedAt: '2026-07-13T19:42:00+09:00',
    title: '新規ニッセイETF — ラッセル2000(600A)上場直後の値動き',
    content: '600Aは上場直後で流動性はまだ薄い。米国小型株エクスポージャを円建てで取りたい人向けだが、今日みたいなリスクオフ日は値幅も荒い。まずは少額ウォッチ、信託報酬0.432%も確認してから。',
    ticker: '600A.T', sentiment: 'neutral', tags: ['ニッセイ', 'ラッセル2000', 'ETF'],
    likes: 58,
    comments: [
      '流動性薄いの注意。',
      '少額ウォッチから。',
      '信託報酬メモ。',
    ],
  },
  {
    author: 7, postedAt: '2026-07-13T20:20:00+09:00',
    title: '426A（S&P500イコールウェイト） — 時価加重疲れの代替？',
    content: '巨大テック偏重が気になる人向けのイコールウェイト。今日のようなメガテック売り日は相対感が変わることも。ただし為替ヘッジなしなので円高局面は別リスク。成長枠候補として名前だけリストに入れた。',
    ticker: '426A.T', sentiment: 'neutral', tags: ['ニッセイ', 'S&P500', 'イコールウェイト'],
    likes: 83,
    comments: [
      '偏重疲れ、わかる。',
      '為替ヘッジなし注意。',
      'リストに入れます。',
      '今日は相対感どうだった？',
    ],
  },
  {
    author: 5, postedAt: '2026-07-13T21:08:00+09:00',
    title: 'プライム売買代金が厚い日 — 「売られた量」も情報',
    content: '下げ日でも売買代金が厚いと、単なる閑散安ではない。ポジション調整の痕跡。翌日ギャップだけ見て飛びつくより、自分のルール（損切り・積立）を優先。コミュニティの意見は参考まで。',
    ticker: 'N225', sentiment: 'neutral', tags: ['売買代金', '需給', 'ルール'],
    likes: 29,
    comments: [],
  },
  {
    author: 0, postedAt: '2026-07-13T21:55:00+09:00',
    title: '夜の振り返り — 下げ相場で守れたこと',
    content: '守れた：積立継続、ナンピンしない、レバ触らない。守れなかった：チャートを開きすぎた。明日は決算カレンダーだけ見て、あとは淡々と。おやすみ。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['振り返り', 'リスク管理'],
    likes: 167,
    comments: [
      'チャート開きすぎ、ある。',
      '守れたことリストいい。',
      'おやすみ。',
      'また明日淡々と。',
      'ナンピン我慢えらい。',
    ],
  },
  {
    author: 8, postedAt: '2026-07-13T22:40:00+09:00',
    title: '明日の主役は？ — 地政学か、半導体決算前の需給か',
    content: '短期は地政学と原油、中期は海外半導体ガイダンス。個人は両方「見に行く」だけで十分。NISAは淡々、サテライトは小さく。自分のルールが一番のエッジ。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['明日', '地政学', '半導体'],
    likes: 91,
    comments: [
      '見に行くだけ、いい。',
      'ルールがエッジ。',
      'サテライト小さく。',
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
  const { data: byContent } = await admin
    .from('lounge_posts')
    .select('id')
    .ilike('content', `%${SEED_MARKER}%`)
  for (const row of byContent || []) ids.add(row.id)

  // Fallback: seed personas within this batch's postedAt window
  const times = POSTS.map((p) => new Date(p.postedAt).getTime()).filter(Number.isFinite)
  if (times.length) {
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
  }
  return [...ids]
}

async function purgeExisting() {
  const seedIds = await findSeedPostIds()
  if (seedIds.length === 0) return
  if (DRY_RUN) {
    console.log(`  would remove ${seedIds.length} existing close posts`)
    return
  }
  await admin.from('lounge_comments').delete().in('post_id', seedIds)
  await admin.from('lounge_post_tags').delete().in('post_id', seedIds)
  await admin.from('lounge_post_likes').delete().in('post_id', seedIds)
  await admin.from('lounge_post_bookmarks').delete().in('post_id', seedIds)
  await admin.from('lounge_posts').delete().in('id', seedIds)
  console.log(`  removed ${seedIds.length} old close posts`)
}

async function main() {
  const existingIds = await findSeedPostIds()
  if (existingIds.length && !REPLACE) {
    console.log('July 13 close seed already exists. Use --replace to rebuild.')
    return
  }

  console.log(DRY_RUN ? 'Dry run (July 13 close)…' : REPLACE ? 'Replace July 13 close seed…' : 'Seeding July 13 close posts…')
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
    const hotScore = row.likes * 2 + commentTotal * 3 + 40
    const content = String(row.content || '')

    const payload = {
      author_id: mapped.userId,
      author_name: mapped.name,
      title: row.title,
      content,
      ticker: row.ticker || null,
      asset_type: 'stock',
      sentiment: row.sentiment || 'neutral',
      like_count: row.likes,
      comment_count: commentTotal,
      bookmark_count: Math.floor(row.likes / 12),
      view_count: row.likes * 14 + commentTotal * 35,
      hot_score: hotScore,
      status: 'published',
      created_at: createdAt,
      updated_at: createdAt,
    }

    if (DRY_RUN) {
      console.log(`[dry-run] ${row.postedAt} ${row.title} (+${commentTotal}c / ${row.likes}♥)`)
      posts += 1
      comments += commentTotal
      likes += row.likes
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

    const likeSlots = Math.min(
      PERSONAS.length - 1,
      Math.max(0, Math.min(row.likes, 4 + (row.likes % 8))),
    )
    for (let li = 0; li < likeSlots; li += 1) {
      const liker = PERSONAS[(row.author + li + 1) % PERSONAS.length]
      const likerMapped = personaMap.get(liker.email)
      if (!likerMapped || likerMapped.userId === mapped.userId) continue
      await admin.from('lounge_post_likes').upsert({
        post_id: post.id,
        user_id: likerMapped.userId,
      }, { onConflict: 'post_id,user_id' })
    }

    const baseMs = new Date(row.postedAt).getTime()
    for (let c = 0; c < commentTexts.length; c += 1) {
      const commentAuthor = PERSONAS[(row.author + c + 1) % PERSONAS.length]
      const commentMapped = personaMap.get(commentAuthor.email)
      if (!commentMapped) continue
      const commentAt = new Date(baseMs + (c + 1) * 4 * 60000 + c * 90000).toISOString()
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
    likes += row.likes
  }

  console.log(`Done. ${posts} posts, ${comments} comments, ${likes} like_count total (2026-07-13 close).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
