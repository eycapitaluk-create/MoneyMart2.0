import { buildHeadBlock, webApplicationLd } from './lib/seoHead.js'

function sendHtml(res, status, html) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(html)
}

export default async function handler(_req, res) {
  const head = buildHeadBlock({
    title: '株式マーケット・注目銘柄 | MoneyMart',
    description:
      '株価・チャート・ウォッチリストをまとめて確認できる無料ツール。ETFとの比較や、NISA成長投資枠での銘柄検討に活用できます。',
    canonicalPath: '/stocks',
    jsonLd: [webApplicationLd({ name: 'MoneyMart 株式ツール', url: '/stocks' })],
  })

  const html = `<!doctype html>
<html lang="ja">
  <head>${head}
  </head>
  <body style="margin:0;background:#f8fafc;font-family:'Noto Sans JP',system-ui,-apple-system,sans-serif;color:#0f172a;">
    <main style="max-width:920px;margin:0 auto;padding:28px 16px 42px 16px;">
      <header style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11px;letter-spacing:.14em;font-weight:900;color:#0ea5e9;">MONEYMART STOCKS</p>
        <h1 style="margin:8px 0 0 0;font-size:34px;line-height:1.15;font-weight:900;">株式ページ</h1>
        <p style="margin:10px 0 0 0;font-size:14px;line-height:1.8;color:#475569;">
          主要銘柄の価格推移やウォッチリストを確認できます。実際の比較表・チャートUIはJavaScript有効時に読み込まれます。
          データ不足時は推定値を出さず、取得できる情報のみを表示します。
        </p>
      </header>
      <section style="display:grid;gap:10px;">
        <a href="/market-indicator" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">マーケット指標へ</a>
        <a href="/news" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">AIニュースへ</a>
        <a href="/insights" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">投資インサイトへ</a>
      </section>
    </main>
  </body>
</html>`

  return sendHtml(res, 200, html)
}
