import { useState, useEffect } from 'react'
import {
  Search, Star, Plus, Layout,
  TrendingUp, TrendingDown, Clock, Info,
  ChevronDown, Wallet, ArrowRight, ShieldCheck, ExternalLink,
} from 'lucide-react'
import {
  ComposedChart, Area, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { MOCK_STOCKS, REGION_BY_SYMBOL } from '../data/mockStocks'

const TIMEFRAMES = ['1D', '1W', '1M', '3M', '1Y', '5Y']

const MARKET_TICKER = [
  { name: '米国大型株', value: 5088.8, change: 0.35 },
  { name: '欧州主要株', value: 4982.6, change: 0.28 },
  { name: '英国主要株', value: 8145.3, change: -0.19 },
  { name: 'USD/JPY', value: 148.55, change: -0.1 },
]

const PLATFORM_PARTNERS = [
  { name: 'SBI証券', fee: '無料', points: 'Tポイント', note: 'NISA対応・国内外商品が豊富', url: 'https://www.sbisec.co.jp' },
  { name: '楽天証券', fee: '無料', points: '楽天ポイント', note: '楽天経済圏との連携が強い', url: 'https://www.rakuten-sec.co.jp' },
  { name: 'マネックス証券', fee: '55円~', points: 'マネックスP', note: '米国株・分析ツールが強み', url: 'https://www.monex.co.jp' },
]

const generateChartData = (points, startPrice, volatility) => {
  const data = []
  let currentPrice = startPrice

  for (let i = 0; i < points; i += 1) {
    const change = (Math.random() - 0.48) * volatility
    currentPrice += change
    const volume = Math.floor(Math.random() * 1000000) + 500000

    const date = new Date()
    date.setDate(date.getDate() - (points - i))
    const hh = 9 + Math.floor(i / 12)
    const mm = String((i % 12) * 5).padStart(2, '0')
    const label = points <= 90 ? `${hh}:${mm}` : `${date.getMonth() + 1}/${date.getDate()}`

    data.push({
      time: label,
      price: Number(currentPrice.toFixed(2)),
      volume,
      open: currentPrice - Math.random() * 10,
      high: currentPrice + Math.random() * 20,
      low: currentPrice - Math.random() * 20,
    })
  }
  return data
}

const currencyByRegion = (region) => (region === 'UK' ? 'GBP' : region === 'EU' ? 'EUR' : 'USD')

const formatCurrency = (value, region) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyByRegion(region),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)

const formatCompact = (value) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return `${Math.round(value)}`
}

const estimateMonthlyPlan = ({ targetAmount, currentAmount, annualRate, years }) => {
  const months = Math.max(1, years * 12)
  const monthlyRate = annualRate / 12
  const futureOfCurrent = currentAmount * (1 + monthlyRate) ** months
  const requiredFutureFromContrib = Math.max(0, targetAmount - futureOfCurrent)
  if (monthlyRate === 0) return requiredFutureFromContrib / months
  const factor = ((1 + monthlyRate) ** months - 1) / monthlyRate
  return requiredFutureFromContrib / factor
}

const inferLiveRegion = (code, exchange) => {
  if (REGION_BY_SYMBOL[code]) return REGION_BY_SYMBOL[code]
  if (/\.(L|LN)$/i.test(code)) return 'UK'
  if (/\.(PA|AS|DE|MI|MC|SW|BR|LS|ST|HE)$/i.test(code)) return 'EU'
  if (/london|lse/i.test(exchange || '')) return 'UK'
  if (/euronext|xetra|frankfurt|paris|amsterdam|milan|madrid|europe/i.test(exchange || '')) return 'EU'
  return 'US'
}

const ActionButton = ({ icon: Icon, active }) => (
  <button
    className={`p-3 rounded-xl border transition ${
      active
        ? 'bg-orange-500 border-orange-500 text-white'
        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
    }`}
  >
    <Icon size={20} fill={active ? 'currentColor' : 'none'} />
  </button>
)

const SettingsBtn = () => (
  <button className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded">
    <ChevronDown size={14} className="text-slate-500" />
  </button>
)

const InfoRow = ({ label, val }) => (
  <div className="flex justify-between border-b border-slate-200 dark:border-white/5 pb-2 last:border-0">
    <span className="text-slate-500">{label}</span>
    <span className="font-bold text-slate-900 dark:text-white">{val}</span>
  </div>
)

export default function StockPage() {
  const [selectedRegion, setSelectedRegion] = useState('US')
  const [searchQuery, setSearchQuery] = useState('')
  const [timeframe, setTimeframe] = useState('1M')
  const [selectedStock, setSelectedStock] = useState(MOCK_STOCKS.US[0])
  const [chartData, setChartData] = useState([])
  const [watchlist, setWatchlist] = useState(['AAPL', 'NVDA'])
  const [liveStocks, setLiveStocks] = useState({ US: [...MOCK_STOCKS.US] })
  const [marketLoading, setMarketLoading] = useState(true)
  const [marketError, setMarketError] = useState('')
  const [usingMockData, setUsingMockData] = useState(true)
  const [goalTarget, setGoalTarget] = useState(3000)
  const [goalYears, setGoalYears] = useState(10)
  const [goalCurrent, setGoalCurrent] = useState(300)
  const [goalRiskProfile, setGoalRiskProfile] = useState('balanced')

  const mergeWithMockUniverse = (liveUs) => {
    const liveByCode = new Map(liveUs.map((s) => [s.code, s]))
    const merged = [...liveUs]
    for (const m of MOCK_STOCKS.US) {
      if (!liveByCode.has(m.code)) merged.push(m)
    }
    return merged
  }

  useEffect(() => {
    const loadLatestStocks = async () => {
      setMarketLoading(true)
      setMarketError('')
      try {
        const { data: latestRows, error: latestErr } = await supabase
          .from('v_stock_latest')
          .select('symbol,trade_date,open,high,low,close,volume')
          .limit(300)
        if (latestErr) throw latestErr

        if (!latestRows || latestRows.length === 0) {
          setUsingMockData(true)
          setLiveStocks({ US: [...MOCK_STOCKS.US] })
          setSelectedStock(MOCK_STOCKS.US[0])
          setMarketError('実データがありません。モックデータを表示します。')
          return
        }

        const symbols = [...new Set(latestRows.map((r) => r.symbol).filter(Boolean))]
        const { data: symbolRows, error: symbolErr } = await supabase
          .from('stock_symbols')
          .select('symbol,name,exchange')
          .in('symbol', symbols)
        if (symbolErr) throw symbolErr

        const symbolMap = new Map((symbolRows || []).map((s) => [s.symbol, s]))
        const mapped = latestRows
          .map((r) => {
            const meta = symbolMap.get(r.symbol) || {}
            const open = Number(r.open || 0)
            const close = Number(r.close || 0)
            const change = close - open
            const rate = open > 0 ? (change / open) * 100 : 0
            return {
              id: r.symbol,
              code: r.symbol,
              name: meta.name || r.symbol,
              price: close,
              change,
              rate,
              market: meta.exchange || 'Market',
              sector: meta.exchange || 'Market',
              region: inferLiveRegion(r.symbol, meta.exchange),
              news: `${r.symbol} の最新終値データ (${r.trade_date})`,
            }
          })
          .filter(Boolean)

        const usLike = mapped.filter((s) => !(/\.(XTKS|XJPX|TSE|JP)$/i.test(s.code) || /^\d{4}/.test(s.code)))
        if (usLike.length === 0) {
          setUsingMockData(true)
          setLiveStocks({ US: [...MOCK_STOCKS.US] })
          setSelectedStock(MOCK_STOCKS.US[0])
          setMarketError('取得データが空のため、モックデータを表示します。')
          return
        }

        const merged = mergeWithMockUniverse(usLike)
        setLiveStocks({ US: merged })
        setUsingMockData(merged.length > usLike.length)
        setSelectedStock(usLike[0] || merged[0] || MOCK_STOCKS.US[0])
      } catch (err) {
        setUsingMockData(true)
        setLiveStocks({ US: [...MOCK_STOCKS.US] })
        setSelectedStock(MOCK_STOCKS.US[0])
        setMarketError((err.message || 'データの読み込みに失敗しました') + '（モックデータ表示中）')
      } finally {
        setMarketLoading(false)
      }
    }

    loadLatestStocks()
  }, [])

  const filteredStocks = (liveStocks.US || []).filter((s) => {
    const regionOK = s.region === selectedRegion
    const query = searchQuery.trim().toLowerCase()
    if (!query) return regionOK
    return regionOK && (`${s.code} ${s.name}`.toLowerCase().includes(query))
  })

  useEffect(() => {
    if (!selectedStock || selectedStock.region !== selectedRegion || !filteredStocks.some((s) => s.id === selectedStock.id)) {
      setSelectedStock(filteredStocks[0] || null)
    }
  }, [selectedRegion, searchQuery, filteredStocks, selectedStock])

  useEffect(() => {
    if (!selectedStock) return
    const pointsByTf = { '1D': 78, '1W': 30, '1M': 90, '3M': 120, '1Y': 180, '5Y': 260 }
    const points = pointsByTf[timeframe] || 90
    const vol = Math.max(selectedStock.price * 0.02, 0.5)
    setChartData(generateChartData(points, selectedStock.price * 0.9, vol))
  }, [timeframe, selectedStock])

  const displayedStock = filteredStocks.find((s) => s.id === selectedStock?.id) || filteredStocks[0] || selectedStock
  const isUp = (displayedStock?.rate || 0) > 0
  const chartColor = isUp ? '#ef4444' : '#3b82f6'
  const goalAnnualRate = goalRiskProfile === 'conservative' ? 0.03 : goalRiskProfile === 'aggressive' ? 0.08 : 0.05
  const requiredMonthlyYen = estimateMonthlyPlan({
    targetAmount: goalTarget * 10000,
    currentAmount: goalCurrent * 10000,
    annualRate: goalAnnualRate,
    years: goalYears,
  })

  const toggleWatch = (id) => {
    if (!id) return
    setWatchlist((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload
      return (
        <div className="bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-white p-3 rounded-xl text-xs shadow-xl border border-slate-200 dark:border-slate-700 backdrop-blur-sm">
          <p className="font-bold text-slate-500 dark:text-slate-400 mb-1">{d.time}</p>
          <p className="font-mono">Price: <span className="font-bold">{formatCurrency(d.price, displayedStock?.region || 'US')}</span></p>
          <p className="font-mono">Vol: <span className="text-slate-500 dark:text-slate-400">{formatCompact(d.volume)}</span></p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0F172A] text-slate-900 dark:text-white font-sans pb-20">
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <div className="bg-slate-900 dark:bg-black text-white rounded-2xl border border-slate-700 shadow-md overflow-hidden relative">
          <div className="py-3 overflow-hidden whitespace-nowrap">
            <div className="inline-flex animate-ticker items-center gap-10 pl-4 pr-16 min-w-max">
              {[...MARKET_TICKER, ...MARKET_TICKER, ...MARKET_TICKER].map((idx, i) => (
                <span key={`${idx.name}-${i}`} className="flex items-center gap-2 text-xs md:text-sm shrink-0">
                  <span className="text-slate-300 font-black">{idx.name}</span>
                  <span className={`font-bold ${idx.change >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {idx.value.toLocaleString()} {idx.change >= 0 ? '▲' : '▼'} {Math.abs(idx.change)}%
                  </span>
                </span>
              ))}
            </div>
          </div>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] md:text-xs font-bold bg-slate-800/90 border border-slate-700 rounded-full px-2.5 py-1">
            Data: <span className={usingMockData ? 'text-amber-300' : 'text-emerald-300'}>{usingMockData ? 'MOCK' : 'LIVE'}</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            {[
              { id: 'US', label: '🇺🇸 米国' },
              { id: 'UK', label: '🇬🇧 英国' },
              { id: 'EU', label: '🇪🇺 欧州' },
            ].map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRegion(r.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  selectedRegion === r.id ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="銘柄コード・社名検索"
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pl-10 pr-4 text-sm font-bold focus:border-orange-500 outline-none transition"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          </div>

          {marketLoading && <p className="text-xs text-slate-500 dark:text-slate-400">最新データを読み込み中...</p>}
          {marketError && <p className="text-xs text-amber-400">{marketError}</p>}

          <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
            <div className="p-3 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Watchlist</span>
              <SettingsBtn />
            </div>
            <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-[620px] overflow-y-auto">
              {filteredStocks.map((stock) => (
                <div
                  key={stock.id}
                  onClick={() => setSelectedStock(stock)}
                  className={`p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition flex justify-between items-center ${displayedStock?.id === stock.id ? 'bg-orange-50 dark:bg-white/10 border-l-4 border-orange-500' : ''}`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-orange-500">{stock.code}</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{stock.name}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{stock.market || stock.sector || 'Market'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-sm">{formatCurrency(stock.price, stock.region)}</div>
                    <div className={`text-xs font-bold ${stock.rate > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                      {stock.rate > 0 ? '+' : ''}{stock.rate.toFixed(2)}%
                    </div>
                  </div>
                </div>
              ))}
              {filteredStocks.length === 0 && (
                <div className="p-6 text-center text-sm font-bold text-slate-500 dark:text-slate-400">
                  この地域の銘柄データはまだありません
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-9 space-y-6">
          {displayedStock && (
            <>
              <div className="flex justify-between items-end gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{displayedStock.name}</h1>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{displayedStock.code}</span>
                    <span className="text-[11px] font-bold text-slate-900 bg-orange-400 px-2 py-1 rounded-md">{displayedStock.sector}</span>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className={`text-4xl md:text-5xl font-black tracking-tight ${isUp ? 'text-red-500' : 'text-blue-500'}`}>
                      {formatCurrency(displayedStock.price, displayedStock.region)}
                    </span>
                    <span className={`text-base md:text-lg font-bold flex items-center ${isUp ? 'text-red-400' : 'text-blue-400'}`}>
                      {isUp ? <TrendingUp size={20} className="mr-1.5" /> : <TrendingDown size={20} className="mr-1.5" />}
                      {displayedStock.change.toFixed(2)} ({displayedStock.rate.toFixed(2)}%)
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleWatch(displayedStock.id)}>
                    <ActionButton icon={Star} active={watchlist.includes(displayedStock.id)} />
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden relative">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/70 backdrop-blur-sm">
                  <div className="flex gap-1.5">
                    {TIMEFRAMES.map((tf) => (
                      <button
                        key={tf}
                        onClick={() => setTimeframe(tf)}
                        className={`px-3 py-1 text-[11px] font-bold rounded-full transition ${
                          timeframe === tf
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50'
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className={`w-1.5 h-1.5 rounded-full ${usingMockData ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                      {usingMockData ? 'Mock Blend' : 'Live'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 text-xs font-mono bg-slate-50/70 dark:bg-slate-900/40">
                  <div className="rounded-lg bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700"><span className="text-slate-500 block">OPEN</span><span className="text-slate-900 dark:text-white font-bold">{formatCurrency(displayedStock.price * 0.98, displayedStock.region)}</span></div>
                  <div className="rounded-lg bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700"><span className="text-slate-500 block">HIGH</span><span className="text-slate-900 dark:text-white font-bold">{formatCurrency(displayedStock.price * 1.02, displayedStock.region)}</span></div>
                  <div className="rounded-lg bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700"><span className="text-slate-500 block">LOW</span><span className="text-slate-900 dark:text-white font-bold">{formatCurrency(displayedStock.price * 0.97, displayedStock.region)}</span></div>
                  <div className="rounded-lg bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700"><span className="text-slate-500 block">VOL</span><span className="text-slate-900 dark:text-white font-bold">2.4M</span></div>
                </div>

                <div className="h-[380px] w-full bg-gradient-to-b from-white to-slate-50 dark:from-[#0B1221] dark:to-[#0F172A] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 20, right: 8, left: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartColor} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#cbd5e1" />
                      <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} minTickGap={30} />
                      <YAxis
                        yAxisId="left"
                        orientation="right"
                        domain={['auto', 'auto']}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickFormatter={(v) => formatCompact(v)}
                        width={54}
                      />
                      <YAxis yAxisId="right" orientation="left" hide />
                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }} />
                      <Bar yAxisId="right" dataKey="volume" fill="#94a3b8" opacity={0.18} barSize={3} />
                      <Area yAxisId="left" type="monotone" dataKey="price" stroke={chartColor} strokeWidth={2.4} fill="url(#colorPrice)" activeDot={{ r: 4, strokeWidth: 0, fill: '#fff' }} />
                      <Line yAxisId="left" type="monotone" dataKey="price" stroke={chartColor} strokeWidth={1.4} dot={false} opacity={0.9} />
                      <ReferenceLine
                        yAxisId="left"
                        y={displayedStock.price * 0.99}
                        stroke="#94a3b8"
                        strokeDasharray="4 4"
                        strokeOpacity={0.6}
                        label={{ value: 'Prev', position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => toggleWatch(displayedStock.id)}
                  className="py-3.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-sm font-bold rounded-2xl transition flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 group"
                >
                  <Plus size={20} className="text-orange-500 group-hover:scale-110 transition" />
                  {watchlist.includes(displayedStock.id) ? 'ウォッチ解除' : 'ウォッチリスト登録'}
                </button>
                <button className="py-3.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 group">
                  <Layout size={20} className="group-hover:rotate-90 transition" />
                  目標プランに追加
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
                  <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-4 flex items-center gap-2"><Info size={16} /> 企業情報</h3>
                  <div className="space-y-3 text-sm">
                    <InfoRow label="時価総額" val="¥42.5兆" />
                    <InfoRow label="PER (予想)" val="12.4倍" />
                    <InfoRow label="PBR (実績)" val="1.1倍" />
                    <InfoRow label="配当利回り" val="2.8%" />
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
                  <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-4 flex items-center gap-2"><Clock size={16} /> 適時開示・ニュース</h3>
                  <div className="space-y-4">
                    {[
                      '2026年3月期 第3四半期決算短信',
                      '自己株式取得に係る事項の決定に関するお知らせ',
                      'EV生産ラインの増設投資について',
                    ].map((news, i) => (
                      <div key={i} className="flex gap-3 items-start group cursor-pointer">
                        <span className="text-[10px] text-slate-500 mt-1">14:00</span>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-orange-500 dark:group-hover:text-orange-400 transition leading-snug">{news}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-3xl border border-slate-700 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-0.5">
                  <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-400" /> Goal Planner (Platform)
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-slate-400 font-bold block mb-2">目標金額（万円）</label>
                      <input
                        type="range"
                        min={500}
                        max={20000}
                        step={100}
                        value={goalTarget}
                        onChange={(e) => setGoalTarget(Number(e.target.value))}
                        className="w-full accent-orange-500"
                      />
                      <div className="text-right text-sm font-bold mt-1">¥{goalTarget.toLocaleString()}万</div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-bold block mb-2">現在の投資元本（万円）</label>
                      <input
                        type="range"
                        min={0}
                        max={10000}
                        step={50}
                        value={goalCurrent}
                        onChange={(e) => setGoalCurrent(Number(e.target.value))}
                        className="w-full accent-orange-500"
                      />
                      <div className="text-right text-sm font-bold mt-1">¥{goalCurrent.toLocaleString()}万</div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-bold block mb-2">目標期間（年）: {goalYears}年</label>
                      <input
                        type="range"
                        min={1}
                        max={20}
                        step={1}
                        value={goalYears}
                        onChange={(e) => setGoalYears(Number(e.target.value))}
                        className="w-full accent-orange-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      {[
                        { id: 'conservative', label: '安定' },
                        { id: 'balanced', label: '標準' },
                        { id: 'aggressive', label: '積極' },
                      ].map((mode) => (
                        <button
                          key={mode.id}
                          onClick={() => setGoalRiskProfile(mode.id)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${
                            goalRiskProfile === mode.id
                              ? 'bg-orange-500 border-orange-500 text-white'
                              : 'bg-slate-800 border-slate-600 text-slate-300'
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                    <div className="bg-white/10 rounded-xl p-4 border border-white/10">
                      <p className="text-xs text-slate-300 mb-1">必要な毎月積立目安</p>
                      <p className="text-2xl font-black text-orange-300">
                        ¥{Math.max(0, Math.round(requiredMonthlyYen)).toLocaleString()}
                        <span className="text-sm text-slate-300 font-bold ml-1">/ 月</span>
                      </p>
                      <p className="text-xs text-slate-300 mt-1">
                        約 {(Math.max(0, requiredMonthlyYen) / 10000).toFixed(1)} 万円 / 月
                      </p>
                      <p className="text-[11px] text-slate-400 mt-2">
                        参考値です。実際の成果は市場変動・コスト・税制により異なります。
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
                  <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-4 flex items-center gap-2">
                    <Wallet size={16} /> 執行先比較（取引は外部）
                  </h3>
                  <div className="space-y-3">
                    {PLATFORM_PARTNERS.map((p) => (
                      <a
                        key={p.name}
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-xl border border-slate-200 dark:border-slate-700 p-3 hover:border-orange-300 dark:hover:border-orange-500/50 hover:bg-orange-50 dark:hover:bg-slate-800 transition"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{p.name}</p>
                          <ExternalLink size={14} className="text-slate-400" />
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold">手数料 {p.fee}</span>
                          <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">{p.points}</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{p.note}</p>
                      </a>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
                    MoneyMartは比較・情報提供を行うプラットフォームです。実際の注文・口座開設は各社サイトで行います。
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Platform Insight</h3>
                    <p className="text-xs text-slate-500 mt-1">価格だけでなく、あなたの目標達成への影響を可視化します。</p>
                  </div>
                  <button className="inline-flex items-center gap-1 text-xs font-bold text-orange-500 hover:text-orange-400">
                    詳細を見る <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
