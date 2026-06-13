export async function replaceNewsManualBucketRows(adminClient, buckets, rows) {
  const bucketList = [...new Set((buckets || []).map((bucket) => String(bucket || '').trim()).filter(Boolean))]
  if (bucketList.length === 0) {
    throw new Error('replaceNewsManualBucketRows requires at least one bucket')
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { inserted: 0, replacedBuckets: bucketList }
  }

  const allowedBuckets = new Set(bucketList)
  const invalidBucket = rows.find((row) => !allowedBuckets.has(String(row?.bucket || '')))
  if (invalidBucket) {
    throw new Error(`Replacement row uses unmanaged bucket: ${String(invalidBucket?.bucket || '')}`)
  }

  const batchUpdatedAt = new Date().toISOString()
  const stampedRows = rows.map((row) => ({
    ...row,
    is_active: row?.is_active ?? true,
    updated_at: batchUpdatedAt,
  }))

  const { error: insertErr } = await adminClient
    .from('news_manual')
    .insert(stampedRows)
  if (insertErr) throw insertErr

  const { error: deleteErr } = await adminClient
    .from('news_manual')
    .delete()
    .in('bucket', bucketList)
    .lt('updated_at', batchUpdatedAt)
  if (deleteErr) throw deleteErr

  return {
    inserted: stampedRows.length,
    replacedBuckets: bucketList,
    batchUpdatedAt,
  }
}
