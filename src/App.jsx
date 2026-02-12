import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
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
import RoboPage from './pages/RoboPage'
import MyPage from './pages/MyPage'
import LegalPage from './pages/LegalPage'
import FAQPage from './pages/FAQPage'
import AboutPage from './pages/AboutPage'

const App = () => {
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

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
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
        <Route path="/lounge" element={<LoungePage />} />
        <Route path="/academy" element={<AcademyPage />} />
        <Route path="/prime" element={<PrimePage />} />
        <Route path="/robo" element={<RoboPage />} />
        <Route path="/mypage" element={<MyPage fundWatchlist={fundWatchlist} />} />
        <Route path="/legal/faq" element={<Navigate to="/faq" replace />} />
        <Route path="/legal/:type" element={<LegalPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
    </Routes>
  )
}

export default App
