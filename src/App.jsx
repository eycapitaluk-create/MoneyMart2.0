import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Layout from './components/layout/Layout'
import HomePage from './pages/HomePage'
import MarketPage from './pages/MarketPage'
import FundPage from './pages/FundPage'
import FundDetailPage from './pages/FundDetailPage'
import FundComparePage from './pages/FundComparePage'
import StockPage from './pages/StockPage'
import ProductPage from './pages/ProductPage'
import ProductDetailPage from './pages/ProductDetailPage'
import LoungePage from './pages/LoungePage'
import AcademyPage from './pages/AcademyPage'
import PrimePage from './pages/PrimePage'
import AdminPage from './pages/AdminPage'
import Login from './pages/Login'
import Signup from './pages/Signup'
import RoboPage from './pages/RoboPage'
import MyPage from './pages/MyPage'
import LegalPage from './pages/LegalPage'
import FAQPage from './pages/FAQPage'
import AboutPage from './pages/AboutPage'

const App = () => {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [currentUserProfile, setCurrentUserProfile] = useState(undefined)
  const [role, setRole] = useState('viewer')
  const [roleReady, setRoleReady] = useState(false)

  const [fundWatchlist, setFundWatchlist] = useState(() => {
    try {
      const raw = localStorage.getItem('mm_fund_watchlist')
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem('mm_fund_watchlist', JSON.stringify(fundWatchlist))
  }, [fundWatchlist])

  useEffect(() => {
    let mounted = true

    const loadDisplayProfile = async (nextSession) => {
      if (!nextSession?.user?.id) {
        if (mounted) setCurrentUserProfile(null)
        return
      }

      const cacheKey = `mm_user_profile:${nextSession.user.id}`
      try {
        const cached = localStorage.getItem(cacheKey)
        if (cached && mounted) {
          const parsed = JSON.parse(cached)
          if (parsed?.id === nextSession.user.id && parsed?.displayName) {
            setCurrentUserProfile(parsed)
          }
        }
      } catch {
        // ignore cache parse errors
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('nickname,full_name')
        .eq('user_id', nextSession.user.id)
        .maybeSingle()

      const displayName = profile?.nickname
        || profile?.full_name
        || (nextSession.user.email ? nextSession.user.email.split('@')[0] : 'Member')

      const normalized = {
        id: nextSession.user.id,
        email: nextSession.user.email || '',
        displayName,
      }

      if (mounted) setCurrentUserProfile(normalized)
      localStorage.setItem(cacheKey, JSON.stringify(normalized))
    }

    const init = async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      const nextSession = data?.session ?? null
      setSession(nextSession)
      await loadDisplayProfile(nextSession)
      setAuthReady(true)
    }
    init()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null)
      setCurrentUserProfile(undefined)
      loadDisplayProfile(nextSession ?? null)
      setRoleReady(false)
    })

    return () => {
      mounted = false
      authListener?.subscription?.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const loadRole = async () => {
      if (!session?.user?.id) {
        setRole('viewer')
        setRoleReady(true)
        return
      }
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single()
      setRole(data?.role || 'viewer')
      setRoleReady(true)
    }
    loadRole()
  }, [session?.user?.id])

  const toggleFundWatchlist = (id, meta = {}) => {
    if (!id) return
    setFundWatchlist((prev) => {
      const exists = prev.some((item) => item.id === id)
      if (exists) return prev.filter((item) => item.id !== id)
      return [
        ...prev,
        {
          id,
          name: meta.name || String(id),
          change: Number(meta.change || 0),
          trend: Number(meta.change || 0) >= 0 ? 'up' : 'down',
        },
      ]
    })
  }

  const RequireAuth = ({ children }) => {
    if (!authReady) return null
    if (!session) return <Navigate to="/login" replace />
    return children
  }

  const RequireAdmin = ({ children }) => {
    if (!authReady || !roleReady) return null
    if (!session) return <Navigate to="/login" replace />
    if (role !== 'admin') return <Navigate to="/" replace />
    return children
  }

  return (
    <Routes>
      <Route element={<Layout session={session} authReady={authReady} />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={session ? <Navigate to="/mypage" replace /> : <Login />} />
        <Route path="/signup" element={session ? <Navigate to="/mypage" replace /> : <Signup />} />
        <Route path="/market" element={<MarketPage />} />
        <Route
          path="/funds"
          element={
            <FundPage
              myWatchlist={fundWatchlist.map((item) => item.id)}
              toggleWatchlist={toggleFundWatchlist}
            />
          }
        />
        <Route path="/funds/compare" element={<FundComparePage />} />
        <Route path="/funds/:id" element={<FundDetailPage />} />
        <Route path="/stocks" element={<StockPage />} />
        <Route path="/products" element={<ProductPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route path="/lounge" element={<LoungePage bootUser={currentUserProfile} authReady={authReady} />} />
        <Route path="/academy" element={<AcademyPage />} />
        <Route path="/prime" element={<PrimePage />} />
        <Route path="/robo" element={<RoboPage />} />
        <Route
          path="/mypage"
          element={
            <RequireAuth>
              <MyPage fundWatchlist={fundWatchlist} user={session?.user || null} />
            </RequireAuth>
          }
        />
        <Route path="/legal/faq" element={<Navigate to="/faq" replace />} />
        <Route path="/legal/:type" element={<LegalPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminPage />
            </RequireAdmin>
          }
        />
      </Route>
    </Routes>
  )
}

export default App
