/**
 * Community: Aug 20 (Thu) rest of session + Aug 21 (Fri) morning.
 * Times only up to current JST (~07:08). No future / no 寄り posts for Aug 21.
 *
 *   node scripts/seed-community-aug21-hotnews.mjs
 *   node scripts/seed-community-aug21-hotnews.mjs --dry-run
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
    author: 3,
    postedAt: '2026-08-20T10:48:00+09:00',
    likeSlots: 17,
    title: 'モデルナ — mRNAがんワクチン、後期治験で初の有効性',
    content:
      '米モデルナとメルクが19日、個別化mRNAがんワクチン（インティスメラン／V940）＋キイトルーダ併用の第3相（INTerpath-001）で、切除済みIIB〜IV期メラノーマの無再発生存と遠隔転移のない生存を達成と発表（報道）。mRNAがんワクチンの後期治験で統計的優位が出たのは初めて、との解説。MRNAは19日終値174.38ドル（+177％、出来高は3カ月平均の約18倍）、メルクも約12.6％高の152.20ドル。承認は2027年目標で当局と協議中との話。ハザード比など詳細数値は未公表。日本は中外・第一三共が相対的に買われたが、米材料の連想買いを追いかけてサイズは増やさない。',
    ticker: 'MRNA',
    sentiment: 'bullish',
    tags: ['モデルナ', 'mRNA', '医薬品', 'メルク'],
    comments: [
      {
        text: '177％は異常値。材料は本物でも今日追う値段じゃない',
        replies: ['空売り買い戻しも乗ってるとの解説', '詳細数字が出るまで見送り'],
      },
      {
        text: '中外・第一三共の連想は分かる。でもテーマ全振り禁止',
        replies: ['キイトルーダ＝メルク。日本株で取りにいくのは2日遅れ'],
      },
      { text: '積立は淡々と。個別バイオは触らない' },
    ],
  },
  {
    author: 6,
    postedAt: '2026-08-20T11:48:00+09:00',
    likeSlots: 16,
    title: '前引け — 656円高の6万5982円、3日ぶり反発継続',
    content:
      '前引けは+656円07銭の6万5982円49銭、TOPIXは+36.41の4048.72（報道）。出来高概算10.7億株。プライムは値上がり約73％。9984・9983・285Aが押し上げ、8035など装置はまだ重い。金利低下の買い戻し＋KOSPI高。後場もサイズ維持。ナイフで上を追わない。',
    ticker: 'TOPIC',
    sentiment: 'bullish',
    tags: ['前引け', '日経平均', '買い戻し', 'ソフトバンクG'],
    comments: [
      {
        text: '66000回復は想定内。追いかけない',
        replies: ['2日で3900円下げた反動', '半導体装置がついてこない日は中身確認'],
      },
      { text: '医薬品は相対的に強い。モデルナ連想は見送り' },
      { text: 'ランチ後に増やさない' },
    ],
  },
  {
    author: 8,
    postedAt: '2026-08-20T13:58:00+09:00',
    likeSlots: 15,
    title: '後場 — 845円高、KOSPI高が支え。戻りは限定的？',
    content:
      '13時50分時点は+845円前後（報道）。プラス寄与は9984・9983・285A。マイナスは8035・4062・6971。輸送用機器・医薬品・電力が強く、鉄鋼・銀行は弱い歪み。KOSPI大幅高が支援との解説。一方「3900円下げたあとの戻りとしては限定的」との見方も。自分はサイズ維持。',
    ticker: '9984.T',
    sentiment: 'neutral',
    tags: ['後場', 'ソフトバンクG', 'KOSPI', '様子見'],
    comments: [
      {
        text: '戻ったから買い、は禁止。昨日の反省',
        replies: ['正しい。ウォッチ更新だけ'],
      },
      { text: '銀行安＝金利低下の裏。指数と中身を分ける' },
      { text: '大引けまで見るだけ' },
    ],
  },
  {
    author: 7,
    postedAt: '2026-08-20T15:16:00+09:00',
    likeSlots: 17,
    title: '大引け確定 — 890円高の6万6216円、3日ぶり反発',
    content:
      '確定終値は+890円37銭（+1.36％）の6万6216円79銭。TOPIXは+47.42（+1.18％）の4059.73（報道）。プライム値上がり1320・値下がり204（約85％高）。プラス寄与上位は9984・9983・6857・285A・6098で約430円押し上げ。マイナス上位は8035など装置。上昇29業種。グロース250は+34.70の776.98、4％超高。教訓：続落2日の翌日は戻しやすいが、サイズを増やす日ではない。積立は淡々と。今晩は米ウォルマート決算と金利。',
    ticker: 'TOPIC',
    sentiment: 'bullish',
    tags: ['大引け', '日経平均', '反発', 'TOPIX'],
    comments: [
      {
        text: '15時スレとほぼ同じ。確定は890円高',
        replies: ['66000回復。中身は自動車・医薬・電力', '装置はまだ重い。指数だけで強気にしない'],
      },
      {
        text: '285Aは買い戻し。昨日の12％安を一日で取りにいかない判断は正しかった',
        replies: ['だから一括ナンピン禁止は継続'],
      },
      { text: '米時間のWMTと金利を見る。決め打ちしない' },
    ],
  },
  {
    author: 10,
    postedAt: '2026-08-20T19:22:00+09:00',
    likeSlots: 14,
    title: 'ナイト — 今晩はWMTと金利。モデルナは見送り',
    content:
      '日中で十分戻した。今晩の米はウォルマート決算、新規失業保険、フィリー連銀（報道）。モデルナは19日に+177％した翌日。バイオの翌日は利益確定が出やすい。自分は触らない。原油と中東も残ってる。投票：米時間は？①見るだけ②ヘルスケア分割③強気で拾う。',
    ticker: 'MRNA',
    sentiment: 'neutral',
    tags: ['ナイト', 'ウォルマート', 'モデルナ', '様子見'],
    comments: [
      {
        text: '①一択。177％の翌日を取りにいかない',
        replies: ['正しい。ナイトは見送り'],
      },
      { text: 'WMTが崩れるなら小売全体が重い。日本の内需連想もしない' },
      { text: '積立設定だけ確認して寝る' },
    ],
  },
  {
    author: 0,
    postedAt: '2026-08-21T07:02:00+09:00',
    likeSlots: 8,
    title: '金曜おはよう — 米は大幅反落、WMT急落。モデルナも利確',
    content:
      '前日米：ダウ-704ドルの5万2759ドル、ナスダック-264の2万6067、S&Pは7641（報道）。ウォルマートは国内売上伸びが6年ぶり低水準で-9.15％の103.84ドル。金利は再上昇、WTIは+2.08の86.47ドル。ドル円NYは159.09円。モデルナは+177％の翌日、-23.55％の133.32ドルまで利確。材料は残っても値段は別。自分のルールは①ギャップ追っかけ禁止②半導体フルベットしない③日本バイオの連想買いをしない④積立は淡々と。',
    ticker: 'MRNA',
    sentiment: 'bearish',
    tags: ['金曜', 'ダウ', 'ウォルマート', 'モデルナ'],
    comments: [
      {
        text: 'バイバック翌日に金利が戻る日は嫌な匂い',
        replies: ['WMTは消費の話。ストーリー固定しない'],
      },
      { text: 'モデルナは材料買いの翌日に半値戻し。典型' },
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Aug 20 close + Aug 21 morning posts…`)

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
