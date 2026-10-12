/**
 * Seed community posts dated 2026-07-04 (JST) with varied times + comments.
 *
 *   node scripts/seed-community-july4-posts.mjs
 *   node scripts/seed-community-july4-posts.mjs --dry-run
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
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim()
const SERVICE_KEY = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '',
).trim()

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const SEED_MARKER = 'mm-community-seed-july4-v1'

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

/** Posts on 2026-07-04 JST — postedAt is ISO with +09:00 */
const POSTS = [
  {
    author: 0, postedAt: '2026-07-04T07:18:00+09:00',
    title: '7/4朝 — 日経先物は小幅高、米Independence Day休場',
    content: '今日は米国市場休場。日本株は海外勢のフローが薄くなりやすい日。前日のV字回復の続きか、利確売りか。個人的には様子見寄り。半導体は引き続き強いが、銀行・商社も底堅い。',
    ticker: 'N225', sentiment: 'neutral', tags: ['日経平均', '米国休場', 'IndependenceDay'],
    likes: 89,
    comments: ['米休場はボラ落ち着く日ですね。', '半導体だけ強いのは続きそう。', '利確売り来るかも、半分だけ減らしました。'],
  },
  {
    author: 3, postedAt: '2026-07-04T08:52:00+09:00',
    title: '独立記念日 — 米株休みでもドル円160円台は動く',
    content: '米国株は休場でも為替は動く。ドル円160.5付近。円安メリットの輸出株は底堅いが、輸入コスト増の内需は逆風。トヨタ・ソニー・キーエンスあたりは為替感応度チェック。',
    ticker: 'USDJPY', sentiment: 'bearish', tags: ['円安', 'ドル円', '為替'],
    likes: 112,
    comments: ['為替だけ動く日は読みにくい。', 'トヨタは円安で助かってる。', '160円超えたら介入来る？'],
  },
  {
    author: 1, postedAt: '2026-07-04T09:35:00+09:00',
    title: '寄付き — 半導体・銀行が牽引、出遅れ内需も買われ始め',
    content: '寄付きから半導体(Rohm, SUMCO)とメガバンクがプラス。イオン・ツルハなど内需も小幅高。セクターローテの続き。TOPIXは+0.4%スタート。米休場でも国内資金の物色は続いてる印象。',
    ticker: 'TOPIX', sentiment: 'bullish', tags: ['寄付き', '半導体', '銀行株'],
    likes: 134,
    comments: ['内需も動き出した。', 'TOPIX連日高はすごい。', 'Rohm強いですね。'],
  },
  {
    author: 8, postedAt: '2026-07-04T10:47:00+09:00',
    title: 'Kioxia(285A) — メモリ回復サイクル入り？',
    content: 'Kioxiaが年初来高値圏。AI推論需要でHBMだけじゃなく汎用DRAMも底打ち。SUMCOのウェハー需給も改善。日本の半導体は装置(TEL)・素材(SUMCO)・メモリ(Kioxia)の3本柱で見るべき。',
    ticker: '285A', sentiment: 'bullish', tags: ['Kioxia', '半導体', 'メモリ'],
    likes: 156,
    comments: ['285A IPO後初の大きな上昇。', 'TELとセットで見てます。', 'メモリサイクル底は見えた？'],
  },
  {
    author: 6, postedAt: '2026-07-04T12:08:00+09:00',
    title: '昼休み — 新NISAつみたて日、今日は何買った？',
    content: '毎月4日はつみたて投資の日。自分はオルカン60%+日経225 ETF 20%+S&P500 20%。米休場でも積立は淡々と。長期目線なら今日の値動きは気にしない派。',
    ticker: 'NISA', sentiment: 'neutral', tags: ['新NISA', '積立投資', 'つみたて'],
    likes: 198,
    comments: ['オルカン100%派です。', '今日は日経225 ETF追加。', '積立日をカレンダーに入れてます。', '米休場でも積立は続ける。'],
  },
  {
    author: 4, postedAt: '2026-07-04T13:22:00+09:00',
    title: '骨太ショック後の国債 — 長期金利2.81%は落ち着いた？',
    content: '7/3に2.81%まで上がった長期金利。今日は小幅低下で2.77%付近。骨太の方針への反応は一服？メガバンクは利ザヤ改善期待で堅調。REITはまだ逆風。',
    ticker: '8306', sentiment: 'neutral', tags: ['長期金利', '骨太ショック', '国債'],
    likes: 87,
    comments: ['金利3%が次の節目。', '銀行株は金利上昇で助かる。', 'REITは様子見。'],
  },
  {
    author: 9, postedAt: '2026-07-04T14:55:00+09:00',
    title: '商社株 — バフェット銘柄がまた話題に',
    content: '三菱商事・伊藤忠・三井物産。バフェット効果+円安+資源高の三重奏。配当利回り3%台+自社株買い。長期ホールド向き。今日も小幅高。',
    ticker: '8058', sentiment: 'bullish', tags: ['商社株', 'バフェット', '高配当'],
    likes: 143,
    comments: ['伊藤忠のROEが光る。', 'バフェットは長期で見る。', '配当再投資してます。'],
  },
  {
    author: 2, postedAt: '2026-07-04T15:38:00+09:00',
    title: '大引け前 — 日経+0.6%で堅調、米休場でも買い優勢',
    content: '15時半時点で日経+0.6%、TOPIX+0.5%。半導体・銀行・商社が牽引。海外勢の買いは少ないが、個人・国内機関の買いが支え。大引けまで様子見。',
    ticker: 'N225', sentiment: 'bullish', tags: ['大引け', '日経平均', 'セクターローテ'],
    likes: 167,
    comments: ['米休場でも堅い。', '個人の待機資金が効いてる？', '大引けギャンブルはしない派。'],
  },
  {
    author: 7, postedAt: '2026-07-04T16:45:00+09:00',
    title: '7/4大引け — 日経+0.7%で3連続高、セクター分散が効いた日',
    content: '大引け：日経+0.7%、TOPIX+0.5%。半導体(Rohm+3%)、銀行(メガバンク+1.5%)、商社(+0.8%)と幅広く上昇。米休場でも国内主導で堅調。明日から米国再開、CPI・雇用統計に注目。',
    ticker: 'N225', sentiment: 'bullish', tags: ['大引け', '日経平均', 'セクターローテ'],
    likes: 221,
    comments: ['3連続高すごい。', '幅広い上昇は健全。', '明日米国再開が波乱要因。', 'セクター分散、正解だった。'],
  },
  {
    author: 10, postedAt: '2026-07-04T18:12:00+09:00',
    title: '夜 — 米国再開前のポジション整理',
    content: '7/5から米国市場再開。Independence Day明けはギャップの可能性。半導体は強いが、金利・為替のニュースに注意。ポジションは半分利確、残りは様子見。',
    ticker: 'SPY', sentiment: 'neutral', tags: ['米国株', 'ポジション', 'IndependenceDay'],
    likes: 76,
    comments: ['半分利確、同じです。', 'ギャップアップ来るかも。', '金利ニュース怖い。'],
  },
  {
    author: 5, postedAt: '2026-07-04T19:40:00+09:00',
    title: '配当金生活 — 7月の配当入金、再投資する？',
    content: '7月は配当集中月。JT・KDDI・三菱商事など。配当金は再投資派。複利効果で5年後に差が出る。新NISAなら非課税でさらに有利。',
    ticker: '2914', sentiment: 'bullish', tags: ['配当金', '高配当', 'FIRE'],
    likes: 134,
    comments: ['再投資派です。', 'JTの配当安定。', '非課税の威力。'],
  },
  {
    author: 11, postedAt: '2026-07-04T21:05:00+09:00',
    title: '夜更け — 米国先物は小幅高、明日の日経は？',
    content: 'S&P500先物は+0.2%程度。Independence Day明けで様子見ムード。明日の日経は小幅続伸か、利確売りか。個人的には+0.3%程度の続伸予想。',
    ticker: 'ES', sentiment: 'bullish', tags: ['米国先物', '日経平均', 'IndependenceDay'],
    likes: 98,
    comments: ['先物小幅高は安心。', '利確売り来るかも。', '続伸予想、同意。'],
  },
  {
    author: 0, postedAt: '2026-07-04T22:33:00+09:00',
    title: '7/4振り返り — 米休場でも堅調、セクター分散の勝利',
    content: '今日は米国休場。日経+0.7%で3連続高。半導体・銀行・商社・内需と幅広く上昇。海外勢の買いは少なかったが、国内資金が支え。7/5米国再開、7/9ファストリ決算、7/14米決算シーズンとイベント続く。',
    ticker: 'N225', sentiment: 'bullish', tags: ['振り返り', '日経平均', 'セクターローテ'],
    likes: 187,
    comments: ['堅調な一日でした。', 'セクター分散効いた。', '明日米国再開。', 'ファストリ決算楽しみ。'],
  },
  {
    author: 3, postedAt: '2026-07-04T23:51:00+09:00',
    title: '7/4最終 — 日銀7/30会合まであと26日',
    content: '日銀追加利上げ観測はOIS30%。7/30までに円安・物価・金利の動きで見通し変わる。それまでポジションは守り寄り。高配当+銀行でディフェンシブ。',
    ticker: 'JPY', sentiment: 'bearish', tags: ['日銀', '金利', '7月'],
    likes: 112,
    comments: ['7/30が分岐点。', '守り寄り、同意。', '銀行+高配当、同じ構成。'],
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

async function main() {
  const existing = await findSeedPostIds()
  if (existing.length) {
    console.log('July 4 seed already exists. Skip.')
    return
  }

  console.log(DRY_RUN ? 'Dry run (July 4 posts)…' : 'Seeding July 4 posts…')

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
    const hotScore = row.likes * 2 + commentTotal * 3 + 50
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
      view_count: row.likes * 12 + commentTotal * 30,
      hot_score: hotScore,
      status: 'published',
      created_at: createdAt,
      updated_at: createdAt,
    }

    if (DRY_RUN) {
      console.log(`[dry-run] ${row.postedAt} ${row.title}`)
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
      const commentAt = new Date(baseMs + (c + 1) * 4 * 60000 + c * 90000).toISOString()
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

  console.log(`Done. ${posts} posts, ${comments} comments (2026-07-04 JST).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
