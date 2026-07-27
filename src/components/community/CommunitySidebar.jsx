import { Link } from 'react-router-dom'
import { Search, X, Trophy, TrendingUp, TrendingDown, Minus, Bookmark, BookOpen, ChevronDown, ChevronUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { getTierForExp } from '../../lib/communityTiers'
import { filterPublicCommunityTags } from '../../lib/communitySeed'
import CommunityTierBadge from './CommunityTierBadge'

function SentimentBar({ label, count, total, colorClass, barClass }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] font-bold">
        <span className={colorClass}>{label}</span>
        <span className="text-slate-500">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function CommunitySidebar({
  searchInput,
  onSearchInputChange,
  onSearchSubmit,
  onClearSearch,
  trendingTags = [],
  onTagSearch,
  sentimentSummary = null,
  trendingTickers = [],
  onTickerSearch,
  leaderboard = [],
  latestInsight = null,
  showMobileSearch = false,
}) {
  const [hintsOpen, setHintsOpen] = useState(false)
  const publicTrendingTags = useMemo(
    () => (trendingTags || []).filter((row) => filterPublicCommunityTags([row?.tag]).length > 0),
    [trendingTags],
  )

  const total = sentimentSummary?.total || 0
  const counts = sentimentSummary?.counts || { bullish: 0, bearish: 0, neutral: 0 }

  const searchForm = (className = '') => (
    <form onSubmit={onSearchSubmit} className={`relative ${className}`}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={searchInput}
        onChange={(e) => onSearchInputChange(e.target.value)}
        placeholder="キーワード・#タグ・$銘柄"
        className="w-full rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
      />
      {searchInput ? (
        <button type="button" onClick={onClearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
          <X size={14} />
        </button>
      ) : null}
    </form>
  )

  return (
    <aside className="space-y-4 lg:sticky lg:top-[5.25rem] lg:z-20 lg:max-h-[calc(100vh-5.75rem)] lg:overflow-y-auto lg:overscroll-y-contain">
      {showMobileSearch ? searchForm('lg:hidden') : null}
      {searchForm('hidden lg:block')}

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <h2 className="text-sm font-black text-slate-900 dark:text-white mb-3">話題のタグ</h2>
        {publicTrendingTags.length === 0 ? (
          <p className="text-xs text-slate-400">集計中…</p>
        ) : (
          <ul className="space-y-1">
            {publicTrendingTags.map((row) => (
              <li key={row.tag}>
                <button
                  type="button"
                  onClick={() => onTagSearch(row.tag)}
                  className="w-full flex justify-between items-center text-xs rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
                >
                  <span className="font-bold text-slate-700 dark:text-slate-200">#{row.tag}</span>
                  <span className="text-slate-400">{row.count}件</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <h2 className="text-sm font-black text-slate-900 dark:text-white mb-1">コミュニティの相場観</h2>
        <p className="text-[10px] text-slate-500 mb-3">直近の投稿から集計</p>
        {total === 0 ? (
          <p className="text-xs text-slate-400">データがありません</p>
        ) : (
          <div className="space-y-3">
            <SentimentBar
              label="上昇"
              count={counts.bullish}
              total={total}
              colorClass="text-red-600 dark:text-red-400"
              barClass="bg-red-500"
            />
            <SentimentBar
              label="下落"
              count={counts.bearish}
              total={total}
              colorClass="text-blue-600 dark:text-blue-400"
              barClass="bg-blue-500"
            />
            <SentimentBar
              label="様子見"
              count={counts.neutral}
              total={total}
              colorClass="text-slate-600 dark:text-slate-400"
              barClass="bg-slate-400"
            />
            <div className="flex gap-3 pt-1 text-[10px] text-slate-500">
              <span className="inline-flex items-center gap-0.5"><TrendingUp size={11} className="text-red-500" />{counts.bullish}</span>
              <span className="inline-flex items-center gap-0.5"><TrendingDown size={11} className="text-blue-500" />{counts.bearish}</span>
              <span className="inline-flex items-center gap-0.5"><Minus size={11} />{counts.neutral}</span>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <h2 className="text-sm font-black text-slate-900 dark:text-white mb-3">話題の銘柄</h2>
        {trendingTickers.length === 0 ? (
          <p className="text-xs text-slate-400">集計中…</p>
        ) : (
          <ul className="space-y-1">
            {trendingTickers.map((row) => (
              <li key={row.ticker}>
                <button
                  type="button"
                  onClick={() => onTickerSearch(row.ticker)}
                  className="w-full flex justify-between items-center text-xs rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
                >
                  <span className="font-bold text-orange-600 dark:text-orange-400">${row.ticker}</span>
                  <span className="text-slate-400">{row.count}件</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={16} className="text-amber-500" />
          <h2 className="text-sm font-black text-slate-900 dark:text-white">EXPランキング</h2>
        </div>
        {leaderboard.length === 0 ? (
          <p className="text-xs text-slate-400">ランキング準備中…</p>
        ) : (
          <ol className="space-y-2">
            {leaderboard.map((row, index) => {
              const tier = getTierForExp(row.total_exp)
              return (
                <li key={row.user_id} className="flex items-center gap-2 text-xs">
                  <span className="w-5 text-center font-black text-slate-400">{index + 1}</span>
                  <CommunityTierBadge tier={tier} size="xs" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{row.name}</p>
                    <p className="text-[10px] text-slate-500">{row.total_exp} EXP · {tier.labelJa}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      {latestInsight?.slug ? (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={15} className="text-amber-600" />
            <h2 className="text-sm font-black text-slate-900 dark:text-white">新着インサイト</h2>
          </div>
          <Link
            to={`/insights/${encodeURIComponent(latestInsight.slug)}`}
            className="block text-sm font-bold text-slate-800 dark:text-slate-100 hover:text-orange-600 dark:hover:text-orange-400 leading-snug line-clamp-2"
          >
            {latestInsight.pageTitle || latestInsight.page_title || 'インサイトを読む'}
          </Link>
          {latestInsight.categoryLabel || latestInsight.category_label ? (
            <p className="text-[10px] text-slate-500 mt-1">{latestInsight.categoryLabel || latestInsight.category_label}</p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <button
          type="button"
          onClick={() => setHintsOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <span className="text-sm font-black text-slate-900 dark:text-white">参加のヒント</span>
          {hintsOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>
        {hintsOpen ? (
          <div className="px-4 pb-4 text-xs text-slate-600 dark:text-slate-300 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
            <ul className="list-disc pl-4 space-y-1">
              <li>毎日ログインで +5 EXP</li>
              <li>マイページで銘柄・資産登録 +30 EXP</li>
              <li>3銘柄以上で +50 EXP ボーナス</li>
              <li>投稿は資産1件登録で解放（2,500 EXPでも可）</li>
            </ul>
            <Link to="/mypage?tab=stock" className="inline-flex items-center gap-1 font-bold text-orange-600 dark:text-orange-400 hover:underline">
              マイページで登録する →
            </Link>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-3 text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-2">
        <Bookmark size={14} className="shrink-0 mt-0.5 text-orange-500" />
        <span>気になる投稿はブックマークして「保存」タブからいつでも読み返せます。</span>
      </div>
    </aside>
  )
}
