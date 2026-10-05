import { C } from './theme'
import { Card } from './ui'

const FAQ = [
  ['顧客コンテキストとは？', 'ファンド・株式画面で検討リストに追加する対象顧客です。「変更」から切り替えできます。'],
  ['デモと Live の違いは？', 'デモはモックデータと公開インサイトを組み合わせた表示です。Live 切替は本番接続を想定した UI 表示です。'],
  ['カレンダーの色分けは？', 'Review / Hearing / Prep / Meeting の種別ごとに色分けされています。空き日は 10:00 / 14:00 / 16:00 の候補枠を表示します。'],
  ['個人モードへは？', 'デモでは切替が無効です。本番では個人向けアプリへ遷移します。'],
  ['AI レビューの判断は？', '承認 / 修正 / 見送りを記録すると右側の「アドバイザー判断」に残ります。前回面談の判断も参照できます。'],
  ['ファンド比較に価格がない？', '本デモでは基準価額の代わりにリターン・信託報酬・純資産総額で確認します。実データ接続後に基準価額を表示します。'],
]

const SHORTCUTS = [
  ['顧客一覧', '担当顧客の優先度と次回レビューを確認'],
  ['サマリー', 'AUM・次回面談・最近のドキュメント'],
  ['レビュー', 'リスク / AI / ミーティングを同じ顧客で切替'],
  ['マーケット', 'Fear & Greed とセクターヒートマップ'],
]

export default function HelpPage({ onToast }) {
  return (
    <div className="space-y-4 p-5 lg:p-6">
      <div>
        <h1 className="text-[22px] font-extrabold" style={{ color: C.navy }}>ヘルプ</h1>
        <p className="mt-0.5 text-[11px]" style={{ color: C.textMuted }}>MoneyMart Business デモの使い方</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {SHORTCUTS.map(([k, v]) => (
          <Card key={k} padding={14}>
            <div className="text-[13px] font-bold" style={{ color: C.navy }}>{k}</div>
            <p className="mt-1 text-[12px]" style={{ color: C.textSecondary }}>{v}</p>
          </Card>
        ))}
      </div>
      <div className="space-y-2">
        {FAQ.map(([q, a]) => (
          <Card key={q} padding={14}>
            <div className="text-[13px] font-bold" style={{ color: C.navy }}>{q}</div>
            <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: C.textSecondary }}>{a}</p>
          </Card>
        ))}
      </div>
      <Card padding={14}>
        <div className="text-[13px] font-bold" style={{ color: C.navy }}>サポート</div>
        <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: C.textSecondary }}>
          デモ操作の質問はサポートへ。平日 9:00-18:00（JST）。返信は担当アドバイザー宛に届きます。
        </p>
        <button
          type="button"
          onClick={() => onToast('デモ: サポートに問い合わせました')}
          className="mt-3 rounded-full px-4 py-2.5 text-[12px] font-extrabold text-white"
          style={{ background: C.accent }}
        >
          サポートに問い合わせ
        </button>
      </Card>
    </div>
  )
}
