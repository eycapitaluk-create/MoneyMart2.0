/**
 * PAY.JP subscription status → entitlement 変換の回帰チェック
 * node scripts/verify-payjp-entitlement-status.mjs
 */
import {
  isPayjpTrialLikeStatus,
  payjpEntitlementStatus,
  payjpPeriodEndIso,
} from '../api/_lib/payjp-api.js'

const nowSec = Math.floor(Date.now() / 1000)
const future = nowSec + 86400 * 7
const past = nowSec - 86400

const cases = [
  {
    name: 'PAY.JP trial (本番)',
    sub: { status: 'trial', current_period_end: future, trial_end: future },
    want: 'active',
  },
  {
    name: 'trialing alias',
    sub: { status: 'trialing', current_period_end: future },
    want: 'active',
  },
  {
    name: 'trial_end only',
    sub: { status: 'trial', trial_end: future },
    want: 'active',
  },
  {
    name: 'active paid',
    sub: { status: 'active', current_period_end: future },
    want: 'active',
  },
  {
    name: 'trial expired',
    sub: { status: 'trial', current_period_end: past },
    want: 'expired',
  },
  {
    name: 'canceled in period',
    sub: { status: 'canceled', current_period_end: future },
    want: 'active',
  },
]

let failed = 0
for (const c of cases) {
  const got = payjpEntitlementStatus(c.sub)
  const endIso = payjpPeriodEndIso(c.sub)
  const ok = got === c.want
  if (!ok) failed += 1
  console.log(`${ok ? 'OK' : 'FAIL'} ${c.name}: ${got} (period_end=${endIso})`)
}

if (!isPayjpTrialLikeStatus('trial') || !isPayjpTrialLikeStatus('trialing')) {
  console.error('FAIL isPayjpTrialLikeStatus')
  failed += 1
}

if (failed > 0) {
  console.error(`\n${failed} case(s) failed`)
  process.exit(1)
}
console.log('\nAll PAY.JP entitlement status checks passed.')
