/**
 * Community: Aug 5 hot news — Dow ATH, Amazon $3T, Palantir, hyperscalers,
 * Hormuz/oil, SpaceX earnings, Coherent (報道ベース).
 *
 *   node scripts/seed-community-aug5-hotnews.mjs
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
    author: 8,
    postedAt: '2026-08-05T07:10:00+09:00',
    likeSlots: 16,
    title: 'ダウ史上最高値更新！54,085ドル（+1.71％）— S&P+1.79％、ナスダック+2.59％',
    content: '米株はダウが54,085.88ドル（+907.47pt、+1.71％）で史上最高値を更新、S&P500 +1.79％、ナスダック +2.59％と報道ベースで全面高。ハイテク・AIセンチメントが主導。日本は寄り前に米先物を確認。全額突っ込み禁止・分割のみ。日経も連動しやすいが、為替と原油もセットで見る。',
    ticker: 'TOPIC',
    sentiment: 'bullish',
    tags: ['ダウ', 'S&P500', 'ナスダック', '米国'],
    comments: [
      'ダウATHは強い',
      'ナスダック+2.59％はハイテク主導',
      '日本は寄り30分待ち',
      '全額禁止わかる',
      '米先物チェック',
      '分割のみ派',
      'メモした',
    ],
  },
  {
    author: 2,
    postedAt: '2026-08-05T08:00:00+09:00',
    likeSlots: 15,
    title: 'アマゾン時価総額3兆ドル初突破 — ただしベゾス40億ドル売却申請で翌日-2％',
    content: 'アマゾン(AMZN)が時価総額3兆ドル初突破との報道。一方ジェフ・ベゾス氏の40億ドル規模の売却申請が話題で、翌日株は約-2％。大型ハイテクの「材料は良いがインサイダー売りが重い」典型例。個人はインサイダー売りを過剰反応しないが、サイズは控えめに。コアETF継続派と個別は分割派に分かれる。',
    ticker: 'AMZN',
    sentiment: 'neutral',
    tags: ['Amazon', 'ベゾス', '時価総額', '米国'],
    comments: [
      '3兆ドルはすごい',
      'インサイダー売りは気になる',
      '翌日-2％は想定内？',
      'サイズ控えめ',
      'コアETF継続',
      '過剰反応しない',
      'わかる',
    ],
  },
  {
    author: 9,
    postedAt: '2026-08-05T09:20:00+09:00',
    likeSlots: 17,
    title: 'パランティア(PLTR)2年ぶり最高の一日 — CEO「otherworldly」実績評価',
    content: 'パランティアが2年ぶりに最高の一日との報道。CEOは決算を「otherworldly（この世のものとは思えない）」と評価。AI・政府・企業向けデータ分析のセンチメント株として注目。日本株への直接影響は限定的だが、米ハイテク全体のリスクオン材料。レバ禁止・ウォッチリスト整理のみ。',
    ticker: 'PLTR',
    sentiment: 'bullish',
    tags: ['Palantir', 'AI', '決算', '米国'],
    comments: [
      'PLTRボラ高い',
      'otherworldlyは強い言葉',
      '日本株は間接影響',
      'レバは触らない',
      'ウォッチリスト入り',
      'リスクオン材料',
      'メモした',
    ],
  },
  {
    author: 4,
    postedAt: '2026-08-05T10:35:00+09:00',
    likeSlots: 16,
    title: '4大ハイパースケーラー同時急騰 — Meta+6％、GOOGL+4.9％、MSFT+4.9％、AMZN+4.6％',
    content: 'メタ+6％、アルファベット+4.9％、マイクロソフト+4.9％、アマゾン+4.6％と4大ハイパースケーラーが同時急騰（報道ベース）。AI投資・クラウド需要のセンチメントが一気に戻った日。日本では東エレク(8035)・アドバンテスト(6857)が連動しやすい。テーマ全振りは危険・コア＋分割で。',
    ticker: 'META',
    sentiment: 'bullish',
    tags: ['Meta', 'Google', 'MSFT', 'Amazon', 'AI'],
    comments: [
      '4社同時は強い',
      '8035連動注意',
      '6857も見る',
      'テーマ全振り危険',
      'コア＋分割',
      'AIセンチメント戻り',
      '同意',
    ],
  },
  {
    author: 6,
    postedAt: '2026-08-05T12:00:00+09:00',
    likeSlots: 14,
    title: 'ベッセント財務長官「ホルムズ海峡再開、今明中に合意の可能性」→ WTI -5.69％ $75.77',
    content: '米ベッセント財務長官がホルムズ海峡の再開について「今日か明日中に合意の可能性」と発言（報道ベース）。WTI原油は-5.69％で75.77ドル付近。インフレ懸念緩和・リスクオンに寄与する一方、地政学は流動的。エネルギー株・インフレ連動銘柄はボラ注意。現金比率メモだけ更新。',
    ticker: 'TOPIC',
    sentiment: 'bullish',
    tags: ['原油', 'ホルムズ', '地政学', 'マクロ'],
    comments: [
      '原油-5.69％は大きい',
      '地政学は流動的',
      'インフレ懸念緩和？',
      'エネルギー株ボラ注意',
      '現金比率メモ',
      '様子見派',
      'メモした',
    ],
  },
  {
    author: 10,
    postedAt: '2026-08-05T13:30:00+09:00',
    likeSlots: 15,
    title: 'SpaceX今夜初四半期決算 — IPO比-24％、5000億ドル蒸発のあと',
    content: 'SpaceXが上場後初の四半期決算を今夜発表予定（報道ベース）。IPO価格比で約-24％、時価総額5000億ドル蒸発との話題。宇宙・防衛テーマのセンチメント株として個人投資家の関心高いが、未上場/新規上場株はサイズ小さめ推奨。日本株への直接影響は限定的。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['SpaceX', 'IPO', '決算', '宇宙'],
    comments: [
      'IPO比-24％は厳しい',
      '今夜の決算注目',
      'サイズ小さめ',
      '日本株は間接',
      '宇宙テーマは難しい',
      'ウォッチのみ',
      'わかる',
    ],
  },
  {
    author: 0,
    postedAt: '2026-08-05T14:50:00+09:00',
    likeSlots: 13,
    title: 'Coherent(COHR)+12.4％ — 米国、中国製光トランシーバー輸入規制検討',
    content: 'Coherentが+12.4％急騰。米国が中国製光トランシーバー（光トランシーバ）の輸入規制を検討との報道が材料。半導体・データセンター・AIインフラのサプライチェーン再編テーマ。日本の富士通・住友電工等も光関連でウォッチ。個別株は情報非対称が大きいので分割のみ。',
    ticker: 'COHR',
    sentiment: 'bullish',
    tags: ['Coherent', '半導体', '中国', '光通信'],
    comments: [
      '+12.4％は強い',
      '輸入規制が材料',
      'サプライチェーン再編',
      '日本の光関連も',
      '個別は難しい',
      '分割のみ',
      'メモした',
    ],
  },
  {
    author: 7,
    postedAt: '2026-08-05T16:15:00+09:00',
    likeSlots: 18,
    title: '投票 — 今夜の米株材料、あなたが一番気になるのは？',
    content: '①ダウATH・ハイパースケーラー急騰②アマゾン3兆ドル＋ベゾス売り③パランティア④原油・ホルムズ⑤SpaceX決算⑥Coherent/光トランシーバー⑦日本株は様子見。番号で教えてください。無理に動かない・ルール優先。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['投票', '米国', 'AI', 'メンタル'],
    comments: [
      '①ハイパースケーラー',
      '②ベゾス売り気になる',
      '③PLTR',
      '④原油',
      '⑤SpaceX',
      '⑥Coherent',
      '⑦様子見',
      'ルール優先',
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Aug 5 hot-news posts…`)

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
      created_at: new Date(row.postedAt).toISOString(),
      updated_at: new Date(row.postedAt).toISOString(),
    }

    if (DRY_RUN) {
      console.log(`[dry-run] ${mapped.nickname}: ${row.title}`)
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
      const { error: lErr } = await admin.from('lounge_post_likes').insert({
        post_id: post.id,
        user_id: likerMapped.userId,
        created_at: likeAt,
      })
      if (lErr) console.error('like insert failed:', lErr.message)
    }

    let commentRows = 0
    for (let c = 0; c < commentTexts.length; c += 1) {
      let commentPersona = PERSONAS[(row.author + c + 2) % PERSONAS.length]
      let commentMapped = personaMap.get(commentPersona.email)
      if (commentMapped?.userId === mapped.userId) {
        commentPersona = PERSONAS[(row.author + c + 3) % PERSONAS.length]
        commentMapped = personaMap.get(commentPersona.email)
      }
      if (!commentMapped?.userId) continue
      const commentAt = new Date(new Date(row.postedAt).getTime() + (c + 1) * 9 * 60 * 1000).toISOString()
      const { error: cErr } = await admin.from('lounge_comments').insert({
        post_id: post.id,
        author_id: commentMapped.userId,
        author_name: commentMapped.nickname,
        content: commentTexts[c],
        status: 'published',
        created_at: commentAt,
        updated_at: commentAt,
      })
      if (cErr) console.error('comment insert failed:', cErr.message)
      else commentRows += 1
    }

    const { count: likeRows } = await admin.from('lounge_post_likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id)
    await admin.from('lounge_posts').update({
      like_count: likeRows ?? likeSlots,
      comment_count: commentRows,
      hot_score: (likeRows ?? likeSlots) * 2 + commentRows * 3 + 55,
    }).eq('id', post.id)

    comments += commentRows
    posts += 1
    console.log(`posted: ${mapped.nickname} — ${row.title.slice(0, 52)}…`)
  }

  console.log(`Done. ${posts} posts, ${comments} comments.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
