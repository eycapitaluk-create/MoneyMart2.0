import { useEffect, useState } from 'react'
import {
  PieChart, Wallet, CreditCard, TrendingUp, TrendingDown,
  AlertTriangle, ShieldCheck, ChevronRight, Bell, Settings,
  LogOut, Crown, ArrowUpRight, Zap, Coins,
  FileText, Home, PiggyBank, Smartphone, Star, X, Loader2
} from 'lucide-react'
import {
  Cell, Pie, ResponsiveContainer, Tooltip,
  PieChart as RechartsPieChart
} from 'recharts'
import { supabase } from '../lib/supabase'

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

const buildAiSummaryReport = ({ totalReturnRate, dti, concentration, bestReturn }) => {
  const marketTone = totalReturnRate >= 8 ? '順調' : totalReturnRate >= 3 ? '中立' : '慎重'
  const riskLevel = dti >= 35 || concentration >= 60 ? 'やや高め' : concentration >= 45 ? '中程度' : '低め'

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

  const confidence = riskLevel === '低め' ? '高' : riskLevel === '中程度' ? '中' : '中'

  return {
    marketTone,
    riskLevel,
    confidence,
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
              <span className="text-[11px] text-slate-400 font-bold mt-2 block bg-slate-100 dark:bg-slate-800 py-1 px-3 rounded-full w-fit mx-auto">参考値です。実際の審査結果を保証するものではありません。</span>
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
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Question {step}/8</span>
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
              <p className="text-xs font-bold text-slate-400 mb-2">Loan Approval Probability (Estimate)</p>
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
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-4">
                この診断は参考目安です。最終可否は金融機関の審査結果により異なります。
              </p>
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

const SummarySection = () => {
  const [reportGeneratedAt, setReportGeneratedAt] = useState(new Date())
  const [savedReport, setSavedReport] = useState(null)
  const [reportSaving, setReportSaving] = useState(false)
  const [reportStatus, setReportStatus] = useState('')
  const totalInvested = PORTFOLIO.reduce((acc, item) => acc + item.invest, 0)
  const totalCurrentValue = PORTFOLIO.reduce((acc, item) => acc + item.value, 0)
  const totalPnL = totalCurrentValue - totalInvested
  const totalReturnRate = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0
  const bestReturn = Math.max(...PORTFOLIO.map((item) => item.return))
  const insuranceSummary = { registered: 1, expiringSoon: 1 }
  const concentration = totalCurrentValue > 0 ? Math.max(...PORTFOLIO.map((item) => (item.value / totalCurrentValue) * 100)) : 0
  const generatedReport = buildAiSummaryReport({ totalReturnRate, dti: DEBT_INFO.dti, concentration, bestReturn })
  const aiReport = savedReport || generatedReport

  useEffect(() => {
    let alive = true
    const loadLatestReport = async () => {
      try {
        const { data, error } = await supabase
          .from('ai_reports')
          .select('payload,created_at')
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
  }, [])

  const handleRegenerateReport = async () => {
    const nextReport = buildAiSummaryReport({
      totalReturnRate,
      dti: DEBT_INFO.dti,
      concentration,
      bestReturn,
    })
    const now = new Date()

    setSavedReport(nextReport)
    setReportGeneratedAt(now)
    setReportStatus('再生成済み（保存中...）')
    setReportSaving(true)

    try {
      const { error } = await supabase
        .from('ai_reports')
        .insert({
          report_type: 'summary',
          payload: {
            generated_at: now.toISOString(),
            metrics: {
              total_return_rate: Number(totalReturnRate.toFixed(2)),
              dti: DEBT_INFO.dti,
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
                  <span className="font-black text-slate-900 dark:text-white">{PORTFOLIO.length}銘柄</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ウォッチリスト</span>
                  <span className="font-black text-slate-900 dark:text-white">{WATCHLIST.length}銘柄</span>
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
                  <span className="font-black text-slate-900 dark:text-white">{DEBT_INFO.dti}%</span>
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
                  {PORTFOLIO.map((fund) => {
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
                  <Pie data={PORTFOLIO} dataKey="value" nameKey="name" outerRadius={90} innerRadius={50} paddingAngle={2}>
                    {PORTFOLIO.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `¥${Number(value).toLocaleString()}`} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-2">
              {PORTFOLIO.map((fund) => {
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
            <button className="w-full mt-5 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black rounded-xl hover:opacity-90 transition flex items-center justify-center gap-2">
              詳細アセット分析 <ArrowUpRight size={14} />
            </button>
            <p className="text-[10px] text-slate-400 mt-3">
              ※ 現在は表示用データです。保存連携は次フェーズで対応します。
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 mt-4">
            <h4 className="text-sm font-black text-slate-900 dark:text-white mb-2">Quick Insight</h4>
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

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-white/10 rounded-lg p-2">
                <p className="text-[10px] text-slate-300">市場トーン</p>
                <p className="font-black text-sm">{aiReport.marketTone}</p>
              </div>
              <div className="bg-white/10 rounded-lg p-2">
                <p className="text-[10px] text-slate-300">ポートフォリオリスク</p>
                <p className="font-black text-sm">{aiReport.riskLevel}</p>
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
            <p className="text-[10px] text-slate-400 mt-3">
              ※ 本リポートは参考情報です。投資判断を保証するものではありません。
            </p>
          </div>
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

const DebtSection = ({ onOpenLoanDiagnosis }) => {
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
  const [isLoanDiagnosisOpen, setIsLoanDiagnosisOpen] = useState(false)

  const renderContent = () => {
    switch (activeTab) {
      case 'wealth': return <WealthSection />
      case 'budget': return <BudgetSection />
      case 'debt': return <DebtSection onOpenLoanDiagnosis={() => setIsLoanDiagnosisOpen(true)} />
      default: return <SummarySection />
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

      <LoanApprovalDiagnosisModal isOpen={isLoanDiagnosisOpen} onClose={() => setIsLoanDiagnosisOpen(false)} />
    </div>
  )
}
