/**
 * Compare JPX tax-exclusive ETF list fees with stock_symbols.trust_fee.
 *
 * A stored pre-tax rate is not treated as already correct. "以内" caps are not
 * an upper bound that makes any lower rate OK. Inclusive comparison is exact
 * (exclusive × 1.1), not rounded to 3 decimals.
 *
 * DB writes are off unless --write-verified-prospectus is passed, and then only
 * the prospectus map is eligible. Unverified JPX-derived fees are report-only.
 *
 *   node scripts/apply-etf-trust-fee-from-jpx-audit.mjs
 *   node scripts/apply-etf-trust-fee-from-jpx-audit.mjs --write-verified-prospectus
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import {
  PROSPECTUS_INCLUSIVE_TRUST_FEE,
  classifyTrustFee,
  feesMatch,
  parseTrustFeePercent,
  planTrustFeeUpdate,
} from '../src/lib/trustFee.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const WRITE_VERIFIED = process.argv.includes('--write-verified-prospectus')

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

function parseFeeCell(raw) {
  const s = String(raw || '').replace(/％/g, '%').trim()
  const m = s.match(/([0-9]+(?:\.[0-9]+)?)\s*%/)
  if (!m) return null
  return { value: Number(m[1]), within: /以内/.test(s), raw: s }
}

function parseJpxMarkdown(md) {
  const map = new Map()
  for (const line of md.split(/\n/)) {
    if (!line.startsWith('|')) continue
    const cols = line.split('|').map((c) => c.trim())
    if (cols.length < 6) continue
    const code = cols[2]
    if (!/^[0-9]{3,4}[A-Z]?$/.test(code)) continue
    const fee = parseFeeCell(cols[5])
    if (!fee) continue
    map.set(`${code}.T`, fee)
  }
  return map
}

function targetInc(sym, jpx) {
  return planTrustFeeUpdate({ symbol: sym, stored: null, exclusive: jpx.value }).target
}

async function fetchJpx() {
  const arg = process.argv.find((a) => a.startsWith('--jpx-md='))
  if (arg) return fs.readFileSync(arg.slice('--jpx-md='.length), 'utf8')
  const cached = path.join(
    ROOT,
    'reports',
    'jpx_etf_list_01.md',
  )
  if (fs.existsSync(cached)) return fs.readFileSync(cached, 'utf8')
  const res = await fetch('https://www.jpx.co.jp/equities/products/etfs/issues/01.html', {
    headers: { 'user-agent': 'MoneyMartTrustFeePatch/1.0' },
  })
  if (!res.ok) throw new Error(`JPX fetch ${res.status}`)
  const html = await res.text()
  // Prefer agent-tools cache if present
  const agentTools = '/Users/justinnam/.cursor/projects/Users-justinnam-cursor-worktrees-MoneyMart2-0-utn/agent-tools/4bdfc1b9-7d8b-44ff-b20c-5209fdb7ad50.txt'
  if (fs.existsSync(agentTools)) return fs.readFileSync(agentTools, 'utf8')
  // crude HTML→pseudo md
  const lines = ['| x | コード | 名称 | y | 信託報酬 |']
  const rowRe = /<tr[^>]*>[\s\S]*?<\/tr>/gi
  const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
  for (const row of html.match(rowRe) || []) {
    const cells = []
    let m
    cellRe.lastIndex = 0
    while ((m = cellRe.exec(row))) {
      cells.push(m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    }
    const codeIdx = cells.findIndex((c) => /^[0-9]{3,4}[A-Z]?$/.test(c))
    if (codeIdx < 0) continue
    const feeCell = cells.find((c) => /%|％/.test(c) && /[0-9]/.test(c))
    if (!feeCell) continue
    lines.push(`| - | ${cells[codeIdx]} | ${cells[codeIdx + 1] || ''} | - | ${feeCell} |`)
  }
  fs.writeFileSync(cached, `${lines.join('\n')}\n`)
  return lines.join('\n')
}

async function main() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing supabase env')
  const sb = createClient(url, key, { auth: { persistSession: false } })

  const jpxMap = parseJpxMarkdown(await fetchJpx())
  console.log(`JPX fees: ${jpxMap.size}`)

  // load current DB fees
  const db = []
  let from = 0
  for (;;) {
    const { data, error } = await sb
      .from('stock_symbols')
      .select('symbol,trust_fee')
      .like('symbol', '%.T')
      .range(from, from + 999)
    if (error) throw error
    db.push(...(data || []))
    if (!data?.length || data.length < 1000) break
    from += 1000
  }
  const dbBy = new Map(db.map((r) => [r.symbol, r]))

  const updates = []
  const skipped = []
  for (const [sym, jpx] of jpxMap) {
    const want = targetInc(sym, jpx)
    const cur = dbBy.get(sym)
    const curFee = parseTrustFeePercent(cur?.trust_fee)
    const ex = jpx.value
    const status = classifyTrustFee({ symbol: sym, stored: curFee, exclusive: ex, within: jpx.within })
    const plan = planTrustFeeUpdate({ symbol: sym, stored: curFee, exclusive: ex })
    if (!cur) {
      skipped.push(`${sym}:no_db_row`)
      continue
    }
    if (!plan.verified) {
      if (!feesMatch(curFee, want)) {
        skipped.push(`${sym}:${status}:report_only`)
      } else {
        skipped.push(sym)
      }
      continue
    }
    if (!plan.writable) {
      skipped.push(sym)
      continue
    }
    updates.push({ symbol: sym, from: curFee, to: plan.target, status, jpx_ex: ex, jpx_raw: jpx.raw })
  }

  console.log(`to update: ${updates.length}, skip: ${skipped.length}`)
  const reportPath = path.join(ROOT, 'reports', 'ETF_TRUST_FEE_APPLY_FROM_JPX.tsv')
  const lines = ['symbol\tfrom\tto\tjpx_ex\tjpx_raw']
  for (const u of updates) {
    lines.push([u.symbol, u.from, u.to, u.jpx_ex, u.jpx_raw].join('\t'))
  }
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`)
  console.log(`Wrote ${reportPath}`)

  if (!WRITE_VERIFIED) {
    console.log('No DB writes. Unverified JPX fees stay report-only. --write-verified-prospectus updates prospectus symbols only.')
    console.log(updates.slice(0, 20))
    return
  }

  let ok = 0
  let fail = 0
  for (const u of updates) {
    const { error } = await sb.from('stock_symbols').update({ trust_fee: u.to }).eq('symbol', u.symbol)
    if (error) {
      fail += 1
      console.error('fail', u.symbol, error.message)
    } else ok += 1
  }
  console.log(`Done. updated=${ok} failed=${fail}`)

  // Patch Transformed CSV where present
  const csvPath = path.join(ROOT, 'reports', 'Transformed_ETF_Universe_Final.ja.csv')
  if (fs.existsSync(csvPath)) {
    const csv = fs.readFileSync(csvPath, 'utf8').split(/\n/)
    const header = csv[0].split(',')
    const feeIdx = header.indexOf('trust_fee')
    const symIdx = header.indexOf('symbol')
    if (feeIdx >= 0 && symIdx >= 0) {
      const bySym = new Map(updates.map((u) => [u.symbol, u.to]))
      // also apply prospectus overrides always
      for (const [s, v] of Object.entries(PROSPECTUS_INCLUSIVE_TRUST_FEE)) bySym.set(s, v)
      let n = 0
      for (let i = 1; i < csv.length; i += 1) {
        if (!csv[i]) continue
        // naive CSV split (fields don't contain commas in fee/symbol)
        const cols = csv[i].split(',')
        const sym = cols[symIdx]
        if (bySym.has(sym)) {
          cols[feeIdx] = String(bySym.get(sym))
          csv[i] = cols.join(',')
          n += 1
        }
      }
      fs.writeFileSync(csvPath, `${csv.join('\n')}${csv.at(-1) === '' ? '' : '\n'}`)
      console.log(`CSV patched rows: ${n}`)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
