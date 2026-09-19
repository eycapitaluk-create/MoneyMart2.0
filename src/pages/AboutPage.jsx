import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  Building2,
  Target,
  CheckCircle2,
  Shield,
  Sparkles,
  PieChart,
  CreditCard,
  BarChart3,
  Globe,
  Heart,
  Scale,
  Calendar,
  Mail,
  Briefcase,
  Lock,
} from 'lucide-react'
import {
  COMPANY_NAME_JA_EN,
  COMPANY_NAME_WITH_SERVICE,
  COMPANY_REPRESENTATIVE,
  COMPANY_ADDRESS,
  COMPANY_SUPPORT_EMAIL,
} from '../constants/companyLegal'

const SUPPORT_MAILTO = `mailto:${COMPANY_SUPPORT_EMAIL}`

const TEAM = [
  {
    initial: 'K',
    name: 'ケリー・ナム',
    nameEn: 'Kelly Nam',
    title: '最高戦略責任者（CSO）',
    bio: 'ロンドンのヘッジファンドや資産運用会社を含む、グローバル金融機関で18年の経験を持ち、国際市場とクロスボーダー金融戦略に深い専門知識を有しています。グローバルなベストプラクティスと日本のニーズを橋渡しする、利用者に合わせた情報整理を担当しています。',
  },
  {
    initial: 'J',
    name: 'ジャスティン・ナム',
    nameEn: 'Justin Nam',
    title: '最高技術責任者・最高マーケティング責任者（CTO / CMO）',
    bio: 'ジャガー・ランドローバー本社にて14カ国のマーケットオペレーションを統括し、損益最適化・販売戦略・サプライチェーン改革を推進。New Jaguarチームでは次世代モビリティの革新プロジェクトをリード。ロンドン大学バークベック校マーケティング修士。',
  },
  {
    initial: 'E',
    name: 'エレン',
    nameEn: 'Ellen',
    title: 'ビジネス戦略・日本市場スペシャリスト',
    bio: '韓国と日本で20年以上、コンテンツ・ゲーム・IT分野の戦略企画とグローバルパートナーシップを推進。ネイティブレベルの日本語と両国のビジネス文化への理解を活かし、サービスの日本展開を支援しています。',
  },
]

const SOLUTIONS = [
  { icon: PieChart, title: '投資信託・ETF', desc: 'ファンド一覧と実績データを並べて比較できます。' },
  { icon: CreditCard, title: 'クレジットカード', desc: 'ライフスタイルや利用額に合わせてカードを探せます。' },
  { icon: Shield, title: '保険', desc: 'カテゴリ別に保険商品の情報を比較できます。' },
  { icon: BarChart3, title: 'ポートフォリオツール', desc: '保有の整理・シミュレーション・追跡に使えます。' },
  { icon: Sparkles, title: 'AI分析', desc: '入力情報に基づく参考情報の整理を補助します。' },
  { icon: Building2, title: '銀行商品', desc: '預金・ローンなど銀行商品の比較情報を提供します。' },
]

const PROFILE_ROWS = [
  { label: '会社名', value: COMPANY_NAME_WITH_SERVICE },
  { label: '代表者', value: COMPANY_REPRESENTATIVE },
  { label: '設立', value: '2025年 12月' },
  { label: '資本金', value: '105万円' },
  { label: '所在地', value: COMPANY_ADDRESS },
  { label: '事業内容', value: 'データモニタリングシステムおよび分析ツールの提供、情報分析サービス、リスク管理支援ソリューションの開発・運営' },
  { label: '主要取引銀行', value: '三井住友銀行' },
  { label: 'お問い合わせ', value: COMPANY_SUPPORT_EMAIL },
]

export default function AboutPage() {
  const navigate = useNavigate()
  const { hash } = useLocation()

  useEffect(() => {
    if (hash === '#about-careers') {
      navigate('/careers', { replace: true })
      return
    }
    if (!hash) return
    const id = hash.replace(/^#/, '')
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash, navigate])

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-200 pb-20">
      <Helmet>
        <title>運営会社 | MoneyMart</title>
        <meta
          name="description"
          content="マネーラボ株式会社（MoneyLab Inc.）が運営するMoneyMartの会社概要・ミッション・チーム。お問い合わせは support@moneymart.co.jp です。"
        />
      </Helmet>

      <section className="relative overflow-hidden bg-slate-900 text-white">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] bg-[size:28px_28px]" />
        <div className="relative max-w-5xl mx-auto px-6 py-20 md:py-24 text-center">
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-100 border border-blue-400/30">
              <Shield size={12} /> 独立系
            </span>
            <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-[11px] font-bold bg-orange-500/20 text-orange-100 border border-orange-400/30">
              <Sparkles size={12} /> AI搭載
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black leading-tight mb-5">
            日本のための
            <span className="text-orange-400">公平な金融</span>
            プラットフォーム
          </h1>
          <p className="text-base md:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
            {COMPANY_NAME_JA_EN}は、独立系の金融比較プラットフォーム「MoneyMart」を運営しています。
            資本提携に左右されない立場で、データに基づく比較・確認の場をつくります。
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 text-xs font-bold text-slate-400">
            <span className="inline-flex items-center gap-1.5"><Lock size={13} /> 通信の暗号化</span>
            <span className="inline-flex items-center gap-1.5"><Globe size={13} /> 東京拠点</span>
          </div>
          <nav className="mt-10 flex flex-wrap justify-center gap-2 text-xs font-bold">
            {[
              ['#about-mission', 'ミッション'],
              ['#about-company', '会社概要'],
              ['#about-team', 'チーム'],
              ['#about-contact', 'お問い合わせ'],
            ].map(([href, label]) => (
              <a key={href} href={href} className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition">
                {label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => navigate('/careers')}
              className="px-3 py-1.5 rounded-full bg-orange-500 text-white hover:bg-orange-600 transition"
            >
              採用
            </button>
          </nav>
        </div>
      </section>

      <section className="bg-orange-50 dark:bg-slate-900 py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-4">なぜ独立性が重要なのか</h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            金融機関と資本提携を持たない独立系として、比較に必要な情報を中立に並べます。
            手数料や資本関係だけで順位を決めるのではなく、利用者が自分で確認できる表示を重視します。
          </p>
        </div>
      </section>

      <section id="about-mission" className="py-20 px-6 max-w-6xl mx-auto scroll-mt-20">
        <div className="text-center mb-12">
          <p className="text-xs font-bold tracking-wide text-orange-600 mb-2">私たちのミッション</p>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4">金融の力を、すべての人へ</h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            金融情報とツールへのアクセスをわかりやすくします。資産規模や経験に関わらず、
            納得のいく選択を自分で行いやすい社会を目指します。
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { icon: Globe, title: 'ユニバーサルアクセス', desc: '金融リテラシーと投資ツールへの障壁を下げ、誰でも使いやすくします。' },
            { icon: Heart, title: 'エンパワーメント', desc: '自ら考え、判断できる「自立した資産形成」のための知識とツールを提供します。' },
            { icon: Scale, title: '公平性', desc: 'プロも個人も関係なく、比較に必要な情報を公平に届けます。' },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-6">
              <item.icon className="text-orange-500 mb-3" size={22} />
              <h3 className="font-black text-slate-900 dark:text-white mb-2">{item.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-900 text-white py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-bold tracking-wide text-orange-400 mb-2">AI搭載プラットフォーム</p>
          <h2 className="text-2xl md:text-3xl font-black mb-4">私たちのビジョン</h2>
          <p className="text-slate-300 leading-relaxed">
            ユーザーファーストのAI搭載プラットフォームとして、多様な金融商品を一目で比較し、
            確認しやすい資産管理を目指します。
          </p>
          <p className="mt-6 text-sm text-slate-400 italic">
            「富や人脈に関係なく、誰もがプロ級の金融ツールにアクセスできる日本を目指します。」
          </p>
        </div>
      </section>

      <section className="py-20 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-xs font-bold tracking-wide text-orange-600 mb-2">ソリューション</p>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-3">あらゆる金融ニーズを、ひとつの場所で</h2>
          <p className="text-slate-600 dark:text-slate-400">個人向け金融商品を横断して比較・整理できる、中立的なデジタル金融プラットフォームです。</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SOLUTIONS.map((item) => (
            <div key={item.title} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900">
              <item.icon className="text-orange-500 mb-3" size={22} />
              <h3 className="font-bold text-slate-900 dark:text-white mb-1">{item.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 dark:bg-slate-900/50 py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2">会社の歩み</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">日本の投資家のための独立系プラットフォームとして、東京でスタートしました。</p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8">
            <div className="flex items-center gap-2 text-orange-600 font-bold text-sm mb-2">
              <Calendar size={16} /> 2025
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">東京で創業</h3>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              {COMPANY_NAME_JA_EN}は、日本の投資家のための独立系金融プラットフォームを創るというビジョンのもと、東京で設立されました。
              サービスブランドは MoneyMart です。
            </p>
          </div>
        </div>
      </section>

      <section id="about-team" className="py-20 px-6 max-w-6xl mx-auto scroll-mt-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2">チーム紹介</h2>
          <p className="text-slate-500 dark:text-slate-400">金融、テクノロジー、日本市場の実務を担うリーダーシップ</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {TEAM.map((member) => (
            <div key={member.name} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              <div className="w-14 h-14 rounded-full bg-orange-500 text-white font-black text-xl flex items-center justify-center mb-4">
                {member.initial}
              </div>
              <h3 className="font-black text-slate-900 dark:text-white">{member.name}</h3>
              <p className="text-xs text-slate-400 mb-1">{member.nameEn}</p>
              <p className="text-sm font-bold text-orange-600 dark:text-orange-400 mb-3">{member.title}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{member.bio}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="about-company" className="py-20 px-6 max-w-4xl mx-auto scroll-mt-20">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-slate-900 dark:text-white flex items-center justify-center gap-3">
            <Building2 className="text-slate-400" /> 会社概要
          </h2>
        </div>
        <p className="mb-8 max-w-2xl mx-auto text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          CSO は Kelly Nam が担当します。日本法人の登記上の代表者は
          <strong className="text-slate-700 dark:text-slate-300"> {COMPANY_REPRESENTATIVE}</strong>
          です。お問い合わせや法令に基づく表示は代表者名義で行います。
        </p>
        <div className="border-t border-slate-200 dark:border-slate-800">
          {PROFILE_ROWS.map((row) => (
            <div key={row.label} className="flex flex-col md:flex-row py-5 border-b border-slate-200 dark:border-slate-800 px-4">
              <div className="md:w-1/3 font-bold text-slate-500 dark:text-slate-400 text-sm py-1 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" /> {row.label}
              </div>
              <div className="md:w-2/3 font-medium text-slate-900 dark:text-slate-200">
                {row.label === 'お問い合わせ' ? (
                  <a href={SUPPORT_MAILTO} className="text-orange-600 hover:underline">{row.value}</a>
                ) : row.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 dark:bg-slate-900/50 py-16 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-5 text-center">
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
            <Target className="mx-auto text-orange-500 mb-2" size={22} />
            <h3 className="font-black text-slate-900 dark:text-white mb-2">発見</h3>
            <p className="text-sm text-slate-500">金融商品を横断して比較できます。</p>
          </div>
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
            <CheckCircle2 className="mx-auto text-orange-500 mb-2" size={22} />
            <h3 className="font-black text-slate-900 dark:text-white mb-2">コントロール</h3>
            <p className="text-sm text-slate-500">自己判断のためのツールと表示を用意します。</p>
          </div>
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
            <Shield className="mx-auto text-orange-500 mb-2" size={22} />
            <h3 className="font-black text-slate-900 dark:text-white mb-2">信頼</h3>
            <p className="text-sm text-slate-500">資本提携に左右されない独立系として運営します。</p>
          </div>
        </div>
      </section>

      <section id="about-contact" className="py-20 px-6 max-w-4xl mx-auto scroll-mt-20">
        <div className="rounded-3xl bg-orange-500 text-white p-8 md:p-10 text-center mb-8">
          <Briefcase className="mx-auto mb-3" size={28} />
          <h2 className="text-2xl font-black mb-3">パートナーシップのご案内</h2>
          <p className="text-orange-50 mb-6 text-sm md:text-base">
            取材・提携のご相談は、下記メールまでお願いします。
          </p>
          <a
            href={SUPPORT_MAILTO}
            className="inline-flex items-center gap-2 bg-white text-orange-600 px-6 py-3 rounded-full font-bold hover:bg-orange-50 transition"
          >
            <Mail size={16} /> {COMPANY_SUPPORT_EMAIL}
          </a>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <Mail className="text-orange-500 mb-3" size={22} />
          <h3 className="font-black text-slate-900 dark:text-white mb-2">お問い合わせ</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
            MoneyMartのご利用や会社へのご連絡は、サポート窓口へお願いします。
          </p>
          <a href={SUPPORT_MAILTO} className="block font-bold text-orange-600 hover:underline mb-3">
            {COMPANY_SUPPORT_EMAIL}
          </a>
          <button
            type="button"
            onClick={() => navigate('/faq')}
            className="text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-orange-600"
          >
            FAQ・お問い合わせフォームへ
          </button>
        </div>
      </section>
    </div>
  )
}
