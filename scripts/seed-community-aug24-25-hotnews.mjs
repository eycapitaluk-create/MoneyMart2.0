/**
 * Community: Mon Aug 24 Tokyo session + Tue Aug 25 morning (to ~07:30 JST).
 * Nikkei OHLC: official 日経平均プロフィル. US prints: Marketstack. Index closes: AP/Yahoo.
 * Skip ~13:08 (existing real user post). No 寄り on Tuesday morning (pre-open).
 *
 *   node scripts/seed-community-aug24-25-hotnews.mjs
 *   node scripts/seed-community-aug24-25-hotnews.mjs --dry-run
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
    postedAt: '2026-08-24T09:12:00+09:00',
    likeSlots: 17,
    title: '寄り — 始値6万5978円、朝方は200円高も半導体が重い',
    content:
      '週明け寄り。公式四本値の始値は6万5978円95銭。報道では25日線（6万5600円）付近で押し目買い、朝方200円あまり高も。高値は6万6257円73銭まで。金利上昇と韓国株安でAI・半導体が先行売り。①寄り30分は触らない。サイズ維持。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['寄り', '日経平均', '半導体', '週明け'],
    comments: [
      {
        text: '高値66257は誰かが売った証拠。追わない',
        replies: ['25日線の押し目も後追いしない', '半導体フルベット禁止'],
      },
      { text: '金曜米は堅調でも日本は金利と韓国が重荷。連想で買わない' },
      {
        text: '①守る。ギャップ埋めを取りにいかない',
        replies: ['同じ。現金はいじらない'],
      },
      { text: '積立設定は触らない' },
    ],
  },
  {
    author: 8,
    postedAt: '2026-08-24T10:26:00+09:00',
    likeSlots: 16,
    title: '前場 — 指数はもみ合い。寄与度の大きい半導体が重し',
    content:
      '前場。報道どおり指数寄与度の大きいAI・半導体が重し。日経は続落スタートから、押し目買いで上げる場面もあったが続かない型。個別の押し目に見えない。アドバンテスト・ソフトバンクGは寄与度下位の中心（報道）。セット買いはしない。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['前場', '半導体', '6857', '9984'],
    comments: [
      {
        text: '6857が強くても今日はセット禁止',
        replies: ['指数寄与度の売り日は後追いしない', '285Aも同じ'],
      },
      { text: 'プライムは半数以上が高い報道。指数と中身が違う' },
      { text: 'ファストリ連想で内需を売らない' },
    ],
  },
  {
    author: 7,
    postedAt: '2026-08-24T11:38:00+09:00',
    likeSlots: 15,
    title: '前引け — 上げが続かず。様子見が強い',
    content:
      '前引け。高値6万6257円から押し戻されている。決算が総じて好調との報道はあったが、指数は半導体が相殺。NVDA決算とジャクソンホールを控えて様子見、という説明で十分。前場の陰線を昼に取りにいかない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['前引け', '様子見', '日経平均'],
    comments: [
      {
        text: 'イベント前の前引けにサイズを足さない',
        replies: ['それがルール', '昼は見るだけ'],
      },
      { text: 'TOPIXが強い日は日経だけで弱気に振らない。まだ大引け' },
      { text: 'ランチは注文しない' },
    ],
  },
  {
    author: 4,
    postedAt: '2026-08-24T12:22:00+09:00',
    likeSlots: 14,
    title: 'ランチ — 数字はまだ確定してない。触らない',
    content:
      '昼休み。四本値の安値・終値はまだ後場。朝の高値だけ見て「戻した」としない。金利と韓国株は材料として消化中。コアETFも日本株も、ランチにスポットしない。①見るだけ。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['ランチ', '様子見', 'リスク管理'],
    comments: [
      { text: '昼の板で結論を出さない', replies: ['後場の500円安を想像して売らない'] },
      { text: '積立勢は今日も淡々と。イベントはニュースだけ' },
      { text: '個別の押し目は午後以降も追わない' },
    ],
  },
  {
    author: 2,
    postedAt: '2026-08-24T13:48:00+09:00',
    likeSlots: 16,
    title: '後場 — 下げ幅一時500円超。安値圏で推移',
    content:
      '後場。報道では下げ幅が一時500円を超えた。公式安値は6万5470円95銭。押し目買いは朝で一巡、後場は様子見が強い。半導体メモリーと値がさの売りが指数を溶かす型。安値拾いはしない。サイズ維持。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['後場', '日経平均', '半導体', '続落'],
    comments: [
      {
        text: '500円超安は想定内。ギャップを追わない',
        replies: ['安値65470で逆張りしない', '寄与度売りは一日では終わらない'],
      },
      { text: 'サービス・建設が強い報道でも指数のヘッジにしない' },
      { text: '大引けまで新規禁止でいい' },
    ],
  },
  {
    author: 7,
    postedAt: '2026-08-24T15:22:00+09:00',
    likeSlots: 18,
    title: '大引け確定 — 488円安の6万5528円、TOPIXは続伸',
    content:
      '大引け確定。日経平均は488円27銭安の6万5528円09銭（公式）。高値66257.73、安値65470.95、始値65978.95。2営業日続落。TOPIXは+6.00の4073.29、JPXプライム150は報道+4.18の1700.69。指数安でも中身は半数以上が高い日（報道）。出来高概算18億8200万株（報道）。①確定後も追いかけない。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['大引け', '日経平均', 'TOPIX', '続落'],
    comments: [
      {
        text: '日経安TOPIX高。弱いとだけ読むと負ける',
        replies: ['金曜も似たねじれだった', '寄与度の値がさが溶かす型'],
      },
      { text: '65528で「安い」と判断してスポットしない' },
      {
        text: '2日続落でも積立は止めない',
        replies: ['コアは別。個別は見送り'],
      },
      { text: '寄与度下位は報道どおりアドバンテとSBGが中心' },
    ],
  },
  {
    author: 3,
    postedAt: '2026-08-24T16:18:00+09:00',
    likeSlots: 15,
    title: '寄与度 — アドバンテとSBGで約563円押し下げ（報道）',
    content:
      '大引け寄与度（報道）。下位はアドバンテスト、ソフトバンクG、キオクシア、ファストリ、フジクラ。2銘柄で約563円押し下げとの指摘。上位は東エレク、リクルート、豊田通商、日立建機、住友金属鉱山。指数を半導体セットで買い戻さない。個別の終値は自分で板を見てから。ここでは値段を憶測しない。',
    ticker: '6857.T',
    sentiment: 'bearish',
    tags: ['寄与度', '6857', '9984', '285A'],
    comments: [
      {
        text: '563円押し下げを「翌日の買い」にしない',
        replies: ['セット買いは禁止継続', 'ファストリも連想売りを追わない'],
      },
      { text: '東エレクが上位でも今日のヘッジにしない' },
      { text: 'キオクシアはテーマ一括禁止' },
    ],
  },
  {
    author: 0,
    postedAt: '2026-08-24T17:44:00+09:00',
    likeSlots: 14,
    title: '夕 — イベント前。コアは据え置き、個別は見送り',
    content:
      '夕方。今週はNVDA決算とジャクソンホールを控える、という報道で十分。結果は出ていないので予想しない。今日の日本は日経65528.09。コアのVTIはまだ月曜米が終わっていない。積立は淡々と。個別の押し目は今夜の米を見てからも急がない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['夕', '積立', 'イベント', '様子見'],
    comments: [
      { text: '決算前に半導体を足さない', replies: ['それが上限', 'コアETFも今夜スポットしない'] },
      { text: '65528を「週の安値」と決めない' },
      { text: '夜は米終値までアプリを閉じてもいい' },
    ],
  },
  {
    author: 8,
    postedAt: '2026-08-25T05:48:00+09:00',
    likeSlots: 17,
    title: '米終値 — S&P 7652.86、ダウは高、ナスダックは安',
    content:
      '月曜米クローズ（報道・Yahoo）。S&P500は-21.51の7652.86（金7674.37）。ダウは+140.15の5万3417.16。ナスダックは-200.26の2万5980.19。半導体安でナスダックが弱い混合。Marketstack：NVDA 214.72→208.48、QQQ 713.44→706.32、VTI 378.24→377.07、AAPL 309.35→310.34、MSFT 483.24→487.31。個別はNVDA、コアは小動き。火曜寄りまでサイズ維持。',
    ticker: 'NVDA',
    sentiment: 'bearish',
    tags: ['米終値', 'NVDA', 'QQQ', 'S&P500'],
    comments: [
      {
        text: 'ダウ高ナスダック安。指数一本で判断しない',
        replies: ['NVDAの陰線でVTIを売らない', 'QQQはサテライト'],
      },
      { text: '208.48は往復の途中。決算前に触らない' },
      { text: 'VTIは1ドル弱。ノイズ' },
      {
        text: 'AAPLとMSFTはプラス。半導体と分けて見る',
        replies: ['同じ'],
      },
    ],
  },
  {
    author: 2,
    postedAt: '2026-08-25T06:32:00+09:00',
    likeSlots: 15,
    title: 'NVDA 208.48 / QQQ 706.32 — 決算前は見送り',
    content:
      'NVDAは金214.72から月208.48。安値207.25まで（Marketstack）。QQQは706.32。半導体が指数を押した一日。決算発表前に枚数を戻さない。日本の6857をADRで埋めない。火曜の寄り30分も触らない。',
    ticker: 'NVDA',
    sentiment: 'bearish',
    tags: ['NVDA', 'QQQ', '半導体', '決算'],
    comments: [
      { text: '207.25の逆張りは禁止', replies: ['イベントまで現金', '日本株のセットも禁止'] },
      { text: 'QQQをVTIの代わりに厚くしない' },
      { text: '今日の日本は米ナスダック安を織り込む想定でサイズ維持' },
    ],
  },
  {
    author: 4,
    postedAt: '2026-08-25T07:16:00+09:00',
    likeSlots: 16,
    title: '火曜おはよう — 寄りまで触らない。数字は月曜まで',
    content:
      '7時台。東京はまだ寄り前。昨日の日本は日経65528.09（-488円）。米はS&P7652.86、NVDA208.48。ルール：①寄り30分新規禁止②半導体セット禁止③コアETFを陰線で売らない④積立淡々と。予想は書かない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['火曜', '寄り前', 'ルール', '日経平均'],
    comments: [
      {
        text: '①＋④。ギャップを取りにいかない',
        replies: ['完全に見るだけ', '積立はいじらない'],
      },
      { text: '65528を「安い」と朝イチで買わない' },
      { text: 'NVDA決算まで個別は上限ゼロでいい' },
      { text: '番号だけ残す。今日も淡々と' },
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Aug 24 session + Aug 25 morning posts…`)

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
