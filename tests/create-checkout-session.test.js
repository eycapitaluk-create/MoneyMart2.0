import assert from 'node:assert/strict'
import test from 'node:test'

import { createCheckoutForUser } from '../api/billing/create-checkout-session.js'

const user = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'member@example.com',
}

function createStripe({
  searchSubscriptions = [],
  customerSubscriptions = [],
  customers = [{ id: 'cus_member' }],
  sessions = [],
} = {}) {
  const calls = []
  return {
    calls,
    subscriptions: {
      async search(params) {
        calls.push(['subscriptions.search', params])
        const status = params.query.includes("status:'trialing'") ? 'trialing' : 'active'
        return {
          data: searchSubscriptions.filter((subscription) => subscription.status === status),
        }
      },
      async list(params) {
        calls.push(['subscriptions.list', params])
        return { data: customerSubscriptions }
      },
    },
    customers: {
      async search(params) {
        calls.push(['customers.search', params])
        return { data: customers }
      },
      async create(params, options) {
        calls.push(['customers.create', params, options])
        return { id: 'cus_created', ...params }
      },
    },
    checkout: {
      sessions: {
        async list(params) {
          calls.push(['checkout.sessions.list', params])
          return { data: sessions }
        },
        async create(params, options) {
          calls.push(['checkout.sessions.create', params, options])
          return { id: 'cs_created', status: 'open', url: 'https://checkout.test/new' }
        },
      },
    },
  }
}

test('rejects checkout when the user already has an active subscription', async () => {
  const stripe = createStripe({
    searchSubscriptions: [{
      id: 'sub_active',
      status: 'active',
      metadata: { supabase_user_id: user.id },
    }],
  })

  await assert.rejects(
    createCheckoutForUser({
      stripe,
      user,
      priceId: 'price_monthly',
      origin: 'https://moneymart.example',
    }),
    (error) => (
      error.code === 'subscription_already_active'
      && error.statusCode === 409
    ),
  )

  assert.equal(
    stripe.calls.some(([name]) => name === 'checkout.sessions.create'),
    false,
  )
})

test('reuses an existing open Checkout session', async () => {
  const stripe = createStripe({
    sessions: [{
      id: 'cs_open',
      status: 'open',
      url: 'https://checkout.test/existing',
    }],
  })

  const session = await createCheckoutForUser({
    stripe,
    user,
    priceId: 'price_monthly',
    origin: 'https://moneymart.example',
  })

  assert.equal(session.url, 'https://checkout.test/existing')
  assert.equal(
    stripe.calls.some(([name]) => name === 'checkout.sessions.create'),
    false,
  )
})

test('uses a metadata-bound customer and idempotent Checkout creation', async () => {
  const stripe = createStripe({
    customers: [],
    sessions: [{ id: 'cs_expired', status: 'expired', url: null }],
  })

  const session = await createCheckoutForUser({
    stripe,
    user,
    priceId: 'price_monthly',
    origin: 'https://moneymart.example',
  })

  assert.equal(session.url, 'https://checkout.test/new')

  const customerCreate = stripe.calls.find(([name]) => name === 'customers.create')
  assert.deepEqual(customerCreate.slice(1), [
    {
      email: user.email,
      metadata: { supabase_user_id: user.id },
    },
    { idempotencyKey: `moneymart-customer-${user.id}` },
  ])

  const checkoutCreate = stripe.calls.find(([name]) => name === 'checkout.sessions.create')
  assert.equal(checkoutCreate[1].customer, 'cus_created')
  assert.equal(checkoutCreate[1].customer_email, undefined)
  assert.deepEqual(checkoutCreate[1].subscription_data.metadata, {
    supabase_user_id: user.id,
  })
  assert.match(checkoutCreate[2].idempotencyKey, /cs_expired$/)
})

test('direct customer check closes the Stripe Search consistency window', async () => {
  const stripe = createStripe({
    customerSubscriptions: [{
      id: 'sub_just_completed',
      status: 'trialing',
      metadata: { supabase_user_id: user.id },
    }],
  })

  await assert.rejects(
    createCheckoutForUser({
      stripe,
      user,
      priceId: 'price_monthly',
      origin: 'https://moneymart.example',
    }),
    { code: 'subscription_already_active', statusCode: 409 },
  )

  assert.equal(
    stripe.calls.some(([name]) => name === 'checkout.sessions.create'),
    false,
  )
})
