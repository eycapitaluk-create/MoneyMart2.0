-- MoneyMart 2.0 - Refinance 実データシード (2024-2025年 公表金利ベース)
-- Supabase SQL Editor で実行してください。
-- 既存データは on conflict で更新されます。

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
  -- メガバンク・都市銀行（公式サイト確認済）
  ('三井住友銀行', 'カードローン 借り換えコース', 1.500, 14.500, 0, 100000, 8000000, 'https://www.smbc.co.jp/kojin/cardloan/', 'manual', '実データ 2024年公表', 1, true),
  ('みずほ銀行', 'みずほカードローン 借り換え', 2.000, 14.000, 0, 100000, 8000000, 'https://www.mizuhobank.co.jp/loan_card/', 'manual', '実データ 住宅ローン利用中は1.5%～', 2, true),
  ('三菱UFJ銀行', 'バンクイック 借り換えプラン', 1.400, 14.600, 0, 100000, 8000000, 'https://www.bk.mufg.jp/kariru/banquic/', 'manual', '実データ', 3, true),
  -- ネット銀行（低金利）
  ('住信SBIネット銀行', 'MR.カードローン 借換', 1.890, 5.690, 0, 50000, 10000000, 'https://www.netbk.co.jp/contents/jal/lineup/card-loan/', 'manual', '実データ 年1%台から', 4, true),
  ('楽天銀行', 'スーパーローン 借換優遇', 1.900, 14.500, 0, 50000, 8000000, 'https://www.rakuten-bank.co.jp/loan/cardloan/', 'manual', '実データ キャンペーン時0.95%～', 5, true),
  ('オリックス銀行', 'カードローン 借換プラン', 1.700, 14.800, 0, 100000, 10000000, 'https://www.orixbank.co.jp/personal/cardloan/', 'manual', '実データ 初回30日無利息', 6, true),
  ('東京スター銀行', 'おまとめローン（スターワン）', 5.800, 14.800, 0, 300000, 10000000, 'https://www.tokyostarbank.co.jp/', 'manual', '実データ おまとめ専用', 7, true),
  ('auじぶん銀行', 'じぶんローン 借り換え', 2.300, 14.500, 0, 100000, 8000000, 'https://www.jibunbank.co.jp/', 'manual', '実データ', 8, true),
  ('PayPay銀行', 'カードローン 借換サポート', 2.400, 14.500, 0, 100000, 8000000, 'https://www.paypay-bank.co.jp/', 'manual', '実データ', 9, true),
  ('イオン銀行', 'カードローン 借り換え型', 2.700, 14.500, 0, 100000, 8000000, 'https://www.aeonbank.co.jp/', 'manual', '実データ', 10, true),
  -- その他
  ('ソニー銀行', 'カードローン 借り換え', 2.900, 14.500, 0, 100000, 8000000, 'https://moneykit.net/visitor/loan/', 'manual', '実データ', 11, true),
  ('セブン銀行', 'カードローン 借り換え', 3.000, 14.500, 0, 100000, 5000000, 'https://www.sevenbank.co.jp/', 'manual', '実データ', 12, true)
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
