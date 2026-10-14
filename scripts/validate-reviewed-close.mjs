// Offline validation only. This does not fetch prices, deploy, or write the DB.
export function validateReviewedClose(ref, previous, { expectedDate = '2026-10-13', previousDate = '2026-10-12', aliases = {} } = {}) {
  const alias = aliases[ref.symbol];
  const expectedSymbol = alias && alias.effective <= expectedDate ? alias.new_ticker : ref.symbol;
  if (ref.quoted_symbol !== expectedSymbol) return { ok: false, reason: 'security_identity_unconfirmed' };
  if (expectedSymbol !== ref.symbol && !alias.source) return { ok: false, reason: 'alias_source_missing' };
  if (!ref.source_provider?.includes('S&P Global Market Intelligence') || !ref.source_policy?.includes('after the close')) return { ok: false, reason: 'daily_source_unconfirmed' };
  const displayedDate = (date) => new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
  if (ref.expected?.date !== displayedDate(expectedDate) || ref.previous?.date !== displayedDate(previousDate)) return { ok: false, reason: 'source_session_missing' };
  const row = ref.expected;
  const columns = row.source_line?.split('|').map((s) => s.trim()) || [];
  const sourceNumber = (i) => /^\d[\d,.]*$/.test(columns[i]) ? Number(columns[i].replaceAll(',', '')) : null;
  if (columns[0] !== displayedDate(expectedDate) || [1, 2, 3, 4, 7].some((i, n) => sourceNumber(i) !== [row.open, row.high, row.low, row.close, row.volume][n])) return { ok: false, reason: 'source_ohlcv_column_mismatch' };
  if (![row.open, row.high, row.low, row.close].every((n) => Number.isFinite(n) && n > 0) || row.low > Math.min(row.open, row.close) || row.high < Math.max(row.open, row.close)) return { ok: false, reason: 'ohlc_invalid' };
  if (!Number.isSafeInteger(row.volume) || row.volume <= 0) return { ok: false, reason: 'exact_trading_volume_unconfirmed' };
  const previousClose = Number(previous?.previous_close);
  const basis = previous?.previous_raw?.price_basis;
  const prior = previous?.previous_raw;
  const verifiedLegacyAlias = expectedSymbol !== ref.symbol && alias.source === prior?.alias_identity_source && prior?.provider_symbol === expectedSymbol && ['nominal_US_daily_quote_excluding_dividend_adjustment', 'unadjusted_reported_quote'].includes(basis) && (prior.same_CUSIP_confirmed === true || prior.anchor_closes?.length > 0);
  if (!(previousClose > 0) || (!['unadjusted_daily_ohlc', 'split_adjusted_daily_close_excluding_dividend_adjustment'].includes(basis) && !verifiedLegacyAlias)) return { ok: false, reason: 'previous_basis_unconfirmed' };
  const difference = Math.abs(previousClose - ref.previous.close);
  if (!Number.isFinite(difference) || difference > 0.011) return { ok: false, reason: 'previous_close_mismatch' };
  if (Math.abs(row.close / previousClose - 1) > 0.25) return { ok: false, reason: 'extreme_move_review_required' };
  return { ok: true, row: {
    source: 'marketstack', symbol: ref.symbol, trade_date: expectedDate,
    open: row.open, high: row.high, low: row.low, close: row.close, volume: row.volume,
    previous_close: previousClose, previous_trade_date: previousDate,
    raw: {
      provider: 'S&P Global Market Intelligence via Stock Analysis',
      source_url: ref.source_url, source_checked_at: ref.checked_at,
      price_basis: 'split_adjusted_daily_close_excluding_dividend_adjustment',
      currency: 'USD', timezone: 'America/New_York', adjusted_close: 'not_used',
      close_column: 'Close, not Adj. Close', dividends_excluded: true,
      collection_mode: 'reviewed_daily_reference_completion',
      source_trade_date: expectedDate, source_ohlcv_row: row.source_line,
      previous_trade_date: previousDate, previous_close_db: previousClose,
      source_previous_close: ref.previous.close, previous_close_difference: difference,
      verified_provider_symbol: expectedSymbol,
      ...(expectedSymbol !== ref.symbol ? { same_security_alias_source: alias.source, alias_effective: alias.effective } : {}),
    },
  } };
}
