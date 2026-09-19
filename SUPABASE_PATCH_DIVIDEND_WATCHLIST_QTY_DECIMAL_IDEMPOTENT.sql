-- user_dividend_watchlist.qty が integer のままだと、Web/API から 0.5 を upsert しても
-- PostgreSQL が整数に丸めて小数が消える（または 0 に切り捨てられる）。
-- Supabase SQL Editor で 1 回だけ実行してください（既に numeric なら何もしません）。

DO $$
DECLARE
  typ text;
BEGIN
  SELECT t.typname INTO typ
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid AND c.relkind = 'r'
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE c.relname = 'user_dividend_watchlist'
    AND a.attname = 'qty'
    AND NOT a.attisdropped;

  IF typ IS NULL THEN
    RAISE NOTICE 'user_dividend_watchlist.qty が見つかりません（テーブル未作成？）';
    RETURN;
  END IF;

  IF typ = 'numeric' THEN
    RAISE NOTICE 'qty は既に numeric のためスキップしました。';
    RETURN;
  END IF;

  EXECUTE $SQL$
    ALTER TABLE public.user_dividend_watchlist
      ALTER COLUMN qty TYPE numeric(18, 6)
      USING ROUND(COALESCE(qty::numeric, 10), 6)
  $SQL$;

  RAISE NOTICE 'qty を numeric(18,6) に変更しました（以前の型: %)', typ;
END $$;
