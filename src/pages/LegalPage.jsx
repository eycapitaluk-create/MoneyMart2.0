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
        <p>
          この利用規約（以下「本規約」）は、MoneyLab Ltd.（以下「当社」）が提供する本サービス「MoneyMart」の利用条件を定めるものです。
          ユーザーは本サービスを利用することにより、本規約に同意したものとみなします。
        </p>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第1条 定義</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>「本サービス」とは、当社が運営するウェブサービス「MoneyMart」およびこれに付随するすべての機能を指します。</li>
            <li>「ユーザー」とは、本サービスを利用するすべての方を指します。</li>
            <li>「会員」とは、会員登録を行いアカウントを保有するユーザーを指します。</li>
          </ul>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第2条 会員登録</h3>
          <p>会員登録を希望するユーザーは、当社の定める方法により登録申請を行うものとします。当社は、以下の場合に登録を拒否または取り消すことができます。</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>虚偽の情報を申告した場合</li>
            <li>過去に本規約違反により登録を取り消されたことがある場合</li>
            <li>その他当社が不適切と判断した場合</li>
          </ul>
          <p className="mt-2">アカウントの管理はユーザーの責任において行うものとし、第三者への譲渡・共有は禁止します。</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第3条 免責事項</h3>
          <p>当社は、本サービスに掲載される情報の正確性について万全を期していますが、その完全性・最新性を保証するものではありません。本サービスの情報に基づいてユーザーが被った損害について、当社は一切の責任を負いません。</p>
          <p className="mt-2">当社は、金融商品取引法に基づく投資助言業・投資運用業の登録を受けておらず、本サービスを通じて投資助言を提供するものではありません。投資の最終判断はユーザーご自身の責任において行ってください。</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第4条 有料サービス・料金</h3>
          <p>本サービスの一部機能については、有料プランへの加入が必要となる場合があります。有料プランの内容・料金・支払方法については、別途サービス内で定めるものとし、本規約の一部を構成します。</p>
          <p className="mt-2">当社は、有料プランの内容・料金を変更する場合、事前に合理的な期間をもってユーザーに通知します。</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第5条 禁止事項</h3>
          <p>ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>法令または公序良俗に違反する行為</li>
            <li>当社のサーバーやネットワークに過度の負担をかける行為</li>
            <li>不正アクセスまたはクラッキング行為</li>
            <li>他のユーザーの個人情報を不正に収集・利用する行為</li>
            <li>当社または第三者の知的財産権を侵害する行為</li>
            <li>当社の信用・名誉を毀損する行為</li>
            <li>商業目的での本サービスの無断利用・転用</li>
            <li>反社会的勢力への利益供与その他の協力行為</li>
            <li>その他当社が不適切と判断する行為</li>
          </ul>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第6条 知的財産権</h3>
          <p>本サービス上のコンテンツ（文章・画像・データ・デザイン・ロゴ等）に関する著作権その他の知的財産権は、当社または正当な権利者に帰属します。本規約に定める範囲を超えた複製・転載・二次利用は禁止します。</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第7条 サービスの変更・停止・終了</h3>
          <p>当社は、以下の場合に、事前の通知なく本サービスの全部または一部を変更・停止・終了することができます。</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>システムの保守・障害対応が必要な場合</li>
            <li>天災・感染症等の不可抗力が発生した場合</li>
            <li>その他当社が必要と判断した場合</li>
          </ul>
          <p className="mt-2">サービスの変更・停止・終了によってユーザーに生じた損害について、当社は責任を負いません。</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第8条 退会</h3>
          <p>会員は、当社所定の方法により退会することができます。退会後はアカウント情報が削除され、有料サービスの利用が停止されます。退会済みの期間に対する料金の返金は、別途定める返金ポリシーに従います。</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第9条 反社会的勢力の排除</h3>
          <p>ユーザーは、暴力団、暴力団員、暴力団関係企業・団体、その他反社会的勢力（以下「反社会的勢力」）に該当しないことを表明・保証します。当社は、ユーザーが反社会的勢力に該当すると判断した場合、事前通知なく登録を取り消すことができます。</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第10条 規約の変更</h3>
          <p>当社は、必要に応じて本規約を変更することができます。重要な変更を行う場合は、本サービス上での告知またはメールにて事前にお知らせします。変更後も本サービスを継続して利用した場合、変更後の規約に同意したものとみなします。</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第11条 準拠法・管轄裁判所</h3>
          <p>本規約は日本法に準拠します。本規約に関連して生じた紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。</p>
        </section>
      </div>
    ),
  },
  privacy: {
    title: 'プライバシーポリシー',
    icon: Lock,
    content: (
      <div className="space-y-6 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <p>MoneyLab Ltd.（以下「当社」）は、個人情報保護の重要性を認識し、個人情報の保護に関する法律（個人情報保護法）を遵守し、以下の通りプライバシーポリシーを定めます。</p>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第1条 個人情報の収集</h3>
          <p>当社は、ユーザーが本サービスを利用する際に、氏名、メールアドレス、資産情報等の個人情報を適正な手段で取得します。</p>
          <p className="mt-2">さらに、会員登録時または初回プロフィール設定時に、以下の内容を選択式でお伺いする場合があります。いずれもユーザー自身の認識に基づく自己申告であり、当社が金融資産の状況や適合性を検証したものではありません。</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>金融資産の割合に関するイメージ（預金中心／投資中心など）</li>
            <li>価格変動やリスクに対する考え方のイメージ</li>
            <li>投資・運用を想定する期間の目安</li>
          </ul>
          <p className="mt-2">上記は当社のデータベース（会員プロフィール）に紐づけて保存され、回答日時とあわせて記録される場合があります。</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第2条 利用目的</h3>
          <p>取得した個人情報は、本サービスの提供、本人確認、お問い合わせ対応、およびサービスの改善のために利用します。</p>
          <p className="mt-2">前項の会員登録時アンケート（投資プロフィール）については、サービス改善、コンテンツや機能の最適化、利用者属性の把握（統計的分析）の目的で利用します。個人を識別しない形式に加工した統計情報として取り扱う場合があります。</p>
          <p className="mt-2">当社は、当該情報をもって個別の投資助言、金融商品の適合性判断、または損益の約束を行うものではありません。</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第3条 第三者提供</h3>
          <p>当社は、法令に基づく場合を除き、ユーザーの同意なく個人情報を第三者に提供しません。ただし、以下の場合はこの限りではありません。</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>法令に基づき開示が求められる場合</li>
            <li>人の生命・身体・財産の保護のために必要がある場合</li>
            <li>公衆衛生の向上または児童の健全な育成のために必要がある場合</li>
          </ul>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第4条 安全管理措置</h3>
          <p>当社は、取得した個人情報について、不正アクセス・紛失・破壊・改ざん・漏洩等を防ぐため、以下の安全管理措置を講じます。</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>個人情報へのアクセス権限の管理および制限</li>
            <li>SSL/TLS等による通信の暗号化</li>
            <li>個人情報を取り扱う従業者への教育・監督</li>
            <li>定期的なセキュリティの点検・改善</li>
          </ul>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第5条 Cookieおよびアクセス解析</h3>
          <p>本サービスでは、利便性向上およびサービス改善を目的として、Cookie（クッキー）を使用しています。また、Googleアナリティクス等のアクセス解析ツールを利用する場合があります。これらのツールはトラフィックデータの収集のためにCookieを使用しますが、個人を特定する情報は含まれません。</p>
          <p className="mt-2">ブラウザの設定によりCookieを無効にすることができますが、一部のサービス機能がご利用いただけなくなる場合があります。</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第6条 個人情報の開示・訂正・削除</h3>
          <p>ユーザーは、当社が保有する自己の個人情報について、開示・訂正・削除・利用停止を求める権利を有します。ご請求の場合は、下記お問い合わせ窓口までご連絡ください。本人確認の上、合理的な期間内に対応いたします。</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第7条 プライバシーポリシーの変更</h3>
          <p>当社は、法令の改正や事業内容の変更等に伴い、本プライバシーポリシーを変更することがあります。重要な変更を行う場合は、本サービス上での告知またはメールにて事前にお知らせします。変更後のポリシーは、本サービス上に掲載した時点で効力を生じるものとします。</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第8条 お問い合わせ窓口</h3>
          <p>会社名: MoneyLab Ltd.</p>
          <p>個人情報保護責任者: 代表取締役 片桐 明子</p>
        </section>
      </div>
    ),
  },
  disclaimer: {
    title: '免責事項',
    icon: Shield,
    content: (
      <div className="space-y-6 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <p className="text-xs text-slate-500 dark:text-slate-400">最終更新：2026年4月11日</p>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第1条（情報提供の目的）</h3>
          <p>
            本サービス「MoneyMart」（以下「本サービス」）は、新NISA・ETF・投資信託に関する情報の比較・提供を目的としており、特定の金融商品の取得・売却を勧誘するものではありません。
          </p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第2条（投資判断に関する免責）</h3>
          <p>
            投資に関するすべての最終判断は、お客様ご自身の責任において行ってください。本サービスの情報のみに基づく投資判断を推奨するものではありません。
          </p>
          <p className="mt-2">
            過去の運用実績・配当実績・数値データは、将来の運用成果・利回りを保証するものではありません。市場環境の変化により、元本割れが生じる可能性があります。
          </p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第3条（データ・情報の正確性）</h3>
          <p>
            本サービスで提供するデータ・情報については正確性の確保に努めておりますが、その完全性・正確性・最新性を保証するものではありません。
            本サービスの情報に基づき生じたいかなる損害についても、当社は責任を負いかねます。
          </p>
          <p className="mt-2">
            実際の取引条件・商品詳細・信託報酬等については、各金融機関および運用会社の公式サイトにて必ずご確認ください。
          </p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第4条（金融商品取引業について）</h3>
          <p>
            本サービスは、金融商品取引法第2条第8項に定める金融商品取引業（投資助言・代理業および投資運用業を含む）に該当するサービスの提供を行うものではありません。特定の金融商品に関する投資助言・投資一任契約の締結、ならびに有価証券の売買の媒介・取次・代理は行っておりません。
          </p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第5条（NISA制度に関する注意事項）</h3>
          <p>
            NISAの非課税枠・税制上の取扱いは、ご利用者様個人の状況（保有口座数・投資額・利用金融機関等）により異なる場合があります。税務上の詳細については、管轄の税務署または税理士にご相談ください。
          </p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第6条（AIコンテンツに関する注意事項）</h3>
          <p>
            本サービスが提供する一部の情報・回答は、AI（人工知能）による自動生成または処理を含みます。AI生成コンテンツの性質上、情報に誤りが含まれる可能性があります。重要な判断を行う際は、必ず一次情報源または専門家にご確認ください。
          </p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第7条（外部リンク）</h3>
          <p>
            本サービスに掲載されている外部リンク先のコンテンツについて、当社は一切の責任を負いません。リンク先のサービス利用により生じた損害についても同様です。
          </p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第8条（個人情報の取扱い）</h3>
          <p>
            個人情報の取扱いについては、プライバシーポリシーをご参照ください。
          </p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第9条（準拠法および管轄裁判所）</h3>
          <p>
            本免責事項および本サービスの利用に関する準拠法は日本法とします。本サービスに関して紛争が生じた場合は、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
          </p>
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
            最終更新日: 2026年 3月 31日
          </p>
        </div>
      </div>
    </div>
  )
}
