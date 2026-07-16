import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const readRepoFile = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('account deletion confirms Auth deletion before removing personal rows', async () => {
  for (const path of ['api/account/delete.js', 'vite.config.js']) {
    const source = await readRepoFile(path)
    const deleteIdentityAt = source.indexOf('admin.auth.admin.deleteUser(userId)')
    const deletePersonalRowsAt = source.indexOf('admin.from(table).delete()')

    assert.notEqual(deleteIdentityAt, -1, `${path} must delete the Auth identity`)
    assert.notEqual(deletePersonalRowsAt, -1, `${path} must retain legacy row cleanup`)
    assert.ok(
      deleteIdentityAt < deletePersonalRowsAt,
      `${path} must not delete personal rows before Auth accepts account deletion`,
    )
  }
})
