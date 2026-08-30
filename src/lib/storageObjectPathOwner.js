/**
 * Storage object path ownership for lounge-images / news-images.
 *
 * RLS must enforce this; the helper keeps client uploads on the same layout
 * (`{userId}/…` or `insights/covers/{userId}/…`) so a caller cannot aim at
 * another user's prefix.
 */

export function isOwnedStorageObjectPath(objectName, userId) {
  const uid = String(userId || '').trim()
  if (!uid) return false
  const parts = String(objectName || '').split('/').filter(Boolean)
  if (parts.length < 2) return false
  if (parts[0] === uid) return true
  return parts[0] === 'insights' && parts[1] === 'covers' && parts[2] === uid && parts.length >= 4
}

export function loungeImageObjectPath(userId, fileName) {
  const uid = String(userId || '').trim()
  const name = String(fileName || '').trim()
  if (!uid || !name) return ''
  return `${uid}/${name}`
}

export function insightCoverObjectPath(userId, fileName) {
  const uid = String(userId || '').trim()
  const name = String(fileName || '').trim()
  if (!uid || !name) return ''
  return `insights/covers/${uid}/${name}`
}
