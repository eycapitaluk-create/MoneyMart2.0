/**
 * Community: Jul 29 hot news — SK Hynix earnings, post-crash Nikkei, FOMC, MSFT/Meta.
 * Figures from public reports (2026-07-29 JST). 報道ベース where noted.
 *
 *   node scripts/seed-community-july29-hotnews.mjs
 *   node scripts/seed-community-july29-hotnews.mjs --dry-run
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
    author: 4,
    postedAt: '2026-07-29T07:35:00+09:00',
    likeSlots: 13,
    title: 'SKハイニックス決算 — 営業益+557％過去最高なのに「予想下回り」、どう読む？',
    content: '29日朝、SKハイニックスが4-6月決算を発表。営業利益は前年比557％増の約60.5兆ウォンで過去最高（ロイター等）。ただ市場予想（約64兆ウォン）は下回った。HBM・AI向けは好調でも、従来型DRAM価格の恩恵が相対的に薄いとの分析も。株価は前日から14％超安の流れの中での決算。日本株投資家は「韓国ADR・KOSPIの反発材料になるか」「予想下振れでさらに売られるか」が論点。全額突っ込み禁止。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['SKハイニックス', '決算', '韓国', '半導体'],
    comments: [
      '過去最高でもサプライズは弱い',
      'HBMは強いはず',
      '予想下振れでギャップダウン?',
      '日本は285Aと装置株が連動',
      '分割で様子見',
      '決算後に方向感',
      'おもしろい',
    ],
  },
  {
    author: 1,
    postedAt: '2026-07-29T08:20:00+09:00',
    likeSlots: 11,
    title: '28日の日経62365円（-3.95％）から — 今日は底打ち？戻り売り？',
    content: '前日は日経が一時6万2000円割れ、終値62365円（-2566円、報道ベース）。アドバンテスト・東エレク・キオクシアが指数を押し下げ、グロースからバリュー・内需へのシフトも。今日29日はSKハイニックス決算と今夜のFOMC（30日未明）が重なる。寄り付きで飛び乗らない・30分待ちルール再掲。現金比率メモだけ先に。',
    ticker: 'N225',
    sentiment: 'bearish',
    tags: ['日経平均', '半導体', 'FOMC'],
    comments: [
      '62000割れは心理的にキツい',
      '戻り売り続く派',
      '底打ちはまだ早い',
      '寄り30分待ち',
      '現金比率上げた',
      '内需は底堅かった',
    ],
  },
  {
    author: 9,
    postedAt: '2026-07-29T09:45:00+09:00',
    likeSlots: 14,
    title: '討論 — キオクシア(285A)・東エレク(8035)は「売られすぎ」？まだ「逃げ」？',
    content: '28日はキオクシアが2桁％安、東エレク・アドバンテストも大幅安の報道。材料は①中国DUV装置の製造開始②CXMT上場後の競争懸念③AI投資持続性への疑念。韓国の「ブラックチューズデー」後、証券会社は「過剰調整・リバウンド余地」とも。日本株で触れるなら285A・8035・6857。あなたは？①押し目②まだ早い③ETFコアのみ継続',
    ticker: '285A.T',
    sentiment: 'neutral',
    tags: ['キオクシア', '東京エレクトロン', '投票', '半導体'],
    comments: [
      '①押し目派だが分割のみ',
      '②まだ逃げ',
      '③コアETF継続',
      '中国DUVが怖い',
      '韓国と連動しすぎ',
      '損切り線更新',
      '6857も重い',
    ],
  },
  {
    author: 7,
    postedAt: '2026-07-29T11:30:00+09:00',
    likeSlots: 10,
    title: '今夜FOMC＋MSFT・Meta決算 — 半導体暴落の次はここ',
    content: '29日夜〜30日未明：FOMC政策金利発表（据え置き観測）とウォーシュ議長会見。米ハイテクはマイクロソフト・メタの決算も。ハイパースケーラーの設備投資ペースがAI半導体の次の焦点。日本は寄り前に結果が出ないので、今夜はポジションを増やさず、損切り線とサイズ上限だけ確認。レバETFは触らない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['FOMC', '米国', 'MSFT', 'Meta'],
    comments: [
      '据え置きがベース',
      '会見の文言が怖い',
      'MSFTのcapex見たい',
      '今夜は増やさない',
      'レバ禁止',
      'サイズ上限メモ',
    ],
  },
  {
    author: 2,
    postedAt: '2026-07-29T13:15:00+09:00',
    likeSlots: 12,
    title: 'KOSPI6000台割れのあと — 韓国はリバウンド、日本はまだ様子見？',
    content: '28日KOSPIは10.84％安で6024付近、サーキットブレーカー発動（報道）。サムスン・SKハイニックスが指数の半分以上。アナリストは「売られすぎ・8月に底打ち後反発も」との声も。日本は28日にすでに大きく調整済みで、今日はSKハイニックス決算で韓国が先に動き、日経は連動か独自か。ウォッチリストは3銘柄に絞る。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['KOSPI', '韓国', 'リバウンド'],
    comments: [
      '韓国が先に反発?',
      '日本はもう調整した',
      '連動で午後も軟調',
      'ウォッチ3つに絞った',
      'サムスン決算も今週',
      'わかる',
    ],
  },
  {
    author: 10,
    postedAt: '2026-07-29T15:40:00+09:00',
    likeSlots: 9,
    title: '内需・ディフェンシブが相対強い日 — 半導体だけ見てない？',
    content: '28日の報道では、半導体暴落の一方で小売・食料品など内需系が相対的に底堅かったとの見方。グロース一辺倒のポートフォリオは痛い日。NISAコア（1306・2559等）は継続、サテライト半導体は半分ルール。偏りチェックだけ午後に。',
    ticker: '1306.T',
    sentiment: 'bullish',
    tags: ['内需', 'NISA', 'バリュー', '分散'],
    comments: [
      'コアETFは触らない',
      '半導体偏りすぎだった',
      '1306積立継続',
      'サテライト半分ルール',
      '分散の意味わかる',
    ],
  },
  {
    author: 8,
    postedAt: '2026-07-29T17:10:00+09:00',
    likeSlots: 8,
    title: '投票 — 今週の半導体暴落、あなたの行動は？',
    content: '①現金比率を上げた②損切りした③何もしていない（積立のみ）④分割で少し買った⑤ウォッチリストだけ整理。コメントで銘柄は書かなくてOK、方針だけ教えてほしい。正解はない週。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['投票', 'メンタル', '半導体'],
    comments: [
      '①現金増やした',
      '③積立のみ',
      '④は1割だけ',
      '②損切りした',
      '⑤リスト整理',
      '正解ない週',
      'お互い様',
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Jul 29 hot-news posts…`)

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
