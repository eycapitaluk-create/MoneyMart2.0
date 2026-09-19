import { breadcrumbListJsonLd, buildHeadBlock, getSiteOrigin, webApplicationLd } from './lib/seoHead.js'

function sendHtml(res, status, html) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(html)
}

const TITLE = '配当カレンダー（日本株・米国株）無料｜入金予定の整理 | MoneyMart'
const DESCRIPTION = '日本株・米国株の配当月・入金見込みをカレンダーで整理する無料ツール。新NISAや長期保有のキャッシュフロー確認に。将来の配当を保証するものではありません。'

export default async function handler(_req, res) {
  const origin = getSiteOrigin()
  const head = buildHeadBlock({
    title: TITLE,
    description: DESCRIPTION,
    canonicalPath: '/dividend-calendar',
    jsonLd: [
      webApplicationLd({ name: 'MoneyMart 配当カレンダー', url: '/dividend-calendar' }),
      breadcrumbListJsonLd(origin, [
        { name: 'ホーム', path: '/' },
        { name: '配当カレンダー', path: '/dividend-calendar' },
      ]),
    ],
  })

  const html = `<!doctype html>
<html lang="ja">
  <head>${head}
  </head>
  <body style="margin:0;background:#f8fafc;font-family:'Noto Sans JP',system-ui,-apple-system,sans-serif;color:#0f172a;">
    <main style="max-width:720px;margin:0 auto;padding:28px 16px 42px 16px;">
      <h1 style="margin:0;font-size:34px;line-height:1.15;font-weight:900;">配当カレンダー</h1>
      <p style="margin:10px 0 0 0;font-size:14px;line-height:1.8;color:#475569;">
        配当月と銘柄を並べて、NISA成長投資枠の入金見込みや再投資のタイミングを整理できます。表示は公開情報に基づく目安です。
      </p>
      <ul style="margin:14px 0 0;padding-left:1.2em;line-height:1.85;font-size:14px;color:#334155;">
        <li>日本株・米国株の配当月をカレンダー形式で確認</li>
        <li>ETFの分配と個別株の配当を同じ流れで見る</li>
        <li>ログイン後はマイページのウォッチリストと連携</li>
      </ul>
      <p style="margin:16px 0 0;font-weight:800;">
        <a href="/etf-compare" style="color:#c2410c;margin-right:12px;">ETFを比較する</a>
        <a href="/tools/nisa-etf-checklist" style="color:#c2410c;">NISAの確認項目</a>
      </p>
      <p style="margin-top:18px;font-size:12px;color:#64748b;">情報提供であり、将来の配当や運用成果を保証しません。<a href="/legal/methodology" style="color:#c2410c;">編集・データ方針</a></p>
    </main>
  </body>
</html>`

  return sendHtml(res, 200, html)
}
