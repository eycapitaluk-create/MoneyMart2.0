/**
 * Seed community posts for 2026-07-14 (JST) — US close reaction + CPI / Warsh week.
 * Times clustered in early JST morning (= US 7/13 close window) then staggered through 午前.
 *
 *   node scripts/seed-community-july14-posts.mjs
 *   node scripts/seed-community-july14-posts.mjs --dry-run
 *   node scripts/seed-community-july14-posts.mjs --replace
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"'))
      || (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = val
    }
  }
}

loadEnvFile(path.resolve(__dirname, '..', '.env.local'))
loadEnvFile(path.resolve(__dirname, '..', '.env'))

const DRY_RUN = process.argv.includes('--dry-run')
const REPLACE = process.argv.includes('--replace')
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim()
const SERVICE_KEY = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '',
).trim()

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const SEED_MARKER = 'mm-community-seed-july14-v1'

/** @type {{ email: string, name: string, exp: number }[]} */
const PERSONAS = [
  { email: 'mm-seed-01@community.seed', name: '田中健太', exp: 4200 },
  { email: 'mm-seed-02@community.seed', name: '佐藤美咲', exp: 3100 },
  { email: 'mm-seed-03@community.seed', name: '鈴木大輔', exp: 2800 },
  { email: 'mm-seed-04@community.seed', name: '高橋翔', exp: 5200 },
  { email: 'mm-seed-05@community.seed', name: '伊藤恵', exp: 1900 },
  { email: 'mm-seed-06@community.seed', name: '渡辺直樹', exp: 1500 },
  { email: 'mm-seed-07@community.seed', name: '山本涼', exp: 3600 },
  { email: 'mm-seed-08@community.seed', name: '中村さくら', exp: 2400 },
  { email: 'mm-seed-09@community.seed', name: '小林拓海', exp: 4800 },
  { email: 'mm-seed-10@community.seed', name: '加藤悠真', exp: 2700 },
  { email: 'mm-seed-11@community.seed', name: '吉田隼人', exp: 3300 },
  { email: 'mm-seed-12@community.seed', name: '松本彩', exp: 2100 },
]

/**
 * 7/14 JST — 米7/13引け直後は夜明け帯、以降は午前〜昼にばらす。
 * likes / comments は意図的にばらつき。
 */
const POSTS = [
  {
    author: 3, postedAt: '2026-07-14T04:52:00+09:00',
    title: '米引け速報 — NVDA -3.4%、MU -5.8%、サンディスク -12.5%',
    content: '米7/13引け。エヌビディア約-3.4%、マイクロン約-5.8%、サンディスク約-12.5%。10年債利回り上昇と「AI過熱のバリュエーション再調整」がセットで語られている。日本勢は寄り前にサイズ確認だけで十分。飛び乗りは禁止。',
    ticker: 'NVDA', sentiment: 'bearish', tags: ['エヌビディア', 'マイクロン', '米国市場'],
    likes: 176,
    comments: [
      'サンディスク二桁安は重い。',
      '寄り前は触らない。',
      'バリュエーション再調整、同意。',
      'サイズ半分にします。',
      'MUもキツい。',
    ],
  },
  {
    author: 8, postedAt: '2026-07-14T05:18:00+09:00',
    title: '10年債利回り上昇 — グロースに冷水の構図',
    content: '金利上昇局面は割引率の話。半導体バスケットが一斉に売られるのはファンダより「金利感応度」。今日の日本寄りもギャップを恐れず、損切り線だけ決めておく。NISAコアはいつも通り。',
    ticker: 'TOPIC', sentiment: 'bearish', tags: ['金利', '国債', 'グロース'],
    likes: 94,
    comments: [
      '金利感応度、わかりやすい。',
      'コアはそのまま。',
      '損切り線決めた。',
    ],
  },
  {
    author: 1, postedAt: '2026-07-14T05:47:00+09:00',
    title: '先週の半導体リバウンドを忘れるな — AMD・NVDA・AVGO強かった',
    content: '7/6〜10の週はAMD約+7.7%、NVDA約+8.3%、AVGO約+11%、サンディスク約+9.8%、シーゲート約+11%。Nasdaq100週次約+1.7%。昨夜の下落は「上げの途中の調整」か「流れの転換」か、まだ断言しない方がいい。',
    ticker: 'AVGO', sentiment: 'neutral', tags: ['半導体', '週次', 'リバウンド'],
    likes: 128,
    comments: [
      '週次で見るとまだ強い。',
      '転換断言は早い、同意。',
      'AVGOの勢いはすごかった。',
      '調整として見る派。',
    ],
  },
  {
    author: 11, postedAt: '2026-07-14T06:15:00+09:00',
    title: 'VXN 33→24台へ急低下 — ボラが一晩で鎮まる日もあった',
    content: '先週は変動性指数VXNがおよそ33.41から24.89まで低下した、とのまとめ。恐怖が一巡すると買われやすいが、昨夜の半導体売りで再びボラが戻るか注視。ヒートマップで「何が売られたか」だけ確認。',
    ticker: 'QQQ', sentiment: 'neutral', tags: ['変動性', 'ナスダック', 'ヒートマップ'],
    likes: 61,
    comments: [
      'VXN低下は安心材料だったのに。',
      'ヒートマップ見てから動く。',
    ],
  },
  {
    author: 4, postedAt: '2026-07-14T06:41:00+09:00',
    title: '今日の最大イベント — 米6月CPI＋Warsh議長の議会証言',
    content: '7/14は米6月CPI発表。7/14〜15はWarsh議長の議会証言週。今週の主役はここ。予想はヘッドライン前年比が5月4.2%→3.8%へ鈍化、コアは2.9%横ばいイメージ。数字が市場コンセンサス通りでも「反応」で動く日。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['CPI', 'FRB', '金利'],
    likes: 212,
    comments: [
      '今週最大イベント、同意。',
      '予想通りでも反応注意。',
      'コア横ばいがポイントかも。',
      '証言週はボラ覚悟。',
      'ポジション軽めで臨む。',
      '2559は触らない予定。',
      '数字よりトーン重要。',
    ],
  },
  {
    author: 0, postedAt: '2026-07-14T07:08:00+09:00',
    title: 'CPIどう読む？ — 鈍化なら安堵、コア粘着なら金利再上昇警戒',
    content: 'ヘッドライン鈍化は表面的な安心材料になりやすい。でもコアが粘ると「利下げ遠い」が意識され、グロースに逆風。個人は予想当てゲームをせず、シナリオA/B（安堵買い／金利高再燃）だけ頭に入れておく。',
    ticker: '2559.T', sentiment: 'neutral', tags: ['物価', 'NISA', 'シナリオ'],
    likes: 147,
    comments: [
      'シナリオだけ用意、いい。',
      'コア粘着が怖い。',
      '予想当てゲームしない。',
      '積立は淡々と。',
      '安堵買い飛び乗り禁止。',
    ],
  },
  {
    author: 9, postedAt: '2026-07-14T07:36:00+09:00',
    title: '日経は7万円台回復を試す？ — 想定レンジ6.6万〜7.2万',
    content: '東京時間は7万円台回復を意識する見方が多いが、想定レンジはざっくり66,000〜72,000円。昨夜の米半導体売りが入るなら下振れ寄りスタートもありうる。レンジ取引の日は「張り付き禁止」、指値と時間切れルール。',
    ticker: 'N225', sentiment: 'neutral', tags: ['日経平均', 'レンジ', '寄り付き'],
    likes: 103,
    comments: [
      '7万円意識、わかる。',
      '下振れ寄り警戒。',
      '張り付き禁止、大事。',
    ],
  },
  {
    author: 6, postedAt: '2026-07-14T08:05:00+09:00',
    title: 'サンディスク急落の余波 — メモリ・ストレージ連想に注意',
    content: '米サンディスク二桁安は日本のメモリ・装置の寄りにも影を落とすことがある。ファンダよりバスケット売り。285Aや装置株は寄付きギャップだけで判断せず、30分は様子見でも遅くない。',
    ticker: 'SNDK', sentiment: 'bearish', tags: ['サンディスク', 'メモリ', '連想売り'],
    likes: 88,
    comments: [
      '連想売り警戒。',
      '30分様子見します。',
      '装置株も注意。',
      'ナンピンしない。',
    ],
  },
  {
    author: 2, postedAt: '2026-07-14T08:42:00+09:00',
    title: 'Warsh証言前 — トーン次第で金利とテックがセットで動く',
    content: '新体制の議会対応は「何を言うか」より「どう聞こえるか」。タカ派トーンなら金利↑・テック↓、ハト派寄りなら逆。CPI当日内に発言が重なると一本調子になりにくい。今日はサイズ半分で十分。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['議会証言', '金利', 'テック'],
    likes: 72,
    comments: [
      'どう聞こえるか、妙にリアル。',
      'サイズ半分、やります。',
    ],
  },
  {
    author: 10, postedAt: '2026-07-14T09:20:00+09:00',
    title: '寄り付きメモ — 米半導体安を織り込むか、内需・金融が相対安泰か',
    content: '昨夜の米ハイテク売りを先に織り込むなら電気機器が重い寄り。先週までの「半導体一本」からローテが進むなら金融・内需が相対的に堅い可能性。ヒートマップで寄与を見てから動く。',
    ticker: 'N225', sentiment: 'neutral', tags: ['寄り付き', 'セクターローテ', 'ヒートマップ'],
    likes: 119,
    comments: [
      'ヒートマップから見る。',
      '金融が相対堅いといいな。',
      '電気機器重い寄り想定。',
      '一本槍はやめる。',
    ],
  },
  {
    author: 5, postedAt: '2026-07-14T09:55:00+09:00',
    title: 'NISA勢の今日のルール — CPI当日は「見に行くだけ」',
    content: '①積立は止めない ②CPI結果でレバしない ③SNSの結論を鵜呑みにしない。やるなら現金比率メモと損切り線の確認だけ。長期では今夜の指標より「続けた月数」。',
    ticker: '1306.T', sentiment: 'bullish', tags: ['NISA', '積立', 'メンタル'],
    likes: 231,
    comments: [
      '見に行くだけ、いい言葉。',
      'レバしない、同意。',
      '続けた月数、刺さる。',
      '積立継続。',
      '現金メモした。',
      'SNS結論鵜呑み禁止。',
      '今日は触らない日。',
      'コアETFだけ見る。',
    ],
  },
  {
    author: 7, postedAt: '2026-07-14T10:33:00+09:00',
    title: 'マイクロン安と日本メモリ — 同じストーリーに見えて別物',
    content: 'MUの下落は米AI需要・在庫サイクルの話が混ざる。日本のキオクシアなどは為替・需給・国内フローが別レイヤー。連想で全部売るのは簡単だが、戻しもバラバラ。ウォッチは分けて持つ。',
    ticker: 'MU', sentiment: 'neutral', tags: ['マイクロン', 'キオクシア', 'メモリ'],
    likes: 54,
    comments: [
      'ウォッチ分け、いい考え方。',
      '連想売りは簡単、わかる。',
    ],
  },
  {
    author: 3, postedAt: '2026-07-14T11:18:00+09:00',
    title: '午後にかけての構図 — CPI秒読み、先物とドル円を同時に見る',
    content: '東京前場で一通り消化しても、本命は米指標。先物・ドル円・金利先物の三位一体が動くと半導体バスケットが再加速しやすい。指値を置きすぎない。イベント日は「注文を減らす」がエッジ。',
    ticker: 'USDJPY', sentiment: 'neutral', tags: ['為替', '先物', 'イベント'],
    likes: 67,
    comments: [
      '注文減らす、同意。',
      '三位一体、わかりやすい。',
      '指値置きすぎ注意。',
    ],
  },
  {
    author: 8, postedAt: '2026-07-14T12:05:00+09:00',
    title: '先週上げ→昨夜下げ — 「週末ポジション」を持ち越した人へ',
    content: '週次プラスのあとの調整は普通にある。問題はサイズ。週末に膨らませたままCPI週に入ると心が折れる。今日リセットできるならする。できないなら増玉だけはやめる。',
    ticker: 'NVDA', sentiment: 'bearish', tags: ['ポジション', 'リスク管理', '半導体'],
    likes: 141,
    comments: [
      '増玉禁止、守れます。',
      'サイズが問題、同意。',
      'リセット検討中。',
      '心が折れる前に軽くする。',
      '普通の調整と信じる派。',
    ],
  },
  {
    author: 0, postedAt: '2026-07-14T13:40:00+09:00',
    title: '昼休みまとめ — 材料は出揃った、あとは反応待ち',
    content: '米半導体安・金利上昇ストーリー、CPI・証言カレンダー、日経レンジ観。個人にできるのはルール実行だけ。コミュニティの意見は参考にして、最終判断は自分の口座サイズで。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['まとめ', 'ルール', 'CPI'],
    likes: 85,
    comments: [
      'ルール実行だけ、いい。',
      '参考までに見ます。',
      '口座サイズ重要。',
    ],
  },
  {
    author: 11, postedAt: '2026-07-14T15:25:00+09:00',
    title: '大引け前メモ — CPI前夜の持ち越しは「小さいかゼロ」',
    content: '今夜〜翌朝の本命に向け、デイトレ残余は片付けたい。持ち越すならコアETFと、試算したサイズの個別だけ。指標直後のスリッページは敵。また明日、数字とトーンを一緒に見よう。',
    ticker: 'N225', sentiment: 'neutral', tags: ['大引け', '持ち越し', 'CPI'],
    likes: 98,
    comments: [
      '持ち越し小さめにします。',
      'スリッページ敵、わかる。',
      'また明日。',
      'トーンも見る派。',
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
  let userId = await findUserIdByEmail(email)
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: `MmSeed!${persona.name.length}99`,
      email_confirm: true,
      user_metadata: { full_name: persona.name, display_name: persona.name, seed: SEED_MARKER },
    })
    if (error) throw error
    userId = data.user.id
    console.log(`  created user ${persona.name}`)
  }

  await admin.from('user_profiles').upsert({
    user_id: userId,
    nickname: persona.name,
    full_name: persona.name,
  }, { onConflict: 'user_id' })

  const level = persona.exp >= 6000 ? 5 : persona.exp >= 2500 ? 4 : persona.exp >= 900 ? 3 : persona.exp >= 300 ? 2 : 1
  await admin.from('lounge_character_stats').upsert({
    user_id: userId,
    total_exp: persona.exp,
    level,
    character_stage: level,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  return { userId, name: persona.name }
}

async function findSeedPostIds() {
  const ids = new Set()
  const { data: byContent } = await admin
    .from('lounge_posts')
    .select('id')
    .ilike('content', `%${SEED_MARKER}%`)
  for (const row of byContent || []) ids.add(row.id)

  // Fallback: seed personas within this batch's postedAt window
  const times = POSTS.map((p) => new Date(p.postedAt).getTime()).filter(Number.isFinite)
  if (times.length) {
    const minAt = new Date(Math.min(...times) - 60_000).toISOString()
    const maxAt = new Date(Math.max(...times) + 60_000).toISOString()
    const authorEmails = new Set(POSTS.map((p) => PERSONAS[p.author]?.email).filter(Boolean))
    const authorIds = []
    for (const persona of PERSONAS) {
      if (!authorEmails.has(persona.email)) continue
      const id = await findUserIdByEmail(persona.email.toLowerCase())
      if (id) authorIds.push(id)
    }
    if (authorIds.length) {
      const { data: byWindow } = await admin
        .from('lounge_posts')
        .select('id')
        .in('author_id', authorIds)
        .gte('created_at', minAt)
        .lte('created_at', maxAt)
      for (const row of byWindow || []) ids.add(row.id)
    }
  }
  return [...ids]
}

async function purgeExisting() {
  const seedIds = await findSeedPostIds()
  if (seedIds.length === 0) return
  if (DRY_RUN) {
    console.log(`  would remove ${seedIds.length} existing july14 posts`)
    return
  }
  await admin.from('lounge_comments').delete().in('post_id', seedIds)
  await admin.from('lounge_post_tags').delete().in('post_id', seedIds)
  await admin.from('lounge_post_likes').delete().in('post_id', seedIds)
  await admin.from('lounge_post_bookmarks').delete().in('post_id', seedIds)
  await admin.from('lounge_posts').delete().in('id', seedIds)
  console.log(`  removed ${seedIds.length} old july14 posts`)
}

async function main() {
  const existingIds = await findSeedPostIds()
  if (existingIds.length && !REPLACE) {
    console.log('July 14 seed already exists. Use --replace to rebuild.')
    return
  }

  console.log(DRY_RUN ? 'Dry run (July 14)…' : REPLACE ? 'Replace July 14 seed…' : 'Seeding July 14 posts…')
  if (REPLACE || existingIds.length) await purgeExisting()

  const personaMap = new Map()
  for (const persona of PERSONAS) {
    personaMap.set(persona.email, await ensurePersona(persona))
  }

  let posts = 0
  let comments = 0
  let likes = 0

  for (let i = 0; i < POSTS.length; i += 1) {
    const row = POSTS[i]
    const persona = PERSONAS[row.author]
    const mapped = personaMap.get(persona.email)
    if (!mapped) continue

    const createdAt = new Date(row.postedAt).toISOString()
    const commentTexts = row.comments || []
    const commentTotal = commentTexts.length
    const hotScore = row.likes * 2 + commentTotal * 3 + 40
    const content = String(row.content || '')

    const payload = {
      author_id: mapped.userId,
      author_name: mapped.name,
      title: row.title,
      content,
      ticker: row.ticker || null,
      asset_type: 'stock',
      sentiment: row.sentiment || 'neutral',
      like_count: row.likes,
      comment_count: commentTotal,
      bookmark_count: Math.floor(row.likes / 12),
      view_count: row.likes * 14 + commentTotal * 35,
      hot_score: hotScore,
      status: 'published',
      created_at: createdAt,
      updated_at: createdAt,
    }

    if (DRY_RUN) {
      console.log(`[dry-run] ${row.postedAt} ${row.title} (+${commentTotal}c / ${row.likes}♥)`)
      posts += 1
      comments += commentTotal
      likes += row.likes
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

    const likeSlots = Math.min(
      PERSONAS.length - 1,
      Math.max(0, Math.min(row.likes, 4 + (row.likes % 8))),
    )
    for (let li = 0; li < likeSlots; li += 1) {
      const liker = PERSONAS[(row.author + li + 1) % PERSONAS.length]
      const likerMapped = personaMap.get(liker.email)
      if (!likerMapped || likerMapped.userId === mapped.userId) continue
      await admin.from('lounge_post_likes').upsert({
        post_id: post.id,
        user_id: likerMapped.userId,
      }, { onConflict: 'post_id,user_id' })
    }

    const baseMs = new Date(row.postedAt).getTime()
    for (let c = 0; c < commentTexts.length; c += 1) {
      const commentAuthor = PERSONAS[(row.author + c + 1) % PERSONAS.length]
      const commentMapped = personaMap.get(commentAuthor.email)
      if (!commentMapped) continue
      const commentAt = new Date(baseMs + (c + 1) * 3 * 60000 + c * 70000).toISOString()
      await admin.from('lounge_comments').insert({
        post_id: post.id,
        author_id: commentMapped.userId,
        author_name: commentMapped.name,
        content: commentTexts[c],
        status: 'published',
        created_at: commentAt,
        updated_at: commentAt,
      })
      comments += 1
    }

    posts += 1
    likes += row.likes
  }

  console.log(`Done. ${posts} posts, ${comments} comments, ${likes} like_count total (2026-07-14 JST).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
