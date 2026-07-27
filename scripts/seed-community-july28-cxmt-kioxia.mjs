/**
 * Community debate: ChangXin Memory (CXMT) STAR listing vs Kioxia (285A).
 * CXMT facts from public IPO coverage (Jul 2026); 285A close from stock_daily_prices.
 *
 *   node scripts/seed-community-july28-cxmt-kioxia.mjs
 *   node scripts/seed-community-july28-cxmt-kioxia.mjs --dry-run
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

async function fetchKioxiaClose() {
  const { data } = await admin
    .from('stock_daily_prices')
    .select('trade_date,close')
    .eq('symbol', '285A.T')
    .order('trade_date', { ascending: false })
    .limit(1)
  const row = data?.[0]
  if (!row) return null
  const close = Number(row.close)
  if (!Number.isFinite(close)) return null
  return {
    tradeDate: String(row.trade_date || '').slice(0, 10),
    closeYen: Math.round(close).toLocaleString('ja-JP'),
  }
}

function buildPosts(kioxia) {
  const kioxiaLine = kioxia
    ? `キオクシア(285A)は直近${kioxia.tradeDate}終値${kioxia.closeYen}円付近。`
    : 'キオクシア(285A)は東京で直接トレード可能。'

  return [
    {
      author: 4,
      postedAt: '2026-07-28T07:15:00+09:00',
      likeSlots: 12,
      title: '討論 — 長鑫(CXMT)上海上場、キオクシア(285A)は追い風？それとも競合？',
      content: `中国DRAM大手・長鑫存儲(CXMT)が27日、上海科創板に上場。公募8.66元→初値49.50元前後（報道ベースで約+470%）と過熱感。調達額は最大666億元（約1.6兆円）規模で、DRAM世界シェア約8%・4位とされる。${kioxiaLine}ただしCXMTはDRAM、キオクシアはNAND中心で製品は別物。それでも「メモリ全体のサイクル」「中国の設備投資」「AI需給」では連想売買が出やすい。あなたは285Aにとってどっち派？①中国資金流入でメモリ全体が強い②DRAM供給増で価格競争・センチメント悪化③製品違いなので無関係`,
      ticker: '285A.T',
      sentiment: 'neutral',
      tags: ['議論', '投票', '半導体', 'キオクシア', 'CXMT'],
      comments: [
        'DRAMとNANDは別だがセクターは一緒に動く',
        'IPOの資金で供給増→価格プレッシャー派',
        'AIでメモリ全体が足りないなら追い風では',
        '285Aは日本株で買えるのが現実的',
        '初値バブルは別、長期は競合',
        'キオクシアはHBM・先端NANDの話が本題',
        '連想売りは買い場派',
        '新規は見送り、議論だけ楽しむ',
      ],
    },
    {
      author: 1,
      postedAt: '2026-07-28T08:05:00+09:00',
      likeSlots: 9,
      title: 'CXMT上場 — 「マイクロン猛追」vs キオクシアはNAND、比較の仕方が雑',
      content: '報道ではCXMTの生産能力が2026年末に3位のマイクロンに迫るとの予測も。一方キオクシアはフラッシュ(NAND)でAI向け需要はあるがDRAMとは在庫サイクルがズレる。雑に「中国メモリ vs 日本メモリ」と一括りにするのは危険。285Aを見るなら為替・装置投資・サムスン/SKの価格動向をセットで。',
      ticker: 'MU',
      sentiment: 'neutral',
      tags: ['DRAM', 'NAND', 'マイクロン', 'キオクシア'],
      comments: [
        '比較対象はMUやSKハイニックスでは',
        '285Aは独自の需給がある',
        '中国IPOの熱狂は国内には直結しない',
        '装置株(東エレク等)の方が連想されやすい',
        '同意、一括りにしない',
      ],
    },
    {
      author: 9,
      postedAt: '2026-07-28T08:42:00+09:00',
      likeSlots: 11,
      title: 'キオクシア(285A) — CXMTブームで割安に見える？高値掴みリスク？',
      content: `${kioxiaLine}上海のCXMTは初日から時価総額が膨らみ「成長プレミアム」が極端。日本株の285AはそもそもIPO後の調整も経験済みで、個人投資家が買えるのはこっち。ただしCXMTの設備投資がDRAM価格を押し下げればセクター心理は冷える。追いかけ買いは分割1回・全額禁止。`,
      ticker: '285A.T',
      sentiment: 'bullish',
      tags: ['キオクシア', '285A', 'バリュエーション'],
      comments: [
        '日本株で触れるのは285Aだけ',
        'CXMTは個人ほぼ買えない',
        'セクター心理で下げたら押し目？',
        '高値掴み注意、損切り線メモ',
        'NISA成長枠はコアETF優先派',
        '分割1回同意',
      ],
    },
    {
      author: 7,
      postedAt: '2026-07-28T09:18:00+09:00',
      likeSlots: 8,
      title: '反論 — CXMTの666億元調達は「メモリ戦争」入り口、285Aは慎重姿勢が正解',
      content: '調達資金は生産能力2〜3倍の話も。DRAM供給が増えれば価格交渉力が変わる。キオクシア太田社長も追加投資は慎重と報じられていた。中国の国家プロジェクト vs 日本の収益重視、どちらが勝つかは長期戦。短期はニュース連想で285Aが振れても、ファンダは自社のNAND需給で見るべき。',
      ticker: 'TOPIC',
      sentiment: 'bearish',
      tags: ['CXMT', '供給', '半導体'],
      comments: [
        '供給増は価格に効く',
        '太田社長の慎重論わかる',
        'でもAIでNANDも足りない説',
        '長期戦同意',
        '短期はノイズ',
      ],
    },
    {
      author: 2,
      postedAt: '2026-07-28T09:55:00+09:00',
      likeSlots: 10,
      title: '投票 — CXMT上場後、285Aのウォッチ優先度は上がった？下がった？',
      content: '①上がった：メモリセクター全体の関心↑、285Aも話題に乗れる②下がった：中国株に資金・関心が吸われる③変わらない：製品違い。コメントで理由も書いてほしい。自分は②寄りだが、285Aはウォッチリストからは外さない。',
      ticker: '285A.T',
      sentiment: 'neutral',
      tags: ['投票', 'ウォッチリスト', 'キオクシア'],
      comments: [
        '①メモリ全体が注目',
        '②上海に資金集中',
        '③製品違いで変わらない',
        'ウォッチは残す派',
        '新規買いはまだしない',
        '議論面白い',
        'コアはETFのまま',
      ],
    },
  ]
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
  const kioxia = await fetchKioxiaClose()
  const POSTS = buildPosts(kioxia)

  console.log(DRY_RUN ? `Dry run — ${POSTS.length} debate posts…` : `Seeding ${POSTS.length} CXMT vs Kioxia debate posts…`)
  if (kioxia) console.log(`Kioxia ref: ${kioxia.tradeDate} ${kioxia.closeYen}円`)

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
      hot_score: likeSlots * 2 + commentTexts.length * 3 + 45,
      status: 'published',
      created_at: createdAt,
      updated_at: createdAt,
    }

    if (DRY_RUN) {
      console.log(`[dry-run] ${row.postedAt} ${row.title}`)
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
    console.log(`posted: ${row.title.slice(0, 56)}…`)
  }

  console.log(`Done. ${posts} posts, ${comments} comments.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
