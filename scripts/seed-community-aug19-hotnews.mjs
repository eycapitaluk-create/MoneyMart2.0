/**
 * Community: Aug 18 close wrap + Aug 19 (Wed) morning.
 * Times only up to current JST (~08:52). No future / no 寄り posts.
 *
 *   node scripts/seed-community-aug19-hotnews.mjs
 *   node scripts/seed-community-aug19-hotnews.mjs --dry-run
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
    postedAt: '2026-08-18T15:42:00+09:00',
    likeSlots: 16,
    title: '大引け確定 — 1759円安の6万7461円、6日ぶり大幅反落',
    content:
      '確定終値は-1759円52銭（-2.54％）の6万7460円73銭（報道）。下げ幅は一時1800円超。TOPIXは-43.89の4140.22。6857・8035・9983・285Aが指数を押し下げ、海運・鉱業・石油と三菱商・武田は相対的に強い。プライムは値下がり783・値上がり722。教訓：5日続伸の翌日にサイズを増やさない。積立は淡々と。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['大引け', '日経平均', '半導体', 'TOPIX'],
    comments: [
      {
        text: '15時スレの数字とほぼ同じ。確定は1759円安',
        replies: ['寄与銘柄依存の下げだった', '指数より中身'],
      },
      {
        text: '海運・資源は買われた。全部売られた日じゃない',
        replies: ['だから一括ナンピン禁止'],
      },
      { text: '米時間の金利と原油を見る' },
    ],
  },
  {
    author: 5,
    postedAt: '2026-08-18T19:08:00+09:00',
    likeSlots: 13,
    title: 'ナイト — 先物はさらに弱い、6万7250円',
    content:
      '19時時点の大阪日経225先物（9月限）は前日比-290円の6万7250円、現物終値6万7461円に対して約211円安（報道）。日中で十分下げたあともナイトは戻りきれず。自分は触らない。明日の米国次第。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['先物', 'ナイト', '様子見'],
    comments: [
      {
        text: '日中で十分見た。ナイトは見送り',
        replies: ['正しい'],
      },
      { text: '積立設定だけ確認して寝る' },
    ],
  },
  {
    author: 0,
    postedAt: '2026-08-19T07:18:00+09:00',
    likeSlots: 16,
    title: '水曜おはよう — 米は3日続落、ナスダックが重い',
    content:
      '前日米：ダウ-116ドルの5万3343ドル、S&P-53の7692付近、ナスダック-355の2万6290付近（報道）。3営業日続落。世界的な長期金利上昇＋中東不透明で原油高が嫌気。半導体・同製造装置は安く、医薬品・エネルギーは相対的に高い。METAは訴訟材料で大幅安との解説も。HDは好決算で上昇。自分のルールは①ギャップ追っかけ禁止②半導体フルベットしない③積立は淡々と。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['水曜', 'ダウ', 'ナスダック', '金利'],
    comments: [
      {
        text: 'ダウよりナスダックが重い。半導体の翌日注意',
        replies: ['6857/8035追いかけない', 'ストーリー固定しない'],
      },
      {
        text: '原油と金利がまだ残ってる',
        replies: ['地政学は一進一退'],
      },
      { text: '積立は淡々と。今日の正解はそれ' },
    ],
  },
  {
    author: 10,
    postedAt: '2026-08-19T08:08:00+09:00',
    likeSlots: 15,
    title: '先物メモ — ナイトで6万6370円まで、ギャップ大きい',
    content:
      '大阪ナイトは19日2時時点で-1170円の6万6370円、現物終値比約1090円安（報道）。シカゴ日経先物は6万6285円前後まで売られたとの解説も。25日線（6万5910円前後）が意識されやすい、との見方。ギャップが大きい日は「寄り30分見るだけ」。投票：寄り後は？①見るだけ②押し目分割③強気で拾う。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['先物', '寄り前', 'ギャップ', '様子見'],
    comments: [
      {
        text: '①一択。1000円ギャップを追わない',
        replies: ['同感。ウォッチ更新だけ', '先物だけ見て飛びつかない'],
      },
      {
        text: '25日線まで行く？決め打ちしない',
        replies: ['下値メドの話は話。今日のサイズは維持'],
      },
      { text: '③欲しい気持ちある…我慢' },
    ],
  },
  {
    author: 2,
    postedAt: '2026-08-19T08:41:00+09:00',
    likeSlots: 14,
    title: '寄り前 — 6857/8035を拾う日？拾わない日',
    content:
      '米半導体安＋金利。前日東京はアドテスト・東エレク・キオクシアが指数を押した。ナイト先物も弱い。チェック：①先物②ドル円159円台③半導体ギャップ④触らない。押し目に見える日ほどナイフ。自分はサイズ維持、新規増やさない。',
    ticker: '6857.T',
    sentiment: 'neutral',
    tags: ['半導体', '寄り前', 'アドバンテスト', '東エレク'],
    comments: [
      {
        text: '押し目に見える日ほど危ない',
        replies: ['連想買い禁止'],
      },
      { text: '285Aも見るけど追わない' },
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Aug 18 close + Aug 19 morning posts…`)

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
