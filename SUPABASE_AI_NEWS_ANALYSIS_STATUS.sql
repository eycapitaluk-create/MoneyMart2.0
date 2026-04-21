-- AIニュース: 「ニュース取り込み」と「LLM分析」を区別する
-- 実行後、既存行は complete 扱い。旧フォールバック文言は failed + 抜粋へ寄せる。

alter table public.ai_news_summaries
  add column if not exists ai_analysis_status text default 'complete';

alter table public.ai_news_summaries
  add column if not exists raw_snippet text;

comment on column public.ai_news_summaries.ai_analysis_status is 'complete = LLM 分析あり, failed = ニュースのみ（抜粋）';
comment on column public.ai_news_summaries.raw_snippet is 'LLM 失敗時など、配信本文の抜粋（表示用）';

update public.ai_news_summaries
set ai_analysis_status = 'complete'
where ai_analysis_status is null;

-- 旧「AI要約が利用不可…」行: AI分析なしとして整理（本文は抜粋として残す）
update public.ai_news_summaries
set
  ai_analysis_status = 'failed',
  raw_snippet = coalesce(nullif(trim(raw_snippet), ''), nullif(trim(summary), '')),
  reason = '',
  impact = '',
  analysis = ''
where coalesce(reason, '') like '%AI要約が利用不可%';
