const NEWS_MANUAL_TABLE = 'news_manual'

export const replaceNewsManualBucketRows = async (
  adminClient,
  buckets,
  rows,
  { batchUpdatedAt = new Date().toISOString() } = {},
) => {
  if (!adminClient) {
    throw new Error('replaceNewsManualBucketRows requires a Supabase client')
  }
  if (!Array.isArray(buckets) || buckets.length === 0) {
    throw new Error('replaceNewsManualBucketRows requires at least one bucket')
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: true, inserted: 0, deletedOldRows: false, batchUpdatedAt }
  }

  const bucketSet = new Set(buckets)
  const stampedRows = rows.map((row) => ({
    ...row,
    updated_at: batchUpdatedAt,
  }))

  const invalidBuckets = stampedRows
    .map((row) => row?.bucket)
    .filter((bucket) => !bucketSet.has(bucket))
  if (invalidBuckets.length > 0) {
    throw new Error(`Replacement rows contain unexpected buckets: ${[...new Set(invalidBuckets)].join(', ')}`)
  }

  const { error: insertErr } = await adminClient
    .from(NEWS_MANUAL_TABLE)
    .insert(stampedRows)
  if (insertErr) {
    return { ok: false, phase: 'insert', error: insertErr, inserted: 0, deletedOldRows: false, batchUpdatedAt }
  }

  const { error: deleteErr } = await adminClient
    .from(NEWS_MANUAL_TABLE)
    .delete()
    .in('bucket', buckets)
    .lt('updated_at', batchUpdatedAt)
  if (deleteErr) {
    return { ok: false, phase: 'delete', error: deleteErr, inserted: stampedRows.length, deletedOldRows: false, batchUpdatedAt }
  }

  return { ok: true, inserted: stampedRows.length, deletedOldRows: true, batchUpdatedAt }
}
