# MoneyMart 顧客チャット（Claude API）

ブラウザ右下の 💬 から一般向け金融 Q&A チャットを表示します。**Anthropic Claude Haiku 3.5** を使用し、API キーはサーバー側のみで保持します。

## アーキテクチャ（この案で正しいか）

| 要素 | 役割 |
|------|------|
| `ANTHROPIC_API_KEY` | サーバー環境変数のみ。**フロントに埋め込まない**（Vite の `VITE_` にはしない）。 |
| `/api/chatbot` | Vercel Serverless（または Vite dev ミドルウェア）。SDK で Messages API を呼ぶ。 |
| `src/lib/chatbotApi.js` | ブラウザから `fetch('/api/chatbot')` する薄いラッパー。 |
| `CustomerChatbot.jsx` | UI。履歴はクライアント state のみ（DB 永続化は未実装）。 |

既存の **`/api/chat.js`（Ollama）** とは別ルートです。併存して問題ありません。

## セットアップ

1. **API キー**  
   [Anthropic Console](https://console.anthropic.com/) でキーを発行する。

2. **ローカル**  
   プロジェクトルートに `.env.local` を作成し、例:

   ```bash
   ANTHROPIC_API_KEY=sk-ant-api03-...
   ```

   開発サーバーを再起動: `npm run dev`

3. **本番（Vercel）**  
   Project Settings → Environment Variables に `ANTHROPIC_API_KEY` を追加し、再デプロイ。

4. **任意**  
   モデルを変える場合のみ:

   ```bash
   ANTHROPIC_CHATBOT_MODEL=claude-3-5-haiku-20241022
   ```

## 依存関係

```bash
npm install
```

`@anthropic-ai/sdk` が `package.json` に含まれていること。

## 注意

- 回答は**一般的な説明**にとどまります。税務・投資の最専判定はユーザー自身の責任で専門家・公的資料を確認してください（システムプロンプトでも制限しています）。
- **個人口座の残高・保有銘柄は送信しません。** チャットはサイト利用の一般質問向けです。
- `/admin` ではチャットボタンを非表示にしています。

## トラブルシュート

- **503 / キー未設定**: `.env.local` または Vercel の変数名が `ANTHROPIC_API_KEY` か確認。
- **ローカルで 404**: `vite.config.js` の `/api/chatbot` ミドルウェアが有効か、`npm run dev` 再起動。
- **401**: API キーが無効・期限切れ。Console で再発行。
