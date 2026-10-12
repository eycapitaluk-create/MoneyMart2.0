import { useEffect, useRef, useState } from 'react'

const A8_CLICK_URL = 'https://px.a8.net/svt/ejp?a8mat=4B1H1L+45FTMA+3XCC+6P4K1'
const A8_BANNER_SRC =
  'https://www24.a8.net/svt/bgt?aid=260409225251&wid=001&eno=01&mid=s00000018318001125000&mc=1'
const A8_PIXEL_SRC = 'https://www19.a8.net/0.gif?a8mat=4B1H1L+45FTMA+3XCC+6P4K1'

function BannerSkeleton() {
  return (
    <div
      className="w-full max-w-[728px] mx-auto h-[90px] max-h-[min(90px,25vw)] rounded-xl bg-slate-200/80 dark:bg-slate-700/80 animate-pulse"
      aria-hidden
    />
  )
}

/**
 * ホーム「Top 5 インサイト」直下用 A8 728×90。ビューポート付近で初めて画像・計測ピクセルを読み込む。
 */
export default function LazyHomeBottomA8Ad() {
  const rootRef = useRef(null)
  const [active, setActive] = useState(false)

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
      { root: null, rootMargin: '280px 0px', threshold: 0.01 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [active])

  return (
    <div ref={rootRef} className="flex justify-center">
      {active ? (
        <div className="w-full max-w-[728px] overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-600/80 bg-white dark:bg-slate-900 shadow-sm">
          <a href={A8_CLICK_URL} rel="nofollow noopener noreferrer" className="block">
            <img
              src={A8_BANNER_SRC}
              width={728}
              height={90}
              alt=""
              loading="lazy"
              decoding="async"
              className="block w-full h-auto max-h-[90px] object-contain object-center bg-white dark:bg-slate-900"
            />
          </a>
          <img
            width={1}
            height={1}
            src={A8_PIXEL_SRC}
            alt=""
            loading="lazy"
            decoding="async"
            className="block w-px h-px opacity-0 pointer-events-none"
            aria-hidden
          />
        </div>
      ) : (
        <BannerSkeleton />
      )}
    </div>
  )
}
