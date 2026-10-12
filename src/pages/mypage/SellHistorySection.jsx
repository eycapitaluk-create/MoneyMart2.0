import { useEffect, useMemo, useState } from 'react'
import { History, Loader2, Pencil, Trash2 } from 'lucide-react'
import { signedReturnTextClassStrong } from '../../lib/marketDirectionColors'
import {
  buildSellHistoryTimeline,
  extractYearsFromSellDates,
  parseSellDateKey,
  sellDateSortMs,
} from '../../lib/sellHistoryTimeline'
import { getStockNameFallback } from '../../data/stockNameFallback'
import { ETF_LIST_FROM_XLSX } from '../../data/etfListFromXlsx'
import { decodeHtmlEntities, resolveFundDisplayName } from '../../lib/fundDisplayUtils'

const PAGE_SIZE = 60

const ETF_META_BY_SYMBOL = new Map(
  (Array.isArray(ETF_LIST_FROM_XLSX) ? ETF_LIST_FROM_XLSX : []).map((r) => [
    String(r.symbol || '').trim().toUpperCase(),
    r,
  ]),
)

function inferListedCurrency(symbol = '') {
  const s = String(symbol || '').toUpperCase()
  if (s.endsWith('.T')) return 'JPY'
  if (s.endsWith('.L') || s.endsWith('.LN')) return 'GBP'
  if (/\.(PA|AS|DE|MI|MC|SW|BR|LS|ST|HE)$/i.test(s)) return 'EUR'
  return 'USD'
}

function normalizeSellUnitPrice(symbol, rawPrice) {
  const n = Number(rawPrice)
  if (!Number.isFinite(n) || n < 0) return 0
  if (/\.(L|LN)$/i.test(String(symbol || ''))) return n / 100
  return n
}

function formatDateJp(isoFrag) {
  const key = parseSellDateKey(isoFrag)
  if (!key) return '—'
  const [y, mo, d] = key.split('-')
  if (!y || !mo || !d) return key
  return `${y}/${mo}/${d}`
}

function formatSellPrice(symbol, rawPrice, currency) {
  const v = normalizeSellUnitPrice(symbol, rawPrice)
  if (!(v > 0)) return '—'
  if (currency === 'JPY') return `¥${Math.round(v).toLocaleString('ja-JP')}`
  if (currency === 'USD')
    return `$${v.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
  if (currency === 'EUR')
    return `€${v.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
  if (currency === 'GBP')
    return `£${v.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
  return String(v)
}

function formatAppliedUsdJpy(rate, asOf) {
  const n = Number(rate)
  const day = String(asOf || '').slice(0, 10)
  if (!(n > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return ''
  const yen = n.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  return `適用レート 1ドル=¥${yen} (${day})`
}

function yenSigned(n) {
  const v = Math.round(Number(n) || 0)
  if (v === 0) return '¥0'
  const sign = v > 0 ? '+' : '-'
  return `${sign}¥${Math.abs(v).toLocaleString('ja-JP')}`
}

const parseNum = (raw) => {
  const n = Number(String(raw ?? '').replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : NaN
}

/** HTML date input / YYYY-MM-DD */
const coerceSellDateIso = (raw) => {
  const s = String(raw ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return parseSellDateKey(s)
}

export default function SellHistorySection({
  stockTrades = [],
  fundTrades = [],
  ownedFunds = [],
  isLoggedIn = false,
  assetsReady = true,
  stockRealizedDbReady = true,
  fundRealizedDbReady = true,
  onGoStockTab,
  onGoFundTab,
  onUpdateStockTrade,
  onDeleteStockTrade,
  onUpdateFundTrade,
  onDeleteFundTrade,
  /** (symbol, qty, sellPrice, sellDateIso) => proceedsJpy — MyPage の stockSaleProceedsJpy と同じ */
  computeSaleProceedsJpy,
  /** (sellDateIso) => Promise<{ rate, asOf } | null>。USD 売却の保存レート。 */
  resolveSellFx,
}) {
  const [kindFilter, setKindFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  /** @type {[{ kind: 'stock'|'fund', tradeId: string, symbol: string, sellDate: string, qtyStr: string, sellPriceStr: string, costStr: string, proceedsStr: string, error: string }]|null} */
  const [editDraft, setEditDraft] = useState(null)
  /** @type {[{ kind: 'stock'|'fund', tradeId: string, label: string }]|null} */
  const [pendingDelete, setPendingDelete] = useState(null)
  /** 저장된 환율이 없는 기존 USD 매도. 표시만 하고 다시 저장하지 않는다. */
  const [lookedUpFx, setLookedUpFx] = useState({})

  const fundFirstNameBySymbol = useMemo(() => {
    const m = new Map()
    for (const row of Array.isArray(ownedFunds) ? ownedFunds : []) {
      const sym = String(row?.symbol || '').trim().toUpperCase()
      if (!sym || m.has(sym)) continue
      const raw = decodeHtmlEntities(String(row?.name || '').trim())
      if (raw) m.set(sym, raw)
    }
    return m
  }, [ownedFunds])

  useEffect(() => {
    const dates = []
    for (const row of Array.isArray(stockTrades) ? stockTrades : []) {
      if (inferListedCurrency(row?.symbol) !== 'USD') continue
      const storedRate = Number(row?.sellFxRate)
      const storedDate = String(row?.sellFxDate || '').slice(0, 10)
      if (storedRate > 0 && /^\d{4}-\d{2}-\d{2}$/.test(storedDate)) continue
      const d = parseSellDateKey(row?.sellDate)
      if (d) dates.push(d)
    }
    const unique = [...new Set(dates)]
    if (unique.length === 0) return undefined
    let alive = true
    ;(async () => {
      const next = {}
      await Promise.all(unique.map(async (d) => {
        try {
          const r = await fetch(`/api/fx?date=${encodeURIComponent(d)}`)
          if (!r.ok) return
          const j = await r.json()
          const rate = Number(j?.rates?.USD)
          const asOf = String(j?.fxAsOf || '').slice(0, 10)
          if (rate > 0 && /^\d{4}-\d{2}-\d{2}$/.test(asOf)) next[d] = { rate, asOf }
        } catch {
          /* 표시 전용 */
        }
      }))
      if (alive) setLookedUpFx((prev) => ({ ...prev, ...next }))
    })()
    return () => {
      alive = false
    }
  }, [stockTrades])

  const fxLineForRow = (row) => {
    if (row?.kind !== 'stock' || inferListedCurrency(row?.symbol) !== 'USD') return ''
    const storedRate = Number(row?.sellFxRate)
    const storedDate = String(row?.sellFxDate || '').slice(0, 10)
    if (storedRate > 0 && /^\d{4}-\d{2}-\d{2}$/.test(storedDate)) {
      return formatAppliedUsdJpy(storedRate, storedDate)
    }
    const d = parseSellDateKey(row?.sellDate)
    const found = d ? lookedUpFx[d] : null
    return found ? formatAppliedUsdJpy(found.rate, found.asOf) : ''
  }

  const timeline = useMemo(
    () => buildSellHistoryTimeline({ stockTrades, fundTrades }),
    [stockTrades, fundTrades],
  )

  const years = useMemo(() => extractYearsFromSellDates(timeline), [timeline])

  const filtered = useMemo(() => {
    let rows = timeline
    if (kindFilter === 'stock') rows = rows.filter((r) => r.kind === 'stock')
    else if (kindFilter === 'fund') rows = rows.filter((r) => r.kind === 'fund')
    if (yearFilter !== 'all') {
      const y = String(yearFilter)
      rows = rows.filter((r) => parseSellDateKey(r.sellDate).startsWith(y))
    }
    return rows
  }, [timeline, kindFilter, yearFilter])

  const visibleRows = useMemo(
    () => filtered.slice(0, Math.min(filtered.length, visibleCount)),
    [filtered, visibleCount],
  )

  const resolveLabel = (row) => {
    const sym = String(row?.symbol || '').trim().toUpperCase()
    if (!sym) return '—'
    if (row.kind === 'fund') {
      const stored = fundFirstNameBySymbol.get(sym) || ''
      return resolveFundDisplayName(sym, { name: stored }, ETF_META_BY_SYMBOL.get(sym), null) || sym
    }
    const fb = getStockNameFallback(sym)
    return fb && fb.trim() !== sym ? fb : sym
  }

  const resetFilters = () => {
    setKindFilter('all')
    setYearFilter('all')
    setVisibleCount(PAGE_SIZE)
  }

  const rowTradeId = (row) => String(row?.tradeId || row?.trade_id || '').trim()

  const canMutateRow = (row) => {
    if (!isLoggedIn || !assetsReady) return false
    return Boolean(rowTradeId(row))
  }

  const openEdit = (row) => {
    if (!canMutateRow(row)) return
    const tid = rowTradeId(row)
    setEditDraft({
      kind: row.kind,
      tradeId: tid,
      symbol: String(row.symbol || '').trim().toUpperCase(),
      sellDate: coerceSellDateIso(row.sellDate) || '',
      qtyStr: row.qty != null && Number(row.qty) > 0 ? String(row.qty) : '',
      sellPriceStr: row.sellPrice != null ? String(row.sellPrice) : '',
      costStr:
        row.costBasisJpy != null || row.cost_basis_jpy != null
          ? String(row.costBasisJpy ?? row.cost_basis_jpy)
          : '',
      proceedsStr:
        row.proceedsJpy != null || row.proceeds_jpy != null
          ? String(row.proceedsJpy ?? row.proceeds_jpy)
          : '',
      error: '',
    })
  }

  /** 売却単価・数量・売却日が変わったら売却金額(円)を再計算（新規売却記録と同じ為替ロジック） */
  useEffect(() => {
    if (!editDraft || typeof computeSaleProceedsJpy !== 'function') return
    if (editDraft.kind === 'stock' && inferListedCurrency(editDraft.symbol) === 'USD') return
    const iso = coerceSellDateIso(editDraft.sellDate)
    const qty = parseNum(editDraft.qtyStr)
    const price = parseNum(editDraft.sellPriceStr)
    if (!iso || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) return
    const jpy = computeSaleProceedsJpy(editDraft.symbol, qty, price, iso)
    if (!Number.isFinite(jpy)) return
    const nextStr = String(Math.round(jpy * 100) / 100)
    setEditDraft((d) => {
      if (!d) return d
      const prev = parseNum(d.proceedsStr)
      if (Number.isFinite(prev) && Math.abs(prev - jpy) < 0.0005) return d
      return { ...d, proceedsStr: nextStr, error: '' }
    })
  }, [
    computeSaleProceedsJpy,
    editDraft?.symbol,
    editDraft?.sellDate,
    editDraft?.qtyStr,
    editDraft?.sellPriceStr,
    editDraft?.tradeId,
  ])

  useEffect(() => {
    if (!editDraft || editDraft.kind !== 'stock' || inferListedCurrency(editDraft.symbol) !== 'USD') return undefined
    if (typeof resolveSellFx !== 'function') return undefined
    const iso = coerceSellDateIso(editDraft.sellDate)
    if (!iso) return undefined
    let alive = true
    resolveSellFx(iso).then((fx) => {
      if (!alive) return
      setEditDraft((d) => {
        if (!d || coerceSellDateIso(d.sellDate) !== iso) return d
        if (!fx) return { ...d, sellFxRate: null, sellFxDate: '' }
        const qty = parseNum(d.qtyStr)
        const price = parseNum(d.sellPriceStr)
        const next = { ...d, sellFxRate: fx.rate, sellFxDate: fx.asOf }
        if (qty > 0 && price >= 0) next.proceedsStr = String(Math.round(qty * price * fx.rate * 100) / 100)
        return next
      })
    })
    return () => {
      alive = false
    }
  }, [editDraft?.kind, editDraft?.symbol, editDraft?.sellDate, editDraft?.qtyStr, editDraft?.sellPriceStr, resolveSellFx])

  const editPreviewPnlJpy = useMemo(() => {
    if (!editDraft) return null
    const proceeds = parseNum(editDraft.proceedsStr)
    const cost = parseNum(editDraft.costStr)
    if (!Number.isFinite(proceeds) || !Number.isFinite(cost)) return null
    return proceeds - cost
  }, [editDraft])

  const submitEdit = () => {
    if (!editDraft) return
    const iso = coerceSellDateIso(editDraft.sellDate)
    if (!iso) {
      setEditDraft((d) => (d ? { ...d, error: '売却日を YYYY-MM-DD で入力してください。' } : d))
      return
    }
    const qty = parseNum(editDraft.qtyStr)
    const sellPrice = parseNum(editDraft.sellPriceStr)
    const costBasisJpy = parseNum(editDraft.costStr)
    let proceedsJpy = parseNum(editDraft.proceedsStr)
    if (typeof computeSaleProceedsJpy === 'function') {
      const recomputed = computeSaleProceedsJpy(editDraft.symbol, qty, sellPrice, iso)
      if (Number.isFinite(recomputed)) proceedsJpy = recomputed
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setEditDraft((d) => (d ? { ...d, error: '数量は正の数で入力してください。' } : d))
      return
    }
    if (!Number.isFinite(sellPrice) || sellPrice < 0) {
      setEditDraft((d) => (d ? { ...d, error: '売却単価を入力してください。' } : d))
      return
    }
    if (!Number.isFinite(costBasisJpy) || !Number.isFinite(proceedsJpy)) {
      setEditDraft((d) => (d ? { ...d, error: '取得費・売却金額（円）を数値で入力してください。' } : d))
      return
    }
    const patch = {
      sellDate: iso,
      qty,
      sellPrice,
      costBasisJpy,
      proceedsJpy,
      realizedPnlJpy: proceedsJpy - costBasisJpy,
    }
    if (editDraft.kind === 'stock' && inferListedCurrency(editDraft.symbol) === 'USD') {
      const rate = Number(editDraft.sellFxRate)
      const fxDate = String(editDraft.sellFxDate || '').slice(0, 10)
      if (rate > 0 && /^\d{4}-\d{2}-\d{2}$/.test(fxDate)) {
        patch.sellFxRate = rate
        patch.sellFxDate = fxDate
        patch.proceedsJpy = qty * sellPrice * rate
        patch.realizedPnlJpy = patch.proceedsJpy - costBasisJpy
      }
    }
    if (editDraft.kind === 'stock') {
      onUpdateStockTrade?.(editDraft.tradeId, patch)
    } else {
      onUpdateFundTrade?.(editDraft.tradeId, patch)
    }
    setEditDraft(null)
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    const { kind, tradeId } = pendingDelete
    if (kind === 'stock') onDeleteStockTrade?.(tradeId)
    else onDeleteFundTrade?.(tradeId)
    setPendingDelete(null)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md shadow-slate-900/10 dark:shadow-black/30 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-slate-900 dark:bg-orange-500 text-white p-2 shrink-0">
              <History size={20} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">売却履歴</h2>
              <p className="mt-1 text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
                マイページで記録した株式・ファンドの売却のみ表示します（証券会社の約定履歴ではありません）。
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {!isLoggedIn ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/40 px-4 py-6 text-center">
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">ログインすると売却履歴を保存・表示できます。</p>
            </div>
          ) : null}

          {isLoggedIn && !assetsReady ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300">
              <Loader2 size={18} className="animate-spin shrink-0" aria-hidden />
              データを読み込み中です…
            </div>
          ) : null}

          {isLoggedIn && assetsReady && (!stockRealizedDbReady || !fundRealizedDbReady) ? (
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/90 dark:bg-amber-950/25 px-4 py-3 text-[11px] font-semibold text-amber-950 dark:text-amber-100/95 leading-relaxed">
              {!stockRealizedDbReady ? (
                <p>株式の売却テーブルに接続できませんでした。履歴が空の場合はページ更新かログインし直しを試してください。</p>
              ) : null}
              {!fundRealizedDbReady ? (
                <p className={!stockRealizedDbReady ? 'mt-2' : ''}>
                  ファンド売却テーブルが未作成の環境では、ファンドの売却履歴を読み込めません（株式のみ表示されることがあります）。
                </p>
              ) : null}
            </div>
          ) : null}

          {isLoggedIn && assetsReady && timeline.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/40 px-4 py-6 text-center space-y-3">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">まだ売却記録がありません。</p>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
                「株式」「ファンド」タブの保有一覧から売却を記録すると、ここに時系列で表示されます。
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => onGoStockTab?.()}
                  className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 dark:bg-orange-500 text-white text-xs font-black hover:opacity-90"
                >
                  株式タブへ
                </button>
                <button
                  type="button"
                  onClick={() => onGoFundTab?.()}
                  className="inline-flex items-center px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  ファンドタブへ
                </button>
              </div>
            </div>
          ) : null}

          {isLoggedIn && assetsReady && timeline.length > 0 ? (
            <>
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3">
                <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800/80">
                  {[
                    { id: 'all', label: 'すべて' },
                    { id: 'stock', label: '株式' },
                    { id: 'fund', label: 'ファンド' },
                  ].map((opt) => (
                    <button
                      key={`sellhist-kind-${opt.id}`}
                      type="button"
                      onClick={() => {
                        setKindFilter(opt.id)
                        setVisibleCount(PAGE_SIZE)
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition ${
                        kindFilter === opt.id
                          ? 'bg-orange-500 text-white shadow-sm dark:bg-orange-500 dark:text-white'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/70 dark:hover:bg-slate-700/60'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="sellhist-year" className="text-[11px] font-black text-slate-500 dark:text-slate-400 shrink-0">
                    年
                  </label>
                  <select
                    id="sellhist-year"
                    value={yearFilter}
                    onChange={(e) => {
                      setYearFilter(e.target.value)
                      setVisibleCount(PAGE_SIZE)
                    }}
                    className="min-w-[8.5rem] rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-black text-slate-800 dark:text-slate-100"
                  >
                    <option value="all">すべて</option>
                    {years.map((y) => (
                      <option key={`sellhist-y-${y}`} value={String(y)}>
                        {y}年
                      </option>
                    ))}
                  </select>
                  {(kindFilter !== 'all' || yearFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="text-[11px] font-bold text-slate-500 dark:text-slate-400 underline underline-offset-2"
                    >
                      リセット
                    </button>
                  )}
                </div>
                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 sm:ml-auto tabular-nums">
                  {filtered.length}件
                  {filtered.length !== timeline.length ? `（全${timeline.length}件中）` : ''}
                </p>
              </div>

              <div className="hidden md:grid md:grid-cols-[5.5rem_4rem_minmax(0,1fr)_minmax(0,9rem)_minmax(0,9rem)_minmax(0,8rem)_4.5rem] gap-x-2 gap-y-1 px-2 pb-1 text-[10px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-700">
                <span>売却日</span>
                <span>種別</span>
                <span>銘柄</span>
                <span className="text-right">数量・単価</span>
                <span className="text-right">売却金額(円)</span>
                <span className="text-right">実現損益</span>
                <span className="text-center">操作</span>
              </div>

              <ul className="divide-y divide-slate-200 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                {visibleRows.map((row) => {
                  const sym = String(row.symbol || '').trim().toUpperCase()
                  const ccy = inferListedCurrency(sym)
                  const title = resolveLabel(row)
                  const pnl = Number(row.realizedPnlJpy ?? row.realized_pnl_jpy ?? 0)
                  const proceeds = Number(row.proceedsJpy ?? row.proceeds_jpy ?? 0)
                  const qty = Number(row.qty ?? 0)
                  const fxLine = fxLineForRow(row)
                  const sortMs = sellDateSortMs(row.sellDate)
                  return (
                    <li
                      key={`${row.kind}-${rowTradeId(row) || `${sym}-${sortMs}`}`}
                      className="px-3 py-3 md:px-2 md:py-2.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                    >
                      <div className="md:hidden space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 tabular-nums">
                              {formatDateJp(row.sellDate)}
                            </p>
                            <p className="mt-0.5 font-black text-slate-900 dark:text-white truncate" title={title}>
                              {sym}{title !== sym ? ` · ${title}` : ''}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black border ${
                              row.kind === 'fund'
                                ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                                : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            {row.kind === 'fund' ? 'ファンド' : '株式'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          <div>
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500">数量・単価</p>
                            <p className="tabular-nums mt-0.5">
                              {qty > 0 ? `${qty.toLocaleString('ja-JP')} × ${formatSellPrice(sym, row.sellPrice, ccy)}` : '—'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500">売却金額(円)</p>
                            <p className="tabular-nums mt-0.5 font-black text-slate-800 dark:text-slate-100">
                              ¥{Math.round(proceeds).toLocaleString('ja-JP')}
                            </p>
                          </div>
                          <div className="col-span-2 flex justify-between items-baseline pt-1 border-t border-dashed border-slate-200 dark:border-slate-600">
                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500">実現損益</span>
                            <span className={`font-black tabular-nums ${signedReturnTextClassStrong(pnl)}`}>
                              {yenSigned(pnl)}
                            </span>
                          </div>
                          {canMutateRow(row) ? (
                            <div className="col-span-2 flex justify-end gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => openEdit(row)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-[11px] font-black text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <Pencil size={14} aria-hidden /> 編集
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setPendingDelete({
                                    kind: row.kind,
                                    tradeId: rowTradeId(row),
                                    label: `${sym} ${title !== sym ? title : ''}`.trim(),
                                  })
                                }
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800 text-[11px] font-black text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              >
                                <Trash2 size={14} aria-hidden /> 削除
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="hidden md:grid md:grid-cols-[5.5rem_4rem_minmax(0,1fr)_minmax(0,9rem)_minmax(0,9rem)_minmax(0,8rem)_4.5rem] md:items-center md:gap-x-2 text-sm">
                        <span className="text-[12px] font-bold tabular-nums text-slate-600 dark:text-slate-300">
                          {formatDateJp(row.sellDate)}
                        </span>
                        <span
                          className={`inline-flex justify-center px-1.5 py-0.5 rounded-md text-[10px] font-black border ${
                            row.kind === 'fund'
                              ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                              : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {row.kind === 'fund' ? 'FD' : '株'}
                        </span>
                        <div className="min-w-0">
                          <p className="font-black text-slate-900 dark:text-white truncate">{sym}</p>
                          {title !== sym ? (
                            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">{title}</p>
                          ) : null}
                        </div>
                        <div className="text-right text-[12px] font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                          {qty > 0 ? (
                            <>
                              <span className="block">{qty.toLocaleString('ja-JP')}</span>
                              <span className="block text-[11px] text-slate-400 dark:text-slate-500">
                                @ {formatSellPrice(sym, row.sellPrice, ccy)}
                              </span>
                            </>
                          ) : (
                            '—'
                          )}
                        </div>
                        <div className="text-right font-black tabular-nums text-slate-800 dark:text-slate-100 text-[13px]">
                          ¥{Math.round(proceeds).toLocaleString('ja-JP')}
                        </div>
                        <div className={`text-right font-black tabular-nums text-[13px] ${signedReturnTextClassStrong(pnl)}`}>
                          {yenSigned(pnl)}
                        </div>
                        <div className="flex flex-col items-stretch gap-1 justify-self-end">
                          {canMutateRow(row) ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openEdit(row)}
                                className="inline-flex items-center justify-center gap-0.5 px-1.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-[10px] font-black text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                                aria-label={`${sym} の売却を編集`}
                              >
                                <Pencil size={12} aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setPendingDelete({
                                    kind: row.kind,
                                    tradeId: rowTradeId(row),
                                    label: `${sym} ${title !== sym ? title : ''}`.trim(),
                                  })
                                }
                                className="inline-flex items-center justify-center gap-0.5 px-1.5 py-1 rounded-md border border-rose-300 dark:border-rose-800 text-[10px] font-black text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                aria-label={`${sym} の売却を削除`}
                              >
                                <Trash2 size={12} aria-hidden />
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-300 dark:text-slate-600 text-center">—</span>
                          )}
                        </div>
                      </div>
                      {fxLine ? (
                        <p className="mt-1.5 text-[11px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                          {fxLine}
                        </p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>

              {filtered.length > visibleCount ? (
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    さらに表示（あと {filtered.length - visibleCount} 件）
                  </button>
                </div>
              ) : null}

              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 leading-relaxed">
                ※ 単価の通貨は銘柄コードから推定しています（例: .T 以外の短いティッカーは USD）。LSE (.L) は価格をペンスからポンドに換算して表示します。
              </p>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 leading-relaxed">
                ※ 編集・削除はログイン後に利用できます。テーブル作成済みの環境では、マイページの自動保存経由で Supabase（株式:
                {' '}
                <code className="text-[9px]">user_stock_realized_trades</code>
                {' · '}
                ファンド:
                {' '}
                <code className="text-[9px]">user_fund_realized_trades</code>
                ）にも反映されます。
              </p>
            </>
          ) : null}
        </div>
      </div>

      {editDraft ? (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/55 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sellhist-edit-title"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-5 space-y-4"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 id="sellhist-edit-title" className="text-base font-black text-slate-900 dark:text-white">
                売却記録を編集
              </h3>
              <button
                type="button"
                onClick={() => setEditDraft(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                閉じる
              </button>
            </div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {editDraft.symbol}（{editDraft.kind === 'fund' ? 'ファンド' : '株式'}）— 銘柄コードは変更できません。
            </p>
            {editDraft.error ? (
              <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{editDraft.error}</p>
            ) : null}
            <div className="space-y-3">
              <label className="block">
                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400">売却日</span>
                <input
                  type="date"
                  value={editDraft.sellDate}
                  onChange={(e) => setEditDraft((d) => (d ? { ...d, sellDate: e.target.value, error: '' } : d))}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold text-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400">数量</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editDraft.qtyStr}
                  onChange={(e) => setEditDraft((d) => (d ? { ...d, qtyStr: e.target.value, error: '' } : d))}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400">売却単価（証券の表示単位）</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editDraft.sellPriceStr}
                  onChange={(e) => setEditDraft((d) => (d ? { ...d, sellPriceStr: e.target.value, error: '' } : d))}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400">取得費相当（円）</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editDraft.costStr}
                  onChange={(e) => setEditDraft((d) => (d ? { ...d, costStr: e.target.value, error: '' } : d))}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400">売却金額（円）</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editDraft.proceedsStr}
                  onChange={(e) => setEditDraft((d) => (d ? { ...d, proceedsStr: e.target.value, error: '' } : d))}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100"
                />
              </label>
            </div>
            {editDraft.kind === 'stock' && inferListedCurrency(editDraft.symbol) === 'USD' ? (
              <p className="text-[11px] font-bold tabular-nums text-slate-600 dark:text-slate-300">
                {formatAppliedUsdJpy(editDraft.sellFxRate, editDraft.sellFxDate) || '適用レートを確認しています…'}
              </p>
            ) : null}
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
              {typeof computeSaleProceedsJpy === 'function'
                ? '売却単価・数量・売却日を変更すると、為替を踏まえて売却金額(円)を自動で更新します（必要なら売却金額だけ手で直せます）。'
                : '実現損益は保存時に「売却金額 − 取得費」で再計算されます。'}
            </p>
            {editPreviewPnlJpy != null && Number.isFinite(editPreviewPnlJpy) ? (
              <p className={`text-xs font-black tabular-nums ${signedReturnTextClassStrong(editPreviewPnlJpy)}`}>
                試算 実現損益 {yenSigned(editPreviewPnlJpy)}
              </p>
            ) : null}
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
              保存時も実現損益は「売却金額 − 取得費」で確定します。
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditDraft(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-black text-slate-700 dark:text-slate-200"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={submitEdit}
                className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black shadow-sm"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingDelete ? (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/55 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sellhist-del-title"
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-5 space-y-4"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="sellhist-del-title" className="text-base font-black text-slate-900 dark:text-white">
              売却記録を削除
            </h3>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">
              次の記録を削除しますか？この操作は同期後にデータベースからも消えます。
            </p>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 break-words">{pendingDelete.label}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-black text-slate-700 dark:text-slate-200"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
