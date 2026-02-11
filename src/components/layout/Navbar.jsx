import { Link, useNavigate } from 'react-router-dom'
import { Menu, X, LogIn, Sun, Moon } from 'lucide-react'
import { useState } from 'react'

export default function Navbar({ darkMode, onToggleDarkMode }) {
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const productCategories = [
    { name: '預金・貯金', id: 'savings' },
    { name: 'ローン', id: 'loans' },
    { name: 'クレジットカード', id: 'cards' },
    { name: 'ポイント', id: 'points' },
    { name: '旅行保険', id: 'insurance' },
  ]

  return (
    <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* 1. ロゴ & メインメニュー */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex-shrink-0 flex items-start -space-x-0.5">
              {/* 돋보기 + ¥ 아이콘 (상단 M과 정렬) */}
              <svg className="w-10 h-10 text-orange-500 flex-shrink-0" viewBox="0 6 40 38" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="18" cy="20" r="12" stroke="currentColor" strokeWidth="2.5" fill="none" />
                <path d="M10 28l-8 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <text x="18" y="24" textAnchor="middle" fontSize="16" fontWeight="bold" fill="currentColor" fontFamily="system-ui, sans-serif">¥</text>
              </svg>
              <div className="flex flex-col">
                <span className="text-xl font-black text-orange-500 tracking-tight leading-tight">MoneyMart</span>
                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400 leading-tight">Compare, Choose, Save.</span>
              </div>
            </Link>

            {/* デスクトップメニュー（左） */}
            <div className="hidden md:flex items-center gap-6 text-sm font-bold text-slate-600 dark:text-slate-300">
              <Link to="/market" className="hover:text-orange-500 transition">マーケット</Link>

              <Link to="/funds" className="hover:text-orange-500 transition">ファンド</Link>

              <Link to="/stocks" className="hover:text-orange-500 transition">株式</Link>

              <Link to="/products" className="hover:text-orange-500 transition">金融商品</Link>
            </div>
          </div>

          {/* 2. 右側メニュー */}
          <div className="hidden md:flex items-center gap-4">
            <Link to="/lounge" className="text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">ラウンジ</Link>
            <Link to="/academy" className="text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">アカデミー</Link>

            <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-2" />

            <Link to="/prime" className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 hover:opacity-80 transition">
              PRIME加入
            </Link>

            <button
              onClick={onToggleDarkMode}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <Link to="/mypage" className="text-sm font-bold text-slate-500 hover:text-orange-500 dark:text-slate-400 dark:hover:text-orange-500 transition">
              マイページ
            </Link>
            <button
              onClick={() => navigate('/login')}
              className="bg-slate-900 hover:bg-black dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white px-5 py-2 rounded-full text-sm font-bold transition shadow-lg flex items-center gap-2"
            >
              <LogIn size={16} /> ログイン
            </button>
          </div>

          {/* モバイルメニューボタン */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={onToggleDarkMode}
              className="p-2 text-slate-600 dark:text-white"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-slate-600 dark:text-white p-2"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* モバイルメニュー */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 p-4 space-y-4 shadow-xl">
          <Link to="/market" onClick={() => setIsMobileMenuOpen(false)} className="block font-bold text-lg">マーケット</Link>
          <Link to="/funds" onClick={() => setIsMobileMenuOpen(false)} className="block font-bold text-lg">ファンド</Link>
          <Link to="/stocks" onClick={() => setIsMobileMenuOpen(false)} className="block font-bold text-lg">株式</Link>

          <div className="space-y-2 pl-4 border-l-2 border-slate-100 dark:border-slate-700">
            <p className="text-xs text-slate-400 font-bold mb-2">金融商品</p>
            {productCategories.map((cat) => (
              <Link
                key={cat.id}
                to={`/products?category=${cat.id}`}
                onClick={() => setIsMobileMenuOpen(false)}
                className="block text-slate-600 dark:text-slate-300 py-1"
              >
                {cat.name}
              </Link>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3">
            <Link to="/mypage" onClick={() => setIsMobileMenuOpen(false)} className="block font-bold text-orange-500">マイページ</Link>
            <Link to="/lounge" onClick={() => setIsMobileMenuOpen(false)} className="block font-bold">ラウンジ</Link>
            <Link to="/academy" onClick={() => setIsMobileMenuOpen(false)} className="block font-bold">アカデミー</Link>
            <Link to="/prime" onClick={() => setIsMobileMenuOpen(false)} className="block font-black text-yellow-500">PRIMEメンバーシップ</Link>
            <button
              onClick={() => { navigate('/login'); setIsMobileMenuOpen(false); }}
              className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
            >
              <LogIn size={20} /> ログイン / 会員登録
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
