import { buildHeadBlock, webApplicationLd } from './lib/seoHead.js'

function sendHtml(res, status, html) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(html)
}

export default async function handler(_req, res) {
  const head = buildHeadBlock({
    title: '投資信託・ETF比較 | MoneyMart',
    description:
      '投資信託とETFを手数料・分配傾向・値動きで比較できる無料ツール。新NISAの銘柄選びや長期分散投資の検討に活用できます。',
    canonicalPath: '/funds',
    jsonLd: [webApplicationLd({ name: 'MoneyMart ファンドツール', url: '/funds' })],
  })

  const html = `<!doctype html>
<html lang="ja">
  <head>${head}
  </head>
  <body style="margin:0;background:#f8fafc;font-family:'Noto Sans JP',system-ui,-apple-system,sans-serif;color:#0f172a;">
    <main style="max-width:920px;margin:0 auto;padding:28px 16px 42px 16px;">
      <header style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11px;letter-spacing:.14em;font-weight:900;color:#f59e0b;">MONEYMART FUNDS</p>
        <h1 style="margin:8px 0 0 0;font-size:34px;line-height:1.15;font-weight:900;">投資信託・ETFページ</h1>
        <p style="margin:10px 0 0 0;font-size:14px;line-height:1.8;color:#475569;">
          ETFや投資信託を比較して、自分の目的に合う商品を選ぶためのページです。価格・パフォーマンスなどの詳細UIはJavaScript有効時に読み込まれます。
          データ欠損時はダミー値を表示しません。
        </p>
      </header>
      <section style="display:grid;gap:10px;">
        <a href="/etf-compare" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">ETF比較へ</a>
        <a href="/insights" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">投資インサイトへ</a>
        <a href="/market-indicator" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">マーケット指標へ</a>
      </section>
    </main>
  </body>
</html>`

  return sendHtml(res, 200, html)
}
