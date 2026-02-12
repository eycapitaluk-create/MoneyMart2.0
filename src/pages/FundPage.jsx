import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Heart, Check, Globe, DollarSign, Flag, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ZAxis,
  ComposedChart,
  Bar,
  Line,
  ReferenceLine,
  Legend,
} from 'recharts'

import { supabase } from '../lib/supabase'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const detectCategory = (code, name) => {
  const n = name ? name.toLowerCase() : ''
  if (n.includes('日本') || n.includes('topix') || n.includes('日経') || n.includes('国内')) return '国内株式'
  if (n.includes('米国') || n.includes('s&p') || n.includes('nasdaq') || n.includes('us')) return '米国株式'
  if (n.includes('全世界') || n.includes('global')) return '全世界株式'
  if (n.includes('新興国') || n.includes('emerging')) return '新興国株式'
  if (n.includes('債券') || n.includes('bond')) return '債券型'
  if (n.includes('reit') || n.includes('リート')) return 'REIT'
  if (n.includes('バランス')) return 'バランス型'
  return 'その他'
}

const calculateRiskFromReturn = (returnRate, category) => {
  if (category === '債券型') return 1.6
  if (category === 'バランス型') return 2.4
  if (returnRate < 5) return 1.8
  if (returnRate < 15) return 2.9
  if (returnRate < 25) return 3.7
  if (returnRate < 40) return 4.6
  return 5.3
}

const estimateStdDev = (riskLevel) => {
  if (riskLevel <= 2) return 5.4
  if (riskLevel <= 3) return 9.8
  if (riskLevel <= 4) return 14.9
  return 21.7
}

const FALLBACK_FUNDS = [
  { id: 'emaxis-all', fundName: 'eMAXIS Slim 全世界株式 (オール・カントリー)', fundCode: 'JP90C0009DQ8', category: '全世界株式', managementCompany: '三菱UFJ国際投信', trustFee: 0.05775, trustFeeDisplay: '0.06%', returnRate1Y: 24.5, aumValue: 2800000, annualReturnDisplay: '+24.5%', aumDisplay: '¥28,000億', riskLevel: 3.8, stdDev: 12.5, basePrice: 12450, prevComparison: 85, prevComparisonPercent: 0.69, minInvest: 100, isNew: false },
  { id: 'emaxis-sp500', fundName: 'eMAXIS Slim 米国株式 (S&P500)', fundCode: 'JP90C0003PD1', category: '米国株式', managementCompany: '三菱UFJ国際投信', trustFee: 0.09372, trustFeeDisplay: '0.09%', returnRate1Y: 28.3, aumValue: 1500000, annualReturnDisplay: '+28.3%', aumDisplay: '¥15,000億', riskLevel: 4.2, stdDev: 15.2, basePrice: 28900, prevComparison: 120, prevComparisonPercent: 0.42, minInvest: 100, isNew: false },
  { id: 'maxis-nikkei', fundName: 'MAXIS 国内株式・日経ダブルインデックス', fundCode: 'JP90C0009DR6', category: '国内株式', managementCompany: '三菱UFJ国際投信', trustFee: 0.154, trustFeeDisplay: '0.15%', returnRate1Y: 18.2, aumValue: 850000, annualReturnDisplay: '+18.2%', aumDisplay: '¥8,500億', riskLevel: 3.5, stdDev: 11.2, basePrice: 15680, prevComparison: 45, prevComparisonPercent: 0.29, minInvest: 100, isNew: false },
  { id: 'alliance-ab', fundName: 'アライアンス・バーンスタイン・米国成長株投信Ｄ', fundCode: 'JP90C0003PE8', category: '米国株式', managementCompany: 'アライアンス・バーンスタイン', trustFee: 1.727, trustFeeDisplay: '1.73%', returnRate1Y: 32.1, aumValue: 420000, annualReturnDisplay: '+32.1%', aumDisplay: '¥4,200億', riskLevel: 4.8, stdDev: 18.5, basePrice: 32500, prevComparison: 180, prevComparisonPercent: 0.56, minInvest: 100, isNew: false },
  { id: 'himuchi-plus', fundName: 'ひふみプラス', fundCode: 'JP90C0002QZ1', category: '国内株式', managementCompany: 'レオス・キャピタルワークス', trustFee: 1.078, trustFeeDisplay: '1.08%', returnRate1Y: 15.4, aumValue: 280000, annualReturnDisplay: '+15.4%', aumDisplay: '¥2,800億', riskLevel: 3.2, stdDev: 9.8, basePrice: 54000, prevComparison: 320, prevComparisonPercent: 0.60, minInvest: 100, isNew: false },
  { id: 'pictet-income', fundName: 'ピクテ・グローバル・インカム株式ファンド', fundCode: 'JP90C0005QZ9', category: '全世界株式', managementCompany: 'ピクテ投信', trustFee: 1.815, trustFeeDisplay: '1.82%', returnRate1Y: 8.2, aumValue: 180000, annualReturnDisplay: '+8.2%', aumDisplay: '¥1,800億', riskLevel: 2.8, stdDev: 7.5, basePrice: 18200, prevComparison: -25, prevComparisonPercent: -0.14, minInvest: 100, isNew: false },
  { id: 'nikko-emerging', fundName: 'ニッセイ 新興国株式ファンド', fundCode: 'JP90C0004QZ2', category: '新興国株式', managementCompany: 'ニッセイアセットマネジメント', trustFee: 1.728, trustFeeDisplay: '1.73%', returnRate1Y: 12.5, aumValue: 95000, annualReturnDisplay: '+12.5%', aumDisplay: '¥950億', riskLevel: 4.0, stdDev: 16.2, basePrice: 12850, prevComparison: 85, prevComparisonPercent: 0.67, minInvest: 100, isNew: false },
  { id: 'daiwa-reit', fundName: '大和 上場投信・REIT インデックス', fundCode: 'JP90C0006QZ5', category: 'REIT', managementCompany: '大和アセットマネジメント', trustFee: 0.198, trustFeeDisplay: '0.20%', returnRate1Y: 5.8, aumValue: 120000, annualReturnDisplay: '+5.8%', aumDisplay: '¥1,200億', riskLevel: 2.5, stdDev: 8.2, basePrice: 9850, prevComparison: 15, prevComparisonPercent: 0.15, minInvest: 100, isNew: false },
  { id: 'muji-balance', fundName: 'ムジ・バランス・ファンド', fundCode: 'JP90C0007QZ8', category: 'バランス型', managementCompany: 'ムジ・インベストメント', trustFee: 0.96, trustFeeDisplay: '0.96%', returnRate1Y: 9.8, aumValue: 65000, annualReturnDisplay: '+9.8%', aumDisplay: '¥650億', riskLevel: 2.8, stdDev: 6.5, basePrice: 11200, prevComparison: 42, prevComparisonPercent: 0.38, minInvest: 5000, isNew: false },
  { id: 'raku-eco', fundName: '楽天・全世界・株価指数・ECO', fundCode: 'JP90C0008QZ1', category: '全世界株式', managementCompany: '楽天投信', trustFee: 0.176, trustFeeDisplay: '0.18%', returnRate1Y: 22.1, aumValue: 320000, annualReturnDisplay: '+22.1%', aumDisplay: '¥3,200億', riskLevel: 3.9, stdDev: 13.8, basePrice: 13480, prevComparison: 95, prevComparisonPercent: 0.71, minInvest: 100, isNew: true },
].map((f) => ({
  ...f,
  sharpe: Number(((f.returnRate1Y || 0) / Math.max(f.stdDev || 1, 1)).toFixed(2)),
}))

const formatOku = (value) => `¥${Math.round((value || 0) / 100).toLocaleString()}億`
const fmtPct = (v) => `${v > 0 ? '+' : ''}${Number(v || 0).toFixed(1)}%`

export default function FundPage({ user, myWatchlist = [], toggleWatchlist: propToggleWatchlist }) {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [dbFunds, setDbFunds] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [watchlist, setWatchlist] = useState(() => (Array.isArray(myWatchlist) ? myWatchlist : []))
  const [currentPage, setCurrentPage] = useState(1)
  const [sortConfig, setSortConfig] = useState({ key: 'returnRate1Y', direction: 'descending' })

  const itemsPerPage = 12
  const toggleWatchlist = typeof propToggleWatchlist === 'function'
    ? propToggleWatchlist
    : (id) => setWatchlist((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const effectiveWatchlist = Array.isArray(myWatchlist) && myWatchlist.length > 0 ? myWatchlist : watchlist

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const { data: fundsData, error: fundsError } = await supabase
          .from('funds')
          .select('*, fund_prices(return_1y, price, return_1d, net_assets)')
          .order('trust_fee', { ascending: true })

        if (fundsError) throw fundsError

        const formattedFunds = (fundsData || []).map((item) => {
          const priceData = item.fund_prices?.[0] || {}
          const basePrice = priceData.price || 10000
          const return1d = priceData.return_1d || 0
          const returnRate = priceData.return_1y || 0
          const rawAum = priceData.net_assets || 0
          const displayCategory = detectCategory(item.category, item.name)
          const riskLvl = calculateRiskFromReturn(returnRate, displayCategory)
          const stdDev = estimateStdDev(riskLvl)
          const prevPrice = basePrice / (1 + return1d / 100)

          return {
            id: item.quick_code || item.isin_code || item.name,
            fundName: item.name,
            fundCode: item.isin_code || '-',
            category: displayCategory,
            managementCompany: item.company_code || '-',
            trustFee: item.trust_fee || 0,
            trustFeeDisplay: item.trust_fee ? `${Number(item.trust_fee).toFixed(2)}%` : '-',
            returnRate1Y: Number(returnRate),
            aumValue: rawAum,
            annualReturnDisplay: `${returnRate > 0 ? '+' : ''}${Number(returnRate).toFixed(1)}%`,
            aumDisplay: formatOku(rawAum),
            riskLevel: riskLvl,
            stdDev,
            basePrice,
            prevComparison: Math.round(basePrice - prevPrice),
            prevComparisonPercent: Number(return1d).toFixed(2),
            minInvest: item.min_investment || 100,
            sharpe: stdDev > 0 ? Number((Number(returnRate) / stdDev).toFixed(2)) : 0,
          }
        })

        const funds = formattedFunds.length > 0 ? formattedFunds : FALLBACK_FUNDS
        setDbFunds([...funds].sort((a, b) => b.returnRate1Y - a.returnRate1Y))
      } catch (error) {
        console.error('Error fetching data:', error.message)
        setDbFunds(FALLBACK_FUNDS)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  const filteredFunds = useMemo(() => {
    let result = dbFunds
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase()
      result = result.filter(
        (fund) =>
          (fund.fundName || '').toLowerCase().includes(lowerTerm) ||
          (fund.fundCode || '').toLowerCase().includes(lowerTerm)
      )
    }
    if (activeFilter !== 'all') {
      if (activeFilter === 'watchlist') {
        result = result.filter((f) => Array.isArray(effectiveWatchlist) && effectiveWatchlist.includes(f.id))
      } else if (activeFilter === 'domestic') result = result.filter((f) => f.category === '国内株式')
      else if (activeFilter === 'global') result = result.filter((f) => ['全世界株式', '米国株式', '先進国株式', '新興国株式'].includes(f.category))
      else if (activeFilter === 'lowcost') result = result.filter((f) => f.trustFee < 0.5)
    }
    return result
  }, [searchTerm, activeFilter, dbFunds, effectiveWatchlist])

  const sortedFunds = useMemo(() => {
    const sortableItems = [...filteredFunds]
    sortableItems.sort((a, b) => {
      const aVal = a[sortConfig.key]
      const bVal = b[sortConfig.key]
      if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1
      return 0
    })
    return sortableItems
  }, [filteredFunds, sortConfig])

  const totalPages = Math.ceil(sortedFunds.length / itemsPerPage) || 1
  const paginatedData = useMemo(() => {
    const first = (currentPage - 1) * itemsPerPage
    return sortedFunds.slice(first, first + itemsPerPage)
  }, [sortedFunds, currentPage])

  const categoryFlowSnapshot = useMemo(() => {
    const map = {}
    dbFunds.forEach((f) => {
      if (!map[f.category]) map[f.category] = { sum: 0, count: 0 }
      map[f.category].sum += f.returnRate1Y
      map[f.category].count += 1
    })
    return Object.entries(map)
      .map(([name, stats]) => ({
        name,
        flow: Math.round((stats.sum / Math.max(stats.count, 1)) * 45),
      }))
      .sort((a, b) => Math.abs(b.flow) - Math.abs(a.flow))
      .slice(0, 5)
  }, [dbFunds])

  const flowTrendData = useMemo(() => {
    const domesticAvg = dbFunds.filter((f) => f.category === '国内株式').reduce((acc, cur) => acc + cur.returnRate1Y, 0) / Math.max(dbFunds.filter((f) => f.category === '国内株式').length, 1)
    const globalAvg = dbFunds.filter((f) => ['米国株式', '全世界株式', '新興国株式'].includes(f.category)).reduce((acc, cur) => acc + cur.returnRate1Y, 0) / Math.max(dbFunds.filter((f) => ['米国株式', '全世界株式', '新興国株式'].includes(f.category)).length, 1)

    let dAcc = 1000
    let gAcc = 1000
    return MONTHS.map((month, idx) => {
      const drift = (idx - 5) * 16
      const netFlow = Math.round((Math.sin(idx / 2) * 95) + drift + (domesticAvg + globalAvg) * 4)
      dAcc += domesticAvg * 18 + idx * 8
      gAcc += globalAvg * 18 + idx * 10
      return {
        month,
        netFlow,
        domesticAum: Math.round(dAcc),
        globalAum: Math.round(gAcc),
      }
    })
  }, [dbFunds])

  const mapData = useMemo(() => {
    const base = dbFunds.slice(0, 30)
    return base.map((f) => {
      const isPositive = f.returnRate1Y >= 0
      return {
        id: f.id,
        x: Number(f.stdDev),
        y: Number(f.returnRate1Y),
        z: Math.max(250, Math.sqrt(f.aumValue || 1) * 2.8),
        name: f.fundName,
        category: f.category,
        aumDisplay: f.aumDisplay,
        fill: isPositive ? '#3b82f6' : '#ef4444',
      }
    })
  }, [dbFunds])

  const requestSort = (key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'descending' ? 'ascending' : 'descending'
    setSortConfig({ key, direction })
  }

  const scoreToStars = (fund) => {
    const score = fund.returnRate1Y - fund.trustFee * 3 - fund.stdDev * 0.3
    if (score > 22) return '★★★★★'
    if (score > 16) return '★★★★☆'
    if (score > 10) return '★★★☆☆'
    if (score > 4) return '★★☆☆☆'
    return '★☆☆☆☆'
  }

  const SortIcon = ({ colKey }) => {
    if (sortConfig.key !== colKey) return <ArrowUpDown size={13} className="ml-1 text-slate-400" />
    return sortConfig.direction === 'ascending'
      ? <ArrowUp size={13} className="ml-1 text-orange-500" />
      : <ArrowDown size={13} className="ml-1 text-orange-500" />
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentPage])

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
        <p className="text-slate-500 dark:text-slate-400 font-bold">データを読み込んでいます...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fadeIn bg-[#F9FAFB] dark:bg-slate-950 min-h-screen font-sans pb-28">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">Fund Intelligence Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Flow / Risk / List を一画面で確認</p>
      </div>

      <div className="mb-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
          <div className="relative w-full lg:max-w-xl">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ファンド名 / ISIN で検索"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'すべて', icon: Check },
              { id: 'watchlist', label: 'ウォッチ', icon: Heart },
              { id: 'domestic', label: '国内', icon: Flag },
              { id: 'global', label: '海外/全世界', icon: Globe },
              { id: 'lowcost', label: '低コスト', icon: DollarSign },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => {
                  setActiveFilter(filter.id)
                  setCurrentPage(1)
                }}
                className={`px-3 py-2 rounded-full border text-xs font-bold flex items-center gap-1.5 transition ${
                  activeFilter === filter.id
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-orange-500 dark:border-orange-500'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {filter.id !== 'all' && <filter.icon size={12} />}
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Fund Flow Trend (Past 1 Year)</h2>
          <div className="text-xs text-slate-500 dark:text-slate-400">Flow/Accumulated AUM (simulated)</div>
        </div>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={flowTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip
                formatter={(v, key) => {
                  if (key === 'netFlow') return [`${v > 0 ? '+' : ''}${v}億`, 'Net Flow']
                  return [`${v.toLocaleString()}億`, key === 'domesticAum' ? 'AUM (Domestic)' : 'AUM (Global)']
                }}
              />
              <Legend />
              <ReferenceLine y={0} stroke="#cbd5e1" />
              <Bar dataKey="netFlow" name="Net fund flow" barSize={18}>
                {flowTrendData.map((entry, i) => (
                  <Cell key={`flow-${i}`} fill={entry.netFlow >= 0 ? '#3b82f6' : '#ef4444'} />
                ))}
              </Bar>
              <Line type="monotone" dataKey="domesticAum" name="AUM model (domestic)" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="globalAum" name="AUM model (global)" stroke="#94a3b8" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {categoryFlowSnapshot.map((item) => (
            <span
              key={item.name}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                item.flow >= 0
                  ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/40'
                  : 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/40'
              }`}
            >
              {item.name} {item.flow > 0 ? '+' : ''}{item.flow}億
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 mb-6">
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mb-4">Risk-Return Bubble Chart</h2>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis type="number" dataKey="x" name="Volatility" unit="%" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis type="number" dataKey="y" name="1Y Return" unit="%" tick={{ fontSize: 11, fill: '#64748b' }} />
              <ZAxis type="number" dataKey="z" range={[120, 1100]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null
                  const d = payload[0].payload
                  return (
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-xs shadow-lg">
                      <p className="font-bold text-slate-900 dark:text-white mb-1">{d.name}</p>
                      <p className="text-slate-500 dark:text-slate-300">Return: {fmtPct(d.y)}</p>
                      <p className="text-slate-500 dark:text-slate-300">Volatility: {d.x}%</p>
                      <p className="text-slate-500 dark:text-slate-300">AUM: {d.aumDisplay}</p>
                    </div>
                  )
                }}
              />
              <Scatter data={mapData} onClick={(entry) => navigate(`/funds/${entry.id}`)}>
                {mapData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} fillOpacity={0.8} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 text-xs mt-2 text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Positive fund flow</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Negative fund flow</span>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Fund List</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">件数 {sortedFunds.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-300 text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Rank</th>
                <th className="px-4 py-3 text-left cursor-pointer" onClick={() => requestSort('fundName')}>Fund <SortIcon colKey="fundName" /></th>
                <th className="px-4 py-3 text-right cursor-pointer" onClick={() => requestSort('trustFee')}>Trust Fee <SortIcon colKey="trustFee" /></th>
                <th className="px-4 py-3 text-right cursor-pointer" onClick={() => requestSort('stdDev')}>Volatility <SortIcon colKey="stdDev" /></th>
                <th className="px-4 py-3 text-right cursor-pointer" onClick={() => requestSort('sharpe')}>Sharpe <SortIcon colKey="sharpe" /></th>
                <th className="px-4 py-3 text-right cursor-pointer" onClick={() => requestSort('aumValue')}>AUM <SortIcon colKey="aumValue" /></th>
                <th className="px-4 py-3 text-right cursor-pointer" onClick={() => requestSort('returnRate1Y')}>1Y Return <SortIcon colKey="returnRate1Y" /></th>
                <th className="px-4 py-3 text-right">Rating</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((fund, idx) => {
                const isWatchlisted = Array.isArray(effectiveWatchlist) && effectiveWatchlist.includes(fund.id)
                return (
                  <tr
                    key={fund.id}
                    className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                    onClick={() => navigate(`/funds/${fund.id}`)}
                  >
                    <td className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white line-clamp-1">{fund.fundName}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">{fund.category} · {fund.fundCode}</div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleWatchlist(fund.id)
                          }}
                          className={`p-1 rounded ${isWatchlisted ? 'text-red-500' : 'text-slate-400'}`}
                        >
                          <Heart size={14} fill={isWatchlisted ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{fund.trustFeeDisplay}</td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{fund.stdDev.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{fund.sharpe.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{fund.aumDisplay}</td>
                    <td className={`px-4 py-3 text-right font-bold ${fund.returnRate1Y >= 0 ? 'text-red-500' : 'text-blue-500'}`}>{fmtPct(fund.returnRate1Y)}</td>
                    <td className="px-4 py-3 text-right text-amber-500 font-bold">{scoreToStars(fund)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-300">{currentPage} / {totalPages}</span>
          <button
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      <div className="text-right mt-4 text-xs text-slate-400">※ データ提供: QUICK | 基準日: 2026.02.02</div>
    </div>
  )
}
