import { useEffect, useRef, useState } from 'react'

/** 300×250 A8 — 右カラムで自動ローテーション */
const A8_SLIDES = [
  {
    id: 'legacy',
    clickUrl: 'https://px.a8.net/svt/ejp?a8mat=4B1H1L+461982+3XCC+BYT9D',
    bannerSrc:
      'https://www26.a8.net/svt/bgt?aid=260409225252&wid=001&eno=01&mid=s00000018318002010000&mc=1',
    pixelSrc: 'https://www13.a8.net/0.gif?a8mat=4B1H1L+461982+3XCC+BYT9D',
    imgAlt: '',
  },
  {
    id: 'hifumi',
    clickUrl: 'https://px.a8.net/svt/ejp?a8mat=4B1H1L+2EBVHU+4C2C+BXYE9',
    bannerSrc:
      'https://www20.a8.net/svt/bgt?aid=260409225145&wid=001&eno=01&mid=s00000020226002006000&mc=1',
    pixelSrc: 'https://www14.a8.net/0.gif?a8mat=4B1H1L+2EBVHU+4C2C+BXYE9',
    imgAlt: 'レオス・キャピタルワークス ひふみ',
  },
]

const ROTATE_MS = 9000
const IMG_W = 300
const IMG_H = 250

function Skeleton() {
  return (
    <div
      className="w-full max-w-[300px] mx-auto rounded-xl bg-slate-200/80 dark:bg-slate-700/80 animate-pulse"
      style={{ aspectRatio: `${IMG_W} / ${IMG_H}` }}
      aria-hidden
    />
  )
}

/**
 * マーケット右カラム：Fear & Greed 直下の 300×250（A8）。ビューポート付近で読込。複数バナーを自動切替。
 */
export default function LazyMarketFearBelowA8Ad() {
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
          className="w-full max-w-[300px] overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-600/80 bg-white dark:bg-slate-900 shadow-sm"
          aria-roledescription="carousel"
          aria-label="スポンサー表示"
        >
          <a
            key={slide.id}
            href={slide.clickUrl}
            rel="nofollow noopener noreferrer"
            className="block"
          >
            <img
              src={slide.bannerSrc}
              width={IMG_W}
              height={IMG_H}
              alt={slide.imgAlt}
              loading="lazy"
              decoding="async"
              className="block w-full h-auto max-w-[300px] object-contain object-center bg-white dark:bg-slate-900"
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
