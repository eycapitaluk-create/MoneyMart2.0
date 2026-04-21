/**
 * 株式ページ右カラム「企業ニュース」用のフォールバック。
 * 日次クロンが Supabase.display_cards を埋めている間はそちらを優先表示し、
 * 空のときだけこの静的行 + brief_points（レガシー）をマージして表示します。
 *
 * 下記は 2026/4/20 時点の主要企業トピック要約（参考ニュース）。各社公式開示で要確認。
 */

export const COMPANY_NEWS_BY_REGION = {
  US: [
    {
      id: 'us-tsla-2026-04-20',
      symbol: 'TSLA',
      company: 'テスラ',
      when: '2026/4/20 時点',
      phase: '米国企業',
      point:
        '4月22日（米時間）の市場終了後に1Q決算の発表が予定。テラファブ（Terafab）と呼ばれる1テラワット級AIデータセンター投資の具体規模に加え、FSD（完全自動運転）やロボタクシーのロードマップが株価の方向感を左右しそうです。',
    },
    {
      id: 'us-nvda-2026-04-20',
      symbol: 'NVDA',
      company: 'エヌビディア',
      when: '2026/4/20 時点',
      phase: '米国企業',
      point:
        '時価総額5兆ドル規模への再接近が話題。ウォール街の目標株価引き上げ（最高267ドル帯）やTSMCの好決算を背景に買い戻しが優勢。AI半導体需要を追い風に「5兆ドル再入場」への期待が高まっています。',
    },
    {
      id: 'us-msft-2026-04-20',
      symbol: 'MSFT',
      company: 'マイクロソフト',
      when: '2026/4/20 時点',
      phase: '米国企業',
      point:
        '4月29日の決算が焦点。Copilotを中心とした企業向け課金サブスクが売上成長にどれだけ寄与したかを証明できるかが注目され、クラウドAzureが前年比37〜38%台の高成長を維持できるかが材料になります。',
    },
    {
      id: 'us-googl-2026-04-20',
      symbol: 'GOOGL',
      company: 'アルファベット',
      when: '2026/4/20 時点',
      phase: '米国企業',
      point:
        'MSFTと同日程の決算を控え、検索広告の防衛に加え、前年比47%超の伸びが続いたクラウド部門の黒字拡大ペースが投資家の注目点です。',
    },
    {
      id: 'us-nflx-2026-04-20',
      symbol: 'NFLX',
      company: 'ネットフリックス',
      when: '2026/4/20 時点',
      phase: '米国企業',
      point:
        '「加入者数の非開示」転換による短期的な急落の後、堅調な営業利益率を材料に機関投資家の押し目買いが観測され、週末を挟んで心理的な下値を探る展開になっています。',
    },
  ],
  JP: [
    {
      id: 'jp-9984-2026-04-20',
      symbol: '9984.T',
      company: 'ソフトバンク',
      when: '2026/4/20 時点',
      phase: '日本企業',
      point:
        'OpenAIへの約100億ドル（約13兆円）規模の追加出資（4月1日発表分の履行）が報じられ、総額300億ドル規模のシリーズ投資の第1弾としてグローバルAI市場での存在感を強めています。',
    },
    {
      id: 'jp-7203-2026-04-20',
      symbol: '7203.T',
      company: 'トヨタ自動車',
      when: '2026/4/20 時点',
      phase: '日本企業',
      point:
        '今週のNFLドラフトを活用し、2026年型RAV4の認知拡大と、女子フラッグフットボール支援など社会貢献を組み合わせた大型キャンペーンを展開。北米でのブランドロイヤルティ強化が目的です。',
    },
    {
      id: 'jp-6758-2026-04-20',
      symbol: '6758.T',
      company: 'ソニーグループ',
      when: '2026/4/20 時点',
      phase: '日本企業',
      point:
        '世界最大級の放送機器見本市NABで新世代「Rシステム」カメラと、AIによる映像処理プラットフォームを公開。エンタメにとどまらず高付加価値のB2Bメディアソリューション市場での競争力強化が狙いです。',
    },
    {
      id: 'jp-8306-2026-04-20',
      symbol: '8306.T',
      company: '三菱UFJフィナンシャル・グループ',
      when: '2026/4/20 時点',
      phase: '日本企業',
      point:
        'インド金融市場へ向けた出資の完了を受け、東南アジア・南西アジアを軸にリテール金融ネットワークの統合を加速。国内の超低金利を補う収益多角化が焦点です。',
    },
    {
      id: 'jp-8035-2026-04-20',
      symbol: '8035.T',
      company: '東京エレクトロン',
      when: '2026/4/20 時点',
      phase: '日本企業',
      point:
        '2026年の半導体製造装置市場が前年比約20%成長するという社内見通しを公表するなど、AIサーバー向け先端パッケージング装置の受注・供給が材料に。日経平均の高値更新を牽引する一角として注目されています。',
    },
  ],
}

/** @param {Record<string, Array<{ id: string, point?: string }>>|null|undefined} briefByRegion */
export function mergeCompanyNewsWithAiBriefs(baseByRegion, briefByRegion) {
  if (!baseByRegion) return {}
  if (!briefByRegion || typeof briefByRegion !== 'object') return baseByRegion
  const out = { ...baseByRegion }
  for (const region of Object.keys(out)) {
    const base = Array.isArray(out[region]) ? out[region] : []
    const briefRows = Array.isArray(briefByRegion[region]) ? briefByRegion[region] : []
    if (briefRows.length === 0) continue
    const pointById = new Map(
      briefRows
        .filter((r) => r && r.id)
        .map((r) => [String(r.id), String(r.point || '').trim()])
        .filter(([, p]) => p.length > 0),
    )
    if (pointById.size === 0) continue
    out[region] = base.map((row) => {
      const next = pointById.get(String(row.id))
      if (!next) return row
      return { ...row, point: next }
    })
  }
  return out
}
