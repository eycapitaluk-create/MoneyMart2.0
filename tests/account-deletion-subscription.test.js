import assert from 'node:assert/strict'
import test from 'node:test'

import { deleteAccount } from '../api/account/delete.js'

function createAdmin({ events, subscriptionId = null, authError = null }) {
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
                      data: subscriptionId ? { stripe_subscription_id: subscriptionId } : null,
                      error: null,
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

test('cancels an active Stripe subscription before deleting the account', async () => {
  const events = []
  const admin = createAdmin({ events, subscriptionId: 'sub_paid' })

  await deleteAccount({
    admin,
    userId: 'user-1',
    stripeSecret: 'sk_test',
    createStripeClient: () => ({
      subscriptions: {
        async retrieve(subscriptionId) {
          events.push(`stripe-retrieve:${subscriptionId}`)
          return { metadata: { supabase_user_id: 'user-1' } }
        },
        async cancel(subscriptionId) {
          events.push(`stripe-cancel:${subscriptionId}`)
        },
      },
    }),
  })

  assert.deepEqual(events.slice(0, 4), [
    'profile-read',
    'stripe-retrieve:sub_paid',
    'stripe-cancel:sub_paid',
    'auth-delete:user-1',
  ])
  assert.ok(events.slice(4).every((event) => event.startsWith('cleanup:')))
})

test('does not delete the account or personal data when Stripe cancellation fails', async () => {
  const events = []
  const admin = createAdmin({ events, subscriptionId: 'sub_paid' })

  await assert.rejects(
    deleteAccount({
      admin,
      userId: 'user-1',
      stripeSecret: 'sk_test',
      createStripeClient: () => ({
        subscriptions: {
          async retrieve() {
            events.push('stripe-retrieve')
            return { metadata: { supabase_user_id: 'user-1' } }
          },
          async cancel() {
            events.push('stripe-cancel')
            throw new Error('Stripe unavailable')
          },
        },
      }),
    }),
    /Stripe unavailable/,
  )

  assert.deepEqual(events, ['profile-read', 'stripe-retrieve', 'stripe-cancel'])
})

test('does not cancel a subscription that belongs to another user', async () => {
  const events = []
  const admin = createAdmin({ events, subscriptionId: 'sub_other_user' })

  await assert.rejects(
    deleteAccount({
      admin,
      userId: 'user-1',
      stripeSecret: 'sk_test',
      createStripeClient: () => ({
        subscriptions: {
          async retrieve() {
            events.push('stripe-retrieve')
            return { metadata: { supabase_user_id: 'user-2' } }
          },
          async cancel() {
            events.push('stripe-cancel')
          },
        },
      }),
    }),
    /ownership mismatch/,
  )

  assert.deepEqual(events, ['profile-read', 'stripe-retrieve'])
})

test('does not clean up personal data when Auth deletion fails', async () => {
  const events = []
  const admin = createAdmin({
    events,
    subscriptionId: null,
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
