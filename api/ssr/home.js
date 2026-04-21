import { buildHeadBlock, getSiteOrigin } from './lib/seoHead.js'

function sendHtml(res, status, html) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(html)
}

export default async function handler(_req, res) {
  const origin = getSiteOrigin()
  const head = buildHeadBlock({
    title: '新NISA・ETF比較・日本株分析 | MoneyMart',
    description:
      '投資初心者から使える無料の資産運用ツール。新NISA、ETF比較、日本株・米国株の情報収集、ニュース要約、投資インサイトをまとめて確認できます。',
    canonicalPath: '/',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'MoneyMart',
        url: origin,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'MoneyMart',
        url: origin,
      },
    ],
  })

  const html = `<!doctype html>
<html lang="ja">
  <head>${head}
  </head>
  <body style="margin:0;background:#f8fafc;font-family:'Noto Sans JP',system-ui,-apple-system,sans-serif;color:#0f172a;">
    <main style="max-width:980px;margin:0 auto;padding:28px 16px 42px 16px;">
      <header style="margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11px;letter-spacing:.14em;font-weight:900;color:#f97316;">MONEYMART</p>
        <h1 style="margin:8px 0 0 0;font-size:38px;line-height:1.15;font-weight:900;">日本の個人投資家向け 無料ファイナンスツール</h1>
        <p style="margin:10px 0 0 0;font-size:14px;line-height:1.8;color:#475569;">
          MoneyMartは、ETF比較、NISAを意識した資産整理、株価確認、ニュース収集、投資インサイト閲覧を一つの導線で使えるサービスです。
          JavaScript有効時には、比較表やウォッチリストなどのインタラクティブ機能が読み込まれます。
        </p>
      </header>
      <section style="display:grid;gap:10px;">
        <a href="/etf-compare" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">ETF比較ツール</a>
        <a href="/market-indicator" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">マーケット指標</a>
        <a href="/news" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">AIニュース</a>
        <a href="/insights" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">投資インサイト</a>
      </section>
    </main>
  </body>
</html>`

  return sendHtml(res, 200, html)
}
