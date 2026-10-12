-- MoneyMart: user_profiles にプレミアム課金メタ用カラムを追加
-- is_premium / subscription_tier は Apple IAP・運用更新で同期する想定
-- stripe_* 列名は既存 DB 互換のため維持（未使用なら NULL のまま）

alter table public.user_profiles
  add column if not exists subscription_tier text,
  add column if not exists is_premium boolean not null default false,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

comment on column public.user_profiles.subscription_tier is '例: free, premium。フロントの planTier 判定にも利用';
comment on column public.user_profiles.is_premium is '有効な課金があるとき true（App Store 等で更新）';
comment on column public.user_profiles.stripe_customer_id is 'レガシー列名。未使用時は NULL';
comment on column public.user_profiles.stripe_subscription_id is 'レガシー列名。未使用時は NULL';
