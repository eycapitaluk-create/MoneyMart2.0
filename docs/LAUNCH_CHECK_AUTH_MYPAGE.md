# 顧客向け 登録・ログイン・活動・セキュリティ・DB・マイページ 点検メモ

## 1. 顧客 登録・ログイン

### 実装状況
| 項目 | 状態 | 備考 |
|------|------|------|
| メール登録 | ✅ | `Signup.jsx` → `useAuth.signUp`。必須: 名前・ニックネーム・メール・パスワード。規約・プライバシー同意必須。 |
| パスワードルール | ✅ | 8文字以上・英字+数字 (`PASSWORD_RULE`)。確認用一致チェックあり。 |
| プロフィール保存 | ✅ | 登録時 `user_profiles` に upsert（full_name, nickname, phone, marketing_opt_in）。 |
| 自動作成トリガー | ✅ | `auth.users` INSERT 後に `handle_new_user_profile` で `user_profiles` 自動作成・更新（Googleログイン含む）。 |
| Google OAuth | ✅ | `signInWithGoogle`。リダイレクト先は `/mypage`。 |
| ログアウト | ✅ | `useAuth.signOut`。Navbar・MyPageから呼び出し。 |
| メール認証 | ⚠️ | Supabase の「メール確認」は設定次第。未確認時のエラーメッセージは `useAuth` で日本語化済み。 |

### 不足・推奨
- **パスワードリセット（忘れた場合）**: UI に「パスワードを忘れた」リンク・画面なし。Supabase の `resetPasswordForEmail` を用意し、ログイン画面にリンク追加を推奨。
- **登録後フロー**: メール登録後は「確認メールをチェック」と表示し `/login` へ。メール確認必須にしている場合は問題なし。

---

## 2. 活動（アクティビティ）

### 実装状況
| 項目 | 状態 | 備考 |
|------|------|------|
| イベント記録 | ✅ | MyPage で `user_activity_events` に insert（`event_name`, `event_meta`）。保存試行・成功など。 |
| RLS | ✅ | 本人のみ insert（user_id = auth.uid()）。本人のみ select 可能。 |
| 管理側集計 | ✅ | `refresh_admin_daily_metrics` で DAU・登録数・マイページ保存試行/成功など集計。 |

### 不足・推奨
- **顧客向け「最近の活動」**: イベントは記録・本人参照可能だが、マイページに「最近の活動」一覧は未実装。必要なら一覧UIを追加可能。
- **監査ログ**: 変更履歴（誰がいつ何を変更したか）は未実装。規制対応が必要なら別テーブル・トリガーで検討。

---

## 3. セキュリティ

### 実装状況
| 項目 | 状態 | 備考 |
|------|------|------|
| RLS（ユーザー別データ） | ✅ | `user_expenses`, `user_insurances`, `user_asset_positions`, `user_point_accounts`, `user_finance_profiles`, `user_watchlists`, `user_owned_stocks`, `user_owned_funds`, `user_profiles` はすべて `auth.uid() = user_id` で select/insert/update/delete 制限。 |
| API の user_id | ✅ | マイページからの保存・削除はすべて `user.id` を渡しており、RLS と整合。 |
| 認証必須 | ✅ | マイページ・ラウンジ投稿などはセッション前提。未ログイン時はログインへ誘導。 |
| キー・秘密 | ✅ | クライアントは `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` のみ。サーバー用キーは env のみ（ハードコード fallback は削除済み）。 |

### 不足・推奨
- **レート制限**: サインアップ・ログイン・API のレート制限は Supabase 標準に依存。 abuse 対策で Vercel / Supabase の制限や追加の rate limit を検討。
- **パスワードリセット**: 上記のとおり未実装。実装推奨。

---

## 4. データベース管理

### 実装状況
| 項目 | 状態 | 備考 |
|------|------|------|
| スキーマ | ✅ | MyPage 用は `SUPABASE_SETUP_MYPAGE_CORE.sql`、保有資産は `SUPABASE_SETUP_MYPAGE_OWNED_ASSETS.sql`、プロフィールは `SUPABASE_SETUP_USER_PROFILES.sql`。 |
| 更新日時 | ✅ | 各テーブル `updated_at` とトリガーで自動更新。 |
| テーブル不在時 | ✅ | `myPageApi` の `loadMyPageData` / `loadOwnedAssetPositions` 等で `isTableMissingError` 時に空で返却しクラッシュ防止。 |

### 運用で確認すべきこと
- **バックアップ**: Supabase の PITR / バックアップ設定を確認。
- **保持期間**: イベント・ログの保持方針が未定義。必要に応じて削除ジョブやアーカイブを検討。
- **マイグレーション**: スキーマ変更時は SQL をバージョン管理し、本番適用手順を明文化すると安全。

---

## 5. マイページ データ入力・保存・管理

### 実装状況
| データ種別 | 取得 | 追加 | 更新 | 削除 | テーブル |
|------------|------|------|------|------|----------|
| 支出 | ✅ | ✅ | （個別更新は未） | ✅ | user_expenses |
| 保険 | ✅ | ✅ | （個別更新は未） | ✅ | user_insurances |
| ポイント口座 | ✅ | ✅ | （個別更新は未） | ✅ | user_point_accounts |
| 資産ポジション | ✅ | ✅ | ✅ | ✅ | user_asset_positions |
| 年間収入・予算目標 | ✅ | - | ✅（upsert） | - | user_finance_profiles |
| ウォッチリスト（ファンド・商品） | ✅ | ✅ | ✅ | ✅ | user_watchlists |
| 保有株式・ファンド | ✅ | - | 一括置換 ✅ | - | user_owned_stocks, user_owned_funds |

- いずれも **user_id を付与** しており、RLS で他ユーザーデータの操作は不可。
- テーブルが存在しない環境では `loadMyPageData` 等が空で返し、デモデータ表示にフォールバック。

### 不足・推奨
- **支出・保険・ポイントの「編集」**: 現在は追加と削除のみ。編集フォームを出す場合は、既存行の update（`user_id` 一致を維持）を追加するとよい。
- **データ export**: 自分のデータを CSV 等でダウンロードする機能は未実装。GDPR 等を意識する場合は検討。
- **アカウント削除**: 削除フローと、関連テーブルの削除（または匿名化）方針が未実装。必要なら Supabase の削除＋RPC で一括削除を検討。

---

## 6. 総合チェックリスト（ランンチ前）

| # | 項目 | 推奨 |
|---|------|------|
| 1 | パスワードリセット（忘れた場合）の UI・API | 追加を推奨 |
| 2 | 支出・保険・ポイントの「編集」 | 必要なら update API・UI 追加 |
| 3 | 顧客向け「最近の活動」表示 | 任意 |
| 4 | データ export（CSV 等） | 規制・要望に応じて検討 |
| 5 | アカウント削除フロー | 規制・要望に応じて検討 |
| 6 | Supabase バックアップ・リテンション確認 | 運用で実施 |
| 7 | サインアップ・ログインのレート制限 | 必要に応じて Supabase/Vercel で確認・強化 |

---

*このメモはコードベースの状態に基づく点検結果です。実際の本番運用では Supabase ダッシュボードの認証設定・RLS・バックアップもあわせて確認してください。*
