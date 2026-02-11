import { useState, useEffect } from 'react'
import {
  Search, Star, TrendingUp, TrendingDown,
  Zap, PieChart, Bell, Plus, Layout, Check
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { supabase } from '../lib/supabase'

const MARKET_INDICES = [
  { name: '日本市場', price: '38,920.15', change: 1.25 },
  { name: '日本市場(全株)', price: '2,715.30', change: 0.88 },
  { name: '日本市場(成長)', price: '750.40', change: -0.45 },
  { name: '日本市場(新興)', price: '648.20', change: 0.62 },
  { name: 'USD/JPY', price: '150.45', change: 0.05 },
  { name: 'EUR/JPY', price: '163.20', change: -0.12 },
  { name: '米国市場', price: '39,150.80', change: -0.15 },
  { name: '米国市場（ハイテク）', price: '16,200.50', change: 1.10 },
  { name: '米国市場（大型株）', price: '5,088.80', change: 0.35 },
  { name: '金', price: '10,850', change: 0.82 },
  { name: '原油WTI', price: '72.40', change: -1.20 },
]

const STOCKS = {
  JP: [
    { id: '7203', code: '7203', name: 'トヨタ自動車', price: 3580, change: 85, rate: 2.43, sector: '自動車', tag: '決算好調', news: 'EV販売台数が過去最高を更新、北米市場でシェア拡大' },
    { id: '6758', code: '6758', name: 'ソニーG', price: 13200, change: -150, rate: -1.12, sector: '電気機器', tag: '', news: 'ゲーム事業の収益見通しを下方修正、株価に売り圧力' },
    { id: '8035', code: '8035', name: '東京エレクトロン', price: 38900, change: 1400, rate: 3.73, sector: '半導体', tag: 'AI特需', news: '生成AI向け製造装置の受注が急増、アナリストが目標株価引き上げ' },
    { id: '9984', code: '9984', name: 'ソフトバンクG', price: 8450, change: 120, rate: 1.44, sector: '投資', tag: '自社株買い', news: 'アーム株の上昇が寄与、NAV（純資産価値）が大幅改善' },
    { id: '7974', code: '7974', name: '任天堂', price: 8800, change: -20, rate: -0.23, sector: 'ゲーム', tag: '', news: '次世代機の発表延期との報道で失望売りが広がる' },
    { id: '9983', code: '9983', name: 'ファーストリテイリング', price: 42100, change: -50, rate: -0.12, sector: '小売', tag: '', news: 'ユニクロ海外売上高が過去最高、インド進出加速' },
    { id: '6861', code: '6861', name: 'キーエンス', price: 68500, change: 1200, rate: 1.78, sector: '電気機器', tag: '高配当', news: 'ファクトリーオートメーション需要が堅調、決算上方修正' },
    { id: '8306', code: '8306', name: '三菱UFJFG', price: 1580, change: 12, rate: 0.77, sector: '銀行', tag: '', news: '米国利下げ期待で銀行株買い優勢、純利益予想上方修正' },
    { id: '9432', code: '9432', name: '日本電信電話', price: 4280, change: -35, rate: -0.81, sector: '通信', tag: '配当安定', news: 'ドコモ決算は横ばい、5G投資の負担が継続' },
    { id: '4519', code: '4519', name: '中外製薬', price: 5420, change: 85, rate: 1.59, sector: '医薬', tag: '', news: '新薬承認取得で成長期待、アナリストが買い推奨維持' },
  ],
  US: [
    { id: 'NVDA', code: 'NVDA', name: 'NVIDIA', price: 880.5, change: 25.4, rate: 2.97, sector: '半導体', tag: 'AI Leader', news: 'GTC 2024で新チップ「Blackwell」発表、圧倒的な性能差を見せつける' },
    { id: 'TSLA', code: 'TSLA', name: 'Tesla', price: 175.3, change: -5.2, rate: -2.8, sector: '自動車', tag: '値下げ', news: '中国市場での競争激化懸念、アナリストが投資判断引き下げ' },
    { id: 'AAPL', code: 'AAPL', name: 'Apple', price: 170.1, change: -0.5, rate: -0.3, sector: 'Tech', tag: '', news: 'EUでの独占禁止法違反による制裁金の影響を懸念' },
    { id: 'MSFT', code: 'MSFT', name: 'Microsoft', price: 415.2, change: 3.1, rate: 0.75, sector: 'Software', tag: 'CoPilot', news: '法人向けCopilotの導入が加速、収益貢献への期待高まる' },
    { id: 'GOOGL', code: 'GOOGL', name: 'Alphabet', price: 142.5, change: 2.8, rate: 2.0, sector: 'Tech', tag: 'Gemini', news: 'AI検索機能の拡大で広告収益への貢献期待' },
    { id: 'AMZN', code: 'AMZN', name: 'Amazon', price: 185.2, change: 1.5, rate: 0.82, sector: '小売', tag: 'AWS', news: 'クラウド事業が予想を上回る成長、営業利益率改善' },
    { id: 'META', code: 'META', name: 'Meta', price: 505.8, change: -3.2, rate: -0.63, sector: 'Tech', tag: '', news: 'Reality Labs赤字が継続、メタバース投資の見直し観測' },
  ],
}

const RELATED_NEWS = [
  { id: 1, source: '日経新聞', time: '10分前', title: '日経平均、史上最高値を更新　半導体関連が牽引', sentiment: 'positive' },
  { id: 2, source: 'Bloomberg', time: '30分前', title: '米FRB議長「利下げ急がない」　早期緩和観測が後退', sentiment: 'negative' },
  { id: 3, source: 'Reuters', time: '1時間前', title: 'トヨタ、春闘で満額回答　賃上げの流れ加速', sentiment: 'positive' },
  { id: 4, source: 'TechCrunch', time: '2時間前', title: 'AIスタートアップへの投資が過熱、バブルの懸念も', sentiment: 'neutral' },
  { id: 5, source: '東洋経済', time: '3時間前', title: 'NISA口座数が1,500万件突破　個人投資家の流入加速', sentiment: 'positive' },
  { id: 6, source: 'WSJ', time: '4時間前', title: '英中央銀、利下げを継続　欧州経済の減速懸念', sentiment: 'negative' },
  { id: 7, source: '日経新聞', time: '5時間前', title: '円安継続で輸出企業の業績予想を上方修正相次ぐ', sentiment: 'positive' },
  { id: 8, source: 'CNBC', time: '6時間前', title: 'オラクル、AIクラウド契約で急成長　株価が過去高値更新', sentiment: 'positive' },
]

const generateChartData = (isUp) => {
  const data = []
  let val = 1000
  for (let i = 0; i < 20; i++) {
    val = val + (Math.random() - (isUp ? 0.4 : 0.6)) * 50
    data.push({ i, val })
  }
  return data
}

// 티커 가격 파싱 (예: "38,920.15" → 38920.15)
const parsePrice = (s) => parseFloat(String(s).replace(/[¥$,M]/g, '').replace(/,/g, '')) || 0
const formatTickerPrice = (val, name) => {
  if (name === 'ビットコイン') return `¥${val.toFixed(2)}M`
  if (name === '金') return `¥${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  if (val >= 1000) return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function StockPage() {
  const [activeTab, setActiveTab] = useState('JP')
  const [selectedStock, setSelectedStock] = useState(STOCKS.JP[0])
  const [chartData, setChartData] = useState(() => generateChartData(true))
  const [watchlist, setWatchlist] = useState(['7203', 'NVDA'])
  const [newsTab, setNewsTab] = useState('news') // 'news' | 'company' | 'disclosure'
  const [liveTicker, setLiveTicker] = useState(MARKET_INDICES.map((i) => ({ ...i, price: parsePrice(i.price) })))
  const [liveStocks, setLiveStocks] = useState({ JP: [...STOCKS.JP], US: [...STOCKS.US] })
  const [marketLoading, setMarketLoading] = useState(true)
  const [marketError, setMarketError] = useState('')
  const [usingMockData, setUsingMockData] = useState(true)

  // Supabase latest stock data load
  useEffect(() => {
    const loadLatestStocks = async () => {
      setMarketLoading(true)
      setMarketError('')
      try {
        const { data: latestRows, error: latestErr } = await supabase
          .from('v_stock_latest')
          .select('symbol,trade_date,open,high,low,close,volume')
          .limit(200)

        if (latestErr) throw latestErr
        if (!latestRows || latestRows.length === 0) {
          setUsingMockData(true)
          setMarketLoading(false)
          return
        }

        const symbols = [...new Set(latestRows.map((r) => r.symbol).filter(Boolean))]
        const { data: symbolRows, error: symbolErr } = await supabase
          .from('stock_symbols')
          .select('symbol,name,exchange')
          .in('symbol', symbols)
        if (symbolErr) throw symbolErr

        const symbolMap = new Map((symbolRows || []).map((s) => [s.symbol, s]))
        const mapped = latestRows.map((r) => {
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
            sector: meta.exchange || 'Market',
            tag: '',
            news: `${r.symbol} の最新終値データ (${r.trade_date})`,
          }
        })

        const jp = mapped.filter((s) => /\.(XTKS|XJPX|TSE|JP)$/i.test(s.code) || /^\d{4}/.test(s.code))
        const us = mapped.filter((s) => !(/\.(XTKS|XJPX|TSE|JP)$/i.test(s.code) || /^\d{4}/.test(s.code)))

        const nextStocks = {
          JP: jp.length > 0 ? jp : [...STOCKS.JP],
          US: us.length > 0 ? us : [...STOCKS.US],
        }

        setLiveStocks(nextStocks)
        setUsingMockData(false)

        const nextSelected = nextStocks[activeTab]?.[0] || nextStocks.US[0] || nextStocks.JP[0]
        if (nextSelected) {
          setSelectedStock(nextSelected)
          setChartData(generateChartData(nextSelected.rate > 0))
        }
      } catch (err) {
        setMarketError(err.message || 'データの読み込みに失敗しました')
        setUsingMockData(true)
      } finally {
        setMarketLoading(false)
      }
    }

    loadLatestStocks()
  }, [])

  // 티커 실시간 시뮬레이션 (2~4초마다 미세 변동)
  useEffect(() => {
    const id = setInterval(() => {
      setLiveTicker((prev) =>
        MARKET_INDICES.map((base, i) => {
          const prevPrice = prev[i]?.price ?? parsePrice(base.price)
          const isBtc = base.name === 'ビットコイン'
          const tick = isBtc ? (Math.random() - 0.5) * 0.02 : (Math.random() - 0.5) * (prevPrice > 10000 ? 40 : prevPrice > 100 ? 0.8 : 0.08)
          const newPrice = Math.max(prevPrice * 0.995, Math.min(prevPrice * 1.005, prevPrice + tick))
          return { ...base, price: newPrice }
        })
      )
    }, 2500 + Math.random() * 1500)
    return () => clearInterval(id)
  }, [])

  // 주식 리스트 실시간 시뮬레이션 (3~5초마다 미세 변동, 베이스 가격 근처에서 변동)
  useEffect(() => {
    if (!usingMockData) return undefined
    const id = setInterval(() => {
      setLiveStocks((prev) => ({
        JP: prev.JP.map((s) => {
          const base = STOCKS.JP.find((b) => b.id === s.id)
          if (!base) return s
          const range = base.price > 10000 ? 20 : 10
          const newPrice = Math.max(1, base.price + Math.round((Math.random() - 0.5) * range))
          const change = newPrice - base.price
          const rate = (change / base.price) * 100
          return { ...s, price: newPrice, change, rate }
        }),
        US: prev.US.map((s) => {
          const base = STOCKS.US.find((b) => b.id === s.id)
          if (!base) return s
          const range = base.price > 100 ? 0.5 : 0.2
          const newPrice = Math.max(0.01, base.price + (Math.random() - 0.5) * range)
          const rounded = Math.round(newPrice * 100) / 100
          const change = rounded - base.price
          const rate = (change / base.price) * 100
          return { ...s, price: rounded, change, rate }
        }),
      }))
    }, 3500 + Math.random() * 2000)
    return () => clearInterval(id)
  }, [usingMockData])

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    const next = liveStocks[tab]?.[0] || STOCKS[tab][0]
    if (next) {
      setSelectedStock(next)
      setChartData(generateChartData(next.rate > 0))
    }
  }

  const handleStockClick = (stock) => {
    setSelectedStock(stock)
    setChartData(generateChartData(stock.rate > 0))
  }

  const displayedStock =
    liveStocks[activeTab]?.find((s) => s.id === selectedStock.id) ||
    liveStocks[activeTab]?.[0] ||
    selectedStock

  const toggleWatch = (id, e) => {
    e.stopPropagation()
    if (watchlist.includes(id)) {
      setWatchlist(watchlist.filter((item) => item !== id))
    } else {
      setWatchlist([...watchlist, id])
    }
  }

  const isUp = displayedStock.rate > 0
  const colorClass = isUp ? 'text-red-500' : 'text-blue-500'
  const strokeColor = isUp ? '#ef4444' : '#3b82f6'
  const gradId = `stockGrad-${displayedStock.id}`

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 font-sans">
      <div className="max-w-7xl mx-auto px-4 pt-4 pb-6">
        {/* 1. ヘッダー & 検索 & タブ */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="text-yellow-500 fill-yellow-500" size={24} /> 株式・マーケット
            </h1>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${usingMockData ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>
              {usingMockData ? 'MOCK' : 'SUPABASE'}
            </span>
            <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
              {['JP', 'US'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition ${activeTab === tab ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  {tab === 'JP' ? '🇯🇵 日本株' : '🇺🇸 米国株'}
                </button>
              ))}
            </div>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="銘柄名・コード検索..."
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
            />
          </div>
        </div>
        {marketLoading && (
          <p className="text-xs font-bold text-slate-400 mb-3">最新データを読み込み中...</p>
        )}
        {marketError && (
          <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-3">
            {marketError}（モックデータ表示中）
          </p>
        )}

        {/* 2. 流れるマーケットティッカー */}
        <div className="bg-slate-900 rounded-2xl overflow-hidden mb-6 -mx-4 sm:-mx-6 md:-mx-8">
          <div className="py-2 overflow-hidden whitespace-nowrap">
            <div className="inline-flex animate-ticker items-center flex-nowrap gap-8 pl-4 pr-16 min-w-max">
              {[...liveTicker, ...liveTicker, ...liveTicker].map((idx, i) => (
                <span key={i} className="flex items-center gap-2 shrink-0 text-white text-xs">
                  <span className="text-slate-400 font-bold">{idx.name}</span>
                  <span className="font-mono tabular-nums">{formatTickerPrice(idx.price, idx.name)}</span>
                  <span className={`font-bold ${idx.change > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                    {idx.change > 0 ? '▲' : '▼'} {Math.abs(idx.change)}%
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 3. メインレイアウト (左: リスト / 右: 詳細) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* [LEFT] 銘柄リスト */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-slate-500 flex items-center gap-1"><PieChart size={14} /> セクター動向</h3>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 rounded text-slate-400">リアルタイム</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold text-white">
                <div className="bg-red-500 p-2 rounded-lg">半導体<br />+2.4%</div>
                <div className="bg-red-400 p-2 rounded-lg">自動車<br />+1.1%</div>
                <div className="bg-blue-500 p-2 rounded-lg">海運<br />-0.8%</div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex-1">
              <div className="overflow-y-auto max-h-[600px] divide-y divide-slate-100 dark:divide-slate-800">
                {liveStocks[activeTab]?.map((stock) => (
                  <div
                    key={stock.id}
                    onClick={() => handleStockClick(stock)}
                    className={`p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition relative ${selectedStock.id === stock.id ? 'bg-orange-50 dark:bg-slate-800' : ''}`}
                  >
                    {selectedStock.id === stock.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500 rounded-r" />}
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 mr-2">{stock.code}</span>
                        <span className="font-bold text-slate-800 dark:text-white text-sm">{stock.name}</span>
                      </div>
                      <span className={`text-sm font-black tabular-nums ${stock.rate > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                        {activeTab === 'US' ? '$' : '¥'}{stock.price.toLocaleString(undefined, { minimumFractionDigits: activeTab === 'US' ? 2 : 0, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded">{stock.sector}</span>
                      <span className={`text-xs font-bold ${stock.rate > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                        {stock.rate > 0 ? '+' : ''}{stock.rate.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* [RIGHT] 詳細ダッシュボード */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">{displayedStock.name}</span>
                    <span className="text-sm font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">{displayedStock.code}</span>
                    {displayedStock.tag && <span className="text-xs font-bold text-white bg-orange-500 px-2 py-0.5 rounded-full animate-pulse">{displayedStock.tag}</span>}
                  </div>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className={`text-4xl font-black tabular-nums ${colorClass}`}>
                      {activeTab === 'US' ? '$' : '¥'}{displayedStock.price.toLocaleString(undefined, { minimumFractionDigits: activeTab === 'US' ? 2 : 0, maximumFractionDigits: 2 })}
                    </span>
                    <span className={`text-lg font-bold ${colorClass}`}>
                      {isUp ? '▲' : '▼'} {Math.abs(displayedStock.change).toFixed(activeTab === 'US' ? 2 : 0)} ({displayedStock.rate.toFixed(2)}%)
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => toggleWatch(displayedStock.id, e)}
                    className={`p-3 rounded-xl transition ${watchlist.includes(displayedStock.id) ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-500' : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-yellow-500'}`}
                  >
                    <Star size={20} fill={watchlist.includes(displayedStock.id) ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={() => alert(`${displayedStock.name} の価格アラート設定は準備中です。`)}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-500 transition"
                    title="価格アラート"
                  >
                    <Bell size={20} />
                  </button>
                </div>
              </div>

              <div className="h-[300px] w-full mb-6 relative group">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={strokeColor} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-700" />
                    <XAxis dataKey="i" hide />
                    <YAxis domain={['auto', 'auto']} hide />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                      cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Area type="monotone" dataKey="val" stroke={strokeColor} strokeWidth={3} fillOpacity={1} fill={`url(#${gradId})`} />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  <Zap size={14} className="text-yellow-400 flex-shrink-0" />
                  AI分析: 決算発表を受けて買い優勢。強気トレンド継続中。
                </div>
              </div>

              {/* プラットフォームアクション（取引は連携証券で） */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    if (watchlist.includes(displayedStock.id)) {
                      setWatchlist(watchlist.filter((id) => id !== displayedStock.id))
                    } else {
                      setWatchlist([...watchlist, displayedStock.id])
                    }
                  }}
                  className={`py-4 font-black rounded-xl shadow-sm transition border-2 flex items-center justify-center gap-2 text-lg
                    ${watchlist.includes(displayedStock.id)
                      ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-orange-500 dark:hover:border-orange-500 text-slate-700 dark:text-slate-300 hover:text-orange-500 dark:hover:text-orange-500'}`}
                >
                  {watchlist.includes(displayedStock.id) ? <Check size={20} /> : <Plus size={20} />}
                  {watchlist.includes(displayedStock.id) ? '登録済み' : 'ウォッチリストに追加'}
                </button>
                <button className="py-4 bg-slate-900 dark:bg-slate-100 hover:bg-black dark:hover:bg-white text-white dark:text-slate-900 font-black rounded-xl shadow-lg transition transform active:scale-95 text-lg flex items-center justify-center gap-2">
                  <Layout size={20} />
                  ポートフォリオ試算
                </button>
              </div>
              <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 mt-3 font-bold">
                ※ MoneyMartは証券会社ではありません。実際の取引は連携先の証券口座で行われます。
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="flex border-b border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setNewsTab('news')}
                  className={`flex-1 py-4 text-sm font-bold transition ${newsTab === 'news' ? 'text-slate-900 dark:text-white border-b-2 border-slate-900 dark:border-orange-500 bg-slate-50 dark:bg-slate-800/50' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                >
                  関連ニュース
                </button>
                <button
                  onClick={() => setNewsTab('company')}
                  className={`flex-1 py-4 text-sm font-bold transition ${newsTab === 'company' ? 'text-slate-900 dark:text-white border-b-2 border-slate-900 dark:border-orange-500 bg-slate-50 dark:bg-slate-800/50' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                >
                  企業情報
                </button>
                <button
                  onClick={() => setNewsTab('disclosure')}
                  className={`flex-1 py-4 text-sm font-bold transition ${newsTab === 'disclosure' ? 'text-slate-900 dark:text-white border-b-2 border-slate-900 dark:border-orange-500 bg-slate-50 dark:bg-slate-800/50' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                >
                  適時開示
                </button>
              </div>

              <div className="p-2">
                {newsTab === 'news' && (
                  <>
                    <div className="p-4 bg-orange-50/50 dark:bg-orange-900/20 rounded-xl mb-2 border border-orange-100 dark:border-orange-900/50">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">HOT</span>
                        <span className="text-xs font-bold text-orange-600 dark:text-orange-400">AI 速報</span>
                      </div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-snug">
                        {displayedStock.news}
                      </p>
                    </div>

                    {RELATED_NEWS.map((news) => (
                      <div key={news.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition cursor-pointer group border-b border-slate-50 dark:border-slate-800 last:border-0">
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{news.source}</span>
                            <span className="text-[10px] text-slate-400">{news.time}</span>
                          </div>
                          {news.sentiment === 'positive' && <TrendingUp size={14} className="text-red-400" />}
                          {news.sentiment === 'negative' && <TrendingDown size={14} className="text-blue-400" />}
                        </div>
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-orange-500 transition leading-snug">
                          {news.title}
                        </h4>
                      </div>
                    ))}
                  </>
                )}

                {newsTab === 'company' && (
                  <div className="p-6 space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">事業内容</h4>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                        {displayedStock.sector}セクターの代表銘柄。業績・財務状況などの詳細は公式IRを参照してください。
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">セクター</h4>
                      <span className="inline-block px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-bold text-sm">{displayedStock.sector}</span>
                    </div>
                    <p className="text-xs text-slate-400 pt-2">※ 企業情報は外部データに基づきます。最新情報は公式発表をご確認ください。</p>
                  </div>
                )}

                {newsTab === 'disclosure' && (
                  <div className="p-6 space-y-3">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">決算短信</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">XXX期 決算発表</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">準備中</p>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">適時開示</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">重要事項のないことの確認</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">準備中</p>
                    </div>
                    <p className="text-xs text-slate-400 pt-2">※ 適時開示情報はEDINET・TDnet等から取得します。</p>
                  </div>
                )}
              </div>
              {newsTab === 'news' && (
                <button className="w-full py-3 text-xs font-bold text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition border-t border-slate-100 dark:border-slate-800">
                  ニュースをもっと見る
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
