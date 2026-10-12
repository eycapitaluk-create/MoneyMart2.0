import { breadcrumbListJsonLd, buildHeadBlock, getSiteOrigin, webApplicationLd } from './lib/seoHead.js'

function sendHtml(res, status, html) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(html)
}

const TITLE = '家計トラッカー｜支出とNISA積立のバランスを整理 | MoneyMart'
const DESCRIPTION = 'レシート読み取りと分類で家計を可視化する無料ツール。日常の支出と、新NISA・ETFなど投資とのバランス確認に使えます。'

export default async function handler(_req, res) {
  const origin = getSiteOrigin()
  const head = buildHeadBlock({
    title: TITLE,
    description: DESCRIPTION,
    canonicalPath: '/budget-tracker',
    jsonLd: [
      webApplicationLd({ name: 'MoneyMart 家計トラッカー', url: '/budget-tracker' }),
      breadcrumbListJsonLd(origin, [
        { name: 'ホーム', path: '/' },
        { name: '家計トラッカー', path: '/budget-tracker' },
      ]),
    ],
  })

  const html = `<!doctype html>
<html lang="ja">
  <head>${head}
  </head>
  <body style="margin:0;background:#f8fafc;font-family:'Noto Sans JP',system-ui,-apple-system,sans-serif;color:#0f172a;">
    <main style="max-width:720px;margin:0 auto;padding:28px 16px 42px 16px;">
      <h1 style="margin:0;font-size:34px;line-height:1.15;font-weight:900;">家計トラッカー</h1>
      <p style="margin:10px 0 0 0;font-size:14px;line-height:1.8;color:#475569;">
        月次の支出を分類し、積立や配当の入金見込みと並べてキャッシュフローを確認できます。レシート読み取りはログイン後に利用できます。
      </p>
      <p style="margin:16px 0 0;font-weight:800;">
        <a href="/dividend-calendar" style="color:#c2410c;margin-right:12px;">配当予定を見る</a>
        <a href="/tools/nisa-etf-checklist" style="color:#c2410c;">NISAの確認項目</a>
      </p>
    </main>
  </body>
</html>`

  return sendHtml(res, 200, html)
}
