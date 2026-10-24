// 重なりチェック共通カタログ — iOS リポジトリ docs/overlap_check_catalog.json のコピー (scripts/test-overlap-check.mjs で一致を確認)
export default {
  "version": "2026-10-24",
  "note": "重なりチェック共通カタログ (iOS・Android・Web で同じ内容を使う). 連動指数は各ファンド名・目論見書で公表されている事実. 値動き・純資産のデータは使わない. 連動指数を目論見書で確認できないファンドは載せない (例: 楽天・プラス・オールカントリーは未確認のため除外).",
  "funds": [
    {
      "id": "emaxis-slim-acwi",
      "name": "eMAXIS Slim 全世界株式（オール・カントリー）",
      "short": "オルカン",
      "index": "MSCI ACWI",
      "kind": "投資信託"
    },
    {
      "id": "emaxis-slim-acwi-exjp",
      "name": "eMAXIS Slim 全世界株式（除く日本）",
      "short": "オルカン（除く日本）",
      "index": "MSCI ACWI 除く日本",
      "kind": "投資信託"
    },
    {
      "id": "emaxis-slim-sp500",
      "name": "eMAXIS Slim 米国株式（S&P500）",
      "short": "スリム S&P500",
      "index": "S&P 500",
      "kind": "投資信託"
    },
    {
      "id": "emaxis-slim-kokusai",
      "name": "eMAXIS Slim 先進国株式インデックス",
      "short": "スリム 先進国",
      "index": "MSCI コクサイ",
      "kind": "投資信託"
    },
    {
      "id": "emaxis-slim-topix",
      "name": "eMAXIS Slim 国内株式（TOPIX）",
      "short": "スリム TOPIX",
      "index": "TOPIX",
      "kind": "投資信託"
    },
    {
      "id": "emaxis-slim-n225",
      "name": "eMAXIS Slim 国内株式（日経平均）",
      "short": "スリム 日経平均",
      "index": "日経平均",
      "kind": "投資信託"
    },
    {
      "id": "emaxis-slim-em",
      "name": "eMAXIS Slim 新興国株式インデックス",
      "short": "スリム 新興国",
      "index": "MSCI エマージング",
      "kind": "投資信託"
    },
    {
      "id": "sbi-v-sp500",
      "name": "SBI・V・S&P500インデックス・ファンド",
      "short": "SBI・V・S&P500",
      "index": "S&P 500",
      "kind": "投資信託"
    },
    {
      "id": "sbi-v-vti",
      "name": "SBI・V・全米株式インデックス・ファンド",
      "short": "SBI・V・全米",
      "index": "米国株式市場全体",
      "kind": "投資信託"
    },
    {
      "id": "sbi-v-vt",
      "name": "SBI・V・全世界株式インデックス・ファンド",
      "short": "SBI・V・全世界",
      "index": "FTSE Global All Cap",
      "kind": "投資信託"
    },
    {
      "id": "rakuten-vti",
      "name": "楽天・全米株式インデックス・ファンド",
      "short": "楽天・全米",
      "index": "米国株式市場全体",
      "kind": "投資信託"
    },
    {
      "id": "rakuten-vt",
      "name": "楽天・全世界株式インデックス・ファンド",
      "short": "楽天・全世界",
      "index": "FTSE Global All Cap",
      "kind": "投資信託"
    },
    {
      "id": "rakuten-plus-sp500",
      "name": "楽天・プラス・S&P500インデックス・ファンド",
      "short": "楽天・プラス・S&P500",
      "index": "S&P 500",
      "kind": "投資信託"
    },
    {
      "id": "nissay-kokusai",
      "name": "ニッセイ外国株式インデックスファンド",
      "short": "ニッセイ外国株式",
      "index": "MSCI コクサイ",
      "kind": "投資信託"
    },
    {
      "id": "tawara-kokusai",
      "name": "たわらノーロード 先進国株式",
      "short": "たわら先進国",
      "index": "MSCI コクサイ",
      "kind": "投資信託"
    },
    {
      "id": "tawara-acwi",
      "name": "たわらノーロード 全世界株式",
      "short": "たわら全世界",
      "index": "MSCI ACWI",
      "kind": "投資信託"
    },
    {
      "id": "ifreenext-ndx",
      "name": "iFreeNEXT NASDAQ100インデックス",
      "short": "iFree NASDAQ100",
      "index": "NASDAQ-100",
      "kind": "投資信託"
    },
    {
      "id": "nissay-ndx",
      "name": "ニッセイNASDAQ100インデックスファンド",
      "short": "ニッセイ NASDAQ100",
      "index": "NASDAQ-100",
      "kind": "投資信託"
    },
    {
      "id": "1306",
      "name": "NEXT FUNDS TOPIX連動型上場投信",
      "short": "1306",
      "symbol": "1306.T",
      "index": "TOPIX",
      "kind": "ETF"
    },
    {
      "id": "1321",
      "name": "NEXT FUNDS 日経225連動型上場投信",
      "short": "1321",
      "symbol": "1321.T",
      "index": "日経平均",
      "kind": "ETF"
    },
    {
      "id": "2558",
      "name": "MAXIS 米国株式（S&P500）上場投信",
      "short": "2558",
      "symbol": "2558.T",
      "index": "S&P 500",
      "kind": "ETF"
    },
    {
      "id": "2559",
      "name": "MAXIS 全世界株式（オール・カントリー）上場投信",
      "short": "2559",
      "symbol": "2559.T",
      "index": "MSCI ACWI",
      "kind": "ETF"
    },
    {
      "id": "voo",
      "name": "バンガード S&P500 ETF",
      "short": "VOO",
      "symbol": "VOO",
      "index": "S&P 500",
      "kind": "米国ETF"
    },
    {
      "id": "vti",
      "name": "バンガード 米国トータル・ストック・マーケット ETF",
      "short": "VTI",
      "symbol": "VTI",
      "index": "米国株式市場全体",
      "kind": "米国ETF"
    },
    {
      "id": "vt",
      "name": "バンガード トータル・ワールド・ストック ETF",
      "short": "VT",
      "symbol": "VT",
      "index": "FTSE Global All Cap",
      "kind": "米国ETF"
    },
    {
      "id": "qqq",
      "name": "インベスコ QQQ トラスト",
      "short": "QQQ",
      "symbol": "QQQ",
      "index": "NASDAQ-100",
      "kind": "米国ETF"
    }
  ],
  "containment_additions": [
    {
      "child": "S&P 500",
      "parent": "MSCI ACWI 除く日本",
      "all": false
    },
    {
      "child": "NASDAQ-100",
      "parent": "MSCI ACWI 除く日本",
      "all": false
    },
    {
      "child": "ダウ平均",
      "parent": "MSCI ACWI 除く日本",
      "all": false
    },
    {
      "child": "米国株式市場全体",
      "parent": "MSCI ACWI 除く日本",
      "all": false
    },
    {
      "child": "MSCI コクサイ",
      "parent": "MSCI ACWI 除く日本",
      "all": true
    },
    {
      "child": "MSCI ACWI 除く日本",
      "parent": "MSCI ACWI",
      "all": true
    },
    {
      "child": "MSCI エマージング",
      "parent": "MSCI ACWI",
      "all": true
    },
    {
      "child": "MSCI エマージング",
      "parent": "MSCI ACWI 除く日本",
      "all": true
    },
    {
      "child": "MSCI エマージング",
      "parent": "FTSE Global All Cap",
      "all": false
    }
  ]
}
