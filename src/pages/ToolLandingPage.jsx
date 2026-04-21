import { Link, useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { SITE_ORIGIN } from '../lib/seoConfig'
import { MM_SIMULATION_PAST_PERFORMANCE_JA } from '../lib/moneymartSimulationDisclaimer'

export default function ToolLandingPage({
  title = '',
  subtitle = '',
  description = '',
  ctaLabel = 'ツールを開く',
  ctaTo = '/',
  secondaryLabel = 'ホームへ',
  secondaryTo = '/',
}) {
  const location = useLocation()
  const path = location?.pathname || '/'
  const canonical = `${SITE_ORIGIN}${path}`
  const metaDescription = String(description || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
  const pageTitle = title ? `${title} | MoneyMart` : 'MoneyMart'
  const loginTo = (() => {
    if (ctaTo !== '/login') return ctaTo
    return '/login'
  })()
  const loginState = ctaTo === '/login'
    ? { from: `${location.pathname || '/'}${location.search || ''}` }
    : undefined

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDescription || 'MoneyMart の無料ツール。ログイン後はマイページで本機能を利用できます。'} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={metaDescription || 'MoneyMart ツール'} />
        <meta property="og:url" content={canonical} />
      </Helmet>
      <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6 md:p-8">
          {subtitle ? (
            <p className="text-[11px] font-black tracking-[0.16em] text-orange-500">{subtitle}</p>
          ) : null}
          <h1 className="mt-2 text-3xl md:text-4xl font-black text-slate-900 dark:text-white leading-tight">{title}</h1>
          <p className="mt-4 text-sm md:text-base leading-relaxed text-slate-600 dark:text-slate-300">{description}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to={loginTo}
              state={loginState}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-black transition"
            >
              {ctaLabel}
            </Link>
            <Link
              to={secondaryTo}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-black hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {secondaryLabel}
            </Link>
          </div>
          <p className="mt-6 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{MM_SIMULATION_PAST_PERFORMANCE_JA}</p>
        </div>
      </div>
    </div>
  )
}

