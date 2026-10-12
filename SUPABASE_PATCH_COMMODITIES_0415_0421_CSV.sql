-- commodity_daily_prices upsert from commodities_0415_0421.csv (20 rows = 5 dates × 4 commodities)
-- price_change_day / percentage_day は CSV 内の前営業日（同一ファイル内の直前行）比。週末スキップはファイルの日付列どおり。
-- Supabase SQL エディタで 1 回実行

begin;

insert into public.commodity_daily_prices (
  commodity_name,
  trade_date,
  price,
  price_change_day,
  percentage_day,
  percentage_week,
  percentage_month,
  percentage_year,
  commodity_unit,
  raw,
  fetched_at
)
values
  ('gold', '2026-04-15'::date, 4800, null, null, null, null, null, null, jsonb_build_object('patched_from', 'csv_manual', 'csv', 'commodities_0415_0421.csv', 'commodity', 'gold', 'close_csv', 4800), now()),
  ('gold', '2026-04-16'::date, 4785.4, -14.6, -0.3, null, null, null, null, jsonb_build_object('patched_from', 'csv_manual', 'csv', 'commodities_0415_0421.csv', 'commodity', 'gold', 'close_csv', 4785.4), now()),
  ('gold', '2026-04-17'::date, 4857.6, 72.2, 1.51, null, null, null, null, jsonb_build_object('patched_from', 'csv_manual', 'csv', 'commodities_0415_0421.csv', 'commodity', 'gold', 'close_csv', 4857.6), now()),
  ('gold', '2026-04-20'::date, 4806.6, -51, -1.05, null, null, null, null, jsonb_build_object('patched_from', 'csv_manual', 'csv', 'commodities_0415_0421.csv', 'commodity', 'gold', 'close_csv', 4806.6), now()),
  ('gold', '2026-04-21'::date, 4698.4, -108.2, -2.25, null, null, null, null, jsonb_build_object('patched_from', 'csv_manual', 'csv', 'commodities_0415_0421.csv', 'commodity', 'gold', 'close_csv', 4698.4), now()),
  ('silver', '2026-04-15'::date, 79.49, null, null, null, null, null, null, jsonb_build_object('patched_from', 'csv_manual', 'csv', 'commodities_0415_0421.csv', 'commodity', 'silver', 'close_csv', 79.49), now()),
  ('silver', '2026-04-16'::date, 78.61, -0.88, -1.11, null, null, null, null, jsonb_build_object('patched_from', 'csv_manual', 'csv', 'commodities_0415_0421.csv', 'commodity', 'silver', 'close_csv', 78.61), now()),
  ('silver', '2026-04-17'::date, 81.74, 3.13, 3.98, null, null, null, null, jsonb_build_object('patched_from', 'csv_manual', 'csv', 'commodities_0415_0421.csv', 'commodity', 'silver', 'close_csv', 81.74), now()),
  ('silver', '2026-04-20'::date, 79.95, -1.79, -2.19, null, null, null, null, jsonb_build_object('patched_from', 'csv_manual', 'csv', 'commodities_0415_0421.csv', 'commodity', 'silver', 'close_csv', 79.95), now()),
  ('silver', '2026-04-21'::date, 76.41, -3.54, -4.43, null, null, null, null, jsonb_build_object('patched_from', 'csv_manual', 'csv', 'commodities_0415_0421.csv', 'commodity', 'silver', 'close_csv', 76.41), now()),
  ('copper', '2026-04-15'::date, 6.07, null, null, null, null, null, null, jsonb_build_object('patched_from', 'csv_manual', 'csv', 'commodities_0415_0421.csv', 'commodity', 'copper', 'close_csv', 6.07), now()),
  ('copper', '2026-04-16'::date, 6.07, 0, 0, null, null, null, null, jsonb_build_object('patched_from', 'csv_manual', 'csv', 'commodities_0415_0421.csv', 'commodity', 'copper', 'close_csv', 6.07), now()),
  ('copper', '2026-04-17'::date, 6.1, 0.03, 0.49, null, null, null, null, jsonb_build_object('patched_from', 'csv_manual', 'csv', 'commodities_0415_0421.csv', 'commodity', 'copper', 'close_csv', 6.1), now()),
  ('copper', '2026-04-20'::date, 6.04, -0.06, -0.98, null, null, null, null, jsonb_build_object('patched_from', 'csv_manual', 'csv', 'commodities_0415_0421.csv', 'commodity', 'copper', 'close_csv', 6.04), now()),
  ('copper', '2026-04-21'::date, 6, -0.04, -0.66, null, null, null, null, jsonb_build_object('patched_from', 'csv_manual', 'csv', 'commodities_0415_0421.csv', 'commodity', 'copper', 'close_csv', 6), now()),
  ('crude_oil', '2026-04-15'::date, 91.29, null, null, null, null, null, null, jsonb_build_object('patched_from', 'csv_manual', 'csv', 'commodities_0415_0421.csv', 'commodity', 'crude_oil', 'close_csv', 91.29), now()),
  ('crude_oil', '2026-04-16'::date, 94.69, 3.4, 3.72, null, null, null, null, jsonb_build_object('patched_from', 'csv_manual', 'csv', 'commodities_0415_0421.csv', 'commodity', 'crude_oil', 'close_csv', 94.69), now()),
  ('crude_oil', '2026-04-17'::date, 83.85, -10.84, -11.45, null, null, null, null, jsonb_build_object('patched_from', 'csv_manual', 'csv', 'commodities_0415_0421.csv', 'commodity', 'crude_oil', 'close_csv', 83.85), now()),
  ('crude_oil', '2026-04-20'::date, 89.61, 5.76, 6.87, null, null, null, null, jsonb_build_object('patched_from', 'csv_manual', 'csv', 'commodities_0415_0421.csv', 'commodity', 'crude_oil', 'close_csv', 89.61), now()),
  ('crude_oil', '2026-04-21'::date, 92.13, 2.52, 2.81, null, null, null, null, jsonb_build_object('patched_from', 'csv_manual', 'csv', 'commodities_0415_0421.csv', 'commodity', 'crude_oil', 'close_csv', 92.13), now())
on conflict (commodity_name, trade_date) do update set
  price = excluded.price,
  price_change_day = excluded.price_change_day,
  percentage_day = excluded.percentage_day,
  percentage_week = excluded.percentage_week,
  percentage_month = excluded.percentage_month,
  percentage_year = excluded.percentage_year,
  commodity_unit = excluded.commodity_unit,
  raw = excluded.raw,
  fetched_at = excluded.fetched_at;

commit;

-- verify:
-- select commodity_name, trade_date, price, percentage_day from public.commodity_daily_prices
-- where trade_date between '2026-04-15' and '2026-04-21' order by commodity_name, trade_date;
