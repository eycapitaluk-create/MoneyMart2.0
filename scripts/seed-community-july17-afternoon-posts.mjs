/**
 * Seed community posts for 2026-07-17 afternoon (JST) —
 * Nikkei -2694 close, AI capex fears, 3-day weekend positioning.
 *
 *   node scripts/seed-community-july17-afternoon-posts.mjs
 *   node scripts/seed-community-july17-afternoon-posts.mjs --dry-run
 *   node scripts/seed-community-july17-afternoon-posts.mjs --replace
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

const SEED_MARKER = 'mm-community-seed-july17-afternoon-v1'

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

/** Afternoon posts — uneven likes & comment counts */
const POSTS = [
  {
    author: 2, postedAt: '2026-07-17T12:08:00+09:00',
    title: '昼休み — 日経64000割れ、前場の-4000円超はまだ生々しい',
    content: '昼の時点でも64100円台前半。一時4100円超安まで振れたあと戻したが、半導体・AI関連の利確売りが止まらない。午後は「戻し」より「底探り」に見える。個別は触らず、指数と為替だけ見る日。',
    ticker: 'N225', sentiment: 'bearish', tags: ['日経平均', '昼休み', '半導体'],
    likes: 167,
    comments: [
      '4100円超、記憶に残る。',
      '戻し弱い印象。',
      '触らない日、同意。',
      '為替も見ます。',
    ],
  },
  {
    author: 7, postedAt: '2026-07-17T12:35:00+09:00',
    title: 'TSMC設備投資 — AI回収期間への不安が震源か',
    content: 'TSMCの設備投資拡大と、AI投資の回収期間が長いという指摘が海外メディアで拡散。装置・メモリ・ファウンドリの連想売りが日本にも波及。ファンダより「ナラティブの反転」に近い。決算前はサイズ半分でも遅くない。',
    ticker: 'TSM', sentiment: 'bearish', tags: ['TSMC', 'AI', '設備投資'],
    likes: 203,
    comments: [
      '回収期間、刺さる。',
      'ナラティブ反転、わかる。',
      'サイズ半分、今日やる。',
      '装置も連れ安。',
      '決算待ち。',
      'ファンダより需給。',
    ],
  },
  {
    author: 10, postedAt: '2026-07-17T13:02:00+09:00',
    title: '韓国市場休場 — 比較対象がない日の日本株',
    content: '今日は韓国が休場でKOSPI/KOSDAQのリアルタイム比較がない。ハイニックス連想売りの「鏡」が欠けている分、国内需給だけで動く。午後の値動きは海外先物とドル円が主役になりそう。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['韓国株', '休場', '需給'],
    likes: 58,
    comments: [
      '比較対象ないの地味に効く。',
      'ドル円見ます。',
    ],
  },
  {
    author: 4, postedAt: '2026-07-17T13:28:00+09:00',
    title: 'キオクシア・アドテスト — 後場も指数押し下げの主役',
    content: '285A・6857が寄与度上位のまま。東エレクも重い。AI一色の日に「持ち株が指数の敵」になるのは辛いが、需給の日はそういうもの。損切り線だけ再確認して、新規は見送り。',
    ticker: '285A.T', sentiment: 'bearish', tags: ['キオクシア', 'アドバンテスト', '半導体'],
    likes: 91,
    comments: [
      '285A重すぎ。',
      '新規見送り、同意。',
      '損切り線確認した。',
      '6857も痛い。',
    ],
  },
  {
    author: 0, postedAt: '2026-07-17T13:55:00+09:00',
    title: '海運・医薬が相対強 — 下げ相場の「逃げ場」セクター',
    content: '非鉄・電気機器が売られている一方、海運と医薬がプラス寄与。完全なセクターローテというより、AI以外への資金シフトの初期。全部乗り換えはやりすぎだが、ヒートマップで偏りチェックは有効。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['セクターローテ', '海運', '医薬'],
    likes: 124,
    comments: [
      '海運プラス、意外。',
      '偏りチェックします。',
      '全部乗り換えはやりすぎ。',
      '医薬も目立つ。',
      'AI以外に目を向ける日。',
    ],
  },
  {
    author: 8, postedAt: '2026-07-17T14:22:00+09:00',
    title: '3連休前 — 週末ポジションをどうするか',
    content: '月曜は海の日で3連休。金曜大引け前に現金比率を上げる動きが出やすい。特にレバ・信用は週末リスク。積立NISAは触らないが、サテライト個別は半分利確もアリ。FOMOより「月曜のギャップ」を恐れる。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['3連休', 'ポジション', '海の日'],
    likes: 178,
    comments: [
      '週末リスク、信用は怖い。',
      '積立は触らない。',
      'サテライト半分利確、検討。',
      '月曜ギャップ、同意。',
      '現金比率メモ。',
      'FOMOやめ。',
    ],
  },
  {
    author: 11, postedAt: '2026-07-17T14:48:00+09:00',
    title: 'GPIFの姿勢 — 長期資金は今日動かない、という安心',
    content: '年金積立金の運用方針は今日の急落で変わらない、という解説が多い。個人がパニック売りする局面こそ、機関の「動かない」が支えになる。とはいえ個別の高ベータは別問題。コアETFと個別の線引きを再確認。',
    ticker: '1306.T', sentiment: 'bullish', tags: ['GPIF', '年金', '長期投資'],
    likes: 142,
    comments: [
      '機関動かない、安心材料。',
      '個別高ベータは別、同意。',
      'コアETF線引き。',
      'パニック売りしない。',
    ],
  },
  {
    author: 5, postedAt: '2026-07-17T15:12:00+09:00',
    title: 'ドル円146円台 — 円高進行が輸出株を二重に押す',
    content: '円高が進むと輸出株のEPS期待も下がる。半導体売りに為替が上乗せ。145円割れは心理線。為替ヘッジなしの個別は今日特に厳しい。1306/2559など円建てコアの方が相対的に楽。',
    ticker: 'USDJPY', sentiment: 'bearish', tags: ['為替', 'ドル円', '円高'],
    likes: 86,
    comments: [
      '146円台、重い。',
      '円建てコア助かる。',
      '145割れ注意。',
    ],
  },
  {
    author: 9, postedAt: '2026-07-17T15:38:00+09:00',
    title: '底値拾い vs 様子見 — 午後の議論、どっち派？',
    content: '「歴史的急落日は買い」派と「トレンド崩れは待て」派が割れている。2694円安は過去5位級だが、V字かL字かはまだ不明。私は分割1回だけ、残りは月曜寄付き。全額突っ込みはやらない。',
    ticker: 'N225', sentiment: 'neutral', tags: ['底値', '議論', '分割買い'],
    likes: 256,
    comments: [
      '分割1回、同じ。',
      '全額突っ込みは無理。',
      'V字かL字、まだ不明。',
      '月曜寄付き待ち派。',
      '5位級は買い派。',
      'トレンド崩れ派。',
      '今日は半分だけ。',
      '議論おもしろい。',
    ],
  },
  {
    author: 1, postedAt: '2026-07-17T15:55:00+09:00',
    title: '大引け前 — 日経2694円安・64141円、過去5位級の下落',
    content: '終値64141円、-2694円（約4%弱）。一時4100円超安から戻したが、終値ベースでも過去5位級。半導体・AI利確＋TSMC設備投資懸念＋3連休前のポジション整理が重なった日。現金比率をメモして週末。',
    ticker: 'N225', sentiment: 'bearish', tags: ['大引け', '日経平均', '急落'],
    likes: 312,
    comments: [
      '2694円安、歴史的。',
      '4100から戻したが重い。',
      '5位級、記録。',
      '現金比率メモした。',
      '週末は触らない。',
      '半導体利確の日。',
      '3連休前整理。',
      '積立は継続。',
      '来週の材料待ち。',
    ],
  },
  {
    author: 6, postedAt: '2026-07-17T16:18:00+09:00',
    title: 'メガバンク・商社 — 下げ日でも相対的に健闘',
    content: '8306・8058あたりが指数対比で粘る。金利ある世界＋バリュエーション見直しの流れは続いている。全部AIから逃げる必要はないが、ポートフォリオの偏りを今日の教訓に。NISA成長枠の再配分メモ。',
    ticker: '8306.T', sentiment: 'bullish', tags: ['銀行', '商社', 'バリュー'],
    likes: 103,
    comments: [
      '銀行粘る。',
      '偏りメモ。',
      '再配分検討。',
      '全部逃げなくていい。',
    ],
  },
  {
    author: 3, postedAt: '2026-07-17T16:45:00+09:00',
    title: 'ASML・ラム — 欧州装置も軟調、連想売りの連鎖',
    content: '欧州時間前の装置株も軟調。日本の6857・8035とセットで見ると「AI capex cycle peak?」の議論が続く。決算で材料が出るまでサテライトは半分。コアETFは予定通り積立。',
    ticker: 'ASML', sentiment: 'bearish', tags: ['ASML', '装置', 'AI'],
    likes: 72,
    comments: [
      'capex peak、怖い。',
      'サテライト半分。',
      'コアは積立継続。',
    ],
  },
  {
    author: 11, postedAt: '2026-07-17T17:12:00+09:00',
    title: 'NISA成長枠 — 急落日の「やること／やらないこと」',
    content: 'やらない：積立停止、レバ追加、SNSの今が底。やる：現金比率メモ、コア（1306/2559）継続、個別は損切り線確認。2694円安は数字として大きいが、長期では「続けた月数」が効く。',
    ticker: '1306.T', sentiment: 'bullish', tags: ['NISA', '積立', 'メンタル'],
    likes: 228,
    comments: [
      '続けた月数、刺さる。',
      '積立止めない。',
      'レバ触らない。',
      '現金メモ。',
      '同じリスト使ってます。',
      '今日は触らない。',
      'コアだけ見る。',
    ],
  },
  {
    author: 4, postedAt: '2026-07-17T17:48:00+09:00',
    title: '週末読書 — 健全な調整 vs トレンド転換、どう見分ける？',
    content: '3連休でニュースを整理する時間。過去の急落日チャートと今日を並べて見る。V字回復の条件（材料・需給・金利）とL字の条件（トレンド・バリュエーション）をメモ。月曜寄付き前にルールだけ決めておく。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['週末', 'チャート', 'ルール'],
    likes: 94,
    comments: [
      '3連休で整理。',
      'V字L字メモ。',
      '月曜前にルール決め。',
      'チャート並べて見る。',
    ],
  },
  {
    author: 0, postedAt: '2026-07-17T18:25:00+09:00',
    title: '7/17振り返り — 64141円引け、来週の注目材料',
    content: '今日は2694円安の64141円引け。半導体・AI・為替・3連休前が重なった。来週はTSMC/ASML決算、米CPI、日銀関連のニュース。週末は触らず、月曜寄付きでサイズだけ確認。お疲れさまでした。',
    ticker: 'N225', sentiment: 'neutral', tags: ['振り返り', '来週', '材料'],
    likes: 185,
    comments: [
      'お疲れさま。',
      '来週材料多い。',
      '週末触らない。',
      '月曜サイズ確認。',
      '64141、覚えておく。',
      '2694円安の日。',
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
    console.log(`  would remove ${seedIds.length} existing july17-afternoon posts`)
    return
  }
  await admin.from('lounge_comments').delete().in('post_id', seedIds)
  await admin.from('lounge_post_tags').delete().in('post_id', seedIds)
  await admin.from('lounge_post_likes').delete().in('post_id', seedIds)
  await admin.from('lounge_post_bookmarks').delete().in('post_id', seedIds)
  await admin.from('lounge_posts').delete().in('id', seedIds)
  console.log(`  removed ${seedIds.length} old july17-afternoon posts`)
}

async function main() {
  const existingIds = await findSeedPostIds()
  if (existingIds.length && !REPLACE) {
    console.log('July 17 afternoon seed already exists. Use --replace to rebuild.')
    return
  }

  console.log(DRY_RUN ? 'Dry run (July 17 afternoon)…' : REPLACE ? 'Replace July 17 afternoon seed…' : 'Seeding July 17 afternoon posts…')
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
      await admin.from('lounge_post_likes').insert({
        post_id: post.id,
        user_id: likerMapped.userId,
        created_at: createdAt,
      })
    }

    for (let c = 0; c < commentTexts.length; c += 1) {
      const commentPersona = PERSONAS[(row.author + c + 2) % PERSONAS.length]
      const commentMapped = personaMap.get(commentPersona.email)
      if (!commentMapped) continue
      const commentAt = new Date(new Date(row.postedAt).getTime() + (c + 1) * 4 * 60 * 1000).toISOString()
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

  console.log(`Done. ${posts} posts, ${comments} comments, ${likes} like_count total (2026-07-17 afternoon).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
