import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../../lib/supabase'

// ── 닛케이225 대표 심볼 (JP 종목 풀)
const JP_SYMBOLS = [
  '7203.T','8306.T','6501.T','6758.T','8316.T','6857.T','8411.T','8035.T','8058.T','9983.T',
  '9984.T','7011.T','8031.T','4519.T','8001.T','6861.T','9432.T','8766.T','6503.T','6301.T',
  '7267.T','4502.T','6954.T','7751.T','8053.T','4063.T','6902.T','9433.T','4568.T','8725.T',
  '6098.T','8015.T','6273.T','6146.T','6367.T','8802.T','6506.T','6981.T','7201.T','9020.T',
  '2802.T','5108.T','4543.T','4901.T','7733.T','3382.T','9201.T','8591.T','8604.T','6702.T',
]
// 모멘텀 기준 ETF
const JP_INDEX_SYMBOL = '1329.T'
const JP_BOND_SYMBOL  = '2621.T'

// S&P500/NASDAQ100 대표 심볼 (US 종목 풀)
const US_SYMBOLS = [
  'NVDA','AAPL','MSFT','AMZN','GOOGL','META','TSLA','AVGO','COST','NFLX',
  'ADBE','AMD','PEP','CSCO','INTU','AMGN','QCOM','TXN','HON','AMAT',
  'BKNG','ADP','SBUX','GILD','ADI','MU','REGN','VRTX','VRT','PANW','KLAC',
  'LRCX','NXPI','ORLY','FTNT','ADSK','WDAY','AEP','MCHP','CPRT','ROST',
  'BRK.B','LLY','JPM','V','UNH','MA','XOM','WMT','PG','JNJ',
]
const US_INDEX_SYMBOL = 'IVV'
const US_BOND_SYMBOL  = 'TLT'

// ── 등급 정의
function getGrade(score) {
  if (score <= 20) return { label: '極度の恐怖', en: 'Extreme Fear',  color: '#dc2626', bg: '#fef2f2', border: '#fecaca', emoji: '😱', desc: '市場が非常に不安定です。歴史的には良い買い場となることも。' }
  if (score <= 40) return { label: '恐怖',       en: 'Fear',          color: '#f97316', bg: '#fff7ed', border: '#fed7aa', emoji: '😨', desc: '投資家が不安を感じています。慎重なアプローチが必要です。' }
  if (score <= 60) return { label: '中立',        en: 'Neutral',       color: '#eab308', bg: '#fefce8', border: '#fde68a', emoji: '😐', desc: '市場が均衡状態です。様子を見ながらチャンスを探りましょう。' }
  if (score <= 80) return { label: '強欲',        en: 'Greed',         color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0', emoji: '😏', desc: '投資家が楽観的です。過熱していないか確認しましょう。' }
  return               { label: '極度の強欲',    en: 'Extreme Greed', color: '#16a34a', bg: '#dcfce7', border: '#86efac', emoji: '🤑', desc: '市場が過熱している可能性があります。慎重な判断が必要です。' }
}

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

// ── 실제 Supabase 데이터로 Fear & Greed 계산
async function calcFearGreedFromDB(market) {
  const symbols  = market === 'JP' ? JP_SYMBOLS  : US_SYMBOLS
  const idxSym   = market === 'JP' ? JP_INDEX_SYMBOL : US_INDEX_SYMBOL
  const bondSym  = market === 'JP' ? JP_BOND_SYMBOL  : US_BOND_SYMBOL
  const allSyms  = [...new Set([...symbols, idxSym, bondSym])]

  // 직전 252 거래일 가격 데이터 가져오기
  const { data: rows, error } = await supabase
    .from('stock_daily_prices')
    .select('symbol,trade_date,close,open,volume')
    .in('symbol', allSyms)
    .order('trade_date', { ascending: false })
    .limit(allSyms.length * 260)

  if (error || !rows || rows.length === 0) throw new Error('DB fetch failed')

  // 심볼별 날짜순 정렬
  const bySymbol = {}
  for (const row of rows) {
    const sym = row.symbol
    if (!bySymbol[sym]) bySymbol[sym] = []
    bySymbol[sym].push(row)
  }
  for (const sym of Object.keys(bySymbol)) {
    bySymbol[sym].sort((a, b) => a.trade_date.localeCompare(b.trade_date))
  }

  // ── 지표 1: 주가 모멘텀 (인덱스 ETF 현재가 vs 125일 MA)
  let momentumScore = 50
  const idxData = bySymbol[idxSym] || []
  if (idxData.length >= 20) {
    const recent = idxData.slice(-125)
    const ma125 = recent.reduce((s, r) => s + Number(r.close), 0) / recent.length
    const latest = Number(idxData[idxData.length - 1].close)
    const pct = ((latest - ma125) / ma125) * 100
    // +10% 이상이면 80, -10% 이하면 20 사이로 매핑
    momentumScore = Math.max(10, Math.min(90, 50 + pct * 3))
  }

  // ── 지표 2: 주가 강도 (52주 신고가/신저가 비율)
  let strengthScore = 50
  let newHighCount = 0, newLowCount = 0
  for (const sym of symbols) {
    const data = bySymbol[sym]
    if (!data || data.length < 10) continue
    const recent252 = data.slice(-252)
    if (recent252.length < 10) continue
    const prices = recent252.map(r => Number(r.close))
    const high52  = Math.max(...prices)
    const low52   = Math.min(...prices)
    const latestP = prices[prices.length - 1]
    if (latestP >= high52 * 0.995) newHighCount++
    else if (latestP <= low52 * 1.005) newLowCount++
  }
  const totalChecked = symbols.filter(s => bySymbol[s] && bySymbol[s].length >= 10).length
  if (totalChecked > 0) {
    const ratio = (newHighCount - newLowCount) / totalChecked // -1 ~ +1
    strengthScore = Math.max(10, Math.min(90, 50 + ratio * 60))
  }

  // ── 지표 3: 시장 폭 (전일 대비 상승 종목 비율)
  let breadthScore = 50
  let upCount = 0, totalBreadth = 0
  for (const sym of symbols) {
    const data = bySymbol[sym]
    if (!data || data.length < 2) continue
    const last  = Number(data[data.length - 1].close)
    const prev  = Number(data[data.length - 2].close)
    if (last > 0 && prev > 0) {
      totalBreadth++
      if (last > prev) upCount++
    }
  }
  if (totalBreadth > 0) {
    const upRatio = upCount / totalBreadth  // 0~1
    breadthScore = Math.max(10, Math.min(90, upRatio * 100))
  }

  // ── 지표 4: 변동성 (20일 수익률 표준편차, 낮을수록 강욕)
  let volatilityScore = 50
  const idxData20 = idxData.slice(-21)
  if (idxData20.length >= 5) {
    const returns = []
    for (let i = 1; i < idxData20.length; i++) {
      const prev = Number(idxData20[i - 1].close)
      const cur  = Number(idxData20[i].close)
      if (prev > 0) returns.push((cur - prev) / prev)
    }
    if (returns.length > 0) {
      const mean = returns.reduce((s, v) => s + v, 0) / returns.length
      const variance = returns.reduce((s, v) => s + (v - mean) ** 2, 0) / returns.length
      const stdDev = Math.sqrt(variance) * 100  // %
      // stdDev: 0.5%=매우 안정(강욕80), 2%=불안(공포20) 사이 매핑
      volatilityScore = Math.max(10, Math.min(90, 80 - stdDev * 25))
    }
  }

  // ── 지표 5: 안전자산 수요 (채권 ETF 상대 강도, 채권 강세=공포)
  let safeHavenScore = 50
  const bondData = bySymbol[bondSym] || []
  const equityData = idxData
  if (bondData.length >= 20 && equityData.length >= 20) {
    const bondRecent   = bondData.slice(-20)
    const equityRecent = equityData.slice(-20)
    const bondReturn   = (Number(bondRecent[bondRecent.length - 1].close) - Number(bondRecent[0].close)) / Number(bondRecent[0].close)
    const equityReturn = (Number(equityRecent[equityRecent.length - 1].close) - Number(equityRecent[0].close)) / Number(equityRecent[0].close)
    const spread = equityReturn - bondReturn  // 양수=주식 우세(강욕), 음수=채권 우세(공포)
    safeHavenScore = Math.max(10, Math.min(90, 50 + spread * 200))
  }

  // ── 지표 6: 모멘텀 가속도 (5일 vs 20일 MA 비율)
  let momentumAccelScore = 50
  if (idxData.length >= 20) {
    const ma5  = idxData.slice(-5).reduce((s, r) => s + Number(r.close), 0) / 5
    const ma20 = idxData.slice(-20).reduce((s, r) => s + Number(r.close), 0) / 20
    const ratio = ((ma5 - ma20) / ma20) * 100
    momentumAccelScore = Math.max(10, Math.min(90, 50 + ratio * 8))
  }

  // ── 가중 합산
  const indicators = [
    {
      id: 'momentum',
      name: '株価モメンタム',
      icon: '📈',
      desc: market === 'JP' ? '日経225指数と125日移動平均の位置関係' : 'S&P500指数と125日移動平均の位置関係',
      score: Math.round(momentumScore),
      weight: 0.25,
      realData: idxData.length > 0,
    },
    {
      id: 'strength',
      name: '株価強度',
      icon: '💪',
      desc: market === 'JP' ? '52週高値・安値圏にいる銘柄の比率' : '52週高値・安値圏にいる銘柄の比率（米国代表株）',
      score: Math.round(strengthScore),
      weight: 0.20,
      realData: totalChecked > 0,
    },
    {
      id: 'breadth',
      name: '市場の幅',
      icon: '🌊',
      desc: market === 'JP' ? '前日比で上昇した銘柄の割合' : '前日比で上昇した銘柄の割合（米国代表株）',
      score: Math.round(breadthScore),
      weight: 0.20,
      realData: totalBreadth > 0,
    },
    {
      id: 'volatility',
      name: '市場ボラティリティ',
      icon: '⚡',
      desc: market === 'JP' ? '直近20営業日リターンの標準偏差（代替ボラ）' : '直近20営業日リターンの標準偏差（代替ボラ・S&P500）',
      score: Math.round(volatilityScore),
      weight: 0.15,
      realData: idxData.length >= 20,
    },
    {
      id: 'safe_haven',
      name: '安全資産需要',
      icon: '🏦',
      desc: market === 'JP' ? '国債ETFと株式指数の相対リターン' : '米国債ETF（TLT）とS&P500の相対リターン',
      score: Math.round(safeHavenScore),
      weight: 0.10,
      realData: bondData.length >= 20,
    },
    {
      id: 'momentum_accel',
      name: 'モメンタム加速度',
      icon: '🚀',
      desc: market === 'JP' ? '5日移動平均と20日移動平均の乖離率' : '5日移動平均と20日移動平均の乖離率（S&P500）',
      score: Math.round(momentumAccelScore),
      weight: 0.10,
      realData: idxData.length >= 20,
    },
  ]

  const totalScore = Math.round(indicators.reduce((s, ind) => s + ind.score * ind.weight, 0))

  // ── 30일 히스토리 (인덱스 ETF 기반 간이 계산)
  const history = []
  const historyDays = idxData.slice(-30)
  for (let i = 0; i < historyDays.length; i++) {
    const slice = idxData.slice(0, idxData.indexOf(historyDays[i]) + 1)
    if (slice.length < 5) { history.push({ day: i + 1, score: 50 }); continue }
    const ma20slice = slice.slice(-20)
    const ma = ma20slice.reduce((s, r) => s + Number(r.close), 0) / ma20slice.length
    const close = Number(historyDays[i].close)
    const pct = ((close - ma) / ma) * 100
    const s = Math.max(10, Math.min(90, Math.round(50 + pct * 3)))
    history.push({ day: i + 1, score: s })
  }
  // 30일 미만이면 남은 자리 채우기
  while (history.length < 30) history.unshift({ day: 0, score: 50 })

  // 전일 / 1주전
  const yesterday = history[history.length - 2]?.score ?? totalScore
  const weekAgo   = history[history.length - 8]?.score ?? totalScore

  const latestTradeDate = idxData.length > 0 ? idxData[idxData.length - 1].trade_date : null
  return { score: totalScore, yesterday, weekAgo, indicators, history, latestTradeDate }
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
      const result = await calcFearGreedFromDB(mkt)
      setData(result)
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
          <div className="text-[10px] font-black text-orange-400 tracking-[0.12em] mb-1">恐怖・強欲指数</div>
          <h2 className="text-base font-black text-white">投資家心理指数</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">中間データ事業者のデータから算出{data?.latestTradeDate ? ` · データ基準: ${data.latestTradeDate}` : ""}</p>
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
              <div className="mt-1 text-xs text-slate-500">/ 100点満点</div>
            </div>
          </div>

          {/* 前日 / 1週間 / 30日平均（全幅） */}
          <div className="mb-5 grid grid-cols-3 gap-2">
            {[
              { label: '前日比',       val: diff,  base: data.yesterday },
              { label: '1週間前',      val: wDiff, base: data.weekAgo },
              { label: '30日平均',     val: data.score - Math.round(data.history.reduce((s, d) => s + d.score, 0) / Math.max(data.history.length, 1)), base: null },
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
                <p className="text-[10px] text-slate-400 mt-0.5">{market === 'JP' ? '日経225指数ベース' : 'S&P500指数ベース'}</p>
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
            <p className="text-xs font-black text-slate-700 dark:text-slate-200 mb-3">📊 構成指標（{data.indicators.length}個）</p>
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
                          {ind.realData ? '✓ 実データ' : 'シミュレーション'}
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

          {/* 投資戦略ガイド */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
              <p className="text-xs font-black text-slate-700 dark:text-slate-200">💡 指数別 投資戦略ガイド</p>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {[
                { range: '0〜20',  label: '極度の恐怖', color: '#dc2626', bg: '#fef2f2', strategy: 'バフェット格言：「他人が恐怖を感じているときに貪欲になれ」。歴史的な買い場の可能性。' },
                { range: '21〜40', label: '恐怖',       color: '#f97316', bg: '#fff7ed', strategy: '市場が売られ過ぎの可能性。優良銘柄の分割購入を検討。' },
                { range: '41〜60', label: '中立',       color: '#eab308', bg: '#fefce8', strategy: '様子を見ながら機会を待ちましょう。ポートフォリオのリバランス時期です。' },
                { range: '61〜80', label: '強欲',       color: '#22c55e', bg: '#f0fdf4', strategy: '上昇モメンタムがありますが過熱シグナルを監視。利益確定を検討。' },
                { range: '81〜100',label: '極度の強欲', color: '#16a34a', bg: '#dcfce7', strategy: '市場が過熱状態。新規購入より既存ポジション管理に注力しましょう。' },
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
            ⚠️ 本指数は参考用です。実際の投資判断には多様な要素を総合的に検討してください。
          </p>
        </div>
      )}
    </div>
  )
}
