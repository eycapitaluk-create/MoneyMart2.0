import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Heart, Check, Globe, DollarSign, Flag, Loader2, ArrowUpDown, ArrowUp, ArrowDown, BarChart2, X } from 'lucide-react'
import {
  ScatterChart,
  Scatter,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ZAxis,
  Bar,
  ReferenceLine,
} from 'recharts'

import { supabase } from '../lib/supabase'
import { calculateRiskScore } from '../simulators/engine/riskEngine'
import { LEGAL_NOTICE_TEMPLATES } from '../constants/legalNoticeTemplates'
import AdBanner from '../components/AdBanner'
import AdSidebar from '../components/AdSidebar'

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
  const [selectedFundIds, setSelectedFundIds] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [fundDataSource, setFundDataSource] = useState('fallback')
  const [watchlist, setWatchlist] = useState(() => (Array.isArray(myWatchlist) ? myWatchlist : []))
  const [currentPage, setCurrentPage] = useState(1)
  const [sortConfig, setSortConfig] = useState({ key: 'returnRate1Y', direction: 'descending' })
  const [selectedFlowCategory, setSelectedFlowCategory] = useState('')
  const [hoveredBubbleId, setHoveredBubbleId] = useState(null)

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

        let formattedFunds = []
        let nextSource = 'fallback'
        if (!fundsError && Array.isArray(fundsData) && fundsData.length > 0) {
          nextSource = 'live'
          formattedFunds = fundsData.map((item) => {
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
        } else {
          const { data: quickMaster, error: quickMasterErr } = await supabase
            .from('quick_fund_master')
            .select('quickcode, isin_code, fund_short_name, official_fund_name, net_trustfee, min_investment, standard_date')
            .order('standard_date', { ascending: false })
            .limit(600)
          if (quickMasterErr) throw quickMasterErr

          const dedupMap = new Map()
          for (const row of quickMaster || []) {
            if (!dedupMap.has(row.quickcode)) dedupMap.set(row.quickcode, row)
          }
          const latestMaster = Array.from(dedupMap.values())
          const quickCodes = latestMaster.map((r) => r.quickcode).slice(0, 200)

          const { data: quickPrice, error: quickPriceErr } = await supabase
            .from('v_quick_fund_latest_price')
            .select('quickcode, price, net_asset_value, touraku_1d_per, touraku_1y_per')
            .in('quickcode', quickCodes)
          if (quickPriceErr) throw quickPriceErr

          const priceMap = new Map((quickPrice || []).map((p) => [p.quickcode, p]))
          nextSource = 'quick'
          formattedFunds = latestMaster.map((item) => {
            const priceData = priceMap.get(item.quickcode) || {}
            const basePrice = Number(priceData.price || 10000)
            const return1d = Number(priceData.touraku_1d_per || 0)
            const returnRate = Number(priceData.touraku_1y_per || 0)
            const rawAum = Number(priceData.net_asset_value || 0)
            const displayName = item.official_fund_name || item.fund_short_name || item.quickcode
            const displayCategory = detectCategory('', displayName)
            const riskLvl = calculateRiskFromReturn(returnRate, displayCategory)
            const stdDev = estimateStdDev(riskLvl)
            const prevPrice = basePrice / (1 + return1d / 100)

            return {
              id: item.quickcode,
              fundName: displayName,
              fundCode: item.isin_code || '-',
              category: displayCategory,
              managementCompany: 'QUICK',
              trustFee: Number(item.net_trustfee || 0),
              trustFeeDisplay: item.net_trustfee ? `${Number(item.net_trustfee).toFixed(2)}%` : '-',
              returnRate1Y: Number(returnRate),
              aumValue: rawAum,
              annualReturnDisplay: `${returnRate > 0 ? '+' : ''}${Number(returnRate).toFixed(1)}%`,
              aumDisplay: formatOku(rawAum),
              riskLevel: riskLvl,
              stdDev,
              basePrice,
              prevComparison: Math.round(basePrice - prevPrice),
              prevComparisonPercent: Number(return1d).toFixed(2),
              minInvest: Number(item.min_investment || 100),
              sharpe: stdDev > 0 ? Number((Number(returnRate) / stdDev).toFixed(2)) : 0,
            }
          })
        }

        const funds = formattedFunds.length > 0 ? formattedFunds : FALLBACK_FUNDS
        if (formattedFunds.length === 0) nextSource = 'fallback'
        setDbFunds([...funds].sort((a, b) => b.returnRate1Y - a.returnRate1Y))
        setFundDataSource(nextSource)
      } catch (error) {
        console.error('Error fetching data:', error.message)
        setDbFunds(FALLBACK_FUNDS)
        setFundDataSource('fallback')
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
    const overallAvg = dbFunds.reduce((acc, cur) => acc + cur.returnRate1Y, 0) / Math.max(dbFunds.length, 1)
    return Object.entries(map)
      .map(([name, stats]) => ({
        name,
        // Mock-style relative flow so plus/minus both appear clearly.
        flow: Math.round(((stats.sum / Math.max(stats.count, 1)) - overallAvg) * 20),
      }))
      .sort((a, b) => Math.abs(b.flow) - Math.abs(a.flow))
      .slice(0, 5)
  }, [dbFunds])

  const divergingFlowData = useMemo(() => (
    categoryFlowSnapshot.map((item) => ({
      ...item,
      // Recharts draws negative values to the left of zero.
      // To match requested layout (left:+, right:-), invert display direction.
      displayFlow: -item.flow,
    }))
  ), [categoryFlowSnapshot])

  const selectedFlowLeaders = useMemo(() => {
    const sourceCategory = selectedFlowCategory || categoryFlowSnapshot[0]?.name || ''
    if (!sourceCategory) return { category: '', top3: [], bottom3: [] }
    const scoped = dbFunds
      .filter((f) => f.category === sourceCategory)
      .sort((a, b) => b.returnRate1Y - a.returnRate1Y)
    return {
      category: sourceCategory,
      top3: scoped.slice(0, 3),
      bottom3: [...scoped].reverse().slice(0, 3),
    }
  }, [dbFunds, selectedFlowCategory, categoryFlowSnapshot])

  const flowRiskSummary = useMemo(() => {
    const flows = categoryFlowSnapshot.map((c) => Number(c.flow || 0))
    const avg = flows.reduce((acc, cur) => acc + cur, 0) / Math.max(flows.length, 1)
    const variance = flows.reduce((acc, cur) => acc + (cur - avg) ** 2, 0) / Math.max(flows.length, 1)
    const stdev = Math.sqrt(variance)
    const positiveRatio = flows.filter((v) => v > 0).length / Math.max(flows.length, 1)
    return calculateRiskScore({
      volatilityRisk: Math.min(100, stdev * 1.8),
      breadthRisk: 100 - (positiveRatio * 100),
      flowRisk: Math.min(100, Math.abs(avg) * 2),
      fxRisk: 45,
    })
  }, [categoryFlowSnapshot])

  useEffect(() => {
    if (!selectedFlowCategory && categoryFlowSnapshot.length > 0) {
      setSelectedFlowCategory(categoryFlowSnapshot[0].name)
    }
  }, [categoryFlowSnapshot, selectedFlowCategory])

  const mapData = useMemo(() => {
    const base = dbFunds.slice(0, 30)
    return base.map((f) => {
      const isWatchlisted = Array.isArray(effectiveWatchlist) && effectiveWatchlist.includes(f.id)
      return {
        id: f.id,
        x: Number(f.stdDev),
        y: Number(f.returnRate1Y),
        z: Math.max(250, Math.sqrt(f.aumValue || 1) * 2.8),
        name: f.fundName,
        category: f.category,
        aumDisplay: f.aumDisplay,
        isWatchlisted,
      }
    })
  }, [dbFunds, effectiveWatchlist])

  const requestSort = (key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'descending' ? 'ascending' : 'descending'
    setSortConfig({ key, direction })
  }
  const toggleCompareFund = (fundId) => {
    setSelectedFundIds((prev) => {
      if (prev.includes(fundId)) return prev.filter((id) => id !== fundId)
      if (prev.length >= 3) {
        alert('比較は最大3件まで選択できます。')
        return prev
      }
      return [...prev, fundId]
    })
  }
  const goToComparison = () => {
    if (selectedFundIds.length < 2) {
      alert('比較するには2つのファンドを選択してください。')
      return
    }
    navigate(`/funds/compare?ids=${selectedFundIds.join(',')}`)
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
      <div className="hidden 2xl:block fixed right-6 top-28 w-64 z-20">
        <AdSidebar />
      </div>
      <div className="mb-6">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">ファンド・インテリジェンス</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">資金フロー・リスク・一覧を一画面で確認</p>
        <p className={`text-xs font-bold mt-2 ${
          fundDataSource === 'fallback'
            ? 'text-amber-600 dark:text-amber-300'
            : 'text-emerald-600 dark:text-emerald-300'
        }`}>
          Data: {fundDataSource === 'live' ? 'LIVE' : fundDataSource === 'quick' ? 'QUICK' : 'FALLBACK'}
        </p>
      </div>
      <div className="mb-5 2xl:hidden">
        <AdBanner variant="horizontal" />
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">カテゴリ資金フロー（上位概念）</h2>
            <div className="text-right">
              <p className="text-xs text-slate-500 dark:text-slate-400">中央軸: 左がプラス / 右がマイナス</p>
              <p className="text-[11px] font-bold text-orange-600 dark:text-orange-300">
                Flow Risk: {flowRiskSummary.score}/100 ({flowRiskSummary.status})
              </p>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={divergingFlowData}
                layout="vertical"
                margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(v, key, payload) => {
                    if (key === 'displayFlow') {
                      const original = payload?.payload?.flow ?? 0
                      return [`${original > 0 ? '+' : ''}${original}億`, 'カテゴリフロー']
                    }
                    return [v, key]
                  }}
                />
                <ReferenceLine x={0} stroke="#94a3b8" />
                <Bar
                  dataKey="displayFlow"
                  name="カテゴリフロー"
                  barSize={20}
                  onClick={(entry) => setSelectedFlowCategory(entry?.payload?.name || entry?.name || '')}
                >
                  {divergingFlowData.map((entry, i) => (
                    <Cell
                      key={`flow-${i}`}
                      fill={entry.flow >= 0 ? '#3b82f6' : '#ef4444'}
                      fillOpacity={selectedFlowCategory === entry.name ? 1 : 0.75}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-900/10 p-3">
              <p className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-2">
                {selectedFlowLeaders.category || '-'} Top 3
              </p>
              <div className="space-y-1.5">
                {selectedFlowLeaders.top3.map((fund, idx) => (
                  <button
                    key={`${fund.id}-top`}
                    onClick={() => navigate(`/funds/${fund.id}`)}
                    className="w-full text-left flex items-center justify-between gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-300"
                  >
                    <span className="truncate">{idx + 1}. {fund.fundName}</span>
                    <span className="shrink-0 font-bold text-blue-600 dark:text-blue-300">+{Number(fund.returnRate1Y || 0).toFixed(1)}%</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-rose-100 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-900/10 p-3">
              <p className="text-xs font-bold text-rose-700 dark:text-rose-300 mb-2">
                {selectedFlowLeaders.category || '-'} Bottom 3
              </p>
              <div className="space-y-1.5">
                {selectedFlowLeaders.bottom3.map((fund, idx) => (
                  <button
                    key={`${fund.id}-bottom`}
                    onClick={() => navigate(`/funds/${fund.id}`)}
                    className="w-full text-left flex items-center justify-between gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-300"
                  >
                    <span className="truncate">{idx + 1}. {fund.fundName}</span>
                    <span className="shrink-0 font-bold text-rose-600 dark:text-rose-300">{Number(fund.returnRate1Y || 0).toFixed(1)}%</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mb-4">リスク・リターン バブルチャート</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis type="number" dataKey="x" name="ボラティリティ" unit="%" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis type="number" dataKey="y" name="1年リターン" unit="%" tick={{ fontSize: 11, fill: '#64748b' }} />
                <ZAxis type="number" dataKey="z" range={[120, 1100]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null
                    const d = payload[0].payload
                    return (
                      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-xs shadow-lg">
                        <p className="font-bold text-slate-900 dark:text-white mb-1">{d.name}</p>
                        <p className="text-slate-500 dark:text-slate-300">リターン: {fmtPct(d.y)}</p>
                        <p className="text-slate-500 dark:text-slate-300">ボラティリティ: {d.x}%</p>
                        <p className="text-slate-500 dark:text-slate-300">純資産(AUM): {d.aumDisplay}</p>
                        {d.isWatchlisted && <p className="text-[11px] font-bold text-red-500 mt-1">ウォッチ中</p>}
                      </div>
                    )
                  }}
                />
                <Scatter data={mapData} onClick={(entry) => navigate(`/funds/${entry.id}`)}>
                  {mapData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.id === hoveredBubbleId
                          ? '#3b82f6'
                          : (entry.isWatchlisted ? '#ef4444' : '#94a3b8')
                      }
                      fillOpacity={
                        entry.id === hoveredBubbleId
                          ? 0.95
                          : (entry.isWatchlisted ? 0.85 : 0.45)
                      }
                      stroke={
                        entry.id === hoveredBubbleId
                          ? '#1d4ed8'
                          : (entry.isWatchlisted ? '#dc2626' : '#64748b')
                      }
                      strokeWidth={entry.id === hoveredBubbleId ? 2 : 1}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredBubbleId(entry.id)}
                      onMouseLeave={() => setHoveredBubbleId(null)}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">ファンド一覧</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 dark:text-slate-400">件数 {sortedFunds.length}</span>
            <button
              onClick={goToComparison}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-orange-500 text-white hover:bg-orange-400 transition"
            >
              <BarChart2 size={14} /> 比較する ({selectedFundIds.length}/3)
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-300 text-xs">
              <tr>
                <th className="px-4 py-3 text-center">比較</th>
                <th className="px-4 py-3 text-left">順位</th>
                <th className="px-4 py-3 text-left cursor-pointer" onClick={() => requestSort('fundName')}>ファンド <SortIcon colKey="fundName" /></th>
                <th className="px-4 py-3 text-right cursor-pointer" onClick={() => requestSort('trustFee')}>信託報酬 <SortIcon colKey="trustFee" /></th>
                <th className="px-4 py-3 text-right cursor-pointer" onClick={() => requestSort('stdDev')}>ボラティリティ <SortIcon colKey="stdDev" /></th>
                <th className="px-4 py-3 text-right cursor-pointer" onClick={() => requestSort('sharpe')}>シャープレシオ <SortIcon colKey="sharpe" /></th>
                <th className="px-4 py-3 text-right cursor-pointer" onClick={() => requestSort('aumValue')}>純資産(AUM) <SortIcon colKey="aumValue" /></th>
                <th className="px-4 py-3 text-right cursor-pointer" onClick={() => requestSort('returnRate1Y')}>1年リターン <SortIcon colKey="returnRate1Y" /></th>
                <th className="px-4 py-3 text-right">評価</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((fund, idx) => {
                const isWatchlisted = Array.isArray(effectiveWatchlist) && effectiveWatchlist.includes(fund.id)
                const isCompared = selectedFundIds.includes(fund.id)
                return (
                  <tr
                    key={fund.id}
                    className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                    onClick={() => navigate(`/funds/${fund.id}`)}
                  >
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleCompareFund(fund.id)
                        }}
                        className={`w-5 h-5 rounded border inline-flex items-center justify-center ${
                          isCompared ? 'bg-orange-500 border-orange-500 text-white' : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isCompared ? <Check size={12} /> : null}
                      </button>
                    </td>
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
                            toggleWatchlist(fund.id, {
                              name: fund.fundName,
                              change: fund.returnRate1Y,
                            })
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
            前へ
          </button>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-300">{currentPage} / {totalPages}</span>
          <button
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
          >
            次へ
          </button>
        </div>
      </div>

      {selectedFundIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2.5 rounded-full shadow-2xl z-50 flex items-center gap-3 border border-slate-700">
          <span className="text-xs font-bold">{selectedFundIds.length}件選択中</span>
          <button onClick={goToComparison} className="text-xs font-bold text-orange-300 hover:text-orange-200 inline-flex items-center gap-1">
            <BarChart2 size={14} /> 比較する
          </button>
          <button onClick={() => setSelectedFundIds([])} className="text-slate-300 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="text-right mt-4 text-xs text-slate-400">※ データ提供: QUICK | 基準日: 2026.02.02</div>
      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
        {LEGAL_NOTICE_TEMPLATES.investment}
      </p>
    </div>
  )
}
