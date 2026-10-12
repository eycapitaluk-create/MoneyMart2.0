import { useMemo } from 'react'
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  usePlotArea,
} from 'recharts'
import { MARKET_DOWN_HEX, MARKET_UP_HEX } from '../../lib/marketDirectionColors'

const formatChartDateLabel = (tradeDate, timeframe) => {
  if (!tradeDate) return ''
  const date = new Date(`${tradeDate}T00:00:00`)
  if (Number.isNaN(date.getTime())) return tradeDate
  if (timeframe === '1D' || timeframe === '5D' || timeframe === 'YTD') {
    return `${date.getMonth() + 1}/${date.getDate()}`
  }
  if (timeframe === '1Y') {
    return `${String(date.getFullYear()).slice(-2)}/${date.getMonth() + 1}/${date.getDate()}`
  }
  return `${date.getMonth() + 1}/${date.getDate()}`
}

const formatAxisPrice = (value, region) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}k`
  if (region === 'JP') return Math.round(n).toLocaleString('ja-JP')
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n < 10 ? n.toFixed(2) : String(Math.round(n * 10) / 10)
}

const formatVolume = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return '--'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(Math.round(n))
}

function CandlestickSeries({ data, priceDomain, upColor, downColor }) {
  const plotArea = usePlotArea()

  const layout = useMemo(() => {
    if (!plotArea || !Array.isArray(data) || data.length === 0) return null
    const yMin = Number(priceDomain?.[0])
    const yMax = Number(priceDomain?.[1])
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax) || yMax <= yMin) return null

    const n = data.length
    const bandW = plotArea.width / n
    const bodyW = Math.max(2, bandW * 0.62)
    const yRange = yMax - yMin
    const yFor = (price) => plotArea.height - ((Number(price) - yMin) / yRange) * plotArea.height
    const xFor = (index) => bandW * index + bandW / 2

    return { bandW, bodyW, yFor, xFor }
  }, [plotArea, data, priceDomain])

  if (!plotArea || !layout) return null

  const { bodyW, yFor, xFor } = layout

  return (
    <g className="stock-candles" transform={`translate(${plotArea.x}, ${plotArea.y})`}>
      {data.map((d, index) => {
        const close = Number(d.close)
        const open = Number(d.open)
        const high = Number(d.high)
        const low = Number(d.low)
        if (!Number.isFinite(close) || close <= 0) return null
        if (![open, high, low].every((v) => Number.isFinite(v) && v > 0)) return null

        const cx = xFor(index)
        const xRect = cx - bodyW / 2
        const yHigh = yFor(high)
        const yLow = yFor(low)
        const yOpen = yFor(open)
        const yClose = yFor(close)
        const isUp = close >= open
        const color = isUp ? upColor : downColor
        const bodyTop = Math.min(yOpen, yClose)
        const bodyH = Math.max(Math.abs(yClose - yOpen), 1.2)

        return (
          <g key={`${String(d.xKey)}-${index}`}>
            <line x1={cx} x2={cx} y1={yHigh} y2={yLow} stroke={color} strokeWidth={1.15} />
            <rect
              x={xRect}
              y={bodyTop}
              width={bodyW}
              height={bodyH}
              fill={isUp ? color : 'transparent'}
              stroke={color}
              strokeWidth={1.15}
              rx={0.5}
            />
          </g>
        )
      })}
    </g>
  )
}

function ChartTooltip({
  active,
  payload,
  region = 'US',
  formatCurrency,
  maShortWindow,
  maLongWindow,
  showMaLong,
  displayMode = 'area',
}) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const trendUp = Boolean(d.trendUp)
  const accent = trendUp ? 'text-red-500' : 'text-blue-500'
  const hasOhlc = [d.open, d.high, d.low, d.close].every((v) => Number.isFinite(Number(v)))

  return (
    <div className="rounded-2xl border border-slate-200/90 dark:border-slate-600/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl shadow-slate-900/10 dark:shadow-black/40 px-3.5 py-3 min-w-[156px]">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">{d.time}</p>
      {displayMode === 'candle' && hasOhlc ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-bold tabular-nums mb-2">
          {[
            ['始', d.open],
            ['高', d.high],
            ['安', d.low],
            ['終', d.close],
          ].map(([label, val]) => (
            <p key={label} className="flex justify-between gap-2 text-slate-500 dark:text-slate-400">
              <span>{label}</span>
              <span className="text-slate-800 dark:text-slate-100">{formatCurrency(val, region)}</span>
            </p>
          ))}
        </div>
      ) : (
        <p className={`text-lg font-black tabular-nums leading-none ${accent}`}>
          {formatCurrency(d.close, region)}
        </p>
      )}
      {Number.isFinite(Number(d.volume)) && Number(d.volume) > 0 ? (
        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1.5">
          出来高 <span className="text-slate-800 dark:text-slate-100 tabular-nums">{formatVolume(d.volume)}</span>
        </p>
      ) : null}
      {displayMode === 'area' ? (
        <div className="mt-2.5 space-y-1 border-t border-slate-100 dark:border-slate-800 pt-2">
          <p className="flex items-center justify-between gap-3 text-[10px] font-bold text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-0.5 rounded-full bg-amber-500" />
              MA{maShortWindow}
            </span>
            <span className="text-slate-800 dark:text-slate-100 tabular-nums">
              {d.maShort != null && Number.isFinite(d.maShort) ? formatCurrency(d.maShort, region) : '--'}
            </span>
          </p>
          {showMaLong ? (
            <p className="flex items-center justify-between gap-3 text-[10px] font-bold text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-0.5 rounded-full bg-violet-500" />
                MA{maLongWindow}
              </span>
              <span className="text-slate-800 dark:text-slate-100 tabular-nums">
                {d.maLong != null && Number.isFinite(d.maLong) ? formatCurrency(d.maLong, region) : '--'}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function PriceChartPanel({
  data,
  timeframe,
  chartColor,
  priceDomain,
  region,
  maShortWindow,
  maLongWindow,
  showMaLong,
  displayMode,
  gradientKey,
  formatCurrency,
  showXAxis,
  syncId,
}) {
  const safeKey = String(gradientKey || 'stock').replace(/[^a-zA-Z0-9_-]/g, '')
  const fillId = `stock-fill-${safeKey}`
  const glowId = `stock-glow-${safeKey}`
  const isCandle = displayMode === 'candle'

  const latestClose = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return null
    const n = Number(data[data.length - 1]?.close)
    return Number.isFinite(n) ? n : null
  }, [data])

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 14, right: 4, left: 0, bottom: showXAxis ? 20 : 4 }} syncId={syncId}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColor} stopOpacity={0.42} />
            <stop offset="45%" stopColor={chartColor} stopOpacity={0.12} />
            <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
          </linearGradient>
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <CartesianGrid vertical={false} stroke="rgba(148, 163, 184, 0.2)" strokeDasharray="4 8" />
        {showXAxis ? (
          <XAxis
            dataKey="xKey"
            type="category"
            scale="band"
            padding={{ left: 4, right: 4 }}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            minTickGap={28}
            tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
            tickFormatter={(value) => formatChartDateLabel(String(value || ''), timeframe)}
          />
        ) : (
          <XAxis dataKey="xKey" type="category" scale="band" hide />
        )}
        <YAxis
          yAxisId="left"
          orientation="right"
          domain={priceDomain}
          allowDataOverflow
          axisLine={false}
          tickLine={false}
          tickMargin={6}
          width={48}
          tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
          tickFormatter={(v) => formatAxisPrice(v, region)}
        />
        <Tooltip
          content={(
            <ChartTooltip
              region={region}
              formatCurrency={formatCurrency}
              maShortWindow={maShortWindow}
              maLongWindow={maLongWindow}
              showMaLong={showMaLong}
              displayMode={displayMode}
            />
          )}
          cursor={{ stroke: chartColor, strokeWidth: 1, strokeOpacity: 0.3, strokeDasharray: '4 6' }}
        />
        {!isCandle && latestClose != null ? (
          <ReferenceLine yAxisId="left" y={latestClose} stroke={chartColor} strokeDasharray="5 5" strokeOpacity={0.25} />
        ) : null}
        {isCandle ? (
          <>
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="close"
              stroke="transparent"
              strokeWidth={0}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <CandlestickSeries
              data={data}
              priceDomain={priceDomain}
              upColor={MARKET_UP_HEX}
              downColor={MARKET_DOWN_HEX}
            />
          </>
        ) : (
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="close"
            stroke={chartColor}
            strokeWidth={2.5}
            fill={`url(#${fillId})`}
            strokeLinecap="round"
            strokeLinejoin="round"
            isAnimationActive
            animationDuration={480}
            animationEasing="ease-out"
            activeDot={{
              r: 5,
              stroke: '#fff',
              strokeWidth: 2,
              fill: chartColor,
              filter: `url(#${glowId})`,
            }}
            dot={false}
          />
        )}
        {!isCandle ? (
          <>
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="maShort"
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              strokeOpacity={0.9}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            {showMaLong ? (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="maLong"
                stroke="#a855f7"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                strokeOpacity={0.85}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ) : null}
          </>
        ) : null}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

function VolumeChartPanel({ data, timeframe, syncId, showXAxis }) {
  const { volumeDomain, volumeCap } = useMemo(() => {
    const vols = data
      .map((row) => Number(row?.volume))
      .filter((v) => Number.isFinite(v) && v > 0)
      .sort((a, b) => a - b)
    if (vols.length === 0) return { volumeDomain: [0, 'auto'], volumeCap: null }
    const p85 = vols[Math.min(vols.length - 1, Math.floor(vols.length * 0.85))]
    const p50 = vols[Math.floor(vols.length * 0.5)]
    const cap = Math.max(p85 * 1.08, p50 * 2.8)
    return { volumeDomain: [0, cap], volumeCap: cap }
  }, [data])

  const volumeData = useMemo(() => {
    if (!volumeCap) return data
    return data.map((row) => {
      const volume = Number(row?.volume)
      if (!Number.isFinite(volume) || volume <= 0) return row
      return {
        ...row,
        volumeDisplay: Math.min(volume, volumeCap),
      }
    })
  }, [data, volumeCap])

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={volumeData} margin={{ top: 6, right: 4, left: 0, bottom: showXAxis ? 16 : 4 }} syncId={syncId}>
        {showXAxis ? (
          <XAxis
            dataKey="xKey"
            type="category"
            scale="band"
            padding={{ left: 4, right: 4 }}
            axisLine={false}
            tickLine={false}
            tickMargin={6}
            minTickGap={28}
            tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }}
            tickFormatter={(value) => formatChartDateLabel(String(value || ''), timeframe)}
          />
        ) : (
          <XAxis dataKey="xKey" type="category" scale="band" hide />
        )}
        <YAxis
          yAxisId="volume"
          orientation="right"
          domain={volumeDomain}
          axisLine={false}
          tickLine={false}
          width={48}
          tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }}
          tickFormatter={(v) => formatVolume(v)}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0]?.payload
            return (
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 shadow-lg">
                出来高 <span className="text-slate-900 dark:text-white tabular-nums">{formatVolume(d?.volume)}</span>
              </div>
            )
          }}
          cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
        />
        <Bar
          yAxisId="volume"
          dataKey={volumeCap ? 'volumeDisplay' : 'volume'}
          radius={[2, 2, 0, 0]}
          maxBarSize={14}
          minPointSize={2}
          isAnimationActive={false}
        >
          {volumeData.map((entry) => {
            const up = Boolean(entry.trendUp)
            return (
              <Cell
                key={String(entry.xKey)}
                fill={up ? 'rgba(239, 68, 68, 0.55)' : 'rgba(37, 99, 235, 0.55)'}
              />
            )
          })}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export default function StockPriceChart({
  data = [],
  timeframe = '1Y',
  chartColor = '#ef4444',
  priceDomain = ['auto', 'auto'],
  region = 'US',
  maShortWindow = 50,
  maLongWindow = 200,
  showMaLong = false,
  displayMode = 'area',
  showVolume = false,
  volumeMeta = null,
  gradientKey = 'stock',
  formatCurrency,
  className = 'h-full w-full',
}) {
  const syncId = `stock-${String(gradientKey || 'main').replace(/[^a-zA-Z0-9_-]/g, '')}`
  const hasVolume = showVolume && data.some((row) => Number.isFinite(Number(row.volume)) && Number(row.volume) > 0)

  if (!formatCurrency) return null

  return (
    <div className={`relative flex flex-col ${className}`}>
      {!hasVolume ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-50"
          aria-hidden
          style={{
            background:
              'radial-gradient(ellipse 85% 55% at 50% 0%, color-mix(in srgb, var(--stock-chart-accent) 14%, transparent), transparent 72%)',
            ['--stock-chart-accent']: chartColor,
          }}
        />
      ) : null}
      <div className={`relative min-h-0 ${hasVolume ? 'flex-[3]' : 'h-full'}`}>
        {hasVolume ? (
          <div
            className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-45"
            aria-hidden
            style={{
              background:
                'radial-gradient(ellipse 85% 55% at 50% 0%, color-mix(in srgb, var(--stock-chart-accent) 12%, transparent), transparent 72%)',
              ['--stock-chart-accent']: chartColor,
            }}
          />
        ) : null}
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-slate-200/80 to-transparent dark:via-slate-600/50" aria-hidden />
        <PriceChartPanel
          data={data}
          timeframe={timeframe}
          chartColor={chartColor}
          priceDomain={priceDomain}
          region={region}
          maShortWindow={maShortWindow}
          maLongWindow={maLongWindow}
          showMaLong={showMaLong}
          displayMode={displayMode}
          gradientKey={gradientKey}
          formatCurrency={formatCurrency}
          showXAxis={!hasVolume}
          syncId={syncId}
        />
      </div>
      {hasVolume ? (
        <>
          <div className="h-px bg-slate-200/80 dark:bg-slate-700/60 mx-2 shrink-0" />
          <div className="relative min-h-[88px] max-h-[140px] flex-[1] shrink-0 pb-1">
            <div className="absolute left-2 top-1 z-10 pointer-events-none">
              <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500">出来高</p>
              {volumeMeta && volumeMeta.pct < 95 ? (
                <p className="text-[8px] font-bold text-amber-600/90 dark:text-amber-400/90 max-w-[min(100%,220px)] leading-tight mt-0.5">
                  {volumeMeta.firstDate}以降のみ（{volumeMeta.count}/{volumeMeta.total}日）
                </p>
              ) : null}
            </div>
            <VolumeChartPanel data={data} timeframe={timeframe} syncId={syncId} showXAxis />
          </div>
        </>
      ) : null}
    </div>
  )
}
