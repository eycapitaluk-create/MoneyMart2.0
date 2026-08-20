/**
 * MyPage owned stock/fund cloud hydrate vs in-flight edits.
 *
 * `replaceOwnedAssetPositions` is a full delete+insert. If hydrate overwrites
 * React state after the user added a lot (list is empty until load finishes),
 * the debounced autosave persists the stale DB snapshot and the new lot is lost.
 */

export const OWNED_ASSET_HYDRATE_BUSY_MESSAGE =
  '保有データの読み込み中です。完了してから操作してください。'

export function canMutateOwnedAssets({ userId, ownedAssetDbReady } = {}) {
  if (!userId) return true
  return ownedAssetDbReady === true
}

/**
 * Keep lots the user added during hydrate (new ids) on top of the DB snapshot.
 * Local rows whose id already exists in DB are ignored so stale pre-hydrate
 * rows cannot replace server values.
 */
export function mergeLocalOwnedRowsOntoDb(dbRows, localRows, idKey) {
  const db = Array.isArray(dbRows) ? dbRows : []
  const local = Array.isArray(localRows) ? localRows : []
  const key = String(idKey || '').trim()
  if (!key) return db

  const ids = new Set()
  db.forEach((row) => {
    const id = String(row?.[key] || '').trim()
    if (id) ids.add(id)
  })

  const extras = []
  local.forEach((row) => {
    const id = String(row?.[key] || '').trim()
    if (!id || ids.has(id)) return
    ids.add(id)
    extras.push(row)
  })

  return extras.length > 0 ? [...db, ...extras] : db
}
