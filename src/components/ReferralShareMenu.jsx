import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Share2 } from 'lucide-react'
import {
  getReferralNativeSharePayload,
  openReferralShareOnFacebook,
  openReferralShareOnLine,
  openReferralShareOnX,
} from '../lib/referralShare'

const METHOD_HINTS = {
  line: 'LINEを開きました',
  x: 'Xの投稿画面を開きました',
  facebook: 'Facebookの共有画面を開きました',
  native: '共有しました',
}

/**
 * 招待URLを SNS / 端末共有で送るためのドロップダウン。
 * @param {object} props
 * @param {string} props.inviteUrl
 * @param {(method: string) => void} [props.onShareMethod] 例: アナリティクス
 * @param {(message: string) => void} [props.onNotify] ヒント文言（親でタイマー消去）
 * @param {string} [props.triggerClassName]
 */
export function ReferralShareMenu({ inviteUrl, onShareMethod, onNotify, triggerClassName }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!inviteUrl) setOpen(false)
  }, [inviteUrl])

  const fire = (method, hintKey) => {
    onShareMethod?.(method)
    const msg = METHOD_HINTS[hintKey]
    if (msg) onNotify?.(msg)
    setOpen(false)
  }

  const runNativeShare = async () => {
    if (!inviteUrl) return
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share(getReferralNativeSharePayload(inviteUrl))
        fire('native', 'native')
        return
      }
    } catch (err) {
      if (err?.name === 'AbortError') {
        setOpen(false)
        return
      }
    }
    try {
      await navigator.clipboard.writeText(inviteUrl)
      onShareMethod?.('native_fallback_copy')
      onNotify?.('リンクをコピーしました')
    } catch {
      onNotify?.('共有できませんでした')
    }
    setOpen(false)
  }

  const disabled = !inviteUrl

  const itemClass =
    'w-full text-left px-3 py-2.5 text-xs font-black rounded-lg transition ' +
    'text-slate-800 dark:text-slate-100 hover:bg-orange-50 dark:hover:bg-orange-950/50 ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 dark:focus-visible:ring-orange-600'

  const defaultTrigger =
    'flex-1 min-h-10 px-3 rounded-xl border-2 border-orange-400 dark:border-orange-600 ' +
    'text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/40 text-xs font-black ' +
    'inline-flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none'

  return (
    <div className="relative flex-1 min-w-0" ref={rootRef}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={triggerClassName || `${defaultTrigger} w-full`}
      >
        <Share2 size={14} strokeWidth={2.5} aria-hidden />
        リンクをシェア
        <ChevronDown
          size={14}
          strokeWidth={2.5}
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="共有の選択"
          className="absolute left-0 right-0 sm:right-auto sm:min-w-[240px] z-[200] mt-1 rounded-xl border border-orange-200/90 dark:border-orange-900/60 bg-white dark:bg-slate-900 shadow-lg shadow-orange-500/10 py-1 px-1"
        >
          <button
            type="button"
            role="menuitem"
            className={`${itemClass} text-[#06C755]`}
            onClick={() => {
              openReferralShareOnLine(inviteUrl)
              fire('line', 'line')
            }}
          >
            LINEで送る
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              openReferralShareOnX(inviteUrl)
              fire('x', 'x')
            }}
          >
            Xで投稿
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              openReferralShareOnFacebook(inviteUrl)
              fire('facebook', 'facebook')
            }}
          >
            Facebookで共有
          </button>
          <div className="my-1 h-px bg-slate-200 dark:bg-slate-700 mx-2" role="separator" />
          <button type="button" role="menuitem" className={itemClass} onClick={() => void runNativeShare()}>
            端末で共有（AirDrop など）
          </button>
        </div>
      ) : null}
    </div>
  )
}
