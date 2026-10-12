import { useEffect, useMemo, useState } from 'react'

const SLIDE_INTERVAL_MS = 9000

/** パネルのアクセント（ロイター系ワイヤのオレンジに近いトーン） */
const ACCENT = 'text-[#FF7900]'
const ACCENT_BG = 'bg-[#FF7900]'

/**
 * 「市場主要ニュース」：大きなスライド + ロイター/ニュースワイヤ風（ダーク・オレンジライン・無装飾タイポ）
 */
export default function MarketMajorNewsTicker({ slides = [] }) {
  const normalized = useMemo(
    () =>
      slides
        .map((s, i) => ({
          id: String(s?.id || `slide-${i}`),
          headline: String(s?.headline || '').trim(),
          lines: (Array.isArray(s?.lines) ? s.lines : [])
            .map((l) => String(l || '').trim())
            .filter(Boolean),
        }))
        .filter((s) => s.headline || s.lines.length > 0),
    [slides],
  )

  const [idx, setIdx] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReducedMotion(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    setIdx(0)
  }, [slides])

  useEffect(() => {
    if (reducedMotion || normalized.length <= 1) return undefined
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % normalized.length)
    }, SLIDE_INTERVAL_MS)
    return () => window.clearInterval(t)
  }, [reducedMotion, normalized.length])

  if (normalized.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-[#0a0a0a] px-4 py-5 text-xs font-semibold text-neutral-500 min-h-[100px] flex items-center justify-center">
        表示するテキストがありません
      </div>
    )
  }

  if (reducedMotion) {
    return (
      <div className="space-y-6 rounded-lg border border-neutral-800 bg-[#0a0a0a] px-3 py-4 md:px-5 md:py-5">
        {normalized.map((slide) => (
          <section key={slide.id} className="border-b border-neutral-800 pb-5 last:border-0 last:pb-0">
            <p className={`text-[9px] md:text-[10px] font-semibold tracking-[0.18em] uppercase ${ACCENT} mb-2`}>
              Market brief
            </p>
            {slide.headline ? (
              <h4 className="text-base md:text-lg font-bold text-neutral-50 tracking-tight leading-snug mb-3 border-b border-neutral-700 pb-2">
                {slide.headline}
              </h4>
            ) : null}
            <ul className="space-y-2 list-none">
              {slide.lines.map((line, i) => (
                <li
                  key={`${slide.id}-${i}-${line.slice(0, 20)}`}
                  className="flex gap-2.5 text-left text-sm md:text-[15px] leading-relaxed text-neutral-200 font-normal"
                >
                  <span className={`shrink-0 w-0.5 self-stretch min-h-[1.1em] ${ACCENT_BG} rounded-[1px] opacity-90 mt-1`} aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    )
  }

  const active = normalized[idx] || normalized[0]

  return (
    <div
      className="relative overflow-hidden rounded-lg border border-neutral-800 bg-[#0a0a0a] shadow-md pl-0.5"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className={`pointer-events-none absolute left-0 top-0 bottom-0 w-0.5 ${ACCENT_BG} z-[1]`} aria-hidden />
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-px ${ACCENT_BG} opacity-90`} aria-hidden />

      {normalized.length > 1 ? (
        <div className="absolute top-2 right-2 md:top-2.5 md:right-2.5 z-10 flex items-center gap-1">
          {normalized.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`${i + 1} / ${normalized.length}: ${s.headline || 'パネル'}`}
              aria-current={i === idx ? 'true' : undefined}
              className={`h-1.5 w-2 md:h-2 md:w-2.5 rounded-[1px] transition-colors ${
                i === idx ? `${ACCENT_BG} shadow-[0_0_8px_rgba(255,121,0,0.4)]` : 'bg-neutral-700 hover:bg-neutral-600'
              }`}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>
      ) : null}

      <div key={active.id} className="pl-3 pr-3 py-4 md:pl-5 md:pr-5 md:py-5 animate-market-major-slide">
        <p className={`text-[9px] md:text-[10px] font-semibold tracking-[0.18em] uppercase ${ACCENT} mb-2 pr-12 md:pr-16`}>
          Market brief
        </p>
        {active.headline ? (
          <h4 className="text-lg md:text-xl font-bold text-neutral-50 tracking-tight leading-snug pr-12 md:pr-16 border-b border-neutral-700/90 pb-2.5 mb-3 md:mb-3.5">
            {active.headline}
          </h4>
        ) : null}
        <ul className={`space-y-2 md:space-y-2.5 list-none ${!active.headline ? 'pt-0.5' : ''}`}>
          {active.lines.map((line, i) => (
            <li
              key={`${active.id}-L${i}-${line.slice(0, 12)}`}
              className="flex gap-2.5 md:gap-3 text-left text-sm md:text-[15px] leading-relaxed text-neutral-200 font-normal"
            >
              <span
                className={`shrink-0 w-0.5 self-stretch min-h-[1.1em] ${ACCENT_BG} rounded-[1px] opacity-90 mt-0.5 md:mt-1`}
                aria-hidden
              />
              <span className="font-sans">{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
