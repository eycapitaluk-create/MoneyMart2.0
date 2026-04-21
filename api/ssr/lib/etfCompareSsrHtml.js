import { buildHeadBlock, escapeHtml, getSiteOrigin, webApplicationLd } from './seoHead.js'

const TITLE = '日本上場ETF比較（344本対応）| 信託報酬・出来高・終値 | MoneyMart'
const DESCRIPTION_BASE =
  '国内上場ETFを手数料・配当利回り・規模などで「比較」できる「無料」の「ツール」です。NISA・つみたて投資の銘柄選びに。ページ内の一覧表はサーバーで生成され、検索エンジンが本文を読み取れます。344本超をアプリで一覧・チャート表示できます。'

/**
 * @param {Array<{ symbol: string, name: string, trustFee: string|null, category: string|null, country: string|null, close: number|null, tradeDate: string|null, volume: number|null }>} rows
 * @param {string} canonicalPath
 */
function buildItemListJsonLd(rows, canonicalPath) {
  const base = getSiteOrigin()
  const path = canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`
  const pageUrl = `${base}${path}#etf-ssr-table-title`
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '日本上場ETF（出来高上位抜粋）',
    description: '直近の取引データに基づく出来高上位の上場投信（ETF）の抜粋一覧です。',
    numberOfItems: rows.length,
    itemListElement: rows.map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `${r.symbol} ${r.name}`.trim(),
      url: pageUrl,
    })),
  }
}

function fmtTrust(v) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return escapeHtml(String(v))
  return escapeHtml(`${n.toFixed(n < 1 ? 3 : 2)}`)
}

function fmtClose(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  return escapeHtml(`${Math.round(Number(v)).toLocaleString('ja-JP')}円`)
}

function fmtVol(v) {
  if (v == null || !Number.isFinite(Number(v)) || Number(v) <= 0) return '—'
  return escapeHtml(`${Math.round(Number(v)).toLocaleString('ja-JP')}`)
}

/**
 * @param {object} opts
 * @param {'/etf-compare'|'/funds/compare'} opts.canonicalPath
 * @param {{ rows?: object[], dataDate?: string|null, error?: string|null }} [opts.snapshot]
 */
export function buildEtfCompareSsrHtml(opts) {
  const { canonicalPath } = opts
  const snapshot = opts.snapshot || {}
  const rows = Array.isArray(snapshot.rows) ? snapshot.rows : []
  const dataDate = snapshot.dataDate || null
  const fetchError = snapshot.error || null

  const jsonLd = [
    webApplicationLd({ name: 'MoneyMart ETF比較', url: canonicalPath }),
    ...(rows.length > 0 ? [buildItemListJsonLd(rows, canonicalPath)] : []),
  ]

  const descExtra =
    rows.length > 0
      ? ` 直近データ日付（抜粋）: ${dataDate || '—'}。`
      : ''
  const head = buildHeadBlock({
    title: TITLE,
    description: `${DESCRIPTION_BASE}${descExtra}`,
    canonicalPath,
    jsonLd,
  })

  const other = canonicalPath === '/etf-compare' ? '/funds/compare' : '/etf-compare'
  const otherLabel = other

  const tableBlock =
    rows.length > 0
      ? `
      <section aria-labelledby="etf-ssr-table-title" style="margin-top:20px;border:1px solid #e2e8f0;border-radius:16px;background:#fff;padding:0;overflow-x:auto;box-shadow:0 1px 2px rgba(15,23,42,.05);">
        <h2 id="etf-ssr-table-title" style="margin:0;padding:16px 18px 8px 18px;font-size:18px;font-weight:900;color:#0f172a;">直近出来高が大きいETF（抜粋・${rows.length}本）</h2>
        <p style="margin:0;padding:0 18px 14px 18px;font-size:12px;line-height:1.6;color:#64748b;">
          次の表はサーバーで生成した静的HTMLです（JavaScript不要）。全${rows.length}行は代表的な銘柄のみで、344本超の一覧・チャート・ウォッチリストはアプリ内で提供します。
          ${dataDate ? `データ基準日（表内の最新）: <strong>${escapeHtml(dataDate)}</strong>。` : ''}
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f1f5f9;border-top:1px solid #e2e8f0;">
              <th scope="col" style="text-align:left;padding:10px 12px;font-weight:800;border-bottom:1px solid #e2e8f0;">コード</th>
              <th scope="col" style="text-align:left;padding:10px 12px;font-weight:800;border-bottom:1px solid #e2e8f0;min-width:160px;">銘柄名</th>
              <th scope="col" style="text-align:right;padding:10px 12px;font-weight:800;border-bottom:1px solid #e2e8f0;">信託報酬(%)</th>
              <th scope="col" style="text-align:right;padding:10px 12px;font-weight:800;border-bottom:1px solid #e2e8f0;">終値</th>
              <th scope="col" style="text-align:left;padding:10px 12px;font-weight:800;border-bottom:1px solid #e2e8f0;">日付</th>
              <th scope="col" style="text-align:right;padding:10px 12px;font-weight:800;border-bottom:1px solid #e2e8f0;">出来高</th>
              <th scope="col" style="text-align:left;padding:10px 12px;font-weight:800;border-bottom:1px solid #e2e8f0;">区分</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (r, idx) => `
            <tr style="background:${idx % 2 === 0 ? '#fff' : '#fafafa'};">
              <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;font-weight:800;white-space:nowrap;">${escapeHtml(r.symbol)}</td>
              <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;line-height:1.45;">${escapeHtml(r.name)}</td>
              <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;text-align:right;white-space:nowrap;">${fmtTrust(r.trustFee)}</td>
              <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;text-align:right;white-space:nowrap;">${fmtClose(r.close)}</td>
              <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;white-space:nowrap;">${escapeHtml(r.tradeDate || '—')}</td>
              <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;text-align:right;white-space:nowrap;">${fmtVol(r.volume)}</td>
              <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#475569;">${escapeHtml(r.category || r.country || '—')}</td>
            </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </section>`
      : `
      <section style="margin-top:20px;border:1px solid #fed7aa;border-radius:16px;background:#fffbeb;padding:16px 18px;">
        <p style="margin:0;font-size:14px;line-height:1.75;color:#78350f;">
          現在、サーバー側でETF一覧表を生成できません（データ未取得${fetchError ? `：${escapeHtml(fetchError)}` : ''}）。
          アプリ内の比較画面ではJavaScript有効時に最新データを読み込みます。
        </p>
      </section>`

  return `<!doctype html>
<html lang="ja">
  <head>${head}
  </head>
  <body style="margin:0;background:#f8fafc;font-family:'Noto Sans JP',system-ui,-apple-system,sans-serif;color:#0f172a;">
    <main style="max-width:980px;margin:0 auto;padding:28px 16px 42px 16px;">
      <header style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11px;letter-spacing:.14em;font-weight:900;color:#f97316;">MONEYMART TOOLS</p>
        <h1 style="margin:8px 0 0 0;font-size:36px;line-height:1.15;font-weight:900;">日本上場ETF比較</h1>
        <p style="margin:10px 0 0 0;font-size:14px;line-height:1.8;color:#475569;">
          信託報酬・分配金・純資産総額・指数連動などの観点で、国内ETF（上場投信）を横並びで確認できます。NISA成長投資枠・つみたて投資での積立検討、指数（TOPIX・日経225・S&amp;P500など）別の整理に活用できる無料ツールです。
        </p>
      </header>
      <section style="border:1px solid #e2e8f0;border-radius:16px;background:#fff;padding:18px;box-shadow:0 1px 2px rgba(15,23,42,.05);">
        <p style="margin:0;font-size:14px;line-height:1.8;color:#334155;">
          インタラクティブなチャート・ウォッチリスト連携などのフル機能は、ブラウザでJavaScriptを有効にしたうえでアプリ内UIからご利用ください。
        </p>
        <p style="margin:14px 0 0 0;font-size:13px;color:#64748b;">
          関連: <a href="${other}" style="color:#ea580c;font-weight:700;">${escapeHtml(otherLabel)}</a>（同一ツールの別URL） / <a href="/insights" style="color:#ea580c;font-weight:700;">投資インサイト</a>
        </p>
      </section>
      ${tableBlock}
      <footer style="margin-top:22px;border-top:1px solid #e2e8f0;padding-top:10px;font-size:11px;color:#64748b;line-height:1.7;">
        表示内容は情報提供のみを目的としており、特定の金融商品の購入・売却を推奨するものではありません。
      </footer>
    </main>
  </body>
</html>`
}
