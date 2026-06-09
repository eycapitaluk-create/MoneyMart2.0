const NEWS_MANUAL_TABLE = 'news_manual'

const normalizeBuckets = (buckets) => [
  ...new Set((Array.isArray(buckets) ? buckets : [buckets])
    .map((bucket) => String(bucket || '').trim())
    .filter(Boolean)),
]

/**
 * Safely swaps generated news_manual rows without deleting the live rows first.
 * If insertion fails, the existing rows remain untouched.
 */
export async function replaceNewsManualBucketRows(supabaseClient, buckets, rows) {
  if (!supabaseClient || typeof supabaseClient.from !== 'function') {
    throw new Error('Supabase client is required')
  }

  const targetBuckets = normalizeBuckets(buckets)
  if (targetBuckets.length === 0) {
    throw new Error('At least one news_manual bucket is required')
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Refusing to replace news_manual rows with an empty batch')
  }

  const targetBucketSet = new Set(targetBuckets)
  const outOfScopeRow = rows.find((row) => !targetBucketSet.has(String(row?.bucket || '').trim()))
  if (outOfScopeRow) {
    throw new Error(`Replacement row bucket is outside target scope: ${outOfScopeRow?.bucket || '(empty)'}`)
  }

  const replacementStartedAt = new Date().toISOString()
  const rowsToInsert = rows.map((row) => ({
    ...row,
    updated_at: replacementStartedAt,
  }))

  const { data: insertedRows, error: insertErr } = await supabaseClient
    .from(NEWS_MANUAL_TABLE)
    .insert(rowsToInsert)
    .select('id')
  if (insertErr) throw insertErr

  const { error: deleteErr } = await supabaseClient
    .from(NEWS_MANUAL_TABLE)
    .delete()
    .in('bucket', targetBuckets)
    .or(`updated_at.is.null,updated_at.lt.${replacementStartedAt}`)
  if (deleteErr) throw deleteErr

  return {
    buckets: targetBuckets,
    inserted: Array.isArray(insertedRows) ? insertedRows.length : rowsToInsert.length,
    replacementStartedAt,
  }
}
