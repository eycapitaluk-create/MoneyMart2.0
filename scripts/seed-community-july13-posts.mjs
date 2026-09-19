/**
 * Seed community posts dated 2026-07-13 (JST) — Nikkei drop, semis, Middle East oil, MUFG.
 *
 *   node scripts/seed-community-july13-posts.mjs
 *   node scripts/seed-community-july13-posts.mjs --dry-run
 *   node scripts/seed-community-july13-posts.mjs --replace
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

const SEED_MARKER = 'mm-community-seed-july13-v1'

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

/** Posts on 2026-07-13 JST (月曜) — live headlines; uneven likes/comments */
const POSTS = [
  {
    author: 0, postedAt: '2026-07-13T07:48:00+09:00',
    title: '7/13朝 — 週明け日経は半導体売り＋中東不安で軟調スタート',
    content: '寄り付きから日経は弱い。海外大手半導体の決算を控えたポジション調整に加え、中東情勢の緊迫で原油高・リスクオフ。個人は「寄付きギャップで慌てて売らない」。NISA積立は触らず、個別はサイズ確認から。',
    ticker: 'N225', sentiment: 'bearish', tags: ['日経平均', '半導体', '中東'],
    likes: 96,
    comments: [
      '積立は触らない、同意。',
      '寄付きで慌てない、大事。',
      '半導体決算前の調整っぽい。',
    ],
  },
  {
    author: 8, postedAt: '2026-07-13T09:12:00+09:00',
    title: 'キオクシア(285A) — 値下がり寄与トップ級、連想売り警戒',
    content: '前場の値下がり寄与で285Aが上位に。アドバンテストや東エレクなど装置株も軟調。NANDファンダと株価は短期で乖離しやすい日。NISA成長枠の主力にはせず、特定口座のサテライトなら損切り線だけ決めておく。',
    ticker: '285A.T', sentiment: 'bearish', tags: ['Kioxia', '285A', '半導体'],
    likes: 154,
    comments: [
      '寄与度トップ、重い。',
      '装置株も連れ安。',
      '損切り線、決めました。',
      'NISAには入れない派。',
      '底値拾いはまだ早い？',
      'ボラ高い日はサイズ半分。',
    ],
  },
  {
    author: 3, postedAt: '2026-07-13T10:05:00+09:00',
    title: '中東緊迫・原油高 — インフレ再燃懸念が株に逆風',
    content: '米イラン関連の緊張で原油が上昇しやすい局面。金利上昇観測とセットになるとグロースに冷水。輸送・エネルギー関連は別だが、半導体・ハイテクは金利感応度が高い。ヒートマップでセクター偏りを確認してから動く。',
    ticker: 'TOPIC', sentiment: 'bearish', tags: ['原油', '中東', '金利'],
    likes: 47,
    comments: [
      '原油高＋金利、怖い組み合わせ。',
      'ヒートマップ見てます。',
    ],
  },
  {
    author: 11, postedAt: '2026-07-13T11:20:00+09:00',
    title: '韓国KOSPI大幅安 — SKハイニックス売りが日本メモリにも波及',
    content: '韓国市場の半導体売りが強いとの報道。AIバリュエーション見直しの空気が広がると、285A・国内装置株も逃げ場がなくなりやすい。連想売りは「ニュースの質」より需給。現金比率を少し上げて様子見。',
    ticker: '000660', sentiment: 'bearish', tags: ['SKハイニックス', 'KOSPI', 'メモリ'],
    likes: 121,
    comments: [
      '韓国発の連想売り、あるある。',
      '現金比率上げました。',
      'AI過熱の見直し局面かも。',
      '日本株も逃げ場なし感。',
    ],
  },
  {
    author: 4, postedAt: '2026-07-13T12:15:00+09:00',
    title: '前場終了 — 日経770円安、半導体が指数を押し下げ',
    content: '前場終値イメージで日経は770円前後安。一時1300円超安の場面も。一方で好決算の小売や金融の一角は相対的に堅い。セクター分散のありがたみが出る日。NISAコア（1306/2559）は予定通りでOK。',
    ticker: 'N225', sentiment: 'bearish', tags: ['日経平均', '前場', 'NISA'],
    likes: 68,
    comments: [
      '770円安、重い。',
      '金融・小売が支え、わかる。',
      'コア積立は継続。',
    ],
  },
  {
    author: 1, postedAt: '2026-07-13T13:02:00+09:00',
    title: '三菱UFJ、時価総額でトヨタ抜き首位の場面 — 「金利ある世界」',
    content: '金利上昇期待で銀行株に資金。8306が時価総額首位に浮上する場面があったとのニュース。半導体一辺倒の週とは真逆の物色。成長枠に高配当・金融を薄く混ぜる派には材料。ただし金利は両刃。',
    ticker: '8306.T', sentiment: 'bullish', tags: ['三菱UFJ', '銀行', '金利'],
    likes: 183,
    comments: [
      '金利ある世界、銀行追い風。',
      'トヨタ抜き首位、象徴的。',
      '金融を薄く混ぜてます。',
      '金利は両刃、同意。',
      '半導体偏り見直しのきっかけ。',
      'NISAで8306、ありかも。',
      '商社・銀行のローテ続く？',
    ],
  },
  {
    author: 6, postedAt: '2026-07-13T14:18:00+09:00',
    title: '後場さらに下げ拡大 — 東エレク・村田なども軟調',
    content: '後場寄りで下げ幅拡大の報道。電気機器セクターが重い。個別のファンダより「半導体バスケット売り」。こういう日は新規ナンピンよりウォッチリスト整理。配当カレンダー見て心を落ち着けるのもアリ。',
    ticker: '8035.T', sentiment: 'bearish', tags: ['東エレク', '後場', '半導体'],
    likes: 33,
    comments: [
      'ナンピン我慢。',
    ],
  },
  {
    author: 9, postedAt: '2026-07-13T15:40:00+09:00',
    title: 'NISA勢どうする？ — 下落日の「やらないこと」リスト',
    content: '①積立設定を止める ②SNSの煽りで飛び乗る ③レバを増やす。今日やるなら：現金比率確認、コアETF継続、個別は損切りルールだけ。長期では今日の下落より「続けた月数」が効く。',
    ticker: '1306.T', sentiment: 'bullish', tags: ['NISA', '積立', 'メンタル'],
    likes: 207,
    comments: [
      'やらないことリスト、いい。',
      '積立止めない。',
      'SNS煽り危険。',
      '続けた月数が効く、名言。',
      '現金比率確認しました。',
      '今日は触らない日にします。',
      'コアETFだけ見る。',
      'メンタル conserving。',
    ],
  },
  {
    author: 2, postedAt: '2026-07-13T16:55:00+09:00',
    title: '海外半導体決算ウィーク前 — ポジション調整の「臭い」',
    content: '今週は海外大手半導体の決算が控える、との解説が多い。材料出る前に軽くする動きが出ると日本の関連株も先行して売られやすい。結果が出るまでサイズ半分でも遅くない。',
    ticker: 'SOX', sentiment: 'neutral', tags: ['決算', '半導体', 'ポジション'],
    likes: 55,
    comments: [
      'サイズ半分、やります。',
      '先行売り、あるある。',
    ],
  },
  {
    author: 10, postedAt: '2026-07-13T18:08:00+09:00',
    title: 'ドル円は方向感欠如？ — 円安でも株が弱い日の読み方',
    content: '為替が大きなトレンドを欠くなか、個別材料と地政学で株が動く日。円安＝輸出株買い、の単純式は今日は効きにくい。Fear&Greedとヒートマップで「何が売られているか」を見る方が早い。',
    ticker: 'USDJPY', sentiment: 'neutral', tags: ['為替', '円安', 'ヒートマップ'],
    likes: 24,
    comments: [],
  },
  {
    author: 7, postedAt: '2026-07-13T19:22:00+09:00',
    title: '金融・小売に資金 — 好決算銘柄への物色が支え',
    content: '半導体以外に資金が向かうのは健全。セクターローテの日はポートフォリオ俯瞰が役立つ。半導体比率が高すぎたら、来月の積立で金融・全世界株を厚めにするだけでも偏りは直る。',
    ticker: 'TOPIC', sentiment: 'bullish', tags: ['セクターローテ', '決算', '分散'],
    likes: 79,
    comments: [
      'ローテ日は俯瞰大事。',
      '積立で直す、同意。',
      '金融厚めにします。',
    ],
  },
  {
    author: 5, postedAt: '2026-07-13T20:35:00+09:00',
    title: 'Warsh議長の議会証言前 — 金利観測に注意',
    content: '新FRB議長の議会対応が近いとの報道。原油高と重なると「引き締め観測」が意識されやすい。米国株ETF（2559等）保有者は短期の値動きより、積立ペースを守る方が精神衛生上よい。',
    ticker: '2559.T', sentiment: 'neutral', tags: ['FRB', '金利', 'NISA'],
    likes: 61,
    comments: [
      '積立ペース守る、同意。',
      '金利観測、注視。',
    ],
  },
  {
    author: 0, postedAt: '2026-07-13T21:48:00+09:00',
    title: '7/13振り返り — 下げ日にやったこと／やらなかったこと',
    content: 'やった：ウォッチ整理、現金比率メモ、コア積立はそのまま。やらなかった：285Aのナンピン、レバETF、SNSの「今が買い」への飛び乗り。下げ日の勝ちパターンは「生き残る」。また明日。',
    ticker: 'N225', sentiment: 'neutral', tags: ['振り返り', 'リスク管理'],
    likes: 138,
    comments: [
      '生き残る、それが勝ち。',
      'ナンピン我慢、えらい。',
      '同じことしました。',
      'また明日。',
      'レバ触らない、正解。',
    ],
  },
  {
    author: 8, postedAt: '2026-07-13T22:56:00+09:00',
    title: '明日に向けて — 半導体決算と地政学、どちらが主役か',
    content: '短期は地政学と原油、中期は半導体決算のガイダンス。個人は両方「見に行く」だけで十分。NISAは淡々と、サテライトは小さく。コミュニティの意見も参考にしつつ、自分のルール優先で。',
    ticker: 'TOPIC', sentiment: 'neutral', tags: ['明日', '半導体', 'NISA'],
    likes: 72,
    comments: [
      '見に行くだけ、いい姿勢。',
      'ルール優先、同意。',
      'おやすみなさい。',
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
    console.log(`  would remove ${seedIds.length} existing july13 posts`)
    return
  }
  await admin.from('lounge_comments').delete().in('post_id', seedIds)
  await admin.from('lounge_post_tags').delete().in('post_id', seedIds)
  await admin.from('lounge_post_likes').delete().in('post_id', seedIds)
  await admin.from('lounge_post_bookmarks').delete().in('post_id', seedIds)
  await admin.from('lounge_posts').delete().in('id', seedIds)
  console.log(`  removed ${seedIds.length} old july13 posts`)
}

async function main() {
  const existingIds = await findSeedPostIds()
  if (existingIds.length && !REPLACE) {
    console.log('July 13 seed already exists. Use --replace to rebuild.')
    return
  }

  console.log(DRY_RUN ? 'Dry run (July 13 posts)…' : REPLACE ? 'Replace July 13 seed…' : 'Seeding July 13 posts…')
  if (REPLACE || existingIds.length) await purgeExisting()

  const personaMap = new Map()
  for (const persona of PERSONAS) {
    personaMap.set(persona.email, await ensurePersona(persona))
  }

  let posts = 0
  let comments = 0

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
      console.log(`[dry-run] ${row.postedAt} ${row.title} (+${commentTotal} comments)`)
      posts += 1
      comments += commentTotal
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

    // Actual likes from other personas (capped by roster; like_count may be higher for display)
    const likeSlots = Math.min(
      PERSONAS.length - 1,
      Math.max(0, Math.min(row.likes, 3 + (row.likes % 7))),
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
      const commentAt = new Date(baseMs + (c + 1) * 5 * 60000 + c * 75000).toISOString()
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
  }

  console.log(`Done. ${posts} posts, ${comments} comments (2026-07-13 JST).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
