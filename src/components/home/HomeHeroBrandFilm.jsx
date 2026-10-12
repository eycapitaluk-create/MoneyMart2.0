import { useEffect, useRef, useState } from 'react'

const POSTER_SRC = '/videos/BrandFilm_v2_hero_poster.jpg'
const LOOP_SRC = '/videos/BrandFilm_v2_hero_loop_15s.mp4'
const FULL_VIDEO_URL = 'https://youtu.be/oPo04oF7sCg'

export default function HomeHeroBrandFilm() {
  const frameRef = useRef(null)
  const videoRef = useRef(null)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [loadVideo, setLoadVideo] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduceMotion(media.matches)
    sync()
    media.addEventListener?.('change', sync)
    return () => media.removeEventListener?.('change', sync)
  }, [])

  useEffect(() => {
    if (reduceMotion) return undefined
    const frame = frameRef.current
    if (!frame || typeof IntersectionObserver === 'undefined') {
      setLoadVideo(true)
      return undefined
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setLoadVideo(true)
        observer.disconnect()
      },
      { rootMargin: '160px 0px' },
    )
    observer.observe(frame)
    return () => observer.disconnect()
  }, [reduceMotion])

  useEffect(() => {
    if (!loadVideo || reduceMotion) return undefined
    const video = videoRef.current
    if (!video) return undefined
    video.muted = true
    video.defaultMuted = true
    if (video.getAttribute('src') !== LOOP_SRC) video.src = LOOP_SRC
    const start = () => {
      video.muted = true
      video.play().catch(() => {})
    }
    if (video.readyState >= 2) start()
    else video.addEventListener('loadeddata', start, { once: true })
    return () => video.removeEventListener('loadeddata', start)
  }, [loadVideo, reduceMotion])

  return (
    <figure className="w-full min-w-0 max-w-full">
      <div
        ref={frameRef}
        className="relative w-full overflow-hidden rounded-2xl bg-[#1a120c] shadow-[0_18px_42px_rgba(15,23,42,0.22),0_10px_28px_rgba(249,115,22,0.16)] ring-1 ring-orange-200/80 dark:ring-orange-900/60"
        style={{ aspectRatio: '16 / 9' }}
      >
        {reduceMotion ? (
          <img
            src={POSTER_SRC}
            alt="MoneyMartアプリのホーム画面イメージ"
            width={1600}
            height={900}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={POSTER_SRC}
            aria-label="MoneyMartアプリのホーム画面イメージ"
          />
        )}
      </div>
      <figcaption className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
        ※画面はサンプルデータによるイメージです
      </figcaption>
      <a
        href={FULL_VIDEO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm transition hover:border-orange-400 hover:text-orange-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-orange-400 dark:hover:text-orange-300"
      >
        フル動画を見る（1分15秒）
      </a>
    </figure>
  )
}
