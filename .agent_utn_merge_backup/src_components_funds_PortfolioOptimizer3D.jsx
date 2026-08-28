/**
 * Portfolio Optimizer 3D - placeholder (2D scatter fallback)
 */
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts'

export default function PortfolioOptimizer3D({
  points = [],
  pathPoints = [],
  currentPoint = null,
  optimalPoint = null,
  ranges = {},
  onOptimalPointClick,
}) {
  const data = (points || []).map((p) => ({ x: Number(p?.ret || 0) * 100, y: Number(p?.risk || 0) * 100, ...p }))
  const pathData = (pathPoints || []).map((p) => ({ x: Number(p?.ret || 0) * 100, y: Number(p?.risk || 0) * 100 }))

  if (data.length === 0) {
    return (
      <div className="h-[400px] md:h-[520px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">3D optimizer を読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="h-[400px] md:h-[520px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 12, bottom: 24, left: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" dataKey="x" name="リターン" unit="%" tick={{ fontSize: 10 }} />
          <YAxis type="number" dataKey="y" name="リスク" unit="%" tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v) => `${Number(v).toFixed(2)}%`} />
          <Scatter data={data} fill="#3b82f6" fillOpacity={0.6} />
          {optimalPoint && (
            <ReferenceDot
              x={Number(optimalPoint.ret || 0) * 100}
              y={Number(optimalPoint.risk || 0) * 100}
              r={8}
              fill="#10b981"
              stroke="#059669"
              onClick={onOptimalPointClick}
              style={{ cursor: 'pointer' }}
            />
          )}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
