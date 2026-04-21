/**
 * Client-side SEO defaults. Production canonical host should match sitemap / SSR (see PUBLIC_SITE_URL on Vercel).
 */
import { ETF_UNIVERSE_COUNT } from '../data/etfUniverseLite'

export const SITE_ORIGIN = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PUBLIC_SITE_ORIGIN)
  ? String(import.meta.env.VITE_PUBLIC_SITE_ORIGIN).replace(/\/$/, '')
  : (typeof window !== 'undefined' ? window.location.origin : 'https://www.moneymart.co.jp')

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
      title: 'MoneyMart | 新NISA ETF比較・配当カレンダー 無料 | 個人投資家向け',
      description:
        '新NISA・つみたて・成長投資枠向けの無料ツール。国内ETF比較（上場投信）、配当カレンダー、信託報酬の確認、株価・マーケット指標・家計トラッカー・投資インサイトまで。',
      path: '/',
      isTool: false,
    },
    {
      match: (p) => p === '/etf-compare',
      title: `新NISA ETF比較 無料 | 国内上場ETF ${ETF_UNIVERSE_COUNT}銘柄 | MoneyMart`,
      description:
        `国内上場ETF（上場投信）${ETF_UNIVERSE_COUNT}銘柄を無料で比較。信託報酬・NISA区分・チャート・パフォーマンス。全銘柄の一覧・詳細な並べ替えはブラウザでJavaScript有効時（アプリ内UI）。配当カレンダー等の他ツールと併用可。`,
      path: '/etf-compare',
      isTool: true,
      toolName: 'MoneyMart ETF比較',
    },
    {
      match: (p) => p === '/funds/compare',
      title: `新NISA ETF比較 無料 | 国内上場ETF ${ETF_UNIVERSE_COUNT}銘柄 | MoneyMart`,
      description:
        `国内上場ETF（上場投信）${ETF_UNIVERSE_COUNT}銘柄を無料で比較。信託報酬・NISA区分・チャート・パフォーマンス。全銘柄の一覧・詳細な並べ替えはブラウザでJavaScript有効時（アプリ内UI）。配当カレンダー等の他ツールと併用可。`,
      path: '/etf-compare',
      isTool: true,
      toolName: 'MoneyMart ETF比較',
    },
    {
      match: (p) => p === '/dividend-calendar',
      title: 'Dividend Calendar | 260+ JP & US Stocks | MoneyMart',
      description:
        '日本株・米国株260銘柄超の配当予定をカレンダーで確認する「無料」「ツール」。NISA・長期保有のキャッシュフロー管理に。ETFと個別株の「比較」検討にも。',
      path: '/dividend-calendar',
      isTool: true,
      toolName: 'MoneyMart 配当カレンダー',
    },
    {
      match: (p) => p === '/market' || p === '/market-indicator',
      title: 'Japan Fear & Greed Index | Market Sentiment | MoneyMart',
      description:
        '日本市場のセンチメントや関連ニュースを整理する「無料」のマーケット「ツール」。ETF・株式のタイミング検討や、NISA枠の配分を考える材料に。',
      path: '/market-indicator',
      isTool: true,
      toolName: 'MoneyMart マーケット指標',
    },
    {
      match: (p) => p === '/budget-tracker',
      title: 'AI Receipt Scanner & Budget Tracker | MoneyMart',
      description:
        'レシート読み取りとAI分類で家計を可視化する「無料」「ツール」。日常の支出管理と、NISA・ETFなど投資とのバランス確認に。他サービスとの「比較」材料にも。',
      path: '/budget-tracker',
      isTool: true,
      toolName: 'MoneyMart 家計トラッカー',
    },
    {
      match: (p) => p === '/insights',
      title: 'Investment Insights | Data-Driven Analysis | MoneyMart',
      description:
        'データドリブンな投資インサイト。「無料」で中立的な視点を提供。ETF「比較」ツールやマーケット指標と併用し、NISA・分散投資の検討に。',
      path: '/insights',
      isTool: true,
      toolName: 'MoneyMart 投資インサイト',
    },
    {
      match: (p) => p === '/news',
      title: 'AI News | MoneyMart',
      description:
        '投資・経済に関わるニュースをAIで要約・整理する「無料」コンテンツ。ETFや個別株、NISAの話題を横断的に追う「ツール」として活用できます。',
      path: '/news',
      isTool: true,
      toolName: 'MoneyMart AIニュース',
    },
    {
      match: (p) => p === '/tools',
      title: 'Tools Hub | MoneyMart',
      description:
        '配当カレンダー・家計トラッカー・ETF「比較」など、個人投資家向け「無料」「ツール」の入口。NISAや長期投資とあわせて一覧から選べます。',
      path: '/tools',
      isTool: true,
      toolName: 'MoneyMart ツールハブ',
    },
    {
      match: (p) => p === '/funds',
      title: 'Funds & ETFs | MoneyMart',
      description:
        '投資信託・ETFの探索とウォッチリスト。信託報酬や分配の傾向を把握し、NISA枠での「比較」検討に使える「無料」「ツール」です。',
      path: '/funds',
      isTool: false,
    },
    {
      match: (p) => p.startsWith('/funds/'),
      title: 'ファンド詳細 | MoneyMart',
      description:
        '国内ETF・投資信託の価格推移、指標、概要を確認できる詳細ページです。NISAでの比較検討にも活用できます。',
      path: '/funds',
      isTool: false,
    },
    {
      match: (p) => p === '/stocks',
      title: 'Stocks | MoneyMart',
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
      match: (p) => p === '/about',
      title: 'About | MoneyMart',
      description:
        'MoneyMartのミッションとチームについて。個人投資家向けの「無料」「ツール」で、ETF「比較」から家計管理までを中立に支援します。',
      path: '/about',
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
  ]

  const normalized = path.replace(/\/$/, '') || '/'
  const row = entries.find((e) => e.match(normalized)) || {
    match: () => true,
    title: 'MoneyMart | 日本の個人投資家向け無料ツール',
    description:
      '日本向け「無料」投資・家計「ツール」。ETF「比較」、NISA、ニュースとインサイトをまとめて利用できます。',
    path: normalized,
    isTool: false,
  }

  const basePath = row.path || normalized
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
  }
}

export function webApplicationJsonLd(name, pageUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    url: pageUrl,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Any',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'JPY',
    },
  }
}
