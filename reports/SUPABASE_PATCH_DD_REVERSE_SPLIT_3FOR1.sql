-- DD 1-for-3 reverse stock split (effective 2026-06-24)
-- Applied via:
--   node scripts/apply-stock-split-adjustment.mjs --symbols=DD --ratio=3 --effective-date=2026-06-24 --reverse
-- Result: 320 rows before 2026-06-24 adjusted (prices ×3, volume ÷3)

-- Heatmap shares outstanding (market cap = shares × split-adjusted price)
UPDATE stock_heatmap_profiles
SET shares_outstanding = 136640435
WHERE symbol = 'DD';
