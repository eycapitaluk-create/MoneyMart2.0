/**
 * Seed community posts dated 2026-07-09 / 07-10 (JST) — post-SPCX inclusion, memory rebound, week wrap.
 *
 *   node scripts/seed-community-july9-10-posts.mjs
 *   node scripts/seed-community-july9-10-posts.mjs --dry-run
 *   node scripts/seed-community-july9-10-posts.mjs --replace
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

const SEED_MARKER = 'mm-community-seed-july910-v1'

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

/** Posts on 2026-07-09 / 07-10 JST */
const POSTS = [
  // ── 7/9 ──
  {
    author: 4, postedAt: '2026-07-09T07:18:00+09:00',
    title: '7/9朝 — SPCX組入れから2営業日、QQQは落ち着いた？',
    content: 'Nasdaq-100組入れ(7/7)から2日。SPCXは組入れ前後のギャップと出来高ピークを経て、パッシブ流入の「初日効果」は一巡した感。QQQ自体は小幅推移で、指数全体を牽引するほどの需給インパクトは限定的だった派。次の関心はS&P500入りまでの時間軸。',
    ticker: 'SPCX', sentiment: 'neutral', tags: ['SpaceX', 'QQQ', 'Nasdaq100'],
    likes: 198,
    comments: [
      '組入れ前に買って利確、典型パターンでした。',
      'QQQは意外と静かだった。',
      'S&P500入りまでまだ先ですね。',
      '出来高は確かに異常でした。',
    ],
  },
  {
    author: 1, postedAt: '2026-07-09T09:02:00+09:00',
    title: 'キオクシア(285A) — 急落後の底固め、25日線は奪還できた？',
    content: '7/6の-12%超から数日経過。285Aは底値圏で出来高を伴いながら揉み合い。NAND契約単価の上昇トレンドは変わらず、テクニカルだけ見ると25日線奪還が次の分岐。ただしSOXの方向感が弱いと連想売りは再燃しやすい。サイズは小さく、様子見継続。',
    ticker: '285A.T', sentiment: 'neutral', tags: ['Kioxia', '285A', '半導体'],
    likes: 176,
    comments: [
      '25日線奪還待ち派です。',
      'SOXが戻れば285Aも連動しそう。',
      '底値拾いは半分だけ入れた。',
      'ボラ高すぎて積立派は静観。',
    ],
  },
  {
    author: 8, postedAt: '2026-07-09T10:44:00+09:00',
    title: '米SOXが3日ぶり反発 — メモリセクターに一服感',
    content: 'フィラデルフィア半導体指数(SOX)が前日比+2%台で反発。MU・SNDKも底から戻り、日本の285A・8035も寄り付き後に買い戻し。ただし「戻り売り」か「トレンド再開」かはまだ不明。AI capexの実需データが次のカタリスト。',
    ticker: 'SOX', sentiment: 'bullish', tags: ['SOX', '半導体', 'メモリ'],
    likes: 154,
    comments: [
      '3日ぶりのプラス、一息。',
      '戻り売り警戒。',
      '285Aも連動で少し戻った。',
      'AI capexの数字待ち。',
    ],
  },
  {
    author: 6, postedAt: '2026-07-09T12:31:00+09:00',
    title: '円安155円台 — 輸出株プラス、内需は様子見',
    content: 'ドル円が155円台前半。トヨタ・ソニーGなど輸出大手は為替追い風だが、285Aのようなグローバル半導体はドル建て売上メリットと株価のセクター要因が混在。個人は「円安＝株高」と単純化せず、セクターで見るのが正解。',
    ticker: 'USDJPY', sentiment: 'neutral', tags: ['為替', '円安', '輸出株'],
    likes: 128,
    comments: [
      '155円、もう慣れてきた。',
      '輸出と半導体は別物ですね。',
      '円安で海外ETF買い増し派。',
      '内需は様子見、同意。',
    ],
  },
  {
    author: 10, postedAt: '2026-07-09T14:08:00+09:00',
    title: 'NISA成長枠 — 7月は半導体ETFと高配当の二極化',
    content: '年初来のNISA資金はハイテク集中とディフェンシブ分散が混在。1306(TOPIX)・2559(S&P500)は定番だが、半導体調整後にSOX連動ETFを拾う声も。個人的には「コアは指数、サテライトはセクター」でボラを抑える。',
    ticker: '1306.T', sentiment: 'neutral', tags: ['NISA', 'ETF', '積立'],
    likes: 142,
    comments: [
      '1306は毎月コツコツ。',
      '半導体ETFは調整後に少し追加。',
      'コア＋サテライト、いいですね。',
      '2559も定番ですね。',
    ],
  },
  {
    author: 3, postedAt: '2026-07-09T16:22:00+09:00',
    title: '7/9大引け — 日経は小幅高、半導体は個別物色',
    content: '日経225は+0.4%程度で小幅高。285Aは前日比プラス圏で引け、セクター全体の地合いは改善。一方SPCXは米時間で小幅調整。イベント週明けの「平常運転」に戻りつつある。週末前はポジションを絞る派が多い。',
    ticker: 'N225', sentiment: 'bullish', tags: ['日経平均', '大引け'],
    likes: 115,
    comments: [
      '平常運転に戻ってきた感じ。',
      '週末前は様子見。',
      '285Aプラス引け、安心。',
      'SPCXは米で見ます。',
    ],
  },
  {
    author: 11, postedAt: '2026-07-09T19:47:00+09:00',
    title: 'Rocket Lab(RKLB) — SPCX組入れ後の宇宙セクター資金の行方',
    content: 'SPCXが指数入りで宇宙テーマは継続注目。RKLBは小型ロケット＋宇宙アプリで差別化。SPCXのパッシブ買いが一巡した今、「第2梯队」への資金シフトがあるかが焦点。ボラは高いがテーマ株としてウォッチ継続。',
    ticker: 'RKLB', sentiment: 'bullish', tags: ['RocketLab', '宇宙', 'SPCX'],
    likes: 131,
    comments: [
      'RKLBはSPCXとは別ポジション。',
      '第2梯队、まだ不透明。',
      'テーマ株としてウォッチ中。',
      'ボラ高いのでサイズ小さく。',
    ],
  },
  {
    author: 0, postedAt: '2026-07-09T21:33:00+09:00',
    title: '7/9夜 — 米雇用統計前の様子見ムード',
    content: '翌週の米雇用・物価系指標を控え、ハイテクは利確と新規買いが拮抗。VIXは低位安定でパニックはなし。個人は「イベント前に現金比率を上げる」か「指数積立は無視」の二択。どちらも正解、時間軸の問題。',
    ticker: 'VIX', sentiment: 'neutral', tags: ['米国株', '雇用統計', 'マクロ'],
    likes: 108,
    comments: [
      '雇用統計前は様子見。',
      'VIX低位、落ち着いてる。',
      '積立は無視派です。',
      '現金比率上げました。',
    ],
  },

  // ── 7/10 ──
  {
    author: 9, postedAt: '2026-07-10T07:05:00+09:00',
    title: '7/10朝 — 週の振り返り：SPCX入りとメモリ調整の同時進行',
    content: '今週のテーマは①SPCXのNasdaq-100組入れとその後の需給一巡 ②285Aを中心としたメモリ調整と底固め。両方同時に起きた週で、分散の重要性を再認識。来週は米指標と半導体セクターの方向感が鍵。',
    ticker: 'N225', sentiment: 'neutral', tags: ['振り返り', 'SpaceX', 'Kioxia'],
    likes: 224,
    comments: [
      '激動の一週間でした。',
      '分散、大事。',
      '来週もSOX注視。',
      'SPCXと285A同時監視、疲れた。',
      '半分利確して正解だった。',
    ],
  },
  {
    author: 2, postedAt: '2026-07-10T08:52:00+09:00',
    title: '高配当株 — 半導体調整の間、電力・商社に資金シフト？',
    content: '285A・SOXの調整期に、東京電力・三菱商事・三井物産などディフェンシブ・高配当が相対的に強い。セクターローテの典型パターン。トータルリターン狙いなら「成長＋配当」のバランスを見直すタイミングかも。',
    ticker: '8058.T', sentiment: 'bullish', tags: ['高配当', '商社', 'セクター'],
    likes: 149,
    comments: [
      '商社・電力にシフト検討中。',
      'セクターローテ、典型。',
      '成長＋配当のバランス大事。',
      '三菱商事、堅いですね。',
    ],
  },
  {
    author: 7, postedAt: '2026-07-10T10:38:00+09:00',
    title: 'ウォッチリスト整理 — ボラ週の後に銘柄数を絞る',
    content: 'イベント週でウォッチリストが30銘柄超に膨らんだ。実際に手を出したのは5銘柄だけ。来週からは「追える数」に絞り直し。MoneyMartのウォッチリストでセクター別にタグ付けして整理中。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['ウォッチリスト', '投資習慣'],
    likes: 167,
    comments: [
      '30銘柄は多すぎ、わかる。',
      '5銘柄に絞る、いいですね。',
      'ウォッチリスト整理、週末の定番。',
      'セクタータグ、便利。',
    ],
  },
  {
    author: 5, postedAt: '2026-07-10T12:14:00+09:00',
    title: '米大型テック決算シーズン前 — NVDA・METAのガイダンスに注目',
    content: '来週以降、米ハイテクの決算が本格化。NVDAのデータセンター売上、METAのAI capexガイダンスがSOX・285Aのセンチメントに直結。好決算でもsell the newsになりうる点は先週のSamsungで学んだ。',
    ticker: 'NVDA', sentiment: 'neutral', tags: ['決算', 'NVDA', 'AI'],
    likes: 193,
    comments: [
      'NVDAガイダンス、毎回イベント。',
      'sell the news、怖い。',
      'METAのcapexも注目。',
      'SOX連動で285Aも動く。',
    ],
  },
  {
    author: 4, postedAt: '2026-07-10T14:01:00+09:00',
    title: '7/10午後 — 日経は横ばい、週末前の手仕舞い',
    content: '日経225は±0.2%程度の横ばい。出来高は週初めより減少、週末前の手仕舞い売り・買いが拮抗。285Aは小幅プラスで週を終えそう。来週の米指標まで「待ち」の姿勢が主流。',
    ticker: 'N225', sentiment: 'neutral', tags: ['日経平均', '週末'],
    likes: 102,
    comments: [
      '横ばいで週終わり。',
      '手仕舞い、様子見。',
      '来週の米指標待ち。',
      '285Aは小幅プラス、よかった。',
    ],
  },
  {
    author: 8, postedAt: '2026-07-10T16:28:00+09:00',
    title: '積立NISA — 下落週でも積立は止めない派の理由',
    content: '半導体調整週でも1306・2559の積立は継続。タイミングを狙うより「時間分散」が自分のスタイル。ボラが高い週は画面を見る頻度を減らすのもメンタル管理。長期は指数に任せる。',
    ticker: '2559.T', sentiment: 'bullish', tags: ['NISA', '積立', '長期投資'],
    likes: 188,
    comments: [
      '積立は止めない派、同意。',
      '画面見る頻度減らす、大事。',
      '2559コツコツ。',
      '時間分散が一番。',
    ],
  },
  {
    author: 1, postedAt: '2026-07-10T18:55:00+09:00',
    title: 'コミュニティで勉強 — みんなの285A見方が参考になった',
    content: '今週のコミュニティ投稿で285Aのファンダ派・テクニカル派・利確派の意見がバラバラで参考になった。正解は一つじゃない。自分の時間軸とサイズで決めるのが大事。来週もみんなの投稿楽しみにしてます。',
    ticker: '285A.T', sentiment: 'bullish', tags: ['コミュニティ', 'Kioxia', '投資哲学'],
    likes: 156,
    comments: [
      '色んな意見あって勉強になる。',
      '正解は一つじゃない、同意。',
      '来週もよろしく。',
      'ファンダ派です。',
      '利確派でした、反省。',
    ],
  },
  {
    author: 11, postedAt: '2026-07-10T21:12:00+09:00',
    title: '7/10週末 — 来週のウォッチリスト5銘柄',
    content: '来週注目：①SPCX（S&P500入りタイムライン）②285A（25日線）③NVDA決算 ④SOX指数 ⑤ドル円155円台の継続。ポジションは半分現金。イベント多い週は「見る専門」も立派な戦略。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['ウォッチリスト', '来週', '戦略'],
    likes: 201,
    comments: [
      '5銘柄に絞る、いいですね。',
      '半分現金、堅実。',
      'NVDA決算、緊張。',
      '見る専門、わかる笑',
      '来週もよろしくお願いします。',
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
    console.log(`  would remove ${seedIds.length} existing july910 posts`)
    return
  }
  await admin.from('lounge_comments').delete().in('post_id', seedIds)
  await admin.from('lounge_post_tags').delete().in('post_id', seedIds)
  await admin.from('lounge_post_likes').delete().in('post_id', seedIds)
  await admin.from('lounge_post_bookmarks').delete().in('post_id', seedIds)
  await admin.from('lounge_posts').delete().in('id', seedIds)
  console.log(`  removed ${seedIds.length} old july910 posts`)
}

async function main() {
  const existingIds = await findSeedPostIds()
  if (existingIds.length && !REPLACE) {
    console.log('July 9-10 seed already exists. Use --replace to rebuild.')
    return
  }

  console.log(DRY_RUN ? 'Dry run (July 9-10 posts)…' : REPLACE ? 'Replace July 9-10 seed…' : 'Seeding July 9-10 posts…')
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

  console.log(`Done. ${posts} posts, ${comments} comments (2026-07-09/10 JST).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
