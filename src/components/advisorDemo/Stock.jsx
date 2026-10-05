import { useMemo, useState } from 'react'
import { Menu, Search, TrendingUp } from 'lucide-react'
import { mockStocks } from './mockCatalog'
import { C } from './theme'
import { AreaChart, Card, Pill } from './ui'
import { ClientContextBanner } from './ClientContextBanner'

function FlagUS({ active }) {
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded-full text-[11px]"
      style={{ background: active ? 'rgba(255,255,255,0.25)' : '#eef2ff' }}
      aria-hidden
    >
      🇺🇸
    </span>
  )
}

function FlagJP({ active }) {
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded-full text-[11px]"
      style={{ background: active ? 'rgba(255,255,255,0.25)' : '#fef2f2' }}
      aria-hidden
    >
      🇯🇵
    </span>
  )
}

function sparkFor(seed, up) {
  const base = 50
  return Array.from({ length: 16 }, (_, i) => {
    const t = i / 15
    const drift = up ? t * 8 : -t * 6
    return base + drift + Math.sin(i * 0.9 + seed) * 3 + Math.cos(i * 0.4 + seed) * 2
  })
}

function StockCard({ s, tab, client, onToast }) {
  const chg = Number(s.ret1d ?? s.chg ?? s.changePct ?? 0)
  const up = chg >= 0
  const spark = sparkFor(s.symbol.charCodeAt(0), up)
  const price =
    tab === 'JP'
      ? `¥${Number(s.price).toLocaleString()}`
      : `$${Number(s.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <button
      type="button"
      onClick={() =>
        onToast(client ? `デモ: ${s.symbol} を ${client.name} の検討リストに追加` : 'デモ: 先に対象顧客を選択してください')
      }
      className="rounded-2xl border bg-white p-3.5 text-left transition-shadow hover:shadow-md"
      style={{ borderColor: C.border }}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[12px] font-extrabold"
          style={{ background: C.accentLight, color: C.accentDark }}
        >
          {(s.symbol || '?').replace('.T', '').slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-bold" style={{ color: C.navy }}>{s.name}</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="text-[10px] font-semibold" style={{ color: C.textMuted }}>{s.symbol}</span>
            <Pill>{s.sector || s.category || '—'}</Pill>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <div className="text-[16px] font-extrabold tabular-nums" style={{ color: C.navy }}>{price}</div>
          <div className="mt-0.5 text-[12px] font-extrabold tabular-nums" style={{ color: up ? C.positive : C.negative }}>
            {up ? '+' : ''}{chg.toFixed(2)}%
          </div>
        </div>
        <div className="w-[88px] shrink-0">
          <AreaChart values={spark} height={36} strokeWidth={1.6} fillOpacity={0.18} />
        </div>
      </div>
    </button>
  )
}

export default function StockPage({ client, clients, onPickClient, onToast }) {
  const [tab, setTab] = useState('US')
  const [q, setQ] = useState('')

  const usCount = (mockStocks || []).filter((s) => s.market !== 'JP').length
  const jpCount = (mockStocks || []).filter((s) => s.market === 'JP').length

  const rows = useMemo(() => {
    const list = (mockStocks || []).filter((s) => (s.market === 'JP' ? 'JP' : 'US') === tab)
    const qq = q.trim().toLowerCase()
    if (!qq) return list
    return list.filter((s) => [s.symbol, s.name].some((x) => String(x || '').toLowerCase().includes(qq)))
  }, [tab, q])

  return (
    <div className="space-y-4 p-5 lg:p-6">
      <ClientContextBanner kind="stock" client={client} clients={clients} onPickClient={onPickClient} onToast={onToast} />
      <h1 className="text-[22px] font-extrabold" style={{ color: C.navy }}>株式</h1>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onToast('デモ: フィルターシート')}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
          style={{ background: `${C.accent}18`, color: C.accent }}
          aria-label="フィルター"
        >
          <Menu className="h-5 w-5" />
        </button>
        {[
          { id: 'US', label: `米国株 (${usCount})`, Flag: FlagUS },
          { id: 'JP', label: `日本株 (${jpCount})`, Flag: FlagJP },
        ].map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[13px] font-extrabold"
              style={{
                background: active ? C.accent : '#fff',
                color: active ? '#fff' : C.textSecondary,
                border: `1px solid ${active ? C.accent : C.border}`,
                boxShadow: active ? '0 4px 12px rgba(184,147,58,0.28)' : undefined,
              }}
            >
              <t.Flag active={active} />
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="銘柄コード・社名検索"
          className="w-full rounded-2xl border bg-white py-3 pl-10 pr-3 text-[13px]"
          style={{ borderColor: C.border }}
        />
      </div>

      {rows.length === 0 ? (
        <Card padding={24}>
          <div className="flex flex-col items-center py-10 text-center">
            <TrendingUp className="mb-3 h-10 w-10" style={{ color: C.accent }} />
            <div className="text-[13px] font-bold" style={{ color: C.navy }}>該当する銘柄がありません</div>
            <p className="mt-1 text-[11px]" style={{ color: C.textMuted }}>検索を空にして AAPL / 7203.T / BKR などカタログ銘柄を表示してください。</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {rows.slice(0, 40).map((s) => (
            <StockCard key={s.symbol} s={s} tab={tab} client={client} onToast={onToast} />
          ))}
        </div>
      )}
    </div>
  )
}
