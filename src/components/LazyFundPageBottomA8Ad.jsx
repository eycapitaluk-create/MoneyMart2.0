import { useEffect, useRef, useState } from 'react'

/** ファンド一覧直下: A8 3本を自動ローテーション（468×60 枠に object-contain で統一） */
const A8_SLIDES = [
  {
    id: 'a8-dmm-468',
    clickUrl: 'https://px.a8.net/svt/ejp?a8mat=4B1SPV+5X57CI+1WP2+15Q22P',
    bannerSrc:
      'https://www23.a8.net/svt/bgt?aid=260424355358&wid=001&eno=01&mid=s00000008903007008000&mc=1',
    pixelSrc: 'https://www15.a8.net/0.gif?a8mat=4B1SPV+5X57CI+1WP2+15Q22P',
    imgW: 468,
    imgH: 60,
    imgAlt: '',
  },
  {
    id: 'a8-gas-320x50',
    clickUrl: 'https://px.a8.net/svt/ejp?a8mat=4B1SPV+51L8AA+1WW0+TVJ4X',
    bannerSrc:
      'https://www21.a8.net/svt/bgt?aid=260424355305&wid=001&eno=01&mid=s00000008928005018000&mc=1',
    pixelSrc: 'https://www13.a8.net/0.gif?a8mat=4B1SPV+51L8AA+1WW0+TVJ4X',
    imgW: 320,
    imgH: 50,
    imgAlt: '',
  },
  {
    id: 'a8-gas-468',
    clickUrl: 'https://px.a8.net/svt/ejp?a8mat=4B1SPV+4XF71U+3EV2+ZR2VL',
    bannerSrc:
      'https://www26.a8.net/svt/bgt?aid=260424355298&wid=001&eno=01&mid=s00000015923006005000&mc=1',
    pixelSrc: 'https://www13.a8.net/0.gif?a8mat=4B1SPV+4XF71U+3EV2+ZR2VL',
    imgW: 468,
    imgH: 60,
    imgAlt: '',
  },
]

const ROTATE_MS = 9000
const SLOT_W = 468
const SLOT_H = 60

function Skeleton() {
  return (
    <div
      className="w-full max-w-[468px] mx-auto rounded-xl bg-slate-200/80 dark:bg-slate-700/80 animate-pulse"
      style={{ aspectRatio: `${SLOT_W} / ${SLOT_H}` }}
      aria-hidden
    />
  )
}

/**
 * ファンドページ下部：468×60（A8）。ビューポート付近で読込。複数バナーを自動切替。
 */
export default function LazyFundPageBottomA8Ad() {
  const rootRef = useRef(null)
  const [active, setActive] = useState(false)
  const [slideIdx, setSlideIdx] = useState(0)

  useEffect(() => {
    const el = rootRef.current
    if (!el || active) return undefined

    if (typeof IntersectionObserver === 'undefined') {
      setActive(true)
      return undefined
    }

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setActive(true)
          obs.disconnect()
        }
      },
      { root: null, rootMargin: '240px 0px', threshold: 0.01 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [active])

  useEffect(() => {
    if (!active || A8_SLIDES.length <= 1) return undefined
    const t = window.setInterval(() => {
      setSlideIdx((i) => (i + 1) % A8_SLIDES.length)
    }, ROTATE_MS)
    return () => window.clearInterval(t)
  }, [active])

  const slide = A8_SLIDES[slideIdx] ?? A8_SLIDES[0]

  return (
    <div ref={rootRef} className="flex flex-col items-center w-full gap-2">
      {active ? (
        <div
          className="w-full max-w-[468px] overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-600/80 bg-white dark:bg-slate-900 shadow-sm"
          aria-roledescription="carousel"
          aria-label="スポンサー表示"
        >
          <a
            key={slide.id}
            href={slide.clickUrl}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="flex w-full items-center justify-center bg-slate-50/90 px-1 dark:bg-slate-900/45"
            style={{ maxWidth: SLOT_W, height: SLOT_H, marginLeft: 'auto', marginRight: 'auto' }}
          >
            <img
              src={slide.bannerSrc}
              width={slide.imgW}
              height={slide.imgH}
              alt={slide.imgAlt}
              loading="lazy"
              decoding="async"
              className="max-h-full max-w-full w-auto h-auto object-contain"
              style={{ border: 0 }}
            />
          </a>
          <img
            key={`${slide.id}-px`}
            width={1}
            height={1}
            src={slide.pixelSrc}
            alt=""
            loading="lazy"
            decoding="async"
            className="block w-px h-px opacity-0 pointer-events-none"
            aria-hidden
          />
          {A8_SLIDES.length > 1 ? (
            <div className="flex justify-center gap-1.5 py-2 border-t border-slate-100 dark:border-slate-700/80">
              {A8_SLIDES.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`広告 ${i + 1} / ${A8_SLIDES.length}`}
                  aria-current={i === slideIdx ? 'true' : undefined}
                  onClick={() => setSlideIdx(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === slideIdx ? 'w-4 bg-orange-500' : 'w-1.5 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400'
                  }`}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <Skeleton />
      )}
    </div>
  )
}
