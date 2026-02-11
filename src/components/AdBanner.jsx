/**
 * 広告バナー - 金融・投資関連の広告用
 * 1ページあたり1〜2個程度に抑え、ユーザー体験を損なわない設計
 * @param variant - 'horizontal' | 'vertical' | 'compact'
 */
export default function AdBanner({ variant = 'horizontal', className = '' }) {
  const isHorizontal = variant === 'horizontal'
  const isCompact = variant === 'compact'
  const isVertical = variant === 'vertical'

  return (
    <div
      className={`rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 ${className}`}
      role="presentation"
      aria-label="広告"
    >
      <div
        className={`flex ${
          isCompact ? 'flex-col p-3 gap-3' : isVertical ? 'flex-col p-4 gap-4' : 'flex-row p-4 gap-4'
        }`}
      >
        <div
          className={`shrink-0 ${
            isCompact ? 'w-full h-20' : isVertical ? 'w-full h-24' : 'w-20 h-20'
          } rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center`}
        >
          <span className="text-2xl font-black text-slate-400 dark:text-slate-500">AD</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
            広告
          </p>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300 line-clamp-2">
            投資信託・保険・カード比較サービス
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            あなたに最適な金融商品を比較
          </p>
        </div>
      </div>
    </div>
  )
}
