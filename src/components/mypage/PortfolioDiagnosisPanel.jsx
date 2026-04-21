import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Loader2, ShieldCheck, Sparkles, Target } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const DIAG_DAILY_LIMIT = 20
const DIAG_COOLDOWN_SECONDS = 20
const DIAG_USAGE_STORAGE_KEY = 'mm_portfolio_diag_usage_v1'

const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const usageKeyForUser = (userId) => `${String(userId || 'guest')}:${todayKey()}`

function ScoreGauge({ score = 0, grade = 'B' }) {
  const safeScore = Math.max(0, Math.min(100, Number(score || 0)))
  const color = safeScore >= 80 ? '#16a34a' : safeScore >= 60 ? '#f59e0b' : '#dc2626'
  const radius = 44
  const circumference = 2 * Math.PI * radius
  const dash = (safeScore / 100) * circumference

  return (
    <div className="relative w-[110px] h-[110px] shrink-0">
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx="55"
          cy="55"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 55 55)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-mono text-[28px] font-black leading-none" style={{ color }}>{safeScore}</div>
        <div className="text-sm font-black mt-1" style={{ color }}>{grade}</div>
      </div>
    </div>
  )
}

function DistributionBars({ title, rows = [] }) {
  if (!rows.length) return null

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <p className="text-xs font-black text-slate-500 dark:text-slate-400 mb-3">{title}</p>
      <div className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.name}>
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{row.name}</span>
              <span className="text-xs font-mono font-black text-slate-500 dark:text-slate-400">{row.pct.toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: row.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const RISK_META = {
  '高': 'text-red-600 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/30 dark:border-red-900',
  '中': 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/30 dark:border-amber-900',
  '低': 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-900',
}

export default function PortfolioDiagnosisPanel({
  scopeLabel = '総合',
  holdings = [],
  userId = null,
}) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState('')
  const [status, setStatus] = useState('')
  const [usageCount, setUsageCount] = useState(0)
  const [cooldownUntilTs, setCooldownUntilTs] = useState(0)

  const totalValue = useMemo(
    () => holdings.reduce((sum, row) => sum + Number(row?.value || 0), 0),
    [holdings]
  )

  const holdingsWithWeight = useMemo(
    () => holdings.map((row) => ({
      ...row,
      weight: totalValue > 0 ? (Number(row?.value || 0) / totalValue) * 100 : 0,
    })),
    [holdings, totalValue]
  )

  const sectorData = useMemo(() => {
    const map = {}
    holdingsWithWeight.forEach((row) => {
      const key = row.sector || 'その他'
      map[key] = (map[key] || 0) + row.weight
    })
    return Object.entries(map)
      .map(([name, pct], idx) => ({
        name,
        pct,
        color: ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'][idx % 6],
      }))
      .sort((a, b) => b.pct - a.pct)
  }, [holdingsWithWeight])

  const categoryData = useMemo(() => {
    const map = {}
    holdingsWithWeight.forEach((row) => {
      const key = row.category || '資産'
      map[key] = (map[key] || 0) + row.weight
    })
    return Object.entries(map)
      .map(([name, pct], idx) => ({
        name,
        pct,
        color: ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#64748b'][idx % 5],
      }))
      .sort((a, b) => b.pct - a.pct)
  }, [holdingsWithWeight])

  const diagnose = async () => {
    if (!holdingsWithWeight.length) return
    if (cooldownUntilTs > Date.now()) return
    if (usageCount >= DIAG_DAILY_LIMIT) {
      setError(`本日の分析上限（${DIAG_DAILY_LIMIT}回）に達しました。明日またお試しください。`)
      return
    }
    setLoading(true)
    setError('')
    setStatus('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('ログインが必要です')
      }
      const res = await fetch('/api/portfolio-diagnosis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          scopeLabel,
          holdings: holdingsWithWeight,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '分析に失敗しました')
      setResult(data?.result || null)
      setSavedAt(new Date().toISOString())
      setStatus('分析が完了しました（参考情報）')
      setUsageCount((prev) => {
        const next = prev + 1
        try {
          if (typeof window !== 'undefined') {
            const raw = window.localStorage.getItem(DIAG_USAGE_STORAGE_KEY)
            const parsed = raw ? JSON.parse(raw) : {}
            parsed[usageKeyForUser(userId)] = next
            window.localStorage.setItem(DIAG_USAGE_STORAGE_KEY, JSON.stringify(parsed))
          }
        } catch {
          // ignore storage errors
        }
        return next
      })
      setCooldownUntilTs(Date.now() + (DIAG_COOLDOWN_SECONDS * 1000))
    } catch (err) {
      setError(err?.message || '分析に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const clearResult = () => {
    setResult(null)
    setSavedAt('')
    setStatus('表示中の結果をクリアしました')
  }

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const raw = window.localStorage.getItem(DIAG_USAGE_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : {}
      const used = Number(parsed?.[usageKeyForUser(userId)] || 0)
      setUsageCount(Number.isFinite(used) ? Math.max(0, Math.floor(used)) : 0)
    } catch {
      setUsageCount(0)
    }
  }, [userId])

  const hasHoldings = holdingsWithWeight.length > 0

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-slate-900 dark:to-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
          <div className="min-w-0 lg:max-w-[38%]">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles size={18} className="text-violet-500" />
              AIポートフォリオ分析
            </h3>
            <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">
              {scopeLabel}の保有資産をもとにAIが分散・リスク・改善案を分析します
            </p>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              {userId ? '結果はマイページに保存されます' : '未ログイン時はこの端末にのみ保存されます'}
            </p>
          </div>
          <div className="flex-1 min-w-0 lg:px-2">
            <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
              本機能は情報整理・参考分析のみを目的としており、特定銘柄の売買推奨や投資助言（インベストメント・アドバイス）ではありません。実際の投資判断はご自身の責任で行い、必要に応じて税理士・ファイナンシャルプランナー等の専門家へご相談ください。
            </p>
          </div>
          <button
            type="button"
            onClick={diagnose}
            disabled={!hasHoldings || loading || usageCount >= DIAG_DAILY_LIMIT || cooldownUntilTs > Date.now()}
            className="shrink-0 self-start lg:self-start px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-sm font-black shadow-sm transition flex items-center gap-2"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {loading ? '分析中...' : 'AIで分析'}
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {!hasHoldings && (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-8 text-center">
            <p className="text-sm font-bold text-slate-400">保有データがまだありません</p>
            <p className="text-xs text-slate-300 dark:text-slate-500 mt-1">このタブに資産を登録すると AI 分析が使えます</p>
          </div>
        )}

        {hasHoldings && (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-4">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <p className="text-xs font-black text-slate-500 dark:text-slate-400">分析対象</p>
                  <p className="text-sm font-mono font-black text-slate-900 dark:text-white">¥{Math.round(totalValue).toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  {holdingsWithWeight
                    .slice()
                    .sort((a, b) => b.weight - a.weight)
                    .slice(0, 5)
                    .map((row, idx) => (
                      <div key={`diag-row-${idx}-${row.ticker || 'x'}-${row.name || ''}`} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <span className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate block">{row.name}</span>
                              {row.ticker ? (
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 block">{row.ticker}</span>
                              ) : null}
                            </div>
                            <span className="text-xs font-mono font-black text-violet-600 dark:text-violet-300">{row.weight.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 mt-1 rounded-full bg-white dark:bg-slate-900 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500" style={{ width: `${row.weight}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                <p className="text-xs font-black text-slate-500 dark:text-slate-400 mb-3">現在の分散メモ</p>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">保有銘柄数</span>
                    <span className="font-black text-slate-900 dark:text-white">{holdingsWithWeight.length}件</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">セクター数</span>
                    <span className="font-black text-slate-900 dark:text-white">{sectorData.length}件</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">資産カテゴリ数</span>
                    <span className="font-black text-slate-900 dark:text-white">{categoryData.length}件</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DistributionBars title="資産カテゴリ構成" rows={categoryData} />
              <DistributionBars title="セクター構成" rows={sectorData} />
            </div>
          </>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-4 text-sm font-bold text-red-600 dark:text-red-300">
            {error}
          </div>
        )}

        {status && !error && (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 p-4 text-sm font-bold text-emerald-700 dark:text-emerald-300">
            {status}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 px-3 py-2">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            本日 {usageCount}/{DIAG_DAILY_LIMIT} 回・再実行間隔 {DIAG_COOLDOWN_SECONDS} 秒。結果はこの画面の表示用です。
          </p>
          {result ? (
            <button
              type="button"
              onClick={clearResult}
              className="text-[11px] font-bold text-slate-600 dark:text-slate-300 underline"
            >
              結果をクリア
            </button>
          ) : null}
        </div>

        {result && (
          <div className="space-y-4">
            <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
                <ScoreGauge score={result.score} grade={result.grade} />
                <div className="flex-1">
                  <p className="text-xs font-black text-slate-400 mb-1">AI分析スコア</p>
                  <p className="text-2xl font-black mb-2">{result.summary}</p>
                  <p className="text-sm text-slate-300 leading-6">{result.comment}</p>
                  {savedAt ? (
                    <p className="mt-3 text-[11px] text-slate-400">
                      最終分析: {new Date(savedAt).toLocaleString('ja-JP')}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs font-black text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                <Target size={14} className="text-indigo-500" />
                分散スコア
              </p>
              <div className="space-y-3">
                {[
                  ['地域分散', result?.diversification?.geographic ?? 0, '#3b82f6'],
                  ['セクター分散', result?.diversification?.sector ?? 0, '#8b5cf6'],
                  ['資産分散', result?.diversification?.asset ?? 0, '#10b981'],
                ].map(([label, value, color]) => (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span>
                      <span className="text-xs font-mono font-black" style={{ color }}>{value}点</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 p-4">
                <p className="text-xs font-black text-emerald-600 dark:text-emerald-300 mb-3 flex items-center gap-2">
                  <ShieldCheck size={14} />
                  強み
                </p>
                <div className="space-y-2">
                  {(result.strengths || []).map((item, idx) => (
                    <div key={idx} className="text-sm text-emerald-900 dark:text-emerald-100 leading-6">• {item}</div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-4">
                <p className="text-xs font-black text-red-600 dark:text-red-300 mb-3 flex items-center gap-2">
                  <AlertTriangle size={14} />
                  弱み
                </p>
                <div className="space-y-2">
                  {(result.weaknesses || []).map((item, idx) => (
                    <div key={idx} className="text-sm text-red-900 dark:text-red-100 leading-6">• {item}</div>
                  ))}
                </div>
              </div>
            </div>

            {Array.isArray(result.risks) && result.risks.length > 0 && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                <p className="text-xs font-black text-slate-500 dark:text-slate-400 mb-3">リスク分析</p>
                <div className="space-y-2.5">
                  {result.risks.map((row, idx) => (
                    <div key={idx} className="flex gap-3 rounded-xl border p-3 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                      <span className={`shrink-0 px-2 py-1 rounded-lg border text-[11px] font-black ${RISK_META[row.level] || RISK_META['中']}`}>
                        {row.level}
                      </span>
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white">{row.type}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-6">{row.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
