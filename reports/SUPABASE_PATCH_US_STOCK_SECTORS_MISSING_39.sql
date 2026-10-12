-- Manual sector corrections for the 39 StockPage US symbols missing from SPX workbook mapping.
-- Source: user-provided missing-sector table screenshots.
begin;

insert into public.stock_symbol_profiles (symbol, region, asset_type, sector, industry, priority)
values
  ('MMC', 'US', 'stock', '金融', 'Marsh & McLennan', 690),
  ('ALNY', 'US', 'stock', 'ヘルスケア', 'Alnylam Pharmaceuticals', 1930),
  ('ASML', 'US', 'stock', 'テクノロジー', 'ASML Holding', 1960),
  ('AZN', 'US', 'stock', 'ヘルスケア', 'AstraZeneca', 1970),
  ('ENPH', 'US', 'stock', 'テクノロジー', 'Enphase Energy', 2110),
  ('GFS', 'US', 'stock', 'テクノロジー', 'GlobalFoundries', 2150),
  ('ILMN', 'US', 'stock', 'ヘルスケア', 'Illumina', 2170),
  ('JD', 'US', 'stock', '一般消費財', 'JD.com', 2180),
  ('LCID', 'US', 'stock', '一般消費財', 'Lucid Group', 2210),
  ('MDB', 'US', 'stock', 'テクノロジー', 'MongoDB', 2240),
  ('MELI', 'US', 'stock', '一般消費財', 'MercadoLibre', 2250),
  ('MRVL', 'US', 'stock', 'テクノロジー', 'Marvell Technology', 2270),
  ('OKTA', 'US', 'stock', 'テクノロジー', 'Okta', 2320),
  ('PDD', 'US', 'stock', '一般消費財', 'PDD Holdings', 2330),
  ('SIRI', 'US', 'stock', 'コミュニケーション', 'Sirius XM', 2380),
  ('TEAM', 'US', 'stock', 'テクノロジー', 'Atlassian', 2400),
  ('ZS', 'US', 'stock', 'テクノロジー', 'Zscaler', 2490),
  ('BIO', 'US', 'stock', 'ヘルスケア', 'Bio-Rad Laboratories', 2800),
  ('BWA', 'US', 'stock', '一般消費財', 'BorgWarner', 2830),
  ('CZR', 'US', 'stock', '一般消費財', 'Caesars Entertainment', 2890),
  ('KMX', 'US', 'stock', '一般消費財', 'CarMax', 2930),
  ('CE', 'US', 'stock', '素材', 'Celanese', 2960),
  ('CNX', 'US', 'stock', 'エネルギー', 'CNX Resources', 2990),
  ('CTRA', 'US', 'stock', 'エネルギー', 'Coterra Energy', 3150),
  ('DAY', 'US', 'stock', '資本財・産業', 'Dayforce', 3200),
  ('EMN', 'US', 'stock', '素材', 'Eastman Chemical', 3300),
  ('ETSY', 'US', 'stock', '一般消費財', 'Etsy', 3390),
  ('HOLX', 'US', 'stock', 'ヘルスケア', 'Hologic', 3670),
  ('LW', 'US', 'stock', '生活必需品', 'Lamb Weston', 3950),
  ('LNC', 'US', 'stock', '金融', 'Lincoln National', 3980),
  ('LKQ', 'US', 'stock', '一般消費財', 'LKQ Corporation', 4000),
  ('MKTX', 'US', 'stock', '金融', 'MarketAxess', 4040),
  ('MTCH', 'US', 'stock', 'コミュニケーション', 'Match Group', 4070),
  ('MHK', 'US', 'stock', '一般消費財', 'Mohawk Industries', 4130),
  ('MOH', 'US', 'stock', 'ヘルスケア', 'Molina Healthcare', 4140),
  ('PAYC', 'US', 'stock', '資本財・産業', 'Paycom Software', 4340),
  ('QRVO', 'US', 'stock', 'テクノロジー', 'Qorvo', 4480),
  ('TFX', 'US', 'stock', 'ヘルスケア', 'Teleflex', 4760),
  ('VNO', 'US', 'stock', '不動産', 'Vornado Realty Trust', 4950)
on conflict (symbol) do update
set region = excluded.region,
    asset_type = excluded.asset_type,
    sector = excluded.sector,
    industry = coalesce(nullif(excluded.industry, ''), stock_symbol_profiles.industry),
    priority = least(stock_symbol_profiles.priority, excluded.priority),
    updated_at = now();

commit;
