/**
 * dividendCalendarDetail.generated.json → 종목별 배당월·배당금 TSV
 *
 *   node scripts/export-dividend-month-amount-tsv.mjs
 *
 * 출력:
 *   reports/DIVIDEND_MONTH_AMOUNT_BY_SYMBOL.tsv  … 종목 1행 (월·금액 요약)
 *   reports/DIVIDEND_MONTH_AMOUNT_LONG.tsv       … 종목×월 장표용
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const JSON_PATH = path.join(ROOT, 'src/data/dividendCalendarDetail.generated.json')
const OUT_WIDE = path.join(ROOT, 'reports/DIVIDEND_MONTH_AMOUNT_BY_SYMBOL.tsv')
const OUT_LONG = path.join(ROOT, 'reports/DIVIDEND_MONTH_AMOUNT_LONG.tsv')

/** @param {string} v */
function tsvCell(v) {
  const s = String(v ?? '')
  if (/[\t\n\r"]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** @param {string[]} row */
function tsvLine(row) {
  return row.map(tsvCell).join('\t')
}

function main() {
  const raw = fs.readFileSync(JSON_PATH, 'utf8')
  const pack = JSON.parse(raw)
  const records = Array.isArray(pack.records) ? pack.records : []
  const sorted = [...records].sort((a, b) =>
    String(a.symbol || '').localeCompare(String(b.symbol || ''), 'en'),
  )

  const meta = [
    `# generatedFrom: ${pack.generatedFrom ?? ''}`,
    `# recordCount: ${sorted.length}`,
    `# sourceJson: src/data/dividendCalendarDetail.generated.json`,
  ].join('\n')

  const wideHeader = [
    'symbol',
    'name',
    'category',
    'currency',
    'dividend_months',
    'amount_by_month',
    'annual_dividend',
    'yield_pct',
    'last_amount',
    'last_ex_date',
    'next_ex_date',
  ]

  const longHeader = ['symbol', 'name', 'category', 'currency', 'month', 'amount']

  const wideRows = []
  const longRows = []

  for (const r of sorted) {
    const symbol = String(r.symbol || '').trim()
    if (!symbol) continue
    const name = String(r.name || '')
    const category = String(r.category || '')
    const currency = String(r.currency || '')
    const divs = Array.isArray(r.dividends)
      ? [...r.dividends].sort((a, b) => Number(a.month) - Number(b.month))
      : []
    const months = divs.map((d) => d.month).join(',')
    const amountByMonth = divs.map((d) => `${d.month}월:${d.amount}`).join(' | ')
    wideRows.push(
      tsvLine([
        symbol,
        name,
        category,
        currency,
        months,
        amountByMonth,
        r.annualDividend ?? '',
        r.yieldPct ?? '',
        r.lastAmount ?? '',
        r.lastExDate ?? '',
        r.nextExDate ?? '',
      ]),
    )
    for (const d of divs) {
      longRows.push(
        tsvLine([symbol, name, category, currency, d.month, d.amount]),
      )
    }
  }

  fs.mkdirSync(path.dirname(OUT_WIDE), { recursive: true })
  fs.writeFileSync(
    OUT_WIDE,
    [meta, '', tsvLine(wideHeader), ...wideRows].join('\n') + '\n',
    'utf8',
  )
  fs.writeFileSync(
    OUT_LONG,
    [meta, '', tsvLine(longHeader), ...longRows].join('\n') + '\n',
    'utf8',
  )

  console.log(`Wrote ${sorted.length} symbols → ${path.relative(ROOT, OUT_WIDE)}`)
  console.log(`Wrote ${longRows.length} symbol-month rows → ${path.relative(ROOT, OUT_LONG)}`)
}

main()
