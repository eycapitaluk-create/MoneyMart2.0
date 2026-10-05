import { createDemoData, formatYen, riskLabel } from '../../lib/advisorDemo'

/** Featured client matching iPad screenshots — Nam Justin. */
export function buildNamJustin() {
  const holdings = [
    { symbol: '1320.T', name: 'iFreeETF 日経225(年1回決算型)', type: 'fund', sector: '日本株', value: 2_841_333, pct: 86 },
    { symbol: 'BKR', name: 'ベーカー・ヒューズ', type: 'stock', sector: 'エネルギー', value: 462_543, pct: 14 },
    { symbol: '1345.T', name: 'MAXIS トピックス上場投信', type: 'fund', sector: '日本株', value: 0, pct: 0 },
  ]
  const aum = 3_303_876
  const cost = 3_042_239
  const returnPct = 8.6
  const allocation = { equity: 92, bond: 0, cash: 8, other: 0, total: aum }
  const c = {
    id: 'c-nam-justin',
    name: 'Nam Justin',
    kana: 'ナム ジャスティン',
    advisorId: 'a-justin',
    advisorName: 'Justin',
    profile: 'moderate',
    aum,
    cost,
    holdings,
    allocation,
    drift: 50,
    concentration: { maxHolding: 86, maxSector: 92, severity: 'high' },
    reviewDays: 5,
    monthsSinceReview: 0,
    returnPct,
    email: 'njs0011@naver.com',
    phone: '1515-51515',
    clientCode: 'C-BA90A105',
    dob: '1980-01-01',
    age: 46,
    objective: '配当収入',
    horizon: '3年以上',
    nextReview: '2026-09-25',
    lastReview: '2026-09-09',
    nextMeeting: '9/25 04:00',
    status: '契約中',
    riskScore: 80,
    priority: {
      total: 55,
      parts: [
        ['レビュー期日近接', 15],
        ['リスクドリフト大', 20],
        ['集中リスク検出', 20],
      ],
    },
    meetings: [
      {
        id: 'M-NJ-1',
        date: '2026-09-25',
        time: '04:00',
        type: '定期レビュー',
        status: '予定',
        agenda: ['集中リスクの確認', '海外分散の検討', '次回方針'],
        notes: '',
        duration: 60,
        prepPct: 0,
      },
      {
        id: 'M-NJ-0',
        date: '2026-09-09',
        time: '10:00',
        type: '定期レビュー',
        status: '完了',
        agenda: ['四半期レビュー'],
        notes: '完了',
        duration: 45,
        prepPct: 100,
      },
    ],
    transactions: [
      {
        date: '2026-09-06',
        symbol: '1320.T',
        name: 'iFreeETF 日経225(年1回決算型)',
        side: '売却',
        qty: 7.61,
        price: 66190,
        amount: 504035,
        pnl: 3274,
      },
      {
        date: '2026-08-30',
        symbol: 'BKR',
        name: 'ベーカー・ヒューズ',
        side: '購入',
        qty: 50,
        price: 5000,
        amount: 250000,
        pnl: null,
      },
    ],
    aiActions: [
      {
        id: 1,
        level: 'H',
        title: 'iFreeETF 日経225 — 集中リスク',
        impact: 'AUM 86% → 目標 8% へ削減',
        body: '単一銘柄比率が過大です。-20%下落時のポートフォリオ影響が大きくなります。海外分散・債券枠の確保を検討してください。',
        status: 'pending',
      },
      {
        id: 2,
        level: 'H',
        title: '目標配分からの乖離',
        impact: 'ドリフト 50pt（バランス型基準）',
        body: '株式偏重が続いています。債券・現金の目標配分との差分を確認し、リバランス案を検討してください。',
        status: 'pending',
      },
      {
        id: 3,
        level: 'M',
        title: '国際分散の不足',
        impact: '国内資産 約92%',
        body: '日本株・国内ETFへの偏りが強いです。米国・全世界株への露出確保が関連テーマです。',
        status: 'pending',
      },
    ],
    relatedNews: [
      {
        id: 'n1',
        title: 'NY原油3営業日続落、99.70ドル…',
        level: '高',
        factors: ['原油', '米国株'],
        icon: 'fuel',
      },
      {
        id: 'n2',
        title: 'NY為替：ECBラガルド総裁「2027年に退任へ」…',
        level: '高',
        factors: ['日本金利', '円相場'],
        icon: 'yen',
      },
      {
        id: 'n3',
        title: 'NY株式：NYダウは95.40ドル安、金利高を警戒…',
        level: '高',
        factors: ['米ドル', '米国株'],
        icon: 'chart',
      },
    ],
    aiSummary:
      '【重点確認事項】\n- リスクプロファイル(バランス型)から乖離 (drift 50pt)\n- iFreeETF 日経225 集中度 86% (目安の範囲を大幅に超えている)\n- 国内資産比率 約92% — 海外分散の余地\n\n【トークポイント】\n- 関連ニュースとの「関連性」を顧客と共有（価格予測ではない）\n- リバランス案はアドバイザー判断で提示',
    recommendations: [
      { title: 'リバランス実施 (リスク許容度乖離 50pt)', status: 'draft' },
      { title: '集中リスク削減: iFreeETF 日経225 86% → 30%以下', status: 'draft' },
    ],
    documents: [
      { name: 'Nam Justin_定期レビュー_20260909.pdf', status: '共有済み', date: '2026-09-09' },
      { name: 'Nam Justin_リスク分析メモ.pdf', status: '下書き', date: '2026-09-18' },
      { name: '投資方針確認書.pdf', status: '共有済み', date: '2026-08-12' },
    ],
    followUps: [{ label: '次回面談資料を送付', due: '9/24', status: '未完了' }],
    profileExtra: {
      marital: '未婚',
      family: '単身世帯',
      nationality: '日本',
      occupation: '会社員',
      workplace: 'JLR',
      role: '営業企画マネージャー',
      income: '¥920万',
      updatedAt: '2026-09-20',
    },
  }
  return c
}

export function buildAdvisorDemoBundle() {
  const base = createDemoData()
  const nam = buildNamJustin()
  const clients = [nam, ...base.clients]
  const meetings = [
    ...nam.meetings.map((m) => ({
      ...m,
      clientId: nam.id,
      clientName: nam.name,
      advisorName: nam.advisorName,
    })),
    ...base.meetings,
  ]
  return {
    ...base,
    clients,
    meetings,
    featuredId: nam.id,
    advisor: { id: 'a-justin', name: 'Justin', initial: 'J' },
  }
}

export { formatYen, riskLabel }
