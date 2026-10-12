/**
 * Community: Aug 11 — Mountain Day (休場), USD/JPY, US CPI eve.
 * Posts spread across the day (報道ベース). Conversational.
 *
 *   node scripts/seed-community-aug11-hotnews.mjs
 *   node scripts/seed-community-aug11-hotnews.mjs --dry-run
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
    postedAt: '2026-08-11T07:35:00+09:00',
    likeSlots: 14,
    title: 'おはよう — 今日は山の日で日本株は休場',
    content:
      '8月11日は国民の祝日「山の日」。東京株式市場（現物）は休場です。前営業日（8日）の日経平均は+2.08％で66,970円付近の報道。祝日はチャートが止まるので、感情的に「動いてないのに不安」になりやすい日。自分のルールは①新規注文しない②米国時間はニュースだけ③サイズ変更なし。休み明け（12日）のギャップに備えてメモだけ。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['山の日', '休場', '日経平均', 'メンタル'],
    comments: [
      '休場日に触りたくなる衝動わかる…',
      'だから今日はアプリ見る回数減らす',
      '66970は高い水準だよね。利確検討してる人もいそう',
      '私はウォッチリスト整理だけ',
      '米国は動くから夜は注意',
      '山登りしてくる。市場は忘れる',
      '良い休日を！',
    ],
  },
  {
    author: 5,
    postedAt: '2026-08-11T09:50:00+09:00',
    likeSlots: 15,
    title: '前場の振り返りメモ — 半導体・リクルートで押し上げた8日',
    content:
      '休場中に前営業日を整理。日経は大幅反発（+2％超）、TOPIXも4,100超えの話題。アドバンテスト・リクルートHDなどが指数寄与トップ級との解説が多かった週末〜週明け。ただし「祝日前の上げ」は翌営業日に調整が来やすい、という話も。個別はストップ高追い禁止・分割確認のみ。今日は振り返りに使う。',
    ticker: 'TOPIC',
    sentiment: 'bullish',
    tags: ['振り返り', '半導体', 'リクルート', 'TOPIX'],
    comments: [
      '6098の上方修正は強かった',
      '6857も寄与大きかった印象',
      '祝日前上げは怖い説、あるよね',
      'だから明けは慎重派',
      '振り返りだけなら今日ちょうどいい',
      'メモありがとう',
      '同じこと書いてた。連想で一致した',
      '利確した人いる？様子見多数かな',
    ],
  },
  {
    author: 10,
    postedAt: '2026-08-11T11:25:00+09:00',
    likeSlots: 13,
    title: '投票 — 休場日、あなたは何してる？',
    content:
      '山の日・休場日の過ごし方。番号で：①完全オフ（市場見ない）②ウォッチリスト整理③米国株・先物だけチェック④積立・NISAの設定見直し⑤家族・趣味優先。私は⑤＋②。無理にトレードしないのが正解。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['投票', '休場', '雑談', 'メンタル'],
    comments: [
      '⑤一択。今日は山へ',
      '②と④。設定だけ触る',
      '③派。米国は動くから',
      '①が理想、③になっちゃう',
      'わかる…つい見ちゃう',
      '休場日トレードしようとする人いないよね',
      '明けに備える程度でいい',
      'みんな冷静で助かる',
    ],
  },
  {
    author: 3,
    postedAt: '2026-08-11T13:55:00+09:00',
    likeSlots: 16,
    title: 'ドル円159円台 — 円安進行、休場中の為替チェック',
    content:
      '前営業日のニューヨーク時間でドル円が159円を突破したとの報道も。円安＝輸出株にプラス・輸入コスト増の話題が再燃。日本株は休場でも為替は動くので、輸出関連ウォッチと生活コストの両面でメモ。円安で「日本株買い」は短絡になりやすい。明けのギャップとCPI（米・火曜予定の話題）をセットで見る。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['為替', 'ドル円', '円安', 'マクロ'],
    comments: [
      '159は心理的にきつい数字',
      '輸出株だけ追うのは危険だよね',
      '生活コストも気になる…',
      '休場でも為替は動くの忘れがち',
      'CPIで一気に振れるかも',
      '様子見が正解',
      'メモ助かる',
      '明けの寄りは触らないルール',
    ],
  },
  {
    author: 7,
    postedAt: '2026-08-11T16:20:00+09:00',
    likeSlots: 15,
    title: '今夜の米国株 — CPI前の様子見、利益確定売りに注意',
    content:
      '日本は休場だが米国市場は通常取引。明日（現地12日）の米7月CPI発表を控え、ハイテクなど高値圏銘柄に利益確定売りが出やすい週末〜週明けの流れ（報道ベース）。ダウは200ドル前後安の話題も。個人は「イベント前にポジ増やさない」が鉄板。NVDA・半導体センチメントもCPIで振れそう。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['CPI', '米国株', 'ハイテク', 'マクロ'],
    comments: [
      'CPI前は毎回荒れるよね',
      '利益確定は自然な動き',
      '追いかけ禁止、再確認',
      'NVDAの動き見るけど触らない',
      '日本休場で焦りやすい日',
      '今夜はニュースだけ',
      '同意。サイズ維持',
      '明けのギャップ怖い',
    ],
  },
  {
    author: 0,
    postedAt: '2026-08-11T18:45:00+09:00',
    likeSlots: 14,
    title: '米国時間チェック — ダウ・ナスダックは調整色、セクターは自動車↑テック↓の話題',
    content:
      '米国時間のダイジェストでは、ダウ平均が200ドル前後安・ナスダックも軟調の報道。CPI待ちの手仕舞い売り、関税・地政学の不透明感も材料に。セクターでは自動車関連が相対的に強く、テック・ハードが弱い、との整理も。日本株休場中は「読むだけ」で十分。明けはギャップ＋CPI結果の二段ロケットに注意。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['米国株', 'セクター', 'CPI', 'ダウ'],
    comments: [
      'テック弱い日は日本の半導体も連想される',
      'でも休場中は何もできない',
      'それが一番安全かも',
      '自動車強いのは関税絡み？',
      '詳細は明日のニュース待ち',
      '読むだけ派＋1',
      'CPIで全部変わる',
      '無理しないで正解',
    ],
  },
  {
    author: 9,
    postedAt: '2026-08-11T21:15:00+09:00',
    likeSlots: 17,
    title: '夜の雑談 — 休場明け（12日）最初に確認すること',
    content:
      '明日は日本市場再開＋米CPIの日。朝イチチェックリスト：①米CPI結果と市場予想比較②ドル円・先物③日経先物のギャップ④半導体（6857/8035）の寄り⑤無理に追わない。番号で「一番見るもの」を教えて。私は①→③の順。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['CPI', '休場明け', 'チェックリスト', '雑談'],
    comments: [
      '①CPIが全て',
      '③ギャップだけ見て触らない',
      '④半導体は見るけど追わない',
      '⑤が一番大事',
      '同意。ルール優先',
      '①→②→③の順',
      '明日は朝忙しそう',
      '今夜は早く寝る',
    ],
  },
  {
    author: 4,
    postedAt: '2026-08-11T23:40:00+09:00',
    likeSlots: 13,
    title: '就寝前メモ — 祝日は「何もしない」も戦略',
    content:
      '山の日、日本株は動かなかった一日。米国はCPI前で調整。明日の自分へのルール：①寄り30分は見るだけ②CPIでストーリー一発買い禁止③サイズは昨日と同じ。休場日にルールを守れた人は、明けも守れるはず。おやすみなさい。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['メンタル', 'ルール', 'CPI', '休場明け'],
    comments: [
      '何もしないの難しい…でも正解',
      '③サイズ維持、大事',
      'おやすみ！',
      '明日もこのスレ見る',
      'ルール書いてくれてありがとう',
      'CPIお祈り（下振れ？）',
      '祈りはしない派だけどわかる',
      '冷静にいこう',
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Aug 11 hot-news posts…`)

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
      console.log(`[dry-run] ${row.postedAt} ${mapped.nickname}: ${row.title}`)
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
    console.log(`posted: ${row.postedAt.slice(11, 16)} ${mapped.nickname} — ${row.title.slice(0, 48)}…`)
  }

  console.log(`Done. ${posts} posts, ${comments} comments.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
