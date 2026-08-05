import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const readRepoFile = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('Stripe profile failures propagate so webhook delivery is retried', async () => {
  const source = await readRepoFile('api/billing/stripe-webhook.js')

  assert.match(source, /profile select[\s\S]*throw selErr/)
  assert.match(source, /profile update[\s\S]*throw error/)
  assert.match(source, /profile insert[\s\S]*throw error/)
  assert.match(source, /catch \(err\) \{[\s\S]*res\.statusCode = 500/)
})
