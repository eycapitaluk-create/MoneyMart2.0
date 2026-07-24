import assert from 'node:assert/strict'
import test from 'node:test'

import { deleteAccount } from '../api/account/delete.js'

function createAdmin({
  events,
  profile = null,
  authError = null,
  profileError = null,
}) {
  return {
    auth: {
      admin: {
        async deleteUser(userId) {
          events.push(`auth-delete:${userId}`)
          return { error: authError }
        },
      },
    },
    from(table) {
      if (table === 'user_profiles') {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    events.push('profile-read')
                    return {
                      data: profile,
                      error: profileError,
                    }
                  },
                }
              },
            }
          },
        }
      }
      return {
        delete() {
          return {
            async eq() {
              events.push(`cleanup:${table}`)
              return { error: null }
            },
          }
        },
      }
    },
  }
}

function createStripe({
  events,
  searchByStatus = {},
  customers = {},
  customerSubscriptions = {},
  subscriptions = {},
  cancelErrorById = {},
}) {
  return {
    subscriptions: {
      async search(params) {
        events.push(['subscriptions.search', params.query])
        const status = params.query.includes("status:'trialing'") ? 'trialing' : 'active'
        return { data: searchByStatus[status] || [] }
      },
      async list(params) {
        events.push(['subscriptions.list', params.customer])
        return { data: customerSubscriptions[params.customer] || [] }
      },
      async retrieve(subscriptionId) {
        events.push(`stripe-retrieve:${subscriptionId}`)
        if (!(subscriptionId in subscriptions)) {
          const error = new Error('No such subscription')
          error.code = 'resource_missing'
          throw error
        }
        return subscriptions[subscriptionId]
      },
      async cancel(subscriptionId) {
        events.push(`stripe-cancel:${subscriptionId}`)
        if (cancelErrorById[subscriptionId]) throw cancelErrorById[subscriptionId]
      },
    },
    customers: {
      async retrieve(customerId) {
        events.push(`customer-retrieve:${customerId}`)
        if (!(customerId in customers)) {
          const error = new Error('No such customer')
          error.code = 'resource_missing'
          throw error
        }
        return customers[customerId]
      },
    },
  }
}

test('cancels every owned active subscription before deleting the account', async () => {
  const events = []
  const admin = createAdmin({
    events,
    profile: {
      stripe_subscription_id: 'sub_tracked',
      stripe_customer_id: 'cus_member',
    },
  })

  await deleteAccount({
    admin,
    userId: 'user-1',
    stripeSecret: 'sk_test',
    createStripeClient: () => createStripe({
      events,
      searchByStatus: {
        active: [
          { id: 'sub_orphan', metadata: { supabase_user_id: 'user-1' }, status: 'active' },
          { id: 'sub_tracked', metadata: { supabase_user_id: 'user-1' }, status: 'active' },
        ],
        trialing: [],
      },
      customers: {
        cus_member: { id: 'cus_member', metadata: { supabase_user_id: 'user-1' } },
      },
      customerSubscriptions: {
        cus_member: [
          { id: 'sub_orphan', metadata: { supabase_user_id: 'user-1' }, status: 'active' },
          { id: 'sub_tracked', metadata: { supabase_user_id: 'user-1' }, status: 'active' },
          { id: 'sub_other', metadata: { supabase_user_id: 'user-2' }, status: 'active' },
        ],
      },
      subscriptions: {
        sub_tracked: { id: 'sub_tracked', metadata: { supabase_user_id: 'user-1' }, status: 'active' },
      },
    }),
  })

  assert.ok(events.includes('profile-read'))
  assert.ok(events.includes('stripe-cancel:sub_orphan'))
  assert.ok(events.includes('stripe-cancel:sub_tracked'))
  assert.equal(events.includes('stripe-cancel:sub_other'), false)
  assert.ok(events.indexOf('auth-delete:user-1') > events.lastIndexOf('stripe-cancel:sub_tracked'))
  assert.ok(events.indexOf('auth-delete:user-1') > events.lastIndexOf('stripe-cancel:sub_orphan'))
  assert.ok(events.slice(events.indexOf('auth-delete:user-1') + 1).every((event) => (
    typeof event === 'string' && event.startsWith('cleanup:')
  )))
})

test('still cancels orphaned subscriptions when the profile id is missing or stale', async () => {
  const events = []
  const admin = createAdmin({
    events,
    profile: {
      stripe_subscription_id: 'sub_stale',
      stripe_customer_id: null,
    },
  })

  await deleteAccount({
    admin,
    userId: 'user-1',
    stripeSecret: 'sk_test',
    createStripeClient: () => createStripe({
      events,
      searchByStatus: {
        active: [
          { id: 'sub_live', metadata: { supabase_user_id: 'user-1' }, status: 'active' },
        ],
        trialing: [],
      },
      subscriptions: {},
    }),
  })

  assert.ok(events.includes('stripe-retrieve:sub_stale'))
  assert.ok(events.includes('stripe-cancel:sub_live'))
  assert.ok(events.includes('auth-delete:user-1'))
})

test('does not delete the account when Stripe cancellation fails', async () => {
  const events = []
  const admin = createAdmin({
    events,
    profile: { stripe_subscription_id: 'sub_paid' },
  })

  await assert.rejects(
    deleteAccount({
      admin,
      userId: 'user-1',
      stripeSecret: 'sk_test',
      createStripeClient: () => createStripe({
        events,
        searchByStatus: {
          active: [
            { id: 'sub_paid', metadata: { supabase_user_id: 'user-1' }, status: 'active' },
          ],
          trialing: [],
        },
        subscriptions: {
          sub_paid: { id: 'sub_paid', metadata: { supabase_user_id: 'user-1' }, status: 'active' },
        },
        cancelErrorById: {
          sub_paid: new Error('Stripe unavailable'),
        },
      }),
    }),
    /Stripe unavailable/,
  )

  assert.equal(events.includes('auth-delete:user-1'), false)
  assert.equal(events.some((event) => typeof event === 'string' && event.startsWith('cleanup:')), false)
})

test('does not cancel a profile subscription that belongs to another user', async () => {
  const events = []
  const admin = createAdmin({
    events,
    profile: { stripe_subscription_id: 'sub_other_user' },
  })

  await assert.rejects(
    deleteAccount({
      admin,
      userId: 'user-1',
      stripeSecret: 'sk_test',
      createStripeClient: () => createStripe({
        events,
        searchByStatus: { active: [], trialing: [] },
        subscriptions: {
          sub_other_user: {
            id: 'sub_other_user',
            metadata: { supabase_user_id: 'user-2' },
            status: 'active',
          },
        },
      }),
    }),
    /ownership mismatch/,
  )

  assert.equal(events.includes('stripe-cancel:sub_other_user'), false)
  assert.equal(events.includes('auth-delete:user-1'), false)
})

test('does not clean up personal data when Auth deletion fails', async () => {
  const events = []
  const admin = createAdmin({
    events,
    profile: null,
    authError: new Error('Auth unavailable'),
  })

  await assert.rejects(
    deleteAccount({
      admin,
      userId: 'user-1',
      stripeSecret: '',
    }),
    /Auth unavailable/,
  )

  assert.deepEqual(events, ['profile-read', 'auth-delete:user-1'])
})

test('fails closed when billing ids exist but Stripe is not configured', async () => {
  const events = []
  const admin = createAdmin({
    events,
    profile: { stripe_subscription_id: 'sub_paid' },
  })

  await assert.rejects(
    deleteAccount({
      admin,
      userId: 'user-1',
      stripeSecret: '',
    }),
    /Missing Stripe server env/,
  )

  assert.deepEqual(events, ['profile-read'])
})
