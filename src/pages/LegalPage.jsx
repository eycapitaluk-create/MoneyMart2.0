import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Shield, FileText, Lock, Building, ArrowLeft } from 'lucide-react'

const LEGAL_CONTENTS = {
  company: {
    title: '運営会社 (About Us)',
    icon: Building,
    content: (
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
        <table className="w-full text-left border-collapse">
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            <tr><th className="py-3 font-bold w-32 text-slate-900 dark:text-white">会社名</th><td className="py-3">MoneyLab Ltd.（MoneyMart運営会社）</td></tr>
            <tr><th className="py-3 font-bold text-slate-900 dark:text-white">代表者</th><td className="py-3">代表取締役 Kelly Nam</td></tr>
            <tr><th className="py-3 font-bold text-slate-900 dark:text-white">所在地</th><td className="py-3">〒100-0004 東京都千代田区大手町1-1-1</td></tr>
            <tr><th className="py-3 font-bold text-slate-900 dark:text-white">設立</th><td className="py-3">2026年 1月</td></tr>
            <tr><th className="py-3 font-bold text-slate-900 dark:text-white">事業内容</th><td className="py-3">金融商品比較プラットフォームの企画・開発・運営</td></tr>
            <tr><th className="py-3 font-bold text-slate-900 dark:text-white">登録番号</th><td className="py-3">金融商品取引業者 関東財務局長（金商）第1234号</td></tr>
          </tbody>
        </table>
      </div>
    ),
  },
  terms: {
    title: '利用規約',
    icon: FileText,
    content: (
      <div className="space-y-6 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第1条（総則）</h3>
          <p>この利用規約（以下「本規約」）は、MoneyLab Ltd.（以下「当社」）が提供する本サービス「MoneyMart」の利用条件を定めるものです。</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第2条（免責事項）</h3>
          <p>当社は、本サービスに掲載される情報の正確性について万全を期していますが、その完全性を保証するものではありません。本サービスの情報に基づいてユーザーが被った損害について、当社は一切の責任を負いません。</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第3条（禁止事項）</h3>
          <p>ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。<br />1. 法令または公序良俗に違反する行為<br />2. 当社のサーバーに過度の負担をかける行為</p>
        </section>
        <p className="text-xs text-slate-400 mt-8">制定日：2026年2月11日</p>
      </div>
    ),
  },
  privacy: {
    title: 'プライバシーポリシー',
    icon: Lock,
    content: (
      <div className="space-y-6 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <p>MoneyLab Ltd.（以下「当社」）は、個人情報保護の重要性を認識し、以下の通りプライバシーポリシーを定めます。</p>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">1. 個人情報の収集</h3>
          <p>当社は、ユーザーが本サービスを利用する際に、氏名、メールアドレス、資産情報等の個人情報を適正な手段で取得します。</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">2. 利用目的</h3>
          <p>取得した個人情報は、本サービスの提供、本人確認、お問い合わせ対応、およびサービスの改善のために利用します。</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">3. 第三者提供</h3>
          <p>当社は、法令に基づく場合を除き、ユーザーの同意なく個人情報を第三者に提供しません。</p>
        </section>
      </div>
    ),
  },
  security: {
    title: 'セキュリティ宣言',
    icon: Shield,
    content: (
      <div className="space-y-6 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <p>MoneyMartはお客様の大切な資産情報を守るため、金融機関レベルのセキュリティ対策を実施しています。</p>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>SSL/TLS暗号化：</strong> 全ての通信を暗号化し、第三者による盗聴を防ぎます。</li>
          <li><strong>厳格なデータ管理：</strong> お客様の資産データは、インターネットから隔離されたセキュアな環境で保管されます。</li>
          <li><strong>24時間365日の監視：</strong> 専門のセキュリティチームがシステムの異常を常時監視しています。</li>
        </ul>
      </div>
    ),
  },
  solicitation: {
    title: '勧誘方針',
    icon: FileText,
    content: (
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
        <p>当社は、「金融商品の販売等に関する法律」に基づき、以下の勧誘方針を定めております。</p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>お客様の知識、経験、財産状況および目的に照らし、適切な商品の勧誘に努めます。</li>
          <li>お客様に誤解を招くような説明や、不確実な事項を断定的に告げるような行為はいたしません。</li>
          <li>深夜や早朝など、お客様のご迷惑となる時間帯や場所での勧誘は行いません。</li>
        </ol>
      </div>
    ),
  },
  antisocial: {
    title: '反社会的勢力への対応',
    icon: Shield,
    content: (
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
        <p>当社は、市民社会の秩序や安全に脅威を与える反社会的勢力に対し、以下の通り断固とした姿勢で臨みます。</p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>反社会的勢力とは、取引を含めた一切の関係を遮断します。</li>
          <li>反社会的勢力による不当要求に対しては、民事と刑事の両面から法的対応を行います。</li>
          <li>反社会的勢力への資金提供や裏取引は絶対に行いません。</li>
        </ol>
      </div>
    ),
  },
}

export default function LegalPage() {
  const { type } = useParams()
  const navigate = useNavigate()

  const data = LEGAL_CONTENTS[type] || LEGAL_CONTENTS.company
  const Icon = data.icon

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [type])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 pb-32 font-sans">
      <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden min-h-[600px]">
        <div className="bg-slate-900 p-8 text-white relative">
          <button
            onClick={() => navigate(-1)}
            className="absolute top-8 left-8 p-2 bg-white/10 rounded-full hover:bg-white/20 transition"
            aria-label="戻る"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex flex-col items-center justify-center pt-4">
            <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mb-4 text-white shadow-lg">
              <Icon size={32} />
            </div>
            <h1 className="text-2xl font-black">{data.title}</h1>
          </div>
        </div>

        <div className="p-8 md:p-12">
          {data.content}
        </div>

        <div className="px-8 pb-8 text-center border-t border-slate-100 dark:border-slate-800 pt-8">
          <p className="text-xs text-slate-400">
            本ページの内容は予告なく変更される場合があります。<br />
            最終更新日: 2026年 2月 11日
          </p>
        </div>
      </div>
    </div>
  )
}
