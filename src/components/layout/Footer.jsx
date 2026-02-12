import { useNavigate, Link, useLocation } from 'react-router-dom'
import {
  ShieldCheck, HelpCircle, FileText, Lock,
  Home, TrendingUp, PieChart, Package, MessageCircle,
  Globe
} from 'lucide-react'

const mobileNavItems = [
  { to: '/', icon: Home, label: 'ホーム' },
  { to: '/market', icon: TrendingUp, label: 'マーケット' },
  { to: '/funds', icon: PieChart, label: 'ファンド' },
  { to: '/products', icon: Package, label: '金融商品' },
  { to: '/lounge', icon: MessageCircle, label: 'ラウンジ' },
]

export default function Footer() {
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <>
      {/* Desktop Footer */}
      <footer className="hidden md:block bg-[#0F172A] text-slate-300 pt-8 pb-6 font-sans border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 mb-6">
            <div className="col-span-2 lg:col-span-2">
              <Link to="/" className="flex-shrink-0 flex items-start -space-x-0.5 mb-3">
                <svg className="w-10 h-10 text-orange-500 flex-shrink-0" viewBox="0 6 40 38" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="18" cy="20" r="12" stroke="currentColor" strokeWidth="2.5" fill="none" />
                  <path d="M10 28l-8 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  <text x="18" y="24" textAnchor="middle" fontSize="16" fontWeight="bold" fill="currentColor" fontFamily="system-ui, sans-serif">¥</text>
                </svg>
                <div className="flex flex-col">
                  <span className="text-xl font-black text-orange-500 tracking-tight leading-tight">MoneyMart</span>
                  <span className="text-[10px] font-medium text-slate-400 leading-tight">Compare, Choose, Save.</span>
                </div>
              </Link>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
                日本最大級の金融商品比較・資産管理プラットフォーム。
              </p>
            </div>

            <div>
              <h4 className="font-bold text-white text-sm mb-3">サービス</h4>
              <ul className="space-y-2 text-xs font-medium">
                <li><button onClick={() => navigate('/funds')} className="hover:text-orange-400 transition">投資信託・ファンド</button></li>
                <li><button onClick={() => navigate('/stocks')} className="hover:text-orange-400 transition">株式・マーケット</button></li>
                <li><button onClick={() => navigate('/products')} className="hover:text-orange-400 transition">カード・ローン比較</button></li>
                <li><button onClick={() => navigate('/products')} className="hover:text-orange-400 transition">保険見直し</button></li>
                <li><button onClick={() => navigate('/mypage')} className="hover:text-orange-400 transition flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full" /> AI 資産診断</button></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white text-sm mb-3">サポート・運営</h4>
              <ul className="space-y-2 text-xs font-medium">
                <li><button onClick={() => navigate('/about')} className="hover:text-white transition">運営会社 (About Us)</button></li>
                <li><button onClick={() => navigate('/faq')} className="hover:text-white transition flex items-center gap-2"><HelpCircle size={12} /> ヘルプセンター</button></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white text-sm mb-3">規約・ポリシー</h4>
              <ul className="space-y-2 text-xs font-medium">
                <li><button onClick={() => navigate('/legal/terms')} className="hover:text-white transition flex items-center gap-2"><FileText size={12} /> 利用規約</button></li>
                <li><button onClick={() => navigate('/legal/privacy')} className="hover:text-white transition flex items-center gap-2"><Lock size={12} /> プライバシーポリシー</button></li>
                <li><button onClick={() => navigate('/legal/security')} className="hover:text-white transition flex items-center gap-2"><ShieldCheck size={12} /> セキュリティ宣言</button></li>
                <li><button onClick={() => navigate('/legal/solicitation')} className="hover:text-white transition">勧誘方針</button></li>
                <li><button onClick={() => navigate('/legal/antisocial')} className="hover:text-white transition">反社会的勢力への対応</button></li>
              </ul>
            </div>
          </div>

          <div className="bg-slate-900 rounded-lg p-4 border border-slate-800 mb-6">
            <h5 className="font-bold text-slate-200 text-[10px] mb-1.5 flex items-center gap-2">
              <ShieldCheck size={12} className="text-orange-500" /> 免責事項 (Disclaimer)
            </h5>
            <p className="text-[10px] leading-relaxed text-slate-500 text-justify">
              ※ 本サービスは金融商品の比較・情報提供を目的としており、特定の商品の勧誘を目的とするものではありません。<br />
              ※ 投資に関する最終決定は、お客様ご自身の判断でなさるようお願いいたします。<br />
              ※ 本サービスで提供しているデータ・情報については、万全を期しておりますが、その内容を保証するものではありません。
              万が一、本サービスの情報に基づいて被ったいかなる損害についても、当社は一切の責任を負いかねます。<br />
              ※ 実際の取引条件や商品詳細は、各金融機関の公式サイトにて必ずご確認ください。
            </p>
          </div>

          <div className="border-t border-slate-800 pt-4 flex flex-col md:flex-row justify-between items-center gap-3">
            <p className="text-[10px] text-slate-500 font-medium">© 2026 MoneyLab Ltd.</p>
            <div className="flex items-center gap-4">
              <span className="text-[9px] text-slate-600 border border-slate-700 px-2 py-0.5 rounded">
                金融商品取引業者 関東財務局長（金商）第1234号
              </span>
              <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1"><Globe size={12} /> Japan</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile Footer (Compact) */}
      <footer className="md:hidden bg-[#0F172A] text-slate-300 pt-6 pb-24 font-sans border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <Link to="/" className="flex-shrink-0 flex items-start -space-x-0.5 mb-3">
            <svg className="w-8 h-8 text-orange-500 flex-shrink-0" viewBox="0 6 40 38" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="18" cy="20" r="12" stroke="currentColor" strokeWidth="2.5" fill="none" />
              <path d="M10 28l-8 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <text x="18" y="24" textAnchor="middle" fontSize="16" fontWeight="bold" fill="currentColor" fontFamily="system-ui, sans-serif">¥</text>
            </svg>
            <div className="flex flex-col">
              <span className="text-lg font-black text-orange-500 tracking-tight leading-tight">MoneyMart</span>
              <span className="text-[9px] font-medium text-slate-400 leading-tight">Compare, Choose, Save.</span>
            </div>
          </Link>
          <div className="flex flex-wrap gap-3 text-[11px] font-medium mb-2">
            <button onClick={() => navigate('/funds')} className="hover:text-orange-400">ファンド</button>
            <button onClick={() => navigate('/products')} className="hover:text-orange-400">金融商品</button>
            <button onClick={() => navigate('/faq')} className="hover:text-orange-400">FAQ</button>
            <button onClick={() => navigate('/mypage')} className="hover:text-orange-400">AI診断</button>
            <button onClick={() => navigate('/legal/terms')} className="hover:text-orange-400">利用規約</button>
            <button onClick={() => navigate('/legal/privacy')} className="hover:text-orange-400">プライバシー</button>
          </div>
          <p className="text-[9px] text-slate-500">© 2026 MoneyLab Ltd.</p>
        </div>
      </footer>

      {/* Mobile Bottom Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 safe-area-pb">
        <div className="flex justify-around items-center h-16 px-2">
          {mobileNavItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center justify-center flex-1 py-1 min-w-0 ${
                isActive(to) ? 'text-orange-500' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon size={24} strokeWidth={isActive(to) ? 2.5 : 1.5} />
              <span className="text-xs mt-0.5 truncate max-w-full">{label}</span>
            </Link>
          ))}
        </div>
      </nav>

      <div className="md:hidden h-16" />
    </>
  )
}
