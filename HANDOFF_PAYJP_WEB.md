# PAY.JP — Web Premium サブスク（iOS は App Store のまま）

## 1. Supabase SQL

`SUPABASE_PATCH_PAYJP_PROVIDER.sql` を SQL Editor で実行（`user_premium_entitlements.provider` に `payjp` を追加）。

## 2. PAY.JP ダッシュボード

1. [設定 → API キー](https://console.pay.jp/d/settings) — 本番 `sk_live_` / `pk_live_`
2. **プラン（定期）** を 2 つ作成（金額は `src/lib/membership.js` と一致）:
   - 月額 **530 円**（税込）
   - 年額 **4,290 円**（税込）
3. **Webhook** — URL:
   - `https://www.moneymart.co.jp/api/billing/payjp/webhook`
   - イベント: `subscription.*`（作成・更新・更新課金・解約など）
   - トークンを `PAYJP_WEBHOOK_TOKEN` に設定

※ 2026/06/03 までは明細に「PAY.JP + 6桁」表示。本番稼働は 6/3 以降推奨（PAY.JP 案内通り）。

### カードブランド（審査 2026-06）

| ブランド | 本番 | アプリ側 |
|----------|------|----------|
| Visa / Mastercard | 2026/06/01〜 | 変更不要 |
| JCB / Amex / Diners / Discover | **2026/06/17 12:00 JST〜** | 変更不要（PAY.JP が有効化済み） |
| Apple Pay | 審査可だが **別実装** | **未対応**（Web はカードフォームのみ） |

コードでブランドを個別に有効化する必要はありません。`pay.js` の `elements.create('card')` は、PAY.JP 加盟店で「可」になったブランドを自動で受け付けます。

UI・FAQ の文言は `src/constants/payjpBillingFaq.js`。**6/17 以降は JCB 等も本番利用可**（「○月○日以降」注記は UI から削除済み）。検証用に開始日時を上書きする場合のみ Vercel `PAYJP_EXTENDED_BRANDS_LIVE_AT`（ISO 8601）。

## 3. Vercel 環境変数

| 変数 | 説明 |
|------|------|
| `PAYJP_SECRET_KEY` | サーバー用 secret |
| `VITE_PAYJP_PUBLIC_KEY` | フロント token 化用 public |
| `PAYJP_PLAN_ID_MONTHLY` | 月額プラン ID `pln_...` |
| `PAYJP_PLAN_ID_ANNUAL` | 年額プラン ID |
| `PAYJP_WEBHOOK_TOKEN` | Webhook 検証トークン |

Supabase（既存）: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

## 4. API

| Method | Path | 説明 |
|--------|------|------|
| POST | `/api/billing/payjp/create-subscription` | ログイン + `payjp_token` → 定期開始 |
| POST | `/api/billing/payjp/cancel-subscription` | 次回更新停止（期間末まで有効） |
| POST | `/api/billing/payjp/webhook` | PAY.JP → entitlements 同期 |

## 5. フロント

`/premium` — ログイン済みユーザーに PAY.JP カードフォーム。  
無料お試し中は `trial_end` を PAY.JP サブスクに渡し、お試し終了後に初回課金。

**PAY.JP 契約 status:** 本番 API は `trial`（`trialing` ではない）。`api/_lib/payjp-api.js` の `payjpEntitlementStatus` で `trial` → entitlement `active` に正規化。既存の誤 `expired` 行は `SUPABASE_PATCH_PAYJP_TRIAL_ENTITLEMENT_BACKFILL.sql` を 1 回実行。

## 6. ローカル

`.env.local` に上記キーを設定 → `npm run dev` → `/premium` でテスト（PAY.JP テストキー推奨）。

## 7. プラン ID 不一致の確認

`GET https://www.moneymart.co.jp/api/billing/payjp/plan-config`

- `monthly.existsOnPayjp` / `annual.existsOnPayjp` が **true** なら Vercel の `pln_` は `PAYJP_SECRET_KEY` と同じ PAY.JP 環境に存在します。
- **false**（`no_such_plan`）のとき:
  1. PAY.JP で **Test environment OFF**（本番）の Plan 一覧から `pln_` をコピー
  2. Vercel **Production** の `PAYJP_PLAN_ID_MONTHLY` / `ANNUAL` を**上書き**（古い `pln_` を残さない）
  3. **Redeploy**（env だけ保存してもランタイムは変わりません）
- `sk_live_` と **テストモードで作った pln_** は併用不可です。
