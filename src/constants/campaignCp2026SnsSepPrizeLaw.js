import {
  COMPANY_ADDRESS,
  COMPANY_NAME_JA,
  COMPANY_SUPPORT_EMAIL,
} from './companyLegal.js'
import { PREMIUM_MONTHLY_PRICE_INCL_TAX_YEN } from '../lib/membership.js'
import {
  CAMPAIGN_CP2026_SNS_SEP_HASHTAG,
  CAMPAIGN_CP2026_SNS_SEP_PARTICIPATION_STEPS,
  CAMPAIGN_CP2026_SNS_SEP_PRIZES,
} from './campaignCp2026SnsSep.js'

/**
 * 景品表示法に基づく表示（キャンペーンページ最下部）。
 * 当選者1人あたりの最高額・懸賞総額が届出基準を下回る想定のため、専用ページは設けず本ページに掲載。
 */
export const CAMPAIGN_CP2026_SNS_SEP_PRIZE_LAW_ROWS = [
  {
    label: 'キャンペーン名称',
    value: 'MoneyMart アンケート（2026年10月）',
  },
  {
    label: '主催者',
    value: COMPANY_NAME_JA,
  },
  {
    label: '所在地',
    value: COMPANY_ADDRESS,
  },
  {
    label: 'お問い合わせ',
    value: COMPANY_SUPPORT_EMAIL,
    href: `mailto:${COMPANY_SUPPORT_EMAIL}`,
  },
  {
    label: '応募期間',
    value: '2026年10月1日（木）0:00 〜 2026年10月30日（金）23:59（日本標準時）',
  },
  {
    label: '応募資格',
    value:
      '応募期間中に MoneyMart 会員登録を完了し、本ページの応募フォームから必要事項を送信した方。1人1回のみ。抽選時点まで会員登録を維持している方。',
  },
  {
    label: '応募方法',
    value: CAMPAIGN_CP2026_SNS_SEP_PARTICIPATION_STEPS.join(' → '),
  },
  {
    label: '景品の内容・当選本数',
    value: CAMPAIGN_CP2026_SNS_SEP_PRIZES.map((p) => `${p.title}（${p.detail}）`).join('／'),
  },
  {
    label: '景品の最高額（1人あたり）',
    value: 'Amazonギフトカード 1,000円相当',
  },
  {
    label: '景品の総額（概算・上限）',
    value: `Amazonギフトカード 50,000円相当（1,000円×50名）および MoneyMart Premium 1か月利用クーポン 約${(PREMIUM_MONTHLY_PRICE_INCL_TAX_YEN * 1000).toLocaleString('ja-JP')}円相当（税込月額${PREMIUM_MONTHLY_PRICE_INCL_TAX_YEN.toLocaleString('ja-JP')}円×1000名）`,
  },
  {
    label: '当選者の選定方法',
    value: '応募締切後、主催者が厳正なる抽選により選定します。当選の権利は第三者に譲渡できません。',
  },
  {
    label: '当選発表の方法・時期',
    value:
      '2026年10月中旬頃を目安に、当選者の登録メールアドレスへ個別にご連絡します。SNS上での当選発表は行いません。',
  },
  {
    label: '景品の提供時期・方法',
    value:
      'Amazonギフトカード：当選連絡後、登録メールアドレス宛にコード等をお送りします。Premium 1か月利用クーポン：イベント終了後、当選者のアカウントへ順次付与します。',
  },
  {
    label: '投稿に関する条件',
    value: `SNS投稿は ${CAMPAIGN_CP2026_SNS_SEP_HASHTAG} を含み、MoneyMart の画面スクリーンショットを1枚以上添付した公開投稿であること。抽選時点まで公開を維持してください。`,
  },
  {
    label: '個人情報の取扱い',
    value:
      '応募時に取得した個人情報は、本キャンペーンの運営・当選連絡・景品提供および関連するお問い合わせ対応のために利用します。プライバシーポリシーに従い適切に管理します。',
  },
  {
    label: 'その他',
    value:
      '本キャンペーンは予告なく変更・中止される場合があります。不正応募・規約違反・運営ポリシーに反する応募は無効とすることがあります。景品の内容・仕様は変更となる場合があります。',
  },
]
