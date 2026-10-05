import { C } from './theme'
import { Card, Pill } from './ui'

const ROWS = [
  ['組織', 'MoneyMart Advisory · Default'],
  ['言語', '日本語'],
  ['タイムゾーン', 'Asia/Tokyo'],
  ['通知', 'オン · レビュー期日 / 集中リスク'],
  ['デモモード', 'Live'],
  ['テーマ', 'ライト'],
]

const NOTICES = [
  ['レビュー期日リマインド', '面談 3日前 / 当日 08:00'],
  ['集中リスクアラート', '単一銘柄 20% 超過で通知'],
  ['AI 提案の承認待ち', '未処理が 24時間続いたら通知'],
]

const COMPLIANCE = [
  ['監査ログ保存', '90日'],
  ['顧客PDF共有', '承認後のみ'],
  ['予測表現チェック', 'オン'],
]

export default function SettingsPage({ onToast }) {
  return (
    <div className="space-y-4 p-5 lg:p-6">
      <div>
        <h1 className="text-[22px] font-extrabold" style={{ color: C.navy }}>設定</h1>
        <p className="mt-0.5 text-[11px]" style={{ color: C.textMuted }}>アドバイザー作業環境 · デモ表示</p>
      </div>
      <Card padding={0}>
        {ROWS.map(([k, v], i) => (
          <button
            key={k}
            type="button"
            onClick={() => onToast(`デモ: ${k} を編集`)}
            className="flex w-full items-center justify-between px-4 py-3.5 text-left hover:bg-[#fbf8ef]"
            style={{ borderBottom: i < ROWS.length - 1 ? `1px solid ${C.borderSub}` : undefined }}
          >
            <span className="text-[13px] font-semibold" style={{ color: C.navy }}>{k}</span>
            <span className="flex items-center gap-2 text-[12px]" style={{ color: C.textMuted }}>
              {k === 'デモモード' ? <Pill bg="#dcfce7" color={C.green}>{v}</Pill> : v}
              <span>›</span>
            </span>
          </button>
        ))}
      </Card>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card padding={14}>
          <h2 className="mb-2 text-[13px] font-bold">通知ルール</h2>
          <div className="space-y-2">
            {NOTICES.map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-3 rounded-xl bg-[#faf8f2] px-3 py-2">
                <div>
                  <div className="text-[12px] font-bold" style={{ color: C.navy }}>{k}</div>
                  <div className="mt-0.5 text-[10px]" style={{ color: C.textMuted }}>{v}</div>
                </div>
                <Pill bg="#dcfce7" color={C.green}>ON</Pill>
              </div>
            ))}
          </div>
        </Card>
        <Card padding={14}>
          <h2 className="mb-2 text-[13px] font-bold">コンプライアンス</h2>
          <div className="space-y-2">
            {COMPLIANCE.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b py-2 text-[12px]" style={{ borderColor: C.borderSub }}>
                <span style={{ color: C.textMuted }}>{k}</span>
                <b style={{ color: C.navy }}>{v}</b>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed" style={{ color: C.textSecondary }}>
            顧客対話では価格予測ではなく、保有資産との関連性を共有します。最終判断はアドバイザーが行います。
          </p>
        </Card>
      </div>
    </div>
  )
}
