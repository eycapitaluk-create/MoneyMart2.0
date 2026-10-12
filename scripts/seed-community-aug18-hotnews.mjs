/**
 * Community: Aug 18 (Tue) — 米続落・金利・原油で6日ぶり大幅反落.
 * Times only up to current JST (~15:07). No future posts.
 *
 *   node scripts/seed-community-aug18-hotnews.mjs
 *   node scripts/seed-community-aug18-hotnews.mjs --dry-run
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
    author: 0,
    postedAt: '2026-08-18T07:20:00+09:00',
    likeSlots: 16,
    title: '火曜おはよう — 米は続落、原油高と長期金利が重し',
    content:
      '前日米：ダウ-273ドルの5万3460ドル付近、ナスダックも小幅安、S&Pは-0.5％前後（報道）。対イラン協議の行き詰まりで原油高が嫌気され、長期金利上昇が売り圧力に。月曜は5日続伸したあと。自分のルールは①ギャップ追っかけ禁止②半導体フルベットしない③積立は淡々と。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['火曜', 'ダウ', '原油', '金利'],
    comments: [
      {
        text: '原油と金利が同時に来る日は嫌な匂い',
        replies: ['地政学はストーリー固定しない', 'それでも①見るだけ'],
      },
      {
        text: '5日続伸の翌日は達成感売り出やすい',
        replies: ['月曜にサイズ増やした人つらそう'],
      },
      { text: '積立は淡々と。今日の正解はそれ' },
    ],
  },
  {
    author: 2,
    postedAt: '2026-08-18T08:38:00+09:00',
    likeSlots: 15,
    title: '寄り前 — 値がさ半導体は売られやすい日？',
    content:
      '米金利上昇＋原油高の翌日。6857/8035/285Aは寄与が大きいから指数ごと振られやすい。月曜スレの「触らない」を継続。チェック：①先物②ドル円③半導体ギャップ④触らない。投票：寄り後は？①見るだけ②押し目分割③強気で拾う。',
    ticker: '6857.T',
    sentiment: 'neutral',
    tags: ['半導体', '寄り前', 'アドバンテスト', '東エレク'],
    comments: [
      {
        text: '①一択。寄与銘柄の火曜朝は罠',
        replies: ['同感。ウォッチ更新だけ', '連想買い禁止'],
      },
      {
        text: '285Aもセットで見るけど追わない',
        replies: ['テーマ全振りしない'],
      },
      { text: '③欲しい気持ちある…我慢' },
    ],
  },
  {
    author: 10,
    postedAt: '2026-08-18T09:16:00+09:00',
    likeSlots: 17,
    title: '寄り — 6日ぶり反落スタート、-373円',
    content:
      '寄りは前営業日比-373円の6万8847円（報道）。米株安と長期金利上昇を受け、値がさ半導体に売り先行。9984はしっかり、9983と6857は弱いとの解説も。6日続伸のあと初日は「見るだけ」。サイズ維持、ギャップ追っかけ禁止。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['寄り', '日経平均', '半導体', '反落'],
    comments: [
      {
        text: '続伸ストップ初日。想定内',
        replies: ['だから見送り', '気持ちよく上げた翌日ほど怖い'],
      },
      {
        text: '海運は相対的に強い？原油高の裏',
        replies: ['指数と個別を分けて見る日'],
      },
      { text: '先物だけ見て飛びつかない' },
    ],
  },
  {
    author: 8,
    postedAt: '2026-08-18T10:42:00+09:00',
    likeSlots: 16,
    title: '前場 — 下げ加速、長期金利は約30年ぶり水準も',
    content:
      '寄り後も下げ幅拡大。一時600円超安の報道。10年国債利回りは一時2.945％、1996年10月以来の高水準との解説。原油はWTI80ドル超の話も。金利敏感は弱い一方、海運・石油は相対的に強い。金利上昇＝株のバリュエーションに逆風。今日は追いかける材料じゃない。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['金利', '国債', '原油', '前場'],
    comments: [
      {
        text: '2.95％は重い…不動産つらそう',
        replies: ['金利と株の同時安はきつい', '日銀観測も出てるけど決め打ちしない'],
      },
      {
        text: '原油高＝インフレ再燃ストーリー、固定しない',
        replies: ['地政学は一進一退しやすい'],
      },
      { text: 'ナンピンしたくなるけど禁止' },
    ],
  },
  {
    author: 3,
    postedAt: '2026-08-18T12:28:00+09:00',
    likeSlots: 16,
    title: '前引け — 1100円超安、アドテスト1銘柄で約376円押し下げ',
    content:
      '前引けは-1122円の6万8099円付近（報道）。騰落は値上がり106・値下がり116。6857が約376円分、8035が約290円分押し下げ。一方9984は約122円押し上げ。海運・鉱業・石油は高いが指数は値がさ売り。TOPIXの下げは日経より小さいとの数字も。指数で一喜一憂しない。後場は無理に拾わない。',
    ticker: '6857.T',
    sentiment: 'bearish',
    tags: ['前引け', 'アドバンテスト', '寄与度', '海運'],
    comments: [
      {
        text: '1銘柄で376円押し下げはエグい',
        replies: ['8035とセットで指数が溶ける', '寄与度の罠、今日は分かりやすい'],
      },
      {
        text: '9984だけ強い。指数と個別が別物',
        replies: ['SBG材料あるけど半導体買い戻しにはしない'],
      },
      { text: 'ランチ後にナイフキャッチする人、やめて' },
    ],
  },
  {
    author: 6,
    postedAt: '2026-08-18T13:38:00+09:00',
    likeSlots: 15,
    title: '後場 — 6万8000円割れ、SBG材料でも指数は別',
    content:
      '13時時点は-1244円の6万7976円、6万8000円割れ（報道）。プライムは値上がり銘柄の方が多いのに日経は大幅安＝寄与銘柄依存。米NVDAがSBエナジー（SBG関連）のオハイオAI拠点に最大1050億ドル規模の保証、15億ドル出資との報道。9984は相対的に強いが、6857/8035を買い戻す材料にはしない。後場のナイフキャッチ禁止。',
    ticker: '9984.T',
    sentiment: 'neutral',
    tags: ['ソフトバンクG', 'NVIDIA', '後場', '日経平均'],
    comments: [
      {
        text: 'NVDAとSBGの材料は大きい。でも今日の指数は別',
        replies: ['9984見るのはあり、半導体全買い戻しはなし', '規模の話は長期。今日は見送り'],
      },
      {
        text: '値上がり銘柄多いのに日経だけ大幅安、歪み注意',
        replies: ['TOPIXの方が地合いに近い日'],
      },
      { text: '①見るだけ。後場に増やさない' },
    ],
  },
  {
    author: 9,
    postedAt: '2026-08-18T14:48:00+09:00',
    likeSlots: 14,
    title: '後場中盤 — 1400円安圏、安値もみ合い',
    content:
      '14時時点は-1390円前後の6万7830円、TOPIXも-34ポイント前後（報道）。値がさ株が指数を押し下げる安値もみ合い。5日続伸のあと初日の下げは「達成感＋金利」。自分のルール：①ナンピンしない②後場に新規増やさない③大引けまでサイズ維持。みんなどうする？',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['後場', 'メンタル', 'ルール', '様子見'],
    comments: [
      {
        text: '①守れそう。午前で十分見た',
        replies: ['正しい', '触ると負ける気がする'],
      },
      {
        text: 'ウォッチリスト整理だけする',
        replies: ['それが仕事'],
      },
      { text: '大引けスレでまた会おう' },
    ],
  },
  {
    author: 11,
    postedAt: '2026-08-18T15:03:00+09:00',
    likeSlots: 15,
    title: '15時 — 約1730円安、6日ぶり大幅反落',
    content:
      '15時時点の報道は日経6万7488円前後（約-1732円）、TOPIX 4141前後（約-43）。前日終値6万9220円から大きく巻き返し。半導体・値がさが指数を押し下げ、海運・資源・医薬品は相対的に強い歪み。終値確定は報道待ちでも、今日の教訓は「続伸5日の翌日にサイズを増やさない」。積立は淡々と、個別は明日の米国次第。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['大引け', '日経平均', '半導体', '積立'],
    comments: [
      {
        text: '6日ぶり反落、想定内でも数字は重い',
        replies: ['指数より個別の中身を見る日'],
      },
      { text: '積立は淡々と。今日はそれでいい' },
      { text: '米時間の金利と原油を見る。決め打ちしない' },
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Aug 18 Tuesday posts…`)

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
