import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Admin IP 제한 가드 — Stripe 일본 보안 요건 대응
 * /admin 접근 시 서버사이드 IP 체크 수행
 */
export default function AdminIpGuard({ children }) {
  const [status, setStatus] = useState('checking') // checking | allowed | denied
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/admin-ip-check')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setStatus('allowed')
        else { setStatus('denied'); navigate('/') }
      })
      .catch(() => { setStatus('denied'); navigate('/') })
  }, [navigate])

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <p className="text-sm font-bold text-slate-500">アクセス確認中...</p>
      </div>
    )
  }

  if (status === 'denied') return null

  return children
}
