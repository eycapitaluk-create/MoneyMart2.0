import { Info, X } from 'lucide-react'
import { C, DISCLAIMER, cardShadow } from './theme'

export {
  DonutChart as Donut,
  HealthDonut,
  PriorityRing,
  RiskScoreGauge as RiskGauge,
  ConcentrationDonut,
  AreaChart,
  PeriodReturnStats,
  PortfolioValueChart,
  BenchmarkCompareChart,
  buildDemoValueSeries,
  AllocationBar,
  TargetAllocBars,
  RadarChart,
  RiskArcGauge,
  FearGreedGauge,
  SectorHeatmap,
  Sparkline,
  CHART,
  healthBucketsFromClients,
} from './charts'

export function Card({ children, className = '', style = {}, padding = 14 }) {
  return (
    <div
      className={`bg-white ${className}`}
      style={{
        borderRadius: 12,
        boxShadow: cardShadow,
        border: `1px solid ${C.border}`,
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function Pill({ children, bg = C.accentLight, color = C.accentDark, className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${className}`}
      style={{ background: bg, color }}
    >
      {children}
    </span>
  )
}

export function DisclaimerBanner({ className = '' }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-lg px-3 py-2 text-[10px] leading-relaxed ${className}`}
      style={{ background: C.surfaceSub, color: C.textMuted, border: `1px solid ${C.borderSub}` }}
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: C.navyLight }} />
      <span>{DISCLAIMER}</span>
    </div>
  )
}

export function Toast({ message, onDone }) {
  if (!message) return null
  return (
    <div className="fixed bottom-16 left-1/2 z-[80] -translate-x-1/2">
      <div
        className="rounded-full px-4 py-2 text-[12px] font-bold text-white shadow-lg"
        style={{ background: C.green }}
        onAnimationEnd={onDone}
      >
        {message}
      </div>
    </div>
  )
}

export function DemoBanner({ dismissed, onDismiss }) {
  if (dismissed) return null
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[70] flex items-center justify-center gap-3 px-4 py-2 text-[11px] font-medium text-white"
      style={{ background: C.navy }}
    >
      <span>これはデモ環境です。実データは表示されません。</span>
      <button type="button" onClick={onDismiss} className="rounded-full p-1 hover:bg-white/10" aria-label="閉じる">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function HitlBar({ status, onAccept, onEdit, onReject }) {
  const btn = (label, active, onClick, fill) => (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-3 py-1.5 text-[11px] font-bold"
      style={{
        background: active ? fill : '#fff',
        color: active ? '#fff' : C.textSecondary,
        border: `1px solid ${active ? fill : C.border}`,
      }}
    >
      {label}
    </button>
  )
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {btn('承認', status === 'accepted', onAccept, C.green)}
      {btn('修正', status === 'edited', onEdit, C.accent)}
      {btn('見送り', status === 'rejected', onReject, C.textMuted)}
    </div>
  )
}
