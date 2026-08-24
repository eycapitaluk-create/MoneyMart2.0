import test from 'node:test'
import assert from 'node:assert/strict'
import {
  COMMUNITY_SEED_PERSONAS,
  generateSeedPersonaPassword,
  isLegacyDeterministicSeedPassword,
  legacyDeterministicSeedPassword,
} from '../api/_lib/community-seed-personas.js'
import { ensureSeedPersona } from '../api/_lib/community-hourly-seed.js'

test('seed persona passwords are not derived from public nickname length', () => {
  const persona = COMMUNITY_SEED_PERSONAS[0]
  const a = generateSeedPersonaPassword()
  const b = generateSeedPersonaPassword()
  assert.notEqual(a, b)
  assert.ok(a.length >= 24)
  assert.equal(isLegacyDeterministicSeedPassword(a, persona.nickname), false)
  assert.equal(
    isLegacyDeterministicSeedPassword(
      legacyDeterministicSeedPassword(persona.nickname),
      persona.nickname,
    ),
    true,
  )
})

function makeAdmin({ existingUserId = null, email = 'mm-seed-01@community.seed' } = {}) {
  const created = []
  const updated = []
  const signedOut = []
  return {
    created,
    updated,
    signedOut,
    auth: {
      admin: {
        listUsers: async () => ({
          data: {
            users: existingUserId ? [{ id: existingUserId, email }] : [],
          },
          error: null,
        }),
        createUser: async (payload) => {
          created.push(payload)
          return { data: { user: { id: 'new-user-id' } }, error: null }
        },
        updateUserById: async (userId, payload) => {
          updated.push({ userId, payload })
          return { data: { user: { id: userId } }, error: null }
        },
        signOut: async (userId, scope) => {
          signedOut.push({ userId, scope })
          return { error: null }
        },
      },
    },
    from: () => ({
      upsert: async () => ({ error: null }),
    }),
  }
}

test('new seed personas are created with a random password, not the public formula', async () => {
  const persona = COMMUNITY_SEED_PERSONAS[0]
  const admin = makeAdmin({ existingUserId: null, email: persona.email })
  await ensureSeedPersona(admin, persona)
  assert.equal(admin.created.length, 1)
  const password = admin.created[0].password
  assert.ok(password)
  assert.equal(isLegacyDeterministicSeedPassword(password, persona.nickname), false)
  assert.notEqual(password, legacyDeterministicSeedPassword(persona.nickname))
})

test('existing seed personas have their public password rotated and sessions dropped', async () => {
  const persona = COMMUNITY_SEED_PERSONAS[3]
  const admin = makeAdmin({ existingUserId: 'existing-id', email: persona.email })
  await ensureSeedPersona(admin, persona)
  assert.equal(admin.created.length, 0)
  assert.equal(admin.updated.length, 1)
  assert.equal(admin.updated[0].userId, 'existing-id')
  const password = admin.updated[0].payload.password
  assert.equal(isLegacyDeterministicSeedPassword(password, persona.nickname), false)
  assert.deepEqual(admin.signedOut, [{ userId: 'existing-id', scope: 'global' }])
})
