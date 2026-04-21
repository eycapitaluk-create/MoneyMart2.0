# MoneyMart 認証メールを自社ドメインから送る方法

Supabase Auth のデフォルトでは、認証メール（確認・パスワードリセット等）が `noreply@mail.app.supabase.io` など Supabase のアドレスから送信されます。  
**MoneyMart のドメインから送る**には、以下の2つを設定します。

---

## 1. カスタム SMTP の設定（送信元を MoneyMart に）

Supabase Dashboard → **Authentication** → **SMTP** で、自社 SMTP を設定します。

### 推奨サービス例

| サービス | 無料枠 | 特徴 |
|----------|--------|------|
| [Resend](https://resend.com) | 3,000通/月 | 設定が簡単、Supabase 連携ガイドあり |
| [Brevo (旧 Sendinblue)](https://www.brevo.com) | 300通/日 | 日本語対応 |
| [SendGrid](https://sendgrid.com) | 100通/日 | 実績多数 |
| [ZeptoMail](https://www.zoho.com/zeptomail/) | 制限あり | Zoho 系 |

### 設定手順（Resend 例）

1. [Resend](https://resend.com) でアカウント作成
2. **Domains** で `moneymart.jp`（またはサブドメイン `auth.moneymart.jp`）を追加
3. DNS に SPF / DKIM レコードを追加（Resend が案内）
4. Resend の **API Keys** から SMTP 情報を取得
   - Host: `smtp.resend.com`
   - Port: `465` または `587`
   - User: `resend`
   - Password: API Key

5. Supabase Dashboard → **Authentication** → **SMTP** で以下を入力：

| 項目 | 例 |
|------|-----|
| Sender email | `noreply@moneymart.jp` または `auth@moneymart.jp` |
| Sender name | `MoneyMart` |
| Host | `smtp.resend.com` |
| Port | `465` (SSL) または `587` (TLS) |
| Username | `resend` |
| Password | Resend API Key |

6. **Save** で保存

→ 以降、認証メールは `MoneyMart <noreply@moneymart.jp>` から送信されます。

---

## 2. メールテンプレートのカスタマイズ（本文を MoneyMart 風に）

Supabase Dashboard → **Authentication** → **Email Templates** で、各メールの件名・本文を編集できます。

### 確認メール（Confirm signup）の例

**Subject:**
```
【MoneyMart】メールアドレスの確認
```

**Body (HTML):**
```html
<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
  <h2 style="color: #f97316;">MoneyMart へようこそ</h2>
  <p>ご登録ありがとうございます。以下のリンクをクリックしてメールアドレスを確認してください。</p>
  <p><a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 12px 24px; background: #f97316; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">メールを確認する</a></p>
  <p style="color: #64748b; font-size: 12px;">このリンクは24時間有効です。心当たりがない場合はこのメールを無視してください。</p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
  <p style="color: #94a3b8; font-size: 11px;">MoneyMart - My Money, My Future</p>
</div>
```

### パスワードリセット（Recovery）の例

**Subject:**
```
【MoneyMart】パスワードの再設定
```

**Body:** 同様に `{{ .ConfirmationURL }}` を含む HTML で MoneyMart のデザインに合わせて編集。

---

## 3. 注意点

- **ドメイン認証**: SMTP サービスで送信ドメイン（`moneymart.jp` 等）の SPF / DKIM を設定しないと、スパム扱いになりやすいです。
- **レート制限**: カスタム SMTP 利用時、Supabase のデフォルトは 30通/時。必要なら **Rate Limits** で変更可能。
- **テンプレート変数**: `{{ .ConfirmationURL }}` は必ず含めてください。リンクが無いとユーザーが確認できません。

---

## まとめ

| 設定場所 | 内容 |
|----------|------|
| **Authentication → SMTP** | 送信元を `noreply@moneymart.jp` に変更 |
| **Authentication → Email Templates** | 件名・本文を MoneyMart 用に編集 |

この2つで、認証メールは MoneyMart から送られているように見えます。
