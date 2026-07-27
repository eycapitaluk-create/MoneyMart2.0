import { BookOpen, Crown, Eye, PenLine, Users } from 'lucide-react'
import { getTierForExp, tierBadgeClass, tierMedalClass } from '../../lib/communityTiers'

const ICON_BY_KEY = {
  eye: Eye,
  book: BookOpen,
  users: Users,
  pen: PenLine,
  crown: Crown,
}

const SIZE_MAP = {
  xs: { box: 'w-5 h-5', icon: 10, ring: 'ring-1', label: 'text-[9px]' },
  sm: { box: 'w-7 h-7', icon: 13, ring: 'ring-2', label: 'text-[10px]' },
  md: { box: 'w-10 h-10', icon: 18, ring: 'ring-2', label: 'text-xs' },
  lg: { box: 'w-14 h-14', icon: 24, ring: 'ring-[3px]', label: 'text-sm' },
}

/**
 * @param {{ tier?: object, totalExp?: number, size?: 'xs'|'sm'|'md'|'lg', showLabel?: boolean, className?: string }} props
 */
export default function CommunityTierBadge({
  tier = null,
  totalExp = null,
  size = 'sm',
  showLabel = false,
  className = '',
}) {
  const resolved = tier || getTierForExp(totalExp ?? 0)
  const Icon = ICON_BY_KEY[resolved?.icon] || Eye
  const sz = SIZE_MAP[size] || SIZE_MAP.sm

  return (
    <span className={`inline-flex items-center gap-1.5 shrink-0 ${className}`.trim()}>
      <span
        className={`inline-flex items-center justify-center rounded-full text-white shadow-md ring-offset-1 ring-offset-white dark:ring-offset-slate-900 ${sz.box} ${sz.ring} ${tierMedalClass(resolved.color)}`}
        title={`Lv${resolved.level} ${resolved.labelJa}`}
        aria-hidden={!showLabel}
      >
        <Icon size={sz.icon} strokeWidth={2.25} />
      </span>
      {showLabel ? (
        <span className={`font-bold leading-none ${sz.label} ${tierBadgeClass(resolved.color)} rounded-full px-2 py-0.5`}>
          {resolved.labelJa}
        </span>
      ) : null}
    </span>
  )
}
