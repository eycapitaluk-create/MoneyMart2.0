/**
 * Community: Aug 10 hot news — Nikkei rebound after NFP, Recruit HD,
 * Advantest, CPI week ahead, Mountain Day (報道ベース). Conversational.
 *
 *   node scripts/seed-community-aug10-hotnews.mjs
 *   node scripts/seed-community-aug10-hotnews.mjs --dry-run
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
    author: 2,
    postedAt: '2026-08-10T08:25:00+09:00',
    likeSlots: 16,
    title: '週明け日経は大幅反発 — 米雇用弱い→利上げ観測後退の流れ',
    content:
      '10日寄り、日経平均は反発スタート（報道ベースで+298円付近の6万5905円など）。先週末の米雇用統計（NFP減少）で利上げ観測が後退し、米株高を引き継ぐ展開。前場は上げ幅1000〜1400円超・6万6600〜6万7000円台の話題も。アドテスト・東エレクなど半導体が指数を押し上げ。明日は山の日で休場なので、朝イチのギャップ追っかけは危険。分割・サイズ確認のみ。',
    ticker: 'TOPIC',
    sentiment: 'bullish',
    tags: ['日経平均', '雇用統計', '半導体', '週明け'],
    comments: [
      '1000円超えの上げは気持ちいいけど怖い…',
      'わかる。祝日前だから余計に追わない',
      '利上げ後退ストーリーは先週から続いてるね',
      '半導体が寄与してる日は指数が跳ねやすい',
      '私は寄り30分触らないルール',
      '同感。見てるだけで十分',
      '山の日明けはどう動くんだろう',
      '明けてから考える派',
    ],
  },
  {
    author: 8,
    postedAt: '2026-08-10T10:15:00+09:00',
    likeSlots: 17,
    title: 'リクルートHD(6098)ストップ高報道 — 通期純利益7550億円へ上方修正',
    content:
      'リクルートHDが前週末に通期純利益予想を7550億円（前期比約52％増）へ上方修正。IndeedなどHRテック好調が背景（報道ベース）。週明けはストップ高となり、アドテストと合わせて指数押し上げ寄与が大きいとの解説も。好決算の「材料出尽くし」もあり得るので、ストップ高追っかけは禁止。個別はサイズ控えめ・ウォッチ中心。',
    ticker: '6098.T',
    sentiment: 'bullish',
    tags: ['リクルート', '決算', 'Indeed', '日本'],
    comments: [
      '上方修正強いね。市場予想も上回ってた',
      'ストップ高は触らない。鉄則',
      'HRテック＝Indeedの勢いってことか',
      '指数寄与大きいから日経の上げ幅も説明つく',
      '利確した人もいそうだな…',
      '私は持ってない。連想で他銘柄飛びつかない',
      '決算銘柄の翌日はボラ高い',
      'メモ：材料は強い、追っかけは弱い',
    ],
  },
  {
    author: 0,
    postedAt: '2026-08-10T11:40:00+09:00',
    likeSlots: 15,
    title: 'アドテスト急伸で指数押し上げ — 半導体は「戻り」か「追いかけ」か',
    content:
      '前場時点でアドバンテストが日経押し上げ寄与トップ級との報道。東エレクなども堅調で、先週の利益確定売りのあとリスクオンが戻った形。ただしNVDA強い週のあとに来るCPI（米7月・水曜予定の話題）で金利が振れると、また半導体は揺さぶられやすい。自分のルールは①ギャップ追っかけ禁止②テーマ全振りしない③祝日前は新規増やさない。',
    ticker: '6857.T',
    sentiment: 'neutral',
    tags: ['アドバンテスト', '東エレク', '半導体', 'AI'],
    comments: [
      '6857の寄与はすごい数字だね',
      '先週売られて今週買うの、気持ちはわかる',
      'でもCPI前にフルベットは危険',
      '同感。サイズ半分ルールで見てる',
      '8035も一緒に動いてる？',
      '動いてる。だからセットで見る',
      '戻り待ちと追いかけは違うよね',
      '追いかけはしない。それが正解',
    ],
  },
  {
    author: 9,
    postedAt: '2026-08-10T13:30:00+09:00',
    likeSlots: 16,
    title: '今週の山場は米CPI — 雇用弱いあとの「物価」テスト',
    content:
      '先週末NFPで利上げ確率は下がったが、水曜の米7月CPIが次の焦点（報道ベース）。予想はヘッドライン前年+3.4％前後・コア+2.5％前後の声。下振れならリスクオン継続、上振れなら金利↑でハイテク逆風、の二択になりやすい。個人はイベント前にサイズを落とす・新規を増やさないのが勝ちパターン。PPI・小売も続く週。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['CPI', '金利', 'マクロ', '米国'],
    comments: [
      '雇用だけで安心するのは危険だよね',
      'うん、物価が熱いとまた利上げ観測戻る',
      '水曜までポジ増やさないと決めた',
      'ゴールドマン会議とかもある週？材料多い',
      'NVDA関連のセンチメントもCPIで振れそう',
      '私は現金比率メモだけ更新',
      '予想どおりでも材料出尽くしはある',
      'だから「数字待ち」は見送りでいい',
    ],
  },
  {
    author: 6,
    postedAt: '2026-08-10T15:50:00+09:00',
    likeSlots: 14,
    title: 'クロージング雑談 — 山の日前の大陽線、どう扱う？',
    content:
      '祝日前に大きく上げると「持ち越す勇気」と「利確して休む」で分かれる日。投票：①何もせずホールド②一部利確③新規は見送り（今日の正解）④休み明けに考える。明日は山の日休場。無理にポジションをいじらないのも戦略です。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['雑談', '投票', '祝日', 'メンタル'],
    comments: [
      '③新規見送り。今日の自分への正解',
      '②少し利確して心を軽くした',
      '①ホールド。触ると負ける気がする',
      '④明けてから。祝日は家族優先',
      '大陽線の翌日ギャップは怖いよね',
      'わかる、だから追いかけなかった',
      '良い山の日を！',
      'ルール守れた人えらい',
    ],
  },
  {
    author: 4,
    postedAt: '2026-08-10T17:20:00+09:00',
    likeSlots: 15,
    title: '週次メモ — NFP→反発→次はCPI。ストーリーを固定しない',
    content:
      '先週：弱い雇用→米株高・金利低下。今日：日本も半導体・リクルートで大幅反発。でも「弱い雇用＝ずっと買い」は短絡。CPI・地政学・決算が残る。自分のルールは①ストーリー一発買い禁止②祝日前にサイズ増やさない③SNSの盛り上がりでルールを曲げない。今週守るルール、一言ください。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['振り返り', 'ルール', 'メンタル', 'マクロ'],
    comments: [
      '①守れそう。飛びつきそうになった',
      '②今日は増やさなかった。えらい自分',
      '③ストップ高見て欲しくなった…我慢',
      'コア積み立てだけ淡々と',
      'それが一番強い',
      'CPIまでは様子見で同意',
      '休み明けも同じルールで',
      'みんな冷静で助かるスレ',
    ],
  },
  {
    author: 11,
    postedAt: '2026-08-10T19:00:00+09:00',
    likeSlots: 13,
    title: '投票 — 休み明け（12日〜）最初に見るのは？',
    content:
      '①米CPI②ドル円・先物③半導体寄与（6857/8035）④リクルートなど決算銘柄の戻り⑤何も見ない・積立だけ。番号で。無理に新規を増やさない・分割のみ。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['投票', 'CPI', '為替', '半導体'],
    comments: [
      '①CPI。これが本命',
      '②為替から温度感見る',
      '③半導体のギャップだけ確認',
      '⑤積立だけ。一番強い',
      '④戻り待ちは危険かも',
      'わかる、高値掴みしやすい',
      '私は①→②の順',
      '冷静な投票ありがとう',
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Aug 10 hot-news posts…`)

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
