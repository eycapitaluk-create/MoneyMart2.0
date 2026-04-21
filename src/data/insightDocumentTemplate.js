/**
 * Default insight “document” for DB seed / admin « Load template ».
 * Edit copy here or replace entire JSON from Admin — schema matches InsightArticleView.
 */
export const INSIGHT_DOCUMENT_TEMPLATE = {
  hero: {
    badge: 'CRISIS REPORT — 2026.03',
    bgFigure: '$120.41',
    titleLines: [
      [{ text: 'オイルショック', accent: 'rose' }, { text: 'で' }],
      [{ text: '勝つ', accent: 'gold' }, { text: '投資家の戦略書' }],
    ],
    sub:
      '1973年、1979年、そして2026年——歴史は3度目の石油危機を迎えた。過去のデータが示す「危機で資産を守り伸ばす」ための視点を整理しました。',
    meta: ['MoneyMart Research', '2026.03.26', '読了 8分'],
  },
  ticker: [
    { label: 'BRENT', value: '$106.41', change: '+30.7%', up: true },
    { label: 'GOLD', value: '$3,048', change: '+14.2%', up: true },
    { label: 'S&P500', value: '5,712', change: '-4.8%', up: false },
    { label: '日経225', value: '37,120', change: '-3.2%', up: false },
    { label: 'USD/JPY', value: '¥151.2', change: '+1.8%', up: true },
  ],
  sections: [
    {
      type: 'prose',
      kicker: '// 01 — Situation',
      title: '2026年、サプライショックが\n市場価格に織り込まれる',
      lead:
        '地政学リスクとエネルギー供給のボトルネックは、ポートフォリオのボラティリティと相関構造をいったんリセットします。',
      paragraphs: [
        '原油・天然ガス・電力の価格スパイクは、企業収益と実質購買力の両方に効きます。ここでは「何が材料か」よりも「どの時間軸で何を見るか」を優先します。',
        '政策金利・信用スプレッド・実物資産価格の三点セットを同じチャート思考で押さえると、ニュースのノイズに振り回されにくくなります。',
      ],
    },
    {
      type: 'compare',
      leftTitle: '1973年 石油危機',
      rightTitle: '2026年 サプライショック想定',
      rows: [
        ['世界供給の限定的な削減', 'ホール・チェーンにまたがる供給制約'],
        ['名目インフレと金利の逡巡', '実質金利と為替の先取り反応'],
        ['株・債の相関が崩れにくい局面も', 'コモディティ・為替の寄与が肥大化しやすい'],
      ],
    },
    {
      type: 'callout',
      variant: 'insight',
      body: '「危機の初期はニュース・中期はキャッシュフロー・長期は構造変化」と分解すると、同じヘッドラインでも投資命題が変わります。',

    },
    {
      type: 'assets',
      items: [
        {
          variant: 'gold',
          rank: '01',
          tag: '実物・代替通貨',
          title: '🥇 金（ゴールド）',
          body: '実質金利とドルの反転が下支えになる局面では、他資産との分散に効きやすい典型ブロックです。',
          stats: [
            { label: '留意点', value: '実物ETF/監理', tone: 'neutral' },
            { label: '時間軸', value: '中長期', tone: 'up' },
          ],
        },
        {
          variant: 'energy',
          rank: '02',
          tag: 'サイクリカル',
          title: '⛽ エネルギー関連',
          body: '利益レバレッジは高い反面、需要破壊が見えた瞬間に急速に織り込まれます。ポジション Size と損切りルールを先に決めるのが前提です。',
          stats: [
            { label: 'ボラ', value: '高', tone: 'down' },
            { label: '監視', value: '在庫・スプレッド', tone: 'neutral' },
          ],
        },
      ],
    },
    {
      type: 'timeline',
      items: [
        {
          period: 'SHORT — 0〜3ヶ月',
          title: 'ボラティリティの顕在化',
          desc: 'リスクオフと実物のメリハリ。ニュートラルなヘッジの有無がパフォーマンスを分けます。',
        },
        {
          period: 'MEDIUM — 3〜12ヶ月',
          title: '業種・地域での選別',
          desc: 'コスト転嫁力・ドル建て収益・棚卸サイクルが選別因子になりやすいフェーズです。',
        },
        {
          period: 'LONG — 1年超',
          title: 'CAPEXと供給の再配置',
          desc: 'エネルギー・素材・インフラへの投資回収の物語が、次の成長株テーマを形成します。',
        },
      ],
    },
    {
      type: 'callout',
      variant: 'warn',
      title: 'リスク：ギャップアップの反面',
      body: '極端なショートスクイーズや限月の歪みが出たとき、ファンドの追従性が悪化します。レバレッジ商品は特にルール優先で。',
    },
  ],
  footer: {
    disclaimer:
      '※本ページは情報提供を目的としたものであり、特定の金融商品の購入・売却を推奨するものではありません。投資判断はご自身の責任において行ってください。',
  },
}
