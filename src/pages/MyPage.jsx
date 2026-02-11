import { useState } from 'react'
import {
  PieChart, Wallet, CreditCard, TrendingUp, TrendingDown,
  AlertTriangle, ShieldCheck, ChevronRight, Bell, Settings,
  LogOut, Crown, ArrowUpRight, Zap, Coins,
  FileText, Home, PiggyBank, Smartphone, Star, X, Loader2, Sparkles, CheckCircle2
} from 'lucide-react'
import {
  Cell, Pie, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  PieChart as RechartsPieChart
} from 'recharts'

const ASSET_HISTORY = [
  { month: '9月', value: 180 },
  { month: '10月', value: 195 },
  { month: '11月', value: 192 },
  { month: '12月', value: 210 },
  { month: '1月', value: 215 },
  { month: '2月', value: 228 },
]

const SUGGESTIONS = [
  { id: 1, type: 'urgent', title: '住宅ローン借り換え', desc: '金利差 -0.3% | 想定削減額 ¥120万', icon: Home },
  { id: 2, type: 'info', title: '余剰資金の活用', desc: '普通預金の¥30万をNISAへ', icon: TrendingUp },
  { id: 3, type: 'check', title: '保険の見直し', desc: '重複補償の可能性があります', icon: ShieldCheck },
]

const PORTFOLIO = [
  { id: 1, name: 'Fund A (Global Tech)', value: 1250000, invest: 1000000, return: 25.0, color: '#3b82f6' },
  { id: 2, name: 'Fund B (Bond Mix)', value: 925000, invest: 1000000, return: -7.5, color: '#ef4444' },
  { id: 3, name: 'Fund C (REITs)', value: 105000, invest: 100000, return: 5.0, color: '#10b981' },
]

const WATCHLIST = [
  { id: 1, name: 'eMAXIS Slim 全世界株式', change: 25.0, trend: 'up' },
  { id: 2, name: 'ひふみプラス', change: -10.0, trend: 'down' },
  { id: 3, name: '楽天・全米株式', change: 5.0, trend: 'up' },
]

const BUDGET_DATA = [
  { name: '食費', value: 5000, color: '#f97316' },
  { name: 'ショッピング', value: 3000, color: '#8b5cf6' },
  { name: 'その他', value: 0, color: '#cbd5e1' },
]

const RECENT_TRANSACTIONS = [
  { id: 1, cat: '食費', name: 'コンビニ (7-Eleven)', date: '2/5', amount: 5000, card: '三井住友カード(NL)' },
  { id: 2, cat: '買い物', name: 'Amazon.co.jp', date: '2/2', amount: 3000, card: 'dカード' },
]

const POINTS = {
  total: 1000,
  expiring: 0,
  list: [{ name: 'PayPayポイント', balance: 1000, expiry: '2027/1/22' }],
}

const DEBT_INFO = {
  current: 35000000,
  remaining: 32000000,
  dti: 28.5,
  alerts: [
    { id: 1, type: 'opportunity', msg: '金利 0.3% 低いローンへの借り換えチャンス' },
    { id: 2, type: 'warning', msg: '来月、市場金利の上昇が予測されています' },
  ],
}

const PORTFOLIOS = {
  conservative: {
    label: '安定運用タイプ',
    desc: 'リスクを抑え、守りながら増やすスタイルです。',
    return: '年 2〜3%',
    data: [
      { name: '債券', value: 70, color: '#10b981' },
      { name: '株式', value: 30, color: '#3b82f6' },
    ],
  },
  balanced: {
    label: 'バランス運用タイプ',
    desc: 'リスクとリターンのバランスが取れた標準的なスタイルです。',
    return: '年 4〜5%',
    data: [
      { name: '債券', value: 40, color: '#10b981' },
      { name: '株式', value: 60, color: '#3b82f6' },
    ],
  },
  aggressive: {
    label: '積極運用タイプ',
    desc: '変動リスクを許容し、高いリターンを狙うスタイルです。',
    return: '年 6〜8%',
    data: [
      { name: '株式', value: 90, color: '#3b82f6' },
      { name: '債券', value: 10, color: '#10b981' },
    ],
  },
}

const RiskDiagnosisModal = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(0)
  const [score, setScore] = useState(0)
  const [resultType, setResultType] = useState('balanced')

  const questions = [
    { category: '基本情報', q: '現在の年齢を教えてください。', options: [{ text: '60代以上 (リタイア期)', score: 1 }, { text: '40代 ~ 50代', score: 3 }, { text: '20代 ~ 30代', score: 5 }] },
    { category: '財務状況', q: '現在の収入源は安定していますか？', options: [{ text: '不安定 / 将来に不安がある', score: 1 }, { text: '平均的 / 普通', score: 3 }, { text: '非常に安定している (公務員・大企業等)', score: 5 }] },
    { category: '資産状況', q: '生活防衛資金（生活費の3~6ヶ月分）は確保できていますか？', options: [{ text: 'いいえ、貯金はほとんどありません', score: 0 }, { text: 'ギリギリ確保できている', score: 3 }, { text: 'はい、十分な余裕資金があります', score: 5 }] },
    { category: '投資経験', q: '過去の投資経験について教えてください。', options: [{ text: '全くの未経験', score: 1 }, { text: '積立NISAやiDeCo程度', score: 3 }, { text: '個別株やFXなどの経験がある', score: 5 }] },
    { category: '金融知識', q: '「インフレ」や「為替リスク」について理解していますか？', options: [{ text: 'あまりよく分からない', score: 1 }, { text: 'ある程度は理解している', score: 3 }, { text: '他人に説明できるレベル', score: 5 }] },
    { category: '投資期間', q: 'この資金はいつ頃使う予定ですか？', options: [{ text: '3年以内 (短期)', score: 1 }, { text: '5年 ~ 10年 (中期)', score: 3 }, { text: '10年以上先 (長期)', score: 5 }] },
    { category: 'リスク許容度', q: '一時的に資産がマイナス20%になりました。どう感じますか？', options: [{ text: '夜も眠れない / すぐに売却する', score: 0 }, { text: '不安だが様子を見る', score: 3 }, { text: '安く買えるチャンスだと思う', score: 5 }] },
    { category: '期待リターン', q: 'あなたが投資に求めるものは？', options: [{ text: '絶対に元本を割りたくない', score: 1 }, { text: '銀行預金より増えればいい', score: 3 }, { text: 'リスクを取ってでも大きく増やしたい', score: 5 }] },
    { category: '毎月の積立', q: '毎月の投資可能額はどのくらいですか？', options: [{ text: '1万円未満', score: 1 }, { text: '3万円 ~ 5万円', score: 3 }, { text: '10万円以上', score: 5 }] },
    { category: '最終確認', q: 'もし明日、投資した100万円が50万円になったら生活に困りますか？', options: [{ text: 'はい、非常に困ります', score: 0 }, { text: '少し困るかもしれません', score: 3 }, { text: '生活には影響ありません', score: 5 }] },
  ]

  const handleAnswer = (point) => {
    const newScore = score + point
    setScore(newScore)
    if (step < questions.length) {
      setStep(step + 1)
    } else {
      setStep(11)
      setTimeout(() => {
        if (newScore <= 20) setResultType('conservative')
        else if (newScore <= 35) setResultType('balanced')
        else setResultType('aggressive')
        setStep(12)
      }, 2000)
    }
  }

  const reset = () => {
    setStep(0)
    setScore(0)
  }

  const currentPortfolio = PORTFOLIOS[resultType]

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden relative min-h-[500px] flex flex-col border border-slate-200 dark:border-slate-800">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition z-10">
          <X size={24} className="text-slate-400" />
        </button>

        {step === 0 && (
          <div className="p-10 text-center flex-1 flex flex-col justify-center">
            <div className="w-20 h-20 bg-orange-50 dark:bg-orange-900/30 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Sparkles size={40} />
            </div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4">AI 資産精密診断</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-8">
              金融工学に基づいた<span className="text-orange-500 font-bold">10の質問</span>で、<br />
              あなたの本当のリスク許容度を分析します。<br />
              <span className="text-xs text-slate-400 font-bold mt-2 block bg-slate-100 dark:bg-slate-800 py-1 px-3 rounded-full w-fit mx-auto">所要時間: 約2分</span>
            </p>
            <button onClick={() => setStep(1)} className="w-full py-4 bg-slate-900 dark:bg-slate-100 hover:bg-black dark:hover:bg-white text-white dark:text-slate-900 font-bold rounded-2xl shadow-lg transition transform hover:scale-[1.02]">
              診断スタート
            </button>
          </div>
        )}

        {step >= 1 && step <= 10 && (
          <div className="p-8 flex-1 flex flex-col">
            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Question {step}/10</span>
                <span className="text-xs font-bold text-orange-500">{Math.round((step / 10) * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full transition-all duration-500 ease-out" style={{ width: `${(step / 10) * 100}%` }} />
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <span className="text-xs font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full w-fit mb-4">{questions[step - 1].category}</span>
              <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mb-8 leading-snug">{questions[step - 1].q}</h3>
              <div className="space-y-3">
                {questions[step - 1].options.map((opt, i) => (
                  <button key={i} onClick={() => handleAnswer(opt.score)} className="w-full p-5 text-left bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition group flex justify-between items-center hover:shadow-md">
                    <span className="font-bold text-slate-700 dark:text-slate-300 group-hover:text-orange-900 dark:group-hover:text-orange-400 text-sm md:text-base">{opt.text}</span>
                    <ChevronRight className="text-slate-300 group-hover:text-orange-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 11 && (
          <div className="p-12 text-center flex-1 flex flex-col justify-center items-center">
            <div className="relative w-24 h-24 mx-auto mb-8">
              <div className="absolute inset-0 border-4 border-slate-100 dark:border-slate-800 rounded-full" />
              <div className="absolute inset-0 border-4 border-orange-500 rounded-full border-t-transparent animate-spin" />
              <Zap className="absolute inset-0 m-auto text-orange-500 animate-pulse" size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">AIが分析中...</h3>
            <div className="space-y-1 text-sm text-slate-500 dark:text-slate-400 font-medium">
              <p>回答データを解析しています...</p>
              <p>過去30年の市場データと照合中...</p>
              <p>最適なポートフォリオを生成中...</p>
            </div>
          </div>
        )}

        {step === 12 && (
          <div className="bg-slate-50 dark:bg-slate-950 h-full animate-slideUp overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-b-[2rem] shadow-sm mb-6">
              <div className="text-center mb-6">
                <span className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">Analysis Result</span>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-4 mb-2">{currentPortfolio.label}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">{currentPortfolio.desc}</p>
              </div>
              <div className="h-64 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie data={currentPortfolio.data} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {currentPortfolio.data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  </RechartsPieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xs text-slate-400 font-bold">想定利回り</span>
                  <span className="text-3xl font-black text-slate-900 dark:text-white">{currentPortfolio.return}</span>
                </div>
              </div>
            </div>
            <div className="px-8 pb-8">
              <h4 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <PieChart size={18} className="text-slate-400" /> ポートフォリオ構成案
              </h4>
              <div className="space-y-3 mb-8">
                {currentPortfolio.data.map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">{item.name}</span>
                    </div>
                    <span className="font-black text-slate-900 dark:text-white">{item.value}%</span>
                  </div>
                ))}
              </div>
              <button onClick={() => { onClose(); alert('ポートフォリオを保存しました') }} className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 transition transform hover:scale-[1.02] flex items-center justify-center gap-2">
                <CheckCircle2 size={20} /> この構成で保存する
              </button>
              <button onClick={reset} className="w-full mt-4 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                もう一度診断する
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const SummarySection = ({ onOpenRiskDiagnosis }) => {
  const totalAssets = 2280000
  const totalDebt = DEBT_INFO.remaining
  const netWorth = totalAssets - totalDebt

  return (
    <div className="space-y-6">
      {/* 1. Key Metrics (3 Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <p className="text-xs font-bold text-slate-400 mb-1">Net Worth (純資産)</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">
            {netWorth < 0 ? '-' : ''}¥{Math.abs(netWorth).toLocaleString()}
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">
            Asset: ¥{(totalAssets / 10000).toFixed(0)}万 - Debt: ¥{(totalDebt / 10000).toFixed(0)}万
          </p>
          <div className="absolute right-4 top-6 p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-xl">
            <Wallet size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <p className="text-xs font-bold text-slate-400 mb-1">Cash Flow (今月)</p>
          <div className="flex items-end gap-2">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">+¥42,000</h3>
            <span className="text-xs font-bold text-green-500 mb-1">黒字</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-3 overflow-hidden">
            <div className="w-[70%] h-full bg-emerald-500 rounded-full" />
          </div>
          <p className="text-[10px] text-slate-400 mt-1 text-right">Budget Left: 84%</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <p className="text-xs font-bold text-slate-400 mb-1">Credit Score</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">A+ <span className="text-lg text-slate-300 font-medium">/ 850</span></h3>
          <p className="text-[10px] text-slate-400 mt-1">Excellent. ほとんどの審査に通ります。</p>
          <div className="absolute right-4 top-6 p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-500 rounded-xl">
            <Crown size={20} />
          </div>
        </div>
      </div>

      {/* 2. Asset Trend Chart & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp size={20} className="text-orange-500" /> Total Asset Growth
            </h3>
            <div className="flex gap-2">
              <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-500">6M</span>
              <span className="text-xs font-bold bg-white dark:bg-slate-900 border dark:border-slate-700 px-3 py-1 rounded-full text-slate-400">1Y</span>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ASSET_HISTORY}>
                <defs>
                  <linearGradient id="colorAsset" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-700" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis hide domain={['dataMin - 10', 'auto']} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  formatter={(value) => [`¥${value}万`, '総資産']}
                />
                <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorAsset)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Zap size={18} className="text-yellow-400 fill-yellow-400" /> MoneyMart Insights
              </h3>
              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">3</span>
            </div>
            <div className="space-y-3">
              {SUGGESTIONS.map((item) => (
                <div key={item.id} className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/10 hover:bg-white/20 transition cursor-pointer group">
                  <div className="flex items-center gap-3 mb-1">
                    <div className={`p-1.5 rounded-lg ${item.type === 'urgent' ? 'bg-red-500/20 text-red-300' : item.type === 'info' ? 'bg-blue-500/20 text-blue-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                      <item.icon size={14} />
                    </div>
                    <span className="font-bold text-sm">{item.title}</span>
                  </div>
                  <p className="text-xs text-slate-400 pl-10 leading-tight">{item.desc}</p>
                </div>
              ))}
            </div>
            <button onClick={onOpenRiskDiagnosis} className="w-full mt-4 py-3 bg-orange-500 text-white font-bold text-xs rounded-xl hover:bg-orange-600 transition flex items-center justify-center gap-2">
              <Zap size={14} /> AI 投資診断
            </button>
            <button className="w-full mt-3 py-3 bg-white/10 text-white font-bold text-xs rounded-xl hover:bg-white/20 transition border border-white/20">
              すべてのアドバイスを見る
            </button>
          </div>
          <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/30 blur-[80px] rounded-full" />
        </div>
      </div>
    </div>
  )
}

const WealthSection = () => (
  <div className="space-y-8">
    <div className="grid md:grid-cols-2 gap-8">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <TrendingUp size={20} className="text-blue-500" /> Current Investment
        </h3>
        <div className="space-y-4">
          {PORTFOLIO.map((fund) => (
            <div key={fund.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
              <div className="flex justify-between items-start mb-2">
                <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">{fund.name}</span>
                <span className={`text-xs font-black px-2 py-1 rounded ${fund.return >= 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                  {fund.return >= 0 ? '+' : ''}{fund.return}%
                </span>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold">評価額</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white">¥{fund.value.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 font-bold">損益</p>
                  <p className={`text-sm font-bold ${fund.value - fund.invest >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {fund.value - fund.invest >= 0 ? '+' : ''}¥{(fund.value - fund.invest).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <Star size={20} className="text-yellow-400 fill-yellow-400" /> Fund Watchlist
        </h3>
        <div className="space-y-3">
          {WATCHLIST.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer group">
              <span className="font-bold text-slate-700 dark:text-slate-300 text-sm group-hover:text-orange-500 transition">{item.name}</span>
              <span className={`font-bold text-sm ${item.change >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                {item.change > 0 ? '+' : ''}{item.change}%
              </span>
            </div>
          ))}
        </div>
        <button className="w-full mt-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-sm rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition">
          + ウォッチリストを追加
        </button>
      </div>
    </div>

    <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2 mb-2 text-orange-400 font-bold text-xs uppercase tracking-wider">
          <Crown size={14} /> Premium Service
        </div>
        <h3 className="font-bold text-lg">Weekly Fund Report</h3>
        <p className="text-sm text-slate-400">今週の市場動向と推奨ポートフォリオ更新</p>
      </div>
      <button className="bg-white text-slate-900 px-4 py-2 rounded-lg font-bold text-xs hover:bg-orange-50 transition">
        レポートを読む
      </button>
    </div>
  </div>
)

const BudgetSection = () => (
  <div className="grid md:grid-cols-2 gap-8">
    <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Wallet size={20} className="text-orange-500" /> Expense Tracker
        </h3>
        <button className="text-xs font-bold text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-3 py-1 rounded-full">
          + Add Expense
        </button>
      </div>

      <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-2xl border border-green-100 dark:border-green-900/50 mb-8">
        <div className="flex justify-between items-end mb-2">
          <div>
            <p className="text-xs text-green-600 dark:text-green-400 font-bold mb-1">This month&apos;s expenses</p>
            <p className="text-3xl font-black text-green-700 dark:text-green-400">¥8,000</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-green-600 dark:text-green-400 font-bold mb-1">Budget Target</p>
            <p className="text-lg font-bold text-green-700 dark:text-green-400">¥200,000</p>
          </div>
        </div>
        <div className="w-full h-3 bg-green-200 dark:bg-green-900/50 rounded-full overflow-hidden">
          <div className="w-[4%] h-full bg-green-500 rounded-full" />
        </div>
        <div className="flex justify-between mt-2 text-[10px] font-bold text-green-600 dark:text-green-400">
          <span>4.0% used</span>
          <span>Remaining ¥192,000</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="h-40 relative">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPieChart>
              <Pie data={BUDGET_DATA} innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
                {BUDGET_DATA.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </RechartsPieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="font-black text-slate-300 text-xs">Category</span>
          </div>
        </div>
        <div className="space-y-2 flex flex-col justify-center">
          {BUDGET_DATA.filter((d) => d.value > 0).map((d, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-slate-500 dark:text-slate-400 font-bold">{d.name}</span>
              </div>
              <span className="font-black text-slate-900 dark:text-white">¥{d.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <h4 className="font-bold text-slate-900 dark:text-white mt-6 mb-4">Recent spending</h4>
      <div className="space-y-3">
        {RECENT_TRANSACTIONS.map((tx) => (
          <div key={tx.id} className="flex justify-between items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.cat === '食費' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'}`}>
                {tx.cat === '食費' ? <Smartphone size={18} /> : <FileText size={18} />}
              </div>
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{tx.name}</p>
                <p className="text-[10px] text-slate-400 font-bold">{tx.date} • {tx.cat} • {tx.card}</p>
              </div>
            </div>
            <span className="font-black text-slate-900 dark:text-white">¥{tx.amount.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>

    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <Coins size={20} className="text-yellow-500" /> Point Book
        </h3>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="relative p-4 bg-orange-50 dark:bg-orange-900/20 rounded-2xl border border-orange-100 dark:border-orange-900/50">
            <p className="text-xs text-orange-600 dark:text-orange-400 font-bold mb-1">Total points</p>
            <p className="text-3xl font-black text-orange-500">{POINTS.total.toLocaleString()}</p>
            <Coins className="text-orange-200 dark:text-orange-800 absolute top-4 right-4" size={40} />
          </div>
          <div className="relative p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
            <p className="text-xs text-slate-500 font-bold mb-1">Expires (30d)</p>
            <p className="text-3xl font-black text-slate-400">{POINTS.expiring}</p>
            <AlertTriangle className="text-slate-200 dark:text-slate-600 absolute top-4 right-4" size={40} />
          </div>
        </div>

        <div className="space-y-2">
          {POINTS.list.map((p, i) => (
            <div key={i} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <span className="bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 text-[10px] font-bold px-2 py-1 rounded-full">{p.name}</span>
              <div className="text-right">
                <p className="font-black text-slate-900 dark:text-white">{p.balance.toLocaleString()} P</p>
                <p className="text-[10px] text-slate-400">有効期限: {p.expiry}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck size={20} className="text-blue-500" /> My Insurance
          </h3>
          <button className="bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-emerald-600 transition">
            + 追加
          </button>
        </div>

        <div className="border border-orange-200 dark:border-orange-900/50 bg-orange-50/30 dark:bg-orange-900/20 rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-orange-500" />
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="font-bold text-slate-900 dark:text-white">AAA 自動車保険</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">保険料: ¥5,000/月</p>
            </div>
            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
              あと 22日
            </span>
          </div>
          <p className="text-[10px] text-slate-400">満期: 2026/2/28 • 補償額: ¥10,000</p>
        </div>
      </div>
    </div>
  </div>
)

const DebtSection = () => {
  const [annualIncome, setAnnualIncome] = useState(600)
  const estimatedAnnualRepayment = 150
  const dti = annualIncome > 0 ? ((estimatedAnnualRepayment / annualIncome) * 100).toFixed(1) : 0

  return (
    <div className="grid md:grid-cols-12 gap-8">
      <div className="md:col-span-4 space-y-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Wallet size={20} className="text-emerald-500" /> Your Income
          </h3>
          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
            <label className="text-xs font-bold text-slate-400 block mb-2">昨年の年収 (税引前)</label>
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-900 dark:text-white text-lg">¥</span>
              <input
                type="number"
                value={annualIncome}
                onChange={(e) => setAnnualIncome(Number(e.target.value) || 0)}
                className="w-full bg-transparent font-black text-2xl text-slate-900 dark:text-white outline-none border-b-2 border-slate-200 dark:border-slate-600 focus:border-emerald-500 transition"
              />
              <span className="font-bold text-slate-400 text-sm whitespace-nowrap">万円</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-500" /> My Debt Status
          </h3>
          <div className="space-y-6">
            <div>
              <p className="text-xs text-slate-400 font-bold mb-1">Total Remaining Debt</p>
              <p className="text-3xl font-black text-slate-900 dark:text-white">¥{DEBT_INFO.remaining.toLocaleString()}</p>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full mt-2">
                <div className="w-[90%] h-full bg-slate-900 dark:bg-slate-600 rounded-full" />
              </div>
            </div>

            <div className={`p-4 rounded-xl transition-all duration-500 ${Number(dti) > 35 ? 'bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50' : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50'}`}>
              <div className="flex justify-between mb-1">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Debt to Income (DTI)</span>
                <span className={`text-xl font-black ${Number(dti) > 35 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                  {dti}%
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                {Number(dti) > 35
                  ? '⚠️ 返済負担が高まっています。借り換えを検討してください。'
                  : '✅ 適正範囲内(35%以下)です。健全な家計状態です。'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Bell size={20} className="text-orange-500" /> Smart Loan Alerts
          </h3>
          <div className="space-y-3">
            {DEBT_INFO.alerts.map((alert) => (
              <div key={alert.id} className={`p-3 rounded-xl border text-xs font-bold leading-relaxed flex gap-2 ${alert.type === 'opportunity' ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/50 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/50 text-red-700 dark:text-red-400'}`}>
                {alert.type === 'opportunity' ? <Zap size={16} className="shrink-0" /> : <AlertTriangle size={16} className="shrink-0" />}
                {alert.msg}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="md:col-span-8">
        <div className="bg-slate-900 text-white p-8 rounded-[2rem] shadow-xl relative overflow-hidden h-full flex flex-col justify-center">
          <div className="relative z-10">
            <div className="mb-8">
              <span className="bg-white/10 text-white text-[10px] font-bold px-2 py-1 rounded border border-white/20 mb-2 inline-block">Simulation</span>
              <h3 className="text-3xl font-black mb-2">Future Scenario Analysis</h3>
              <p className="text-slate-400 text-sm leading-relaxed max-w-lg">
                あなたの年収 <span className="text-white font-bold underline">¥{annualIncome}万円</span> をベースに、<br />
                金利上昇や収入減少が返済計画に与える影響をAIが予測します。
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10 hover:bg-white/20 transition cursor-pointer group">
                <div className="w-12 h-12 bg-red-500/20 text-red-400 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition"><TrendingUp size={24} /></div>
                <h4 className="font-bold text-lg mb-2">Interest rate hikes</h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">金利が0.5%上昇した場合、月々の返済額がどう変わるか確認できます。</p>
                <span className="text-xs font-bold text-white border-b border-white pb-0.5 group-hover:text-red-400 group-hover:border-red-400 transition">シミュレーション実行 &rarr;</span>
              </div>

              <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10 hover:bg-white/20 transition cursor-pointer group">
                <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition"><TrendingDown size={24} /></div>
                <h4 className="font-bold text-lg mb-2">Income decrease</h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">収入が20%減少した場合の返済負担率(DTI)の変化を予測します。</p>
                <span className="text-xs font-bold text-white border-b border-white pb-0.5 group-hover:text-blue-400 group-hover:border-blue-400 transition">シミュレーション実行 &rarr;</span>
              </div>
            </div>
          </div>
          <div className="absolute -right-20 -top-20 w-96 h-96 bg-orange-500/20 rounded-full blur-[100px]" />
        </div>
      </div>
    </div>
  )
}

export default function MyPage() {
  const [activeTab, setActiveTab] = useState('summary')
  const [isDiagnosisOpen, setIsDiagnosisOpen] = useState(false)

  const renderContent = () => {
    switch (activeTab) {
      case 'wealth': return <WealthSection />
      case 'budget': return <BudgetSection />
      case 'debt': return <DebtSection />
      default: return <SummarySection onOpenRiskDiagnosis={() => setIsDiagnosisOpen(true)} />
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans pb-20 flex">
      <aside className="hidden lg:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-screen sticky top-0 p-6">
        <div className="flex items-center gap-2 mb-10">
          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-black text-xs">MM</div>
          <span className="text-xl font-black text-slate-900 dark:text-white">MoneyMart</span>
        </div>

        <nav className="space-y-2 flex-1">
          {[
            { id: 'summary', label: 'サマリー', icon: Home },
            { id: 'wealth', label: '資産運用 (My Wealth)', icon: TrendingUp },
            { id: 'budget', label: '家計・ポイント', icon: Wallet },
            { id: 'debt', label: 'ローン・負債管理', icon: AlertTriangle },
          ].map((menu) => (
            <button
              key={menu.id}
              onClick={() => setActiveTab(menu.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition ${activeTab === menu.id ? 'bg-slate-900 dark:bg-orange-500 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              <menu.icon size={18} /> {menu.label}
            </button>
          ))}
        </nav>

        <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <Settings size={18} /> 設定
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-red-400 hover:text-red-500">
            <LogOut size={18} /> ログアウト
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-900 dark:bg-orange-500 text-white flex items-center justify-center text-2xl font-black shadow-lg">
              J
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                Hi, Justin! <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full border border-orange-200 dark:border-orange-800 flex items-center gap-1"><Crown size={12} /> Premium</span>
              </h1>
              <p className="text-slate-400 font-bold text-sm">Welcome back to MoneyMart</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm min-w-[180px]">
              <p className="text-xs text-slate-400 font-bold mb-1">Total Assets</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">¥2,280,000</p>
              <p className="text-xs font-bold text-green-500 flex items-center gap-1">
                <TrendingUp size={12} /> +¥250,000 (+12.3%)
              </p>
            </div>
          </div>
        </header>

        <div className="lg:hidden flex overflow-x-auto gap-2 mb-6 pb-2 scrollbar-hide">
          {['summary', 'wealth', 'budget', 'debt'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap ${activeTab === tab ? 'bg-slate-900 dark:bg-orange-500 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}
            >
              {tab === 'wealth' ? '資産' : tab === 'budget' ? '家計' : tab === 'debt' ? '負債' : 'ホーム'}
            </button>
          ))}
        </div>

        <div className="animate-fadeIn">
          {renderContent()}
        </div>
      </main>

      <button
        onClick={() => setIsDiagnosisOpen(true)}
        className="fixed bottom-8 right-8 bg-slate-900 dark:bg-orange-500 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition z-50 flex items-center gap-2 font-bold pr-6"
      >
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        AI 投資診断
      </button>

      <RiskDiagnosisModal isOpen={isDiagnosisOpen} onClose={() => setIsDiagnosisOpen(false)} />
    </div>
  )
}
