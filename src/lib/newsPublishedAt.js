/**
 * `<input type="date">` の値（YYYY-MM-DD）だけがあるとき DB timestamptz に入れる文字列。
 * UTC 正午（T12:00:00Z）だけだと JP/KR（+9）で常に 21:00 に見えるため、
 * そのカレンダー日付の Asia/Tokyo 正午に固定する（記事・インサイト等で日付のみ指定する場合）。
 */
export function publishedAtNoonTokyoFromDateOnly(isoDate) {
  const d = String(isoDate || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return new Date().toISOString()
  return `${d}T12:00:00+09:00`
}

/** 管理画面で保存した瞬間の時刻（UTC ISO）。手動ニュースは「掲載した今」の時刻を使う。 */
export function publishedAtNowIso() {
  return new Date().toISOString()
}
