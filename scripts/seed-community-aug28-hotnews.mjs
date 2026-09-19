/**
 * Community: Wed Aug 26 Tokyo session + US NVDA earnings + Thu Aug 27 session + Fri Aug 28 morning (~08:32 JST).
 * JP/US prints: Marketstack (2026-08-26, 2026-08-27). Skip ~13:56 Thu (existing real user post).
 *
 *   node scripts/seed-community-aug28-hotnews.mjs
 *   node scripts/seed-community-aug28-hotnews.mjs --dry-run
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
  // ── Wed Aug 26 Tokyo session (NVDA決算前日) ──
  {
    author: 3,
    postedAt: '2026-08-26T09:12:00+09:00',
    likeSlots: 17,
    title: '水曜寄り — 始値65195円、NVDA決算前に半導体は様子見',
    content:
      '水曜寄り。日経平均始値65195.26円（Marketstack）。6857アドバンテ33650円、9984ソフトバンクG5138円は寄りから方向感なし。今夜のNVDA決算と金曜ジャクソンホール前。①寄り30分は触らない。サイズ維持。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['寄り', 'NVDA', '半導体', '6857'],
    comments: [
      { text: '65195で追いかけ禁止。決算前は上限ゼロ', replies: ['6857セット買いも禁止', '9984も同じ'] },
      { text: '月曜65528からの戻りを連想で買わない' },
      { text: '1306 TOPIX ETFは428.2。日経よりTOPIXが強い型' },
    ],
  },
  {
    author: 10,
    postedAt: '2026-08-26T10:28:00+09:00',
    likeSlots: 16,
    title: '前場 — 6857が35910円まで試すも決算前は追わない',
    content:
      '前場。6857は高値35910円まで回復、9984も5235円高値。日経は65904.24円高値を付けたが、NVDA決算前に半導体を厚くしない。安値64609.47円圏までの値動きは材料として認識するだけ。個別の押し目は追わない。',
    ticker: '6857.T',
    sentiment: 'neutral',
    tags: ['前場', '6857', '9984', 'NVDA'],
    comments: [
      { text: '35910で決算前に枚数を戻さない', replies: ['高値更新＝買い、と決めない', '285Aも同じ'] },
      { text: '64609安値で逆張り禁止' },
      { text: '7203トヨタ3070円は内需側。セット買いしない' },
    ],
  },
  {
    author: 1,
    postedAt: '2026-08-26T11:40:00+09:00',
    likeSlots: 15,
    title: '前引け — 今夜NVDA決算。前引けにサイズを足さない',
    content:
      '前引け。指数は65904円高値圏から押し戻し。今夜のNVDA決算が最大イベント。VIX15.21と低ボラだが決算で一晩で動く。前引けに6857・9984を足さない。昼休みも注文しない。',
    ticker: 'NVDA',
    sentiment: 'neutral',
    tags: ['前引け', 'NVDA', '決算', 'VIX'],
    comments: [
      { text: 'VIX15台で油断しない', replies: ['決算後に動く。前に行かない', '現金維持'] },
      { text: '昼は見るだけ。後場の500円安を想像して売らない' },
      { text: '積立設定は触らない' },
    ],
  },
  {
    author: 6,
    postedAt: '2026-08-26T12:18:00+09:00',
    likeSlots: 14,
    title: 'ランチ — 四本値はまだ後場。触らない',
    content:
      '昼休み。終値はまだ後場。朝の65904円高値だけ見て「戻した」としない。6857終値35700、9984終値5163は確定前。コアETFも日本株も、ランチにスポットしない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['ランチ', '様子見', 'NVDA'],
    comments: [
      { text: '昼の板で結論を出さない', replies: ['後場まで見るだけ'] },
      { text: '決算前にVTI378.23を厚くしない' },
      { text: '積立勢は今日も淡々と' },
    ],
  },
  {
    author: 8,
    postedAt: '2026-08-26T13:54:00+09:00',
    likeSlots: 16,
    title: '後場 — 決算前の様子見。安値64609円圏を意識',
    content:
      '後場。日経は64609.47円安値圏まで試した後、引き上げ。685735700円、99845163円で引け間近。決算前のポジション整理が中心。安値拾いはしない。大引けまで新規禁止。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['後場', '日経平均', '半導体', '決算前'],
    comments: [
      { text: '64609で逆張り禁止', replies: ['決算前は上限ゼロ', '大引けまで見送り'] },
      { text: '685735700を「安い」と決めない' },
      { text: 'SBG5163もセット買い禁止' },
    ],
  },
  {
    author: 7,
    postedAt: '2026-08-26T15:16:00+09:00',
    likeSlots: 18,
    title: '大引け — 65856円、NVDA決算前に328円戻し',
    content:
      '大引け確定。日経平均65856.43円（高65904.24、安64609.47、始65195.26）。前日65528.09から328円戻し。6857終値35700、9984終値5163、7203終値3070、1306終値428.2。今夜NVDA決算。①確定後も追いかけない。',
    ticker: 'TOPIC',
    sentiment: 'bullish',
    tags: ['大引け', '日経平均', '6857', 'NVDA'],
    comments: [
      { text: '328円戻しを「反転」と決めない', replies: ['決算前の戻りはノイズ', 'コアは別'] },
      { text: '65856でスポットしない' },
      { text: '今夜の結果まで6857は見送り', replies: ['同じ'] },
    ],
  },
  {
    author: 2,
    postedAt: '2026-08-26T16:24:00+09:00',
    likeSlots: 15,
    title: '寄与度 — 6857・9984が指数を上下。決算前はセット禁止',
    content:
      '大引け寄与度。685735700、99845163が指数の中心。7203トヨタ3070は内需寄与。今夜NVDA209.66終値（米前日）を意識するが、結果は出ていないので予想しない。半導体セットで指数を買い戻さない。',
    ticker: '6857.T',
    sentiment: 'neutral',
    tags: ['寄与度', '6857', '9984', 'NVDA'],
    comments: [
      { text: '35700を翌日の買いにしない', replies: ['決算後に動く', '285Aも禁止'] },
      { text: 'トヨタ3070が上位でもヘッジにしない' },
      { text: '209.66は参考値。憶測しない' },
    ],
  },
  {
    author: 0,
    postedAt: '2026-08-26T17:38:00+09:00',
    likeSlots: 14,
    title: '夕 — 今夜NVDA決算。コア据え置き、個別は見送り',
    content:
      '夕方。今夜がNVDA決算。金曜はジャクソンホール。結果は出ていないので予想しない。今日の日本は日経65856.43。米前日NVDA209.66、QQQ711.37。積立は淡々と。個別は決算後も急がない。',
    ticker: 'NVDA',
    sentiment: 'neutral',
    tags: ['夕', 'NVDA', 'ジャクソンホール', '積立'],
    comments: [
      { text: '決算前に6857を足さない', replies: ['それが上限', 'VTI378.23も今夜スポットしない'] },
      { text: '209.66を「安い」と決めない' },
      { text: '夜は米決算までアプリを閉じてもいい' },
    ],
  },
  {
    author: 11,
    postedAt: '2026-08-26T22:50:00+09:00',
    likeSlots: 16,
    title: '米時間 — NVDA決算発表前。S&P7675.70で様子見',
    content:
      '水曜夜（米時間）。NVDA決算発表前。S&P500は7675.70、VIX15.21。日本の6857をADRで埋めない。決算数字が出るまで上限ゼロ。結果後も寄り30分は触らない。',
    ticker: 'NVDA',
    sentiment: 'neutral',
    tags: ['米時間', 'NVDA', '決算', 'S&P500'],
    comments: [
      { text: '決算前に213ドル前後で逆張り禁止', replies: ['結果後も30分待つ', 'サイズ維持'] },
      { text: '7675は小動き。ノイズ' },
      { text: '木曜寄りまで見送り' },
    ],
  },
  // ── Thu Aug 27 morning: NVDA earnings reaction ──
  {
    author: 8,
    postedAt: '2026-08-27T05:46:00+09:00',
    likeSlots: 18,
    title: '米終値 — NVDA227.98で決算後リバウンド、S&P7730.99',
    content:
      '水曜米クローズ（Marketstack）。NVDAは209.66→227.98（高230.47）。S&P500は7730.99。QQQ721.11、VTI380.63、VIX14.51。半導体決算後のリバウンドでも、日本6857を227.98で埋めない。木曜寄り30分は触らない。',
    ticker: 'NVDA',
    sentiment: 'bullish',
    tags: ['米終値', 'NVDA', '決算', 'QQQ'],
    comments: [
      { text: '227.98は往復の途中。寄り前に触らない', replies: ['NVDA陽線でVTIを厚くしない', '6857セット禁止'] },
      { text: '7730は+0.7%程度。ノイズ' },
      { text: 'VIX14.51で油断しない。ジャクソンホールは金曜', replies: ['同じ'] },
    ],
  },
  {
    author: 4,
    postedAt: '2026-08-27T06:38:00+09:00',
    likeSlots: 16,
    title: 'NVDA227.98 / QQQ721.11 — 決算後も上限維持',
    content:
      'NVDA227.98（安値220.9から回復）。QQQ721.11。決算後のリバウンドでも枚数を戻さない。6857を227.98で埋めない。ジャクソンホール前。①寄り30分新規禁止②半導体セット禁止③VTI380.63据え置き。',
    ticker: 'NVDA',
    sentiment: 'bullish',
    tags: ['NVDA', 'QQQ', '決算', '6857'],
    comments: [
      { text: '227.98で6857を買わない', replies: ['30分後も見送り', '9984も同じ'] },
      { text: 'QQQをVTIの代わりに厚くしない' },
      { text: '金曜パウエル演説まで上限ゼロでいい' },
    ],
  },
  {
    author: 6,
    postedAt: '2026-08-27T07:22:00+09:00',
    likeSlots: 17,
    title: '木曜おはよう — NVDA決算後・ジャクソンホール前。寄りまで触らない',
    content:
      '7時台。東京はまだ寄り前。昨日の日本は日経65856.43。米はNVDA227.98、S&P7730.99。金曜ジャクソンホール。ルール：①寄り30分新規禁止②決算後も6857セット禁止③コアETFを陽線で追わない④積立淡々と。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['木曜', '寄り前', 'NVDA', 'ジャクソンホール'],
    comments: [
      { text: '①＋④。227.98を追わない', replies: ['完全に見るだけ', '6857は寄り30分後も見送り'] },
      { text: '65856を「安い」と朝イチで買わない' },
      { text: 'ジャクソンホールは金曜。今日は決算余波だけ意識' },
    ],
  },
  // ── Thu Aug 27 Tokyo session ──
  {
    author: 5,
    postedAt: '2026-08-27T09:08:00+09:00',
    likeSlots: 17,
    title: '木曜寄り — 6857始値36020円、NVDA決算後に半導体高',
    content:
      '木曜寄り。6857アドバンテ始値36020円、9984ソフトバンクG5300円と半導体が高い。NVDA227.98の決算後リバウンドを織り込む型。①寄り30分は触らない。36020で追いかけ禁止。',
    ticker: '6857.T',
    sentiment: 'bullish',
    tags: ['寄り', '6857', '9984', 'NVDA'],
    comments: [
      { text: '36020で決算後に枚数を戻さない', replies: ['寄り30分ルール', '285Aも同じ'] },
      { text: '5300のSBGをセット買いしない' },
      { text: '227.98を連想で6857を買わない' },
    ],
  },
  {
    author: 9,
    postedAt: '2026-08-27T10:22:00+09:00',
    likeSlots: 16,
    title: '前場 — 6857が36120円高値も上値は重い',
    content:
      '前場。6857は36120円高値、9984は5335円高値まで試すも伸び悩み。NVDA決算後の買いも一巡、上値は重い印象。1306 TOPIX ETF429.4。決算後の高値追いはしない。',
    ticker: '6857.T',
    sentiment: 'neutral',
    tags: ['前場', '6857', '9984', '半導体'],
    comments: [
      { text: '36120で新規禁止。高値更新＝買い、と決めない', replies: ['上値重い日は後追いしない', '9984も同じ'] },
      { text: '5335のSBGを厚くしない' },
      { text: '7203トヨタ3077円は内需。セット買いしない' },
    ],
  },
  {
    author: 1,
    postedAt: '2026-08-27T11:36:00+09:00',
    likeSlots: 15,
    title: '前引け — 半導体は強いが上値重い。前引けに足さない',
    content:
      '前引け。685736120円高値から伸び悩み、9984も5335円高値圏。決算後の買いも一巡。金曜ジャクソンホール前。前引けに6857・9984を足さない。昼休みも注文しない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['前引け', '半導体', 'ジャクソンホール', '6857'],
    comments: [
      { text: '強いが上値重い＝追わない', replies: ['前引けにサイズを足さない', '昼は見るだけ'] },
      { text: 'ジャクソンホール前は現金維持' },
      { text: '積立設定は触らない' },
    ],
  },
  {
    author: 6,
    postedAt: '2026-08-27T12:14:00+09:00',
    likeSlots: 14,
    title: 'ランチ — 6857は後場で利益確定売りに注意',
    content:
      '昼休み。6857は36120円高値から伸び悩み。後場は決算後の利益確定売りに注意。99845200円、685734610円はまだ確定前。ランチにスポットしない。①見るだけ。',
    ticker: '6857.T',
    sentiment: 'neutral',
    tags: ['ランチ', '6857', '利益確定', 'NVDA'],
    comments: [
      { text: '36120高値だけ見て「戻した」としない', replies: ['後場の売りを想像して買わない'] },
      { text: '決算後の高値追いは禁止' },
      { text: '積立勢は今日も淡々と' },
    ],
  },
  {
    author: 10,
    postedAt: '2026-08-27T13:28:00+09:00',
    likeSlots: 16,
    title: '後場 — 6857が34330円安値まで下落、決算後の利益確定',
    content:
      '後場。6857は36020円始値から34330円安値まで下落、決算後の利益確定売り。9984も5074円安値。高値36120円からの戻しは想定内。安値34330で逆張りしない。サイズ維持。',
    ticker: '6857.T',
    sentiment: 'bearish',
    tags: ['後場', '6857', '利益確定', '9984'],
    comments: [
      { text: '36020→34330は1400円超の戻し。追わない', replies: ['34330で逆張り禁止', '9984も同じ'] },
      { text: '227.98のNVDAを連想で買わない' },
      { text: '大引けまで新規禁止' },
    ],
  },
  {
    author: 3,
    postedAt: '2026-08-27T15:14:00+09:00',
    likeSlots: 18,
    title: '大引け — 6857終値34610円、高値から1400円超の戻し',
    content:
      '大引け確定。6857終値34610円（始36020、高36120、安34330）。9984終値5200円（高5335）。日経66262.16円、7203終値3077、1306終値429.4。NVDA227.98決算後も日本半導体は上値重く引け。①確定後も追いかけない。',
    ticker: '6857.T',
    sentiment: 'bearish',
    tags: ['大引け', '6857', '9984', 'NVDA'],
    comments: [
      { text: '34610で「安い」と判断してスポットしない', replies: ['1400円戻しは想定内', 'コアは別'] },
      { text: '66262で日経だけ見ない。6857の四本値を見る' },
      { text: '決算後の高値追いは負けパターン', replies: ['同じ'] },
    ],
  },
  {
    author: 7,
    postedAt: '2026-08-27T16:20:00+09:00',
    likeSlots: 15,
    title: '寄与度 — 6857の利益確定売りが指数を押す',
    content:
      '大引け寄与度。685734610円の利益確定売りが指数を押し下げ。99845200円も高値5335から戻し。7203トヨタ3077は内需寄与。NVDA227.98決算後も日本は上値重い一日。セット買いは禁止継続。',
    ticker: '6857.T',
    sentiment: 'bearish',
    tags: ['寄与度', '6857', '9984', '利益確定'],
    comments: [
      { text: '34610を翌日の買いにしない', replies: ['ジャクソンホール前', '285Aも禁止'] },
      { text: '5200のSBGをセット買いしない' },
      { text: '227.98と34610を連動させない' },
    ],
  },
  {
    author: 0,
    postedAt: '2026-08-27T17:34:00+09:00',
    likeSlots: 14,
    title: '夕 — 明日ジャクソンホール。コア据え置き',
    content:
      '夕方。明日金曜はジャクソンホール・パウエル演説。今日の685734610、99845200。米NVDA227.98。結果は出ていないので予想しない。積立は淡々と。個別はイベント後も急がない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['夕', 'ジャクソンホール', 'NVDA', '積立'],
    comments: [
      { text: '34610で6857を足さない', replies: ['それが上限', 'VTI380.63もスポットしない'] },
      { text: '金曜寄り30分も触らない' },
      { text: 'パウエル演説前にサイズを戻さない' },
    ],
  },
  {
    author: 2,
    postedAt: '2026-08-27T22:42:00+09:00',
    likeSlots: 16,
    title: '米時間 — S&P7730.99、ジャクソンホール前で様子見',
    content:
      '木曜夜（米時間）。S&P7730.99、NVDA227.98、VIX14.51。金曜ジャクソンホール前。日本6857の34610引けを米で埋めない。パウエル演説前に上限ゼロ。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['米時間', 'ジャクソンホール', 'S&P500', 'VIX'],
    comments: [
      { text: 'VIX14.51で油断しない', replies: ['金曜で動く', 'サイズ維持'] },
      { text: '7730は小動き。ノイズ' },
      { text: '金曜寄りまで6857見送り' },
    ],
  },
  // ── Fri Aug 28 morning (Jackson Hole day) ──
  {
    author: 8,
    postedAt: '2026-08-28T05:50:00+09:00',
    likeSlots: 17,
    title: '米終値 — S&P7730.99据え置き、本日ジャクソンホール',
    content:
      '木曜米クローズ（Marketstack）。S&P7730.99、NVDA227.98、QQQ721.11、VTI380.63、VIX14.51。本日金曜はジャクソンホール・パウエル演説。日本前日685734610、99845200。寄り30分は触らない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['米終値', 'ジャクソンホール', 'NVDA', 'S&P500'],
    comments: [
      { text: '7730据え置きを「堅い」と決めない', replies: ['パウエル前は上限ゼロ', '6857セット禁止'] },
      { text: '227.98で6857を買わない' },
      { text: 'VIX14.51で油断しない', replies: ['同じ'] },
    ],
  },
  {
    author: 11,
    postedAt: '2026-08-28T07:06:00+09:00',
    likeSlots: 16,
    title: 'ジャクソンホール当日 — パウエル演説前は上限ゼロ',
    content:
      '金曜7時台。本日ジャクソンホール。パウエル演説が最大イベント。昨日6857は36020→34610の1400円超戻し。NVDA227.98決算後も日本は上値重かった。演説前に枚数を戻さない。①寄り30分新規禁止。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['ジャクソンホール', 'パウエル', '6857', 'イベント'],
    comments: [
      { text: '34610を「安い」と朝イチで買わない', replies: ['演説前は現金', '9984も見送り'] },
      { text: '227.98のNVDAを連想で6857を買わない' },
      { text: '積立はいじらない' },
    ],
  },
  {
    author: 4,
    postedAt: '2026-08-28T07:44:00+09:00',
    likeSlots: 17,
    title: '金曜おはよう — イベント日。寄りまで触らない',
    content:
      '7時台。東京はまだ寄り前。昨日685734610、99845200。米NVDA227.98、S&P7730.99。本日ジャクソンホール。ルール：①寄り30分新規禁止②6857セット禁止③コアETFをイベント前に売らない④積立淡々と。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['金曜', '寄り前', 'ジャクソンホール', 'ルール'],
    comments: [
      { text: '①＋④。パウエル前に触らない', replies: ['完全に見るだけ', '6857は見送り'] },
      { text: '34610を底と決めない' },
      { text: 'イベント日は上限ゼロでいい' },
    ],
  },
  {
    author: 9,
    postedAt: '2026-08-28T08:18:00+09:00',
    likeSlots: 16,
    title: '寄り前 — ジャクソンホール・6857戻し後。サイズ維持',
    content:
      '8時18分、寄りまで。昨日6857は36020→34610。NVDA227.98決算後も日本半導体は上値重い。本日パウエル演説。①寄り30分触らない②6857・9984セット禁止③VTI380.63据え置き④積立淡々と。',
    ticker: '6857.T',
    sentiment: 'neutral',
    tags: ['寄り前', '6857', 'ジャクソンホール', 'NVDA'],
    comments: [
      { text: '寄り前に注文しない', replies: ['30分後も見送り', '同じ'] },
      { text: '34610で逆張り禁止' },
      { text: 'パウエル演説まで個別は上限ゼロ' },
      { text: '積立はいじらない' },
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Aug 26–28 community posts…`)

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
