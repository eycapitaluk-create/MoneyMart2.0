import { buildHeadBlock, webApplicationLd } from './lib/seoHead.js'

function sendHtml(res, status, html) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(html)
}

export default async function handler(_req, res) {
  const head = buildHeadBlock({
    title: '無料投資ツール一覧（ETF比較・配当管理）| MoneyMart',
    description:
      'ETF比較、配当カレンダー、家計トラッカーなど無料で使える投資ツールを一覧で確認。新NISAや長期投資の計画づくりに役立ちます。',
    canonicalPath: '/tools',
    jsonLd: [webApplicationLd({ name: 'MoneyMart ツールハブ', url: '/tools' })],
  })

  const html = `<!doctype html>
<html lang="ja">
  <head>${head}
  </head>
  <body style="margin:0;background:#f8fafc;font-family:'Noto Sans JP',system-ui,-apple-system,sans-serif;color:#0f172a;">
    <main style="max-width:920px;margin:0 auto;padding:28px 16px 42px 16px;">
      <header style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11px;letter-spacing:.14em;font-weight:900;color:#f97316;">MONEYMART TOOLS</p>
        <h1 style="margin:8px 0 0 0;font-size:34px;line-height:1.15;font-weight:900;">ツールハブ</h1>
        <p style="margin:10px 0 0 0;font-size:14px;line-height:1.8;color:#475569;">
          無料で使える投資・家計ツールを用途別にまとめています。ETF比較、配当管理、家計管理を組み合わせて、NISAを含む中長期の運用方針を整理できます。
        </p>
      </header>
      <section style="display:grid;gap:10px;">
        <a href="/etf-compare" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">ETF比較</a>
        <a href="/dividend-calendar" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">配当カレンダー</a>
        <a href="/budget-tracker" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">家計トラッカー</a>
        <a href="/market-indicator" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">マーケット指標</a>
      </section>
    </main>
  </body>
</html>`

  return sendHtml(res, 200, html)
}
