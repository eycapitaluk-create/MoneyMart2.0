export async function replaceNewsManualBucketRows(adminClient, buckets, rows, batchUpdatedAt = new Date().toISOString()) {
  const stampedRows = rows.map((row) => ({
    ...row,
    updated_at: batchUpdatedAt,
  }))

  const { error: insertErr } = await adminClient.from('news_manual').insert(stampedRows)
  if (insertErr) {
    return { error: insertErr }
  }

  const { error: deleteErr } = await adminClient
    .from('news_manual')
    .delete()
    .in('bucket', buckets)
    .lt('updated_at', batchUpdatedAt)
  if (deleteErr) {
    return { error: deleteErr }
  }

  return { inserted: stampedRows.length }
}

export async function replaceAiNewsSummaryRows(adminClient, rows, batchUpdatedAt = new Date().toISOString()) {
  const stampedRows = rows.map((row) => ({
    ...row,
    updated_at: batchUpdatedAt,
  }))

  const { error: insertErr } = await adminClient.from('ai_news_summaries').insert(stampedRows)
  if (insertErr) {
    return { error: insertErr }
  }

  const { error: deactivateErr } = await adminClient
    .from('ai_news_summaries')
    .update({ is_active: false })
    .eq('is_active', true)
    .lt('updated_at', batchUpdatedAt)
  if (deactivateErr) {
    return { error: deactivateErr }
  }

  return { inserted: stampedRows.length }
}
