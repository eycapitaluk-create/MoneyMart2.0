/**
 * 日本株セクター表示の即時修正:
 * - 公益事業 → 電力・ガス（DB）
 * - StockPage 一覧に出るが profile 無しの4銘柄を upsert
 *
 *   node scripts/patch-jp-stock-sector-display.mjs
 */
import fs from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import { normalizeSectorForDb } from '../src/lib/stockSectorNormalize.js'

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

const MISSING_PROFILES = [
  { symbol: '7914.T', sector: '資本財・産業', industry: 'その他製品', name_jp: '共同印刷', name_en: 'Dai Nippon Printing' },
  { symbol: '3103.T', sector: '素材', industry: '繊維製品', name_jp: 'ユニチカ', name_en: 'Unitika' },
  { symbol: '6532.T', sector: 'テクノロジー', industry: 'サービス業', name_jp: 'ベイカレント', name_en: 'BayCurrent' },
  { symbol: '7186.T', sector: '金融', industry: '銀行業', name_jp: '横浜フィナンシャルグループ', name_en: 'Yokohama Financial Group' },
]

const run = async () => {
  await loadEnv()
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim()
  if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  const { data: koueki, error: e1 } = await supabase
    .from('stock_symbol_profiles')
    .select('symbol,sector')
    .in('sector', ['公益事業', '公益'])
  if (e1) throw e1

  for (const row of koueki || []) {
    const { error } = await supabase
      .from('stock_symbol_profiles')
      .update({ sector: '電力・ガス' })
      .eq('symbol', row.symbol)
    if (error) throw error
  }
  console.log(`Renamed 公益事業→電力・ガス: ${(koueki || []).map((r) => r.symbol).join(', ') || '(none)'}`)

  const upserts = MISSING_PROFILES.map((r) => ({
    ...r,
    sector: normalizeSectorForDb(r.sector),
    region: 'JP',
    asset_type: 'stock',
    priority: 9999,
    index_tag: null,
    market_cap: null,
  }))

  const { error: e2 } = await supabase.from('stock_symbol_profiles').upsert(upserts, { onConflict: 'symbol' })
  if (e2) throw e2
  console.log('Upserted missing profiles:', upserts.map((r) => `${r.symbol} ${r.sector}`).join(', '))
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
