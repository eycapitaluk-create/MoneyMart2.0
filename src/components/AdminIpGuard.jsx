import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Admin Basic Auth 가드 — Stripe 일본 보안 요건 대응
 * ADMIN_BASIC_USER / ADMIN_BASIC_PASS 환경변수 기반
 */
export default function AdminIpGuard({ children }) {
  const [status, setStatus] = useState('checking')
  const navigate = useNavigate()

  useEffect(() => {
    // 저장된 인증 정보 확인
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
          alert('認証に失敗しました')
          navigate('/')
        }
      })
      .catch(() => navigate('/'))
  }

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <p className="text-sm font-bold text-slate-500">認証確認中...</p>
      </div>
    )
  }

  return children
}
