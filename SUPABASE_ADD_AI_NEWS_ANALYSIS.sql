-- Long-form AI explanation (grounded in headline + API snippet only)
ALTER TABLE public.ai_news_summaries
  ADD COLUMN IF NOT EXISTS analysis TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.ai_news_summaries.analysis IS 'Japanese explanatory prose from ai-news cron; must not invent facts beyond headline/description; empty for legacy rows.';
