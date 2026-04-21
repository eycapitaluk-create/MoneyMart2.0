-- Fix DAY (Dayforce, formerly Ceridian) display name
-- Ceridian rebranded to Dayforce in 2024, ticker changed CDAY→DAY
-- Run in Supabase SQL Editor

update public.stock_symbol_profiles
set
  name_jp = 'デイフォース',
  name_en = 'Dayforce'
where symbol = 'DAY';
