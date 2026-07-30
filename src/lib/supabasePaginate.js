/**
 * PostgREST / Supabase silently caps SELECT responses (commonly 1000 rows).
 * Use range pagination whenever a full table snapshot is required before
 * delete-and-replace writes, otherwise rows past the first page are lost.
 */

export const DEFAULT_POSTGREST_PAGE_SIZE = 1000

/**
 * Exhaustively page a query that supports `.range(from, to)`.
 *
 * @param {(from: number, to: number) => PromiseLike<{ data?: any[]|null, error?: any }>} fetchPage
 * @param {{ pageSize?: number, maxPages?: number }} [options]
 * @returns {Promise<{ data: any[]|null, error: any }>}
 */
export async function fetchAllRowsPaged(fetchPage, options = {}) {
  const pageSize = Math.max(1, Math.floor(Number(options.pageSize) || DEFAULT_POSTGREST_PAGE_SIZE))
  const maxPages = Math.max(1, Math.floor(Number(options.maxPages) || 1000))
  const merged = []

  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize
    const to = from + pageSize - 1
    const result = await fetchPage(from, to)
    if (result?.error) {
      return { data: null, error: result.error }
    }
    const rows = Array.isArray(result?.data) ? result.data : []
    merged.push(...rows)
    if (rows.length < pageSize) {
      return { data: merged, error: null }
    }
  }

  return { data: merged, error: null }
}
