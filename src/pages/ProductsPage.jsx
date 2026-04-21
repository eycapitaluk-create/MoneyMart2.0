import { useEffect, useMemo, useState } from 'react'
import { trackAffiliateClick } from '../lib/affiliateTracking'

const CATS = [
  { id: 'all', label: 'すべて' },
  { id: 'stocks', label: '証券・投資' },
  { id: 'card', label: 'クレジットカード' },
  { id: 'loan', label: 'ローン・融資' },
  { id: 'insurance', label: '保険' },
  { id: 'other', label: 'その他' },
]

const ICONS = { stocks: '📈', card: '💳', loan: '🏦', insurance: '🛡️', other: '💡' }

const PRODUCTS = [
  { id: 1, cat: 'stocks', name: '松井証券の魅力、まずはお試しください。', company: '松井証券株式会社', fee: '¥0〜', feeNote: '国内株手数料', highlights: ['株式・先物・投資信託など幅広い商品に対応', 'NISA口座でも利用可能', 'Webで簡単に口座開設（無料）'], keyPoints: ['1日の約定代金合計50万円まで手数料0円', '25歳以下の株式取引手数料が無料', 'NISA株式取引手数料は恒久無料', '豊富な無料情報ツールと安心サポート体制'], bannerImage: 'https://www27.a8.net/svt/bgt?aid=260409225251&wid=001&eno=01&mid=s00000018318001088000&mc=1', bannerWidth: 468, bannerHeight: 60, detailUrl: 'https://px.a8.net/svt/ejp?a8mat=4B1H1L+45FTMA+3XCC+6H729', impressionPixelUrl: 'https://www13.a8.net/0.gif?a8mat=4B1H1L+45FTMA+3XCC+6H729', tags: ['nisa', 'web'], popular: true },
  { id: 2, cat: 'stocks', name: '松井証券ではじめる【iDeCo】', company: '松井証券株式会社', fee: '¥0', feeNote: '運営管理手数料', highlights: ['運営管理手数料が0円', '低コスト商品40種類を用意', 'iDeCoも対象の投信残高ポイントサービス'], keyPoints: ['運営管理手数料がどなたでも無料', 'eMAXIS Slimシリーズ等の低コスト商品', '投信残高ポイントサービスで長期運用を支援', '初心者から経験者まで使いやすいサポート体制'], bannerImage: 'https://www25.a8.net/svt/bgt?aid=260409225252&wid=001&eno=01&mid=s00000018318002007000&mc=1', bannerWidth: 468, bannerHeight: 60, detailUrl: 'https://px.a8.net/svt/ejp?a8mat=4B1H1L+461982+3XCC+BY641', impressionPixelUrl: 'https://www16.a8.net/0.gif?a8mat=4B1H1L+461982+3XCC+BY641', tags: ['nisa', 'web'], popular: false },
  { id: 3, cat: 'other', name: '商品券をクレジットカードで購入！【金券ねっと】', company: '金券ねっと', fee: '即日発送可', feeNote: 'クレジット決済対応', highlights: ['日本最大級の商品券通販サイト', '新規購入でQUOカード特典キャンペーン', '本人確認・サポート体制を整備'], keyPoints: ['クレジットカードで商品券を購入可能', '即日発送対応で急ぎの利用にも便利', '実績ある運営で安心して利用しやすい', '30代〜50代利用者を中心に幅広く利用'], bannerImage: '/kinken-net-a8-banner-320x50.png', bannerWidth: 320, bannerHeight: 50, detailUrl: 'https://px.a8.net/svt/ejp?a8mat=4B1H1N+EAZZ1U+3J2Q+609HT', impressionPixelUrl: 'https://www15.a8.net/0.gif?a8mat=4B1H1N+EAZZ1U+3J2Q+609HT', tags: ['web'], popular: false },
  { id: 4, cat: 'stocks', name: 'auカブコム証券', company: 'auカブコム証券', fee: '¥99〜', feeNote: '取引手数料', highlights: ['Pontaポイント活用', '自動売買ツール', 'NISA対応'], tags: ['nisa', 'web'], popular: false },
  { id: 5, cat: 'stocks', name: '楽天証券 iSPEED', company: '楽天証券', fee: '¥0', feeNote: '手数料0円コース', highlights: ['楽天ポイントで投資可能', 'マネーブリッジ連携', '米国株3,800銘柄対応'], tags: ['nisa', 'web'], popular: false },
  { id: 6, cat: 'stocks', name: 'DMM 株', company: 'DMM.com証券', fee: '¥88〜', feeNote: '国内株手数料', highlights: ['使いやすい取引画面', '米国株にも対応', 'キャンペーン豊富'], tags: ['web'], popular: false },
  { id: 7, cat: 'stocks', name: 'GMOクリック証券 株', company: 'GMOクリック証券', fee: '¥90〜', feeNote: '取引手数料', highlights: ['アプリ機能が充実', 'IPO取扱あり', '信用取引対応'], tags: ['web'], popular: false },
  { id: 8, cat: 'stocks', name: '岡三オンライン', company: '岡三オンライン', fee: '¥108〜', feeNote: '現物取引手数料', highlights: ['情報ツールが豊富', '日本株中心に強い', 'NISA口座対応'], tags: ['nisa', 'web'], popular: false },
  { id: 9, cat: 'stocks', name: 'SMBC日興証券 総合', company: 'SMBC日興証券', fee: '¥137〜', feeNote: 'ダイレクトコース', highlights: ['大手総合証券の安心感', 'IPO実績豊富', '相談窓口あり'], tags: ['web'], popular: false },
  { id: 10, cat: 'stocks', name: '野村證券 オンライン', company: '野村證券', fee: '¥152〜', feeNote: 'オンライン手数料', highlights: ['大型銘柄情報が豊富', 'レポートが充実', 'サポート体制あり'], tags: ['web'], popular: false },

  { id: 11, cat: 'card', name: '楽天カード', company: '楽天カード', fee: '¥0', feeNote: '年会費永年無料', highlights: ['楽天ポイント還元率1%（楽天市場で3%以上）', '楽天証券でポイント投資が可能', '新規入会で楽天ポイントプレゼント'], keyPoints: ['年会費永年無料', '楽天ポイント還元率1%（楽天市場で3%以上）', '楽天証券でポイント投資が可能', '新規入会で楽天ポイントプレゼント'], detailUrl: 'https://www.rakuten-card.co.jp/card/rakuten-card/', tags: ['free', 'web'], popular: true },
  { id: 12, cat: 'card', name: 'PayPayカード', company: 'PayPayカード', fee: '¥0', feeNote: '年会費永年無料', highlights: ['PayPay連携で便利', 'Yahoo!ショッピング特典', 'タッチ決済対応'], tags: ['free', 'web'], popular: false },
  { id: 13, cat: 'card', name: 'エポスカード', company: '丸井グループ', fee: '¥0', feeNote: '年会費永年無料', highlights: ['海外旅行傷害保険', 'マルイ優待', 'ゴールド招待制度'], tags: ['free'], popular: false },
  { id: 14, cat: 'card', name: '三井住友カード（NL）', company: '三井住友カード', fee: '¥0', feeNote: '年会費永年無料', highlights: ['コンビニ・飲食店で最大7%ポイント還元', 'ナンバーレスで安心セキュリティ', 'SBI証券との連携でクレカ積立可能'], keyPoints: ['年会費永年無料', 'コンビニ・飲食店で最大7%ポイント還元', 'ナンバーレスで安心セキュリティ', 'SBI証券との連携でクレカ積立可能'], detailUrl: 'https://www.smbc-card.com/nyukai/card/numberless.jsp', tags: ['free', 'web'], popular: true },
  { id: 15, cat: 'card', name: 'JCBカードW', company: 'JCB', fee: '¥0', feeNote: '年会費永年無料', highlights: ['39歳以下限定申込（40歳以降も無料継続）', '基本還元率1%（JCB一般の2倍）', 'Amazon・スタバで還元率UP', '海外旅行傷害保険付帯'], keyPoints: ['年会費永年無料（39歳以下限定申込）', '基本還元率1%（JCB一般の2倍）', 'Amazon・スタバで還元率UP', '海外旅行傷害保険付帯'], detailUrl: 'https://www.jcb.co.jp/ordercard/kojin_card/os_card_w.html', tags: ['free', 'web'], popular: false },
  { id: 16, cat: 'card', name: 'dカード', company: 'NTTドコモ', fee: '¥0', feeNote: '年会費無料', highlights: ['dポイントが貯まる', '携帯料金連携', '街のお店で使いやすい'], tags: ['free'], popular: false },
  { id: 17, cat: 'card', name: 'イオンカードセレクト', company: 'イオンフィナンシャル', fee: '¥0', feeNote: '年会費無料', highlights: ['イオングループ特典', 'WAON一体型', '公共料金支払いでも活用'], tags: ['free'], popular: false },
  { id: 18, cat: 'card', name: 'セゾンパール・アメックス', company: 'クレディセゾン', fee: '¥0〜', feeNote: '実質年会費無料', highlights: ['QUICPayで高還元', '即日発行対応', 'アメックスブランド'], tags: ['free', 'web'], popular: false },
  { id: 19, cat: 'card', name: 'Orico Card THE POINT', company: 'オリエントコーポレーション', fee: '¥0', feeNote: '年会費無料', highlights: ['入会後6か月高還元', 'ネットショッピング連携', 'iD/QUICPay搭載'], tags: ['free', 'web'], popular: false },
  { id: 20, cat: 'card', name: 'リクルートカード', company: 'リクルート', fee: '¥0', feeNote: '年会費無料', highlights: ['高還元率で人気', 'じゃらん・ホットペッパー連携', '電子マネー対応'], tags: ['free', 'web'], popular: false },

  { id: 21, cat: 'loan', name: 'アコム カードローン', company: 'アコム株式会社', fee: '3.0〜18.0%', feeNote: '実質年率', highlights: ['最短20分で審査', '初回30日無利息', 'アプリで管理可能'], tags: ['instant', 'web'], popular: false },
  { id: 22, cat: 'loan', name: 'SMBCモビット', company: 'SMBCコンシューマーファイナンス', fee: '3.0〜18.0%', feeNote: '実質年率', highlights: ['Web完結申込', '書類郵送不要', 'スマホで借入返済'], tags: ['instant', 'web'], popular: true },
  { id: 23, cat: 'loan', name: 'プロミス', company: 'SMBCコンシューマーファイナンス', fee: '4.5〜17.8%', feeNote: '実質年率', highlights: ['最短即日融資', '30日間利息0円', 'アプリローン対応'], tags: ['instant', 'web'], popular: false },
  { id: 24, cat: 'loan', name: 'レイク', company: '新生フィナンシャル', fee: '4.5〜18.0%', feeNote: '実質年率', highlights: ['選べる無利息期間', 'Web申込が簡単', '最短即日対応'], tags: ['instant', 'web'], popular: false },
  { id: 25, cat: 'loan', name: 'アイフル', company: 'アイフル株式会社', fee: '3.0〜18.0%', feeNote: '実質年率', highlights: ['最短18分審査', '無担保ローン', '来店不要'], tags: ['instant', 'web'], popular: false },
  { id: 26, cat: 'loan', name: '三井住友銀行 カードローン', company: '三井住友銀行', fee: '1.5〜14.5%', feeNote: '実質年率', highlights: ['銀行系の安心感', 'ATM利用しやすい', '口座保有者優遇'], tags: ['web'], popular: false },
  { id: 27, cat: 'loan', name: 'みずほ銀行 カードローン', company: 'みずほ銀行', fee: '2.0〜14.0%', feeNote: '実質年率', highlights: ['銀行口座連携', '低めの上限金利', 'スマホ完結申込'], tags: ['web'], popular: false },
  { id: 28, cat: 'loan', name: '楽天銀行 スーパーローン', company: '楽天銀行', fee: '1.9〜14.5%', feeNote: '実質年率', highlights: ['楽天会員ランク優遇', 'ネット申込完結', '利用限度額が広い'], tags: ['web'], popular: false },
  { id: 29, cat: 'loan', name: '住信SBIネット銀行 カードローン', company: '住信SBIネット銀行', fee: '1.89〜14.79%', feeNote: '実質年率', highlights: ['ネット銀行ならでは', '条件で金利優遇', 'Web完結'], tags: ['web'], popular: false },
  { id: 30, cat: 'loan', name: 'auじぶん銀行 カードローン', company: 'auじぶん銀行', fee: '1.48〜17.5%', feeNote: '実質年率', highlights: ['auユーザー優遇', 'アプリ連携', '来店不要'], tags: ['web', 'instant'], popular: false },

  { id: 31, cat: 'insurance', name: 'SBI生命 定期保険', company: 'SBI生命保険', fee: '¥800〜', feeNote: '月額目安', highlights: ['ネット完結申込', 'シンプル保障', '健康告知のみ'], tags: ['web'], popular: false },
  { id: 32, cat: 'insurance', name: 'チューリッヒ 自動車保険', company: 'チューリッヒ保険会社', fee: '見積無料', feeNote: '条件により変動', highlights: ['ネット割引あり', '24時間ロードサービス', '弁護士費用特約'], tags: ['web'], popular: false },
  { id: 33, cat: 'insurance', name: 'アクサダイレクト 自動車保険', company: 'アクサ損害保険', fee: '見積無料', feeNote: '条件により変動', highlights: ['インターネット割引', '事故対応サポート', 'ロードサービス付き'], tags: ['web'], popular: false },
  { id: 34, cat: 'insurance', name: 'ソニー損保 自動車保険', company: 'ソニー損害保険', fee: '見積無料', feeNote: '走行距離で変動', highlights: ['走行距離連動型', '24時間事故受付', '保険料の透明性'], tags: ['web'], popular: false },
  { id: 35, cat: 'insurance', name: '三井ダイレクト損保', company: '三井ダイレクト損保', fee: '見積無料', feeNote: '条件により変動', highlights: ['ネット型で割安', '弁護士費用特約', 'ロードサービス'], tags: ['web'], popular: false },
  { id: 36, cat: 'insurance', name: 'ライフネット生命 かぞくへの保険', company: 'ライフネット生命', fee: '¥1,000〜', feeNote: '月額目安', highlights: ['オンライン申込', '保険料がわかりやすい', '定期保険中心'], tags: ['web'], popular: false },
  { id: 37, cat: 'insurance', name: 'メットライフ生命 終身保険', company: 'メットライフ生命', fee: '¥2,000〜', feeNote: '月額目安', highlights: ['長期保障', '保険設計相談可', '幅広いプラン'], tags: ['web'], popular: false },
  { id: 38, cat: 'insurance', name: 'オリックス生命 医療保険', company: 'オリックス生命', fee: '¥1,500〜', feeNote: '月額目安', highlights: ['入院・手術保障', '特約カスタム可能', 'ネット資料請求'], tags: ['web'], popular: false },
  { id: 39, cat: 'insurance', name: 'FWD医療', company: 'FWD生命', fee: '¥1,300〜', feeNote: '月額目安', highlights: ['シンプル設計', '先進医療特約', 'ネット相談対応'], tags: ['web'], popular: false },
  { id: 40, cat: 'insurance', name: '県民共済 生命共済', company: '都道府県民共済', fee: '¥1,000〜', feeNote: '掛金目安', highlights: ['手頃な掛金', '基本保障重視', '地域窓口あり'], tags: ['web'], popular: false },

  { id: 41, cat: 'other', name: 'Money Forward ME プレミアム', company: 'マネーフォワード', fee: '¥500', feeNote: '月額（年払いあり）', highlights: ['金融口座連携が豊富', '資産推移グラフ', '自動家計簿'], tags: ['web'], popular: false },
  { id: 42, cat: 'other', name: 'Zaim プレミアム', company: 'Zaim', fee: '¥440', feeNote: '月額', highlights: ['家計簿自動化', 'レシート読取', 'カテゴリ分析'], tags: ['web'], popular: false },
  { id: 43, cat: 'other', name: 'マネーツリー Grow', company: 'Moneytree', fee: '¥360', feeNote: '月額', highlights: ['資産一元管理', '投資口座連携', '通知機能'], tags: ['web'], popular: false },
  { id: 44, cat: 'other', name: '弥生会計 オンライン', company: '弥生株式会社', fee: '¥1,000〜', feeNote: '月額プラン', highlights: ['クラウド会計', '請求書作成', '確定申告サポート'], tags: ['web'], popular: false },
  { id: 45, cat: 'other', name: 'freee会計', company: 'freee株式会社', fee: '¥1,180〜', feeNote: '月額プラン', highlights: ['会計業務自動化', '口座連携', '経営レポート'], tags: ['web'], popular: false },
  { id: 46, cat: 'other', name: 'GMO外貨 FX口座', company: 'GMO外貨', fee: '0.2銭〜', feeNote: 'ドル円スプレッド', highlights: ['多通貨ペア', '取引ツール充実', 'Web完結口座開設'], tags: ['web', 'instant'], popular: false },
  { id: 47, cat: 'other', name: '外為どっとコム FX', company: '外為どっとコム', fee: '0.2銭〜', feeNote: 'ドル円スプレッド', highlights: ['情報コンテンツ豊富', '初心者向けセミナー', '取引ツール対応'], tags: ['web', 'instant'], popular: false },
  { id: 48, cat: 'other', name: 'みんなのFX', company: 'トレイダーズ証券', fee: '0.2銭〜', feeNote: 'ドル円スプレッド', highlights: ['低スプレッド', 'スワップ実績', '自動売買対応'], tags: ['web', 'instant'], popular: false },
  { id: 49, cat: 'other', name: 'LINE証券 つみたて', company: 'LINE証券', fee: '¥0〜', feeNote: '取引手数料', highlights: ['LINE連携で使いやすい', '少額投資対応', '初心者向けUI'], tags: ['web', 'nisa'], popular: false },
  { id: 50, cat: 'other', name: 'PayPay資産運用', company: 'PayPay証券', fee: '¥0〜', feeNote: '取引手数料', highlights: ['PayPayアプリ連携', '少額から運用', '簡単な積立設定'], tags: ['web', 'nisa'], popular: false },
]

/** カテゴリごとに意味のある条件。「すべて」は横断タグ（NISA 等）で絞り込み可能にする */
const FILTERS_BY_CAT = {
  all: [
    { id: 'nisa', label: 'NISA対応' },
    { id: 'free', label: '年会費無料' },
    { id: 'instant', label: '即日審査' },
    { id: 'web', label: 'Web完結' },
  ],
  stocks: [
    { id: 'nisa', label: 'NISA対応' },
    { id: 'web', label: 'Web完結' },
  ],
  card: [
    { id: 'free', label: '年会費無料' },
    { id: 'web', label: 'Web完結' },
  ],
  loan: [
    { id: 'instant', label: '即日審査' },
    { id: 'web', label: 'Web完結' },
  ],
  insurance: [
    { id: 'web', label: 'Web完結' },
  ],
  other: [
    { id: 'nisa', label: 'NISA対応' },
    { id: 'instant', label: '即日審査' },
    { id: 'web', label: 'Web完結' },
  ],
}

function getFiltersForCategory(catId) {
  if (!catId) return FILTERS_BY_CAT.all
  return FILTERS_BY_CAT[catId] || FILTERS_BY_CAT.all
}

const TAG_STYLE = {
  nisa: { bg: '#EFF6FF', color: '#1D4ED8', label: 'NISA対応' },
  free: { bg: '#F0FDF4', color: '#15803D', label: '年会費無料' },
  instant: { bg: '#FFF7ED', color: '#C2410C', label: '即日審査' },
  web: { bg: '#F5F3FF', color: '#6D28D9', label: 'Web完結' },
}

const ICON_BG = { stocks: '#EFF6FF', card: '#F0FDF4', loan: '#FFFBEB', insurance: '#FFF1F2', other: '#F5F3FF' }

const A8_LINKS = {
  // stocks
  1: import.meta.env.VITE_A8_MATSUI_SECURITIES || 'https://px.a8.net/svt/ejp?a8mat=4B1H1L+45FTMA+3XCC+6H729',
  2: import.meta.env.VITE_A8_MATSUI_IDECO || 'https://px.a8.net/svt/ejp?a8mat=4B1H1L+461982+3XCC+BY641',
  5: import.meta.env.VITE_A8_RAKUTEN_SECURITIES || '',
  3: import.meta.env.VITE_A8_KINKEN_NET || 'https://px.a8.net/svt/ejp?a8mat=4B1H1N+EAZZ1U+3J2Q+609HT',
  // cards
  11: import.meta.env.VITE_A8_RAKUTEN_CARD || '',
  12: import.meta.env.VITE_A8_PAYPAY_CARD || '',
  13: import.meta.env.VITE_A8_EPOS || '',
  // loans
  21: import.meta.env.VITE_A8_ACOM || '',
  22: import.meta.env.VITE_A8_SMBC_MOBIT || '',
  // insurance
  31: import.meta.env.VITE_A8_SBI_LIFE || '',
  32: import.meta.env.VITE_A8_ZURICH || '',
  // other
  41: import.meta.env.VITE_A8_MONEYFORWARD || '',
  46: import.meta.env.VITE_A8_GMO_GAIGA || '',
}

const OFFICIAL_LINKS = {
  1: 'https://www.matsui.co.jp/',
  2: 'https://www.matsui.co.jp/ideco/',
  3: 'https://kinken-net.jp/',
  4: 'https://kabu.com/',
  5: 'https://www.rakuten-sec.co.jp/',
  6: 'https://kabu.dmm.com/',
  7: 'https://www.click-sec.com/',
  8: 'https://www.okasan-online.co.jp/',
  9: 'https://www.smbcnikko.co.jp/',
  10: 'https://www.nomura.co.jp/',
  11: 'https://www.rakuten-card.co.jp/card/rakuten-card/',
  12: 'https://www.paypay-card.co.jp/',
  13: 'https://www.eposcard.co.jp/',
  14: 'https://www.smbc-card.com/nyukai/card/numberless.jsp',
  15: 'https://www.jcb.co.jp/ordercard/kojin_card/os_card_w.html',
  16: 'https://dcard.docomo.ne.jp/',
  17: 'https://www.aeon.co.jp/card/',
  18: 'https://www.saisoncard.co.jp/',
  19: 'https://www.orico.co.jp/creditcard/thepoint/',
  20: 'https://recruit-card.jp/',
  21: 'https://www.acom.co.jp/',
  22: 'https://www.mobit.ne.jp/',
  23: 'https://cyber.promise.co.jp/',
  24: 'https://lakealsa.com/',
  25: 'https://www.aiful.co.jp/',
  26: 'https://www.smbc.co.jp/kojin/cardloan/',
  27: 'https://www.mizuhobank.co.jp/loan_card/',
  28: 'https://www.rakuten-bank.co.jp/loan/cardloan/',
  29: 'https://www.netbk.co.jp/contents/lineup/card-loan/',
  30: 'https://www.jibunbank.co.jp/products/card_loan/',
  31: 'https://www.sbilife.co.jp/',
  32: 'https://www.zurich.co.jp/',
  33: 'https://www.axa-direct.co.jp/',
  34: 'https://www.sonysonpo.co.jp/',
  35: 'https://www.mitsui-direct.co.jp/',
  36: 'https://www.lifenet-seimei.co.jp/',
  37: 'https://www.metlife.co.jp/',
  38: 'https://www.orixlife.co.jp/',
  39: 'https://www.fwdlife.co.jp/',
  40: 'https://www.kyosai-cc.or.jp/',
  41: 'https://moneyforward.com/me/',
  42: 'https://zaim.net/',
  43: 'https://moneytree.jp/',
  44: 'https://www.yayoi-kk.co.jp/',
  45: 'https://www.freee.co.jp/',
  46: 'https://www.gaikaex.com/',
  47: 'https://www.gaitame.com/',
  48: 'https://min-fx.jp/',
  49: 'https://line-sec.co.jp/',
  50: 'https://www.paypay-sec.co.jp/',
}

const resolveOutboundLink = (productId) => {
  const a8 = String(A8_LINKS[productId] || '').trim()
  if (/^https?:\/\//i.test(a8)) return a8
  return OFFICIAL_LINKS[productId] || '#'
}

function isConfiguredA8Link(productId) {
  const a8 = String(A8_LINKS[productId] || '').trim()
  return /^https?:\/\//i.test(a8)
}

function openProductOutbound(product, source = 'products_page') {
  const url = resolveOutboundLink(product.id)
  if (isConfiguredA8Link(product.id)) {
    trackAffiliateClick({
      product: {
        id: product.id,
        name: product.name,
        provider: product.company,
        ad_provider: 'a8',
        affiliate_url: url,
      },
      source,
    })
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

const HAS_ANY_A8_LINK = Object.keys(A8_LINKS).some((k) => isConfiguredA8Link(Number(k)))

const parseNumericTokens = (raw = '') => {
  const nums = String(raw || '').replace(/,/g, '').match(/[\d.]+/g) || []
  return nums.map((v) => Number(v)).filter((n) => Number.isFinite(n))
}

const scoreFeeValue = (product, feeRaw) => {
  const raw = String(feeRaw || '')
  if (!raw.trim()) return null
  if (raw.includes('無料') || raw === '¥0') return 0
  const nums = parseNumericTokens(raw)
  if (nums.length === 0) return null
  if (String(product?.cat || '') === 'loan') {
    // For APR ranges, lower minimum is generally more favorable.
    return Math.min(...nums)
  }
  return Math.min(...nums)
}

function getSortOptionsForCategory(catId) {
  const base = [
    { id: 'default', label: '表示順', fn: (a, b) => a.id - b.id },
    { id: 'name', label: '名前順', fn: (a, b) => (a.name > b.name ? 1 : -1) },
    { id: 'company', label: '提供会社順', fn: (a, b) => (a.company > b.company ? 1 : -1) },
  ]
  const feeLabel = catId === 'loan' ? '実質年率が低い順' : '手数料・料金が安い順'
  base.push({
    id: 'fee',
    label: feeLabel,
    fn: (a, b) => {
      const sa = scoreFeeValue(a, a.fee)
      const sb = scoreFeeValue(b, b.fee)
      if (!Number.isFinite(sa) && !Number.isFinite(sb)) return 0
      if (!Number.isFinite(sa)) return 1
      if (!Number.isFinite(sb)) return -1
      return sa - sb
    },
  })
  return base
}

function ProductCard({ product, inCompare, canAdd, onToggleCompare, isDark }) {
  const cardBg = isDark ? '#0F172A' : '#fff'
  const cardBorder = isDark ? '#334155' : '#E2E8F0'
  const subText = isDark ? '#94A3B8' : '#64748B'
  const mainText = isDark ? '#E2E8F0' : '#0F172A'
  const divider = isDark ? '#334155' : '#E2E8F0'
  const bodyText = isDark ? '#CBD5E1' : '#334155'
  const detailLink = String(product.detailUrl || '').trim()
  const hasDetailLink = /^https?:\/\//i.test(detailLink)
  const impressionPixelUrl = String(product.impressionPixelUrl || '').trim()
  const hasImpressionPixel = /^https?:\/\//i.test(impressionPixelUrl)
  const keyPoints = Array.isArray(product.keyPoints) ? product.keyPoints.slice(0, 4) : []
  return (
    <div
      style={{
        background: cardBg,
        border: inCompare ? '2px solid #F97316' : `1px solid ${cardBorder}`,
        borderRadius: 12,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        position: 'relative',
        transition: 'box-shadow 0.2s, transform 0.2s, border-color 0.2s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 24px rgba(249,115,22,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      {product.bannerImage ? (
        <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${divider}`, width: product.bannerWidth || '100%', maxWidth: '100%', height: product.bannerHeight || 96 }}>
          <img
            src={product.bannerImage}
            alt={`${product.company} バナー`}
            style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'left center', background: '#fff' }}
            loading="lazy"
          />
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: ICON_BG[product.cat], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
          {ICONS[product.cat]}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: subText, fontWeight: 500, marginBottom: 2 }}>{product.company}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: mainText, lineHeight: 1.3 }}>{product.name}</div>
        </div>
      </div>

      <div style={{ height: 1, background: divider }} />

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#F97316' }}>{product.fee}</span>
        <span style={{ fontSize: 11, color: subText }}>{product.feeNote}</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {product.tags.map((t) => (
          <span key={t} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 600, background: TAG_STYLE[t].bg, color: TAG_STYLE[t].color }}>
            {TAG_STYLE[t].label}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {product.highlights.map((h, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: bodyText }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#F97316', flexShrink: 0 }} />
            {h}
          </div>
        ))}
      </div>

      {keyPoints.length > 0 ? (
        <div
          style={{
            borderRadius: 10,
            border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
            background: isDark ? '#111827' : '#F8FAFC',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: isDark ? '#E2E8F0' : '#0F172A' }}>注目ポイント</div>
          {keyPoints.map((point, idx) => (
            <div key={idx} style={{ fontSize: 11, color: bodyText, lineHeight: 1.45 }}>
              ・{point}
            </div>
          ))}
          {hasDetailLink ? (
            <button
              type="button"
              onClick={() => window.open(detailLink, '_blank', 'noopener,noreferrer')}
              style={{
                marginTop: 2,
                border: 'none',
                background: 'transparent',
                color: '#F97316',
                fontSize: 11,
                fontWeight: 700,
                padding: 0,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              詳しく見る →
            </button>
          ) : null}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <button
          type="button"
          onClick={() => openProductOutbound(product, 'products_card')}
          style={{ flex: 1, padding: '9px 12px', background: '#F97316', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          申し込む →
        </button>
        <button
          onClick={() => onToggleCompare(product.id)}
          disabled={!canAdd && !inCompare}
          style={{
            padding: '9px 12px',
            background: inCompare ? '#FFF7ED' : 'transparent',
            border: inCompare ? '1.5px solid #FDBA74' : `1.5px solid ${cardBorder}`,
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: canAdd || inCompare ? 'pointer' : 'not-allowed',
            color: inCompare ? '#F97316' : subText,
            whiteSpace: 'nowrap',
            opacity: !canAdd && !inCompare ? 0.4 : 1,
          }}
        >
          {inCompare ? '選択中 ✓' : '比較'}
        </button>
      </div>

      {hasImpressionPixel ? (
        <img
          src={impressionPixelUrl}
          alt=""
          width="1"
          height="1"
          loading="lazy"
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        />
      ) : null}
    </div>
  )
}

/** 一覧直上に表示（固定バーではない）。ProductPage と同様の位置感。 */
function CompareSelectionPanel({ compareList, onRemove, onCompare, onClearAll, isMobile, isDark }) {
  if (compareList.length === 0) return null
  const canOpen = compareList.length >= 2
  const panelBg = isDark ? '#0B1220' : '#BFDBFE'
  const panelBorder = isDark ? 'rgba(59,130,246,0.58)' : '#3B82F6'
  const panelText = isDark ? 'rgba(255,255,255,0.9)' : '#1E3A8A'
  const panelSubText = isDark ? 'rgba(191,219,254,0.9)' : '#1D4ED8'
  const chipBg = isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF'
  const chipBorder = isDark ? '1px solid rgba(191,219,254,0.5)' : '1px solid #60A5FA'
  const chipText = isDark ? '#FFFFFF' : '#1E3A8A'
  const chipRemove = isDark ? '#BFDBFE' : '#2563EB'
  const clearText = isDark ? 'rgba(191,219,254,0.95)' : '#1D4ED8'
  const panelShadow = isDark ? '0 10px 30px rgba(2,6,23,0.45)' : '0 10px 30px rgba(59,130,246,0.2)'
  return (
    <div
      role="region"
      aria-label="比較リスト"
      style={{
        position: 'fixed',
        left: isMobile ? 12 : '50%',
        right: isMobile ? 12 : 'auto',
        bottom: isMobile ? 92 : 24,
        transform: isMobile ? 'none' : 'translateX(-50%)',
        width: isMobile ? 'auto' : 'min(980px, calc(100vw - 2rem))',
        zIndex: 50,
        borderRadius: isMobile ? 16 : 999,
        border: `1px solid ${panelBorder}`,
        background: panelBg,
        padding: isMobile ? '10px 12px' : '10px 14px',
        boxShadow: panelShadow,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: panelText }}>比較選択中</span>
          <span style={{ display: 'inline-flex', minWidth: 28, height: 28, padding: '0 8px', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: '#1D4ED8', color: '#fff', fontSize: 12, fontWeight: 800 }}>
            {compareList.length}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: panelSubText }}>
            {compareList.length === 1 ? 'あと2つ選べます' : '比較する準備OK'}
          </span>
        </div>

        {!isMobile && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, flex: 1, minWidth: 0, alignItems: 'center' }}>
            {compareList.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  maxWidth: '100%',
                  padding: '6px 10px',
                  borderRadius: 10,
                  border: chipBorder,
                  background: chipBg,
                  color: chipText,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <button
                  type="button"
                  onClick={() => onRemove(p.id)}
                  aria-label={`${p.name}を比較から外す`}
                  style={{ border: 'none', background: 'transparent', color: chipRemove, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'flex-end', marginLeft: isMobile ? 'auto' : 0 }}>
          <button
            type="button"
            onClick={onClearAll}
            style={{
              border: 'none',
              background: 'transparent',
              color: clearText,
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              padding: '8px 4px',
            }}
          >
            全選択解除
          </button>
          <button
            type="button"
            onClick={onCompare}
            disabled={!canOpen}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              border: 'none',
              background: canOpen ? '#1D4ED8' : '#374151',
              color: '#fff',
              fontSize: 13,
              fontWeight: 900,
              cursor: canOpen ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap',
            }}
          >
            比較する →
          </button>
        </div>
      </div>
    </div>
  )
}

function CompareModal({ compareList, onClose, isDark }) {
  const panelBg = isDark ? '#0F172A' : '#fff'
  const panelBorder = isDark ? '#334155' : '#E2E8F0'
  const panelText = isDark ? '#E2E8F0' : '#0F172A'
  const subtleText = isDark ? '#94A3B8' : '#64748B'
  const headerBg = isDark ? '#111827' : '#F8FAFC'
  const rows = [
    { label: '提供元', key: 'company' },
    { label: '費用', key: 'fee' },
    { label: '費用備考', key: 'feeNote' },
  ]
  const bestByKey = useMemo(() => {
    const out = {}
    const feeCandidates = compareList
      .map((p) => ({ id: p.id, score: scoreFeeValue(p, p.fee) }))
      .filter((x) => Number.isFinite(x.score))
    if (feeCandidates.length >= 2) {
      const bestScore = Math.min(...feeCandidates.map((x) => x.score))
      out.fee = new Set(feeCandidates.filter((x) => x.score === bestScore).map((x) => x.id))
    }
    return out
  }, [compareList])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 16, padding: 28, width: '100%', maxWidth: 780, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: panelText }}>商品比較</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: subtleText }}>×</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 12, fontWeight: 600, color: subtleText, background: headerBg, borderBottom: `1px solid ${panelBorder}` }}>項目</th>
              {compareList.map((p) => (
                <th key={p.id} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 12, fontWeight: 700, color: panelText, background: headerBg, borderBottom: `1px solid ${panelBorder}`, minWidth: 180 }}>{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, key }) => (
              <tr key={key}>
                <td style={{ padding: '12px 14px', borderBottom: `1px solid ${panelBorder}`, fontSize: 12, fontWeight: 600, color: subtleText, background: headerBg, whiteSpace: 'nowrap' }}>{label}</td>
                {compareList.map((p) => {
                  const isBest = Boolean(bestByKey[key]?.has(p.id))
                  return (
                    <td key={p.id} style={{ padding: '12px 14px', borderBottom: `1px solid ${panelBorder}`, color: panelText, background: isBest ? '#ECFDF5' : 'transparent' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span>{p[key]}</span>
                        {isBest ? (
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#065F46', background: '#A7F3D0', borderRadius: 999, padding: '2px 8px' }}>
                            ベスト
                          </span>
                        ) : null}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr>
              <td style={{ padding: '12px 14px', borderBottom: `1px solid ${panelBorder}`, fontSize: 12, fontWeight: 600, color: subtleText, background: headerBg, whiteSpace: 'nowrap' }}>特徴</td>
              {compareList.map((p) => (
                <td key={p.id} style={{ padding: '12px 14px', borderBottom: `1px solid ${panelBorder}`, color: panelText }}>
                  {p.highlights.map((h, i) => <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>• {h}</div>)}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ padding: '12px 14px', fontSize: 12, fontWeight: 600, color: subtleText, background: headerBg, whiteSpace: 'nowrap' }}>タグ</td>
              {compareList.map((p) => (
                <td key={p.id} style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {p.tags.map((t) => <span key={t} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 600, background: TAG_STYLE[t].bg, color: TAG_STYLE[t].color }}>{TAG_STYLE[t].label}</span>)}
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          {compareList.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => openProductOutbound(p, 'products_compare_modal')}
              style={{ flex: 1, padding: 11, background: '#F97316', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              {p.name}に申し込む →
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const SORT_OPTIONS_ALL = [
  { id: 'default', label: '表示順', fn: (a, b) => a.id - b.id },
  { id: 'name', label: '名前順', fn: (a, b) => (a.name > b.name ? 1 : -1) },
  { id: 'company', label: '提供会社順', fn: (a, b) => (a.company > b.company ? 1 : -1) },
]

export default function ProductsPage() {
  const CARD_FEATURE_ORDER = useMemo(() => new Map([
    [11, 1], // 楽天カード
    [15, 2], // JCBカードW
    [14, 3], // 三井住友カード（NL）
  ]), [])
  const [currentCat, setCurrentCat] = useState('all')
  const [activeFilters, setActiveFilters] = useState([])
  const [mobileFilterExpanded, setMobileFilterExpanded] = useState(false)
  const [sortBy, setSortBy] = useState('default')
  const [compareList, setCompareList] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [pageSize, setPageSize] = useState(9)
  const [currentPage, setCurrentPage] = useState(1)
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280))
  const [isDark, setIsDark] = useState(() => (
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false
  ))

  const specFilters = useMemo(() => getFiltersForCategory(currentCat), [currentCat])

  const sortOptions = useMemo(
    () => (currentCat === 'all' ? SORT_OPTIONS_ALL : getSortOptionsForCategory(currentCat)),
    [currentCat],
  )

  const filteredProducts = useMemo(() => {
    let list = currentCat === 'all' ? PRODUCTS : PRODUCTS.filter((p) => p.cat === currentCat)
    if (activeFilters.length > 0) {
      list = list.filter((p) => activeFilters.every((fid) => p.tags.includes(fid)))
    }
    if (currentCat === 'card' && sortBy === 'default') {
      return [...list].sort((a, b) => {
        const aRank = CARD_FEATURE_ORDER.get(a.id) || 999
        const bRank = CARD_FEATURE_ORDER.get(b.id) || 999
        if (aRank !== bRank) return aRank - bRank
        return a.id - b.id
      })
    }
    const sortFn = sortOptions.find((o) => o.id === sortBy)?.fn || sortOptions[0].fn
    return [...list].sort(sortFn)
  }, [currentCat, activeFilters, sortBy, sortOptions, CARD_FEATURE_ORDER])

  useEffect(() => {
    setCurrentPage(1)
  }, [currentCat, activeFilters, sortBy, pageSize])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark'))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const isMobile = viewportWidth < 768
  const isTablet = viewportWidth >= 768 && viewportWidth < 1100
  const showCategoryFilterPanel = !isMobile || mobileFilterExpanded
  const gridColumns = isMobile ? '1fr' : (isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))')

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const pagedProducts = filteredProducts.slice(startIndex, startIndex + pageSize)

  const handleCategoryChange = (catId) => {
    if (compareList.length > 0 && !window.confirm('カテゴリーを変更すると比較リストがリセットされます。よろしいですか？')) {
      return
    }
    if (compareList.length > 0) setCompareList([])
    setCurrentCat(catId)
    setActiveFilters([])
    setSortBy('default')
  }

  const toggleFilter = (filterId) => {
    setActiveFilters((prev) => (prev.includes(filterId) ? prev.filter((f) => f !== filterId) : [...prev, filterId]))
  }

  const toggleCompare = (id) => {
    setCompareList((prev) => {
      const exists = prev.find((p) => p.id === id)
      if (exists) return prev.filter((p) => p.id !== id)
      if (prev.length >= 3) return prev
      const nextProduct = PRODUCTS.find((p) => p.id === id)
      if (!nextProduct) return prev
      if (prev.length > 0 && prev[0].cat !== nextProduct.cat) {
        window.alert('同じカテゴリーの商品のみ比較できます。')
        return prev
      }
      return [...prev, nextProduct]
    })
  }

  const removeCompare = (id) => setCompareList((prev) => prev.filter((p) => p.id !== id))

  return (
    <div style={{ minHeight: '100vh', background: isDark ? '#020617' : '#F8FAFC', color: isDark ? '#E2E8F0' : '#0F172A', fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 16px 0' }}>
        <div style={{ background: '#0F172A', padding: '40px 32px 32px', position: 'relative', overflow: 'hidden', borderRadius: 20 }}>
          <div style={{ position: 'absolute', top: -60, right: -60, width: 300, height: 300, background: '#F97316', opacity: 0.08, borderRadius: '50%' }} />
          <div style={{ position: 'absolute', bottom: -40, right: 80, width: 180, height: 180, background: '#F97316', opacity: 0.05, borderRadius: '50%' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 800, letterSpacing: '0.12em', color: '#F97316', textTransform: 'uppercase', marginBottom: 10 }}>MoneyMart 商品比較</div>
          <div style={{ fontSize: isMobile ? 28 : 34, fontWeight: 800, color: '#fff', lineHeight: 1.32, marginBottom: 10 }}>あなたに合った金融商品を、<br />かしこく選ぼう。</div>
          <div style={{ fontSize: isMobile ? 14 : 16, color: '#CBD5E1', lineHeight: 1.7, fontWeight: 500 }}>金融商品を一覧比較。申し込みはすべて無料です。</div>
          <div style={{ display: 'flex', gap: 28, marginTop: 22 }}>
            {[{ num: PRODUCTS.length, label: '掲載商品数' }, { num: '5', label: 'カテゴリ' }, { num: '無料', label: '申し込み手数料' }].map((s) => (
              <div key={s.label}>
                <div style={{ fontSize: isMobile ? 24 : 30, fontWeight: 800, color: '#F97316', lineHeight: 1.1 }}>{s.num}</div>
                <div style={{ fontSize: 12, color: '#CBD5E1', marginTop: 4, fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
          </div>
        </div>
      </div>

      <div style={{ position: 'sticky', top: 64, zIndex: 20, padding: '0 16px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', background: isDark ? '#0F172A' : '#fff', border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`, borderRadius: 14, padding: '0 14px' }}>
        {isMobile ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 0 4px' }}>
            <button
              type="button"
              onClick={() => setMobileFilterExpanded((v) => !v)}
              style={{
                border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
                background: isDark ? '#111827' : '#F8FAFC',
                color: isDark ? '#CBD5E1' : '#334155',
                borderRadius: 8,
                padding: '7px 10px',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {mobileFilterExpanded ? 'フィルターを閉じる' : 'フィルターを開く'}
            </button>
            <span style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', fontWeight: 700 }}>
              {activeFilters.length > 0 ? `適用中 ${activeFilters.length}` : 'フィルター未適用'}
            </span>
          </div>
        ) : null}

        {showCategoryFilterPanel ? (
          <>
            <div style={{ display: 'flex', gap: 4, padding: '12px 0 0', overflowX: 'auto' }}>
              {CATS.map((c) => {
                const cnt = c.id === 'all' ? PRODUCTS.length : PRODUCTS.filter((p) => p.cat === c.id).length
                const active = currentCat === c.id
                return (
                  <button key={c.id} onClick={() => handleCategoryChange(c.id)} style={{ padding: '8px 18px', borderRadius: 20, border: active ? '1.5px solid #F97316' : `1.5px solid ${isDark ? '#334155' : '#E2E8F0'}`, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', background: active ? '#F97316' : 'transparent', color: active ? '#fff' : (isDark ? '#CBD5E1' : '#64748B'), fontFamily: 'inherit', transition: 'all 0.15s' }}>
                    {c.label}（{cnt}）
                  </button>
                )
              })}
            </div>

            {specFilters.length > 0 && (
              <div style={{ padding: '10px 0 0' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#94A3B8' : '#64748B' }}>条件フィルター</span>
                    {activeFilters.length > 0 && (
                      <span style={{ display: 'inline-flex', minWidth: 20, height: 20, padding: '0 6px', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: '#FFF7ED', color: '#F97316', fontSize: 11, fontWeight: 800 }}>
                        {activeFilters.length}
                      </span>
                    )}
                  </div>
                  {activeFilters.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveFilters([])}
                      style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 700, color: isDark ? '#94A3B8' : '#64748B', cursor: 'pointer' }}
                    >
                      すべて解除
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {specFilters.map((f) => {
                    const isActive = activeFilters.includes(f.id)
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => toggleFilter(f.id)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 10,
                          border: isActive ? '1.5px solid #F97316' : `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: isActive ? '#F97316' : (isDark ? '#0F172A' : '#fff'),
                          color: isActive ? '#fff' : (isDark ? '#CBD5E1' : '#64748B'),
                          fontFamily: 'inherit',
                        }}
                      >
                        {f.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0 12px', flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: isDark ? '#94A3B8' : '#64748B', fontWeight: 700 }}>
            並び替え
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`, borderRadius: 8, padding: '6px 10px', background: isDark ? '#111827' : '#fff', color: isDark ? '#E2E8F0' : '#334155', fontWeight: 700 }}
            >
              {sortOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: isDark ? '#94A3B8' : '#64748B', fontWeight: 600 }}>
            件数
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value || 9))}
              style={{ border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`, borderRadius: 6, padding: '2px 6px', background: isDark ? '#111827' : '#fff', color: isDark ? '#E2E8F0' : '#334155', fontWeight: 600 }}
            >
              <option value={9}>9</option>
              <option value={12}>12</option>
              <option value={15}>15</option>
            </select>
          </label>
          <div style={{ marginLeft: isMobile ? 0 : 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: isMobile ? 'flex-end' : 'flex-end', width: isMobile ? '100%' : 'auto' }}>
            {compareList.length > 0 && (
              <button
                type="button"
                onClick={() => compareList.length >= 2 && setShowModal(true)}
                disabled={compareList.length < 2}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: compareList.length < 2 ? `1px solid ${isDark ? '#334155' : '#E2E8F0'}` : '1px solid #F97316',
                  background: compareList.length < 2 ? (isDark ? '#111827' : '#F8FAFC') : '#F97316',
                  color: compareList.length < 2 ? (isDark ? '#64748B' : '#94A3B8') : '#fff',
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: compareList.length < 2 ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                比較する ({compareList.length}/3)
              </button>
            )}
            <span style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B' }}>
              <strong style={{ color: isDark ? '#F1F5F9' : '#0F172A' }}>{filteredProducts.length}</strong>件表示中
            </span>
          </div>
        </div>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px', paddingBottom: compareList.length > 0 ? 132 : 48 }}>
        <CompareSelectionPanel
          compareList={compareList}
          onRemove={removeCompare}
          onCompare={() => setShowModal(true)}
          onClearAll={() => setCompareList([])}
          isMobile={isMobile}
          isDark={isDark}
        />
        {filteredProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: isDark ? '#94A3B8' : '#64748B' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 15 }}>条件に合う商品が見つかりませんでした</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: gridColumns, gap: 16 }}>
            {pagedProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                inCompare={Boolean(compareList.find((c) => c.id === p.id))}
                canAdd={compareList.length < 3}
                onToggleCompare={toggleCompare}
                isDark={isDark}
              />
            ))}
          </div>
        )}

        {filteredProducts.length > 0 && (
          <div style={{ marginTop: 18, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`, background: safePage <= 1 ? (isDark ? '#0B1220' : '#F8FAFC') : (isDark ? '#0F172A' : '#fff'), color: safePage <= 1 ? '#94A3B8' : (isDark ? '#CBD5E1' : '#334155'), cursor: safePage <= 1 ? 'not-allowed' : 'pointer', fontWeight: 700 }}
            >
              前へ
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((page) => !isMobile || Math.abs(page - safePage) <= 2 || page === 1 || page === totalPages)
              .map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                style={{
                  minWidth: 36,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: page === safePage ? '1px solid #F97316' : `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
                  background: page === safePage ? '#F97316' : (isDark ? '#0F172A' : '#fff'),
                  color: page === safePage ? '#fff' : (isDark ? '#CBD5E1' : '#334155'),
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`, background: safePage >= totalPages ? (isDark ? '#0B1220' : '#F8FAFC') : (isDark ? '#0F172A' : '#fff'), color: safePage >= totalPages ? '#94A3B8' : (isDark ? '#CBD5E1' : '#334155'), cursor: safePage >= totalPages ? 'not-allowed' : 'pointer', fontWeight: 700 }}
            >
              次へ
            </button>
          </div>
        )}
      </div>

      {showModal && <CompareModal compareList={compareList} onClose={() => setShowModal(false)} isDark={isDark} />}
    </div>
  )
}
