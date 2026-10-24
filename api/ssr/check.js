/**
 * 重なりチェック (/check, /check/<a>-vs-<b>) のクローラー向け HTML.
 * 人気の組み合わせごとに「A と B の重なり」を事実の文で出す (検索流入用). 判定は src/lib/overlapCheck.js と同じ.
 * URL のパラメータは既知のカタログ ID だけを受け付け、画面に出す文字はすべてエスケープする.
 */
import { buildHeadBlock, webApplicationLd, breadcrumbListJsonLd, getSiteOrigin, ssrTrustNavHtml, escapeHtml } from './lib/seoHead.js'
import { MM_PATH_PREFIXES_CHECK, parseMmPathForSsr } from './lib/mmPathAllowlist.js'
import {
  OVERLAP_FUNDS,
  POPULAR_PAIRS,
  fundById,
  overlapHeadline,
  overlapLines,
  pairSlug,
  parseFundIds,
} from '../../src/lib/overlapCheck.js'

function sendHtml(res, status, html) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(html)
}

function readPath(req) {
  const full = String(req.url || '')
  const qIdx = full.indexOf('?')
  const outerQs = new URLSearchParams(qIdx >= 0 ? full.slice(qIdx + 1) : '')
  const mm = outerQs.get('__mm_path')
  if (mm) {
    const parsed = parseMmPathForSsr(mm, MM_PATH_PREFIXES_CHECK)
    if (parsed.ok) return parsed.pathname
  }
  return '/check'
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

const DISCLAIMER =
  '連動指数の構成ルールにもとづく表示です。実際の保有銘柄・比率は商品ごとに異なります。特定の金融商品の売買を勧誘するものではありません。'

function pairListHtml() {
  return `<ul style="padding-left:18px;line-height:2;">${POPULAR_PAIRS.map(([a, b]) => {
    const fa = fundById(a)
    const fb = fundById(b)
    return `<li><a href="/check/${escapeHtml(pairSlug(a, b))}" style="color:#c2410c;">${escapeHtml(fa.short)} と ${escapeHtml(fb.short)} の重なり</a></li>`
  }).join('')}</ul>`
}

export default async function handler(req, res) {
  const origin = getSiteOrigin()
  const pathname = readPath(req)
  const seg = pathname.startsWith('/check/') ? pathname.slice('/check/'.length) : ''
  const pair = seg ? parseFundIds(seg) : []

  if (seg && pair.length === 2) {
    const [a, b] = pair
    const canonicalPath = `/check/${pairSlug(a.id, b.id)}`
    const title = `${a.short} と ${b.short} の重なり｜連動指数で3秒チェック | MoneyMart`
    const headline = overlapHeadline(pair)
    const lines = overlapLines(pair)
    const description = `${a.name}（${a.index}）と ${b.name}（${b.index}）の連動指数の重なり: ${headline}。`
    const head = buildHeadBlock({
      title,
      description,
      canonicalPath,
      jsonLd: [
        webApplicationLd({ name: '重なりチェック', url: canonicalPath, description }),
        breadcrumbListJsonLd(origin, [
          { name: 'ホーム', path: '/' },
          { name: '重なりチェック', path: '/check' },
          { name: `${a.short} と ${b.short}`, path: canonicalPath },
        ]),
      ],
    })
    return sendHtml(res, 200, wrap(head, `
      <p style="margin:0;font-size:11px;letter-spacing:.14em;font-weight:900;color:#f97316;">重なりチェック</p>
      <h1 style="font-size:26px;line-height:1.4;margin:8px 0 12px;">${escapeHtml(a.short)} と ${escapeHtml(b.short)} の重なり</h1>
      <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:16px;">
        <tr><th style="text-align:left;padding:8px;border-bottom:1px solid #e2e8f0;">商品</th><th style="text-align:left;padding:8px;border-bottom:1px solid #e2e8f0;">種類</th><th style="text-align:left;padding:8px;border-bottom:1px solid #e2e8f0;">連動指数</th></tr>
        ${pair.map((f) => `<tr><td style="padding:8px;border-bottom:1px solid #f1f5f9;">${escapeHtml(f.name)}</td><td style="padding:8px;border-bottom:1px solid #f1f5f9;">${escapeHtml(f.kind)}</td><td style="padding:8px;border-bottom:1px solid #f1f5f9;">${escapeHtml(f.index)}</td></tr>`).join('')}
      </table>
      <h2 style="font-size:18px;">${escapeHtml(headline)}</h2>
      ${lines.map((l) => `<p style="margin:8px 0 2px;font-weight:800;">${escapeHtml(l.title)}</p><p style="margin:0;color:#475569;font-size:13px;">${escapeHtml(l.detail)}</p>`).join('')}
      <p style="margin-top:20px;"><a href="/check?f=${escapeHtml(a.id)},${escapeHtml(b.id)}" style="color:#c2410c;font-weight:800;">ほかの商品も選んで重なりを確認する →</a></p>
      <p style="font-size:12px;color:#64748b;">${escapeHtml(DISCLAIMER)}</p>
      <h2 style="font-size:16px;margin-top:28px;">よく見られている組み合わせ</h2>
      ${pairListHtml()}
    `))
  }

  const canonicalPath = '/check'
  const title = 'オルカンとS&P500、どこまで重なる？ 重なりチェック | MoneyMart'
  const description =
    '持っている（気になる）投資信託・ETFを選ぶだけで、連動指数の重なりを3秒で確認。オルカン・S&P500・全米株式・NASDAQ100・TOPIXなど。登録不要・無料。'
  const head = buildHeadBlock({
    title,
    description,
    canonicalPath,
    jsonLd: [
      webApplicationLd({ name: '重なりチェック', url: canonicalPath, description }),
      breadcrumbListJsonLd(origin, [
        { name: 'ホーム', path: '/' },
        { name: '重なりチェック', path: '/check' },
      ]),
    ],
  })
  return sendHtml(res, 200, wrap(head, `
    <p style="margin:0;font-size:11px;letter-spacing:.14em;font-weight:900;color:#f97316;">無料・登録不要</p>
    <h1 style="font-size:28px;line-height:1.4;margin:8px 0 12px;">オルカンとS&amp;P500、どこまで重なる？</h1>
    <p style="color:#475569;">持っている（気になる）投資信託・ETFを選ぶだけで、連動指数の重なりを確認できます。金額の入力はいりません。</p>
    <h2 style="font-size:16px;margin-top:24px;">対応している商品</h2>
    <ul style="padding-left:18px;line-height:1.9;font-size:14px;">${OVERLAP_FUNDS.map((f) => `<li>${escapeHtml(f.name)}（${escapeHtml(f.index)}）</li>`).join('')}</ul>
    <h2 style="font-size:16px;margin-top:24px;">よく見られている組み合わせ</h2>
    ${pairListHtml()}
    <p style="font-size:12px;color:#64748b;">${escapeHtml(DISCLAIMER)}</p>
  `))
}
