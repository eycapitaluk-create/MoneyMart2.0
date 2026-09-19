/**
 * Community seed: 2026-07-24 (JST) — Tesla plunge, Alphabet capex, semi outlook debates.
 * Uses reported US moves (7/23 close): TSLA ~-14.5%, GOOGL ~-7%, AI capex concerns.
 * No fabricated JP index closes for 7/24.
 *
 *   node scripts/seed-community-july24-posts.mjs
 *   node scripts/seed-community-july24-posts.mjs --dry-run
 *   node scripts/seed-community-july24-posts.mjs --replace
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
const BATCH_KEY = 'july24-v1'
const PREFIX = '【7/24】'

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
  {
    author: 4, postedAt: '2026-07-24T05:50:00+09:00', likeSlots: 9,
    title: `${PREFIX}早朝 — テスラ約14%安・Google約7%安、AI設備投資が売り材料に`,
    content: '米7/23引け：テスラが約14.5%下落（2025年3月以来の大幅安）、Alphabetも約7%安。決算自体は売上堅いが、AI向け設備投資（capex）増とマイナスFCFが嫌気。日本は寄り前に半導体・マグセブの連想売り警戒。',
    ticker: 'TSLA', sentiment: 'bearish', tags: ['テスラ', 'Google', '決算', 'AI'],
    comments: ['capexが重い', 'テスラ14%は大きい', '半導体連想売り?', 'FCFマイナス', '寄り前警戒', '同意'],
  },
  {
    author: 1, postedAt: '2026-07-24T07:15:00+09:00', likeSlots: 7,
    title: `${PREFIX}朝 — 「AIに金を焼く」は行き過ぎ？それとも必須投資？`,
    content: 'Googleはクラウド+82%と好調なのに株価は下落。capexガイド1950〜2050億ドルに上方。テスラも年間250億ドル超の投資を継続。議論：近い将来の利益より先に株価がつらい局面か。',
    ticker: 'GOOGL', sentiment: 'neutral', tags: ['議論', 'AI', '設備投資'],
    comments: ['必須投資派', '行き過ぎ派', 'クラウド+82%は強い', 'capex先行', 'わかる', 'おもしろい'],
  },
  {
    author: 9, postedAt: '2026-07-24T08:35:00+09:00', likeSlots: 8,
    title: `${PREFIX}寄り前 — 半導体は「連想売り」か「選別買い」か`,
    content: 'NVDA・装置・日本半導体株は米テックのcapex懸念と相殺。AI需要は残るが、バリュエーション調整は続きうる。寄り後30分は触らない派。',
    ticker: 'NVDA', sentiment: 'neutral', tags: ['半導体', '議論', '寄り前'],
    comments: ['選別買い派', '連想売り派', '寄り30分待ち', '装置株どう', '同意'],
  },
  {
    author: 0, postedAt: '2026-07-24T09:20:00+09:00', likeSlots: 11,
    title: `${PREFIX}寄り — テスラ決算：EPS33セント予想割れ、売上は上振れ`,
    content: '調整後EPS33セント（予想50セント前後に未達の報道）。売上は堅いが営業費+47%、Q2設備投資は前年比+142%。ロボタクシー・Optimus・半導体ラインへの投資が焦点。押し目派と見送り派、どっち？',
    ticker: 'TSLA', sentiment: 'bearish', tags: ['テスラ', '決算', '投票'],
    comments: ['見送り派', '押し目は分割', 'Optimusまだ先', 'EPSミス重い', '売上は良い', '全額禁止', 'おもしろい'],
  },
  {
    author: 8, postedAt: '2026-07-24T10:30:00+09:00', likeSlots: 10,
    title: `${PREFIX}前場 — Google：クラウド好調でも株は安い理由`,
    content: 'クラウド売上+82%（約248億ドル）と好調なのに株価は約7%安。capex上方修正とFCFマイナスが先に価格に織り込まれた形。検索・広告は強いが「AI請求書」が怖い、という見方。',
    ticker: 'GOOGL', sentiment: 'bearish', tags: ['Google', 'クラウド', '決算'],
    comments: ['クラウド82%すごい', 'capexが怖い', '請求書織り込み', '広告は強い', '同意', '様子見'],
  },
  {
    author: 3, postedAt: '2026-07-24T11:15:00+09:00', likeSlots: 6,
    title: `${PREFIX}前場討論 — テスラ、個別は触る？NISAコアだけ？`,
    content: '大幅安の翌日は飛び乗り禁止。コアETF継続、個別テスラはサイズ1割上限・分割だけ。レバは触らない。',
    ticker: 'TSLA', sentiment: 'neutral', tags: ['テスラ', 'NISA', 'サイズ'],
    comments: ['コアだけ', '1割上限', 'レバ触らない', '分割だけ', '同意'],
  },
  {
    author: 7, postedAt: '2026-07-24T12:25:00+09:00', likeSlots: 8,
    title: `${PREFIX}昼 — 半導体の「次の一手」：メモリ vs 装置 vs GPU`,
    content: 'テスラ・Googleのcapex増は中長期では装置・GPU需要の材料にもなるが、短期はマルチプル圧縮。メモリ回復サイクルとAI投資サイクル、どちらが先に株価に効くか議論したい。',
    ticker: 'NVDA', sentiment: 'bullish', tags: ['半導体', '議論', 'メモリ'],
    comments: ['装置株', 'GPU主導', 'メモリ回復', 'マルチプル圧縮', '中長期は需要', 'わかる', '同意'],
  },
  {
    author: 11, postedAt: '2026-07-24T13:35:00+09:00', likeSlots: 9,
    title: `${PREFIX}後場 — 日本半導体：連想売りで買える？`,
    content: '東エレク・キオクシア・アドテストなど、米テックの設備投資ストーリーは残る。ただし指数が弱い日はベータで下げやすい。新規は半分ルール。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['半導体', '日本株', '押し目'],
    comments: ['半分ルール', 'ベータ注意', 'ストーリーは残る', '連想売りで拾う?', '同意', 'サイズ控えめ'],
  },
  {
    author: 5, postedAt: '2026-07-24T14:45:00+09:00', likeSlots: 11,
    title: `${PREFIX}午後投票 — AI設備投資、今は「怖い」派？「チャンス」派？`,
    content: 'テスラ・Googleに続き、他のハイテクもcapex増の圧力。怖い派＝マルチプル調整続く。チャンス派＝2〜3年後の収益に先回り。あなたはどちら？',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['投票', 'AI', '議論'],
    comments: ['怖い派', 'チャンス派', '両方ある', '2〜3年先', 'capex地獄', 'おもしろい', '同意'],
  },
  {
    author: 2, postedAt: '2026-07-24T15:40:00+09:00', likeSlots: 7,
    title: `${PREFIX}大引け前 — 米株急落のあと、日本は相対的に強い？弱い？`,
    content: '円高・輸出株・半導体の組み合わせで日経の反応は一様じゃない。大引け前の新規は避け、明日の米株・先物だけ見る。',
    ticker: 'N225', sentiment: 'neutral', tags: ['大引け', '日経平均'],
    comments: ['新規避ける', '相対強弱見る', '先物明日', '円高注意', '同意'],
  },
  {
    author: 6, postedAt: '2026-07-24T16:35:00+09:00', likeSlots: 6,
    title: `${PREFIX}引け間際 — テスラ・Google振り返りメモ`,
    content: 'テスラ：大幅安・EPSミス・capex増・FCFマイナス。Google：クラウド好調もcapex上方で株安。半導体は選別。終値は確定後に記録。',
    ticker: 'TSLA', sentiment: 'bearish', tags: ['振り返り', '決算'],
    comments: ['メモした', '選別が大事', '確定後に記録', 'FCF注意'],
  },
  {
    author: 10, postedAt: '2026-07-24T17:55:00+09:00', likeSlots: 10,
    title: `${PREFIX}夕方 — やらないこと：テスラ底値拾い全額、レバ、積立停止`,
    content: 'やらない：決算翌日の全額突っ込み、レバ、ニュース飛び乗り。やる：コアETF継続、現金比率メモ、サイズ上限。',
    ticker: '1306.T', sentiment: 'neutral', tags: ['ルール', 'メンタル', 'NISA'],
    comments: ['全額禁止', 'コア継続', 'リスト使う', 'お疲れさま', 'レバやめる', '同意'],
  },
  {
    author: 4, postedAt: '2026-07-24T19:20:00+09:00', likeSlots: 8,
    title: `${PREFIX}夜 — 金曜の米株・半導体は週末どう持つ？`,
    content: 'テスラ・Googleのcapex議論は来週も続く。週末はポジションサイズと損切り線だけ確認。新規は月曜寄り後に。',
    ticker: 'NVDA', sentiment: 'neutral', tags: ['週末', '半導体', '米株'],
    comments: ['月曜寄り後', '損切り確認', '週末は触らない', 'capex議論続く', '同意'],
  },
  {
    author: 1, postedAt: '2026-07-24T20:50:00+09:00', likeSlots: 5,
    title: `${PREFIX}夜更け — 半導体ウォッチリスト、来週の材料`,
    content: '米ハイテクのcapex・クラウド成長・メモリサイクル。日本は装置・材料・メモリで分ける。リストは3銘柄までに絞る。',
    ticker: 'TOPIC', sentiment: 'bullish', tags: ['ウォッチリスト', '半導体'],
    comments: ['3銘柄に絞る', '装置・材料', '来週材料', 'わかる'],
  },
  {
    author: 8, postedAt: '2026-07-24T22:10:00+09:00', likeSlots: 4,
    title: `${PREFIX}就寝前 — 明日も分割1回・全額禁止`,
    content: 'テスラ急落で慌てない。ルールは同じ。おやすみ。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['おやすみ', 'ルール'],
    comments: ['慌てない', 'おやすみ', '分割1回'],
  },
]

function jstHourKey(isoOrDate) {
  const t = new Date(isoOrDate).getTime() + 9 * 3600000
  const jst = new Date(t)
  return `${jst.toISOString().slice(0, 10)}:${jst.getUTCHours()}`
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
      user_metadata: { full_name: persona.name, display_name: persona.name, seed: BATCH_KEY },
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
  const titles = new Set(POSTS.map((p) => p.title))
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
  if (!authorIds.length) return []
  const { data } = await admin
    .from('lounge_posts')
    .select('id,title')
    .in('author_id', authorIds)
    .gte('created_at', minAt)
    .lte('created_at', maxAt)
  return (data || []).filter((r) => titles.has(r.title)).map((r) => r.id)
}

async function purgeExisting() {
  const seedIds = await findSeedPostIds()
  if (!seedIds.length) return
  if (DRY_RUN) {
    console.log(`  would remove ${seedIds.length} july24 posts`)
    return
  }
  await admin.from('lounge_comments').delete().in('post_id', seedIds)
  await admin.from('lounge_post_tags').delete().in('post_id', seedIds)
  await admin.from('lounge_post_likes').delete().in('post_id', seedIds)
  await admin.from('lounge_post_bookmarks').delete().in('post_id', seedIds)
  await admin.from('lounge_posts').delete().in('id', seedIds)
  console.log(`  removed ${seedIds.length} old july24 posts`)
}

async function main() {
  const covered = new Set()
  const { data: existing } = await admin
    .from('lounge_posts')
    .select('created_at')
    .gte('created_at', '2026-07-24T00:00:00+09:00')
    .lte('created_at', '2026-07-24T23:59:59+09:00')
  for (const row of existing || []) covered.add(jstHourKey(row.created_at))

  const existingIds = await findSeedPostIds()
  if (existingIds.length && !REPLACE) {
    console.log('July 24 seed already exists. Use --replace to rebuild.')
    return
  }
  if (REPLACE || existingIds.length) await purgeExisting()

  const toInsert = POSTS.filter((p) => !covered.has(jstHourKey(p.postedAt)))
  if (!toInsert.length) {
    console.log('All July 24 hour buckets already covered.')
    return
  }

  console.log(DRY_RUN ? `Dry run — ${toInsert.length} posts…` : `Seeding ${toInsert.length} July 24 posts…`)

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

  console.log(`Done. ${posts} posts, ${comments} comments, ${likes} likes (July 24).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
