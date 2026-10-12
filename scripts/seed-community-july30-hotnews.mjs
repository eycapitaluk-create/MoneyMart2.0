/**
 * Community: Jul 30 hot news — post-FOMC/Powell, MSFT/Meta earnings, Nikkei ~62k rebound debate,
 * semiconductor dip-buy, KOSPI recovery, defensive rotation, vote.
 * Figures from public reports (2026-07-30 JST). 報道ベース where noted.
 *
 *   node scripts/seed-community-july30-hotnews.mjs
 *   node scripts/seed-community-july30-hotnews.mjs --dry-run
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { COMMUNITY_SEED_PERSONAS } from '../api/_lib/community-seed-personas.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PERSONAS = COMMUNITY_SEED_PERSONAS

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

const POSTS = [
  {
    author: 7,
    postedAt: '2026-07-30T07:15:00+09:00',
    likeSlots: 15,
    title: 'FOMC据え置き＋パウエル会見 — 「利下げはまだ早い」で半導体は？',
    content: '30日未明のFOMCは政策金利を据え置き（報道ベース）。パウエル議長会見では「インフレは下がりつつあるが、利下げ判断は時期尚早」との慎重姿勢。ドル高・米10年債利回り上昇で、ナスダック先物は軟調。日本は寄り前に結果が出たので、半導体（285A・8035・6857）の反応が今日の主役。利下げ期待の織り込みが外れるなら、戻り売り圧力も。損切り線だけ先に確認。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['FOMC', 'パウエル', '米国', '金利'],
    comments: [
      '据え置きは想定内',
      '会見がハト派じゃなかった',
      '半導体先物弱い',
      '利下げ織り込み外し',
      '損切り線更新した',
      '寄り30分待ち',
      'ドル高がキツい',
    ],
  },
  {
    author: 3,
    postedAt: '2026-07-30T08:05:00+09:00',
    likeSlots: 14,
    title: 'MSFT・Meta決算の余韻 — AI投資は続く？capex見通しが半導体の次の鍵',
    content: '29日夜のマイクロソフト・メタ決算。クラウド・広告は堅調でも、AI関連の設備投資（capex）ペースが市場の焦点（報道ベース）。「AIバブル崩壊」論と「調整は買い場」論が真っ二つ。日本株では東エレク・アドバンテストがハイパースケーラーの投資計画に連動しやすい。決算数字だけでなく、ガイダンスの文言を要チェック。全額突っ込み禁止。',
    ticker: 'MSFT',
    sentiment: 'neutral',
    tags: ['MSFT', 'Meta', '決算', 'AI', '半導体'],
    comments: [
      'capexの伸び率が大事',
      'Meta広告は強かった',
      'AI投資は続く派',
      '調整は買い場？',
      '8035が反応しそう',
      'ガイダンス文言チェック',
      '全額禁止わかる',
    ],
  },
  {
    author: 1,
    postedAt: '2026-07-30T09:30:00+09:00',
    likeSlots: 13,
    title: '日経62365円のあと — 今日はリバウンド継続？それともデッドキャット？',
    content: '29日終値は日経62365円（報道ベース）。28日の-3.95％暴落から小幅戻しだが、まだ6万2000円台。FOMC・米ハイテク決算後の30日朝は「本当の底打ち」か「戻り売りの罠」かが論点。前日比でプラスでも出来高が薄ければデッドキャットの可能性。寄り付きで飛び乗らない・30分待ちルール再掲。現金比率メモだけ先に。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['日経平均', 'リバウンド', 'デッドキャット'],
    comments: [
      '62365はまだ重い',
      '出来高が薄いと罠',
      'デッドキャット派',
      '底打ちはまだ早い',
      '寄り30分待ち',
      '現金比率上げた',
      'リバウンド継続派',
    ],
  },
  {
    author: 9,
    postedAt: '2026-07-30T10:45:00+09:00',
    likeSlots: 16,
    title: '討論 — キオクシア(285A)・東エレク(8035)・アドバンテスト(6857)は押し目？まだ待ち？',
    content: '28-29日の半導体暴落で285A・8035・6857は大幅安の流れ。材料は①中国DUV装置②韓国サーキットブレーカー③FOMC慎重姿勢。韓国は反発も、日本はまだ様子見ムード。あなたは？①分割で押し目②まだ待つ（現金比率維持）③ETFコアのみ継続④損切り済みでウォッチのみ',
    ticker: '285A.T',
    sentiment: 'neutral',
    tags: ['キオクシア', '東京エレクトロン', 'アドバンテスト', '投票', '半導体'],
    comments: [
      '①分割で少し買った',
      '②まだ待つ',
      '③コアETF継続',
      '④損切り済み',
      'FOMC後は様子見',
      '韓国連動が怖い',
      '6857の出来高見てる',
    ],
  },
  {
    author: 4,
    postedAt: '2026-07-30T12:00:00+09:00',
    likeSlots: 11,
    title: 'KOSPIサーキットブレーカー後 — 韓国は反発、日本はまだ連動弱い？',
    content: '28日KOSPIは10％超の暴落でサーキットブレーカー発動（報道）。29-30日は韓国半導体（サムスン・SKハイニックス）がリバウンド材料に。日本は28日にすでに大きく調整済みで、今日は韓国の反発が日経に波及するか独自か。ウォッチリストは3銘柄に絞る。全額突っ込み禁止。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['KOSPI', '韓国', 'リバウンド', '半導体'],
    comments: [
      '韓国が先に反発',
      '日本は連動弱い',
      'サムスン決算も今週',
      'ウォッチ3つに絞った',
      'サーキット後は荒い',
      '連動で午後も様子見',
    ],
  },
  {
    author: 10,
    postedAt: '2026-07-30T13:30:00+09:00',
    likeSlots: 10,
    title: 'ディフェンシブ・現金比率 — 半導体暴落後のポートフォリオ再考',
    content: '28-29日の半導体暴落で、グロース一辺倒は痛い週。報道では小売・食料品など内需系が相対的に底堅かったとの見方も。NISAコア（1306・2559等）は継続、サテライト半導体は半分ルール。現金比率を上げた人・上げてない人、どちらが多い？偏りチェックだけ午後に。',
    ticker: '1306.T',
    sentiment: 'bullish',
    tags: ['内需', 'ディフェンシブ', '現金比率', '分散'],
    comments: [
      '現金比率20％に上げた',
      'コアETFは触らない',
      '半導体偏りすぎだった',
      '1306積立継続',
      'サテライト半分ルール',
      '分散の意味わかる',
      'ディフェンシブ買い増し',
    ],
  },
  {
    author: 8,
    postedAt: '2026-07-30T15:00:00+09:00',
    likeSlots: 12,
    title: '投票 — 今日（7/30）あなたの行動は？',
    content: 'FOMC・MSFT/Meta決算後の30日。①現金比率を上げた②損切りした③何もしていない（積立のみ）④分割で少し買った⑤ウォッチリストだけ整理⑥様子見（寄り30分待ち）。コメントで銘柄は書かなくてOK、方針だけ教えてほしい。正解はない日。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['投票', 'メンタル', 'FOMC'],
    comments: [
      '⑥様子見',
      '③積立のみ',
      '④は1割だけ',
      '①現金増やした',
      '②損切りした',
      '⑤リスト整理',
      '正解ない日',
      'お互い様',
    ],
  },
  {
    author: 6,
    postedAt: '2026-07-30T16:20:00+09:00',
    likeSlots: 9,
    title: '午後のメモ — パウエル会見後、日経は6万2000円台で膠着',
    content: '30日午後、日経は6万2000円台で方向感なし（報道ベース）。FOMC据え置き＋慎重会見で半導体は軟調、内需・ディフェンシブは相対強。AAPL 338ドル台、トヨタ7203は3200円台。今夜は追加材料薄め。損切り線とサイズ上限だけ確認して、無理に増やさない。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['日経平均', '午後', 'メモ'],
    comments: [
      '膠着してる',
      '半導体弱い',
      '内需は底堅い',
      '今夜は静観',
      'サイズ上限メモ',
      '無理に増やさない',
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
  const nickname = String(persona.nickname || '').trim()
  let userId = await findUserIdByEmail(email)
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: `MmSeed!${nickname.length}99`,
      email_confirm: true,
      user_metadata: { nickname, display_name: nickname },
    })
    if (error) throw error
    userId = data.user.id
  }
  await admin.from('user_profiles').upsert({
    user_id: userId,
    nickname,
    full_name: null,
  }, { onConflict: 'user_id' })
  const level = persona.exp >= 6000 ? 5 : persona.exp >= 2500 ? 4 : persona.exp >= 900 ? 3 : persona.exp >= 300 ? 2 : 1
  await admin.from('lounge_character_stats').upsert({
    user_id: userId,
    total_exp: persona.exp,
    level,
    character_stage: level,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  return { userId, nickname }
}

async function main() {
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Jul 30 hot-news posts…`)

  const personaMap = new Map()
  for (const persona of PERSONAS) {
    personaMap.set(persona.email, await ensurePersona(persona))
  }

  let posts = 0
  let comments = 0

  for (const row of POSTS) {
    const persona = PERSONAS[row.author]
    const mapped = personaMap.get(persona.email)
    if (!mapped) continue

    const createdAt = new Date(row.postedAt).toISOString()
    const commentTexts = row.comments || []
    const likeSlots = Math.min(PERSONAS.length - 1, Math.max(4, Number(row.likeSlots || 8)))

    const payload = {
      author_id: mapped.userId,
      author_name: mapped.nickname,
      title: row.title,
      content: String(row.content || ''),
      ticker: row.ticker || null,
      asset_type: 'stock',
      sentiment: row.sentiment || 'neutral',
      like_count: likeSlots,
      comment_count: commentTexts.length,
      bookmark_count: Math.floor(likeSlots / 3),
      view_count: 0,
      hot_score: likeSlots * 2 + commentTexts.length * 3 + 55,
      status: 'published',
      created_at: createdAt,
      updated_at: createdAt,
    }

    if (DRY_RUN) {
      console.log(`[dry-run] ${row.title}`)
      posts += 1
      comments += commentTexts.length
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
      if (!commentMapped || commentMapped.userId === mapped.userId) continue
      const commentAt = new Date(new Date(row.postedAt).getTime() + (c + 1) * 9 * 60 * 1000).toISOString()
      await admin.from('lounge_comments').insert({
        post_id: post.id,
        author_id: commentMapped.userId,
        author_name: commentMapped.nickname,
        content: commentTexts[c],
        status: 'published',
        created_at: commentAt,
        updated_at: commentAt,
      })
      comments += 1
    }

    posts += 1
    console.log(`posted: ${row.title.slice(0, 58)}…`)
  }

  console.log(`Done. ${posts} posts, ${comments} comments.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
