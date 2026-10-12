/**
 * Community: Aug 19 (Wed) session through close + Aug 20 (Thu) morning.
 * Times only up to current JST (~10:24). No future / no 前引け posts for Aug 20.
 *
 *   node scripts/seed-community-aug20-hotnews.mjs
 *   node scripts/seed-community-aug20-hotnews.mjs --dry-run
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
    author: 11,
    postedAt: '2026-08-19T09:16:00+09:00',
    likeSlots: 16,
    title: '寄り — 648円安の6万6812円、先物主導で弱い',
    content:
      '寄りは-648円の6万6812円27銭（報道）。米ハイテク安＋長期金利。値がさ半導体・電子部品に売り先行。9時18分には一時-2134円の6万5327円まで、取引時間中として6営業日ぶりに6万6000円割れとの数字も。ドル円は159円30銭台。ギャップを追わない。サイズ維持。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['寄り', '日経平均', '半導体', '続落'],
    comments: [
      {
        text: '朝から66000割れは想定より速い',
        replies: ['ナイトで十分下げてた。追わない', '先物だけ見て飛びつかない'],
      },
      {
        text: '全面安の匂い。個別の押し目に見えない',
        replies: ['寄与銘柄依存の下げでも広がりやすい日'],
      },
      { text: '①見るだけ。寄り30分は触らない' },
    ],
  },
  {
    author: 8,
    postedAt: '2026-08-19T10:22:00+09:00',
    likeSlots: 16,
    title: '前場 — SOX追随、AI・半導体が指数を溶かす',
    content:
      '前日SOXは5％近い急落（報道）。東京は285A・9984・8035・5803が指数を押す。売りは半導体だけでなく銀行・機械・非鉄にも波及。KOSPIも弱いとの解説。中東不透明＋金利上昇は「ストーリー固定しない」。今日はナイフキャッチ禁止。',
    ticker: '285A.T',
    sentiment: 'bearish',
    tags: ['キオクシア', '半導体', 'SOX', '前場'],
    comments: [
      {
        text: '285Aはサンディスク連想で売られてる？',
        replies: ['SOX翌日の値がさは罠', 'テーマ全振りしない'],
      },
      {
        text: '9984も重い。AI逆風＋社債観測の話も',
        replies: ['材料確認しても今日は追わない'],
      },
      { text: 'ナンピンしたくなるけど禁止' },
    ],
  },
  {
    author: 3,
    postedAt: '2026-08-19T11:48:00+09:00',
    likeSlots: 17,
    title: '前引け — 1736円安の6万5724円、SBGが約378円押し下げ',
    content:
      '前引けは-1736円48銭の6万5724円25銭、TOPIXは-112.87の4027.35（報道）。出来高概算11.8億株。プライムは値下がり1282・値上がり240で8割超安。9984が約378円分、8035が約175円分、285Aが約120円分押し下げ。医薬品と海運は相対的に強い歪み。後場のナイフ禁止。',
    ticker: '9984.T',
    sentiment: 'bearish',
    tags: ['前引け', 'ソフトバンクG', '寄与度', '全面安'],
    comments: [
      {
        text: '1銘柄で378円押し下げはエグい',
        replies: ['8035と285Aセットで指数が溶ける', '寄与度の罠、今日は分かりやすい'],
      },
      {
        text: '33業種ほぼ全滅。指数より中身が悪い',
        replies: ['高配当も金利で重い日', 'ランチ後に拾う人、やめて'],
      },
      { text: '積立は淡々と。個別は触らない' },
    ],
  },
  {
    author: 6,
    postedAt: '2026-08-19T13:12:00+09:00',
    likeSlots: 15,
    title: '後場寄り — 1645円安、25日線攻防でも拾わない',
    content:
      '後場寄りは-1645円の6万5816円付近、前引けからやや下げ縮小（報道）。先物は昼休み65670-65890円のもみ合い。25日線や75日線が下値メドとの見方もあるが、決め打ちしない。KOSPI大幅安が重し。セクターは医薬品・海運だけ相対的。サイズ維持。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['後場', '日経平均', '先物', '様子見'],
    comments: [
      {
        text: '25日線で拾う話は話。今日のサイズは維持',
        replies: ['同感。テクニカル根拠のナンピン禁止', '後場に増やさない'],
      },
      { text: 'アジアも弱い。単独で戻すイメージない' },
      { text: '①見るだけ。大引けまで待つ' },
    ],
  },
  {
    author: 9,
    postedAt: '2026-08-19T14:02:00+09:00',
    likeSlots: 16,
    title: '後場 — 13時52分に安値6万5134円、-2326円',
    content:
      '13時52分に-2326円の6万5134円まで、この日の安値更新（報道）。寄り後に一度持ち直しても、後場後半で一段安。買い戻しが入らない。自分のルール：①ナンピンしない②後場に新規増やさない③大引けまでサイズ維持。みんなどうする？',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['後場', '安値', 'メンタル', 'ルール'],
    comments: [
      {
        text: '①守れそう。午前で十分見た',
        replies: ['正しい', '触ると負ける気がする'],
      },
      {
        text: '2日連続の4桁安はきつい。積立だけ続ける',
        replies: ['それが仕事'],
      },
      { text: '大引けスレでまた会おう' },
    ],
  },
  {
    author: 7,
    postedAt: '2026-08-19T15:14:00+09:00',
    likeSlots: 17,
    title: '大引け確定 — 2134円安の6万5326円、2週ぶり66000割れ',
    content:
      '確定終値は-2134円31銭（-3.16％）の6万5326円42銭。TOPIXは-127.91（-3.09％）の4012.31（報道）。安値圏で着地、終盤の買い戻しは限定的。プライム値下がり1155・値上がり362（74％安）。マイナス寄与上位は9984・6857・8035・285A・5803で約1145円押し下げ。上昇業種は医薬品・海運の2業種のみ。2日で約3900円安。教訓：続落2日目にサイズを増やさない。積立は淡々と。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['大引け', '日経平均', '半導体', 'TOPIX'],
    comments: [
      {
        text: '15時スレの安値圏とほぼ同じ。確定は2134円安',
        replies: ['指数より中身。広範なセクター売り', '66000割れは節目の話。明日の材料は米国'],
      },
      {
        text: '285Aは12％超安。値がさの翌日はこうなる',
        replies: ['だから一括ナンピン禁止'],
      },
      { text: '米時間の金利とSOXを見る。決め打ちしない' },
    ],
  },
  {
    author: 10,
    postedAt: '2026-08-19T22:12:00+09:00',
    likeSlots: 14,
    title: 'ナイト — 先物は急反発、22時に6万6730円',
    content:
      '22時時点の大阪日経225先物（9月限）は前日比+1250円の6万6730円、現物終値6万5326円に対して約1404円高（報道）。米財務省が長期国債の買い戻し増額、金利低下が支えとの解説。自分は触らない。ダウが戻ってもSOXが弱い日は翌日の半導体に注意。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['先物', 'ナイト', '金利', '様子見'],
    comments: [
      {
        text: '日中で十分下げた。ナイトの急騰は見送り',
        replies: ['正しい。ギャップ埋めを追わない'],
      },
      { text: '金利低下はプラス。でもSOX次第' },
      { text: '積立設定だけ確認して寝る' },
    ],
  },
  {
    author: 0,
    postedAt: '2026-08-20T07:18:00+09:00',
    likeSlots: 16,
    title: '木曜おはよう — 米は金利低下で反発、SOXはまだ重い',
    content:
      '前日米：ダウ+120ドル前後の5万3463ドル、ナスダック+41の2万6331、S&Pも反発（報道）。米財務省の長期国債買い戻し増額が金利低下を誘った。一方SOXは続落。OpenAIの4-6月売上67億ドルがAnthropic（116億ドル）に届かずとの報道がAI株の重し、との解説も。FOMC議事要旨ではインフレ鈍化しない場合の利上げ指摘。原油は高止まり。自分のルールは①ギャップ追っかけ禁止②半導体フルベットしない③積立は淡々と。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['木曜', 'ダウ', '金利', 'SOX'],
    comments: [
      {
        text: '指数は戻した。中身はSOX。半導体は慎重',
        replies: ['6857/8035追いかけない', '金利とAIを分けて見る日'],
      },
      {
        text: '2日で3900円下げた反動は出やすい。でもサイズは維持',
        replies: ['自律反発を「底」としない'],
      },
      { text: '積立は淡々と。今日の正解はそれ' },
    ],
  },
  {
    author: 5,
    postedAt: '2026-08-20T08:12:00+09:00',
    likeSlots: 15,
    title: '先物メモ — シカゴ6万5965円、円は158円台',
    content:
      '20日4時台のシカゴ日経先物は大阪日中比+485円の6万5965円前後（報道）。ナイト22時の6万6730円からは縮んだ。ドル円は158円20銭台と、昨日午後から1円ほど円高。海外勢は9-15日に国内株を3週ぶり買い越し6212億円、7月貿易赤字は6345億円（予想6690億円）との数字も。投票：寄り後は？①見るだけ②押し目分割③強気で拾う。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['先物', '寄り前', 'ドル円', '様子見'],
    comments: [
      {
        text: '①一択。ナイト高値はもうない',
        replies: ['同感。ウォッチ更新だけ', '円高も輸出の重し'],
      },
      {
        text: '買い越しは先週の話。今日の材料にしない',
        replies: ['データはデータ。サイズは維持'],
      },
      { text: '③欲しい気持ちある…我慢' },
    ],
  },
  {
    author: 2,
    postedAt: '2026-08-20T08:44:00+09:00',
    likeSlots: 15,
    title: '寄り前 — 連日急落の反動で拾う？まだ見送り',
    content:
      '18・19日で4桁安が続いた反動は出やすい、との見方。ただしSOX続落・円高・原油高止まり。6857/8035/285A/9984は寄与が大きいから指数ごと振られやすい。チェック：①先物②ドル円158円台③半導体ギャップ④触らない。押し目に見える日ほどナイフ。自分はサイズ維持。',
    ticker: '6857.T',
    sentiment: 'neutral',
    tags: ['半導体', '寄り前', 'アドバンテスト', 'キオクシア'],
    comments: [
      {
        text: '押し目に見える日ほど危ない',
        replies: ['連想買い禁止', '285Aの12％安を一日で取りにいかない'],
      },
      { text: '9984も見るけど追わない。AIと金利は別物' },
    ],
  },
  {
    author: 4,
    postedAt: '2026-08-20T09:18:00+09:00',
    likeSlots: 16,
    title: '寄り — 406円高の6万5733円、3日ぶり反発スタート',
    content:
      '寄りは+406円の6万5733円、TOPIXは+22の4034付近（報道）。米株高＋金利低下の流れ。自動車・不動産・電力が相対的に強く、銀行・海運は弱いとの解説。半導体はまだ重い（8035など）。9時15分には+646円の6万5973円まで切り返す場面も。ギャップを追わない。自律反発の初日は見るだけ。',
    ticker: 'TOPIC',
    sentiment: 'bullish',
    tags: ['寄り', '日経平均', '反発', '金利'],
    comments: [
      {
        text: '3日ぶり反発は想定内。追いかけない',
        replies: ['だから見送り', '3900円下げた翌日ほどダマシが出やすい'],
      },
      {
        text: '指数は戻しても半導体が重いなら中身確認',
        replies: ['TOPIXと日経を分けて見る日'],
      },
      { text: '先物だけ見て飛びつかない' },
    ],
  },
  {
    author: 1,
    postedAt: '2026-08-20T10:08:00+09:00',
    likeSlots: 8,
    title: '前場 — 一時6万6325円、9984が押し上げ',
    content:
      '10時前後は一時6万6325円付近まで、その後は上げ一服で6万6000円台（報道）。9984が指数を押し上げ、285Aも買い戻し。一方8035はまだ弱い。金利低下のリバウンドでもSOX翌日の半導体はまちまち。自分はサイズ維持、新規増やさない。積立は淡々と。',
    ticker: '9984.T',
    sentiment: 'neutral',
    tags: ['前場', 'ソフトバンクG', 'リバウンド', '様子見'],
    comments: [
      {
        text: '戻ったから買い、は昨日の反省と矛盾する',
        replies: ['正しい。ウォッチ更新だけ'],
      },
      { text: '8035がついてこないなら指数の中身注意' },
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Aug 19 session + Aug 20 morning posts…`)

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
