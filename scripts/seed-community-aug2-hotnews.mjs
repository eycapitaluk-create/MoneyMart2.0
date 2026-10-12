/**
 * Community: Aug 2 hot news — post-BOJ hold, Nikkei +4% rebound, semi/AI earnings bounce.
 * Figures from public reports (2026-07-31〜08-02 JST). 報道ベース where noted.
 *
 *   node scripts/seed-community-aug2-hotnews.mjs
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
    author: 1,
    postedAt: '2026-08-02T08:30:00+09:00',
    likeSlots: 15,
    title: '7/31日経+4％（64362円）リバウンド — 週明けも続く？それとも利確？',
    content: '7月31日は日経225が+4％超（終値64362円付近、報道ベース）で半導体・AI関連が主導。韓国株反発＋MSFT・AMZN決算好調が材料。ただ28-29日の暴落直後のリバウンドなので「本物の戻り」か「週末前のショートカバー」かはまだ不明。月曜は寄り付きで飛び乗らず、出来高と米先物を確認。分割のみ・コアETFは継続派。',
    ticker: 'N225',
    sentiment: 'bullish',
    tags: ['日経平均', 'リバウンド', '半導体', 'AI'],
    comments: [
      '64362はまだ重い水準',
      'ショートカバー説もある',
      '月曜は寄り30分待ち',
      '利確派と継続派が真っ二つ',
      '出来高見ないと判断できない',
      'コアETFは触らない',
      'わかる',
    ],
  },
  {
    author: 5,
    postedAt: '2026-08-02T09:15:00+09:00',
    likeSlots: 14,
    title: '日銀政策金利1.0％据え置き — 8対1のタカ派票、円と株はどう読む？',
    content: '7/31の日銀は政策金利1.0％据え置き（報道ベース）。ただ8対1の投票で「インフレ上振れリスク」への警戒が強調されたとの解説も。株は半導体リバウンドで上昇、円は方向感が分かれやすい局面。長期金利・銀行株・REITのバランスを再確認。レバは触らない・現金比率メモだけ更新。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['日銀', '金利', '円', 'マクロ'],
    comments: [
      '据え置きは想定内',
      '8対1はややタカ派',
      '円は様子見',
      '銀行株は材料次第',
      'REITは金利敏感',
      'レバは触らない',
      'メモした',
    ],
  },
  {
    author: 3,
    postedAt: '2026-08-02T10:40:00+09:00',
    likeSlots: 16,
    title: 'アドバンテスト+15％・東エレク+6％ — 半導体の「戻り」は追いかける？',
    content: '7/31はアドバンテスト(6857)が年間営業益予想を上方修正し大幅高、東エレク(8035)・キオクシア(285A)も反発（報道ベース）。28-29日の暴落からの戻りなので、①分割で押し目②まだ様子見③コアETFのみ④損切り済みでウォッチ、の4択。全額突っ込み禁止。シタデル/Situational話題もまだAIセンチメントに影響。',
    ticker: '6857.T',
    sentiment: 'bullish',
    tags: ['アドバンテスト', '東京エレクトロン', '半導体', '決算'],
    comments: [
      '6857の上方修正は強い',
      '②まだ様子見派',
      '①は分割のみ',
      '8035は連動しやすい',
      '285Aはボラ高い',
      '全額禁止わかる',
      '③コアETF継続',
    ],
  },
  {
    author: 7,
    postedAt: '2026-08-02T12:00:00+09:00',
    likeSlots: 13,
    title: 'MSFT・AMZN決算後 — AI投資は「続く」に戻った？',
    content: '米ハイテク決算でクラウド・AI投資継続のシグナルが出たとの報道（7/31）。ナスダック主導のリバウンドに日本の半導体が連動。一方でシタデル/Situationalのデレバレッジ話題も残り、センチメントは「楽観一辺倒」ではない。ガイダンスの文言とcapex見通しを要チェック。テーマ全振りは避ける。',
    ticker: 'MSFT',
    sentiment: 'bullish',
    tags: ['MSFT', 'Amazon', 'AI', '決算'],
    comments: [
      'capex継続は安心材料',
      'センチメントはまだ慎重',
      '日本半導体連動',
      'テーマ全振りは危険',
      'ガイダンス要チェック',
      '分割でいく',
      '同意',
    ],
  },
  {
    author: 11,
    postedAt: '2026-08-02T13:20:00+09:00',
    likeSlots: 12,
    title: 'ルネサス(6723)決算 — 営業利益率32.7％、自動車×AIの戻り？',
    content: 'ルネサス電子の四半期決算で売上・利益率が改善したとの報道（8/1付記事等）。株価は直近1ヶ月で約-29％からの反発局面でもあり、「材料は良いが織り込み済み」論も。MCU・車載＋データセンター向けの話題株としてウォッチリスト整理。個別株はサイズ小さめ推奨。',
    ticker: '6723.T',
    sentiment: 'neutral',
    tags: ['ルネサス', '半導体', '決算', '車載'],
    comments: [
      '利益率は強い',
      '織り込み済み説も',
      '車載×AIはテーマ',
      'サイズ小さめ',
      'ウォッチリスト入り',
      '個別は難しい',
      'メモした',
    ],
  },
  {
    author: 4,
    postedAt: '2026-08-02T14:45:00+09:00',
    likeSlots: 17,
    title: '投票 — 8月最初の週、あなたのポジション方針は？',
    content: '7月末の暴落→7/31大反発→日銀据え置きを経て、8月第1週の方針は？①リバウンド追い（分割）②利確・現金増③コアETFのみ継続④個別半導体はウォッチ⑤すでに損切り済み。番号で教えてください。レバ・信用は非推奨。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['投票', 'メンタル', 'リバウンド', 'NISA'],
    comments: [
      '③コアETF継続',
      '②利確派',
      '①は分割のみ',
      '④ウォッチ',
      '⑤損切り済み',
      'レバは触らない',
      '②に近い',
      '様子見',
    ],
  },
  {
    author: 6,
    postedAt: '2026-08-02T16:10:00+09:00',
    likeSlots: 11,
    title: '週末メモ — シタデル話題＋日銀＋半導体リバウンド、月曜は何を見る？',
    content: '今週の論点まとめ：①シタデル/SituationalのAIデレバレッジ②日銀1.0％据え置き・タカ派警戒③日経64362円のリバウンド持続性④6857/8035/285Aの戻り幅。月曜は米先物・韓国半導体・円相場の3点セットで寄り前チェック。無理に動かない・ルールだけ守る。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['週末', 'メモ', '半導体', '日銀'],
    comments: [
      '月曜は3点セット',
      '韓国半導体要チェック',
      '円も見る',
      'ルール守る',
      '無理に動かない',
      'まとめ助かる',
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Aug 2 hot-news posts…`)

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
      const { error: lErr } = await admin.from('lounge_post_likes').insert({
        post_id: post.id,
        user_id: likerMapped.userId,
        created_at: likeAt,
      })
      if (lErr) console.error('like insert failed:', row.title.slice(0, 48), lErr.message, lErr.code, lErr.details)
    }

    let commentRows = 0
    for (let c = 0; c < commentTexts.length; c += 1) {
      let commentPersona = PERSONAS[(row.author + c + 2) % PERSONAS.length]
      let commentMapped = personaMap.get(commentPersona.email)
      if (commentMapped?.userId === mapped.userId) {
        commentPersona = PERSONAS[(row.author + c + 3) % PERSONAS.length]
        commentMapped = personaMap.get(commentPersona.email)
      }
      if (!commentMapped?.userId) {
        console.error('comment skipped (no persona):', row.title.slice(0, 48), commentTexts[c])
        continue
      }
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
      if (cErr) {
        console.error('comment insert failed:', row.title.slice(0, 48), commentTexts[c], cErr.message, cErr.code, cErr.details)
      } else {
        commentRows += 1
      }
    }

    const { count: likeRows } = await admin.from('lounge_post_likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id)
    await admin.from('lounge_posts').update({
      like_count: likeRows ?? likeSlots,
      comment_count: commentRows,
      hot_score: (likeRows ?? likeSlots) * 2 + commentRows * 3 + 55,
      updated_at: new Date(row.postedAt).toISOString(),
    }).eq('id', post.id)

    comments += commentRows
    posts += 1
    console.log(`posted: ${row.title.slice(0, 58)}…`)
  }

  console.log(`Done. ${posts} posts, ${comments} comments.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
