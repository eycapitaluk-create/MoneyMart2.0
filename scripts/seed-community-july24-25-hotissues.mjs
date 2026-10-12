/**
 * Community seed: 2026-07-24 gap hours + 2026-07-25 (weekend hot issues).
 * Tesla/Google earnings fallout, Jul 24 N225 -1811, semi selloff debates.
 *
 *   node scripts/seed-community-july24-25-hotissues.mjs
 *   node scripts/seed-community-july24-25-hotissues.mjs --dry-run
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
const SERVICE_KEY = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '',
).trim()

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const P24 = '【7/24補】'
const P25 = '【7/25】'

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

const POSTS = [
  // —— 7/24 gap hours ——
  {
    author: 2, postedAt: '2026-07-24T06:15:00+09:00', likeSlots: 6,
    title: `${P24}早朝 — 米株ハイテク安のあと、寄り前に半導体比率だけ確認`,
    content: '前日米でテスラ・Google決算後の売り。日本はAI・半導体の連想売り警戒。寄り前に偏りとサイズ上限だけメモ。全額突っ込み禁止。',
    ticker: 'NVDA', sentiment: 'bearish', tags: ['寄り前', '半導体', 'サイズ'],
    comments: ['偏り確認', '全額禁止', '連想売り警戒', '同意'],
  },
  {
    author: 6, postedAt: '2026-07-24T18:10:00+09:00', likeSlots: 9,
    title: `${P24}夕方 — 日経64611円（-1811円）引け、週末前のメンタル`,
    content: '終値64611円、-1811円（-2.73%）。6万5000円台割れ。テスラ・Googleのcapex懸念と半導体売り。週末は触らない・損切り線だけ見直す。',
    ticker: 'N225', sentiment: 'bearish', tags: ['大引け', '日経平均', '週末'],
    comments: ['64611メモ', '週末触らない', '損切り見直し', '半導体売り', '同意', 'お疲れさま'],
  },
  {
    author: 10, postedAt: '2026-07-24T21:25:00+09:00', likeSlots: 5,
    title: `${P24}夜 — 月曜寄り30分待ちルール再掲`,
    content: '大幅安のあとは月曜もギャップ注意。分割1回・全額禁止。短く寝る。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['ルール', '月曜'],
    comments: ['寄り30分', '分割1回', 'おやすみ'],
  },

  // —— 7/25 Saturday ——
  {
    author: 4, postedAt: '2026-07-25T05:40:00+09:00', likeSlots: 8,
    title: `${P25}土曜朝 — 24日は日経-1811円、テスラ・Google余波を整理`,
    content: '24日終値64611円（前日比-1811円）。米テスラ約14%安・Google約7%安の決算反応が波及。半導体全面安。週末は現物なし、頭の中の数字だけ整理。',
    ticker: 'N225', sentiment: 'bearish', tags: ['週末', 'テスラ', 'Google', '半導体'],
    comments: ['-1811円', 'テスラ14%', 'Google7%', '週末整理', '半導体安', '同意'],
  },
  {
    author: 7, postedAt: '2026-07-25T06:20:00+09:00', likeSlots: 6,
    title: `${P25}早朝 — 米株ハイテク安の週末振り返り`,
    content: 'テスラ・Google決算後の売りが24日の日本半導体にも波及。週末は売買せず、ウォッチリストと損切り線だけ見直す。',
    ticker: 'TSLA', sentiment: 'bearish', tags: ['週末', 'テスラ', 'Google'],
    comments: ['売買しない', '損切り見直し', '半導体波及', '同意'],
  },
  {
    author: 1, postedAt: '2026-07-25T07:10:00+09:00', likeSlots: 7,
    title: `${P25}討論 — AI設備投資は「行き過ぎ」？「必須」？`,
    content: 'Googleはクラウド+82%なのにcapex 1950〜2050億ドルで株安。テスラも250億ドル超投資・FCFマイナス。怖い派と長期必須派、どっち？',
    ticker: 'GOOGL', sentiment: 'neutral', tags: ['議論', 'AI', '投票'],
    comments: ['行き過ぎ派', '必須投資派', 'capex怖い', 'クラウド82%', 'おもしろい', 'わかる'],
  },
  {
    author: 9, postedAt: '2026-07-25T08:25:00+09:00', likeSlots: 10,
    title: `${P25}テスラ急落 — 押し目派 vs 見送り派`,
    content: '決算後の大幅安（7/23終値319.69ドル付近、前日比約-14%）。ロボタクシー・Optimus・半導体投資は先が長い。個別はサイズ1割・分割のみ。',
    ticker: 'TSLA', sentiment: 'bearish', tags: ['テスラ', '決算', '投票'],
    comments: ['見送り派', '押し目は分割', 'Optimus先長い', '1割上限', 'EPSミス', '同意', 'レバ触らない'],
  },
  {
    author: 0, postedAt: '2026-07-25T09:35:00+09:00', likeSlots: 6,
    title: `${P25}午前 — 半導体の24日：キオクシア・アドテスト・東エレク`,
    content: '24日はAI・半導体が軒並み安。韓国KOSPI弱さも重石。週末はウォッチリスト固定、新規追加しない。',
    ticker: 'TOPIC', sentiment: 'bearish', tags: ['半導体', 'キオクシア', '韓国'],
    comments: ['軒並み安', 'KOSPI重い', 'リスト固定', '新規追加しない'],
  },
  {
    author: 7, postedAt: '2026-07-25T10:45:00+09:00', likeSlots: 9,
    title: `${P25}投票 — 月曜、半導体は買い増し？様子見？`,
    content: '64611円割れのあと。月曜はギャップダウンもありうる。買い増しは分割のみ、全額は禁止。どちら派？',
    ticker: 'N225', sentiment: 'neutral', tags: ['投票', '月曜', '半導体'],
    comments: ['様子見派', '分割だけ', 'ギャップ注意', '全額禁止', 'おもしろい', '同意'],
  },
  {
    author: 3, postedAt: '2026-07-25T11:20:00+09:00', likeSlots: 8,
    title: `${P25}昼 — Google：クラウド好調でも株安のパラドックス`,
    content: 'クラウド+82%は強いのに株は約7%安。capex上方とFCFマイナスが先に価格に。検索・広告は堅いが「AI請求書」が怖い見方。',
    ticker: 'GOOGL', sentiment: 'bearish', tags: ['Google', 'クラウド', '決算'],
    comments: ['パラドックス', 'capex先', '請求書怖い', 'クラウド強い', '同意', 'わかる'],
  },
  {
    author: 8, postedAt: '2026-07-25T12:40:00+09:00', likeSlots: 5,
    title: `${P25}昼休み — ディフェンシブ（医薬・保険）へのローテ？`,
    content: '24日は半導体売りの一方、医薬・保険・食品が相対強。全部乗り換えはやりすぎ。偏り是正は薄くだけ。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['ローテ', 'ディフェンシブ'],
    comments: ['乗り換えやりすぎ', '薄くだけ', '医薬強い', '偏り是正'],
  },
  {
    author: 11, postedAt: '2026-07-25T13:50:00+09:00', likeSlots: 11,
    title: `${P25}午後 — 中東・原油・円安、月曜の二重リスク`,
    content: '地政学と原油高がハイテクに追い打ち。円安進行も輸出・半導体のEPSに効く。週末は一次情報だけ、売買しない。',
    ticker: 'USDJPY', sentiment: 'bearish', tags: ['為替', '原油', '地政学'],
    comments: ['二重リスク', '売買しない', '一次情報', '円安注意', '原油高', '同意', 'わかる'],
  },
  {
    author: 5, postedAt: '2026-07-25T14:55:00+09:00', likeSlots: 7,
    title: `${P25}午後討論 — NVDAは押し目？まだ高い？`,
    content: '7/23終値208.76ドル付近。テスラ・Googleのcapex議論は半導体全体のマルチプルにも効く。新規は控えめ派。',
    ticker: 'NVDA', sentiment: 'neutral', tags: ['NVDA', '半導体', '議論'],
    comments: ['まだ高い派', '押し目派', 'マルチプル', '新規控えめ', '同意'],
  },
  {
    author: 2, postedAt: '2026-07-25T15:35:00+09:00', likeSlots: 6,
    title: `${P25}夕方 — NISAコア継続、サテライト半分ルール`,
    content: '大幅安週でも積立停止はしない。半導体偏りだけ確認。サテライトは半分ルール継続。',
    ticker: '1306.T', sentiment: 'bullish', tags: ['NISA', '積立', '偏り'],
    comments: ['積立継続', '半分ルール', '偏り確認', '停止しない'],
  },
  {
    author: 6, postedAt: '2026-07-25T16:45:00+09:00', likeSlots: 9,
    title: `${P25}夕方 — やらないことリスト（週末版）`,
    content: 'やらない：底値拾い全額、レバ、ニュース飛び乗り、積立停止。やる：損切り線、現金比率メモ、月曜チェックリスト。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['ルール', 'メンタル', '週末'],
    comments: ['リスト使う', 'レバやめる', '積立継続', '月曜準備', '同意', 'お疲れさま'],
  },
  {
    author: 10, postedAt: '2026-07-25T17:50:00+09:00', likeSlots: 8,
    title: `${P25}夜 — 来週の材料：決算・半導体・米株`,
    content: 'テスラ・Googleの余波は来週も続く。capex vs 収益の議論。触らない日を先に決める。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['来週', '決算', 'カレンダー'],
    comments: ['触らない日', 'capex議論', '来週材料', 'カレンダー', '同意'],
  },
  {
    author: 11, postedAt: '2026-07-25T18:05:00+09:00', likeSlots: 7,
    title: `${P25}夕方 — 週末のポジションサイズ、紙に書く`,
    content: '64611円割れ後の週末。月曜に備えてサイズ上限10%・分割1回を紙に書く。レバは触らない。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['サイズ', '月曜', 'ルール'],
    comments: ['10%上限', '紙に書く', 'レバ触らない', '同意'],
  },
  {
    author: 4, postedAt: '2026-07-25T19:15:00+09:00', likeSlots: 10,
    title: `${P25}夜 — 64611円割れ、下値の節目はどこ？`,
    content: '24日終値64611円。前週安値圏64141（7/17）が意識されるか。数字だけ先に置く、飛び乗りはしない。',
    ticker: 'N225', sentiment: 'bearish', tags: ['日経平均', '下値', '議論'],
    comments: ['64141意識', '64611メモ', '飛び乗りしない', '節目どこ', '同意', 'わかる'],
  },
  {
    author: 1, postedAt: '2026-07-25T20:30:00+09:00', likeSlots: 5,
    title: `${P25}夜更け — 半導体ウォッチ3銘柄に絞る`,
    content: '情報過多の週末。ウォッチは装置・メモリ・GPUから最大3つ。月曜寄り後に再判定。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['ウォッチリスト', '半導体'],
    comments: ['3銘柄に絞る', '月曜再判定', '情報過多'],
  },
  {
    author: 8, postedAt: '2026-07-25T21:40:00+09:00', likeSlots: 7,
    title: `${P25}夜 — 月曜のチェックリスト3つ`,
    content: '1) 半導体比率 2) 現金比率 3) 寄り30分待ち。週末は売買しない。',
    ticker: '1306.T', sentiment: 'bullish', tags: ['月曜', 'チェックリスト'],
    comments: ['3つやる', '寄り30分', '売買しない', 'わかる'],
  },
  {
    author: 3, postedAt: '2026-07-25T22:05:00+09:00', likeSlots: 4,
    title: `${P25}就寝前 — 分割1回・全額禁止、おやすみ`,
    content: '激しい週を終えてルールは同じ。短く寝て月曜に冷静に。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['おやすみ', 'ルール'],
    comments: ['おやすみ', '冷静に月曜', '全額禁止'],
  },
]

function jstHourKey(isoOrDate) {
  const t = new Date(isoOrDate).getTime() + 9 * 3600000
  const jst = new Date(t)
  return `${jst.toISOString().slice(0, 10)}:${jst.getUTCHours()}`
}

async function fetchCoveredHours() {
  const { data, error } = await admin
    .from('lounge_posts')
    .select('created_at')
    .gte('created_at', '2026-07-24T00:00:00+09:00')
    .lte('created_at', '2026-07-25T23:59:59+09:00')
  if (error) throw error
  const covered = new Set()
  for (const row of data || []) covered.add(jstHourKey(row.created_at))
  return covered
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
  const toInsert = POSTS.filter((p) => !covered.has(jstHourKey(p.postedAt)))
  if (!toInsert.length) {
    console.log('No empty hour buckets to fill (Jul 24-25).')
    return
  }

  console.log(DRY_RUN ? `Dry run — ${toInsert.length} posts…` : `Seeding ${toInsert.length} posts (Jul 24-25 hot issues)…`)

  const personaMap = new Map()
  for (const persona of PERSONAS) {
    personaMap.set(persona.email, await ensurePersona(persona))
  }

  let posts = 0
  let comments = 0
  let likes = 0

  for (const row of toInsert) {
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
