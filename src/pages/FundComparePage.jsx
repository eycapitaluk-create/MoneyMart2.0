import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Plus, Shield, TrendingUp, AlertCircle, Award
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts'

const ALL_FUNDS = [
  {
    id: 1,
    name: 'eMAXIS Slim 全世界株式 (オール・カントリー)',
    color: '#2563EB',
    price: 24580,
    return1y: 24.5,
    fee: 0.057,
    risk: 4,
    sharpe: 1.2,
    assets: '2.8兆円',
    radar: { return: 80, stability: 60, cost: 95, popularity: 90, dividend: 20 },
  },
  {
    id: 2,
    name: 'eMAXIS Slim 米国株式 (S&P500)',
    color: '#F97316',
    price: 28900,
    return1y: 28.3,
    fee: 0.093,
    risk: 5,
    sharpe: 1.4,
    assets: '1.5兆円',
    radar: { return: 95, stability: 50, cost: 90, popularity: 85, dividend: 10 },
  },
  {
    id: 3,
    name: 'アライアンス・バーンスタイン・米国成長株投信Ｄ',
    color: '#8B5CF6',
    price: 32500,
    return1y: 32.1,
    fee: 1.727,
    risk: 5,
    sharpe: 1.3,
    assets: '8000億円',
    radar: { return: 98, stability: 45, cost: 25, popularity: 75, dividend: 85 },
  },
  {
    id: 4,
    name: 'ひふみプラス',
    color: '#10B981',
    price: 54000,
    return1y: 15.4,
    fee: 1.078,
    risk: 3,
    sharpe: 0.9,
    assets: '5000億円',
    radar: { return: 50, stability: 80, cost: 40, popularity: 70, dividend: 30 },
  },
  {
    id: 5,
    name: 'ピクテ・グローバル・インカム株式ファンド',
    color: '#F59E0B',
    price: 18200,
    return1y: 8.2,
    fee: 1.815,
    risk: 3,
    sharpe: 0.7,
    assets: '3000億円',
    radar: { return: 30, stability: 85, cost: 20, popularity: 55, dividend: 95 },
  },
]

const CHART_DATA = [
  { month: '1月', f1: 100, f2: 100, f3: 100, f4: 100, f5: 100 },
  { month: '2月', f1: 102, f2: 103, f3: 105, f4: 101, f5: 101 },
  { month: '3月', f1: 105, f2: 108, f3: 112, f4: 102, f5: 102 },
  { month: '4月', f1: 104, f2: 106, f3: 110, f4: 103, f5: 103 },
  { month: '5月', f1: 108, f2: 112, f3: 118, f4: 104, f5: 102 },
  { month: '6月', f1: 112, f2: 118, f3: 125, f4: 106, f5: 105 },
]

// FundPage 문자열 ID → ALL_FUNDS 숫자 ID 매핑
const STRING_ID_MAP = { 'emaxis-all': 1, 'emaxis-sp500': 2, 'alliance-ab': 3, 'himuchi-plus': 4, 'pictet-income': 5, 'maxis-nikkei': 2, 'nikko-emerging': 1, 'daiwa-reit': 4, 'muji-balance': 5, 'raku-eco': 1 }

export default function FundComparePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const idsParam = searchParams.get('ids')
  const rawIds = idsParam ? idsParam.split(',').map((s) => s.trim()).filter(Boolean) : []
  const selectedIds = rawIds
    .map((v) => (isNaN(Number(v)) ? STRING_ID_MAP[v] : Number(v)))
    .filter((id) => id >= 1 && id <= 5)
  const uniqueIds = [...new Set(selectedIds)]
  const FUNDS_TO_COMPARE = uniqueIds.length >= 2
    ? uniqueIds.map((id) => ALL_FUNDS.find((f) => f.id === id)).filter(Boolean)
    : ALL_FUNDS.slice(0, 3)

  const maxReturn = Math.max(...FUNDS_TO_COMPARE.map((f) => f.return1y))
  const minFee = Math.min(...FUNDS_TO_COMPARE.map((f) => f.fee))

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 font-sans">
      {/* 1. ヘッダー */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition">
              <ArrowLeft className="text-slate-600 dark:text-slate-400" size={24} />
            </button>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">ファンド比較分析</h1>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-orange-500 text-white rounded-lg font-bold text-sm shadow-md hover:opacity-90 transition">
            <Plus size={16} /> ファンドを追加
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* 2. レーダーチャート & 収益率チャート */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ファンド性格診断 (レーダーチャート) */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="text-purple-500" /> ファンド性格診断
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart
                  outerRadius={90}
                  data={[
                    { subject: '収益性', ...Object.fromEntries(FUNDS_TO_COMPARE.map((f, i) => [String.fromCharCode(65 + i), f.radar.return])), fullMark: 100 },
                    { subject: '安定性', ...Object.fromEntries(FUNDS_TO_COMPARE.map((f, i) => [String.fromCharCode(65 + i), f.radar.stability])), fullMark: 100 },
                    { subject: 'コスト', ...Object.fromEntries(FUNDS_TO_COMPARE.map((f, i) => [String.fromCharCode(65 + i), f.radar.cost])), fullMark: 100 },
                    { subject: '人気度', ...Object.fromEntries(FUNDS_TO_COMPARE.map((f, i) => [String.fromCharCode(65 + i), f.radar.popularity])), fullMark: 100 },
                    { subject: '配当金', ...Object.fromEntries(FUNDS_TO_COMPARE.map((f, i) => [String.fromCharCode(65 + i), f.radar.dividend])), fullMark: 100 },
                  ]}
                >
                  <PolarGrid stroke="#e2e8f0" className="dark:stroke-slate-700" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 'bold' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  {FUNDS_TO_COMPARE.map((fund, idx) => (
                    <Radar
                      key={fund.id}
                      name={fund.name}
                      dataKey={String.fromCharCode(65 + idx)}
                      stroke={fund.color}
                      strokeWidth={3}
                      fill={fund.color}
                      fillOpacity={0.2}
                    />
                  ))}
                  <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 収益率シミュレーション */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="text-red-500" /> 収益率シミュレーション (6ヶ月)
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={CHART_DATA}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-700" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={['auto', 'auto']} hide />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                  {FUNDS_TO_COMPARE.map((fund, idx) => (
                    <Line
                      key={fund.id}
                      type="monotone"
                      dataKey={`f${idx + 1}`}
                      name={fund.name}
                      stroke={fund.color}
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 3. 詳細比較テーブル */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <th className="p-4 min-w-[150px] sticky left-0 bg-slate-50 dark:bg-slate-800 z-10">比較項目</th>
                  {FUNDS_TO_COMPARE.map((fund) => (
                    <th key={fund.id} className="p-4 min-w-[200px]">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: fund.color }} />
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">ID: {fund.id}</span>
                      </div>
                      <div className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                        {fund.name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                  <td className="p-4 font-bold text-slate-500 sticky left-0 bg-white dark:bg-slate-900 z-10 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)]">直近リターン(1年)</td>
                  {FUNDS_TO_COMPARE.map((fund) => (
                    <td key={fund.id} className="p-4">
                      <span className={`text-lg font-black ${fund.return1y === maxReturn ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
                        +{fund.return1y}%
                      </span>
                      {fund.return1y === maxReturn && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">最高</span>}
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                  <td className="p-4 font-bold text-slate-500 sticky left-0 bg-white dark:bg-slate-900 z-10 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)]">信託報酬 (コスト)</td>
                  {FUNDS_TO_COMPARE.map((fund) => (
                    <td key={fund.id} className="p-4">
                      <span className={`text-base font-bold ${fund.fee === minFee ? 'text-green-500' : 'text-slate-700 dark:text-slate-300'}`}>
                        {fund.fee}%
                      </span>
                      {fund.fee === minFee && <span className="ml-2 text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded font-bold">最安</span>}
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                  <td className="p-4 font-bold text-slate-500 sticky left-0 bg-white dark:bg-slate-900 z-10 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)] flex items-center gap-1">
                    シャープレシオ
                    <AlertCircle size={12} className="text-slate-300" />
                  </td>
                  {FUNDS_TO_COMPARE.map((fund) => (
                    <td key={fund.id} className="p-4 font-medium text-slate-700 dark:text-slate-300">
                      {fund.sharpe}
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                  <td className="p-4 font-bold text-slate-500 sticky left-0 bg-white dark:bg-slate-900 z-10 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)]">純資産総額</td>
                  {FUNDS_TO_COMPARE.map((fund) => (
                    <td key={fund.id} className="p-4 font-medium text-slate-700 dark:text-slate-300">
                      {fund.assets}
                    </td>
                  ))}
                </tr>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  <td className="p-4 sticky left-0 bg-slate-50 dark:bg-slate-800/50 z-10" />
                  {FUNDS_TO_COMPARE.map((fund) => (
                    <td key={fund.id} className="p-4">
                      <button
                        onClick={() => navigate(`/funds/${fund.id}`)}
                        className="w-full py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl font-bold text-slate-700 dark:text-white hover:bg-orange-500 hover:text-white hover:border-orange-500 transition shadow-sm"
                      >
                        選択する
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* AIアドバイス */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white flex items-start gap-4 shadow-lg">
          <div className="p-3 bg-white/20 rounded-full">
            <Award size={24} className="text-yellow-300" />
          </div>
          <div>
            <h3 className="font-bold text-lg mb-1">AIのアドバイス</h3>
            <p className="text-blue-100 text-sm leading-relaxed">
              長期的な資産形成を目指すなら、コストが最も低く、分散投資効果が高い <strong className="text-white underline">eMAXIS Slim 全世界株式</strong> が推奨されます。一方、短期的なリターンを狙う場合はS&P500が有利です。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
