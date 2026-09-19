/**
 * Apply JPX ETF list trust fees → stock_symbols.trust_fee
 *
 * Convention: store 税込 estimate = JPX税抜 × 1.1 (3dp), matching how many
 * Japanese product pages advertise the inclusive rate.
 * Prospectus overrides for known MAXIS cases (税込 exact).
 *
 * Skips rows already within TOL of either 税抜 or 税込 estimate.
 *
 *   node scripts/apply-etf-trust-fee-from-jpx-audit.mjs
 *   node scripts/apply-etf-trust-fee-from-jpx-audit.mjs --dry-run
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DRY = process.argv.includes('--dry-run')
const TOL = 0.005

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

/** Known prospectus 税込 (prefer over JPX×1.1) */
const PROSPECTUS_INC = {
  '2558.T': 0.077,
  '2630.T': 0.077,
  '2631.T': 0.22,
  '2632.T': 0.22,
}

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
  if (PROSPECTUS_INC[sym] != null) return PROSPECTUS_INC[sym]
  return Number((jpx.value * 1.1).toFixed(3))
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
    const curFee = cur?.trust_fee == null ? null : Number(cur.trust_fee)
    const ex = jpx.value
    const inc = Number((ex * 1.1).toFixed(3))
    const ok =
      curFee != null
      && (Math.abs(curFee - want) <= TOL
        || Math.abs(curFee - ex) <= TOL
        || Math.abs(curFee - inc) <= TOL
        || (jpx.within && curFee <= ex + TOL)
        || (jpx.within && curFee <= inc + TOL))
    // Still force prospectus overrides even if "ok" against wrong value
    const force = PROSPECTUS_INC[sym] != null && curFee != null && Math.abs(curFee - PROSPECTUS_INC[sym]) > TOL
    if (ok && !force) {
      skipped.push(sym)
      continue
    }
    if (!cur) {
      // symbol not in DB — skip create (master must exist)
      skipped.push(`${sym}:no_db_row`)
      continue
    }
    updates.push({ symbol: sym, from: curFee, to: want, jpx_ex: ex, jpx_raw: jpx.raw })
  }

  console.log(`to update: ${updates.length}, skip: ${skipped.length}`)
  const reportPath = path.join(ROOT, 'reports', 'ETF_TRUST_FEE_APPLY_FROM_JPX.tsv')
  const lines = ['symbol\tfrom\tto\tjpx_ex\tjpx_raw']
  for (const u of updates) {
    lines.push([u.symbol, u.from, u.to, u.jpx_ex, u.jpx_raw].join('\t'))
  }
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`)
  console.log(`Wrote ${reportPath}`)

  if (DRY) {
    console.log('Dry run — no DB writes')
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
      for (const [s, v] of Object.entries(PROSPECTUS_INC)) bySym.set(s, v)
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
