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
import MyPage from './pages/MyPage'
import LegalPage from './pages/LegalPage'
import FAQPage from './pages/FAQPage'
import AboutPage from './pages/AboutPage'
import NotFoundPage from './pages/NotFoundPage'
import {
  loadDbWatchlists,
  addDbWatchlistItem,
  removeDbWatchlistItem,
} from './lib/myPageApi'

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

  const [productInterests, setProductInterests] = useState(() => {
    try {
      const raw = localStorage.getItem('mm_product_interests')
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem('mm_product_interests', JSON.stringify(productInterests))
  }, [productInterests])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return

    const syncWatchlists = async () => {
      try {
        const { fund, product, available } = await loadDbWatchlists(userId)
        if (!available) return

        setFundWatchlist((prev) => {
          const mergedMap = new Map()
          ;[...fund, ...prev].forEach((item) => mergedMap.set(item.id, item))
          const merged = [...mergedMap.values()]
          prev.forEach((item) => {
            if (!fund.some((f) => f.id === item.id)) {
              addDbWatchlistItem({
                userId,
                itemType: 'fund',
                itemId: item.id,
                itemName: item.name,
                metadata: { change: Number(item.change || 0) },
              }).catch(() => {})
            }
          })
          return merged
        })

        setProductInterests((prev) => {
          const mergedMap = new Map()
          ;[...product, ...prev].forEach((item) => mergedMap.set(item.id, item))
          const merged = [...mergedMap.values()]
          prev.forEach((item) => {
            if (!product.some((p) => p.id === item.id)) {
              addDbWatchlistItem({
                userId,
                itemType: 'product',
                itemId: item.id,
                itemName: item.name,
                metadata: { provider: item.provider || '', category: item.category || '' },
              }).catch(() => {})
            }
          })
          return merged
        })
      } catch (err) {
        console.warn('watchlist sync failed:', err?.message || err)
      }
    }

    syncWatchlists()
  }, [session?.user?.id])

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
    })

    return () => {
      mounted = false
      authListener?.subscription?.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let alive = true
    const loadRole = async () => {
      if (!session?.user?.id) {
        if (!alive) return
        setRole('viewer')
        setRoleReady(true)
        return
      }

      setRole('viewer')
      setRoleReady(false)

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle()

        if (error) throw error
        if (!alive) return
        setRole(data?.role === 'admin' ? 'admin' : 'viewer')
      } catch (err) {
        console.warn('role load failed, fallback to viewer:', err?.message || err)
        if (!alive) return
        setRole('viewer')
      } finally {
        if (alive) setRoleReady(true)
      }
    }
    loadRole()
    return () => {
      alive = false
    }
  }, [session?.user?.id])

  const toggleFundWatchlist = (id, meta = {}) => {
    if (!id) return
    const exists = fundWatchlist.some((item) => item.id === id)
    const next = exists
      ? fundWatchlist.filter((item) => item.id !== id)
      : [
        ...fundWatchlist,
        {
          id,
          name: meta.name || String(id),
          change: Number(meta.change || 0),
          trend: Number(meta.change || 0) >= 0 ? 'up' : 'down',
        },
      ]
    setFundWatchlist(next)

    const userId = session?.user?.id
    if (!userId) return
    const dbOp = exists
      ? removeDbWatchlistItem({ userId, itemType: 'fund', itemId: id })
      : addDbWatchlistItem({
        userId,
        itemType: 'fund',
        itemId: id,
        itemName: meta.name || String(id),
        metadata: { change: Number(meta.change || 0) },
      })
    dbOp.catch((err) => console.warn('fund watchlist sync failed:', err?.message || err))
  }

  const toggleProductInterest = (id, meta = {}) => {
    if (!id) return
    const exists = productInterests.some((item) => item.id === id)
    const next = exists
      ? productInterests.filter((item) => item.id !== id)
      : [
        ...productInterests,
        {
          id,
          name: meta.name || String(id),
          provider: meta.provider || '',
          category: meta.category || '',
        },
      ]
    setProductInterests(next)

    const userId = session?.user?.id
    if (!userId) return
    const dbOp = exists
      ? removeDbWatchlistItem({ userId, itemType: 'product', itemId: id })
      : addDbWatchlistItem({
        userId,
        itemType: 'product',
        itemId: id,
        itemName: meta.name || String(id),
        metadata: { provider: meta.provider || '', category: meta.category || '' },
      })
    dbOp.catch((err) => console.warn('product interest sync failed:', err?.message || err))
  }

  const RequireAuth = ({ children }) => {
    if (!authReady) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center">
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">認証情報を確認中...</p>
        </div>
      )
    }
    if (!session) return <Navigate to="/login" replace />
    return children
  }

  const RequireAdmin = ({ children }) => {
    if (!authReady || !roleReady) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center">
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">管理者権限を確認中...</p>
        </div>
      )
    }
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
        <Route
          path="/funds/:id"
          element={
            <FundDetailPage
              myWatchlist={fundWatchlist.map((item) => item.id)}
              toggleWatchlist={toggleFundWatchlist}
            />
          }
        />
        <Route path="/stocks" element={<StockPage />} />
        <Route
          path="/products"
          element={
            <ProductPage
              productInterestIds={productInterests.map((item) => item.id)}
              toggleProductInterest={toggleProductInterest}
            />
          }
        />
        <Route
          path="/products/:id"
          element={
            <ProductDetailPage
              productInterestIds={productInterests.map((item) => item.id)}
              toggleProductInterest={toggleProductInterest}
            />
          }
        />
        <Route path="/lounge" element={<LoungePage bootUser={currentUserProfile} authReady={authReady} />} />
        <Route path="/academy" element={<AcademyPage />} />
        <Route path="/prime" element={<PrimePage />} />
        <Route
          path="/mypage"
          element={
            <RequireAuth>
              <MyPage
                fundWatchlist={fundWatchlist}
                productInterests={productInterests}
                toggleFundWatchlist={toggleFundWatchlist}
                user={session?.user || null}
              />
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
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App
