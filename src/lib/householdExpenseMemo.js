/** Web memos are stored in merchant. Older iOS builds stored them in notes only. */
export function householdMemoText(row) {
  const merchant = String(row?.merchant ?? '').trim()
  if (merchant) return merchant
  return String(row?.notes ?? '').trim()
}
