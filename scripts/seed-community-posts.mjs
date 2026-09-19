/**
 * Seed community lounge_posts — Japanese-only personas, comments, bullish/bearish tags.
 *
 *   node scripts/seed-community-posts.mjs --replace
 *   node scripts/seed-community-posts.mjs --dry-run
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"'))
      || (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = val
    }
  }
}

loadEnvFile(path.resolve(__dirname, '..', '.env.local'))
loadEnvFile(path.resolve(__dirname, '..', '.env'))

const DRY_RUN = process.argv.includes('--dry-run')
const REPLACE = process.argv.includes('--replace')
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim()
const SERVICE_KEY = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '',
).trim()

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const SEED_MARKER = 'mm-community-seed-v1'

/** @type {{ email: string, name: string, exp: number }[]} */
const PERSONAS = [
  { email: 'mm-seed-01@community.seed', name: '田中健太', exp: 4200 },
  { email: 'mm-seed-02@community.seed', name: '佐藤美咲', exp: 3100 },
  { email: 'mm-seed-03@community.seed', name: '鈴木大輔', exp: 2800 },
  { email: 'mm-seed-04@community.seed', name: '高橋翔', exp: 5200 },
  { email: 'mm-seed-05@community.seed', name: '伊藤恵', exp: 1900 },
  { email: 'mm-seed-06@community.seed', name: '渡辺直樹', exp: 1500 },
  { email: 'mm-seed-07@community.seed', name: '山本涼', exp: 3600 },
  { email: 'mm-seed-08@community.seed', name: '中村さくら', exp: 2400 },
  { email: 'mm-seed-09@community.seed', name: '小林拓海', exp: 4800 },
  { email: 'mm-seed-10@community.seed', name: '加藤悠真', exp: 2700 },
  { email: 'mm-seed-11@community.seed', name: '吉田隼人', exp: 3300 },
  { email: 'mm-seed-12@community.seed', name: '松本彩', exp: 2100 },
]

const COMMENT_POOL = [
  '鋭い視点ですね。自分も同じ銘柄をウォッチしています。',
  '短期と長期で見方が分かれそう。様子見派です。',
  'この論点、決算後にどう変わるか注目しています。',
  'リスク面の整理が参考になりました。',
  '同意です。ポジションは半分に抑えています。',
  '逆のシナリオも想定しておきたいですね。',
  '新NISA枠でどう組み込むか迷います。',
  'マクロの影響が大きそう。金利動向とセットで見ます。',
  'コメントありがとうございます。勉強になります。',
  '個人的にはまだ様子見ですが、議論は面白いです。',
  '出来高の変化も一緒に見た方が良さそうです。',
  'セクターローテの文脈で納得感があります。',
  'ここからどう積み増すか、閾値を決めておきたい。',
  '配当利回りとのバランスも気になります。',
  '為替が円安に振れると見方が変わりますね。',
  '金利上昇は銀行にプラス、不動産にマイナス。選別が大事。',
  '日銀の次の一手が全てを変えそう。',
  '待機資金まだ多いから下値は固い気がします。',
  '海外勢が買ってるうちは強気で。',
  '積立で毎月淡々と入れてます。相場気にしない派。',
  '骨太ショック、債券やってる人は大変そう…。',
  '高配当+増配銘柄のダブルで守り固めてます。',
  'TOPIX型の方が今はバランスいいかも。',
  'V字回復の日に限って仕事で見れない法則。',
  '円安のうちに外貨建て資産の利確迷ってます。',
]

/** Seed post rows */
const POSTS = [
  {
    author: 0, title: 'SpaceX上場の評価額1.5兆ドル説は現実的か？',
    content: 'StarlinkのARR成長とStarshipのコスト低下で、IPOストーリーが現実味を帯びてきました。個人投資家は初日ギャップより二次流通のボラに注意。航空宇宙ETFより単体で見る派です。',
    ticker: 'SPACE', sentiment: 'bullish', tags: ['SpaceX', 'IPO'],
    likes: 186, hoursAgo: 1,
    comments: ['Starlinkの解約率が低いのが強みだと思います。', '評価額は夢ありすぎ？様子見派です。', 'RKLBとの比較もしたいですね。', 'IPO初日は触らず2週間後を見ます。'],
  },
  {
    author: 3, title: 'SpaceX IPOでテスラ株は連想買いか売り誘発か',
    content: 'イーロン関連の資金循環でTSLAはボラが拡大しがち。短期は話題分散、長期はエコシステム信頼の向上もあり得ると思います。サイズは半分が無難。',
    ticker: 'TSLA', sentiment: 'bearish', tags: ['SpaceX', 'テスラ'],
    likes: 124, hoursAgo: 3,
    comments: ['TSLAは決算まで様子見にします。', '連想売りが来たら拾うかも。', '相関が高すぎて怖いですね。'],
  },
  {
    author: 1, title: 'Starlink収益から逆算するSpaceXのざっくりDCF',
    content: '加入者×ARPUで2028年数百億ドル規模は射程。打ち上げコストが$100/kg台まで落ちれば宇宙物流のTAMが開きます。規制とAmazon Kuiperがリスク。',
    ticker: 'SPACE', sentiment: 'bullish', tags: ['SpaceX', 'Starlink'],
    likes: 98, hoursAgo: 5,
    comments: ['DCFの前提、どのくらいの成長率を入れましたか？', '規制リスクは織り込みが難しいですね。', '参考になります。'],
  },
  {
    author: 9, title: 'メタのクラウド参入はAWSに脅威になるのか',
    content: 'Meta Cloudはまず自社AIコストの償却が主目的。刺さる層は広告利用SMBとLlama採用スタートアップでは。エンタープライズではAWSが依然強い。',
    ticker: 'META', sentiment: 'bullish', tags: ['Meta', 'クラウド'],
    likes: 167, hoursAgo: 2,
    comments: ['第4のハイパースケーラーは難しくないですか？', '広告×AIのデータ優位は強い。', 'MSFTとの比較記事も欲しいです。', '発表直後は過熱しがちですね。'],
  },
  {
    author: 9, title: 'メタのAI設備投資は2026年がピークになる？',
    content: 'Capex増はFCFを圧迫。Google・MSFTも同様で、市場は成長投資か還元かで評価が割れます。Reels収益化が鈍ければ厳しい局面も。',
    ticker: 'META', sentiment: 'bearish', tags: ['Meta', 'AI'],
    likes: 88, hoursAgo: 7,
    comments: ['Capex/売上比率を毎四半期チェックしています。', '長期ではプラスだと思いますが短期は厳しい。'],
  },
  {
    author: 8, title: 'Llamaエコシステムの恩恵は半導体株に出る',
    content: 'オープンウェイト戦略はNVDA・AMDと推論チップ勢に追い風。日本株は冷却・電装の間接銘柄もテーマに入ります。',
    ticker: 'NVDA', sentiment: 'bullish', tags: ['Meta', 'AI', '半導体'],
    likes: 73, hoursAgo: 9,
    comments: ['銘柄リスト作ってる人羨ましいです。', '間接銘柄はボラも大きいので注意。'],
  },
  {
    author: 8, title: 'AIブームは終わったのか？2026年夏の温度感',
    content: 'テーマ株の横断リレーは終わり、収益のあるAIだけが残る選別フェーズ。NVDAガイダンスとハイパースケーラーCapexが鍵。物理制約（電力・冷却）の方が投資しやすいかも。',
    ticker: 'NVDA', sentiment: 'bearish', tags: ['AI'],
    likes: 241, hoursAgo: 1,
    comments: ['終わりではなく難易度が上がっただけ、同意です。', '電力関連にシフトしました。', 'アプリ層への資金移動は始まってますね。', 'バリューへのローテも進んでる感じ。', '3年持てる銘柄だけ、同感です。'],
  },
  {
    author: 0, title: 'エヌビディア決算後のAIトレードはもう薄い？',
    content: 'ビートでもガイダンスが期待下回りなら即売り。インフラ投資のフロントローディングが一段落すれば、アプリ層へ資金シフト。SOXXから個別へウェイト調整中。',
    ticker: 'NVDA', sentiment: 'bearish', tags: ['NVDA', 'AI'],
    likes: 112, hoursAgo: 4,
    comments: ['利確してバリューに回しました。', 'まだホールドですがサイズ半分。'],
  },
  {
    author: 4, title: 'AIテーマETFの組み替え（2026年版）',
    content: 'BOTZ/ROBO/AIQは重複多め。コアQQQ＋SMH＋SKYYに絞ると管理しやすい。NISAなら積立＋バンドリバランスが現実的。',
    ticker: 'BOTZ', sentiment: 'neutral', tags: ['ETF', 'AI'],
    likes: 56, hoursAgo: 12,
    comments: ['SMHの比率どのくらいですか？', '積立派です。'],
  },
  {
    author: 2, title: 'グロースからバリューへ — AI逃げのタイミング',
    content: '金利ピークアウト後は銀行・商社・エネルギーへ。AI電力需要でユーティリティまで絡む。全面逃避ではなく30%ディフェンシブ。',
    ticker: 'XLE', sentiment: 'bullish', tags: ['バリュー', 'ローテ'],
    likes: 64, hoursAgo: 10,
    comments: ['商社株、最近強いですね。', '30%ルール、参考にします。'],
  },
  {
    author: 1, title: 'FRB利下げ観測とグロース株 — AIは底堅い？',
    content: '長期金利低下はDCFに追い風。ただしインフレ再燃リスクは残る。マクロとAIの二軸で見るのが今年の基本。',
    ticker: 'SPY', sentiment: 'bullish', tags: ['マクロ', 'FRB'],
    likes: 79, hoursAgo: 8,
    comments: ['利下げは秋以降だと思います。', 'インフレデータ次第ですね。'],
  },
  {
    author: 6, title: 'SpaceX上場で小型宇宙株は連れ高になる？',
    content: 'RKLB・ASTSは既にコンセプトで動いている。本家IPOで資金が大型に集中し小型は売られるパターンも。イベントトレードはサイズ小さく。',
    ticker: 'RKLB', sentiment: 'neutral', tags: ['SpaceX', '宇宙'],
    likes: 51, hoursAgo: 14,
    comments: ['小型はギャンブル枠で。', 'RKLBは業績も見たい。'],
  },
  {
    author: 5, title: '配当ポートフォリオにAIを混ぜるべきか',
    content: '配当貴族＋AIサテライトはアリ。AI側は配当なしで総合利回りは下がる。成長枠AI・つみたて枠高配当の住み分けがきれい。',
    ticker: 'VYM', sentiment: 'neutral', tags: ['配当', 'AI'],
    likes: 42, hoursAgo: 18,
    comments: ['住み分け、自分もそうしてます。', '高配当だけだと成長が足りない悩み。'],
  },
  {
    author: 7, title: '日本株：AIデータセンター関連の装置・材料メモ',
    content: '冷却・電源・基板材料の国内サプライチェーンが再評価。米Capexサイクルと連動するのでドル円もセットで。',
    ticker: '6501', sentiment: 'bullish', tags: ['日本株', 'AI'],
    likes: 68, hoursAgo: 11,
    comments: ['サプライチェーン図、作ってみます。', '円安メリット大きいセクターですね。'],
  },
  {
    author: 3, title: '「AIは終わった」は毎年言われる — 歴史比較',
    content: 'インターネット・モバイルも毎回「終わった」と言われた。違いはスピード。保有期間を短くしすぎないこと。',
    ticker: 'QQQ', sentiment: 'bullish', tags: ['AI', '歴史'],
    likes: 95, hoursAgo: 6,
    comments: ['歴史は繰り返す…', '長期ホールド派です。', 'バブルと革命の違いは難しい。'],
  },
  {
    author: 10, title: 'メタ対アマゾン — クラウド×広告のハイブリッド比較',
    content: 'AWSが利益柱のAMZN、広告柱のMETA。近いのはGoogle。理解している収益源で選ぶべき。',
    ticker: 'AMZN', sentiment: 'neutral', tags: ['Meta', 'Amazon'],
    likes: 58, hoursAgo: 13,
    comments: ['GOOGとの3社比較が見たい。', '広告は景気敏感ですね。'],
  },
  {
    author: 0, title: 'Starship量産成功で打ち上げコストはどこまで下がる？',
    content: '完全再利用が当たり前になれば衛星コンステの経済性は一変。SpaceX IPOストーリーの核はここ。',
    ticker: 'SPACE', sentiment: 'bullish', tags: ['SpaceX', 'Starship'],
    likes: 82, hoursAgo: 9,
    comments: ['技術ニュース追うの大変…', 'でも投資の核心ですね。'],
  },
  {
    author: 8, title: 'AIエージェント課金 — 次の巨大収益源はどこ',
    content: 'シート課金から成果課金へ。ソフトウェア再評価に繋がるが2026後半の決算証明が必要。',
    ticker: 'MSFT', sentiment: 'bullish', tags: ['AI', 'SaaS'],
    likes: 91, hoursAgo: 5,
    comments: ['Copilotの浸透率が鍵。', '成果課金は測りにくい。'],
  },
  {
    author: 6, title: 'メタ決算当日の値動き — デイトレの注意点',
    content: '発表前買い・当日半分利確は定石だがCapex懸念でギャップダウンも。信用は使わず現物のみ。',
    ticker: 'META', sentiment: 'bearish', tags: ['Meta', 'デイトレ'],
    likes: 37, hoursAgo: 15,
    comments: ['ギャップダウン怖い…', '現物のみ、鉄則ですね。'],
  },
  {
    author: 11, title: 'AI電力需要と原子力・再エネ株の再評価',
    content: 'データセンター24/7稼働で再エネだけでは不足。原子力・ガス議論が戻る。テーマはAI終了ではなく物理制約へ。',
    ticker: 'CEG', sentiment: 'bullish', tags: ['AI', '電力'],
    likes: 104, hoursAgo: 7,
    comments: ['CEG注目してます。', '日本の再エネ株も動き出した。', '電力は長期ホールド向き。'],
  },
  {
    author: 4, title: '新NISAでSpaceX上場株は買える日が来る？',
    content: '米国上場すれば証券口座経由で可能だが評価額が高すぎるとNISA枠を食う。ETFや関連株で間接エクスポージャが現実的。',
    ticker: 'SPACE', sentiment: 'neutral', tags: ['SpaceX', 'NISA'],
    likes: 118, hoursAgo: 4,
    comments: ['枠がもったいないかも…', '関連ETFで十分かも。', '初日は触らない派。'],
  },
  {
    author: 1, title: '半導体サイクル — 在庫調整はもう底？',
    content: 'メモリ・先端ロジックの在庫は改善傾向。中国・地政学リスクは残る。NVDA一強から設備・材料へ分散。',
    ticker: 'ASML', sentiment: 'bullish', tags: ['半導体', 'AI'],
    likes: 63, hoursAgo: 16,
    comments: ['ASMLは長期で持ちたい。', 'サイクル底は見えにくい。'],
  },
  {
    author: 7, title: 'アップル中国販売23%増の読み方 — 全体は4%減',
    content: 'iPhone17サイクルと国産化シフトの影響。中国だけ強いのは一時要因も。為替とサービス収益の伸びをセットで見たい。',
    ticker: 'AAPL', sentiment: 'bullish', tags: ['アップル', '中国'],
    likes: 134, hoursAgo: 2,
    comments: ['中国リスクは常に意識。', 'サービス収益が支えますね。', '23%は印象的。', '全体市場減は無視できない。'],
  },
  {
    author: 10, title: 'ソフトバンクGとOpenAI — AI投資の次の一手',
    content: 'OpenAIへの投資キャリーが株価のドライバー。AIブーム後半はポートフォリオの質で勝負。Armとのシナジーも論点。',
    ticker: '9984', sentiment: 'bearish', tags: ['AI', '日本株'],
    likes: 89, hoursAgo: 8,
    comments: ['キャリー依存は怖い。', 'Armは別で見てます。', '議論の質が上がってきた感じ。'],
  },
  {
    author: 2, title: '円安進行で外資の日本株買いは続く？',
    content: '円安＋企業改革で外国人買いが続いている印象。ただし円急落後の政策介入リスクは常に。輸出とインバウンド両方の恩恵。',
    ticker: 'EWJ', sentiment: 'bullish', tags: ['日本株', '為替'],
    likes: 77, hoursAgo: 10,
    comments: ['介入来たら一気に調整？', '長期は日本株積立継続。'],
  },
  {
    author: 5, title: '高配当株でAI関連の間接エクスポージャを取る方法',
    content: '電力・通信の高配当株はデータセンター需要の恩恵を受けやすい。成長枠でNVDA、安定枠で電力、の二層構造。',
    ticker: 'T', sentiment: 'bullish', tags: ['配当', 'AI'],
    likes: 49, hoursAgo: 20,
    comments: ['二層構造、分かりやすい。', '通信株の配当利回り魅力的。'],
  },
  {
    author: 11, title: 'チャットGPTショッピング機能 — EC株への影響',
    content: '検索×購買の導線が変わる。AMZN以外にも小売・決済の再評価があり得る。まだ収益化は初期。',
    ticker: 'SHOP', sentiment: 'bearish', tags: ['AI', 'EC'],
    likes: 66, hoursAgo: 11,
    comments: ['AMZNへの影響が大きそう。', '初期段階なので様子見。'],
  },
  {
    author: 3, title: 'トランプ関税と半導体サプライチェーン — 2026年後半',
    content: '関税リスクで在庫積み増しが進むと一時的に需要が見える化。本質はサプライチェーンの多極化。台湾リスクヘッジは継続。',
    ticker: 'TSM', sentiment: 'bearish', tags: ['半導体', 'マクロ'],
    likes: 102, hoursAgo: 6,
    comments: ['在庫の見える化、勉強になります。', '多極化は長期トレンド。', 'TSMは難しいポジション。'],
  },
  {
    author: 8, title: 'OpenAIの収益化ペース — AIバブル議論の核心',
    content: 'ARRの伸びと推論コストの低下が噛み合えばまだ序章。合わなければマルチプル圧縮。アプリ課金の実績を四半期で追う。',
    ticker: 'MSFT', sentiment: 'neutral', tags: ['AI', 'OpenAI'],
    likes: 88, hoursAgo: 9,
    comments: ['ARRの数字、どこで見られますか？', 'コスト低下は確実に進んでる。'],
  },
  {
    author: 0, title: 'コミュニティ初書き込み — みなさんの注目テーマは？',
    content: 'SpaceX IPO、メタクラウド、AI後半の3本柱が熱いです。バッジ上げて議論に参加していきます。',
    ticker: 'TOPIC', sentiment: 'bullish', tags: ['コミュニティ'],
    likes: 45, hoursAgo: 24,
    comments: ['ようこそ！', 'AI後半の議論、盛り上がってますね。', 'SpaceX楽しみです。'],
  },

  // ── 2026年7月 ホットトピック ──────────────────────────────

  {
    author: 3, title: '骨太ショックで長期金利2.81% — 30年ぶり水準が示すもの',
    content: '政府の「骨太の方針」原案で財政拡大懸念→国債売り加速。3%が視野に入ると不動産ローン金利も跳ね、REITに逆風。メガバンクには利ザヤ改善で追い風。三菱UFJ/三井住友は年初来+30%超。配当も増配基調でコア持ち継続。',
    ticker: '8306', sentiment: 'bullish', tags: ['長期金利', '銀行株', '骨太ショック'],
    likes: 213, hoursAgo: 2,
    comments: ['メガバンクの増配ペースすごいですね。', '逆にREIT売りました…。', '金利3%になったら生活直撃。', '日銀と政府のチキンレース感。'],
  },
  {
    author: 1, title: '日銀7/30会合 — 追加利上げはあるのか',
    content: '6月に1.0%へ引き上げ後、次は据え置き派が多数。ただ円安160円台が続けば「為替配慮利上げ」の可能性も。市場はOISで25bp織り込み30%。円安×金利高は銀行・輸出にプラスだが、グロース株のバリュエーション圧縮が怖い。',
    ticker: 'JPY', sentiment: 'bearish', tags: ['日銀', '金利', '為替介入'],
    likes: 178, hoursAgo: 3,
    comments: ['7月は据え置きだと思う。', '円安がここまで来ると介入の方が先かも。', 'OIS30%は低くない。', 'グロース持ちはヘッジ欲しい。'],
  },
  {
    author: 7, title: '円安160円台 — 介入警戒ラインを整理する',
    content: 'ドル円160.87。財務省の「断固たる措置」発言は152-155の頃から出ていたが実弾なし。米財務長官との会談があった直後で、協調介入は否定的。単独介入でも一時的に5-7円は戻るが持続性は疑問。輸出・インバウンド株は円安享受中。',
    ticker: 'USDJPY', sentiment: 'neutral', tags: ['円安', 'ドル円', '為替介入'],
    likes: 156, hoursAgo: 4,
    comments: ['介入あっても押し目で拾いたい。', 'ドル建て資産が円換算で膨らんでうれしい半面…。', '海外旅行が高すぎる。'],
  },
  {
    author: 0, title: '海外勢9.7兆円買い越し — アベノミクス超えの意味',
    content: '2026年上半期、海外投資家の日本株買い越しが半期で過去最高。アベノミクス初動の2013年を超えた。背景は企業改革+AI半導体サプライチェーン+円安。「新顔マネー」（日本初投資のファンド）の流入が加速。この波はしばらく続くと見ます。',
    ticker: 'EWJ', sentiment: 'bullish', tags: ['海外投資家', '日本株', '過去最高'],
    likes: 192, hoursAgo: 1,
    comments: ['外国人が買ってるうちは安心感ある。', '9.7兆は凄い数字…', '企業改革が評価されてるのはポジティブ。', '高市政権の恩恵もありそう。', '逆に外国人が売りに転じたら怖い。'],
  },
  {
    author: 9, title: '個人待機資金16兆円 — 押し目は買い支えられる',
    content: '6月4週の個人買い越し9503億は過去最大。待機資金（MRFなど）は16兆円。つまり日本の個人はまだ余力を持っている。新NISA2年目の積立マネーと合わせて、下値は固いと見る。逆に言えば、入れない人が焦り始める天井シグナルでもある。',
    ticker: 'N225', sentiment: 'bullish', tags: ['個人投資家', '新NISA', '待機資金'],
    likes: 145, hoursAgo: 5,
    comments: ['積立の日が来るたびに自動購入されてる安心感。', '天井シグナルは盲点。', 'でも16兆全部が株に来るわけじゃない。'],
  },
  {
    author: 6, title: '新NISA積立2年目 — 枠をどう使い切る？',
    content: '成長投資枠240万＋つみたて枠120万。今年も半分使った人は後半でリバランスのチャンス。S&P500一本もいいが、日本株インデックスを20%混ぜると為替リスク分散になる。iDeCo限度額引き上げ検討中の情報もあり、制度変更にも注意。',
    ticker: 'NISA', sentiment: 'neutral', tags: ['新NISA', '積立投資', 'インデックス'],
    likes: 167, hoursAgo: 6,
    comments: ['枠使い切り派です！', 'オルカン一本で悩みゼロにしてる。', '日本株20%混ぜ、やってみようかな。', '成長投資枠は個別に使ってます。'],
  },
  {
    author: 11, title: 'セクターローテーション — 半導体→銀行・不動産の流れ',
    content: '7/3の急反発でも物色は拡散。TOPIX連日高値は幅広い買いの証拠。前半AI一本で来た人はバリューへのリバランスが吉。メガバンク、不動産、商社、自動車が出遅れ修正中。TOPIX型ETFの方がバランスが取れる局面。',
    ticker: 'TOPIX', sentiment: 'bullish', tags: ['セクターローテ', '銀行株', '不動産'],
    likes: 134, hoursAgo: 7,
    comments: ['TOPIX ETF買い増しました。', '商社は為替も味方。', '不動産は金利上昇で逆風じゃない？', '利ザヤ改善＞金利コスト上昇の銘柄を選別。'],
  },
  {
    author: 2, title: '東京エレクトロン・Kioxia — 日本半導体の主役交代',
    content: 'TEL(8035)はガイダンス引き上げ連発。Kioxia(285A)はメモリ回復＋AI需要でIPO後最高値圏。SUMCOはウェハー需給改善。日本の半導体は「装置・素材・メモリ」の三本柱。NVDAだけ見てると取りこぼす。',
    ticker: '8035', sentiment: 'bullish', tags: ['半導体', '東京エレクトロン', 'Kioxia'],
    likes: 188, hoursAgo: 3,
    comments: ['TELは決算のたびに上振れ。', 'Kioxiaはまだ割安感ある。', '日本の半導体装置、世界シェア高い。', 'SUMCOは配当もそこそこ。'],
  },
  {
    author: 4, title: '米国決算シーズン7/14開幕 — 注目ポイント整理',
    content: 'JPM/GS/MSから始まりMSFT/META/GOOGへ。焦点は①AI Capex継続のコミット②広告市場の健全性③NIM（純金利マージン）の方向。日本株への波及は半導体ガイダンスとドル円に直結。先回りより決算後の動きに乗る方が安全。',
    ticker: 'SPY', sentiment: 'neutral', tags: ['決算シーズン', '米国株', 'GAFAM'],
    likes: 121, hoursAgo: 8,
    comments: ['先回りせず決算後派です。', 'AI Capexの数字が全て。', 'GOOGの広告が一番気になる。', '金融株の決算も見逃せない。'],
  },
  {
    author: 10, title: '高配当×金利上昇 — メガバンクが最強？',
    content: '三菱UFJ(8306)配当利回り3%台+自社株買い。金利上昇で利ザヤ拡大。PBR1倍割れは解消されつつあり、企業改革の代表格。地銀も連れ高だが選別必要。高配当ポートに銀行30%は多すぎないバランス。',
    ticker: '8306', sentiment: 'bullish', tags: ['高配当', '銀行株', 'FIRE'],
    likes: 176, hoursAgo: 4,
    comments: ['増配＋自社株買い最強。', '地銀は地域差が大きい。', '配当再投資の複利効果実感中。', 'PBR1倍問題、やっと動き出した感じ。'],
  },
  {
    author: 5, title: '配当金生活への道 — 月3万円の不労所得を作る',
    content: '利回り4%で年36万＝元本900万。新NISAで非課税なら実質利回り+20%。高配当ETF(1489/1577)+個別(KDDI/JT/三菱商事)のハイブリッド型を実践中。株価下落時こそ利回りが上がるので、買い増しのチャンス到来。',
    ticker: '1489', sentiment: 'bullish', tags: ['配当金生活', 'FIRE', '高配当'],
    likes: 203, hoursAgo: 2,
    comments: ['月3万から始めて、今は月5万まで来ました。', '非課税の威力大きいですね。', 'JTの利回り安心感。', '900万は遠いけど積み重ね。', '下落が買い増しチャンス、心理的に難しいけど正解。'],
  },
  {
    author: 8, title: 'Nikkei YTD+37% — バブルか、新常態か',
    content: '日経平均年初来+37%。6連続で史上最高値更新は1989年以来。企業改革・円安・AI・海外資金の4要素が重なっている。バブルとの違いはPER水準（当時60倍、今20倍）とROE改善。調整は来るが、トレンド転換ではないと見る。',
    ticker: 'N225', sentiment: 'bullish', tags: ['日経平均', '最高値', 'バブル'],
    likes: 231, hoursAgo: 1,
    comments: ['PER20倍なら割高じゃない。', '1989年との比較、安心材料。', '調整来たら買い増し。', '37%はさすがに過熱感も…。', '企業の稼ぐ力が違う。'],
  },
  {
    author: 3, title: 'ソフトバンクG — OpenAI IPO延期リスクどう見る？',
    content: 'OpenAI上場延期報道でSBG(9984)に下げ圧力。ただしArm好調+ファンド含み益は健在。問題はAI投資のリターン可視化タイミング。マルチプルは割安だが、カタリスト不足。9000円割れなら打診買い。',
    ticker: '9984', sentiment: 'neutral', tags: ['ソフトバンク', 'OpenAI', 'AI投資'],
    likes: 108, hoursAgo: 9,
    comments: ['SBGはイベント株。', 'Armだけで十分な気も。', '9000円以下は買い場に見える。', 'IPO延期はサプライズだった。'],
  },
  {
    author: 7, title: 'トヨタ・自動車セクター — 円安メリットの代表',
    content: 'ドル円160台はトヨタの営業利益に数千億のプラス。ただしEVシフト遅れの評価は分かれる。短期は為替トレード、中期はハイブリッド戦略の正しさが証明されつつある。日産との比較で相対優位。',
    ticker: '7203', sentiment: 'bullish', tags: ['トヨタ', '円安', '自動車'],
    likes: 142, hoursAgo: 6,
    comments: ['ハイブリッド戦略が正解だった。', '為替が戻ったら利益も戻る怖さ。', '日産は厳しいですね…。', '配当も悪くない水準。'],
  },
  {
    author: 11, title: '高市政権と株式市場 — 企業改革加速の期待',
    content: '2月の大勝で政策実行力が上がった高市政権。法人減税・スタートアップ支援・防衛費増の三本柱。市場は「アベノミクス2.0」と評価。リスクは財政拡張→金利上昇のスパイラル。骨太ショックはまさにその警鐘。',
    ticker: 'N225', sentiment: 'bullish', tags: ['高市政権', '企業改革', 'アベノミクス'],
    likes: 119, hoursAgo: 10,
    comments: ['政策実行力は評価できる。', '財政と金利のバランスが課題。', 'スタートアップ支援の具体策に注目。'],
  },
  {
    author: 6, title: 'AI電力需要 × 原発再稼働 — エネルギー株の逆襲',
    content: 'データセンター24/7稼働でベースロード電力が必須。再エネだけでは不足→原発再稼働・ガス火力の議論が活発化。関西電力・九州電力・東北電力が恩恵。米国ではCEGが2倍。日本版データセンター電力テーマはまだ初期。',
    ticker: '9503', sentiment: 'bullish', tags: ['電力株', 'AI電力', '原発再稼働'],
    likes: 97, hoursAgo: 12,
    comments: ['電力は長期テーマとして有望。', '原発再稼働の政治リスクは？', 'CEGみたいな急騰期待。'],
  },
  {
    author: 1, title: '金(ゴールド)4187ドル — インフレヘッジか過熱か',
    content: 'ゴールドが$4,187。中央銀行の買い+地政学リスク+インフレ懸念の三重奏。ドル建てだと円安効果で円建てはさらに上。純金積立やETF(1540)で保有比率5-10%は合理的。',
    ticker: '1540', sentiment: 'bullish', tags: ['ゴールド', 'インフレ', '分散投資'],
    likes: 84, hoursAgo: 14,
    comments: ['5%くらい持ってます。', '円建てだとさらに上がって見える。', '利息がないのが唯一の弱点。'],
  },
  {
    author: 4, title: '商社株 — バフェット効果+資源高+円安のトリプル恩恵',
    content: '三菱商事・伊藤忠・三井物産。バフェットが買い増し報道の度に上昇。資源価格は底堅く、円安で海外利益膨張。PERは割安水準のまま。配当+自社株買い=株主還元が充実。長期コアポジション候補。',
    ticker: '8058', sentiment: 'bullish', tags: ['商社株', 'バフェット', '高配当'],
    likes: 163, hoursAgo: 5,
    comments: ['バフェット銘柄は安心感。', '資源の波があるけど分散されてる。', '伊藤忠のROEが光る。', '配当+成長で完璧に近い。'],
  },
  {
    author: 2, title: 'イオン急反発+4% — 出遅れ株の逆襲が始まった',
    content: '年初来ワーストパフォーマーだったイオンが突如+4%。セクターローテの典型。AI一辺倒からの資金分散で、出遅れ内需株に物色が向かっている。薬王堂・ツルハなどドラッグストアも同じ文脈。',
    ticker: '8267', sentiment: 'bullish', tags: ['出遅れ株', 'セクターローテ', '内需'],
    likes: 78, hoursAgo: 11,
    comments: ['イオン持ってたけど報われた。', '内需はディフェンシブで安心。', 'ドラッグストアも面白い。'],
  },
  {
    author: 10, title: '今週の振り返り — 7/3のV字回復はどう読む？',
    content: '日経-1100から+1000へのV字。半導体売り→バリュー買いの二段ロケット。「買い場を探してた資金」が一気に入った印象。TOPIX5連騰・ボラ指数3ヶ月ぶり低水準。来週のリスクは米CPI＋日銀発言。ポジション調整は先にやっておきたい。',
    ticker: 'N225', sentiment: 'bullish', tags: ['週間振り返り', '急反発', 'ボラティリティ'],
    likes: 198, hoursAgo: 1,
    comments: ['朝の-1100で焦ったけど持って正解だった。', 'V字すぎてエントリーできず…。', '来週のCPIが波乱要因。', '3ヶ月ぶりの低ボラ、落ち着いてきた。', 'ポジション整理は同意です。'],
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
  let userId = await findUserIdByEmail(email)
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: `MmSeed!${persona.name.length}99`,
      email_confirm: true,
      user_metadata: { full_name: persona.name, display_name: persona.name, seed: SEED_MARKER },
    })
    if (error) throw error
    userId = data.user.id
    console.log(`  created user ${persona.name}`)
  }

  await admin.from('user_profiles').upsert({
    user_id: userId,
    nickname: persona.name,
    full_name: persona.name,
  }, { onConflict: 'user_id' })

  const level = persona.exp >= 6000 ? 5 : persona.exp >= 2500 ? 4 : persona.exp >= 900 ? 3 : persona.exp >= 300 ? 2 : 1
  await admin.from('lounge_character_stats').upsert({
    user_id: userId,
    total_exp: persona.exp,
    level,
    character_stage: level,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  return { userId, name: persona.name }
}

async function findSeedPostIds() {
  const ids = new Set()
  const { data: byContent } = await admin
    .from('lounge_posts')
    .select('id')
    .ilike('content', `%${SEED_MARKER}%`)
  for (const row of byContent || []) ids.add(row.id)

  // Fallback: seed personas within this batch's postedAt window
  const times = POSTS.map((p) => new Date(p.postedAt).getTime()).filter(Number.isFinite)
  if (times.length) {
    const minAt = new Date(Math.min(...times) - 60_000).toISOString()
    const maxAt = new Date(Math.max(...times) + 60_000).toISOString()
    const authorEmails = new Set(POSTS.map((p) => PERSONAS[p.author]?.email).filter(Boolean))
    const authorIds = []
    for (const persona of PERSONAS) {
      if (!authorEmails.has(persona.email)) continue
      const id = await findUserIdByEmail(persona.email.toLowerCase())
      if (id) authorIds.push(id)
    }
    if (authorIds.length) {
      const { data: byWindow } = await admin
        .from('lounge_posts')
        .select('id')
        .in('author_id', authorIds)
        .gte('created_at', minAt)
        .lte('created_at', maxAt)
      for (const row of byWindow || []) ids.add(row.id)
    }
  }
  return [...ids]
}

async function purgeAndHide() {
  const seedIds = await findSeedPostIds()
  if (seedIds.length > 0 && !DRY_RUN) {
    await admin.from('lounge_comments').delete().in('post_id', seedIds)
    await admin.from('lounge_post_tags').delete().in('post_id', seedIds)
    await admin.from('lounge_post_likes').delete().in('post_id', seedIds)
    await admin.from('lounge_post_bookmarks').delete().in('post_id', seedIds)
    await admin.from('lounge_posts').delete().in('id', seedIds)
    console.log(`  removed ${seedIds.length} old seed posts`)
  }

  // Keep real user posts visible — only remove old seed posts
  // (previously this hid all non-seed posts, which buried user content)
}

function pickExtraComments(count, seed) {
  const out = []
  for (let i = 0; i < count; i += 1) {
    out.push(COMMENT_POOL[(seed + i) % COMMENT_POOL.length])
  }
  return out
}

async function seedPosts(personaMap) {
  if (REPLACE) await purgeAndHide()
  else {
    const existing = await findSeedPostIds()
    if (existing.length) {
      console.log('Seed exists. Use --replace to rebuild.')
      return { posts: 0, comments: 0 }
    }
  }

  let inserted = 0
  let commentCount = 0

  for (let i = 0; i < POSTS.length; i += 1) {
    const row = POSTS[i]
    const persona = PERSONAS[row.author]
    const mapped = personaMap.get(persona.email)
    if (!mapped) continue

    const createdAt = new Date(Date.now() - row.hoursAgo * 3600 * 1000).toISOString()
    const commentTexts = [
      ...(row.comments || []),
      ...pickExtraComments(Math.max(0, 3 - (row.comments?.length || 0)), i),
    ]
    const commentTotal = commentTexts.length
    const hotScore = row.likes * 2 + commentTotal * 3 + Math.max(0, 200 - row.hoursAgo * 8)
    const content = String(row.content || '')

    const payload = {
      author_id: mapped.userId,
      author_name: mapped.name,
      title: row.title,
      content,
      ticker: row.ticker || null,
      asset_type: 'stock',
      sentiment: row.sentiment || 'neutral',
      like_count: row.likes,
      comment_count: commentTotal,
      bookmark_count: Math.floor(row.likes / 10),
      view_count: row.likes * 15 + commentTotal * 40,
      hot_score: hotScore,
      status: 'published',
      created_at: createdAt,
      updated_at: createdAt,
    }

    if (DRY_RUN) {
      console.log(`[dry-run] ${row.title} (+${commentTotal} comments)`)
      inserted += 1
      commentCount += commentTotal
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

    for (let c = 0; c < commentTexts.length; c += 1) {
      const commentAuthor = PERSONAS[(row.author + c + 1) % PERSONAS.length]
      const commentMapped = personaMap.get(commentAuthor.email)
      if (!commentMapped) continue
      const commentAt = new Date(Date.now() - row.hoursAgo * 3600 * 1000 + (c + 1) * 600000).toISOString()
      await admin.from('lounge_comments').insert({
        post_id: post.id,
        author_id: commentMapped.userId,
        author_name: commentMapped.name,
        content: commentTexts[c],
        status: 'published',
        created_at: commentAt,
        updated_at: commentAt,
      })
      commentCount += 1
    }

    inserted += 1
  }

  return { posts: inserted, comments: commentCount }
}

async function main() {
  console.log(DRY_RUN ? 'Dry run' : REPLACE ? 'Replace seed content…' : 'Seeding…')
  const personaMap = new Map()
  for (const persona of PERSONAS) {
    const mapped = await ensurePersona(persona)
    personaMap.set(persona.email, mapped)
  }
  const { posts, comments } = await seedPosts(personaMap)
  console.log(`Done. ${posts} posts, ${comments} comments.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
