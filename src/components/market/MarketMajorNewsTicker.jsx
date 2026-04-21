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
      <div className="rounded-lg border border-neutral-800 bg-[#0a0a0a] px-4 py-8 text-sm font-semibold text-neutral-500 min-h-[160px] flex items-center justify-center">
        表示するテキストがありません
      </div>
    )
  }

  if (reducedMotion) {
    return (
      <div className="space-y-10 rounded-lg border border-neutral-800 bg-[#0a0a0a] px-4 py-6 md:px-7 md:py-8">
        {normalized.map((slide) => (
          <section key={slide.id} className="border-b border-neutral-800 pb-8 last:border-0 last:pb-0">
            <p className={`text-[10px] md:text-[11px] font-semibold tracking-[0.22em] uppercase ${ACCENT} mb-3`}>
              Market brief
            </p>
            {slide.headline ? (
              <h4 className="text-xl md:text-2xl font-bold text-neutral-50 tracking-tight leading-tight mb-5 border-b border-neutral-700 pb-3">
                {slide.headline}
              </h4>
            ) : null}
            <ul className="space-y-3.5 list-none">
              {slide.lines.map((line, i) => (
                <li
                  key={`${slide.id}-${i}-${line.slice(0, 20)}`}
                  className="flex gap-3 text-left text-base md:text-lg leading-relaxed text-neutral-200 font-normal"
                >
                  <span className={`shrink-0 w-1 self-stretch min-h-[1.25em] ${ACCENT_BG} rounded-[1px] opacity-90 mt-1.5`} aria-hidden />
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
      className={`relative overflow-hidden rounded-lg border border-neutral-800 bg-[#0a0a0a] shadow-lg min-h-[240px] md:min-h-[280px] pl-1`}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className={`pointer-events-none absolute left-0 top-0 bottom-0 w-1 ${ACCENT_BG} z-[1]`} aria-hidden />
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-0.5 ${ACCENT_BG} opacity-90`} aria-hidden />

      {normalized.length > 1 ? (
        <div className="absolute top-3 right-3 md:top-4 md:right-4 z-10 flex items-center gap-1.5">
          {normalized.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`${i + 1} / ${normalized.length}: ${s.headline || 'パネル'}`}
              aria-current={i === idx ? 'true' : undefined}
              className={`h-2 w-2.5 md:h-2.5 md:w-3 rounded-[1px] transition-colors ${
                i === idx ? `${ACCENT_BG} shadow-[0_0_12px_rgba(255,121,0,0.45)]` : 'bg-neutral-700 hover:bg-neutral-600'
              }`}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>
      ) : null}

      <div key={active.id} className="pl-4 pr-4 py-6 md:pl-8 md:pr-8 md:py-9 animate-market-major-slide">
        <p className={`text-[10px] md:text-[11px] font-semibold tracking-[0.24em] uppercase ${ACCENT} mb-3 pr-14 md:pr-20`}>
          Market brief
        </p>
        {active.headline ? (
          <h4 className="text-2xl md:text-4xl font-bold text-neutral-50 tracking-tight leading-[1.15] pr-14 md:pr-20 border-b border-neutral-700/90 pb-4 mb-5 md:mb-6">
            {active.headline}
          </h4>
        ) : null}
        <ul className={`space-y-3.5 md:space-y-4 list-none ${!active.headline ? 'pt-1' : ''}`}>
          {active.lines.map((line, i) => (
            <li
              key={`${active.id}-L${i}-${line.slice(0, 12)}`}
              className="flex gap-3 md:gap-4 text-left text-base md:text-xl leading-relaxed md:leading-[1.55] text-neutral-200 font-normal"
            >
              <span
                className={`shrink-0 w-1 self-stretch min-h-[1.25em] ${ACCENT_BG} rounded-[1px] opacity-90 mt-1 md:mt-1.5`}
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
