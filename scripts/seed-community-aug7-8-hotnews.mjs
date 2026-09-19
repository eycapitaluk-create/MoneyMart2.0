/**
 * Community: Aug 7–8 hot news — Nikkei/SBG/Lasertec, US NFP -23k rally,
 * SpaceX surge, weekend digest (報道ベース). Conversational threads.
 *
 *   node scripts/seed-community-aug7-8-hotnews.mjs
 *   node scripts/seed-community-aug7-8-hotnews.mjs --dry-run
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
    postedAt: '2026-08-07T08:20:00+09:00',
    likeSlots: 16,
    title: '日経続落76円安の6万5606円 — SBG決算消化、前場は一時1000円超安',
    content:
      '7日の日経平均は続落、終値6万5606円（-76円、-0.12％）。前場は下げ幅1000円超・6万5000円割れも後場は戻す。前日SBG決算が材料でAI・半導体に利益確定売り。レーザーテクは今期見通しが市場予想割れで大幅安との報道。一方フジクラなど好材料個別が指数を押し上げ、TOPIXは+0.47％の4074。また「指数と中身のズレ」。報道ベース・分割のみ・追っかけ禁止。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['日経平均', 'ソフトバンクG', '半導体', 'TOPIX'],
    comments: [
      '前場の1000円安は心臓に悪い…',
      'でも大引けは-76円まで戻したんだよね',
      'SBGが重い日は指数だけ見てると判断ミスる',
      'わかる、TOPIXは続伸してるし',
      'レーザーテクはガイダンス嫌気か',
      'フジクラが寄与で支えたって話もあった',
      '私は触らずサイズ確認だけ',
      '週末前だから余計に動かない派',
    ],
  },
  {
    author: 3,
    postedAt: '2026-08-07T10:50:00+09:00',
    likeSlots: 15,
    title: 'レーザーテク大幅安報道 — 今期純利益見通し900億円、市場予想割れ',
    content:
      'レーザーテック(6920)が大幅安との報道。今期（2027年6月期）連結純利益見通し900億円（前期比+16％）は増益だが、市場予想（968億円前後）に届かず嫌気された流れ。前場の日経押し下げ要因にも。装置株は「増益でも予想割れで売られる」典型。個人は決算直後のギャップ追っかけ禁止・サイズ控えめ。東エレク・アドテストも連想で振れやすいのでセットで見る。',
    ticker: '6920.T',
    sentiment: 'bearish',
    tags: ['レーザーテク', '決算', '半導体', '日本'],
    comments: [
      '増益なのに売られるのきついね',
      '期待値が高すぎた典型だと思う',
      '装置株あるある…ガイダンスで振られる',
      '私もギャップ追っかけはしないルール',
      '6857・8035も連想で動いた？',
      '動いた。だからテーマ株はサイズ半分',
      'ウォッチリスト更新だけにした',
      '来週の他社決算も同じパターン注意',
    ],
  },
  {
    author: 0,
    postedAt: '2026-08-07T15:40:00+09:00',
    likeSlots: 14,
    title: 'クロージング — SBG・半導体売りでも値上がり銘柄6割、どう読む？',
    content:
      '大引け時点でプライムは値上がり約6割との報道。日経はマイナスでも中身はまだ物色。原油高・米株安の流れを受けつつ、好決算個別（レゾナック、任天堂など）はしっかりとの解説も。投票：今日のあなたは①SBG/半導体を利確②個別を拾った③完全見送り④来週の米雇用待ち。無理にポジションを増やさない日。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['雑談', '投票', '日本', '決算'],
    comments: [
      '③完全見送り。正解だった気がする',
      '同じく③。数字待ちの日は触らない',
      '①ちょっとだけ半導体サイズ落とした',
      '②任天堂まわりを少額だけ…反省中',
      '④雇用統計で方向が出てから',
      '指数マイナス＝全面安、じゃないよね',
      'うん、それが今週のテーマだった',
      '来週もルール優先で',
    ],
  },
  {
    author: 9,
    postedAt: '2026-08-07T22:20:00+09:00',
    likeSlots: 18,
    title: '米雇用統計ショック — 7月NFP -2.3万人（予想+8万）、株高・金利低下',
    content:
      '米7月非農業部門雇用者数は-2.3万人（市場予想+8万人程度）と予想を大きく下回る減少（報道ベース）。過去分も下方修正の話題。利上げ観測が後退し債券利回り低下、米株は反発。S&Pは高値圏、ナスダック+1％超との報道も。ただし失業率は4.1％付近で低下との指摘もあり「弱い雇用＝即利下げ」とは限らない。日本は週明け為替・先物から。現金比率メモ・サイズいじりは最小限。',
    ticker: 'TOPIC',
    sentiment: 'bullish',
    tags: ['雇用統計', 'NFP', '金利', '米国'],
    comments: [
      '予想+8万で-2.3万はかなり弱い…',
      'だから利上げ観測が後退したんだよね',
      '株高はわかるけど、景気減速材料でもある',
      'そこ！リスクオンと景気懸念が同居',
      'ドル円どう動いたか週明け重要',
      '私はポジ増やさずメモだけ',
      'CPI待ちって声も多いね',
      'わかる、雇用だけで決め打ちしない',
    ],
  },
  {
    author: 8,
    postedAt: '2026-08-07T23:40:00+09:00',
    likeSlots: 16,
    title: '米株反発 — ナスダック+1.3％、NVDA高い、SpaceXは+15％超の報道も',
    content:
      '雇用統計後の米株は反発（報道ベース）。ナスダック総合+1.3％前後、S&Pも高値更新の話題。NVDA+2％超、AVGOなども高い一方、メモリー株は売られたとの解説。SpaceX(SPCX)はロックアップ関連などで+15％超の急騰報道も。個人は急騰銘柄の翌朝ギャップ追っかけ禁止。日本半導体は「米ハイテク高＝全面高」と決めつけない。分割・ウォッチのみ。',
    ticker: 'NVDA',
    sentiment: 'bullish',
    tags: ['NASDAQ', 'NVIDIA', 'SpaceX', '米国'],
    comments: [
      'SpaceX+15％はえぐい…',
      '触らない。急騰の翌日が一番危ない',
      'NVDAは強い材料続きだね',
      'でもメモリーは売られてるって書いてある',
      '選別相場だと思う',
      '日本は週明け8035/6857の寄りだけ見る',
      '追っかけ禁止ルール再確認した',
      'コア積み立ては淡々と',
    ],
  },
  {
    author: 6,
    postedAt: '2026-08-08T09:30:00+09:00',
    likeSlots: 15,
    title: '週末まとめ — 弱い雇用で米株高、日本はSBG消化のあとどうする？',
    content:
      '金曜の整理：①日本は日経小幅安・TOPIX高、SBG/レーザーテクが重い②米NFP予想外の減少で利上げ観測後退・米株高③NVDA強くSpaceX急騰、メモリーは弱い。週明けはドル円と先物の温度感から。自分のルールはイベント明けでも「寄り30分触らない」「テーマ全振りしない」。みんなの週末一言ください。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['週末', '振り返り', '雇用統計', 'メンタル'],
    comments: [
      '弱い雇用＋株高は読みにくい週末…',
      'だから動かないのが正解だと思う',
      'SBGは決算翌日より週明けが本番かも',
      'レーザーテク持ってる人つらそう',
      '私は持ってない。連想で触らない',
      '来週CPIが次の山だよね',
      'うん、雇用だけでストーリー固定しない',
      '良い週末を！ルール表見直す',
    ],
  },
  {
    author: 11,
    postedAt: '2026-08-08T11:15:00+09:00',
    likeSlots: 14,
    title: '投票 — 週明け最初に見るのはどれ？',
    content:
      '①ドル円・米先物②日経寄与（SBG/半導体）③レーザーテクなど決算銘柄の戻り④NVDA連想の東エレク・アドテスト⑤何も見ない・積立だけ。番号で教えてください。無理に新規を増やさない・分割のみ。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['投票', '週明け', '為替', '半導体'],
    comments: [
      '①ドル円から。雇用後は為替が先',
      '②寄与度。SBGが重いと指数だけで誤解する',
      '④連想買いしたくなるのを我慢する用',
      '⑤積立だけ。一番強い',
      '③決算銘柄の戻り待ちは危険かも',
      'わかる、戻り売りもある',
      '私は①→②の順でメモだけ',
      'みんな冷静でえらい',
    ],
  },
  {
    author: 4,
    postedAt: '2026-08-08T14:00:00+09:00',
    likeSlots: 15,
    title: 'メンタルスレ — 「弱い雇用＝買い」で飛びつく前に',
    content:
      'NFP弱い→利上げ後退→株高、の短絡は危険。失業率低下や賃金、原油・地政学、来週のCPIも残る。自分は①ストーリー一発買いは禁止②サイズはイベント前より増やさない③SNSの盛り上がりでルールを曲げない。あなたが今週守れたルール、教えてください。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['メンタル', 'ルール', '雇用統計', 'マクロ'],
    comments: [
      '①守れました。飛びつきそうになった',
      'えらい。私もギリ我慢',
      '②サイズ増やさなかったのが勝ち',
      '③SNS見てるとSpaceX欲しくなる…',
      '触らない勇気もスキルだよね',
      'コア積み立てだけ続けた',
      'それが一番再現性ある',
      '来週も同じルールで',
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

async function main() {
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Aug 7–8 hot-news posts…`)

  const personaMap = new Map()
  for (const persona of PERSONAS) {
    personaMap.set(persona.email, await ensurePersona(persona))
  }

  let posts = 0
  let comments = 0

  for (const row of POSTS) {
    const persona = PERSONAS[row.author]
    const mapped = personaMap.get(persona.email)
    if (!mapped) continue

    const commentTexts = row.comments || []
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
      comment_count: commentTexts.length,
      bookmark_count: Math.floor(likeSlots / 3),
      view_count: 0,
      hot_score: likeSlots * 2 + commentTexts.length * 3 + 55,
      status: 'published',
      created_at: new Date(row.postedAt).toISOString(),
      updated_at: new Date(row.postedAt).toISOString(),
    }

    if (DRY_RUN) {
      console.log(`[dry-run] ${mapped.nickname}: ${row.title}`)
      posts += 1
      comments += commentTexts.length
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
      const likeAt = new Date(new Date(row.postedAt).getTime() + (li + 1) * 6 * 60 * 1000).toISOString()
      const { error: lErr } = await admin.from('lounge_post_likes').insert({
        post_id: post.id,
        user_id: likerMapped.userId,
        created_at: likeAt,
      })
      if (lErr) console.error('like insert failed:', lErr.message)
    }

    let commentRows = 0
    for (let c = 0; c < commentTexts.length; c += 1) {
      let commentPersona = PERSONAS[(row.author + c + 2) % PERSONAS.length]
      let commentMapped = personaMap.get(commentPersona.email)
      if (commentMapped?.userId === mapped.userId) {
        commentPersona = PERSONAS[(row.author + c + 3) % PERSONAS.length]
        commentMapped = personaMap.get(commentPersona.email)
      }
      if (!commentMapped?.userId) continue
      const commentAt = new Date(new Date(row.postedAt).getTime() + (c + 1) * 9 * 60 * 1000).toISOString()
      const { error: cErr } = await admin.from('lounge_comments').insert({
        post_id: post.id,
        author_id: commentMapped.userId,
        author_name: commentMapped.nickname,
        content: commentTexts[c],
        status: 'published',
        created_at: commentAt,
        updated_at: commentAt,
      })
      if (cErr) console.error('comment insert failed:', cErr.message)
      else commentRows += 1
    }

    const { count: likeRows } = await admin.from('lounge_post_likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id)
    await admin.from('lounge_posts').update({
      like_count: likeRows ?? likeSlots,
      comment_count: commentRows,
      hot_score: (likeRows ?? likeSlots) * 2 + commentRows * 3 + 55,
    }).eq('id', post.id)

    comments += commentRows
    posts += 1
    console.log(`posted: ${mapped.nickname} — ${row.title.slice(0, 52)}…`)
  }

  console.log(`Done. ${posts} posts, ${comments} comments.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
