/**
 * Supabase stock_symbol_profiles から日本株(symbol が .T 終わり)の sector/industry を TSV で出力。
 *
 *   node scripts/export-jp-stock-sectors-tsv.mjs [--out=reports/JP_STOCK_SYMBOL_SECTORS.tsv]
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY（または SUPABASE_SECRET_KEY）
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const loadEnv = async () => {
  for (const f of ['.env.local', '.env']) {
    try {
      const raw = await fs.readFile(f, 'utf8')
      for (const line of raw.split(/\r?\n/)) {
        const t = line.trim()
        if (!t || t.startsWith('#') || !t.includes('=')) continue
        const eq = t.indexOf('=')
        const k = t.slice(0, eq).trim()
        const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
        if (k && !process.env[k]) process.env[k] = v
      }
    } catch {}
  }
}

const escapeTsv = (s) => {
  const x = String(s ?? '')
  if (/[\t\n\r"]/.test(x)) return `"${x.replace(/"/g, '""')}"`
  return x
}

const run = async () => {
  await loadEnv()
  const url = process.env.SUPABASE_URL?.trim()
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    || process.env.SUPABASE_SECRET_KEY?.trim()
  if (!url || !key) {
    console.error('Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY')
    process.exit(1)
  }

  const outArg =
    process.argv.find((a) => a.startsWith('--out='))?.slice('--out='.length)
    || 'reports/JP_STOCK_SYMBOL_SECTORS.tsv'

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  const pageSize = 1000
  let from = 0
  const rows = []
  for (;;) {
    const { data, error } = await supabase
      .from('stock_symbol_profiles')
      .select('symbol,sector,industry,name_jp,name_en,asset_type')
      .like('symbol', '%.T')
      .order('symbol', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw error
    const chunk = Array.isArray(data) ? data : []
    rows.push(...chunk)
    if (chunk.length < pageSize) break
    from += pageSize
  }

  const headers = ['symbol', 'sector', 'industry', 'name_jp', 'name_en', 'asset_type']
  const lines = [
    headers.join('\t'),
    ...rows.map((r) =>
      headers.map((h) => escapeTsv(r[h])).join('\t'),
    ),
  ]
  const body = `${lines.join('\n')}\n`
  await fs.mkdir(path.dirname(outArg), { recursive: true })
  await fs.writeFile(outArg, body, 'utf8')
  console.log(`Wrote ${rows.length} rows → ${path.resolve(outArg)}`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
