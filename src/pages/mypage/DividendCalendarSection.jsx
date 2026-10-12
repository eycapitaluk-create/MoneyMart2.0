import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Star, X } from 'lucide-react'
import {
  dividendGrossTotalJpyFromPerShare,
  dividendNetTotalJpyFromPerShare,
  formatDividendCash,
  getAnnualDividendPerShare,
  getDividendCadenceMeta,
  getDividendItemIsNisa,
  getDividendNetCashInNative,
  getDividendYieldPct,
  isLikelyUsdDivStock,
  normalizeDividendStockFlag,
} from '../../lib/dividendCalendar'
import { isHighYieldDetailSymbol } from '../../lib/dividendCalendarDetailLookup'

import VerifiedDividendPayments from '../../components/dividends/VerifiedDividendPayments'

const MONTHS_JP_MP = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"]

/** 配当ウォッチ・モーダルと保有株数の小数桁（MyPage の株式保有と揃える） */
const DIV_SHARE_FRAC_DIGITS = 3
const roundDivShareQty = (raw) => {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 0
  const p = 10 ** DIV_SHARE_FRAC_DIGITS
  return Math.round(n * p) / p
}

const getDividendWatchQty = (item) => {
  const q = Number(item?.qty)
  if (!Number.isFinite(q) || q <= 0) return 10
  const r = roundDivShareQty(q)
  return r > 0 ? r : 10
}

const sanitizeDecimalInputDiv = (raw = '') => {
  const normalized = String(raw)
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xFEE0))
    .replace(/[．。]/g, '.')
    .replace(/,/g, '')
    .replace(/[^\d.]/g, '')
  const firstDot = normalized.indexOf('.')
  if (firstDot === -1) return normalized
  return `${normalized.slice(0, firstDot + 1)}${normalized.slice(firstDot + 1).replace(/\./g, '')}`
}

/** MyPage の株式保有と同じく小数第3位まで（入力中は "0." など中間状態を許す） */
const sanitizeDivQtyDraft = (raw = '') => {
  const normalized = sanitizeDecimalInputDiv(raw)
  if (!normalized) return ''
  const [intPart = '', decimalPart = ''] = normalized.split('.')
  const n = DIV_SHARE_FRAC_DIGITS
  if (normalized.includes('.')) {
    const d = decimalPart.slice(0, n)
    if (d.length === 0 && normalized.endsWith('.')) return `${intPart}.`
    return d.length > 0 ? `${intPart}.${d}` : intPart
  }
  return intPart
}

const DIV_SHARE_QTY_STEP = 0.001

/** 選択月の配当一覧（1ページあたり） */
const DIVIDEND_LIST_PAGE_SIZE = 8

export default function DividendCalendarSection({
  userId, watchlist, loading, saving, status,
  isPaidMember = false,
  onUiMessage = null,
  onOpenPremium = null,
  highlightSignal,
  showAdd, onShowAdd,
  divStockLookupLoading = false,
  editingStockId = null,
  newStockId, newStockName, newStockFlag, newStockSector, newStockPrice, newStockQty, newStockNisa,
  newStockBuyDate = '', newStockBuyPrice = '',
  newDividends,
  onNewStockId, onNewStockName, onNewStockFlag, onNewStockSector, onNewStockPrice, onNewStockQty, onNewStockNisa,
  onNewStockBuyDate, onNewStockBuyPrice,
  onNewDividends,
  onQtyChange, onDelete, onEdit, onAdd,
  detailSuggestions = [],
  onPickDetailSuggestion,
  valuationUsdJpy = 150,
  valuationFxDate = '',
}) {
  const [selMonth, setSelMonth] = useState(new Date().getMonth() + 1)
  const [flashMonth, setFlashMonth] = useState(null)
  const [dividendListPage, setDividendListPage] = useState(1)
  /** number input の即時クランプで "0.5" が打てない問題を避ける（一覧・モーダル共用パターン） */
  const [inlineQtyDraftByStockId, setInlineQtyDraftByStockId] = useState({})
  const [modalQtyDraft, setModalQtyDraft] = useState(null)

  const fxUsdJpy = Number(valuationUsdJpy) > 0 ? Number(valuationUsdJpy) : 150

  useLayoutEffect(() => {
    if (!showAdd) {
      setModalQtyDraft(null)
      return
    }
    const seed = Number(newStockQty)
    const s = Number.isFinite(seed) && seed > 0 ? roundDivShareQty(seed) : 10
    setModalQtyDraft(String(s))
  }, [showAdd, editingStockId])

  useEffect(() => {
    const month = Number(highlightSignal?.month || 0)
    if (!month) return undefined
    setSelMonth(month)
    setFlashMonth(month)
    const timeoutId = window.setTimeout(() => {
      setFlashMonth((prev) => (prev === month ? null : prev))
    }, 1300)
    return () => window.clearTimeout(timeoutId)
  }, [highlightSignal?.token, highlightSignal?.month])

  useEffect(() => {
    setDividendListPage(1)
  }, [selMonth])

  const monthlyEvents = useMemo(() => {
    const map = {}
    for (let m = 1; m <= 12; m++) map[m] = []
    watchlist.forEach((item) => {
      (item.dividends || []).forEach((d) => {
        if (d?.month >= 1 && d?.month <= 12) {
          const amount = Math.max(0, Number(d.amount || 0))
          const qty = getDividendWatchQty(item)
          const totalNative = amount * qty
          const totalJpy = dividendGrossTotalJpyFromPerShare(amount, qty, item, fxUsdJpy)
          const netNative = getDividendNetCashInNative(totalNative, item)
          const netJpy = dividendNetTotalJpyFromPerShare(amount, qty, item, fxUsdJpy)
          map[d.month] = [...(map[d.month] || []), { item, amount, totalNative, totalJpy, netNative, netJpy }]
        }
      })
    })
    return map
  }, [watchlist, fxUsdJpy])

  useEffect(() => {
    setDividendListPage((p) => {
      const n = (monthlyEvents[selMonth] || []).length
      const tp = Math.max(1, Math.ceil(n / DIVIDEND_LIST_PAGE_SIZE))
      return p > tp ? tp : p
    })
  }, [selMonth, monthlyEvents])

  const pagedDividendDetail = useMemo(() => {
    const all = monthlyEvents[selMonth] || []
    const totalPages = Math.max(1, Math.ceil(all.length / DIVIDEND_LIST_PAGE_SIZE))
    const page = Math.min(Math.max(1, dividendListPage), totalPages)
    const start = (page - 1) * DIVIDEND_LIST_PAGE_SIZE
    return {
      all,
      totalPages,
      page,
      items: all.slice(start, start + DIVIDEND_LIST_PAGE_SIZE),
      start,
    }
  }, [monthlyEvents, selMonth, dividendListPage])

  const monthlyTotalsJpy = useMemo(() => Object.fromEntries(
    Object.entries(monthlyEvents).map(([m, evs]) => [m, evs.reduce((s, e) => s + e.totalJpy, 0)]),
  ), [monthlyEvents])
  const monthlyTotalsNetJpy = useMemo(() => Object.fromEntries(
    Object.entries(monthlyEvents).map(([m, evs]) => [m, evs.reduce((s, e) => s + e.netJpy, 0)]),
  ), [monthlyEvents])

  const yearTotalJpy = useMemo(() => (
    Object.values(monthlyTotalsJpy).reduce((a, b) => a + b, 0)
  ), [monthlyTotalsJpy])
  const yearTotalNetJpy = useMemo(() => (
    Object.values(monthlyTotalsNetJpy).reduce((a, b) => a + b, 0)
  ), [monthlyTotalsNetJpy])

  const maxM = Math.max(...Object.values(monthlyTotalsJpy), 1)

  const hasUsdDiv = useMemo(() => watchlist.some(isLikelyUsdDivStock), [watchlist])

  const divHighYield = (item) => {
    const y = getDividendYieldPct(item.price, item.dividends)
    return isHighYieldDetailSymbol(item.stock_id) || (y != null && y >= 4)
  }

  const [stockFilterQuery, setStockFilterQuery] = useState('')
  const filteredWatchlist = useMemo(() => {
    const q = stockFilterQuery.trim().toLowerCase()
    if (!q) return watchlist
    return watchlist.filter((item) => (`${item.stock_id || ''} ${item.stock_name || ''} ${item.sector || ''}`.toLowerCase().includes(q)))
  }, [watchlist, stockFilterQuery])

  const newItemStub = useMemo(() => ({
    flag: newStockFlag,
    stock_id: newStockId,
    sector: newStockSector,
    is_nisa: Boolean(newStockNisa),
  }), [newStockFlag, newStockId, newStockSector, newStockNisa])

  const modalStockQty = useMemo(() => {
    const raw = modalQtyDraft != null ? modalQtyDraft : String(newStockQty ?? 10)
    const n = Number(String(raw).replace(/,/g, ''))
    const r = roundDivShareQty(Number.isFinite(n) ? n : 0)
    return r > 0 ? r : getDividendWatchQty({ qty: newStockQty })
  }, [modalQtyDraft, newStockQty])

  const updateDiv = (idx, field, val) => {
    onNewDividends(prev => prev.map((d, i) => i === idx ? { ...d, [field]: field === 'amount' ? Number(val) : Number(val) } : d))
  }
  const addDivRow = () => onNewDividends(prev => [...prev, { month: 6, amount: 0 }])
  const removeDivRow = (idx) => onNewDividends(prev => prev.filter((_, i) => i !== idx))
  const handleNumericFocus = (e) => {
    if (String(e?.target?.value ?? '').trim() === '0') e.target.select()
  }
  const openPremiumFromLock = () => {
    if (typeof onUiMessage === 'function') {
      onUiMessage('税引後表示はプレミアム限定です。7日無料体験でご利用いただけます。', 'premium')
    }
    if (typeof onOpenPremium === 'function') onOpenPremium()
  }

  return (
    <div className="space-y-4">
      <style>{`
        @keyframes mm-dividend-pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 rgba(34,197,94,0); }
          35% { transform: scale(1.04); box-shadow: 0 0 0 6px rgba(34,197,94,0.12); }
          100% { transform: scale(1); box-shadow: 0 0 0 rgba(34,197,94,0); }
        }
      `}</style>
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">配当カレンダー</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-bold mt-1">保有銘柄の配当スケジュールを管理</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 max-w-2xl leading-relaxed">
            ※ ここから銘柄を削除しても、<strong className="text-slate-600 dark:text-slate-300 font-bold">「株式」タブの保有</strong>（数量・買付）は変わりません。保有を減らす・消す操作は「株式」タブで行ってください。
          </p>
        </div>
        <button
          type="button"
          onClick={() => onShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold shadow transition"
        >
          <Plus size={15} /> 銘柄を追加
        </button>
      </div>

      <VerifiedDividendPayments symbols={watchlist.map(item => item.stock_id)} />

      {status && (
        <p className="text-xs font-bold text-orange-500">{status}</p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm font-bold py-8 justify-center">
          <Loader2 size={18} className="animate-spin" /> 読み込み中…
        </div>
      ) : (
        <>
          {/* 年間サマリー */}
          <div className="flex items-center justify-between bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl px-6 py-4">
            <div>
              <p className="text-xs text-slate-300 font-bold mb-1.5">登録した月別参考額の合計（円換算・税引前）</p>
              <p className="font-mono text-4xl font-black text-green-400">¥{Math.round(yearTotalJpy).toLocaleString('ja-JP')}</p>
              {isPaidMember ? (
                <p className="mt-2 text-sm font-black text-emerald-300">
                  税引後見込み受取額: ¥{Math.round(yearTotalNetJpy).toLocaleString('ja-JP')}
                </p>
              ) : (
                <p className="mt-2 text-xs font-bold text-amber-300">
                  税引後見込み受取額:{' '}
                  <button
                    type="button"
                    onClick={openPremiumFromLock}
                    title="税引後表示はプレミアム限定です"
                    className="inline-flex items-center gap-1 rounded-md border border-amber-300/60 bg-amber-400/10 px-2 py-0.5 text-amber-200 hover:bg-amber-400/20 transition"
                  >
                    <span aria-hidden>🔒</span>
                    プレミアムで確認
                  </button>
                </p>
              )}
              {hasUsdDiv ? (
                <p className="text-xs text-slate-300 font-bold mt-2 leading-relaxed">
                  <span className="text-slate-200">米国株（ドル建て）の配当は、資産タブと同じレートで概算換算しています。</span>
                  <span className="block mt-1.5">1 USD = {fxUsdJpy.toLocaleString('ja-JP', { maximumFractionDigits: 2 })} JPY（適用日: {valuationFxDate?.trim() ? valuationFxDate : '—'}）。実際の入金レート・源泉税・為替差益課税は含みません。</span>
                </p>
              ) : (
                <p className="text-xs text-slate-400 font-bold mt-2">円建て銘柄のみの合計です。</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-300">{watchlist.length}銘柄登録中</p>
              {saving && <p className="text-xs text-orange-300 mt-1 flex items-center gap-1 justify-end"><Loader2 size={12} className="animate-spin"/>保存中</p>}
            </div>
          </div>

          {watchlist.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
              <div className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">現在の選択銘柄</div>
              <div className="flex flex-wrap gap-2">
                {watchlist.map((item) => (
                  <div key={`selected-${item.stock_id}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5">
                    <span className="text-base">{item.flag || '🏳️'}</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-white">{item.stock_name}</span>
                    {divHighYield(item) ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-400/70 bg-amber-500/15 text-amber-800 dark:text-amber-200 dark:border-amber-600 px-1.5 py-0.5 text-[10px] font-black" title="配当利回り4%以上またはマスター高配当リスト">
                        <Star size={11} className="shrink-0 fill-amber-400 text-amber-600 dark:fill-amber-300 dark:text-amber-200" aria-hidden />
                        高配当
                      </span>
                    ) : null}
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold ${getDividendCadenceMeta(item.dividends).className}`}>{getDividendCadenceMeta(item.dividends).label}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{(item.dividends || []).map((d) => `${d.month}月`).join(' / ') || 'なし'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-[1.65fr_1fr] gap-4">
            <div className="space-y-4">
              {/* 月別カレンダーグリッド */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {MONTHS_JP_MP.map((name, i) => {
                    const m = i + 1
                    const totalJpy = monthlyTotalsJpy[m] || 0
                    const hasD = monthlyEvents[m]?.length > 0
                    const isSel = selMonth === m
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSelMonth(m)}
                        className={`min-w-0 w-full rounded-xl p-2 sm:p-2.5 text-center transition border flex flex-col items-stretch overflow-hidden ${isSel ? 'border-green-500 bg-green-50 dark:bg-green-900/30 shadow-md' : hasD ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50'}`}
                        style={flashMonth === m ? { animation: 'mm-dividend-pulse 1.1s ease' } : undefined}
                      >
                        <p className={`shrink-0 text-sm font-bold ${isSel ? 'text-green-600 dark:text-green-400' : hasD ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600'}`}>{name}</p>
                        <div className="h-6 flex min-w-0 items-end justify-center my-1.5">
                          {hasD
                            ? <div className="w-3/4 max-w-full rounded-t" style={{ height: Math.max(3, (totalJpy / maxM) * 18), background: isSel ? '#4ade80' : '#bbf7d0' }} />
                            : <div className="w-3/4 max-w-full h-0.5 bg-slate-100 dark:bg-slate-800 rounded" />}
                        </div>
                        {hasD
                          ? (
                            <p className={`w-full min-w-0 text-center text-xs sm:text-sm font-mono font-black tabular-nums leading-snug break-words [overflow-wrap:anywhere] hyphens-none ${isSel ? 'text-green-600 dark:text-green-400' : 'text-slate-600 dark:text-slate-300'}`}>
                              ¥{Math.round(totalJpy).toLocaleString('ja-JP')}
                            </p>
                          )
                          : <p className="text-xs text-slate-300 dark:text-slate-600">なし</p>}
                      </button>
                    )
                  })}
                </div>
                {hasUsdDiv ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 font-bold leading-relaxed">※ 登録月には過去の権利落ち月・決算月や手入力が含まれ、確定した支払月とは限りません。公式発表の支払日と金額は上の一覧で確認してください。参考額の合計は年間受取額の保証ではありません。</p>
                ) : null}
              </div>

              {/* 選択月の配当詳細 */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3 gap-3">
                  <div>
                    <p className="text-lg font-black text-slate-800 dark:text-white">{MONTHS_JP_MP[selMonth - 1]}の配当</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">選択した銘柄のうち、{MONTHS_JP_MP[selMonth - 1]}に登録された参考項目を表示（公式支払日は上の一覧）</p>
                  </div>
                  {(monthlyTotalsJpy[selMonth] || 0) > 0 && (
                    <p className="font-mono text-xl font-black text-green-500 tabular-nums shrink-0">
                      ¥{Math.round(monthlyTotalsJpy[selMonth]).toLocaleString('ja-JP')}
                    </p>
                  )}
                </div>
                {!pagedDividendDetail.all.length ? (
                  <p className="text-center text-slate-400 dark:text-slate-500 py-8 text-base">この月は配当がありません 📭</p>
                ) : (
                  <div className="space-y-2">
                    {pagedDividendDetail.items.map((ev, i) => (
                      <div
                        key={`${ev.item?.stock_id ?? 'x'}-${pagedDividendDetail.start + i}`}
                        className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(13rem,42%)] items-start gap-3 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-3"
                      >
                        <div className="min-w-0 flex items-start gap-2.5">
                          <span className="text-2xl shrink-0 leading-none">{ev.item.flag || '🏳️'}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-base font-bold text-slate-800 dark:text-white truncate">{ev.item.stock_name}</p>
                              {getDividendItemIsNisa(ev.item) ? (
                                <span className="inline-flex items-center rounded-full border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:text-emerald-300">
                                  NISA
                                </span>
                              ) : null}
                              {divHighYield(ev.item) ? (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-amber-600 dark:text-amber-300" title="高配当">
                                  <Star size={12} className="fill-amber-400 text-amber-600 dark:fill-amber-300 dark:text-amber-200 shrink-0" aria-hidden />
                                </span>
                              ) : null}
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold ${getDividendCadenceMeta(ev.item.dividends).className}`}>{getDividendCadenceMeta(ev.item.dividends).label}</span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{ev.item.sector}</p>
                          </div>
                        </div>
                        <div className="w-full min-w-0 rounded-lg border border-slate-200/80 dark:border-slate-700 bg-white/80 dark:bg-slate-900/70 px-3 py-2">
                          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">税引前配当</p>
                          <p className="font-mono text-xl font-black text-green-500 tabular-nums">{formatDividendCash(ev.totalNative, ev.item)}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                            {isPaidMember ? (
                              <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                                税引後: {formatDividendCash(ev.netNative, ev.item)}
                              </p>
                            ) : (
                              <p className="text-xs font-bold text-amber-600 dark:text-amber-400 shrink-0 flex flex-wrap items-center gap-x-1 gap-y-1">
                                <span>税引後:</span>
                                <button
                                  type="button"
                                  onClick={openPremiumFromLock}
                                  title="税引後表示はプレミアム限定です"
                                  className="inline-flex items-center gap-1 rounded border border-amber-300/70 bg-amber-50 px-1.5 py-0.5 text-amber-700 hover:bg-amber-100 dark:border-amber-700/70 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
                                >
                                  <span aria-hidden>🔒</span>
                                  プレミアム
                                </button>
                              </p>
                            )}
                            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-x-2 gap-y-0.5 text-xs leading-tight">
                              {isLikelyUsdDivStock(ev.item) ? (
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">
                                  ≈ ¥{Math.round(ev.totalJpy).toLocaleString('ja-JP')}（換算）
                                </span>
                              ) : null}
                              {isLikelyUsdDivStock(ev.item) ? (
                                <span className="text-slate-300 dark:text-slate-600 font-bold select-none shrink-0" aria-hidden>
                                  ·
                                </span>
                              ) : null}
                              <span className="text-slate-500 dark:text-slate-400 tabular-nums min-w-0">
                                {formatDividendCash(ev.amount, ev.item)}/株 × {getDividendWatchQty(ev.item)}株
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {pagedDividendDetail.totalPages > 1 ? (
                      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pt-3 mt-1 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                          全{pagedDividendDetail.all.length}件中 {pagedDividendDetail.start + 1}–{pagedDividendDetail.start + pagedDividendDetail.items.length}件
                        </p>
                        <div className="flex items-center justify-center sm:justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={pagedDividendDetail.page <= 1}
                            onClick={() => setDividendListPage((p) => Math.max(1, p - 1))}
                            className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                            aria-label="前のページ"
                          >
                            <ChevronLeft size={16} className="shrink-0" aria-hidden />
                            前へ
                          </button>
                          <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 tabular-nums min-w-[4.5rem] text-center">
                            {pagedDividendDetail.page} / {pagedDividendDetail.totalPages}
                          </span>
                          <button
                            type="button"
                            disabled={pagedDividendDetail.page >= pagedDividendDetail.totalPages}
                            onClick={() => {
                              setDividendListPage((p) => {
                                const n = (monthlyEvents[selMonth] || []).length
                                const tp = Math.max(1, Math.ceil(n / DIVIDEND_LIST_PAGE_SIZE))
                                return Math.min(p + 1, tp)
                              })
                            }}
                            className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                            aria-label="次のページ"
                          >
                            次へ
                            <ChevronRight size={16} className="shrink-0" aria-hidden />
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            {/* 우측 관리 패널 */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 h-fit">
              <p className="text-base font-black text-slate-800 dark:text-white mb-3">銘柄追加 / 株数調整</p>
              <input
                value={stockFilterQuery}
                onChange={(e) => setStockFilterQuery(e.target.value)}
                placeholder="銘柄名 / ティッカー / セクター検索"
                className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-orange-400"
              />
              <div className="mt-3 space-y-2 max-h-[540px] overflow-y-auto pr-1">
                {filteredWatchlist.map((item) => {
                  const yieldPct = getDividendYieldPct(item.price, item.dividends)
                  return (
                    <div key={`panel-${item.stock_id}`} className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 px-3 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-lg">{item.flag || '🏳️'}</span>
                            <p className="text-sm font-black text-slate-800 dark:text-white truncate">{item.stock_name}</p>
                            {divHighYield(item) ? (
                              <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-400/60 bg-amber-500/10 text-[10px] font-black text-amber-700 dark:text-amber-300 px-1.5 py-0.5">
                                <Star size={10} className="fill-amber-400 text-amber-600 shrink-0" aria-hidden />
                                高配当
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.stock_id} · {item.sector || '—'}</p>
                          <div className="mt-1 flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold ${getDividendCadenceMeta(item.dividends).className}`}>{getDividendCadenceMeta(item.dividends).label}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">{(item.dividends || []).map((d) => `${d.month}月`).join(' / ') || 'なし'}</span>
                          </div>
                          <p className="mt-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">予想利回り {yieldPct == null ? '—' : `${yieldPct.toFixed(2)}%`}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDelete(item.stock_id)}
                          className="text-xs font-bold text-red-400 hover:text-red-500 shrink-0"
                        >
                          削除
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onEdit?.(item)}
                          title="登録内容を編集"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800 text-xs font-black text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition"
                        >
                          <Pencil size={12} />
                          編集
                        </button>
                        <button
                          type="button"
                          onClick={() => onQtyChange(item.stock_id, Math.max(DIV_SHARE_QTY_STEP, roundDivShareQty(getDividendWatchQty(item) - DIV_SHARE_QTY_STEP)))}
                          className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                        >−</button>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={inlineQtyDraftByStockId[item.stock_id] ?? String(getDividendWatchQty(item))}
                          onFocus={(e) => {
                            const sid = String(item.stock_id || '').trim()
                            if (!sid) return
                            setInlineQtyDraftByStockId((prev) => ({
                              ...prev,
                              [sid]: String(getDividendWatchQty(item)),
                            }))
                            handleNumericFocus(e)
                          }}
                          onChange={(e) => {
                            const sid = String(item.stock_id || '').trim()
                            if (!sid) return
                            const next = sanitizeDivQtyDraft(e.target.value)
                            setInlineQtyDraftByStockId((prev) => ({ ...prev, [sid]: next }))
                          }}
                          onBlur={() => {
                            const sid = String(item.stock_id || '').trim()
                            if (!sid) return
                            const draft = inlineQtyDraftByStockId[sid]
                            const raw = draft != null ? String(draft).trim().replace(/,/g, '') : ''
                            const n = Number(raw)
                            const r = roundDivShareQty(Number.isFinite(n) ? n : 0)
                            const fallback = getDividendWatchQty(item)
                            const q = r > 0 ? Math.max(DIV_SHARE_QTY_STEP, r) : Math.max(DIV_SHARE_QTY_STEP, fallback)
                            onQtyChange(sid, q)
                            setInlineQtyDraftByStockId((prev) => {
                              const next = { ...prev }
                              delete next[sid]
                              return next
                            })
                          }}
                          className="font-mono text-sm font-bold min-w-[5rem] max-w-[6.5rem] px-1 py-0.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-center text-slate-800 dark:text-white tabular-nums"
                          aria-label={`${item.stock_id} 保有株数`}
                        />
                        <button
                          type="button"
                          onClick={() => onQtyChange(item.stock_id, roundDivShareQty(getDividendWatchQty(item) + DIV_SHARE_QTY_STEP))}
                          className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                        >+</button>
                        <span className="text-xs text-slate-500 dark:text-slate-400">株</span>
                      </div>
                    </div>
                  )
                })}
                {filteredWatchlist.length === 0 && (
                  <p className="text-center text-xs text-slate-400 py-6">検索条件に一致する銘柄がありません</p>
                )}
              </div>
            </div>
          </div>

          {watchlist.length === 0 && !loading && (
            <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center">
              <Calendar size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm font-bold text-slate-400">配当銘柄がまだ登録されていません</p>
              <p className="text-xs text-slate-300 mt-1">「銘柄を追加」から登録してください</p>
            </div>
          )}
        </>
      )}

      {/* 銘柄追加モーダル */}
      {showAdd && (
        <>
          <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm" onClick={() => onShowAdd(false)} />
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 pointer-events-none overflow-y-auto">
            <div className="pointer-events-auto my-auto w-full max-w-2xl max-h-[min(90vh,56rem)] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="flex shrink-0 items-start justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-orange-50 to-white dark:from-slate-900 dark:to-slate-900">
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{editingStockId ? '配当銘柄を編集' : '配当銘柄を追加'}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{editingStockId ? '登録済み銘柄の配当月と配当金を更新できます' : '株式・ETFの銘柄名・コードを入力すると一覧から選べます。マスター反映後は内容をご確認ください。'}</p>
                </div>
                <button type="button" onClick={() => onShowAdd(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"><X size={18} /></button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 space-y-4 bg-slate-50/60 dark:bg-slate-900/40">
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">ティッカー / 証券コード *</label>
                    <div className="relative">
                      <input value={newStockId} onChange={e => onNewStockId(e.target.value)} placeholder="例: 8306, KO, 1306" disabled={Boolean(editingStockId)} autoComplete="off" className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-800 dark:text-white focus:outline-none focus:border-orange-400 disabled:opacity-60 disabled:cursor-not-allowed" />
                      {divStockLookupLoading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-orange-500 font-bold">検索中...</span>}
                    </div>
                    {editingStockId && (
                      <p className="mt-1 text-[10px] text-slate-400">既存銘柄の編集ではティッカーは固定です。</p>
                    )}
                    {!editingStockId ? (
                      <p className="mt-1 text-[10px] text-slate-400">会社名は下の「銘柄名」に英語・日本語どちらでも入力できます（候補はすぐ下に表示）。</p>
                    ) : null}
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">国旗</label>
                    <select value={normalizeDividendStockFlag(newStockFlag, { stock_id: newStockId, sector: newStockSector })} onChange={e => onNewStockFlag(e.target.value)} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-orange-400">
                      <option value="🇯🇵">🇯🇵 日本</option>
                      <option value="🇺🇸">🇺🇸 米国</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">銘柄名 *（英語・日本語可）</label>
                  <input value={newStockName} onChange={e => onNewStockName(e.target.value)} placeholder="例: Apple、三菱UFJ、NEXT FUNDS TOPIX" autoComplete="off" className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-orange-400" />
                  {!editingStockId ? (
                    <p className="mt-1 text-[10px] text-slate-400">株式・ETFはティッカー、または商品名が一致するとコード・配当月・配当金を自動入力します。候補が複数なら下の一覧から選べます。</p>
                  ) : null}
                </div>
                {!editingStockId && Array.isArray(detailSuggestions) && detailSuggestions.length > 0 ? (
                  <div className="rounded-xl border border-orange-200 dark:border-orange-900/50 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                    <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400 px-3 py-2 bg-orange-50/80 dark:bg-orange-950/30 border-b border-orange-100 dark:border-orange-900/40">
                      銘柄候補（コード・英語名・日本語名／部分一致・全角半角 NFKC）
                    </p>
                    <ul className="max-h-52 overflow-y-auto text-left">
                      {detailSuggestions.map((r) => (
                        <li key={r.symbol}>
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 text-xs hover:bg-orange-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                            onClick={() => onPickDetailSuggestion?.(r)}
                          >
                            <span className="font-mono font-black text-slate-900 dark:text-white">{r.symbol}</span>
                            {r.highYield ? (
                              <span className="ml-1.5 inline-flex items-center gap-0.5 text-[9px] font-black text-amber-600 dark:text-amber-400">
                                <Star size={9} className="fill-amber-400 shrink-0" aria-hidden />
                                高配当 {r.yieldPct != null ? `${r.yieldPct}%` : ''}
                              </span>
                            ) : null}
                            <span className="block text-[11px] text-slate-500 truncate">{r.name}</span>
                            {r.category ? (
                              <span className="block text-[10px] text-slate-400">{r.category}</span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">セクター</label>
                    <input value={newStockSector} onChange={e => onNewStockSector(e.target.value)} placeholder="例: 金融, 消費財" className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">現在株価</label>
                    <input type="number" min="0" step="0.01" value={newStockPrice} onFocus={handleNumericFocus} onChange={e => onNewStockPrice(e.target.value === '' ? 0 : Number(e.target.value))} placeholder="例: 2340" className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-800 dark:text-white focus:outline-none focus:border-orange-400" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">保有株数（小数第3位まで）</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={modalQtyDraft ?? String(Number(newStockQty) || 10)}
                      onFocus={handleNumericFocus}
                      onChange={(e) => setModalQtyDraft(sanitizeDivQtyDraft(e.target.value))}
                      onBlur={() => {
                        const raw = String(modalQtyDraft ?? '').trim().replace(/,/g, '')
                        const n = Number(raw)
                        const r = roundDivShareQty(Number.isFinite(n) ? n : 0)
                        const q = r > 0 ? Math.max(DIV_SHARE_QTY_STEP, r) : 10
                        setModalQtyDraft(String(q))
                        onNewStockQty(q)
                      }}
                      className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-800 dark:text-white focus:outline-none focus:border-orange-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">口座区分</label>
                    <button
                      type="button"
                      onClick={() => onNewStockNisa(!newStockNisa)}
                      className={`w-full h-[42px] rounded-lg border px-3 py-2 text-sm font-black transition ${
                        newStockNisa
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {newStockNisa ? 'NISA適用' : '課税口座'}
                    </button>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2">
                    <div className="text-[10px] font-bold text-slate-500">予想年配当利回り</div>
                    <div className="mt-1 font-mono text-sm font-black text-emerald-500">
                      {getDividendYieldPct(newStockPrice, newDividends) == null ? '—' : `${getDividendYieldPct(newStockPrice, newDividends).toFixed(2)}%`}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      年1株あたり配当（合計） {formatDividendCash(getAnnualDividendPerShare(newDividends), newItemStub)}
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-600 text-[10px] font-bold text-slate-500">
                      年間配当受取額（予想・{modalStockQty}株）
                    </div>
                    <div className="mt-0.5 font-mono text-base font-black text-green-600 dark:text-green-400">
                      {formatDividendCash(getAnnualDividendPerShare(newDividends) * modalStockQty, newItemStub)}
                    </div>
                    {isPaidMember ? (
                      <div className="mt-1 text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                        税引後見込み: {formatDividendCash(
                          getDividendNetCashInNative(
                            getAnnualDividendPerShare(newDividends) * modalStockQty,
                            newItemStub,
                          ),
                          newItemStub,
                        )}
                      </div>
                    ) : (
                      <div className="mt-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                        税引後見込み: 🔒 プレミアムで確認
                      </div>
                    )}
                    {isLikelyUsdDivStock(newItemStub) ? (
                      <div className="mt-2 space-y-0.5">
                        <div className="font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">
                          ≈ ¥{dividendGrossTotalJpyFromPerShare(
                            getAnnualDividendPerShare(newDividends),
                            modalStockQty,
                            newItemStub,
                            fxUsdJpy,
                          ).toLocaleString('ja-JP')}
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 font-sans ml-1">（円換算）</span>
                        </div>
                        <p className="text-[9px] text-slate-400 leading-snug">
                          1 USD = {fxUsdJpy.toLocaleString('ja-JP', { maximumFractionDigits: 2 })} JPY（適用日: {valuationFxDate?.trim() ? valuationFxDate : '—'}）。マイページの資産評価と同じ基準レートの概算です。
                        </p>
                      </div>
                    ) : null}
                    <p className="mt-1 text-[9px] text-slate-400 leading-snug">
                      下の表の金額は<strong className="text-slate-500 dark:text-slate-400 font-bold">1株あたり</strong>です（会社の配当は株数に関係なく1株単位で決まります）。株数を変えても1株あたりは変わりません。<strong className="text-slate-500 dark:text-slate-400 font-bold">受け取り総額</strong>だけが上の緑字の「年間〜」や額×株数で増えます。
                    </p>
                  </div>
                </div>
                {!editingStockId && userId && typeof onNewStockBuyDate === 'function' && typeof onNewStockBuyPrice === 'function' ? (
                  <div className="rounded-xl border border-dashed border-orange-200 dark:border-orange-900/50 bg-orange-50/40 dark:bg-orange-950/20 px-3 py-3 space-y-2">
                    <p className="text-[11px] font-black text-slate-800 dark:text-slate-200">資産（株式）に同時登録</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      配当を登録する際に、マイページ「株式」タブの保有へ同時に1ロット分を反映します。未入力の項目は同タブのあとから入力して構いません（任意）。
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 block mb-1">買付日</label>
                        <input
                          type="text"
                          value={newStockBuyDate}
                          onChange={(e) => onNewStockBuyDate(e.target.value)}
                          placeholder="例: 2024-03-15 / 2024年3月15日"
                          autoComplete="off"
                          className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-800 dark:text-white focus:outline-none focus:border-orange-400"
                        />
                        <p className="mt-0.5 text-[9px] text-slate-400">YYYY-MM-DD や 2024/3/15 表記に対応。保存時に日付に正規化します。</p>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 block mb-1">買付価格（1株・税込/税抜はご自身の前提で）</label>
                        <input
                          type="number"
                          min="0"
                          step="0.0001"
                          value={newStockBuyPrice}
                          onFocus={handleNumericFocus}
                          onChange={(e) => onNewStockBuyPrice(e.target.value === '' ? '' : e.target.value)}
                          placeholder="例: 1015 / 1234.5"
                          className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-800 dark:text-white focus:outline-none focus:border-orange-400"
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-bold text-slate-500">配当スケジュール（月・金額）</label>
                    <button type="button" onClick={addDivRow} className="text-[11px] font-bold text-orange-500 hover:text-orange-600 flex items-center gap-1"><Plus size={12}/> 追加</button>
                  </div>
                  <p className="mb-2 text-[10px] text-slate-400">一覧から銘柄を選ぶと月次・金額を自動入力します。各行は<strong className="font-bold text-slate-500 dark:text-slate-400">1株あたり</strong>の配当です。マスターは参照用です。実際の権利落ち・金額は各社の公告をご確認ください。</p>
                  <div className="space-y-2">
                    {newDividends.map((d, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <select value={d.month} onChange={e => updateDiv(idx, 'month', e.target.value)} className="flex-1 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-orange-400">
                          {MONTHS_JP_MP.map((name, i) => <option key={i+1} value={i+1}>{name}</option>)}
                        </select>
                        <div className="flex items-center gap-1 flex-1">
                          <span className="text-xs text-slate-400">{isLikelyUsdDivStock(newItemStub) ? '$' : '¥'}</span>
                          <input type="number" min="0" step="0.01" value={d.amount} onFocus={handleNumericFocus} onChange={e => updateDiv(idx, 'amount', e.target.value)} placeholder="配当金額/株" className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-800 dark:text-white focus:outline-none focus:border-orange-400" />
                        </div>
                        {newDividends.length > 1 && (
                          <button type="button" onClick={() => removeDivRow(idx)} className="text-slate-300 hover:text-red-400 transition"><X size={13}/></button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="shrink-0 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 justify-end bg-white dark:bg-slate-900">
                <button type="button" onClick={() => onShowAdd(false)} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition">キャンセル</button>
                <button
                  type="button"
                  onClick={() => {
                    const raw = String(modalQtyDraft ?? '').trim().replace(/,/g, '')
                    const n = Number(raw)
                    const r = roundDivShareQty(Number.isFinite(n) ? n : 0)
                    const q = r > 0 ? Math.max(DIV_SHARE_QTY_STEP, r) : Math.max(DIV_SHARE_QTY_STEP, getDividendWatchQty({ qty: newStockQty }))
                    onAdd?.({ qty: q })
                  }}
                  disabled={!newStockId.trim() || !newStockName.trim()}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {editingStockId ? '更新して保存' : (userId ? '保存して追加' : '追加（未ログイン）')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {!userId && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-xs font-bold text-amber-700 dark:text-amber-300">
          ※ ログインすると配当カレンダーがクラウドに保存されます
        </div>
      )}
    </div>
  )
}
