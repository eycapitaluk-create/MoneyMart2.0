/**
 * Seed community posts dated 2026-07-05 / 07-06 (JST) — SpaceX Nasdaq-100, Kioxia selloff, hot topics.
 *
 *   node scripts/seed-community-july5-6-posts.mjs
 *   node scripts/seed-community-july5-6-posts.mjs --dry-run
 *   node scripts/seed-community-july5-6-posts.mjs --replace
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

const SEED_MARKER = 'mm-community-seed-july56-v1'

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

/** Posts on 2026-07-05 / 07-06 JST */
const POSTS = [
  // ── 7/5 ──
  {
    author: 0, postedAt: '2026-07-05T07:42:00+09:00',
    title: '7/5朝 — 米Independence Day明け、SPCXが話題の中心',
    content: '米国市場再開。SpaceX(SPCX)は6/12上場から約3週間、時価総額2兆ドル超。7/7のNasdaq-100組入れが目前で、QQQ連動のパッシブ買い需要が注目。個人的には初日ギャップより「組入れ前後のボラ」に備えたい。',
    ticker: 'SPCX', sentiment: 'bullish', tags: ['SpaceX', 'SPCX', 'Nasdaq100'],
    likes: 214,
    comments: [
      'Nasdaq-100 fast-track入りは史上初ですね。',
      'QQQのリバランスで数十億ドル規模の買い？',
      'IPO後のボラは半分利確派です。',
      'RKLBとの比較もしたい。',
    ],
  },
  {
    author: 3, postedAt: '2026-07-05T09:18:00+09:00',
    title: 'SpaceX(SPCX) — Nasdaq-100組入れでQQQはどう動く？',
    content: '7/7付でSPCXがNasdaq-100に入る見込み。フロート時価総額ベースでウェイトは約1%と言われており、QQQ/QQQM経由のパッシブ需要が議論中。一方S&P500はfast-trackなしで組入れまで1年超の見方。指数投資家は「QQQに宇宙が入る日」として記念に。',
    ticker: 'SPCX', sentiment: 'bullish', tags: ['SpaceX', 'QQQ', '指数'],
    likes: 187,
    comments: [
      'S&P500入りはまだ先か…。',
      '1%でも2兆ドル企業だと規模大きい。',
      'QQQM派ですが同じ話ですね。',
      '組入れ前に買い煽り、入ったら利確パターンも。',
    ],
  },
  {
    author: 1, postedAt: '2026-07-05T11:03:00+09:00',
    title: 'キオクシア(285A) — 6月高値112,700円からの調整はどこまで？',
    content: '285AはIPO後の急騰で一時112,700円（6/22）。NAND契約単価はQ3も+10〜15%見込みでファンダは強いが、テクニカルでは過熱感。25日線割れで短期トレードは様子見。中長期は北米のKitakami新工場・332層BiCS FLASHの供給制約がカタリスト。',
    ticker: '285A.T', sentiment: 'neutral', tags: ['Kioxia', '285A', '半導体'],
    likes: 168,
    comments: [
      'IPO後すぐ2倍超えは調整来ても不思議じゃない。',
      'NAND単価上昇は続くって analysts も言ってる。',
      '25日線割れは一度様子見にしました。',
      'TEL/SUMCOとセットで半導体3本柱。',
    ],
  },
  {
    author: 8, postedAt: '2026-07-05T13:27:00+09:00',
    title: '米SOX指数-6% — 日本の半導体も連れ安の匂い',
    content: 'Independence Day明けの米国でフィラデルフィア半導体指数(SOX)が大幅下落。SNDK-10%超、メモリ関連ETF(DRAM)も軟調。日本時間7/6の寄付きは285A・8035・6857あたりが売られやすい。ただしAI capexの構造需要は消えてないので「売り過ぎ」派も。',
    ticker: 'SOX', sentiment: 'bearish', tags: ['SOX', '半導体', 'メモリ'],
    likes: 142,
    comments: [
      'SNDKと285Aは連動しやすい。',
      '寄付きギャップダウン覚悟。',
      '構造需要は残る、同意。',
      '利確の波、来週も続くかも。',
    ],
  },
  {
    author: 6, postedAt: '2026-07-05T15:51:00+09:00',
    title: '7/5大引け — 日経は小幅安、半導体だけ弱い',
    content: '米国再開初日はハイテク中心に調整。日経は-0.3%程度で底堅いが、285A・ソフトバンクG・TELが重し。商社・銀行はプラスでセクター分散。週明け7/7はSPCXのNasdaq-100＋サムスン決算後のメモリセクターが焦点。',
    ticker: 'N225', sentiment: 'neutral', tags: ['日経平均', 'セクターローテ'],
    likes: 119,
    comments: [
      '半導体だけ弱い日、最近多い。',
      '銀行・商社が支えてる。',
      '7/7がイベント多い。',
    ],
  },
  {
    author: 4, postedAt: '2026-07-05T20:14:00+09:00',
    title: 'SpaceX — ウォール街のカバレッジ開始、Ratingは概ねBuy',
    content: 'IPO quiet period明けでGS/MS/JPM/Citi/WFCがSPCXのカバレッジ開始。「AIの最終フロンティア」など強気コメント。時価総額2.1兆ドルで米国6位規模。ただし評価は「信仰」要素も大きく、伝統的DCFよりStarlink ARR×打ち上げコスト低下のストーリー勝負。',
    ticker: 'SPCX', sentiment: 'bullish', tags: ['SpaceX', 'アナリスト', 'IPO'],
    likes: 203,
    comments: [
      'Rating Buyばかりは怖い反面、需給は強い。',
      'Starlink ARRの成長率が鍵。',
      'イーロン関連でTSLAも連想売買。',
      '個人は指数連動で間接保有になる日も近い。',
    ],
  },
  {
    author: 11, postedAt: '2026-07-05T22:08:00+09:00',
    title: '7/5夜 — Metaのクラウド参入報道、AI capex見直し懸念？',
    content: 'BloombergがMetaの余剰コンピュート容量を外部販売する構想を報道。データセンター拡張ペース鈍化→メモリ需要減の懸念で半導体が売られた流れ。本当に需要減か、それとも効率化か。NVDA・285A・MUは過剰反応の可能性も。',
    ticker: 'META', sentiment: 'bearish', tags: ['Meta', 'AI', 'データセンター'],
    likes: 156,
    comments: [
      '報道1本でSOX-6%は過剰反応気味。',
      '効率化と需要減は別。',
      'HBM/NANDの実需はまだタイト。',
      '様子見、同意。',
    ],
  },

  // ── 7/6 ──
  {
    author: 9, postedAt: '2026-07-06T06:55:00+09:00',
    title: '7/6早朝 — 明日7/7はSPCXがNasdaq-100入り、歴史的な一日',
    content: '7/7付でSpaceX(SPCX)がNasdaq-100に正式組入れ。fast-track entryルール初適用で、IPOから約15営業日での入りは前例なし。Morgan Stanleyはパッシブ流入43億ドル規模と試算。明日はギャップ＋出来高増に注意。指数連動派は「買わざるを得ない日」かも。',
    ticker: 'SPCX', sentiment: 'bullish', tags: ['SpaceX', 'Nasdaq100', 'パッシブ'],
    likes: 278,
    comments: [
      '明日は出来高が異常になりそう。',
      'fast-trackはAnthropic/OpenAI IPOにも効くルール。',
      '入った日に利確売り来る説も。',
      'QQQ保有者は自動的にSPCX持ちになる日。',
      '43億ドル、需給インパクト大きい。',
    ],
  },
  {
    author: 2, postedAt: '2026-07-06T08:31:00+09:00',
    title: 'キオクシア285A — 米半導体安の連想売り、今日の寄付きは？',
    content: '前日の米SOX大幅安を受け、285Aは寄付きから売られやすい局面。6月高値からの調整で含み益の利確も重なる。ただし2026年の受注は埋まってるとの経営コメントあり。SanDisk(SNDK)との共同開発体なので米国のメモリ株とセットで見るのが正解。',
    ticker: '285A.T', sentiment: 'bearish', tags: ['Kioxia', '285A', 'SNDK'],
    likes: 191,
    comments: [
      'SNDK-10%なら285Aも連動。',
      '含み益利確、わかる。',
      'ファンダはまだ強い派。',
      '寄付きで半分利確しました。',
    ],
  },
  {
    author: 7, postedAt: '2026-07-06T10:12:00+09:00',
    title: 'DRAM価格操縦訴訟 — メモリ株にまた逆風',
    content: '米北カリフォルニア地裁でSamsung/SK hynix/MicronらがDRAM価格の不当引き上げで集団訴訟。顧客側のプッシュバックという見方も。285A・MU・000660.KSはセンチメント悪化。ただしNAND/DRAMの需給タイトは続いており、訴訟とファンダは切り離して見たい。',
    ticker: 'MU', sentiment: 'bearish', tags: ['DRAM', '訴訟', 'メモリ'],
    likes: 134,
    comments: [
      '訴訟は長期化しそう。',
      '需給タイトは別問題、同意。',
      '285Aも連想売りされやすい。',
    ],
  },
  {
    author: 5, postedAt: '2026-07-06T12:44:00+09:00',
    title: 'サムスンQ2営業益+1810% — なのにメモリ株は売られる理由',
    content: 'SamsungのQ2 2026営業利益が前年比+1810%という爆発的決算。なのに7/7のアジア時間は「sell the news」で285A・000660が大幅安。市場は既に織り込み済みで、AI capex ROIへの疑問も重なる。好決算＝株価上昇ではない、典型例。',
    ticker: '005930', sentiment: 'bearish', tags: ['Samsung', '決算', 'sell the news'],
    likes: 245,
    comments: [
      'sell the newsの典型。',
      '1810%でも足りない市場、怖い。',
      '285A-12%は連想売り。',
      'SK hynixも-10%近い。',
      '中長期はまだサイクル続く派。',
    ],
  },
  {
    author: 10, postedAt: '2026-07-06T14:19:00+09:00',
    title: '285Aが日経を引っ張り下げ — 半導体集中リスクの現実',
    content: 'キオクシアが一時-12%超、日経225も-1.7%台。IPO後に時価総額がトヨタ超えの285Aが指数に効くようになった。半導体1銘柄の急落が指数全体を押し下げる構造。分散投資の重要性を再認識。商社・銀行・内需でヘッジ。',
    ticker: '285A.T', sentiment: 'bearish', tags: ['Kioxia', '日経225', 'リスク'],
    likes: 172,
    comments: [
      '285Aが指数に効く時代。',
      '半導体集中はリスク。',
      '商社で分散してます。',
      '底値拾い派も出始めた。',
    ],
  },
  {
    author: 0, postedAt: '2026-07-06T16:03:00+09:00',
    title: '7/6大引け — SPCXは組入れ前夜で堅調、285Aは大幅安',
    content: '日本株：285A・TEL・SBGが重く日経-1.7%前後。米国株：SPCXはNasdaq-100組入れ前夜で$149前後、-7%近い調整も。明日7/7は「SPCX指数入り vs メモリセクター売り」の二極化。ポジションは半分利確、現金比率上げ。',
    ticker: 'SPCX', sentiment: 'neutral', tags: ['SpaceX', 'Kioxia', '大引け'],
    likes: 198,
    comments: [
      '二極化の日、明日。',
      'SPCXと285A同時に見てる人多そう。',
      '現金比率上げ、同意。',
      '7/7は朝から画面見ます。',
    ],
  },
  {
    author: 3, postedAt: '2026-07-06T18:37:00+09:00',
    title: 'Fedウォーシュ「株価は高すぎる」発言 — セクター全体に冷や水',
    content: 'FRB議長候補のウォーシュ氏が「price is too high」とコメント。ハイテク・メモリの利確売りを加速させた一因。金利据え置き＋バリュエーション警戒の組み合わせ。ディフェンシブ（商社・電力・高配当）へのローテーション続くか。',
    ticker: 'SPY', sentiment: 'bearish', tags: ['FRB', '金利', 'バリュエーション'],
    likes: 121,
    comments: [
      '高バリュー株は逆風。',
      '商社・電力に資金向かう？',
      '利確の口実にされがち。',
    ],
  },
  {
    author: 8, postedAt: '2026-07-06T20:52:00+09:00',
    title: 'Rocket Lab(RKLB) — SpaceX IPO後の宇宙セクター再評価',
    content: 'SPCX上場で宇宙経済全体が注目。RKLBは小型ロケット+宇宙アプリでSPCXとは別ポジション。SPCXが2兆ドルなら「第2梯队」の再評価余地。ただしSPCX組入れ前後はRKLBに資金が流れるか流出するか、明日の動きが参考になる。',
    ticker: 'RKLB', sentiment: 'bullish', tags: ['RocketLab', 'SpaceX', '宇宙'],
    likes: 143,
    comments: [
      'RKLBは小型ロケットで差別化。',
      'SPCXとセットで宇宙セクター見てます。',
      '第2梯队の再評価、あるかも。',
    ],
  },
  {
    author: 11, postedAt: '2026-07-06T22:26:00+09:00',
    title: '7/6振り返り — 明日はSpaceX指数入り＋メモリ乱高下のダブルイベント',
    content: '今日のテーマは①SPCXのNasdaq-100組入れ前夜 ②285Aを中心としたメモリセクター調整。Samsung好決算なのにsell the news。SOX-6%、DRAM訴訟、Metaクラウド報道が重なった。明日7/7はパッシブ買い(SPCX)とアジア時間の続落(285A)が同時進行しうる。ポジション小さく、イベント見学モード推奨。',
    ticker: 'N225', sentiment: 'neutral', tags: ['振り返り', 'SpaceX', 'Kioxia'],
    likes: 267,
    comments: [
      'イベント見学モード、同意。',
      'SPCXと285A同時監視。',
      'パッシブ買いvs連想売り。',
      '明日は寝不足確定。',
      '半分利確して正解だった。',
    ],
  },
  {
    author: 1, postedAt: '2026-07-06T23:41:00+09:00',
    title: '285A底値拾い？ — 個人投資家の逆張りが始まった話',
    content: '285Aが25日線割れ・-12%超の日に、個人の買い越しが観測されたとの報道。NAND単価上昇・2026年受注埋まり・Kitakami新工場は変わらず。ただしボラティリティ年率160%超でサイズは小さく。SPCX組入れで宇宙株に資金が流れる日、メモリは逆風続くか。',
    ticker: '285A.T', sentiment: 'bullish', tags: ['Kioxia', '底値拾い', '個人投資家'],
    likes: 184,
    comments: [
      '個人の買い越し、よくあるパターン。',
      'サイズ小さく、同意。',
      'ファンダはまだ強い。',
      '明日もう一段来るかも…。',
      '積立派は無視して続ける。',
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
    console.log(`  would remove ${seedIds.length} existing july56 posts`)
    return
  }
  await admin.from('lounge_comments').delete().in('post_id', seedIds)
  await admin.from('lounge_post_tags').delete().in('post_id', seedIds)
  await admin.from('lounge_post_likes').delete().in('post_id', seedIds)
  await admin.from('lounge_post_bookmarks').delete().in('post_id', seedIds)
  await admin.from('lounge_posts').delete().in('id', seedIds)
  console.log(`  removed ${seedIds.length} old july56 posts`)
}

async function main() {
  const existingIds = await findSeedPostIds()
  if (existingIds.length && !REPLACE) {
    console.log('July 5-6 seed already exists. Use --replace to rebuild.')
    return
  }

  console.log(DRY_RUN ? 'Dry run (July 5-6 posts)…' : REPLACE ? 'Replace July 5-6 seed…' : 'Seeding July 5-6 posts…')
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

  console.log(`Done. ${posts} posts, ${comments} comments (2026-07-05/06 JST).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
