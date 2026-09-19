/** SNSキャンペーン cp2026_sns_sep — 2026-10-01 00:00 〜 10-30 23:59 JST */

export const CAMPAIGN_CP2026_SNS_SEP_ID = 'cp2026_sns_sep'

/** キャンペーン専用ランディング（応募 UI はここ。マイページはリンクのみ） */
export const CAMPAIGN_CP2026_SNS_SEP_PATH = '/campaign/sns-2026'

/** JST 窓（UTC 固定）: 2026-10-01 00:00〜10-30 23:59:59.999 JST */
export const CAMPAIGN_CP2026_SNS_SEP_START_MS = Date.parse('2026-09-30T15:00:00.000Z')
export const CAMPAIGN_CP2026_SNS_SEP_END_MS = Date.parse('2026-10-30T14:59:59.999Z')

export const CAMPAIGN_CP2026_SNS_SEP_HASHTAG = '#MoneyMart'

/** 本番前の社内テスト — このメールのみ UI・応募 API が期間外でも利用可 */
export const CAMPAIGN_CP2026_SNS_SEP_TEST_EMAILS = [
  'justin.nam@moneymart.co.jp',
  'kelly.nam@moneymart.co.jp',
]

export function isCampaignCp2026StaffTester(email) {
  const e = String(email || '').trim().toLowerCase()
  return e.length > 0 && CAMPAIGN_CP2026_SNS_SEP_TEST_EMAILS.includes(e)
}

/** アンケート冒頭文（MoneyMart アンケート） */
export const CAMPAIGN_CP2026_SNS_SEP_SURVEY_INTRO = `日頃よりMoneyMartをご利用いただき、誠にありがとうございます。
より良いサービスを提供するため、皆さまの貴重なご意見をお聞かせいただきたく、アンケートを実施いたします。

アンケートにご回答いただいた方の中から抽選で、
・50名様にAmazonギフトカード（1,000円分）
・さらに1000名様にMoneyMart Premium 1か月利用クーポン
をプレゼントいたします。

皆さまからいただいた貴重なご意見は、今後のサービス改善に積極的に反映してまいります。
ぜひご協力をお願いいたします。ありがとうございます。`

const FEATURE_OPTIONS = [
  { value: 'compare', label: '投資商品の比較' },
  { value: 'wealth', label: '資産管理・家計分析' },
  { value: 'optimizer', label: 'ポートフォリオオプティマイザー' },
  { value: 'dividend', label: '配当管理' },
  { value: 'insights', label: '投資インサイト' },
  { value: 'dca', label: 'ナンピン計算機' },
  { value: 'ai', label: 'AI分析' },
  { value: 'community', label: 'コミュニティ' },
  { value: 'other', label: 'その他（自由入力）' },
]

/** アンケート — 回答は campaign_entries.survey_answers (jsonb) に保存 */
export const CAMPAIGN_CP2026_SNS_SEP_SURVEY_QUESTIONS = [
  {
    id: 'discovery',
    label: '1. MoneyMartを初めて知ったきっかけは何ですか？',
    hint: '1つ選択',
    type: 'select',
    required: true,
    options: [
      { value: 'note', label: 'Note' },
      { value: 'x', label: 'X（Twitter）' },
      { value: 'instagram', label: 'Instagram' },
      { value: 'app_store', label: 'App Store' },
      { value: 'search', label: '検索' },
      { value: 'friend', label: '知人からの紹介' },
      { value: 'other', label: 'その他' },
    ],
  },
  {
    id: 'manage_how',
    label: '2. 現在、投資状況を主にどのように確認・管理していますか？',
    hint: '複数選択可',
    type: 'multiselect',
    required: true,
    options: [
      { value: 'broker_app', label: '証券会社のアプリ' },
      { value: 'excel', label: 'Excel' },
      { value: 'portfolio_app', label: 'ポートフォリオ管理アプリ' },
      { value: 'budget_app', label: '家計簿アプリ' },
      { value: 'none', label: '特に管理していない' },
      { value: 'other', label: 'その他（自由入力）' },
    ],
    otherFieldId: 'manage_how_other',
    otherPlaceholder: 'その他の場合はご記入ください',
  },
  {
    id: 'pain_points',
    label: '3. 現在、投資を行う中で最も難しいと感じていることは何ですか？',
    hint: '複数選択可',
    type: 'multiselect',
    required: true,
    options: [
      { value: 'pick_symbols', label: 'どの銘柄や投資商品を選べばよいかわからない' },
      { value: 'overview', label: '保有資産を一目で管理しにくい' },
      { value: 'portfolio_fit', label: 'ポートフォリオが適切か判断しにくい' },
      { value: 'compare_products', label: '投資商品（株式、ETF、投資信託など）を比較しにくい' },
      { value: 'trusted_info', label: '信頼できる投資情報を見つけにくい' },
      { value: 'track_returns', label: '投資成績（収益率）を体系的に管理しにくい' },
      { value: 'time', label: '投資に多くの時間をかけられない' },
      { value: 'none', label: '特に困っていることはない' },
      { value: 'other', label: 'その他（自由入力）' },
    ],
    otherFieldId: 'pain_points_other',
    otherPlaceholder: 'その他の場合はご記入ください',
  },
  {
    id: 'usage_freq',
    label: '4. MoneyMartをどのくらいの頻度で利用していますか？',
    hint: '1つ選択',
    type: 'select',
    required: true,
    options: [
      { value: 'daily', label: '毎日' },
      { value: 'weekly_3_5', label: '週3〜5回' },
      { value: 'weekly_1_2', label: '週1〜2回' },
      { value: 'monthly_1_2', label: '月1〜2回' },
      { value: 'rarely', label: 'ほとんど利用していない' },
    ],
  },
  {
    id: 'usability',
    label: '5. MoneyMartは全体的に使いやすいと感じますか？',
    type: 'select',
    required: true,
    options: [
      { value: 'strongly_agree', label: 'とてもそう思う' },
      { value: 'agree', label: 'そう思う' },
      { value: 'neutral', label: '普通' },
      { value: 'disagree', label: 'そう思わない' },
      { value: 'strongly_disagree', label: 'まったくそう思わない' },
    ],
  },
  {
    id: 'features_used',
    label: '6. 現在、最もよく利用している機能は何ですか？',
    hint: '複数選択可',
    type: 'multiselect',
    required: true,
    options: FEATURE_OPTIONS,
    otherFieldId: 'features_used_other',
    otherPlaceholder: 'その他の場合はご記入ください',
  },
  {
    id: 'features_improve',
    label: '7. 最も改善が必要だと感じる機能は何ですか？',
    hint: '複数選択可',
    type: 'multiselect',
    required: true,
    options: FEATURE_OPTIONS,
    otherFieldId: 'features_improve_other',
    otherPlaceholder: 'その他の場合はご記入ください',
  },
  {
    id: 'nps',
    label: '8. MoneyMartを周囲の方におすすめしたいと思いますか？',
    hint: '1つ選択',
    type: 'select',
    required: true,
    options: [
      { value: 'definitely', label: '必ずおすすめする' },
      { value: 'likely', label: 'おすすめする可能性が高い' },
      { value: 'unsure', label: 'まだよくわからない' },
      { value: 'unlikely', label: 'おすすめしない' },
    ],
  },
  {
    id: 'nps_reason',
    label: '8-1. そう答えた理由を教えてください。',
    hint: '必須',
    type: 'text',
    required: true,
    maxLength: 800,
    showIf: { field: 'nps', values: ['definitely', 'likely', 'unsure', 'unlikely'] },
  },
  {
    id: 'premium_interest',
    label: '9. 今後、MoneyMart Premiumを利用したいと思いますか？',
    hint: '1つ選択',
    type: 'select',
    required: true,
    options: [
      { value: 'definitely', label: '必ず利用する' },
      { value: 'likely', label: '利用する可能性が高い' },
      { value: 'unsure', label: 'まだよくわからない' },
      { value: 'unlikely', label: '利用しないと思う' },
      { value: 'never', label: 'まったく利用しない' },
    ],
  },
  {
    id: 'premium_reason',
    label: '9-1. その理由を教えてください。',
    hint: '「まだよくわからない」以下を選択した方 · 複数選択可',
    type: 'multiselect',
    required: true,
    showIf: { field: 'premium_interest', values: ['unsure', 'unlikely', 'never'] },
    options: [
      { value: 'unknown_features', label: 'Premium機能の内容がよくわからない' },
      { value: 'free_enough', label: '現在の無料機能で十分だ' },
      { value: 'price', label: '価格が負担に感じる' },
      { value: 'missing_features', label: '必要な機能が不足している' },
      { value: 'no_paid_plan', label: 'まだ有料サービスを利用する予定がない' },
      { value: 'other', label: 'その他（自由入力）' },
    ],
    otherFieldId: 'premium_reason_other',
    otherPlaceholder: 'その他の場合はご記入ください',
  },
  {
    id: 'feature_wish',
    label: '10. 今後追加してほしい機能や、改善してほしい点があれば自由にご記入ください。',
    type: 'text',
    required: false,
    maxLength: 1200,
  },
  {
    id: 'demo_section',
    label: '以下の項目は、統計分析のための基本情報です。',
    hint: 'ご回答いただいた内容は、統計分析の目的でのみ利用いたします。',
    type: 'section',
  },
  {
    id: 'gender',
    label: '性別',
    type: 'select',
    required: true,
    options: [
      { value: 'male', label: '男性' },
      { value: 'female', label: '女性' },
    ],
  },
  {
    id: 'age_band',
    label: '年代',
    type: 'select',
    required: true,
    options: [
      { value: 'under_20', label: '20歳以下' },
      { value: '20_29', label: '20〜29歳' },
      { value: '30_39', label: '30〜39歳' },
      { value: '40_49', label: '40〜49歳' },
      { value: '50_59', label: '50〜59歳' },
      { value: '60_plus', label: '60歳以上' },
    ],
  },
  {
    id: 'invest_exp',
    label: '投資経験',
    type: 'select',
    required: true,
    options: [
      { value: 'none', label: 'まだ投資をしていない' },
      { value: 'under_1y', label: '1年未満' },
      { value: '1_3y', label: '1〜3年' },
      { value: '3_5y', label: '3〜5年' },
      { value: '5y_plus', label: '5年以上' },
    ],
  },
  {
    id: 'asset_types',
    label: '現在投資している資産は何ですか？',
    hint: '複数選択可',
    type: 'multiselect',
    required: true,
    options: [
      { value: 'stocks', label: '個別株式' },
      { value: 'etf', label: 'ETF' },
      { value: 'funds', label: '投資信託' },
      { value: 'crypto', label: '暗号資産' },
      { value: 'cash', label: '現金・預金' },
      { value: 'none', label: 'まだ投資をしていない' },
      { value: 'other', label: 'その他' },
    ],
    otherFieldId: 'asset_types_other',
    otherPlaceholder: 'その他の場合はご記入ください',
  },
  {
    id: 'decision_factor',
    label: '普段、投資判断をする際に最も重視していることは何ですか？',
    hint: '1つ選択',
    type: 'select',
    required: true,
    options: [
      { value: 'growth', label: '成長性' },
      { value: 'dividend', label: '配当・安定性' },
      { value: 'value', label: '割安かどうか' },
      { value: 'trend', label: '市場トレンド' },
      { value: 'diversification', label: '分散投資' },
      { value: 'other', label: 'その他' },
    ],
  },
]

export const CAMPAIGN_CP2026_SNS_SEP_PARTICIPATION_STEPS = [
  'MoneyMart会員登録',
  'マイページで関心資産または投資資産を1件以上登録（口座連携は不要）',
  '約1〜2分のアンケートに回答',
  'X（旧Twitter）またはNoteに #MoneyMart ハッシュタグ付きで感想を投稿',
  'MoneyMartの画面スクリーンショットを1枚以上添付',
  'ご利用の感想や改善してほしい点を本文に記載',
]

export const CAMPAIGN_CP2026_SNS_SEP_PRIZES = [
  {
    title: 'Amazonギフトカード 1,000円',
    detail: '50名様（抽選）',
    note: '当選者には登録メールアドレスへ個別ご連絡',
  },
  {
    title: 'MoneyMart Premium 1か月利用クーポン',
    detail: '1000名様（抽選）',
    note: 'イベント終了後、当選者へ順次付与',
  },
]

export const CAMPAIGN_CP2026_SNS_SEP_DISCLAIMERS = [
  '1人1回のみ応募できます。',
  '抽選時点まで会員登録状態を維持している方のみが対象です。',
  'SNS投稿は抽選時点まで公開状態を維持してください。',
  'Premium 1か月利用クーポンはイベント終了後、当選者へ順次付与されます。',
  'Amazonギフトカード当選者は抽選後、登録メールアドレスへ個別にご案内します。',
  '投稿内容がイベント趣旨に合わない場合、同一内容の反復投稿など運営ポリシーに反する場合は抽選対象外となることがあります（AI生成の形だけの投稿や同一文面の反復など）。',
]
