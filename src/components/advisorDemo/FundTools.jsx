import { useMemo, useState } from 'react'
import { ChevronLeft, Search, Sparkles, X } from 'lucide-react'
import { mockFunds } from './mockCatalog'
import { fundCorrelationLabel, fundVol } from './demoFill'
import { C } from './theme'
import { Card, Pill } from './ui'

const FILTERS = ['すべて', '株式', '債券', '原材料', 'REIT (不動産)', 'つみたて', '成長', '対象外']

function FundPicker({ limit, selected, onChange, onClose }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('すべて')
  const rows = useMemo(() => {
    const query = q.trim().toLowerCase()
    return mockFunds.filter((f) => {
      const categoryOk =
        filter === 'すべて' ||
        (filter === '株式' && !['債券', 'REIT', 'コモディティ'].includes(f.category)) ||
        (filter === '債券' && f.category === '債券') ||
        (filter === '原材料' && f.category === 'コモディティ') ||
        (filter === 'REIT (不動産)' && f.category === 'REIT')
      return categoryOk && (!query || `${f.symbol} ${f.name}`.toLowerCase().includes(query))
    })
  }, [filter, q])

  const toggle = (fund) => {
    if (selected.some((x) => x.symbol === fund.symbol)) onChange(selected.filter((x) => x.symbol !== fund.symbol))
    else if (selected.length < limit) onChange([...selected, fund])
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/35 p-4" onClick={onClose}>
      <div className="max-h-[78vh] w-full max-w-xl overflow-hidden rounded-[24px] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-[22px] font-extrabold" style={{ color: C.navy }}>ファンド選択</h2>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1.5 text-[11px] font-extrabold" style={{ background: '#fff7ed', color: '#f97316' }}>完了</button>
        </div>
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="銘柄名・ティッカーで検索" className="w-full rounded-xl bg-slate-50 py-2.5 pl-10 pr-3 text-[12px]" />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)} className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: filter === f ? '#f97316' : '#f8fafc', color: filter === f ? '#fff' : C.textSecondary }}>
                {f === 'すべて' ? 'すべて' : f}
              </button>
            ))}
          </div>
          <div className="mt-2 text-[10px]" style={{ color: C.textMuted }}>最大{limit}本まで選択（残り{limit - selected.length}）</div>
        </div>
        <div className="max-h-[50vh] overflow-y-auto px-4 pb-4">
          {rows.map((f) => {
            const active = selected.some((x) => x.symbol === f.symbol)
            return (
              <button
                key={f.symbol}
                type="button"
                onClick={() => toggle(f)}
                className="mb-1.5 flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left"
                style={{ borderColor: active ? '#fb923c' : C.borderSub, background: active ? '#fff7ed' : '#fff' }}
              >
                <span className="grid h-7 w-7 place-items-center rounded-full text-[10px] font-extrabold" style={{ background: active ? '#f97316' : '#f1f5f9', color: active ? '#fff' : C.textMuted }}>{active ? '✓' : '+'}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-extrabold" style={{ color: C.navy }}>{f.name}</div>
                  <div className="text-[9px]" style={{ color: C.textMuted }}>{f.category} · {f.symbol}</div>
                </div>
                <div className="text-right">
                  <div className="text-[12px] font-extrabold" style={{ color: f.ret1y >= 0 ? C.positive : C.negative }}>{f.ret1y >= 0 ? '+' : ''}{f.ret1y}%</div>
                  <div className="text-[8px]" style={{ color: C.textMuted }}>1年</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ToolHeader({ title, onBack }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={onBack} className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-sm"><ChevronLeft className="h-5 w-5" /></button>
      <h1 className="text-[22px] font-extrabold" style={{ color: C.navy }}>{title}</h1>
    </div>
  )
}

function CompareRadar({ funds }) {
  const colors = ['#f97316', '#0ea5e9', '#22c55e', '#8b5cf6']
  const axes = ['収益性', '安定性', '継続', '総コスト', '成長性']
  const size = 260
  const cx = 130
  const cy = 130
  const radius = 86
  const point = (i, value) => {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 5
    return [cx + Math.cos(a) * radius * value / 10, cy + Math.sin(a) * radius * value / 10]
  }
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[320px]">
      {[2, 4, 6, 8, 10].map((lv) => <polygon key={lv} points={axes.map((_, i) => point(i, lv).join(',')).join(' ')} fill="none" stroke="#e2e8f0" strokeWidth="0.8" />)}
      {axes.map((a, i) => {
        const [x, y] = point(i, 11.6)
        return <text key={a} x={x} y={y} textAnchor="middle" fontSize="8" fill="#64748b">{a}</text>
      })}
      {funds.map((f, fi) => {
        const vals = [Math.min(10, 5 + f.ret1y / 8), Math.max(1, 10 - Math.abs(f.ret1m)), Math.min(10, 7 + f.ret3y / 30), Math.max(1, 10 - f.expense * 8), Math.min(10, 5 + f.ret3y / 15)]
        return <polygon key={f.symbol} points={vals.map((v, i) => point(i, v).join(',')).join(' ')} fill={`${colors[fi]}18`} stroke={colors[fi]} strokeWidth="1.5" />
      })}
    </svg>
  )
}

export function FundCompare({ onBack, onOpenDetail }) {
  const [selected, setSelected] = useState(() => mockFunds.slice(0, 2))
  const [picker, setPicker] = useState(false)
  const colors = ['#f97316', '#0ea5e9', '#22c55e', '#8b5cf6']

  return (
    <div className="space-y-4">
      <ToolHeader title="ファンド比較" onBack={onBack} />
      <Card padding={14}>
        <div className="flex flex-wrap items-center gap-2">
          {selected.map((f, i) => <button key={f.symbol} type="button" onClick={() => onOpenDetail(f)} className="rounded-xl border px-3 py-2 text-left" style={{ borderColor: colors[i] }}><div className="text-[11px] font-extrabold">{f.symbol}</div><div className="max-w-44 truncate text-[9px]" style={{ color: C.textMuted }}>{f.name}</div></button>)}
          <button type="button" onClick={() => setPicker(true)} className="rounded-xl border border-dashed px-4 py-3 text-[11px] font-bold" style={{ borderColor: C.accent, color: C.accent }}>+ ファンドを選ぶ ({selected.length}/4)</button>
          {selected.length ? <button type="button" onClick={() => setSelected([])} className="ml-auto text-[10px] font-bold" style={{ color: C.textMuted }}>クリア</button> : null}
        </div>
      </Card>
      {selected.length >= 2 ? (
        <>
          <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
            <Card padding={14}>
              {[
                ['1年', 'ret1y', '%'],
                ['3年', 'ret3y', '%'],
                ['信託報酬', 'expense', '%'],
                ['純資産', 'aumYen', ''],
              ].map(([label, key, unit]) => (
                <div key={key} className="border-b py-3" style={{ borderColor: C.borderSub }}>
                  <div className="mb-2 text-[10px] font-bold" style={{ color: C.textMuted }}>{label}</div>
                  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${selected.length}, minmax(0,1fr))` }}>
                    {selected.map((f, i) => <div key={f.symbol} className="text-[12px] font-extrabold tabular-nums" style={{ color: colors[i] }}>{key === 'aumYen' ? `¥${Math.round(f[key] / 1e8).toLocaleString()}億` : `${f[key]}${unit}`}</div>)}
                  </div>
                </div>
              ))}
            </Card>
            <Card padding={14}>
              <h2 className="text-[13px] font-bold">総合スコア比較</h2>
              <CompareRadar funds={selected} />
              <div className="flex flex-wrap justify-center gap-3">
                {selected.map((f, i) => <span key={f.symbol} className="text-[9px] font-bold" style={{ color: colors[i] }}>● {f.symbol}</span>)}
              </div>
            </Card>
          </div>
          <Card padding={14}>
            <h2 className="mb-3 text-[13px] font-bold">リターン比較</h2>
            <div className="space-y-3">{selected.map((f, i) => <div key={f.symbol}><div className="mb-1 flex justify-between text-[10px]"><b>{f.name}</b><b style={{ color: colors[i] }}>{f.ret1y >= 0 ? '+' : ''}{f.ret1y}%</b></div><div className="h-3 rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${Math.max(4, Math.min(100, f.ret1y * 2))}%`, background: colors[i] }} /></div></div>)}</div>
          </Card>
        </>
      ) : (
        <Card padding={16}>
          <div className="text-[13px] font-bold" style={{ color: C.navy }}>比較セットを選ぶ</div>
          <p className="mt-1 text-[11px]" style={{ color: C.textSecondary }}>よく使う組み合わせをタップすると、リターン・信託報酬・純資産を並べて確認できます。</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              [mockFunds[0], mockFunds[3]],
              [mockFunds[4], mockFunds[1]],
            ].map((pair) => (
              <button
                key={pair.map((f) => f.symbol).join('-')}
                type="button"
                onClick={() => setSelected(pair)}
                className="rounded-xl border p-3 text-left hover:bg-[#fbf8ef]"
                style={{ borderColor: C.border }}
              >
                <div className="text-[11px] font-extrabold" style={{ color: C.navy }}>{pair[0].symbol} × {pair[1].symbol}</div>
                <div className="mt-1 text-[10px]" style={{ color: C.textMuted }}>{pair[0].name} / {pair[1].name}</div>
              </button>
            ))}
          </div>
        </Card>
      )}
      {picker ? <FundPicker limit={4} selected={selected} onChange={setSelected} onClose={() => setPicker(false)} /> : null}
    </div>
  )
}

function SimulationChart({ selected }) {
  const end = selected.reduce((a, f) => a + f.ret1y, 0) / Math.max(1, selected.length)
  const pts = Array.from({ length: 36 }, (_, i) => {
    const x = 10 + i * 7.7
    const y = 120 - i * end / 16 + Math.sin(i * 0.7) * 8
    return `${x},${Math.max(18, Math.min(128, y))}`
  }).join(' ')
  return (
    <svg viewBox="0 0 300 145" className="w-full">
      <defs><linearGradient id="simGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#06b6d4" stopOpacity=".35" /><stop offset="100%" stopColor="#06b6d4" stopOpacity="0" /></linearGradient></defs>
      {[30, 70, 110].map((y) => <line key={y} x1="8" y1={y} x2="292" y2={y} stroke="#334155" strokeWidth=".5" />)}
      <polygon points={`10,140 ${pts} 280,140`} fill="url(#simGrad)" />
      <polyline points={pts} fill="none" stroke="#22d3ee" strokeWidth="2" />
    </svg>
  )
}

export function FundOptimizer({ onBack }) {
  const [profile, setProfile] = useState('バランス')
  const [assetCount, setAssetCount] = useState(2)
  const [selected, setSelected] = useState(() => mockFunds.filter((f) => ['2559.T', '1482.T'].includes(f.symbol)).slice(0, 2))
  const [picker, setPicker] = useState(false)
  const [result, setResult] = useState(true)

  const allocations = selected.map((f, i) => ({ ...f, weight: assetCount === 2 ? (i === 0 ? 28 : 72) : [25, 35, 40][i] }))
  const expectedReturn = allocations.reduce((sum, f) => sum + f.ret1y * f.weight / 100, 0)
  const weightedExpense = allocations.reduce((sum, f) => sum + f.expense * f.weight / 100, 0)
  const blendedRisk = allocations.reduce((sum, f) => sum + fundVol(f) * f.weight / 100, 0)
  const corrLabel = fundCorrelationLabel(selected)
  const simulatedValue = Math.round(1_000_000 * (1 + expectedReturn / 100))
  return (
    <div className="space-y-4">
      <ToolHeader title="ファンド分析" onBack={onBack} />
      <div className="rounded-2xl p-6 text-white" style={{ background: 'linear-gradient(135deg,#0f172a,#0f766e)' }}>
        <div className="text-[10px] font-bold text-emerald-200">◉ AI Portfolio Optimizer</div>
        <h2 className="mt-2 text-[24px] font-extrabold">相関も含めて、組み合わせを分析</h2>
        <p className="mt-2 max-w-2xl text-[11px] text-slate-200">収益率・リスク・信託報酬・相関を一覧で表示します。本機能は情報提供を目的としており、投資判断を行うものではありません。</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
        <Card padding={16}>
          <h3 className="mb-3 text-[13px] font-bold">設定</h3>
          <div className="mb-3 flex flex-wrap gap-2">{['安定', 'バランス', '成長'].map((p) => <button key={p} onClick={() => setProfile(p)} className="rounded-full px-3 py-1.5 text-[11px] font-bold" style={{ background: profile === p ? '#f97316' : '#f1f5f9', color: profile === p ? '#fff' : C.textSecondary }}>{p}</button>)}</div>
          <div className="mb-4 flex gap-2">{[2, 3].map((n) => <button key={n} onClick={() => { setAssetCount(n); setSelected((s) => s.slice(0, n)); setResult(false) }} className="rounded-full px-3 py-1.5 text-[11px] font-bold" style={{ background: assetCount === n ? '#f97316' : '#f1f5f9', color: assetCount === n ? '#fff' : C.textSecondary }}>{n}資産</button>)}</div>
          <div className="rounded-xl border p-3" style={{ borderColor: '#fed7aa', background: '#fffaf5' }}>
            <div className="mb-2 flex justify-between"><b className="text-[12px]">比較するファンド</b><b className="text-[11px]" style={{ color: '#f97316' }}>{selected.length}/{assetCount}</b></div>
            <button type="button" onClick={() => setPicker(true)} className="flex w-full items-center gap-2 rounded-xl bg-slate-50 px-3 py-3 text-left text-[11px]"><Search className="h-4 w-4 text-orange-500" /><span className="flex-1" style={{ color: selected.length ? C.navy : C.textMuted }}>{selected.length ? selected.map((x) => x.name).join(' / ') : 'ファンドを検索　銘柄名・ティッカーで探せます'}</span></button>
            {selected.length ? <div className="mt-2 flex flex-wrap gap-1.5">{selected.map((f) => <span key={f.symbol} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[9px] font-bold">{f.symbol}<button onClick={() => setSelected((s) => s.filter((x) => x.symbol !== f.symbol))}><X className="h-3 w-3" /></button></span>)}</div> : null}
          </div>
          <div className="mt-3 flex items-center justify-between"><button className="text-[11px] font-bold">詳細条件</button><button type="button" disabled={selected.length !== assetCount} onClick={() => setResult(true)} className="rounded-full px-4 py-2 text-[11px] font-extrabold text-white disabled:opacity-35" style={{ background: '#0f766e' }}>分析を更新</button></div>
        </Card>
        <Card padding={16}>
          <h3 className="text-[13px] font-bold">分析について</h3>
          <p className="mt-3 text-[11px] leading-relaxed" style={{ color: C.textSecondary }}>
            選択ファンドの1年リターンを配分加重し、信託報酬とカテゴリ分散も同時に確認します。{profile}プロファイルでは株式偏重を抑え、債券・全世界株の組み合わせを優先表示します。
          </p>
          <ul className="mt-3 space-y-1.5 text-[10px]" style={{ color: C.textSecondary }}>
            <li>・加重リターン: 各ファンド1年リターン × 配分</li>
            <li>・合計リスク: カテゴリ別ボラティリティの加重</li>
            <li>・相関: 同一カテゴリは高、株式×債券は低</li>
          </ul>
          <p className="mt-2 text-[9px]" style={{ color: C.textMuted }}>情報提供を目的としており、投資判断を行うものではありません。</p>
        </Card>
      </div>
      {result ? (
        <>
          <Card padding={0} className="overflow-hidden" style={{ background: '#08111f', borderColor: '#1e293b' }}><div className="p-4 text-white"><div className="text-[10px] text-cyan-300">選択ファンドの1年リターンを配分加重した参考シミュレーション</div><div className="mt-1 text-[20px] font-extrabold">¥{simulatedValue.toLocaleString()} <span className="text-[11px] text-cyan-300">{expectedReturn >= 0 ? '+' : ''}{expectedReturn.toFixed(1)}%</span></div><SimulationChart selected={selected} /></div></Card>
          <Card padding={16}><h3 className="mb-3 text-[14px] font-bold">分析サマリー</h3><div className="space-y-3">{allocations.map((f, i) => <div key={f.symbol}><div className="mb-1 flex justify-between text-[11px]"><b>{f.name}</b><b>{f.weight}%</b></div><div className="h-4 overflow-hidden rounded-full bg-slate-100"><div className="h-full" style={{ width: `${f.weight}%`, background: i === 0 ? '#f97316' : '#0ea5e9' }} /></div></div>)}</div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[['加重1年リターン', `${expectedReturn >= 0 ? '+' : ''}${expectedReturn.toFixed(1)}%`], ['合計リスク', `${blendedRisk.toFixed(1)}%`], ['加重信託報酬', `${weightedExpense.toFixed(3)}%`], ['相関', corrLabel]].map(([k, v]) => <div key={k} className="rounded-xl bg-slate-50 p-3"><div className="text-[9px]" style={{ color: C.textMuted }}>{k}</div><b className="text-[15px]">{v}</b></div>)}</div></Card>
        </>
      ) : null}
      {picker ? <FundPicker limit={assetCount} selected={selected} onChange={(v) => { setSelected(v); setResult(false) }} onClose={() => setPicker(false)} /> : null}
    </div>
  )
}

export function FundList({ onBack, onOpenDetail }) {
  const [q, setQ] = useState('')
  const [market, setMarket] = useState('すべて')
  const rows = mockFunds.filter((f) => (!q || `${f.symbol} ${f.name}`.toLowerCase().includes(q.toLowerCase())) && (market === 'すべて' || (market === '日本株' ? f.category === '日本株' : true)))
  return (
    <div className="space-y-4">
      <ToolHeader title="ファンド一覧" onBack={onBack} />
      <Card padding={14}>
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="銘柄コード・社名検索" className="w-full rounded-xl bg-slate-50 py-3 pl-10 pr-3 text-[12px]" /></div>
        <div className="mt-3 flex gap-2">{['すべて', '日本株'].map((m) => <button key={m} onClick={() => setMarket(m)} className="rounded-full px-4 py-2 text-[11px] font-extrabold" style={{ background: market === m ? '#f97316' : '#f1f5f9', color: market === m ? '#fff' : C.textSecondary }}>{m === '日本株' ? `🇯🇵 日本株 (${rows.length})` : m}</button>)}</div>
      </Card>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((f) => <button key={f.symbol} type="button" onClick={() => onOpenDetail(f)} className="rounded-xl border bg-white p-3 text-left" style={{ borderColor: C.border }}><div className="flex justify-between gap-2"><div className="min-w-0"><div className="truncate text-[12px] font-extrabold">{f.name}</div><div className="text-[9px]" style={{ color: C.textMuted }}>{f.symbol} · {f.category}</div></div><b className="text-[12px]" style={{ color: f.ret1y >= 0 ? C.positive : C.negative }}>{f.ret1y >= 0 ? '+' : ''}{f.ret1y}%</b></div><div className="mt-2 flex gap-2 text-[9px]" style={{ color: C.textMuted }}><span>信託報酬 {f.expense}%</span><span>純資産 ¥{Math.round(f.aumYen / 1e8)}億</span></div></button>)}
      </div>
    </div>
  )
}
