import { buildHeadBlock, homeJsonLd, ssrTrustNavHtml, breadcrumbListJsonLd, getSiteOrigin } from './lib/seoHead.js'

function sendHtml(res, status, html) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(html)
}

export default async function handler(_req, res) {
  const origin = getSiteOrigin()
  const title = 'MoneyMart｜ポートフォリオの見える化・新NISA・投信とETFの重複確認'
  const description =
    '保有ポートフォリオの偏りと投資信託・ETFの重なり、集中リスクを整理。新NISAの枠と配当予定を無料で確認できます。将来の運用成果を保証するものではなく、投資助言ではありません。'
  const head = buildHeadBlock({
    title,
    description,
    canonicalPath: '/',
    ogImagePath: '/og-card.png',
    jsonLd: [
      ...homeJsonLd(),
      breadcrumbListJsonLd([{ name: 'ホーム', path: '/' }], origin),
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
        <h1 style="margin:8px 0 0 0;font-size:34px;line-height:1.2;font-weight:900;">ポートフォリオの偏りと、投信・ETFの重なりを見える化する</h1>
        <p style="margin:10px 0 0 0;font-size:14px;line-height:1.8;color:#475569;">
          MoneyMartは、保有資産の全体像、投資信託とETFの重複、集中リスク、新NISAの枠、配当の入金予定を一つの画面で整理できる無料ツールです。
          口座連携は不要です。特定の金融商品の購入を推奨するものではなく、将来の運用成果を保証しません。
        </p>
      </header>
      <section style="display:grid;gap:10px;">
        <a href="/etf-compare" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">ETF比較で重複と信託報酬を確認</a>
        <a href="/tools/nisa-etf-checklist" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">新NISA・ETFを選ぶ前のチェックリスト</a>
        <a href="/dividend-calendar" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">配当カレンダーで入金予定を整理</a>
        <a href="/market" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">マーケット指標</a>
        <a href="/insights" style="display:block;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none;font-weight:800;">編集インサイトを読む</a>
      </section>
      ${ssrTrustNavHtml()}
    </main>
  </body>
</html>`

  return sendHtml(res, 200, html)
}
