import { CAREERS_SEO_TITLE, CAREERS_SEO_DESCRIPTION } from '../data/careers.js'
/**
 * Client-side SEO defaults. Production canonical host should match sitemap / SSR (see PUBLIC_SITE_URL on Vercel).
 */
import { ETF_UNIVERSE_COUNT } from '../data/etfUniverseLite'
import { softwareApplicationJsonLd } from './seoJsonLd'

export {
  articleJsonLd,
  breadcrumbListJsonLd,
  organizationJsonLd,
  softwareApplicationJsonLd,
  webSiteJsonLd,
  EDITORIAL_AUTHOR_NAME,
} from './seoJsonLd'

export const SITE_ORIGIN = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PUBLIC_SITE_ORIGIN)
  ? String(import.meta.env.VITE_PUBLIC_SITE_ORIGIN).replace(/\/$/, '')
  : (typeof window !== 'undefined' ? window.location.origin : 'https://www.moneymart.co.jp')

/** Favicon / apple-touch-icon (public/icon.png). */
export const SITE_LOGO_PATH = '/icon.png'
/** Social link previews — smaller than icon.png so X/Kakao fetch reliably. */
export const SITE_OG_IMAGE_PATH = '/og-card.png'
export const SITE_OG_IMAGE_SIZE = { width: 512, height: 512 }

export function getSiteOgImageUrl(origin = SITE_ORIGIN) {
  return `${String(origin || SITE_ORIGIN).replace(/\/$/, '')}${SITE_OG_IMAGE_PATH}`
}

function abs(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${SITE_ORIGIN}${p}`
}

/**
 * @returns {{ title: string, description: string, canonical: string, path: string, isTool: boolean, toolName?: string }}
 */
export function getSeoForRoute(pathname, search = '') {
  const path = pathname || '/'
  const params = new URLSearchParams(search && search.startsWith('?') ? search.slice(1) : String(search || ''))

  const entries = [
    {
      match: (p) => p === '/' || p === '',
      title: 'MoneyMart｜ポートフォリオの見える化・新NISA・投信とETFの重複確認',
      description:
        '保有ポートフォリオの偏りと投資信託・ETFの重なり、集中リスクを整理。新NISAの枠と配当予定を無料で確認できます。将来の運用成果を保証するものではなく、投資助言ではありません。',
      path: '/',
      isTool: false,
    },
    {
      match: (p) => p === '/etf-compare',
      title: `国内上場ETF比較（${ETF_UNIVERSE_COUNT}本）｜信託報酬・NISA | MoneyMart`,
      description:
        `国内上場ETF ${ETF_UNIVERSE_COUNT}本を信託報酬・NISA区分・値動きで横並び比較。投信との重複や集中度を確認する前の銘柄選びにも使えます。情報提供のみで、売買の勧誘ではありません。`,
      path: '/etf-compare',
      isTool: true,
      toolName: 'MoneyMart ETF比較',
    },
    {
      match: (p) => p === '/funds/compare',
      title: `国内上場ETF比較（${ETF_UNIVERSE_COUNT}本）｜信託報酬・NISA | MoneyMart`,
      description:
        `国内上場ETF ${ETF_UNIVERSE_COUNT}本を信託報酬・NISA区分・値動きで横並び比較。投信との重複や集中度を確認する前の銘柄選びにも使えます。情報提供のみで、売買の勧誘ではありません。`,
      path: '/etf-compare',
      isTool: true,
      toolName: 'MoneyMart ETF比較',
    },
    {
      match: (p) => p === '/dividend-calendar',
      title: '配当カレンダー（日本株・米国株）無料｜入金予定の整理 | MoneyMart',
      description:
        '日本株・米国株の配当月・入金見込みをカレンダーで整理する無料ツール。新NISAや長期保有のキャッシュフロー確認、ETFと個別株の配当見通しの比較に使えます。将来の配当を保証するものではありません。',
      path: '/dividend-calendar',
      isTool: true,
      toolName: 'MoneyMart 配当カレンダー',
    },
    {
      match: (p) => p === '/market' || p === '/market-indicator',
      title: 'マーケット指標｜セクター・地域・センチメント | MoneyMart',
      description:
        '米国セクター・地域ETFの騰落、日本テーマ、ニュースと市場センチメントを一つのボードで確認。ポートフォリオの偏りを点検する補助情報です。数値タイルの一部は会員ログイン後に表示されます。',
      path: '/market',
      isTool: true,
      toolName: 'MoneyMart マーケット指標',
    },
    {
      match: (p) => p === '/budget-tracker',
      title: '家計トラッカー｜支出とNISA積立のバランスを整理 | MoneyMart',
      description:
        'レシート読み取りと分類で家計を可視化する無料ツール。日常の支出と、新NISA・ETFなど投資とのバランス確認に使えます。特定の金融商品の売買を勧誘するものではありません。',
      path: '/budget-tracker',
      isTool: true,
      toolName: 'MoneyMart 家計トラッカー',
    },
    {
      match: (p) => p === '/insights',
      title: 'MoneyMart Insights｜市場・家計・新NISAの編集分析',
      description:
        '家計・ポートフォリオ・マーケットをデータで読み解く MoneyMart 編集インサイト。公開日とリードを掲載し、全文は無料会員向けです。投資助言ではありません。',
      path: '/insights',
      isTool: false,
    },
    {
      match: (p) => p.startsWith('/insights/category/'),
      title: 'インサイト（テーマ別）｜MoneyMart 編集分析',
      description:
        '新NISA・家計・住宅ローン・マーケットなどテーマ別に整理した MoneyMart 分析インサイト。公開日・リードを確認できます。',
      path: '',
      useFullPath: true,
      isTool: false,
    },
    {
      match: (p) => p.startsWith('/insights/'),
      title: 'インサイト記事｜MoneyMart 編集部',
      description:
        'MoneyMart 編集部の投資・家計分析。公開情報と一次資料の参照を前提とした検証記事です。投資助言ではありません。',
      path: '',
      useFullPath: true,
      isTool: false,
    },
    {
      match: (p) => p === '/news',
      title: 'AIニュース｜投資・経済ヘッドラインの要点整理 | MoneyMart',
      description:
        '投資・経済ニュースを日本語で要約して読める無料ページ。ETF・個別株・新NISA関連の話題を横断チェックできます。情報提供であり、投資助言ではありません。',
      path: '/news',
      isTool: true,
      toolName: 'MoneyMart AIニュース',
    },
    {
      match: (p) => p === '/tools',
      title: '無料投資ツール一覧｜ETF比較・配当・NISAチェック | MoneyMart',
      description:
        'ETF比較、配当カレンダー、家計トラッカー、NISA・ETFチェックリストなど、ポートフォリオ整理に使える無料ツールの入口です。',
      path: '/tools',
      isTool: true,
      toolName: 'MoneyMart ツール',
    },
    {
      match: (p) => p === '/tools/nisa-etf-checklist',
      title: 'NISA・ETFを選ぶ前の初心者チェックリスト | MoneyMart',
      description:
        '人気ランキングを見る前に、投資期間・積立額・信託報酬・為替・分配金などの比較軸を整理する無料チェックリスト。NISA・ETF初心者向け。',
      path: '/tools/nisa-etf-checklist',
      isTool: true,
      toolName: 'NISA・ETF初心者チェックリスト',
    },
    {
      match: (p) => p === '/funds',
      title: '投資信託・ETF｜信託報酬とNISA区分の確認 | MoneyMart',
      description:
        '投資信託とETFの探索・ウォッチリスト。信託報酬や分配の傾向を把握し、新NISA枠での比較検討に使える無料ツールです。重複保有の確認にも使えます。',
      path: '/funds',
      isTool: false,
    },
    {
      match: (p) => p.startsWith('/funds/'),
      title: 'ファンド詳細 | MoneyMart',
      description:
        '国内ETF・投資信託の価格推移、指標、概要を確認できる詳細ページです。NISAでの比較検討にも活用できます。',
      path: '',
      useFullPath: true,
      isTool: false,
    },
    {
      match: (p) => p === '/stocks',
      title: '株式・銘柄一覧 | MoneyMart',
      description:
        '株価・チャート・ウォッチリストをまとめて確認。ETFと個別株の「比較」や、NISA成長枠の銘柄研究に使える「無料」の株式「ツール」です。',
      path: '/stocks',
      isTool: false,
    },
    {
      match: (p) => p.startsWith('/products/'),
      title: '商品詳細 | MoneyMart',
      description:
        'カード・ローン・保険などの金融商品情報を確認できる詳細ページです。比較検討の補助情報として活用できます。',
      path: '/products',
      isTool: false,
    },
    {
      match: (p) => p === '/products',
      title: '金融商品比較 | MoneyMart',
      description:
        'カード・ローン・保険など主要サービスを横断比較できるページです。提携に偏らない中立比較を目指しています。',
      path: '/products',
      isTool: false,
    },
    {
      match: (p) => p === '/faq',
      title: 'FAQ | MoneyMart',
      description:
        'サービス全般・セキュリティ・NISA対応などよくある質問。ETF「比較」や「無料」プランについてもこちらをご確認ください。',
      path: '/faq',
      isTool: false,
    },
    {
      match: (p) => p === '/campaign/sns-2026',
      title: 'SNSキャンペーン | MoneyMart',
      description:
        '応募条件を満たした方の中から抽選で、Amazonギフトカード1,000円分を50名様、MoneyMart Premium 1か月利用クーポンを1,000名様に。',
      path: '/campaign/sns-2026',
      isTool: false,
    },
    {
      match: (p) => p === '/careers',
      title: CAREERS_SEO_TITLE,
      description:
        CAREERS_SEO_DESCRIPTION,
      path: '/careers',
      isTool: false,
    },
    {
      match: (p) => p === '/about',
      title: '運営会社 | MoneyMart',
      description:
        'マネーラボ株式会社（MoneyLab Inc.）が運営する独立系の金融プラットフォーム MoneyMart。資本提携に左右されない立場で、公平な比較と金融ツールへのアクセスを届けます。',
      path: '/about',
      isTool: false,
    },
    {
      match: (p) => p === '/legal/commerce',
      title: '特定商取引法に基づく表記 | MoneyMart',
      description:
        'MoneyMart Premium の販売業者、料金、支払方法、解約・返金、お問い合わせ先など、特定商取引法に基づく表記です。',
      path: '/legal/commerce',
      isTool: false,
    },
    {
      match: (p) => p === '/legal/privacy',
      title: 'プライバシーポリシー | MoneyMart',
      description:
        'MoneyMartの個人情報取り扱い方針。収集項目、利用目的、第三者提供、セキュリティ運用についてご確認いただけます。',
      path: '/legal/privacy',
      isTool: false,
    },
    {
      match: (p) => p === '/legal/terms',
      title: '利用規約 | MoneyMart',
      description:
        'MoneyMartの利用条件・免責事項・禁止事項を定めた利用規約です。サービスご利用前に必ずご確認ください。',
      path: '/legal/terms',
      isTool: false,
    },
    {
      match: (p) => p === '/legal/disclaimer',
      title: '免責事項 | MoneyMart',
      description:
        'MoneyMartの免責事項です。提供情報の性質、投資判断の責任範囲、データ取り扱いに関する前提をご確認ください。',
      path: '/legal/disclaimer',
      isTool: false,
    },
    {
      match: (p) => p === '/legal/methodology',
      title: '編集・データ方針｜一次情報と訂正窓口 | MoneyMart',
      description:
        'MoneyMartのインサイト編集方針、市場データの取り扱い、一次情報の確認、訂正・お問い合わせ窓口（support@moneymart.co.jp）のご案内です。',
      path: '/legal/methodology',
      isTool: false,
    },
    {
      match: (p) => p === '/legal/security',
      title: 'セキュリティ宣言 | MoneyMart',
      description:
        'MoneyMartの通信暗号化とアクセス管理など、安全管理措置に関する宣言です。',
      path: '/legal/security',
      isTool: false,
    },
    {
      match: (p) => p === '/legal/solicitation',
      title: '勧誘方針 | MoneyMart',
      description:
        'MoneyMartの広告・紹介に関する方針です。投資助言や特定商品の取得勧誘は行いません。',
      path: '/legal/solicitation',
      isTool: false,
    },
    {
      match: (p) => p === '/legal/antisocial',
      title: '反社会的勢力への対応 | MoneyMart',
      description:
        'マネーラボ株式会社の反社会的勢力に対する方針です。',
      path: '/legal/antisocial',
      isTool: false,
    },
    {
      match: (p) => p === '/premium',
      title: 'プレミアム会員 | MoneyMart',
      description:
        'MoneyMart Premium の機能案内。料金・支払・解約は特定商取引法に基づく表記および申込画面の表示に従います。',
      path: '/premium',
      isTool: false,
    },
    {
      match: (p) => p === '/community',
      title: 'コミュニティ | MoneyMart',
      description: 'MoneyMartの会員コミュニティ。',
      path: '/community',
      isTool: false,
      noindex: true,
    },
    {
      match: (p) => p === '/signup-complete',
      title: 'メール確認完了 | MoneyMart',
      description:
        '新規登録時のメール確認が完了したことを表示するページです。',
      path: '/signup-complete',
      isTool: false,
      noindex: true,
    },
  ]

  const normalized = path.replace(/\/$/, '') || '/'
  const row = entries.find((e) => e.match(normalized)) || {
    match: () => true,
    title: 'MoneyMart｜日本の個人投資家向け無料ツール',
    description:
      'ポートフォリオの見える化、ETF比較、NISA、配当管理をまとめて使える日本向け無料ツールです。',
    path: normalized,
    isTool: false,
  }

  const basePath = row.useFullPath ? normalized : (row.path || normalized)
  // Avoid duplicate content: keep only explicitly allowed query params.
  let canonicalQuery = ''
  if (basePath === '/insights') {
    const id = String(params.get('id') || '').trim()
    if (/^\d+$/.test(id)) canonicalQuery = `?id=${id}`
  }
  const canonicalPath = `${basePath}${canonicalQuery}`
  const canonical = abs(canonicalPath)

  return {
    title: row.title,
    description: row.description,
    canonical,
    path: basePath,
    isTool: row.isTool,
    toolName: row.toolName,
    noindex: Boolean(row.noindex),
  }
}

export function webApplicationJsonLd(name, pageUrl) {
  return softwareApplicationJsonLd({ name, url: pageUrl, base: SITE_ORIGIN })
}
