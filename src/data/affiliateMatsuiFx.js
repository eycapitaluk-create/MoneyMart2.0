/**
 * 松井証券 MATSUI FX — A8 アフィリエイト（cp2026 更新）
 * バナー画像は A8 配信（bgt）。文言は広告主 PR を要約（掲載面向けに編集）。
 */

/** A8 経由の松井 FX イベント LP（affiliate パラメータ付き） */
export const MATSUI_FX_LANDING_URL =
  'https://www.matsui.co.jp/event/fx02/?modal=show&utm_source=a8&utm_campaign=fx&utm_medium=fxaffiliate&argument=0p7Lzdhu&dmai=a6960dc5ab5a01&affnmsid=6cbdf7b85edfb96542e0ef72bd366c5474ca5b79'

export const MATSUI_FX_A8 = {
  clickUrl: import.meta.env.VITE_A8_MATSUI_FX || MATSUI_FX_LANDING_URL,
  bannerSrc728x90:
    'https://www23.a8.net/svt/bgt?aid=260424355359&wid=001&eno=01&mid=s00000022371001013000&mc=1',
  pixelSrc: 'https://www12.a8.net/0.gif?a8mat=4B1SPV+5XQMYA+4SM6+614CX',
}

export const MATSUI_FX_HEADLINE =
  '100円からお取引可能！FXをはじめるなら【松井証券 MATSUI FX】'

export const MATSUI_FX_TAGLINE = '100円から取引できる！ FXはじめるなら、松井証券！'

export const MATSUI_FX_OFFICIAL_URL = MATSUI_FX_LANDING_URL
export const MATSUI_FX_AUTO_TRADING_URL = 'https://www.matsui.co.jp/fx/auto-trading/'
export const MATSUI_FX_SPREAD_URL =
  'https://www.matsui.co.jp/fx/service/fx/study/relief/02_spread/'
export const MATSUI_FX_AFFILIATE_GUIDELINE_URL =
  'https://www.matsui.co.jp/utility/rule/affiliate_guideline.pdf'

/** 商品比較カード用 */
export const MATSUI_FX_PRODUCT = {
  id: 57,
  cat: 'other',
  name: MATSUI_FX_HEADLINE,
  company: '松井証券株式会社',
  fee: '100円〜',
  feeNote: '1通貨単位から取引可能（※スプレッド等は公式で確認）',
  highlights: [
    '100円から取引できる（1通貨単位から取引可能）',
    '取引手数料0円・取扱通貨ペア32通貨ペア',
    'レバレッジ1倍〜25倍・スマホアプリ対応',
    '24時まで受付のFX専用サポートダイヤル',
  ],
  keyPoints: [
    '1通貨単位・100円からの取引が可能（一般的な1,000通貨単位と異なる点が訴求）',
    '取引手数料・自動売買利用料・口座維持手数料等は無料（条件は公式で確認）',
    'リピート系自動売買に対応。豪ドル/NZドル・米ドル/カナダなど人気ペアにも対応',
    'スプレッドは業界最狭水準を訴求（※1 詳細は松井証券公式サイトでご確認ください）',
  ],
  bannerImage: MATSUI_FX_A8.bannerSrc728x90,
  bannerWidth: 728,
  bannerHeight: 90,
  detailUrl: MATSUI_FX_A8.clickUrl,
  impressionPixelUrl: MATSUI_FX_A8.pixelSrc,
  tags: ['web', 'instant'],
  popular: true,
}

/** 掲載面用の成果・否認条件（要約） */
export const MATSUI_FX_AFFILIATE_DISCLOSURE = [
  '【成果条件】広告主新規（当広告主を初めて利用する方）。WEB申込後、60日以内のFX口座開設完了＋1万通貨以上の取引。',
  '【否認の例】不備・不正・重複・いたずら・審査落ち・1世帯2回以上の申込・リスティング違反・データ不備など。詳細はA8.netおよび広告主規定に準じます。',
  '※掲載文言は情報提供目的です。投資勧誘・将来収益の保証ではありません。レバレッジ取引には元本超過損のリスクがあります。',
  '※X（旧Twitter）は本キャンペーンのスポンサーではありません。',
]
