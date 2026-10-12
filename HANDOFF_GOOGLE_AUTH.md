# Google OAuth + 簡易会員登録

## 概要

- **メール登録**: ニックネーム + メール + パスワード + 規約同意（1画面）
- **Google 登録/ログイン**: Supabase OAuth → `/signup-complete` → 元ページ or `/complete-profile`（Google 初回のみニックネーム+同意）
- **投資プロフィール・電話・イベント**: 登録後（`/complete-profile` またはマイページ）— 任意
- **メール認証**: ソフトゲート（ログイン可・未確認時は画面上部バナー）

## Supabase ダッシュボード設定（必須）

### 1. Google Provider

1. [Google Cloud Console](https://console.cloud.google.com/) → OAuth 同意画面 + **Web クライアント ID**
2. **Authorized redirect URIs**:
   ```
   https://<PROJECT_REF>.supabase.co/auth/v1/callback
   ```
3. Supabase → **Authentication → Providers → Google** → Enable
4. Client ID / Client Secret を貼り付け

### 2. Redirect URLs

**Authentication → URL Configuration → Redirect URLs** に追加:

```
https://www.moneymart.co.jp/signup-complete
http://localhost:5173/signup-complete
```

### 3. メール確認（推奨: ソフトゲート）

**Authentication → Providers → Email**:

- **Confirm email** を **OFF** にすると、登録直後にセッションが立ちます（転換率最大）
- **ON** のままなら、未確認でもログインできるよう Supabase の「Confirm email required for login」相当を OFF に（プロジェクト設定による）
- 未確認ユーザーには `EmailVerificationBanner` が表示されます

## イベント・キャンペーン時

| 目的 | 方法 |
|------|------|
| 流入計測 | リンクに `?utm_source=note&utm_medium=event&utm_campaign=2026-summer` |
| 友達紹介 | `?ref=CODE`（登録フォーム不要・自動適用） |
| 電話・クーポン | イベント LP または `/complete-profile` / マイページで opt-in |
| 投資プロフィール | 登録後バナー or 診断利用時（任意） |

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| `src/pages/Signup.jsx` | 1画面メール登録 |
| `src/pages/Login.jsx` | Google + メールログイン |
| `src/hooks/useAuth.js` | `signInWithGoogle`, `signUp` |
| `src/pages/CompleteProfilePage.jsx` | Google 初回: ニックネーム+同意 |
| `src/components/auth/GoogleSignInButton.jsx` | 共通ボタン |
| `src/components/auth/EmailVerificationBanner.jsx` | 未確認メールバナー |
