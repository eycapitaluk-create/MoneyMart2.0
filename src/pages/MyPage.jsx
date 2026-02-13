import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PieChart, Wallet, CreditCard, TrendingUp, TrendingDown,
  AlertTriangle, ShieldCheck, ChevronRight, Bell, Settings,
  LogOut, Crown, ArrowUpRight, Zap, Coins,
  FileText, Home, PiggyBank, Smartphone, Star, X, Loader2, Trash2
} from 'lucide-react'
import {
  Cell, Pie, ResponsiveContainer, Tooltip,
  PieChart as RechartsPieChart, AreaChart, Area, XAxis, YAxis, CartesianGrid
} from 'recharts'
import { supabase } from '../lib/supabase'
import {
  loadMyPageData,
  addExpense,
  deleteExpenseById,
  addInsurance,
  deleteInsuranceById,
  saveFinanceProfile,
  addPointAccount,
  deletePointAccountById,
  addAssetPosition,
  updateAssetPosition,
  deleteAssetPositionById,
} from '../lib/myPageApi'
import { calculateRiskScore } from '../simulators/engine/riskEngine'
import { LEGAL_NOTICE_TEMPLATES } from '../constants/legalNoticeTemplates'

const PORTFOLIO = [
  { id: 1, name: 'Fund A (Global Tech)', value: 1250000, invest: 1000000, return: 25.0, color: '#3b82f6' },
  { id: 2, name: 'Fund B (Bond Mix)', value: 925000, invest: 1000000, return: -7.5, color: '#ef4444' },
  { id: 3, name: 'Fund C (REITs)', value: 105000, invest: 100000, return: 5.0, color: '#10b981' },
]

const DEFAULT_WATCHLIST = [
  { id: 'emaxis-all', name: 'eMAXIS Slim 全世界株式', change: 25.0, trend: 'up' },
  { id: 'himuchi-plus', name: 'ひふみプラス', change: -10.0, trend: 'down' },
  { id: 'raku-eco', name: '楽天・全米株式', change: 5.0, trend: 'up' },
]

const BUDGET_DATA = [
  { name: '食費', value: 5000, color: '#f97316' },
  { name: 'ショッピング', value: 3000, color: '#8b5cf6' },
  { name: 'その他', value: 0, color: '#cbd5e1' },
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

const calcMonthlyPayment = (principal, annualRatePct, years) => {
  const monthlyRate = (annualRatePct / 100) / 12
  const months = years * 12
  if (principal <= 0 || months <= 0) return 0
  if (monthlyRate <= 0) return principal / months
  const factor = Math.pow(1 + monthlyRate, months)
  return (principal * monthlyRate * factor) / (factor - 1)
}

const buildAiSummaryReport = ({ totalReturnRate, dti, concentration, bestReturn }) => {
  const marketTone = totalReturnRate >= 8 ? '順調' : totalReturnRate >= 3 ? '中立' : '慎重'
  const riskScoreResult = calculateRiskScore({
    volatilityRisk: concentration,
    breadthRisk: Math.min(100, dti * 2),
    flowRisk: Math.max(0, 50 - totalReturnRate),
    fxRisk: 45,
  })
  const riskLevel = riskScoreResult.score >= 70 ? '低め' : riskScoreResult.score >= 40 ? '中程度' : 'やや高め'

  const actions = [
    concentration >= 55
      ? '単一テーマ集中が高めです。低相関アセットを10〜15%追加して分散を強化。'
      : '現状の分散は良好です。定期積立ルールを維持し、急な比率変更を避ける。',
    dti >= 35
      ? '返済負担率が高めです。新規投資額より先に返済余力の確保を優先。'
      : '負債比率は許容範囲です。積立比率の最適化に集中できます。',
    bestReturn >= 20
      ? '高リターン銘柄の利益確定ルール（例: +25%で一部利確）を設定。'
      : 'リターン改善余地あり。低コスト商品中心に積立額を段階的に増額。',
  ]

  const confidence = riskScoreResult.score >= 70 ? '高' : riskScoreResult.score >= 40 ? '中' : '中'

  return {
    marketTone,
    riskLevel,
    confidence,
    riskScore: riskScoreResult.score,
    riskStatus: riskScoreResult.status,
    actions,
  }
}

const LoanApprovalDiagnosisModal = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(0)
  const [score, setScore] = useState(0)
  const [answers, setAnswers] = useState([])
  const [result, setResult] = useState(null)

  const questions = [
    {
      category: '収入',
      q: '現在の雇用形態は？',
      options: [
        { text: '正社員（勤続3年以上）', score: 5, reason: '雇用の継続性が高い' },
        { text: '正社員（勤続1年以上）/契約社員', score: 3, reason: '雇用の安定性は中程度' },
        { text: '自営業・フリーランス（収入変動あり）', score: 2, reason: '収入変動リスクがある' },
        { text: '無職・収入不安定', score: 0, reason: '返済原資の証明が難しい' },
      ],
    },
    {
      category: '収入',
      q: '年収レンジは？',
      options: [
        { text: '800万円以上', score: 5, reason: '返済余力が高い' },
        { text: '500〜799万円', score: 4, reason: '返済余力は十分' },
        { text: '300〜499万円', score: 2, reason: '返済余力は限定的' },
        { text: '300万円未満', score: 0, reason: '返済余力が不足しやすい' },
      ],
    },
    {
      category: '負債',
      q: '現在の返済負担率（DTI）は？',
      options: [
        { text: '20%未満', score: 5, reason: 'DTIが低く審査で有利' },
        { text: '20〜30%', score: 3, reason: '標準的な返済負担率' },
        { text: '30〜35%', score: 2, reason: '返済負担がやや高い' },
        { text: '35%以上', score: 0, reason: '返済比率が高く否決要因になりやすい' },
      ],
    },
    {
      category: '信用',
      q: '過去24ヶ月で延滞はありましたか？',
      options: [
        { text: '延滞なし', score: 5, reason: '支払い履歴が良好' },
        { text: '1回のみ（軽微）', score: 2, reason: '軽微な遅延履歴がある' },
        { text: '複数回ある', score: 0, reason: '延滞履歴が審査に強く影響' },
      ],
    },
    {
      category: '信用',
      q: '過去6ヶ月のローン申込み回数は？',
      options: [
        { text: '0〜1回', score: 4, reason: '短期多重申込リスクが低い' },
        { text: '2〜3回', score: 2, reason: '申込件数がやや多い' },
        { text: '4回以上', score: 0, reason: '短期多重申込の懸念がある' },
      ],
    },
    {
      category: '資産',
      q: '生活防衛資金（3〜6ヶ月分）はありますか？',
      options: [
        { text: '十分にある', score: 4, reason: '不測時の返済継続力が高い' },
        { text: '一部ある', score: 2, reason: '一定のバッファはある' },
        { text: 'ほぼない', score: 0, reason: '緊急時の返済余力が不足' },
      ],
    },
    {
      category: '属性',
      q: '頭金（または自己資金）はどの程度ありますか？',
      options: [
        { text: '借入額の20%以上', score: 4, reason: '自己資金比率が高く与信にプラス' },
        { text: '借入額の10〜20%', score: 2, reason: '自己資金は平均的' },
        { text: '10%未満', score: 0, reason: '借入依存度が高い' },
      ],
    },
    {
      category: '最終確認',
      q: '健康状態・勤務先情報の提出に問題はありませんか？',
      options: [
        { text: '問題なし', score: 3, reason: '必要書類の整備が見込める' },
        { text: '一部不明点あり', score: 1, reason: '追加確認が必要になる可能性' },
        { text: '提出が難しい項目がある', score: 0, reason: '審査手続きの遅延・否決リスク' },
      ],
    },
  ]

  const buildResult = (total, answerList) => {
    const max = 35
    const normalized = Math.max(0, Math.min(1, total / max))
    const prob = Math.round(35 + normalized * 60) // 35% ~ 95%
    const margin = Math.max(5, 13 - Math.round(normalized * 6))
    const confidenceLow = Math.max(0, prob - margin)
    const confidenceHigh = Math.min(100, prob + margin)
    const isGood = prob >= 70
    const reasons = [...answerList]
      .sort((a, b) => (isGood ? b.score - a.score : a.score - b.score))
      .slice(0, 3)
      .map((item) => item.reason)

    if (prob >= 80) return { prob, label: '高め', color: 'text-emerald-500', confidenceLow, confidenceHigh, reasons }
    if (prob >= 60) return { prob, label: '標準', color: 'text-amber-500', confidenceLow, confidenceHigh, reasons }
    return { prob, label: '要改善', color: 'text-red-500', confidenceLow, confidenceHigh, reasons }
  }

  const handleAnswer = (option) => {
    const question = questions[step - 1]
    const newScore = score + option.score
    const newAnswers = [...answers, { score: option.score, reason: `${question.category}: ${option.reason}` }]
    setScore(newScore)
    setAnswers(newAnswers)

    if (step < questions.length) {
      setStep(step + 1)
    } else {
      setStep(9)
      setTimeout(() => {
        setResult(buildResult(newScore, newAnswers))
        setStep(10)
      }, 1200)
    }
  }

  const reset = () => {
    setStep(0)
    setScore(0)
    setAnswers([])
    setResult(null)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden relative min-h-[500px] flex flex-col border border-slate-200 dark:border-slate-800">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition z-10">
          <X size={24} className="text-slate-400" />
        </button>

        {step === 0 && (
          <div className="p-10 text-center flex-1 flex flex-col justify-center">
            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldCheck size={40} />
            </div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4">ローン承認可能性診断</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-8">
              8つの質問で、現在の属性ベースの<br />
              <span className="text-blue-500 font-bold">承認可能性の目安</span>を表示します。<br />
              <span className="text-[11px] text-slate-400 font-bold mt-2 block bg-slate-100 dark:bg-slate-800 py-1 px-3 rounded-full w-fit mx-auto">
                参考値です。審査結果を保証するものではありません。
              </span>
            </p>
            <button onClick={() => setStep(1)} className="w-full py-4 bg-slate-900 dark:bg-slate-100 hover:bg-black dark:hover:bg-white text-white dark:text-slate-900 font-bold rounded-2xl shadow-lg transition transform hover:scale-[1.02]">
              診断スタート
            </button>
          </div>
        )}

        {step >= 1 && step <= 8 && (
          <div className="p-8 flex-1 flex flex-col">
            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">質問 {step}/8</span>
                <span className="text-xs font-bold text-blue-500">{Math.round((step / 8) * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out" style={{ width: `${(step / 8) * 100}%` }} />
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <span className="text-xs font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full w-fit mb-4">{questions[step - 1].category}</span>
              <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mb-8 leading-snug">{questions[step - 1].q}</h3>
              <div className="space-y-3">
                {questions[step - 1].options.map((opt, i) => (
                  <button key={i} onClick={() => handleAnswer(opt)} className="w-full p-5 text-left bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition group flex justify-between items-center hover:shadow-md">
                    <span className="font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-900 dark:group-hover:text-blue-400 text-sm md:text-base">{opt.text}</span>
                    <ChevronRight className="text-slate-300 group-hover:text-blue-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 9 && (
          <div className="p-12 text-center flex-1 flex flex-col justify-center items-center">
            <Loader2 className="text-blue-500 animate-spin mb-6" size={40} />
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">診断中...</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">入力データを解析しています</p>
          </div>
        )}

        {step === 10 && result && (
          <div className="bg-slate-50 dark:bg-slate-950 h-full animate-slideUp overflow-y-auto p-8">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800">
              <p className="text-xs font-bold text-slate-400 mb-2">ローン承認可能性（推定）</p>
              <div className="flex items-end gap-3 mb-2">
                <span className={`text-5xl font-black ${result.color}`}>{result.prob}%</span>
                <span className={`text-sm font-bold mb-2 ${result.color}`}>{result.label}</span>
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-4">
                信頼区間: {result.confidenceLow}% - {result.confidenceHigh}%
              </p>
              <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                <p className="text-xs font-black text-slate-500 mb-2">判定理由 Top 3</p>
                <ul className="space-y-2">
                  {result.reasons.map((reason, idx) => (
                    <li key={idx} className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {idx + 1}. {reason}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-4">{LEGAL_NOTICE_TEMPLATES.loan}</p>
            </div>
            <button onClick={reset} className="w-full mt-6 py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-2xl shadow-lg transition">
              もう一度診断する
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const SummarySection = ({
  watchlistCount,
  user,
  insuranceSummary,
  portfolio = PORTFOLIO,
  summaryDti = DEBT_INFO.dti,
  isMockMode = false,
}) => {
  const navigate = useNavigate()
  const [reportGeneratedAt, setReportGeneratedAt] = useState(new Date())
  const [savedReport, setSavedReport] = useState(null)
  const [reportSaving, setReportSaving] = useState(false)
  const [reportStatus, setReportStatus] = useState('')
  const totalInvested = portfolio.reduce((acc, item) => acc + item.invest, 0)
  const totalCurrentValue = portfolio.reduce((acc, item) => acc + item.value, 0)
  const totalPnL = totalCurrentValue - totalInvested
  const totalReturnRate = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0
  const bestReturn = portfolio.length > 0 ? Math.max(...portfolio.map((item) => item.return)) : 0
  const concentration = totalCurrentValue > 0 && portfolio.length > 0
    ? Math.max(...portfolio.map((item) => (item.value / totalCurrentValue) * 100))
    : 0
  const generatedReport = buildAiSummaryReport({ totalReturnRate, dti: summaryDti, concentration, bestReturn })
  const aiReport = savedReport || generatedReport

  useEffect(() => {
    let alive = true
    const loadLatestReport = async () => {
      try {
        const { data, error } = await supabase
          .from('ai_reports')
          .select('payload,created_at')
          .eq('user_id', user?.id)
          .eq('report_type', 'summary')
          .order('created_at', { ascending: false })
          .limit(1)
        if (error) throw error

        const latest = data?.[0]
        if (latest?.payload?.report && alive) {
          setSavedReport(latest.payload.report)
          setReportGeneratedAt(new Date(latest.created_at))
          setReportStatus('保存済みレポートを表示中')
        }
      } catch {
        if (alive) setReportStatus('ローカル生成レポートを表示中')
      }
    }

    loadLatestReport()
    return () => {
      alive = false
    }
  }, [user?.id])

  const handleRegenerateReport = async () => {
    const nextReport = buildAiSummaryReport({
      totalReturnRate,
      dti: summaryDti,
      concentration,
      bestReturn,
    })
    const now = new Date()

    setSavedReport(nextReport)
    setReportGeneratedAt(now)
    setReportStatus('再生成済み（保存中...）')
    setReportSaving(true)

    try {
      if (!user?.id) {
        setReportStatus('ログイン情報が見つからないため保存できません')
        return
      }

      const { error } = await supabase
        .from('ai_reports')
        .insert({
          user_id: user.id,
          report_type: 'summary',
          payload: {
            generated_at: now.toISOString(),
            metrics: {
              total_return_rate: Number(totalReturnRate.toFixed(2)),
              dti: Number(summaryDti.toFixed(2)),
              concentration: Number(concentration.toFixed(2)),
              best_return: Number(bestReturn.toFixed(2)),
            },
            report: nextReport,
          },
        })
      if (error) throw error
      setReportStatus('再生成して保存しました')
    } catch {
      setReportStatus('再生成しました（DB保存は未完了）')
    } finally {
      setReportSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp size={18} className="text-indigo-500" /> 総合レポート
              </h3>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4">
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-500 mb-1">投資元本</p>
                <p className="text-xl md:text-2xl 2xl:text-[2rem] font-black text-slate-900 dark:text-white leading-tight whitespace-nowrap tracking-tight">¥{totalInvested.toLocaleString()}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-500 mb-1">現在価値</p>
                <p className="text-xl md:text-2xl 2xl:text-[2rem] font-black text-slate-900 dark:text-white leading-tight whitespace-nowrap tracking-tight">¥{totalCurrentValue.toLocaleString()}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-500 mb-1">総損益</p>
                <p className={`text-xl md:text-2xl 2xl:text-[2rem] font-black leading-tight whitespace-nowrap tracking-tight ${totalPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {totalPnL >= 0 ? '+' : ''}¥{totalPnL.toLocaleString()}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-500 mb-1">損益率</p>
                <p className={`text-xl md:text-2xl 2xl:text-[2rem] font-black leading-tight whitespace-nowrap tracking-tight ${totalReturnRate >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {totalReturnRate >= 0 ? '+' : ''}{totalReturnRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
              <h4 className="font-black text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <TrendingUp size={16} className="text-indigo-500" /> ファンド概要
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">保有銘柄数</span>
                  <span className="font-black text-slate-900 dark:text-white">{portfolio.length}銘柄</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ウォッチリスト</span>
                  <span className="font-black text-slate-900 dark:text-white">{watchlistCount}銘柄</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">最高リターン</span>
                  <span className="font-black text-green-600 dark:text-green-400">+{bestReturn.toFixed(1)}%</span>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
              <h4 className="font-black text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <ShieldCheck size={16} className="text-emerald-500" /> 保険概要
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">登録保険数</span>
                  <span className="font-black text-slate-900 dark:text-white">{insuranceSummary.registered}件</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">満期間近</span>
                  <span className="font-black text-slate-900 dark:text-white">{insuranceSummary.expiringSoon}件</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">負債比率 (DTI)</span>
                  <span className="font-black text-slate-900 dark:text-white">{Number(summaryDti).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60">
              <h3 className="font-black text-slate-900 dark:text-white">銘柄別パフォーマンス</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/40">
                  <tr className="text-left text-slate-500 text-xs uppercase tracking-wider">
                    <th className="px-5 py-3">銘柄名</th>
                    <th className="px-5 py-3 text-right">投資額</th>
                    <th className="px-5 py-3 text-right">現在価値</th>
                    <th className="px-5 py-3 text-right">損益</th>
                    <th className="px-5 py-3 text-right">損益率</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.length === 0 && (
                    <tr className="border-t border-slate-100 dark:border-slate-800">
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                        登録済みの投資資産がありません。資産運用タブで追加してください。
                      </td>
                    </tr>
                  )}
                  {portfolio.map((fund) => {
                    const pnl = fund.value - fund.invest
                    const pnlRate = fund.invest > 0 ? (pnl / fund.invest) * 100 : 0
                    return (
                      <tr key={fund.id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-5 py-4 font-bold text-slate-800 dark:text-slate-200">{fund.name}</td>
                        <td className="px-5 py-4 text-right font-semibold text-slate-700 dark:text-slate-300">¥{fund.invest.toLocaleString()}</td>
                        <td className="px-5 py-4 text-right font-semibold text-slate-900 dark:text-white">¥{fund.value.toLocaleString()}</td>
                        <td className={`px-5 py-4 text-right font-black ${pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {pnl >= 0 ? '+' : ''}¥{pnl.toLocaleString()}
                        </td>
                        <td className={`px-5 py-4 text-right font-black ${pnlRate >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {pnlRate >= 0 ? '+' : ''}{pnlRate.toFixed(1)}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="xl:col-span-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <PieChart size={18} className="text-indigo-500" /> 資産配分
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie data={portfolio} dataKey="value" nameKey="name" outerRadius={90} innerRadius={50} paddingAngle={2}>
                    {portfolio.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `¥${Number(value).toLocaleString()}`} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-2">
              {portfolio.map((fund) => {
                const weight = totalCurrentValue > 0 ? (fund.value / totalCurrentValue) * 100 : 0
                return (
                  <div key={fund.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: fund.color }} />
                      <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{fund.name}</span>
                    </div>
                    <span className="font-black text-slate-900 dark:text-white">{weight.toFixed(0)}%</span>
                  </div>
                )
              })}
            </div>
            <button
              onClick={() => navigate('/funds')}
              className="w-full mt-5 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black rounded-xl hover:opacity-90 transition flex items-center justify-center gap-2"
            >
              詳細アセット分析 <ArrowUpRight size={14} />
            </button>
            <p className="text-[10px] text-slate-400 mt-3">
              {isMockMode
                ? '※ 現在は表示用データです。Supabase連携後に実データへ切り替わります。'
                : '※ 表示データはユーザー保存情報をもとに更新されます。'}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 mt-4">
            <h4 className="text-sm font-black text-slate-900 dark:text-white mb-2">クイックインサイト</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              現在はファンド中心の構成です。リスクを抑えたい場合は、値動きの異なる資産の比率を高めると変動幅の平準化が期待できます。
            </p>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl border border-slate-700 shadow-sm p-5 mt-4">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h4 className="text-sm font-black flex items-center gap-2">
                  <Zap size={16} className="text-yellow-400 fill-yellow-400" /> AI リポート（Beta）
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  最終更新: {reportGeneratedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </p>
                {reportStatus && <p className="text-[10px] text-slate-500 mt-1">{reportStatus}</p>}
              </div>
              <button
                onClick={handleRegenerateReport}
                disabled={reportSaving}
                className="text-[11px] font-bold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg border border-white/20 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {reportSaving ? '保存中...' : '再生成'}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              <div className="bg-white/10 rounded-lg p-2">
                <p className="text-[10px] text-slate-300">市場トーン</p>
                <p className="font-black text-sm">{aiReport.marketTone}</p>
              </div>
              <div className="bg-white/10 rounded-lg p-2">
                <p className="text-[10px] text-slate-300">ポートフォリオリスク</p>
                <p className="font-black text-sm">{aiReport.riskLevel}</p>
              </div>
              <div className="bg-white/10 rounded-lg p-2">
                <p className="text-[10px] text-slate-300">リスクスコア</p>
                <p className="font-black text-sm">{aiReport.riskScore || '-'} /100</p>
              </div>
              <div className="bg-white/10 rounded-lg p-2">
                <p className="text-[10px] text-slate-300">信頼度</p>
                <p className="font-black text-sm">{aiReport.confidence}</p>
              </div>
            </div>

            <div className="space-y-2">
              {aiReport.actions.map((action, idx) => (
                <p key={idx} className="text-xs leading-relaxed text-slate-200 bg-white/5 border border-white/10 rounded-lg p-2.5">
                  {idx + 1}. {action}
                </p>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-3">※ {LEGAL_NOTICE_TEMPLATES.investment}</p>
          </div>
        </div>
      </div>

    </div>
  )
}

const WealthSection = ({
  watchlistItems,
  productInterests = [],
  portfolio = PORTFOLIO,
  isMockMode = false,
  onRemoveWatchlist,
  canEditAssets = false,
  onAddAsset,
  onUpdateAsset,
  onDeleteAsset,
}) => {
  const navigate = useNavigate()
  const normalizedWatchlist = Array.isArray(watchlistItems) && watchlistItems.length > 0
    ? watchlistItems
    : (isMockMode ? DEFAULT_WATCHLIST : [])
  const [showAssetForm, setShowAssetForm] = useState(false)
  const [editingAssetId, setEditingAssetId] = useState('')
  const [assetForm, setAssetForm] = useState({ name: '', value: '', invest: '', color: '#3b82f6' })

  const startEditAsset = (fund) => {
    setEditingAssetId(String(fund.id))
    setAssetForm({
      name: fund.name,
      value: String(Math.round(Number(fund.value || 0))),
      invest: String(Math.round(Number(fund.invest || 0))),
      color: fund.color || '#3b82f6',
    })
  }

  const resetAssetForm = () => {
    setShowAssetForm(false)
    setEditingAssetId('')
    setAssetForm({ name: '', value: '', invest: '', color: '#3b82f6' })
  }

  const submitAsset = async () => {
    const valueNum = Number(assetForm.value || 0)
    const investNum = Number(assetForm.invest || 0)
    if (!assetForm.name.trim() || !Number.isFinite(valueNum) || !Number.isFinite(investNum)) {
      alert('資産名・評価額・投資額を入力してください。')
      return
    }
    if (editingAssetId) {
      await onUpdateAsset?.({
        id: editingAssetId,
        name: assetForm.name.trim(),
        current_value: Math.max(0, valueNum),
        invest_value: Math.max(0, investNum),
        color: assetForm.color || '#3b82f6',
      })
    } else {
      await onAddAsset?.({
        name: assetForm.name.trim(),
        current_value: Math.max(0, valueNum),
        invest_value: Math.max(0, investNum),
        color: assetForm.color || '#3b82f6',
      })
    }
    resetAssetForm()
  }

  return (
    <div className="space-y-8">
    <div className="grid md:grid-cols-2 gap-8">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-500" /> 現在の投資
          </h3>
          {canEditAssets && (
            <button
              onClick={() => setShowAssetForm((prev) => !prev)}
              className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full"
            >
              + 資産を追加
            </button>
          )}
        </div>
        {canEditAssets && showAssetForm && (
          <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 p-3 grid grid-cols-2 gap-2">
            <input value={assetForm.name} onChange={(e) => setAssetForm((p) => ({ ...p, name: e.target.value }))} placeholder="資産名" className="col-span-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm" />
            <input type="number" value={assetForm.value} onChange={(e) => setAssetForm((p) => ({ ...p, value: e.target.value }))} placeholder="評価額" className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm" />
            <input type="number" value={assetForm.invest} onChange={(e) => setAssetForm((p) => ({ ...p, invest: e.target.value }))} placeholder="投資額" className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm" />
            <input type="color" value={assetForm.color} onChange={(e) => setAssetForm((p) => ({ ...p, color: e.target.value }))} className="h-10 w-full rounded-lg bg-slate-50 dark:bg-slate-800" />
            <div className="flex items-center gap-2">
              <button onClick={submitAsset} className="flex-1 py-2 rounded-lg bg-blue-500 text-white text-xs font-bold">
                {editingAssetId ? '更新' : '追加'}
              </button>
              <button onClick={resetAssetForm} className="flex-1 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs font-bold">
                キャンセル
              </button>
            </div>
          </div>
        )}
        <div className="space-y-4">
          {portfolio.length === 0 && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400">
              投資資産がまだありません。右上の「+ 資産を追加」から登録してください。
            </div>
          )}
          {portfolio.map((fund) => (
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
              {canEditAssets && fund.source === 'db' && (
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    onClick={() => startEditAsset(fund)}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-500"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => onDeleteAsset?.(fund.id)}
                    className="text-[11px] font-bold text-red-600 hover:text-red-500"
                  >
                    削除
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <Star size={20} className="text-yellow-400 fill-yellow-400" /> ファンドウォッチリスト
        </h3>
        <div className="space-y-3">
          {normalizedWatchlist.map((item) => (
            <div key={item.id} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition group">
              <button
                onClick={() => navigate(`/funds/${item.id}`)}
                className="flex-1 min-w-0 text-left"
              >
                <span className="font-bold text-slate-700 dark:text-slate-300 text-sm group-hover:text-orange-500 transition block truncate">{item.name}</span>
              </button>
              <div className="flex items-center gap-2">
                <span className={`font-bold text-sm ${item.change >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                  {item.change > 0 ? '+' : ''}{item.change}%
                </span>
                {typeof onRemoveWatchlist === 'function' && (
                  <button
                    onClick={() => onRemoveWatchlist(item.id, item.name)}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500"
                    title="ウォッチリストから削除"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => navigate('/funds')}
          className="w-full mt-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-sm rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition"
        >
          + ウォッチリストを追加
        </button>
      </div>
    </div>

    <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
      <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <Star size={18} className="text-amber-500 fill-amber-500" /> 関心商品リスト
      </h3>
      {Array.isArray(productInterests) && productInterests.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-3">
          {productInterests.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(`/products/${item.id}`)}
              className="text-left p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{item.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {item.provider || '-'} {item.category ? `• ${item.category}` : ''}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          まだ保存された関心商品はありません。
        </p>
      )}
      <button
        onClick={() => navigate('/products')}
        className="w-full mt-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-sm rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition"
      >
        + 商品から関心リストを追加
      </button>
    </div>

    <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2 mb-2 text-orange-400 font-bold text-xs uppercase tracking-wider">
          <Crown size={14} /> プレミアムサービス
        </div>
        <h3 className="font-bold text-lg">週間ファンドレポート</h3>
        <p className="text-sm text-slate-400">今週の市場動向と推奨ポートフォリオ更新</p>
      </div>
              <button
                onClick={() => navigate('/academy')}
                className="bg-white text-slate-900 px-4 py-2 rounded-lg font-bold text-xs hover:bg-orange-50 transition"
              >
        レポートを読む
      </button>
    </div>
    </div>
  )
}

const BudgetSection = ({
  user,
  expenses = [],
  insurances = [],
  pointAccounts = [],
  budgetTargetYen = 200000,
  onSaveBudgetTarget,
  onAddExpense,
  onDeleteExpense,
  onAddInsurance,
  onDeleteInsurance,
  onAddPointAccount,
  onDeletePointAccount,
  expenseSaving = false,
  insuranceSaving = false,
  pointSaving = false,
}) => {
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseForm, setExpenseForm] = useState({
    category: '食費',
    merchant: '',
    amount: '',
    payment_method: '',
    spent_on: new Date().toISOString().slice(0, 10),
  })
  const [showInsuranceForm, setShowInsuranceForm] = useState(false)
  const [insuranceForm, setInsuranceForm] = useState({
    product_name: '',
    provider: '',
    monthly_premium: '',
    maturity_date: '',
    coverage_summary: '',
  })
  const [showPointForm, setShowPointForm] = useState(false)
  const [pointForm, setPointForm] = useState({
    name: '',
    balance: '',
    expiry: '',
  })
  const [budgetInput, setBudgetInput] = useState(String(budgetTargetYen))

  const toMonthKey = (dateStr) => {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return ''
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  const now = new Date()
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const thisMonthTotal = expenses
    .filter((e) => toMonthKey(e.spent_on) === currentMonthKey)
    .reduce((acc, e) => acc + Number(e.amount || 0), 0)
  const usedPct = budgetTargetYen > 0 ? Math.min(100, (thisMonthTotal / budgetTargetYen) * 100) : 0

  const trendData = (() => {
    const keys = []
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    const map = new Map(keys.map((k) => [k, 0]))
    expenses.forEach((e) => {
      const k = toMonthKey(e.spent_on)
      if (map.has(k)) map.set(k, map.get(k) + Number(e.amount || 0))
    })
    return keys.map((k) => ({ month: `${Number(k.split('-')[1])}月`, amount: map.get(k) || 0 }))
  })()

  const categorySeries = (() => {
    const colorMap = { 食費: '#f97316', ショッピング: '#8b5cf6', 交通: '#0ea5e9', その他: '#94a3b8' }
    const map = new Map()
    expenses
      .filter((e) => toMonthKey(e.spent_on) === currentMonthKey)
      .forEach((e) => {
        const cat = e.category || 'その他'
        map.set(cat, (map.get(cat) || 0) + Number(e.amount || 0))
      })
    const list = [...map.entries()].map(([name, value]) => ({
      name,
      value,
      color: colorMap[name] || '#94a3b8',
    }))
    return list.length > 0 ? list : BUDGET_DATA
  })()

  const recentExpenses = expenses.slice(0, 8)
  const pointTotal = pointAccounts.reduce((acc, p) => acc + Number(p.balance || 0), 0)
  const expiringPoints = pointAccounts
    .filter((p) => {
      if (!p.expiry) return false
      const diff = new Date(p.expiry).getTime() - Date.now()
      return diff >= 0 && diff <= 1000 * 60 * 60 * 24 * 30
    })
    .reduce((acc, p) => acc + Number(p.balance || 0), 0)

  const handleExpenseSubmit = async () => {
    if (!user?.id) return
    const amountNum = Number(expenseForm.amount || 0)
    if (!expenseForm.merchant.trim() || !Number.isFinite(amountNum) || amountNum <= 0) {
      alert('支出名と金額を入力してください。')
      return
    }
    await onAddExpense?.({
      user_id: user.id,
      spent_on: expenseForm.spent_on,
      category: expenseForm.category,
      merchant: expenseForm.merchant.trim(),
      amount: amountNum,
      payment_method: expenseForm.payment_method.trim(),
      notes: '',
    })
    setExpenseForm((prev) => ({ ...prev, merchant: '', amount: '', payment_method: '' }))
    setShowExpenseForm(false)
  }

  const handleInsuranceSubmit = async () => {
    if (!user?.id) return
    const premium = Number(insuranceForm.monthly_premium || 0)
    if (!insuranceForm.product_name.trim()) {
      alert('保険名を入力してください。')
      return
    }
    await onAddInsurance?.({
      user_id: user.id,
      product_name: insuranceForm.product_name.trim(),
      provider: insuranceForm.provider.trim(),
      monthly_premium: Number.isFinite(premium) ? Math.max(0, premium) : 0,
      maturity_date: insuranceForm.maturity_date || null,
      coverage_summary: insuranceForm.coverage_summary.trim(),
    })
    setInsuranceForm({
      product_name: '',
      provider: '',
      monthly_premium: '',
      maturity_date: '',
      coverage_summary: '',
    })
    setShowInsuranceForm(false)
  }

  const handlePointSubmit = async () => {
    if (!user?.id) return
    const balanceNum = Number(pointForm.balance || 0)
    if (!pointForm.name.trim() || !Number.isFinite(balanceNum) || balanceNum < 0) {
      alert('ポイント名と残高を入力してください。')
      return
    }
    await onAddPointAccount?.({
      user_id: user.id,
      name: pointForm.name.trim(),
      balance: balanceNum,
      expiry: pointForm.expiry || null,
    })
    setPointForm({ name: '', balance: '', expiry: '' })
    setShowPointForm(false)
  }

  useEffect(() => {
    setBudgetInput(String(budgetTargetYen))
  }, [budgetTargetYen])

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Wallet size={20} className="text-orange-500" /> 支出トラッカー
          </h3>
          <button
            onClick={() => setShowExpenseForm((prev) => !prev)}
            className="text-xs font-bold text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-3 py-1 rounded-full"
          >
            + 支出を追加
          </button>
        </div>

        {showExpenseForm && (
          <div className="mb-5 rounded-xl border border-slate-200 dark:border-slate-700 p-3 grid grid-cols-2 gap-2">
            <input value={expenseForm.merchant} onChange={(e) => setExpenseForm((p) => ({ ...p, merchant: e.target.value }))} placeholder="支出名" className="col-span-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm" />
            <input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))} placeholder="金額" className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm" />
            <select value={expenseForm.category} onChange={(e) => setExpenseForm((p) => ({ ...p, category: e.target.value }))} className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm">
              <option value="食費">食費</option>
              <option value="ショッピング">ショッピング</option>
              <option value="交通">交通</option>
              <option value="その他">その他</option>
            </select>
            <input type="date" value={expenseForm.spent_on} onChange={(e) => setExpenseForm((p) => ({ ...p, spent_on: e.target.value }))} className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm" />
            <input value={expenseForm.payment_method} onChange={(e) => setExpenseForm((p) => ({ ...p, payment_method: e.target.value }))} placeholder="支払い手段 (任意)" className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm" />
            <button onClick={handleExpenseSubmit} disabled={expenseSaving} className="col-span-2 py-2 rounded-lg bg-orange-500 text-white text-sm font-bold disabled:opacity-60">
              {expenseSaving ? '保存中...' : '支出を追加'}
            </button>
          </div>
        )}

        <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-2xl border border-green-100 dark:border-green-900/50 mb-8">
          <div className="flex justify-between items-end mb-2">
            <div>
              <p className="text-xs text-green-600 dark:text-green-400 font-bold mb-1">今月の支出</p>
              <p className="text-3xl font-black text-green-700 dark:text-green-400">¥{thisMonthTotal.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-green-600 dark:text-green-400 font-bold mb-1">予算目標</p>
            <p className="text-lg font-bold text-green-700 dark:text-green-400">¥{budgetTargetYen.toLocaleString()}</p>
            </div>
          </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 text-sm"
            placeholder="予算目標(円)"
          />
          <button
            onClick={() => onSaveBudgetTarget?.(Number(budgetInput || 0))}
            className="px-3 py-2 rounded-lg bg-emerald-500 text-white text-xs font-bold"
          >
            予算保存
          </button>
        </div>
          <div className="w-full h-3 bg-green-200 dark:bg-green-900/50 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${usedPct}%` }} />
          </div>
          <div className="flex justify-between mt-2 text-[10px] font-bold text-green-600 dark:text-green-400">
            <span>{usedPct.toFixed(1)}% 使用中</span>
            <span>残り ¥{Math.max(budgetTargetYen - thisMonthTotal, 0).toLocaleString()}</span>
          </div>
        </div>

        <div className="mb-8 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">月次支出トレンド (6ヶ月)</h4>
            <span className="text-[10px] font-bold text-slate-400">単位: 円</span>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="expenseTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v) => `¥${Number(v).toLocaleString()}`} />
                <Area type="monotone" dataKey="amount" stroke="#f97316" strokeWidth={2} fill="url(#expenseTrendFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="h-40 relative">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie data={categorySeries} innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
                  {categorySeries.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `¥${Number(v).toLocaleString()}`} />
              </RechartsPieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="font-black text-slate-300 text-xs">カテゴリ</span>
            </div>
          </div>
          <div className="space-y-2 flex flex-col justify-center">
            {categorySeries.filter((d) => d.value > 0).map((d, i) => (
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

        <h4 className="font-bold text-slate-900 dark:text-white mt-6 mb-4">最近の支出</h4>
        <div className="space-y-3">
          {recentExpenses.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">支出データがまだありません。</p>
          )}
          {recentExpenses.map((tx) => (
            <div key={tx.id} className="flex justify-between items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.category === '食費' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'}`}>
                  {tx.category === '食費' ? <Smartphone size={18} /> : <FileText size={18} />}
                </div>
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{tx.merchant}</p>
                  <p className="text-[10px] text-slate-400 font-bold">
                    {tx.spent_on} • {tx.category} {tx.payment_method ? `• ${tx.payment_method}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-black text-slate-900 dark:text-white">¥{Number(tx.amount || 0).toLocaleString()}</span>
                <button onClick={() => onDeleteExpense?.(tx.id)} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Coins size={20} className="text-yellow-500" /> ポイント管理
            </h3>
            <button
              onClick={() => setShowPointForm((prev) => !prev)}
              className="text-xs font-bold text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-3 py-1 rounded-full"
            >
              + 追加
            </button>
          </div>
          {showPointForm && (
            <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 p-3 grid grid-cols-2 gap-2">
              <input value={pointForm.name} onChange={(e) => setPointForm((p) => ({ ...p, name: e.target.value }))} placeholder="ポイント名" className="col-span-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm" />
              <input type="number" value={pointForm.balance} onChange={(e) => setPointForm((p) => ({ ...p, balance: e.target.value }))} placeholder="残高" className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm" />
              <input type="date" value={pointForm.expiry} onChange={(e) => setPointForm((p) => ({ ...p, expiry: e.target.value }))} className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm" />
              <button onClick={handlePointSubmit} disabled={pointSaving} className="col-span-2 py-2 rounded-lg bg-orange-500 text-white text-sm font-bold disabled:opacity-60">
                {pointSaving ? '保存中...' : 'ポイントを追加'}
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="relative p-4 bg-orange-50 dark:bg-orange-900/20 rounded-2xl border border-orange-100 dark:border-orange-900/50">
              <p className="text-xs text-orange-600 dark:text-orange-400 font-bold mb-1">総ポイント</p>
              <p className="text-3xl font-black text-orange-500">{pointTotal.toLocaleString()}</p>
              <Coins className="text-orange-200 dark:text-orange-800 absolute top-4 right-4" size={40} />
            </div>
            <div className="relative p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
              <p className="text-xs text-slate-500 font-bold mb-1">30日以内に失効</p>
              <p className="text-3xl font-black text-slate-400">{expiringPoints.toLocaleString()}</p>
              <AlertTriangle className="text-slate-200 dark:text-slate-600 absolute top-4 right-4" size={40} />
            </div>
          </div>

          <div className="space-y-2">
            {pointAccounts.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">ポイントデータがまだありません。</p>
            )}
            {pointAccounts.map((p) => (
              <div key={p.id} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <span className="bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 text-[10px] font-bold px-2 py-1 rounded-full">{p.name}</span>
                <div className="text-right flex items-center gap-2">
                  <div>
                    <p className="font-black text-slate-900 dark:text-white">{Number(p.balance || 0).toLocaleString()} P</p>
                    <p className="text-[10px] text-slate-400">有効期限: {p.expiry || '-'}</p>
                  </div>
                  <button onClick={() => onDeletePointAccount?.(p.id)} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
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
            <button
              onClick={() => setShowInsuranceForm((prev) => !prev)}
              className="bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-emerald-600 transition"
            >
              + 追加
            </button>
          </div>

          {showInsuranceForm && (
            <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 p-3 grid grid-cols-2 gap-2">
              <input value={insuranceForm.product_name} onChange={(e) => setInsuranceForm((p) => ({ ...p, product_name: e.target.value }))} placeholder="保険名" className="col-span-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm" />
              <input value={insuranceForm.provider} onChange={(e) => setInsuranceForm((p) => ({ ...p, provider: e.target.value }))} placeholder="保険会社" className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm" />
              <input type="number" value={insuranceForm.monthly_premium} onChange={(e) => setInsuranceForm((p) => ({ ...p, monthly_premium: e.target.value }))} placeholder="月額保険料" className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm" />
              <input type="date" value={insuranceForm.maturity_date} onChange={(e) => setInsuranceForm((p) => ({ ...p, maturity_date: e.target.value }))} className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm" />
              <input value={insuranceForm.coverage_summary} onChange={(e) => setInsuranceForm((p) => ({ ...p, coverage_summary: e.target.value }))} placeholder="補償概要" className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm" />
              <button onClick={handleInsuranceSubmit} disabled={insuranceSaving} className="col-span-2 py-2 rounded-lg bg-emerald-500 text-white text-sm font-bold disabled:opacity-60">
                {insuranceSaving ? '保存中...' : '保険を追加'}
              </button>
            </div>
          )}

          <div className="space-y-2">
            {insurances.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">保険データがまだありません。</p>}
            {insurances.map((ins) => {
              const dayLeft = ins.maturity_date
                ? Math.max(0, Math.ceil((new Date(ins.maturity_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                : null
              return (
                <div key={ins.id} className="border border-orange-200 dark:border-orange-900/50 bg-orange-50/30 dark:bg-orange-900/20 rounded-xl p-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-orange-500" />
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{ins.product_name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{ins.provider || '-'} • 保険料: ¥{Number(ins.monthly_premium || 0).toLocaleString()}/月</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {dayLeft !== null && (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          あと {dayLeft}日
                        </span>
                      )}
                      <button onClick={() => onDeleteInsurance?.(ins.id)} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {ins.maturity_date ? `満期: ${ins.maturity_date}` : '満期: -'} • 補償: {ins.coverage_summary || '-'}
                  </p>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
            {LEGAL_NOTICE_TEMPLATES.insurance}
          </p>
        </div>
      </div>
    </div>
  )
}

const DebtSection = ({ annualIncome = 600, onAnnualIncomeChange, onSaveAnnualIncome, profileSaving, onOpenLoanDiagnosis }) => {
  const [selectedScenario, setSelectedScenario] = useState('rate_up')
  const [extraMonthlyYen, setExtraMonthlyYen] = useState(0)
  const principalYen = Number(DEBT_INFO.remaining || 0)
  const remainingYears = 30
  const currentRate = 0.9
  const raisedRate = 1.4

  const baseMonthlyYen = calcMonthlyPayment(principalYen, currentRate, remainingYears)
  const rateUpMonthlyYen = calcMonthlyPayment(principalYen, raisedRate, remainingYears)
  const annualRepaymentManwon = (baseMonthlyYen * 12) / 10000
  const annualRepaymentRateUpManwon = (rateUpMonthlyYen * 12) / 10000

  const dtiBase = annualIncome > 0 ? (annualRepaymentManwon / annualIncome) * 100 : 0
  const dtiRateUp = annualIncome > 0 ? (annualRepaymentRateUpManwon / annualIncome) * 100 : 0
  const reducedIncome = annualIncome * 0.8
  const dtiIncomeDown = reducedIncome > 0 ? (annualRepaymentManwon / reducedIncome) * 100 : 0

  const scenarioMap = {
    rate_up: {
      title: '金利上昇シナリオ',
      monthlyBefore: baseMonthlyYen,
      monthlyAfter: rateUpMonthlyYen,
      dtiBefore: dtiBase,
      dtiAfter: dtiRateUp,
      impact: '金利+0.5%想定',
    },
    income_down: {
      title: '収入減少シナリオ',
      monthlyBefore: baseMonthlyYen,
      monthlyAfter: baseMonthlyYen,
      dtiBefore: dtiBase,
      dtiAfter: dtiIncomeDown,
      impact: '年収-20%想定',
    },
  }
  const activeScenario = scenarioMap[selectedScenario]
  const dti = dtiBase.toFixed(1)

  const estimatePayoffMonths = (balance, annualRatePct, monthlyPayment) => {
    const monthlyRate = (annualRatePct / 100) / 12
    let remain = balance
    let months = 0
    const maxMonths = 1200
    while (remain > 0 && months < maxMonths) {
      const interest = remain * monthlyRate
      const principalPaid = monthlyPayment - interest
      if (principalPaid <= 0) return maxMonths
      remain -= principalPaid
      months += 1
    }
    return months
  }

  const baseMonthsToPayoff = estimatePayoffMonths(principalYen, currentRate, baseMonthlyYen)
  const acceleratedPaymentYen = baseMonthlyYen + Math.max(0, Number(extraMonthlyYen || 0))
  const acceleratedMonthsToPayoff = estimatePayoffMonths(principalYen, currentRate, acceleratedPaymentYen)
  const reducedMonths = Math.max(0, baseMonthsToPayoff - acceleratedMonthsToPayoff)
  const baseTotalInterestYen = Math.max(0, Math.round(baseMonthlyYen * baseMonthsToPayoff - principalYen))
  const accelTotalInterestYen = Math.max(0, Math.round(acceleratedPaymentYen * acceleratedMonthsToPayoff - principalYen))
  const interestSavingYen = Math.max(0, baseTotalInterestYen - accelTotalInterestYen)

  return (
    <div className="grid md:grid-cols-12 gap-8">
      <div className="md:col-span-4 space-y-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Wallet size={20} className="text-emerald-500" /> あなたの収入
          </h3>
          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
            <label className="text-xs font-bold text-slate-400 block mb-2">昨年の年収 (税引前)</label>
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-900 dark:text-white text-lg">¥</span>
              <input
                type="number"
                value={annualIncome}
                onChange={(e) => onAnnualIncomeChange?.(Number(e.target.value) || 0)}
                className="w-full bg-transparent font-black text-2xl text-slate-900 dark:text-white outline-none border-b-2 border-slate-200 dark:border-slate-600 focus:border-emerald-500 transition"
              />
              <span className="font-bold text-slate-400 text-sm whitespace-nowrap">万円</span>
            </div>
            <button
              onClick={onSaveAnnualIncome}
              disabled={profileSaving}
              className="mt-3 w-full py-2 rounded-lg bg-emerald-500 text-white text-xs font-bold disabled:opacity-60"
            >
              {profileSaving ? '保存中...' : '年収を保存'}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-500" /> 負債状況
          </h3>
          <div className="space-y-6">
            <div>
              <p className="text-xs text-slate-400 font-bold mb-1">残債総額</p>
              <p className="text-3xl font-black text-slate-900 dark:text-white">¥{DEBT_INFO.remaining.toLocaleString()}</p>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full mt-2">
                <div className="w-[90%] h-full bg-slate-900 dark:bg-slate-600 rounded-full" />
              </div>
            </div>

            <div className={`p-4 rounded-xl transition-all duration-500 ${Number(dti) > 35 ? 'bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50' : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50'}`}>
              <div className="flex justify-between mb-1">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">返済負担率 (DTI)</span>
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
            <Bell size={20} className="text-orange-500" /> ローンアラート
          </h3>
          <div className="space-y-3">
            {DEBT_INFO.alerts.map((alert) => (
              <div key={alert.id} className={`p-3 rounded-xl border text-xs font-bold leading-relaxed flex gap-2 ${alert.type === 'opportunity' ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/50 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/50 text-red-700 dark:text-red-400'}`}>
                {alert.type === 'opportunity' ? <Zap size={16} className="shrink-0" /> : <AlertTriangle size={16} className="shrink-0" />}
                {alert.msg}
              </div>
            ))}
          </div>
          <button
            onClick={onOpenLoanDiagnosis}
            className="w-full mt-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
          >
            <ShieldCheck size={14} /> ローン承認可能性診断
          </button>
        </div>
      </div>

      <div className="md:col-span-8">
        <div className="bg-slate-900 text-white p-8 rounded-[2rem] shadow-xl relative overflow-hidden h-full flex flex-col justify-center">
          <div className="relative z-10">
            <div className="mb-8">
              <span className="bg-white/10 text-white text-[10px] font-bold px-2 py-1 rounded border border-white/20 mb-2 inline-block">シミュレーション</span>
              <h3 className="text-3xl font-black mb-2">将来シナリオ分析</h3>
              <p className="text-slate-400 text-sm leading-relaxed max-w-lg">
                あなたの年収 <span className="text-white font-bold underline">¥{annualIncome}万円</span> をベースに、<br />
                金利上昇や収入減少が返済計画に与える影響をAIが予測します。
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <button
                onClick={() => setSelectedScenario('rate_up')}
                className={`text-left bg-white/10 backdrop-blur-md p-6 rounded-2xl border transition cursor-pointer group ${
                  selectedScenario === 'rate_up' ? 'border-red-400/70 bg-white/20' : 'border-white/10 hover:bg-white/20'
                }`}
              >
                <div className="w-12 h-12 bg-red-500/20 text-red-400 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition"><TrendingUp size={24} /></div>
                <h4 className="font-bold text-lg mb-2">金利上昇シナリオ</h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">金利が0.5%上昇した場合、月々の返済額がどう変わるか確認できます。</p>
                <span className="text-xs font-bold text-white border-b border-white pb-0.5 group-hover:text-red-400 group-hover:border-red-400 transition">シミュレーション実行 &rarr;</span>
              </button>

              <button
                onClick={() => setSelectedScenario('income_down')}
                className={`text-left bg-white/10 backdrop-blur-md p-6 rounded-2xl border transition cursor-pointer group ${
                  selectedScenario === 'income_down' ? 'border-blue-400/70 bg-white/20' : 'border-white/10 hover:bg-white/20'
                }`}
              >
                <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition"><TrendingDown size={24} /></div>
                <h4 className="font-bold text-lg mb-2">収入減少シナリオ</h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">収入が20%減少した場合の返済負担率(DTI)の変化を予測します。</p>
                <span className="text-xs font-bold text-white border-b border-white pb-0.5 group-hover:text-blue-400 group-hover:border-blue-400 transition">シミュレーション実行 &rarr;</span>
              </button>
            </div>

            <div className="mt-6 bg-white/10 border border-white/10 rounded-2xl p-5">
              <div className="flex items-center justify-between gap-4 mb-3">
                <h4 className="font-black text-lg">{activeScenario.title}</h4>
                <span className="text-[11px] font-bold px-2 py-1 rounded bg-white/10">{activeScenario.impact}</span>
              </div>
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-white/10 p-3">
                  <p className="text-xs text-slate-300">毎月返済額（現状 → シナリオ）</p>
                  <p className="font-black text-lg">
                    ¥{Math.round(activeScenario.monthlyBefore).toLocaleString()} → ¥{Math.round(activeScenario.monthlyAfter).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl bg-white/10 p-3">
                  <p className="text-xs text-slate-300">DTI（現状 → シナリオ）</p>
                  <p className={`font-black text-lg ${activeScenario.dtiAfter > 35 ? 'text-rose-300' : 'text-emerald-300'}`}>
                    {activeScenario.dtiBefore.toFixed(1)}% → {activeScenario.dtiAfter.toFixed(1)}%
                  </p>
                </div>
              </div>
              <button
                onClick={onOpenLoanDiagnosis}
                className="w-full mt-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
              >
                <ShieldCheck size={14} /> 詳細診断を実行
              </button>
            </div>

            <div className="mt-4 bg-white/10 border border-white/10 rounded-2xl p-5">
              <h4 className="font-black text-lg mb-3">繰上返済インパクト</h4>
              <p className="text-xs text-slate-300 mb-3">
                毎月の追加返済額を設定すると、完済時期と総利息の変化を試算します。
              </p>
              <div className="grid md:grid-cols-2 gap-3 mb-3">
                <div className="rounded-xl bg-white/10 p-3">
                  <p className="text-xs text-slate-300 mb-1">月の追加返済額</p>
                  <div className="text-lg font-black">¥{Number(extraMonthlyYen || 0).toLocaleString()}</div>
                </div>
                <div className="rounded-xl bg-white/10 p-3">
                  <p className="text-xs text-slate-300 mb-1">毎月返済（合計）</p>
                  <div className="text-lg font-black">¥{Math.round(acceleratedPaymentYen).toLocaleString()}</div>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100000}
                step={5000}
                value={extraMonthlyYen}
                onChange={(e) => setExtraMonthlyYen(Number(e.target.value))}
                className="w-full accent-orange-400"
              />
              <div className="grid md:grid-cols-3 gap-3 mt-4 text-sm">
                <div className="rounded-xl bg-white/10 p-3">
                  <p className="text-xs text-slate-300">完済期間短縮</p>
                  <p className="font-black text-emerald-300">
                    -{Math.floor(reducedMonths / 12)}年 {reducedMonths % 12}ヶ月
                  </p>
                </div>
                <div className="rounded-xl bg-white/10 p-3">
                  <p className="text-xs text-slate-300">総利息（現状）</p>
                  <p className="font-black">¥{baseTotalInterestYen.toLocaleString()}</p>
                </div>
                <div className="rounded-xl bg-white/10 p-3">
                  <p className="text-xs text-slate-300">利息削減見込み</p>
                  <p className="font-black text-emerald-300">¥{interestSavingYen.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -right-20 -top-20 w-96 h-96 bg-orange-500/20 rounded-full blur-[100px]" />
        </div>
      </div>
    </div>
  )
}

export default function MyPage({ fundWatchlist = [], productInterests = [], toggleFundWatchlist, user = null }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('summary')
  const [isLoanDiagnosisOpen, setIsLoanDiagnosisOpen] = useState(false)
  const [assetPositions, setAssetPositions] = useState([])
  const [pointAccounts, setPointAccounts] = useState([])
  const [expenses, setExpenses] = useState([])
  const [insurances, setInsurances] = useState([])
  const [financeProfile, setFinanceProfile] = useState({ annual_income_manwon: 600, budget_target_yen: 200000 })
  const [dataStatus, setDataStatus] = useState('')
  const [expenseSaving, setExpenseSaving] = useState(false)
  const [insuranceSaving, setInsuranceSaving] = useState(false)
  const [pointSaving, setPointSaving] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [myPageDbAvailable, setMyPageDbAvailable] = useState(false)

  const watchlistCount = myPageDbAvailable
    ? (Array.isArray(fundWatchlist) ? fundWatchlist.length : 0)
    : (Array.isArray(fundWatchlist) && fundWatchlist.length > 0 ? fundWatchlist.length : DEFAULT_WATCHLIST.length)
  const effectivePortfolio = myPageDbAvailable
    ? assetPositions.map((a, i) => {
      const invest = Number(a.invest_value || 0)
      const value = Number(a.current_value || 0)
      const pnlRate = invest > 0 ? ((value - invest) / invest) * 100 : 0
      return {
        id: a.id || `asset-${i}`,
        name: a.name,
        value,
        invest,
        return: Number(pnlRate.toFixed(1)),
        color: a.color || '#3b82f6',
        source: 'db',
      }
    })
    : PORTFOLIO.map((p) => ({ ...p, source: 'mock' }))
  const summaryBaseMonthlyYen = calcMonthlyPayment(Number(DEBT_INFO.remaining || 0), 0.9, 30)
  const summaryAnnualRepaymentManwon = (summaryBaseMonthlyYen * 12) / 10000
  const summaryDti = Number(financeProfile.annual_income_manwon || 0) > 0
    ? (summaryAnnualRepaymentManwon / Number(financeProfile.annual_income_manwon || 0)) * 100
    : 0
  const headerTotalValue = effectivePortfolio.reduce((acc, item) => acc + Number(item.value || 0), 0)
  const headerTotalInvest = effectivePortfolio.reduce((acc, item) => acc + Number(item.invest || 0), 0)
  const headerPnL = headerTotalValue - headerTotalInvest
  const headerRate = headerTotalInvest > 0 ? (headerPnL / headerTotalInvest) * 100 : 0
  const insuranceSummary = {
    registered: insurances.length,
    expiringSoon: insurances.filter((ins) => {
      if (!ins.maturity_date) return false
      const diff = new Date(ins.maturity_date).getTime() - Date.now()
      return diff <= 1000 * 60 * 60 * 24 * 30
    }).length,
  }

  useEffect(() => {
    let alive = true
    const load = async () => {
      if (!user?.id) {
        if (alive) setDataStatus('ログイン後にMyデータを保存できます。')
        return
      }
      try {
        const data = await loadMyPageData(user.id)
        if (!alive) return
        setExpenses(data.expenses || [])
        setInsurances(data.insurances || [])
        setAssetPositions(data.assetPositions || [])
        setPointAccounts(data.pointAccounts || [])
        setMyPageDbAvailable(Boolean(data.available))
        setFinanceProfile({
          annual_income_manwon: Number(data.profile?.annual_income_manwon || 600),
          budget_target_yen: Number(data.profile?.budget_target_yen || 200000),
        })
        setDataStatus(data.available ? 'Myデータを同期しました。' : 'MyPage DBテーブル未設定のため表示用データを使用中。')
      } catch (err) {
        if (!alive) return
        setDataStatus(`データ読み込み失敗: ${err?.message || 'unknown error'}`)
      }
    }
    load()
    return () => {
      alive = false
    }
  }, [user?.id])

  const handleAddExpense = async (payload) => {
    setExpenseSaving(true)
    try {
      const row = await addExpense(payload)
      setExpenses((prev) => [row, ...prev])
      setDataStatus('支出を保存しました。')
    } catch (err) {
      setDataStatus(`支出保存に失敗: ${err?.message || 'unknown error'}`)
    } finally {
      setExpenseSaving(false)
    }
  }

  const handleDeleteExpense = async (expenseId) => {
    if (!user?.id || !expenseId) return
    try {
      await deleteExpenseById(expenseId, user.id)
      setExpenses((prev) => prev.filter((e) => e.id !== expenseId))
      setDataStatus('支出を削除しました。')
    } catch (err) {
      setDataStatus(`支出削除に失敗: ${err?.message || 'unknown error'}`)
    }
  }

  const handleAddInsurance = async (payload) => {
    setInsuranceSaving(true)
    try {
      const row = await addInsurance(payload)
      setInsurances((prev) => [row, ...prev])
      setDataStatus('保険情報を保存しました。')
    } catch (err) {
      setDataStatus(`保険保存に失敗: ${err?.message || 'unknown error'}`)
    } finally {
      setInsuranceSaving(false)
    }
  }

  const handleDeleteInsurance = async (insuranceId) => {
    if (!user?.id || !insuranceId) return
    try {
      await deleteInsuranceById(insuranceId, user.id)
      setInsurances((prev) => prev.filter((ins) => ins.id !== insuranceId))
      setDataStatus('保険情報を削除しました。')
    } catch (err) {
      setDataStatus(`保険削除に失敗: ${err?.message || 'unknown error'}`)
    }
  }

  const handleSaveFinanceProfile = async () => {
    if (!user?.id) return
    setProfileSaving(true)
    try {
      const saved = await saveFinanceProfile({
        userId: user.id,
        annualIncomeManwon: financeProfile.annual_income_manwon,
        budgetTargetYen: financeProfile.budget_target_yen,
      })
      setFinanceProfile({
        annual_income_manwon: Number(saved.annual_income_manwon || 0),
        budget_target_yen: Number(saved.budget_target_yen || 200000),
      })
      setDataStatus('年収情報を保存しました。')
    } catch (err) {
      setDataStatus(`年収保存に失敗: ${err?.message || 'unknown error'}`)
    } finally {
      setProfileSaving(false)
    }
  }

  const handleAddPointAccount = async (payload) => {
    setPointSaving(true)
    try {
      const row = await addPointAccount(payload)
      setPointAccounts((prev) => [row, ...prev])
      setDataStatus('ポイント情報を保存しました。')
    } catch (err) {
      setDataStatus(`ポイント保存に失敗: ${err?.message || 'unknown error'}`)
    } finally {
      setPointSaving(false)
    }
  }

  const handleDeletePointAccount = async (pointId) => {
    if (!user?.id || !pointId) return
    try {
      await deletePointAccountById(pointId, user.id)
      setPointAccounts((prev) => prev.filter((p) => p.id !== pointId))
      setDataStatus('ポイント情報を削除しました。')
    } catch (err) {
      setDataStatus(`ポイント削除に失敗: ${err?.message || 'unknown error'}`)
    }
  }

  const handleAddAsset = async ({ name, current_value, invest_value, color }) => {
    if (!user?.id) return
    try {
      const row = await addAssetPosition({
        user_id: user.id,
        name,
        current_value: Math.max(0, Number(current_value || 0)),
        invest_value: Math.max(0, Number(invest_value || 0)),
        color: color || '#3b82f6',
      })
      setAssetPositions((prev) => [row, ...prev])
      setDataStatus('投資資産を追加しました。')
    } catch (err) {
      setDataStatus(`資産追加に失敗: ${err?.message || 'unknown error'}`)
    }
  }

  const handleUpdateAsset = async ({ id, name, current_value, invest_value, color }) => {
    if (!user?.id || !id) return
    try {
      const row = await updateAssetPosition({
        id,
        userId: user.id,
        name,
        current_value: Math.max(0, Number(current_value || 0)),
        invest_value: Math.max(0, Number(invest_value || 0)),
        color: color || '#3b82f6',
      })
      setAssetPositions((prev) => prev.map((a) => (a.id === id ? row : a)))
      setDataStatus('投資資産を更新しました。')
    } catch (err) {
      setDataStatus(`資産更新に失敗: ${err?.message || 'unknown error'}`)
    }
  }

  const handleDeleteAsset = async (assetId) => {
    if (!user?.id || !assetId) return
    try {
      await deleteAssetPositionById(assetId, user.id)
      setAssetPositions((prev) => prev.filter((a) => a.id !== assetId))
      setDataStatus('投資資産を削除しました。')
    } catch (err) {
      setDataStatus(`資産削除に失敗: ${err?.message || 'unknown error'}`)
    }
  }

  const handleSaveBudgetTarget = async (nextBudgetYen) => {
    if (!user?.id) return
    setProfileSaving(true)
    try {
      const saved = await saveFinanceProfile({
        userId: user.id,
        annualIncomeManwon: financeProfile.annual_income_manwon,
        budgetTargetYen: Math.max(0, Number(nextBudgetYen || 0)),
      })
      setFinanceProfile({
        annual_income_manwon: Number(saved.annual_income_manwon || 0),
        budget_target_yen: Number(saved.budget_target_yen || 200000),
      })
      setDataStatus('予算目標を保存しました。')
    } catch (err) {
      setDataStatus(`予算保存に失敗: ${err?.message || 'unknown error'}`)
    } finally {
      setProfileSaving(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'wealth':
        return (
          <WealthSection
            watchlistItems={fundWatchlist}
            productInterests={productInterests}
            portfolio={effectivePortfolio}
            isMockMode={!myPageDbAvailable}
            onRemoveWatchlist={(id, name) => {
              const ok = window.confirm(`「${name || id}」をウォッチリストから削除しますか？`)
              if (!ok) return
              toggleFundWatchlist?.(id)
              setDataStatus('ウォッチリストから削除しました。')
            }}
            canEditAssets={Boolean(user?.id)}
            onAddAsset={handleAddAsset}
            onUpdateAsset={handleUpdateAsset}
            onDeleteAsset={handleDeleteAsset}
          />
        )
      case 'budget':
        return (
          <BudgetSection
            user={user}
            expenses={expenses}
            insurances={insurances}
            pointAccounts={pointAccounts}
            budgetTargetYen={financeProfile.budget_target_yen}
            onSaveBudgetTarget={handleSaveBudgetTarget}
            onAddExpense={handleAddExpense}
            onDeleteExpense={handleDeleteExpense}
            onAddInsurance={handleAddInsurance}
            onDeleteInsurance={handleDeleteInsurance}
            onAddPointAccount={handleAddPointAccount}
            onDeletePointAccount={handleDeletePointAccount}
            expenseSaving={expenseSaving}
            insuranceSaving={insuranceSaving}
            pointSaving={pointSaving}
          />
        )
      case 'debt':
        return (
          <DebtSection
            annualIncome={financeProfile.annual_income_manwon}
            onAnnualIncomeChange={(v) => setFinanceProfile((prev) => ({ ...prev, annual_income_manwon: v }))}
            onSaveAnnualIncome={handleSaveFinanceProfile}
            profileSaving={profileSaving}
            onOpenLoanDiagnosis={() => setIsLoanDiagnosisOpen(true)}
          />
        )
      default:
        return (
          <SummarySection
            watchlistCount={watchlistCount}
            user={user}
            insuranceSummary={insuranceSummary}
            portfolio={effectivePortfolio}
            summaryDti={summaryDti}
            isMockMode={!myPageDbAvailable}
          />
        )
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
            { id: 'wealth', label: '資産運用', icon: TrendingUp },
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
          <button
            onClick={() => setActiveTab('summary')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <Settings size={18} /> 設定
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-red-400 hover:text-red-500"
          >
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
                こんにちは、Justinさん <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full border border-orange-200 dark:border-orange-800 flex items-center gap-1"><Crown size={12} /> プレミアム</span>
              </h1>
              <p className="text-slate-400 font-bold text-sm">MoneyMartへようこそ</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm min-w-[180px]">
              <p className="text-xs text-slate-400 font-bold mb-1">総資産</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">¥{headerTotalValue.toLocaleString()}</p>
              <p className={`text-xs font-bold flex items-center gap-1 ${headerPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                <TrendingUp size={12} /> {headerPnL >= 0 ? '+' : ''}¥{headerPnL.toLocaleString()} ({headerRate.toFixed(1)}%)
              </p>
            </div>
          </div>
        </header>
        {dataStatus ? <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-4">{dataStatus}</p> : null}

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

      <LoanApprovalDiagnosisModal isOpen={isLoanDiagnosisOpen} onClose={() => setIsLoanDiagnosisOpen(false)} />
    </div>
  )
}
