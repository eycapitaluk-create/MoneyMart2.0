# MoneyMart — Enterprise Security & AI Governance

> 일본 금융기관이 도입 전에 확인하는 IT·보안·리스크 심사 항목용 슬라이드 / 부록 초안입니다.  
> **기능 설명서가 아니라** “고객 데이터를 맡겨도 안전한가”에 답하는 자료입니다.  
> **실제로 구현·운영 가능한 내용만 확정형으로 표기**했습니다. 미확정은 상태를 명시합니다.

상태 표기:
- **Available now** — 현재 제품·운영 중
- **Configurable for enterprise clients** — 설정·계약으로 대응 가능
- **Available during implementation** — 엔터프라이즈 도입 시 구축
- **Product roadmap** — 로드맵 (현재 미제공)

---

## Slide 1 — Enterprise Ready（本編 1枚）

### Enterprise Ready

**Data & AI Governance**
- Defined data-hosting and retention controls — *Configurable for enterprise clients*
- Client-data AI-training policy — *Configurable for enterprise clients*（契約・設定で明文化）
- Explainable outputs with source references — *Partial · Available now*（市場・ニュース） / *Roadmap*（AI診断の根拠提示）
- Human review and approval — *Product positioning*（B2Cは最終判断が利用者） / *Available during implementation*（機関向けAdvisor承認）

**Security & Access**
- SSO and role-based access — *SSO: Available during implementation* / *RBAC: Partial · Available now*（admin / user）
- Audit logs — *Available during implementation*
- Encryption in transit and at rest — *Available now*（TLS + クラウド基盤の保存時暗号化）

**Integration & Resilience**
- API, CRM and portfolio-system connectivity — *Available during implementation*
- Incident response, backup and BCP — *Partial · Available now*（社内SOP） / *SLA・BCP formalisation: Available during implementation*
- Flexible deployment options — *Configurable for enterprise clients*

---

## Appendix — Security & AI Governance（詳細）

---

### 1. データ保存場所と個人情報の処理

金融機関が問うこと:  
「顧客データはどの国・どのサーバーにあり、誰がアクセスし、いつ削除されるか」

| 項目 | 現状 | 状態 |
|------|------|------|
| ホスティング | 本番は **Vercel**（アプリ）+ **Supabase**（DB / Auth / Storage） | Available now |
| 日本国内保存の保証 | リポジトリ上 **日本リージョン固定の契約保証は未確定** | Configurable for enterprise clients |
| クラウド | 上記 SaaS。OCR等で **GCP Document AI / AWS Textract** を利用する場合あり | Available now |
| 個人情報と投資情報 | ユーザー資産はログインユーザー単位のDB（RLS）。法的取扱いはプライバシーポリシー | Available now |
| 保管・削除 | 退会APIでアカウント・資産データの削除フローあり。法令上の記録保持はポリシー記載どおり | Available now |
| 外部処理 | AI・OCR・決済・分析（Clarity等）で外部処理あり。エンプラではサブプロセッサ一覧を契約で提示 | Configurable for enterprise clients |

**スライド表現（推奨）**

```
Data Management
• Cloud SaaS architecture (application + managed database)     [Available now]
• Data-hosting options available for enterprise deployment      [Configurable]
• Access control via authentication and row-level security      [Available now]
• Account deletion and retention aligned with published policy  [Available now]
```

⚠️ 「データは日本国内に保存されます」は **現状の確定表現にしない**。  
→ `Data hosting options available for enterprise deployment`

---

### 2. 顧客データの AI 学習利用

金融機関が最も聞きたい答えの方向性:  
「顧客データは共有・公開モデルの学習に使わない」

| 項目 | 現状 | 状態 |
|------|------|------|
| 外部 AI API | カスタマーチャット・ポートフォリオ診断などで **Anthropic API**（Geminiフォールバック）を使用。診断時は保有銘柄等を送信しうる | Available now（処理） |
| 学習利用の契約保証 | ベンダー契約上の学習不使用・保持期間は **エンプラ契約で明示が必要**（コードだけでは保証不可） | Configurable for enterprise clients |
| API提供者による保管 | プロバイダの商用条件に依存 | Configurable for enterprise clients |
| 他金融機関への影響 | テナント分離・専用環境はエンプラ導入時 | Available during implementation |

**スライド表現（推奨 — 保証できる範囲のみ）**

```
AI Data Policy
• AI is used for authorised product workflows (support / analysis assist)  [Available now]
• Client portfolios may be processed via contracted AI APIs for that workflow
• Client data is not used by MoneyMart to train public shared models         [Available now*]
• Enterprise: zero-retention / no-training terms and data controls          [Configurable]
```

\* 「MoneyMart自身が公開モデルを学習していない」意味。  
ベンダー側の学習・保持は **契約条項で確定**すること。  
`Client data is not used to train shared AI models` を **無条件の確定文で書かない**（契約前）。

---

### 3. 説明可能性・出典表示

| 項目 | 現状 | 状態 |
|------|------|------|
| 市場データ | 価格行に source / fetched_at 等 | Available now |
| ニュース・インサイト | 出典URL・公開日時を保持・表示しうる | Available now |
| AI診断・チャットの根拠提示 | スコアはルールベース部分あり。AIコメントの「なぜ」出典UIは未整備 | Product roadmap |
| データ / 分析 / AI生成の区別 | プロダクト上は一部。機関向け明示フォーマットは未整備 | Available during implementation |

**スライド表現（推奨）**

```
Explainable Insights
• Market data with source and timestamps                 [Available now]
• Research / news with source references                 [Available now]
• AI commentary labelled as assistive output             [Configurable]
• Full rationale trail for institutional reports         [Product roadmap]
```

---

### 4. Human-in-the-loop 承認構造

MoneyMartのポジショニング（個人向け）: AIは判断の補助であり、売買執行・最終助言の代替ではない。

| 項目 | 現状 | 状態 |
|------|------|------|
| B2C | 最終判断は利用者。AIは助言の自動化送信なし（チャットは応答、診断は画面表示） | Available now（思想・実装） |
| 機関向け Advisor → Accept/Edit/Reject | 未実装 | Available during implementation |

**スライド表現（推奨）**

```
Human Oversight
• AI supports—not replaces—user / advisor judgement     [Available now]
• No automated order execution via MoneyMart                 [Available now]
• Advisor review & approval before client delivery           [Available during implementation]
• Final recommendations remain the institution’s responsibility
```

フロー図（機関向け・導入時）:

```
AI analysis
    ↓
Advisor review
    ↓
Accept / Edit / Reject
    ↓
Client discussion or report
```

---

### 5. 監査ログ、SSO、権限、暗号化

| 項目 | 現状 | 状態 |
|------|------|------|
| Encryption in transit | HTTPS / TLS | Available now |
| Encryption at rest | Supabase等マネージド基盤の標準暗号化 | Available now |
| Role-based access | 一般ユーザー / 管理者（admin）・RLS | Available now（Partial） |
| SSO（SAML / OIDC 機関） | 未実装（消費者向けGoogle OAuthはある） | Available during implementation |
| Audit logs（誰が何を見たか） | 製品としての監査ログ基盤は未整備。運用ログは部分的 | Available during implementation |
| Adminアクセス | Basic認証・管理者メール許可。IP制限APIは存在、UI完全連動は要確認 | Configurable for enterprise clients |

**スライド表現（推奨）**

```
Security & Access
• Encryption in transit and at rest          [Available now]
• Role-based access (user / admin) + RLS   [Available now]
• Single Sign-On                             [Available during implementation]
• Enterprise audit logging                   [Available during implementation]
```

---

### 6. API・CRM・コアシステム連携

| 項目 | 現状 | 状態 |
|------|------|------|
| 既存システム置換 | **置換ではなく併用**を想定（現行はB2C SaaS） | Positioning |
| Partner API / CRM双方向 | 未提供 | Available during implementation |
| 社内Admin CRM・CSV | 運用向けにあり（顧客向け連携APIではない） | Available now（internal） |
| Import / Export（機関） | 導入時設計 | Available during implementation |

**スライド表現（推奨）**

```
Integration
• Works alongside existing infrastructure（not a core replacement）
• Integration options available during enterprise deployment
• API connectivity / CRM & portfolio sync                    [Available during implementation]
• Data import and export                                     [Available during implementation]
```

⚠️ APIが無い現状で「API完備」と書かない。  
→ `Integration options available during enterprise deployment`

---

### 7. 障害対応、SLA、BCP

| 項目 | 現状 | 状態 |
|------|------|------|
| Incident response | 社内オペレーションSOP（障害・データ欠落等） | Available now（internal） |
| Backup / DR | クラウドベンダー標準バックアップに依存 | Configurable for enterprise clients |
| 公開SLA数値（例: 99.9%） | **未定義 — 数値を書かない** | Available during implementation |
| Formal BCP文書 | 未整備 | Available during implementation |

**スライド表現（推奨）**

```
Operational Resilience
• Incident response and escalation process（internal SOP）  [Available now]
• Backup and disaster recovery on managed cloud             [Configurable]
• Service-level commitments                                 [Available during implementation]
• Business continuity planning                              [Available during implementation]
```

⚠️ `99.9%` 等のSLA数値は **契約確定前に記載しない**。

---

### 8. デプロイメントオプション

| 項目 | 現状 | 状態 |
|------|------|------|
| Lightweight cloud SaaS | Vercel + Supabase | Available now |
| Dedicated enterprise environment | 未提供 | Configurable / Available during implementation |
| Private cloud / VPC / 日本リージョン | 要件に応じて協議 | Configurable for enterprise clients |
| On-premise | 未提供 | Product roadmap |

**スライド表現（推奨）**

```
Deployment
• Lightweight cloud deployment                              [Available now]
• Dedicated enterprise environment available                [Configurable]
• Private deployment options subject to institutional requirements
• On-premise                                                [Product roadmap]
```

⚠️ 「すべてのデプロイ形態に対応」とは書かない。

---

## 金融機関向け FAQ（口頭用・短答）

| 質問 | 答え方 |
|------|--------|
| 顧客データを預けて安全か？ | 認証・RLS・TLS・退会削除あり。日本国内保存・監査ログ・SSOはエンプラ導入で設計。 |
| AIが間違ったら誰が確認？ | B2Cは利用者が最終判断。機関向けはAdvisor承認フローを導入時に構築。 |
| 既存システムと繋がるか？ | コア置換ではなく併用。API/CRM連携は導入プロジェクトで提供。 |
| 障害時は？ | 社内SOPとクラウド基盤の復旧。正式SLA/BCPは契約時に合意。 |

---

## 使い方メモ

1. **本編**: Slide 1「Enterprise Ready」のみ（1枚）。  
2. **詳細**: 本 Appendix（Security & AI Governance）を別紙。  
3. 営業資料では **Available now だけを断定**し、他は括弧で状態を必ず付ける。  
4. AI学習・日本リージョン・SLA% は契約・インフラ確定後に文言更新する。

---

## 現状サマリー（社内向け）

MoneyMartは現時点では **B2C向けクラウドSaaS** です。  
日本の金融機関向け審査にそのまま「フル準拠・完備」と書くと齟齬が出ます。  
正しいストーリーは:

> **軽量クラウドで早く価値を出し、機関要件（データ所在・SSO・監査・HITL・連携・SLA）はエンタープライズ導入時に構成する。**
