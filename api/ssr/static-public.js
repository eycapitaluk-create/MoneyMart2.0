import { breadcrumbListJsonLd, buildHeadBlock, getSiteOrigin, organizationJsonLd, ssrTrustNavHtml } from './lib/seoHead.js'
import { MM_PATH_PREFIXES_STATIC_PUBLIC, parseMmPathForSsr } from './lib/mmPathAllowlist.js'
import { COMPANY_NAME_JA_EN, COMPANY_SUPPORT_EMAIL } from '../../src/constants/companyLegal.js'

function sendHtml(res, status, html) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(html)
}

function readPath(req) {
  const full = String(req.url || '')
  const qIdx = full.indexOf('?')
  const search = qIdx >= 0 ? full.slice(qIdx + 1) : ''
  const outerQs = new URLSearchParams(search)
  const mm = outerQs.get('__mm_path')
  if (mm) {
    const parsed = parseMmPathForSsr(mm, MM_PATH_PREFIXES_STATIC_PUBLIC)
    if (parsed.ok) return parsed.pathname
  }
  return ''
}

const PAGES = {
  '/about': {
    title: '運営会社 | MoneyMart',
    h1: 'MoneyMart の運営会社',
    description:
      'マネーラボ株式会社（MoneyLab Inc.）が運営するMoneyMartの会社概要。お問い合わせは support@moneymart.co.jp です。',
    crumbs: [{ name: 'ホーム', path: '/' }, { name: '運営会社', path: '/about' }],
    body: `
      <p>MoneyMart は ${COMPANY_NAME_JA_EN} が運営する、個人投資家向けの比較・確認ツールです。資本提携に左右されない表示を目指しています。</p>
      <p>訂正やお問い合わせ：<a href="mailto:${COMPANY_SUPPORT_EMAIL}">${COMPANY_SUPPORT_EMAIL}</a></p>
      <p><a href="/legal/methodology">編集・データ方針</a> ／ <a href="/careers">採用情報</a></p>
    `,
  },
  '/faq': {
    title: 'FAQ | MoneyMart',
    h1: 'よくある質問',
    description: 'サービス全般・セキュリティ・NISA対応などよくある質問。',
    crumbs: [{ name: 'ホーム', path: '/' }, { name: 'FAQ', path: '/faq' }],
    body: `
      <p>口座連携なしでETF比較や配当カレンダーを試せます。マイページの詳細は無料登録後にご利用ください。</p>
      <p>投資助言は行いません。制度や商品の最終確認は各金融機関の公式情報をご覧ください。</p>
      <p><a href="/tools/nisa-etf-checklist">NISAの確認項目</a> ／ <a href="/etf-compare">ETF比較</a></p>
    `,
  },
  '/careers': {
    title: '採用情報 | MoneyMart',
    h1: '採用情報',
    description: 'MoneyMartの採用情報。ビジネスデベロップメントディレクターを通年で募集しています。',
    crumbs: [{ name: 'ホーム', path: '/' }, { name: '採用', path: '/careers' }],
    body: `<p>詳細な募集要項はブラウザで本ページをご覧ください。お問い合わせは ${COMPANY_SUPPORT_EMAIL} です。</p>`,
  },
  '/premium': {
    title: 'プレミアム会員 | MoneyMart',
    h1: 'MoneyMart Premium',
    description: 'MoneyMart Premium の機能案内。料金は特定商取引法に基づく表記および申込画面の表示に従います。',
    crumbs: [{ name: 'ホーム', path: '/' }, { name: 'プレミアム', path: '/premium' }],
    body: `
      <p>無料ツールに加え、会員向け機能を提供しています。料金・解約は <a href="/legal/commerce">特定商取引法に基づく表記</a> をご確認ください。</p>
    `,
  },
  '/products': {
    title: '金融商品比較 | MoneyMart',
    h1: '金融商品の比較情報',
    description: 'カード・ローン・保険など主要サービスを横断比較できるページです。',
    crumbs: [{ name: 'ホーム', path: '/' }, { name: '金融商品', path: '/products' }],
    body: `<p>提携に偏らない比較表示を目指しています。詳細はブラウザで本ページをご覧ください。</p>`,
  },
  '/legal/methodology': {
    title: '編集・データ方針｜一次情報と訂正窓口 | MoneyMart',
    h1: '編集・データ方針',
    description: 'インサイト編集方針、市場データの取り扱い、一次情報、訂正窓口のご案内です。',
    crumbs: [
      { name: 'ホーム', path: '/' },
      { name: '編集・データ方針', path: '/legal/methodology' },
    ],
    body: `
      <p>インサイトは MoneyMart 編集部が公開情報を整理します。個人名がない記事は編集部名義です。</p>
      <p>価格は原則として前営業日終値（EOD）です。公式資料と異なる場合は公式資料を正とします。</p>
      <p>訂正のご連絡：<a href="mailto:${COMPANY_SUPPORT_EMAIL}">${COMPANY_SUPPORT_EMAIL}</a></p>
      <p><a href="/legal/disclaimer">免責事項</a></p>
    `,
  },
  '/legal/disclaimer': {
    title: '免責事項 | MoneyMart',
    h1: '免責事項',
    description: '提供情報の性質、投資判断の責任範囲、データ取り扱いに関する前提です。',
    crumbs: [{ name: 'ホーム', path: '/' }, { name: '免責事項', path: '/legal/disclaimer' }],
    body: `<p>本サービスは情報提供であり、金融商品取引業（投資助言を含む）には該当しません。詳細はブラウザで全文をご確認ください。</p>`,
  },
  '/legal/privacy': {
    title: 'プライバシーポリシー | MoneyMart',
    h1: 'プライバシーポリシー',
    description: 'MoneyMartの個人情報取り扱い方針です。',
    crumbs: [{ name: 'ホーム', path: '/' }, { name: 'プライバシーポリシー', path: '/legal/privacy' }],
    body: `<p>収集項目・利用目的の全文はブラウザで本ページをご覧ください。</p>`,
  },
  '/legal/terms': {
    title: '利用規約 | MoneyMart',
    h1: '利用規約',
    description: 'MoneyMartの利用条件です。',
    crumbs: [{ name: 'ホーム', path: '/' }, { name: '利用規約', path: '/legal/terms' }],
    body: `<p>ご利用前に全文をご確認ください。</p>`,
  },
  '/legal/commerce': {
    title: '特定商取引法に基づく表記 | MoneyMart',
    h1: '特定商取引法に基づく表記',
    description: 'Premium の販売業者、料金、支払、解約の表記です。',
    crumbs: [{ name: 'ホーム', path: '/' }, { name: '特商法表記', path: '/legal/commerce' }],
    body: `<p>販売業者はマネーラボ株式会社です。料金の詳細は本ページの表をご覧ください。</p>`,
  },
  '/legal/security': {
    title: 'セキュリティ宣言 | MoneyMart',
    h1: 'セキュリティ宣言',
    description: '通信暗号化とアクセス管理に関する宣言です。',
    crumbs: [{ name: 'ホーム', path: '/' }, { name: 'セキュリティ宣言', path: '/legal/security' }],
    body: `<p>通信の暗号化とアクセス権限の管理に努めています。</p>`,
  },
  '/legal/solicitation': {
    title: '勧誘方針 | MoneyMart',
    h1: '勧誘方針',
    description: '広告・紹介に関する方針です。投資助言は行いません。',
    crumbs: [{ name: 'ホーム', path: '/' }, { name: '勧誘方針', path: '/legal/solicitation' }],
    body: `<p>投資助言や特定商品の取得勧誘は行いません。</p>`,
  },
  '/legal/antisocial': {
    title: '反社会的勢力への対応 | MoneyMart',
    h1: '反社会的勢力への対応',
    description: 'マネーラボ株式会社の反社会的勢力に対する方針です。',
    crumbs: [{ name: 'ホーム', path: '/' }, { name: '反社会的勢力への対応', path: '/legal/antisocial' }],
    body: `<p>反社会的勢力との関係を遮断する方針です。全文はブラウザでご確認ください。</p>`,
  },
}

export default async function handler(req, res) {
  const origin = getSiteOrigin()
  const pathname = readPath(req)
  const page = PAGES[pathname]
  if (!page) {
    const head = buildHeadBlock({
      title: 'ページが見つかりません | MoneyMart',
      description: '指定のURLは公開ページではありません。',
      canonicalPath: '/',
      noIndex: true,
    })
    return sendHtml(
      res,
      404,
      `<!doctype html><html lang="ja"><head>${head}</head><body><main style="padding:40px;font-family:sans-serif;"><h1>ページが見つかりません</h1><p><a href="/">ホームへ</a></p></main></body></html>`,
    )
  }
  const head = buildHeadBlock({
    title: page.title,
    description: page.description,
    canonicalPath: pathname,
    jsonLd: [
      organizationJsonLd(origin),
      breadcrumbListJsonLd(origin, page.crumbs),
    ],
  })
  const html = `<!doctype html>
<html lang="ja">
  <head>${head}</head>
  <body style="margin:0;background:#f8fafc;font-family:'Noto Sans JP',system-ui,-apple-system,sans-serif;color:#0f172a;">
    <main style="max-width:760px;margin:0 auto;padding:28px 16px 42px 16px;">
      <h1 style="margin:0;font-size:32px;font-weight:900;">${page.h1}</h1>
      <div style="margin-top:14px;font-size:14px;line-height:1.85;color:#334155;">${page.body}</div>
      ${ssrTrustNavHtml()}
    </main>
  </body>
</html>`
  return sendHtml(res, 200, html)
}
