/**
 * Filters `news_manual` rows for market / fund surfaces so off-topic JP stories
 * (lifestyle, comics, etc.) do not appear beside investing content.
 * Used by MarketPage (CSR) and api/ssr/market (SSR) so crawlers and users see the same set.
 */

const FINANCE_HINT =
  /株価|株式|投資|ETF|投信|上場投信|NISA|iDeCo|ideco|為替|円安|円高|金利|日銀|FRB|FOMC|CPI|GDP|決算|配当|リート|REIT|国債|社債|原油|金先物|指数|TOPIX|日経|ドル.?円|ドル\/円|暴落|上昇率|下落|市場|証券|アナリスト|ファンド|ポートフォリオ|新NISA|つみたて|成長投資枠|バリュエーション|PER|PBR|ROE|業績|売上高|営業利益|純利益|セクター|ハイテク|半導体|金融株|長期金利|イールド|スプレッド|マーケット|エクイティ|債券|コモディティ|ビットコイン|暗号資産/i

const OFF_TOPIC =
  /精子バンク|不妊|妊活|4コマ|四コマ|漫画連載|マンガ連載|(?:新型|路線)?バス(?:が|の|で|、|\u3000).{0,12}(?:運行|デビュー|就航|公開)|女子(?:プロ)?野球.*ラジオ|ラジオ.*女子(?:プロ)?野球|連載(?:小説|エッセイ)(?!.*(?:経済|投資|市場|株))/i

const HAS_JP_TICKER = /\d{4}(?:\.T)?\b/

/**
 * @param {object} row — raw `news_manual` or normalized client row with title, description, language
 */
export function isMarketRelevantManualNews(row) {
  if (!row || typeof row !== 'object') return false
  const lang = String(row.language ?? 'ja').toLowerCase()
  if (lang !== 'ja') return false
  const title = String(row.title || '')
  const desc = String(row.description || '')
  const text = `${title} ${desc}`
  if (!text.trim()) return false
  if (OFF_TOPIC.test(text)) return false
  if (FINANCE_HINT.test(text)) return true
  if (HAS_JP_TICKER.test(title)) return true
  return false
}
