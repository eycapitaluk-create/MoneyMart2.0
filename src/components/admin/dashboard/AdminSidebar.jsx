import {
  BarChart3,
  LayoutDashboard,
  LifeBuoy,
  Settings,
  Users,
} from 'lucide-react'

const NAV = [
  {
    id: 'dashboard',
    label: 'ダッシュボード',
    icon: LayoutDashboard,
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: Users,
    children: [
      { id: 'crm', label: 'ユーザー管理' },
      { id: 'crm', label: 'セグメント' },
      { id: 'crm', label: 'キャンペーン' },
      { id: 'crm', label: 'メッセージ' },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    children: [
      { id: 'analytics', label: '利用状況' },
      { id: 'analytics', label: 'コンバージョン' },
      { id: 'analytics', label: '収益' },
      { id: 'analytics', label: 'コンテンツ' },
    ],
  },
  {
    id: 'operations',
    label: 'オペレーション',
    icon: Settings,
    children: [
      { id: 'operations', label: 'プロダクト' },
      { id: 'operations', label: 'サポート' },
      { id: 'operations', label: '設定' },
    ],
  },
]

export default function AdminSidebar({ activeTab, onTabChange }) {
  return (
    <aside className="hidden w-56 shrink-0 flex-col bg-[#0b1220] text-white lg:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <img src="/icon.png" alt="" className="h-7 w-7 rounded-md" />
        <span className="text-sm font-semibold tracking-tight">Moneymart</span>
      </div>
      <nav className="flex-1 space-y-5 px-3 pb-6">
        {NAV.map((item) => {
          const Icon = item.icon
          const active = activeTab === item.id
          return (
            <div key={item.label}>
              <button
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] ${
                  active ? 'bg-white/10 font-semibold text-white' : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <Icon size={15} />
                {item.label}
              </button>
              {item.children && (
                <div className="mt-1 space-y-0.5 pl-7">
                  {item.children.map((child) => (
                    <button
                      key={child.label}
                      type="button"
                      onClick={() => onTabChange(child.id)}
                      className="block w-full rounded-md px-2 py-1 text-left text-[12px] text-slate-400 hover:text-slate-200"
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>
      <div className="border-t border-white/10 px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold">JN</span>
          <div>
            <p className="text-xs font-medium">Admin</p>
            <p className="text-[10px] text-slate-400">Staff</p>
          </div>
        </div>
        <p className="mt-3 inline-flex items-center gap-1 text-[10px] text-slate-500">
          <LifeBuoy size={11} /> より良いお金の未来を、すべての人に。
        </p>
      </div>
    </aside>
  )
}
