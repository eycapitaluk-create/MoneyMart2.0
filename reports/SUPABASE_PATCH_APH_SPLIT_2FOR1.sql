-- APH 2-for-1 stock split (stock dividend distributed 2026-09-02; post-split quotes from 2026-09-04)
-- Applied via:
--   node scripts/apply-stock-split-adjustment.mjs --symbols=APH --ratio=2 --effective-date=2026-09-03
-- Result: 370 rows with trade_date < 2026-09-03 (prices ÷2, volume ×2)
-- Note: 2026-09-02 still traded on pre-split quote scale in our feed, so it was included in the adjustment.

-- Heatmap shares outstanding (market cap = shares × split-adjusted price)
UPDATE stock_heatmap_profiles
SET shares_outstanding = 2460468890,
    notes = 'APH 2-for-1 split 2026-09-02: shares_outstanding ×2',
    updated_at = now()
WHERE symbol = 'APH';
