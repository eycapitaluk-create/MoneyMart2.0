/**
 * Full audit: MoneyMart stock_symbols.trust_fee vs JPX ETF list (税抜).
 *
 * JPX source note: fees on the list are 税抜き, year-end (or listing-time for new listings).
 * MoneyMart store appears mixed historically (some 税込 like 2558=0.077).
 *
 *   node scripts/audit-etf-trust-fee-vs-jpx.mjs
 *   node scripts/audit-etf-trust-fee-vs-jpx.mjs --jpx-md=/path/to/jpx.md
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

function loadEnv(file) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#') || !t.includes('=')) continue
      const eq = t.indexOf('=')
      const k = t.slice(0, eq).trim()
      let v = t.slice(eq + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (k && process.env[k] == null) process.env[k] = v
    }
  } catch {}
}

loadEnv(path.join(ROOT, '.env.local'))
loadEnv(path.join(ROOT, '.env'))

const JPX_URL = 'https://www.jpx.co.jp/equities/products/etfs/issues/01.html'
const TOL = 0.005 // absolute percentage points

function parseFeeCell(raw) {
  const s = String(raw || '').replace(/％/g, '%').trim()
  const m = s.match(/([0-9]+(?:\.[0-9]+)?)\s*%/)
  if (!m) return null
  return {
    value: Number(m[1]),
    within: /以内/.test(s),
    raw: s,
  }
}

function parseJpxMarkdown(md) {
  const map = new Map()
  for (const line of md.split(/\n/)) {
    if (!line.startsWith('|')) continue
    const cols = line.split('|').map((c) => c.trim())
    // | idx | code | name | mgmt | fee | ...
    if (cols.length < 6) continue
    const code = cols[2]
    if (!/^[0-9]{3,4}[A-Z]?$/.test(code)) continue
    const fee = parseFeeCell(cols[5])
    if (!fee) continue
    map.set(`${code}.T`, {
      code,
      name: cols[3],
      jpxFeeExTax: fee.value,
      jpxWithin: fee.within,
      jpxRaw: fee.raw,
    })
  }
  return map
}

async function fetchJpxMarkdown() {
  const arg = process.argv.find((a) => a.startsWith('--jpx-md='))
  if (arg) {
    return fs.readFileSync(arg.slice('--jpx-md='.length), 'utf8')
  }
  const res = await fetch(JPX_URL, {
    headers: { 'user-agent': 'MoneyMartTrustFeeAudit/1.0' },
  })
  if (!res.ok) throw new Error(`JPX fetch failed: ${res.status}`)
  const html = await res.text()
  // Prefer pre-converted md if WebFetch-style tables exist; else crude HTML row parse
  if (html.includes('| 連動対象指標 |')) return html
  const mapLines = ['| 連動対象指標 | コード | 名称 | 管理会社（検索コード） | 信託報酬 |']
  const rowRe = /<tr[^>]*>[\s\S]*?<\/tr>/gi
  const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
  for (const row of html.match(rowRe) || []) {
    const cells = []
    let m
    cellRe.lastIndex = 0
    while ((m = cellRe.exec(row))) {
      cells.push(m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    }
    if (cells.length < 5) continue
    // find code-like cell
    const codeIdx = cells.findIndex((c) => /^[0-9]{3,4}[A-Z]?$/.test(c))
    if (codeIdx < 0) continue
    const code = cells[codeIdx]
    const name = cells[codeIdx + 1] || ''
    const feeCell = cells.find((c) => /%|％/.test(c) && /[0-9]/.test(c))
    if (!feeCell) continue
    mapLines.push(`| - | ${code} | ${name} | - | ${feeCell} |`)
  }
  return mapLines.join('\n')
}

async function loadDbFees(sb) {
  const rows = []
  let from = 0
  for (;;) {
    const { data, error } = await sb
      .from('stock_symbols')
      .select('symbol,name,trust_fee')
      .not('trust_fee', 'is', null)
      .like('symbol', '%.T')
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data || []))
    if (!data?.length || data.length < 1000) break
    from += 1000
  }
  return rows
}

function classify(mm, jpx) {
  if (mm == null || !Number.isFinite(mm)) return 'mm_missing'
  if (!jpx) return 'jpx_missing'
  const ex = jpx.jpxFeeExTax
  const inc = +(ex * 1.1).toFixed(6)
  const matchEx = Math.abs(mm - ex) <= TOL
  const matchInc = Math.abs(mm - inc) <= TOL
  if (jpx.jpxWithin && mm <= ex + TOL) return 'ok_within_cap_ex'
  if (matchEx) return 'ok_ex_tax'
  if (matchInc) return 'ok_inc_tax'
  // suspicious: mm lower than both by a lot, or higher
  return 'mismatch'
}

async function main() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing SUPABASE_URL / SERVICE_ROLE_KEY')
    process.exit(1)
  }
  const sb = createClient(url, key, { auth: { persistSession: false } })

  console.log('Fetching JPX list…')
  const md = await fetchJpxMarkdown()
  const jpx = parseJpxMarkdown(md)
  console.log(`JPX parsed: ${jpx.size} symbols`)

  const db = await loadDbFees(sb)
  console.log(`DB with trust_fee (*.T): ${db.length}`)

  const outDir = path.join(ROOT, 'reports')
  fs.mkdirSync(outDir, { recursive: true })

  const results = []
  const dbBySym = new Map(db.map((r) => [r.symbol, r]))

  for (const [sym, j] of jpx) {
    const mm = dbBySym.get(sym)
    const mmFee = mm ? Number(mm.trust_fee) : null
    const status = classify(mmFee, j)
    results.push({
      symbol: sym,
      name_jpx: j.name,
      name_mm: mm?.name || '',
      mm_fee: mmFee,
      jpx_fee_ex_tax: j.jpxFeeExTax,
      jpx_fee_inc_est: +(j.jpxFeeExTax * 1.1).toFixed(4),
      jpx_raw: j.jpxRaw,
      jpx_within: j.jpxWithin,
      status,
      delta_vs_ex: mmFee == null ? null : +(mmFee - j.jpxFeeExTax).toFixed(4),
      delta_vs_inc: mmFee == null ? null : +(mmFee - j.jpxFeeExTax * 1.1).toFixed(4),
    })
  }

  // DB symbols not on JPX parse
  for (const r of db) {
    if (!jpx.has(r.symbol)) {
      results.push({
        symbol: r.symbol,
        name_jpx: '',
        name_mm: r.name,
        mm_fee: Number(r.trust_fee),
        jpx_fee_ex_tax: null,
        jpx_fee_inc_est: null,
        jpx_raw: '',
        jpx_within: false,
        status: 'jpx_missing',
        delta_vs_ex: null,
        delta_vs_inc: null,
      })
    }
  }

  const counts = {}
  for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1

  const mismatch = results
    .filter((r) => r.status === 'mismatch')
    .sort((a, b) => Math.abs(b.delta_vs_ex || 0) - Math.abs(a.delta_vs_ex || 0))

  const tsvPath = path.join(outDir, 'ETF_TRUST_FEE_AUDIT_VS_JPX.tsv')
  const header = [
    'symbol', 'status', 'mm_fee', 'jpx_fee_ex_tax', 'jpx_fee_inc_est', 'delta_vs_ex', 'delta_vs_inc',
    'jpx_within', 'jpx_raw', 'name_jpx', 'name_mm',
  ]
  const lines = [header.join('\t')]
  for (const r of results.sort((a, b) => a.symbol.localeCompare(b.symbol))) {
    lines.push(header.map((h) => String(r[h] ?? '')).join('\t'))
  }
  fs.writeFileSync(tsvPath, `${lines.join('\n')}\n`, 'utf8')

  const mismatchPath = path.join(outDir, 'ETF_TRUST_FEE_MISMATCH_VS_JPX.tsv')
  const mLines = [header.join('\t')]
  for (const r of mismatch) mLines.push(header.map((h) => String(r[h] ?? '')).join('\t'))
  fs.writeFileSync(mismatchPath, `${mLines.join('\n')}\n`, 'utf8')

  console.log('\n=== Summary ===')
  console.log(counts)
  console.log(`\nWrote ${tsvPath}`)
  console.log(`Wrote ${mismatchPath} (${mismatch.length} mismatches)`)
  console.log('\nTop mismatches:')
  for (const r of mismatch.slice(0, 25)) {
    console.log(
      `${r.symbol}\tMM=${r.mm_fee}\tJPX_ex=${r.jpx_fee_ex_tax}\tJPX_inc≈${r.jpx_fee_inc_est}\tΔex=${r.delta_vs_ex}\t${(r.name_jpx || r.name_mm).slice(0, 40)}`,
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
