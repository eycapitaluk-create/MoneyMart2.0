/**
 * Fill community gaps: 2026-07-19 (Sun) + 2026-07-20 (Mon / Marine Day holiday),
 * and sparse hours on 07-15 / 07-16 / 07-17 evening.
 *
 * Spot market closed 7/18–7/20 (weekend + 海の日). Futures holiday trading on 7/20.
 * Uses known closes only: 7/15 68751 / 7/16 66835 / 7/17 64141.
 *
 *   node scripts/seed-community-gap-fill-july15-20.mjs
 *   node scripts/seed-community-gap-fill-july15-20.mjs --dry-run
 *   node scripts/seed-community-gap-fill-july15-20.mjs --replace
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
const BATCH_KEY = 'july15-20-gapfill-v1'

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

/** Gap-fill posts — evenly spaced; likeSlots = real likes inserted */
const POSTS = [
  // —— 7/15 sparse mid / evening ——
  {
    author: 2, postedAt: '2026-07-15T10:15:00+09:00', likeSlots: 6, batch: BATCH_KEY,
    title: '午前 — 15日は戻し日、半導体以外も見えているか',
    content: '終値イメージは68751円前後の強含み。だが「全部半導体」だと17日のような吐き出しが怖い。午前のうちにヒートマップで金融・内需の相対強さを確認しておく派。',
    ticker: 'N225', sentiment: 'bullish', tags: ['日経平均', 'ヒートマップ', 'ローテ'],
    comments: ['ヒートマップ見る', '内需もチェック', '同意', '偏りメモ'],
  },
  {
    author: 7, postedAt: '2026-07-15T18:05:00+09:00', likeSlots: 8, batch: BATCH_KEY,
    title: '引け後メモ — +1008円の68751、明日も同じリズムは期待しない',
    content: '上げ日こそサイズ確認。明日以降のギャップに備えてサテライトは半分ルール。コアETFは予定通り。',
    ticker: 'N225', sentiment: 'neutral', tags: ['大引け', 'リスク管理'],
    comments: ['半分ルール', 'コア継続', '上げ日の罠注意', 'メモした', '同意'],
  },

  // —— 7/16 sparse ——
  {
    author: 4, postedAt: '2026-07-16T08:20:00+09:00', likeSlots: 5, batch: BATCH_KEY,
    title: '寄り前 — 15日上げのあと、吐き出し警戒は妥当か',
    content: '昨日の戻りを全部信じない。寄り後30分は様子見。半導体の需給ニュースが出やすい局面。',
    ticker: 'TOPIC', sentiment: 'bearish', tags: ['寄り付き', '半導体'],
    comments: ['様子見', '吐き出し警戒', 'わかる'],
  },
  {
    author: 11, postedAt: '2026-07-16T12:40:00+09:00', likeSlots: 9, batch: BATCH_KEY,
    title: '昼 — 日経が重い、終値66835円付近のイメージで頭を整理',
    content: '午前から下げが効いている。数字だけ先に置く：終値66835円、-1915円級。積立は触らず、個別は損切り線だけ。',
    ticker: 'N225', sentiment: 'bearish', tags: ['日経平均', '昼休み'],
    comments: ['66835メモ', '積立触らない', '損切り確認', '重い', '同意', '現金比率'],
  },
  {
    author: 0, postedAt: '2026-07-16T16:50:00+09:00', likeSlots: 7, batch: BATCH_KEY,
    title: '後場メモ — 吐き出しの日は「やらないこと」リスト再掲',
    content: 'やらない：積立停止、レバ、今が底飛び乗り。やる：現金メモ、コア継続。明日もボラ警戒。',
    ticker: '1306.T', sentiment: 'neutral', tags: ['NISA', 'メンタル'],
    comments: ['リスト使う', 'レバやめる', 'コア継続', 'わかる'],
  },

  // —— 7/17 evening gap ——
  {
    author: 5, postedAt: '2026-07-17T19:35:00+09:00', likeSlots: 10, batch: BATCH_KEY,
    title: '夜 — 64141円引けのあと、連休中に何を見るか',
    content: '2694円安は過去級。連休は先物と海外半導体ニュースだけ。月曜（海の日）は現物休場なので、火曜寄付きまでサイズは触らない。',
    ticker: 'N225', sentiment: 'neutral', tags: ['連休', '先物', '振り返り'],
    comments: ['火曜まで待つ', '先物だけ', '過去級だった', 'サイズ触らない', '同意', 'お疲れさま'],
  },
  {
    author: 9, postedAt: '2026-07-17T21:20:00+09:00', likeSlots: 4, batch: BATCH_KEY,
    title: '就寝前 — 健全調整派とトレンド終了派、コメントで投票',
    content: '両方あり得る。私は中立：分割1・全額禁止。連休明けの動きで再判定。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['議論', '投票'],
    comments: ['中立', '健全調整派', '終了派'],
  },

  // —— 7/19 Sunday (empty day) ——
  {
    author: 1, postedAt: '2026-07-19T08:10:00+09:00', likeSlots: 8, batch: BATCH_KEY,
    title: '日曜朝 — 連休2日目、頭の中の数字だけ整理',
    content: '先週終値64141円（-2694）。週末の先物は戻した場面もあったが、現物は月曜海の日で休場。火曜に備えてウォッチリストの損切り線だけ見直す。',
    ticker: 'N225', sentiment: 'neutral', tags: ['連休', '日曜', '準備'],
    comments: ['火曜備え', '損切り見直し', '64141メモ', '先物は参考', '同意'],
  },
  {
    author: 8, postedAt: '2026-07-19T10:25:00+09:00', likeSlots: 5, batch: BATCH_KEY,
    title: 'セミナー代わり — 急落週のあとで読む「やること3つ」',
    content: '1) 半導体比率の偏り確認 2) コアETF継続 3) サテライト半分。SNSの今が底は読まない。',
    ticker: '1306.T', sentiment: 'bullish', tags: ['NISA', 'ルール'],
    comments: ['3つやる', '偏りチェック', '底読まない'],
  },
  {
    author: 3, postedAt: '2026-07-19T12:40:00+09:00', likeSlots: 11, batch: BATCH_KEY,
    title: '昼討論 — 火曜寄付き、買いたい派？見送り派？',
    content: '海の日明けの火曜が実質の次の現物営業日。押し目買いは分割だけ。全額は禁止。投票どうぞ。',
    ticker: 'N225', sentiment: 'neutral', tags: ['投票', '押し目', '火曜'],
    comments: ['見送り派', '分割だけ', '火曜様子見', '押し目派', '全額禁止', 'おもしろい', '同意'],
  },
  {
    author: 6, postedAt: '2026-07-19T15:05:00+09:00', likeSlots: 6, batch: BATCH_KEY,
    title: '午後 — 来週の決算カレンダーを先に書く',
    content: '国内外のAI・装置・好業績銘柄が続きやすい週。材料前にサイズを膨らませない。触らない日を先に決める。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['決算', 'カレンダー'],
    comments: ['カレンダー書いた', '触らない日', 'サイズ注意', 'わかる'],
  },
  {
    author: 10, postedAt: '2026-07-19T17:30:00+09:00', likeSlots: 9, batch: BATCH_KEY,
    title: '夕方 — 為替と輸出株、連休明けの二重リスク',
    content: '円高が進むと輸出・半導体の期待EPSも下がりやすい。円建てコア相対優位。個別はサイズ確認だけ。',
    ticker: 'USDJPY', sentiment: 'bearish', tags: ['為替', '円高'],
    comments: ['円建てコア', 'サイズ確認', '二重リスク', '同感', 'メモ'],
  },
  {
    author: 4, postedAt: '2026-07-19T19:45:00+09:00', likeSlots: 7, batch: BATCH_KEY,
    title: '夜 — 月曜は現物休場、祝日先物だけ見る人いる？',
    content: '海の日は現物休み。先物は祝日取引ありだが流動性は薄い。無理に触らない。火曜のギャップ想定だけメモ。',
    ticker: 'N225', sentiment: 'neutral', tags: ['海の日', '先物', '休場'],
    comments: ['触らない', '流動性薄い', '火曜ギャップ', '先物だけ見る'],
  },
  {
    author: 2, postedAt: '2026-07-19T21:20:00+09:00', likeSlots: 4, batch: BATCH_KEY,
    title: '就寝前 — 連休中のメンタルだけ整える',
    content: 'やらない：積立停止、レバ、ニュース飛び乗り。やる：現金比率メモ、コア継続。火曜に冷静にサイズ確認。',
    ticker: 'TOPIC', sentiment: 'bullish', tags: ['メンタル', 'ルール'],
    comments: ['メンタル大事', 'コア継続', '火曜冷静に'],
  },

  // —— 7/20 Marine Day (empty day) ——
  {
    author: 0, postedAt: '2026-07-20T07:35:00+09:00', likeSlots: 8, batch: BATCH_KEY,
    title: '海の日朝 — 現物休場、チャートは「復習」だけ',
    content: '今日は現物なし。先週の64141円からの位置だけ確認。売買はしない日。先物は薄いので参考値扱い。',
    ticker: 'N225', sentiment: 'neutral', tags: ['海の日', '休場'],
    comments: ['売買しない', '復習だけ', '64141', '先物参考', '同意'],
  },
  {
    author: 9, postedAt: '2026-07-20T09:20:00+09:00', likeSlots: 5, batch: BATCH_KEY,
    title: '祝日先物 — 今日動かす人の注意点',
    content: '祝日取引は約定しにくい・スプレッド広い可能性。証拠金と建玉の管理を。個人はパスでいい局面も多い。',
    ticker: 'N225', sentiment: 'bearish', tags: ['先物', '祝日取引'],
    comments: ['パスでいい', '流動性注意', 'わかる'],
  },
  {
    author: 7, postedAt: '2026-07-20T11:05:00+09:00', likeSlots: 10, batch: BATCH_KEY,
    title: '午前 — 火曜寄付きシミュレーション（サイズ編）',
    content: 'ギャップアップでも全額突っ込まない。ギャップダウンでもパニック売りしない。分割1回ルールを紙に書く。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['火曜', 'サイズ', 'ルール'],
    comments: ['紙に書いた', '分割1', 'パニック売り禁止', 'ギャップ注意', '同意', 'いいリスト'],
  },
  {
    author: 5, postedAt: '2026-07-20T12:50:00+09:00', likeSlots: 6, batch: BATCH_KEY,
    title: '昼 — NISA成長枠の偏り、連休最終チェック',
    content: '半導体比率・現金比率・コア比率だけ見る。売買はしない。火曜以降の行動リスト作成。',
    ticker: '1306.T', sentiment: 'bullish', tags: ['NISA', '偏り'],
    comments: ['売買しない', '比率チェック', 'リスト作成', '積立継続'],
  },
  {
    author: 11, postedAt: '2026-07-20T14:35:00+09:00', likeSlots: 9, batch: BATCH_KEY,
    title: '午後投票 — 火曜、押し目買いは何割？',
    content: '資金の0 / 10 / 30%で投票したい。私は最大10%・分割。残りは様子見。',
    ticker: 'N225', sentiment: 'neutral', tags: ['投票', '押し目'],
    comments: ['0%様子見', '10%分割', '30%攻める', '最大10', 'おもしろい', '賛成'],
  },
  {
    author: 3, postedAt: '2026-07-20T16:20:00+09:00', likeSlots: 4, batch: BATCH_KEY,
    title: '半導体ウォッチ — 休場中に見るべき海外材料',
    content: 'TSMC/ASML系の海外ニュースと米指数だけ。日本個別は火曜まで触らない。ウォッチリスト固定のみ。',
    ticker: 'TSM', sentiment: 'bearish', tags: ['半導体', '海外'],
    comments: ['触らない', 'ウォッチ固定', '海外材料'],
  },
  {
    author: 8, postedAt: '2026-07-20T18:05:00+09:00', likeSlots: 11, batch: BATCH_KEY,
    title: '夕方 — 銀行・商社の相対強さ、火曜の物色ヒント',
    content: '急落週に粘ったバリューは継続か。全部乗り換えはやりすぎ。偏り是正の候補として薄くだけ意識。',
    ticker: '8306.T', sentiment: 'bullish', tags: ['銀行', '商社', 'ローテ'],
    comments: ['薄く意識', '乗り換えやりすぎ', 'バリュー', '同意', 'ヒントありがたい', '偏り是正', 'わかる'],
  },
  {
    author: 1, postedAt: '2026-07-20T19:50:00+09:00', likeSlots: 7, batch: BATCH_KEY,
    title: '夜 — 連休最終日のルール再掲',
    content: 'やらない：積立停止、レバ、飛び乗り。やる：現金メモ、コア継続、火曜の損切り線。64141は記憶に残す。お疲れさま。',
    ticker: 'TOPIC', sentiment: 'bullish', tags: ['連休', 'ルール', 'メンタル'],
    comments: ['お疲れさま', '火曜損切り', '積立継続', '64141', 'レバ触らない'],
  },
  {
    author: 6, postedAt: '2026-07-20T21:25:00+09:00', likeSlots: 5, batch: BATCH_KEY,
    title: '就寝前 — 明日（火曜）のチェックリスト',
    content: '寄り30分は触らない／サイズ上限確認／ニュースは一次情報だけ。連休終わり、短く眠る。',
    ticker: 'N225', sentiment: 'neutral', tags: ['火曜', 'チェックリスト'],
    comments: ['寄り30分待ち', 'サイズ上限', 'おやすみ'],
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

async function findBatchPostIds() {
  const ids = new Set()
  const times = POSTS.map((p) => new Date(p.postedAt).getTime()).filter(Number.isFinite)
  if (!times.length) return []
  // Only target posts whose title matches our batch titles (avoid wiping older seeds)
  const titles = new Set(POSTS.map((p) => p.title))
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
  for (const row of data || []) {
    if (titles.has(row.title)) ids.add(row.id)
  }
  return [...ids]
}

async function purgeExisting() {
  const seedIds = await findBatchPostIds()
  if (seedIds.length === 0) return
  if (DRY_RUN) {
    console.log(`  would remove ${seedIds.length} gap-fill posts`)
    return
  }
  await admin.from('lounge_comments').delete().in('post_id', seedIds)
  await admin.from('lounge_post_tags').delete().in('post_id', seedIds)
  await admin.from('lounge_post_likes').delete().in('post_id', seedIds)
  await admin.from('lounge_post_bookmarks').delete().in('post_id', seedIds)
  await admin.from('lounge_posts').delete().in('id', seedIds)
  console.log(`  removed ${seedIds.length} old gap-fill posts`)
}

async function main() {
  const existingIds = await findBatchPostIds()
  if (existingIds.length && !REPLACE) {
    console.log('Gap-fill seed already exists. Use --replace to rebuild.')
    return
  }

  console.log(DRY_RUN ? 'Dry run (gap-fill)…' : REPLACE ? 'Replace gap-fill…' : 'Seeding gap-fill posts…')
  if (REPLACE || existingIds.length) await purgeExisting()

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
      console.log(`[dry-run] ${row.postedAt} ${row.title} (+${commentTotal}c / ${likeSlots}♥)`)
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

  console.log(`Done. ${posts} posts, ${comments} comments, ${likes} likes (gap-fill 7/15–7/20).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
