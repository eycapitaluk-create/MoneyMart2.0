/**
 * Community debate: KOSPI plunge, Samsung / SK Hynix, spillover to Japan.
 * Figures from public market reports (2026-07-28 JST). No fabricated DB prices.
 *
 *   node scripts/seed-community-july28-kospi-kr-jp.mjs
 *   node scripts/seed-community-july28-kospi-kr-jp.mjs --dry-run
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
    author: 0,
    postedAt: '2026-07-28T14:25:00+09:00',
    likeSlots: 14,
    title: '韓国KOSPIが一時11％超安・サーキットブレーカー — 何が起きてる？',
    content: '28日のソウル市場はKOSPIが一時11％超の急落、サーキットブレーカー発動（報道ベース）。サムスン電子・SKハイニックスが指数の半分以上を占める構造なので、メモリ半導体の売りがそのまま指数を壊す日。材料は①AI投資の持続性への疑念②CXMT上場後の中国勢との競争③SKハイニックスADRがIPO価格割れ、など複合。日本株だけ見てると「他人事」に見えがちだが、バスケット売りの入口になりやすい。まずはサイズ確認。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['KOSPI', '韓国', '半導体', '議論'],
    comments: [
      'サム電・ハイニックスの比重がデカすぎる',
      'サーキットブレーカーは需給の歪み',
      'AIテーマの利確連鎖か',
      '日本はまだ追随中',
      '全額禁止ルール再掲',
      'サイズ半分にした',
      'わかりやすい整理',
    ],
  },
  {
    author: 3,
    postedAt: '2026-07-28T15:10:00+09:00',
    likeSlots: 12,
    title: 'サムスン・SKハイニックス急落 — 14％前後安、決算前のポジション調整？',
    content: '報道ではサムスン電子が14％前後、SKハイニックスも同程度の大幅安。両社とも今週後半に決算予定で、先にポジションを落とす資金もいるはず。ただ「決算悪化」より「バリュエーション・中国競争・レバETFの解消」が主因という見方も。個別株は買えないので、日本側は装置（東エレク）・NAND（キオクシア）・為替の連想で見るしかない。新規は寄り後30分待ち。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['サムスン', 'SKハイニックス', '決算', '韓国'],
    comments: [
      '決算前のリスクオフわかる',
      'レバETFの解消がキツい',
      '日本株で触れるのは285Aと装置株',
      '寄り30分同意',
      'ファンダより需給の日',
      '見送り派',
    ],
  },
  {
    author: 8,
    postedAt: '2026-07-28T16:05:00+09:00',
    likeSlots: 15,
    title: '討論 — 韓国暴落は日本株にどれくらい効く？日経は一時3000円超下落',
    content: '午後の報道では日経平均が一時3000円超の下落幅、アドバンテスト・東京エレクなど半導体関連が寄与度上位、キオクシアも2桁％安の報道あり。韓国は「心理の先行指標」になりやすい日。ただし日本はNAND中心・韓国はDRAM比重が高いので、製品は別でもセクター心理は連動。あなたはどっち？①日本も連想売り続く②韓国だけの調整で日本は底堅い③日本の方が出口が早い',
    ticker: 'N225',
    sentiment: 'bearish',
    tags: ['日経平均', '韓国', '投票', '半導体'],
    comments: [
      '①連想売り続く派',
      '②DRAMとNANDは別サイクル',
      '③日本は出口早いことも',
      'アドバンテスト重すぎ',
      'キオクシアが連動してる',
      '現金比率上げた',
      '議論面白い',
      'レバ触らない',
    ],
  },
  {
    author: 5,
    postedAt: '2026-07-28T17:20:00+09:00',
    likeSlots: 10,
    title: 'キオクシア(285A)・装置株 — 韓国売りの「日本版」はどこまで行く？',
    content: '韓国のメモリ2強が崩れると、日本ではフラッシュ（285A）と装置（8035・6857）が同じバスケットで売られる日。報道ベースでキオクシアも大幅安。ファンダより「AIテーマのポジション解消」が先に来る。NISA成長枠の主力にするなら、こういう日のメンタルルール（損切り線・半分ルール）を先に書く。ナンピンは禁止、分割1回まで。',
    ticker: '285A.T',
    sentiment: 'bearish',
    tags: ['キオクシア', '285A', '東エレク', '韓国'],
    comments: [
      '285Aは韓国と連動しやすい',
      '装置株も巻き添え',
      'ナンピン禁止同意',
      '半分ルール使う',
      '損切り線更新した',
    ],
  },
  {
    author: 11,
    postedAt: '2026-07-28T18:40:00+09:00',
    likeSlots: 9,
    title: '投票 — KOSPI急落後、日本株は「押し目」？「まだ早い」？',
    content: 'KOSPIが6000台前半まで落ちた日（報道）。年初来はまだ高いという声もあるが、月間では大幅な調整入り。日本は大引け後に冷静に。①韓国の暴落は一過性、日本は分割で拾う②まだ早い、現金比率を上げる③コアETF積立のみ継続。コメントで理由も書いてほしい。',
    ticker: '1306.T',
    sentiment: 'neutral',
    tags: ['投票', '押し目', 'KOSPI', 'NISA'],
    comments: [
      '②まだ早い派',
      '①は韓国だけの話にしたい',
      '③積立だけ継続',
      '現金30％にした',
      '分割1回ならあり',
      '全額は無理',
      '明日の寄り見る',
    ],
  },
  {
    author: 6,
    postedAt: '2026-07-28T19:55:00+09:00',
    likeSlots: 8,
    title: '夜 — 韓国・日本・米国、同じ「AI半導体」バスケットで動いてる',
    content: '韓国KOSPIの暴落、サムスン・ハイニックス、日本の日経・キオクシア・装置株、米ナスダックのハイテク — 今日は同じストーリーで売られた感。個別のニュースを追いかけるより、ポートフォリオの半導体比率とレバの有無だけ今夜チェック。SNSの底値予想は信用しない。おやすみ前にサイズ上限だけメモ。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['アジア', '半導体', 'メンタル', 'ルール'],
    comments: [
      '半導体比率メモした',
      'レバなし確認',
      'SNS見ない',
      'おやすみ',
      '明日寄り30分',
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} KOSPI/KR-JP posts…`)

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
      hot_score: likeSlots * 2 + commentTexts.length * 3 + 50,
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
