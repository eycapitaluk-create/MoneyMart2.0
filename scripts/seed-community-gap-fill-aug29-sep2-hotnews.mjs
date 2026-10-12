/**
 * Community gap fill: Aug 29 afternoon – Sep 2 morning (hot topics).
 *   node scripts/seed-community-gap-fill-aug29-sep2-hotnews.mjs
 *   node scripts/seed-community-gap-fill-aug29-sep2-hotnews.mjs --dry-run
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
  // ── Aug 29 afternoon (12:00–21:00) ──────────────────────────────────────
  {
    author: 4,
    postedAt: '2026-08-29T12:18:00+09:00',
    likeSlots: 16,
    title: '土曜昼 — ジャクソンホール翌日。金曜確定値メモだけ',
    content:
      '土曜昼チェック。金曜確定（Marketstack）：日経66131.98円、6857アドバンテ35270円、9984ソフトバンクG5161円、285Aキオクシア47900円。米NVDA217.55ドル。週末は板がない。ジャクソンホール要約は読むが、月曜寄り30分までは枚数ゼロ。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['ジャクソンホール', 'N225', 'NVDA', '6857'],
    comments: [
      { text: '66132で週末に買い理由を作らない', replies: ['月曜寄り30分待つ', '285Aも同じ'] },
      { text: '217.55は確定。憶測で枚数を戻さない' },
      { text: '99845161はイベント前の位置。セット禁止' },
    ],
  },
  {
    author: 9,
    postedAt: '2026-08-29T14:05:00+09:00',
    likeSlots: 17,
    title: 'NVDA217.55ドル — 決算後の金曜引け。半導体は週明けまで様子見',
    content:
      '金曜米時間。NVDA終値217.55ドル。285A47900円（高52190・安47800）、685735270、99845161とセットで見るが、週末に半導体を厚くしない。決算後の戻りを追わない。ジャクソンホール週末は新規ゼロ。',
    ticker: 'NVDA',
    sentiment: 'bearish',
    tags: ['NVDA', '決算', '半導体', '285A'],
    comments: [
      { text: '217.55で逆張り禁止', replies: ['47800安値も追わない', '6857も'] },
      { text: '47900を「底」と決めない' },
      { text: '35270で6857を埋めない' },
    ],
  },
  {
    author: 5,
    postedAt: '2026-08-29T16:30:00+09:00',
    likeSlots: 15,
    title: '285A47900円大引け — 半導体メモリはイベント日に幅が出やすい',
    content:
      '285Aキオクシア金曜47900円引け。685735270、99845161と同じ半導体バスケット。NVDA217.55も参考。ジャクソンホール週末は新規ゼロ。月曜ギャップは寄り30分後に判断。47800安値でスポットしない。',
    ticker: '285A.T',
    sentiment: 'neutral',
    tags: ['285A', '半導体', 'NVDA', '6857'],
    comments: [
      { text: '47900で追わない', replies: ['6857セット禁止', '9984も'] },
      { text: 'イベント週はサイズ維持' },
      { text: '1306432も月曜まで触らない' },
    ],
  },
  {
    author: 1,
    postedAt: '2026-08-29T18:45:00+09:00',
    likeSlots: 14,
    title: '6857/9984 — 月曜ギャップ想定メモ（実行はしない）',
    content:
      '週末メモのみ。6857終35270円、9984終5161円。NVDA217.55、285A47900円。月曜寄りでギャップが出ても①寄り30分待つ②35270/5161を「安い」と決めない③半導体セット買い禁止。ジャクソンホール要約は見るが、結果で枚数を変えない。',
    ticker: '6857.T',
    sentiment: 'neutral',
    tags: ['6857', '9984', '半導体', 'ジャクソンホール'],
    comments: [
      { text: '35270を月曜の買い理由にしない', replies: ['5161も同じ', '285Aも禁止'] },
      { text: 'ギャップダウンでも追わない' },
      { text: '積立は触らない派', replies: ['同感'] },
    ],
  },
  {
    author: 7,
    postedAt: '2026-08-29T20:30:00+09:00',
    likeSlots: 16,
    title: 'N22566132円 — 金曜65782安値まで試した週末整理',
    content:
      '日経平均66131.98円で金曜引け。1306 TOPIX ETF432円。半導体寄与（6857・9984・285A）と指数を分けて見る。ジャクソンホール要約が出ても、月曜寄り前に枚数を増やさない。NVDA217.55は米側の参考値。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['N225', '1306', 'ジャクソンホール', '半導体'],
    comments: [
      { text: '65782安値で週末に逆張りしない', replies: ['66132で買わない', '1306も同じ'] },
      { text: '66954高値を「ブレイク」と決めない' },
      { text: 'NVDA217.55は米側の参考値' },
    ],
  },

  // ── Aug 30 weekend ──────────────────────────────────────────────────────
  {
    author: 2,
    postedAt: '2026-08-30T09:15:00+09:00',
    likeSlots: 15,
    title: '日曜朝 — ジャクソンホール要約チェック。板は月曜までない',
    content:
      '日曜朝。金曜確定値の再確認：N22566131.98円、685735270、99845161、285A47900、NVDA217.55、1306432。ジャクソンホール関連のニュースは読むが、日曜に半導体を厚くしない。月曜寄り30分ルールを先に決める。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['ジャクソンホール', 'N225', '半導体', 'NVDA'],
    comments: [
      { text: '日曜はアプリを閉じてもいい', replies: ['月曜寄り30分待つ', '同感'] },
      { text: '217.55を「割安」と決めない' },
      { text: '35270/5161/47900は位置確認だけ' },
    ],
  },
  {
    author: 10,
    postedAt: '2026-08-30T11:40:00+09:00',
    likeSlots: 14,
    title: 'ジャクソンホール週末 — NVDA決算と半導体の位置整理',
    content:
      'NVDA決算後217.55ドル。285A47900、685735270、99845161。半導体はイベント週で幅が出やすい。日曜はニュースを読むだけ。月曜ギャップが出ても寄り30分待つ。1306432 TOPIXも同じルール。',
    ticker: 'NVDA',
    sentiment: 'neutral',
    tags: ['ジャクソンホール', 'NVDA', '決算', '半導体'],
    comments: [
      { text: '決算後の-4%を追わない', replies: ['285Aも', '6857も'] },
      { text: '35270で日本半導体を埋めない' },
      { text: 'ジャクソンホール要約は①だけ見る' },
    ],
  },
  {
    author: 6,
    postedAt: '2026-08-30T14:20:00+09:00',
    likeSlots: 16,
    title: '月曜プレビュー — 6857/9984/285Aの半導体バスケット',
    content:
      '月曜想定メモ。6857終35270、9984終5161、285A終47900。NVDA217.55。いずれも金曜確定値。ギャップダウンでも追わない。半導体3銘柄をセットで買い戻さない。N22566132と1306432は指数側。',
    ticker: '6857.T',
    sentiment: 'neutral',
    tags: ['6857', '9984', '285A', '半導体'],
    comments: [
      { text: '3銘柄セット買い禁止', replies: ['NVDAも参考だけ', '月曜寄り30分'] },
      { text: '47900を底と決めない' },
      { text: '5161でSBGを埋めない' },
    ],
  },
  {
    author: 0,
    postedAt: '2026-08-30T16:55:00+09:00',
    likeSlots: 17,
    title: '1306 TOPIX432円 — 指数ETFは半導体と分けて考える',
    content:
      '1306 TOPIX ETF金曜432円。日経66131.98円と比べ指数側は相対的に落ち着き。6857・9984・285Aの半導体個別と1306をセットで買い戻さない。NVDA217.55も参考。日曜チェック：①ルール②サイズ③月曜寄り30分。',
    ticker: '1306.T',
    sentiment: 'neutral',
    tags: ['1306', 'N225', '半導体', 'TOPIX'],
    comments: [
      { text: '432で日曜スポットしない', replies: ['6857セット禁止', '9984も'] },
      { text: '66132日経と1306を同時に厚くしない' },
      { text: 'ジャクソンホールは月曜寄り後' },
    ],
  },
  {
    author: 8,
    postedAt: '2026-08-30T19:10:00+09:00',
    likeSlots: 15,
    title: '日曜夜 — 今週の話題タグ整理（ジャクソンホール・NVDA・285A）',
    content:
      '今週の話題タグ整理：ジャクソンホール、NVDA217.55、285A47900、685735270、99845161、N22566132、1306432。どれも「買い」ではなく「位置の確認」。月曜は寄り30分待つ。',
    ticker: 'NVDA',
    sentiment: 'neutral',
    tags: ['ジャクソンホール', 'NVDA', '285A', '6857'],
    comments: [
      { text: '①NVDA。それ以外触らない', replies: ['②285Aは月曜', '③6857も'] },
      { text: '9984はSBG5161で見送り' },
      { text: '日曜はサイズを増やさない派', replies: ['同感', '+1'] },
    ],
  },
  {
    author: 11,
    postedAt: '2026-08-30T21:30:00+09:00',
    likeSlots: 14,
    title: '月曜朝の準備 — 半導体は寄り30分後に判断',
    content:
      '月曜朝の準備メモ。金曜確定：N22566132、685735270、99845161、285A47900、NVDA217.55、1306432。ジャクソンホール後の初週。寄り30分は触らない。ギャップが出ても35270/5161/47900を安いと決めない。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['N225', '半導体', 'ジャクソンホール', '決算'],
    comments: [
      { text: '寄り30分ルールを先に決める', replies: ['6857も', '285Aも'] },
      { text: '217.55で米半導体を追わない' },
      { text: '1306は指数。個別半導体と混ぜない' },
    ],
  },

  // ── Aug 31 Mon session (09:00–20:00) ────────────────────────────────────
  {
    author: 3,
    postedAt: '2026-08-31T09:12:00+09:00',
    likeSlots: 18,
    title: '月曜寄り — 日経66104スタート。半導体はギャップダウン',
    content:
      '月曜寄り（Marketstack）：日経66104スタート（終値66405.56円・高66842・安66012）。6857アドバンテ33690円（始32900・高33880・安32280）、99845200、285A49990。寄り30分は触らない。32280安値で6857を追わない。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['N225', '6857', '半導体', 'ジャクソンホール'],
    comments: [
      { text: '66104寄りで買わない', replies: ['66406引けも追わない', '寄り30分待つ'] },
      { text: '32900始値で6857を埋めない' },
      { text: '32280安値はスポットしない' },
    ],
  },
  {
    author: 5,
    postedAt: '2026-08-31T10:25:00+09:00',
    likeSlots: 17,
    title: '685733690円 — 金曜35270からギャップダウン。寄り30分後に判断',
    content:
      '6857アドバンテ33690円（始32900・高33880・安32280）。金曜35270から約-4.5%。99845200、285A49990と半導体バスケット。NVDA前日220.78ドル。33880高値で追いかけない。32280安値で逆張りしない。',
    ticker: '6857.T',
    sentiment: 'bearish',
    tags: ['6857', '半導体', '9984', 'NVDA'],
    comments: [
      { text: '33690で逆張り禁止', replies: ['32280も追わない', '9984も'] },
      { text: '35270を「高値圏」と決めない' },
      { text: '半導体セット買い禁止' },
    ],
  },
  {
    author: 9,
    postedAt: '2026-08-31T11:50:00+09:00',
    likeSlots: 16,
    title: '285A49990円 — 金曜47900から戻し。半導体メモリは幅広い',
    content:
      '285Aキオクシア49990円（金曜47900から+約4.4%）。685733690、99845200と同じ半導体テーマ。NVDA220.78ドル。49990で追いかけない。47900を「底」と決めない。イベント週はサイズ維持。',
    ticker: '285A.T',
    sentiment: 'neutral',
    tags: ['285A', '半導体', '6857', 'NVDA'],
    comments: [
      { text: '49990で追わない', replies: ['47900底と決めない', '6857も'] },
      { text: '220.78は米側参考' },
      { text: '半導体は枚数を増やさない' },
    ],
  },
  {
    author: 1,
    postedAt: '2026-08-31T13:15:00+09:00',
    likeSlots: 15,
    title: '99845200円 — SBGは半導体バスケットの一員として見る',
    content:
      '9984ソフトバンクG5200円（金曜5161から小幅プラス）。685733690、285A49990とセットで見るが、セット買い禁止。NVDA220.78。日経66406付近。5200で追いかけない。5161を安いと決めない。',
    ticker: '9984',
    sentiment: 'neutral',
    tags: ['9984', '6857', '半導体', 'N225'],
    comments: [
      { text: '5200で追わない', replies: ['5161も', '6857セット禁止'] },
      { text: '66406日経と個別半導体を混ぜない' },
      { text: 'ジャクソンホール後もルール維持' },
    ],
  },
  {
    author: 7,
    postedAt: '2026-08-31T15:05:00+09:00',
    likeSlots: 17,
    title: 'NVDA220.78ドル — 月曜米時間。半導体は方向確認だけ',
    content:
      '月曜米時間。NVDA220.78ドル（金曜217.55から+約1.5%）。285A49990、685733690、99845200の日本半導体と方向が揃う日。220.78で追いかけない。決算後の戻りを追わない。S&P7686.14も参考。',
    ticker: 'NVDA',
    sentiment: 'bullish',
    tags: ['NVDA', '半導体', '決算', '285A'],
    comments: [
      { text: '220.78で追わない', replies: ['217.55底と決めない', '285Aも'] },
      { text: '7686 S&Pは指数参考' },
      { text: '決算後の戻りを追わない' },
    ],
  },
  {
    author: 4,
    postedAt: '2026-08-31T17:30:00+09:00',
    likeSlots: 14,
    title: '1306433.5円 — TOPIX ETFは半導体個別と分けて見る',
    content:
      '1306 TOPIX ETF433.5円（金曜432から+約0.3%）。日経66405.56円。6857・9984・285Aの半導体個別と1306をセットで買い戻さない。NVDA220.78も参考。433.5で追いかけない。',
    ticker: '1306.T',
    sentiment: 'neutral',
    tags: ['1306', 'N225', 'TOPIX', '半導体'],
    comments: [
      { text: '433.5で追わない', replies: ['432も', '6857セット禁止'] },
      { text: '66406日経と1306を同時に厚くしない' },
      { text: '半導体個別と指数は分ける' },
    ],
  },
  {
    author: 10,
    postedAt: '2026-08-31T19:45:00+09:00',
    likeSlots: 18,
    title: '月曜大引け — 日経66406円。半導体は寄与分けて整理',
    content:
      '月曜確定（Marketstack）：日経66405.56円（始66104・高66842・安66012）。685733690、99845200、285A49990、NVDA220.78、1306433.5、S&P7686.14。ジャクソンホール後初日。66842高値で追わない。66012安値で逆張りしない。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['N225', '6857', '半導体', 'ジャクソンホール'],
    comments: [
      { text: '66406で追わない', replies: ['66842高値も', '66012安値も'] },
      { text: '33690/5200/49990は位置確認' },
      { text: '火曜寄り30分ルール維持' },
    ],
  },

  // ── Sep 1 Tue session (09:00–20:00, skip 13:00) ─────────────────────────
  {
    author: 6,
    postedAt: '2026-09-01T09:08:00+09:00',
    likeSlots: 17,
    title: '火曜寄り — 日経65668スタート。半導体はさらに軟調',
    content:
      '火曜寄り（Marketstack）：日経65668スタート（終値66311.93円・高66311・安64832）。6857アドバンテ33380円（始32700・高33690・安32520）、99845262、285A51000。寄り30分は触らない。64832安値で日経を追わない。',
    ticker: 'N225',
    sentiment: 'bearish',
    tags: ['N225', '6857', '半導体', '285A'],
    comments: [
      { text: '65668寄りで買わない', replies: ['66312引けも追わない', '寄り30分待つ'] },
      { text: '32700始値で6857を埋めない' },
      { text: '64832安値はスポットしない' },
    ],
  },
  {
    author: 2,
    postedAt: '2026-09-01T10:35:00+09:00',
    likeSlots: 16,
    title: '685733380円 — 月曜33690からさらに軟調。安値32520',
    content:
      '6857アドバンテ33380円（始32700・高33690・安32520）。月曜33690から約-0.9%。99845262、285A51000と半導体バスケット。NVDA217.44ドル。33690高値で追いかけない。32520安値で逆張りしない。',
    ticker: '6857.T',
    sentiment: 'bearish',
    tags: ['6857', '半導体', '9984', 'NVDA'],
    comments: [
      { text: '33380で逆張り禁止', replies: ['32520も追わない', '9984も'] },
      { text: '33690を「高値圏」と決めない' },
      { text: '半導体セット買い禁止' },
    ],
  },
  {
    author: 8,
    postedAt: '2026-09-01T12:05:00+09:00',
    likeSlots: 15,
    title: '285A51000円 — 半導体メモリは51000で推移。追いかけない',
    content:
      '285Aキオクシア51000円（月曜49990から+約2%）。685733380、99845262と同じ半導体テーマ。NVDA217.44ドル。51000で追いかけない。49990を「底」と決めない。決算シーズンはサイズ維持。',
    ticker: '285A.T',
    sentiment: 'neutral',
    tags: ['285A', '半導体', '決算', '6857'],
    comments: [
      { text: '51000で追わない', replies: ['49990底と決めない', '6857も'] },
      { text: '217.44は米側参考' },
      { text: '半導体は枚数を増やさない' },
    ],
  },
  {
    author: 0,
    postedAt: '2026-09-01T14:10:00+09:00',
    likeSlots: 17,
    title: '半導体バスケット — 6857/9984/285A/NVDAの位置確認',
    content:
      '火曜昼チェック。685733380、99845262、285A51000、NVDA217.44。日経66312付近（安64832）。半導体4銘柄をセットで買い戻さない。ジャクソンホール後2日目。決算シーズンは上限ゼロ。寄り30分ルール維持。',
    ticker: 'NVDA',
    sentiment: 'neutral',
    tags: ['半導体', '6857', 'NVDA', '285A'],
    comments: [
      { text: '4銘柄セット買い禁止', replies: ['9984も', '1306も'] },
      { text: '64832日経安値で逆張りしない' },
      { text: '217.44でNVDAを追わない' },
    ],
  },
  {
    author: 11,
    postedAt: '2026-09-01T15:40:00+09:00',
    likeSlots: 16,
    title: '99845262円 — SBGは5262で推移。半導体と指数を分ける',
    content:
      '9984ソフトバンクG5262円（月曜5200から+約1.2%）。685733380、285A51000と半導体バスケット。日経66311.93円。5262で追いかけない。5200を安いと決めない。1306435.7 TOPIXも指数側。',
    ticker: '9984',
    sentiment: 'neutral',
    tags: ['9984', '6857', 'N225', '半導体'],
    comments: [
      { text: '5262で追わない', replies: ['5200も', '6857セット禁止'] },
      { text: '66312日経と個別半導体を混ぜない' },
      { text: '435.7 TOPIXは指数参考' },
    ],
  },
  {
    author: 3,
    postedAt: '2026-09-01T17:20:00+09:00',
    likeSlots: 18,
    title: 'NVDA217.44ドル — S&P7631と半導体は方向確認だけ',
    content:
      '火曜米時間。NVDA217.44ドル（月曜220.78から-約1.5%）。S&P7631.47。285A51000、685733380、99845262の日本半導体と方向確認。217.44で追いかけない。220.78を高値と決めない。決算後の戻りを追わない。',
    ticker: 'NVDA',
    sentiment: 'bearish',
    tags: ['NVDA', '決算', '半導体', 'N225'],
    comments: [
      { text: '217.44で追わない', replies: ['220.78高値と決めない', '285Aも'] },
      { text: '7631 S&Pは指数参考' },
      { text: '決算シーズンは枚数維持' },
    ],
  },
  {
    author: 5,
    postedAt: '2026-09-01T19:55:00+09:00',
    likeSlots: 17,
    title: '火曜大引け — 日経66312円。半導体・指数を分けて整理',
    content:
      '火曜確定（Marketstack）：日経66311.93円（始65668・高66311・安64832）。685733380、99845262、285A51000、NVDA217.44、1306435.7、S&P7631.47。66311高値で追わない。64832安値で逆張りしない。水曜寄り30分ルール維持。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['N225', '6857', '半導体', '1306'],
    comments: [
      { text: '66312で追わない', replies: ['66311高値も', '64832安値も'] },
      { text: '33380/5262/51000は位置確認' },
      { text: '水曜寄り30分ルール維持' },
    ],
  },

  // ── Sep 2 Wed morning ───────────────────────────────────────────────────
  {
    author: 4,
    postedAt: '2026-09-02T07:20:00+09:00',
    likeSlots: 16,
    title: '水曜朝 — 火曜確定値メモ。寄り30分待つ',
    content:
      '水曜朝チェック。火曜確定（Marketstack）：日経66311.93円、685733380、99845262、285A51000、NVDA217.44、1306435.7、S&P7631.47。寄り30分は触らない。半導体バスケット（6857・9984・285A・NVDA）をセットで買い戻さない。決算シーズンはサイズ維持。',
    ticker: 'N225',
    sentiment: 'neutral',
    tags: ['N225', '半導体', 'NVDA', '決算'],
    comments: [
      { text: '66312で朝に買わない', replies: ['寄り30分待つ', '6857も'] },
      { text: '217.44でNVDAを追わない' },
      { text: '435.7 TOPIXは指数。個別半導体と混ぜない' },
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Aug 29–Sep 2 gap-fill posts…`)

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
      console.log(`[dry-run] ${row.postedAt.slice(0, 16)} ${mapped.nickname}: ${row.title} (c=${totalComments}) tags=${(row.tags || []).join(',')}`)
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
