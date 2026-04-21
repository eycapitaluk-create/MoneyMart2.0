-- ================================================================
--  配当マスター（運営が登録する「その月に配当がある」スケジュール）
--  user_dividend_watchlist.stock_id と同じキー（例: AAPL, 8306, 2558.T）で突き合わせる。
--  ベル通知は「該当ユーザーがウォッチに入れた銘柄 × 今月（または指定年のその月）」で判定予定。
--  Run in Supabase SQL Editor (project owner). Requires public.user_roles for admin writes.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.dividend_master_schedule (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id        TEXT        NOT NULL,
  asset_kind      TEXT        NOT NULL DEFAULT 'us_stock'
                  CHECK (asset_kind IN ('us_stock', 'jp_stock', 'jp_fund')),
  dividend_month  SMALLINT    NOT NULL CHECK (dividend_month >= 1 AND dividend_month <= 12),
  -- NULL = 毎年その月（恒常）。整数など特定年のみ上書きしたい場合に使用。
  calendar_year   INTEGER     CHECK (calendar_year IS NULL OR (calendar_year >= 2000 AND calendar_year <= 2100)),
  name_hint       TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.dividend_master_schedule IS 'Curated dividend months per symbol for in-app alerts; stock_id matches user_dividend_watchlist.stock_id.';

-- 毎年繰り返し: 同一 (stock_id, month) は1行まで
CREATE UNIQUE INDEX IF NOT EXISTS dividend_master_schedule_recurring_unique
  ON public.dividend_master_schedule (stock_id, dividend_month)
  WHERE calendar_year IS NULL;

-- 年指定行: 同一 (stock_id, month, year) は1行まで
CREATE UNIQUE INDEX IF NOT EXISTS dividend_master_schedule_year_unique
  ON public.dividend_master_schedule (stock_id, dividend_month, calendar_year)
  WHERE calendar_year IS NOT NULL;

CREATE INDEX IF NOT EXISTS dividend_master_schedule_stock_id_idx
  ON public.dividend_master_schedule (stock_id);

CREATE INDEX IF NOT EXISTS dividend_master_schedule_month_idx
  ON public.dividend_master_schedule (dividend_month);

ALTER TABLE public.dividend_master_schedule ENABLE ROW LEVEL SECURITY;

-- 参照: ログインユーザーがアプリで読める（ベル照会用）
DROP POLICY IF EXISTS "dividend_master_schedule_authenticated_read" ON public.dividend_master_schedule;
CREATE POLICY "dividend_master_schedule_authenticated_read"
  ON public.dividend_master_schedule FOR SELECT
  TO authenticated
  USING (true);

-- Admin のみ CRUD
DROP POLICY IF EXISTS "dividend_master_schedule_admin_insert" ON public.dividend_master_schedule;
CREATE POLICY "dividend_master_schedule_admin_insert"
  ON public.dividend_master_schedule FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "dividend_master_schedule_admin_update" ON public.dividend_master_schedule;
CREATE POLICY "dividend_master_schedule_admin_update"
  ON public.dividend_master_schedule FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

DROP POLICY IF EXISTS "dividend_master_schedule_admin_delete" ON public.dividend_master_schedule;
CREATE POLICY "dividend_master_schedule_admin_delete"
  ON public.dividend_master_schedule FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

CREATE OR REPLACE FUNCTION public.update_dividend_master_schedule_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dividend_master_schedule_updated_at ON public.dividend_master_schedule;
CREATE TRIGGER trg_dividend_master_schedule_updated_at
  BEFORE UPDATE ON public.dividend_master_schedule
  FOR EACH ROW
  EXECUTE FUNCTION public.update_dividend_master_schedule_updated_at();
