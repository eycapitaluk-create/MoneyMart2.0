/**
 * Fill empty hour buckets (05–22 JST) for community 2026-07-01 … 2026-07-23.
 * Hand-crafted Jul 22–23; generated posts for other gaps. Skips already-covered hours.
 *
 *   node scripts/seed-community-hour-gap-fill-july1-23.mjs
 *   node scripts/seed-community-hour-gap-fill-july1-23.mjs --dry-run
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
const BATCH_PREFIX = '【時埋め】'
const P22 = '【7/22】'
const P23 = '【7/23】'

const START_DAY = '2026-07-01'
const END_DAY = '2026-07-23'

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

/** Known ^N225 manual_close (do not invent other dates) */
const N225_CLOSE = {
  '2026-07-01': 70062,
  '2026-07-02': 70475,
  '2026-07-13': 68558,
  '2026-07-14': 67243,
  '2026-07-15': 68752,
  '2026-07-16': 66836,
  '2026-07-17': 64141,
  '2026-07-21': 66232,
}

const HOUR_TOPICS = {
  early: ['米株・先物の夜間動きをメモ', '寄り前チェックリスト', '損切り線の確認', '為替と半導体ニュース'],
  morning: ['前場の値動きメモ', '半導体と金融の相対強さ', '寄り後30分は様子見', 'ヒートマップで偏り確認'],
  lunch: ['昼休み — 午前の振り返り', 'コアETF継続・サテライト半分', 'ニュース飛び乗り禁止', '現金比率メモ'],
  afternoon: ['後場 — サイズ膨らませない', 'バリューとグロースのローテ', '大引け前は整理優先', '決算カレンダー確認'],
  evening: ['引け後メモ', 'NISA偏りチェック', 'やらないことリスト', '明日のギャップ想定'],
  night: ['夜 — 先物と海外指数', 'サイズ上限を紙に書く', 'SNSの底読みしない', '明日のチェックリスト'],
}

const JULY22_POSTS = [
  {
    author: 0, postedAt: '2026-07-22T05:40:00+09:00', likeSlots: 6,
    title: `${P22}早朝 — 前日66232円引けのあと、米株夜間を確認`,
    content: '21日は日経66232円（+2091円）の大陽線。今日は利益確定と様子見が混ざりやすい。寄り前にサイズ上限だけ決める。',
    ticker: 'N225', sentiment: 'neutral', tags: ['日経平均', '利益確定', 'サイズ'],
    comments: ['66232メモ', '様子見', 'サイズ上限', '同意'],
  },
  {
    author: 7, postedAt: '2026-07-22T07:50:00+09:00', likeSlots: 8,
    title: `${P22}寄り前 — 戻しの翌日は「追いかけ全額」禁止`,
    content: '大きく戻した翌日はギャップでも飛び乗り注意。分割1回・半分ルール。レバは触らない。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['寄り付き', 'ルール'],
    comments: ['全額禁止', '分割1回', 'レバ触らない', 'わかる', '同意'],
  },
  {
    author: 9, postedAt: '2026-07-22T09:18:00+09:00', likeSlots: 9,
    title: `${P22}寄り — 高値66232円が意識されるか`,
    content: '前日高値・終値66232円が抵抗に見えるか、それともブレイクするか。寄り後30分は触らない派。',
    ticker: 'N225', sentiment: 'bullish', tags: ['寄り付き', '抵抗線'],
    comments: ['66232意識', '寄り30分待ち', 'ブレイク?', '触らない派', '同意'],
  },
  {
    author: 3, postedAt: '2026-07-22T10:35:00+09:00', likeSlots: 7,
    title: `${P22}前場 — 半導体の続伸か、バリューへのローテか`,
    content: '戻し翌日はセクター交代が起きやすい。ヒートマップで主導を確認。新規は控えめ。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['ローテ', '半導体'],
    comments: ['ヒートマップ', 'ローテ注意', '新規控えめ', 'わかる'],
  },
  {
    author: 8, postedAt: '2026-07-22T11:20:00+09:00', likeSlots: 10,
    title: `${P22}前場後半 — 議論：今日は「消化」派？「続伸」派？`,
    content: '66232円の大陽線の翌日。利益確定売りは自然。投票どうぞ。私は消化寄りでサイズ半分。',
    ticker: 'N225', sentiment: 'neutral', tags: ['議論', '投票'],
    comments: ['消化派', '続伸派', 'サイズ半分', '利益確定', 'おもしろい', '同意'],
  },
  {
    author: 5, postedAt: '2026-07-22T12:25:00+09:00', likeSlots: 5,
    title: `${P22}昼 — 午前の値動きだけメモ、数字は引け後に`,
    content: '終値はまだ確定前。午前の主導セクターと自分の偏りだけ確認。積立コアは継続。',
    ticker: '1306.T', sentiment: 'neutral', tags: ['昼休み', 'NISA'],
    comments: ['引け後確定', '偏り確認', 'コア継続'],
  },
  {
    author: 11, postedAt: '2026-07-22T13:35:00+09:00', likeSlots: 8,
    title: `${P22}後場 — 66232円の上で推移できるか`,
    content: '前日終値66232円を維持できるかが心理線。上でも追いかけ禁止、下でもパニック売り禁止。',
    ticker: 'N225', sentiment: 'neutral', tags: ['後場', 'メンタル'],
    comments: ['維持できるか', '追いかけ禁止', 'パニック売り禁止', '同意'],
  },
  {
    author: 2, postedAt: '2026-07-22T14:50:00+09:00', likeSlots: 6,
    title: `${P22}午後 — 銀行・商社の粘りを見る`,
    content: '戻し日の翌日はバリューが支えるか。全部乗り換えはやりすぎ。薄く意識だけ。',
    ticker: '8306.T', sentiment: 'bullish', tags: ['銀行', '商社'],
    comments: ['薄く意識', '乗り換えやりすぎ', 'わかる'],
  },
  {
    author: 6, postedAt: '2026-07-22T15:45:00+09:00', likeSlots: 9,
    title: `${P22}大引け前 — 新規より整理、明日の材料待ち`,
    content: '大引け前の飛び乗りは避ける。米株と半導体ニュースを夜に確認。サイズは今日触らない。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['大引け', '整理'],
    comments: ['飛び乗り避ける', '米株夜に', 'サイズ触らない', '同意', '整理'],
  },
  {
    author: 10, postedAt: '2026-07-22T16:35:00+09:00', likeSlots: 7,
    title: `${P22}引け間際 — 終値は確定後に振り返る`,
    content: '66232円からの2日目。終値数字は引け後に記録。積立は予定通り。',
    ticker: 'N225', sentiment: 'neutral', tags: ['大引け', '振り返り'],
    comments: ['確定後に記録', '積立継続', '2日目', '同意'],
  },
  {
    author: 4, postedAt: '2026-07-22T17:50:00+09:00', likeSlots: 10,
    title: `${P22}夕方 — やらないことリスト再掲`,
    content: 'やらない：レバ、ニュース全額、積立停止。やる：現金比率メモ、コア継続。',
    ticker: '1306.T', sentiment: 'bullish', tags: ['ルール', 'NISA'],
    comments: ['レバやめる', '積立継続', 'リスト使う', '同意', 'お疲れさま'],
  },
  {
    author: 1, postedAt: '2026-07-22T19:15:00+09:00', likeSlots: 6,
    title: `${P22}夜 — 米株と半導体ADR、明日の方向感`,
    content: '今夜の海外が明日のギャップ材料。日本は戻し後の調整か続伸か、一次情報だけ見る。',
    ticker: 'TSM', sentiment: 'neutral', tags: ['米株', '海外'],
    comments: ['ADR見る', '一次情報', 'ギャップ材料', '同意'],
  },
  {
    author: 8, postedAt: '2026-07-22T20:40:00+09:00', likeSlots: 5,
    title: `${P22}夜更け — 配当・NISA枠の偏りだけ`,
    content: '値動きに振り回されず枠の偏り確認。売買はしない。',
    ticker: '1306.T', sentiment: 'bullish', tags: ['配当', 'NISA'],
    comments: ['偏り確認', '売買しない', 'わかる'],
  },
  {
    author: 3, postedAt: '2026-07-22T22:05:00+09:00', likeSlots: 4,
    title: `${P22}就寝前 — 明日も寄り30分待ち`,
    content: '分割1回・全額禁止を継続。短く寝る。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['ルール', 'おやすみ'],
    comments: ['寄り30分', 'おやすみ', '全額禁止'],
  },
]

const JULY23_POSTS = [
  {
    author: 4, postedAt: '2026-07-23T05:45:00+09:00', likeSlots: 7,
    title: `${P23}早朝 — 米株夜間と、前回確定66232円を基準に`,
    content: '直近の確定終値は21日の66232円。寄り前にウォッチリストとサイズ上限だけ更新。全額突っ込み禁止。',
    ticker: 'N225', sentiment: 'neutral', tags: ['早朝', 'サイズ'],
    comments: ['66232基準', 'サイズ上限', '全額禁止', '同意'],
  },
  {
    author: 1, postedAt: '2026-07-23T07:05:00+09:00', likeSlots: 6,
    title: `${P23}朝 — チェック3つ（偏り・現金・コア継続）`,
    content: '1) 半導体比率 2) 現金比率 3) コアETF継続。寄り後30分待ち。',
    ticker: '1306.T', sentiment: 'bullish', tags: ['チェックリスト', 'NISA'],
    comments: ['3つやる', '寄り30分', 'コア継続', 'わかる'],
  },
  {
    author: 7, postedAt: '2026-07-23T08:15:00+09:00', likeSlots: 8,
    title: `${P23}寄り前 — 海外材料と円相場を先に`,
    content: '個別よりマクロ。為替と米半導体の動きを確認してから寄りを見る。',
    ticker: 'USDJPY', sentiment: 'neutral', tags: ['為替', '寄り前'],
    comments: ['為替先', '半導体', 'マクロ優先', '同意'],
  },
  {
    author: 0, postedAt: '2026-07-23T09:12:00+09:00', likeSlots: 9,
    title: `${P23}寄り — 66232円ラインの攻防`,
    content: '21日終値66232円がサポートかレジスタンスか。寄り後は数字確定まで様子見。',
    ticker: 'N225', sentiment: 'neutral', tags: ['寄り付き', '日経平均'],
    comments: ['66232ライン', '様子見', 'サポート?', '同意', 'レジスタンス?'],
  },
  {
    author: 9, postedAt: '2026-07-23T10:28:00+09:00', likeSlots: 10,
    title: `${P23}前場 — 半導体主導か、広がりあるか`,
    content: '前場の主導セクターをヒートマップで。一強なら偏り注意、広がりなら様子見継続。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['前場', 'ヒートマップ'],
    comments: ['ヒートマップ', '一強注意', '広がり?', '同意', '偏り'],
  },
  {
    author: 3, postedAt: '2026-07-23T11:15:00+09:00', likeSlots: 7,
    title: `${P23}前場後半 — 投票：今日は買い増し？様子見？`,
    content: '戻し後の調整局面。買い増しは分割のみ。全額は禁止。どちら派？',
    ticker: 'N225', sentiment: 'neutral', tags: ['投票', '議論'],
    comments: ['様子見派', '分割買い', '全額禁止', 'おもしろい', '同意'],
  },
  {
    author: 5, postedAt: '2026-07-23T12:35:00+09:00', likeSlots: 8,
    title: `${P23}昼 — 午前の感触だけ、終値は引け後`,
    content: '昼休みは午前の主導と自分のポジション偏りだけ確認。新規は控えめ。コア積立は継続。',
    ticker: '1306.T', sentiment: 'neutral', tags: ['昼休み', '偏り'],
    comments: ['午前の感触', '偏り確認', 'コア継続', '新規控えめ', '同意'],
  },
  {
    author: 11, postedAt: '2026-07-23T13:40:00+09:00', likeSlots: 6,
    title: `${P23}後場入り — 高値掴みリスクを意識`,
    content: '午後も追いかけ全額は危険。サイズ上限10%・分割1回を再確認。',
    ticker: 'TOPIC', sentiment: 'bearish', tags: ['後場', 'リスク管理'],
    comments: ['10%上限', '分割1回', '高値掴み注意', '同意'],
  },
  {
    author: 2, postedAt: '2026-07-23T14:55:00+09:00', likeSlots: 9,
    title: `${P23}午後 — 決算・材料前のサイズルール`,
    content: '材料前にポジション膨らませない。触らない日を先に決める。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['決算', 'サイズ'],
    comments: ['材料前注意', '触らない日', 'サイズ固定', 'わかる', '同意'],
  },
  {
    author: 6, postedAt: '2026-07-23T15:50:00+09:00', likeSlots: 7,
    title: `${P23}大引け前 — 整理優先、明日のギャップ想定`,
    content: '大引け前の新規は避ける。今夜の米株が明日の材料。',
    ticker: 'N225', sentiment: 'neutral', tags: ['大引け', '整理'],
    comments: ['新規避ける', '米株今夜', '整理優先', '同意'],
  },
  {
    author: 10, postedAt: '2026-07-23T16:40:00+09:00', likeSlots: 8,
    title: `${P23}引け間際 — 終値確定後に記録`,
    content: '数字は引け後に振り返る。積立は予定通り。損切り線だけ更新。',
    ticker: 'N225', sentiment: 'neutral', tags: ['大引け', '振り返り'],
    comments: ['引け後記録', '積立継続', '損切り更新', '同意'],
  },
  {
    author: 4, postedAt: '2026-07-23T18:00:00+09:00', likeSlots: 10,
    title: `${P23}夕方 — メンタル：やらないこと再掲`,
    content: 'やらない：レバ、ニュース全額、積立停止。やる：現金メモ、コア継続。',
    ticker: '1306.T', sentiment: 'bullish', tags: ['メンタル', 'ルール'],
    comments: ['レバやめる', '積立継続', 'お疲れさま', 'リスト使う', '同意'],
  },
  {
    author: 1, postedAt: '2026-07-23T19:30:00+09:00', likeSlots: 6,
    title: `${P23}夜 — 米株寄りと半導体ニュース`,
    content: '海外の反応次第で明日のギャップ。一次情報だけ。',
    ticker: 'TSM', sentiment: 'neutral', tags: ['米株', '半導体'],
    comments: ['米株見る', '一次情報', 'ギャップ', '同意'],
  },
  {
    author: 8, postedAt: '2026-07-23T21:00:00+09:00', likeSlots: 5,
    title: `${P23}夜 — ウォッチリスト固定`,
    content: 'リスト追加はしない。損切り線とサイズ上限を紙に書く。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['ウォッチリスト', 'ルール'],
    comments: ['リスト固定', '損切り', '紙に書く'],
  },
  {
    author: 3, postedAt: '2026-07-23T22:15:00+09:00', likeSlots: 4,
    title: `${P23}就寝前 — 明日も同じルール`,
    content: '分割1回・全額禁止。おやすみ。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['おやすみ', 'ルール'],
    comments: ['おやすみ', '分割1回', '全額禁止'],
  },
]

const HANDCRAFTED = [...JULY22_POSTS, ...JULY23_POSTS]

function jstHourKey(isoOrDate) {
  const t = new Date(isoOrDate).getTime() + 9 * 3600000
  const jst = new Date(t)
  return `${jst.toISOString().slice(0, 10)}:${jst.getUTCHours()}`
}

function getDayMeta(day) {
  const wd = new Date(`${day}T12:00:00+09:00`).getUTCDay()
  const d = parseInt(day.slice(8, 10), 10)
  const wdJa = wd === 0 ? '日' : wd === 6 ? '土' : ''
  const label = `7/${d}${wdJa}`
  let kind = 'trade'
  if (day === '2026-07-20') kind = 'holiday'
  else if (wd === 0 || wd === 6) kind = 'weekend'
  const close = N225_CLOSE[day] ?? null
  return { kind, close, label }
}

function hourBand(h) {
  if (h <= 7) return 'early'
  if (h <= 11) return 'morning'
  if (h <= 13) return 'lunch'
  if (h <= 17) return 'afternoon'
  if (h <= 19) return 'evening'
  return 'night'
}

function pick(arr, idx) {
  return arr[Math.abs(idx) % arr.length]
}

function buildGapPost(day, hour, slotIdx) {
  const meta = getDayMeta(day)
  const band = hourBand(hour)
  const topic = pick(HOUR_TOPICS[band], slotIdx + hour)
  const author = slotIdx % PERSONAS.length
  const minute = 8 + (slotIdx * 11) % 48
  const postedAt = `${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`
  const likeSlots = 4 + (slotIdx % 8)
  const closeNote = meta.close ? `終値${meta.close.toLocaleString('ja-JP')}円付近を基準。` : '確定数字は一次情報で確認。'
  let content = ''
  if (meta.kind === 'weekend' || meta.kind === 'holiday') {
    content = `${meta.label} — ${topic}。現物休場。売買しない。${closeNote}`
  } else {
    content = `${meta.label} ${hour}時台 — ${topic}。${closeNote}サイズ控えめ、コアETF継続。`
  }
  const comments = [
    pick(['メモした', '同意', 'わかる', 'サイズ注意', 'コア継続'], slotIdx),
    pick(['寄り30分待ち', '偏りチェック', '損切り確認', '現金比率'], slotIdx + 1),
    pick(['参考になる', '同じ考え', 'リスト使う'], slotIdx + 2),
  ]
  if (likeSlots >= 7) comments.push(pick(['ヒートマップ', 'レバ触らない', '分割だけ'], slotIdx + 3))
  return {
    author,
    postedAt,
    likeSlots,
    title: `${BATCH_PREFIX}${meta.label} ${hour}時 — ${topic}`,
    content,
    ticker: hour % 3 === 0 ? 'N225' : hour % 3 === 1 ? '1306.T' : 'TOPIC',
    sentiment: 'neutral',
    tags: [meta.label.replace('/', ''), pick(['日経平均', 'NISA', 'メンタル', '先物'], slotIdx)],
    comments,
  }
}

function dayRange(start, end) {
  const out = []
  let cur = start
  while (cur <= end) {
    out.push(cur)
    const d = new Date(`${cur}T12:00:00+09:00`)
    d.setUTCDate(d.getUTCDate() + 1)
    cur = d.toISOString().slice(0, 10)
  }
  return out
}

async function fetchCoveredHours() {
  const { data, error } = await admin
    .from('lounge_posts')
    .select('created_at')
    .gte('created_at', `${START_DAY}T00:00:00+09:00`)
    .lte('created_at', `${END_DAY}T23:59:59+09:00`)
  if (error) throw error
  const covered = new Set()
  for (const row of data || []) covered.add(jstHourKey(row.created_at))
  return covered
}

function buildAllPosts(covered) {
  const handcraftedHours = new Set(HANDCRAFTED.map((p) => jstHourKey(p.postedAt)))
  const posts = []
  let slotIdx = 0

  for (const day of dayRange(START_DAY, END_DAY)) {
    for (let hour = 5; hour <= 22; hour += 1) {
      const key = `${day}:${hour}`
      if (covered.has(key)) continue
      if (handcraftedHours.has(key)) continue
      posts.push(buildGapPost(day, hour, slotIdx))
      slotIdx += 1
    }
  }

  for (const p of HANDCRAFTED) {
    if (!covered.has(jstHourKey(p.postedAt))) posts.push(p)
  }

  return posts
}

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
      user_metadata: { full_name: persona.name, display_name: persona.name },
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

async function main() {
  const covered = await fetchCoveredHours()
  const POSTS = buildAllPosts(covered)
  if (POSTS.length === 0) {
    console.log('No empty hour buckets to fill.')
    return
  }

  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} posts (gaps Jul 1–23)…`)

  const personaMap = new Map()
  for (const persona of PERSONAS) {
    personaMap.set(persona.email, await ensurePersona(persona))
  }

  let posts = 0
  let comments = 0
  let likes = 0

  for (const row of POSTS) {
    const persona = PERSONAS[row.author]
    const mapped = personaMap.get(persona.email)
    if (!mapped) continue

    const createdAt = new Date(row.postedAt).toISOString()
    const commentTexts = row.comments || []
    const commentTotal = commentTexts.length
    const likeSlots = Math.min(PERSONAS.length - 1, Math.max(1, Number(row.likeSlots || 5)))
    const hotScore = likeSlots * 2 + commentTotal * 3 + 40

    const payload = {
      author_id: mapped.userId,
      author_name: mapped.name,
      title: row.title,
      content: String(row.content || ''),
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
      console.log(`[dry-run] ${row.postedAt} ${row.title.slice(0, 52)}…`)
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
      const likeAt = new Date(new Date(row.postedAt).getTime() + (li + 1) * 6 * 60 * 1000).toISOString()
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
      const commentAt = new Date(new Date(row.postedAt).getTime() + (c + 1) * 9 * 60 * 1000).toISOString()
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

  console.log(`Done. ${posts} posts, ${comments} comments, ${likes} likes.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
