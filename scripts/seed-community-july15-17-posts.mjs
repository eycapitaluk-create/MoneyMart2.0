/**
 * Seed community posts 2026-07-15 / 16 / 17(午前〜約09:30 JST) —
 * CPI+ASML反発、半導体急落ローテ、Warsh証言、7/17寄り調整。議論が割れるトーン。
 *
 *   node scripts/seed-community-july15-17-posts.mjs
 *   node scripts/seed-community-july15-17-posts.mjs --dry-run
 *   node scripts/seed-community-july15-17-posts.mjs --replace
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

const SEED_MARKER = 'mm-community-seed-july15-17-v1'

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

/** Debate-heavy posts; uneven likes / comment counts */
const POSTS = [
  // ——— 7/15 ———
  {
    author: 3, postedAt: '2026-07-15T05:05:00+09:00',
    title: '米CPI予想下回り — 「利下げ期待」で飛び乗る？それとも罠？',
    content: '6月CPIはヘッドラインが予想（3.8%）を下回る3.5%前後との報道。コアも予想割れ。市場はリスクオンに振れやすいが、一夜でAI投資懸念が消えたわけではない。NISAコアは継続、サテライトはサイズ半分のままが無難では？',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['CPI', '金利', '議論'],
    likes: 198,
    comments: [
      '予想下回りは材料だが飛び乗りは危険。',
      '利下げ期待で買い、賛成寄り。',
      'コアも下なら安心材料でしょ。',
      'Warsh証言前にサイズ増やすのは怖い。',
      '積立は触らない派。',
      '一晩でファンダ変わらない、同意。',
    ],
  },
  {
    author: 8, postedAt: '2026-07-15T07:42:00+09:00',
    title: '日経続伸スタート — 半導体買い戻しは「本物」か売られ過ぎ反発か',
    content: '寄りからAI・半導体に買い。CPI安堵＋アジア半導体堅調のセット。でも先週〜一昨日の急落後のリバウンドに見えなくもない。ここから積み増す派と、戻り売り待ち派、どっち？',
    ticker: 'N225', sentiment: 'bullish', tags: ['日経平均', '半導体', '議論'],
    likes: 142,
    comments: [
      '売られ過ぎ反発、まだ買う気にならない。',
      '東エレク戻りで少し拾った。',
      '本物かは決算まで分からない。',
      '戻り売り待ち。',
    ],
  },
  {
    author: 1, postedAt: '2026-07-15T12:18:00+09:00',
    title: 'ASML通期見通し引き上げ — 装置株はまだ買いか、材料出尽くしか',
    content: 'ASMLが26年通期売上見通し上限を450億ユーロへ引き上げ、4〜6月も上振れ。午後にレーザーテク・東エレクが一段高。長期需要の「可視性」発言は強気材料。一方、今日買って明日利確の相場でもある。中期保有なら今日の押し目？それとも高値掴み？',
    ticker: 'ASML', sentiment: 'bullish', tags: ['ASML', '東エレク', '装置'],
    likes: 221,
    comments: [
      '装置の長期需要は本物だと思う。',
      '材料出尽くし警戒して様子見。',
      '8035少しだけ追加した。',
      'ガイダンス上方は強い。',
      '明日の海外反応待ち。',
      'NISAで装置は持ちすぎ注意。',
      '可視性、キーワード。',
    ],
  },
  {
    author: 11, postedAt: '2026-07-15T14:55:00+09:00',
    title: 'IBM急落の連想で国内ソフトが弱い — 過剰反応？妥当？',
    content: '米IBMがAIインフラハード優先でソフト投資が後回し、との報道で株急落→富士通・NEC・野村総研など国内ソフトも軟調。日本企業の受注まで同じストーリーかは疑問。連想売りに乗る派 vs 「別物」で拾う派、議論したい。',
    ticker: '6702.T', sentiment: 'bearish', tags: ['ソフトウェア', 'IBM', '連想売り'],
    likes: 87,
    comments: [
      '日本は別物、買い場かも。',
      '連想売りは短期で終わることが多い。',
      '触らない。需給が悪い日。',
      'NECはもともと重い。',
    ],
  },
  {
    author: 4, postedAt: '2026-07-15T16:05:00+09:00',
    title: '大引け — 日経1008円高の68751円。この上げ、持ち越す？',
    content: '終値+1008円。ASMLとCPI安堵が主役。韓国KOSPIも強く、半導体見直し買い。明日はWarsh議会対応が残る。今夜の米反応と証言トーンで180度変わる可能性。持ち越しはコアのみ派、それとも今日の勢いを信じる派？',
    ticker: 'N225', sentiment: 'bullish', tags: ['大引け', '持ち越し', '議論'],
    likes: 165,
    comments: [
      'コア以外は減らした。',
      '勢い信じる、サテライト少し残す。',
      '証言前は小さいサイズ。',
      '1008円高は気持ちいいが怖い。',
      '明日のギャップ警戒。',
    ],
  },
  {
    author: 0, postedAt: '2026-07-15T20:40:00+09:00',
    title: 'SKHY急反発報道 — 「売られ過ぎ」論とファンダ未解消、どっちが正しい？',
    content: 'CPI後にハイニックスADRが急騰したとの海外解説。売られ過ぎからのテクニカル反発と見る向きが多い一方、「AI Capex懸念は消えていない」とも。短期トレード向き？それとも中期の底打ちサイン？',
    ticker: 'SKHY', sentiment: 'neutral', tags: ['ハイニックス', '売られ過ぎ', '議論'],
    likes: 119,
    comments: [
      '売られ過ぎ反発、同意。ファンダは別。',
      '底打ちなら嬉しいが証拠不足。',
      'ADRと東証メモリは動きが違う。',
      'ナンピンはまだ早い。',
      'ウォッチだけ。',
      '短期で利確するタイプの動き。',
    ],
  },
  {
    author: 9, postedAt: '2026-07-15T22:15:00+09:00',
    title: 'Warsh証言前夜 — CPI鈍化でも「任務完了」と言わない議長',
    content: '物価鈍化でも「まだやるべきことがある」と線引きするトーンが伝わっている。市場の早期利下げ期待と、FRBの慎重姿勢がぶつかる局面。明日〜明後日の発言でテックが再び売られるシナリオ、どう備える？',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['FRB', '議会証言', '金利'],
    likes: 134,
    comments: [
      '期待しすぎは危険。',
      'ハト派に聞こえたら買い戻し。',
      'サイズ半分で十分。',
      'CPIは勝ったのに油断禁物。',
    ],
  },

  // ——— 7/16 ———
  {
    author: 2, postedAt: '2026-07-16T05:12:00+09:00',
    title: '米半導体再び大幅安 — 15日の買い戻しは罠だった？',
    content: '米引けでSOXが大きく下落。中国メモリ勢の上場・増産懸念でマイクロンが売られたとの解説も。昨日ASML好決算で買った日本勢、寄りどうする？損切り即断派 vs 「一日のブレ」我慢派。',
    ticker: 'MU', sentiment: 'bearish', tags: ['マイクロン', '半導体', '議論'],
    likes: 183,
    comments: [
      '昨日買った人かわいそう…自分は様子見で正解。',
      '増産懸念は中期テーマ、無視できない。',
      'ギャップ埋め待ち。',
      '損切り線だけ守る。',
      '罠だった可能性、高い。',
      'ASML材料は生きてると思う。',
      '競争激化懸念、重い。',
    ],
  },
  {
    author: 6, postedAt: '2026-07-16T09:05:00+09:00',
    title: '寄り — アドテスト・東エレク・キオクシア・SBGが指数を押し下げ',
    content: '寄与上位が半導体・通信に集中。285Aは二桁近い下げも。指数は一時2000円超安。ここで「押し目買い」と言える人と「下落トレンド入り」と言う人、根拠を聞きたい。',
    ticker: '285A.T', sentiment: 'bearish', tags: ['キオクシア', '東エレク', '寄り付き'],
    likes: 156,
    comments: [
      '押し目にはまだ早い。',
      '決算前は買えない。',
      '下落トレンド断言は過剰では。',
      'サイズゼロに近い。',
      'ヒートマップ真っ青。',
    ],
  },
  {
    author: 10, postedAt: '2026-07-16T11:35:00+09:00',
    title: '韓国KOSPIまた急落 — 日本半導体は永遠に韓国と連動するのか',
    content: 'KOSPIが7%超安の場面も。東京も歩調を合わせる形で半導体売り強化。ファンダが違っても「バスケット」で売られる構造。連動を織り込んでサイズ管理すべき？それとも乖離を狙う？',
    ticker: 'TOPIC', sentiment: 'bearish', tags: ['韓国株', '連想売り', '議論'],
    likes: 92,
    comments: [
      '連動は短期の話、中期は別。',
      'サイズ管理が全て。',
      '乖離狙いは上級者向け。',
      'CB級の日は触らない。',
    ],
  },
  {
    author: 5, postedAt: '2026-07-16T13:20:00+09:00',
    title: 'ローテ議論 — 半導体売り→自動車・小売りは「正しい分散」か一時しのぎか',
    content: '値上がり銘柄数が過半になる場面も。ハイテク集中マネーが自動車・小売りへ。サイゼリヤは値上げ検討報道でストップ高。出遅れ拾いはあり？それとも半導体が戻ればまた置いていかれる？',
    ticker: '7203.T', sentiment: 'bullish', tags: ['セクターローテ', '自動車', '小売り'],
    likes: 128,
    comments: [
      '分散としては正しい。',
      'サイゼリヤはテーマ株、追わない。',
      'トヨタは相対的に楽。',
      '半導体戻したら置いていかれる派。',
      'NISAは全世界株で十分では。',
      '出遅れ拾い、少しだけ。',
    ],
  },
  {
    author: 7, postedAt: '2026-07-16T15:50:00+09:00',
    title: '大引け — 日経1915円安の66835円。3日ぶり反落、どう総括する？',
    content: '一時2200円超安→終値-1915円。15日の上げをほぼ吐き出した形。調整継続＋決算前リスクオフとの見方。あなたは「健康な調整」？それとも「トレンド転換の初動」？',
    ticker: 'N225', sentiment: 'bearish', tags: ['大引け', '調整', '議論'],
    likes: 204,
    comments: [
      '健康な調整、まだ強気。',
      '転換初動の可能性も否定できない。',
      'ボラが高すぎて疲れる。',
      '積立だけ続ける。',
      'サテライト全部降りた。',
      '7万円回復は先送り。',
      '明日の米次第。',
      'こういう日こそルール。',
    ],
  },
  {
    author: 3, postedAt: '2026-07-16T18:25:00+09:00',
    title: 'Warsh証言 — 物価鈍化でも「任務完了」否定。市場は何を聞きたい？',
    content: '議長はインフレ急騰は過去になり得るとしつつ、完了宣言には慎重。市場はハト派ワードを欲しがっているが、慎重トーンなら金利↑・テック↓のセットが再来しやすい。証言テキストのどこを見る？',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['議会証言', 'FRB', '議論'],
    likes: 111,
    comments: [
      '「データ次第」連発なら様子見。',
      'タカ派一句で全部崩れる。',
      '聞きたいのは利下げパス。',
      '聞きすぎない方がメンタル良い。',
    ],
  },
  {
    author: 1, postedAt: '2026-07-16T20:10:00+09:00',
    title: 'エヌビディア、日本企業とフィジカルAI連携拡大 — 材料になる日？',
    content: 'NVDAが日本企業との連携拡大、「フィジカルAI」実装へ、との報道。個別材料としては前向き。でもマクロの半導体バスケット売りが強いと埋もれる。材料株を個別で拾う派 vs 指数リスク優先派。',
    ticker: 'NVDA', sentiment: 'bullish', tags: ['エヌビディア', 'フィジカルAI', '日本'],
    likes: 76,
    comments: [
      '中期テーマとしては面白い。',
      '今日みたいな日は埋もれる。',
      '連携銘柄リスト見たい。',
    ],
  },
  {
    author: 8, postedAt: '2026-07-16T21:48:00+09:00',
    title: '日銀調査 — 1年後物価「上がる」が過去最高。円安と株高の両立は続く？',
    content: '家計のインフレ予想が強いと、金融政策・消費・実質賃金の議論が再燃しやすい。円は162円前後。株は半導体で振れるのに、生活者実感は物価。個人投資家として「円資産」と「外貨ETF」のバランス、どう考えてる？',
    ticker: 'USDJPY', sentiment: 'neutral', tags: ['物価', '為替', 'NISA'],
    likes: 89,
    comments: [
      '外貨ETFは持ちすぎない。',
      '円安メリット株も持つ。',
      '生活防衛と投資は分けて考える。',
      '2559は薄めに。',
    ],
  },

  // ——— 7/17 午前（〜約09:30） ———
  {
    author: 4, postedAt: '2026-07-17T05:08:00+09:00',
    title: '米時間の続き — 半導体安が残るなら、17日寄りもギャップ警戒',
    content: '16日の東京大引け後も、海外半導体のトーンは重いとの見方が多い。寄りで追撃売りが入るか、売られ過ぎからの小反発か。今日は「予想到達で利確」ルールを先に紙に書く日。',
    ticker: 'SOX', sentiment: 'bearish', tags: ['寄り付き', '半導体', 'ルール'],
    likes: 97,
    comments: [
      '紙に書く、いい習慣。',
      'ギャップ埋め待ち。',
      '追撃売り警戒。',
    ],
  },
  {
    author: 0, postedAt: '2026-07-17T07:55:00+09:00',
    title: '寄り前議論 — 15日上げ→16日吐き出しのあと、今日は「様子見」が正解か',
    content: '乱高下の三日間。CPI・ASMLで強気→競争懸念・利確で弱気。今日午前は情報が薄い分、様子見ムードが広がるはず。あなたは現金比率を上げる？それとも機械的に積立だけ？',
    ticker: 'N225', sentiment: 'neutral', tags: ['様子見', '現金比率', '議論'],
    likes: 148,
    comments: [
      '現金比率上げた。',
      '積立だけ、触らない。',
      '少しだけ逆張りしたい欲との戦い。',
      '様子見が正解だと思う。',
      '三日で疲れた。',
    ],
  },
  {
    author: 11, postedAt: '2026-07-17T08:42:00+09:00',
    title: '寄り付き軟調 — 一時2000円超安・6.5万円割れ報道。売り疲れ？それとも続き？',
    content: '寄りからAI・半導体中心に利益確定売り。一時2400円安や6.5万円割れの速報も。急騰のブレーキとの指摘もある。ここから押し目買いに転換できる条件は何だと思う？（決算？金利？KOSPI安定？）',
    ticker: 'N225', sentiment: 'bearish', tags: ['日経平均', '半導体', '議論'],
    likes: 172,
    comments: [
      '売り疲れなら午後戻る。',
      '6.5万割れは心理的に重い。',
      '条件は海外半導体の安定。',
      '今日は買いを入れない。',
      'ブレーキ論、同意寄り。',
      '決算まで待ち。',
    ],
  },
  {
    author: 9, postedAt: '2026-07-17T09:18:00+09:00',
    title: '午前の論点まとめ — 「健康な調整」派 vs 「トレンド終了」派、どっちに投票？',
    content: '健康な調整派：ボラは高いがCPI鈍化・装置需要は生きてる。トレンド終了派：競争激化＋バスケット売りが構造化、7万回復は遠い。コメントで立場と理由を一言で。個人的には前者寄りだがサイズは小さい。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['議論', '調整', 'トレンド'],
    likes: 189,
    comments: [
      '健康な調整派。積立継続。',
      'トレンド終了寄り。現金増やす。',
      'どちらでもサイズが答え。',
      '前者。ただしサテライトはゼロ。',
      '後者。戻り売り待ち。',
      'まだ決められない派。',
      '投票：健康な調整。',
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
    console.log(`  would remove ${seedIds.length} existing july15-17 posts`)
    return
  }
  await admin.from('lounge_comments').delete().in('post_id', seedIds)
  await admin.from('lounge_post_tags').delete().in('post_id', seedIds)
  await admin.from('lounge_post_likes').delete().in('post_id', seedIds)
  await admin.from('lounge_post_bookmarks').delete().in('post_id', seedIds)
  await admin.from('lounge_posts').delete().in('id', seedIds)
  console.log(`  removed ${seedIds.length} old july15-17 posts`)
}

async function main() {
  const existingIds = await findSeedPostIds()
  if (existingIds.length && !REPLACE) {
    console.log('July 15-17 seed already exists. Use --replace to rebuild.')
    return
  }

  console.log(DRY_RUN ? 'Dry run (July 15-17)…' : REPLACE ? 'Replace July 15-17 seed…' : 'Seeding July 15-17 posts…')
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
      const commentAt = new Date(baseMs + (c + 1) * 3 * 60000 + c * 70000).toISOString()
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

  console.log(`Done. ${posts} posts, ${comments} comments, ${likes} like_count total (2026-07-15〜17).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
