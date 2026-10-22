import { useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Shield, FileText, Lock, Building, ArrowLeft, Scale, Trash2 } from 'lucide-react'
import {
  PREMIUM_ANNUAL_PRICE_INCL_TAX_YEN,
  PREMIUM_MONTHLY_PRICE_INCL_TAX_YEN,
  PREMIUM_TRIAL_DAYS,
} from '../lib/membership'
import { PAYJP_WEB_CARD_BRANDS_LABEL } from '../constants/payjpBillingFaq'
import {
  COMPANY_ADDRESS,
  COMPANY_NAME_JA,
  COMPANY_NAME_JA_EN,
  COMPANY_PHONE,
  COMPANY_PHONE_NOTE,
  COMPANY_REPRESENTATIVE,
  COMPANY_SUPPORT_EMAIL,
} from '../constants/companyLegal'

const LEGAL_CONTENTS = {
  commerce: {
    title: '特定商取引法に基づく表記',
    icon: Scale,
    content: (
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <p className="font-black text-slate-900 dark:text-white text-base">{COMPANY_NAME_JA_EN} / MoneyMart</p>
        <table className="w-full text-left border-collapse">
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            <tr>
              <th className="py-3 align-top font-bold w-[min(40%,11rem)] text-slate-900 dark:text-white">販売業者</th>
              <td className="py-3">{COMPANY_NAME_JA}</td>
            </tr>
            <tr>
              <th className="py-3 align-top font-bold text-slate-900 dark:text-white">運営責任者</th>
              <td className="py-3">{COMPANY_REPRESENTATIVE}</td>
            </tr>
            <tr>
              <th className="py-3 align-top font-bold text-slate-900 dark:text-white">所在地</th>
              <td className="py-3">{COMPANY_ADDRESS}</td>
            </tr>
            <tr>
              <th className="py-3 align-top font-bold text-slate-900 dark:text-white">電話番号</th>
              <td className="py-3">
                <a href={`tel:${COMPANY_PHONE.replace(/-/g, '')}`} className="font-mono font-bold text-orange-600 dark:text-orange-400 underline underline-offset-2">{COMPANY_PHONE}</a>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{COMPANY_PHONE_NOTE}</p>
              </td>
            </tr>
            <tr>
              <th className="py-3 align-top font-bold text-slate-900 dark:text-white">メールアドレス</th>
              <td className="py-3">
                <a
                  href={`mailto:${COMPANY_SUPPORT_EMAIL}`}
                  className="font-mono font-bold text-orange-600 dark:text-orange-400 underline underline-offset-2 break-all"
                >
                  {COMPANY_SUPPORT_EMAIL}
                </a>
              </td>
            </tr>
            <tr>
              <th className="py-3 align-top font-bold text-slate-900 dark:text-white">商品代金以外の必要料金</th>
              <td className="py-3 space-y-2">
                <p>なし（インターネット接続に伴う通信費等はお客様のご負担となります）。</p>
              </td>
            </tr>
            <tr>
              <th className="py-3 align-top font-bold text-slate-900 dark:text-white">サービス名・販売価格</th>
              <td className="py-3">
                <p className="font-bold text-slate-800 dark:text-slate-200">MoneyMart プレミアムサービス（デジタルサービス）</p>
                <p className="mt-2">
                  月額プラン：税込{' '}
                  {PREMIUM_MONTHLY_PRICE_INCL_TAX_YEN.toLocaleString('ja-JP')}
                  円／月（自動更新）
                </p>
                <p className="mt-1">
                  年額プラン：税込{' '}
                  {PREMIUM_ANNUAL_PRICE_INCL_TAX_YEN.toLocaleString('ja-JP')}
                  円／年（一括・自動更新。チャネルにより取り扱いの有無が異なる場合があります）
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  ※表示価格はすべて消費税込みです。※新規登録から {PREMIUM_TRIAL_DAYS} 日間の無料お試しがある場合は、申込画面の表示に従います（お試し終了後にご契約が継続する場合のみ課金）。
                </p>
              </td>
            </tr>
            <tr>
              <th className="py-3 align-top font-bold text-slate-900 dark:text-white">支払方法</th>
              <td className="py-3 space-y-2">
                <p>
                  <span className="font-bold text-slate-800 dark:text-slate-200">ウェブサイト：</span>
                  決済代行サービス PAY.JP を利用したクレジットカード決済（
                  {PAYJP_WEB_CARD_BRANDS_LABEL}
                  ）
                </p>
                <p>
                  <span className="font-bold text-slate-800 dark:text-slate-200">iOS アプリ：</span>
                  App Store における自動更新サブスクリプション（請求・解約等は Apple の規約に従います）
                </p>
              </td>
            </tr>
            <tr>
              <th className="py-3 align-top font-bold text-slate-900 dark:text-white">支払時期</th>
              <td className="py-3 space-y-2">
                <p>
                  <span className="font-bold text-slate-800 dark:text-slate-200">ウェブサイト（PAY.JP・クレジットカード・定期課金）：</span>
                  初回はお申し込み手続き完了時に決済します。月額プランは、初回決済を基準におおむね毎月同様のタイミングで自動更新時に決済します（月の日数や決済処理により前後する場合があります）。年額プランは、お申し込み時に表示される更新周期に従い、更新日に決済します。カード会社の明細上の引き落とし日は各社の規定により異なります。
                </p>
                <p>
                  <span className="font-bold text-slate-800 dark:text-slate-200">iOS アプリ（App Store・自動更新サブスクリプション）：</span>
                  初回および更新は、Apple が定めるサブスクリプションの請求タイミングに従います（詳細は App Store の購入・サブスクリプション画面および Apple の規約をご確認ください）。
                </p>
              </td>
            </tr>
            <tr>
              <th className="py-3 align-top font-bold text-slate-900 dark:text-white">サービス提供時期</th>
              <td className="py-3">プレミアムサービスの登録手続き完了後、直ちにご利用いただけます。</td>
            </tr>
            <tr>
              <th className="py-3 align-top font-bold text-slate-900 dark:text-white">返品・キャンセルについて</th>
              <td className="py-3 space-y-2">
                <p>
                  デジタルサービスの性質上、一度ご利用が開始されたコンテンツについて、お客様都合による返品・契約の撤回はお受けできません。既に決済された期間に対する日割・按分による返金は、原則お受けできません。
                </p>
                <p className="font-bold text-slate-800 dark:text-slate-200">定期課金の解約（次回以降の請求を止めるために）</p>
                <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400">
                  <li>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">ウェブサイト（PAY.JP）：</span>
                    MoneyMart のプレミアム（
                    <Link to="/premium" className="font-bold text-orange-600 underline underline-offset-2 dark:text-orange-400">
                      /premium
                    </Link>
                    ）またはマイページ内の案内に従い、解約手続きを行ってください。決済完了メール等に記載の案内がある場合はそれに従ってください。不明な点は本表のメールアドレスまでお問い合わせください。
                    <span className="block mt-1">
                      次回更新課金日の前までに解約手続きが完了した場合、次回以降の更新料金は発生いたしません（更新日を過ぎてからの解約でも、既に決済された更新分の返金はできない場合があります）。
                    </span>
                  </li>
                  <li>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">iOS アプリ（App Store）：</span>
                    Apple ID の「サブスクリプション」または App Store のアカウント設定から解約できます。次回更新課金の前までに解約すると、次回以降の請求は発生しません（請求・返金条件は Apple の規約に準じます）。
                  </li>
                </ul>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ※サービスに重大な瑕疵がある場合や法令により認められる場合は、この限りではありません。
                </p>
              </td>
            </tr>
            <tr>
              <th className="py-3 align-top font-bold text-slate-900 dark:text-white">動作環境</th>
              <td className="py-3 space-y-2">
                <p>ウェブ：インターネット接続環境および対応ブラウザが必要です。</p>
                <p>iOS アプリ：対応 OS の Apple デバイスおよび App Store にて入手できる環境が必要です。</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    ),
  },
  company: {
    title: '運営会社',
    icon: Building,
    content: (
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
        <table className="w-full text-left border-collapse">
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            <tr><th className="py-3 font-bold w-32 text-slate-900 dark:text-white">会社名</th><td className="py-3">マネーラボ株式会社（MoneyLab Inc.・MoneyMart運営）</td></tr>
            <tr><th className="py-3 font-bold text-slate-900 dark:text-white">代表者</th><td className="py-3">代表取締役 片桐 明子</td></tr>
            <tr><th className="py-3 font-bold text-slate-900 dark:text-white">所在地</th><td className="py-3">〒150-0022 東京都渋谷区恵比寿南 2-12-4-207</td></tr>
            <tr><th className="py-3 font-bold text-slate-900 dark:text-white">設立</th><td className="py-3">2025年 12月</td></tr>
            <tr><th className="py-3 font-bold text-slate-900 dark:text-white">資本金</th><td className="py-3">105万円</td></tr>
            <tr><th className="py-3 font-bold text-slate-900 dark:text-white">主要取引銀行</th><td className="py-3">三井住友銀行</td></tr>
            <tr><th className="py-3 font-bold text-slate-900 dark:text-white">事業内容</th><td className="py-3">データモニタリングシステムおよび分析ツールの提供、情報分析サービス、リスク管理支援ソリューションの開発・運営</td></tr>
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
          この利用規約（以下「本規約」）は、マネーラボ株式会社（英文商号 MoneyLab Inc.、以下「当社」）が提供する本サービス「MoneyMart」の利用条件を定めるものです。
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
          <p>当社は、本サービスに掲載される情報の正確性について万全を期していますが、その完全性・最新性を保証するものではありません。本サービスの情報に基づいてユーザーが被った損害について、法令上認められる範囲において当社は責任を負いません。</p>
          <p className="mt-2">当社は、金融商品取引法に基づく投資助言業・投資運用業の登録を受けておらず、本サービスを通じて投資助言を提供するものではありません。投資の最終判断はユーザーご自身の責任において行ってください。</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第4条 有料サービス・料金</h3>
          <p>本サービスの一部機能については、有料プランへの加入が必要となる場合があります。有料プランの内容・料金・支払方法については、別途サービス内で定めるものとし、本規約の一部を構成します。</p>
          <p className="mt-2">
            有料プランのお申し込み・自動更新・解約は、App Store（サブスクリプション）、またはウェブの決済代行（PAY.JP）ごとの規約・画面に従います。料金・請求日・無料試用の条件は申込時の表示が優先します。
          </p>
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
          <p className="mt-2">サービスの変更・停止・終了によってユーザーに生じた損害について、法令上認められる範囲において当社は責任を負いません。</p>
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
        <p>マネーラボ株式会社（英文商号 MoneyLab Inc.、以下「当社」）は、個人情報保護の重要性を認識し、個人情報の保護に関する法律（個人情報保護法）を遵守し、以下の通りプライバシーポリシーを定めます。</p>
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
          <p className="mt-2">前項の会員登録時アンケート（投資プロフィール）については、サービス改善、コンテンツや機能の見直し、利用者属性の把握（統計的分析）の目的で利用します。個人を識別しない形式に加工した統計情報として取り扱う場合があります。</p>
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
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第4条 外部サービスへの送信（外国にある第三者への提供を含む）</h3>
          <p>1. 本サービスの一部の機能では、AI（人工知能）による処理のため、機能の提供に必要な範囲の情報を Anthropic, PBC（所在国：アメリカ合衆国）に送信します。対象となる主な機能と送信する情報は次のとおりです。</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>保有銘柄のスクリーンショット読み取り：ユーザーが選択した画像</li>
            <li>家計簿の AI まとめ：カテゴリ別の集計金額など（店名・メモ・個々の明細は送信しません）</li>
          </ul>
          <p className="mt-2">2. スクリーンショット読み取りでは、画像を送信する前に本条の内容を表示し、ユーザーの同意を得たうえで送信します。当社は画像を保存しません。読み取った内容は、ユーザーが画面で確認して登録した場合にのみ保有情報として保存されます。</p>
          <p className="mt-2">3. 送信した情報は、送信先において AI モデルの学習には利用されません。ただし、送信先の規約に基づき、不正利用の監視等のため一定期間保管される場合があります。</p>
          <p className="mt-2">
            4. アメリカ合衆国の個人情報の保護に関する制度については、個人情報保護委員会が公表している情報（
            <a
              href="https://www.ppc.go.jp/personalinfo/legal/kaiseihogohou/#gaikoku"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-600 dark:text-orange-400 font-semibold hover:underline break-all"
            >
              https://www.ppc.go.jp/personalinfo/legal/kaiseihogohou/#gaikoku
            </a>
            ）をご参照ください。送信先は、個人情報の適切な取扱いに関する方針を定め、これに基づき情報を管理しています。
          </p>
          <p className="mt-2">5. 証券会社の CSV ファイルからの取込では、ファイルはユーザーの端末内で読み取り、銘柄・数量・取得単価・取得日（米ドル建ての場合は通貨・取得時の為替を含む）のみを保存します。口座番号・氏名等のその他の項目は保存しません。</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第5条 安全管理措置</h3>
          <p>当社は、取得した個人情報について、不正アクセス・紛失・破壊・改ざん・漏洩等を防ぐため、以下の安全管理措置を講じます。</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>個人情報へのアクセス権限の管理および制限</li>
            <li>SSL/TLS等による通信の暗号化</li>
            <li>個人情報を取り扱う従業者への教育・監督</li>
            <li>定期的なセキュリティの点検・改善</li>
          </ul>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第6条 Cookieおよびアクセス解析</h3>
          <p>本サービスでは、利便性向上およびサービス改善を目的として、Cookie（クッキー）を使用しています。</p>
          <p className="mt-2">
            また、Microsoft Clarity（マイクロソフト社提供の行動分析ツール）を利用し、クリック・スクロール等の利用状況を匿名化された形で収集する場合があります。マイページ（資産・家計データを含む画面）、管理画面、パスワード再設定画面では記録を行いません。Clarityのプライバシーについては
            {' '}
            <a
              href="https://privacy.microsoft.com/privacystatement"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-600 dark:text-orange-400 font-semibold hover:underline"
            >
              Microsoftのプライバシーステートメント
            </a>
            をご参照ください。
          </p>
          <p className="mt-2">ブラウザの設定によりCookieを無効にすることができますが、一部のサービス機能がご利用いただけなくなる場合があります。</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第7条 個人情報の開示・訂正・削除</h3>
          <p>ユーザーは、当社が保有する自己の個人情報について、開示・訂正・削除・利用停止を求める権利を有します。ご請求の場合は、下記お問い合わせ窓口までご連絡ください。本人確認の上、合理的な期間内に対応いたします。</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第8条 プライバシーポリシーの変更</h3>
          <p>当社は、法令の改正や事業内容の変更等に伴い、本プライバシーポリシーを変更することがあります。重要な変更を行う場合は、本サービス上での告知またはメールにて事前にお知らせします。変更後のポリシーは、本サービス上に掲載した時点で効力を生じるものとします。</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">第9条 お問い合わせ窓口</h3>
          <p>会社名: マネーラボ株式会社（英文商号 MoneyLab Inc.）</p>
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
            投資に関するすべての最終判断は、お客様ご自身の責任において行ってください。特定の金融商品の売買を勧誘するものではありません。
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
            本サービスに掲載されている外部リンク先のコンテンツについて、法令上認められる範囲において当社は責任を負いません。リンク先のサービス利用により生じた損害についても同様です。
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
  methodology: {
    title: '編集・データ方針',
    icon: FileText,
    content: (
      <div className="space-y-6 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <p className="text-xs text-slate-500">最終更新：2026年9月18日</p>
        <section>
          <h2 className="font-bold text-slate-900 dark:text-white mb-2 text-base">編集の立場</h2>
          <p>
            インサイト記事は MoneyMart 編集部が公開情報を整理して提供します。記事ごとの個人名がデータベースにない場合は「MoneyMart編集部」と表示します。
            一部の文章の下書きにAIを使うことがあります。公開前に編集チームが内容を確認します。本コンテンツは情報提供であり、投資助言ではありません。
          </p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 dark:text-white mb-2 text-base">一次情報の扱い</h2>
          <p>
            信託報酬、分配、制度、企業情報など取引や税務に関わる数値は、各運用会社・取引所・官公庁の公式資料を優先して確認する方針です。
            本サイトの表示と公式資料が異なる場合は、公式資料を正とします。
          </p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 dark:text-white mb-2 text-base">市場データの目安</h2>
          <p>
            価格・騰落率などは、原則として各取引所の前営業日終値（EOD）をもとに更新します。目安として、国内上場は日本時間の午後（おおむね16時頃）、米国上場は翌営業日の日本時間の朝（おおむね8時頃）です。休場や提供元の遅延で前後することがあります。欠測時に推定値で埋めません。
          </p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 dark:text-white mb-2 text-base">訂正・お問い合わせ</h2>
          <p>
            誤りを見つけた場合は、
            <a href={`mailto:${COMPANY_SUPPORT_EMAIL}`} className="font-bold text-orange-600 underline underline-offset-2">{COMPANY_SUPPORT_EMAIL}</a>
            または
            <Link to="/about#about-contact" className="font-bold text-orange-600 underline underline-offset-2">運営会社のお問い合わせ</Link>
            までご連絡ください。確認できた事実に基づき、該当ページの更新を検討します。
          </p>
          <p className="mt-2">関連：<Link to="/legal/disclaimer" className="text-orange-600 underline underline-offset-2">免責事項</Link></p>
        </section>
      </div>
    ),
  },
  security: {
    title: 'セキュリティ宣言',
    icon: Shield,
    content: (
      <div className="space-y-6 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <p>MoneyMartはお客様の大切な資産情報を守るため、通信暗号化やアクセス管理など、必要な安全管理措置の実施に努めています。</p>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>SSL/TLS暗号化：</strong> 全ての通信を暗号化し、第三者による盗聴を防ぎます。</li>
          <li><strong>厳格なデータ管理：</strong> お客様の資産データは、アクセス権限を管理した環境で取り扱います。</li>
          <li><strong>継続的な確認：</strong> システムの状態を確認し、必要に応じてセキュリティ対策を見直します。</li>
        </ul>
      </div>
    ),
  },
  solicitation: {
    title: '勧誘方針',
    icon: FileText,
    content: (
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
        <p>当社は、提携先の商品・サービスに関する広告、紹介、案内を行う場合について、以下の方針を定めております。なお、投資助言、投資運用、特定の金融商品の取得・売却の勧誘は行いません。</p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>広告・紹介を行う場合は、利用者が条件やリスクを確認しやすい表示に努めます。</li>
          <li>お客様に誤解を招くような説明や、不確実な事項を断定的に告げるような行為はいたしません。</li>
          <li>深夜や早朝など、お客様のご迷惑となる時間帯や方法で一方的な案内は行いません。</li>
        </ol>
      </div>
    ),
  },
  'account-deletion': {
    title: 'アカウントとデータの削除',
    icon: Trash2,
    updated: '2026年 10月 22日',
    content: (
      <div className="space-y-6 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <p>
          本ページは、{COMPANY_NAME_JA_EN} が提供するアプリ「MoneyMart」のアカウントおよび関連データの削除方法を説明するものです。ログインしていなくてもご覧いただけます。
        </p>
        <section>
          <h2 className="font-bold text-slate-900 dark:text-white mb-2 text-base">アプリで削除する</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>iOS：マイページ › 設定 › アカウントを削除</li>
            <li>Android：もっと › 設定（⚙） › アカウントを削除</li>
          </ul>
          <p className="mt-2">手続きを完了すると、アカウントと下記の対象データは直ちに削除されます。</p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 dark:text-white mb-2 text-base">ウェブで削除する</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>MoneyMart にログインし、マイページを開きます。</li>
            <li>「資産運用」タブを選びます。</li>
            <li>ページ下部の「アカウント詳細」で「詳細を開く」を選びます。</li>
            <li>「退会オプションを表示」を選びます。</li>
            <li>確認事項にチェックを入れ、登録メールアドレスと「退会する」を入力します。</li>
            <li>「アカウントを削除する」を選びます。</li>
          </ol>
          <p className="mt-2">手続きを完了すると、アカウントと下記の対象データは直ちに削除されます。</p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 dark:text-white mb-2 text-base">アプリを削除したあとにメールで依頼する</h2>
          <p>端末からアプリを削除しただけでは、アカウントとサーバー上のデータは削除されません。</p>
          <p className="mt-2">
            <a href={`mailto:${COMPANY_SUPPORT_EMAIL}`} className="font-bold text-orange-600 underline underline-offset-2">{COMPANY_SUPPORT_EMAIL}</a>
            {' '}まで、本文に登録メールアドレスを記載して送信してください。
          </p>
          <p className="mt-2">メールで依頼を受けた場合は、30日以内に削除します。</p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 dark:text-white mb-2 text-base">削除されるデータ</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>アカウント情報（メールアドレス・ニックネーム）</li>
            <li>保有資産・売却履歴・配当</li>
            <li>家計簿（支出・予算・定期支出）</li>
            <li>ポイント・保険</li>
            <li>ウォッチリスト・保存した分析</li>
            <li>資産推移</li>
            <li>コミュニティの投稿・コメント・いいね・画像</li>
            <li>通知設定・プッシュ通知用の端末トークン</li>
          </ul>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 dark:text-white mb-2 text-base">削除されない、または残るデータ</h2>
          <p>有料プランを利用していない場合：なし。</p>
          <p className="mt-2">有料プランを利用した場合、次の記録は当社のアカウント削除後も各事業者に残ります。</p>
          <ul className="list-disc pl-5 mt-2 space-y-2">
            <li>ウェブのクレジットカード決済（PAY.JP）に関する決済記録</li>
            <li>iOSアプリの App Store サブスクリプションに関する購入記録</li>
          </ul>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 dark:text-white mb-2 text-base">処理の期限</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>アプリまたはウェブで削除手続きを完了した場合：直ちに削除します。</li>
            <li>メールで依頼した場合：30日以内に削除します。</li>
          </ul>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 dark:text-white mb-2 text-base">お問い合わせ</h2>
          <p>{COMPANY_NAME_JA_EN}</p>
          <p className="mt-2">アプリ名：MoneyMart</p>
          <p className="mt-2">
            メール：
            <a href={`mailto:${COMPANY_SUPPORT_EMAIL}`} className="font-bold text-orange-600 underline underline-offset-2">{COMPANY_SUPPORT_EMAIL}</a>
          </p>
          <p className="mt-2">
            関連：
            <Link to="/legal/privacy" className="text-orange-600 underline underline-offset-2">プライバシーポリシー</Link>
          </p>
        </section>
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
            最終更新日: {data.updated || (type === 'privacy' ? '2026年 10月 14日' : '2026年 3月 31日')}
          </p>
        </div>
      </div>
    </div>
  )
}
