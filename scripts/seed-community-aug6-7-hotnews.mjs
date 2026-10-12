/**
 * Community: Aug 6–7 hot news — Nikkei semiconductor pullback, SoftBank earnings,
 * NVDA/Musk Vera Rubin, AMD, FOMC minutes (報道ベース). Conversational threads.
 *
 *   node scripts/seed-community-aug6-7-hotnews.mjs
 *   node scripts/seed-community-aug6-7-hotnews.mjs --dry-run
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
    postedAt: '2026-08-06T08:15:00+09:00',
    likeSlots: 15,
    title: '日経617円安の6万5683円 — 半導体に利益確定、でもTOPIXは続伸',
    content:
      '6日の日経平均は3日ぶり反落、終値6万5683円（-617円、-0.93％）。一時6万5000円割れも後場は下げ渋り。米ハイテク安とサンディスク時間外安が材料で、東エレク・アドテスト・キオクシア・SBGが指数を押し下げた一方、値上がり銘柄は7割超でTOPIXは+0.24％。指数と中身がズレる日。半導体フルベット勢はサイズ確認、内需・好決算は別物色。報道ベース・分割のみ。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['日経平均', '半導体', 'TOPIX', '日本'],
    comments: [
      '朝から8035・6857が重いね…',
      'でも値上がり銘柄7割って書いてある。指数だけ見てると騙される',
      'わかる、ファストリとか内需は買われてた',
      'キオクシアはサンディスク連想で売られやすそう',
      'TOPIX続伸なら「全面安」じゃないよね',
      '半導体は利益確定で一旦様子見派',
      '私もサイズだけ落とした。ルール優先',
      '後場の下げ渋りは海外先物買い？',
    ],
  },
  {
    author: 8,
    postedAt: '2026-08-06T10:40:00+09:00',
    likeSlots: 17,
    title: 'NVDA急騰 — マスク「Vera Rubinは最高のAIコンピュータ」、SpaceXが独占採用',
    content:
      'エヌビディア(NVDA)が急騰（報道ベースで+3％超、219ドル付近）。SpaceX決算コールでマスクCEOが「Vera Rubin architectureは最高のAIコンピュータ。今後はNVIDIAだけで構築する」と発言。地上DC＋軌道上Starmind衛星もRubin前提との話題。時価総額は5兆ドル超の議論も。日本では東エレク・アドテストのセンチメント材料だが、追っかけ買いは危険。8/26決算まで分割ウォッチ。',
    ticker: 'NVDA',
    sentiment: 'bullish',
    tags: ['NVIDIA', 'SpaceX', 'AI', 'VeraRubin'],
    comments: [
      'マスクの「exclusive」は強いね',
      '昨日のSpaceX初決算の本命はこれだった感じ',
      'AMD側はきつい材料だよね…',
      'うん、AMDは売られてる報道見てサイズ触らないと決めた',
      '日本半導体は連想買いになりやすいけどボラ高い',
      '219ドル付近、うちは追っかけ禁止ルール',
      '8/26決算まで新規は様子見で同意',
      'コアETF＋少額NVDAウォッチ派',
    ],
  },
  {
    author: 0,
    postedAt: '2026-08-06T12:20:00+09:00',
    likeSlots: 14,
    title: 'AMD大幅安報道 — SpaceXがNVIDIA独占、供給サイドの選別が加速？',
    content:
      'SpaceXがAIインフラをNVIDIA独占で構築すると表明した流れで、AMDが大きく売られたとの報道（-8％前後の話題）。データセンターGPUの「選ばれる側／外れる側」がより鮮明。個人は勝者総取りを前提にしない・ポジションをテーマ一本にしない。日本の装置株も連想で振れやすいので、ニュース反応だけの売買は避けたい。',
    ticker: 'AMD',
    sentiment: 'bearish',
    tags: ['AMD', 'NVIDIA', 'AI', '米国'],
    comments: [
      'AMD持ってる人つらそう…',
      '私は持ってないけど、AIテーマ全振りの怖さが出た日',
      'NVDA一本は精神衛生よくないよね',
      'そう、だからコアはVOO/オルカン派',
      '装置株も「連想だけ」で飛びつかない',
      'わかる、昨日の急騰の反動と材料が重なった',
      'メモ：選別加速＝ボラ拡大',
    ],
  },
  {
    author: 3,
    postedAt: '2026-08-06T15:50:00+09:00',
    likeSlots: 16,
    title: 'SBG決算 — 純利益3473億円（-17.7％）、一方NAVは過去最高72.3兆円',
    content:
      'ソフトバンクG(9984)が4–6月期決算を発表。純利益3473億円（前年同期比-17.7％）。投資利益は1.86兆円と大幅増（インテル株価上昇など）も、円安で為替差損、ArmのAI関連費用増、OpenAIは評価変わらずで利益寄与なしとの報道。NAVは6月末72.3兆円で過去最高。短期の損益と中長期のNAVを分けて見る材料。個別はサイズ控えめ・分割のみ。',
    ticker: '9984.T',
    sentiment: 'neutral',
    tags: ['ソフトバンクG', '決算', 'OpenAI', 'Arm'],
    comments: [
      '利益減でもNAV最高って説明むずくない？',
      'むずい。会計上の純利益と含み資産は別物ってことだよね',
      'OpenAIが寄与ゼロは意外だった',
      '為替差損1460億は円安の副作用だね',
      'Armの研究開発費増は成長投資枠で見る人もいそう',
      'CFO「短期の変動に一喜一憂しない」って言ってた',
      '指数寄与大きいから明日の寄与注意',
      '私は触らずウォッチリスト更新だけ',
    ],
  },
  {
    author: 5,
    postedAt: '2026-08-06T17:30:00+09:00',
    likeSlots: 13,
    title: 'クロージング雑談 — 半導体売り×好決算買い、今日の勝ちパターンは？',
    content:
      '今日の東証は「指数はマイナス、中身はまだ物色」。半導体・AIは利益確定、オムロンや花王など好決算・内需は買い、原油安でインフレ懸念後退も背景との解説が多い。あなたは①半導体を利確した②内需を拾った③何もしてない④明日のSBG反応待ち——どれ？無理に動かないのが正解の日も多い。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['雑談', '日本', '決算', 'メンタル'],
    comments: [
      '③何もしてない。正解だった気がする',
      '同じく③。見ているだけで十分だった',
      '①ちょっとだけ利確。サイズ戻した',
      '②食品・小売りを少額だけ',
      '④明日寄りでSBG見てから',
      '「指数と中身のズレ」メモ残した',
      'わかる、動きたくなる日ほどルール',
      '明日は米材料の残りも見る',
    ],
  },
  {
    author: 9,
    postedAt: '2026-08-07T07:40:00+09:00',
    likeSlots: 16,
    title: 'FOMC議事要旨 — 物価上振れリスクなお高く、利上げ議論も「割れている」',
    content:
      'FOMC議事要旨（報道ベース）。参加者は物価安定への上振れリスクをなお高く見つつ、雇用の下振れリスクはいくぶん和らいだとの見方。利上げをすぐ検討する声もある一方、インフレが2％に戻るシナリオでは据え置き〜利下げも議論、と「割れている」。ウォーシュ体制下の短い声明・フォワードガイダンス縮小も意識。日本株は金利・為替経由で反応しやすい。ポジションいじる前に現金比率メモだけ。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['FOMC', '金利', 'ドル円', 'マクロ'],
    comments: [
      '割れてる＝ボラ材料だよね',
      '利上げすぐ派がいるのは意外だった',
      '私は「すぐ動かない」が正解だと思う',
      'ドル円の振れで輸出・内需の見え方が変わる',
      'フォワードガイダンス縮小は読みにくい…',
      'わかる、だからサイズ小さめルール',
      '今日の雇用統計（もし注目なら）とセットで見る',
      'メモ：金利＞個別の日は触らない',
    ],
  },
  {
    author: 6,
    postedAt: '2026-08-07T09:10:00+09:00',
    likeSlots: 15,
    title: '寄り前チェック — NVDA材料の翌日、日本半導体は追う？追わない？',
    content:
      '昨夜〜米株でNVDAがマスク発言を材料に強い一方、前日の日本は半導体が利益確定売り。今日の寄りで東エレク・アドテスト・キオクシアがどう反応するか見たい。連想買いは「遅れての飛びつき」になりやすいので、自分はギャップ追っかけ禁止。SBG決算の消化売り/買い戻しもセット。全額禁止・分割のみ。',
    ticker: '8035.T',
    sentiment: 'neutral',
    tags: ['東エレク', 'アドバンテスト', 'キオクシア', '寄り付き'],
    comments: [
      '追っかけ禁止ルール、今日こそ効く日',
      '同感。ギャップ開けたら見送り',
      'キオクシアはメモリー材料がまだ重い？',
      'SBGは決算翌日だから寄与度だけ意識',
      '私は6857をウォッチリストに戻しただけ',
      'NVDA強い＝日本も全面高、とは限らないよね',
      'うん、昨日TOPIXと日経がズレたのもその例',
      '寄り30分は触らない派',
    ],
  },
  {
    author: 11,
    postedAt: '2026-08-07T11:45:00+09:00',
    likeSlots: 14,
    title: '雇用統計・週末前 — 動かない勇気、ありますか？',
    content:
      '週末前で米雇用関連も意識されやすい週。FOMC議事要旨で「割れた」あとは、数字一つでドル円と先物が振れやすい。個人の勝ちパターンは①イベント前にサイズを落とす②新規を増やさない③キャッシュ比率をメモする、が多い。投票：今日〜週末、あなたは①利確多め②ホールド③少額だけ④完全オフ。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['雇用統計', '投票', 'メンタル', '週末'],
    comments: [
      '④完全オフ。家族優先デー',
      '②ホールド。触ると負ける気がする',
      '①少しだけ利確して現金増やした',
      '③少額だけ。実験枠',
      'イベント前にサイズ落とすの賛成',
      'わかる、数字待ちでポジ増やす人の気持ちもわかるけど…',
      '私は③。ルール表を見直す時間にする',
      '良い週末を〜！',
    ],
  },
  {
    author: 4,
    postedAt: '2026-08-07T14:20:00+09:00',
    likeSlots: 15,
    title: '今週の振り返りスレ — ATH翌週の「調整」どう感じた？',
    content:
      '先週〜週初はダウATH・ハイパースケーラー急騰、そのあとSpaceX/NVDA材料、日本は半導体の上げ→利確。上がったあとの調整を「終わり」と取るか「押し目」と取るかで迷いやすい。自分のルールは：①テーマ全振りしない②決算・金利はサイズ半分③SNSで急いで買わない。みんなの今週一言ください。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['振り返り', 'AI', 'メンタル', 'ルール'],
    comments: [
      '押し目狙いしたくなったけど我慢した',
      'えらい。私も我慢枠',
      'NVDA発言は強かった。でも日本は別物',
      'SBG決算は「良い悪い」が同時で混乱した',
      '混乱する材料ほど触らないが正解',
      'コア積み立ては淡々と継続した',
      'それが一番強い…',
      '来週も分割・ルール優先で',
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Aug 6–7 hot-news posts…`)

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
