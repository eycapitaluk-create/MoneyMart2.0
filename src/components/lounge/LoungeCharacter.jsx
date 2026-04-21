import React from 'react'

const VIEW_SIZE = 80

/**
 * ラウンジキャラ（5段階進化）
 * stage 1=たまご, 2=ひよこ, 3=成長, 4=マスター, 5=レジェンド
 * @param {{ stage: number, level?: number, size?: number, className?: string, showLevel?: boolean }} props
 */
export default function LoungeCharacter({
  stage = 1,
  level = 1,
  size = 48,
  className = '',
  showLevel = false,
}) {
  const s = Math.min(5, Math.max(1, Number(stage) || 1))
  const l = Math.max(1, Number(level) || 1)

  return (
    <div className={`inline-flex flex-col items-center justify-center ${className}`.trim()}>
      <div className="relative" style={{ width: size, height: size }}>
        {s === 1 && <Stage1Egg size={size} />}
        {s === 2 && <Stage2Hatchling size={size} />}
        {s === 3 && <Stage3Grown size={size} />}
        {s === 4 && <Stage4Master size={size} />}
        {s === 5 && <Stage5Legend size={size} />}
      </div>
      {showLevel && (
        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 mt-0.5 leading-none">
          Lv.{l}
        </span>
      )}
    </div>
  )
}

function Stage1Egg({ size }) {
  return (
    <svg
      viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
      width={size}
      height={size}
      className="block"
      aria-hidden
    >
      <defs>
        <linearGradient id="egg-fill" x1="0%" y1="0%" x2="40%" y2="100%">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="60%" stopColor="#fcd34d" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <filter id="egg-soft">
          <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodOpacity="0.2" />
        </filter>
      </defs>
      <ellipse
        cx="40"
        cy="44"
        rx="22"
        ry="28"
        fill="url(#egg-fill)"
        stroke="#d97706"
        strokeWidth="1.5"
        filter="url(#egg-soft)"
      />
      <ellipse cx="34" cy="38" rx="6" ry="8" fill="rgba(255,255,255,0.5)" />
    </svg>
  )
}

function Stage2Hatchling({ size }) {
  return (
    <svg
      viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
      width={size}
      height={size}
      className="block"
      aria-hidden
    >
      <defs>
        <linearGradient id="hatch-body" x1="0%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#fed7aa" />
          <stop offset="100%" stopColor="#fdba74" />
        </linearGradient>
        <filter id="hatch-soft">
          <feDropShadow dx="0" dy="2" stdDeviation="1" floodOpacity="0.15" />
        </filter>
      </defs>
      {/* body */}
      <circle cx="40" cy="46" r="18" fill="url(#hatch-body)" stroke="#ea580c" strokeWidth="1.5" filter="url(#hatch-soft)" />
      {/* belly */}
      <ellipse cx="40" cy="50" rx="10" ry="8" fill="rgba(255,255,255,0.6)" />
      {/* eyes */}
      <ellipse cx="34" cy="42" rx="4" ry="5" fill="#1e293b" />
      <ellipse cx="46" cy="42" rx="4" ry="5" fill="#1e293b" />
      <circle cx="35" cy="40" r="1" fill="white" />
      <circle cx="47" cy="40" r="1" fill="white" />
      {/* smile */}
      <path d="M 32 48 Q 40 54 48 48" stroke="#c2410c" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* feet */}
      <ellipse cx="32" cy="62" rx="5" ry="3" fill="#ea580c" />
      <ellipse cx="48" cy="62" rx="5" ry="3" fill="#ea580c" />
    </svg>
  )
}

function Stage3Grown({ size }) {
  return (
    <svg
      viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
      width={size}
      height={size}
      className="block"
      aria-hidden
    >
      <defs>
        <linearGradient id="grown-body" x1="0%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#ffedd5" />
          <stop offset="100%" stopColor="#fb923c" />
        </linearGradient>
        <filter id="grown-soft">
          <feDropShadow dx="0" dy="2" stdDeviation="1.2" floodOpacity="0.2" />
        </filter>
      </defs>
      {/* body */}
      <circle cx="40" cy="45" r="20" fill="url(#grown-body)" stroke="#ea580c" strokeWidth="1.5" filter="url(#grown-soft)" />
      <ellipse cx="40" cy="50" rx="11" ry="9" fill="rgba(255,255,255,0.5)" />
      {/* eyes */}
      <ellipse cx="32" cy="42" rx="5" ry="6" fill="#1e293b" />
      <ellipse cx="48" cy="42" rx="5" ry="6" fill="#1e293b" />
      <circle cx="33" cy="40" r="1.5" fill="white" />
      <circle cx="49" cy="40" r="1.5" fill="white" />
      {/* smile */}
      <path d="M 30 50 Q 40 58 50 50" stroke="#c2410c" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {/* arms (wave) */}
      <path d="M 22 44 Q 18 38 22 34" stroke="#ea580c" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M 58 44 Q 62 38 58 34" stroke="#ea580c" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* feet */}
      <ellipse cx="30" cy="62" rx="6" ry="3.5" fill="#ea580c" />
      <ellipse cx="50" cy="62" rx="6" ry="3.5" fill="#ea580c" />
    </svg>
  )
}

function Stage4Master({ size }) {
  return (
    <svg
      viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
      width={size}
      height={size}
      className="block"
      aria-hidden
    >
      <defs>
        <linearGradient id="master-body" x1="0%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#fff7ed" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
        <linearGradient id="master-ribbon" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <filter id="master-soft">
          <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodOpacity="0.25" />
        </filter>
      </defs>
      {/* ribbon/badge */}
      <path d="M 40 8 L 44 20 L 40 18 L 36 20 Z" fill="url(#master-ribbon)" stroke="#d97706" strokeWidth="0.8" />
      <circle cx="40" cy="16" r="3" fill="#fef3c7" stroke="#d97706" strokeWidth="0.6" />
      {/* body */}
      <circle cx="40" cy="44" r="21" fill="url(#master-body)" stroke="#ea580c" strokeWidth="1.8" filter="url(#master-soft)" />
      <ellipse cx="40" cy="50" rx="12" ry="10" fill="rgba(255,255,255,0.45)" />
      {/* eyes */}
      <ellipse cx="31" cy="41" rx="5.5" ry="6.5" fill="#1e293b" />
      <ellipse cx="49" cy="41" rx="5.5" ry="6.5" fill="#1e293b" />
      <circle cx="32" cy="39" r="2" fill="white" />
      <circle cx="50" cy="39" r="2" fill="white" />
      {/* smile - confident */}
      <path d="M 28 50 Q 40 60 52 50" stroke="#c2410c" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {/* arms */}
      <path d="M 20 42 Q 14 36 18 28" stroke="#ea580c" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <path d="M 60 42 Q 66 36 62 28" stroke="#ea580c" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      {/* feet */}
      <ellipse cx="28" cy="63" rx="7" ry="4" fill="#ea580c" />
      <ellipse cx="52" cy="63" rx="7" ry="4" fill="#ea580c" />
    </svg>
  )
}

function Stage5Legend({ size }) {
  return (
    <svg
      viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
      width={size}
      height={size}
      className="block"
      aria-hidden
    >
      <defs>
        <linearGradient id="legend-glow" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#fcd34d" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id="legend-body" x1="0%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#fff7ed" />
          <stop offset="50%" stopColor="#fdba74" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
        <filter id="legend-glow-filter">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="legend-soft">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#f59e0b" floodOpacity="0.35" />
        </filter>
      </defs>
      {/* outer glow */}
      <circle cx="40" cy="42" r="26" fill="url(#legend-glow)" opacity="0.6" filter="url(#legend-glow-filter)" />
      {/* star/crown */}
      <path
        d="M 40 6 L 43 16 L 52 16 L 45 22 L 48 32 L 40 26 L 32 32 L 35 22 L 28 16 L 37 16 Z"
        fill="#fbbf24"
        stroke="#d97706"
        strokeWidth="0.8"
      />
      {/* body */}
      <circle cx="40" cy="44" r="22" fill="url(#legend-body)" stroke="#ea580c" strokeWidth="2" filter="url(#legend-soft)" />
      <ellipse cx="40" cy="50" rx="13" ry="11" fill="rgba(255,255,255,0.4)" />
      {/* eyes */}
      <ellipse cx="30" cy="41" rx="6" ry="7" fill="#1e293b" />
      <ellipse cx="50" cy="41" rx="6" ry="7" fill="#1e293b" />
      <circle cx="31" cy="39" r="2" fill="white" />
      <circle cx="51" cy="39" r="2" fill="white" />
      {/* smile */}
      <path d="M 26 51 Q 40 62 54 51" stroke="#c2410c" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* arms - triumph */}
      <path d="M 18 40 Q 10 28 16 18" stroke="#ea580c" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M 62 40 Q 70 28 64 18" stroke="#ea580c" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      {/* feet */}
      <ellipse cx="26" cy="64" rx="8" ry="4" fill="#ea580c" />
      <ellipse cx="54" cy="64" rx="8" ry="4" fill="#ea580c" />
    </svg>
  )
}

export const STAGE_NAMES = {
  1: 'たまご',
  2: 'ひよこ',
  3: '成長',
  4: 'マスター',
  5: 'レジェンド',
}
