import { useState, useEffect, useRef, useMemo } from 'react'
import { getGrade } from '../../lib/fearGreedCalc'

// ── Canvas ゲージ
function Gauge({ score, grade }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    const cx = W / 2, cy = H * 0.86
    const R = W * 0.38

    ctx.clearRect(0, 0, W, H)

    const segments = [
      { from: 0,  to: 20,  color: '#dc2626' },
      { from: 20, to: 40,  color: '#f97316' },
      { from: 40, to: 60,  color: '#eab308' },
      { from: 60, to: 80,  color: '#84cc16' },
      { from: 80, to: 100, color: '#16a34a' },
    ]
    segments.forEach(seg => {
      const sA = Math.PI + (seg.from / 100) * Math.PI
      const eA = Math.PI + (seg.to   / 100) * Math.PI
      ctx.beginPath()
      ctx.arc(cx, cy, R, sA, eA)
      ctx.arc(cx, cy, R * 0.65, eA, sA, true)
      ctx.fillStyle = seg.color + '30'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(cx, cy, R, sA, eA)
      ctx.strokeStyle = seg.color
      ctx.lineWidth = 3
      ctx.stroke()
    })

    // 눈금
    for (let i = 0; i <= 10; i++) {
      const angle = Math.PI + (i / 10) * Math.PI
      const inner = R * 0.63
      const outer = i % 5 === 0 ? R * 0.73 : R * 0.69
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner)
      ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer)
      ctx.strokeStyle = '#e5e7eb'
      ctx.lineWidth = i % 5 === 0 ? 2 : 1
      ctx.stroke()
    }

    // 레이블
    ;['0', '25', '50', '75', '100'].forEach((label, i) => {
      const angle = Math.PI + (i / 4) * Math.PI
      const lR = R * 0.54
      ctx.fillStyle = '#9ca3af'
      ctx.font = 'bold 11px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, cx + Math.cos(angle) * lR, cy + Math.sin(angle) * lR)
    })

    // 바늘
    const targetAngle = Math.PI + (score / 100) * Math.PI
    const needleLen = R * 0.56
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.18)'
    ctx.shadowBlur = 6
    ctx.shadowOffsetX = 2
    ctx.shadowOffsetY = 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(targetAngle) * needleLen, cy + Math.sin(targetAngle) * needleLen)
    ctx.strokeStyle = grade.color
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.stroke()
    ctx.restore()

    // 바늘 끝 원
    ctx.beginPath()
    ctx.arc(cx + Math.cos(targetAngle) * needleLen, cy + Math.sin(targetAngle) * needleLen, 6, 0, Math.PI * 2)
    ctx.fillStyle = grade.color
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.stroke()

    // 중앙 원
    ctx.beginPath()
    ctx.arc(cx, cy, 14, 0, Math.PI * 2)
    ctx.fillStyle = '#111827'
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.stroke()

    // 점수
    ctx.fillStyle = grade.color
    ctx.font = 'bold 40px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(score, cx, cy - R * 0.22)

    ctx.fillStyle = '#374151'
    ctx.font = "bold 13px 'Noto Sans JP', sans-serif"
    ctx.fillText(grade.label, cx, cy - R * 0.06)

    // 英語サブ表記は出さず（米国タブでも日本語UIに統一）
  }, [score, grade])

  return <canvas ref={canvasRef} width={320} height={210} style={{ maxWidth: '100%' }} />
}

// ── 30日ヒストリーチャート
function HistoryChart({ history }) {
  const W = 560, H = 90, pad = 8
  const pts = history.map((d, i) => ({
    x: pad + (i / (history.length - 1)) * (W - pad * 2),
    y: H - pad - (d.score / 100) * (H - pad * 2),
    score: d.score,
  }))
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaD = `${pathD} L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`
  const getColor = s => s <= 20 ? '#dc2626' : s <= 40 ? '#f97316' : s <= 60 ? '#eab308' : s <= 80 ? '#84cc16' : '#16a34a'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      <defs>
        <linearGradient id="fg-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[25, 50, 75].map(v => {
        const y = H - pad - (v / 100) * (H - pad * 2)
        return (
          <g key={v}>
            <line x1={pad} y1={y} x2={W - pad} y2={y} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4,3" />
            <text x={2} y={y + 3} fontSize="8" fill="#d1d5db" fontFamily="monospace">{v}</text>
          </g>
        )
      })}
      <path d={areaD} fill="url(#fg-area-grad)" />
      <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" />
      {pts.filter((_, i) => i % 7 === 0 || i === pts.length - 1).map((p, i, arr) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === arr.length - 1 ? 5 : 3}
          fill={getColor(p.score)} stroke="#fff" strokeWidth="1.5" />
      ))}
    </svg>
  )
}

// ── MAIN コンポーネント
export default function FearGreedIndex() {
  const [market, setMarket] = useState('JP')
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [lastFetch, setLastFetch] = useState(null)

  const load = async (mkt) => {
    setLoading(true)
    setError(null)
    try {
      // アプリと同じ /api/fear-greed だけを使う（クライアント再計算は 62/59 など旧結果に戻りうる）
      const qs = `market=${encodeURIComponent(mkt)}`
      const candidates = [
        `/api/fear-greed?${qs}`,
        `https://www.moneymart.co.jp/api/fear-greed?${qs}`,
      ]
      let json = null
      let lastErr = null
      for (const url of candidates) {
        try {
          const res = await fetch(url, { cache: 'no-store' })
          if (!res.ok) {
            lastErr = new Error(`HTTP ${res.status}`)
            continue
          }
          const body = await res.json()
          if (body?.ok && Number.isFinite(Number(body.score))) {
            json = body
            break
          }
          lastErr = new Error(body?.error || 'invalid payload')
        } catch (e) {
          lastErr = e
        }
      }
      if (!json) throw lastErr || new Error('Fear & Greed API unavailable')

      setData({
        score: Number(json.score),
        yesterday: Number(json.yesterday ?? json.score),
        weekAgo: Number(json.weekAgo ?? json.score),
        indicators: Array.isArray(json.indicators) ? json.indicators : [],
        history: Array.isArray(json.history) ? json.history : [],
        latestTradeDate: json.latestTradeDate || null,
        dashboard: json.dashboard || null,
        stance: json.stance || null,
      })
      setLastFetch(new Date())
    } catch (e) {
      setError(e.message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(market) }, [market])

  const grade = useMemo(() => data ? getGrade(data.score) : getGrade(50), [data])
  const diff  = data ? data.score - data.yesterday : 0
  const wDiff = data ? data.score - data.weekAgo   : 0

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
      {/* ── ヘッダー */}
      <div className="bg-slate-900 dark:bg-black px-5 py-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-black text-orange-400 tracking-[0.12em] mb-1">Fear & Greed Index</div>
          <h2 className="text-base font-black text-white">投資家心理指数</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            EOD株価 + 日次 market_dashboard（VIX/MOVE/金/FX）から算出
            {data?.latestTradeDate ? ` · 基準日: ${data.latestTradeDate}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* 市場タブ */}
          <div className="flex gap-1 bg-slate-800 rounded-xl p-1">
            {[
              { id: 'JP', flag: '🇯🇵', label: '日本' },
              { id: 'US', flag: '🇺🇸', label: '米国' },
            ].map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMarket(m.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition ${
                  market === m.id
                    ? 'bg-orange-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>{m.flag}</span>{m.label}
              </button>
            ))}
          </div>
          {/* 最終更新 */}
          {lastFetch && (
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              {lastFetch.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 更新
            </div>
          )}
          <button
            type="button"
            onClick={() => load(market)}
            className="text-[11px] font-bold text-slate-400 hover:text-white border border-slate-700 rounded-lg px-2 py-1 transition"
          >
            ↺
          </button>
        </div>
      </div>

      {/* ── ローディング */}
      {loading && (
        <div className="flex items-center justify-center py-16 gap-3">
          <div className="w-6 h-6 border-[3px] border-slate-200 border-t-orange-500 rounded-full animate-spin" />
          <span className="text-sm font-bold text-slate-400">
            {market === 'JP' ? '日本市場データ' : '米国市場データ'}を分析中...
          </span>
        </div>
      )}

      {/* ── エラー */}
      {!loading && error && (
        <div className="p-6 text-center">
          <p className="text-sm text-red-500 font-bold mb-3">データ取得に失敗しました</p>
          <p className="text-xs text-slate-400 mb-4">{error}</p>
          <button
            type="button"
            onClick={() => load(market)}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
          >
            再試行
          </button>
        </div>
      )}

      {/* ── メインコンテンツ */}
      {!loading && !error && data && (
        <div className="p-5">
          {/* 上段: ゲージ+解説 と グレードカードを同じ行の高さで揃える（下段に比較3枚） */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-3 md:items-stretch">
            {/* ゲージ + 解説（ノ란 카드와 높이 맞춤） */}
            <div className="flex h-full min-h-0 w-full min-w-0 flex-col items-center justify-center gap-2 overflow-visible rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/50">
              <Gauge score={data.score} grade={grade} />
              <p className="w-full min-w-0 max-w-full whitespace-normal text-balance break-words text-center text-[13px] leading-relaxed text-slate-600 dark:text-slate-300 md:text-sm md:px-1">
                {grade.desc}
              </p>
            </div>

            {/* 現在グレードカード（右列はこのカードだけで行高を決める） */}
            <div
              className="flex h-full min-h-0 flex-col items-center justify-center rounded-2xl p-5 text-center"
              style={{ background: grade.bg, border: `2px solid ${grade.border}` }}
            >
              <div className="mb-2 text-3xl">{grade.emoji}</div>
              <div className="mb-1 text-lg font-black" style={{ color: grade.color }}>{grade.label}</div>
              <div className="font-mono text-5xl font-black leading-none" style={{ color: grade.color }}>{data.score}</div>
              <div className="mt-1 text-xs text-slate-500">/ 100</div>
              {data.stance ? (
                <div className="mt-4 w-full rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5 text-left dark:border-slate-600 dark:bg-slate-900/40">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-wide">確認ポイント</p>
                  <p className="mt-1 text-sm font-black text-slate-800 dark:text-slate-100">
                    {data.stance.icon} {data.stance.label}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{data.stance.hint}</p>
                </div>
              ) : null}
            </div>
          </div>

          {data.dashboard ? (
            <div className="mb-5 flex flex-wrap gap-2">
              {[
                data.dashboard.indexClose != null && {
                  k: data.dashboard.indexLabel,
                  v: `${Number(data.dashboard.indexClose).toLocaleString('ja-JP')}${data.dashboard.indexPctDay != null ? ` (${data.dashboard.indexPctDay > 0 ? '+' : ''}${data.dashboard.indexPctDay}%)` : ''}`,
                },
                data.dashboard.vix != null && { k: 'VIX', v: Number(data.dashboard.vix).toFixed(2) },
                data.dashboard.move != null && { k: 'MOVE', v: Number(data.dashboard.move).toFixed(1) },
                data.dashboard.riskOnOff != null && { k: 'Risk-On', v: Number(data.dashboard.riskOnOff).toFixed(1) },
                data.dashboard.goldPctDay != null && { k: 'Gold', v: `${data.dashboard.goldPctDay > 0 ? '+' : ''}${data.dashboard.goldPctDay}%` },
                data.dashboard.usdJpy != null && { k: 'USD/JPY', v: Number(data.dashboard.usdJpy).toFixed(2) },
              ].filter(Boolean).map((chip) => (
                <div
                  key={chip.k}
                  className="rounded-xl border border-orange-100 bg-orange-50/80 px-3 py-1.5 dark:border-orange-900/40 dark:bg-orange-950/30"
                >
                  <span className="text-[9px] font-black text-orange-600 dark:text-orange-400">{chip.k}</span>
                  <span className="ml-1.5 font-mono text-xs font-black text-slate-800 dark:text-slate-100">{chip.v}</span>
                </div>
              ))}
              <span className="self-center text-[9px] font-bold text-slate-400">dashboard xlsx</span>
            </div>
          ) : null}

          {/* 前日 / 1週間 / 30日平均（全幅） */}
          <div className="mb-5 grid grid-cols-3 gap-2">
            {[
              { label: '前日比', val: diff, base: data.yesterday },
              { label: '1週間前', val: wDiff, base: data.weekAgo },
              (() => {
                const avg30 = Math.round(
                  data.history.reduce((s, d) => s + d.score, 0) / Math.max(data.history.length, 1),
                )
                return { label: 'vs30日平均', val: data.score - avg30, base: avg30 }
              })(),
            ].map((item, i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center dark:border-slate-700 dark:bg-slate-900/50">
                <div className="mb-1 text-[10px] font-bold text-slate-400">{item.label}</div>
                <div
                  className="font-mono text-xl font-black"
                  style={{ color: item.val > 0 ? '#ef4444' : item.val < 0 ? '#2563eb' : '#6b7280' }}
                >
                  {item.val > 0 ? '+' : ''}{item.val}
                </div>
                {item.base != null && (
                  <div className="mt-0.5 text-[9px] text-slate-400">前回 {item.base}点</div>
                )}
              </div>
            ))}
          </div>

          {/* 30日トレンド */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 mb-5 border border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-black text-slate-700 dark:text-slate-200">30日推移</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {market === 'JP' ? '日経連動ETF・個別・VIX等' : 'S&P連動ETF・個別・VIX等'}の日次再計算
                </p>
              </div>
              <div className="flex gap-3">
                {[
                  { label: '極恐怖', color: '#dc2626' },
                  { label: '恐怖',   color: '#f97316' },
                  { label: '中立',   color: '#eab308' },
                  { label: '強欲',   color: '#84cc16' },
                  { label: '極強欲', color: '#16a34a' },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                    <span className="text-[9px] text-slate-400 font-bold">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <HistoryChart history={data.history} />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
              <span>30日前</span><span>今日</span>
            </div>
          </div>

          {/* 6指標 */}
          <div className="mb-5">
            <p className="text-xs font-black text-slate-700 dark:text-slate-200 mb-3">
              📊 構成指標（{data.indicators.length}項目 · EOD + dashboard）
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.indicators.map((ind) => {
                const g = getGrade(ind.score)
                return (
                  <div
                    key={ind.id}
                    className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700 transition hover:shadow-md"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-base">{ind.icon}</span>
                          <span className="text-xs font-black text-slate-800 dark:text-slate-100">{ind.name}</span>
                        </div>
                        <p className="text-[10px] text-slate-400">{ind.desc}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono text-xl font-black" style={{ color: g.color }}>{ind.score}</div>
                        <div
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-1 whitespace-nowrap"
                          style={{
                            color: ind.realData ? '#16a34a' : '#9ca3af',
                            background: ind.realData ? '#f0fdf4' : '#f9fafb',
                            border: `1px solid ${ind.realData ? '#bbf7d0' : '#e5e7eb'}`,
                          }}
                        >
                          {ind.realData ? (ind.source === 'dashboard' ? '✓ dashboard' : ind.source?.includes('dashboard') ? '✓ 混合' : '✓ EOD') : 'データ不足'}
                        </div>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${ind.score}%`, background: `linear-gradient(90deg,${g.color}88,${g.color})` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[9px] text-slate-400">恐怖 0</span>
                      <span className="text-[9px] font-bold" style={{ color: g.color }}>{g.label}</span>
                      <span className="text-[9px] text-slate-400">強欲 100</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 市場心理ガイド */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
              <p className="text-xs font-black text-slate-700 dark:text-slate-200">💡 指数別 市場心理の見方</p>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {[
                { range: '0〜20',  label: '極度の恐怖', color: '#dc2626', bg: '#fef2f2', strategy: '市場心理が極端に慎重な局面です。価格変動リスクや分散状況を確認する材料になります。' },
                { range: '21〜40', label: '恐怖',       color: '#f97316', bg: '#fff7ed', strategy: '不安心理が強い局面です。市場全体の下落要因と保有比率の偏りを確認する目安になります。' },
                { range: '41〜60', label: '中立',       color: '#eab308', bg: '#fefce8', strategy: '市場心理は中立圏です。複数指標を見ながら、現在の配分が目的に沿っているか確認する局面です。' },
                { range: '61〜80', label: '強欲',       color: '#22c55e', bg: '#f0fdf4', strategy: '楽観心理が強まりやすい局面です。過熱感や保有比率の偏りを確認する材料になります。' },
                { range: '81〜100',label: '極度の強欲', color: '#16a34a', bg: '#dcfce7', strategy: '市場心理が大きく楽観方向に傾いています。リスク許容度とポジション管理を再確認する目安です。' },
              ].map((item) => {
                const isActive = data &&
                  ((item.range === '0〜20'   && data.score <= 20) ||
                   (item.range === '21〜40'  && data.score > 20  && data.score <= 40) ||
                   (item.range === '41〜60'  && data.score > 40  && data.score <= 60) ||
                   (item.range === '61〜80'  && data.score > 60  && data.score <= 80) ||
                   (item.range === '81〜100' && data.score > 80))
                return (
                  <div
                    key={item.range}
                    className="flex items-start gap-3 px-4 py-3 transition"
                    style={{ background: isActive ? item.bg : undefined }}
                  >
                    <div className="shrink-0 pt-0.5">
                      <div className="font-mono text-[10px] font-bold whitespace-nowrap" style={{ color: item.color }}>{item.range}</div>
                      <div className="text-xs font-black whitespace-nowrap" style={{ color: item.color }}>{item.label}</div>
                    </div>
                    <div className="w-px self-stretch bg-slate-200 dark:bg-slate-700 shrink-0" />
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{item.strategy}</p>
                    {isActive && (
                      <div
                        className="shrink-0 text-[9px] font-black px-2 py-0.5 rounded-full whitespace-nowrap self-center"
                        style={{ color: item.color, background: item.bg, border: `1px solid ${item.color}44` }}
                      >
                        現在
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 免責 */}
          <p className="text-[10px] text-slate-400 mt-4 leading-relaxed">
          ⚠️ 本指数は EOD株価と日次 market_dashboard（VIX・MOVE・Risk-On/Off・商品・為替）を組み合わせた参考指標です。CNN Fear &amp; Greed 等の外部指数そのものではありません。売買タイミングの指示や運用成果の保証はありません。
          </p>
        </div>
      )}
    </div>
  )
}
