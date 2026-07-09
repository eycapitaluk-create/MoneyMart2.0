export async function replaceNewsManualBucketRows(adminClient, buckets, rows, options = {}) {
  const bucketList = [...new Set((buckets || []).map((bucket) => String(bucket || '').trim()).filter(Boolean))]
  const inputRows = Array.isArray(rows) ? rows : []
  if (!adminClient || bucketList.length === 0 || inputRows.length === 0) {
    return { inserted: 0, deleted: 0, batchUpdatedAt: null }
  }

  const batchUpdatedAt = options.batchUpdatedAt || new Date().toISOString()
  const stampedRows = inputRows.map((row) => ({
    ...row,
    updated_at: batchUpdatedAt,
  }))

  const { error: insertErr } = await adminClient.from('news_manual').insert(stampedRows)
  if (insertErr) throw insertErr

  const { data: deletedRows, error: deleteErr } = await adminClient
    .from('news_manual')
    .delete()
    .in('bucket', bucketList)
    .lt('updated_at', batchUpdatedAt)
    .select('id')
  if (deleteErr) throw deleteErr

  return {
    inserted: stampedRows.length,
    deleted: Array.isArray(deletedRows) ? deletedRows.length : null,
    batchUpdatedAt,
  }
}
