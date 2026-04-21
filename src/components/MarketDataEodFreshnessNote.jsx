import { Info } from 'lucide-react'

/**
 * EODベースのデータ取り込み時刻の目安（日本時間）。投資助言ではありません。
 * @param {{ variant?: 'fund' | 'stock' }} props
 */
export default function MarketDataEodFreshnessNote({ variant = 'fund' }) {
  const intro =
    variant === 'fund'
      ? '表示している価格・騰落率などは、'
      : 'チャート・一覧の株価などは、'

  return (
    <div
      className="flex gap-2.5 rounded-xl border border-sky-200/90 dark:border-sky-900/45 bg-sky-50/95 dark:bg-sky-950/30 px-3 py-2.5 text-[11px] md:text-xs leading-relaxed text-sky-950 dark:text-sky-100"
      role="note"
    >
      <Info className="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400 mt-0.5" aria-hidden />
      <p className="min-w-0">
        {intro}
        原則として<strong>各取引所の前営業日終値（EOD）</strong>をもとに更新されるデータです。
        取り込みの目安は、<strong>国内上場（東証など）は日本時間の午後（おおむね16時頃）</strong>、
        <strong>米国上場は翌営業日の日本時間の朝（おおむね8時頃）</strong>です。
        休場日・祝日・データ提供元の遅延により前後することがあります。
      </p>
    </div>
  )
}
