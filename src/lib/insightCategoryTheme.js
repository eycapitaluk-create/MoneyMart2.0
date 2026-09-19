/** Insight category → visual theme (article + list cards) */

export function getInsightCategoryLabelFromDocument(doc) {
  const admin = doc?.admin && typeof doc.admin === 'object' ? doc.admin : {}
  const fromAdmin = String(admin.category || '').trim()
  if (fromAdmin) return fromAdmin
  const badge = String(doc?.hero?.badge || '').trim()
  if (badge) return badge.split(/[—\-–]/)[0].trim() || badge
  return 'インサイト'
}

export function normalizeInsightCategoryKey(categoryLabel) {
  const c = String(categoryLabel || '').trim().toLowerCase()
  if (/マーケット|market|相場|市場インサイト/.test(c)) return 'market'
  if (/etf|投資信託/.test(c)) return 'etf'
  return 'editorial'
}

const THEMES = {
  market: {
    key: 'market',
    shortLabel: 'MARKET',
    displayLabel: 'マーケット',
    rootClass: 'bg-slate-100 dark:bg-[#070b14] text-slate-900 dark:text-slate-100',
    pageShellClass: 'bg-slate-100 dark:bg-[#070b14]',
    stickyBarClass: 'border-slate-200/90 dark:border-cyan-900/40 bg-slate-100/90 dark:bg-[#070b14]/90',
    headerBorder: 'border-slate-200/80 dark:border-cyan-900/30',
    headerLightGrid: 'rgba(14,116,144,0.07)',
    headerLightGradient: `
      radial-gradient(ellipse 80% 60% at 85% 8%, rgba(6,182,212,0.14) 0%, transparent 55%),
      radial-gradient(ellipse 60% 50% at 8% 92%, rgba(59,130,246,0.10) 0%, transparent 50%),
      linear-gradient(180deg, #e8eef4 0%, #f1f5f9 100%)
    `,
    headerDarkGradient: `
      radial-gradient(ellipse 75% 55% at 80% 10%, rgba(6,182,212,0.18) 0%, transparent 55%),
      radial-gradient(ellipse 55% 45% at 12% 88%, rgba(37,99,235,0.12) 0%, transparent 50%),
      linear-gradient(180deg, #0c1220 0%, #070b14 100%)
    `,
    headerAccentLine: 'via-cyan-500/60 dark:via-cyan-400/40',
    defaultBgFigure: 'MARKET',
    badgeClass:
      'border-cyan-400/70 dark:border-cyan-500/50 bg-slate-50/95 dark:bg-slate-900/85 text-cyan-800 dark:text-cyan-200',
    badgeDotClass: 'bg-cyan-500',
    subBorderClass: 'border-cyan-500/90 dark:border-cyan-400/70',
    metaBoxClass: 'border-slate-200/90 dark:border-cyan-900/40 bg-slate-50/95 dark:bg-slate-900/80',
    coverWrapClass: 'bg-slate-100 dark:bg-[#070b14] border-slate-200/60 dark:border-cyan-900/30',
    tickerBarClass: 'border-cyan-200/80 dark:border-cyan-900/50 bg-slate-200/90 dark:bg-slate-900/95',
    bodyGradientClass: 'from-slate-50 via-slate-100 to-slate-200/80 dark:from-[#070b14] dark:via-slate-950 dark:to-[#0a1018]',
    kickerClass: 'text-cyan-800/90 dark:text-cyan-300/90',
    kickerLineClass: 'from-cyan-400/60 dark:from-cyan-500/40',
    leadBorderClass: 'border-cyan-400/70 dark:border-cyan-500/50',
    thesisCardClass:
      'border-cyan-200/90 dark:border-cyan-900/50 bg-cyan-50/80 dark:bg-slate-900/85 shadow-[0_16px_40px_-28px_rgba(6,182,212,0.2)]',
    thesisLabelClass: 'text-cyan-800 dark:text-cyan-300',
    evidenceCardClass:
      'border-indigo-200/90 dark:border-indigo-900/50 bg-indigo-50/70 dark:bg-slate-900/85 shadow-[0_16px_40px_-28px_rgba(67,56,202,0.15)]',
    evidenceLabelClass: 'text-indigo-800 dark:text-indigo-300',
    proseCardClass: 'border-slate-200/90 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90',
    calloutInsightClass:
      'bg-slate-50 border-l-[3px] border-cyan-500 shadow-sm border-y border-r border-slate-200/80 rounded-r-xl dark:bg-slate-900 dark:border-slate-700 dark:border-l-cyan-500',
    calloutTitleClass: 'text-cyan-900 dark:text-cyan-200',
    sectionLabelClass: 'text-cyan-800 dark:text-cyan-300',
    keywordChipClass:
      'border-cyan-200/90 dark:border-cyan-800/60 bg-cyan-50/80 dark:bg-slate-800/95 text-slate-800 dark:text-slate-100',
    footerClass: 'border-slate-200 dark:border-cyan-900/30 bg-slate-200/50 dark:bg-slate-900/70',
    footerBrandClass: 'text-cyan-800 dark:text-cyan-300/90',
    listCardClass:
      'border-cyan-200/90 dark:border-cyan-800/45 bg-white dark:bg-slate-900 shadow-sm hover:shadow-lg hover:border-cyan-300/80 dark:hover:border-cyan-600/50',
    listAccentClass: 'from-cyan-500 via-blue-500 to-indigo-500',
    listBadgeClass:
      'border-cyan-300/80 dark:border-cyan-700/60 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-900 dark:text-cyan-200',
    relatedBadgeClass: 'bg-cyan-100/90 dark:bg-cyan-950/50 text-cyan-900 dark:text-cyan-200',
  },
  etf: {
    key: 'etf',
    shortLabel: 'ETF',
    displayLabel: 'ETF分析',
    rootClass: 'bg-[#f6f4ef] dark:bg-slate-950 text-stone-900 dark:text-slate-200',
    pageShellClass: 'bg-[#f6f4ef] dark:bg-slate-950',
    stickyBarClass: 'border-stone-200/90 dark:border-slate-700/90 bg-[#f6f4ef]/90 dark:bg-slate-950/90',
    headerBorder: 'border-stone-200/80 dark:border-slate-800/90',
    headerLightGrid: 'rgba(120,113,108,0.06)',
    headerLightGradient: `
      radial-gradient(ellipse 70% 55% at 75% 12%, rgba(16,185,129,0.10) 0%, transparent 55%),
      radial-gradient(ellipse 55% 45% at 12% 88%, rgba(5,150,105,0.08) 0%, transparent 50%),
      linear-gradient(180deg, #f0ece4 0%, #f6f4ef 100%)
    `,
    headerDarkGradient: `
      radial-gradient(ellipse 70% 55% at 75% 15%, rgba(52,211,153,0.12) 0%, transparent 55%),
      radial-gradient(ellipse 55% 45% at 15% 85%, rgba(16,185,129,0.08) 0%, transparent 50%),
      linear-gradient(180deg, #0f172a 0%, #020617 100%)
    `,
    headerAccentLine: 'via-emerald-500/50 dark:via-emerald-500/30',
    defaultBgFigure: 'ETF',
    badgeClass:
      'border-emerald-300/80 dark:border-emerald-500/40 bg-[#faf8f4]/90 dark:bg-slate-900/80 text-emerald-800 dark:text-emerald-200',
    badgeDotClass: 'bg-emerald-500',
    subBorderClass: 'border-emerald-500/90 dark:border-emerald-500/70',
    metaBoxClass: 'border-stone-200/90 dark:border-slate-600/80 bg-[#faf8f4]/90 dark:bg-slate-900/75',
    coverWrapClass: 'bg-[#faf8f4] dark:bg-slate-950 border-stone-200/60 dark:border-slate-800/80',
    tickerBarClass: 'border-stone-200 dark:border-slate-800 bg-[#eeebe4]/90 dark:bg-slate-900/95',
    bodyGradientClass: 'from-[#faf8f4] via-[#f6f4ef] to-[#f0ece6] dark:from-slate-950 dark:via-slate-950 dark:to-slate-900',
    kickerClass: 'text-emerald-800/90 dark:text-emerald-400/90',
    kickerLineClass: 'from-emerald-400/60 dark:from-emerald-600/40',
    leadBorderClass: 'border-emerald-400/70 dark:border-emerald-600/50',
    thesisCardClass:
      'border-emerald-200/90 dark:border-emerald-900/50 bg-[#eef6f2] dark:bg-slate-900/80 shadow-[0_16px_40px_-28px_rgba(6,78,59,0.2)]',
    thesisLabelClass: 'text-emerald-800 dark:text-emerald-300',
    evidenceCardClass:
      'border-teal-200/90 dark:border-teal-900/50 bg-teal-50/70 dark:bg-slate-900/80 shadow-[0_16px_40px_-28px_rgba(13,148,136,0.15)]',
    evidenceLabelClass: 'text-teal-800 dark:text-teal-300',
    proseCardClass: 'border-stone-200/90 dark:border-slate-700 bg-[#faf8f4] dark:bg-slate-900/90',
    calloutInsightClass:
      'bg-[#faf8f4] border-l-[3px] border-emerald-500 shadow-sm border-y border-r border-stone-200/80 rounded-r-xl dark:bg-slate-900 dark:border-slate-700 dark:border-l-emerald-500',
    calloutTitleClass: 'text-emerald-900 dark:text-emerald-200',
    sectionLabelClass: 'text-emerald-800 dark:text-emerald-300',
    keywordChipClass:
      'border-emerald-200/90 dark:border-emerald-800/60 bg-emerald-50/80 dark:bg-slate-800/95 text-stone-800 dark:text-slate-100',
    footerClass: 'border-stone-200 dark:border-slate-800 bg-[#f0ece6]/50 dark:bg-slate-900/60',
    footerBrandClass: 'text-emerald-900/90 dark:text-emerald-300/90',
    listCardClass:
      'border-emerald-200/90 dark:border-emerald-800/45 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md hover:border-emerald-300/70 dark:hover:border-emerald-700/40',
    listAccentClass: 'from-emerald-500 via-teal-500 to-emerald-600',
    listBadgeClass:
      'border-emerald-300/80 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200',
    relatedBadgeClass: 'bg-emerald-100/90 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200',
  },
  editorial: {
    key: 'editorial',
    shortLabel: 'INSIGHT',
    displayLabel: 'インサイト',
    rootClass: 'bg-[#f6f4ef] dark:bg-slate-950 text-stone-900 dark:text-slate-200',
    pageShellClass: 'bg-[#f6f4ef] dark:bg-slate-950',
    stickyBarClass: 'border-stone-200/90 dark:border-slate-700/90 bg-[#f6f4ef]/90 dark:bg-slate-950/90',
    headerBorder: 'border-stone-200/80 dark:border-slate-800/90',
    headerLightGrid: 'rgba(120,113,108,0.06)',
    headerLightGradient: `
      radial-gradient(ellipse 70% 55% at 75% 12%, rgba(225,29,72,0.09) 0%, transparent 55%),
      radial-gradient(ellipse 55% 45% at 12% 88%, rgba(180,83,9,0.08) 0%, transparent 50%),
      linear-gradient(180deg, #f0ece4 0%, #f6f4ef 100%)
    `,
    headerDarkGradient: `
      radial-gradient(ellipse 70% 55% at 75% 15%, rgba(248,113,113,0.12) 0%, transparent 55%),
      radial-gradient(ellipse 55% 45% at 15% 85%, rgba(251,191,36,0.08) 0%, transparent 50%),
      linear-gradient(180deg, #0f172a 0%, #020617 100%)
    `,
    headerAccentLine: 'via-amber-500/50 dark:via-amber-500/30',
    defaultBgFigure: null,
    badgeClass:
      'border-rose-300/80 dark:border-rose-500/40 bg-[#faf8f4]/90 dark:bg-slate-900/80 text-rose-700 dark:text-rose-300',
    badgeDotClass: 'bg-rose-500',
    subBorderClass: 'border-amber-500/90 dark:border-amber-500/70',
    metaBoxClass: 'border-stone-200/90 dark:border-slate-600/80 bg-[#faf8f4]/90 dark:bg-slate-900/75',
    coverWrapClass: 'bg-[#faf8f4] dark:bg-slate-950 border-stone-200/60 dark:border-slate-800/80',
    tickerBarClass: 'border-stone-200 dark:border-slate-800 bg-[#eeebe4]/90 dark:bg-slate-900/95',
    bodyGradientClass: 'from-[#faf8f4] via-[#f6f4ef] to-[#f0ece6] dark:from-slate-950 dark:via-slate-950 dark:to-slate-900',
    kickerClass: 'text-amber-800/90 dark:text-amber-400/90',
    kickerLineClass: 'from-amber-400/60 dark:from-amber-600/40',
    leadBorderClass: 'border-amber-400/70 dark:border-amber-600/50',
    thesisCardClass:
      'border-emerald-200/90 dark:border-emerald-900/50 bg-[#eef6f2] dark:bg-slate-900/80 shadow-[0_16px_40px_-28px_rgba(6,78,59,0.2)]',
    thesisLabelClass: 'text-emerald-800 dark:text-emerald-300',
    evidenceCardClass:
      'border-sky-200/90 dark:border-sky-900/50 bg-[#eef3f8] dark:bg-slate-900/80 shadow-[0_16px_40px_-28px_rgba(12,74,110,0.15)]',
    evidenceLabelClass: 'text-sky-800 dark:text-sky-300',
    proseCardClass: 'border-stone-200/90 dark:border-slate-700 bg-[#faf8f4] dark:bg-slate-900/90',
    calloutInsightClass:
      'bg-[#faf8f4] border-l-[3px] border-amber-500 shadow-sm border-y border-r border-stone-200/80 rounded-r-xl dark:bg-slate-900 dark:border-slate-700 dark:border-l-amber-500',
    calloutTitleClass: 'text-amber-900 dark:text-amber-200',
    sectionLabelClass: 'text-amber-800 dark:text-amber-300',
    keywordChipClass:
      'border-stone-300/90 dark:border-slate-500 bg-[#ebe6dc]/90 dark:bg-slate-800/95 text-stone-800 dark:text-slate-100',
    footerClass: 'border-stone-200 dark:border-slate-800 bg-[#f0ece6]/50 dark:bg-slate-900/60',
    footerBrandClass: 'text-amber-900/90 dark:text-amber-300/90',
    listCardClass:
      'border-stone-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 shadow-sm hover:shadow-md hover:border-amber-200/70 dark:hover:border-amber-800/40',
    listAccentClass: 'from-amber-500 via-orange-400 to-amber-600',
    listBadgeClass:
      'border-amber-300/80 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200',
    relatedBadgeClass: 'bg-amber-100/90 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200',
  },
}

export function getInsightCategoryTheme(categoryLabel) {
  const key = normalizeInsightCategoryKey(categoryLabel)
  return THEMES[key] || THEMES.editorial
}

export function getInsightCategoryThemeFromDocument(doc) {
  return getInsightCategoryTheme(getInsightCategoryLabelFromDocument(doc))
}
