/**
 * Community topics from news (Thu Sep 10 – Fri Sep 11 morning).
 * Themes: Middle East/oil, US CPI/rates, TSMC/semis, SoftBank bridge loan.
 * Prices: Marketstack 2026-09-09 equities; dashboard 2026-09-10 WTI/US10Y/USDJPY/VIX only.
 * Do NOT invent Sep 10 equity closes (dashboard N225 conflicts with wire reports).
 *
 *   node scripts/seed-community-sep10-sep11-topics-hotnews.mjs
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
    postedAt: '2026-09-10T11:08:00+09:00',
    likeSlots: 17,
    title: '話題：中東リスク×原油高。WTI96.57はインフレ警戒',
    content:
      '木曜話題①中東情勢の長期化懸念→原油高。dashboard 2026-09-10：WTI96.57ドル（+3.81%）、Brent101.34、US10Y4.84%。インフレ再加速の連想でリスクオフが先に出やすい。個別は水曜確定（日経65269.33・NVDA223.67）を買い理由にしない。ニュースでサイズを増やさない。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['原油', '中東', '金利', '話題', '様子見'],
    comments: [
      { text: '原油テーマで全額禁止', replies: ['WTI96追わない', 'サイズ維持'] },
      { text: '金利4.84も重い。分割のみ' },
      { text: '一次情報は公式・通信社で' },
    ],
  },
  {
    author: 8,
    postedAt: '2026-09-10T13:36:00+09:00',
    likeSlots: 16,
    title: '話題：米PPI→金曜CPI。手掛けにくさ優先',
    content:
      '木曜話題②米物価。報道ベースでPPI後に金利上昇・株は手控えムード。金曜は米8月CPIが焦点（通信社）。dashboard：VIX16.46、USD/JPY153.62。結果が出るまで新規は増やさない。水曜NVDA223.67・99846810を「CPI前の押し目買い」にしない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['CPI', '金利', 'VIX', '話題', 'ルール'],
    comments: [
      { text: 'CPI前は寄り30分どころか触らない', replies: ['同感', '積立だけ'] },
      { text: 'VIX16台でもレバ禁止' },
      { text: '予想当てゲームしない' },
    ],
  },
  {
    author: 10,
    postedAt: '2026-09-10T16:18:00+09:00',
    likeSlots: 18,
    title: '話題：TSMC月次→半導体押し目。セット買い禁止',
    content:
      '木曜話題③TSMCの好調な月次売上が伝わったとの報道。後場に6857/285Aなど半導体一角へ押し目買い、という市況記事が多い。位置メモは水曜確定：685732840・285A57000・99846810。報道の「押し目」で枚数を揃えない。8035とセットにもしない。',
    ticker: '6857.T',
    sentiment: 'neutral',
    tags: ['TSMC', '半導体', '6857', '285A', '話題'],
    comments: [
      { text: 'TSMCニュースでスポット禁止', replies: ['32840追わない', '57000も'] },
      { text: '銘柄差が出る日。セット禁止' },
      { text: '一次情報はTSMC開示で確認' },
    ],
  },
  {
    author: 1,
    postedAt: '2026-09-10T19:02:00+09:00',
    likeSlots: 17,
    title: '話題：9984ブリッジローン期限前返済（9/15）',
    content:
      '木曜話題④ソフトバンクG（9984）IR：OpenAI追加出資向けブリッジ借入残高259億ドルを9/15期限前返済へ（会社開示、換算はUSD/JPY153.74）。好材料連想でも水曜終値6810円を買い理由にしない。Arm/OpenAIテーマと返済ニュースをセット買いしない。サイズ維持。',
    ticker: '9984.T',
    sentiment: 'neutral',
    tags: ['9984', 'OpenAI', '話題', '決算', 'ルール'],
    comments: [
      { text: 'IRは読んだ。枚数は増やさない', replies: ['6810追わない', '分割のみ'] },
      { text: '返済＝買い、と決めない' },
      { text: '一次情報は会社開示PDF' },
    ],
  },
  {
    author: 4,
    postedAt: '2026-09-10T21:28:00+09:00',
    likeSlots: 15,
    title: '夜の話題整理：原油・金利・CPI・半導体・9984',
    content:
      '木曜夜。今週の話題タグ候補：①中東×原油（WTI96.57）②米CPI前の手掛けにくさ③TSMC月次→半導体押し目④9984ブリッジ返済（9/15）。どれも「ニュース＝エントリー」にしない。確定価格は水曜：日経65269.33・NVDA223.67・99846810。金曜CPIまで新規慎重。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['話題', '原油', 'CPI', '半導体', '9984', 'ルール'],
    comments: [
      { text: '①②③④全部ウォッチだけ', replies: ['同感', 'サイズ確認'] },
      { text: '話題タグに飛び乗らない' },
      { text: '寝る。CPIは結果待ち' },
    ],
  },
  {
    author: 5,
    postedAt: '2026-09-11T06:12:00+09:00',
    likeSlots: 16,
    title: '金曜朝の話題：米CPI当日。寄り前は触らない',
    content:
      '金曜早朝。最大の話題は米8月CPI（通信社カレンダー）。dashboard直近：US10Y4.84・VIX16.46・USD/JPY153.62・WTI96.57。結果前に枚数を動かさない。水曜位置（685732840・99846810・NVDA223.67）はメモのみ。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['CPI', '金利', '話題', 'ルール', '様子見'],
    comments: [
      { text: 'CPI前は新規ゼロ', replies: ['積立だけ', 'レバ禁止'] },
      { text: '予想当てでサイズ増やさない' },
      { text: '寄り30分＋指標後も再判定' },
    ],
  },
  {
    author: 9,
    postedAt: '2026-09-11T07:48:00+09:00',
    likeSlots: 15,
    title: '話題：利上げ織り込み×AI株。連想売りも追わない',
    content:
      '金曜朝。報道では原油高・物価指標を背景に米利上げ織り込みが意識、との解説が多い。AI/半導体は金利に敏感、という話も出やすい。でも水曜NVDA223.67・685732840を「利上げ前に売る/買う」材料にしない。テーマはウォッチ、執行はルール。',
    ticker: 'NVDA',
    sentiment: 'neutral',
    tags: ['金利', 'NVDA', '半導体', '話題', 'ルール'],
    comments: [
      { text: '連想で全額禁止', replies: ['223.67も触らない', 'サイズ'] },
      { text: 'CPI結果まで待つ' },
      { text: '一次情報は公式指標' },
    ],
  },
  {
    author: 7,
    postedAt: '2026-09-11T08:42:00+09:00',
    likeSlots: 16,
    title: '金曜寄り前チェックリスト：CPI・原油・9984IR',
    content:
      '寄り前。①米CPIは結果待ち②原油・金利テーマでギャップ追わない③9984のブリッジ返済IRは既知・6810で追いかけない④半導体はTSMC報道でもセット買い禁止。確定は水曜：日経65269.33。今日の個別終値は大引けまで書かない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['寄り', 'CPI', '原油', '9984', 'ルール'],
    comments: [
      { text: '①〜④そのまま', replies: ['同感', '寄り30分'] },
      { text: 'ニュースで枚数を動かさない' },
      { text: '偏り確認だけ' },
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} topic posts…`)

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
      console.log(`[dry-run] ${row.postedAt.slice(0, 16)} ${mapped.nickname}: ${row.title}`)
      posts += 1
      comments += totalComments
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
