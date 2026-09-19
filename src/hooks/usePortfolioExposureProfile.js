/**
 * Load a lightweight portfolio exposure profile for the signed-in user.
 * Uses cost/invest as fallback when live marks are unavailable — still fine for exposure ratios.
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { loadOwnedAssetPositions } from '../lib/myPageApi'
import { getStockNameFallback } from '../data/stockNameFallback'
import { buildExposureProfile } from '../lib/portfolioExposureMap'
import { normalizeSectorName } from '../lib/stockSectorNormalize'

function inferRegion(symbol = '') {
  const s = String(symbol || '').toUpperCase()
  if (/\.T$/.test(s) || /^\d{4}A?$/.test(s)) return 'JP'
  if (/^[A-Z]{1,5}$/.test(s)) return 'US'
  return 'GLOBAL'
}

async function fetchLatestCloses(symbols = []) {
  const list = [...new Set(symbols.map((s) => String(s || '').toUpperCase()).filter(Boolean))]
  if (!list.length) return new Map()
  const { data, error } = await supabase
    .from('v_stock_latest')
    .select('symbol,close')
    .in('symbol', list)
  if (error) return new Map()
  const map = new Map()
  for (const row of data || []) {
    const sym = String(row.symbol || '').toUpperCase()
    const close = Number(row.close)
    if (sym && Number.isFinite(close) && close > 0) map.set(sym, close)
  }
  return map
}

async function fetchProfiles(symbols = []) {
  const list = [...new Set(symbols.map((s) => String(s || '').toUpperCase()).filter(Boolean))]
  if (!list.length) return new Map()
  const { data, error } = await supabase
    .from('stock_symbol_profiles')
    .select('symbol,name_jp,name_en,sector,region')
    .in('symbol', list)
  if (error) return new Map()
  const map = new Map()
  for (const row of data || []) {
    map.set(String(row.symbol || '').toUpperCase(), row)
  }
  return map
}

/**
 * @param {string|null|undefined} userId
 */
export function usePortfolioExposureProfile(userId) {
  const [holdings, setHoldings] = useState([])
  const [loading, setLoading] = useState(Boolean(userId))
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (!userId) {
      setHoldings([])
      setLoading(false)
      setError(null)
      return undefined
    }

    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const pos = await loadOwnedAssetPositions(userId)
        const stockLots = Array.isArray(pos?.ownedStocks) ? pos.ownedStocks : []
        const fundRows = Array.isArray(pos?.ownedFunds) ? pos.ownedFunds : []

        // Aggregate stock lots by symbol
        const stockAgg = new Map()
        for (const lot of stockLots) {
          const symbol = String(lot.symbol || '').toUpperCase()
          if (!symbol) continue
          const qty = Number(lot.qty || 0)
          const buy = Number(lot.buyPrice || 0)
          const prev = stockAgg.get(symbol) || { symbol, qty: 0, cost: 0 }
          prev.qty += qty
          prev.cost += qty * buy
          stockAgg.set(symbol, prev)
        }

        const symbols = [
          ...stockAgg.keys(),
          ...fundRows.map((f) => String(f.symbol || '').toUpperCase()).filter(Boolean),
        ]
        const [closes, profiles] = await Promise.all([
          fetchLatestCloses(symbols),
          fetchProfiles(symbols),
        ])

        const next = []
        for (const row of stockAgg.values()) {
          const close = closes.get(row.symbol)
          const valueFromMark = Number.isFinite(close) ? close * row.qty : 0
          const valueFromCost = row.cost
          const valueJpy = valueFromMark > 0 ? valueFromMark : valueFromCost
          if (valueJpy <= 0) continue
          const prof = profiles.get(row.symbol)
          next.push({
            symbol: row.symbol,
            name: prof?.name_jp || prof?.name_en || getStockNameFallback(row.symbol) || row.symbol,
            valueJpy,
            sector: normalizeSectorName(prof?.sector || ''),
            region: String(prof?.region || '').toUpperCase() || inferRegion(row.symbol),
            kind: 'stock',
          })
        }

        for (const fund of fundRows) {
          const symbol = String(fund.symbol || '').toUpperCase()
          if (!symbol) continue
          const invest = Number(fund.investAmount ?? fund.invest_amount ?? 0)
          const buy = Number(fund.buyPrice ?? fund.buy_price ?? 0)
          const close = closes.get(symbol)
          // Approximate units from invest/buy when possible
          let valueJpy = invest
          if (Number.isFinite(close) && close > 0 && Number.isFinite(buy) && buy > 0 && invest > 0) {
            const units = invest / buy
            valueJpy = units * close
          }
          if (!(valueJpy > 0)) continue
          const prof = profiles.get(symbol)
          next.push({
            symbol,
            name: fund.name || prof?.name_jp || prof?.name_en || symbol,
            valueJpy,
            sector: normalizeSectorName(prof?.sector || ''),
            region: String(prof?.region || '').toUpperCase() || inferRegion(symbol),
            kind: 'fund',
          })
        }

        if (!cancelled) setHoldings(next)
      } catch (e) {
        if (!cancelled) {
          setError(e)
          setHoldings([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId])

  const profile = useMemo(() => buildExposureProfile(holdings), [holdings])

  return { profile, holdings, loading, error, empty: profile.empty }
}
