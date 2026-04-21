-- Fill Japanese names for unresolved ticker-only symbols.
-- 1) Edit VALUES rows below (replace 日本語名プレースホルダ).
-- 2) Run this SQL in Supabase SQL Editor.

WITH name_map(symbol, name) AS (
  VALUES
  ('6479.T.1', '日本語名プレースホルダ'),
  ('AAF.XLON', '日本語名プレースホルダ'),
  ('ABBN.XSWX', '日本語名プレースホルダ'),
  ('ABDN.XLON', '日本語名プレースホルダ'),
  ('ABF.XLON', '日本語名プレースホルダ'),
  ('ABI.XBRU', '日本語名プレースホルダ'),
  ('AD.XAMS', '日本語名プレースホルダ'),
  ('ADM.XLON', '日本語名プレースホルダ'),
  ('ADYEN.XAMS', '日本語名プレースホルダ'),
  ('AHT.XLON', '日本語名プレースホルダ'),
  ('AI.XPAR', '日本語名プレースホルダ'),
  ('AIR.XPAR', '日本語名プレースホルダ'),
  ('ANTO.XLON', '日本語名プレースホルダ'),
  ('ASC.XLON', '日本語名プレースホルダ'),
  ('ASML.XAMS', '日本語名プレースホルダ'),
  ('AV.XLON', '日本語名プレースホルダ'),
  ('AZN.XLON', '日本語名プレースホルダ'),
  ('BA.XLON', '日本語名プレースホルダ'),
  ('BARC.XLON', '日本語名プレースホルダ'),
  ('BATS.XLON', '日本語名プレースホルダ'),
  ('BBY.XLON', '日本語名プレースホルダ'),
  ('BDEV.XLON', '日本語名プレースホルダ'),
  ('BEZ.XLON', '日本語名プレースホルダ'),
  ('BKG.XLON', '日本語名プレースホルダ'),
  ('BLND.XLON', '日本語名プレースホルダ'),
  ('BME.XLON', '日本語名プレースホルダ'),
  ('BN.XPAR', '日本語名プレースホルダ'),
  ('BNP.XPAR', '日本語名プレースホルダ'),
  ('BNZL.XLON', '日本語名プレースホルダ'),
  ('BP.XLON', '日本語名プレースホルダ')
)
UPDATE stock_symbols s
SET name = nm.name
FROM name_map nm
WHERE s.symbol = nm.symbol
  AND COALESCE(NULLIF(TRIM(nm.name), ''), '') <> '';

-- unresolved count at export time: 161
