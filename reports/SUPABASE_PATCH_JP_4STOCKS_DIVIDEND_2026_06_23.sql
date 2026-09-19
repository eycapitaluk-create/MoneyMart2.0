-- Dividend months (Mar/Sep) + bell alerts for Taiyo Yuden, Ibiden, Mitsui Kinzoku, Rohm
-- Per-share amounts live in dividendCalendarDetail.generated.json (app bundle).

begin;

insert into public.dividend_master_schedule (stock_id, asset_kind, dividend_month, calendar_year, name_hint, notes)
values
  ('6976.T', 'jp_stock', 3, null, 'TAIYO YUDEN CO LTD', 'per-share JPY 45'),
  ('6976.T', 'jp_stock', 9, null, 'TAIYO YUDEN CO LTD', 'per-share JPY 45'),
  ('4062.T', 'jp_stock', 3, null, 'IBIDEN CO LTD', 'per-share JPY 15'),
  ('4062.T', 'jp_stock', 9, null, 'IBIDEN CO LTD', 'per-share JPY 15'),
  ('5706.T', 'jp_stock', 3, null, 'MITSUI KINZOKU CO LTD', 'per-share JPY 145'),
  ('5706.T', 'jp_stock', 9, null, 'MITSUI KINZOKU CO LTD', 'per-share JPY 145'),
  ('6963.T', 'jp_stock', 3, null, 'ROHM CO LTD', 'per-share JPY 25'),
  ('6963.T', 'jp_stock', 9, null, 'ROHM CO LTD', 'per-share JPY 25')
on conflict do nothing;

commit;
