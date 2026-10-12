import { useMemo, useState } from 'react'
import pack from '../../data/dividendVerifiedPayments.generated.json'
import { listVerifiedPaymentEvents } from '../../lib/verifiedDividendPayments'

export default function VerifiedDividendPayments({ symbols = [] }) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [query, setQuery] = useState('')
  const [selectedOnly, setSelectedOnly] = useState(symbols.length > 0)
  const [limit, setLimit] = useState(12)
  const events = useMemo(() => listVerifiedPaymentEvents(pack, { symbols: selectedOnly ? symbols : [], year, query }), [symbols, selectedOnly, year, query])
  return <section className="rounded-2xl border border-orange-200 bg-white p-4 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white" aria-label="公式発表の支払日と金額">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-bold">公式発表の支払日と金額</h3>
      <label className="text-sm">支払年 <select className="rounded border bg-transparent p-1" value={year} onChange={event => { setYear(Number(event.target.value)); setLimit(12) }}>
        {[2025, 2026, 2027].map(value => <option key={value} value={value}>{value}年</option>)}
      </select></label>
    </div>
    <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">権利落ち日・決算日と支払日を分けています。公表された支払日と税引前の1株・1口あたり金額のみ掲載。未掲載は無配を意味しません。確認基準日: {pack.asOf}。</p>
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <input className="min-w-0 rounded border bg-transparent px-3 py-2 text-sm" aria-label="公式配当の銘柄検索" placeholder="コード・銘柄名で検索" value={query} onChange={event => { setQuery(event.target.value); setLimit(12) }} />
      {symbols.length > 0 && <label className="text-xs"><input type="checkbox" checked={selectedOnly} onChange={event => { setSelectedOnly(event.target.checked); setLimit(12) }} /> 登録・選択銘柄のみ</label>}
    </div>
    {events.length === 0 ? <p className="mt-4 text-sm text-slate-500">この条件では支払日・金額の確認済み情報がありません。0円や支払予定なしとの判定ではありません。</p> : <ul className="mt-4 divide-y divide-slate-200 dark:divide-slate-700">
      {events.slice(0, limit).map(event => <li className="py-3 text-sm" key={`${event.symbol}-${event.payment_date}`}>
        <div className="flex flex-wrap justify-between gap-2"><span className="font-bold">{event.symbol} · {event.name}</span><span className="font-mono font-bold">{event.currency === 'USD' ? '$' : '¥'}{Number(event.amount).toLocaleString('ja-JP', { maximumFractionDigits: 6 })}</span></div>
        <p className="mt-1 text-xs">支払日: {event.payment_date} {event.record_date && `／ 基準日: ${event.record_date}`} {event.ex_date && `／ 権利落ち日: ${event.ex_date}`} {event.settlement_date && `／ 決算日: ${event.settlement_date}`}</p>
        {Number(event.special_amount) > 0 && <p className="mt-1 text-xs">一般配当 {event.regular_amount} ＋ 特別配当 {event.special_amount}（特別配当を毎回繰り返すものではありません）</p>}
        {event.current_unit_amount != null && <p className="mt-1 text-xs">当時の1口基準。{event.split_effective_date}の分割後の現在口数基準では {event.current_unit_amount}円。過去の受取額は変更しません。</p>}
        <a className="mt-1 inline-block text-xs font-bold text-orange-600 underline" href={event.source_url} target="_blank" rel="noreferrer">公式資料 ↗</a>
      </li>)}
    </ul>}
    {events.length > limit && <button type="button" className="mt-3 text-sm font-bold text-orange-600" onClick={() => setLimit(value => value + 20)}>さらに表示（残り{events.length - limit}件）</button>}
  </section>
}
