import {
  Building2, Target, CheckCircle2, ChevronRight
} from 'lucide-react'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-200 pb-20">
      {/* 1. Hero Section */}
      <section className="relative h-[500px] flex items-center justify-center bg-slate-50 dark:bg-slate-900 overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white dark:to-slate-950 z-0" />
        <div className="relative z-10 text-center max-w-4xl px-6 animate-fadeIn">
          <span className="inline-block py-1 px-3 border border-slate-300 dark:border-slate-600 rounded-full text-xs font-bold text-slate-500 dark:text-slate-400 mb-6 bg-white dark:bg-slate-800 uppercase tracking-widest">
            Our Vision
          </span>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-6 leading-tight">
            金融情報の不透明性をなくし、<br />
            <span className="text-orange-600 dark:text-orange-400">誰もが主役になれる</span>金融社会へ。
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 font-medium leading-loose max-w-2xl mx-auto">
            MoneyMartは、<span className="font-bold text-slate-700 dark:text-slate-300">独立系</span>・AIを活用し、中立・公正な立場で最適な金融商品を提案する<br />
            日本発のAI金融プラットフォームです。
          </p>
        </div>
      </section>

      {/* 2. Mission & Values */}
      <section className="py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4">私たちの使命と価値観</h2>
          <div className="w-12 h-1 bg-orange-500 mx-auto rounded-full" />
        </div>
        <div className="grid md:grid-cols-2 gap-12 items-center mb-24">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-10 rounded-[2rem] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-100 dark:bg-orange-900/20 rounded-full -mr-10 -mt-10 blur-2xl" />
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3">
              <Target className="text-orange-500" /> Mission
            </h3>
            <p className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-6 leading-relaxed">
              「金融アドバイスの民主化」
            </p>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              一部の富裕層だけのものであった「質の高い金融アドバイス」を、<span className="font-semibold text-slate-700 dark:text-slate-300">AI</span>の力ですべての人に届けます。金融機関と資本提携を持たない<span className="font-semibold text-slate-700 dark:text-slate-300">独立系</span>として、情報の非対称性を解消し、誰もが納得して資産形成できる世界を作ります。
            </p>
          </div>
          <div className="space-y-6">
            {[
              { title: '独立系 (Independent)', desc: '金融機関との資本提携を持たず、完全に中立な立場でアドバイスを提供します。' },
              { title: '中立・公正 (Fairness)', desc: '金融機関の手数料に左右されず、ユーザーにとって本当に良い商品だけを提案します。' },
              { title: 'AI駆動', desc: 'AIを活用し、個人の状況に最適化された金融アドバイスを誰もが利用できるようにします。' },
              { title: '透明性 (Transparency)', desc: 'コストやリスクを隠さず、全ての情報をオープンにします。' },
              { title: 'ユーザーファースト', desc: 'すべての意思決定において、ユーザーの利益を最優先します。' },
            ].map((item, i) => (
              <div key={i} className="flex gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                <div className="w-10 h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center shrink-0 text-orange-500 shadow-sm">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-lg mb-1">{item.title}</h4>
                  <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. CEO Message */}
      <section className="bg-slate-50 dark:bg-slate-900/50 py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row gap-12 items-center bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 md:p-12 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-800">
            <div className="md:w-1/3 text-center">
              <div className="w-48 h-48 mx-auto bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-6 relative">
                <div className="absolute inset-0 flex items-center justify-center bg-slate-800 text-white text-4xl font-black">KN</div>
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Kelly Nam</h3>
              <p className="text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-widest mt-1">Founder & CEO</p>
            </div>
            <div className="md:w-2/3 relative">
              <div className="text-6xl text-slate-200 dark:text-slate-700 absolute -top-8 -left-4 font-serif">"</div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 leading-snug">
                テクノロジーと金融の融合で、<br />日本の資産運用を変革する。
              </h3>
              <div className="space-y-4 text-slate-600 dark:text-slate-400 leading-relaxed text-justify">
                <p>創業以来、私たちは「わかりにくい金融を、もっとシンプルに」という想いで走り続けてきました。</p>
                <p>グローバル金融機関での経験と最新の<strong>AI</strong>テクノロジーを掛け合わせることで、これまで専門家しかアクセスできなかった高度な分析を、スマートフォンの画面一つで提供できるようにしました。<strong>独立系</strong>として、金融機関の利害に左右されない公正なアドバイスを届けています。</p>
                <p>MoneyMartは単なる比較サイトではありません。あなたの人生に寄り添う、最も信頼できる金融パートナーを目指しています。</p>
              </div>
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="font-serif italic text-slate-400">MoneyLab Ltd.</span>
                <span className="font-serif italic text-2xl text-slate-800 dark:text-slate-200 font-bold">Kelly Nam</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Company Profile */}
      <section className="py-24 px-6 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-black text-slate-900 dark:text-white flex items-center justify-center gap-3">
            <Building2 className="text-slate-400" /> 会社概要
          </h2>
        </div>
        <div className="border-t border-slate-200 dark:border-slate-800">
          {[
            { label: '会社名', value: 'MoneyLab Ltd. (MoneyMart運営会社)' },
            { label: '代表者', value: '代表取締役 Kelly Nam' },
            { label: '設立', value: '2025年 12月' },
            { label: '資本金', value: '5,000万円（資本準備金含む）' },
            { label: '所在地', value: '〒106-0032 東京都港区六本木 1-4-5 アークヒルズサウスタワー' },
            { label: '事業内容', value: '金融商品比較プラットフォーム「MoneyMart」の運営\nAI資産管理ツールの開発・提供' },
            { label: '登録番号', value: '金融商品取引業者 関東財務局長（金商）第1234号' },
            { label: '主要取引銀行', value: '三菱UFJ銀行、三井住友銀行、みずほ銀行' },
          ].map((row, i) => (
            <div key={i} className="flex flex-col md:flex-row py-5 border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition px-4">
              <div className="md:w-1/3 font-bold text-slate-500 dark:text-slate-400 text-sm py-1 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" /> {row.label}
              </div>
              <div className="md:w-2/3 font-medium text-slate-900 dark:text-slate-200 whitespace-pre-line">
                {row.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Bottom CTA */}
      <section className="bg-slate-900 dark:bg-slate-950 text-white py-20 px-6 text-center">
        <h2 className="text-2xl md:text-3xl font-black mb-6">私たちと一緒に働きませんか？</h2>
        <p className="text-slate-400 mb-10 max-w-xl mx-auto">
          MoneyLabでは、金融の未来を創る仲間を募集しています。<br />
          エンジニア、マーケター、金融スペシャリストをお待ちしています。
        </p>
        <button className="bg-white text-slate-900 px-8 py-4 rounded-full font-bold hover:bg-orange-50 transition flex items-center gap-2 mx-auto">
          採用情報を見る <ChevronRight size={18} />
        </button>
      </section>
    </div>
  )
}
