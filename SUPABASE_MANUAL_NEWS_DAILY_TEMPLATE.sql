-- Manual daily news update template for news_manual
-- Usage:
-- 1) Replace titles/urls/source/image/time/topic text
-- 2) Run in Supabase SQL Editor
-- 3) Verify in AdminPage -> Operations -> News URL (Manual Input)

begin;

-- Optional: deactivate existing active rows in target buckets first.
update news_manual
set
  is_active = false,
  updated_at = now()
where bucket in ('market_pickup', 'fund_pickup', 'stock_disclosures', 'daily_brief')
  and is_active = true;

-- -------------------------------------------------------------------
-- market_pickup (Business / Financial / Politics mix)
-- -------------------------------------------------------------------
insert into news_manual
  (bucket, sort_order, source, title, description, url, image_url, topic, time_text, language, published_at, tone, is_active, updated_at)
values
  ('market_pickup', 1, 'Nikkei', '【Business】見出しをここに入力', '概要をここに入力', 'https://example.com/business-1', '', 'Business', '08:30', 'ja', now(), null, true, now()),
  ('market_pickup', 2, 'Reuters', '【Financial】見出しをここに入力', '概要をここに入力', 'https://example.com/financial-1', '', 'Financial', '09:00', 'ja', now(), null, true, now()),
  ('market_pickup', 3, 'Bloomberg', '【Politics】見出しをここに入力', '概要をここに入力', 'https://example.com/politics-1', '', 'Politics', '09:30', 'ja', now(), null, true, now()),
  ('market_pickup', 4, 'NHK', '【Business】見出しをここに入力', '概要をここに入力', 'https://example.com/business-2', '', 'Business', '10:00', 'ja', now(), null, true, now()),
  ('market_pickup', 5, 'Yahoo! News', '【Financial】見出しをここに入力', '概要をここに入力', 'https://example.com/financial-2', '', 'Financial', '10:30', 'ja', now(), null, true, now()),
  ('market_pickup', 6, 'TBS', '【Politics】見出しをここに入力', '概要をここに入力', 'https://example.com/politics-2', '', 'Politics', '11:00', 'ja', now(), null, true, now());

-- -------------------------------------------------------------------
-- fund_pickup (Investment focus)
-- -------------------------------------------------------------------
insert into news_manual
  (bucket, sort_order, source, title, description, url, image_url, topic, time_text, language, published_at, tone, is_active, updated_at)
values
  ('fund_pickup', 1, 'Bloomberg', '【Investment】見出しをここに入力', '概要をここに入力', 'https://example.com/investment-1', '', 'Investment', '08:40', 'ja', now(), null, true, now()),
  ('fund_pickup', 2, 'Nikkei', '【Investment】見出しをここに入力', '概要をここに入力', 'https://example.com/investment-2', '', 'Investment', '09:20', 'ja', now(), null, true, now()),
  ('fund_pickup', 3, 'Reuters', '【Financial】見出しをここに入力', '概要をここに入力', 'https://example.com/financial-3', '', 'Financial', '10:10', 'ja', now(), null, true, now()),
  ('fund_pickup', 4, 'Money Media', '【Investment】見出しをここに入力', '概要をここに入力', 'https://example.com/investment-3', '', 'Investment', '10:50', 'ja', now(), null, true, now()),
  ('fund_pickup', 5, 'CNBC', '【Business】見出しをここに入力', '概要をここに入力', 'https://example.com/business-3', '', 'Business', '11:20', 'ja', now(), null, true, now()),
  ('fund_pickup', 6, 'Yahoo! Finance', '【Investment】見出しをここに入力', '概要をここに入力', 'https://example.com/investment-4', '', 'Investment', '11:50', 'ja', now(), null, true, now());

-- -------------------------------------------------------------------
-- stock_disclosures (Market / Financial / Politics relevant to stocks)
-- -------------------------------------------------------------------
insert into news_manual
  (bucket, sort_order, source, title, description, url, image_url, topic, time_text, language, published_at, tone, is_active, updated_at)
values
  ('stock_disclosures', 1, 'Nikkei', '【Financial】見出しをここに入力', '概要をここに入力', 'https://example.com/stock-1', '', 'Financial', '08:45', 'ja', now(), null, true, now()),
  ('stock_disclosures', 2, 'Reuters', '【Business】見出しをここに入力', '概要をここに入力', 'https://example.com/stock-2', '', 'Business', '09:25', 'ja', now(), null, true, now()),
  ('stock_disclosures', 3, 'NHK', '【Politics】見出しをここに入力', '概要をここに入力', 'https://example.com/stock-3', '', 'Politics', '10:05', 'ja', now(), null, true, now()),
  ('stock_disclosures', 4, 'Bloomberg', '【Financial】見出しをここに入力', '概要をここに入力', 'https://example.com/stock-4', '', 'Financial', '10:45', 'ja', now(), null, true, now()),
  ('stock_disclosures', 5, 'Yahoo! News', '【Business】見出しをここに入力', '概要をここに入力', 'https://example.com/stock-5', '', 'Business', '11:15', 'ja', now(), null, true, now()),
  ('stock_disclosures', 6, 'TBS', '【Politics】見出しをここに入力', '概要をここに入力', 'https://example.com/stock-6', '', 'Politics', '11:45', 'ja', now(), null, true, now());

-- -------------------------------------------------------------------
-- daily_brief (top summary card)
-- tone: やや強気 / 中立 / やや慎重
-- -------------------------------------------------------------------
insert into news_manual
  (bucket, sort_order, source, title, description, url, image_url, topic, time_text, language, published_at, tone, is_active, updated_at)
values
  (
    'daily_brief',
    1,
    'Manual Desk',
    '本日の要約見出しをここに入力',
    '本日のマーケット/経済の一言要約をここに入力',
    '',
    '',
    'Brief',
    '',
    'ja',
    now(),
    '中立',
    true,
    now()
  );

commit;

-- Quick check
-- select bucket, sort_order, topic, title, url, is_active
-- from news_manual
-- where bucket in ('market_pickup', 'fund_pickup', 'stock_disclosures', 'daily_brief')
-- order by bucket, sort_order;
