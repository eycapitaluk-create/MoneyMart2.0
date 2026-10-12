import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  classifyTrustFee,
  feesMatch,
  formatTrustFeePercent,
  inclusiveFromExclusive,
  isTrustFeeOk,
  planTrustFeeUpdate,
  PROSPECTUS_INCLUSIVE_TRUST_FEE,
  refreshCachedTrustFees,
} from '../src/lib/trustFee.js'

assert.equal(formatTrustFeePercent(0.03025), '0.03025%')
assert.equal(formatTrustFeePercent(0.03025).includes('0.0303'), false)
assert.equal(formatTrustFeePercent(0.03025).includes('0.030250'), false)
assert.equal(formatTrustFeePercent(0.0495), '0.0495%')
assert.equal(formatTrustFeePercent(0.0506), '0.0506%')
assert.equal(formatTrustFeePercent(0.045), '0.045%')
assert.equal(formatTrustFeePercent(0.0748), '0.0748%')
assert.equal(formatTrustFeePercent(0.935), '0.935%')
assert.equal(formatTrustFeePercent(0), '0.000%')
assert.equal(formatTrustFeePercent(null), '-')
assert.equal(formatTrustFeePercent(''), '-')
assert.equal(formatTrustFeePercent('0.0495'), '0.0495%')
assert.equal(formatTrustFeePercent(0.0495).includes('0.050'), false)

assert.equal(feesMatch(0.045, 0.0495), false)
assert.equal(feesMatch(inclusiveFromExclusive(0.045), 0.0495), true)
assert.equal(feesMatch(inclusiveFromExclusive(0.046), 0.0506), true)

const dotsPreTax = classifyTrustFee({ symbol: '1369.T', stored: 0.045, exclusive: 0.045, within: true })
assert.equal(dotsPreTax, 'tax_mismatch_pre_tax')
assert.equal(isTrustFeeOk(dotsPreTax), false)
assert.equal(classifyTrustFee({ symbol: '1473.T', stored: 0.045, exclusive: 0.045 }), 'tax_mismatch_pre_tax')

const dotsInclusive = classifyTrustFee({ symbol: '1369.T', stored: 0.0495, exclusive: 0.045, within: true })
assert.equal(dotsInclusive, 'ok_prospectus')
assert.equal(isTrustFeeOk(dotsInclusive), true)
assert.equal(classifyTrustFee({ symbol: '1473.T', stored: 0.0495, exclusive: 0.045 }), 'ok_prospectus')

const roundedAway = classifyTrustFee({ symbol: '1369.T', stored: 0.05, exclusive: 0.045 })
assert.equal(roundedAway, 'mismatch')
assert.equal(isTrustFeeOk(roundedAway), false)

const lowFeeInclusive = classifyTrustFee({ symbol: '9999.T', stored: 0.0506, exclusive: 0.046 })
assert.equal(lowFeeInclusive, 'ok_inc_tax')
const lowFeePreTax = classifyTrustFee({ symbol: '9999.T', stored: 0.046, exclusive: 0.046, within: true })
assert.equal(lowFeePreTax, 'tax_mismatch_pre_tax')
const underCap = classifyTrustFee({ symbol: '9999.T', stored: 0.04, exclusive: 0.045, within: true })
assert.equal(underCap, 'review_needed')
assert.equal(isTrustFeeOk(underCap), false)
assert.equal(underCap === 'tax_mismatch_pre_tax', false)

const alreadyInclusive = classifyTrustFee({ symbol: '9999.T', stored: 0.0495, exclusive: 0.045, within: true })
assert.equal(alreadyInclusive, 'ok_inc_tax')

const dotsPlan = planTrustFeeUpdate({ symbol: '1369.T', stored: 0.045, exclusive: 0.045 })
assert.equal(dotsPlan.target, 0.0495)
assert.equal(dotsPlan.verified, true)
assert.equal(dotsPlan.writable, true)
const dotsKept = planTrustFeeUpdate({ symbol: '1473.T', stored: 0.0495, exclusive: 0.045 })
assert.equal(dotsKept.writable, false)
for (const symbol of ['1475.T', '1329.T', '1364.T']) {
  const plan = planTrustFeeUpdate({ symbol, stored: 0.045, exclusive: 0.045 })
  assert.equal(plan.target, 0.0495)
  assert.equal(plan.verified, true)
  assert.equal(plan.writable, true)
  assert.equal(classifyTrustFee({ symbol, stored: 0.0495, exclusive: 0.045 }), 'ok_prospectus')
}
for (const symbol of ['449A.T', '450A.T']) {
  const plan = planTrustFeeUpdate({ symbol, stored: 0.0275, exclusive: 0.0275 })
  assert.equal(plan.target, 0.03025)
  assert.equal(plan.writable, true)
  assert.equal(formatTrustFeePercent(plan.target), '0.03025%')
  assert.equal(classifyTrustFee({ symbol, stored: 0.0275, exclusive: 0.0275 }), 'tax_mismatch_pre_tax')
  assert.equal(classifyTrustFee({ symbol, stored: 0.03025, exclusive: 0.0275 }), 'ok_prospectus')
}
const capLow = classifyTrustFee({ symbol: '1308.T', stored: 0.06, exclusive: 0.068, within: true })
assert.equal(capLow, 'review_needed')
assert.equal(isTrustFeeOk(capLow), false)
const capPreTax = classifyTrustFee({ symbol: '1308.T', stored: 0.068, exclusive: 0.068 })
assert.equal(capPreTax, 'tax_mismatch_pre_tax')
const capPlan = planTrustFeeUpdate({ symbol: '1308.T', stored: 0.06, exclusive: 0.068 })
assert.equal(capPlan.target, 0.0748)
assert.equal(capPlan.writable, true)
assert.equal(planTrustFeeUpdate({ symbol: '1308.T', stored: 0.0748, exclusive: 0.068 }).writable, false)
assert.equal(planTrustFeeUpdate({ symbol: '2558.T', stored: 0.077, exclusive: 0.07 }).verified, false)
assert.deepEqual(Object.keys(PROSPECTUS_INCLUSIVE_TRUST_FEE).sort(), [
  '1308.T', '1329.T', '1364.T', '1369.T', '1473.T', '1475.T', '449A.T', '450A.T',
])

const unverified = planTrustFeeUpdate({ symbol: '1306.T', stored: 0.045, exclusive: 0.045 })
assert.equal(unverified.verified, false)
assert.equal(unverified.writable, false)
assert.equal(unverified.target, inclusiveFromExclusive(0.045))

const page = readFileSync(new URL('../src/pages/FundPage.jsx', import.meta.url), 'utf8')
const apply = readFileSync(new URL('./apply-etf-trust-fee-from-jpx-audit.mjs', import.meta.url), 'utf8')
const audit = readFileSync(new URL('./audit-etf-trust-fee-vs-jpx.mjs', import.meta.url), 'utf8')
const tools = readFileSync(new URL('../src/pages/ToolsHubPage.jsx', import.meta.url), 'utf8')
assert.equal(page.includes('税抜目安×1.1'), false)
assert.equal(page.includes('交付目論見書で税込を確認した銘柄だけ'), false)
assert.ok(page.includes('信託報酬は保存済みの税込年率の参考値です'))
assert.ok(page.includes('低コスト順位は保存済み参考値を比較したもので、日々の実効料率や総経費率の順位ではありません'))
assert.ok(audit.includes("r.status === 'mismatch' || r.status === 'tax_mismatch_pre_tax'"))
assert.equal(audit.includes('tax_mismatch_within_cap'), false)
assert.equal(apply.includes('const TOL'), false)
assert.equal(apply.includes('toFixed(3)'), false)
assert.ok(apply.includes('--write-verified-prospectus'))
assert.ok(apply.includes('report_only'))
assert.equal(audit.includes('ok_ex_tax'), false)
assert.equal(audit.includes('ok_within_cap_ex'), false)
assert.equal(audit.includes('const TOL'), false)
assert.equal(tools.includes('toFixed(3)%'), false)

const cached = [
  { id: '1369.T', fundCode: '1369.T', trustFee: 0.045, basePrice: 100, returnRate1Y: 5, aumValue: 10 },
  { id: '1473.T', fundCode: '1473.T', trustFee: 0.045, basePrice: 200, returnRate1Y: 1, aumValue: 11 },
  { id: '1475.T', fundCode: '1475.T', trustFee: 0.045, basePrice: 300, returnRate1Y: 2, aumValue: 12 },
  { id: '1308.T', fundCode: '1308.T', trustFee: 0.046, basePrice: 400, returnRate1Y: 3, aumValue: 13 },
  { id: '449A.T', fundCode: '449A.T', trustFee: 0.03, basePrice: 500, returnRate1Y: 4, aumValue: 14 },
  { id: '9999.T', fundCode: '9999.T', trustFee: 0.1, basePrice: 9, returnRate1Y: 8, aumValue: 15 },
]
const freshRows = [
  { symbol: '1369.T', trust_fee: 0.0495, aum: 999 },
  { symbol: '1473.T', trust_fee: 0.0495 },
  { symbol: '1475.T', trust_fee: 0.0495 },
  { symbol: '1308.T', trust_fee: 0.0748 },
  { symbol: '449A.T', trust_fee: 0.03025 },
  { symbol: '450A.T', trust_fee: null },
]
const refreshed = refreshCachedTrustFees(cached, freshRows)
const byId = Object.fromEntries(refreshed.map((row) => [row.id, row]))
assert.equal(byId['1369.T'].trustFee, 0.0495)
assert.equal(byId['1369.T'].basePrice, 100)
assert.equal(byId['1369.T'].returnRate1Y, 5)
assert.equal(byId['1369.T'].aumValue, 10)
assert.equal(byId['1473.T'].trustFee, 0.0495)
assert.equal(byId['1475.T'].trustFee, 0.0495)
assert.equal(byId['1308.T'].trustFee, 0.0748)
assert.equal(byId['1308.T'].basePrice, 400)
assert.equal(byId['449A.T'].trustFee, 0.03025)
assert.equal(formatTrustFeePercent(byId['449A.T'].trustFee), '0.03025%')
assert.equal(byId['9999.T'].trustFee, 0.1)
assert.equal(byId['9999.T'].basePrice, 9)
const nulled = refreshCachedTrustFees(
  [{ id: '450A.T', trustFee: 0.03, basePrice: 7, returnRate1Y: 1 }],
  [{ symbol: '450A.T', trust_fee: null }],
)
assert.equal(nulled[0].trustFee, null)
assert.equal(nulled[0].basePrice, 7)
assert.equal(nulled[0].returnRate1Y, 1)
const kept = refreshCachedTrustFees(
  [{ id: '1369.T', trustFee: 0.045, basePrice: 100 }],
  [],
)
assert.equal(kept[0].trustFee, 0.045)
assert.equal(kept[0].basePrice, 100)
assert.equal(refreshCachedTrustFees([{ id: '1369.T', trustFee: 0.045 }], [{ symbol: '1369.T', trust_fee: 0.045 }])[0].trustFee, 0.045)

const fundPage = readFileSync(new URL('../src/pages/FundPage.jsx', import.meta.url), 'utf8')
const refreshCall = fundPage.indexOf('refreshCachedTrustFees(')
const historyCall = fundPage.indexOf('await fetchStockDailyHistoryBySymbolMap')
assert.ok(refreshCall > 0)
assert.ok(historyCall > refreshCall)
assert.ok(fundPage.includes('let feesRefreshed = false'))
assert.ok(fundPage.includes('!feesRefreshed'))

console.log('trust fee tax checks passed')
