import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getAuthCallbackUrl } from '../../lib/authCallbackUrl'

function isEmailPasswordUser(user) {
  const identities = Array.isArray(user?.identities) ? user.identities : []
  if (identities.some((id) => id?.provider === 'email')) return true
  return String(user?.app_metadata?.provider || '').toLowerCase() === 'email'
}

export default function EmailVerificationBanner({ session }) {
  const user = session?.user
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  if (!user?.email || user.email_confirmed_at) return null
  if (!isEmailPasswordUser(user)) return null

  const handleResend = async () => {
    setBusy(true)
    setNotice('')
    try {
      const redirectTo = getAuthCallbackUrl()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: { emailRedirectTo: redirectTo },
      })
      if (error) throw error
      setNotice('確認メールを再送信しました。')
    } catch (err) {
      setNotice(err?.message || '再送信に失敗しました。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-b border-amber-200/80 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-amber-950 dark:text-amber-100">
        <p>
          <strong>メール認証が未完了です。</strong>
          {' '}
          サービスは利用できますが、重要なお知らせの受信取りにご確認ください（{user.email}）。
        </p>
        <div className="flex items-center gap-3 shrink-0">
          {notice ? <span className="text-[11px] opacity-90">{notice}</span> : null}
          <button
            type="button"
            onClick={handleResend}
            disabled={busy}
            className="font-bold underline underline-offset-2 disabled:opacity-50"
          >
            {busy ? '送信中…' : '確認メールを再送'}
          </button>
        </div>
      </div>
    </div>
  )
}
