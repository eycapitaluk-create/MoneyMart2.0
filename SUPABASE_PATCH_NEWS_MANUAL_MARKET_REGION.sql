-- Market brief 電光パネル: グローバル / 米国 / 日本 を DB で明示
-- Supabase SQL Editor で 1 回実行

alter table public.news_manual
  add column if not exists market_region text;

alter table public.news_manual
  drop constraint if exists news_manual_market_region_check;

alter table public.news_manual
  add constraint news_manual_market_region_check
  check (market_region is null or market_region in ('global', 'us', 'jp'));

create index if not exists idx_news_manual_market_region
  on public.news_manual (bucket, market_region, sort_order, published_at desc)
  where bucket in ('market_major_event', 'market_weekly_summary');

-- 既存行: タイトルがリージョン名だけの場合は market_region に移し、本文をタイトルに昇格
update public.news_manual
set
  market_region = case
    when title ~ '^(グローバル|全世界|速報)$' then 'global'
    when title ~ '^(米国|アメリカ)$' then 'us'
    when title ~ '^(日本|国内)$' then 'jp'
    else market_region
  end,
  title = coalesce(nullif(trim(description), ''), title),
  description = case
    when title ~ '^(グローバル|米国|アメリカ|日本|国内|全世界|速報)$' and coalesce(trim(description), '') <> ''
      then description
    else description
  end,
  updated_at = now()
where bucket in ('market_major_event', 'market_weekly_summary')
  and market_region is null
  and title ~ '^(グローバル|米国|アメリカ|日本|国内|全世界|速報)$';

-- タイトルから推定（本文ヘッダー未設定の旧データ）
update public.news_manual
set market_region = 'jp', updated_at = now()
where bucket in ('market_major_event', 'market_weekly_summary')
  and market_region is null
  and (title ~ '(日経|日銀|東証|6857|キオクシア|アドバンテ)' or description ~ '(日経|日銀|東証)');

update public.news_manual
set market_region = 'us', updated_at = now()
where bucket in ('market_major_event', 'market_weekly_summary')
  and market_region is null
  and (title ~ '(NVDA|エヌビディア|S&P|ナスダック|FRB|FOMC|ジャクソンホール|パウエル)' or description ~ '(NVDA|FRB|FOMC|S&P)');

update public.news_manual
set market_region = 'global', updated_at = now()
where bucket in ('market_major_event', 'market_weekly_summary')
  and market_region is null;
