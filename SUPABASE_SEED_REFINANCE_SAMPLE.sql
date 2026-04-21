-- MoneyMart 2.0 - Refinance sample seed (for MVP demo/testing only)
-- Run this after SUPABASE_SETUP_REFINANCE_MVP.sql

-- Optional cleanup: remove previous sample rows only.
delete from public.loan_refinance_products
where source_type = 'manual'
  and notes = 'sample seed';

insert into public.loan_refinance_products (
  bank_name,
  product_name,
  apr_min,
  apr_max,
  fees_yen,
  min_amount_yen,
  max_amount_yen,
  apply_url,
  source_type,
  notes,
  sort_order,
  is_active
) values
  ('三菱UFJ銀行', 'バンクイック 借り換えプラン', 2.100, 6.100, 0, 100000, 8000000, 'https://www.bk.mufg.jp/', 'manual', 'sample seed', 1, true),
  ('三井住友銀行', 'カードローン 借り換えコース', 1.950, 6.300, 0, 100000, 8000000, 'https://www.smbc.co.jp/', 'manual', 'sample seed', 2, true),
  ('みずほ銀行', 'みずほカードローン 借り換え', 2.200, 6.700, 0, 100000, 8000000, 'https://www.mizuhobank.co.jp/', 'manual', 'sample seed', 3, true),
  ('楽天銀行', 'スーパーローン 借換優遇', 1.900, 5.900, 0, 50000, 10000000, 'https://www.rakuten-bank.co.jp/', 'manual', 'sample seed', 4, true),
  ('住信SBIネット銀行', 'MR.カードローン 借換', 1.890, 5.690, 0, 50000, 10000000, 'https://www.netbk.co.jp/', 'manual', 'sample seed', 5, true),
  ('auじぶん銀行', 'じぶんローン 借り換え', 2.300, 6.900, 0, 100000, 8000000, 'https://www.jibunbank.co.jp/', 'manual', 'sample seed', 6, true),
  ('PayPay銀行', 'カードローン 借換サポート', 2.400, 7.200, 0, 100000, 8000000, 'https://www.paypay-bank.co.jp/', 'manual', 'sample seed', 7, true),
  ('イオン銀行', 'カードローン 借り換え型', 2.700, 7.800, 0, 100000, 8000000, 'https://www.aeonbank.co.jp/', 'manual', 'sample seed', 8, true),
  ('オリックス銀行', 'カードローン 借換プラン', 1.700, 5.400, 0, 100000, 10000000, 'https://www.orixbank.co.jp/', 'manual', 'sample seed', 9, true),
  ('東京スター銀行', 'おまとめローン（スターワン）', 1.800, 5.800, 0, 100000, 10000000, 'https://www.tokyostarbank.co.jp/', 'manual', 'sample seed', 10, true)
on conflict (bank_name, product_name) do update set
  apr_min = excluded.apr_min,
  apr_max = excluded.apr_max,
  fees_yen = excluded.fees_yen,
  min_amount_yen = excluded.min_amount_yen,
  max_amount_yen = excluded.max_amount_yen,
  apply_url = excluded.apply_url,
  source_type = excluded.source_type,
  notes = excluded.notes,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

-- Quick verification
select
  bank_name,
  product_name,
  apr_min,
  apr_max,
  min_amount_yen,
  max_amount_yen,
  is_active
from public.loan_refinance_products
where notes = 'sample seed'
order by apr_min asc, sort_order asc;
