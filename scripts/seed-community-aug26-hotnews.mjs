/**
 * Community: Tue Aug 25 Tokyo session (09:12–close) + US close + Wed Aug 26 morning (~08:35 JST).
 * JP/US prints: Marketstack + dashboard xlsx (2026-08-25). Skip duplicate titles via author+title+created_at.
 *
 *   node scripts/seed-community-aug26-hotnews.mjs
 *   node scripts/seed-community-aug26-hotnews.mjs --dry-run
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
    author: 5,
    postedAt: '2026-08-25T09:12:00+09:00',
    likeSlots: 17,
    title: '火曜寄り — 始値65978円、半導体・AIの売りが再び重い',
    content:
      '火曜寄り。日経平均の始値は65978.95円（Marketstack）。月曜と同レンジだが、6857アドバンテ34450円、9984ソフトバンクG5087円は寄りから弱い。韓国・香港の半導体安と米ナスダックの余韻。①寄り30分は触らない。サイズ維持。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['寄り', '日経平均', '半導体', '6857'],
    comments: [
      {
        text: '65978で追いかけ禁止。寄り30分ルール',
        replies: ['半導体セット買いも禁止', '285Aキオクシアも同じ'],
      },
      { text: '月曜65528終値からギャップは小さい。連想で買わない' },
      { text: '1306 TOPIX ETFは426.7。日経よりTOPIXが強い日の可能性' },
    ],
  },
  {
    author: 9,
    postedAt: '2026-08-25T10:34:00+09:00',
    likeSlots: 16,
    title: '前場 — 6857・9984が指数を押す。TOPIXは堅い',
    content:
      '前場。アドバンテ34450円、SBG5087円が寄与度下位の中心。日経は高値66257.73円まで試すも半導体売りが続く型。一方TOPIXは+0.47%（1306.T 426.7）と日経-0.74%のねじれ。中身と指数を分けて見る。個別の押し目は追わない。',
    ticker: '6857.T',
    sentiment: 'bearish',
    tags: ['前場', '6857', '9984', 'TOPIX'],
    comments: [
      {
        text: '日経弱TOPIX強。弱いとだけ読むと負ける',
        replies: ['1306で指数ヘッジしない', '個別6857は今日見送り'],
      },
      { text: '7203トヨタ3082円は指数寄与度上位側。セット買いはしない' },
      { text: 'NVDA決算前に日本半導体を厚くしない' },
    ],
  },
  {
    author: 1,
    postedAt: '2026-08-25T11:46:00+09:00',
    likeSlots: 15,
    title: '前引け — ジャクソンホール週。様子見が強い',
    content:
      '前引け。安値65470.95円圏まで試した後、前場引けは様子見。今週はNVDA決算（水〜木）とジャクソンホール（金）が重なる。為替はUSD/JPY159.20円（ダッシュボード）で円安継続。前引けにサイズを足さない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['前引け', 'ジャクソンホール', 'NVDA', '為替'],
    comments: [
      {
        text: '159円台で輸出株だけ買わない',
        replies: ['円安＝半導体買い、と決めない', 'イベント前は現金維持'],
      },
      { text: '昼休みは注文しない。後場の500円安を想像して売らない' },
      { text: '新NISA積立は設定だけ触る。スポットはしない' },
    ],
  },
  {
    author: 6,
    postedAt: '2026-08-25T12:24:00+09:00',
    likeSlots: 14,
    title: 'ランチ — 数字はまだ確定してない。触らない',
    content:
      '昼休み。四本値の終値はまだ後場。朝の安値65470円だけ見て「底」と決めない。金（+1.85%）と原油（WTI -4.76%）は材料として消化中。コアETFも日本株も、ランチにスポットしない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['ランチ', '金', '原油', '様子見'],
    comments: [
      { text: '金高・原油安。商品連想で個別を買わない', replies: ['後場まで見るだけ'] },
      { text: '積立勢は今日も淡々と' },
      { text: '6857の終値34450を昼に逆張りしない' },
    ],
  },
  {
    author: 10,
    postedAt: '2026-08-25T13:56:00+09:00',
    likeSlots: 16,
    title: '後場 — 半導体・AI関連の売りが指数を溶かす',
    content:
      '後場。6857・9984・285Aキオクシアが指数を押し下げる展開が続く。日経は軟調で、安値65470.95円圏で推移。プライムの半数超は高い報道もあるが、寄与度の値がさが指数を上回る日。安値拾いはしない。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['後場', '半導体', 'AI', '日経平均'],
    comments: [
      {
        text: '寄与度売り日は一日で終わらない',
        replies: ['65470で逆張り禁止', '大引けまで新規禁止'],
      },
      { text: 'SBG5087は決算前に枚数を戻さない' },
      { text: 'TOPIX強い日は日経だけで弱気に振らない' },
    ],
  },
  {
    author: 3,
    postedAt: '2026-08-25T15:20:00+09:00',
    likeSlots: 18,
    title: '大引け — 日経65528円、TOPIXは続伸。ねじれ継続',
    content:
      '大引け確定。日経平均65528.09円（-0.74%、Marketstack）。高66257.73、安65470.95、始65978.95。TOPIXは+0.47%（1306.T 426.7）。指数安でも中身は強弱混在。6857終値34450、9984終値5087、7203終値3082。①確定後も追いかけない。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['大引け', '日経平均', 'TOPIX', '6857'],
    comments: [
      {
        text: '65528で「安い」と判断してスポットしない',
        replies: ['2日続けて同終値付近。レンジと決めない', 'コアは別。個別は見送り'],
      },
      { text: 'TOPIX続伸は1306で確認。日経だけ見ない' },
      {
        text: '積立は止めない。イベントはニュースだけ',
        replies: ['同じ'],
      },
    ],
  },
  {
    author: 7,
    postedAt: '2026-08-25T16:28:00+09:00',
    likeSlots: 15,
    title: '寄与度 — 半導体3社で指数を押し下げ（6857・9984・285A）',
    content:
      '大引け寄与度。下位はアドバンテ34450、ソフトバンクG5087、キオクシア、ファストリ、東京エレクトロン。上位はトヨタ3082、リクルート、三井物産。半導体セットで指数を買い戻さない。個別の終値はMarketstackで確認済み。憶測で翌日の買いにしない。',
    ticker: '6857.T',
    sentiment: 'bearish',
    tags: ['寄与度', '6857', '9984', '285A'],
    comments: [
      {
        text: '3社セット買いは禁止継続',
        replies: ['285Aもテーマ一括禁止', 'ファストリ連想売りを追わない'],
      },
      { text: 'トヨタ3082が上位でも今日のヘッジにしない' },
      { text: '水曜寄りまでサイズ維持' },
    ],
  },
  {
    author: 0,
    postedAt: '2026-08-25T17:42:00+09:00',
    likeSlots: 14,
    title: '夕 — NVDA決算・ジャクソンホール前。コア据え置き',
    content:
      '夕方。今週の焦点はNVDA決算とパウエル演説。結果は出ていないので予想しない。今日の日本は日経65528.09、円159.20。米株先物は様子見。積立は淡々と。個別の押し目は今夜の米終値を見てからも急がない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['夕', 'NVDA', 'ジャクソンホール', '積立'],
    comments: [
      { text: '決算前に6857を足さない', replies: ['それが上限', 'コアETFも今夜スポットしない'] },
      { text: '159円台でドルコスト平均の設定だけ確認' },
      { text: '夜は米終値までアプリを閉じてもいい' },
    ],
  },
  {
    author: 8,
    postedAt: '2026-08-25T22:48:00+09:00',
    likeSlots: 16,
    title: '米時間 — S&P先物は堅調、半導体は様子見',
    content:
      '火曜夜（米時間）。S&P500先物は前日比プラス圏。VIX15.45と低ボラ継続。NVDAは決算前213ドル付近を意識。日本の6857をADRで埋めない。米がプラスでも日本半導体を夜中に買わない。',
    ticker: 'NVDA',
    sentiment: 'neutral',
    tags: ['米時間', 'NVDA', 'VIX', 'S&P500'],
    comments: [
      {
        text: 'VIX15台で油断しない',
        replies: ['決算で一晩で動く', 'サイズ維持'],
      },
      { text: '213ドル前後で逆張り禁止' },
      { text: '水曜寄り30分も触らない' },
    ],
  },
  {
    author: 2,
    postedAt: '2026-08-26T05:54:00+09:00',
    likeSlots: 17,
    title: '米終値 — S&P7677.28、NVDA213.05で半導体リバウンド',
    content:
      '火曜米クローズ（Marketstack）。S&P500は7677.28（+0.32%）。NVDAは208.48→213.05、QQQ706.32→710.72、IVV769.62、VTI378.15、AAPL309.90、MSFT491.71。半導体がナスダックを支えた一日。決算発表前に枚数を戻さない。水曜寄りまでサイズ維持。',
    ticker: 'NVDA',
    sentiment: 'bullish',
    tags: ['米終値', 'NVDA', 'QQQ', 'S&P500'],
    comments: [
      {
        text: '213.05は往復の途中。決算前に触らない',
        replies: ['NVDAの陽線でVTIを厚くしない', 'QQQはサテライト'],
      },
      { text: '7677は小動き。ノイズ' },
      {
        text: 'AAPL309.9・MSFT491.7は堅い。半導体と分けて見る',
        replies: ['同じ'],
      },
    ],
  },
  {
    author: 4,
    postedAt: '2026-08-26T06:44:00+09:00',
    likeSlots: 15,
    title: 'NVDA213.05 / QQQ710.72 — 決算は今夜。見送り継続',
    content:
      'NVDAは213.05（安値207.25から回復）。QQQ710.72。半導体リバウンドでも決算結果までは上限ゼロ。日本の6857を213ドルで埋めない。水曜寄り30分も触らない。①見るだけ。',
    ticker: 'NVDA',
    sentiment: 'neutral',
    tags: ['NVDA', 'QQQ', '決算', '半導体'],
    comments: [
      { text: '207.25の逆張りは禁止だった。213でも同じ', replies: ['イベントまで現金', '6857セット禁止'] },
      { text: 'QQQをVTIの代わりに厚くしない' },
      { text: '決算後に動く。前に行かない' },
    ],
  },
  {
    author: 11,
    postedAt: '2026-08-26T07:18:00+09:00',
    likeSlots: 16,
    title: '為替159.20円 — 円安継続、金高・原油安のねじれ',
    content:
      '朝7時台。USD/JPY159.20（fx_daily）。金は+1.85%、WTIは-4.76%（ダッシュボード）。円安・金高・原油安の三つ巴。輸出株だけ買う、金ETFだけ買う、と決めない。コアはVTI378.15据え置き。個別は寄り前に触らない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['為替', '円安', '金', '原油'],
    comments: [
      {
        text: '159円台で新NISAのドル建て比率だけ確認',
        replies: ['スポットはしない', '積立設定は触らない'],
      },
      { text: '金高を連想して個別を買わない' },
      { text: '原油安でエネルギー株を昼前に売らない' },
    ],
  },
  {
    author: 6,
    postedAt: '2026-08-26T07:52:00+09:00',
    likeSlots: 17,
    title: '水曜おはよう — NVDA決算・ジャクソンホール。寄りまで触らない',
    content:
      '7時台。東京はまだ寄り前。昨日の日本は日経65528.09（-0.74%）。米はS&P7677.28、NVDA213.05。ルール：①寄り30分新規禁止②半導体セット禁止③コアETFを陽線で追わない④積立淡々と。予想は書かない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['水曜', '寄り前', 'NVDA', 'ジャクソンホール'],
    comments: [
      {
        text: '①＋④。米半導体リバウンドを追わない',
        replies: ['完全に見るだけ', '6857は寄り30分後も見送り'],
      },
      { text: '65528を「安い」と朝イチで買わない' },
      { text: 'NVDA決算まで個別は上限ゼロでいい' },
      { text: '番号だけ残す。今日も淡々と' },
    ],
  },
  {
    author: 9,
    postedAt: '2026-08-26T08:28:00+09:00',
    likeSlots: 16,
    title: '寄り前 — 半導体・円159台・イベント週。サイズ維持',
    content:
      '8時28分、寄りまで7分。米半導体は213.05まで回復も決算前。日経前日65528.09、TOPIX1306は426.7。韓国・香港の弱さが日本半導体に波及する可能性は材料として認識するだけ。①寄り30分触らない②6857・9984セット禁止③VTI378.15据え置き。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['寄り前', '6857', '為替', 'ルール'],
    comments: [
      { text: '寄り7分前に注文しない', replies: ['30分後も見送り', '同じ'] },
      { text: '159円台で輸出株だけ買わない' },
      { text: 'ジャクソンホールは金曜。今日は決算だけ意識' },
      { text: '積立はいじらない' },
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

function normalizeCommentTree(comments) {
  return (comments || []).map((c) => {
    if (typeof c === 'string') return { text: c, replies: [] }
    return {
      text: String(c.text || ''),
      author: c.author,
      replies: (c.replies || []).map((r) => (typeof r === 'string' ? { text: r } : r)),
    }
  })
}

function countAllComments(tree) {
  let n = 0
  for (const c of tree) {
    n += 1
    n += (c.replies || []).length
  }
  return n
}

async function main() {
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Aug 25 session + Aug 26 morning posts…`)

  const personaMap = new Map()
  for (const persona of PERSONAS) {
    personaMap.set(persona.email, await ensurePersona(persona))
  }

  let posts = 0
  let comments = 0
  let replies = 0

  for (const row of POSTS) {
    const persona = PERSONAS[row.author]
    const mapped = personaMap.get(persona.email)
    if (!mapped) continue

    const tree = normalizeCommentTree(row.comments)
    const totalComments = countAllComments(tree)
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
      comment_count: totalComments,
      bookmark_count: Math.floor(likeSlots / 3),
      view_count: 0,
      hot_score: likeSlots * 2 + totalComments * 3 + 55,
      status: 'published',
      created_at: new Date(row.postedAt).toISOString(),
      updated_at: new Date(row.postedAt).toISOString(),
    }

    if (DRY_RUN) {
      console.log(`[dry-run] ${row.postedAt.slice(0, 16)} ${mapped.nickname}: ${row.title} (c=${totalComments})`)
      posts += 1
      comments += totalComments
      continue
    }

    const { data: existing } = await admin
      .from('lounge_posts')
      .select('id')
      .eq('author_id', mapped.userId)
      .eq('title', row.title)
      .eq('created_at', payload.created_at)
      .maybeSingle()
    if (existing?.id) {
      console.log(`skip duplicate: ${row.title}`)
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
      const likeAt = new Date(new Date(row.postedAt).getTime() + (li + 1) * 5 * 60 * 1000).toISOString()
      const { error: lErr } = await admin.from('lounge_post_likes').insert({
        post_id: post.id,
        user_id: likerMapped.userId,
        created_at: likeAt,
      })
      if (lErr) console.error('like insert failed:', lErr.message)
    }

    let commentRows = 0
    let replyRows = 0
    let cursor = 0

    for (let c = 0; c < tree.length; c += 1) {
      const node = tree[c]
      let commentPersona = PERSONAS[
        Number.isFinite(node.author) ? node.author : (row.author + c + 2) % PERSONAS.length
      ]
      let commentMapped = personaMap.get(commentPersona.email)
      if (commentMapped?.userId === mapped.userId) {
        commentPersona = PERSONAS[(row.author + c + 3) % PERSONAS.length]
        commentMapped = personaMap.get(commentPersona.email)
      }
      if (!commentMapped?.userId) continue

      cursor += 1
      const commentAt = new Date(new Date(row.postedAt).getTime() + cursor * 7 * 60 * 1000).toISOString()
      const { data: parentComment, error: cErr } = await admin.from('lounge_comments').insert({
        post_id: post.id,
        author_id: commentMapped.userId,
        author_name: commentMapped.nickname,
        content: node.text,
        status: 'published',
        created_at: commentAt,
        updated_at: commentAt,
      }).select('id').single()

      if (cErr || !parentComment) {
        console.error('comment insert failed:', cErr?.message)
        continue
      }
      commentRows += 1

      for (let r = 0; r < (node.replies || []).length; r += 1) {
        const reply = node.replies[r]
        let replyPersona = PERSONAS[
          Number.isFinite(reply.author)
            ? reply.author
            : (row.author + c + r + 4) % PERSONAS.length
        ]
        let replyMapped = personaMap.get(replyPersona.email)
        if (
          !replyMapped
          || replyMapped.userId === mapped.userId
          || replyMapped.userId === commentMapped.userId
        ) {
          replyPersona = PERSONAS[(row.author + c + r + 5) % PERSONAS.length]
          replyMapped = personaMap.get(replyPersona.email)
        }
        if (!replyMapped?.userId) continue

        cursor += 1
        const replyAt = new Date(new Date(row.postedAt).getTime() + cursor * 7 * 60 * 1000).toISOString()
        const replyText = `@${commentMapped.nickname} ${reply.text}`
        const nestedPayload = {
          post_id: post.id,
          author_id: replyMapped.userId,
          author_name: replyMapped.nickname,
          content: replyText,
          parent_comment_id: parentComment.id,
          status: 'published',
          created_at: replyAt,
          updated_at: replyAt,
        }
        let { error: rErr } = await admin.from('lounge_comments').insert(nestedPayload)
        if (rErr && /parent_comment_id/i.test(String(rErr.message || ''))) {
          delete nestedPayload.parent_comment_id
          nestedPayload.content = `↳ @${commentMapped.nickname} ${reply.text}`
          ;({ error: rErr } = await admin.from('lounge_comments').insert(nestedPayload))
        }
        if (rErr) console.error('reply insert failed:', rErr.message)
        else {
          commentRows += 1
          replyRows += 1
        }
      }
    }

    const { count: likeRows } = await admin
      .from('lounge_post_likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post.id)

    await admin.from('lounge_posts').update({
      like_count: likeRows ?? likeSlots,
      comment_count: commentRows,
      hot_score: (likeRows ?? likeSlots) * 2 + commentRows * 3 + 55,
    }).eq('id', post.id)

    comments += commentRows
    replies += replyRows
    posts += 1
    console.log(
      `posted: ${row.postedAt.slice(5, 16)} ${mapped.nickname} — ${row.title.slice(0, 42)}… (c=${commentRows}, replies=${replyRows})`,
    )
  }

  console.log(`Done. ${posts} posts, ${comments} comments (${replies} replies).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
