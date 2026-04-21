import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, RefreshCw, ArrowRight } from 'lucide-react'
import { ETF_LIST_FROM_XLSX } from '../data/etfListFromXlsx'
import { normalizeFundDisplayName } from '../lib/fundDisplayUtils'

const FALLBACK_FUNDS = ETF_LIST_FROM_XLSX.filter((item) => item?.symbol && item?.jpName)

const pickRandomFund = (excludeSymbol) => {
  const pool = excludeSymbol
    ? FALLBACK_FUNDS.filter((item) => item.symbol !== excludeSymbol)
    : FALLBACK_FUNDS
  if (!pool.length) return null
  return pool[Math.floor(Math.random() * pool.length)] || pool[0]
}

const getFundCountry = (fund) => (String(fund?.symbol || '').endsWith('.T') ? '日本' : '米国')

const getFundCategory = (fund) => {
  const name = String(fund?.jpName || '').toUpperCase()
  if (name.includes('全世界') || name.includes('GLOBAL') || name.includes('ACWI')) return '全世界株式'
  if (name.includes('米国') || name.includes('S&P') || name.includes('NASDAQ')) return '米国株式'
  if (name.includes('先進国')) return '先進国株式'
  if (name.includes('新興国') || name.includes('中国') || name.includes('INDIA')) return '新興国株式'
  if (name.includes('TOPIX') || name.includes('日経') || name.includes('日本')) return '国内株式'
  if (name.includes('ＲＥＩＴ') || name.includes('REIT') || name.includes('リート')) return 'REIT'
  if (name.includes('債券') || name.includes('BOND')) return '債券'
  if (name.includes('金') || name.includes('GOLD') || name.includes('原油') || name.includes('COMMODITY')) return 'コモディティ'
  if (name.includes('高配当') || name.includes('DIVIDEND')) return '高配当'
  if (name.includes('半導体') || name.includes('TECH')) return 'テクノロジー'
  return 'ETF'
}

export default function AdBanner({ variant = 'horizontal', className = '' }) {
  const isHorizontal = variant === 'horizontal'
  const isCompact = variant === 'compact'
  const isVertical = variant === 'vertical'
  const [fund, setFund] = useState(() => pickRandomFund())

  useEffect(() => {
    if (!fund) {
      setFund(pickRandomFund())
      return undefined
    }
    const timer = window.setInterval(() => {
      setFund((current) => pickRandomFund(current?.symbol))
    }, 12000)
    return () => window.clearInterval(timer)
  }, [fund])

  if (!fund) return null

  const countryLabel = getFundCountry(fund)
  const categoryLabel = getFundCategory(fund)

  return (
    <div
      className={`rounded-2xl overflow-hidden border border-orange-200/70 dark:border-orange-900/40 bg-gradient-to-br from-orange-50 via-amber-50 to-white dark:from-slate-900 dark:via-orange-950/20 dark:to-slate-900 ${className}`}
      aria-label="広告"
    >
      <div
        className={`flex ${
          isCompact ? 'flex-col p-3 gap-3' : isVertical ? 'flex-col p-4 gap-4' : 'flex-row p-4 gap-4'
        }`}
      >
        <div
          className={`shrink-0 ${
            isCompact ? 'w-full h-20' : isVertical ? 'w-full h-24' : 'w-24 h-24'
          } rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 text-white flex flex-col items-center justify-center shadow-lg shadow-orange-500/20`}
        >
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Ad</span>
          <Sparkles size={isCompact ? 18 : 22} className="mt-1" />
          <span className="mt-1 text-xs font-black">{countryLabel}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-black text-orange-500 dark:text-orange-300 uppercase tracking-[0.22em]">
              Picked From Our Funds
            </p>
            <button
              type="button"
              onClick={() => setFund((current) => pickRandomFund(current?.symbol))}
              className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-white/80 px-2 py-1 text-[10px] font-bold text-orange-600 transition hover:border-orange-300 hover:text-orange-700 dark:border-orange-800/70 dark:bg-slate-900/70 dark:text-orange-300"
              aria-label="別のファンドを表示"
            >
              <RefreshCw size={12} />
              ランダム
            </button>
          </div>
          <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100 line-clamp-2">
            {normalizeFundDisplayName(fund.jpName)}
          </p>
          <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
            実際の掲載ファンドからランダム表示中
          </p>
          <div className={`mt-3 grid ${isCompact ? 'grid-cols-2' : 'grid-cols-3'} gap-2`}>
            <div className="rounded-xl bg-white/85 dark:bg-slate-900/80 px-3 py-2 border border-orange-100 dark:border-slate-800">
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Category</p>
              <p className="text-xs font-black text-slate-900 dark:text-white">{categoryLabel}</p>
            </div>
            <div className="rounded-xl bg-white/85 dark:bg-slate-900/80 px-3 py-2 border border-orange-100 dark:border-slate-800">
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Country</p>
              <p className="text-xs font-black text-sky-600 dark:text-sky-300">{countryLabel}</p>
            </div>
            {!isCompact && (
              <div className="rounded-xl bg-white/85 dark:bg-slate-900/80 px-3 py-2 border border-orange-100 dark:border-slate-800">
                <p className="text-[10px] text-slate-500 dark:text-slate-400">NISA</p>
                <p className="text-xs font-black text-emerald-600 dark:text-emerald-300">{fund.nisaCategory || '-'}</p>
              </div>
            )}
          </div>
          <Link
            to={`/funds/${encodeURIComponent(fund.symbol)}`}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-xs font-black text-white shadow-md shadow-orange-500/20 transition hover:bg-orange-600"
          >
            このファンドを見る
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  )
}
