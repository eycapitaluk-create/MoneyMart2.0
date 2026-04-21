import { Fragment, useEffect, useRef } from 'react'
import { isEmptyInsightBodyHtml, looksLikeInsightHtml, sanitizeInsightBodyHtml } from '../../lib/insightHtml'
import InsightToolPill from './InsightToolPill'

const accentTitle = (accent) => {
  if (accent === 'gold') return 'text-amber-700 dark:text-amber-300'
  if (accent === 'rose') return 'text-rose-600 dark:text-rose-400'
  return 'text-stone-900 dark:text-slate-100'
}

const statTone = (tone) => {
  if (tone === 'up') return 'text-rose-600 dark:text-rose-400'
  if (tone === 'down') return 'text-blue-600 dark:text-blue-400'
  return 'text-stone-900 dark:text-slate-100'
}

const cardTopBar = (variant) => {
  const map = {
    gold: 'from-amber-500 to-transparent',
    energy: 'from-rose-500 to-transparent',
    commodity: 'from-sky-500 to-transparent',
    defense: 'from-violet-500 to-transparent',
    realestate: 'from-emerald-500 to-transparent',
  }
  return map[variant] || 'from-amber-400 to-transparent'
}

const cardTagClass = (variant) => {
  const map = {
    gold: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
    energy: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
    commodity: 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200',
    defense: 'bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200',
    realestate: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
  }
  return map[variant] || 'bg-stone-100 text-stone-800 dark:bg-slate-800 dark:text-slate-200'
}

function normText(s) {
  return String(s || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\s+/g, ' ')
    .trim()
}

function flattenHeroTitle(hero) {
  const lines = hero?.titleLines || []
  return lines
    .map((line) => (line || []).map((seg) => String(seg?.text || '')).join(''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Admin 簡易フォームはヒーローと同じ見出し・リードを prose にも入れるため、本文で繰り返さない */
function proseDuplicatesHero(block, hero) {
  if (!block || block.type !== 'prose') return false
  const ht = normText(flattenHeroTitle(hero))
  const hs = normText(hero?.sub || '')
  const bt = normText(block.title || '')
  const bl = normText(block.lead || '')
  if (!ht || !bt) return false
  return bt === ht && bl === hs
}

function useFadeInVisible() {
  const containerRef = useRef(null)
  useEffect(() => {
    const root = containerRef.current
    if (!root) return undefined
    const els = root.querySelectorAll('[data-insight-reveal]')
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('insight-visible')
        })
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [])
  return containerRef
}

function ProseParagraph({ text, className = '' }) {
  const raw = String(text || '').trim()
  if (!raw) return null
  if (looksLikeInsightHtml(raw)) {
    if (isEmptyInsightBodyHtml(raw)) return null
    const html = sanitizeInsightBodyHtml(raw)
    if (!html.trim()) return null
    return (
      <div
        className={`insight-body-html ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }
  return <p className={`whitespace-pre-line ${className}`}>{raw}</p>
}

export default function InsightArticleView({ document: doc }) {
  const rootRef = useFadeInVisible()
  const hero = doc?.hero || {}
  const adminMeta = doc?.admin && typeof doc.admin === 'object' ? doc.admin : {}
  /** 一覧サムネは admin.coverImageUrl を使う。本文ヘッダは従来 hero のみだったため、管理の URL を合流 */
  const coverImageUrl = String(adminMeta?.coverImageUrl || hero.coverImageUrl || '').trim()
  const ticker = Array.isArray(doc?.ticker) ? doc.ticker : []
  const tickerLoop = ticker.length ? [...ticker, ...ticker] : []
  const sections = Array.isArray(doc?.sections) ? doc.sections : []
  const footer = doc?.footer || {}
  const keywordList = Array.isArray(adminMeta?.keywords)
    ? adminMeta.keywords.map((k) => String(k || '').trim()).filter(Boolean)
    : []
  const relatedToolList = Array.isArray(adminMeta?.relatedTools)
    ? adminMeta.relatedTools.map((t) => String(t || '').trim()).filter(Boolean)
    : []

  const firstProseIdx = sections.findIndex((b) => b?.type === 'prose')

  return (
    <div
      ref={rootRef}
      className="insight-editorial text-stone-900 dark:text-slate-200 bg-[#f6f4ef] dark:bg-slate-950 antialiased selection:bg-amber-200/80 selection:text-stone-900 dark:selection:bg-amber-900/40 dark:selection:text-amber-100"
    >
      <style>{`
        .insight-editorial { font-family: 'Noto Sans JP', system-ui, -apple-system, sans-serif; }
        .insight-editorial .insight-heading { letter-spacing: -0.02em; }
        .insight-editorial .font-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        [data-insight-reveal] { opacity: 0; transform: translateY(18px); transition: opacity 0.65s ease, transform 0.65s ease; }
        [data-insight-reveal].insight-visible { opacity: 1; transform: translateY(0); }
        @keyframes insight-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .insight-marquee-track { animation: insight-marquee 28s linear infinite; }
      `}</style>

      <header className="relative flex flex-col justify-start px-5 sm:px-10 lg:px-24 pb-8 sm:pb-10 pt-8 sm:pt-10 border-b border-stone-200/80 dark:border-slate-800/90">
        {/* 背景だけクリップ。見出し・リードは overflow で切らない（長い見出しが右で欠けないように） */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div
            className="absolute inset-0 opacity-[0.35] dark:hidden"
            style={{
              backgroundImage: `linear-gradient(rgba(120,113,108,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(120,113,108,0.06) 1px, transparent 1px)`,
              backgroundSize: '48px 48px',
            }}
          />
          <div
            className="absolute inset-0 dark:hidden"
            style={{
              background: `
              radial-gradient(ellipse 70% 55% at 75% 12%, rgba(225,29,72,0.09) 0%, transparent 55%),
              radial-gradient(ellipse 55% 45% at 12% 88%, rgba(180,83,9,0.08) 0%, transparent 50%),
              radial-gradient(ellipse 50% 35% at 50% 50%, rgba(251,191,36,0.04) 0%, transparent 60%),
              linear-gradient(180deg, #f0ece4 0%, #f6f4ef 100%)
            `,
            }}
          />
          <div
            className="absolute inset-0 hidden dark:block"
            style={{
              background: `
              radial-gradient(ellipse 70% 55% at 75% 15%, rgba(248,113,113,0.12) 0%, transparent 55%),
              radial-gradient(ellipse 55% 45% at 15% 85%, rgba(251,191,36,0.08) 0%, transparent 50%),
              linear-gradient(180deg, #0f172a 0%, #020617 100%)
            `,
            }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent dark:via-amber-500/30"
          />
          {hero.bgFigure ? (
            <div
              className="font-mono absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[clamp(4rem,18vw,16rem)] font-medium text-stone-900/[0.04] dark:text-slate-100/[0.06] whitespace-nowrap select-none z-0"
            >
              {hero.bgFigure}
            </div>
          ) : null}
        </div>

        <div className="relative z-[1] mx-auto w-full min-w-0 max-w-4xl">
          {hero.badge ? (
            <div className="inline-flex max-w-full items-center gap-2 px-4 py-1.5 rounded-full border border-rose-300/80 dark:border-rose-500/40 bg-[#faf8f4]/90 dark:bg-slate-900/80 backdrop-blur-sm text-[11px] font-semibold tracking-[0.12em] text-rose-700 dark:text-rose-300 mb-5 shadow-sm break-words [overflow-wrap:anywhere]">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              {hero.badge}
            </div>
          ) : null}

          <h1 className="insight-heading text-[clamp(1.75rem,5vw,3.25rem)] font-extrabold leading-[1.25] tracking-tight text-stone-900 dark:text-white mb-6 break-words [overflow-wrap:anywhere]">
            {(hero.titleLines || []).map((line, li) => (
              <span key={`tl-${li}`} className="block">
                {(line || []).map((seg, si) => (
                  <span key={`seg-${li}-${si}`} className={accentTitle(seg?.accent)}>
                    {seg?.text || ''}
                  </span>
                ))}
              </span>
            ))}
          </h1>

          {hero.sub ? (
            <div className="relative w-full min-w-0 max-w-2xl mb-10 pl-4 sm:pl-5 border-l-[3px] border-amber-500/90 dark:border-amber-500/70">
              <p className="text-base sm:text-lg text-stone-700 dark:text-slate-300 leading-[1.95] font-normal break-words [overflow-wrap:anywhere]">
                {hero.sub}
              </p>
            </div>
          ) : null}

          {Array.isArray(hero.meta) && hero.meta.length > 0 ? (
            <div className="inline-flex max-w-full flex-wrap rounded-2xl border border-stone-200/90 dark:border-slate-600/80 bg-[#faf8f4]/90 dark:bg-slate-900/75 backdrop-blur-md px-4 py-3 shadow-sm">
              <p className="text-[11px] sm:text-xs text-stone-600 dark:text-slate-400 font-mono font-medium tracking-wide leading-relaxed">
                {hero.meta.filter(Boolean).join(' · ')}
              </p>
            </div>
          ) : null}
        </div>
      </header>

      {coverImageUrl ? (
        <div className="relative bg-[#faf8f4] dark:bg-slate-950 border-b border-stone-200/60 dark:border-slate-800/80">
          <div
            data-insight-reveal
            className="mx-auto max-w-3xl px-5 sm:px-8 pb-6 sm:pb-8 w-full overflow-hidden rounded-2xl border border-stone-200/90 dark:border-slate-600/80 bg-stone-200/80 dark:bg-slate-800 shadow-[0_22px_55px_-28px_rgba(28,25,23,0.28)] dark:shadow-[0_24px_60px_-28px_rgba(0,0,0,0.5)]"
          >
            <img
              src={coverImageUrl}
              alt=""
              className="w-full max-h-[min(52vh,520px)] object-cover object-center"
              loading="eager"
              decoding="async"
            />
          </div>
        </div>
      ) : null}

      {tickerLoop.length > 0 ? (
        <div className="border-y border-stone-200 dark:border-slate-800 bg-[#eeebe4]/90 dark:bg-slate-900/95 overflow-hidden py-3.5">
          <div className="flex gap-14 insight-marquee-track w-max">
            {tickerLoop.map((item, i) => (
              <div key={`tk-${i}`} className="flex items-center gap-3 whitespace-nowrap font-mono text-[13px]">
                <span className="text-[11px] text-stone-500 dark:text-slate-500 tracking-wide">{item.label}</span>
                <span className="text-stone-900 dark:text-slate-100 font-semibold">{item.value}</span>
                <span className={item.up === false ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-rose-600 dark:text-rose-400 font-medium'}>
                  {item.change}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="relative bg-gradient-to-b from-[#faf8f4] via-[#f6f4ef] to-[#f0ece6] dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 pt-4 sm:pt-6 pb-6 sm:pb-8 space-y-12 sm:space-y-16">
        {sections.map((block, idx) => {
          if (!block || !block.type) return null
          if (block.type === 'prose') {
            const isDupHero = idx === firstProseIdx && proseDuplicatesHero(block, hero)
            const paras = (block.paragraphs || []).map((p) => String(p || '').trim()).filter(Boolean)

            if (isDupHero) {
              return (
                <section key={`b-${idx}`} data-insight-reveal className="space-y-4 sm:space-y-5">
                  <div className="flex items-center gap-3">
                    {block.kicker ? (
                      <span className="font-mono text-base font-semibold tracking-[0.2em] uppercase text-amber-900 dark:text-amber-300 whitespace-nowrap">
                        {block.kicker}
                      </span>
                    ) : null}
                    <div className="h-px flex-1 bg-gradient-to-r from-amber-400/60 to-transparent dark:from-amber-600/40" />
                  </div>
                  <p className="text-xs font-black tracking-[0.2em] text-stone-500 dark:text-slate-400 uppercase">
                    分析の本文
                  </p>
                  {paras.length >= 2 ? (
                    <div className="space-y-6">
                      <div className="rounded-2xl border border-emerald-200/90 dark:border-emerald-900/50 bg-[#eef6f2] dark:bg-slate-900/80 p-6 sm:p-8 shadow-[0_16px_40px_-28px_rgba(6,78,59,0.2)] dark:shadow-[0_20px_50px_-28px_rgba(0,0,0,0.5)]">
                        <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-emerald-800 dark:text-emerald-300 mb-3">
                          投資テーゼ
                        </p>
                        <ProseParagraph
                          text={paras[0]}
                          className="text-[16px] sm:text-[17px] leading-[1.9] text-stone-800 dark:text-slate-100 font-medium"
                        />
                      </div>
                      <div className="rounded-2xl border border-sky-200/90 dark:border-sky-900/50 bg-[#eef3f8] dark:bg-slate-900/80 p-6 sm:p-8 shadow-[0_16px_40px_-28px_rgba(12,74,110,0.15)] dark:shadow-[0_20px_50px_-28px_rgba(0,0,0,0.5)]">
                        <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-sky-800 dark:text-sky-300 mb-3">
                          根拠
                        </p>
                        <div className="space-y-5">
                          {paras.slice(1).map((p, ri) => (
                            <ProseParagraph
                              key={`rat-${ri}`}
                              text={p}
                              className="text-[16px] sm:text-[17px] leading-[1.9] text-stone-700 dark:text-slate-200"
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-stone-200/90 dark:border-slate-700 bg-[#faf8f4] dark:bg-slate-900/90 p-6 sm:p-8 shadow-[0_20px_50px_-30px_rgba(28,25,23,0.12)] dark:shadow-[0_24px_60px_-28px_rgba(0,0,0,0.45)]">
                      {paras.map((p, pi) => (
                        <ProseParagraph
                          key={`p-${pi}`}
                          text={p}
                          className="text-[16px] sm:text-[17px] leading-[1.9] text-stone-800 dark:text-slate-100 mb-6 last:mb-0"
                        />
                      ))}
                    </div>
                  )}
                </section>
              )
            }

            return (
              <section key={`b-${idx}`} data-insight-reveal className="rounded-2xl border border-stone-200/80 dark:border-slate-700/90 bg-[#faf8f4] dark:bg-slate-900/85 p-6 sm:p-9 shadow-[0_18px_48px_-32px_rgba(28,25,23,0.18)] dark:shadow-[0_22px_55px_-28px_rgba(0,0,0,0.5)] space-y-5">
                {block.kicker ? (
                  <p className="font-mono text-base font-semibold tracking-[0.2em] uppercase text-amber-800/90 dark:text-amber-400/90">
                    {block.kicker}
                  </p>
                ) : null}
                <h2 className="insight-heading text-[clamp(1.35rem,3.5vw,2rem)] font-bold text-stone-900 dark:text-white leading-snug whitespace-pre-line">
                  {block.title}
                </h2>
                {block.lead ? (
                  <p className="text-stone-600 dark:text-slate-400 text-[15px] sm:text-base leading-[1.95] border-l-2 border-amber-400/70 dark:border-amber-600/50 pl-4">
                    {block.lead}
                  </p>
                ) : null}
                {(block.paragraphs || []).map((p, pi) => (
                  <ProseParagraph
                    key={`p-${pi}`}
                    text={p}
                    className="text-stone-700 dark:text-slate-300 text-[15px] sm:text-[16px] leading-[2.05]"
                  />
                ))}
              </section>
            )
          }
          if (block.type === 'compare') {
            return (
              <section key={`b-${idx}`} data-insight-reveal>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-stone-200 dark:bg-slate-700 rounded-2xl overflow-hidden border border-stone-200/80 dark:border-slate-700 shadow-sm">
                  <div className="bg-stone-100 dark:bg-slate-800 px-5 py-4 text-center font-mono text-[10px] font-semibold tracking-wider text-stone-500 dark:text-slate-400 uppercase">
                    {block.leftTitle}
                  </div>
                  <div className="bg-stone-100 dark:bg-slate-800 px-5 py-4 text-center font-mono text-[10px] font-semibold tracking-wider text-stone-500 dark:text-slate-400 uppercase sm:border-l border-stone-200 dark:border-slate-700">
                    {block.rightTitle}
                  </div>
                  {(block.rows || []).map((row, ri) => (
                    <Fragment key={`cmp-${ri}`}>
                      <div className="bg-[#faf8f4] dark:bg-slate-900/80 px-5 py-3.5 text-sm text-stone-600 dark:text-slate-300 text-center leading-relaxed">
                        {row?.[0]}
                      </div>
                      <div className="bg-[#faf8f4] dark:bg-slate-900 px-5 py-3.5 text-sm text-stone-600 dark:text-slate-300 text-center leading-relaxed sm:border-l border-stone-100 dark:border-slate-800">
                        {row?.[1]}
                      </div>
                    </Fragment>
                  ))}
                </div>
              </section>
            )
          }
          if (block.type === 'callout') {
            const variant = block.variant || 'insight'
            const isWarn = variant === 'warn'
            const isTip = variant === 'tip'
            const box = isWarn
              ? 'bg-rose-50/80 border-rose-200/80 dark:bg-rose-950/35 dark:border-rose-800/60'
              : isTip
                ? 'bg-amber-50/80 border-amber-200/70 dark:bg-amber-950/25 dark:border-amber-800/50'
                : 'bg-[#faf8f4] border-l-[3px] border-amber-500 shadow-sm border-y border-r border-stone-200/80 rounded-r-xl dark:bg-slate-900 dark:border-slate-700 dark:border-l-amber-500'
            return (
              <section key={`b-${idx}`} data-insight-reveal>
                <div className={`rounded-xl px-6 py-5 ${box}`}>
                  {block.title ? (
                    <h4
                      className={`font-bold text-sm mb-2 ${isWarn ? 'text-rose-700 dark:text-rose-300' : isTip ? 'text-amber-900 dark:text-amber-200' : 'text-amber-900 dark:text-amber-200'}`}
                    >
                      {block.title}
                    </h4>
                  ) : null}
                  <p
                    className={`text-[15px] leading-[1.9] ${isWarn || isTip ? 'text-stone-600 dark:text-slate-300' : 'text-stone-800 dark:text-slate-200'}`}
                  >
                    {block.body}
                  </p>
                </div>
              </section>
            )
          }
          if (block.type === 'assets') {
            return (
              <div key={`b-${idx}`} className="space-y-6">
                {(block.items || []).map((asset, ai) => (
                  <section
                    key={`asset-${ai}`}
                    data-insight-reveal
                    className="relative rounded-2xl border border-stone-200/90 dark:border-slate-700 bg-[#faf8f4] dark:bg-slate-900 p-8 sm:p-9 shadow-[0_12px_40px_-24px_rgba(28,25,23,0.35)] dark:shadow-[0_12px_40px_-24px_rgba(0,0,0,0.5)] overflow-hidden transition hover:border-amber-200/60 dark:hover:border-amber-700/50 hover:-translate-y-0.5"
                  >
                    <div
                      className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${cardTopBar(asset.variant)}`}
                    />
                    <span className="font-mono absolute top-5 right-7 text-[2.75rem] font-medium text-stone-900/[0.06] dark:text-slate-100/[0.08] leading-none">
                      {asset.rank}
                    </span>
                    {asset.tag ? (
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase mb-4 ${cardTagClass(asset.variant)}`}
                      >
                        {asset.tag}
                      </span>
                    ) : null}
                    <h3 className="insight-heading text-xl font-bold text-stone-900 dark:text-white mb-3 tracking-tight">{asset.title}</h3>
                    <p className="text-[14px] text-stone-600 dark:text-slate-400 leading-[1.9] mb-5">{asset.body}</p>
                    {Array.isArray(asset.stats) && asset.stats.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-5 border-t border-stone-100 dark:border-slate-800">
                        {asset.stats.map((s, si) => (
                          <div key={`st-${si}`} className="text-center sm:text-left">
                            <div className={`font-mono text-lg font-semibold ${statTone(s.tone)}`}>
                              {s.value}
                            </div>
                            <div className="text-[11px] text-stone-500 dark:text-slate-500 mt-1 tracking-wide">{s.label}</div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </section>
                ))}
              </div>
            )
          }
          if (block.type === 'timeline') {
            return (
              <section key={`b-${idx}`} data-insight-reveal className="relative pl-8 sm:pl-10">
                <div
                  className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-amber-600 via-rose-400 to-sky-400 opacity-90 rounded-full"
                  aria-hidden
                />
                <div className="space-y-10">
                  {(block.items || []).map((it, ti) => (
                    <div key={`ti-${ti}`} className="relative">
                      <span
                        className="absolute -left-[1.4rem] sm:-left-[1.55rem] top-2 w-3 h-3 rounded-full bg-[#f6f4ef] dark:bg-slate-950 border-2 border-amber-600 dark:border-amber-500"
                        aria-hidden
                      />
                      <p className="font-mono text-xs text-amber-800 dark:text-amber-400 font-semibold tracking-wide mb-2">
                        {it.period}
                      </p>
                      <h3 className="insight-heading text-lg font-bold text-stone-900 dark:text-white mb-2 tracking-tight">{it.title}</h3>
                      <p className="text-sm text-stone-600 dark:text-slate-400 leading-[1.85]">{it.desc}</p>
                    </div>
                  ))}
                </div>
              </section>
            )
          }
          return null
        })}
        </div>

        {relatedToolList.length > 0 ? (
          <section
            className="max-w-3xl mx-auto px-5 sm:px-8 pt-3 sm:pt-4 pb-5 sm:pb-6 border-b border-stone-200/80 dark:border-slate-800"
            aria-label="関連コンテンツ"
          >
            <p className="font-mono text-xs sm:text-sm tracking-[0.18em] uppercase text-amber-800/90 dark:text-amber-400/90 mb-2 font-bold">
              MM 関連コンテンツ
            </p>
            <div className="flex flex-wrap gap-2 sm:gap-2.5">
              {relatedToolList.map((tool, ti) => (
                <InsightToolPill key={`rel-${ti}-${tool}`} name={tool} />
              ))}
            </div>
          </section>
        ) : null}
        {keywordList.length > 0 ? (
          <section
            className="max-w-3xl mx-auto px-5 sm:px-8 pt-3 sm:pt-4 pb-5 sm:pb-6 border-b border-stone-200/80 dark:border-slate-800"
            aria-label="キーワード"
          >
            <p className="font-mono text-xs sm:text-sm tracking-[0.18em] uppercase text-amber-800/90 dark:text-amber-400/90 mb-2 font-bold">
              キーワード
            </p>
            <div className="flex flex-wrap gap-2 sm:gap-2.5">
              {keywordList.map((kw, ki) => (
                <span
                  key={`${kw}-${ki}`}
                  className="inline-flex items-center rounded-full border border-stone-300/90 dark:border-slate-500 bg-[#ebe6dc]/90 dark:bg-slate-800/95 px-3.5 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-[15px] font-bold text-stone-800 dark:text-slate-100 leading-snug"
                >
                  {kw}
                </span>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <footer className="border-t border-stone-200 dark:border-slate-800 bg-[#f0ece6]/50 dark:bg-slate-900/60 py-8 sm:py-9 px-5 text-center">
        <p className="font-mono text-lg font-semibold text-amber-900/90 dark:text-amber-300/90 tracking-wide mb-1.5">MoneyMart</p>
        <p className="text-xs text-stone-500 dark:text-slate-500 tracking-[0.12em] font-medium mb-5">
          投資をもっとシンプルに、もっとスマートに
        </p>
        {footer.disclaimer ? (
          <p className="text-[11px] text-stone-500 dark:text-slate-400 leading-[1.85] max-w-xl mx-auto border-t border-stone-200/80 dark:border-slate-700 pt-5">
            ※本ページは情報提供を目的としたものであり、特定の金融商品の購入・売却を推奨するものではありません。投資判断はご自身の責任において行ってください。本コンテンツの著作権はMoneyMart（運営：MoneyLab Ltd.）に帰属します。無断での転載・複製・配布・改変を禁じます。一部記事の作成にAIを活用している場合があります。すべての記事は編集チームが内容を確認しています。
          </p>
        ) : null}
      </footer>
    </div>
  )
}
