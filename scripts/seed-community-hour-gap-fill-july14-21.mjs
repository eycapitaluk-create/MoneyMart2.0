/**
 * Fill empty hour buckets (05–22 JST) for community posts 2026-07-14 … 2026-07-21.
 * Hand-crafted Jul 21 trading-day posts; generated short posts for other gaps.
 *
 *   node scripts/seed-community-hour-gap-fill-july14-21.mjs
 *   node scripts/seed-community-hour-gap-fill-july14-21.mjs --dry-run
 *   node scripts/seed-community-hour-gap-fill-july14-21.mjs --replace
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
    if (process.env[key] == null || process.env[key] === '') process.env[key] = val
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
const BATCH_PREFIX = '【時埋め】'
const JULY21_PREFIX = '【7/21】'

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

const DAY_META = {
  '2026-07-14': { kind: 'trade', close: 67242, label: '7/14' },
  '2026-07-15': { kind: 'trade', close: 68751, label: '7/15' },
  '2026-07-16': { kind: 'trade', close: 66835, label: '7/16' },
  '2026-07-17': { kind: 'trade', close: 64141, label: '7/17' },
  '2026-07-18': { kind: 'weekend', close: 64141, label: '7/18土' },
  '2026-07-19': { kind: 'weekend', close: 64141, label: '7/19日' },
  '2026-07-20': { kind: 'holiday', close: 64141, label: '7/20海の日' },
  '2026-07-21': { kind: 'trade', close: 64141, label: '7/21火' },
}

const HOUR_TOPICS = {
  early: [
    '米株・先物の夜間動きをメモ',
    '寄り前チェックリストだけ書く',
    'ウォッチリストの損切り線確認',
    '為替と半導体ニュースを一次情報で',
  ],
  morning: [
    '前場の値動き、サイズは触らない',
    '半導体と金融の相対強さを見る',
    '寄り後30分は様子見派',
    'ヒートマップで偏りチェック',
  ],
  lunch: [
    '昼休み — 午前の振り返りだけ',
    '積立コアは継続、サテライトは半分ルール',
    'ニュース飛び乗り禁止を再掲',
    '現金比率メモを更新',
  ],
  afternoon: [
    '後場 — 材料前にサイズ膨らませない',
    'バリューとグロースのローテ感',
    '大引け前は新規より整理',
    '決算カレンダーを先に書く',
  ],
  evening: [
    '引け後メモ — 明日のギャップ想定',
    'NISAコア比率の偏り確認',
    'やらないことリスト再掲',
    '連休・休場明けのメンタル整備',
  ],
  night: [
    '夜 — 先物と海外指数だけ',
    '就寝前にサイズ上限を紙に書く',
    'SNSの底読みはしない',
    '明日のチェックリスト3行',
  ],
}

/** Jul 21 — real context: reopen after 3-day break; open ~+403 to ~64544; morning +1000~+1500 */
const JULY21_POSTS = [
  {
    author: 4, postedAt: '2026-07-21T05:35:00+09:00', likeSlots: 6,
    title: `${JULY21_PREFIX}早朝 — 連休明け火曜、先物と米株の夜間を整理`,
    content: '現物は17日終値64141円（-2694）から4営業日ぶり。夜間先物は戻し気味の報道も。寄り前にサイズ上限だけ決めておく。全額突っ込みは禁止。',
    ticker: 'N225', sentiment: 'neutral', tags: ['連休明け', '先物', 'サイズ'],
    comments: ['サイズ上限決めた', '64141メモ', '全額禁止', '寄り前整理'],
  },
  {
    author: 1, postedAt: '2026-07-21T06:50:00+09:00', likeSlots: 8,
    title: `${JULY21_PREFIX}朝 — 海の日明け、現物再開までのチェック3つ`,
    content: '1) 半導体比率 2) 現金比率 3) コアETF継続。売買は寄り後30分待ち。レバは触らない。',
    ticker: '1306.T', sentiment: 'bullish', tags: ['チェックリスト', 'NISA'],
    comments: ['3つやる', '寄り30分待ち', 'レバ触らない', 'コア継続', 'わかる'],
  },
  {
    author: 7, postedAt: '2026-07-21T07:55:00+09:00', likeSlots: 5,
    title: `${JULY21_PREFIX}寄り前 — ギャップアップでもパニック買いしない`,
    content: '連休中の先物戻しで寄り高も想定。だが「取りこぼし恐怖」で全額は危険。分割1回ルールだけ守る。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['寄り付き', 'メンタル'],
    comments: ['分割1回', 'パニック買いしない', '同意'],
  },
  {
    author: 0, postedAt: '2026-07-21T08:58:00+09:00', likeSlots: 9,
    title: `${JULY21_PREFIX}直前 — 5分後に寄り、ウォッチは半導体と銀行`,
    content: '寄り付き直前。半導体の需給と金融の相対強さを同時に見る。数字は寄り後に確定。',
    ticker: 'N225', sentiment: 'neutral', tags: ['寄り付き', '半導体', '銀行'],
    comments: ['半導体見る', '銀行も', '寄り後確定', 'わかる', '同意'],
  },
  {
    author: 9, postedAt: '2026-07-21T09:22:00+09:00', likeSlots: 11,
    title: `${JULY21_PREFIX}寄り — 前日比+403円付近の6万4544円前後でスタート`,
    content: '報道ベースで寄りは前日比+403円93銭高の64544円05銭付近。17日安値圏64141からの戻し。全戻しではないのでサイズは控えめ。',
    ticker: 'N225', sentiment: 'bullish', tags: ['寄り付き', '日経平均', 'ギャップ'],
    comments: ['+403メモ', '64544付近', 'サイズ控えめ', '戻し確認', '全戻しじゃない', '同意', '寄り高'],
  },
  {
    author: 3, postedAt: '2026-07-21T10:32:00+09:00', likeSlots: 10,
    title: `${JULY21_PREFIX}前場 — 日経が1000円超高に拡大、押し目派と見送り派`,
    content: '前場中盤で前日比1000円超高の報道。ショートカバー要素もある。追いかけ全額は禁止、分割だけ。',
    ticker: 'N225', sentiment: 'bullish', tags: ['前場', '反発', '議論'],
    comments: ['1000円高', '見送り派', '分割だけ', 'ショートカバー?', '追いかけ禁止', 'おもしろい', '同意'],
  },
  {
    author: 8, postedAt: '2026-07-21T11:08:00+09:00', likeSlots: 7,
    title: `${JULY21_PREFIX}前場後半 — 1500円超高の報道、過熱感はどこから`,
    content: '11時前後で+1500円超高のニュース。17日の-2694円からの戻しとしては大きい。新規は半分ルール、既存は損切り線確認のみ。',
    ticker: 'N225', sentiment: 'neutral', tags: ['前場', '過熱', 'リスク管理'],
    comments: ['1500円高', '半分ルール', '損切り確認', '過熱感', '同意'],
  },
  {
    author: 5, postedAt: '2026-07-21T12:18:00+09:00', likeSlots: 6,
    title: `${JULY21_PREFIX}昼 — 前場の戻し、午後は利益確定売りに注意`,
    content: '前場は広く買い。午後は利益確定と材料待ちで伸び悩みも。積立コアは触らず、個別は新規控えめ。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['昼休み', '前場', '午後'],
    comments: ['利益確定売り注意', 'コア触らない', '新規控えめ', '前場強い'],
  },
  {
    author: 11, postedAt: '2026-07-21T13:28:00+09:00', likeSlots: 8,
    title: `${JULY21_PREFIX}後場入り — 前場高のあと、追いかけは分割のみ`,
    content: '連休明けの戻し相場。後場も強いが、高値掴みリスクは残る。サイズ上限10%・分割1回を紙に書いた。',
    ticker: 'N225', sentiment: 'bullish', tags: ['後場', 'サイズ', '押し目'],
    comments: ['10%上限', '分割1回', '高値掴み注意', '紙に書いた', '同意'],
  },
  {
    author: 2, postedAt: '2026-07-21T14:42:00+09:00', likeSlots: 5,
    title: `${JULY21_PREFIX}午後 — 半導体と商社、どちらが主導か`,
    content: '戻し日はセクター主導が変わりやすい。半導体一強で終わるか、バリューに広がるか。ヒートマップで確認。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['ローテ', '半導体', '商社'],
    comments: ['ヒートマップ見る', 'バリュー広がり?', '半導体主導', 'わかる'],
  },
  {
    author: 6, postedAt: '2026-07-21T15:38:00+09:00', likeSlots: 9,
    title: `${JULY21_PREFIX}大引け前 — 新規より整理、明日のギャップ想定`,
    content: '連休明け1日目はボラ大きめ。大引け前の飛び乗りは避ける。明日の寄りギャップだけメモして終了。',
    ticker: 'N225', sentiment: 'neutral', tags: ['大引け', 'ボラ', '整理'],
    comments: ['飛び乗り避ける', '明日ギャップ', '整理優先', 'ボラ大', '同意', 'メモした'],
  },
  {
    author: 10, postedAt: '2026-07-21T16:30:00+09:00', likeSlots: 7,
    title: `${JULY21_PREFIX}引け間際 — 17日64141からの戻し幅を記録`,
    content: '基準は17日終値64141円。今日の戻しは心理的節目。終値は確定後に振り返る。積立は予定通り。',
    ticker: 'N225', sentiment: 'bullish', tags: ['大引け', '振り返り'],
    comments: ['64141基準', '確定後に振り返り', '積立継続', '戻し幅記録', '同意'],
  },
  {
    author: 4, postedAt: '2026-07-21T17:55:00+09:00', likeSlots: 10,
    title: `${JULY21_PREFIX}夕方 — 連休明け1日目のメンタル、やらないこと再掲`,
    content: 'やらない：レバ、ニュース全額、積立停止。やる：現金比率メモ、コア継続。明日も寄り30分待ち。',
    ticker: '1306.T', sentiment: 'neutral', tags: ['メンタル', 'ルール', 'NISA'],
    comments: ['レバやめる', '積立継続', '寄り30分', 'リスト使う', '同意', 'お疲れさま'],
  },
  {
    author: 1, postedAt: '2026-07-21T19:12:00+09:00', likeSlots: 6,
    title: `${JULY21_PREFIX}夜 — 米株寄りと夜間先物、明日の材料`,
    content: '今夜の米株と半導体ニュースが明日の方向感。日本は今日大きく戻したので、海外の反応次第。',
    ticker: 'TSM', sentiment: 'neutral', tags: ['米株', '先物', '海外'],
    comments: ['米株見る', '半導体ニュース', '海外反応', '同意'],
  },
  {
    author: 8, postedAt: '2026-07-21T20:45:00+09:00', likeSlots: 4,
    title: `${JULY21_PREFIX}夜更け — 配当カレンダーとNISA枠の最終確認`,
    content: '値動きに振り回されず、配当予定と枠の偏りだけ見る。売買はしない。',
    ticker: '1306.T', sentiment: 'bullish', tags: ['配当', 'NISA', 'カレンダー'],
    comments: ['配当確認', '枠の偏り', '売買しない'],
  },
  {
    author: 3, postedAt: '2026-07-21T18:20:00+09:00', likeSlots: 6,
    title: `${JULY21_PREFIX}夕方 — 大引け後の海外材料チェック`,
    content: '終値確定後は米株と半導体ADRを確認。今日の戻しを全部信じず、明日の寄り30分待ちルールは継続。',
    ticker: 'TSM', sentiment: 'neutral', tags: ['大引け後', '海外', 'ルール'],
    comments: ['寄り30分', 'ADR確認', '戻し全部信じない', '同意'],
  },
  {
    author: 6, postedAt: '2026-07-21T21:05:00+09:00', likeSlots: 7,
    title: `${JULY21_PREFIX}夜 — 明日のウォッチリスト固定`,
    content: '連休明けの1日を終えてリストだけ更新。新規銘柄追加はしない。損切り線とサイズ上限を再確認。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['ウォッチリスト', 'ルール'],
    comments: ['リスト固定', '損切り再確認', '新規追加しない', 'わかる'],
  },
  {
    author: 3, postedAt: '2026-07-21T22:10:00+09:00', likeSlots: 5,
    title: `${JULY21_PREFIX}就寝前 — 明日も分割1回・全額禁止`,
    content: '連休明けの戻し日を終えた。明日も同じルール。短く寝る。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['ルール', 'おやすみ'],
    comments: ['分割1回', 'おやすみ', '全額禁止'],
  },
]

function jstHourKey(isoOrDate) {
  const t = new Date(isoOrDate).getTime() + 9 * 3600000
  const jst = new Date(t)
  const day = jst.toISOString().slice(0, 10)
  const hour = jst.getUTCHours()
  return `${day}:${hour}`
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
  const meta = DAY_META[day]
  if (!meta) return null
  const band = hourBand(hour)
  const topic = pick(HOUR_TOPICS[band], slotIdx + hour)
  const author = slotIdx % PERSONAS.length
  const minute = 12 + (slotIdx * 7) % 45
  const postedAt = `${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`
  const likeSlots = 4 + (slotIdx % 8)
  const closeNote = meta.close ? `前回終値${meta.close.toLocaleString('ja-JP')}円付近を基準に。` : ''
  let content = ''
  if (meta.kind === 'weekend' || meta.kind === 'holiday') {
    content = `${meta.label} — ${topic}。現物休場なので売買はしない。${closeNote}先物は参考値、火曜寄付きの準備だけ。`
  } else {
    content = `${meta.label} ${hour}時台 — ${topic}。${closeNote}サイズは控えめ、コアETFは継続。`
  }
  const comments = [
    pick(['メモした', '同意', 'わかる', 'サイズ注意', 'コア継続'], slotIdx),
    pick(['寄り30分待ち', '偏りチェック', '損切り確認', '現金比率'], slotIdx + 1),
    pick(['おもしろい', '参考になる', '同じ考え', 'リスト使う'], slotIdx + 2),
  ]
  if (likeSlots >= 7) comments.push(pick(['ヒートマップ見る', 'レバ触らない', '分割だけ'], slotIdx + 3))
  return {
    author,
    postedAt,
    likeSlots,
    title: `${BATCH_PREFIX}${meta.label} ${hour}時 — ${topic}`,
    content,
    ticker: hour % 3 === 0 ? 'N225' : hour % 3 === 1 ? '1306.T' : 'TOPIC',
    sentiment: band === 'morning' ? 'bullish' : band === 'night' ? 'neutral' : 'neutral',
    tags: [meta.label.replace('/', ''), pick(['日経平均', 'NISA', 'メンタル', '先物', 'ローテ'], slotIdx)],
    comments,
  }
}

async function fetchCoveredHours() {
  const { data, error } = await admin
    .from('lounge_posts')
    .select('created_at')
    .gte('created_at', '2026-07-14T00:00:00+09:00')
    .lte('created_at', '2026-07-21T23:59:59+09:00')
  if (error) throw error
  const covered = new Set()
  for (const row of data || []) {
    covered.add(jstHourKey(row.created_at))
  }
  return covered
}

function buildAllPosts(covered) {
  const posts = []
  let slotIdx = 0

  for (let d = 14; d <= 20; d += 1) {
    const day = `2026-07-${String(d).padStart(2, '0')}`
    for (let hour = 5; hour <= 22; hour += 1) {
      const key = `${day}:${hour}`
      if (covered.has(key)) continue
      const gapPost = buildGapPost(day, hour, slotIdx)
      if (gapPost) posts.push(gapPost)
      slotIdx += 1
    }
  }

  for (const p of JULY21_POSTS) {
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

async function findBatchPostIds() {
  const { data, error } = await admin
    .from('lounge_posts')
    .select('id,title')
    .gte('created_at', '2026-07-14T00:00:00+09:00')
    .lte('created_at', '2026-07-21T23:59:59+09:00')
  if (error) throw error
  return (data || [])
    .filter((r) => String(r.title || '').startsWith(BATCH_PREFIX) || String(r.title || '').startsWith(JULY21_PREFIX))
    .map((r) => r.id)
}

async function purgeExisting() {
  const seedIds = await findBatchPostIds()
  if (seedIds.length === 0) return
  if (DRY_RUN) {
    console.log(`  would remove ${seedIds.length} hour-gap posts`)
    return
  }
  await admin.from('lounge_comments').delete().in('post_id', seedIds)
  await admin.from('lounge_post_tags').delete().in('post_id', seedIds)
  await admin.from('lounge_post_likes').delete().in('post_id', seedIds)
  await admin.from('lounge_post_bookmarks').delete().in('post_id', seedIds)
  await admin.from('lounge_posts').delete().in('id', seedIds)
  console.log(`  removed ${seedIds.length} old hour-gap posts`)
}

async function main() {
  const existingBatch = await findBatchPostIds()
  if (existingBatch.length && !REPLACE) {
    console.log(`Hour-gap batch exists (${existingBatch.length} posts). Use --replace to rebuild batch only.`)
    // Still fill non-batch gaps if any
  } else if (REPLACE || existingBatch.length) {
    await purgeExisting()
  }

  const covered = await fetchCoveredHours()
  const POSTS = buildAllPosts(covered)
  if (POSTS.length === 0) {
    console.log('No empty hour buckets to fill.')
    return
  }

  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} hour-gap posts…`)

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
      console.log(`[dry-run] ${row.postedAt} ${row.title.slice(0, 48)}… (+${commentTotal}c / ${likeSlots}♥)`)
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

  console.log(`Done. ${posts} posts, ${comments} comments, ${likes} likes (hour-gap 7/14–7/21).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
