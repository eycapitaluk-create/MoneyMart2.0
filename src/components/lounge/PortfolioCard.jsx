import { useState } from 'react'
import { PieChart } from 'lucide-react'
import {
  copyPortfolioToMine,
  togglePortfolioFollow,
} from '../../lib/portfolioApi'

const DONUT_COLORS = ['#38bdf8', '#34d399', '#fb923c', '#8b5cf6', '#f472b6']

const buildDonutGradient = (allocations = []) => {
  let acc = 0
  const stops = allocations.map((a, i) => {
    const pct = Number(a.weightPct) || 0
    const start = acc
    acc += pct
    return `${DONUT_COLORS[i % DONUT_COLORS.length]} ${start}% ${acc}%`
  })
  return `conic-gradient(${stops.join(', ')})`
}

/**
 * PortfolioCard - donut, allocation bars, 参考にする
 * @param {object} props
 * @param {object} props.portfolio - { id, name, allocations, return_1y, fee, risk, fund_count, follower_count, author_name?, updated_at }
 * @param {'small'|'large'} props.size - small for sidebar, large for feed
 * @param {string} props.currentUserId - 로그인 유저 ID
 * @param {boolean} props.isFollowed - 이미 参考 중인지
 * @param {function} props.onCopy - 복사 완료 콜백
 * @param {function} props.onFollowToggle - 팔로우 토글 콜백
 */
export default function PortfolioCard({
  portfolio,
  size = 'large',
  currentUserId,
  isFollowed = false,
  onCopy,
  onFollowToggle,
}) {
  const [busy, setBusy] = useState(false)
  const allocations = Array.isArray(portfolio?.allocations) ? portfolio.allocations : []

  const handleReference = async () => {
    if (!currentUserId) return
    setBusy(true)
    try {
      const copied = await copyPortfolioToMine({ portfolioId: portfolio.id, userId: currentUserId })
      onCopy?.(copied)
    } catch (err) {
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  const handleFollowToggle = async () => {
    if (!currentUserId) return
    setBusy(true)
    try {
      const nowFollowing = await togglePortfolioFollow({ portfolioId: portfolio.id, userId: currentUserId })
      onFollowToggle?.(nowFollowing)
    } catch (err) {
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  const donutStyle = {
    background: buildDonutGradient(allocations),
  }

  const timeText = portfolio?.updated_at
    ? (() => {
        const d = new Date(portfolio.updated_at)
        const diff = Date.now() - d.getTime()
        const days = Math.floor(diff / (24 * 60 * 60 * 1000))
        if (days < 1) return '今日'
        if (days < 7) return `${days}日前`
        return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
      })()
    : ''

  const isSmall = size === 'small'

  return (
    <div
      className={`rounded-xl border overflow-hidden transition ${
        isSmall
          ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3'
          : 'border-violet-200 dark:border-violet-900/50 bg-gradient-to-br from-sky-50 to-violet-50 dark:from-slate-900 dark:to-slate-900 p-4'
      }`}
    >
      <div className={`flex items-center gap-2 ${isSmall ? 'gap-2' : 'gap-3'} mb-2`}>
        <div
          className="rounded-full flex-shrink-0 relative"
          style={{
            width: isSmall ? 44 : 48,
            height: isSmall ? 44 : 48,
            ...donutStyle,
          }}
        >
          <div
            className="absolute inset-0 rounded-full bg-white dark:bg-slate-900"
            style={{ margin: isSmall ? 7 : 8 }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={`font-bold text-slate-900 dark:text-white truncate ${
              isSmall ? 'text-xs' : 'text-sm'
            }`}
          >
            {portfolio?.name || 'ポートフォリオ'}
          </p>
          {!isSmall && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              {portfolio?.author_name ? `by ${portfolio.author_name}` : ''}
              {timeText ? ` · 更新 ${timeText}` : ''}
            </p>
          )}
        </div>
        {!isSmall && portfolio?.return_1y != null && (
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded">
            +{Number(portfolio.return_1y).toFixed(1)}%
          </span>
        )}
      </div>

      {!isSmall && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {portfolio?.return_1y != null && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
              1Y +{Number(portfolio.return_1y).toFixed(1)}%
            </span>
          )}
          {portfolio?.fee != null && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
              信託報酬 {Number(portfolio.fee).toFixed(2)}%
            </span>
          )}
          {portfolio?.risk != null && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
              リスク {Number(portfolio.risk).toFixed(1)}%
            </span>
          )}
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            {allocations.length}{portfolio?.asset_type === 'stock' ? '銘柄' : 'ファンド'}
          </span>
        </div>
      )}

      <div className={`flex flex-col gap-1 ${isSmall ? 'gap-1' : 'gap-1.5'}`}>
        {allocations.slice(0, isSmall ? 3 : 6).map((a, i) => (
          <div key={a.id || a.symbol || i} className="flex items-center gap-2">
            <span
              className={`text-slate-500 dark:text-slate-400 truncate text-right flex-shrink-0 ${
                isSmall ? 'w-12 text-[9px]' : 'w-20 text-[10px]'
              }`}
              title={a.name}
            >
              {a.name}
            </span>
            <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded overflow-hidden">
              <div
                className="h-full rounded"
                style={{
                  width: `${Math.min(100, Number(a.weightPct) || 0)}%`,
                  backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length],
                }}
              />
            </div>
            <span className={`font-bold text-slate-900 dark:text-white flex-shrink-0 ${isSmall ? 'text-[9px] w-6' : 'text-[10px] w-7'}`}>
              {Number(a.weightPct || 0).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>

      {!isSmall && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={handleReference}
            disabled={busy || !currentUserId}
            className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-bold transition"
          >
            🥧 参考にする →
          </button>
          <button
            type="button"
            onClick={handleFollowToggle}
            disabled={busy || !currentUserId}
            className={`px-3 py-2 rounded-lg border text-xs font-bold transition ${
              isFollowed
                ? 'border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {isFollowed ? '参考中' : '詳細'}
          </button>
          {portfolio?.follower_count != null && portfolio.follower_count > 0 && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto">
              {portfolio.follower_count}人が参考中
            </span>
          )}
        </div>
      )}
    </div>
  )
}
