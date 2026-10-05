import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import { meetingKindConfig } from './mockCatalog'
import { C } from './theme'
import { Card, Pill } from './ui'

const MODES = ['月', '週', '日', 'アジェンダ']
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function ymd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function monthLabel(d) {
  return `${d.getFullYear()}年 ${d.getMonth() + 1}月`
}

function buildMonthCells(monthDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), d))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export default function CalendarPage({ meetings = [], clients = [], onOpenClient, onToast }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    d.setDate(1)
    d.setHours(12, 0, 0, 0)
    return d
  })
  const [selected, setSelected] = useState(() => ymd(new Date()))
  const [mode, setMode] = useState('月')
  const [onlyMine, setOnlyMine] = useState(false)
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    let list = meetings || []
    if (onlyMine) list = list.filter((m) => m.advisorName === 'Justin' || !m.advisorName)
    const qq = q.trim().toLowerCase()
    if (qq) {
      list = list.filter((m) =>
        [m.title, m.clientName, m.mode].some((x) => String(x || '').toLowerCase().includes(qq)),
      )
    }
    return list
  }, [meetings, onlyMine, q])

  const byDate = useMemo(() => {
    const map = {}
    for (const m of filtered) {
      if (!map[m.dateKey]) map[m.dateKey] = []
      map[m.dateKey].push(m)
    }
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.time.localeCompare(b.time))
    return map
  }, [filtered])

  const cells = useMemo(() => buildMonthCells(cursor), [cursor])
  const selectedMeetings = byDate[selected] || []
  const todayKey = ymd(new Date())

  const agenda = useMemo(() => {
    return [...filtered].sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.time.localeCompare(b.time)).slice(0, 40)
  }, [filtered])

  const goToday = () => {
    const t = new Date()
    setSelected(ymd(t))
    setCursor(new Date(t.getFullYear(), t.getMonth(), 1, 12))
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col xl:flex-row">
      <div className="min-w-0 flex-1 space-y-3 p-5 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-extrabold" style={{ color: C.navy }}>ミーティングカレンダー</h1>
            <p className="mt-0.5 text-[11px]" style={{ color: C.textMuted }}>
              {filtered.length} 件の予定 · 色分け: Review / Hearing / Prep / Meeting
            </p>
          </div>
          <button
            type="button"
            onClick={() => onToast('デモ: 予定登録シートを開きました')}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-extrabold text-white"
            style={{ background: C.accent }}
          >
            <Plus className="h-4 w-4" /> 予定登録
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={goToday} className="rounded-md border bg-white px-2.5 py-1.5 text-[11px] font-extrabold" style={{ borderColor: C.border }}>今日</button>
          <div className="flex items-center gap-1">
            <button type="button" className="rounded p-1.5 hover:bg-white" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1, 12))} aria-label="前月">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-[7.5rem] text-center text-[16px] font-extrabold" style={{ color: C.navy }}>{monthLabel(cursor)}</div>
            <button type="button" className="rounded p-1.5 hover:bg-white" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1, 12))} aria-label="翌月">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border bg-white p-0.5" style={{ borderColor: C.border }}>
              {MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className="rounded-md px-2.5 py-1 text-[11px] font-bold"
                  style={{ background: mode === m ? C.accent : 'transparent', color: mode === m ? '#fff' : C.textMuted }}
                >
                  {m}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setOnlyMine((v) => !v)}
              className="rounded-md px-2.5 py-1.5 text-[11px] font-extrabold"
              style={{ background: onlyMine ? C.accent : '#fff', color: onlyMine ? '#fff' : C.navy, border: `1px solid ${C.border}` }}
            >
              自分のミーティング
            </button>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="顧客・タイトル検索"
                className="rounded-lg border bg-white py-1.5 pl-8 pr-2 text-[11px]"
                style={{ borderColor: C.border, width: 160 }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-[10px]">
          {Object.entries(meetingKindConfig).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: C.textMuted }}>
              <i className="h-2.5 w-2.5 rounded-sm" style={{ background: v.color }} /> {v.label}
            </span>
          ))}
        </div>

        {mode === '月' ? (
          <Card padding={10}>
            <div className="mb-1 grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-1 text-center text-[10px] font-bold" style={{ color: C.textMuted }}>{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (!d) return <div key={`e-${i}`} className="min-h-[72px] rounded-lg bg-transparent" />
                const key = ymd(d)
                const items = byDate[key] || []
                const isSel = key === selected
                const isToday = key === todayKey
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelected(key)}
                    className="min-h-[72px] rounded-lg border p-1.5 text-left transition-colors"
                    style={{
                      borderColor: isSel ? C.accent : C.borderSub,
                      background: isSel ? C.accentLight : isToday ? '#fff' : '#fff',
                      boxShadow: isToday && !isSel ? `inset 0 0 0 1.5px ${C.accent}` : undefined,
                    }}
                  >
                    <div className="text-[11px] font-bold" style={{ color: isSel ? C.accentDark : C.navy }}>{d.getDate()}</div>
                    <div className="mt-1 space-y-0.5">
                      {items.slice(0, 3).map((m) => (
                        <div
                          key={m.id}
                          className="truncate rounded px-1 py-0.5 text-[8px] font-bold text-white"
                          style={{ background: meetingKindConfig[m.kind]?.color || '#94a3b8' }}
                        >
                          {m.time} {m.clientName}
                        </div>
                      ))}
                      {items.length > 3 ? <div className="text-[8px]" style={{ color: C.textMuted }}>+{items.length - 3}</div> : null}
                    </div>
                  </button>
                )
              })}
            </div>
          </Card>
        ) : (
          <Card padding={12}>
            <h2 className="mb-3 text-[13px] font-bold">{mode === 'アジェンダ' ? 'アジェンダ一覧' : mode === '週' ? '週次アジェンダ' : '日次アジェンダ'}</h2>
            <div className="space-y-2">
              {(mode === '日' ? selectedMeetings : agenda.filter((m) => mode === 'アジェンダ' || m.dateKey >= todayKey).slice(0, 20)).map((m) => (
                <MeetingRow key={m.id} m={m} onOpenClient={onOpenClient} onToast={onToast} clients={clients} />
              ))}
              {(mode === '日' ? selectedMeetings : agenda).length === 0 ? (
                <div className="rounded-xl bg-[#faf8f2] p-4 text-[12px] leading-relaxed" style={{ color: C.textSecondary }}>
                  表示できる予定はありません。空き枠は 10:00 / 14:00 / 16:00。定期レビュー候補として追加できます。
                </div>
              ) : null}
            </div>
          </Card>
        )}
      </div>

      <aside className="w-full shrink-0 border-t xl:w-[260px] xl:border-l xl:border-t-0" style={{ background: '#faf9f6', borderColor: C.border }}>
        <div className="space-y-3 p-4">
          <div>
            <div className="text-[10px] font-extrabold tracking-wide" style={{ color: C.textMuted }}>選択日</div>
            <div className="text-[15px] font-extrabold" style={{ color: C.navy }}>{selected}</div>
          </div>
          <div className="text-[11px] font-bold" style={{ color: C.textSecondary }}>
            {selectedMeetings.length} 件の予定
          </div>
          <div className="space-y-2">
            {selectedMeetings.length === 0 ? (
              <div className="rounded-xl border bg-white p-3" style={{ borderColor: C.border }}>
                <div className="text-[11px] font-bold" style={{ color: C.navy }}>空き枠</div>
                <div className="mt-2 space-y-1.5 text-[10px]" style={{ color: C.textSecondary }}>
                  {['10:00 · オンライン 30分', '14:00 · 定期レビュー 45分', '16:00 · フォローアップ 30分'].map((slot) => (
                    <div key={slot} className="rounded-lg bg-[#faf8f2] px-2 py-1.5">{slot}</div>
                  ))}
                </div>
              </div>
            ) : (
              selectedMeetings.map((m) => (
                <MeetingRow key={m.id} m={m} onOpenClient={onOpenClient} onToast={onToast} clients={clients} compact />
              ))
            )}
          </div>
          <button
            type="button"
            onClick={() => onToast('デモ: この日に予定を追加')}
            className="w-full rounded-xl border border-dashed py-2.5 text-[11px] font-extrabold"
            style={{ borderColor: C.accent, color: C.accent }}
          >
            + この日に追加
          </button>
        </div>
      </aside>
    </div>
  )
}

function MeetingRow({ m, onOpenClient, onToast, clients, compact }) {
  const cfg = meetingKindConfig[m.kind] || { label: m.kind, color: '#94a3b8' }
  return (
    <div className="rounded-xl border bg-white p-2.5" style={{ borderColor: C.border }}>
      <div className="mb-1 flex items-center gap-1.5">
        <i className="h-2 w-2 rounded-sm" style={{ background: cfg.color }} />
        <Pill bg={`${cfg.color}33`} color="#334155">{cfg.label}</Pill>
        <span className="ml-auto text-[10px] font-bold tabular-nums" style={{ color: C.textMuted }}>{m.time}</span>
      </div>
      <div className="text-[12px] font-bold" style={{ color: C.navy }}>{m.title}</div>
      <div className="mt-0.5 text-[11px]" style={{ color: C.textSecondary }}>{m.clientName} · {m.mode}</div>
      {!compact ? (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-[10px] font-bold text-white"
            style={{ background: C.accent }}
            onClick={() => {
              const c = clients.find((x) => x.id === m.clientId)
              if (c) onOpenClient?.(c)
              else onToast('デモ: ミーティングワークフロー')
            }}
          >
            開く
          </button>
          <button type="button" className="rounded-lg border px-2 py-1 text-[10px] font-bold" style={{ borderColor: C.border, color: C.textMuted }} onClick={() => onToast('デモ: 予定を取消しました')}>
            取消
          </button>
        </div>
      ) : null}
    </div>
  )
}
