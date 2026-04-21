-- ================================================================
-- AI News summaries for News page
-- Public read of active rows, service role write via cron
-- ================================================================

CREATE TABLE IF NOT EXISTS public.ai_news_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_slot TEXT NOT NULL DEFAULT 'am' CHECK (run_slot IN ('am', 'pm')),
  market TEXT NOT NULL DEFAULT 'global',
  ticker TEXT NOT NULL,
  company_name TEXT NOT NULL,
  flag TEXT DEFAULT '',
  sector TEXT DEFAULT '',
  headline TEXT NOT NULL,
  source TEXT DEFAULT '',
  source_url TEXT DEFAULT '',
  published_at TIMESTAMPTZ,
  time_text TEXT DEFAULT '',
  is_hot BOOLEAN NOT NULL DEFAULT false,
  summary TEXT NOT NULL DEFAULT '',
  sentiment TEXT NOT NULL DEFAULT '中立',
  reason TEXT DEFAULT '',
  impact TEXT DEFAULT '',
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  discussion_title TEXT DEFAULT '',
  discussion_body TEXT DEFAULT '',
  analysis TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 1,
  language TEXT NOT NULL DEFAULT 'ja',
  is_active BOOLEAN NOT NULL DEFAULT true,
  batch_key TEXT NOT NULL DEFAULT '',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_news_summaries_active
  ON public.ai_news_summaries(is_active, published_at DESC, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_ai_news_summaries_batch_key
  ON public.ai_news_summaries(batch_key);

ALTER TABLE public.ai_news_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read active ai news summaries" ON public.ai_news_summaries;
CREATE POLICY "public read active ai news summaries"
  ON public.ai_news_summaries
  FOR SELECT
  USING (is_active = true);

CREATE OR REPLACE FUNCTION public.update_ai_news_summaries_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_news_summaries_updated_at ON public.ai_news_summaries;
CREATE TRIGGER trg_ai_news_summaries_updated_at
BEFORE UPDATE ON public.ai_news_summaries
FOR EACH ROW
EXECUTE FUNCTION public.update_ai_news_summaries_updated_at();
