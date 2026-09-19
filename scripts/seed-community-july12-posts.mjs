/**
 * Seed community posts dated 2026-07-12 (JST) — NISA, weekend news, next-week setup.
 *
 *   node scripts/seed-community-july12-posts.mjs
 *   node scripts/seed-community-july12-posts.mjs --dry-run
 *   node scripts/seed-community-july12-posts.mjs --replace
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

const SEED_MARKER = 'mm-community-seed-july12-v1'

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

/** Posts on 2026-07-12 JST (日曜) — likes/comments intentionally uneven */
const POSTS = [
  {
    author: 1, postedAt: '2026-07-12T07:35:00+09:00',
    title: '日曜朝 — 新NISA成長枠、7月の積立配分を見直した',
    content: '成長枠は毎月コツコツ。コアは1306(TOPIX連動)と2559(S&P500)、サテライトに1545(NASDAQ100)を薄く。先週の半導体ボラを見て「サテライト比率を上げすぎない」と再確認。信託報酬と騰落はMoneyMartのETF比較でチェックしてから決定。',
    ticker: '1306.T', sentiment: 'bullish', tags: ['NISA', 'ETF', '積立'],
    likes: 87,
    comments: [
      'コア＋サテライト、いい配分です。',
      '1306と2559の二本柱、定番。',
      '1545は薄く、同意。',
    ],
  },
  {
    author: 4, postedAt: '2026-07-12T08:48:00+09:00',
    title: '新NISAつみたて投資枠 — 「何を買うか」より「止めない」が本題',
    content: 'つみたて枠は全世界or米国の低コストETFで十分、という結論にまた戻った。銘柄選びに時間を使いすぎると続かない。設定したら日曜は確認だけ、売買はしない。メンタルが一番のリターン要因。',
    ticker: '2559.T', sentiment: 'bullish', tags: ['NISA', 'つみたて', '長期投資'],
    likes: 214,
    comments: [
      '止めないが本題、名言。',
      '銘柄選び沼、あるある。',
      '日曜は確認だけ、いいルール。',
      '低コストETFで十分、同意。',
      '積立設定したあと触らない、やってます。',
      'メンタルがリターン、本当それ。',
    ],
  },
  {
    author: 8, postedAt: '2026-07-12T10:02:00+09:00',
    title: '週末ニュースまとめ — SPCX組入れ後・メモリ・米指標前',
    content: '今週のヘッドライン再整理：①SpaceX(SPCX)のNasdaq-100組入れ後は需給一巡 ②キオクシア(285A)などメモリは急落後の底固め ③来週は米指標＋ハイテク決算シーズン前夜。個人は「イベント週＝新規買い見送り」が無難かも。',
    ticker: 'N225', sentiment: 'neutral', tags: ['ニュース', 'SpaceX', '半導体'],
    likes: 41,
    comments: [
      'まとめ分かりやすい。',
    ],
  },
  {
    author: 2, postedAt: '2026-07-12T11:15:00+09:00',
    title: '配当重視のNISA — 成長枠で高配当を混ぜる是非',
    content: '成長枠＝成長株、という固定観念を少し崩して、商社・高配当ETFを薄く入れる案。トータルリターンとキャッシュフローのバランス。配当カレンダーで「入金の見える化」があると続けやすい。税率ゼロのNISA枠内ならなおさら。',
    ticker: '8058.T', sentiment: 'bullish', tags: ['NISA', '配当', '高配当'],
    likes: 63,
    comments: [
      '高配当を薄く、いいですね。',
      '入金の見える化、モチベになる。',
    ],
  },
  {
    author: 10, postedAt: '2026-07-12T12:28:00+09:00',
    title: '円安155円台 — NISAの海外ETFは「為替込み」で見る',
    content: '2559や1545は円安局面で円換算リターンが押し上げられやすい。ただし円高局面では逆。週末は「為替を理由に売買しない」ルールを再確認。比率調整は年1〜2回で十分。',
    ticker: 'USDJPY', sentiment: 'neutral', tags: ['為替', 'NISA', '海外ETF'],
    likes: 29,
    comments: [],
  },
  {
    author: 6, postedAt: '2026-07-12T13:40:00+09:00',
    title: 'キオクシア285A — ニュース後の「保有継続？」アンケート気分',
    content: 'NAND単価上昇のファンダは残る一方、ボラが高くNISA成長枠の主力には向かない、という意見が先週多かった。自分は特定口座で小さく、NISAは指数ETFに寄せる方針に変更。テーマ株と制度口座は分けた方が眠れる。',
    ticker: '285A.T', sentiment: 'neutral', tags: ['Kioxia', '285A', 'NISA'],
    likes: 118,
    comments: [
      'NISAは指数、特定でテーマ、いい分け方。',
      '眠れるが一番。',
      '285Aはサイズ小さく。',
      '成長枠の主力には向かない、同意。',
      '同じ方針に変えました。',
    ],
  },
  {
    author: 0, postedAt: '2026-07-12T14:55:00+09:00',
    title: 'Fear&Greedとヒートマップ — 日曜の気分チェック',
    content: '市場の温度感を数字で見る癖をつける。Fear&Greedが極端なときほど「逆張りしたくなる自分」に注意。ヒートマップでセクターの偏りを確認してから、月曜のウォッチリストを確定。感覚より画面の色。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['FearGreed', 'ヒートマップ', '市場'],
    likes: 52,
    comments: [
      '画面の色、わかりみ。',
      '逆張り衝動、あるある。',
    ],
  },
  {
    author: 11, postedAt: '2026-07-12T16:08:00+09:00',
    title: '来週の米ハイテク決算 — NISA勢はどう構える？',
    content: 'NVDA・METAなど決算が近いと個別は揺れるが、NISAの指数積立は予定通りでOK、が基本。個別で乗せるならサイズ半減＋現金多め。sell the newsは先週のメモリでも見た。ガイダンス待ちモード。',
    ticker: 'NVDA', sentiment: 'neutral', tags: ['決算', 'NVDA', 'NISA'],
    likes: 176,
    comments: [
      '積立は予定通り、同意。',
      '個別は半減。',
      'sell the news怖い。',
      'ガイダンスが全て。',
      'METAも注目。',
      '現金多めにしました。',
      'NISA触らない、正解。',
    ],
  },
  {
    author: 5, postedAt: '2026-07-12T17:21:00+09:00',
    title: '配当カレンダー確認 — 7月後半の入金予定',
    content: '日曜ルーティン：配当カレンダーで今月の入金見込みを見る。米国株は為替込みの手取りイメージ、日本株は税引後。NISA枠内は非課税のありがたみを再確認。数字が見えると積立も続けやすい。',
    ticker: 'TOPIC', sentiment: 'bullish', tags: ['配当', 'カレンダー', 'NISA'],
    likes: 38,
    comments: [
      '日曜ルーティン、いい。',
    ],
  },
  {
    author: 9, postedAt: '2026-07-12T18:34:00+09:00',
    title: 'ETF比較メモ — 1306 vs 1545、コストと値動き',
    content: '国内型と海外テック寄りを並べて信託報酬・騰落を比較。1545はリターン期待もボラ大、1306は分散。NISA成長枠の「攻めすぎ防止」に比較画面が効く。結論は両方持つが比率は1306寄り。',
    ticker: '1545.T', sentiment: 'neutral', tags: ['ETF比較', 'NISA', '1306'],
    likes: 94,
    comments: [
      '1306寄り、堅実。',
      '1545はボラ大、わかる。',
      '比較してから決める、正解。',
    ],
  },
  {
    author: 3, postedAt: '2026-07-12T19:47:00+09:00',
    title: '保有の見える化 — 3Dポートフォリオで週末チェック',
    content: '銘柄が増えると偏りに気づきにくい。週末にポートフォリオを俯瞰して、半導体比率・海外比率・現金比率を確認。偏っていたら来月の積立でゆっくり直す。一気に売り買いしない。',
    ticker: 'TOPIC', sentiment: 'bullish', tags: ['ポートフォリオ', 'リバランス', 'NISA'],
    likes: 19,
    comments: [
      '俯瞰大事。',
    ],
  },
  {
    author: 7, postedAt: '2026-07-12T20:59:00+09:00',
    title: 'コミュニティ質問 — NISA成長枠、今月何を積みました？',
    content: '情報交換したいです。自分は1306と2559を固定、余力があれば高配当を薄く。テーマ株は特定口座のみ。みんなの今月の積立メニュー教えてください（銘柄だけでOK）。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['NISA', 'コミュニティ', '積立'],
    likes: 143,
    comments: [
      '2559のみです。',
      '1306＋1545薄く。',
      '高配当も少し混ぜてます。',
      'テーマは特定のみ、同じ。',
      '情報交換ありがたい。',
      '自分も1306固定。',
      '今月は現金多めで様子見。',
      '1545だけ追加しました。',
    ],
  },
  {
    author: 1, postedAt: '2026-07-12T22:12:00+09:00',
    title: '7/12夜 — 月曜に向けたチェックリスト',
    content: '①NISA積立設定は触らない ②ウォッチは8銘柄以内 ③決算・指標カレンダー確認 ④現金比率の下限を決める。日曜の仕事は「ルールの再確認」まで。予想当てはしない。おやすみ。',
    ticker: 'N225', sentiment: 'neutral', tags: ['月曜', 'チェックリスト', 'リスク管理'],
    likes: 71,
    comments: [
      'チェックリストいい。',
      'おやすみなさい。',
    ],
  },
  {
    author: 8, postedAt: '2026-07-12T23:05:00+09:00',
    title: '最後に一言 — ニュースに振り回されないNISA術',
    content: 'ヘッドラインは毎週ある。枠の上限と積立日だけ守れば、長期ではニュースよりコストと継続が効く。MoneyMartは比較・配当・ヒートマップで「確認」用、売買ボタンは証券アプリで。役割分担が大事。',
    ticker: 'TOPIC', sentiment: 'bullish', tags: ['NISA', '長期投資', 'ニュース'],
    likes: 58,
    comments: [
      '継続が効く、同意。',
      '役割分担、賢い。',
      '今週もありがとうございました。',
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
    console.log(`  would remove ${seedIds.length} existing july12 posts`)
    return
  }
  await admin.from('lounge_comments').delete().in('post_id', seedIds)
  await admin.from('lounge_post_tags').delete().in('post_id', seedIds)
  await admin.from('lounge_post_likes').delete().in('post_id', seedIds)
  await admin.from('lounge_post_bookmarks').delete().in('post_id', seedIds)
  await admin.from('lounge_posts').delete().in('id', seedIds)
  console.log(`  removed ${seedIds.length} old july12 posts`)
}

async function main() {
  const existingIds = await findSeedPostIds()
  if (existingIds.length && !REPLACE) {
    console.log('July 12 seed already exists. Use --replace to rebuild.')
    return
  }

  console.log(DRY_RUN ? 'Dry run (July 12 posts)…' : REPLACE ? 'Replace July 12 seed…' : 'Seeding July 12 posts…')
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

    // Actual likes from other personas (capped by roster; like_count may be higher for display)
    const likeSlots = Math.min(
      PERSONAS.length - 1,
      Math.max(0, Math.min(row.likes, 3 + (row.likes % 7))),
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

  console.log(`Done. ${posts} posts, ${comments} comments (2026-07-12 JST).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
