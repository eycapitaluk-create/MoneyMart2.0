-- Fix incorrect trust_fee for MAXIS Nasdaq-100 ETFs (+ related MAXIS S&P hedged)
-- Source of truth:
--   JPX 2631 fact sheet: 信託報酬（税込）0.22%
--   Prospectus / SBI: 年率0.22%（税抜 年率0.20%）以内 for 2631/2632
--   SBI MAXIS US equity note: 2558/2630 are 0.077%以内（税込）
-- MoneyMart stock_symbols.trust_fee for 2558 already stores 税込 0.077,
-- so store 0.22 (税込) for 2631/2632 and 0.077 for 2630.
-- Previous bad value 0.15 on 2631/2632/2630 likely confused with US QQQM (~0.15%).

UPDATE public.stock_symbols
SET trust_fee = 0.22
WHERE symbol IN ('2631.T', '2632.T')
  AND (trust_fee IS DISTINCT FROM 0.22);

UPDATE public.stock_symbols
SET trust_fee = 0.077
WHERE symbol = '2630.T'
  AND (trust_fee IS DISTINCT FROM 0.077);

-- Verify:
-- SELECT symbol, name, trust_fee
-- FROM public.stock_symbols
-- WHERE symbol IN ('2631.T','2632.T','2630.T','2558.T','1545.T');
