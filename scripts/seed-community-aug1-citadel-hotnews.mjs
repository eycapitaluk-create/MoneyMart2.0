/**
 * Community: Aug 1 hot news — Citadel acquires Situational Awareness equity book
 * after AI selloff / deleveraging spiral (Reuters/WSJ/CNBC reports, late Jul 2026).
 *
 *   node scripts/seed-community-aug1-citadel-hotnews.mjs
 *   node scripts/seed-community-aug1-citadel-hotnews.mjs --dry-run
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
    postedAt: '2026-08-01T07:20:00+09:00',
    likeSlots: 16,
    title: '速報 — シタデルがSituational Awarenessの株式ポートフォリオ大半を取得（報道）',
    content: '米メディア報道（Reuters/WSJ等）で、ケン・グリフィンのシタデルが、元OpenAI研究者レオポルド・アッシェンブレンナー氏のAI特化ヘッジファンド「Situational Awareness」の公開株式ポートフォリオの大半を買い取ったとのこと。7月のAI株急落で同ファンドは月間で約-67％と報じられ、プライムブローカーからの追証・デレバレッジ圧力が背景。ゴールドマン・JPモルガン等が取引を仲介したとの報道も。日本株への直接影響は限定的だが、AIセンチメントの温度計として要注目。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['シタデル', 'AI', 'ヘッジファンド', '報道'],
    comments: [
      'シタデルが流動性提供役',
      'AI特化ファンドの教訓',
      '報道ベースで様子見',
      'レバレッジの怖さ',
      '日本株は間接影響',
      'メモしました',
      'プライムブローカー絡みがキツい',
    ],
  },
  {
    author: 2,
    postedAt: '2026-08-01T08:10:00+09:00',
    likeSlots: 15,
    title: 'Situational Awareness -67％ — レバレッジ集中AIポジションのデレバレッジ地獄',
    content: 'CNBC等の解説では、AIインフラ株への集中＋レバレッジで運用していたSituational Awarenessが、株価下落→担保不足→追証→売り→さらに下落の「デレバレッジスパイラル」に陥った構図。個人投資家にも当てはまる話で、①信用・レバETF②テーマ集中③「ただの調整」と思い込む、の3つは危険信号。報道ではBroadcom・Intel・CoreWeave等のポジションが言及。全額突っ込み禁止ルール再掲。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['レバレッジ', 'AI', 'リスク管理', '半導体'],
    comments: [
      'デレバレッジは怖い',
      '個人も同じ構図あり得る',
      '信用は触らない派',
      'テーマ集中が危険',
      'CRWVも絡む話',
      'サイズ管理が全て',
      'わかる',
    ],
  },
  {
    author: 9,
    postedAt: '2026-08-01T09:35:00+09:00',
    likeSlots: 14,
    title: 'シタデル買収でAVGO・INTC・CRWVは？ — AI関連の次の値動き',
    content: '報道ベースでSituationalの公開株ブックにBroadcom・Intel・CoreWeave等が含まれていたとのこと。シタデルがバルクを引き受けたことで「強制売りの終焉」期待と「プロが安く拾った」解釈が両立。日本では東エレク(8035)・アドバンテスト(6857)・キオクシア(285A)がAIセンチメントに連動しやすい。今日は寄り付きで飛び乗らず、出来高と米先物を見てから。分割買いのみ。',
    ticker: 'AVGO',
    sentiment: 'neutral',
    tags: ['シタデル', 'Broadcom', 'CoreWeave', '半導体'],
    comments: [
      '強制売り終わり期待',
      'プロが拾った解釈',
      '8035は様子見',
      '寄り30分待ち',
      'CRWVボラ高い',
      '分割のみ',
      'AIセンチメント注意',
    ],
  },
  {
    author: 4,
    postedAt: '2026-08-01T11:00:00+09:00',
    likeSlots: 13,
    title: '討論 — ケン・グリフィンは「危機の買い手」？それとも「底値狩りのプロ」？',
    content: 'シタデルがストレス時に流動性を提供する事例は過去にも（報道・業界解説）。今回もAI株急落の中でSituationalのレバレッジ付き公開株ブックを引き受けた形。個人投資家目線では「同じタイミングで買えるのか？」が論点。答えはほぼNo — 情報・資金・ブローカー網が違う。学ぶべきは「プロの買い場＝個人の買い場ではない」こと。現金比率メモだけ更新。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['シタデル', 'ケン・グリフィン', '議論', '流動性'],
    comments: [
      '個人は同じタイミング無理',
      '流動性提供はプロの仕事',
      '底値狩りは別次元',
      '現金比率メモした',
      '学びはレバ管理',
      '同意',
      '冷静に見る',
    ],
  },
  {
    author: 6,
    postedAt: '2026-08-01T12:30:00+09:00',
    likeSlots: 12,
    title: 'Anthropic持分は売却せず — 公開株とプライベート投資の分離',
    content: '報道では、Situational Awarenessは取引後も約100億ドル規模のポートフォリオを残し、Anthropicへの投資は売却していないとのこと。つまり「公開株のAIテーマは清算、プライベートAIは継続」という整理。個人のNISA/積立にも当てはめられる — 上場株のテーマ株と未上場・長期テーマはリスクが違う。上場株だけでAI全振りは危険、という読み方も。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['Anthropic', 'AI', 'プライベート', '分散'],
    comments: [
      '公開株と私募は別物',
      'Anthropicは残すのか',
      'テーマ全振り危険',
      'NISAはコアETF派',
      '分散の話',
      'なるほど',
      '上場株だけでAIは無理',
    ],
  },
  {
    author: 10,
    postedAt: '2026-08-01T14:00:00+09:00',
    likeSlots: 17,
    title: '投票 — シタデル/Situational騒動後、AI集中ポジションはどうする？',
    content: '7月末のAI株急落＋Situationalの大幅損失＋シタデルによる公開株ブック引き受け（いずれも報道ベース）を受けて、あなたのAI関連ポジション方針は？①現状維持（コアのみ）②AI比率を下げる③押し目で増やす④すでに損切り済み⑤ウォッチのみ。コメントで番号教えてください。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['投票', 'AI', 'シタデル', 'メンタル'],
    comments: [
      '①コアのみ継続',
      '②比率下げた',
      '③はまだ早い',
      '④損切り済み',
      '⑤ウォッチ',
      'レバは触らない',
      '②に近い',
      '分割のみなら③',
    ],
  },
  {
    author: 0,
    postedAt: '2026-08-01T15:45:00+09:00',
    likeSlots: 11,
    title: '8/1午後メモ — シタデル話題でAIセンチメントはまだ慎重',
    content: '午後の感触として、シタデル/Situationalの報道は「AIバブル崩壊」論と「プロの買い場」論を同時に刺激。日経は前日比で方向感が定まりにくい（報道・市場データ要確認）。半導体は個別材料よりセンチメント主導。今日やることは①ウォッチリスト整理②信用・レバ確認③コアETF以外は触らない、の3つだけ。無理に動かない。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['日経平均', 'シタデル', '午後', 'メモ'],
    comments: [
      'センチメントまだ慎重',
      '無理に動かない',
      'ウォッチリスト整理',
      'コアETFのみ',
      'レバ確認した',
      'メモ助かる',
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Aug 1 Citadel hot-news posts…`)

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
