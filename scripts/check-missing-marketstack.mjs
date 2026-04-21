#!/usr/bin/env node
/**
 * marketstack-daily에서 요청했지만 DB에 없는 심볼 확인
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { STOCK_LIST_400 } from '../src/data/stockList400.js'
import { ETF_SYMBOLS_FROM_XLSX, MARKETSTACK_BLOCKLIST_EXPORT } from '../src/data/etfListFromXlsx.js'

try {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch (_) {}

const REQUIRED = ['ACWI','MCHI','1329.T','1475.T','EUNK.DE','AAXJ','EEM','IVV','IJH','IJR','IYE','IYM','IYJ','IYC','IYK','IYH','IYF','IYW','IYZ','IDU','IYR','TLT','2621.T','GLD','SLV','CPER','USO']
const usJp = STOCK_LIST_400.filter(r => r?.region === 'US' || r?.region === 'JP').map(r => r.symbol)
const requested = [...new Set([...usJp, ...REQUIRED, ...ETF_SYMBOLS_FROM_XLSX])].filter(s => !MARKETSTACK_BLOCKLIST_EXPORT.has(s))

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: latest } = await supabase.from('stock_daily_prices').select('trade_date').eq('source','marketstack').order('trade_date',{ascending:false}).limit(1).single()
const tradeDate = latest?.trade_date || '2026-03-16'
const { data } = await supabase.from('stock_daily_prices').select('symbol').eq('source','marketstack').eq('trade_date', tradeDate)
const haveData = new Set((data || []).map(r => r.symbol))
const missing = requested.filter(s => !haveData.has(s))

console.log('trade_date:', tradeDate)
console.log('요청:', requested.length, '| DB 있음:', haveData.size, '| 없음:', missing.length)
console.log('\n없는 심볼:', missing.join(', '))
