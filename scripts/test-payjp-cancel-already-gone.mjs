import assert from 'node:assert/strict'
import { isPayjpSubscriptionAlreadyGone } from '../api/_lib/payjp-api.js'

const documentedCancel = {
  status: 400,
  code: 'payjp_api_error',
  message: 'Subscription `sub_19f6a2123363b514a743d1334109` already has been canceled',
  payjp: {
    error: {
      message: 'Subscription `sub_19f6a2123363b514a743d1334109` already has been canceled',
      status: 400,
      type: 'client_error',
    },
  },
}

assert.equal(
  isPayjpSubscriptionAlreadyGone(documentedCancel),
  true,
  'documented PAY.JP already-canceled message must not block account deletion',
)

assert.equal(
  /no such subscription|already been canceled|already canceled|status is canceled/i.test(documentedCancel.message),
  false,
  'the old guard misses "already has been canceled"',
)

assert.equal(isPayjpSubscriptionAlreadyGone({
  status: 400,
  code: 'already_canceled',
  message: 'すでにキャンセル済みの定期課金',
}), true)

assert.equal(isPayjpSubscriptionAlreadyGone({
  status: 404,
  code: 'invalid_id',
  message: 'No such subscription: sub_deleted_after_period_end',
}), true)

assert.equal(isPayjpSubscriptionAlreadyGone({
  status: 400,
  code: 'already_paused',
  message: 'Subscription `sub_paused` already has been paused',
}), false, 'a paused subscription still needs cancel before deletion')

assert.equal(isPayjpSubscriptionAlreadyGone({
  status: 402,
  code: 'card_declined',
  message: 'Your card was declined.',
}), false)

console.log('PAY.JP already-canceled guard passed.')
