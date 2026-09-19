-- JP stock splits effective 2026-03-27 (beneficial interest / 受益権分割)
-- Applied via apply-stock-split-adjustment.mjs (prices ÷ratio, volume ×ratio for trade_date < effective-date)
--
-- 5803.T Fujikura: 6-for-1 (28115 → ~4685 on 2026-03-27)
-- 9008.T Keio:      5-for-1 (3938 → ~788 on 2026-03-27)

begin;

update public.stock_heatmap_profiles
set shares_outstanding = shares_outstanding * 6,
    updated_at = now(),
    notes = coalesce(notes, '') || ' | split 6:1 effective 2026-03-27'
where symbol = '5803.T';

update public.stock_heatmap_profiles
set shares_outstanding = shares_outstanding * 5,
    updated_at = now(),
    notes = coalesce(notes, '') || ' | split 5:1 effective 2026-03-27'
where symbol = '9008.T';

commit;
