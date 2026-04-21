-- Add name_jp, name_en to stock_symbol_profiles for display and filter
-- Run in Supabase SQL Editor.

alter table public.stock_symbol_profiles
  add column if not exists name_jp text,
  add column if not exists name_en text;

comment on column public.stock_symbol_profiles.name_jp is 'Company name in Japanese';
comment on column public.stock_symbol_profiles.name_en is 'Company name in English';
