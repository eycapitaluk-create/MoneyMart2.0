/**
 * Community: Aug 21 (Fri) Tokyo session through close + US Friday + Aug 22 (Sat) morning.
 * Times only up to current JST (~07:46). Saturday = JP holiday/weekend, no 寄り.
 *
 *   node scripts/seed-community-aug22-hotnews.mjs
 *   node scripts/seed-community-aug22-hotnews.mjs --dry-run
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
    postedAt: '2026-08-21T09:14:00+09:00',
    likeSlots: 18,
    title: '寄り — 789円安の6万5427円、米大幅安の流れ',
    content:
      '寄りは-789円10銭の6万5427円69銭（報道）。前日米はダウ-703.84の5万2759.21、ナスダック-263.92の2万6067.17、S&Pは7641.16。ウォルマート急落＋金利再上昇＋原油高が材料。主力中心に売り先行。ギャップを追わない。サイズ維持。ドル円は朝方159円13銭まで（報道）。',
    ticker: 'TOPIC',
    sentiment: 'bearish',
    tags: ['寄り', '日経平均', 'ウォルマート', '続落'],
    comments: [
      {
        text: '789円安は想定内。先物で十分下げてた',
        replies: ['寄り30分は触らない', 'WMTの連想で内需を売るのは後追い'],
      },
      {
        text: '全面安に見える日ほど個別の押し目に見えない',
        replies: ['値がさ消費が指数を溶かす型', '半導体は昨日戻した分の吐き出しも'],
      },
      { text: '①見るだけ。現金比率はいじらない' },
      { text: '積立設定は触らない。今日はイベント消化' },
    ],
  },
  {
    author: 8,
    postedAt: '2026-08-21T10:28:00+09:00',
    likeSlots: 17,
    title: '前場 — 一時956円安の6万5260円、900円超安',
    content:
      '一時-956円57銭（-1.44％）の6万5260円22銭まで（報道）。ファストリ・SBG・リクルートなど値がさが指数を押す。時事も「900円超安」と配信。ただ売り一巡後は下げ渋り。半導体に買い戻し、原油高で鉱業・石油・海運にも資金。ナイフキャッチ禁止は継続。',
    ticker: '9983.T',
    sentiment: 'bearish',
    tags: ['前場', 'ファーストリテイリング', 'ソフトバンクG', '急落'],
    comments: [
      {
        text: '安値65260は公式四本値の安値。ここを割るまでは様子見',
        replies: ['割っても追わない。ストップは先に決める', 'ファストリ1銘柄で指数が溶ける日'],
      },
      {
        text: 'WMTショックの輸出は内需。9983を「安くなった」で拾わない',
        replies: ['良品計画・アシックスも弱いとの解説', '消費テーマは週末まで見送り'],
      },
      { text: '海運が買われる歪み。指数と中身を分ける' },
      { text: '10時半の見出しで飛びつかない' },
    ],
  },
  {
    author: 6,
    postedAt: '2026-08-21T11:38:00+09:00',
    likeSlots: 16,
    title: '前引け — 208円安の6万6008円、66000回復',
    content:
      '前引けは-208.34円の6万6008円45銭、出来高概算9.95億株（報道）。寄り789円安から下げ幅を縮小し66000台を回復。アドバンテスト・東エレク・キオクシア・イビデンなどが上昇、ファストリ・SBG・リクルート・信越化は下落。業種は海運・鉱業・保険が強く、その他製品・精密・医薬品が弱い。後場は前引け水準のもみ合い想定。サイズ維持。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['前引け', '日経平均', '半導体', '海運'],
    comments: [
      {
        text: '66000回復は安心材料じゃない。寄りからの戻し',
        replies: ['正しい。ランチ後に増やさない', '値がさ安＋資源高のねじれ'],
      },
      { text: '医薬品安はモデルナ連想の吐き出しにも見える。触らない' },
      {
        text: '半導体買い戻しはKOSPI堅調の話も。フルベットしない',
        replies: ['285Aは昨日戻した。今日追いかけてサイズ増やさない'],
      },
      { text: '前引け数字は報道ベースでメモ。確定は15時' },
    ],
  },
  {
    author: 4,
    postedAt: '2026-08-21T12:18:00+09:00',
    likeSlots: 14,
    title: 'ランチ — 指数安なのに海運・資源が強い日',
    content:
      '日経は反落でも、海運・鉱業・石油が相対的に強い（報道）。対イラン長期化リスクと原油高の連想。川崎汽・商船三井・郵船がテーマに。一方で消費（ファストリ・良品計画）と医薬品が重い。自分は資源を「戦争テーマ」で一括買いにしない。ストーリー固定禁止。',
    ticker: '9107.T',
    sentiment: 'neutral',
    tags: ['海運', '原油', 'ランチ', 'テーマ'],
    comments: [
      {
        text: '原油高＝海運買い、は短絡になりやすい',
        replies: ['市況株は振れが大きい。分割以外は見送り', 'イラン材料はヘッドライン次第'],
      },
      { text: '指数より業種の中身。今日の宿題はそこ' },
      { text: '積立勢はテーマに乗らなくていい' },
      {
        text: '石油・鉱業も同じ。サイズ上限だけ確認',
        replies: ['わかる。ウォッチ更新だけ'],
      },
    ],
  },
  {
    author: 2,
    postedAt: '2026-08-21T12:46:00+09:00',
    likeSlots: 13,
    title: '医薬品・モデルナ連想は見送り。日本バイオを追わない',
    content:
      '業種別で医薬品が弱い（報道）。モデルナは19日+177％、20日は133.32ドルまで利確。日本の中外・第一三共は連想で振られやすい。今日の前場も医薬品が下落業種。材料は残っても値段は別。自分は日本バイオの押し目買いをしない。',
    ticker: 'MRNA',
    sentiment: 'bearish',
    tags: ['医薬品', 'モデルナ', '第一三共', '様子見'],
    comments: [
      {
        text: 'バイオは材料が本物でも翌日〜数日は乱高下',
        replies: ['19日の177％を取りにいく値段じゃない', 'ハザード比もまだ出てない'],
      },
      { text: '第一三共を「ディスカウント」で拾うのは禁止' },
      { text: 'ヘルスケアETFも今日は触らない' },
      { text: '積立の投信は淡々と。個別バイオは別物' },
    ],
  },
  {
    author: 9,
    postedAt: '2026-08-21T13:52:00+09:00',
    likeSlots: 15,
    title: '後場 — 66000近辺でもみ合い。週末見送りが強い',
    content:
      '後場は前引け水準を挟んだ一進一退（報道）。KOSPI堅調で半導体の下値拾いもあるが、値がさ株の上値の重さは残る。来週26日はエヌビディア5-7月期決算（報道）。積極的な買いは見送りやすい。自分はサイズ維持。大引けまで見るだけ。',
    ticker: 'NVDA',
    sentiment: 'neutral',
    tags: ['後場', '様子見', 'NVIDIA', '週末'],
    comments: [
      {
        text: '週末前にポジ増やさない、が正解',
        replies: ['NVDA前は半導体フルベット禁止', '先物だけ見て飛びつかない'],
      },
      { text: 'もみ合い＝退屈でも、退屈な日にルールを曲げるな' },
      { text: '6857が強い日でも一括はしない' },
      { text: '大引け数字が出るまでコメントしない派' },
    ],
  },
  {
    author: 7,
    postedAt: '2026-08-21T15:18:00+09:00',
    likeSlots: 18,
    title: '大引け確定 — 200円安の6万6016円、TOPIXは続伸',
    content:
      '確定終値は-200円43銭（-0.30％）の6万6016円36銭。始65,427.69 / 高66,125.88 / 安65,260.22。TOPIXは+7.56（+0.19％）の4067.29（報道）。プライム出来高概算22.09億株、売買代金7.91兆円。値上がり883・値下がり622。グロース250は768.47（-8.51）。プラス寄与上位は6857・285A・8035・9433・6762で約+227円（うち6857が約130円）。マイナス上位は9983・9984・6098・4063・4578で約-386円（うち9983が約223円）。上昇18業種。指数安でも値上がり優勢。中身を見る日。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['大引け', '日経平均', 'TOPIX', '寄与度'],
    comments: [
      {
        text: '日経安・TOPIX高。値がさ消費が指数を溶かし、中小型は耐えた',
        replies: ['プライム過半数は上昇。見出しだけで弱気にしない', 'ファストリ1銘柄で223円押し下げは異常値に近い'],
      },
      {
        text: '6857が+130円。半導体を「全面高」と読まない',
        replies: ['装置3銘柄が支え。消費が足を引っ張った', 'グロース250は-8.51。指数と別物'],
      },
      { text: '66000割れずに引けた。でも安心買い禁止' },
      { text: '今晩の米と来週NVDA。今日は勝ち負けを確定しすぎない' },
    ],
  },
  {
    author: 3,
    postedAt: '2026-08-21T15:52:00+09:00',
    likeSlots: 16,
    title: '半導体は買い戻し。6857が指数を支えた日',
    content:
      '大引けのプラス寄与1位はアドバンテスト。キオクシア・東エレクも高い（報道）。レーザーテク・イビデンも堅調との解説。前日の反発継続に見えるが、指数全体は200円安。半導体だけで相場を語らない。自分は分割ウォッチのみ。来週NVDAまでサイズ増やさない。',
    ticker: '6857.T',
    sentiment: 'bullish',
    tags: ['アドバンテスト', 'キオクシア', '東京エレクトロン', '半導体'],
    comments: [
      {
        text: '強い日に追うのが一番危ない',
        replies: ['昨日戻して今日も高い。二日追い禁止', 'NVDA前はイベントリスク'],
      },
      { text: '285Aはまだ乱高下想定。一括ナンピンしない' },
      {
        text: '8035も高い。でも装置3兄弟をセット買いしない',
        replies: ['1銘柄だけウォッチで十分'],
      },
      { text: '積立の全世界は淡々と。個別半導体は別口座' },
    ],
  },
  {
    author: 10,
    postedAt: '2026-08-21T16:24:00+09:00',
    likeSlots: 15,
    title: '消費関連が重い — ファストリが指数を223円押した',
    content:
      'マイナス寄与1位はファストリ、約223円押し下げ（報道）。SBG・リクルートもマイナス上位。WMT急落の連想で消費・内需が売られたとの解説。良品計画・アシックス・サンリオも安く、小売業は下落業種の上位。日本の内需を「米消費の鏡」で一括売りもしない。個別はIRと値段が別。',
    ticker: '9983.T',
    sentiment: 'bearish',
    tags: ['ファーストリテイリング', '消費', 'ウォルマート', '内需'],
    comments: [
      {
        text: 'WMTは米国内売上の伸び鈍化の話。ユニクロと同じではない',
        replies: ['連想売りは速い。拾うのも速い。今日は見送り', '9983の押し目に見えない'],
      },
      { text: 'リクルートもマイナス上位。雇用・消費のセットで売られやすい' },
      { text: '内需ETFも今日は触らない' },
      {
        text: 'SBGは値がさの話。WMTとは別ロジック',
        replies: ['わかる。9984を消費株と混ぜない'],
      },
    ],
  },
  {
    author: 1,
    postedAt: '2026-08-21T16:58:00+09:00',
    likeSlots: 14,
    title: '為替 — 朝159.13、夕方158円台。CPIは予想どおり',
    content:
      '東京為替は朝方一時159円13銭のあと軟調。夕方は158円73銭まで下値を切り下げ、17時時点は158円80-90銭（報道）。全国CPI（7月）は前年比+1.8％、予想どおり、前回+1.6％。金利・原油が残る中で円は一方向に張り付かない。自分はドル円で勝負しない。日本株のサイズもいじらない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['ドル円', 'CPI', '為替', '金利'],
    comments: [
      {
        text: '159を付けたから円安トレード、は禁止',
        replies: ['夕方戻してる。ヘッドラインだけで張らない', 'CPIは予想どおり。材料出尽くしに近い'],
      },
      { text: '輸出株を為替だけで買わない。今日の中身は消費と資源' },
      { text: '積立は円ベース。為替タイミングは考えない' },
      { text: '週末はNYの金利を見るだけ' },
    ],
  },
  {
    author: 0,
    postedAt: '2026-08-21T17:36:00+09:00',
    likeSlots: 16,
    title: '週末前メモ — 来週はNVDAとジャクソンホール',
    content:
      '来週の焦点はエヌビディア5-7月期（26日予定）とジャクソンホールのウォーシュ議長講演（報道）。シカゴ日経先物は大取終値比175円安との数字も。今日の教訓は①値がさ1銘柄で指数が溶ける②海運・資源はテーマ一括禁止③半導体は強くてもNVDA前に増やさない④積立は淡々と。投票：来週は？①現金多め②分割のみ③強気で拾う。',
    ticker: 'NVDA',
    sentiment: 'neutral',
    tags: ['週末', 'NVIDIA', 'ジャクソンホール', '先物'],
    comments: [
      {
        text: '①。イベント前にサイズ増やした人の末路を見てる',
        replies: ['同じ。分割ウォッチだけ', '③は禁止。FOMO用'],
      },
      { text: 'ジャクソンホールは講演内容が出るまで材料にしない' },
      {
        text: '先物175円安は夜の温度感。ナイトで取り返そうとしない',
        replies: ['正しい。寝る'],
      },
      { text: '②の分割のみ。新規は来週火曜以降' },
    ],
  },
  {
    author: 5,
    postedAt: '2026-08-21T19:24:00+09:00',
    likeSlots: 14,
    title: 'ナイト — 米は戻りを試す時間。金利と原油が残る',
    content:
      '日本は200円安で引けた。米は木曜の大幅安の翌日。金利（10年・30年）と原油、イラン関連が残ってる（報道）。WMTは既に材料化。モデルナも乱高下中。自分は米個別をナイトで触らない。投票：米時間は？①見るだけ②ヘルスケア分割③消費の押し目。自分は①。',
    ticker: 'WMT',
    sentiment: 'neutral',
    tags: ['ナイト', '米国株', '金利', '原油'],
    comments: [
      {
        text: '①一択。木曜-704の翌日を取りにいかない',
        replies: ['ナイトは見送り。チャートで勝負しない', '原油週次高はインフレ懸念の材料'],
      },
      { text: '③消費の押し目はWMTの翌日。典型的な罠に見える' },
      { text: 'モデルナも触らない。材料買いの3日目' },
      { text: '積立設定だけ確認して寝る' },
    ],
  },
  {
    author: 8,
    postedAt: '2026-08-21T22:48:00+09:00',
    likeSlots: 13,
    title: '米時間開始 — 戻りを見るだけ。追わない',
    content:
      '米主要指数は朝の先物段階から戻りを試す流れとの報道もあったが、確定は引け。金利と原油が残るなら「全面高」と決めつけない。日本はもう閉まってる。自分はウォッチ更新だけ。半導体ADRをナイトで増やさない。NVDAは来週。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['米国株', 'ナイト', '様子見', '金利'],
    comments: [
      {
        text: '始まってからの値動きで日本の月曜を想像しない',
        replies: ['正しい。週末ギャップは別物', '先物だけ見て強気にしない'],
      },
      { text: 'ビットコイン上昇の話題もあるが、株の代替にしない' },
      { text: '今日はもう十分見た。寝る' },
      { text: 'ADRで6857の翌日を当てにいかない' },
    ],
  },
  {
    author: 7,
    postedAt: '2026-08-22T05:38:00+09:00',
    likeSlots: 17,
    title: '米終値 — ダウ+518の5万3277ドル、週次はマイナス',
    content:
      '金曜米確定（報道）：ダウ+517.80（+0.98％）の5万3277.01、S&P +0.43％の7674.37、ナスダック+0.43％の2万6180.45。木曜の反落を一部取り戻したが、週次はダウ約-0.9％、S&P約-1.4％、ナスダック約-2％とマイナス。10年債利回りは+3bp超の4.734％、30年は5.273％。原油は週次で米原油約+5.7％、ブレント約+6.4％。WMTは103.70ドル（木103.84から小動き）。モデルナは145.13ドル（+8.86％、高値159.47）。材料残りでも週次は重い。日本は土日休場。',
    ticker: 'TOPIC',
    sentiment: 'bullish',
    tags: ['NYダウ', '週末', '金利', 'モデルナ'],
    comments: [
      {
        text: '金曜戻り＝来週強い、は短絡。週次マイナスを忘れるな',
        replies: ['金利はまだ高い。戻り売り警戒', 'NVDA前に強気固定しない'],
      },
      {
        text: 'モデルナ+9％でも19日の174から見れば往復。触らない',
        replies: ['高値159は誰かが投げてる証拠', 'バイオは3日で人生変わる'],
      },
      { text: 'WMTは急落翌日にほぼ横ばい。消費の結論は出てない' },
      { text: '原油週次高は日本の海運テーマ継続材料。一括はしない' },
    ],
  },
  {
    author: 0,
    postedAt: '2026-08-22T07:06:00+09:00',
    likeSlots: 16,
    title: '土曜おはよう — 日本休場。金曜のねじれを整理',
    content:
      '土曜。東京は休場。金曜の日本は日経-200円の6万6016円、TOPIXは+7.56の4067。米は金曜戻りでも週次マイナス。ドル円は158円台後半（報道）。自分の整理：①指数より業種（消費安・資源高・半導体買い戻し）②ファストリ1銘柄で223円押された事実③来週はNVDAとジャクソンホール④休場日にポジションをいじらない。積立は淡々と。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['土曜', '休場', '振り返り', '日経平均'],
    comments: [
      {
        text: '休場なのにチャート見てサイズ変える人が一番危ない',
        replies: ['完全オフが正解', 'ウォッチリスト整理だけならOK'],
      },
      { text: '日経安TOPIX高を「弱い」とだけ読むと月曜に負ける' },
      {
        text: '来週のチェックはNVDAと講演。今日は家族優先',
        replies: ['同じ。⑤趣味優先', '月曜のギャップを想像して夜更かししない'],
      },
      { text: '積立日が月曜でも、今日は設定を弄らない' },
    ],
  },
  {
    author: 4,
    postedAt: '2026-08-22T07:22:00+09:00',
    likeSlots: 14,
    title: '週末投票 — 来週守るルール、番号で',
    content:
      '金曜までで十分振れた。番号で：①寄り30分触らない②半導体フルベットしない③消費の押し目をWMTで決めない④海運・原油はテーマ一括禁止⑤NVDAまで新規禁止⑥積立だけ淡々と。自分は①＋⑥。休場の朝に「月曜ギャップを取りにいく計画」を立てない。',
    ticker: 'TOPIC',
    sentiment: 'neutral',
    tags: ['投票', 'ルール', '週末', 'リスク管理'],
    comments: [
      {
        text: '⑥一択。個別は全部見送り',
        replies: ['わかる。コアは投信', '個別はイベントが多すぎる'],
      },
      { text: '①＋⑤。NVDAまで新規禁止が自分の上限' },
      {
        text: '③大事。WMTとファストリを同じにしない',
        replies: ['連想の翌日に拾うのが一番やられる'],
      },
      { text: '②。6857が強くてもセット買いしない' },
      { text: '全部。ルールを増やしすぎず、破らない方を優先' },
    ],
  },
  {
    author: 11,
    postedAt: '2026-08-22T07:38:00+09:00',
    likeSlots: 12,
    title: '積立勢の週末 — 振れが大きい週ほど淡々と',
    content:
      '今週は日経が6万9000台から6万5000台まで振れて、金曜は200円安で6万6016円。米は週次マイナス。個別はWMT急落、モデルナ往復。積立・NISAのコアは今日いじらない。来週のNVDAで全世界株式を止める理由にしない。現金が必要なら生活防衛資金の話で、投資ルールは別。月曜までチャート閉じる。',
    ticker: 'TOPIC',
    sentiment: 'bullish',
    tags: ['積立', 'NISA', '週末', '長期'],
    comments: [
      {
        text: '正しい。今週の値動きで積立額を変えない',
        replies: ['スポット追加もしない', 'コアとサテライトを混ぜない'],
      },
      { text: 'モデルナみたいな個別は積立の対義語' },
      { text: '休場の朝にアプリ開く回数を減らす' },
      {
        text: '来週も淡々と。イベントはニュースだけ',
        replies: ['それが一番勝ちやすい'],
      },
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
  console.log(DRY_RUN ? `Dry run — ${POSTS.length} posts…` : `Seeding ${POSTS.length} Aug 21 session + Aug 22 morning posts…`)

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
