import { useState } from 'react'
import {
  Check, Zap, Crown, ShieldCheck,
  TrendingUp, ArrowRight, Sparkles
} from 'lucide-react'

export default function PrimePage() {
  const [isYearly, setIsYearly] = useState(true)

  const handlePrimeStart = () => {
    alert('PRIME 결제 기능은 준비 중입니다。')
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-32">
      {/* 1. Hero Section */}
      <section className="pt-24 pb-20 px-6 text-center max-w-5xl mx-auto">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 text-orange-600 text-xs font-bold uppercase tracking-wider mb-8 animate-fadeIn">
          <Crown size={14} fill="currentColor" /> Premium Membership
        </span>

        <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter mb-6 leading-tight">
          資産運用の<br className="md:hidden" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-500">次元を変える。</span>
        </h1>

        <p className="text-lg md:text-xl text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed mb-12">
          AIによる高度な分析、リアルタイムの市場データ。<br />
          プロレベルの環境を、あなたの手に。
        </p>

        <div className="flex justify-center mb-16">
          <div className="bg-slate-200 p-1.5 rounded-full flex relative shadow-inner">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-8 py-3 rounded-full text-sm font-bold transition-all duration-300 z-10 ${!isYearly ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
            >
              月払い
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-8 py-3 rounded-full text-sm font-bold transition-all duration-300 z-10 flex items-center gap-2 ${isYearly ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
            >
              年払い <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full uppercase tracking-wide">Save 17%</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Pricing Card */}
      <section className="max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-8 mb-32 items-center">
        <div className="space-y-8 pl-4 md:pl-12">
          <h2 className="text-3xl font-black text-slate-900 leading-tight">
            ただのツールではありません。<br />
            <span className="text-orange-500">成功への投資</span>です。
          </h2>
          <div className="space-y-6">
            {[
              { title: 'AI ポートフォリオ診断', desc: 'あなたの資産状況を24時間365日モニタリング。最適なリバランスを提案します。' },
              { title: '米国株 リアルタイム株価', desc: '15分の遅延なし。機関投資家と同じタイミングで市場の動きを把握できます。' },
              { title: '会員限定レポート', desc: '毎朝配信されるプロのアナリストによる市場分析レポートが読み放題。' },
            ].map((item, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                  <Check size={24} strokeWidth={3} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">{item.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed font-medium mt-1">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative group">
          <div className="absolute -inset-4 bg-gradient-to-r from-orange-500 to-amber-500 rounded-[3rem] blur-2xl opacity-20 group-hover:opacity-30 transition duration-500" />

          <div className="relative bg-white rounded-[2.5rem] p-10 shadow-2xl border border-slate-100 overflow-hidden">
            <div className="absolute top-0 right-0 bg-orange-500 text-white text-xs font-bold px-4 py-2 rounded-bl-2xl">
              MOST POPULAR
            </div>

            <div className="mb-8">
              <p className="text-slate-500 font-bold uppercase tracking-wider text-xs mb-2">MoneyMart Prime</p>
              <div className="flex items-baseline gap-1">
                <span className="text-6xl font-black text-slate-900 tracking-tighter">
                  ¥{isYearly ? '9,800' : '980'}
                </span>
                <span className="text-slate-400 font-bold text-lg">
                  / {isYearly ? '年' : '月'}
                </span>
              </div>
              <p className="text-sm text-slate-400 font-medium mt-2">
                {isYearly ? '月額換算 ¥816 (2ヶ月分無料)' : 'いつでも解約可能'}
              </p>
            </div>

            <button
              onClick={handlePrimeStart}
              className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 flex items-center justify-center gap-2 mb-6"
            >
              <Zap size={20} className="text-yellow-400 fill-yellow-400" />
              30日間 無料で試す
            </button>

            <p className="text-center text-xs text-slate-400 font-bold">
              無料期間終了の3日前に通知します。<br />勝手に課金されることはありません。
            </p>
          </div>
        </div>
      </section>

      {/* 3. Feature Grid (Bento Style) */}
      <section className="max-w-6xl mx-auto px-6 mb-24">
        <h2 className="text-center text-2xl font-black text-slate-900 mb-12">
          すべての機能が、<br />あなたの資産を加速させる。
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-lg hover:shadow-xl transition">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
              <TrendingUp size={28} />
            </div>
            <h3 className="font-bold text-xl text-slate-900 mb-2">高度なチャート分析</h3>
            <p className="text-slate-500 text-sm font-medium leading-relaxed">
              TradingView有料版相当のインジケーターが使い放題。
            </p>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-lg hover:shadow-xl transition">
            <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-6">
              <Sparkles size={28} />
            </div>
            <h3 className="font-bold text-xl text-slate-900 mb-2">AI ロボアドバイザー</h3>
            <p className="text-slate-500 text-sm font-medium leading-relaxed">
              市場変動に合わせて、最適なポートフォリオを自動提案。
            </p>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-lg hover:shadow-xl transition">
            <div className="w-14 h-14 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-6">
              <ShieldCheck size={28} />
            </div>
            <h3 className="font-bold text-xl text-slate-900 mb-2">広告完全非表示</h3>
            <p className="text-slate-500 text-sm font-medium leading-relaxed">
              ストレスのない快適な取引環境を提供します。
            </p>
          </div>
        </div>
      </section>

      {/* 4. Comparison Table */}
      <section className="max-w-4xl mx-auto px-6 mb-20">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-6 text-sm text-slate-500 font-bold w-1/3">機能比較</th>
                <th className="p-6 text-center w-1/3 font-bold text-slate-500">Free</th>
                <th className="p-6 text-center w-1/3 font-black text-orange-600 bg-orange-50/50">PRIME</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { name: 'リアルタイム株価', free: false, prime: true },
                { name: 'AI ポートフォリオ診断', free: false, prime: true },
                { name: 'ウォッチリスト登録数', free: '10件', prime: '無制限' },
                { name: '広告表示', free: 'あり', prime: 'なし' },
                { name: 'カスタマーサポート', free: 'メール', prime: '優先チャット' },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition">
                  <td className="p-5 text-sm font-bold text-slate-700">{row.name}</td>
                  <td className="p-5 text-center">
                    {row.free === false ? <div className="w-1 h-1 bg-slate-300 rounded-full mx-auto" /> : row.free}
                  </td>
                  <td className="p-5 text-center bg-orange-50/30">
                    {row.prime === true ? <Check size={20} className="mx-auto text-orange-500" strokeWidth={3} /> : <span className="font-bold text-slate-900">{row.prime}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. Footer CTA */}
      <section className="text-center pb-20 px-6">
        <p className="text-slate-400 font-bold text-sm mb-4">
          まずは30日間、無料でお試しください。
        </p>
        <button
          onClick={handlePrimeStart}
          className="text-slate-900 font-black hover:text-orange-600 transition flex items-center justify-center gap-1 mx-auto"
        >
          すべての機能を見る <ArrowRight size={16} />
        </button>
      </section>
    </div>
  )
}
