import { useState, useEffect, useMemo } from 'react'
import {
  TrendingUp, Calendar, Newspaper, Activity, Loader2,
  Trophy, ArrowRight, Gift, Building2, Landmark, ChevronRight, Crown,
  Zap, Map, Gauge, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'

import { supabase } from '../lib/supabase'
import { calculateRiskScore } from '../simulators/engine/riskEngine'
import { LEGAL_NOTICE_TEMPLATES } from '../constants/legalNoticeTemplates'

const shortenCategory = (name) => {
  if (!name) return 'その他'
  if (name.includes('米国')) return '米国株'
  if (name.includes('国内') || name.includes('日本')) return '日本株'
  if (name.includes('先進国')) return '先進国'
  if (name.includes('新興国')) return '新興国'
  if (name.includes('全世界')) return '全世界'
  if (name.includes('債券')) return '債券'
  if (name.includes('REIT')) return 'REIT'
  return 'その他'
}

export default function MarketPage() {
  const [topFunds, setTopFunds] = useState([])
  const [inflowFunds, setInflowFunds] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const heatmapData = [
    { name: '半導体', change: 2.5, weight: 3 },
    { name: '自動車', change: 1.8, weight: 2 },
    { name: '銀行', change: 0.9, weight: 2 },
    { name: '商社', change: 1.2, weight: 1 },
    { name: '不動産', change: -0.4, weight: 1 },
    { name: '医薬品', change: -1.2, weight: 1 },
    { name: '通信', change: 0.3, weight: 1 },
    { name: '小売り', change: -0.8, weight: 1 },
    { name: '電力', change: 1.5, weight: 1 },
    { name: '食品', change: -0.2, weight: 1 },
    { name: '鉄鋼', change: 0.5, weight: 1 },
  ]

  const campaigns = [
    {
      id: 1,
      tag: '証券口座',
      title: '新NISA 口座開設',
      desc: '取引手数料 0円！最短翌日から取引可能',
      color: 'from-orange-500 to-red-500',
      icon: <TrendingUp className="text-white opacity-20" size={60} />,
    },
    {
      id: 2,
      tag: '銀行',
      title: '円定期 特別金利',
      desc: '年 0.45% (税引前) 6ヶ月ものキャンペーン',
      color: 'from-emerald-500 to-teal-600',
      icon: <Landmark className="text-white opacity-20" size={60} />,
    },
    {
      id: 3,
      tag: 'ローン',
      title: '住宅ローン借り換え',
      desc: '変動金利 年0.29%〜 保証料0円プラン',
      color: 'from-blue-600 to-indigo-600',
      icon: <Building2 className="text-white opacity-20" size={60} />,
    },
  ]

  const news = [
    { source: 'Reuters', time: '10:30', title: '米ハイテク株が反発、AI需要への期待続く' },
    { source: 'Bloomberg', time: '09:45', title: '日銀、マイナス金利解除後の国債買い入れ額を維持' },
    { source: '日経', time: '08:15', title: '新NISA、成長投資枠の利用額が1兆円突破' },
    { source: 'CNBC', time: '06:00', title: '原油先物、中東情勢の緊迫化で3日続伸' },
  ]

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const { data: fundsData, error } = await supabase
          .from('funds')
          .select('*, fund_prices(return_1y, net_assets, asset_flow_month, price)')
          .limit(100)

        let processed = []
        if (!error && Array.isArray(fundsData) && fundsData.length > 0) {
          processed = fundsData.map((f) => {
            const priceSource = Array.isArray(f.fund_prices) ? f.fund_prices[0] : f.fund_prices
            const priceData = priceSource || {}
            return {
              id: f.quick_code,
              name: f.name,
              category: f.category,
              shortCat: shortenCategory(f.category),
              return1y: Number(priceData.return_1y || 0),
              inflow: Number(priceData.asset_flow_month || 0),
              price: Number(priceData.price || 0),
            }
          })
        } else {
          const { data: quickMaster, error: masterErr } = await supabase
            .from('quick_fund_master')
            .select('quickcode, official_fund_name, fund_short_name, standard_date')
            .order('standard_date', { ascending: false })
            .limit(600)
          if (masterErr) throw masterErr

          const dedupMap = new Map()
          for (const row of quickMaster || []) {
            if (!dedupMap.has(row.quickcode)) dedupMap.set(row.quickcode, row)
          }
          const latestMaster = Array.from(dedupMap.values())
          const quickCodes = latestMaster.map((r) => r.quickcode).slice(0, 200)

          const { data: latestPrice, error: priceErr } = await supabase
            .from('v_quick_fund_latest_price')
            .select('quickcode, price, net_asset_value, touraku_1m_per, touraku_1y_per')
            .in('quickcode', quickCodes)
          if (priceErr) throw priceErr

          const priceMap = new Map((latestPrice || []).map((p) => [p.quickcode, p]))
          processed = latestMaster.map((f) => {
            const p = priceMap.get(f.quickcode) || {}
            const oneMonth = Number(p.touraku_1m_per || 0)
            const aum = Number(p.net_asset_value || 0)
            const simulatedInflow = Math.round((aum / 100) * (oneMonth / 100))
            const name = f.official_fund_name || f.fund_short_name || f.quickcode
            return {
              id: f.quickcode,
              name,
              category: name,
              shortCat: shortenCategory(name),
              return1y: Number(p.touraku_1y_per || 0),
              inflow: simulatedInflow,
              price: Number(p.price || 0),
            }
          })
        }

        setTopFunds([...processed].sort((a, b) => b.return1y - a.return1y).slice(0, 5))
        setInflowFunds([...processed].sort((a, b) => b.inflow - a.inflow).slice(0, 5))
      } catch (err) {
        console.error('Data Fetch Error:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  const marketSentiment = useMemo(() => {
    const heatmapAbsAvg = heatmapData.reduce((acc, cur) => acc + Math.abs(Number(cur.change || 0)), 0) / Math.max(heatmapData.length, 1)
    const heatmapPositiveRatio = heatmapData.filter((item) => Number(item.change || 0) > 0).length / Math.max(heatmapData.length, 1)
    const topFundsAvgReturn = topFunds.reduce((acc, cur) => acc + Number(cur.return1y || 0), 0) / Math.max(topFunds.length, 1)
    const inflowAvg = inflowFunds.reduce((acc, cur) => acc + Number(cur.inflow || 0), 0) / Math.max(inflowFunds.length, 1)

    const risk = calculateRiskScore({
      volatilityRisk: Math.min(100, heatmapAbsAvg * 18),
      breadthRisk: 100 - (heatmapPositiveRatio * 100),
      flowRisk: Math.max(0, 55 - Math.min(100, topFundsAvgReturn * 2)),
      fxRisk: inflowAvg >= 0 ? 40 : 60,
    })

    return {
      score: risk.score,
      status: risk.status,
      desc: risk.desc,
    }
  }, [topFunds, inflowFunds, heatmapData])

  const sentimentSignals = useMemo(() => {
    const heatmapAbsAvg = heatmapData.reduce((acc, cur) => acc + Math.abs(Number(cur.change || 0)), 0) / Math.max(heatmapData.length, 1)
    const heatmapPositiveRatio = heatmapData.filter((item) => Number(item.change || 0) > 0).length / Math.max(heatmapData.length, 1)
    const topFundsAvgReturn = topFunds.reduce((acc, cur) => acc + Number(cur.return1y || 0), 0) / Math.max(topFunds.length, 1)
    const inflowAvg = inflowFunds.reduce((acc, cur) => acc + Number(cur.inflow || 0), 0) / Math.max(inflowFunds.length, 1)

    return [
      {
        label: '業種変動',
        value: `${heatmapAbsAvg.toFixed(1)}%`,
        tone: heatmapAbsAvg >= 1.8 ? 'alert' : 'calm',
      },
      {
        label: '上昇業種比率',
        value: `${Math.round(heatmapPositiveRatio * 100)}%`,
        tone: heatmapPositiveRatio >= 0.5 ? 'calm' : 'alert',
      },
      {
        label: '上位ファンド1Y',
        value: `${topFundsAvgReturn >= 0 ? '+' : ''}${topFundsAvgReturn.toFixed(1)}%`,
        tone: topFundsAvgReturn >= 0 ? 'calm' : 'alert',
      },
      {
        label: '平均資金流入',
        value: `${inflowAvg >= 0 ? '+' : ''}${Math.round(inflowAvg).toLocaleString()}億`,
        tone: inflowAvg >= 0 ? 'calm' : 'alert',
      },
    ]
  }, [topFunds, inflowFunds, heatmapData])

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 animate-fadeIn pb-32 min-h-screen bg-gray-50 dark:bg-slate-900 font-sans transition-colors duration-300">
      {/* 1. Scrolling News Ticker */}
      <div className="bg-slate-900 dark:bg-black text-white rounded-2xl shadow-md mb-6 border border-slate-700 overflow-hidden">
        <div className="py-3 overflow-hidden whitespace-nowrap">
          <div className="inline-flex animate-ticker items-center gap-10 pl-4 pr-16 min-w-max">
            {[...news, ...news, ...news].map((item, i) => (
              <span key={`${item.source}-${i}`} className="flex items-center gap-2 text-xs md:text-sm shrink-0">
                <span className="text-orange-400 font-black">{item.source}</span>
                <span className="text-slate-200 font-bold">{item.title}</span>
                <span className="text-slate-500 font-mono">{item.time}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* 2. Sector Heatmap */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Map className="text-blue-600 dark:text-blue-400" size={20} /> セクターヒートマップ
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  本日の業種別騰落率 (サイズは時価総額)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 grid-rows-3 gap-2 h-[320px]">
              {heatmapData.map((item, idx) => {
                let bgClass = 'bg-gray-100'
                if (item.change >= 2) bgClass = 'bg-red-600'
                else if (item.change >= 1) bgClass = 'bg-red-500'
                else if (item.change >= 0) bgClass = 'bg-red-400'
                else if (item.change >= -1) bgClass = 'bg-emerald-400'
                else if (item.change >= -2) bgClass = 'bg-emerald-500'
                else bgClass = 'bg-emerald-600'

                const spanClass =
                  item.weight === 3
                    ? 'col-span-2 row-span-2'
                    : item.weight === 2
                      ? 'col-span-2 row-span-1'
                      : 'col-span-1 row-span-1'

                return (
                  <div
                    key={idx}
                    className={`${spanClass} ${bgClass} rounded-xl p-4 flex flex-col items-center justify-center text-white transition hover:scale-[1.02] cursor-pointer shadow-sm relative overflow-hidden group`}
                  >
                    <span className="font-bold text-sm md:text-base z-10">{item.name}</span>
                    <span className="font-black text-lg md:text-xl z-10 flex items-center">
                      {item.change > 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                      {Math.abs(item.change)}%
                    </span>
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition" />
                  </div>
                )
              })}
            </div>
          </div>

          {/* AD 1 */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 dark:from-black dark:to-slate-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group cursor-pointer border border-slate-700">
            <div className="relative z-10 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="text-yellow-400" size={20} fill="currentColor" />
                  <span className="text-xs font-bold bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded border border-yellow-500/30">
                    MoneyMart Pro
                  </span>
                </div>
                <h3 className="text-xl font-black mb-1">市場の「先」を読む。</h3>
                <p className="text-sm text-slate-400">機関投資家レベルのデータ分析とAI予測。</p>
              </div>
              <div className="bg-white text-slate-900 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-100 transition shadow-lg shrink-0">
                詳細を見る
              </div>
            </div>
            <div className="absolute -right-10 -bottom-20 w-48 h-48 bg-yellow-500/10 rounded-full blur-3xl group-hover:bg-yellow-500/20 transition duration-700" />
          </div>

          {/* 3. Ranking Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                <Trophy size={18} className="text-yellow-500" />
                <h3 className="font-bold text-slate-800 dark:text-white text-sm">リターンランキング (1年)</h3>
              </div>
              {isLoading ? (
                <div className="py-10 flex items-center justify-center text-slate-400">
                  <Loader2 size={18} className="animate-spin mr-2" /> 読み込み中...
                </div>
              ) : (
                <div className="space-y-3">
                  {topFunds.map((fund, i) => (
                    <div key={fund.id || i} className="flex items-center justify-between group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 p-2 -mx-2 rounded-lg transition">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold shrink-0 ${i < 3 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>{i + 1}</span>
                        <div className="truncate">
                          <div className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{fund.name}</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">{fund.shortCat}</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-black text-red-500 dark:text-red-400">
                          +{fund.return1y.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                <TrendingUp size={18} className="text-emerald-500" />
                <h3 className="font-bold text-slate-800 dark:text-white text-sm">資金流入ランキング (月間)</h3>
              </div>
              {isLoading ? (
                <div className="py-10 flex items-center justify-center text-slate-400">
                  <Loader2 size={18} className="animate-spin mr-2" /> 読み込み中...
                </div>
              ) : (
                <div className="space-y-3">
                  {inflowFunds.map((fund, i) => (
                    <div key={fund.id || i} className="flex items-center justify-between group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 p-2 -mx-2 rounded-lg transition">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold shrink-0 ${i < 3 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>{i + 1}</span>
                        <div className="truncate">
                          <div className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{fund.name}</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">{fund.shortCat}</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                          +{fund.inflow.toLocaleString()}億
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
              <Gauge size={18} className="text-orange-500" />
              <h3 className="font-bold text-slate-800 dark:text-white text-sm">AI 市場センチメント</h3>
            </div>
            <div className="flex flex-col items-center">
              <div className="relative w-full h-4 bg-slate-100 dark:bg-slate-700 rounded-full mb-3">
                <div className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-blue-400 via-yellow-400 to-red-500" style={{ width: `${marketSentiment.score}%` }} />
              </div>
              <div className="flex justify-between w-full text-[10px] font-bold text-slate-400 mb-2">
                <span>Risk Off (悲観)</span>
                <span>Risk On (楽観)</span>
              </div>
              <div className="text-center">
                <span className="text-3xl font-black text-slate-900 dark:text-white">{marketSentiment.score}</span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">/100</span>
                <div className="text-sm font-bold text-orange-600 mt-1">{marketSentiment.status}</div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 bg-slate-50 dark:bg-slate-700/50 p-2 rounded leading-relaxed">
                {marketSentiment.desc}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 w-full">
                {sentimentSignals.map((signal) => (
                  <div
                    key={signal.label}
                    className={`rounded-lg border px-2.5 py-2 text-left ${
                      signal.tone === 'calm'
                        ? 'border-emerald-200 bg-emerald-50/80 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-300'
                        : 'border-amber-200 bg-amber-50/80 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-300'
                    }`}
                  >
                    <p className="text-[10px] font-bold opacity-80">{signal.label}</p>
                    <p className="text-xs font-black mt-0.5">{signal.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
              <Calendar size={18} className="text-slate-500 dark:text-slate-400" />
              <h3 className="font-bold text-slate-800 dark:text-white text-sm">今週の経済指標</h3>
            </div>
            <div className="relative border-l-2 border-slate-100 dark:border-slate-700 ml-2 space-y-6 pl-4 py-2">
              <div className="relative">
                <div className="absolute -left-[21px] top-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white dark:border-slate-800" />
                <div className="text-[10px] font-bold text-slate-400 mb-1">2/12 (水)</div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">🇺🇸 消費者物価指数 (CPI)</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 bg-slate-50 dark:bg-slate-700 p-1.5 rounded">
                  注目度: <span className="text-orange-500">★★★★★</span>
                </div>
              </div>
              <div className="relative">
                <div className="absolute -left-[21px] top-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-800" />
                <div className="text-[10px] font-bold text-slate-400 mb-1">2/15 (土)</div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">🇯🇵 GDP 速報値</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
              <Newspaper size={18} className="text-slate-500 dark:text-slate-400" />
              <h3 className="font-bold text-slate-800 dark:text-white text-sm">マーケット速報</h3>
            </div>
            <div className="space-y-4">
              {news.map((item, i) => (
                <div key={i} className="group cursor-pointer">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                    <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded font-bold text-slate-500 dark:text-slate-300">{item.source}</span>
                    <span>{item.time}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-relaxed group-hover:text-blue-600 dark:group-hover:text-blue-400 transition line-clamp-2">
                    {item.title}
                  </p>
                </div>
              ))}
            </div>
            <button className="w-full mt-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center justify-center gap-1">
              ニュースをもっと見る <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* AD 2 */}
      <div className="mt-12">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2 px-2">
          <Gift className="text-orange-500" /> キャンペーン・ピックアップ
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {campaigns.map((ad) => (
            <div
              key={ad.id}
              className="bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-xl transition-all duration-300 group cursor-pointer hover:-translate-y-1 relative h-48"
              onClick={() => alert('キャンペーン詳細へ移動します')}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${ad.color} opacity-90 p-6 flex flex-col justify-between text-white`}>
                <div>
                  <span className="text-[10px] font-black bg-white/20 px-2 py-1 rounded inline-block mb-3 border border-white/20">
                    {ad.tag}
                  </span>
                  <h3 className="text-2xl font-black leading-tight mb-2 drop-shadow-md">{ad.title}</h3>
                  <p className="text-xs font-bold opacity-90">{ad.desc}</p>
                </div>
                <div className="flex justify-end">
                  <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm group-hover:bg-white group-hover:text-orange-600 transition">
                    <ChevronRight size={20} />
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-6 -right-6 transform rotate-12 scale-110 group-hover:scale-125 transition duration-500">
                {ad.icon}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-5 leading-relaxed">
        {LEGAL_NOTICE_TEMPLATES.investment}
      </p>
    </div>
  )
}
