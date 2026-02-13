import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, BarChart2, Sparkles, ChevronRight,
  CreditCard, Landmark, Home, Coins,
  Trophy, TrendingUp, Calculator, X,
  PiggyBank, Umbrella, Briefcase
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import AdBanner from '../components/AdBanner'

const FUND_RANKING = [
  { id: 'emaxis-all', name: 'eMAXIS Slim 全世界株式 (オール・カントリー)', cat: '国際株式', ret: '+24.5%' },
  { id: 'emaxis-sp500', name: 'eMAXIS Slim 米国株式 (S&P500)', cat: '北米株式', ret: '+28.3%' },
  { id: 'alliance-ab', name: 'アライアンス・バーンスタイン・米国成長株投信Ｄ', cat: '北米株式', ret: '+32.1%' },
  { id: 'himuchi-plus', name: 'ひふみプラス', cat: '国内株式', ret: '+15.4%' },
  { id: 'raku-eco', name: '楽天・全世界・株価指数・ECO', cat: '全世界株式', ret: '+22.1%' },
]

const FUND_TREND = {
  'emaxis-all': [
    { m: '4月', r: 0.8 }, { m: '5月', r: 2.1 }, { m: '6月', r: 4.2 }, { m: '7月', r: 6.0 },
    { m: '8月', r: 7.4 }, { m: '9月', r: 9.5 }, { m: '10月', r: 11.3 }, { m: '11月', r: 14.0 },
    { m: '12月', r: 16.1 }, { m: '1月', r: 19.4 }, { m: '2月', r: 21.7 }, { m: '3月', r: 24.5 },
  ],
  'emaxis-sp500': [
    { m: '4月', r: 1.1 }, { m: '5月', r: 2.7 }, { m: '6月', r: 5.5 }, { m: '7月', r: 8.0 },
    { m: '8月', r: 9.2 }, { m: '9月', r: 11.5 }, { m: '10月', r: 14.6 }, { m: '11月', r: 17.2 },
    { m: '12月', r: 19.0 }, { m: '1月', r: 22.6 }, { m: '2月', r: 25.0 }, { m: '3月', r: 28.3 },
  ],
  'alliance-ab': [
    { m: '4月', r: 1.3 }, { m: '5月', r: 3.4 }, { m: '6月', r: 6.2 }, { m: '7月', r: 9.1 },
    { m: '8月', r: 10.8 }, { m: '9月', r: 13.0 }, { m: '10月', r: 16.9 }, { m: '11月', r: 20.3 },
    { m: '12月', r: 22.4 }, { m: '1月', r: 26.1 }, { m: '2月', r: 29.0 }, { m: '3月', r: 32.1 },
  ],
  'himuchi-plus': [
    { m: '4月', r: 0.4 }, { m: '5月', r: 1.2 }, { m: '6月', r: 2.4 }, { m: '7月', r: 3.9 },
    { m: '8月', r: 4.7 }, { m: '9月', r: 6.1 }, { m: '10月', r: 8.0 }, { m: '11月', r: 9.6 },
    { m: '12月', r: 11.2 }, { m: '1月', r: 12.9 }, { m: '2月', r: 14.0 }, { m: '3月', r: 15.4 },
  ],
  'raku-eco': [
    { m: '4月', r: 0.7 }, { m: '5月', r: 1.8 }, { m: '6月', r: 3.7 }, { m: '7月', r: 5.4 },
    { m: '8月', r: 6.8 }, { m: '9月', r: 8.6 }, { m: '10月', r: 10.9 }, { m: '11月', r: 13.2 },
    { m: '12月', r: 15.0 }, { m: '1月', r: 17.6 }, { m: '2月', r: 19.9 }, { m: '3月', r: 22.1 },
  ],
}

const LoanSimulatorModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null
  const [amount, setAmount] = useState(3000)
  const [rate, setRate] = useState(0.475)
  const [year, setYear] = useState(35)
  const [result, setResult] = useState(null)

  const calculate = () => {
    const r = rate / 100 / 12
    const n = year * 12
    const p = amount * 10000
    const monthly = Math.floor((p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1))
    const totalRepayment = monthly * n
    const totalInterest = Math.max(totalRepayment - p, 0)
    setResult({ monthly, principal: p, totalRepayment, totalInterest })
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 w-full max-w-sm shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X size={24} /></button>
        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <Home className="text-indigo-600" /> 住宅ローン計算
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500">借入金額 (万円)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-bold text-slate-500">金利 (%)</label>
              <input type="number" step="0.001" value={rate} onChange={(e) => setRate(Number(e.target.value))} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-slate-500">返済期間 (年)</label>
              <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <button onClick={calculate} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition">計算する</button>
        </div>
        {result && (
          <div className="mt-6 pt-6 border-t border-dashed border-slate-200 dark:border-slate-700 animate-slideUp">
            <p className="text-xs text-slate-500 mb-1">毎月の返済額</p>
            <p className="text-3xl font-black text-indigo-600 mb-4 text-center">¥{result.monthly.toLocaleString()}</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-2">
                <p className="text-[10px] text-slate-500 font-bold">元金</p>
                <p className="text-xs font-black text-slate-700 dark:text-slate-200">¥{result.principal.toLocaleString()}</p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-2">
                <p className="text-[10px] text-slate-500 font-bold">利息</p>
                <p className="text-xs font-black text-rose-600">¥{result.totalInterest.toLocaleString()}</p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-2">
                <p className="text-[10px] text-slate-500 font-bold">総返済額</p>
                <p className="text-xs font-black text-indigo-600">¥{result.totalRepayment.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const InvestSimulatorModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null
  const [monthly, setMonthly] = useState(3)
  const [rate, setRate] = useState(5.0)
  const [year, setYear] = useState(20)
  const [result, setResult] = useState(null)

  const calculate = () => {
    const r = rate / 100 / 12
    const n = year * 12
    const p = monthly * 10000
    const fv = p * ((Math.pow(1 + r, n) - 1) / r)
    setResult({ total: Math.floor(fv), principal: p * n })
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 w-full max-w-sm shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X size={24} /></button>
        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <TrendingUp className="text-pink-600" /> 積立シミュレーション
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500">毎月の積立額 (万円)</label>
            <input type="number" value={monthly} onChange={(e) => setMonthly(Number(e.target.value))} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-bold text-slate-500">想定利回り (%)</label>
              <input type="number" step="0.1" value={rate} onChange={(e) => setRate(Number(e.target.value))} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-slate-500">積立期間 (年)</label>
              <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500" />
            </div>
          </div>
          <button onClick={calculate} className="w-full py-3 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-xl shadow-lg transition">計算する</button>
        </div>
        {result && (
          <div className="mt-6 pt-6 border-t border-dashed border-slate-200 dark:border-slate-700 animate-slideUp text-center">
            <p className="text-xs text-slate-500 mb-1">{year}年後の予想資産額</p>
            <p className="text-3xl font-black text-pink-600 mb-2">¥{(result.total / 10000).toFixed(1)}<span className="text-lg text-slate-700 dark:text-slate-300">万円</span></p>
          </div>
        )}
      </div>
    </div>
  )
}

const RiskModal = ({ isOpen, onClose, onNavigate }) => {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 w-full max-w-sm shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X size={24} /></button>
        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <Sparkles className="text-orange-500" /> 無料AI診断
        </h3>
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
          リスク許容度に基づいたポートフォリオ診断をご提供します。ログインして診断を開始してください。
        </p>
        <button
          onClick={() => { onClose(); onNavigate('/login') }}
          className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-lg transition"
        >
          ログインして診断
        </button>
      </div>
    </div>
  )
}

export default function HomePage({ openRiskModal }) {
  const navigate = useNavigate()
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false)
  const [isInvestModalOpen, setIsInvestModalOpen] = useState(false)
  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false)
  const [selectedFundId, setSelectedFundId] = useState(FUND_RANKING[0].id)

  const handleRiskClick = () => {
    if (typeof openRiskModal === 'function') {
      openRiskModal()
    } else {
      setIsRiskModalOpen(true)
    }
  }

  const quickMenu = [
    { id: 'card', name: 'カード', icon: <CreditCard size={28} />, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20', link: '/products?category=cards' },
    { id: 'bank', name: '銀行', icon: <Landmark size={28} />, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', link: '/products?category=savings' },
    { id: 'fund', name: '投資信託', icon: <BarChart2 size={28} />, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', link: '/funds' },
    { id: 'loan', name: 'ローン', icon: <Home size={28} />, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20', link: '/products?category=loans' },
    { id: 'stock', name: '株式', icon: <TrendingUp size={28} />, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', link: '/stocks' },
    { id: 'point', name: 'ポイ活', icon: <Coins size={28} />, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20', link: '/products?category=points' },
    { id: 'ins', name: '保険', icon: <Umbrella size={28} />, color: 'text-sky-500', bg: 'bg-sky-50 dark:bg-sky-900/20', link: '/products?category=insurance' },
  ]

  const recommendedCards = [
    { id: 1, name: 'MoneyMart Gold', point: '1.5%', fee: '初年度無料', img: 'from-yellow-400 to-orange-500' },
    { id: 2, name: 'Platinum Elite', point: '2.0%', fee: '¥11,000', img: 'from-slate-700 to-black' },
    { id: 3, name: 'Student Life', point: '1.0%', fee: '永年無料', img: 'from-blue-400 to-cyan-400' },
    { id: 4, name: 'ANA Super Flyers', point: '1.0%', fee: '¥2,750', img: 'from-indigo-600 to-blue-800' },
    { id: 5, name: 'JAL CARD W', point: '1.5%', fee: '永年無料', img: 'from-rose-500 to-pink-600' },
    { id: 6, name: 'Amazon Mastercard', point: '0.5%~2.5%', fee: '永年無料', img: 'from-amber-500 to-orange-600' },
  ]

  return (
    <div className="pb-24 animate-fadeIn font-sans bg-[#F8FAFC] dark:bg-slate-950">
      {/* 1. Hero Section */}
      <section className="relative bg-slate-900 pt-8 pb-32 px-4 rounded-b-[3rem] shadow-xl overflow-hidden">
        <div className="absolute top-[-50%] left-[-20%] w-[80%] h-[200%] bg-blue-600/20 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[150%] bg-orange-500/10 blur-[80px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/10 px-4 py-1.5 rounded-full text-xs font-bold text-white shadow-lg">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span>只今、金利キャンペーン実施中 (最大0.2%UP)</span>
              <ChevronRight size={12} className="opacity-50" />
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-5xl font-black text-white mb-4 leading-tight">
              全ての金融サービスを、<br className="md:hidden" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-300">MoneyMart</span> ひとつで。
            </h1>
            <p className="text-slate-400 text-sm font-medium mb-8">
              家計管理から資産運用まで。<br className="md:hidden" />AIがあなたの「お金」を最適化します。
            </p>

            <div className="flex justify-center gap-4 flex-wrap">
              <button
                onClick={handleRiskClick}
                className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition shadow-lg shadow-orange-500/30 flex items-center gap-2 hover:-translate-y-1"
              >
                <Sparkles size={18} /> 無料AI診断
              </button>
              <button
                onClick={() => setIsLoanModalOpen(true)}
                className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl font-bold transition backdrop-blur-md flex items-center gap-2"
              >
                <Calculator size={18} /> シミュレーション
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Quick Menu (8개 아이콘) */}
      <div className="max-w-6xl mx-auto px-4 -mt-16 relative z-20 mb-12">
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl p-6 md:p-8 border border-slate-100 dark:border-slate-800 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-4 md:gap-6">
          {quickMenu.map((menu) => (
            <button
              key={menu.id}
              onClick={() => navigate(menu.link)}
              className="flex flex-col items-center gap-2 group w-full"
            >
              <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl ${menu.bg} ${menu.color} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                {menu.icon}
              </div>
              <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{menu.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 広告バナー */}
      <div className="max-w-6xl mx-auto px-4 mb-8">
        <AdBanner variant="horizontal" />
      </div>

      {/* 3. 카드 추천 섹션 */}
      <section className="max-w-7xl mx-auto px-4 mb-16">
        <div className="flex items-center justify-between mb-6 px-2">
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="text-orange-500" /> クレジットカード比較
          </h2>
          <button onClick={() => navigate('/products?category=cards')} className="text-xs font-bold text-slate-400 hover:text-orange-500 flex items-center gap-1">
            すべて見る <ChevronRight size={14} />
          </button>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide px-2">
          {recommendedCards.map((card) => (
            <div key={card.id} className="min-w-[280px] bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-md border border-slate-100 dark:border-slate-800 hover:shadow-xl transition-all duration-300 group cursor-pointer">
              <div className={`h-32 rounded-2xl bg-gradient-to-br ${card.img} mb-4 relative overflow-hidden shadow-inner group-hover:scale-105 transition-transform duration-500`}>
                <div className="absolute top-4 left-4 text-white/80 font-bold italic text-lg">{card.name}</div>
                <div className="absolute bottom-4 right-4 text-white/60 text-xs">0000 0000 0000</div>
                <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white/20 rounded-full blur-xl" />
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-slate-400 font-bold mb-1">ポイント還元率</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{card.point}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 font-bold mb-1">年会費</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{card.fee}</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/products?category=cards')}
                className="w-full mt-4 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-xl font-bold text-sm opacity-0 group-hover:opacity-100 transition-opacity"
              >
                詳細を見る
              </button>
            </div>
          ))}
          <div onClick={() => navigate('/products?category=cards')} className="min-w-[100px] flex items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition">
            <div className="text-center">
              <div className="w-10 h-10 bg-white dark:bg-slate-600 rounded-full flex items-center justify-center shadow-sm mx-auto mb-2 text-slate-400">
                <ArrowRight size={20} />
              </div>
              <span className="text-xs font-bold text-slate-400">もっと見る</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. 대출 & 금융 계산기 */}
      <section className="max-w-7xl mx-auto px-4 mb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-slate-900 p-8 rounded-[2.5rem] border border-indigo-100 dark:border-indigo-900/50 relative overflow-hidden group cursor-pointer" onClick={() => setIsLoanModalOpen(true)}>
            <div className="relative z-10">
              <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded mb-3 inline-block">住宅ローン</span>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">借り換えシミュレーション</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-6">今の金利と比べるだけで、<br />数百万円お得になる可能性があります。</p>
              <div className="flex items-center gap-4">
                <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-xl shadow-sm border border-indigo-100 dark:border-indigo-900/50">
                  <p className="text-[10px] text-slate-400 font-bold">最安金利</p>
                  <p className="text-xl font-black text-indigo-600">0.29%~</p>
                </div>
                <button className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition">
                  <ArrowRight size={20} />
                </button>
              </div>
            </div>
            <Home size={120} className="absolute -right-4 -bottom-4 text-indigo-100 dark:text-indigo-900/30 group-hover:rotate-12 transition-transform duration-500" />
          </div>

          <div className="bg-gradient-to-br from-pink-50 to-white dark:from-pink-900/20 dark:to-slate-900 p-8 rounded-[2.5rem] border border-pink-100 dark:border-pink-900/50 relative overflow-hidden group cursor-pointer" onClick={() => setIsInvestModalOpen(true)}>
            <div className="relative z-10">
              <span className="bg-pink-500 text-white text-[10px] font-bold px-2 py-1 rounded mb-3 inline-block">積立投資</span>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">将来の資産を計算</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-6">毎月3万円を20年間積み立てると、<br />いくらになるかチェック！</p>
              <div className="flex items-center gap-4">
                <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-xl shadow-sm border border-pink-100 dark:border-pink-900/50">
                  <p className="text-[10px] text-slate-400 font-bold">税制優遇対象</p>
                  <p className="text-xl font-black text-pink-500">NISA活用</p>
                </div>
                <button className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition">
                  <ArrowRight size={20} />
                </button>
              </div>
              <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                ※ 税制優遇は制度条件・非課税枠・運用期間により異なります。制度変更となる場合があります。
              </p>
            </div>
            <PiggyBank size={120} className="absolute -right-4 -bottom-4 text-pink-100 dark:text-pink-900/30 group-hover:rotate-12 transition-transform duration-500" />
          </div>
        </div>
      </section>

      {/* 5. 라이프 스테이지별 제안 */}
      <section className="max-w-7xl mx-auto px-4 mb-20">
        <h2 className="text-xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <Briefcase className="text-blue-500" /> ライフイベントから探す
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { title: '家を買う', icon: '🏠', desc: '住宅ローン・保険', color: 'hover:bg-indigo-50 hover:border-indigo-200 dark:hover:bg-indigo-900/20 dark:hover:border-indigo-800' },
            { title: '老後に備える', icon: '👴', desc: 'iDeCo・年金', color: 'hover:bg-emerald-50 hover:border-emerald-200 dark:hover:bg-emerald-900/20 dark:hover:border-emerald-800' },
            { title: '子供の教育', icon: '🎓', desc: '学資保険・積立', color: 'hover:bg-blue-50 hover:border-blue-200 dark:hover:bg-blue-900/20 dark:hover:border-blue-800' },
            { title: '旅行に行く', icon: '✈️', desc: 'マイル・保険', color: 'hover:bg-sky-50 hover:border-sky-200 dark:hover:bg-sky-900/20 dark:hover:border-sky-800' },
          ].map((item, idx) => (
            <div key={idx} className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 transition-all cursor-pointer flex items-center gap-4 group ${item.color}`}>
              <span className="text-3xl group-hover:scale-125 transition-transform duration-300">{item.icon}</span>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{item.title}</h3>
                <p className="text-[10px] text-slate-400 font-bold">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 広告バナー */}
      <div className="max-w-7xl mx-auto px-4 mb-12">
        <AdBanner variant="horizontal" />
      </div>

      {/* 6. 投資信託ランキング */}
      <section className="max-w-7xl mx-auto px-4 mb-16">
        <div className="bg-slate-50 dark:bg-slate-900 rounded-[2.5rem] p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Trophy className="text-yellow-500" /> 投資信託ランキング
            </h2>
            <button onClick={() => navigate('/funds')} className="text-xs font-bold text-slate-400 hover:text-orange-500">もっと見る</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {FUND_RANKING.map((fund, i) => (
              <button
                key={fund.id}
                onClick={() => setSelectedFundId((prev) => (prev === fund.id ? '' : fund.id))}
                className={`bg-white dark:bg-slate-800 rounded-xl border p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/60 transition ${
                  selectedFundId === fund.id
                    ? 'border-blue-400 dark:border-blue-500 ring-2 ring-blue-200/70 dark:ring-blue-900/40'
                    : 'border-slate-100 dark:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className={`text-sm font-black ${
                    i === 0 ? 'text-yellow-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-500' : 'text-slate-500'
                  }`}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs leading-snug line-clamp-2">
                      {fund.name}
                    </h3>
                    <div className="flex items-center justify-between mt-1 text-[10px]">
                      <span className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-1.5 py-0.5 rounded">
                    {fund.cat}
                  </span>
                      <span className="text-red-500 font-black">{fund.ret}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {selectedFundId ? (
            <div className="mt-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-black text-slate-800 dark:text-slate-200">
                  {(FUND_RANKING.find((f) => f.id === selectedFundId)?.name || '選択中ファンド')} - 1年収益推移
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400">単位: %</span>
                  <button
                    onClick={() => navigate(`/funds/${selectedFundId}`)}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-500 dark:text-blue-300 dark:hover:text-blue-200 inline-flex items-center gap-1"
                  >
                    詳細を見る <ChevronRight size={12} />
                  </button>
                </div>
              </div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={FUND_TREND[selectedFundId] || []} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fundTrendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="m" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}%`, '累積収益']} />
                    <Area type="monotone" dataKey="r" stroke="#3b82f6" strokeWidth={2} fill="url(#fundTrendFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <LoanSimulatorModal isOpen={isLoanModalOpen} onClose={() => setIsLoanModalOpen(false)} />
      <InvestSimulatorModal isOpen={isInvestModalOpen} onClose={() => setIsInvestModalOpen(false)} />
      <RiskModal isOpen={isRiskModalOpen} onClose={() => setIsRiskModalOpen(false)} onNavigate={navigate} />
    </div>
  )
}
