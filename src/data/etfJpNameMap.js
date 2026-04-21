/**
 * US/Global ETF symbol -> Japanese display name (펀드페이지 일본어 표시용)
 * ETF_LIST_FROM_XLSX에 jpName이 있는 일본 ETF는 제외, 여기서는 미주/글로벌 ETF만
 */
export const ETF_JP_NAME_MAP = {
  // 全世界・米国
  SPY: 'スパイダー S&P500 ETF',
  IVV: 'iシェアーズ S&P500 ETF',
  VOO: 'バンガード S&P500 ETF',
  VTI: 'バンガード 米国全株ETF',
  QQQ: 'インベスコ QQQトラスト',
  VT: 'バンガード 全世界株式ETF',
  ACWI: 'iシェアーズ MSCI ACWI ETF',
  VXUS: 'バンガード 米国除く全世界株式ETF',
  EFA: 'iシェアーズ MSCI EAFE ETF（先進国除外米国）',
  IEFA: 'iシェアーズ コア MSCI EAFE ETF',
  EEM: 'iシェアーズ MSCI 新興国ETF',
  VEA: 'バンガード 先進国株式ETF',
  EWG: 'iシェアーズ MSCI ドイツETF',
  EWJ: 'iシェアーズ MSCI 日本ETF',
  EWU: 'iシェアーズ MSCI 英国ETF',
  EWZ: 'iシェアーズ MSCI ブラジルETF',
  MCHI: 'iシェアーズ MSCI 中国ETF',
  // 債券
  BND: 'バンガード 米国債券ETF',
  AGG: 'iシェアーズ 米国債券ETF',
  TLT: 'iシェアーズ 米国債20年超ETF',
  IEF: 'iシェアーズ 米国債7-10年ETF',
  SHY: 'iシェアーズ 米国債1-3年ETF',
  HYG: 'iシェアーズ ハイイールド社債ETF',
  LQD: 'iシェアーズ 投資適格社債ETF',
  TIP: 'iシェアーズ TIPS ETF',
  EMB: 'iシェアーズ 新興国債券ETF',
  // REIT
  VNQ: 'バンガード 米国REIT ETF',
  VNQI: 'バンガード 国際REIT ETF',
  // コモディティ
  GLD: 'SPDR 金ETF',
  SLV: 'iシェアーズ 銀ETF',
  USO: 'US 原油ETF',
  GDX: 'バンガード ゴールドマイナーズETF',
}

export const getEtfJpName = (symbol) => ETF_JP_NAME_MAP[symbol] || null
