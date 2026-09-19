/**
 * Community topics: Fri Sep 11 session – Sat Sep 12 morning.
 * News: oil/Middle East, JP rates ~3%, AI/semi selloff, US CPI (core hot), Fed hike odds.
 * DB prices: Marketstack 2026-09-10 only. Sep 11 equity EOD not in DB — Nikkei close cited as 報道のみ.
 *
 *   node scripts/seed-community-sep11-sep12-topics-hotnews.mjs
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
    postedAt: '2026-09-11T09:18:00+09:00',
    likeSlots: 17,
    title: '話題：原油104ドル台・中東。寄りからリスクオフ',
    content:
      '金曜寄り。話題①中東緊迫（報道：紅海周辺の制圧・ミサイル生産再開観測）→原油一時104ドル台。dashboard木曜確定WTI103.98・US10Y4.94・USD/JPY154.49。インフレ・金利連想でリスクオフが先。木曜確定（Marketstack）：日経65142.78・NVDA218.36・99846810。ニュースで枚数を戻さない。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['原油', '中東', '金利', '話題', '様子見'],
    comments: [
      { text: '原油テーマで全額禁止', replies: ['103.98追わない', 'サイズ維持'] },
      { text: '金利4.94も重い' },
      { text: '一次情報は通信社で' },
    ],
  },
  {
    author: 10,
    postedAt: '2026-09-11T11:24:00+09:00',
    likeSlots: 16,
    title: '話題：AI・半導体売り。一時2000円安報道も追わない',
    content:
      '前場話題②。報道では日経が一時2000円超安、6857/9984などAI・半導体が主導、と。位置メモは木曜確定：685733920・99846810・285A58090・NVDA218.36。急落ニュースで逆張りスポットしない。セット買い・セット売り禁止。',
    ticker: '6857.T',
    sentiment: 'bearish',
    tags: ['半導体', '6857', '9984', '話題', 'ルール'],
    comments: [
      { text: '落ちるナイフ掴まない', replies: ['33920も触らない', '分割のみ'] },
      { text: '9984とセットにしない' },
      { text: '損切り線だけ確認' },
    ],
  },
  {
    author: 8,
    postedAt: '2026-09-11T13:42:00+09:00',
    likeSlots: 15,
    title: '話題：国内金利3%接近。成長株と銀行を混ぜない',
    content:
      '昼話題③。報道で国内長期金利が3%接近。金利高は成長株・AIに重く、銀行には別ロジック。それでも「金利＝銀行買い」で枚数を増やさない。木曜確定日経65142.78・US10Y4.94。テーマはウォッチ、執行はサイズ上限。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['金利', '話題', 'ルール', '様子見'],
    comments: [
      { text: '連想で全額禁止', replies: ['同感', '積立だけ'] },
      { text: 'CPI待ち。予想当てしない' },
      { text: '偏り確認のみ' },
    ],
  },
  {
    author: 1,
    postedAt: '2026-09-11T15:36:00+09:00',
    likeSlots: 18,
    title: '話題：金曜大引け報道64011。原油・金利で大幅安',
    content:
      '金曜大引け。報道（日経・財経等）：日経終値64011.34円（約1259円安）。原油高・金利高でAI/半導体売りが主導、との市況。DBの個別終値は未取込のため書かない。位置は木曜Marketstack：日経65142.78・685733920・99846810・285A58090・NVDA218.36。報道終値で逆張り禁止。',
    ticker: 'N225',
    sentiment: 'bearish',
    tags: ['大引け', 'N225', '原油', '半導体', '話題'],
    comments: [
      { text: '64011で飛び乗り禁止', replies: ['落ちるナイフ', 'サイズ'] },
      { text: '個別は取込まで数字更新しない' },
      { text: '夜の米CPIまで新規ゼロ寄り' },
    ],
  },
  {
    author: 5,
    postedAt: '2026-09-11T18:08:00+09:00',
    likeSlots: 16,
    title: '話題：米CPI直前。コアが焦点、利上げ織り込み',
    content:
      '金曜夕。話題④米8月CPI発表前（通信社）。総合は予想通りでもコアが焦点、という事前解説が多い。木曜dashboard：VIX17.84・WTI103.98・US10Y4.94。結果が出るまで枚数動かさない。日本の大幅安報道を「CPI前の押し目」にしない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['CPI', '金利', 'VIX', '話題', 'ルール'],
    comments: [
      { text: 'CPI前は触らない', replies: ['積立だけ', 'レバ禁止'] },
      { text: '予想当てゲームしない' },
      { text: '結果後に再判定' },
    ],
  },
  {
    author: 4,
    postedAt: '2026-09-11T21:22:00+09:00',
    likeSlots: 17,
    title: '話題：コアCPI予想上回る→利上げ確率急上昇',
    content:
      '金曜夜。報道：米8月CPI総合は予想通り（前月比+0.4%/前年+3.4%）、コア前月比+0.3%で予想超え。CME系で9/16利上げ確率がおおむね90%近辺へ、との解説。株は「織り込み済み」で戻す場面もあるが、ニュース＝エントリーにしない。木曜確定NVDA218.36・日経（報道金曜64011）は位置確認のみ。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['CPI', 'FOMC', '金利', 'NVDA', '話題'],
    comments: [
      { text: '利上げ織り込みで追わない', replies: ['218.36も', 'サイズ維持'] },
      { text: '来週FOMCまで分割のみ' },
      { text: '一次情報はBLS/通信社' },
    ],
  },
  {
    author: 6,
    postedAt: '2026-09-11T22:40:00+09:00',
    likeSlots: 14,
    title: '金曜夜の話題整理：原油・金利・CPI・AI売り',
    content:
      '金曜22時。今週の話題タグ：①中東×原油104ドル台②国内金利3%接近③日本株大幅安（報道64011）④米コアCPI上振れ→利上げ確率上昇⑤AI/半導体売り。確定価格は木曜Marketstack（日経65142.78・685733920・99846810・NVDA218.36）。週末に買い理由を作らない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['話題', '原油', 'CPI', '半導体', 'ルール'],
    comments: [
      { text: '①〜⑤全部ウォッチだけ', replies: ['同感', '寝る'] },
      { text: '週末に枚数触らない' },
      { text: '月曜寄り30分' },
    ],
  },
  {
    author: 7,
    postedAt: '2026-09-12T06:18:00+09:00',
    likeSlots: 15,
    title: '土曜朝：週次メモ。CPI後もサイズ優先',
    content:
      '土曜朝。週次話題メモ：原油高・金利高・金曜日本株大幅安（報道）・米コアCPI上振れ・FOMC(9/16)利上げ織り込み。DB確定は木曜：日経65142.78・WTI103.98・US10Y4.94・NVDA218.36・99846810。週末は板がない。新規ゼロ、積立だけ。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['週末', 'CPI', 'N225', 'ルール', '様子見'],
    comments: [
      { text: '週末は触らない', replies: ['月曜まで', 'サイズ確認'] },
      { text: '報道終値で逆張り禁止' },
      { text: 'FOMCまで慎重' },
    ],
  },
  {
    author: 9,
    postedAt: '2026-09-12T07:42:00+09:00',
    likeSlots: 14,
    title: '土曜：話題タグは金利と原油。月曜ギャップ追わない',
    content:
      '土曜朝チェック。話題の中心は金利（米利上げ確率上昇）と原油。半導体・9984は木曜位置（33920/6810）をメモするだけ。月曜ギャップを「押し目」と決めない。寄り30分ルール継続。',
    ticker: '9984.T',
    sentiment: 'neutral',
    tags: ['週末', '金利', '原油', '9984', 'ルール'],
    comments: [
      { text: '6810で週末に買い理由作らない', replies: ['33920も', '積立だけ'] },
      { text: 'アプリ閉じる派' },
      { text: '一次情報だけ残す' },
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Sep11–12 topic posts…`)

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
