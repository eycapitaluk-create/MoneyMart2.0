import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Download, Share2, Star,
  TrendingUp, PieChart, Calendar, DollarSign
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, Legend
} from 'recharts'

const FUND_DETAILS = {
  'emaxis-all': {
    id: 'emaxis-all',
    name: 'eMAXIS Slim 全世界株式 (オール・カントリー)',
    provider: '三菱UFJ国際投信',
    price: 24580,
    change: '+125',
    changePercent: '+0.51%',
    assets: '2兆8000億円',
    fee: '0.05775%',
    risk: 4,
    category: '全世界株式',
    description: '日本を含む先進国および新興国の株式等に投資し、MSCIオール・カントリー・ワールド・インデックス(配当込み、円換算ベース)に連動する投資成果をめざします。',
    portfolio: [
      { name: '米国', value: 62 },
      { name: '日本', value: 5.5 },
      { name: '英国', value: 3.5 },
      { name: 'その他先進国', value: 18 },
      { name: '新興国', value: 11 },
    ],
  },
  'emaxis-sp500': {
    id: 'emaxis-sp500',
    name: 'eMAXIS Slim 米国株式 (S&P500)',
    provider: '三菱UFJ国際投信',
    price: 28900,
    change: '+168',
    changePercent: '+0.58%',
    assets: '1兆5000億円',
    fee: '0.09372%',
    risk: 5,
    category: '米国株式',
    description: '米国の大型株を中心とした指数連動を目指す低コストファンド。',
    portfolio: [
      { name: '米国', value: 96 },
      { name: '現金等', value: 4 },
    ],
  },
  'alliance-ab': {
    id: 'alliance-ab',
    name: 'アライアンス・バーンスタイン・米国成長株投信Ｄ',
    provider: 'アライアンス・バーンスタイン',
    price: 32500,
    change: '+205',
    changePercent: '+0.63%',
    assets: '8000億円',
    fee: '1.727%',
    risk: 5,
    category: '米国株式',
    description: '米国成長株への集中投資により高い資本成長を目指します。',
    portfolio: [
      { name: '米国', value: 94 },
      { name: '欧州', value: 3 },
      { name: 'その他', value: 3 },
    ],
  },
  'himuchi-plus': {
    id: 'himuchi-plus',
    name: 'ひふみプラス',
    provider: 'レオス・キャピタルワークス',
    price: 54000,
    change: '-95',
    changePercent: '-0.18%',
    assets: '5000億円',
    fee: '1.078%',
    risk: 3,
    category: '国内株式',
    description: '日本株中心のアクティブ運用で中長期の成長を目指します。',
    portfolio: [
      { name: '日本', value: 82 },
      { name: '現金等', value: 10 },
      { name: '海外', value: 8 },
    ],
  },
  'pictet-income': {
    id: 'pictet-income',
    name: 'ピクテ・グローバル・インカム株式ファンド',
    provider: 'ピクテ投信',
    price: 18200,
    change: '+32',
    changePercent: '+0.18%',
    assets: '3000億円',
    fee: '1.815%',
    risk: 3,
    category: '全世界株式',
    description: '世界の高配当株へ分散投資し、インカム収益を重視するファンド。',
    portfolio: [
      { name: '米国', value: 41 },
      { name: '欧州', value: 34 },
      { name: 'アジア', value: 17 },
      { name: 'その他', value: 8 },
    ],
  },
}

const FUND_ID_ALIAS = {
  '1': 'emaxis-all',
  '2': 'emaxis-sp500',
  '3': 'alliance-ab',
  '4': 'himuchi-plus',
  '5': 'pictet-income',
  'maxis-nikkei': 'emaxis-sp500',
  'nikko-emerging': 'emaxis-all',
  'daiwa-reit': 'himuchi-plus',
  'muji-balance': 'pictet-income',
  'raku-eco': 'emaxis-all',
}

const CHART_DATA_1Y = [
  { date: '2023-01', value: 10000 },
  { date: '2023-03', value: 10500 },
  { date: '2023-05', value: 11200 },
  { date: '2023-07', value: 11800 },
  { date: '2023-09', value: 11500 },
  { date: '2023-11', value: 12100 },
  { date: '2024-01', value: 12450 },
]

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6']

export default function FundDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [amount, setAmount] = useState(10000)
  const [period, setPeriod] = useState(10)
  const fundId = FUND_ID_ALIAS[id] || id || 'emaxis-all'
  const selectedFund = useMemo(() => FUND_DETAILS[fundId] || FUND_DETAILS['emaxis-all'], [fundId])

  const futureValue = Math.floor(amount * Math.pow(1.07, period))
  const profit = futureValue - amount

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 font-sans">
      {/* 1. 上部ナビゲーション */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-16 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
            <ArrowLeft className="text-slate-600 dark:text-slate-400" size={24} />
          </button>
          <div className="flex gap-2">
            <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-500 transition">
              <Share2 size={20} />
            </button>
            <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-yellow-500 transition">
              <Star size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 2. ファンド基本情報カード */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800 mb-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-bold mb-3">
                {selectedFund.category}
              </span>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-tight mb-2">
                {selectedFund.name}
              </h1>
              <p className="text-slate-500 font-medium">{selectedFund.provider}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-400 font-bold mb-1">基準価額 (昨日比)</p>
              <div className="flex items-end justify-end gap-3">
                <span className="text-4xl font-black text-slate-900 dark:text-white">
                  ¥{selectedFund.price.toLocaleString()}
                </span>
                <span className="text-lg font-bold text-red-500 mb-1">
                  {selectedFund.change} ({selectedFund.changePercent})
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-800 rounded-2xl p-6">
            <div>
              <p className="text-xs text-slate-400 font-bold mb-1">純資産総額</p>
              <p className="font-bold text-slate-900 dark:text-white">{selectedFund.assets}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold mb-1">信託報酬 (税込)</p>
              <p className="font-bold text-slate-900 dark:text-white">{selectedFund.fee}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold mb-1">リスク等級</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`w-2 h-4 rounded-sm ${i <= selectedFund.risk ? 'bg-orange-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold mb-1">NISA対象</p>
              <p className="font-bold text-green-500 flex items-center gap-1">
                <Calendar size={14} /> 成長枠・つみたて
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 3. チャート & ポートフォリオ */}
          <div className="lg:col-span-2 space-y-8">
            {/* 基準価額チャート */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-lg mb-6 text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="text-orange-500" /> 基準価額チャート (1年)
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={CHART_DATA_1Y}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-700" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis domain={['auto', 'auto']} hide />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ポートフォリオ構成 (円グラフ) */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-lg mb-6 text-slate-900 dark:text-white flex items-center gap-2">
                <PieChart className="text-purple-500" /> 投資先の国・地域
              </h3>
              <div className="flex flex-col md:flex-row items-center justify-around h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={selectedFund.portfolio}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {selectedFund.portfolio.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend layout="vertical" verticalAlign="middle" align="right" />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 目論見書ダウンロード */}
            <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-6 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white">目論見書 (PDF)</h4>
                <p className="text-xs text-slate-500">投資信託の詳しい情報が記載されています。</p>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-white rounded-lg font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-600 transition">
                <Download size={16} /> ダウンロード
              </button>
            </div>
          </div>

          {/* 4. シミュレーション & アクション (Sticky) */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 sticky top-24">
              <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white flex items-center gap-2">
                <DollarSign className="text-green-500" /> 積立シミュレーション
              </h3>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">毎月の積立額</label>
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      className="bg-transparent font-bold text-lg w-full outline-none text-slate-900 dark:text-white"
                    />
                    <span className="text-sm font-bold text-slate-400">円</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">積立期間: {period}年</label>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    value={period}
                    onChange={(e) => setPeriod(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                </div>
              </div>

              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white mb-6 relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-sm text-slate-400 mb-1">{period}年後の予想資産額</p>
                  <p className="text-3xl font-black text-orange-400">
                    ¥{futureValue.toLocaleString()}
                  </p>
                  <p className="text-xs text-green-400 mt-2 font-bold">
                    +¥{profit.toLocaleString()} (利益)
                  </p>
                </div>
                <div className="absolute right-0 bottom-0 w-24 h-24 bg-orange-500/20 rounded-full blur-2xl" />
              </div>

              <button className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-black text-lg rounded-xl shadow-lg shadow-orange-500/30 transition transform hover:-translate-y-1 mb-3">
                このファンドを購入する
              </button>
              <button className="w-full py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition">
                カートに入れる
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
