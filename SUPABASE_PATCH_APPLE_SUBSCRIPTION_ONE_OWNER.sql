-- One App Store original transaction unlocks one MoneyMart account.
-- Run in the Supabase SQL editor. Fails if the same Apple key is already
-- stored on more than one user_id; keep the earliest row, then rerun.
create unique index if not exists user_premium_entitlements_apple_one_owner
  on public.user_premium_entitlements (external_subscription_key)
  where provider = 'apple';
