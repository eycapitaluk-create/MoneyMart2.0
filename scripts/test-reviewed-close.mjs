import assert from 'node:assert/strict';
import { validateReviewedClose } from './validate-reviewed-close.mjs';
const ref = {
  symbol: 'A', quoted_symbol: 'A', source_url: 'https://stockanalysis.com/stocks/a/history/',
  source_provider: 'S&P Global Market Intelligence', source_policy: 'Prices added after the close; stock splits adjusted.',
  checked_at: '2026-10-14T01:30:00Z',
  expected: { date: 'Oct 13, 2026', open: 171.87, high: 172.74, low: 169.9, close: 171.6, adj_close_not_used: 171.6, volume: 1536706, source_line: 'Oct 13, 2026 | 171.87 | 172.74 | 169.90 | 171.60 | 171.60 | 0.16% | 1,536,706' },
  previous: { date: 'Oct 12, 2026', close: 171.33 },
};
const previous = { previous_close: 171.330002, previous_raw: { price_basis: 'unadjusted_daily_ohlc' } };
const check = (change, reason) => { const copy = structuredClone(ref); change(copy); assert.equal(validateReviewedClose(copy, previous).reason, reason); };
assert.equal(validateReviewedClose(ref, previous).row.close, 171.6);
check((r) => { r.quoted_symbol = 'OTHER'; }, 'security_identity_unconfirmed');
check((r) => { r.expected.date = 'Oct 14, 2026'; }, 'source_session_missing');
check((r) => { r.expected.close = 171.5; }, 'source_ohlcv_column_mismatch');
check((r) => { r.expected.source_line = r.expected.source_line.replace('172.74', '170.00'); r.expected.high = 170; }, 'ohlc_invalid');
check((r) => { r.expected.volume = null; }, 'source_ohlcv_column_mismatch');
check((r) => { r.expected.volume = 0; r.expected.source_line = r.expected.source_line.replace('1,536,706', '0'); }, 'exact_trading_volume_unconfirmed');
assert.equal(validateReviewedClose(ref, { ...previous, previous_close: 173 }).reason, 'previous_close_mismatch');
assert.equal(validateReviewedClose(ref, { ...previous, previous_raw: { price_basis: 'dividend_adjusted' } }).reason, 'previous_basis_unconfirmed');
const adjusted = structuredClone(ref); adjusted.expected.adj_close_not_used = 999;
assert.equal(validateReviewedClose(adjusted, previous).row.close, 171.6);
console.log('Reviewed close: actual source row passes; 8 unsafe source/date/identity/basis/volume cases rejected; adjusted close not used.');
