import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPayjpPremiumSubscription } from '../../lib/billingClient'
import { trackAnalyticsEvent } from '../../lib/analytics'
import {
  PAYJP_WEB_CARD_BRAND_CHIPS,
  PAYJP_WEB_CARD_BRANDS_LABEL,
} from '../../constants/payjpBillingFaq'

const PAYJP_JS = 'https://js.pay.jp/v2/pay.js'

function loadPayjpScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('browser only'))
  if (window.Payjp) return Promise.resolve(window.Payjp)
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${PAYJP_JS}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Payjp))
      existing.addEventListener('error', reject)
      return
    }
    const script = document.createElement('script')
    script.src = PAYJP_JS
    script.async = true
    script.onload = () => resolve(window.Payjp)
    script.onerror = () => reject(new Error('PAY.JP の読み込みに失敗しました'))
    document.head.appendChild(script)
  })
}

async function resolvePayjpPublicKey() {
  // Vercel env はビルド後も変わるが VITE_* はビルド時に焼き込まれるため、常に API を優先する
  try {
    const res = await fetch('/api/billing/payjp/public-config', { credentials: 'same-origin' })
    const data = await res.json().catch(() => ({}))
    const key = String(data?.publicKey || '').trim()
    if (key && !key.startsWith('sk_')) return key
  } catch {
    /* fall through */
  }
  const baked = String(import.meta.env.VITE_PAYJP_PUBLIC_KEY || '').trim()
  if (baked && !baked.startsWith('sk_')) return baked
  return ''
}

export default function PayjpPremiumCheckout({
  accessToken,
  billingCycle = 'monthly',
  disabled = false,
  onSuccess,
}) {
  const mountId = useId().replace(/:/g, '')
  const cardElementRef = useRef(null)
  const payjpRef = useRef(null)

  const [publicKey, setPublicKey] = useState('')
  const [keyLoading, setKeyLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setKeyLoading(true)
      const key = await resolvePayjpPublicKey()
      if (!cancelled) {
        setPublicKey(key)
        setKeyLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const mountSelector = `#payjp-card-${mountId}`

  useLayoutEffect(() => {
    if (!publicKey || !accessToken) return undefined

    let cancelled = false
    let cardEl = null

    ;(async () => {
      try {
        const Payjp = await loadPayjpScript()
        if (cancelled) return
        const host = document.querySelector(mountSelector)
        if (!host) {
          throw new Error('決済フォームの表示領域が見つかりません')
        }
        const payjp = Payjp(publicKey)
        payjpRef.current = payjp
        const elements = payjp.elements()
        cardEl = elements.create('card', {
          style: {
            base: {
              color: '#0f172a',
              fontSize: '16px',
              '::placeholder': { color: '#94a3b8' },
            },
            invalid: { color: '#dc2626' },
          },
        })
        cardElementRef.current = cardEl
        cardEl.mount(mountSelector)
        if (!cancelled) setReady(true)
      } catch (e) {
        if (!cancelled) setError(String(e?.message || e || '決済フォームの初期化に失敗しました'))
      }
    })()

    return () => {
      cancelled = true
      try {
        cardEl?.unmount?.()
      } catch {
        /* ignore */
      }
      cardElementRef.current = null
      payjpRef.current = null
      setReady(false)
    }
  }, [publicKey, accessToken, mountSelector])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (disabled || loading || !ready || !payjpRef.current || !cardElementRef.current) return
    setLoading(true)
    setError('')
    trackAnalyticsEvent('premium_checkout_click', { billing_cycle: billingCycle })
    try {
      const result = await payjpRef.current.createToken(cardElementRef.current)
      if (result?.error) {
        throw new Error(result.error.message || 'カード情報を確認してください')
      }
      const tokenId = String(result?.id || result?.token?.id || '').trim()
      if (!tokenId) throw new Error('トークンの取得に失敗しました')

      const subscriptionResult = await createPayjpPremiumSubscription({
        accessToken,
        billingCycle,
        payjpToken: tokenId,
      })
      trackAnalyticsEvent('premium_checkout_success', { billing_cycle: billingCycle })
      onSuccess?.(subscriptionResult)
    } catch (err) {
      trackAnalyticsEvent('premium_checkout_error', {
        billing_cycle: billingCycle,
        message: String(err?.message || err || '').slice(0, 200),
      })
      setError(String(err?.message || err || '決済に失敗しました'))
    } finally {
      setLoading(false)
    }
  }

  if (keyLoading) {
    return <p className="text-xs text-slate-500 text-center">決済フォームを読み込み中…</p>
  }

  if (!publicKey) {
    return (
      <p className="text-xs text-amber-700 dark:text-amber-300 text-center leading-relaxed">
        公開鍵が未設定、または秘密鍵（sk_）が誤って設定されています。PAY.JP ダッシュボードの
        {' '}
        <strong>Test public key（pk_test_…）</strong>
        {' '}
        を Vercel の
        {' '}
        <code className="text-[10px]">VITE_PAYJP_PUBLIC_KEY</code>
        {' '}
        に設定し Redeploy してください（秘密鍵 sk_ は別変数
        {' '}
        <code className="text-[10px]">PAYJP_SECRET_KEY</code>
        {' '}
        のみ）。
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="w-full min-w-0 space-y-4">
      <div className="text-center space-y-2">
        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
          対応カード（PAY.JP 本番）
        </p>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {PAYJP_WEB_CARD_BRAND_CHIPS.map((brand) => (
            <span
              key={brand}
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-black tracking-wide text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            >
              {brand}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 dark:text-slate-500">
          {PAYJP_WEB_CARD_BRANDS_LABEL}
          {' '}
          · Apple Pay は Web 未対応（iOS は App Store）
        </p>
      </div>
      <div
        id={`payjp-card-${mountId}`}
        className="relative z-10 w-full min-w-0 overflow-visible rounded-xl border border-orange-200/80 bg-white px-3 py-4 dark:border-orange-800/60 dark:bg-slate-950 min-h-[3.5rem] sm:min-h-[3.25rem]"
        aria-label="クレジットカード入力"
      />
      {error ? (
        <p className="text-xs font-semibold text-red-600 dark:text-red-400 text-center break-words" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={disabled || loading || !ready}
        className="relative z-0 w-full min-h-[48px] rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-3.5 text-xs font-black text-white shadow-lg shadow-orange-500/25 transition hover:from-orange-600 hover:to-amber-600 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-sm"
      >
        {loading ? '処理中…' : (
          <>
            <span className="sm:hidden">Premium に申し込む</span>
            <span className="hidden sm:inline">Premium に申し込む（Web・PAY.JP）</span>
          </>
        )}
      </button>
    </form>
  )
}
