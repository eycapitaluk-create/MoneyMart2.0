import { useMemo, useState } from 'react'
import { GitCompare, List, Sparkles } from 'lucide-react'
import { mockFunds } from './mockCatalog'
import { C } from './theme'
import { Card, Pill } from './ui'
import { ClientContextBanner } from './ClientContextBanner'
import { FundCompare, FundList, FundOptimizer } from './FundTools'

const BUBBLE_CATS = [
  { id: 'all', label: '全て', color: C.navy },
  { id: 'stock', label: '株式ETF', color: '#d4b56a' },
  { id: 'bond', label: '債券ETF', color: '#3b82f6' },
  { id: 'dividend', label: 'バランス', color: '#22c55e' },
  { id: 'reit', label: 'REIT/商品', color: '#f97316' },
]

const BUBBLES = [
  { name: '全世界株', risk: 14, ret: 14.5, size: 60, category: 'stock', symbol: '2559.T' },
  { name: '外国株', risk: 15, ret: 13.5, size: 45, category: 'stock', symbol: '2513.T' },
  { name: '米国株 Dow', risk: 16, ret: 15.0, size: 45, category: 'stock', symbol: '1546.T' },
  { name: '米国株', risk: 17, ret: 21.0, size: 55, category: 'stock', symbol: '1655.T' },
  { name: 'S&P500', risk: 19, ret: 23.5, size: 65, category: 'stock', symbol: '2558.T' },
  { name: '日本株', risk: 21, ret: 17.5, size: 60, category: 'stock', symbol: '1306.T' },
  { name: '日経225', risk: 23, ret: 20.0, size: 55, category: 'stock', symbol: '1321.T' },
  { name: 'NASDAQ100', risk: 26, ret: 28.4, size: 55, category: 'stock', symbol: '1545.T' },
  { name: '国内債券', risk: 3, ret: 1.5, size: 35, category: 'bond', symbol: '2510.T' },
  { name: '日本高配当', risk: 9, ret: 8.5, size: 45, category: 'dividend', symbol: '1489.T' },
  { name: '日本高配当2', risk: 11, ret: 10.5, size: 40, category: 'dividend', symbol: '1478.T' },
  { name: '国内REIT', risk: 13, ret: 6.5, size: 40, category: 'reit', symbol: '1343.T' },
  { name: '金', risk: 18, ret: 25.0, size: 40, category: 'reit', symbol: '1540.T' },
]

function catColor(id) {
  return BUBBLE_CATS.find((c) => c.id === id)?.color || C.accent
}

function BubbleChart({ filter, onSelect }) {
  const xMax = 35
  const yMin = -5
  const yMax = 32
  const w = 560
  const h = 260
  const sorted = [...BUBBLES].sort((a, b) => b.size - a.size)

  return (
    <div className="flex gap-1">
      <div className="flex w-8 flex-col justify-between py-1 text-right text-[8px] font-semibold tabular-nums" style={{ color: '#94a3b8' }}>
        <span>+30%</span><span>+20%</span><span>+10%</span><span>0%</span><span>−5%</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 260 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={`h${i}`} x1="0" y1={(h * i) / 4} x2={w} y2={(h * i) / 4} stroke="#e2e8f0" strokeWidth="0.5" />
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={`v${i}`} x1={(w * i) / 4} y1="0" x2={(w * i) / 4} y2={h} stroke="#e2e8f0" strokeWidth="0.5" />
        ))}
        <line x1="0" y1={h * (-yMin) / (yMax - yMin)} x2={w} y2={h * (-yMin) / (yMax - yMin)} stroke="#94a3b8" strokeWidth="1" />
        {sorted.map((p) => {
          const x = (p.risk / xMax) * w
          const y = h - ((p.ret - yMin) / (yMax - yMin)) * h
          const s = 12 + p.size * 0.32
          const dimmed = filter !== 'all' && p.category !== filter
          const color = catColor(p.category)
          return (
            <g
              key={p.symbol}
              transform={`translate(${x}, ${y})`}
              style={{ cursor: 'pointer', opacity: dimmed ? 0.25 : 1 }}
              onClick={() => onSelect(p)}
            >
              <circle r={s / 2} fill={color} fillOpacity={0.35} stroke={color} strokeWidth="1.5" />
              <text textAnchor="middle" dy="-2" fontSize={Math.min(10, s * 0.22)} fontWeight="800" fill="#0f172a">{p.name}</text>
              <text textAnchor="middle" dy="10" fontSize={Math.min(8, s * 0.16)} fontWeight="600" fill="#64748b">{p.symbol.replace('.T', '')}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function FundDetailSheet({ item, onClose }) {
  if (!item) return null
  const hasPrice = Number.isFinite(Number(item.price))
  const performance = [
    { label: '1ヶ月', value: item.ret1m },
    { label: '3ヶ月', value: item.ret3m },
    { label: '6ヶ月', value: item.ret6m },
    { label: '1年', value: item.ret1y ?? item.ret },
    { label: '3年', value: item.ret3y },
  ].filter((x) => Number.isFinite(Number(x.value)))
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <button type="button" onClick={onClose} className="text-[12px] font-bold" style={{ color: C.accent }}>閉じる</button>
          <span className="text-[11px]" style={{ color: C.textMuted }}>2026-09-18</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: C.accent }}>ƒ</div>
          <div className="text-[16px] font-extrabold" style={{ color: C.navy }}>{item.symbol}</div>
        </div>
        <div className="mt-1 text-[12px]" style={{ color: C.textMuted }}>{item.name}</div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="text-[28px] font-extrabold tabular-nums" style={{ color: C.navy }}>
            {hasPrice ? `¥${Number(item.price).toLocaleString()}` : `¥${Math.round((item.aumYen || 0) / 1e8).toLocaleString()}億`}
          </div>
          {Number.isFinite(Number(item.ret1y ?? item.ret)) ? (
            <Pill bg="#fee2e2" color={C.positive}>1年 {Number(item.ret1y ?? item.ret) >= 0 ? '+' : ''}{item.ret1y ?? item.ret}%</Pill>
          ) : null}
        </div>
        <div className="text-[10px]" style={{ color: C.textMuted }}>{hasPrice ? '基準価額' : '純資産総額（デモカタログ）'}</div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {performance.map((p) => (
            <div key={p.label} className="rounded-xl bg-slate-50 p-3">
              <div className="text-[9px]" style={{ color: C.textMuted }}>{p.label}リターン</div>
              <div className="mt-1 text-[15px] font-extrabold" style={{ color: Number(p.value) >= 0 ? C.positive : C.negative }}>
                {Number(p.value) >= 0 ? '+' : ''}{p.value}%
              </div>
            </div>
          ))}
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-[9px]" style={{ color: C.textMuted }}>信託報酬</div>
            <div className="mt-1 text-[15px] font-extrabold" style={{ color: C.navy }}>{Number(item.expense || 0).toFixed(3)}%</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-[9px]" style={{ color: C.textMuted }}>カテゴリ</div>
            <div className="mt-1 text-[13px] font-extrabold" style={{ color: C.navy }}>{item.category || '株式'}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-[9px]" style={{ color: C.textMuted }}>運用会社</div>
            <div className="mt-1 text-[13px] font-extrabold" style={{ color: C.navy }}>{item.company || 'Nomura AM'}</div>
          </div>
        </div>
        <p className="mt-4 rounded-xl bg-[#faf8f2] p-3 text-[10px] leading-relaxed" style={{ color: C.textSecondary }}>
          {hasPrice
            ? `${item.name} の基準価額と期間リターンです。顧客対話では予測ではなく、保有資産との関連性を共有してください。`
            : `${item.name} は本デモではリターン・信託報酬・純資産総額で確認します。顧客対話では予測ではなく、保有資産との関連性を共有してください。`}
        </p>
      </div>
    </div>
  )
}

export default function FundPage({ client, clients, onPickClient, onToast }) {
  const [filter, setFilter] = useState('all')
  const [detail, setDetail] = useState(null)
  const [view, setView] = useState('home')
  const yieldTop = useMemo(() => [...mockFunds].sort((a, b) => (b.ret1y / 8) - (a.ret1y / 8)).slice(0, 10), [])
  const retTop = useMemo(() => [...mockFunds].sort((a, b) => b.ret1y - a.ret1y).slice(0, 10), [])

  if (view !== 'home') {
    return (
      <div className="space-y-4 p-5 lg:p-6">
        <ClientContextBanner kind="fund" client={client} clients={clients} onPickClient={onPickClient} onToast={onToast} />
        {view === 'compare' ? <FundCompare onBack={() => setView('home')} onOpenDetail={setDetail} /> : null}
        {view === 'optimizer' ? <FundOptimizer onBack={() => setView('home')} /> : null}
        {view === 'list' ? <FundList onBack={() => setView('home')} onOpenDetail={setDetail} /> : null}
        {detail ? <FundDetailSheet item={detail} onClose={() => setDetail(null)} /> : null}
      </div>
    )
  }

  return (
    <div className="space-y-4 p-5 lg:p-6">
      <ClientContextBanner kind="fund" client={client} clients={clients} onPickClient={onPickClient} onToast={onToast} />
      <h1 className="text-[22px] font-extrabold" style={{ color: C.navy }}>ファンド</h1>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { id: 'compare', title: 'ファンド比較', sub: '最大4本を並べて分析', Icon: GitCompare, color: '#3b82f6' },
          { id: 'optimizer', title: 'ファンド最適化', sub: 'AIで配分提案', Icon: Sparkles, color: C.accent },
          { id: 'list', title: 'ファンド一覧', sub: '全ファンドを検索', Icon: List, color: C.green },
        ].map((a) => (
          <button
            key={a.title}
            type="button"
            onClick={() => setView(a.id)}
            className="flex items-center gap-3 rounded-xl border bg-white p-3 text-left hover:bg-[#fbf8ef]"
            style={{ borderColor: C.border }}
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${a.color}22` }}>
              <a.Icon className="h-5 w-5" style={{ color: a.color }} />
            </div>
            <div>
              <div className="text-[13px] font-extrabold" style={{ color: C.navy }}>{a.title}</div>
              <div className="text-[10px]" style={{ color: C.textMuted }}>{a.sub}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.6fr_0.7fr]">
        <Card padding={14}>
          <h2 className="mb-3 text-[13px] font-bold">リスク・リターン 参考マップ (1年 · カテゴリ)</h2>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {BUBBLE_CATS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setFilter(c.id)}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold"
                style={{ background: filter === c.id ? c.color : '#f5f5f4', color: filter === c.id ? '#fff' : '#475569' }}
              >
                {c.id !== 'all' ? <i className="h-2 w-2 rounded-full" style={{ background: filter === c.id ? '#fff' : c.color }} /> : null}
                {c.label}
              </button>
            ))}
          </div>
          <BubbleChart
            filter={filter}
            onSelect={(p) => setDetail(mockFunds.find((f) => f.symbol === p.symbol) || p)}
          />
          <div className="mt-2 flex justify-between text-[9px]" style={{ color: '#94a3b8' }}>
            <span>← 低リスク</span>
            <span>(標準偏差 %)</span>
            <span>高リスク →</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            {BUBBLE_CATS.filter((c) => c.id !== 'all').map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 text-[9px]">
                <i className="h-2.5 w-2.5 rounded-full" style={{ background: c.color, opacity: 0.65 }} />
                {c.label}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[9px]" style={{ color: '#94a3b8' }}>
            バブルサイズ = 純資産規模の目安. 縦=リターン %, 横=標準偏差 % · タップで詳細チャート
          </p>
        </Card>

        <div className="space-y-3">
          <Card padding={12}>
            <h3 className="mb-2 text-[12px] font-bold">% 配当利回り トップ10</h3>
            {yieldTop.map((f, i) => (
              <button
                key={f.symbol}
                type="button"
                onClick={() => setDetail(f)}
                className="flex w-full items-center gap-2 border-b py-1.5 text-left text-[11px]"
                style={{ borderColor: C.borderSub }}
              >
                <span className="w-4 font-bold" style={{ color: C.accent }}>{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{f.name}</span>
                <b className="tabular-nums" style={{ color: C.positive }}>{(f.ret1y / 8).toFixed(2)}%</b>
              </button>
            ))}
          </Card>
          <Card padding={12}>
            <h3 className="mb-2 text-[12px] font-bold">1年リターン トップ10</h3>
            {retTop.map((f, i) => (
              <button
                key={f.symbol}
                type="button"
                onClick={() => setDetail(f)}
                className="flex w-full items-center gap-2 border-b py-1.5 text-left text-[11px]"
                style={{ borderColor: C.borderSub }}
              >
                <span className="w-4 font-bold" style={{ color: C.accent }}>{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{f.name}</span>
                <b className="tabular-nums" style={{ color: C.positive }}>+{f.ret1y}%</b>
              </button>
            ))}
          </Card>
        </div>
      </div>

      {detail ? <FundDetailSheet item={detail} onClose={() => setDetail(null)} /> : null}
    </div>
  )
}
