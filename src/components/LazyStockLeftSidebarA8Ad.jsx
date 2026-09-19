import { useEffect, useRef, useState } from 'react'

const A8_CLICK_URL = 'https://px.a8.net/svt/ejp?a8mat=4B1H1L+46MOTU+5PYG+5YZ75'
const A8_BANNER_SRC =
  'https://www23.a8.net/svt/bgt?aid=260409225253&wid=001&eno=01&mid=s00000026692001003000&mc=1'
const A8_PIXEL_SRC = 'https://www13.a8.net/0.gif?a8mat=4B1H1L+46MOTU+5PYG+5YZ75'

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
 * 株価ページ左カラム：銘柄一覧下 300×250（A8 ALTERNA）。ビューポート付近で読込。
 */
export default function LazyStockLeftSidebarA8Ad() {
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
      { root: null, rootMargin: '240px 0px', threshold: 0.01 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [active])

  return (
    <div ref={rootRef} className="flex justify-center w-full">
      {active ? (
        <div className="w-full max-w-[300px] overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-600/80 bg-white dark:bg-slate-900 shadow-sm">
          <a href={A8_CLICK_URL} rel="nofollow noopener noreferrer" className="block">
            <img
              src={A8_BANNER_SRC}
              width={IMG_W}
              height={IMG_H}
              alt=""
              loading="lazy"
              decoding="async"
              className="block w-full h-auto max-w-[300px] object-contain object-center bg-white dark:bg-slate-900"
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
        <Skeleton />
      )}
    </div>
  )
}
