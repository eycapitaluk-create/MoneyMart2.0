/**
 * Community: Aug 13 afternoon–evening — CPI後の3日続伸、アドテスト寄与、TOPIX高値.
 * X-style threads. Times fill gaps after morning seeds.
 *
 *   node scripts/seed-community-aug13-close-hotnews.mjs
 *   node scripts/seed-community-aug13-close-hotnews.mjs --dry-run
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
    author: 2,
    postedAt: '2026-08-13T10:05:00+09:00',
    likeSlots: 17,
    title: '前場 — アドテスト1銘柄で指数を数百円押し上げ、追っかけ？',
    content:
      'CPI無難通過の翌日。寄りは続伸（報道で+509円・6万8033円付近）。前場は上げ幅1000円超・一時6万8600円台の話題も。アドバンテストが寄与トップ級（約427円分との解説）で、東エレク・イビデン・キオクシアも強い。指数は半導体数銘柄に依存しやすい日。ルール：①ギャップ追っかけ禁止②6857はウォッチ③サイズ半分。',
    ticker: '6857.T',
    sentiment: 'bullish',
    tags: ['アドバンテスト', '半導体', '日経平均', 'CPI'],
    comments: [
      {
        text: '427円寄与はすごい…でも1銘柄依存は怖い',
        replies: ['わかる。指数強い≠個別全部買い', '6857追っかけは禁止で同意'],
      },
      {
        text: '上場来高値更新の話もある。利確した人いそう',
        replies: ['高値更新日は翌日揺さぶりやすい'],
      },
      {
        text: '8035と285Aもセットで見てる',
        replies: ['イビデン・村田も強い流れらしい'],
      },
      { text: 'CPI通過で安心しすぎ注意。原油高は残ってる' },
    ],
  },
  {
    author: 8,
    postedAt: '2026-08-13T11:50:00+09:00',
    likeSlots: 15,
    title: '前引けメモ — 3日続伸、値上がり銘柄より寄与銘柄',
    content:
      '前引けは大幅続伸（報道で+1086円・6万8609円付近）。騰落は値上がり87・値下がり137との数字も。指数は強いのに下落銘柄の方が多い日＝値がさ半導体に引っ張られてる。TOPIXも時間中高値更新の話題。後場は「持ち越し」と「一部利確」で分かれそう。投票：後場は①見るだけ②一部利確③押し目分割。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['前引け', 'TOPIX', '半導体', '投票'],
    comments: [
      {
        text: '①見るだけ。3日続伸の後場は怖い',
        replies: ['私も①。触ると負ける気がする', '②少し利確して心を軽くした'],
      },
      {
        text: '値下がり銘柄が多いのに指数高、わかりやすい歪み',
        replies: ['寄与度の罠だね'],
      },
      { text: '9983とか主力は弱い日もある。指数だけ見ない' },
      {
        text: '後場でさらに伸ばす？',
        replies: ['CPI通過の達成感売りもあり得る'],
      },
    ],
  },
  {
    author: 6,
    postedAt: '2026-08-13T13:40:00+09:00',
    likeSlots: 16,
    title: '後場雑談 — 村田・イビデンも強い、AIインフラ連想が広がってる？',
    content:
      '半導体テスタだけじゃなく電子部品・基板関連も買われてるとの解説。村田・イビデン・太陽誘電などの名前が並ぶ。資金が「AI関連に回帰」してる感じ。でもテーマ全振りは禁止。自分はコア積立＋ウォッチ更新のみ。後場で追いかけたくなる衝動、みんなどう抑えてる？',
    ticker: '6981.T',
    sentiment: 'bullish',
    tags: ['村田製作所', 'イビデン', 'AI', '電子部品'],
    comments: [
      {
        text: 'テーマ拡散の日は一番飛びつきやすい…',
        replies: ['わかる。分割サイズだけメモ', 'ウォッチに入れるまでが仕事'],
      },
      {
        text: 'SKハイニックス急騰の連想でメモリーも話題',
        replies: ['韓国株強いと日本の半導体も振れやすい'],
      },
      { text: '積立は淡々と。サテライトは触らない' },
      {
        text: '9984ソフトバンクGも寄与上位だったっけ',
        replies: ['指数寄与は見る。買う理由にはしない'],
      },
    ],
  },
  {
    author: 3,
    postedAt: '2026-08-13T15:50:00+09:00',
    likeSlots: 18,
    title: '大引け — 日経+784円の6万8308円、1カ月ぶり6万8000円台',
    content:
      '大引け：日経終値6万8308円（+784円・+1.16％前後、報道）。3営業日続伸、約1カ月ぶりに6万8000円台回復。TOPIXは4176付近で2日連続最高値更新も。プライムの6割超が値上がりの話。強い地合いだが、寄与は半導体・AIに偏りやすい。今夜の自分：サイズ維持・新規増やさない・明日のギャップに備える。',
    ticker: 'TOPIC',
    sentiment: 'bullish',
    tags: ['大引け', '日経平均', 'TOPIX', 'CPI'],
    comments: [
      {
        text: '68000回復は気持ちいい。でも追いかけない',
        replies: ['同感。回復日の翌営業日は調整あるある', '3日続伸は利確が出やすい'],
      },
      {
        text: 'TOPIX最高値は広がりあるサイン？',
        replies: ['銀行なども含めて地合い良い話はある', 'それでも個別は選別'],
      },
      {
        text: 'CPI通過→半導体→指数、ストーリーがきれいすぎる',
        replies: ['きれいな日ほどルール厳守', '原油高・地政学は残ってる'],
      },
      { text: '投票：明日は？①見るだけ②押し目待ち③強気継続' },
      {
        text: '私は①。週末前でもないし、まだ木金',
        replies: ['金曜まで持ち越すならサイズ半分'],
      },
    ],
  },
  {
    author: 9,
    postedAt: '2026-08-13T17:35:00+09:00',
    likeSlots: 14,
    title: '夕方メモ — 今週の流れを固定しない（NFP→休場→CPI→続伸）',
    content:
      '週の流れ：弱い雇用→反発、山の日休場、CPI予想一致、今日は半導体で大幅続伸。だからといって「ずっと買い」は短絡。残リスクは原油・中東・個別決算の出尽くし。ルール再掲：①ストーリー一発買い禁止②高値更新の追いかけ禁止③コア積立は継続。今週守れた人、一言ください。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['振り返り', 'ルール', 'メンタル', 'マクロ'],
    comments: [
      {
        text: '①守れそう。今日は欲しくなった',
        replies: ['その自覚があるなら勝ち', '私も追いかけそうになった'],
      },
      { text: '②が一番難しい。高値更新は魔力ある' },
      {
        text: '③積立だけやってる。一番強い',
        replies: ['それが正解', 'サテライトは来週判定でいい'],
      },
      { text: '原油高忘れてた。景気敏感は別管理' },
    ],
  },
  {
    author: 11,
    postedAt: '2026-08-13T19:20:00+09:00',
    likeSlots: 15,
    title: '投票 — 今夜の米国、何を見る？',
    content:
      '日本は大幅高で終了。米国時間はハイテク堅調のあとの利益確定も出やすい。番号で：①ナスダック・SOX②原油③ドル円④個別決算（AIクラウド等）⑤何も見ない・寝る。私は⑤が理想、①だけチラ見しそう。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['投票', '米国株', '原油', '雑談'],
    comments: [
      {
        text: '⑤寝る。今日ルール守れたから余計に',
        replies: ['えらい', '私は①だけ。触らない'],
      },
      {
        text: '②原油。ダウが嫌気してた材料',
        replies: ['エネルギーはCPI内訳でも論点だった'],
      },
      { text: '④NBISとかCRWVの話題あったけど追わない' },
      {
        text: 'ドル円159円台の話、円安メリットだけで買わない',
        replies: ['為替は別枠。日本株全振り禁止'],
      },
    ],
  },
  {
    author: 4,
    postedAt: '2026-08-13T21:15:00+09:00',
    likeSlots: 13,
    title: '夜の雑談 — 明日（金）最初に確認すること',
    content:
      '金曜チェックリスト：①米株の戻り/利益確定②ドル円③半導体ギャップ（6857/8035）④指数の6万8000円台維持⑤無理に増やさない。週末持ち越しはサイズ意識。番号で「一番見るもの」を。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['チェックリスト', '金曜', '半導体', '雑談'],
    comments: [
      {
        text: '①米株。今日の上げの持続力',
        replies: ['それが本命', '③はそのあと'],
      },
      { text: '⑤が一番大事。リストに入れてくれてありがとう' },
      {
        text: '週末前に新規増やさない派',
        replies: ['同感。金曜は減らす日'],
      },
      { text: '6万8000維持できるかが心理的節目' },
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Aug 13 close-session posts…`)

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
