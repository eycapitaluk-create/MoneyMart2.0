-- KLAC 10-for-1 stock split (effective 2026-06-12)
-- Applied via: node scripts/apply-stock-split-adjustment.mjs --symbols=KLAC --ratio=10 --effective-date=2026-06-12
-- Result: 316 rows before 2026-06-12 adjusted (prices ÷10, volume ×10)

-- Heatmap shares outstanding (market cap = shares × split-adjusted price)
UPDATE stock_heatmap_profiles
SET shares_outstanding = 1306275210
WHERE symbol = 'KLAC';
