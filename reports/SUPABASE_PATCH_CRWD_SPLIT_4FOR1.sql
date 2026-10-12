-- CRWD 4-for-1 stock split (split-adjusted trading from 2026-07-02)
-- Applied via:
--   node scripts/apply-stock-split-adjustment.mjs --symbols=CRWD --ratio=4 --effective-date=2026-07-02
-- Result: 326 rows with trade_date < 2026-07-02 (prices ÷4, volume ×4)

-- Heatmap shares outstanding (market cap = shares × split-adjusted price)
UPDATE stock_heatmap_profiles
SET shares_outstanding = 1018146084
WHERE symbol = 'CRWD';
