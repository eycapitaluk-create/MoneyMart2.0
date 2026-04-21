# Supabase Signup Email Setup (JA)

MoneyMart の確認メールを「日本語 + ブランド表示 + スパム到達率改善」で設定する手順です。

## 1) Confirm signup テンプレートを日本語化

Supabase Dashboard:
- `Authentication` -> `Email Templates` -> `Confirm signup`

### Subject (推奨)
`【MoneyMart】メールアドレス確認のお願い`

### Body (HTML) - そのまま貼り付け

```html
<!doctype html>
<html lang="ja">
  <body style="margin:0;padding:0;background:#f6f8fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans JP','Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:20px 24px 8px 24px;">
                <div style="font-size:22px;font-weight:800;color:#f97316;letter-spacing:-0.2px;">MoneyMart</div>
                <div style="font-size:12px;color:#64748b;margin-top:2px;">My Money, My Future</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 4px 24px;">
                <h1 style="margin:0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:800;">メールアドレス確認のお願い</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 24px 0 24px;">
                <p style="margin:0;font-size:14px;line-height:1.8;color:#334155;">
                  MoneyMart にご登録ありがとうございます。<br />
                  下のボタンを押してメールアドレス確認を完了してください。
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:700;">
                  メールアドレスを確認する
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 16px 24px;">
                <p style="margin:0;font-size:12px;line-height:1.7;color:#64748b;word-break:break-all;">
                  ボタンが開けない場合は、以下のURLをブラウザに貼り付けてください。<br />
                  <a href="{{ .ConfirmationURL }}" style="color:#2563eb;">{{ .ConfirmationURL }}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:11px;line-height:1.7;color:#94a3b8;">
                  本メールに心当たりがない場合、このメールは破棄してください。<br />
                  © MoneyMart
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

> 参考: ロゴ画像を入れる場合は公開URLを使用  
> 例: `<img src="https://www.moneymart.co.jp/<your-logo>.png" ... />`

---

## 2) スパム到達率改善 (Custom SMTP + 独自ドメイン)

Supabase Dashboard:
- `Authentication` -> `Settings` -> `SMTP Settings`
- `Enable Custom SMTP` を ON

推奨送信元:
- `From`: `MoneyMart <noreply@moneymart.co.jp>`

## 3) DNS 必須設定 (moneymart.co.jp)

- SPF: 送信プロバイダを許可
- DKIM: プロバイダ指定の公開鍵を追加
- DMARC: `p=none` から開始し、安定後に `quarantine/reject` へ

### DMARC 例 (初期)
`v=DMARC1; p=none; rua=mailto:postmaster@moneymart.co.jp; fo=1; adkim=s; aspf=s`

---

## 4) すぐ確認するテスト

1. 新規メールでサインアップ
2. Gmail / iCloud / Outlook で受信先フォルダ確認
3. 件名・本文が日本語か確認
4. ボタン遷移が正しいか確認
5. スパムに落ちる場合:
   - SPF/DKIM/DMARC の反映待ち (最大24h)
   - 件名の記号乱用や短縮URLを減らす

