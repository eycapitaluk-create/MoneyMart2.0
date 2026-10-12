import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * 管理画面用 Basic 認証ガード（管理ツールのアクセス制御）
 * 環境変数 ADMIN_BASIC_USER / ADMIN_BASIC_PASS を使用
 */
export default function AdminIpGuard({ children }) {
  const [status, setStatus] = useState('checking')
  const navigate = useNavigate()

  useEffect(() => {
    // セッションに保存済みの認証情報を確認
    const saved = sessionStorage.getItem('mm_admin_auth')
    if (saved) {
      verifyAuth(saved)
    } else {
      promptAuth()
    }
  }, [])

  const verifyAuth = (credentials) => {
    fetch('/api/admin-auth', {
      headers: { Authorization: `Basic ${credentials}` },
    })
      .then((res) => {
        if (res.ok) setStatus('allowed')
        else { sessionStorage.removeItem('mm_admin_auth'); promptAuth() }
      })
      .catch(() => promptAuth())
  }

  const promptAuth = () => {
    const user = window.prompt('Admin Username')
    if (!user) { navigate('/'); return }
    const pass = window.prompt('Admin Password')
    if (!pass) { navigate('/'); return }

    const credentials = btoa(`${user}:${pass}`)
    fetch('/api/admin-auth', {
      headers: { Authorization: `Basic ${credentials}` },
    })
      .then((res) => {
        if (res.ok) {
          sessionStorage.setItem('mm_admin_auth', credentials)
          setStatus('allowed')
        } else {
          alert('Authentication failed')
          navigate('/')
        }
      })
      .catch(() => navigate('/'))
  }

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <p className="text-sm font-bold text-slate-500">Checking credentials…</p>
      </div>
    )
  }

  return children
}
