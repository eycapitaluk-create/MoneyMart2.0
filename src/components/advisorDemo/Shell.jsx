import {
  BarChart3,
  Bell,
  Building2,
  Calendar,
  CircleUserRound,
  CornerUpLeft,
  HelpCircle,
  IdCard,
  LayoutGrid,
  Lightbulb,
  LineChart,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  TrendingUp,
  Users,
} from 'lucide-react'
import { C, cardShadow } from './theme'

const GROUPS = [
  {
    title: '顧客',
    items: [
      { id: 'dashboard', label: 'ダッシュボード', Icon: LayoutGrid },
      { id: 'clients', label: '顧客一覧', Icon: Users },
      { id: 'client', label: '顧客詳細', Icon: IdCard },
      { id: 'calendar', label: 'カレンダー', Icon: Calendar },
    ],
  },
  {
    title: '投資',
    items: [
      { id: 'market', label: 'マーケット', Icon: LineChart },
      { id: 'funds', label: 'ファンド', Icon: TrendingUp },
      { id: 'stocks', label: '株式', Icon: BarChart3 },
      { id: 'insights', label: 'インサイト', Icon: Lightbulb },
    ],
  },
]

const BOTTOM = [
  { id: 'settings', label: '設定', Icon: Settings },
  { id: 'help', label: 'ヘルプ', Icon: HelpCircle },
  { id: 'mypage', label: 'マイページ', Icon: CircleUserRound },
]

export default function AdvisorShell({
  view,
  onNavigate,
  collapsed,
  onToggleCollapse,
  search,
  onSearch,
  searchResults = [],
  onPickClient,
  advisor,
  toast,
  children,
}) {
  const active = view === 'client' ? 'client' : view

  const NavBtn = ({ id, label, Icon }) => {
    const selected = active === id
    return (
      <button
        type="button"
        onClick={() => onNavigate(id)}
        title={label}
        className="relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12px] font-medium transition-colors"
        style={{
          background: selected ? C.sidebarSelectedBg : 'transparent',
          color: selected ? C.accent : C.navy,
        }}
      >
        {selected ? (
          <span className="absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-r" style={{ background: C.accent }} />
        ) : null}
        <Icon className="h-[18px] w-[18px] shrink-0" style={{ color: selected ? C.accent : '#64748b' }} />
        {!collapsed ? <span className="truncate">{label}</span> : null}
      </button>
    )
  }

  return (
    <div className="flex min-h-screen" style={{ background: C.background, color: C.textPrimary, fontFamily: '"Noto Sans JP", -apple-system, system-ui, sans-serif' }}>
      <aside
        className="sticky top-0 flex h-screen shrink-0 flex-col border-r bg-white transition-[width] duration-200"
        style={{ width: collapsed ? 52 : 198, borderColor: C.sidebarDivider }}
      >
        <div className="flex items-start gap-2 px-3 pb-3 pt-4">
          <div className="grid h-6 w-6 shrink-0 place-items-center rounded bg-orange-500 text-[11px] font-black text-white">M</div>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-extrabold leading-tight" style={{ color: C.navy }}>MoneyMart</div>
              <div className="text-[8px] font-semibold tracking-wide" style={{ color: C.textMuted }}>Business</div>
            </div>
          ) : null}
          <button type="button" onClick={onToggleCollapse} className="mt-0.5 rounded p-0.5 hover:bg-slate-50" aria-label="サイドバー">
            {collapsed ? <PanelLeftOpen className="h-4 w-4 text-slate-400" /> : <PanelLeftClose className="h-4 w-4 text-slate-400" />}
          </button>
        </div>

        {!collapsed ? (
          <div className="mx-3 mb-3 flex items-center gap-2 rounded-lg border px-2.5 py-2" style={{ borderColor: C.border, background: C.surfaceSub }}>
            <div className="grid h-6 w-6 place-items-center rounded-md text-[10px] font-bold text-white" style={{ background: C.accentDark }}>D</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] font-semibold">Default</div>
            </div>
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
          </div>
        ) : null}

        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          {GROUPS.map((g) => (
            <div key={g.title} className="mb-3">
              {!collapsed ? (
                <div className="mb-1 px-2 text-[9px] font-bold uppercase tracking-wide" style={{ color: C.textMuted }}>
                  {g.title}
                </div>
              ) : null}
              <div className="space-y-0.5">
                {g.items.map((it) => (
                  <NavBtn key={it.id} {...it} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto border-t px-2 py-2" style={{ borderColor: C.sidebarDivider }}>
          {BOTTOM.map((it) => (
            <NavBtn key={it.id} {...it} />
          ))}
          <button
            type="button"
            onClick={() => onNavigate('personal')}
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px]"
            style={{ color: C.textMuted }}
          >
            <CornerUpLeft className="h-[18px] w-[18px]" />
            {!collapsed ? <span>個人モードへ</span> : null}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-white px-4"
          style={{ borderColor: C.sidebarDivider }}
        >
          <div className="relative max-w-[500px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="顧客名・カナ・メールで検索"
              className="w-full rounded-full border bg-[#f8f7f3] py-2 pl-9 pr-3 text-[12px] outline-none focus:border-[#b8933a]"
              style={{ borderColor: C.border, color: C.navy }}
            />
            {search && searchResults.length > 0 ? (
              <div
                className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-xl border bg-white py-1"
                style={{ borderColor: C.border, boxShadow: cardShadow }}
              >
                {searchResults.slice(0, 8).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onPickClient(c)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[#f4f0e5]"
                  >
                    <span className="font-semibold" style={{ color: C.navy }}>{c.name}</span>
                    <span className="text-[10px]" style={{ color: C.textMuted }}>{c.email}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex overflow-hidden rounded-full border text-[10px] font-bold" style={{ borderColor: C.border }}>
              <span className="px-2.5 py-1" style={{ color: C.textMuted, background: '#fff' }}>Demo</span>
              <span className="flex items-center gap-1 px-2.5 py-1 text-white" style={{ background: C.green }}>
                <i className="h-1.5 w-1.5 rounded-full bg-white" /> Live
              </span>
            </div>
            <span className="rounded-full px-2.5 py-1 text-[10px] font-extrabold text-white" style={{ background: C.green }}>
              デモモード
            </span>
            <button type="button" className="relative rounded-full p-2 hover:bg-slate-50" aria-label="通知">
              <Bell className="h-4 w-4" style={{ color: C.textSecondary }} />
              <span className="absolute right-1 top-1 grid h-3.5 w-3.5 place-items-center rounded-full text-[8px] font-bold text-white" style={{ background: C.positive }}>3</span>
            </button>
            <div className="flex items-center gap-2 pl-1">
              <div className="grid h-8 w-8 place-items-center rounded-full text-[12px] font-bold text-white" style={{ background: C.navy }}>
                {advisor?.initial || 'J'}
              </div>
              <span className="hidden text-[11px] font-semibold sm:inline" style={{ color: C.navy }}>{advisor?.name || 'Justin'}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto pb-14">{children}</main>
        {toast ? (
          <div className="pointer-events-none fixed bottom-12 left-1/2 z-[80] -translate-x-1/2 rounded-full px-4 py-2 text-[12px] font-bold text-white shadow-lg" style={{ background: C.green }}>
            {toast}
          </div>
        ) : null}
      </div>
    </div>
  )
}
