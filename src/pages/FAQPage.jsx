import { useState, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import {
  Search, ChevronDown, ChevronUp, HelpCircle,
  Shield, CreditCard, FileText, Send,
  ArrowRight
} from 'lucide-react'

const FAQ_DATA = {
  general: {
    title: 'サービス全般',
    icon: HelpCircle,
    items: [
      { q: 'MoneyMartはどのようなサービスですか？', a: 'MoneyMartは、中立的な立場で金融商品（投資信託、クレジットカード、住宅ローンなど）を比較・シミュレーションできるプラットフォームです。AIは情報整理・可視化を補助しますが、特定商品の提案は行いません。' },
      { q: '利用料はかかりますか？', a: '基本的な機能（商品比較、ポートフォリオ管理、AI診断の簡易版）はすべて無料でご利用いただけます。より高度な分析機能やリアルタイム株価などを利用したい場合は、有料の「MoneyMart Prime」プランへの登録が必要です。' },
      { q: '証券口座の開設はできますか？', a: 'MoneyMart自体は証券会社ではないため、直接口座開設はできませんが、提携先の証券会社（SBI証券、楽天証券など）の開設ページへスムーズにご案内しています。' },
    ],
  },
  account: {
    title: 'アカウント・セキュリティ',
    icon: Shield,
    items: [
      { q: '個人情報の取り扱いは安全ですか？', a: 'はい。お客様のデータは金融機関レベルの暗号化技術（SSL/TLS）を用いて保護されています。また、資産データは閲覧専用（Read-only）で連携されるため、MoneyMartから資金が移動されることは絶対にありません。' },
      { q: '2段階認証は設定できますか？', a: 'はい、設定をおすすめしています。マイページの「設定」＞「セキュリティ」から、SMSまたは認証アプリによる2段階認証を設定可能です。' },
      { q: '退会したいのですが、データはどうなりますか？', a: '退会手続き完了後、お客様の個人情報および資産データは当社のサーバーから完全に削除されます。復元はできませんのでご注意ください。' },
    ],
  },
  prime: {
    title: '有料プラン (Prime)',
    icon: CreditCard,
    items: [
      { q: '無料期間中に解約した場合、料金は発生しますか？', a: 'いいえ。30日間の無料体験期間中に解約された場合、料金は一切発生しません。安心してお試しください。' },
      { q: '支払い方法を教えてください。', a: '各種クレジットカード（Visa, Mastercard, JCB, Amex, Diners）および、キャリア決済（d払い, auかんたん決済, ソフトバンクまとめて支払い）に対応しています。' },
      { q: '領収書の発行は可能ですか？', a: 'はい。マイページの「支払い履歴」からPDF形式の領収書をダウンロードいただけます。' },
    ],
  },
  nisa: {
    title: '投資・NISA',
    icon: FileText,
    items: [
      { q: '新NISAには対応していますか？', a: 'はい、完全対応しています。「つみたて投資枠」と「成長投資枠」それぞれのシミュレーションや、非課税枠の残り管理機能も提供しています。' },
      { q: '表示される株価はリアルタイムですか？', a: '無料プランでは15分〜20分遅延の株価が表示されます。MoneyMart Prime会員の方は、リアルタイム株価をご利用いただけます。' },
      { q: 'AIの分析結果は、必ず儲かりますか？', a: 'いいえ。MoneyMartのAI分析は過去データに基づく参考情報であり、将来の運用成果を保証するものではありません。投資の最終判断はご自身で行ってください。' },
    ],
  },
}

export default function FAQPage() {
  const faqStructuredData = useMemo(() => {
    const mainEntity = Object.values(FAQ_DATA).flatMap((section) => section.items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })))
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity,
    }
  }, [])

  const [activeTab, setActiveTab] = useState('general')
  const [openIndex, setOpenIndex] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  const filteredItems = FAQ_DATA[activeTab].items.filter(
    (item) => item.q.includes(searchQuery) || item.a.includes(searchQuery)
  )
  const [contactEmail, setContactEmail] = useState('')
  const [contactMessage, setContactMessage] = useState('')
  const [contactStatus, setContactStatus] = useState(null) // 'sending' | 'success' | 'error'
  const [contactError, setContactError] = useState('')

  const handleContactSubmit = async (e) => {
    e.preventDefault()
    setContactStatus('sending')
    setContactError('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: contactEmail.trim(), message: contactMessage.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setContactError(data?.error || '送信に失敗しました')
        setContactStatus('error')
        return
      }
      setContactStatus('success')
      setContactEmail('')
      setContactMessage('')
    } catch (err) {
      setContactError('送信に失敗しました。しばらくしてからお試しください。')
      setContactStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans pb-20">
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(faqStructuredData)}</script>
      </Helmet>
      {/* 1. Hero Search Section */}
      <div className="bg-slate-900 text-center py-20 px-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-orange-500 rounded-full blur-[100px] opacity-40" />

        <div className="relative z-10 max-w-2xl mx-auto">
          <span className="text-orange-400 font-bold text-xs tracking-widest uppercase mb-4 block">Help Center</span>
          <h1 className="text-3xl md:text-5xl font-black text-white mb-8">何かお困りですか？</h1>

          <div className="relative">
            <input
              type="text"
              placeholder="キーワードで検索 (例: NISA, 解約, 手数料...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-5 rounded-2xl text-lg font-bold text-slate-900 outline-none shadow-2xl focus:ring-4 focus:ring-orange-500/50 transition"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
          </div>
        </div>
      </div>

      {/* 2. Content Area */}
      <div className="max-w-4xl mx-auto px-6 -mt-10 relative z-20">
        {/* Category Tabs */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {Object.entries(FAQ_DATA).map(([key, data]) => {
            const Icon = data.icon
            const isActive = activeTab === key
            return (
              <button
                key={key}
                onClick={() => {
                  setActiveTab(key)
                  setOpenIndex(null)
                  setSearchQuery('')
                }}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition shadow-sm ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-orange-500/30 scale-105'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon size={18} />
                {data.title}
              </button>
            )
          })}
        </div>

        {/* FAQ List (Accordion) - key by tab + item so content updates when tab changes */}
        <div className="space-y-4" key={activeTab}>
          {filteredItems.length > 0 ? (
            filteredItems.map((item, index) => (
              <div
                key={`${activeTab}-${item.q.slice(0, 24)}`}
                className={`bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border transition duration-300 ${
                  openIndex === index
                    ? 'border-orange-200 dark:border-orange-900 shadow-lg'
                    : 'border-slate-100 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <span
                    className={`font-bold text-lg ${
                      openIndex === index ? 'text-orange-600 dark:text-orange-400' : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    Q. {item.q}
                  </span>
                  {openIndex === index ? (
                    <ChevronUp className="text-orange-500" />
                  ) : (
                    <ChevronDown className="text-slate-400" />
                  )}
                </button>

                {openIndex === index && (
                  <div className="px-6 pb-6 animate-fadeIn">
                    <div className="h-px w-full bg-slate-100 dark:bg-slate-800 mb-4" />
                    <div className="flex gap-3">
                      <span className="font-black text-orange-500 text-xl shrink-0">A.</span>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm md:text-base">
                        {item.a}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800">
              <HelpCircle size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 dark:text-slate-400 font-bold">検索結果が見つかりませんでした。</p>
              <p className="text-xs text-slate-400 mt-2">別のキーワードを試すか、下記よりお問い合わせください。</p>
            </div>
          )}
        </div>

        {/* 3. Still need help? (Contact Form) */}
        <div className="mt-20 text-center">
          <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6">解決しませんでしたか？</h3>
          <div className="max-w-xl mx-auto">
            <form
              onSubmit={handleContactSubmit}
              className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-orange-500/50 focus-within:border-orange-500 shadow-sm transition text-left"
            >
              <div className="w-12 h-12 bg-green-50 dark:bg-green-900/30 text-green-500 rounded-full flex items-center justify-center mb-4">
                <Send size={24} />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-1">フォームで問い合わせ</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">通常24時間以内に返信します。</p>

              <input
                type="email"
                required
                placeholder="メールアドレス"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm mb-3 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none"
              />
              <textarea
                required
                placeholder="お問い合わせ内容"
                rows={4}
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm mb-4 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none resize-none"
              />

              {contactStatus === 'success' && (
                <p className="text-green-600 dark:text-green-400 text-sm mb-3">送信しました。24時間以内にご返信いたします。</p>
              )}
              {contactStatus === 'error' && contactError && (
                <p className="text-red-600 dark:text-red-400 text-sm mb-3">{contactError}</p>
              )}

              <button
                type="submit"
                disabled={contactStatus === 'sending'}
                className="text-green-500 hover:text-green-600 text-xs font-bold flex items-center gap-1 disabled:opacity-50"
              >
                {contactStatus === 'sending' ? '送信中...' : 'フォームを送信'}
                <ArrowRight size={14} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
