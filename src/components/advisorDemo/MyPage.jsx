import { C } from './theme'
import { Card, Pill } from './ui'

const ACTIVITY = [
  ['09:20', 'Nam Justin の AI 提案を確認', '承認待ち 2件'],
  ['08:45', '佐藤 健太 の定期レビュー資料を共有', 'PDF 送信済み'],
  ['昨日', 'カレンダーに 10/2 14:00 を仮押さえ', 'オンライン 45分'],
  ['昨日', '集中リスクアラートを既読', '日経225 ETF 86%'],
]

export default function MyPage({ advisor, onToast }) {
  const name = advisor?.name || 'Justin'
  const initial = advisor?.initial || name.slice(0, 1)
  return (
    <div className="space-y-4 p-5 lg:p-6">
      <h1 className="text-[22px] font-extrabold" style={{ color: C.navy }}>マイページ</h1>
      <Card padding={16}>
        <div className="flex items-center gap-4">
          <div
            className="grid h-14 w-14 place-items-center rounded-2xl text-[18px] font-extrabold text-white"
            style={{ background: C.accent }}
          >
            {initial}
          </div>
          <div>
            <div className="text-[18px] font-extrabold" style={{ color: C.navy }}>{name}</div>
            <div className="mt-1 text-[11px]" style={{ color: C.textMuted }}>シニアアドバイザー · Tokyo Desk</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Pill>アドバイザー</Pill>
              <Pill bg="#dcfce7" color={C.green}>Demo · Live</Pill>
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ['担当顧客', '48'],
            ['今月の面談', '12'],
            ['優先対応', '5'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border p-3" style={{ borderColor: C.border }}>
              <div className="text-[10px]" style={{ color: C.textMuted }}>{k}</div>
              <div className="mt-1 text-[20px] font-extrabold tabular-nums" style={{ color: C.navy }}>{v}</div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onToast('デモ: プロフィールを更新しました')}
          className="mt-4 rounded-full px-4 py-2 text-[12px] font-extrabold text-white"
          style={{ background: C.accent }}
        >
          プロフィール編集
        </button>
      </Card>
      <Card padding={14}>
        <h2 className="mb-2 text-[13px] font-bold">本日の活動</h2>
        <div className="space-y-2">
          {ACTIVITY.map(([t, title, sub]) => (
            <div key={title} className="flex items-start gap-3 rounded-xl bg-[#faf8f2] px-3 py-2">
              <div className="w-10 shrink-0 text-[10px] font-extrabold tabular-nums" style={{ color: C.accentDark }}>{t}</div>
              <div>
                <div className="text-[12px] font-bold" style={{ color: C.navy }}>{title}</div>
                <div className="mt-0.5 text-[10px]" style={{ color: C.textMuted }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
