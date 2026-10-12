import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { supabase } from '../lib/supabase'
import { consumeAuthRedirectPath } from '../lib/authRedirectStorage'
import { sanitizeAuthReturnPath } from '../lib/authReturnPath'
import {
  hasAuthCallbackPayload,
  parseAuthCallbackError,
  scrubAuthCallbackUrl,
} from '../lib/authCallbackUrl'

/**
 * メール確認 / Google OAuth (PKCE) の redirect 先。
 */
export default function SignupComplete() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState('loading')
  const [errorDetail, setErrorDetail] = useState('')

  const goNext = (session) => {
    const fromMeta = sanitizeAuthReturnPath(session?.user?.user_metadata?.mm_auth_next || '', '')
    const target = fromMeta && fromMeta !== '/' ? fromMeta : consumeAuthRedirectPath('/')
    navigate(target, { replace: true })
  }

  useEffect(() => {
    let cancelled = false
    let navigated = false

    const finishOk = (session) => {
      if (cancelled || navigated) return
      navigated = true
      scrubAuthCallbackUrl()
      goNext(session)
    }

    const finishError = (message) => {
      if (cancelled) return
      setErrorDetail(String(message || '').trim())
      setPhase('error')
    }

    const waitForSession = async () => {
      const callbackErr = parseAuthCallbackError()
      if (callbackErr) {
        finishError(callbackErr)
        return
      }

      for (let attempt = 0; attempt < 20; attempt += 1) {
        if (cancelled) return
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          finishError(error.message)
          return
        }
        if (data?.session) {
          finishOk(data.session)
          return
        }
        await new Promise((r) => window.setTimeout(r, 150))
      }

      if (hasAuthCallbackPayload()) {
        finishError('ログイン情報を取得できませんでした。Supabase Redirect URLs にこのサイトの /signup-complete を追加してください。')
        return
      }

      setPhase('idle')
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled || navigated) return
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
        finishOk(session)
      }
    })

    waitForSession().catch((err) => {
      if (!cancelled) finishError(err?.message || String(err))
    })

    return () => {
      cancelled = true
      sub?.subscription?.unsubscribe()
    }
  }, [])

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans flex items-center justify-center px-4">
        <Card className="p-8 w-full max-w-md text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">ログインを処理しています…</p>
        </Card>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans flex items-center justify-center px-4">
        <Card className="p-8 w-full max-w-md space-y-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">ログインを完了できませんでした</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {errorDetail || 'リンクの有効期限切れ、または設定の不整合の可能性があります。'}
          </p>
          <ul className="text-xs text-gray-500 dark:text-gray-400 list-disc list-inside space-y-1">
            <li>
              Supabase Redirect URLs:
              {' '}
              <code className="text-[10px] break-all">{typeof window !== 'undefined' ? window.location.origin : 'https://www.moneymart.co.jp'}/signup-complete</code>
            </li>
            <li>Google Redirect URI = Supabase Callback URL</li>
            <li>Testing 中は Google Test users に Gmail 追加</li>
          </ul>
          <div className="flex flex-col gap-2">
            <Button type="button" onClick={() => navigate('/login', { replace: true })}>ログインへ</Button>
            <Link to="/signup" className="text-center text-sm text-sky-600 dark:text-sky-400 hover:underline">
              新規登録へ
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans flex items-center justify-center px-4">
      <Card className="p-8 w-full max-w-md space-y-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">ログイン確認</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          メール内リンクまたは Google ログインからアクセスしてください。
        </p>
        <Button type="button" onClick={() => navigate('/login', { replace: true })}>ログインへ</Button>
      </Card>
    </div>
  )
}
