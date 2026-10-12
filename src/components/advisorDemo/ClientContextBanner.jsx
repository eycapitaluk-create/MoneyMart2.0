import { UserRound, X } from 'lucide-react'
import { C } from './theme'

/** Matches iOS ClientContextRequiredBanner for Fund/Stock pages. */
export function ClientContextBanner({ kind = 'fund', client, clients = [], onPickClient, onClear, onToast }) {
  const noun = kind === 'stock' ? '株式' : kind === 'fund' ? 'ファンド' : '検討'

  if (client) {
    return (
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2.5"
        style={{ background: `${C.accent}0f`, borderBottom: `1px solid ${C.accent}33` }}
      >
        <UserRound className="h-4 w-4" style={{ color: C.accent }} />
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-extrabold tracking-wide" style={{ color: C.textMuted }}>対象顧客</div>
          <div className="truncate text-[13px] font-bold" style={{ color: C.navy }}>{client.name}</div>
        </div>
        <button
          type="button"
          onClick={() => {
            const next = clients.find((c) => c.id !== client.id) || clients[0]
            if (next) onPickClient?.(next)
            else onToast?.('デモ: 顧客選択シート')
          }}
          className="rounded-full px-2.5 py-1 text-[10px] font-extrabold"
          style={{ background: `${C.accent}1f`, color: C.accent }}
        >
          変更
        </button>
        {onClear ? (
          <button type="button" onClick={onClear} className="rounded-full p-1" aria-label="クリア">
            <X className="h-4 w-4" style={{ color: C.textMuted }} />
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: '#f59e0b55', background: '#fffbeb' }}>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-extrabold" style={{ color: C.navy }}>顧客未選択</div>
        <div className="text-[10px]" style={{ color: C.textMuted }}>
          {noun}を検討リストに追加するには対象顧客を選択してください
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          if (clients[0]) onPickClient?.(clients[0])
          else onToast?.('デモ: 顧客選択シート')
        }}
        className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-extrabold text-white"
        style={{ background: C.accent }}
      >
        顧客を選択
      </button>
    </div>
  )
}
