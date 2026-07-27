import { ChevronDown, ChevronUp, CheckCircle2, Lock, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  COMMUNITY_EXP_REWARDS,
  COMMUNITY_POST_UNLOCK_LINES,
  COMMUNITY_TIERS,
} from '../../lib/communityTiers'
import CommunityTierBadge from './CommunityTierBadge'

const PERMISSION_ROWS = [
  { label: '本文を読む', requirement: 'ログイン' },
  { label: 'いいね', requirement: 'ログイン（ビギナー〜）' },
  { label: 'コメント', requirement: '900 EXP（メンバー〜）' },
  { label: '投稿', requirement: '資産1件登録 または 2,500 EXP（ライター〜）' },
]

const TIER_ROWS = COMMUNITY_TIERS.map((tier) => ({
  ...tier,
  perks: [
    tier.canReadBody ? '本文を読める' : null,
    tier.canLike ? 'いいね' : null,
    tier.canComment ? 'コメント' : null,
    tier.canPost ? '投稿（EXP）' : null,
  ].filter(Boolean),
}))

export default function CommunityGuidePanel({
  tier,
  totalExp = 0,
  expToNext = null,
  hasPortfolioAsset = false,
  canCompose = false,
  compact = false,
}) {
  const [open, setOpen] = useState(!compact)

  return (
    <section className="rounded-2xl border border-orange-200/80 dark:border-orange-900/50 bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-slate-900 dark:via-slate-900 dark:to-orange-950/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles size={18} className="text-orange-500 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-900 dark:text-white">コミュニティの仕組み</p>
            <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
              ログインで読める · 資産登録で投稿 · EXPでコメントやバッジアップ
            </p>
          </div>
        </div>
        {open ? <ChevronUp size={18} className="shrink-0 text-slate-500" /> : <ChevronDown size={18} className="shrink-0 text-slate-500" />}
      </button>

      {open ? (
        <div className="px-4 pb-4 space-y-4 border-t border-orange-100 dark:border-orange-900/40">
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 pt-3">
            MoneyMartコミュニティは、投資家同士がテーマ別に議論する場です。
            <strong className="font-bold text-slate-800 dark:text-slate-100"> ログイン</strong>
            すれば投稿本文を読めます。
            <strong className="font-bold text-slate-800 dark:text-slate-100"> EXP</strong>
            を貯めるとコメントやバッジが解放されます。投稿は
            <strong className="font-bold text-slate-800 dark:text-slate-100"> マイページでの資産登録</strong>
            でも、
            <strong className="font-bold text-slate-800 dark:text-slate-100"> 2,500 EXP（ライター）</strong>
            でも可能です。
          </p>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/60 overflow-hidden">
            <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 px-3 pt-2.5 pb-1">参加できること</p>
            <ul className="divide-y divide-slate-100 dark:divide-slate-700/80 text-xs">
              {PERMISSION_ROWS.map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="font-bold text-slate-800 dark:text-slate-100">{row.label}</span>
                  <span className="text-slate-500 dark:text-slate-400 text-right">{row.requirement}</span>
                </li>
              ))}
            </ul>
          </div>

          {tier ? (
            <div className="rounded-xl bg-white/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-3 py-3 space-y-2">
              <div className="flex items-center gap-3">
                <CommunityTierBadge tier={tier} size="lg" />
                <div className="text-xs min-w-0">
                  <p className="font-bold text-slate-800 dark:text-slate-100">
                    あなたのバッジ: {tier.labelJa}
                  </p>
                  <p className="text-slate-600 dark:text-slate-300 mt-0.5">{totalExp} EXP</p>
                  {expToNext != null && expToNext > 0 ? (
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">次のランクまで あと {expToNext} EXP</p>
                  ) : (
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">最高ランクです</p>
                  )}
                </div>
              </div>
              {canCompose ? (
                <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 size={14} aria-hidden />
                  投稿できます
                  {hasPortfolioAsset && !tier.canPost ? '（資産登録済み）' : ''}
                </p>
              ) : (
                <p className="text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
                  <Lock size={13} className="shrink-0 mt-0.5 text-orange-500" aria-hidden />
                  <span>
                    投稿するには
                    <Link to="/mypage?tab=stock" className="font-bold text-orange-600 dark:text-orange-400 hover:underline mx-0.5">資産を1件登録</Link>
                    するか、ライターバッジ（2,500 EXP）を目指してください。
                  </span>
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl bg-white/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-3 py-2.5 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <Lock size={14} className="shrink-0" />
              <span>
                <Link to="/login" className="font-bold text-orange-600 dark:text-orange-400 hover:underline">ログイン</Link>
                すると本文の閲覧や EXP の獲得ができます。
              </span>
            </div>
          )}

          <div className="rounded-xl border border-orange-200/70 dark:border-orange-900/40 bg-orange-50/60 dark:bg-orange-950/20 px-3 py-2.5">
            <p className="text-[11px] font-black text-orange-800 dark:text-orange-200 mb-1">投稿の解放条件</p>
            <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-0.5 list-disc pl-4">
              {COMMUNITY_POST_UNLOCK_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {TIER_ROWS.map((row) => (
              <div
                key={row.id}
                className={`rounded-xl border px-3 py-2.5 flex gap-2.5 ${
                  tier?.id === row.id
                    ? 'border-orange-400 bg-orange-50/80 dark:bg-orange-950/30 dark:border-orange-700'
                    : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/40'
                }`}
              >
                <CommunityTierBadge tier={row} size="md" className="mt-0.5" />
                <div className="min-w-0 text-xs">
                  <p className="font-black text-slate-800 dark:text-slate-100">
                    Lv{row.level} {row.labelJa}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{row.minExp} EXP〜</p>
                  <p className="text-slate-600 dark:text-slate-400 mt-1 leading-snug">{row.perks.join(' · ')}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            ※ 投稿は上記のとおり、資産1件登録でも解放されます（EXPのライター到達前でも可）。
          </p>

          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">EXPの貯め方</p>
            <ul className="grid sm:grid-cols-2 gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              {COMMUNITY_EXP_REWARDS.map((row) => (
                <li key={row.action} className="flex justify-between gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 px-2 py-1">
                  <span>{row.labelJa}</span>
                  <span className="font-bold text-orange-600 dark:text-orange-400">+{row.points}</span>
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
              株式・ファンド・関心リスト・資産タブのいずれかから
              <Link to="/mypage?tab=stock" className="text-orange-600 dark:text-orange-400 hover:underline mx-0.5">マイページ</Link>
              で登録できます。毎日のログインでも少しずつランクアップできます。
            </p>
          </div>
        </div>
      ) : null}
    </section>
  )
}
