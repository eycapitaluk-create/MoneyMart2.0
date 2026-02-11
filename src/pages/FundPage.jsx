import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Heart, Check, Globe, DollarSign, Flag, BarChart2,
  LayoutList, ScatterChart as ChartIcon, TrendingUp, Loader2, ChevronRight, X,
  ChevronLeft, ArrowUpDown, ArrowUp, ArrowDown, JapaneseYen
} from 'lucide-react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ZAxis,
  BarChart, Bar, ReferenceLine
} from 'recharts'

import { supabase } from '../lib/supabase'

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
  if (category === '債券型') return 1.5
  if (category === 'バランス型') return 2.5
  if (returnRate < 5) return 1.5 + Math.random() * 0.5
  if (returnRate < 15) return 2.5 + Math.random() * 0.5
  if (returnRate < 25) return 3.5 + Math.random() * 0.5
  if (returnRate < 40) return 4.5 + Math.random() * 0.5
  return 5.2 + Math.random() * 0.3
}

const estimateStdDev = (riskLevel) => {
  const base = Math.round(riskLevel || 3)
  let min, max
  switch (base) {
    case 1: min = 0.5; max = 3.0; break
    case 2: min = 3.0; max = 8.0; break
    case 3: min = 8.0; max = 15.0; break
    case 4: min = 15.0; max = 25.0; break
    case 5: min = 25.0; max = 40.0; break
    default: min = 10.0; max = 20.0
  }
  return Number((min + Math.random() * (max - min)).toFixed(2))
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
]

export default function FundPage({ user, myWatchlist = [], toggleWatchlist: propToggleWatchlist }) {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [viewMode, setViewMode] = useState('list')
  const [dbFunds, setDbFunds] = useState([])
  const [assetFlowData, setAssetFlowData] = useState([])
  const [selectedFlow, setSelectedFlow] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [selectedFundIds, setSelectedFundIds] = useState([])
  const [watchlist, setWatchlist] = useState(() => (Array.isArray(myWatchlist) ? myWatchlist : []))

  const itemsPerPage = 7
  const [currentPage, setCurrentPage] = useState(1)
  const [sortConfig, setSortConfig] = useState({ key: 'returnRate1Y', direction: 'descending' })

  const toggleWatchlist = typeof propToggleWatchlist === 'function'
    ? propToggleWatchlist
    : (id) => {
        setWatchlist((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
      }

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
          const displayReturn = Number(returnRate).toFixed(1)
          const displayAum = (rawAum / 100).toFixed(1)
          const prevPrice = basePrice / (1 + return1d / 100)
          const changePrice = Math.round(basePrice - prevPrice)
          const changePercent = return1d.toFixed(2)
          const displayCategory = detectCategory(item.category, item.name)
          const riskLvl = calculateRiskFromReturn(returnRate, displayCategory)
          const stdDev = estimateStdDev(riskLvl)

          return {
            id: item.quick_code,
            fundName: item.name,
            fundCode: item.isin_code || null,
            category: displayCategory,
            managementCompany: item.company_code,
            trustFee: item.trust_fee || 0,
            trustFeeDisplay: item.trust_fee ? Number(item.trust_fee).toFixed(2) + '%' : '-',
            returnRate1Y: Number(returnRate),
            aumValue: rawAum,
            annualReturnDisplay: (returnRate > 0 ? '+' : '') + displayReturn + '%',
            aumDisplay: `¥${displayAum}億`,
            riskLevel: riskLvl,
            stdDev,
            basePrice,
            prevComparison: changePrice,
            prevComparisonPercent: changePercent,
            minInvest: item.min_investment || 100,
            isNew: false,
          }
        })

        if (formattedFunds.length === 0) {
          setDbFunds(FALLBACK_FUNDS)
        } else {
          formattedFunds.sort((a, b) => b.returnRate1Y - a.returnRate1Y)
          setDbFunds(formattedFunds)
        }

        const fundsToUse = formattedFunds.length > 0 ? formattedFunds : FALLBACK_FUNDS
        const categoryStats = {}
        ['国内株式', '米国株式', '全世界株式', '債券型', 'REIT', 'バランス型'].forEach((c) => {
          categoryStats[c] = { totalReturn: 0, count: 0 }
        })

        fundsToUse.forEach((fund) => {
          const cat = fund.category
          if (!categoryStats[cat]) categoryStats[cat] = { totalReturn: 0, count: 0 }
          categoryStats[cat].totalReturn += fund.returnRate1Y
          categoryStats[cat].count += 1
        })

        const computedFlows = Object.keys(categoryStats).map((cat) => {
          const stats = categoryStats[cat]
          if (stats.count === 0) return { name: cat, flow: 0 }
          const avgReturn = stats.totalReturn / stats.count
          let simulatedFlow = Math.round(avgReturn * 50)
          if (simulatedFlow === 0 && avgReturn !== 0) {
            simulatedFlow = avgReturn > 0 ? 10 : -10
          }
          return { name: cat, flow: simulatedFlow }
        })

        computedFlows.sort((a, b) => {
          if (a.flow === 0) return 1
          if (b.flow === 0) return -1
          return Math.abs(b.flow) - Math.abs(a.flow)
        })
        setAssetFlowData(computedFlows.slice(0, 7))
      } catch (error) {
        console.error('Error fetching data:', error.message)
        setDbFunds(FALLBACK_FUNDS)
        setAssetFlowData([
          { name: '全世界株式', flow: 150 },
          { name: '米国株式', flow: 120 },
          { name: '国内株式', flow: -30 },
        ])
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
      else if (activeFilter === 'global') result = result.filter((f) => f.category === '全世界株式' || f.category === '米国株式' || f.category === '先進国株式')
      else if (activeFilter === 'lowcost') result = result.filter((f) => f.trustFee < 0.5)
    }
    return result
  }, [searchTerm, activeFilter, dbFunds, effectiveWatchlist])

  const sortedFunds = useMemo(() => {
    const sortableItems = [...filteredFunds]
    if (sortConfig.key != null) {
      sortableItems.sort((a, b) => {
        const aVal = a[sortConfig.key]
        const bVal = b[sortConfig.key]
        if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1
        if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1
        return 0
      })
    }
    return sortableItems
  }, [filteredFunds, sortConfig])

  const requestSort = (key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'descending' ? 'ascending' : 'descending'
    setSortConfig({ key, direction })
  }

  const totalPages = Math.ceil(sortedFunds.length / itemsPerPage)

  const chartDisplayData = useMemo(() => {
    const highlights = dbFunds.filter(
      (f) =>
        selectedFundIds.includes(f.id) ||
        (Array.isArray(effectiveWatchlist) && effectiveWatchlist.includes(f.id))
    )
    const highlightIds = highlights.map((f) => f.id)
    const candidates = dbFunds.filter((f) => !highlightIds.includes(f.id))
    const sortedByReturn = [...candidates].sort((a, b) => b.returnRate1Y - a.returnRate1Y)
    const topTier = sortedByReturn.slice(0, 10)
    const midTier = sortedByReturn.slice(Math.floor(sortedByReturn.length / 2), Math.floor(sortedByReturn.length / 2) + 10)
    const lowTier = sortedByReturn.slice(-10)
    return [...highlights, ...topTier, ...midTier, ...lowTier]
  }, [dbFunds, selectedFundIds, effectiveWatchlist])

  const mapData = useMemo(
    () =>
      chartDisplayData.map((f) => {
        const isSelected = selectedFundIds.includes(f.id)
        const isWatchlisted = Array.isArray(effectiveWatchlist) && effectiveWatchlist.includes(f.id)
        const isHighlight = isSelected || isWatchlisted
        return {
          id: f.id,
          x: f.stdDev,
          y: f.returnRate1Y,
          z: (f.aumValue > 0 ? Math.sqrt(f.aumValue) : 500) * (isHighlight ? 2.5 : 1.2),
          name: f.fundName,
          category: f.category,
          aumDisplay: f.aumDisplay,
          fill: isHighlight ? '#F97316' : (f.riskLevel <= 2.5 ? '#10B981' : f.riskLevel <= 4 ? '#3B82F6' : '#8B5CF6'),
          opacity: isHighlight ? 1 : 0.5,
          stroke: isHighlight ? '#fff' : 'none',
          strokeWidth: isHighlight ? 3 : 0,
          isHighlight,
        }
      }),
    [chartDisplayData, selectedFundIds, effectiveWatchlist]
  )

  const handleFlowClick = async (data) => {
    if (data.flow === 0) {
      alert('このカテゴリーのデータは現在ありません。')
      return
    }
    if (selectedFlow && selectedFlow.name === data.name) {
      setSelectedFlow(null)
      return
    }

    setIsDetailLoading(true)
    setSelectedFlow({ name: data.name, flow: data.flow, details: { top: [], bottom: [] } })

    try {
      let keyword = data.name.replace('株式', '').replace('型', '')
      if (data.name.includes('米国')) keyword = '米国'
      if (data.name.includes('日本') || data.name.includes('国内')) keyword = '日本'

      const { data: fundsData } = await supabase
        .from('funds')
        .select('name, fund_prices(return_1y, net_assets)')
        .or(`name.ilike.%${keyword}%,category.ilike.%${keyword}%`)
        .limit(50)

      if (fundsData && fundsData.length > 0) {
        const parsed = fundsData.map((f) => ({
          name: f.name,
          return: f.fund_prices?.[0]?.return_1y || 0,
          aum: f.fund_prices?.[0]?.net_assets || 0,
        }))
        const top3 = [...parsed].sort((a, b) => b.aum - a.aum).slice(0, 3)
        const bottom3 = [...parsed].sort((a, b) => a.aum - b.aum).slice(0, 3)
        setSelectedFlow((prev) => ({ ...prev, details: { top: top3, bottom: bottom3 } }))
      } else {
        setSelectedFlow((prev) => ({ ...prev, details: { top: [], bottom: [] } }))
      }
    } catch (err) {
      console.error('Detail Fetch Error:', err)
    } finally {
      setIsDetailLoading(false)
    }
  }

  const handleCheckboxChange = (e, fundId) => {
    e.stopPropagation()
    if (selectedFundIds.includes(fundId)) {
      setSelectedFundIds(selectedFundIds.filter((id) => id !== fundId))
    } else {
      if (selectedFundIds.length >= 2) {
        alert('比較は最大2件まで選択可能です。')
        return
      }
      setSelectedFundIds([...selectedFundIds, fundId])
    }
  }

  const goToComparison = () => {
    if (selectedFundIds.length < 2) {
      alert('比較するには2つ以上のファンドを選択してください。')
      return
    }
    navigate(`/funds/compare?ids=${selectedFundIds.join(',')}`)
  }

  const SortIcon = ({ colKey }) => {
    if (sortConfig.key !== colKey) return <ArrowUpDown size={14} className="ml-1 text-slate-300 dark:text-slate-600" />
    return sortConfig.direction === 'ascending' ? (
      <ArrowUp size={14} className="ml-1 text-orange-500" />
    ) : (
      <ArrowDown size={14} className="ml-1 text-orange-500" />
    )
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-xl backdrop-blur-sm text-xs z-50 min-w-[200px]">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: data.fill }} />
            <span className="font-bold text-slate-500">{data.category}</span>
          </div>
          <p className="font-bold text-sm text-slate-900 dark:text-white mb-2 leading-tight">{data.name}</p>
          <div className="grid grid-cols-2 gap-y-1 gap-x-4 text-slate-500">
            <span>標準偏差:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 text-right">{data.x}%</span>
            <span>Return:</span>
            <span className={`font-bold text-right ${data.y >= 0 ? 'text-red-500' : 'text-blue-500'}`}>{data.y > 0 ? '+' : ''}{data.y}%</span>
            <span>AUM:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 text-right">{data.aumDisplay}</span>
          </div>
          {data.isHighlight && <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 text-orange-500 font-bold text-center">★ 選択中 / ウォッチ</div>}
        </div>
      )
    }
    return null
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentPage])

  const paginatedData = useMemo(() => {
    const first = (currentPage - 1) * itemsPerPage
    return sortedFunds.slice(first, first + itemsPerPage)
  }, [currentPage, sortedFunds, itemsPerPage])

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
        <p className="text-slate-500 dark:text-slate-400 font-bold">データを読み込んでいます...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fadeIn bg-[#F9FAFB] dark:bg-slate-950 min-h-screen font-sans pb-32">
      <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">ファンド検索</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">全{dbFunds.length}件のファンドからAIが分析</p>
        </div>
        <div className="flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1 rounded-xl shadow-sm">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${viewMode === 'list' ? 'bg-slate-900 dark:bg-orange-500 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <LayoutList size={16} /> リスト
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${viewMode === 'map' ? 'bg-slate-900 dark:bg-orange-500 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <ChartIcon size={16} /> リスクマップ
          </button>
        </div>
      </div>

      {/* Fund Flow Section */}
      <div className="mb-8">
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <JapaneseYen size={20} className="text-green-500" /> カテゴリー別 資金流出入 (Fund Flow)
              </h2>
              <p className="text-xs text-slate-400 mt-1">棒グラフをクリックすると、その中の純資産上位・下位ファンドが表示されます。</p>
            </div>
          </div>
          <div className="h-64 w-full">
            {assetFlowData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={assetFlowData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-700" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} />
                  <YAxis fontSize={10} stroke="#94a3b8" />
                  <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    formatter={(value) => [value === 0 ? '±0 (均衡)' : `${value > 0 ? '+' : ''}${value}億円`, '推計資金流']}
                  />
                  <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={2} />
                  <Bar dataKey="flow" barSize={32} radius={[4, 4, 4, 4]} onClick={handleFlowClick} cursor="pointer">
                    {assetFlowData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.flow === 0 ? '#94a3b8' : entry.flow > 0 ? '#ef4444' : '#3b82f6'}
                        stroke={selectedFlow?.name === entry.name ? '#000' : 'none'}
                        strokeWidth={2}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">データがありません</div>
            )}
          </div>

          {selectedFlow && (
            <div className="mt-4 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 animate-slideUp">
              <div className="flex justify-between items-center mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <span className="bg-slate-800 dark:bg-slate-600 text-white text-xs px-2 py-1 rounded">{selectedFlow.name}</span>
                  カテゴリー内の資産規模
                </h3>
                <button onClick={() => setSelectedFlow(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <X size={18} />
                </button>
              </div>
              {isDetailLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="animate-spin text-slate-400" />
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-bold text-red-500 mb-2 flex items-center gap-1">
                      <ArrowUp size={14} /> 純資産 Top 3 (人気)
                    </h4>
                    <div className="space-y-2">
                      {selectedFlow.details.top?.length > 0 ? (
                        selectedFlow.details.top.map((f, i) => (
                          <div key={i} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-red-100 dark:border-red-900/50 flex justify-between items-center shadow-sm">
                            <div className="flex items-center gap-3">
                              <span className="w-5 h-5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 line-clamp-1">{f.name}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-black text-red-500">¥{(f.aum / 100).toFixed(1)}億</div>
                              <div className="text-[10px] text-slate-400">Return: {f.return?.toFixed(1) || '0'}%</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-400">データがありません</div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-blue-500 mb-2 flex items-center gap-1">
                      <ArrowDown size={14} /> 純資産 Bottom 3
                    </h4>
                    <div className="space-y-2">
                      {selectedFlow.details.bottom?.length > 0 ? (
                        selectedFlow.details.bottom.map((f, i) => (
                          <div key={i} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-blue-100 dark:border-blue-900/50 flex justify-between items-center shadow-sm">
                            <div className="flex items-center gap-3">
                              <span className="w-5 h-5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 line-clamp-1">{f.name}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-black text-blue-500">¥{(f.aum / 100).toFixed(1)}億</div>
                              <div className="text-[10px] text-slate-400">Return: {f.return?.toFixed(1) || '0'}%</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-400">データがありません</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mb-6 relative w-full bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          <Search size={20} />
        </div>
        <input
          type="text"
          placeholder="ファンド名、ISINコード(JP...) で検索"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-4 text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none text-base font-medium bg-transparent"
        />
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        <span className="text-slate-400 text-sm flex items-center mr-2">フィルター:</span>
        {[
          { id: 'all', label: 'すべて', icon: Check },
          { id: 'watchlist', label: 'ウォッチリスト', icon: Heart },
          { id: 'domestic', label: '国内株式', icon: Flag },
          { id: 'global', label: '海外・全世界', icon: Globe },
          { id: 'lowcost', label: '低コスト', icon: DollarSign },
        ].map((filter) => (
          <button
            key={filter.id}
            onClick={() => {
              setActiveFilter(filter.id)
              setCurrentPage(1)
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold transition-all ${
              activeFilter === filter.id
                ? filter.id === 'watchlist'
                  ? 'bg-rose-500 text-white border-rose-500'
                  : 'bg-slate-900 dark:bg-orange-500 text-white border-slate-900 dark:border-orange-500'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {filter.id !== 'all' && <filter.icon size={14} className={activeFilter === filter.id ? 'text-white' : filter.id === 'watchlist' ? 'text-rose-500' : 'text-slate-500'} />}
            {filter.label}
          </button>
        ))}
      </div>

      {viewMode === 'map' ? (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-800 shadow-lg mb-8 relative overflow-hidden animate-fadeIn">
          <div className="h-[450px] w-full bg-slate-50 dark:bg-slate-800/30 rounded-2xl relative border border-slate-100 dark:border-slate-700 overflow-hidden cursor-crosshair">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-700" />
                <XAxis type="number" dataKey="x" name="Risk" domain={[0, 'auto']} unit="%" tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <YAxis type="number" dataKey="y" name="Return" unit="%" tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} isAnimationActive={false} />
                <ZAxis type="number" dataKey="z" range={[200, 1200]} />
                <Scatter name="Funds" data={mapData} onClick={(d) => navigate(`/funds/${d.id}`)}>
                  {mapData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} fillOpacity={entry.opacity} stroke={entry.stroke} strokeWidth={entry.strokeWidth} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden animate-fadeIn">
          <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider items-center hidden md:grid select-none">
            <div className="col-span-1 text-center">比較</div>
            <div className="col-span-4 pl-2 cursor-pointer hover:text-orange-600 flex items-center" onClick={() => requestSort('fundName')}>
              ファンド名 / カテゴリー <SortIcon colKey="fundName" />
            </div>
            <div className="col-span-2 text-center cursor-pointer hover:text-orange-600 flex items-center justify-center" onClick={() => requestSort('returnRate1Y')}>
              年間リターン <SortIcon colKey="returnRate1Y" />
            </div>
            <div className="col-span-1 text-center cursor-pointer hover:text-orange-600 flex items-center justify-center" onClick={() => requestSort('trustFee')}>
              信託報酬 <SortIcon colKey="trustFee" />
            </div>
            <div className="col-span-1 text-center">最低投資額</div>
            <div className="col-span-1 text-right cursor-pointer hover:text-orange-600 flex items-center justify-end" onClick={() => requestSort('aumValue')}>
              純資産(AUM) <SortIcon colKey="aumValue" />
            </div>
            <div className="col-span-2 text-right">基準価額 / 前日比</div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginatedData.map((fund) => {
              const isPlus = (parseFloat(fund.prevComparisonPercent) || 0) >= 0
              const riskLevel = Math.round(fund.riskLevel)
              const isHighRisk = riskLevel >= 4
              const isSelected = selectedFundIds.includes(fund.id)
              const isWatchlisted = Array.isArray(effectiveWatchlist) && effectiveWatchlist.includes(fund.id)

              return (
                <div
                  key={fund.id}
                  onClick={() => navigate(`/funds/${fund.id}`)}
                  className={`grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-6 items-center transition cursor-pointer group relative ${
                    isSelected ? 'bg-orange-50 dark:bg-orange-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <div className="col-span-1 hidden md:flex justify-center items-center" onClick={(e) => e.stopPropagation()}>
                    <div
                      onClick={(e) => handleCheckboxChange(e, fund.id)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                        isSelected ? 'bg-orange-500 border-orange-500 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-orange-400'
                      }`}
                    >
                      {isSelected && <Check size={14} strokeWidth={4} />}
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-4 pl-0 md:pl-2 relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleWatchlist(fund.id)
                      }}
                      className="absolute right-0 top-0 md:hidden p-3 z-30 text-slate-400 active:scale-90 transition-transform"
                    >
                      <Heart size={20} fill={isWatchlisted ? '#EF4444' : 'none'} className={isWatchlisted ? 'text-red-500' : ''} />
                    </button>
                    <div className="pr-8 md:pr-4">
                      {fund.fundCode && <span className="text-[10px] text-slate-400 font-mono mb-1 block">{fund.fundCode}</span>}
                      <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1 group-hover:text-orange-600 transition-colors line-clamp-2 leading-tight">{fund.fundName}</h3>
                      <p className="text-xs text-slate-400 font-medium mb-2 truncate">{fund.managementCompany}</p>
                    </div>
                    <div className="flex gap-2 items-center flex-wrap">
                      <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] px-2 py-1 rounded font-bold whitespace-nowrap overflow-hidden max-w-[120px] text-ellipsis">{fund.category}</span>
                      <span className={`text-[10px] px-2 py-1 rounded font-bold ${isHighRisk ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'}`}>
                        Risk Lv.{riskLevel}
                      </span>
                      {isWatchlisted && (
                        <span className="hidden md:flex items-center text-red-500 bg-red-50 dark:bg-red-900/20 text-[10px] px-2 py-1 rounded font-bold border border-red-100 dark:border-red-900/50">
                          <Heart size={8} fill="currentColor" className="mr-1" /> Watch
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-2 flex justify-between md:block text-center mt-2 md:mt-0">
                    <span className="md:hidden text-slate-400 text-xs font-bold">年間リターン</span>
                    <span className={`text-lg font-black ${fund.returnRate1Y >= 0 ? 'text-red-500' : 'text-blue-500'}`}>{fund.annualReturnDisplay}</span>
                  </div>

                  <div className="col-span-1 hidden md:block text-center text-slate-700 dark:text-slate-300 font-bold text-sm">{fund.trustFeeDisplay}</div>
                  <div className="col-span-1 hidden md:block text-center text-slate-700 dark:text-slate-300 font-bold text-sm">
                    ¥{fund.minInvest?.toLocaleString()}
                  </div>
                  <div className="col-span-1 hidden md:block text-right text-slate-700 dark:text-slate-300 font-bold text-sm whitespace-nowrap">
                    {fund.aumDisplay}
                  </div>

                  <div className="col-span-1 md:col-span-2 flex justify-between md:block text-right mt-2 md:mt-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-50 dark:border-slate-800">
                    <span className="md:hidden text-slate-400 text-xs font-bold self-end">基準価額</span>
                    <div>
                      <div className="font-black text-lg text-slate-900 dark:text-white leading-none">¥{fund.basePrice?.toLocaleString()}</div>
                      <div className={`text-xs font-bold mt-1 ${isPlus ? 'text-red-500' : 'text-blue-500'}`}>
                        {isPlus ? '+' : ''}{fund.prevComparison} ({fund.prevComparisonPercent}%)
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleWatchlist(fund.id)
                      }}
                      className={`hidden md:inline-flex mt-2 items-center gap-1 text-xs px-2 py-1 rounded-full transition z-20 relative ${
                        isWatchlisted ? 'text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Heart size={12} fill={isWatchlisted ? 'currentColor' : 'none'} />
                      {isWatchlisted ? '登録済' : 'ウォッチ'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {sortedFunds.length > 0 && (
            <div className="flex justify-center items-center py-6 border-t border-slate-100 dark:border-slate-800 gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pNum = i + 1
                  if (totalPages > 5 && currentPage > 3) pNum = currentPage - 2 + i
                  if (pNum > totalPages) return null
                  return (
                    <button
                      key={pNum}
                      onClick={() => setCurrentPage(pNum)}
                      className={`w-8 h-8 rounded-lg text-sm font-bold flex items-center justify-center transition ${
                        currentPage === pNum ? 'bg-orange-500 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {pNum}
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>
      )}

      {selectedFundIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-4 animate-slideUp border border-slate-700">
          <span className="font-bold text-sm whitespace-nowrap">{selectedFundIds.length}件 選択中</span>
          <div className="h-4 w-px bg-slate-600" />
          <button onClick={goToComparison} className="flex items-center gap-2 font-bold text-orange-400 hover:text-orange-300 transition whitespace-nowrap">
            <BarChart2 size={18} /> 比較する
          </button>
          <button onClick={() => setSelectedFundIds([])} className="ml-2 p-1 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="text-right mt-4 text-xs text-slate-400">※ データ提供: QUICK | 基準日: 2026.02.02</div>
    </div>
  )
}
