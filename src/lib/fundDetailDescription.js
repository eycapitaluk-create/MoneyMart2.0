/**
 * FundDetailPage と SSR で共有するファンド説明文生成（推定テキストのみ。価格・リターンは別データ）。
 */
import { FUND_DESCRIPTIONS_BY_ISIN } from '../data/fundDescriptionsByIsin.js'

const classifyFundTheme = (name = '') => {
  const n = String(name || '').toUpperCase()
  if (n.includes('NASDAQ')) return '米国ハイテク株'
  if (n.includes('S&P 500') || n.includes('S&P500')) return '米国大型株'
  if (n.includes('ダウ') || n.includes('DOW')) return '米国主要株'
  if (n.includes('TOPIX')) return '日本株（TOPIX）'
  if (n.includes('日経２２５') || n.includes('日経225') || n.includes('NIKKEI')) return '日本株（日経平均）'
  if (n.includes('JPX日経') || n.includes('JPX')) return '日本株（JPX指数）'
  if (n.includes('Ｊリート') || n.includes('J-REIT') || n.includes('REIT')) return '不動産投資信託（REIT）'
  if (n.includes('米国債') || n.includes('国債') || n.includes('社債') || n.includes('BOND')) return '債券'
  if (n.includes('全世界') || n.includes('オール・カントリー') || n.includes('ACWI') || n.includes('KOKUSAI')) return '全世界株式'
  if (n.includes('新興国') || n.includes('EMERGING')) return '新興国株式'
  if (n.includes('銀行') || /\bBANK\b/.test(n)) return '東証銀行業株価'
  if ((n.includes('金') && !n.includes('年金')) || n.includes('GOLD')) return '金'
  if (n.includes('銀') || n.includes('SILVER')) return '銀'
  if (n.includes('プラチナ') || n.includes('PLATINUM')) return 'プラチナ'
  if (n.includes('原油') || n.includes('CRUDE') || n.includes('WTI')) return '原油'
  if (n.includes('半導体')) return '半導体関連株'
  if (n.includes('高配当') || n.includes('DIVIDEND')) return '高配当株'
  return '主要株価指数'
}

const buildGeneratedDescription = (symbol, fundName) => {
  const name = String(fundName || '')
  const upper = name.toUpperCase()
  const theme = classifyFundTheme(name)
  const isLeveraged = /レバレッジ|ブル2倍|ブル２倍|2倍|2X|LEVERAGED/.test(name) || /^(1570|1579|1568|2036)\.T$/.test(symbol)
  const isInverse = /インバース|ベア|ダブルインバース|INVERSE/.test(name)
  const isEtN = /ETN|NEXT NOTES/.test(upper)
  const isHedged = /ヘッジ|Ｈ有|\(H\)|\(Ｈ\)|Hあり|H有/.test(name)

  if (isLeveraged) {
    return `${theme}の値動きに対して概ね2倍程度の値動きを目指すレバレッジ型の${isEtN ? '上場投資商品（ETN）' : 'ETF'}です。短期的には上昇局面で効果が出やすい一方、下落局面やボラティリティ上昇時の値動きには注意が必要です。`
  }
  if (isInverse) {
    return `${theme}の逆方向の値動きを目指すインバース型ETFです。相場下落時のヘッジ用途で使われる一方、長期保有では乖離が生じる可能性があります。`
  }
  if (theme === '金' || theme === '銀' || theme === 'プラチナ' || theme === '原油') {
    return `${theme}価格への連動を目指す${isEtN ? 'ETN' : 'ETF'}です。株式とは異なる値動き特性を持つため、分散投資やインフレ局面の補完として活用されることがあります。`
  }
  if (theme === '債券') {
    return `${theme}指数に連動するETFです。${isHedged ? '為替ヘッジありの設計で、' : ''}株式ETFと比べて値動きが相対的に穏やかな傾向があり、ポートフォリオの安定化に用いられます。`
  }
  return `${theme}指数への連動を目指す${isEtN ? '上場投資商品（ETN）' : 'ETF'}です。${isHedged ? '為替ヘッジを活用し、為替変動の影響を抑える設計です。' : '市場全体の値動きを低コストで取り込みやすい設計です。'}`
}

const normalizeDescriptionTypography = (text = '') => {
  const halfWidth = String(text || '')
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/\u3000/g, ' ')
  return halfWidth
    .replace(/([A-Za-z])ー(?=\d)/g, '$1-')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function getFundDescription(symbol, isin, fundName) {
  const symbolKey = String(symbol || '').toUpperCase()
  const isinKey = String(isin || '').trim().toUpperCase()
  if (isinKey && FUND_DESCRIPTIONS_BY_ISIN[isinKey]) {
    return normalizeDescriptionTypography(FUND_DESCRIPTIONS_BY_ISIN[isinKey])
  }
  return normalizeDescriptionTypography(buildGeneratedDescription(symbolKey, fundName))
}
