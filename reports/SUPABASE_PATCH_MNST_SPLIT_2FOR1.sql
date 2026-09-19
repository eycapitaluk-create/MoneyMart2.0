-- MNST 2-for-1 stock split (split-adjusted trading from 2026-08-11)
-- Source: Monster Beverage IR, 2026-07-08
--   Record date 2026-07-24; additional shares distributed after close 2026-08-10
-- Applied via:
--   node scripts/apply-stock-split-adjustment.mjs --symbols=MNST --ratio=2 --effective-date=2026-08-11
-- Result: 356 rows with trade_date < 2026-08-11 (prices ÷2, volume ×2)
--   2026-08-10 close 91.10 → 45.55; 2026-08-11 close 45.53 (real move, not a crash)

-- Heatmap shares outstanding (market cap = shares × split-adjusted price)
-- Previous shares_outstanding 977916000 doubled for 2-for-1.
UPDATE stock_heatmap_profiles
SET shares_outstanding = 1955832000
WHERE symbol = 'MNST';
