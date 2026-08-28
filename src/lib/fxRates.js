import { supabase } from './supabase'

export const FX_SYMBOLS = [
  { symbol: 'USDJPY.FX', label: 'USD/JPY' },
  { symbol: 'EURJPY.FX', label: 'EUR/JPY' },
  { symbol: 'GBPJPY.FX', label: 'GBP/JPY' },
  { symbol: 'USDKRW.FX', label: 'USD/KRW' },
]

export const fetchLatestFxRates = async () => {
  const symbols = FX_SYMBOLS.map((item) => item.symbol)
  const { data, error } = await supabase
    .from('v_stock_latest')
    .select('symbol,trade_date,close')
    .in('symbol', symbols)

  if (error) throw error

  const bySymbol = new Map((data || []).map((row) => [row.symbol, row]))

  return FX_SYMBOLS.map((item) => {
    const row = bySymbol.get(item.symbol)
    return {
      ...item,
      rate: Number(row?.close ?? NaN),
      tradeDate: row?.trade_date || null,
    }
  })
}
