-- Remove QUICK fund objects (no longer used by app runtime).
-- Run only after confirming you will not use QUICK ingestion.

drop view if exists public.v_quick_fund_latest_price;

drop table if exists public.quick_fund_property;
drop table if exists public.quick_fund_holdings;
drop table if exists public.quick_fund_asset_composition;
drop table if exists public.quick_fund_price_daily;
drop table if exists public.quick_fund_master;

