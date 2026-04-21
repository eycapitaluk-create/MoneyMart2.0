-- MoneyMart 2.0 - Tax-Shield MVP sample seed
-- Run after SUPABASE_SETUP_TAX_SHIELD_MVP.sql

insert into public.tax_shield_rules (
  tax_year,
  deduction_type,
  cap_yen,
  deduction_rate,
  deadline_month,
  deadline_day,
  note,
  sort_order,
  is_active
)
values
  (2025, 'ideco', 816000, 1.00000, 12, 31, '企業年金なし会社員の一般上限（サンプル）', 10, true),
  (2025, 'nisa', 3600000, 0.05000, 12, 31, '運用益非課税メリットの簡易換算（サンプル）', 20, true),
  (2025, 'insurance', 120000, 0.40000, 12, 31, '生命保険料控除の簡易換算（サンプル）', 30, true),
  (2026, 'ideco', 816000, 1.00000, 12, 31, '企業年金なし会社員の一般上限（サンプル）', 10, true),
  (2026, 'nisa', 3600000, 0.05000, 12, 31, '運用益非課税メリットの簡易換算（サンプル）', 20, true),
  (2026, 'insurance', 120000, 0.40000, 12, 31, '生命保険料控除の簡易換算（サンプル）', 30, true)
on conflict (tax_year, deduction_type)
do update set
  cap_yen = excluded.cap_yen,
  deduction_rate = excluded.deduction_rate,
  deadline_month = excluded.deadline_month,
  deadline_day = excluded.deadline_day,
  note = excluded.note,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();
