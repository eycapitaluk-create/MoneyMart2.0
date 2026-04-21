import { useNavigate, Link, useLocation } from 'react-router-dom'
import {
  ShieldCheck, HelpCircle, FileText, Lock,
  Home, TrendingUp, PieChart, Package, BookOpen,
  Globe, Sparkles,
} from 'lucide-react'

// Phase 1: 金融商品・アカデミーを非表示（ローンチ後に表示）
const PHASE1_HIDE_PRODUCTS_ACADEMY = true

const mobileNavItems = [
  { to: '/', icon: Home, label: 'ホーム' },
  { to: '/market', icon: TrendingUp, label: 'マーケット' },
  { to: '/funds', icon: PieChart, label: 'ファンド' },
  { to: '/products', icon: Package, label: '金融商品' },
  { to: '/insights', icon: BookOpen, label: 'インサイト' },
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
              <Link to="/" className="flex-shrink-0 flex items-center gap-1.5 mb-3">
                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 text-white text-2xl font-black leading-none flex items-center justify-center">
                  M
                </span>
                <div className="flex flex-col items-center text-center">
                  <span className="text-xl font-black text-orange-500 tracking-tight leading-tight">MoneyMart</span>
                  <span className="text-[10px] font-medium text-slate-400 leading-tight">My Money, My Future</span>
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
                {!PHASE1_HIDE_PRODUCTS_ACADEMY && (
                  <>
                    <li><button onClick={() => navigate('/products')} className="hover:text-orange-400 transition">カード・ローン比較</button></li>
                    <li><button onClick={() => navigate('/products')} className="hover:text-orange-400 transition">保険見直し</button></li>
                  </>
                )}
                <li><button onClick={() => navigate('/mypage')} className="hover:text-orange-400 transition flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full" /> AI 資産診断</button></li>
                <li><button onClick={() => navigate('/premium')} className="hover:text-amber-400 transition flex items-center gap-1.5"><Sparkles size={12} className="text-amber-400 shrink-0" aria-hidden /> プレミアム会員</button></li>
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
                <li><button onClick={() => navigate('/legal/disclaimer')} className="hover:text-white transition flex items-center gap-2"><ShieldCheck size={12} /> 免責事項</button></li>
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
              ※ 本サービスは、金融商品に関する一般的な情報提供および比較を目的としたものであり、金融商品取引法第2条第8項に定める金融商品取引業（投資助言・代理業を含む）には該当しません。特定の金融商品の取得・売却を勧誘・推奨するものではありません。<br />
              ※ 本サービスで提供するコンテンツの一部は、AI（人工知能）による自動生成または処理を含みます。情報の正確性・最新性の確保に努めておりますが、完全性・正確性を保証するものではありません。<br />
              ※ 投資に関するすべての最終判断は、お客様ご自身の責任において行ってください。本サービスの情報に基づき生じたいかなる損害についても、当社は責任を負いかねます。<br />
              ※ 実際の取引条件・商品詳細については、各金融機関の公式サイトまたは担当者にて必ずご確認ください。<br />
              ※ 本サービスの運営者（MoneyLab Ltd.）は、日本法に基づき設立された法人です。本サービスに関する準拠法は日本法とし、紛争が生じた場合は東京地方裁判所を第一審の専属的合意管轄裁判所とします。<br />
              ※ 個人情報の取扱いについては、
              <button type="button" onClick={() => navigate('/legal/privacy')} className="underline underline-offset-2 hover:text-slate-300">
                プライバシーポリシー
              </button>
              をご参照ください。<br />
              最終更新：2026年4月1日<br />
              © 2026 MoneyLab Ltd.
            </p>
          </div>

          <div className="border-t border-slate-800 pt-4 flex flex-col md:flex-row justify-between items-center gap-3">
            <p className="text-[10px] text-slate-500 font-medium">© 2026 MoneyLab Ltd.</p>
            <div className="flex items-center gap-4">
              <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1"><Globe size={12} /> Japan</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile Footer (Compact) */}
      <footer className="md:hidden bg-[#0F172A] text-slate-300 pt-6 pb-24 font-sans border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <Link to="/" className="flex-shrink-0 flex items-center gap-1.5 mb-3">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 text-white text-2xl font-black leading-none flex items-center justify-center">
              M
            </span>
            <div className="flex flex-col items-center text-center">
              <span className="text-lg font-black text-orange-500 tracking-tight leading-tight">MoneyMart</span>
              <span className="text-[9px] font-medium text-slate-400 leading-tight">My Money, My Future</span>
            </div>
          </Link>
          <div className="flex flex-wrap gap-3 text-[11px] font-medium mb-2">
            <button onClick={() => navigate('/funds')} className="hover:text-orange-400">ファンド</button>
            {!PHASE1_HIDE_PRODUCTS_ACADEMY && (
              <button onClick={() => navigate('/products')} className="hover:text-orange-400">金融商品</button>
            )}
            <button onClick={() => navigate('/faq')} className="hover:text-orange-400">FAQ</button>
            <button onClick={() => navigate('/mypage')} className="hover:text-orange-400">AI診断</button>
            <button onClick={() => navigate('/premium')} className="hover:text-amber-400">プレミアム</button>
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
