import { Link, useNavigate } from 'react-router-dom'
import { Menu, X, LogIn, Sun, Moon, Bell, ShieldCheck, CreditCard, ChevronDown, BookOpen, Newspaper, Sparkles, Wallet, PiggyBank, AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSiteContentNotification } from '../../hooks/useSiteContentNotification'
import { useDividendMonthBellAlerts } from '../../hooks/useDividendMonthBellAlerts'
import { trackAnalyticsEvent } from '../../lib/analytics'
import { acknowledgeDividendBellForCurrentMonth } from '../../lib/dividendBellAck'
import { acknowledgePortfolioDropAlerts } from '../../lib/myPageApi'
import { isPaidPlanTier } from '../../lib/membership'

export default function Navbar({
  darkMode,
  onToggleDarkMode,
  session = null,
  authReady = false,
  userProfile = null,
  alertSummary = {
    insuranceExpiringSoon: 0,
    pointExpiringSoonCount: 0,
    budgetOver80Pct: false,
    portfolioDropAlertCount: 0,
  },
}) {
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showAlertPanel, setShowAlertPanel] = useState(false)
  const [isMobileProductsOpen, setIsMobileProductsOpen] = useState(false)
  const [showMobileAlertPanel, setShowMobileAlertPanel] = useState(false)
  const dividendMonthAlerts = useDividendMonthBellAlerts(session)
  const planTier = String(
    userProfile?.planTier
    || userProfile?.plan_tier
    || userProfile?.membership_tier
    || '',
  ).toLowerCase()
  const isPremium = Boolean(session && isPaidPlanTier(planTier))
  const dividendMonthAlertsForView = isPremium ? dividendMonthAlerts : []
  const dividendMonthAlertCount = session ? dividendMonthAlertsForView.length : 0
  const mypageAlertCount =
    (alertSummary?.insuranceExpiringSoon || 0)
    + (alertSummary?.pointExpiringSoonCount || 0)
    + (session && alertSummary?.budgetOver80Pct ? 1 : 0)
    + (session ? Math.max(0, Number(alertSummary?.portfolioDropAlertCount || 0)) : 0)
  const alertCount = mypageAlertCount + dividendMonthAlertCount

  const {
    siteContentActive,
    insightNew,
    newsNew,
    insightLatest,
    newsLatest,
    acknowledgeInsight,
    acknowledgeNews,
    acknowledgeAllSiteContent,
  } = useSiteContentNotification(session?.user?.id ?? null)

  const hasSiteNotify = insightNew || newsNew
  const hasMypageAlerts = Boolean(session && mypageAlertCount > 0)
  const hasDividendMonthAlerts = Boolean(session && dividendMonthAlertCount > 0)
  const notifyPanelEmpty = !hasSiteNotify && !hasMypageAlerts && !hasDividendMonthAlerts

  const closeNotifyPanels = () => {
    setShowAlertPanel(false)
    setShowMobileAlertPanel(false)
  }

  /** /tools 内でサブツール表示中はパスが変わらないため、同じ「ツール」Link では Router が遷移しない → ハブを一覧に戻す */
  const notifyToolsHubReset = () => {
    window.dispatchEvent(new CustomEvent('mm-tools-hub-reset'))
  }

  const goInsightFromNotify = () => {
    acknowledgeInsight()
    trackAnalyticsEvent('site_content_notify_open', { channel: 'insight' })
    const slug = insightLatest?.slug
    const path = slug ? `/insights/${encodeURIComponent(slug)}` : '/insights'
    navigate(path)
    closeNotifyPanels()
  }

  const goNewsFromNotify = () => {
    const kind = newsLatest?.kind
    const newsId = newsLatest?.newsId
    acknowledgeNews()
    trackAnalyticsEvent('site_content_notify_open', { channel: 'news', news_kind: kind || '' })
    if (kind === 'manual' && newsId) navigate(`/news?mn=${encodeURIComponent(newsId)}`)
    else if (kind === 'ai' && newsId) navigate(`/news?an=${encodeURIComponent(newsId)}`)
    else navigate('/news')
    closeNotifyPanels()
  }

  const productCategories = [
    { name: '預金・貯金', id: 'savings' },
    { name: 'ローン', id: 'loans' },
    { name: 'クレジットカード', id: 'cards' },
    { name: 'ポイント', id: 'points' },
    { name: '旅行保険', id: 'insurance' },
  ]

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsMobileMenuOpen(false)
    setShowMobileAlertPanel(false)
    navigate('/')
  }

  return (
    <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-[90] font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* 1. ロゴ & メインメニュー */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex-shrink-0 flex items-center gap-1.5">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 text-white text-2xl font-black leading-none flex items-center justify-center">
                M
              </span>
              <div className="flex flex-col items-center text-center">
                <span className="text-xl font-black text-orange-500 tracking-tight leading-tight">MoneyMart</span>
                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400 leading-tight">My Money, My Future</span>
              </div>
            </Link>

            {/* デスクトップメニュー（左） */}
            <div className="hidden md:flex items-center gap-6 text-sm font-bold text-slate-600 dark:text-slate-300">
              <Link to="/market" className="hover:text-orange-500 transition">マーケット</Link>
              <Link to="/stocks" className="hover:text-orange-500 transition">株式</Link>
              <Link to="/funds" className="hover:text-orange-500 transition">ファンド</Link>
              <Link to="/products" className="hover:text-orange-500 transition">金融商品</Link>
              <Link to="/news" className="hover:text-orange-500 transition">ニュース</Link>
              <Link to="/tools" onClick={notifyToolsHubReset} className="hover:text-orange-500 transition">ツール</Link>
              <Link
                to="/premium"
                className="hover:text-amber-600 dark:hover:text-amber-400 transition inline-flex items-center gap-1 text-amber-700 dark:text-amber-300"
              >
                <Sparkles size={14} className="shrink-0" aria-hidden />
                プレミアム
              </Link>

            </div>
          </div>

          {/* 2. 右側メニュー */}
          <div className="hidden md:flex items-center gap-4">
            <Link to="/insights" className="text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">インサイト</Link>
            {session ? (
              <Link to="/mypage" className="text-sm font-bold text-slate-500 hover:text-orange-500 dark:text-slate-400 dark:hover:text-orange-500 transition">
                マイページ
              </Link>
            ) : null}

            <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-2" />

            <button
              onClick={onToggleDarkMode}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {!authReady ? (
              <div className="h-9 w-28 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
            ) : (
              <>
                <div className="relative flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowAlertPanel((v) => !v)}
                    className={`relative p-2 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition ${siteContentActive ? 'mm-bell-site-pulse text-red-600 dark:text-red-400' : ''}`}
                    title="通知"
                    aria-label="通知"
                  >
                    <Bell size={20} className={siteContentActive ? 'relative z-[1]' : ''} />
                    {alertCount > 0 ? (
                      <span className="absolute top-0 right-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-black z-[2]">
                        {alertCount > 99 ? '99+' : alertCount}
                      </span>
                    ) : siteContentActive ? (
                      <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900 z-[2]" aria-hidden />
                    ) : null}
                  </button>
                  {showAlertPanel ? (
                    <>
                      <div className="fixed inset-0 z-[95]" aria-hidden onClick={() => setShowAlertPanel(false)} />
                      <div className="absolute right-0 top-full mt-1 z-[100] w-[320px] max-h-[min(420px,70vh)] overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-3">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">通知</p>
                        {notifyPanelEmpty ? (
                          <p className="text-xs text-slate-400 py-2">通知はありません。</p>
                        ) : (
                          <ul className="space-y-1.5 text-left">
                            {insightNew && insightLatest ? (
                              <li>
                                <button
                                  type="button"
                                  onClick={goInsightFromNotify}
                                  className="flex items-start gap-2 w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-200"
                                >
                                  <BookOpen size={14} className="text-amber-600 shrink-0 mt-0.5" aria-hidden />
                                  <span>
                                    <span className="font-bold block">インサイトに新着</span>
                                    {insightLatest.headline ? (
                                      <span className="text-slate-500 dark:text-slate-400 line-clamp-2">{insightLatest.headline}</span>
                                    ) : null}
                                  </span>
                                </button>
                              </li>
                            ) : null}
                            {newsNew && newsLatest ? (
                              <li>
                                <button
                                  type="button"
                                  onClick={goNewsFromNotify}
                                  className="flex items-start gap-2 w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-200"
                                >
                                  <Newspaper size={14} className="text-orange-600 shrink-0 mt-0.5" aria-hidden />
                                  <span>
                                    <span className="font-bold block">ニュースに新着</span>
                                    {newsLatest.headline ? (
                                      <span className="text-slate-500 dark:text-slate-400 line-clamp-2">{newsLatest.headline}</span>
                                    ) : null}
                                  </span>
                                </button>
                              </li>
                            ) : null}
                            {hasSiteNotify ? (
                              <li className="pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    acknowledgeAllSiteContent()
                                    setShowAlertPanel(false)
                                  }}
                                  className="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-2"
                                >
                                  新着をすべて既読にする
                                </button>
                              </li>
                            ) : null}
                            {hasSiteNotify && (hasMypageAlerts || hasDividendMonthAlerts) ? (
                              <li className="list-none my-2 border-t border-slate-100 dark:border-slate-800 pt-0" role="separator" aria-hidden />
                            ) : null}
                            {(alertSummary?.insuranceExpiringSoon || 0) > 0 && session ? (
                              <li>
                                <button
                                  type="button"
                                  onClick={() => { navigate('/mypage?tab=wealth'); setShowAlertPanel(false); }}
                                  className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-200"
                                >
                                  <ShieldCheck size={12} className="text-amber-500 shrink-0" />
                                  保険が30日以内に満期：{alertSummary.insuranceExpiringSoon}件
                                </button>
                              </li>
                            ) : null}
                            {(alertSummary?.pointExpiringSoonCount || 0) > 0 && session ? (
                              <li>
                                <button
                                  type="button"
                                  onClick={() => { navigate('/mypage?tab=point'); setShowAlertPanel(false); }}
                                  className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-200"
                                >
                                  <CreditCard size={12} className="text-amber-500 shrink-0" />
                                  カード・ポイントが30日以内に期限：{alertSummary.pointExpiringSoonCount}件
                                </button>
                              </li>
                            ) : null}
                            {session && alertSummary?.budgetOver80Pct ? (
                              <li>
                                <button
                                  type="button"
                                  onClick={() => { navigate('/mypage?tab=point'); setShowAlertPanel(false); }}
                                  className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-bold text-red-700 dark:text-red-300"
                                >
                                  <Wallet size={12} className="text-red-500 shrink-0" />
                                  今月の予算の80%に達しました
                                </button>
                              </li>
                            ) : null}
                            {(alertSummary?.portfolioDropAlertCount || 0) > 0 && session ? (
                              <li>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (session?.user?.id) {
                                      acknowledgePortfolioDropAlerts({ userId: session.user.id }).catch(() => {})
                                      window.dispatchEvent(new CustomEvent('mm-portfolio-alert-refresh'))
                                    }
                                    navigate('/mypage?tab=wealth')
                                    setShowAlertPanel(false)
                                  }}
                                  className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-bold text-red-700 dark:text-red-300"
                                >
                                  <AlertTriangle size={12} className="text-red-500 shrink-0" />
                                  ポートフォリオアラート：{alertSummary.portfolioDropAlertCount}件
                                </button>
                              </li>
                            ) : null}
                            {hasMypageAlerts && hasDividendMonthAlerts ? (
                              <li className="list-none my-2 border-t border-slate-100 dark:border-slate-800 pt-0" role="separator" aria-hidden />
                            ) : null}
                            {hasDividendMonthAlerts ? (
                              <li>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (session?.user?.id) acknowledgeDividendBellForCurrentMonth(session.user.id)
                                    navigate('/mypage?tab=dividend')
                                    setShowAlertPanel(false)
                                  }}
                                  className="flex items-start gap-2 w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-200"
                                >
                                  <PiggyBank size={14} className="text-emerald-600 shrink-0 mt-0.5" aria-hidden />
                                  <span>
                                    <span className="font-bold block">
                                      {isPremium && dividendMonthAlertsForView.find((a) => a.stock_id === '__MONTH_NET_SUMMARY__')
                                        ? dividendMonthAlertsForView.find((a) => a.stock_id === '__MONTH_NET_SUMMARY__')?.title
                                        : `今月は配当予定月（ウォッチ ${dividendMonthAlertCount}）`}
                                    </span>
                                    <span className="text-slate-500 dark:text-slate-400 line-clamp-4">
                                      {dividendMonthAlertsForView
                                        .filter((a) => a.stock_id !== '__MONTH_NET_SUMMARY__')
                                        .map((a) => `${a.title} が今月配当します。`)
                                        .join('、')}
                                    </span>
                                  </span>
                                </button>
                              </li>
                            ) : null}
                          </ul>
                        )}
                      </div>
                    </>
                  ) : null}
                </div>
                {session ? (
                  <button
                    onClick={handleLogout}
                    className="bg-slate-900 hover:bg-black dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white px-5 py-2 rounded-full text-sm font-bold transition shadow-lg flex items-center gap-2"
                  >
                    ログアウト
                  </button>
                ) : (
                  <button
                    onClick={() => navigate('/login', { state: { from: `${window.location.pathname}${window.location.search}` } })}
                    className="bg-slate-900 hover:bg-black dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white px-5 py-2 rounded-full text-sm font-bold transition shadow-lg flex items-center gap-2"
                  >
                    <LogIn size={16} /> ログイン
                  </button>
                )}
              </>
            )}
          </div>

          {/* モバイルメニューボタン */}
          <div className="flex md:hidden items-center gap-2">
            {authReady ? (
              <button
                type="button"
                onClick={() => setShowMobileAlertPanel((v) => !v)}
                className={`relative p-2 rounded-full text-slate-600 dark:text-white ${siteContentActive ? 'mm-bell-site-pulse text-red-600 dark:text-red-400' : ''}`}
                aria-label="通知"
              >
                <Bell size={20} className={siteContentActive ? 'relative z-[1]' : ''} />
                {alertCount > 0 ? (
                  <span className="absolute top-0 right-0 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-black px-1 z-[2]">
                    {alertCount > 99 ? '99+' : alertCount}
                  </span>
                ) : siteContentActive ? (
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900 z-[2]" aria-hidden />
                ) : null}
              </button>
            ) : null}
            <button
              onClick={onToggleDarkMode}
              className="p-2 text-slate-600 dark:text-white"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-slate-600 dark:text-white p-2"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {showMobileAlertPanel && authReady ? (
        <div className="md:hidden border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">通知</p>
            {notifyPanelEmpty ? (
              <p className="text-xs text-slate-400">通知はありません。</p>
            ) : (
              <ul className="space-y-1.5 text-left">
                {insightNew && insightLatest ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        goInsightFromNotify()
                        setIsMobileMenuOpen(false)
                      }}
                      className="flex items-start gap-2 w-full text-left px-2 py-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-200"
                    >
                      <BookOpen size={14} className="text-amber-600 shrink-0 mt-0.5" aria-hidden />
                      <span>
                        <span className="font-bold block">インサイトに新着</span>
                        {insightLatest.headline ? (
                          <span className="text-slate-500 dark:text-slate-400 line-clamp-2">{insightLatest.headline}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ) : null}
                {newsNew && newsLatest ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        goNewsFromNotify()
                        setIsMobileMenuOpen(false)
                      }}
                      className="flex items-start gap-2 w-full text-left px-2 py-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-200"
                    >
                      <Newspaper size={14} className="text-orange-600 shrink-0 mt-0.5" aria-hidden />
                      <span>
                        <span className="font-bold block">ニュースに新着</span>
                        {newsLatest.headline ? (
                          <span className="text-slate-500 dark:text-slate-400 line-clamp-2">{newsLatest.headline}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ) : null}
                {hasSiteNotify ? (
                  <li className="pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        acknowledgeAllSiteContent()
                        setShowMobileAlertPanel(false)
                      }}
                      className="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-2"
                    >
                      新着をすべて既読にする
                    </button>
                  </li>
                ) : null}
                {hasSiteNotify && (hasMypageAlerts || hasDividendMonthAlerts) ? (
                  <li className="list-none my-1 border-t border-slate-200 dark:border-slate-600 pt-1" role="separator" />
                ) : null}
                {(alertSummary?.insuranceExpiringSoon || 0) > 0 && session ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        navigate('/mypage?tab=wealth')
                        setShowMobileAlertPanel(false)
                        setIsMobileMenuOpen(false)
                      }}
                      className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-200"
                    >
                      <ShieldCheck size={12} className="text-amber-500 shrink-0" />
                      保険が30日以内に満期：{alertSummary.insuranceExpiringSoon}件
                    </button>
                  </li>
                ) : null}
                {(alertSummary?.pointExpiringSoonCount || 0) > 0 && session ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        navigate('/mypage?tab=point')
                        setShowMobileAlertPanel(false)
                        setIsMobileMenuOpen(false)
                      }}
                      className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-200"
                    >
                      <CreditCard size={12} className="text-amber-500 shrink-0" />
                      カード・ポイントが30日以内に期限：{alertSummary.pointExpiringSoonCount}件
                    </button>
                  </li>
                ) : null}
                {session && alertSummary?.budgetOver80Pct ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        navigate('/mypage?tab=point')
                        setShowMobileAlertPanel(false)
                        setIsMobileMenuOpen(false)
                      }}
                      className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-xs font-bold text-red-700 dark:text-red-300"
                    >
                      <Wallet size={12} className="text-red-500 shrink-0" />
                      今月の予算の80%に達しました
                    </button>
                  </li>
                ) : null}
                {(alertSummary?.portfolioDropAlertCount || 0) > 0 && session ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        if (session?.user?.id) {
                          acknowledgePortfolioDropAlerts({ userId: session.user.id }).catch(() => {})
                          window.dispatchEvent(new CustomEvent('mm-portfolio-alert-refresh'))
                        }
                        navigate('/mypage?tab=wealth')
                        setShowMobileAlertPanel(false)
                        setIsMobileMenuOpen(false)
                      }}
                      className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-xs font-bold text-red-700 dark:text-red-300"
                    >
                      <AlertTriangle size={12} className="text-red-500 shrink-0" />
                      ポートフォリオアラート：{alertSummary.portfolioDropAlertCount}件
                    </button>
                  </li>
                ) : null}
                {hasMypageAlerts && hasDividendMonthAlerts ? (
                  <li className="list-none my-1 border-t border-slate-200 dark:border-slate-600 pt-1" role="separator" />
                ) : null}
                {hasDividendMonthAlerts ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        if (session?.user?.id) acknowledgeDividendBellForCurrentMonth(session.user.id)
                        navigate('/mypage?tab=dividend')
                        setShowMobileAlertPanel(false)
                        setIsMobileMenuOpen(false)
                      }}
                      className="flex items-start gap-2 w-full text-left px-2 py-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-200"
                    >
                      <PiggyBank size={14} className="text-emerald-600 shrink-0 mt-0.5" aria-hidden />
                      <span>
                        <span className="font-bold block">
                          {isPremium && dividendMonthAlertsForView.find((a) => a.stock_id === '__MONTH_NET_SUMMARY__')
                            ? dividendMonthAlertsForView.find((a) => a.stock_id === '__MONTH_NET_SUMMARY__')?.title
                            : `今月は配当予定月（ウォッチ ${dividendMonthAlertCount}）`}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 line-clamp-4">
                          {dividendMonthAlertsForView
                            .filter((a) => a.stock_id !== '__MONTH_NET_SUMMARY__')
                            .map((a) => `${a.title} が今月配当します。`)
                            .join('、')}
                        </span>
                      </span>
                    </button>
                  </li>
                ) : null}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {/* モバイルメニュー */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 p-4 pb-28 space-y-4 shadow-xl">
          <Link to="/market" onClick={() => setIsMobileMenuOpen(false)} className="block font-bold text-lg text-slate-900 dark:text-slate-100">マーケット</Link>
          <Link to="/stocks" onClick={() => setIsMobileMenuOpen(false)} className="block font-bold text-lg text-slate-900 dark:text-slate-100">株式</Link>
          <Link to="/funds" onClick={() => setIsMobileMenuOpen(false)} className="block font-bold text-lg text-slate-900 dark:text-slate-100">ファンド</Link>
          <Link to="/news" onClick={() => setIsMobileMenuOpen(false)} className="block font-bold text-lg text-slate-900 dark:text-slate-100">ニュース</Link>
          <Link to="/tools" onClick={() => { notifyToolsHubReset(); setIsMobileMenuOpen(false) }} className="block font-bold text-lg text-slate-900 dark:text-slate-100">ツール</Link>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setIsMobileProductsOpen((v) => !v)}
              className="w-full flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2"
            >
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">金融商品</span>
              <ChevronDown
                size={16}
                className={`text-slate-500 transition-transform ${isMobileProductsOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {isMobileProductsOpen ? (
              <div className="space-y-2 pl-4 border-l-2 border-slate-100 dark:border-slate-700">
                {productCategories.map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/products?category=${cat.id}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block text-base font-bold text-slate-900 dark:text-slate-100 py-1"
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3">
            {authReady && session ? (
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-slate-200">通知</span>
                {alertCount > 0 ? (
                  <span className="rounded-full bg-amber-500 text-white text-xs font-black px-2 py-0.5">{alertCount}</span>
                ) : null}
              </div>
            ) : null}
            <Link to="/insights" onClick={() => setIsMobileMenuOpen(false)} className="block font-bold text-slate-900 dark:text-slate-100">インサイト</Link>
            {authReady && session ? (
              <Link to="/mypage" onClick={() => setIsMobileMenuOpen(false)} className="block font-bold text-orange-500">マイページ</Link>
            ) : null}
            <Link to="/premium" onClick={() => setIsMobileMenuOpen(false)} className="block font-bold text-amber-600 dark:text-amber-400">プレミアム</Link>
            {!authReady ? (
              <div className="w-full h-12 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
            ) : session ? (
              <button
                onClick={handleLogout}
                className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                ログアウト
              </button>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => { navigate('/login', { state: { from: `${window.location.pathname}${window.location.search}` } }); setIsMobileMenuOpen(false); }}
                  className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <LogIn size={20} /> ログイン
                </button>
                <button
                  onClick={() => { navigate('/signup', { state: { from: `${window.location.pathname}${window.location.search}` } }); setIsMobileMenuOpen(false); }}
                  className="w-full border border-orange-400 text-orange-600 dark:text-orange-300 py-3 rounded-xl font-bold bg-white dark:bg-slate-900"
                >
                  無料会員登録
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
