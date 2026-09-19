/**
 * Seed community posts dated 2026-07-11 (JST) — weekend wrap / next-week setup.
 *
 *   node scripts/seed-community-july11-posts.mjs
 *   node scripts/seed-community-july11-posts.mjs --dry-run
 *   node scripts/seed-community-july11-posts.mjs --replace
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

const SEED_MARKER = 'mm-community-seed-july11-v1'

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

/** Posts on 2026-07-11 JST (土曜) */
const POSTS = [
  {
    author: 0, postedAt: '2026-07-11T07:22:00+09:00',
    title: '7/11土曜朝 — 今週の振り返り：SPCX一巡とメモリ底固め',
    content: '平日は①SPCXのNasdaq-100組入れ後の需給一巡 ②285A中心のメモリ調整→底固めが同時進行。週末はチャート整理とウォッチリスト削減の時間。来週は米指標＋ハイテク決算シーズン前夜で、ポジションは半分現金でもいい週かも。',
    ticker: 'N225', sentiment: 'neutral', tags: ['振り返り', 'SpaceX', 'Kioxia'],
    likes: 231,
    comments: [
      '激動の一週間でした。',
      '半分現金、堅実です。',
      '285Aは底値圏で様子見。',
      '週末のウォッチ整理、定番。',
      '来週もよろしくお願いします。',
    ],
  },
  {
    author: 3, postedAt: '2026-07-11T08:41:00+09:00',
    title: 'キオクシア(285A) — 週末のチャート確認、25日線は？',
    content: '平日の急落から戻りつつも、25日線奪還はまだ明確ではない印象。NAND単価上昇のファンダは残る一方、SOXの方向感が弱いと連想売り再燃しやすい。週末はサイズを決めてから月曜寄付きに備える派。',
    ticker: '285A.T', sentiment: 'neutral', tags: ['Kioxia', '285A', 'テクニカル'],
    likes: 187,
    comments: [
      '25日線奪還待ち。',
      'ファンダはまだ強い派。',
      'サイズ小さく、同意。',
      '月曜ギャップ注意。',
    ],
  },
  {
    author: 8, postedAt: '2026-07-11T09:55:00+09:00',
    title: 'SpaceX(SPCX) — 組入れ後の「退屈」が本番？',
    content: 'イベント通過後は出来高が落ち、値動きも小さくなりがち。指数入りのストーリーは終わったわけではなく、次はS&P500入りタイムラインとStarlink成長率。個人は「毎日見ない銘柄」に格下げしてもいい段階かも。',
    ticker: 'SPCX', sentiment: 'neutral', tags: ['SpaceX', 'SPCX', '指数'],
    likes: 164,
    comments: [
      'イベント後の閑散、典型。',
      'S&P500入りはまだ先。',
      '毎日見ない、いい判断。',
      'QQQ経由で間接保有。',
    ],
  },
  {
    author: 1, postedAt: '2026-07-11T11:08:00+09:00',
    title: 'NISA成長枠 — 週末に「コアETF」を見直す',
    content: 'ボラ週のあとこそ、1306・2559・1545などコアの比率を確認。サテライト（半導体・宇宙）は小さく、コアは積立継続。MoneyMartのETF比較で信託報酬と騰落を見比べてから、来月の積立額を決める。',
    ticker: '1306.T', sentiment: 'bullish', tags: ['NISA', 'ETF', '積立'],
    likes: 198,
    comments: [
      'コア＋サテライト、大事。',
      '1306は毎月固定。',
      '1545も定番ですね。',
      '信託報酬比較、便利。',
    ],
  },
  {
    author: 6, postedAt: '2026-07-11T12:33:00+09:00',
    title: 'ドル円155円台 — 為替を見ながら米国株比率を調整',
    content: '円安が続くと海外ETFの円換算リターンは追い風。ただし「円安＝買い増し」だけだと為替リスクが偏る。週末は米国株・国内株・現金の比率を紙に書いてみる。為替ヘッジ型か無ヘッジかも再確認。',
    ticker: 'USDJPY', sentiment: 'neutral', tags: ['為替', '円安', '資産配分'],
    likes: 142,
    comments: [
      '155円、慣れてきた。',
      '比率を紙に書く、いい習慣。',
      '無ヘッジ多めです。',
      '円安追い風、同意。',
    ],
  },
  {
    author: 10, postedAt: '2026-07-11T13:47:00+09:00',
    title: '高配当・商社 — 半導体調整の「受け皿」は続く？',
    content: 'メモリ調整週に三菱商事・三井物産・電力などが相対的に堅かった。セクターローテが続くなら、成長枠の一部を高配当に寄せるのもアリ。ただし金利・資源価格次第で商社も動くので、配当利回りだけで買わない。',
    ticker: '8058.T', sentiment: 'bullish', tags: ['高配当', '商社', 'セクター'],
    likes: 155,
    comments: [
      '商社シフト検討中。',
      '利回りだけで買わない、同意。',
      '電力も堅い。',
      'ローテ続くか見極め。',
    ],
  },
  {
    author: 4, postedAt: '2026-07-11T15:02:00+09:00',
    title: '来週の米ハイテク決算 — NVDA・META前にやること',
    content: '決算前は「予想ゲーム」よりリスク管理。①ポジションサイズ半減 ②ストップ幅を広げるか現金化 ③指数ETFで間接的に取る。sell the newsは先週のSamsungでも見た。ガイダンスが全て。',
    ticker: 'NVDA', sentiment: 'neutral', tags: ['決算', 'NVDA', 'AI'],
    likes: 212,
    comments: [
      'サイズ半減、やる。',
      'sell the news怖い。',
      '指数で間接、賢い。',
      'METAのcapexも注目。',
      'ガイダンス待ち。',
    ],
  },
  {
    author: 11, postedAt: '2026-07-11T16:18:00+09:00',
    title: 'ウォッチリスト削減チャレンジ — 30→8銘柄',
    content: 'イベント週でリストが膨れたので、週末に「来週本気で見る銘柄」だけ残す。候補：285A、SPCX、NVDA、SOX関連、1306、2559、8058、ドル円。追えない銘柄はアラートだけ。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['ウォッチリスト', '投資習慣'],
    likes: 176,
    comments: [
      '30→8、いい目標。',
      'アラートだけ残す、同意。',
      'リスト肥大化、あるある。',
      '8銘柄なら追える。',
    ],
  },
  {
    author: 2, postedAt: '2026-07-11T17:29:00+09:00',
    title: '配当カレンダー — 7月後半の入金予定をチェック',
    content: '週末は配当月の確認タイム。米国株は為替込みの手取りイメージ、日本株は税引後。NISA枠内なら非課税のありがたみを再確認。MoneyMartの配当カレンダーで「今月いくら入るか」を見てモチベ維持。',
    ticker: 'TOPIC', sentiment: 'bullish', tags: ['配当', 'カレンダー', 'NISA'],
    likes: 169,
    comments: [
      '配当確認、週末ルーティン。',
      'NISA非課税、最高。',
      '手取りイメージ大事。',
      'カレンダー便利。',
    ],
  },
  {
    author: 7, postedAt: '2026-07-11T18:41:00+09:00',
    title: 'Rocket Lab(RKLB) — 宇宙テーマは「見送り」か「少額」か',
    content: 'SPCX組入れ後、宇宙セクター全体の注目は続くが、個人のサテライト枠は限られる。RKLBはテーマとして面白いが、コア比率を崩してまで買う段階ではない。少額ウォッチ継続で十分。',
    ticker: 'RKLB', sentiment: 'neutral', tags: ['RocketLab', '宇宙', 'サテライト'],
    likes: 128,
    comments: [
      '少額ウォッチ、同意。',
      'コア崩さないのが正解。',
      'テーマ株はサイズ命。',
      'SPCX経由で十分かも。',
    ],
  },
  {
    author: 5, postedAt: '2026-07-11T19:56:00+09:00',
    title: '積立は止めない — 下落・イベント週のメンタルメモ',
    content: '画面を見すぎると「何かしたくなる」。積立設定済みなら週末は触らない。個別はサイズ管理、コアは自動化。これが一番リターンに効いてる気がする。',
    ticker: '2559.T', sentiment: 'bullish', tags: ['積立', 'メンタル', '長期投資'],
    likes: 205,
    comments: [
      '画面見すぎ問題、ある。',
      '触らない勇気。',
      '自動化最高。',
      '2559コツコツ。',
      '同意です。',
    ],
  },
  {
    author: 9, postedAt: '2026-07-11T21:08:00+09:00',
    title: 'コミュニティの議論が参考になる週末',
    content: '285Aファンダ派・利確派、SPCXイベント後派、NISAコア派…意見が分かれるのが健全。自分の時間軸に合うコメントだけ拾う。来週も短い投稿で情報交換しましょう。',
    ticker: 'TOPIC', sentiment: 'bullish', tags: ['コミュニティ', '投資哲学'],
    likes: 158,
    comments: [
      '意見が分かれるの健全。',
      '時間軸大事。',
      '来週もよろしく。',
      '短い投稿、読みやすい。',
    ],
  },
  {
    author: 0, postedAt: '2026-07-11T22:24:00+09:00',
    title: '7/11夜 — 来週の優先順位トップ3',
    content: '①米指標・ハイテク決算のカレンダー確認 ②285A/SOXの方向感 ③コアETF積立は予定通り実行。個別の新規買いは「見送り」がデフォルト。イベント多い週は守りが攻め。',
    ticker: 'N225', sentiment: 'neutral', tags: ['来週', '戦略', 'リスク管理'],
    likes: 219,
    comments: [
      '守りが攻め、名言。',
      '新規見送りデフォルト、いい。',
      'カレンダー確認から。',
      '積立は予定通り。',
      '来週も頑張りましょう。',
    ],
  },
  {
    author: 3, postedAt: '2026-07-11T23:11:00+09:00',
    title: '日曜に備えて — 月曜の寄付きシナリオを2つだけ書く',
    content: 'シナリオA：米先物堅調→日経小高い、半導体買い戻し。シナリオB：利確続き→285A再安。どちらでも「自分のルール」だけ決めておく。予想当てより損切り/利確の線引き。おやすみ。',
    ticker: '285A.T', sentiment: 'neutral', tags: ['シナリオ', '月曜', 'ルール'],
    likes: 147,
    comments: [
      'シナリオ2つ、ちょうどいい。',
      '線引き大事。',
      'おやすみなさい。',
      '月曜頑張ります。',
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
    console.log(`  would remove ${seedIds.length} existing july11 posts`)
    return
  }
  await admin.from('lounge_comments').delete().in('post_id', seedIds)
  await admin.from('lounge_post_tags').delete().in('post_id', seedIds)
  await admin.from('lounge_post_likes').delete().in('post_id', seedIds)
  await admin.from('lounge_post_bookmarks').delete().in('post_id', seedIds)
  await admin.from('lounge_posts').delete().in('id', seedIds)
  console.log(`  removed ${seedIds.length} old july11 posts`)
}

async function main() {
  const existingIds = await findSeedPostIds()
  if (existingIds.length && !REPLACE) {
    console.log('July 11 seed already exists. Use --replace to rebuild.')
    return
  }

  console.log(DRY_RUN ? 'Dry run (July 11 posts)…' : REPLACE ? 'Replace July 11 seed…' : 'Seeding July 11 posts…')
  if (REPLACE || existingIds.length) await purgeExisting()

  const personaMap = new Map()
  for (const persona of PERSONAS) {
    personaMap.set(persona.email, await ensurePersona(persona))
  }

  let posts = 0
  let comments = 0

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
      console.log(`[dry-run] ${row.postedAt} ${row.title} (+${commentTotal} comments)`)
      posts += 1
      comments += commentTotal
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

    const baseMs = new Date(row.postedAt).getTime()
    for (let c = 0; c < commentTexts.length; c += 1) {
      const commentAuthor = PERSONAS[(row.author + c + 1) % PERSONAS.length]
      const commentMapped = personaMap.get(commentAuthor.email)
      if (!commentMapped) continue
      const commentAt = new Date(baseMs + (c + 1) * 5 * 60000 + c * 75000).toISOString()
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
  }

  console.log(`Done. ${posts} posts, ${comments} comments (2026-07-11 JST).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
