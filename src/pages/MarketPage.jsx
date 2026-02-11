import { useState } from 'react'
import {
  TrendingUp, TrendingDown, Globe, Clock,
  Activity, Zap, BarChart3
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

const CHART_DATA = [
  { time: '09:00', price: 38800 },
  { time: '09:30', price: 38850 },
  { time: '10:00', price: 38950 },
  { time: '10:30', price: 38920 },
  { time: '11:00', price: 38980 },
  { time: '11:30', price: 39020 },
  { time: '12:00', price: 39050 },
  { time: '12:30', price: 39100 },
  { time: '13:00', price: 39050 },
  { time: '13:30', price: 39120 },
  { time: '14:00', price: 39200 },
  { time: '14:30', price: 39180 },
  { time: '15:00', price: 39150 },
]

const NEWS_DATA = [
  { id: 1, title: '日経平均、一時4万円台回復 半導体株がけん引', source: '日経新聞', time: '10分前', tag: '市況' },
  { id: 2, title: '米FRB、利下げ観測強まる 次回のFOMCに注目', source: 'Bloomberg', time: '1時間前', tag: '海外' },
  { id: 3, title: '新NISA、つみたて投資枠の利用が急増 20代・30代中心に', source: 'MoneyMart', time: '2時間前', tag: '国内' },
  { id: 4, title: 'トヨタ、過去最高益を更新 EV販売も好調', source: 'Reuters', time: '3時間前', tag: '企業' },
  { id: 5, title: '円安が続く中、輸入物価の上昇懸念 企業業績に影響', source: '東洋経済', time: '4時間前', tag: '為替' },
  { id: 6, title: 'ビットコインETFの流入額が過去最高を更新', source: 'CoinDesk', time: '5時間前', tag: '仮想通貨' },
  { id: 7, title: '欧州中央銀行、利下げを継続 経済減速への対応', source: 'WSJ', time: '6時間前', tag: '海外' },
  { id: 8, title: '東京エレクトロン、半導体製造装置受注が好調', source: '日経新聞', time: '7時間前', tag: '企業' },
]

export default function MarketPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('1D')

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 font-sans">
      {/* ヘッダー */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 pt-8 pb-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="text-orange-500" size={28} /> マーケット情報
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm font-medium">
              世界の金融市場の動きをリアルタイムでチェック
            </p>
          </div>
          <span className="text-xs font-bold text-green-500 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full animate-pulse">
            ● リアルタイム更新中
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 1. 主要指数カード */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[
            { name: '日本市場', price: '39,150', change: '+1.25%', up: true, icon: '🇯🇵' },
            { name: '日本市場(全株)', price: '2,715', change: '+0.88%', up: true, icon: '🇯🇵' },
            { name: '米国市場', price: '5,089', change: '+0.03%', up: true, icon: '🇺🇸' },
            { name: '米国市場(NY)', price: '20,120', change: '-0.15%', up: false, icon: '🇺🇸' },
            { name: 'ビットコイン', price: '¥9.85M', change: '-2.40%', up: false, icon: '₿' },
            { name: '金', price: '¥10,850', change: '+0.82%', up: true, icon: '🥇' },
          ].map((item, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-900 p-4 lg:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition overflow-hidden min-w-0">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <span className="text-xl lg:text-2xl shrink-0">{item.icon}</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300 text-sm lg:text-base break-words leading-tight">{item.name}</span>
                </div>
                {item.up ? <TrendingUp className="text-red-500 shrink-0" size={20} /> : <TrendingDown className="text-blue-500 shrink-0" size={20} />}
              </div>
              <div className="flex items-end gap-2 min-w-0">
                <span className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white truncate min-w-0">{item.price}</span>
                <span className={`font-bold mb-1 shrink-0 text-sm ${item.up ? 'text-red-500' : 'text-blue-500'}`}>
                  {item.change}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 2. メインチャートエリア */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-2 h-6 bg-orange-500 rounded-full" />
                    日本市場 チャート
                  </h2>
                </div>
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                  {['1D', '1W', '1M', '3M', '1Y'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setSelectedPeriod(p)}
                      className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${
                        selectedPeriod === p
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={CHART_DATA}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-700" />
                    <XAxis dataKey="time" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis domain={['auto', 'auto']} hide />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke="#ef4444"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorPrice)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* AIマーケット分析レポート */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-8 text-white relative overflow-hidden flex items-center justify-between">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2 text-orange-400 font-bold text-sm">
                  <Zap size={16} /> AI Market Analysis
                </div>
                <h3 className="text-xl font-bold mb-1">今の市場は「買い時」？</h3>
                <p className="text-slate-400 text-sm">AIが過去20年のデータを分析し、今週のトレンドを予測。</p>
              </div>
              <button className="relative z-10 bg-white text-slate-900 px-4 py-2 rounded-xl font-bold text-sm hover:bg-orange-50 transition">
                レポートを見る
              </button>
              <div className="absolute right-0 top-0 w-32 h-32 bg-orange-500/20 blur-3xl rounded-full" />
            </div>
          </div>

          {/* 3. ニュース & ランキング */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <Globe size={18} className="text-blue-500" /> 最新ニュース
                </h3>
                <button className="text-xs text-slate-400 hover:text-blue-500">すべて見る</button>
              </div>
              <div className="space-y-4">
                {NEWS_DATA.map((news) => (
                  <div key={news.id} className="group cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                        {news.tag}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock size={10} /> {news.time}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 line-clamp-2 leading-relaxed">
                      {news.title}
                    </h4>
                    <div className="h-px bg-slate-50 dark:bg-slate-800 mt-4 group-last:hidden" />
                  </div>
                ))}
              </div>
            </div>

            {/* セクター別騰落率 */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <BarChart3 size={18} className="text-purple-500" /> セクター別騰落率
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400">半導体</p>
                  <p className="font-black text-red-500">+2.4%</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400">銀行</p>
                  <p className="font-black text-blue-500">-0.8%</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400">自動車</p>
                  <p className="font-black text-red-500">+1.1%</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400">不動産</p>
                  <p className="font-black text-slate-500">0.0%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
