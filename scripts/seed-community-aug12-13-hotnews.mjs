/**
 * Community: Aug 12–13 gap fill — CPI week, Nikkei rebound, TOPIX high.
 * X-style threads: comments + nested replies + likes. Times spread across the day.
 *
 *   node scripts/seed-community-aug12-13-hotnews.mjs
 *   node scripts/seed-community-aug12-13-hotnews.mjs --dry-run
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
  // ——— 8/12 ———
  {
    author: 0,
    postedAt: '2026-08-12T07:20:00+09:00',
    likeSlots: 15,
    title: '休場明けおはよう — 今夜は米CPI、朝イチは様子見で正解？',
    content:
      '山の日明け。前営業日は日経+2％超で66,970円付近（報道）。今夜は米7月CPI。朝からフルベットは危険。自分のルールは①寄り30分は見るだけ②CPI前にサイズ増やさない③半導体はウォッチ中心。みんな朝イチどうする？',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['休場明け', 'CPI', '日経平均', 'メンタル'],
    comments: [
      {
        text: '①同意。触りたくなるけど我慢',
        replies: [
          'わかる…祝日明け＋CPIは罠多そう',
          '私も見るだけ。メモ更新のみ',
        ],
      },
      {
        text: '半導体強い流れ引き継ぐかもだけど、追いかけない',
        replies: ['SOX反発のあとはギャップ追っかけ禁止派'],
      },
      { text: '積立は淡々と。今日の正解はそれ' },
      {
        text: '投票：朝イチは？ ①見るだけ ②少し買う ③休み明け無視して仕事',
        replies: ['③仕事優先。夜CPIまで触れない', '①一択'],
      },
    ],
  },
  {
    author: 2,
    postedAt: '2026-08-12T09:15:00+09:00',
    likeSlots: 16,
    title: '寄り雑談 — 半導体・AIが買われてる？でも方向感薄い',
    content:
      '寄り後、アドテスト・キオクシア・イビデンなど半導体に買いの話。ただ参加者少なめ・CPI待ちで方向感乏しいとの解説も。一時下げ200円超の場面もあったらしい。「強いテーマ」と「薄い相場」が同居してる日。サイズ半分ルールで見てる。',
    ticker: '6857.T',
    sentiment: 'neutral',
    tags: ['半導体', 'アドバンテスト', 'キオクシア', '寄り'],
    comments: [
      {
        text: '6857動いてるけど追わない。CPI前だから',
        replies: [
          '同感。寄与大きい日ほど翌日揺さぶりやすい',
          '285Aも話題だけどストップ高追い禁止',
        ],
      },
      {
        text: '参加者少ない中での上げは怖い',
        replies: ['夏休み相場あるある…'],
      },
      { text: '前場は様子見で正解だと思う' },
      {
        text: '東エレク(8035)も堅調？セットで見る派',
        replies: ['うん、6857/8035はセット監視'],
      },
    ],
  },
  {
    author: 8,
    postedAt: '2026-08-12T11:40:00+09:00',
    likeSlots: 14,
    title: '前引けメモ — 小幅続伸、CPI前で様子見ムード強い',
    content:
      '前引けは日経小幅高（報道ベースで+70円前後・6万7040円付近）。半導体買いと原油高嫌気の売りが交錯。今夜CPI上振れ→利上げ観測再燃の警戒も。後場も無理に増やさない。投票：後場は①現金多め②保有維持③押し目だけ分割。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['前引け', 'CPI', '様子見', '原油'],
    comments: [
      {
        text: '①現金多め。今夜まで触らない',
        replies: ['それが一番強い', '私も①'],
      },
      {
        text: '原油高で小売り・空運弱いの気になる',
        replies: ['エネルギーは中東絡みで振れやすいよね'],
      },
      { text: '②維持。触ると負ける気がする' },
      {
        text: 'ゴールデンクロス期待してる人いる？',
        replies: ['チャートは後付け。CPI優先で見る'],
      },
    ],
  },
  {
    author: 6,
    postedAt: '2026-08-12T14:05:00+09:00',
    likeSlots: 17,
    title: '後場 — 半導体・AIが牽引、上げ幅拡大してきた',
    content:
      '後場は先物絡みで上値志向。韓国KOSPI堅調＋SOX流れで半導体・電子部品が牽引との解説。一時+469円付近の話題も。でも「ファンダではなくセンチメント」という声もある。CPI前の上昇は持ち越し注意。利確一部／サイズ維持が無難では。',
    ticker: 'TOPIC',
    sentiment: 'bullish',
    tags: ['後場', '半導体', 'AI', 'KOSPI'],
    comments: [
      {
        text: '気持ちいい上げだけど怖い…',
        replies: [
          'わかる。だから一部利確した',
          '私はウォッチだけ。追いかけない',
        ],
      },
      {
        text: '太陽誘電・村田・イビデンも話題だね',
        replies: ['AIインフラ連想で動いてる感じ'],
      },
      {
        text: 'メガバンクも強い？TOPIX押し上げそう',
        replies: ['指数と個別は別。個別はサイズ確認'],
      },
      { text: 'CPIまでホールドできるメンタルある人えらい' },
    ],
  },
  {
    author: 3,
    postedAt: '2026-08-12T15:45:00+09:00',
    likeSlots: 18,
    title: '大引け — 日経+553円で6万7524円、TOPIX最高値更新',
    content:
      '大引け：日経終値6万7524円（+553円・+0.83％前後、報道）。6万7000円台回復、約1カ月ぶり高値水準。TOPIXは4139付近で約1カ月ぶり最高値更新も。5日・25日線ゴールデンクロスの話題あり。一方サンリオ・楽天Gは決算で弱い。強い指数≠全部買い。今夜CPIが本番。',
    ticker: 'TOPIC',
    sentiment: 'bullish',
    tags: ['大引け', 'TOPIX', '日経平均', 'ゴールデンクロス'],
    comments: [
      {
        text: 'TOPIX最高値は地合い良いサイン？',
        replies: [
          '銀行なども買われてるらしい',
          'でも値上がり銘柄比率はそこまで広くない話も',
        ],
      },
      {
        text: '6098リクルートも商い伴って上げてた',
        replies: ['ストップ高週明けのあとも強いね'],
      },
      {
        text: '9983ファーストリテイリング弱いのは気になる',
        replies: ['指数寄与大きい銘柄が弱い日はある'],
      },
      {
        text: 'ゴールデンクロスで飛び乗る？',
        replies: [
          '飛び乗り禁止。CPI後に再判定',
          'チャートは確認用、売買理由にしない',
        ],
      },
      { text: '今夜までポジ増やさないルール厳守' },
    ],
  },
  {
    author: 9,
    postedAt: '2026-08-12T18:30:00+09:00',
    likeSlots: 15,
    title: '夕方雑談 — CPIまであと数時間、何見てる？',
    content:
      '今夜21:30前後（報道）に米7月CPI。予想はヘッドライン前年+3.4％・コア+2.5％前後の声が多い。下振れ→リスクオン継続、上振れ→金利↑ハイテク逆風、の二択。個人はイベント前にサイズ落とすのが勝ちパターン。チェックリスト：①予想比較②ドル円③先物④半導体⑤触らない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['CPI', 'マクロ', 'チェックリスト', '雑談'],
    comments: [
      {
        text: '①予想比較から。サプライズ有無が全て',
        replies: ['同感。数字そのものより反応', 'コア重視派'],
      },
      {
        text: '予想どおりでも材料出尽くしあるよね',
        replies: ['あるある。だから「数字待ち買い」は危険'],
      },
      { text: '⑤触らないが一番強い答え' },
      {
        text: 'NVDA・半導体センチも振れそう',
        replies: ['日本は明日寄りで反映。今夜は見るだけ'],
      },
    ],
  },
  {
    author: 11,
    postedAt: '2026-08-12T21:45:00+09:00',
    likeSlots: 19,
    title: '速報スレ — 米7月CPI 前年+3.4％・コア+2.5％、予想どおり',
    content:
      '米7月CPI：前年+3.4％（予想どおり）、前月比+0.1％。コア前年+2.5％・前月比+0.2％も予想一致（報道ベース）。伸び率は2カ月連続縮小。サプライズなし＝利上げ急加速は起きにくい一方、材料出尽くしにも注意。エネルギーは前年高だが月次は落ち着きの解説も。反応待ち・サイズ維持。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['CPI', '速報', '金利', 'マクロ'],
    comments: [
      {
        text: '予想どおり！下振れじゃなかったけど悪くない',
        replies: [
          '「教科書どおり」は反応が読みにくい日',
          '利上げ確率は少し下がる話もあるね',
        ],
      },
      {
        text: 'コアも予想一致。シェルター寄与が大きいとか',
        replies: ['細かい内訳は明日の解説待ち'],
      },
      {
        text: 'これで明日日本株ギャップアップ？',
        replies: [
          '可能性ある。だから追いかけない',
          'ギャップ追っかけ禁止ルール発動',
        ],
      },
      {
        text: 'ドル円どう動いてる？',
        replies: ['CPI後も円安気味の話あり。為替は別管理'],
      },
      { text: '今夜は寝て、明日寄り30分見るだけ' },
    ],
  },
  {
    author: 5,
    postedAt: '2026-08-12T23:25:00+09:00',
    likeSlots: 14,
    title: '就寝前 — CPI後の米国反応、明日の自分へのルール',
    content:
      'CPIは予想一致。米市場はハイテク堅調・原油高でダウはまちまち、のダイジェストも。明日のルール：①寄り30分は見るだけ②ギャップ追っかけ禁止③ストーリー一発買い禁止④サイズは今日と同じ。休場→反発→CPIと続いた週。守り切った人が勝つ。おやすみ。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['メンタル', 'ルール', 'CPI', '米国株'],
    comments: [
      {
        text: '①〜④全部同意。書いてくれてありがとう',
        replies: ['同じルールでいく', 'おやすみ！'],
      },
      {
        text: '原油高は忘れがち。景気敏感は注意',
        replies: ['エネルギー関連は別枠で見る'],
      },
      { text: '明日もこのスレ見ます' },
    ],
  },

  // ——— 8/13 ———
  {
    author: 1,
    postedAt: '2026-08-13T07:10:00+09:00',
    likeSlots: 16,
    title: 'おはよう — CPI予想どおりのあと、寄りはどうする？',
    content:
      '昨夜CPIは予想一致（+3.4％/コア+2.5％）。米ハイテクは相対的に堅調との流れ。今日の寄りはギャップアップしやすい日。自分は①見るだけ②半導体寄与確認（6857等）③追っかけ禁止。投票：朝イチは？①見るだけ②押し目待ち③強気で少し買う。',
    ticker: 'TOPIC',
    sentiment: 'bullish',
    tags: ['おはよう', 'CPI', '寄り', '半導体'],
    comments: [
      {
        text: '①見るだけ。ギャップ日は触らない',
        replies: [
          '正解寄り。私も①',
          '②押し目待ちだけど来ない日もある',
        ],
      },
      {
        text: 'アドテスト強い流れ続く？',
        replies: ['寄与は見る。でもフルベットしない'],
      },
      { text: '積立だけ淡々と。一番強い' },
      {
        text: '③欲しい気持ちある…でも我慢',
        replies: ['その我慢が勝率上げる'],
      },
    ],
  },
  {
    author: 7,
    postedAt: '2026-08-13T08:55:00+09:00',
    likeSlots: 15,
    title: '寄り前チェック — 利上げ観測後退ストーリーに飛びつく？',
    content:
      'CPI後、9月利上げ確率が下がったとの解説も。だからといって「ずっと買い」は短絡。原油・地政学・決算が残る。ルール：ストーリー一発買い禁止・分割のみ・ウォッチリストは更新してOK。みんな寄り前に何チェックした？',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['金利', 'ルール', '寄り前', 'マクロ'],
    comments: [
      {
        text: '先物とドル円だけ見た',
        replies: ['シンプルでいい', '私もそれ'],
      },
      {
        text: 'ストーリー固定しない、大事',
        replies: ['NFP→反発→CPIと続いたから余計に'],
      },
      { text: '半導体ウォッチ更新した。買うのはまた今度' },
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Aug 12–13 threaded posts…`)

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
