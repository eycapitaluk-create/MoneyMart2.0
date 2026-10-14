const PG_UNIQUE_VIOLATION = '23505'

export function isDuplicateChildInsertError(error) {
  const code = String(error?.code || '')
  const status = Number(error?.status || error?.statusCode || 0)
  return code === PG_UNIQUE_VIOLATION || code === '409' || status === 409
}

/** Bulk insert, then one row at a time. Duplicate conflicts are skipped. No onConflict: that errors before the unique constraint exists. */
export async function insertRowsSkippingDuplicates(rows, insertMany) {
  const pending = Array.isArray(rows) ? rows : []
  if (pending.length === 0) return { inserted: 0, skipped: 0 }
  const bulk = await insertMany(pending)
  if (!bulk?.error) return { inserted: pending.length, skipped: 0 }
  if (!isDuplicateChildInsertError(bulk.error)) throw bulk.error
  let inserted = 0
  let skipped = 0
  for (const row of pending) {
    const one = await insertMany([row])
    if (!one?.error) {
      inserted += 1
      continue
    }
    if (isDuplicateChildInsertError(one.error)) {
      skipped += 1
      continue
    }
    throw one.error
  }
  return { inserted, skipped }
}
