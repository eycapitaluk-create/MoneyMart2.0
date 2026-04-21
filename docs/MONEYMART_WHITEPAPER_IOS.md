# MoneyMart 2.0 백서 (iOS 앱 개발용)

> **목적**: Claude 등 AI에게 전달하여 iOS 네이티브 앱을 개발할 때 참고할 기술 명세서입니다.  
> 기존 React/Vite 웹앱과 Supabase 백엔드를 기준으로, 동일 기능을 iOS에서 구현하기 위한 정보를 정리했습니다.

---

## Claude에 전달할 때 (한국어 예시)

```
아래 MoneyMart 백서를 참고해서 SwiftUI로 iOS 네이티브 앱을 만들어 주세요.
- Supabase를 백엔드로 사용 (인증, DB)
- 주요 기능: 홈, 마켓, 주식, 펀드, 뉴스, 도구, 마이페이지
- 디자인: 오렌지(#f97316) 액센트, 다크모드 지원
- 언어: 일본어 메인
```

---

## 1. アプリ概要

### 1.1 コンセプト
**MoneyMart** は、日本在住の個人投資家向けの資産管理・投資情報アプリです。
- **タグライン**: "My Money, My Future"
- **主な対象**: 日本株・米国株・ETF・投資信託に興味を持つ個人投資家
- **言語**: 日本語メイン（一部英語データ混在）
- **通貨**: 円（JPY）ベース、米ドル建て資産は為替換算表示

### 1.2 技術スタック（既存）
- **フロント**: React 19 + Vite + Tailwind CSS
- **バックエンド**: Supabase（Auth, PostgreSQL, Realtime, Storage）
- **外部API**: 中間データ事業者（株価・ETF）、The News API / NewsData.io（ニュース）、Anthropic（AI要約）
- **デプロイ**: Vercel

### 1.3 iOS版で必要な技術
- SwiftUI または UIKit
- Supabase Swift SDK
- ダークモード対応
- 日本語ローカライズ

---

## 2. 画面・ルート構成

| パス | 画面名 | 説明 | 認証 |
|------|--------|------|------|
| `/` | ホーム | トップ・ETFランキング・投資シミュレーション入口 | 不要 |
| `/market` | マーケット | 市場指数・相場一覧 | 不要 |
| `/stocks` | 株式 | 株式銘柄検索・ウォッチリスト | 不要 |
| `/funds` | ファンド | ETF・投資信託一覧・検索・フィルタ | 不要 |
| `/funds/:id` | ファンド詳細 | 個別ETF詳細・チャート・保有追加 | 不要 |
| `/funds/compare` | ファンド比較 | 複数ETF比較 | 不要 |
| `/news` | ニュース | 市場ニュース・AI要約ニュース | 不要 |
| `/tools` | ツール | シミュレーター・計算機群 | 不要 |
| `/lounge` | ラウンジ | コミュニティ・投稿 | 不要 |
| `/mypage` | マイページ | 資産・配当・税金・コーチ | 要 |
| `/login` | ログイン | メール/パスワード認証 | - |
| `/signup` | 会員登録 | 新規登録 | - |
| `/forgot-password` | パスワード忘れ | リセットメール送信 | - |
| `/reset-password` | パスワードリセット | 新パスワード入力 | - |
| `/complete-profile` | プロフィール完了 | 同意・ニックネーム等 | 要 |
| `/legal/:type` | 法的ページ | 利用規約・プライバシー | 不要 |
| `/faq` | FAQ | よくある質問 | 不要 |
| `/about` | 会社概要 | アプリ情報 | 不要 |

---

## 3. 主要機能の詳細

### 3.1 ホーム (`/`)
- **ETFランキング**: 1年収益率・出来高順の上位表示
- **カテゴリ**: 国内株式、米国株式、全世界株式、債券、REIT、コモディティ等
- **投資シミュレーション**: 月額・利回り・年数入力 → 将来資産予測
- **CTA**: ニュース、ファンド、ツールへの導線

### 3.2 マーケット (`/market`)
- 主要指数（日経225、TOPIX、S&P500、NASDAQ等）の表示
- 商品別（原油、金等）の相場
- 為替（USD/JPY等）

### 3.3 株式 (`/stocks`)
- 銘柄検索（ティッカー・銘柄名）
- ウォッチリスト（ログイン時）
- 日本株・米国株の区別（JP: .T、US: ティッカー）

### 3.4 ファンド (`/funds`)
- **一覧**: ETF・投資信託の検索・フィルタ
  - フィルタ: 資産クラス（株式/債券/REIT/コモディティ）、サブカテゴリ（国内/米国/全世界等）
  - ソート: 1年収益率、信託報酬、出来高、名前順
- **詳細**: チャート、信託報酬、NISA区分、保有株数入力
- **ウォッチリスト**: ログイン時、DBに保存

**データソース**:
- `stock_symbols`（category, subcategory, country, trust_fee, nisa_category, aum）
- `v_stock_latest`（日次価格）
- `stock_daily_prices`（過去価格・チャート用）

### 3.5 ニュース (`/news`)
- **注意**: 「投資推奨ではない。情報提供のみ」の明示
- **バケット**:
  - `market_ticker`: 市場速報
  - `market_pickup`: 市場ピックアップ
  - `fund_pickup`: ファンド関連
  - `stock_disclosures`: 決算・開示
  - `daily_brief`: 日次ブリーフ
- **AIニュース**: `ai_news_summaries`（銘柄別AI要約・センチメント）

**テーブル**:
- `news_manual`: bucket, title, source, url, image_url, published_at, topic
- `ai_news_summaries`: ticker, company_name, headline, summary, sentiment, source_url

### 3.6 ツール (`/tools`)
| ツール | 説明 |
|--------|------|
| 新NISAシミュレーター | 積立・成長枠の月額・利回り・年数 → 複利収益・節税効果 |
| 積立 vs 一括投資 | 一括 vs DCA の比較 |
| 税金計算機 | 売却益・配当の税金計算、NISA節税 |
| 為替積立計算機 | 毎月円→ドル換算の積立シミュレーション |
| 配当カレンダー | 銘柄の配当月・金額を手動入力・月別可視化 |

**配当カレンダー**:
- 銘柄: ティッカー・銘柄名は自動補完（`stock_symbols` または `dividendStockUniverse`）
- 配当月・配当金: **ユーザー手動入力**
- データ: `user_dividend_watchlist`（user_id, stock_id, stock_name, dividends: [{month, amount}], qty）

### 3.7 マイページ (`/mypage`)
タブ構成: `wealth` | `stock` | `fund` | `point` | `debt` | `coach` | `dividend`

#### wealth（資産）
- 資産ポジション（名前、現在価値、投資元本、色）
- 保有株式・保有ファンド（ウォッチから追加、株数・価格）
- 経費、保険、ポイント口座
- 財務プロフィール（年収、予算目標）

#### stock（株式）
- 株式ウォッチリスト
- 保有株式の管理

#### fund（ファンド）
- ファンドウォッチリスト
- ファンド最適化セット（ワークセット）

#### point（ポイント）
- ポイント口座（名前、残高、有効期限）
- 期限切れアラート

#### debt（借金）
- リボ・カードローン（残高、APR、月返済）
- 借り換えシミュレーション

#### coach（コーチ）
- 税金シミュレーション（iDeCo、NISA、保険控除）
- キャッシュフロー最適化

#### dividend（配当カレンダー）
- 銘柄追加（ティッカー・銘柄名・配当月・配当金を手動入力）
- 株数調整
- 月別カレンダー表示

---

## 4. 認証・ユーザー

### 4.1 Supabase Auth
- **方式**: メール/パスワード
- **パスワードリセット**: リカバリーハッシュ付きURL → `/reset-password` で新パスワード入力
- **プロフィール**: `user_profiles` または `auth.users` の user_metadata

### 4.2 同意フロー
- 初回ログイン後、`consent_acknowledged_at` が未設定なら `/complete-profile` へリダイレクト
- 同意・ニックネーム等を入力後に完了

### 4.3 ロール
- `user_roles`: `viewer` | `admin`
- 管理者は `/admin` にアクセス可能

---

## 5. データモデル（Supabase）

### 5.1 主要テーブル

| テーブル | 用途 |
|----------|------|
| `auth.users` | 認証（Supabase組み込み） |
| `user_profiles` | ユーザー表示名・プラン・同意日時 |
| `user_roles` | 管理者フラグ |
| `user_watchlists` | ファンド・商品のウォッチ（item_type, item_id, item_name） |
| `user_expenses` | 経費（spent_on, category, merchant, amount） |
| `user_insurances` | 保険（product_name, monthly_premium, maturity_date） |
| `user_asset_positions` | 資産（name, current_value, invest_value, color） |
| `user_point_accounts` | ポイント（name, balance, expiry） |
| `user_finance_profiles` | 年収・予算目標 |
| `user_dividend_watchlist` | 配当ウォッチ（stock_id, stock_name, dividends, qty） |
| `user_owned_stocks` | 保有株式 |
| `user_owned_funds` | 保有ファンド |
| `stock_symbols` | 銘柄マスタ（symbol, name, category, subcategory, country, trust_fee, nisa_category, aum） |
| `stock_daily_prices` | 日次価格（symbol, trade_date, open, close, volume） |
| `v_stock_latest` | 最新価格ビュー |
| `news_manual` | ニュース（bucket, title, source, url, image_url, published_at） |
| `ai_news_summaries` | AIニュース（ticker, headline, summary, sentiment, source_url） |

### 5.2 RLS（Row Level Security）
- 全ユーザーテーブルは `auth.uid() = user_id` でフィルタ
- `stock_symbols`, `stock_daily_prices`, `news_manual`, `ai_news_summaries` は公開読み取り

---

## 6. 外部API・環境変数

### 6.1 必須
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`: クライアント用
- `SUPABASE_SERVICE_ROLE_KEY`: サーバー・cron用（iOSでは不要）

### 6.2 オプション（ウェブのみ）
- 中間データ事業者: 株価取得（cronでSupabaseに保存済み）
- The News API / NewsData.io: ニュース（cronでSupabaseに保存済み）
- Anthropic: AI要約（cronでSupabaseに保存済み）

**iOSアプリ**: 基本的にSupabaseから読み取るのみ。cronは既存Vercelで処理。

---

## 7. UI/UX ガイドライン

### 7.1 デザイン
- **主色**: オレンジ（#f97316）をアクセント
- **ロゴ**: オレンジ〜赤グラデーションの「M」マーク
- **フォント**: Inter, Noto Sans JP, sans-serif
- **ダークモード**: 完全対応（`dark:` クラス）

### 7.2 ナビゲーション
- トップ: マーケット、株式、ファンド、ニュース、ツール
- 右: ラウンジ、マイページ（ログイン時）、テーマ切替、通知、ログイン/ログアウト

### 7.3 通知
- 保険満期30日以内
- ポイント期限30日以内
- ベルアイコンでバッジ表示

---

## 8. iOS実装時の注意点

### 8.1 Supabase Swift SDK
```swift
// 認証
let session = try await supabase.auth.signIn(email: email, password: password)

// データ取得
let rows: [NewsRow] = try await supabase
  .from("news_manual")
  .select()
  .eq("bucket", value: "market_ticker")
  .eq("is_active", value: true)
  .order("published_at", ascending: false)
  .execute()
  .value
```

### 8.2 リッチテキスト・表示
- ニュースは `title`, `description`, `image_url`, `url` を表示
- ファンドは `trust_fee`, `nisa_category` をバッジ表示
- チャートは `stock_daily_prices` の `close` を時系列でプロット

### 8.3 オフライン
- キャッシュ戦略: ニュース・ファンド一覧はキャッシュしてオフライン表示可能にするとUX向上

### 8.4 データ整合性
- 株価・ファンドは実データを優先。ダミー・プレースホルダーは使用しない
- ソースが無効な場合は空/エラー表示とする

---

## 9. 参考ファイル（コードベース内）

| ファイル | 内容 |
|----------|------|
| `src/App.jsx` | ルート・認証・ウォッチリスト |
| `src/pages/HomePage.jsx` | ホーム |
| `src/pages/FundPage.jsx` | ファンド一覧・フィルタ |
| `src/pages/NewsPage.jsx` | ニュース |
| `src/pages/MyPage.jsx` | マイページ全タブ |
| `src/pages/ToolsHubPage.jsx` | ツール群 |
| `src/lib/supabase.js` | Supabaseクライアント |
| `src/lib/myPageApi.js` | マイページAPI |
| `SUPABASE_SETUP_*.sql` | テーブル定義 |

---

## 10. バージョン・更新

- ドキュメント作成日: 2026-03
- 対象: MoneyMart 2.0 ウェブアプリ（React/Vite）

---

**Claudeへの指示例**:
> 上記のMoneyMart 백서を参照して、SwiftUIでiOSネイティブアプリを開発してください。Supabaseをバックエンドとして使用し、認証・ファンド一覧・ニュース・マイページ・ツールの主要機能を実装してください。デザインはオレンジをアクセントにしたモダンなUIで、ダークモード対応をお願いします。
