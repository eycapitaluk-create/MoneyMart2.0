function currencyByRegion(region) {
  if (region === 'UK') return 'GBP'
  if (region === 'EU') return 'EUR'
  if (region === 'JP') return 'JPY'
  return 'USD'
}

function normalizeDisplayPrice(value, region) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  if (region === 'UK') return n / 100
  return n
}

function formatStockPrice(value, region) {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: currencyByRegion(region),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(normalizeDisplayPrice(value || 0, region))
}

function formatVolume(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return '—'
  return n.toLocaleString('ja-JP')
}

function formatTradeDateLabel(ymd) {
  const s = String(ymd || '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || '—'
  const d = new Date(`${s}T00:00:00`)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * Yahoo Finance 風: 直近営業日の OHLCV 一行
 */
export default function StockLatestSessionOhlcvTable({ stock = null }) {
  if (!stock?.hasLiveData || !stock?.tradeDate) return null

  const region = stock.region || 'US'
  const rows = [
    { label: '始値', value: stock.open },
    { label: '高値', value: stock.high },
    { label: '安値', value: stock.low },
    { label: '終値', value: stock.price },
  ]

  return (
    <section
      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden"
      aria-labelledby="stock-latest-ohlcv-heading"
    >
      <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/80 dark:bg-slate-900/60">
        <div>
          <h3 id="stock-latest-ohlcv-heading" className="text-xs font-black text-slate-700 dark:text-slate-200">
            直近営業日の株価
          </h3>
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
            {formatTradeDateLabel(stock.tradeDate)}
            {region === 'US' ? ' · 通貨 USD' : region === 'JP' ? ' · 通貨 JPY' : ''}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-500 dark:text-slate-400">
              <th className="px-4 py-2">日付</th>
              <th className="px-3 py-2">始値</th>
              <th className="px-3 py-2">高値</th>
              <th className="px-3 py-2">安値</th>
              <th className="px-3 py-2">終値</th>
              <th className="px-3 py-2 text-right">出来高</th>
            </tr>
          </thead>
          <tbody>
            <tr className="font-mono font-bold text-slate-800 dark:text-slate-100">
              <td className="px-4 py-2.5 whitespace-nowrap">{formatTradeDateLabel(stock.tradeDate)}</td>
              {rows.map((row) => (
                <td key={row.label} className="px-3 py-2.5 tabular-nums">
                  {row.value != null && Number.isFinite(Number(row.value))
                    ? formatStockPrice(row.value, region)
                    : '—'}
                </td>
              ))}
              <td className="px-3 py-2.5 text-right tabular-nums">{formatVolume(stock.volume)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
