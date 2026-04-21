-- ポートフォリオ上昇アラート閾値 + 履歴 baseline_type 拡張（daily_gain / weekly_gain）
-- 本番適用後に MyPage の上昇アラートが DB に保存されます。

alter table user_portfolio_alert_settings
  add column if not exists rise_threshold_pct integer;

comment on column user_portfolio_alert_settings.rise_threshold_pct is
  '上昇アラート閾値（%）。5 または 10。NULL = オフ';

-- 既存 CHECK (daily, weekly) を拡張
alter table user_portfolio_alert_history
  drop constraint if exists user_portfolio_alert_history_baseline_type_check;

alter table user_portfolio_alert_history
  add constraint user_portfolio_alert_history_baseline_type_check
  check (baseline_type in ('daily', 'weekly', 'daily_gain', 'weekly_gain'));
