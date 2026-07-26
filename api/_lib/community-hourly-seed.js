/**
 * Hourly community lounge seed — posts, comments, likes (JST 05–22).
 * Uses real index/stock closes from DB when available; no fabricated prices.
 */

export const COMMUNITY_HOURLY_JST_START = 5
export const COMMUNITY_HOURLY_JST_END = 22

/** @type {{ email: string, name: string, exp: number }[]} */
export const COMMUNITY_SEED_PERSONAS = [
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

const COMMENT_POOL = [
  '同意です',
  'わかる',
  'サイズだけ見直します',
  '全額はやめます',
  '分割でいきます',
  'メモしました',
  '寄り後に再判定',
  'レバは触りません',
  '積立は継続',
  '偏り確認します',
  'おもしろい議論',
  '損切り線だけ更新',
]

const TAG_POOL = ['日経平均', 'NISA', 'メンタル', 'ウォッチリスト', '積立', '半導体', '為替', 'ルール']

export function jstHourKey(isoOrDate = new Date()) {
  const t = new Date(isoOrDate).getTime() + 9 * 3600000
  const jst = new Date(t)
  return `${jst.toISOString().slice(0, 10)}:${jst.getUTCHours()}`
}

export function jstParts(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    weekday: 'short',
  })
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value]),
  )
  const hour = Number(parts.hour)
  const day = `${parts.year}-${parts.month}-${parts.day}`
  const isWeekend = parts.weekday === 'Sat' || parts.weekday === 'Sun'
  return { day, hour, isWeekend }
}

function pick(arr, seed) {
  return arr[Math.abs(seed) % arr.length]
}

function formatYen(n) {
  if (!Number.isFinite(n)) return null
  return Math.round(n).toLocaleString('ja-JP')
}

function formatUsd(n) {
  if (!Number.isFinite(n)) return null
  return n.toFixed(2)
}

function formatPct(n) {
  if (!Number.isFinite(n)) return null
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

async function fetchIndexPair(admin, symbol) {
  // Indices (^N225, etc.) live in stock_daily_prices / v_stock_latest — same as equities.
  return fetchStockPair(admin, symbol)
}

async function fetchStockPair(admin, symbol) {
  const { data, error } = await admin
    .from('stock_daily_prices')
    .select('trade_date,close')
    .eq('symbol', symbol)
    .order('trade_date', { ascending: false })
    .limit(2)
  if (error || !data?.length) return null
  const latest = data[0]
  const prev = data[1]
  const close = Number(latest?.close)
  const prevClose = Number(prev?.close)
  if (!Number.isFinite(close)) return null
  let changePct = null
  if (Number.isFinite(prevClose) && prevClose !== 0) {
    changePct = ((close - prevClose) / prevClose) * 100
  }
  return {
    symbol,
    tradeDate: String(latest.trade_date || '').slice(0, 10),
    close,
    changePct,
  }
}

async function findUserIdByEmail(admin, emailNorm) {
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

export async function ensureSeedPersona(admin, persona) {
  const email = persona.email.toLowerCase()
  let userId = await findUserIdByEmail(admin, email)
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: `MmSeed!${persona.name.length}99`,
      email_confirm: true,
      user_metadata: { full_name: persona.name, display_name: persona.name },
    })
    if (error) throw error
    userId = data.user.id
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
  return { userId, name: persona.name, email }
}

export async function ensureAllPersonas(admin) {
  const map = new Map()
  for (const persona of COMMUNITY_SEED_PERSONAS) {
    map.set(persona.email, await ensureSeedPersona(admin, persona))
  }
  return map
}

async function hourHasPost(admin, hourKey) {
  const [day, hourStr] = hourKey.split(':')
  const h = Number(hourStr)
  const start = new Date(`${day}T${String(h).padStart(2, '0')}:00:00+09:00`)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const { data, error } = await admin
    .from('lounge_posts')
    .select('id')
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .limit(1)
  if (error) throw error
  return Boolean(data?.length)
}

async function buildPostDraft(admin, now, slotSeed) {
  const { hour, isWeekend } = jstParts(now)
  const n225 = await fetchIndexPair(admin, '^N225')
  const tickers = ['TSLA', 'NVDA', 'GOOGL', '1306.T']
  const stockSym = pick(tickers, slotSeed + hour)
  const stock = await fetchStockPair(admin, stockSym)

  const hourLabels = {
    5: '早朝',
    6: '朝',
    7: '朝',
    8: '午前',
    9: '午前',
    10: '午前',
    11: '昼',
    12: '昼休み',
    13: '午後',
    14: '午後',
    15: '夕方',
    16: '夕方',
    17: '引け前',
    18: '大引け',
    19: '夜',
    20: '夜',
    21: '夜更け',
    22: '深夜前',
  }
  const slot = hourLabels[hour] || '午前'

  if (n225 && hour >= 17 && hour <= 19) {
    const yen = formatYen(n225.close)
    const pct = formatPct(n225.changePct)
    const dir = Number(n225.changePct) >= 0 ? 'bullish' : 'bearish'
    return {
      title: `${slot} — 日経${yen}円${pct ? `（${pct}）` : ''}、メモだけ`,
      content: `終値ベース${yen}円${pct ? `、前日比${pct}` : ''}（${n225.tradeDate}）。${isWeekend ? '週末は売買せず' : '飛び乗り禁止・サイズ上限だけ'}見直します。`,
      ticker: 'N225',
      sentiment: dir,
      tags: [pick(TAG_POOL, slotSeed), '日経平均'],
    }
  }

  if (stock && hour % 3 === slotSeed % 3) {
    const px = stock.symbol.endsWith('.T') ? `${formatYen(stock.close)}円` : `${formatUsd(stock.close)}ドル`
    const pct = formatPct(stock.changePct)
    const dir = Number(stock.changePct) >= 0 ? 'bullish' : Number(stock.changePct) < 0 ? 'bearish' : 'neutral'
    return {
      title: `${slot} — ${stock.symbol} ${px}${pct ? `（${pct}）` : ''}のウォッチ`,
      content: `${stock.tradeDate}終値${px}${pct ? `、前日比${pct}` : ''}。新規は分割のみ・全額禁止。ウォッチリストに残すか週末に再判定。`,
      ticker: stock.symbol,
      sentiment: dir,
      tags: [stock.symbol.replace('.T', ''), pick(TAG_POOL, slotSeed + 1)],
    }
  }

  if (n225) {
    const yen = formatYen(n225.close)
    const pct = formatPct(n225.changePct)
    return {
      title: `${slot} — 日経${yen}円付近、偏りとサイズだけ確認`,
      content: `直近${n225.tradeDate}の終値${yen}円${pct ? `（${pct}）` : ''}。${isWeekend ? '週末は触らない' : '寄り前にポートフォリオの偏りだけチェック'}。レバは使いません。`,
      ticker: 'N225',
      sentiment: Number(n225.changePct) >= 0 ? 'bullish' : 'bearish',
      tags: ['日経平均', pick(TAG_POOL, slotSeed + 2)],
    }
  }

  return {
    title: `${slot} — 今日のルール確認（サイズ・分割）`,
    content: '大幅な値動きのあとも、全額エントリーはしません。積立は継続、サテライトは半分ルール。損切り線だけメモ。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: [pick(TAG_POOL, slotSeed + 3), 'ルール'],
  }
}

function randomPostedAtInCurrentHour(now, slotSeed) {
  const { day, hour } = jstParts(now)
  const minute = 8 + (slotSeed % 47)
  const second = (slotSeed * 7) % 50
  return new Date(`${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}+09:00`)
}

async function insertPostBundle(admin, {
  authorIdx,
  postedAt,
  draft,
  personaMap,
  likeSlots,
  commentCount,
}) {
  const persona = COMMUNITY_SEED_PERSONAS[authorIdx % COMMUNITY_SEED_PERSONAS.length]
  const mapped = personaMap.get(persona.email)
  if (!mapped) throw new Error(`Persona missing: ${persona.email}`)

  const createdAt = new Date(postedAt).toISOString()
  const comments = []
  for (let i = 0; i < commentCount; i += 1) {
    comments.push(pick(COMMENT_POOL, authorIdx + i + Number(postedAt)))
  }

  const payload = {
    author_id: mapped.userId,
    author_name: mapped.name,
    title: draft.title,
    content: String(draft.content || ''),
    ticker: draft.ticker || null,
    asset_type: 'stock',
    sentiment: draft.sentiment || 'neutral',
    like_count: likeSlots,
    comment_count: comments.length,
    bookmark_count: Math.max(0, Math.floor(likeSlots / 4)),
    view_count: 0,
    hot_score: likeSlots * 2 + comments.length * 3 + 35,
    status: 'published',
    created_at: createdAt,
    updated_at: createdAt,
  }

  const { data: post, error } = await admin.from('lounge_posts').insert(payload).select('id').single()
  if (error) throw error

  for (const tag of draft.tags || []) {
    await admin.from('lounge_post_tags').insert({ post_id: post.id, tag })
  }

  let likes = 0
  for (let li = 0; li < likeSlots; li += 1) {
    const liker = COMMUNITY_SEED_PERSONAS[(authorIdx + li + 1) % COMMUNITY_SEED_PERSONAS.length]
    const likerMapped = personaMap.get(liker.email)
    if (!likerMapped || likerMapped.userId === mapped.userId) continue
    const likeAt = new Date(new Date(postedAt).getTime() + (li + 1) * 5 * 60 * 1000).toISOString()
    const { error: likeErr } = await admin.from('lounge_post_likes').insert({
      post_id: post.id,
      user_id: likerMapped.userId,
      created_at: likeAt,
    })
    if (!likeErr) likes += 1
  }

  let commentRows = 0
  for (let c = 0; c < comments.length; c += 1) {
    const commentPersona = COMMUNITY_SEED_PERSONAS[(authorIdx + c + 2) % COMMUNITY_SEED_PERSONAS.length]
    const commentMapped = personaMap.get(commentPersona.email)
    if (!commentMapped || commentMapped.userId === mapped.userId) continue
    const commentAt = new Date(new Date(postedAt).getTime() + (c + 1) * 8 * 60 * 1000).toISOString()
    const { error: cErr } = await admin.from('lounge_comments').insert({
      post_id: post.id,
      author_id: commentMapped.userId,
      author_name: commentMapped.name,
      content: comments[c],
      status: 'published',
      created_at: commentAt,
      updated_at: commentAt,
    })
    if (!cErr) commentRows += 1
  }

  await admin.from('lounge_posts').update({
    like_count: likes,
    comment_count: commentRows,
    hot_score: likes * 2 + commentRows * 3 + 35,
    updated_at: new Date().toISOString(),
  }).eq('id', post.id)

  return { postId: post.id, likes, comments: commentRows }
}

async function enrichRecentPost(admin, personaMap, now, slotSeed) {
  const since = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString()
  const { data: posts, error } = await admin
    .from('lounge_posts')
    .select('id,author_id,like_count,comment_count,created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(8)
  if (error) throw error
  if (!posts?.length) return null

  const target = posts.sort((a, b) => Number(a.like_count) - Number(b.like_count))[0]
  if (!target?.id) return null

  const { data: existingLikes } = await admin
    .from('lounge_post_likes')
    .select('user_id')
    .eq('post_id', target.id)
  const liked = new Set((existingLikes || []).map((r) => r.user_id))

  let addedLikes = 0
  const wantLikes = 1 + (slotSeed % 2)
  for (let i = 0; i < COMMUNITY_SEED_PERSONAS.length && addedLikes < wantLikes; i += 1) {
    const p = COMMUNITY_SEED_PERSONAS[(slotSeed + i) % COMMUNITY_SEED_PERSONAS.length]
    const mapped = personaMap.get(p.email)
    if (!mapped || mapped.userId === target.author_id || liked.has(mapped.userId)) continue
    const { error: likeErr } = await admin.from('lounge_post_likes').insert({
      post_id: target.id,
      user_id: mapped.userId,
      created_at: now.toISOString(),
    })
    if (!likeErr) {
      addedLikes += 1
      liked.add(mapped.userId)
    }
  }

  let addedComments = 0
  if (slotSeed % 3 === 0 && Number(target.comment_count) < 8) {
    const cp = COMMUNITY_SEED_PERSONAS[(slotSeed + 3) % COMMUNITY_SEED_PERSONAS.length]
    const cm = personaMap.get(cp.email)
    if (cm && cm.userId !== target.author_id) {
      const { error: cErr } = await admin.from('lounge_comments').insert({
        post_id: target.id,
        author_id: cm.userId,
        author_name: cm.name,
        content: pick(COMMENT_POOL, slotSeed),
        status: 'published',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      if (!cErr) addedComments = 1
    }
  }

  if (addedLikes > 0 || addedComments > 0) {
    await admin.from('lounge_posts').update({
      like_count: Number(target.like_count || 0) + addedLikes,
      comment_count: Number(target.comment_count || 0) + addedComments,
      hot_score: (Number(target.like_count || 0) + addedLikes) * 2
        + (Number(target.comment_count || 0) + addedComments) * 3 + 35,
      updated_at: now.toISOString(),
    }).eq('id', target.id)
  }

  return { postId: target.id, addedLikes, addedComments }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {{ now?: Date, dryRun?: boolean }} opts
 */
export async function runCommunityHourlySeed(admin, { now = new Date(), dryRun = false } = {}) {
  const enabled = String(process.env.COMMUNITY_HOURLY_SEED_ENABLED || 'true').trim().toLowerCase() !== 'false'
  if (!enabled) {
    return { ok: true, skipped: true, reason: 'COMMUNITY_HOURLY_SEED_ENABLED=false' }
  }

  const { hour } = jstParts(now)
  if (hour < COMMUNITY_HOURLY_JST_START || hour > COMMUNITY_HOURLY_JST_END) {
    return { ok: true, skipped: true, reason: 'outside_jst_window', hour }
  }

  const hourKey = jstHourKey(now)
  const slotSeed = hour + now.getUTCMinutes() + now.getUTCDate()

  if (dryRun) {
    const draft = await buildPostDraft(admin, now, slotSeed)
    const hasPost = await hourHasPost(admin, hourKey)
    return {
      ok: true,
      dryRun: true,
      hourKey,
      hourHasPost: hasPost,
      draft,
    }
  }

  const personaMap = await ensureAllPersonas(admin)
  const hasPost = await hourHasPost(admin, hourKey)

  if (!hasPost) {
    const draft = await buildPostDraft(admin, now, slotSeed)
    const postedAt = randomPostedAtInCurrentHour(now, slotSeed)
    const likeSlots = 4 + (slotSeed % 5)
    const commentCount = 2 + (slotSeed % 3)
    const authorIdx = slotSeed % COMMUNITY_SEED_PERSONAS.length
    const result = await insertPostBundle(admin, {
      authorIdx,
      postedAt,
      draft,
      personaMap,
      likeSlots,
      commentCount,
    })
    return {
      ok: true,
      action: 'created_post',
      hourKey,
      ...result,
      title: draft.title,
    }
  }

  const enriched = await enrichRecentPost(admin, personaMap, now, slotSeed)
  return {
    ok: true,
    action: 'enriched_existing',
    hourKey,
    hourHasPost: true,
    ...enriched,
  }
}
