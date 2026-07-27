import { TrendingDown, TrendingUp, Minus } from 'lucide-react'

const SENTIMENT_META = {
  bullish: {
    label: '上昇',
    Icon: TrendingUp,
    badge: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900',
    icon: 'text-red-600 dark:text-red-400',
  },
  bearish: {
    label: '下落',
    Icon: TrendingDown,
    badge: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900',
    icon: 'text-blue-600 dark:text-blue-400',
  },
  neutral: {
    label: '様子見',
    Icon: Minus,
    badge: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    icon: 'text-slate-500',
  },
}

export function getSentimentMeta(sentiment) {
  return SENTIMENT_META[sentiment] || SENTIMENT_META.neutral
}

export function SentimentBadge({ sentiment, size = 'sm', className = '' }) {
  const meta = getSentimentMeta(sentiment)
  const Icon = meta.Icon
  const sizeClass = size === 'lg'
    ? 'text-xs px-2.5 py-1 gap-1'
    : 'text-[10px] px-2 py-0.5 gap-0.5'
  return (
    <span
      className={`inline-flex items-center font-black rounded-full border ${meta.badge} ${sizeClass} ${className}`}
      title={`相場観: ${meta.label}`}
    >
      <Icon size={size === 'lg' ? 14 : 11} className={meta.icon} aria-hidden />
      {meta.label}
    </span>
  )
}

export function SentimentPicker({ value, onChange, className = '' }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {(['bullish', 'bearish', 'neutral']).map((key) => {
        const meta = getSentimentMeta(key)
        const Icon = meta.Icon
        const active = value === key
        const activeRing = key === 'bullish'
          ? 'ring-2 ring-red-400 border-red-300 bg-red-50 dark:bg-red-950/40'
          : key === 'bearish'
            ? 'ring-2 ring-blue-400 border-blue-300 bg-blue-50 dark:bg-blue-950/40'
            : 'ring-2 ring-slate-400 border-slate-300 bg-slate-50 dark:bg-slate-800'
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
              active ? activeRing : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Icon size={14} className={meta.icon} aria-hidden />
            {meta.label}
          </button>
        )
      })}
    </div>
  )
}
