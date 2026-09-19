import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { Mail, Users } from 'lucide-react'
import { COMPANY_SUPPORT_EMAIL } from '../constants/companyLegal'

const CAREERS_MAILTO = `mailto:${COMPANY_SUPPORT_EMAIL}?subject=${encodeURIComponent('採用応募（通年採用）')}`
const CAREERS_B2B_MAILTO = `mailto:${COMPANY_SUPPORT_EMAIL}?subject=${encodeURIComponent('採用応募（ビジネスデベロップメントディレクター）')}`

const CAREERS_B2B_JD = {
  title: 'ビジネスデベロップメントディレクター（ウェルスマネジメント）',
  location: '勤務地： 日本国内（柔軟な勤務形態／リモート可。顧客訪問あり）',
  sections: [
    {
      heading: 'MoneyMartについて',
      paragraphs: [
        'MoneyMartは、ウェルスマネジメント会社、銀行、証券会社、IFA（独立系ファイナンシャルアドバイザー）向けの投資インテリジェンスプラットフォームを開発しています。',
        '当社のプラットフォームは、顧客ポートフォリオのモニタリング、リスクや投資機会の把握、投資レビューの準備、市場・金融商品に関する情報や分析へのアクセス、一貫性のある顧客レポートの効率的な作成を支援します。',
      ],
    },
    {
      heading: '募集ポジション',
      paragraphs: [
        'MoneyMartのB2Bプラットフォームにおける法人営業および事業開発をリードする、経験豊富なウェルスマネジメント業界のプロフェッショナルを募集します。',
        '本ポジションは、一般的なソフトウェア営業職ではありません。ウェルスマネジメント業界での実務経験を有し、アドバイザー、リレーションシップマネージャー、投資・運用チーム、金融機関における業務プロセスを深く理解していることが求められます。',
        'これまでの経験を活かして経営層や部門責任者との関係を構築し、各社のビジネスニーズを把握したうえで、MoneyMartがアドバイザーの業務効率、投資管理、顧客エンゲージメントおよびガバナンスをどのように改善できるかを提案していただきます。',
      ],
    },
    {
      heading: '主な業務内容',
      items: [
        'ウェルスマネジメント会社、銀行、証券会社およびIFAを対象としたB2B営業戦略の策定・実行',
        'ターゲットとなる金融機関の選定および質の高い営業パイプラインの構築',
        'ウェルスマネジメント、運用、アドバイザリー、デジタルトランスフォーメーション、コンプライアンス部門の責任者との関係構築',
        '顧客との商談、製品デモンストレーションおよび提案プレゼンテーションの実施',
        '各金融機関の投資プロセス、アドバイザーの業務フロー、ガバナンス要件およびオペレーション上の課題の把握',
        'MoneyMartの機能や強みを、見込み顧客ごとの具体的な事業成果やビジネス価値として提示',
        '初回アプローチ、ニーズ分析、パイロット導入、提案、条件交渉、契約締結までの営業プロセス全体の管理',
        '創業者およびプロダクトチームと連携したパイロット導入と導入計画の策定',
        '市場や顧客からのフィードバックの収集およびプロダクト開発の優先順位付けへの貢献',
        '戦略的パートナーシップおよび業界ネットワークの構築',
        '導入後の既存顧客との関係拡大および追加提案',
      ],
    },
    {
      heading: '必須経験・スキル',
      items: [
        'ウェルスマネジメント、プライベートバンキング、金融アドバイザリー、証券、資産運用、または関連分野における10年以上の実務経験',
        'ウェルスマネジメント事業における実務経験',
        'アドバイザーの業務フロー、ポートフォリオレビュー、金融商品、適合性管理、コンプライアンスおよび顧客レポーティングに関する深い理解',
        '事業開発、法人営業、機関投資家営業、リレーションシップマネジメント、または新規顧客・案件獲得における実績',
        '経営層と現場のウェルスマネジメント担当者の双方と、専門性と信頼性をもってコミュニケーションできる能力',
        '長期かつ複雑な法人営業プロセスを管理した経験',
        '日本のウェルスマネジメントまたは金融サービス業界における既存のネットワークや関係性',
      ],
    },
    {
      heading: '歓迎する経験・スキル',
      items: [
        '投資関連テクノロジー、ウェルスマネジメントプラットフォーム、金融データ、またはその他のB2B金融サービスの営業経験',
        'ウェルスマネージャー、プライベートバンカー、投資アドバイザー、投資スペシャリスト、またはウェルスマネジメントの商品・サービス企画責任者としての経験',
        '地方銀行、証券会社またはIFAとの業務経験',
        '法人顧客における調達プロセス、パイロット導入およびテクノロジー導入に関する知識',
        'ビジネスレベルの英語力があれば尚可。ただし必須ではありません',
      ],
    },
    {
      heading: '応募方法',
      paragraphs: [
        '履歴書または職務経歴書に加え、これまでのウェルスマネジメント業界での経験、関連する業界ネットワーク、およびB2B顧客や新規案件の獲得実績を簡潔にまとめた自己紹介文をご提出ください。',
      ],
    },
  ],
}

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-200 pb-20">
      <Helmet>
        <title>採用情報 | MoneyMart</title>
        <meta
          name="description"
          content="MoneyMartの採用情報。ウェルスマネジメント向けB2B営業・事業開発のビジネスデベロップメントディレクターを通年で募集しています。"
        />
      </Helmet>

      <section className="relative overflow-hidden bg-slate-900 text-white">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] bg-[size:28px_28px]" />
        <div className="relative max-w-4xl mx-auto px-6 py-16 md:py-20">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Users className="text-orange-400" size={20} />
            <span className="inline-flex items-center py-1 px-3 rounded-full text-[11px] font-black bg-orange-500 text-white">
              通年採用・随時募集中
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black leading-tight mb-3">採用情報</h1>
          <p className="text-base md:text-lg text-slate-300 leading-relaxed">
            {CAREERS_B2B_JD.title}
          </p>
          <p className="mt-3 text-sm text-slate-400">{CAREERS_B2B_JD.location}</p>
          <a
            href={CAREERS_B2B_MAILTO}
            className="mt-8 inline-flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-orange-600 transition"
          >
            <Mail size={15} /> 応募する
          </a>
        </div>
      </section>

      <section className="py-12 md:py-16 px-6 max-w-4xl mx-auto">
        <div className="space-y-8">
          {CAREERS_B2B_JD.sections.map((section) => (
            <div key={section.heading}>
              <h2 className="text-base md:text-lg font-black text-slate-900 dark:text-white mb-3">{section.heading}</h2>
              {section.paragraphs?.map((text) => (
                <p key={text} className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3 last:mb-0">
                  {text}
                </p>
              ))}
              {section.items && (
                <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800">
          <a
            href={CAREERS_B2B_MAILTO}
            className="inline-flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-orange-600 transition"
          >
            <Mail size={15} /> 応募する（{COMPANY_SUPPORT_EMAIL}）
          </a>
          <p className="mt-5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
            エンジニアリング、プロダクト、コンテンツなど他領域も通年で受け付けます。
          </p>
          <a
            href={CAREERS_MAILTO}
            className="inline-flex items-center gap-2 text-sm font-bold text-orange-600 hover:underline"
          >
            その他の職種で応募する
          </a>
          <p className="mt-6">
            <Link to="/about" className="text-sm font-bold text-slate-500 hover:text-orange-600">
              運営会社について
            </Link>
          </p>
        </div>
      </section>
    </div>
  )
}
