/**
 * ホーム「登録前にイメージ」用。実オプティマイザーUIの見た目のみ（数値・3Dはイメージ、非機能）。
 */

const SLIDERS = [
  {
    pct: 40.0,
    label: '上場インデックス型…',
    r: '+104.4%',
    sigma: '69.1%',
    track: 'from-sky-500/35 to-sky-500/10 dark:from-sky-500/25 dark:to-sky-500/5',
    fill: 'bg-sky-500',
    text: 'text-sky-600 dark:text-sky-300',
  },
  {
    pct: 25.0,
    label: '日本株式（物化）…',
    r: '+103.3%',
    sigma: '71.8%',
    track: 'from-emerald-500/35 to-emerald-500/10 dark:from-emerald-500/25 dark:to-emerald-500/5',
    fill: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-300',
  },
  {
    pct: 35.0,
    label: '半導体関連…',
    r: '+98.9%',
    sigma: '47.6%',
    track: 'from-orange-500/35 to-orange-500/10 dark:from-orange-500/25 dark:to-orange-500/5',
    fill: 'bg-orange-500',
    text: 'text-orange-600 dark:text-orange-300',
  },
]

function FakeOptimizer3DPanel() {
  return (
    <div className="relative w-full h-full min-h-[176px] sm:min-h-0 sm:flex-1 rounded-lg overflow-hidden border border-slate-200/90 dark:border-slate-600/80 bg-gradient-to-br from-slate-100 via-[#e8edf7] to-slate-100 dark:from-slate-900 dark:via-[#1a2235] dark:to-slate-900">
      <div className="absolute left-1.5 top-1.5 z-10 flex flex-wrap gap-1 pointer-events-none">
        {['信託報酬', 'リスク', 'リターン'].map((t) => (
          <span
            key={t}
            className="rounded-full bg-white/90 dark:bg-slate-900/90 px-1.5 py-0.5 text-[6px] sm:text-[7px] font-black text-slate-700 dark:text-slate-200 shadow-sm border border-slate-200/80 dark:border-slate-700/80"
          >
            {t}
          </span>
        ))}
      </div>
      <div className="absolute right-1.5 top-1.5 z-10 flex flex-col gap-1 max-w-[48%] pointer-events-none">
        <div className="rounded-md bg-white/92 dark:bg-slate-900/90 border border-emerald-200/90 dark:border-emerald-800/60 px-1.5 py-1 shadow-sm">
          <p className="text-[6px] font-black text-emerald-700 dark:text-emerald-300">現在の配分</p>
          <p className="text-[6px] font-semibold text-slate-600 dark:text-slate-300 leading-tight mt-0.5 tabular-nums">
            R 102.2% / Risk 56.2% / Fee 0.26
          </p>
        </div>
        <div className="rounded-md bg-white/92 dark:bg-slate-900/90 border border-orange-200/90 dark:border-orange-800/60 px-1.5 py-1 shadow-sm">
          <p className="text-[6px] font-black text-orange-700 dark:text-orange-300">最適配分</p>
          <p className="text-[6px] font-semibold text-slate-600 dark:text-slate-300 leading-tight mt-0.5 tabular-nums">
            R 102.2% / Risk 56.2% / Fee 0.26
          </p>
        </div>
      </div>

      <div className="absolute inset-0 flex items-end justify-center pt-7 pb-4 sm:pb-5 px-2">
        <div
          className="relative w-[90%] h-[min(82%,11.5rem)] min-h-[118px] sm:min-h-[132px] max-w-[220px]"
          style={{ perspective: '240px' }}
        >
          <div
            className="absolute inset-0 rounded-[3px] shadow-[inset_0_0_24px_rgba(255,255,255,0.12),0_12px_28px_rgba(15,23,42,0.18)] dark:shadow-[inset_0_0_28px_rgba(255,255,255,0.06),0_12px_28px_rgba(0,0,0,0.45)]"
            style={{
              transform: 'rotateX(58deg) rotateZ(-28deg)',
              transformStyle: 'preserve-3d',
              background: `
                linear-gradient(118deg, rgba(20,184,166,0.92) 0%, rgba(37,99,235,0.78) 38%, rgba(79,70,229,0.88) 68%, rgba(250,204,21,0.55) 100%)
              `,
            }}
          />
          <div
            className="absolute inset-0 rounded-[3px] opacity-[0.22] dark:opacity-[0.18] pointer-events-none"
            style={{
              transform: 'rotateX(58deg) rotateZ(-28deg)',
              backgroundImage: `
                linear-gradient(90deg, rgba(15,23,42,0.5) 1px, transparent 1px),
                linear-gradient(rgba(15,23,42,0.45) 1px, transparent 1px)
              `,
              backgroundSize: '11px 11px',
            }}
          />
          <div
            className="absolute left-[56%] top-[38%] z-[2] w-2 h-2 bg-orange-500 rotate-45 border border-orange-100 dark:border-orange-950 shadow-md pointer-events-none"
            aria-hidden
          />
        </div>
      </div>

      <div className="absolute bottom-1 left-1 right-1 flex justify-between gap-1 text-[5px] sm:text-[6px] font-bold text-slate-500 dark:text-slate-400 pointer-events-none tabular-nums">
        <span className="truncate">信託報酬 0.25–0.30</span>
        <span className="truncate text-center">リスク 50–65</span>
        <span className="truncate text-right">リターン 100–103.5</span>
      </div>
    </div>
  )
}

export default function HomeOptimizer3DShowcase() {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 overflow-hidden w-full h-full min-h-0 flex flex-col flex-1">
      <div className="px-2.5 pt-2 pb-1.5 border-b border-slate-200/80 dark:border-slate-700/80 flex flex-wrap items-start justify-between gap-1.5 shrink-0">
        <div className="min-w-0 flex-1">
          <p className="text-[8px] sm:text-[9px] font-black text-slate-900 dark:text-white leading-tight">
            3D ポートフォリオ最適化（リスク / リターン / 信託報酬）
          </p>
          <p className="text-[7px] sm:text-[8px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug line-clamp-2">
            比較で2〜3本を選ぶと、配分に応じて最適点が動くイメージです（デモ・操作不可）。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1 shrink-0 justify-end">
          <span className="text-[6px] sm:text-[7px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
            上位3自動
          </span>
          <span className="text-[6px] sm:text-[7px] font-black px-1.5 py-0.5 rounded-md border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-800/80 whitespace-nowrap">
            最適配分を適用
          </span>
        </div>
      </div>

      <div className="p-2 sm:p-2.5 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-2.5 flex-1 min-h-0">
        <div className="shrink-0 sm:w-[min(100%,148px)] rounded-lg border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/70 p-1.5 sm:p-2">
          <p className="text-[7px] sm:text-[8px] font-black tracking-wide text-slate-600 dark:text-slate-300 mb-1.5 text-center">
            ファンド配分コントロール
          </p>
          <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
            {SLIDERS.map((s) => (
              <div
                key={s.label}
                className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-1"
              >
                <p className={`text-[8px] sm:text-[9px] font-black text-center tabular-nums ${s.text}`}>
                  {s.pct.toFixed(1)}%
                </p>
                <div className="relative h-[4.75rem] sm:h-20 mt-1 mx-auto w-6 flex justify-center">
                  <div className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-1.5 rounded-full bg-gradient-to-b ${s.track}`} />
                  <div
                    className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-2 rounded-full ${s.fill} shadow-sm`}
                    style={{ height: `${Math.min(100, s.pct)}%` }}
                    aria-hidden
                  />
                </div>
                <p className="text-[6px] sm:text-[7px] font-black text-slate-700 dark:text-slate-200 text-center mt-1 line-clamp-2 min-h-[26px] leading-tight">
                  {s.label}
                </p>
                <p className="text-[5px] sm:text-[6px] text-slate-500 dark:text-slate-400 text-center mt-0.5 tabular-nums leading-tight">
                  R {s.r} / σ {s.sigma}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-0 min-h-[176px] sm:min-h-0 flex flex-col h-full">
          <FakeOptimizer3DPanel />
        </div>
      </div>
    </div>
  )
}
