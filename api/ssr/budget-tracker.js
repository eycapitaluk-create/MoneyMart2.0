import { buildHeadBlock, webApplicationLd } from './lib/seoHead.js'

function sendHtml(res, status, html) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(html)
}

const TITLE = 'AI Receipt Scanner & Budget Tracker | MoneyMart'
const DESCRIPTION = 'レシート読み取りとAI分類で家計を可視化する「無料」の「ツール」。日常の支出管理と、NISA・ETFなど投資枠とのバランス確認に活用できます。他機能との「比較」検討用ダッシュボードとしても使えます。'

export default async function handler(_req, res) {
  const head = buildHeadBlock({
    title: TITLE,
    description: DESCRIPTION,
    canonicalPath: '/budget-tracker',
    jsonLd: [webApplicationLd({ name: 'MoneyMart 家計トラッカー', url: '/budget-tracker' })],
  })

  const html = `<!doctype html>
<html lang="ja">
  <head>${head}
  </head>
  <body style="margin:0;background:#f8fafc;font-family:'Noto Sans JP',system-ui,-apple-system,sans-serif;color:#0f172a;">
    <main style="max-width:720px;margin:0 auto;padding:28px 16px 42px 16px;">
      <header style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11px;letter-spacing:.14em;font-weight:900;color:#f97316;">MONEYMART TOOLS</p>
        <h1 style="margin:8px 0 0 0;font-size:34px;line-height:1.15;font-weight:900;">家計トラッカー</h1>
        <p style="margin:10px 0 0 0;font-size:14px;line-height:1.8;color:#475569;">
          支出・ポイント・予算をまとめて確認し、月次のキャッシュフローを整えるツールです。ログイン後はマイページで利用できます。
        </p>
      </header>
      <section style="border:1px solid #e2e8f0;border-radius:16px;background:#fff;padding:18px;">
        <p style="margin:0;font-size:14px;line-height:1.8;color:#334155;">
          AIによるレシートOCRや分類はログイン後にご利用いただけます。
        </p>
        <p style="margin:14px 0 0 0;">
          <a href="/login" style="display:inline-block;padding:10px 16px;border-radius:12px;background:#ea580c;color:#fff;font-weight:800;text-decoration:none;font-size:14px;">ログインして開く</a>
        </p>
      </section>
      <footer style="margin-top:22px;font-size:11px;color:#64748b;">本ページはログイン後の機能案内を含みます。</footer>
    </main>
  </body>
</html>`

  return sendHtml(res, 200, html)
}
