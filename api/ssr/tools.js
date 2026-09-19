import { buildHeadBlock, webApplicationLd, breadcrumbListJsonLd, getSiteOrigin, ssrTrustNavHtml } from './lib/seoHead.js'
import { MM_PATH_PREFIXES_TOOLS, parseMmPathForSsr } from './lib/mmPathAllowlist.js'

function sendHtml(res, status, html) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(html)
}

function readToolsPath(req) {
  const full = String(req.url || '')
  const qIdx = full.indexOf('?')
  const search = qIdx >= 0 ? full.slice(qIdx + 1) : ''
  const outerQs = new URLSearchParams(search)
  const mm = outerQs.get('__mm_path')
  if (mm) {
    const parsed = parseMmPathForSsr(mm, MM_PATH_PREFIXES_TOOLS)
    if (parsed.ok) return parsed.pathname
  }
  return '/tools'
}

function wrap(head, inner) {
  return `<!doctype html>
<html lang="ja">
  <head>${head}
  </head>
  <body style="margin:0;background:#f8fafc;font-family:'Noto Sans JP',system-ui,-apple-system,sans-serif;color:#0f172a;">
    <main style="max-width:920px;margin:0 auto;padding:28px 16px 42px 16px;">
      ${inner}
      ${ssrTrustNavHtml()}
    </main>
  </body>
</html>`
}

export default async function handler(req, res) {
  const origin = getSiteOrigin()
  const pathname = readToolsPath(req)

  if (pathname === '/tools/nisa-etf-checklist') {
    const title = 'NISA・ETFを選ぶ前の初心者チェックリスト | MoneyMart'
    const description =
      '人気ランキングを見る前に、投資期間・積立額・信託報酬・為替・分配金などの比較軸を整理する無料チェックリスト。NISA・ETF初心者向け。投資助言ではありません。'
    const head = buildHeadBlock({
      title,
      description,
      canonicalPath: '/tools/nisa-etf-checklist',
      jsonLd: [
        webApplicationLd({ name: 'NISA・ETF初心者チェックリスト', url: '/tools/nisa-etf-checklist', description }),
        breadcrumbListJsonLd(origin, [
          { name: 'ホーム', path: '/' },
          { name: 'ツール', path: '/tools' },
          { name: 'NISA・ETFチェックリスト', path: '/tools/nisa-etf-checklist' },
        ]),
      ],
    })
    return sendHtml(res, 200, wrap(head, `
      <header style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11px;letter-spacing:.14em;font-weight:900;color:#f97316;">MONEYMART TOOLS</p>
        <h1 style="margin:8px 0 0 0;font-size:30px;line-height:1.2;font-weight:900;">NISA・ETFを選ぶ前に確認したい7つの軸</h1>
        <p style="margin:10px 0 0 0;font-size:14px;line-height:1.8;color:#475569;">
          期間・積立額・地域分散・信託報酬・為替・分配金・集中度を先に整理すると、ランキングだけに引っ張られにくくなります。結果は保存されません。
        </p>
      </header>
      <section style="display:grid;gap:10px;">
        <a href="/etf-compare" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">国内ETFの信託報酬を比較する</a>
        <a href="/funds" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">投資信託・ETF一覧</a>
        <a href="/insights/category/nisa" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">新NISAのインサイト</a>
      </section>
    `))
  }

  const title = '無料投資ツール一覧｜ETF比較・配当・NISAチェック | MoneyMart'
  const description =
    'ETF比較、配当カレンダー、家計トラッカー、NISA・ETFチェックリストなど、ポートフォリオ整理に使える無料ツールの入口です。'
  const head = buildHeadBlock({
    title,
    description,
    canonicalPath: '/tools',
    jsonLd: [
      webApplicationLd({ name: 'MoneyMart ツールハブ', url: '/tools', description }),
      breadcrumbListJsonLd(origin, [
        { name: 'ホーム', path: '/' },
        { name: 'ツール', path: '/tools' },
      ]),
    ],
  })

  return sendHtml(res, 200, wrap(head, `
      <header style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11px;letter-spacing:.14em;font-weight:900;color:#f97316;">MONEYMART TOOLS</p>
        <h1 style="margin:8px 0 0 0;font-size:34px;line-height:1.15;font-weight:900;">ポートフォリオを整理する無料ツール</h1>
        <p style="margin:10px 0 0 0;font-size:14px;line-height:1.8;color:#475569;">
          ETFの重複と信託報酬、新NISAの確認項目、配当の入金予定、家計の支出を用途別に選べます。将来の運用成果を保証するものではありません。
        </p>
      </header>
      <section style="display:grid;gap:10px;">
        <a href="/etf-compare" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">ETF比較（重複・信託報酬）</a>
        <a href="/tools/nisa-etf-checklist" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">NISA・ETFチェックリスト</a>
        <a href="/dividend-calendar" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">配当カレンダー</a>
        <a href="/budget-tracker" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">家計トラッカー</a>
        <a href="/market" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">マーケット指標</a>
      </section>
  `))
}
