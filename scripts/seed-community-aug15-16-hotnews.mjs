/**
 * Community: Aug 15–16 weekend — 金曜4日続伸のあと米株反落、AMAT、週末ルール.
 * Times only up to current JST (Sun 8/16 ~08:00). No future posts.
 *
 *   node scripts/seed-community-aug15-16-hotnews.mjs
 *   node scripts/seed-community-aug15-16-hotnews.mjs --dry-run
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

/**
 * comments: string = top-level
 *   or { text, author?, replies?: [{ text, author? }] }
 */
const POSTS = [
  {
    author: 1,
    postedAt: '2026-08-15T07:15:00+09:00',
    likeSlots: 16,
    title: '土曜おはよう — 米ダウ107ドル安、金曜の日本高をどう見る？',
    content:
      '金曜の日本は4営業日続伸で終値6万8713円（+405円、報道）。一時6万9000円台回復も利確で縮めた。その後の米市場はダウ-107ドル・ナスダックも反落。小売売上高の下振れ・消費者態度の弱さ・中東不透明感が材料（報道ベース）。週末はチャート追わず、メモだけ。月曜はギャップ注意。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['週末', 'ダウ', '日経平均', 'マクロ'],
    comments: [
      {
        text: '日本高→米安の週末あるある。月曜焦らない',
        replies: ['同感。ギャップ追っかけ禁止', 'サイズ維持でいい'],
      },
      {
        text: '小売弱いのは消費の話。ハイテク全部売りとは限らない',
        replies: ['ストーリー固定しないのが正解'],
      },
      { text: '土曜は市場見ない派。家族優先' },
      {
        text: '投票：月曜は？①見るだけ②押し目待ち③強気継続',
        replies: ['①一択', '③は危険'],
      },
    ],
  },
  {
    author: 2,
    postedAt: '2026-08-15T10:40:00+09:00',
    likeSlots: 15,
    title: 'AMAT決算後5％超安 — 好決算でも売られる日',
    content:
      'アプライド（AMAT）は決算・見通しが予想超えでも期待未達で5％超安との報道。ブロードコムなども弱い。日本の東エレク・アドテスト連想は出やすいが、週末に飛びつくのは禁止。好決算＝買い、は短絡。来週の自分：①寄与銘柄追いかけない②分割のみ③ウォッチ更新はOK。',
    ticker: 'AMAT',
    sentiment: 'bearish',
    tags: ['AMAT', '半導体', '決算', '東エレク'],
    comments: [
      {
        text: '期待値の高さで売られるの怖い…',
        replies: ['AI関連のバリュエーション警戒だね', '8035は見るけど買わない'],
      },
      {
        text: 'SNDKは強気見通しで上げてた話もある。銘柄選別',
        replies: ['全部まとめて売らない'],
      },
      { text: '週末にポジ増やす人いないよね' },
      {
        text: '6857も金曜寄与大きかった。月曜は揺さぶり注意',
        replies: ['寄与銘柄の翌日は危険'],
      },
    ],
  },
  {
    author: 6,
    postedAt: '2026-08-15T13:25:00+09:00',
    likeSlots: 14,
    title: '投票 — 週末、チャート見る？見ない？',
    content:
      '土曜の過ごし方。①完全オフ②ウォッチリスト整理だけ③米株ダイジェスト読む④来週チェックリスト作成⑤全部やる。私は②＋④。4日続伸のあとに米安だと余計に触りたくなるけど、触らないのが戦略。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['投票', '週末', 'メンタル', '雑談'],
    comments: [
      {
        text: '①理想、③になっちゃう',
        replies: ['わかる…つい見る', '見るだけならOK'],
      },
      {
        text: '④だけやって公園行く',
        replies: ['それが一番強い'],
      },
      { text: '触らない約束。破ったら自分に罰金' },
    ],
  },
  {
    author: 9,
    postedAt: '2026-08-15T16:50:00+09:00',
    likeSlots: 15,
    title: '週次メモ — NFP→休場→CPI→PPI→4日続伸→米週末安',
    content:
      '今週の流れが速すぎる。弱い雇用で利上げ観測後退、山の日休場、CPI予想一致、PPI下振れ、日本は4日続伸で一時69000台。週末米は消費指標と地政学で反落。だから来週も同じ買いストーリーとは限らない。ルール再掲：①ストーリー一発買い禁止②ギャップ追っかけ禁止③コア積立は継続。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['振り返り', 'ルール', 'CPI', 'PPI'],
    comments: [
      {
        text: 'きれいな週ほど翌週は荒れる説',
        replies: ['あるある。だからサイズ維持', '積立だけ淡々と'],
      },
      { text: '中東・原油も残ってる材料。忘れがち' },
      {
        text: 'TOPIX最高値更新の話もあった。地合いは悪くない？',
        replies: ['地合い≠個別全買い', '来週判定でいい'],
      },
    ],
  },
  {
    author: 3,
    postedAt: '2026-08-15T19:35:00+09:00',
    likeSlots: 13,
    title: '夜の雑談 — 月曜最初に確認すること',
    content:
      '月曜チェックリスト：①米株の戻り/続落②ドル円③半導体ギャップ（6857/8035/AMAT連想）④6万8000〜8700円台の位置⑤寄り30分は見るだけ。週末持ち越しサイズ、増やしてない人えらい。番号で「一番見るもの」を。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['チェックリスト', '月曜', '半導体', '雑談'],
    comments: [
      {
        text: '①米株。金曜高の持続力',
        replies: ['それが本命', '⑤がそのあと'],
      },
      { text: '③は見るけど追わない' },
      {
        text: '増やしてない。えらい自分',
        replies: ['その自覚が勝ち'],
      },
    ],
  },
  {
    author: 11,
    postedAt: '2026-08-15T22:20:00+09:00',
    likeSlots: 14,
    title: '就寝前 — 週末に何もしないのも戦略',
    content:
      '土曜の夜。チャート閉じた人、えらい。月曜の自分へ：①寄りは見るだけ②AMAT連想で日本半導体フルベット禁止③ストーリー固定しない。良い日曜日を。おやすみ。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['メンタル', 'ルール', '週末', '半導体'],
    comments: [
      {
        text: '閉じた。スマホ別室',
        replies: ['えらい', 'おやすみ'],
      },
      { text: '②が一番難しい。でも書く' },
      {
        text: '良い日曜を！',
        replies: ['月曜またここで'],
      },
    ],
  },
  {
    author: 0,
    postedAt: '2026-08-16T06:20:00+09:00',
    likeSlots: 15,
    title: '日曜早朝 — 来週の自分へのメモ（まだ市場は休み）',
    content:
      '日曜朝。日本は明日開場。金曜は4日続伸・終値68713円、週末米はダウ反落。材料は消費弱さ・AMAT期待未達・地政学。今日やることはトレードじゃなく①チェックリスト確認②サイズを増やさない約束③家族・休息。明日の正解は「見るだけ」。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['日曜', '来週', 'ルール', 'メンタル'],
    comments: [
      {
        text: 'まだ開いてないのに欲しくなるの病気',
        replies: ['わかる。だからメモだけ', '明日まで触らない'],
      },
      {
        text: '積立設定だけ確認して終わる',
        replies: ['それが一番強い'],
      },
      { text: '投票：明日寄りは？①見るだけ②押し目③強気', replies: ['①', '③禁止'] },
    ],
  },
  {
    author: 5,
    postedAt: '2026-08-16T07:42:00+09:00',
    likeSlots: 14,
    title: '投票 — 月曜ギャップ、どう扱う？',
    content:
      '米安を受けて月曜はギャップダウンしやすい、という声もある。逆に戻す日もある。番号で：①ギャップは触らない②押し目だけ分割③強いなら追い④積立以外見ない。私は①＋④。週末に決めたルールを月曜に曲げない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['投票', 'ギャップ', '月曜', 'メンタル'],
    comments: [
      {
        text: '①。ギャップ日は一番負ける',
        replies: ['同感', '④も一緒に'],
      },
      {
        text: '②は来たら考える。今は決めない',
        replies: ['それが冷静'],
      },
      { text: '③は絶対やらないと決めた' },
      {
        text: '良い日曜を。明日また',
        replies: ['お互いルール守ろう'],
      },
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Aug 15–16 weekend posts…`)

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

    // DB may not have parent_comment_id yet — flatten replies as X-style threaded lines.
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
