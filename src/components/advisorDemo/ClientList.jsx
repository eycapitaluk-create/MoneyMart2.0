import { ChevronRight, Filter, Plus } from 'lucide-react'
import { formatYen, riskLabel } from './mockFeatured'
import { C } from './theme'
import { Card, Pill } from './ui'

export default function ClientList({ clients, onOpen, onToast }) {
  return (
    <div className="space-y-4 p-5 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold" style={{ color: C.navy }}>顧客一覧</h1>
          <p className="mt-1 text-[12px]" style={{ color: C.textMuted }}>担当顧客の一覧と最新状況を確認</p>
        </div>
        <button
          type="button"
          onClick={() => onToast('デモ: 顧客追加を受け付けました（佐藤 健太 / 定期レビュー）')}
          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12px] font-extrabold text-white"
          style={{ background: C.accent }}
        >
          <Plus className="h-4 w-4" /> 顧客追加
        </button>
      </div>

      <Card padding={12}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button type="button" className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[11px] font-semibold" style={{ borderColor: C.border, color: C.textSecondary }}>
            <Filter className="h-3.5 w-3.5" /> フィルタ
          </button>
          <select className="rounded-lg border px-2 py-1.5 text-[11px]" style={{ borderColor: C.border }}>
            <option>リスク許容度 すべて</option>
            <option>安定型</option>
            <option>バランス型</option>
            <option>積極型</option>
          </select>
          <select className="rounded-lg border px-2 py-1.5 text-[11px]" style={{ borderColor: C.border }}>
            <option>並び替え 次回レビュー</option>
            <option>資産順</option>
            <option>名前順</option>
          </select>
          <button type="button" className="text-[11px] font-bold" style={{ color: C.accent }}>フィルタをリセット</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead style={{ color: C.textMuted }}>
              <tr className="border-b text-[10px]" style={{ borderColor: C.borderSub }}>
                <th className="px-3 py-2 font-medium">顧客名</th>
                <th className="px-2 py-2 font-medium">リスク</th>
                <th className="px-2 py-2 font-medium">資産</th>
                <th className="px-2 py-2 font-medium">投資目的</th>
                <th className="px-2 py-2 font-medium">前回レビュー</th>
                <th className="px-2 py-2 font-medium">次回レビュー</th>
                <th className="px-2 py-2 font-medium">アラート</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const urgent = c.reviewDays != null && c.reviewDays <= 7
                return (
                  <tr
                    key={c.id}
                    className="cursor-pointer border-b hover:bg-[#fbf8ef]"
                    style={{ borderColor: C.borderSub }}
                    onClick={() => onOpen(c)}
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="grid h-8 w-8 place-items-center rounded-full text-[10px] font-bold" style={{ background: C.accentLight, color: C.accentDark }}>
                          {(c.name || '?').slice(0, 1)}
                        </div>
                        <div>
                          <div className="font-bold" style={{ color: C.navy }}>{c.name}</div>
                          <div className="text-[10px]" style={{ color: C.textMuted }}>{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <Pill bg={c.profile === 'aggressive' ? '#dbeafe' : C.accentLight} color={c.profile === 'aggressive' ? C.negative : C.accentDark}>
                        {riskLabel[c.profile] || 'バランス型'}
                      </Pill>
                    </td>
                    <td className="px-2 py-3 font-semibold tabular-nums">{formatYen(c.aum)}</td>
                    <td className="px-2 py-3">{c.objective || '資産成長'}</td>
                    <td className="px-2 py-3 text-[11px]" style={{ color: C.textMuted }}>{c.lastReview || '—'}</td>
                    <td className="px-2 py-3 font-semibold" style={{ color: C.accent }}>{c.nextReview || (c.reviewDays != null ? `${c.reviewDays}日後` : '—')}</td>
                    <td className="px-2 py-3">
                      {urgent ? (
                        <Pill bg="#ffedd5" color="#c2410c">緊急・残{Math.max(0, c.reviewDays)}日</Pill>
                      ) : (
                        <Pill bg="#dcfce7" color={C.green}>余裕</Pill>
                      )}
                    </td>
                    <td className="pr-3"><ChevronRight className="h-4 w-4 text-slate-300" /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex justify-between px-1 text-[10px]" style={{ color: C.textMuted }}>
          <span>{clients.length} / {clients.length} 件表示</span>
        </div>
      </Card>
    </div>
  )
}
