import { useEffect, useMemo, useRef, useState } from 'react'

let plotlyLoaderPromise = null
const ensurePlotlyLoaded = async () => {
  if (typeof window === 'undefined') throw new Error('window unavailable')
  if (window.Plotly) return window.Plotly
  if (!plotlyLoaderPromise) {
    plotlyLoaderPromise = import('plotly.js-dist-min')
      .then((mod) => {
        const PlotlyLib = mod?.default || mod
        if (!PlotlyLib) throw new Error('plotly load failed')
        window.Plotly = PlotlyLib
        return PlotlyLib
      })
  }
  return plotlyLoaderPromise
}

const linspace = (start, end, n) => {
  if (n <= 1) return [start]
  const step = (end - start) / (n - 1)
  return Array.from({ length: n }, (_, i) => start + (i * step))
}

const fmt = (v, d = 2) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return '-'
  return n.toFixed(d)
}

const expandAxisRange = (minValue, maxValue, fallbackPad = 1) => {
  const min = Number(minValue)
  const max = Number(maxValue)
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: fallbackPad }
  }
  if (Math.abs(max - min) > 1e-9) return { min, max }
  const center = min
  const pad = Math.max(fallbackPad, Math.abs(center) * 0.08)
  return {
    min: center - pad,
    max: center + pad,
  }
}

function buildSurfaceFromPoints(points, ranges, rows = 28, cols = 28) {
  const riskAxis = linspace(Number(ranges.riskMin || 0), Number(ranges.riskMax || 1), rows)
  const feeAxis = linspace(Number(ranges.feeMin || 0), Number(ranges.feeMax || 1), cols)
  const z = riskAxis.map((risk) => (
    feeAxis.map((fee) => {
      let weightedReturn = 0
      let weightSum = 0
      for (let i = 0; i < points.length; i += 1) {
        const p = points[i]
        const dr = risk - Number(p.risk || 0)
        const df = fee - Number(p.fee || 0)
        const dist2 = (dr * dr) + (df * df)
        const w = 1 / (dist2 + 0.25)
        weightedReturn += Number(p.ret || 0) * w
        weightSum += w
      }
      return weightSum > 0 ? (weightedReturn / weightSum) : Number(ranges.retMin || 0)
    })
  ))
  return { xFee: feeAxis, yRisk: riskAxis, zRet: z }
}

export default function PortfolioOptimizer3D({
  points = [],
  currentPoint = null,
  optimalPoint = null,
  ranges = null,
  onOptimalPointClick = null,
}) {
  const plotRef = useRef(null)
  const [isPlotlyReady, setIsPlotlyReady] = useState(Boolean(typeof window !== 'undefined' && window.Plotly))
  const [plotlyLoadError, setPlotlyLoadError] = useState('')
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof document === 'undefined') return true
    return document.documentElement.classList.contains('dark')
  })

  const displayRanges = useMemo(() => {
    if (!ranges) return null
    const feeRange = expandAxisRange(ranges.feeMin, ranges.feeMax, 0.03)
    const riskRange = expandAxisRange(ranges.riskMin, ranges.riskMax, 1)
    const retRange = expandAxisRange(ranges.retMin, ranges.retMax, 1)
    return {
      feeMin: feeRange.min,
      feeMax: feeRange.max,
      riskMin: riskRange.min,
      riskMax: riskRange.max,
      retMin: retRange.min,
      retMax: retRange.max,
    }
  }, [ranges])
  const surfaceData = useMemo(() => {
    if (!displayRanges || !points || points.length < 2) return null
    return buildSurfaceFromPoints(points, displayRanges, 28, 28)
  }, [points, displayRanges])
  useEffect(() => {
    let mounted = true
    ensurePlotlyLoaded()
      .then(() => {
        if (mounted) {
          setIsPlotlyReady(true)
          setPlotlyLoadError('')
        }
      })
      .catch((err) => {
        if (mounted) {
          setIsPlotlyReady(false)
          setPlotlyLoadError(err?.message || 'plotly load failed')
        }
      })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return undefined
    const html = document.documentElement
    const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
    const syncTheme = () => {
      const byClass = html.classList.contains('dark')
      const bySystem = media ? media.matches : false
      setIsDarkMode(byClass || bySystem)
    }
    syncTheme()
    const observer = new MutationObserver(syncTheme)
    observer.observe(html, { attributes: true, attributeFilter: ['class'] })
    if (media?.addEventListener) media.addEventListener('change', syncTheme)
    return () => {
      observer.disconnect()
      if (media?.removeEventListener) media.removeEventListener('change', syncTheme)
    }
  }, [])

  useEffect(() => {
    if (!isPlotlyReady || !plotRef.current || !surfaceData || !window.Plotly) return undefined
    const isMobileViewport = typeof window !== 'undefined' ? window.innerWidth < 640 : false
    const axisTitleFontSize = isMobileViewport ? 11 : 16
    const axisTickFontSize = isMobileViewport ? 9 : 13
    const axisTickCount = isMobileViewport ? 4 : 7
    const palette = isDarkMode
      ? {
        surface: [[0.0, '#2dd4bf'], [0.45, '#3b82f6'], [1.0, '#6474ff']],
        axisColor: '#94a3b8',
        gridColor: 'rgba(15,23,42,0.34)',
        axisLineColor: 'rgba(15,23,42,0.55)',
        axisBgColor: 'rgba(2,6,23,0.16)',
        contourColorStrong: 'rgba(15,23,42,0.68)',
        contourColorSoft: 'rgba(15,23,42,0.42)',
        currentText: '#f87171',
        optimalText: '#ef4444',
      }
      : {
        surface: [[0.0, '#14b8a6'], [0.45, '#2563eb'], [1.0, '#4338ca']],
        axisColor: '#334155',
        gridColor: 'rgba(2,6,23,0.38)',
        axisLineColor: 'rgba(2,6,23,0.68)',
        axisBgColor: 'rgba(2,6,23,0.08)',
        contourColorStrong: 'rgba(2,6,23,0.72)',
        contourColorSoft: 'rgba(2,6,23,0.48)',
        currentText: '#dc2626',
        optimalText: '#b91c1c',
      }

    const surfaceTrace = {
      x: surfaceData.xFee,
      y: surfaceData.yRisk,
      z: surfaceData.zRet,
      type: 'surface',
      colorscale: palette.surface,
      showscale: false,
      opacity: 0.84,
      contours: {
        x: { show: true, color: palette.contourColorStrong, width: 1, highlight: false },
        y: { show: true, color: palette.contourColorStrong, width: 1, highlight: false },
        z: { show: true, color: palette.contourColorSoft, width: 1, highlight: false },
      },
      hoverinfo: 'none',
      showlegend: false,
    }

    const traces = [surfaceTrace]

    if (currentPoint) {
      traces.push({
        x: [Number(currentPoint.fee || 0)],
        y: [Number(currentPoint.risk || 0)],
        z: [Number(currentPoint.ret || 0)],
        type: 'scatter3d',
        mode: 'markers',
        marker: {
          size: 12,
          color: '#10b981',
          line: { color: '#ffffff', width: 1.5 },
          opacity: 0.95,
          symbol: 'circle',
        },
        hoverinfo: 'text',
        hovertext: `現在の配分<br>リスク: ${fmt(currentPoint.risk, 2)}%<br>リターン: ${fmt(currentPoint.ret, 2)}%<br>信託報酬: ${fmt(currentPoint.fee, 3)}%`,
        showlegend: false,
      })
    }

    if (optimalPoint) {
      traces.push({
        x: [Number(optimalPoint.fee || 0)],
        y: [Number(optimalPoint.risk || 0)],
        z: [Number(optimalPoint.ret || 0)],
        type: 'scatter3d',
        mode: 'markers',
        marker: {
          size: 9,
          color: '#f97316',
          line: { color: '#ffedd5', width: 1.2 },
          opacity: 0.85,
          symbol: 'diamond',
        },
        hoverinfo: 'text',
        hovertext: `最適配分<br>リスク: ${fmt(optimalPoint.risk, 2)}%<br>リターン: ${fmt(optimalPoint.ret, 2)}%<br>信託報酬: ${fmt(optimalPoint.fee, 3)}%`,
        customdata: ['optimal'],
        showlegend: false,
      })
    }

    const layout = {
      autosize: true,
      margin: { l: 0, r: 0, b: 0, t: 0 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      scene: {
        xaxis: {
          title: { text: '信託報酬 (%)', font: { size: axisTitleFontSize, family: 'Inter, system-ui, sans-serif' } },
          color: palette.axisColor,
          gridcolor: palette.gridColor,
          zerolinecolor: palette.gridColor,
          linecolor: palette.axisLineColor,
          showline: true,
          showbackground: true,
          backgroundcolor: palette.axisBgColor,
          range: [displayRanges.feeMin, displayRanges.feeMax],
          nticks: axisTickCount,
          tickfont: { size: axisTickFontSize, family: 'Inter, system-ui, sans-serif' },
        },
        yaxis: {
          title: { text: 'リスク (%)', font: { size: axisTitleFontSize, family: 'Inter, system-ui, sans-serif' } },
          color: palette.axisColor,
          gridcolor: palette.gridColor,
          zerolinecolor: palette.gridColor,
          linecolor: palette.axisLineColor,
          showline: true,
          showbackground: true,
          backgroundcolor: palette.axisBgColor,
          range: [displayRanges.riskMin, displayRanges.riskMax],
          nticks: axisTickCount,
          tickfont: { size: axisTickFontSize, family: 'Inter, system-ui, sans-serif' },
        },
        zaxis: {
          title: { text: 'リターン (%)', font: { size: axisTitleFontSize, family: 'Inter, system-ui, sans-serif' } },
          color: palette.axisColor,
          gridcolor: palette.gridColor,
          zerolinecolor: palette.gridColor,
          linecolor: palette.axisLineColor,
          showline: true,
          showbackground: true,
          backgroundcolor: palette.axisBgColor,
          range: [displayRanges.retMin, displayRanges.retMax],
          nticks: axisTickCount,
          tickfont: { size: axisTickFontSize, family: 'Inter, system-ui, sans-serif' },
        },
        bgcolor: 'rgba(0,0,0,0)',
        camera: { eye: { x: 1.55, y: -1.45, z: 1.03 } },
      },
      showlegend: false,
    }

    const pixelRatio = typeof window !== 'undefined'
      ? Math.min(2.5, Math.max(1.5, window.devicePixelRatio || 2))
      : 2
    const config = {
      displayModeBar: false,
      responsive: true,
      scrollZoom: false,
      plotGlPixelRatio: pixelRatio,
    }

    window.Plotly.react(plotRef.current, traces, layout, config)

    const handlePlotClick = (event) => {
      if (typeof onOptimalPointClick !== 'function') return
      const clickedPoint = event?.points?.[0]
      if (!clickedPoint) return
      const markerType = Array.isArray(clickedPoint.data?.customdata)
        ? (clickedPoint.data.customdata[clickedPoint.pointNumber] || clickedPoint.data.customdata[0])
        : clickedPoint.data?.customdata
      if (markerType === 'optimal') onOptimalPointClick()
    }

    if (typeof onOptimalPointClick === 'function' && typeof plotRef.current?.on === 'function') {
      plotRef.current.on('plotly_click', handlePlotClick)
    }

    return () => {
      if (plotRef.current && typeof plotRef.current.removeListener === 'function') {
        plotRef.current.removeListener('plotly_click', handlePlotClick)
      }
      if (plotRef.current && window.Plotly) {
        window.Plotly.purge(plotRef.current)
      }
    }
  }, [isPlotlyReady, surfaceData, points, currentPoint, optimalPoint, isDarkMode, onOptimalPointClick, displayRanges])

  if (!surfaceData) {
    return (
      <div className="flex h-[min(48vh,320px)] flex-col sm:h-[400px] md:h-[520px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 items-center justify-center text-sm font-bold text-slate-500 dark:text-slate-400">
        3Dフロンティアを算出中...
      </div>
    )
  }

  if (!isPlotlyReady) {
    return (
      <div className="flex h-[min(48vh,320px)] flex-col sm:h-[400px] md:h-[520px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 items-center justify-center text-sm font-bold text-slate-500 dark:text-slate-400">
        {plotlyLoadError ? '3Dライブラリを読み込めませんでした。' : '3Dライブラリを読み込み中...'}
      </div>
    )
  }

  const mobileMetrics = (
    <>
      {currentPoint ? (
        <div className="rounded-lg border border-emerald-200 bg-white/95 px-2.5 py-1.5 dark:border-emerald-700 dark:bg-slate-900/95">
          <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-300">現在の配分</p>
          <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
            R {fmt(currentPoint.ret, 1)}% / Risk {fmt(currentPoint.risk, 1)}% / Fee {fmt(currentPoint.fee, 2)}%
          </p>
        </div>
      ) : null}
      {optimalPoint ? (
        <div className="rounded-lg border border-orange-200 bg-white/95 px-2.5 py-1.5 dark:border-orange-700 dark:bg-slate-900/95">
          <p className="text-[10px] font-black text-orange-700 dark:text-orange-300">最適配分</p>
          <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
            R {fmt(optimalPoint.ret, 1)}% / Risk {fmt(optimalPoint.risk, 1)}% / Fee {fmt(optimalPoint.fee, 2)}%
          </p>
        </div>
      ) : null}
    </>
  )

  return (
    <div className="flex h-[min(48vh,320px)] flex-col sm:h-[400px] md:h-[520px]">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-100 via-[#e6edf9] to-slate-100 dark:from-slate-900 dark:via-[#1c2740] dark:to-slate-900 p-1.5">
        <div className="pointer-events-none absolute left-3 top-3 z-10 hidden flex-wrap gap-1.5 md:flex">
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black text-slate-700 shadow-sm dark:bg-slate-900/85 dark:text-slate-200">
            信託報酬
          </span>
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black text-slate-700 shadow-sm dark:bg-slate-900/85 dark:text-slate-200">
            リスク
          </span>
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black text-slate-700 shadow-sm dark:bg-slate-900/85 dark:text-slate-200">
            リターン
          </span>
        </div>
        <div className="pointer-events-none absolute right-3 top-3 z-10 hidden flex-col gap-1.5 md:flex">
          {mobileMetrics}
        </div>
        <div ref={plotRef} className="h-full w-full" />
      </div>
      <div className="mt-2 shrink-0 space-y-1.5 md:hidden">
        <p className="text-[9px] font-bold leading-snug text-slate-500 dark:text-slate-400">
          軸: 信託報酬・リスク・リターン
        </p>
        {mobileMetrics}
      </div>
    </div>
  )
}
