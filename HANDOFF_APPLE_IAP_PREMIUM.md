# Apple IAP ↔ Supabase 프리미엄 동기화

iOS StoreKit 결제 후 **Supabase `user_id`** 기준으로 `user_profiles`·권리 테이블이 갱신되도록 하는 백엔드입니다（웹 브라우ザでの決済ゲートウェイは使用しない）。

## 1. Supabase에서 실행할 SQL（順序）

1. まだなら: `SUPABASE_ADD_PREMIUM_SUBSCRIPTION.sql`（`is_premium`, `subscription_tier` 等）
2. **追加**: `SUPABASE_SETUP_PREMIUM_ENTITLEMENTS.sql`
   - `user_profiles.premium_until`, `plan_tier`
   - `user_premium_entitlements`（`provider` は現状 **`apple`** のみ）
   - RLS: ユーザーは **自分の行だけ SELECT**、INSERT/UPDATE は **サービスロール(API)のみ**

## 2. デプロイ後 API

| Method | Path | 説明 |
|--------|------|------|
| `POST` | `/api/apple/verify-subscription` | アプリが StoreKit の transaction ID を送ると Apple Server API で検証し DB に反映 |

### リクエスト（iOS）

- URL: `https://www.moneymart.co.jp/api/apple/verify-subscription`（実際のドメインに合わせる）
- Header: `Authorization: Bearer <Supabase session access_token>`
- Header: `Content-Type: application/json`
- Body:

```json
{
  "transaction_id": "2000000123456789"
}
```

## 3. サーバー環境変数（Vercel 等）

`.env.example` の Apple ブロックを参照。例:

- `APPLE_ISSUER_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`（.p8 PEM）
- `APPLE_BUNDLE_ID`
- `APPLE_APP_STORE_SERVER_ENV` — 開発・審査中は `sandbox`、本番は `production`（または `live`）
- `APPLE_IAP_PRODUCT_IDS` — 自動更新サブスクの productId（カンマ区切り）

Supabase: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`（または `SUPABASE_SECRET_KEY`）

## 4. 解約・期限

- エンドポイントは **その transaction 査読時点の `expiresDate`** で `active` / `expired` を判定します。
- 自動更新解除後も期間までは有効な場合、アプリ側で同 API を定期的に呼ぶか、後から **App Store Server Notifications V2** を追加するのが安全です。

## 5. ローカル開発

`vite` 開発サーバーで `POST http://localhost:5178/api/apple/verify-subscription` が `.env.local` 設定済みなら同様にテストできます。

---

**Xcode:** ログイン後の Supabase `session.access_token` をヘッダに付け、上記 URL へ `transaction_id` を POST してください。
