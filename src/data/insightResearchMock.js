export const INSIGHT_RESEARCH_MOCK_STORAGE_KEY = 'mm_admin_insight_research_mock_v1'

export const INSIGHT_RESEARCH_MOCK_DEFAULT = {
  issue: 'ISSUE 04 — 2026.05',
  titleLead: 'AI狂騒曲、',
  titleAccent: 'どこまで続くか',
  titleTail: 'ドットコムバブルと何が違うのか',
  subtitle:
    'SanDisk +330%、AMD +90%——。2026年の半導体株は歴史的な上昇を続ける。これは「新産業革命の夜明け」か、それとも「1999年の再来」か。データで読み解く。',
  date: '2026年5月10日',
  category: 'マクロ／半導体',
  readTime: '約8分',
  source: 'Bloomberg / 各社決算',
  coverImageUrl: '',
  coverImageCaption: '記事冒頭に大きく表示するヒーロー画像。インフォグラフィック、チャート、キービジュアルを想定。',
  /** false のとき Market Snapshot（3カード）ブロックをプレビューに出さない */
  showMarketSnapshot: true,
  findings: [
    '今のAI相場は「売上高ゼロの夢」で動いたドットコムバブルとは根本的に異なり、実際の収益成長が株価を支えている',
    'ただし、オプション市場の過熱や半導体の粗利80%超という数字は「サイクルピーク」の兆候を示す',
    '長期積立投資家には「今が最高値」より「継続できるか」が問われる局面。個別株集中はリスク管理を徹底すべき段階',
  ],
  stats: [
    { value: '+469%', label: 'SanDisk（SNDK）\n2026年初来パフォーマンス', tone: 'red' },
    { value: '+90%', label: 'AMD\n底値比リカバリー率', tone: 'gold' },
    { value: '2.6兆$', label: 'S&P500コールオプション\n1日の出来高（史上最高）', tone: 'ink' },
  ],
  sections: [
    {
      label: 'Section 01',
      title: '数字が語る「AI狂騒」の規模',
      body:
        '2026年、半導体セクターは前例のない上昇を記録している。SanDiskはわずか4ヶ月で大幅上昇し、AMDも底値比で大きく反発した。Nvidiaを中心としたAI半導体への資金流入は、市場の構造そのものを変えつつある。',
      chartTitle: 'Fig. 01 — 株価パフォーマンス比較',
      chartHeadline: 'AI主要銘柄の2026年年初来リターン',
      chartNote: '2026年1月2日を100として指数化。データ：各社決算・Bloomberg',
      imageUrl: '',
      imageCaption: '',
    },
    {
      label: 'Section 02',
      title: 'ドットコムバブルとの決定的な違い',
      body:
        '1999〜2000年のドットコムバブルとの比較は、今の相場を理解するうえで欠かせない視点だ。しかし、表面上の「株価急騰」だけを比較するのは危険な単純化である。',
      quote:
        '1999年、シスコのPERは200倍を超えていた。今のNvidiaのPERは約35〜40倍。数字が語る「バブルの質」は根本的に異なる。',
      chartTitle: 'Fig. 02 — バブル比較',
      chartHeadline: 'ドットコム期 vs AI相場：PERと売上高成長率の比較',
      chartNote: 'ドットコム期はNASDAQ100構成企業の中央値。AI期は半導体主要5社の平均。',
      imageUrl: '',
      imageCaption: '',
    },
    {
      label: 'Section 03',
      title: '警戒すべき3つのシグナル',
      body:
        '強気論と同時に、データは複数の「過熱シグナル」を発している。投資判断において、オプション市場の狂乱、粗利ピーク、集中リスクを無視することは合理的ではない。',
      chartTitle: 'Fig. 03 — リスクレーダー',
      chartHeadline: 'AI相場における過熱指標の現在位置',
      chartNote: '各指標を0（低リスク）〜100（高リスク）でスコアリング。MoneyMart独自推計。',
      imageUrl: '',
      imageCaption: '',
    },
  ],
  verdictTitle: '結論：「バブルではないが、慎重を要する局面」',
  verdictBody:
    'ドットコムバブルとの最大の違いは「実収益の存在」だ。数字は本物の需要を反映している。しかし、オプション過熱・粗利ピーク・集中リスクという三重の警戒信号が点灯している。',
  verdictItems: [
    { label: '長期積立投資家へ', body: 'インデックス積立（NISA）は継続が正解。「最高値で怖い」より「続けられるか」が問われる。' },
    { label: '個別株投資家へ', body: '半導体個別株は業績の本物性を確認しながらも、ポジションサイズの管理を徹底すべき局面。' },
    { label: '注目すべき次の焦点', body: 'AI設備投資、主要半導体企業のガイダンス、そして年末FRBの利下げ回数が相場の方向性を決める。' },
    { label: '最大のリスクシナリオ', body: 'AI設備投資の過剰が明確になった時点で、収益の巻き戻しが急速に進む可能性。' },
  ],
}

const toStringValue = (value, fallback = '') => {
  const s = String(value ?? '').trim()
  return s || fallback
}

const toArray = (value, fallback) => (Array.isArray(value) && value.length ? value : fallback)

export function normalizeInsightResearchMockDraft(value) {
  const src = value && typeof value === 'object' ? value : {}
  const base = INSIGHT_RESEARCH_MOCK_DEFAULT
  return {
    ...base,
    ...src,
    issue: toStringValue(src.issue, base.issue),
    titleLead: toStringValue(src.titleLead, base.titleLead),
    titleAccent: toStringValue(src.titleAccent, base.titleAccent),
    titleTail: toStringValue(src.titleTail, base.titleTail),
    subtitle: toStringValue(src.subtitle, base.subtitle),
    date: toStringValue(src.date, base.date),
    category: toStringValue(src.category, base.category),
    readTime: toStringValue(src.readTime, base.readTime),
    source: toStringValue(src.source, base.source),
    coverImageUrl: toStringValue(src.coverImageUrl, ''),
    coverImageCaption: toStringValue(src.coverImageCaption, base.coverImageCaption),
    showMarketSnapshot:
      typeof src.showMarketSnapshot === 'boolean' ? src.showMarketSnapshot : base.showMarketSnapshot,
    findings: toArray(src.findings, base.findings).map((item) => String(item || '').trim()).filter(Boolean),
    stats: toArray(src.stats, base.stats).map((item, idx) => ({
      value: toStringValue(item?.value, base.stats[idx]?.value || ''),
      label: toStringValue(item?.label, base.stats[idx]?.label || ''),
      tone: ['red', 'gold', 'ink'].includes(item?.tone) ? item.tone : (base.stats[idx]?.tone || 'ink'),
    })),
    sections: toArray(src.sections, base.sections).map((item, idx) => ({
      label: toStringValue(item?.label, base.sections[idx]?.label || `Section ${idx + 1}`),
      title: toStringValue(item?.title, base.sections[idx]?.title || ''),
      body: toStringValue(item?.body, base.sections[idx]?.body || ''),
      quote: toStringValue(item?.quote, base.sections[idx]?.quote || ''),
      chartTitle: toStringValue(item?.chartTitle, base.sections[idx]?.chartTitle || ''),
      chartHeadline: toStringValue(item?.chartHeadline, base.sections[idx]?.chartHeadline || ''),
      chartNote: toStringValue(item?.chartNote, base.sections[idx]?.chartNote || ''),
      imageUrl: toStringValue(item?.imageUrl, ''),
      imageCaption: toStringValue(item?.imageCaption, ''),
    })),
    verdictTitle: toStringValue(src.verdictTitle, base.verdictTitle),
    verdictBody: toStringValue(src.verdictBody, base.verdictBody),
    verdictItems: toArray(src.verdictItems, base.verdictItems).map((item, idx) => ({
      label: toStringValue(item?.label, base.verdictItems[idx]?.label || ''),
      body: toStringValue(item?.body, base.verdictItems[idx]?.body || ''),
    })),
  }
}
