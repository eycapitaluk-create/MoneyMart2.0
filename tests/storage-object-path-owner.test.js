import test from 'node:test'
import assert from 'node:assert/strict'
import {
  insightCoverObjectPath,
  isOwnedStorageObjectPath,
  loungeImageObjectPath,
} from '../src/lib/storageObjectPathOwner.js'

test('lounge paths are owned only when the first segment is the user id', () => {
  const uid = '11111111-2222-4333-8444-555555555555'
  const path = loungeImageObjectPath(uid, '1725000000-0.jpg')
  assert.equal(path, `${uid}/1725000000-0.jpg`)
  assert.equal(isOwnedStorageObjectPath(path, uid), true)
  assert.equal(isOwnedStorageObjectPath(path, 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'), false)
})

test('insight cover paths are owned only when folder[3] is the user id', () => {
  const uid = '11111111-2222-4333-8444-555555555555'
  const path = insightCoverObjectPath(uid, 'cover.webp')
  assert.equal(path, `insights/covers/${uid}/cover.webp`)
  assert.equal(isOwnedStorageObjectPath(path, uid), true)
  assert.equal(isOwnedStorageObjectPath(path, 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'), false)
})

test('root or empty object names are never treated as owned', () => {
  const uid = '11111111-2222-4333-8444-555555555555'
  assert.equal(isOwnedStorageObjectPath('hero.jpg', uid), false)
  assert.equal(isOwnedStorageObjectPath('', uid), false)
  assert.equal(isOwnedStorageObjectPath(`${uid}`, uid), false)
  assert.equal(isOwnedStorageObjectPath(null, uid), false)
  assert.equal(isOwnedStorageObjectPath(`${uid}/a.jpg`, ''), false)
})

test('insights/covers without a file segment is rejected', () => {
  const uid = '11111111-2222-4333-8444-555555555555'
  assert.equal(isOwnedStorageObjectPath(`insights/covers/${uid}`, uid), false)
})
