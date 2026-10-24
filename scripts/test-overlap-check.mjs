// 重なりチェック: iOS OverlapCheckTests と同じ期待値 (node scripts/test-overlap-check.mjs)
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import catalog from '../src/data/overlapCheckCatalog.js'
import { overlapLines, overlapHeadline, fundById, searchFunds, shareUrl, parseFundIds, canonicalIndex, OVERLAP_FUNDS, POPULAR_PAIRS } from '../src/lib/overlapCheck.js'

const iosJson = '/Users/justinnam/Desktop/MoneyMart iOS/moneymart/docs/overlap_check_catalog.json'
if (existsSync(iosJson)) {
  const src = JSON.parse(readFileSync(iosJson, 'utf8'))
  assert.deepEqual(catalog.funds, src.funds, 'Web カタログが iOS の docs/overlap_check_catalog.json と一致しない')
}
for (const f of OVERLAP_FUNDS) assert.equal(canonicalIndex(f.index), f.index, f.id)
const f = (id) => fundById(id)

let l = overlapLines([f('emaxis-slim-acwi'), f('emaxis-slim-sp500')])
assert.equal(l.length, 1)
assert.equal(l[0].title, '「スリム S&P500」の銘柄は、多くが「オルカン」にも含まれます')
assert.equal(overlapHeadline([f('emaxis-slim-acwi'), f('emaxis-slim-sp500')]), '重なりが 1 か所 見つかりました')

l = overlapLines([f('emaxis-slim-sp500'), f('sbi-v-sp500'), f('voo')])
assert.equal(l.length, 1)
assert.ok(l[0].title.includes('同じ指数に連動') && l[0].detail.includes('S&P 500'))

assert.ok(overlapLines([f('emaxis-slim-kokusai'), f('emaxis-slim-acwi-exjp')])[0].title.includes('すべて'))
assert.ok(overlapLines([f('emaxis-slim-em'), f('emaxis-slim-acwi')])[0].title.includes('すべて'))
assert.equal(overlapLines([f('emaxis-slim-topix'), f('emaxis-slim-sp500')]).length, 0)
assert.equal(overlapHeadline([f('emaxis-slim-topix'), f('emaxis-slim-sp500')]), '連動指数の重なりは見つかりませんでした')
assert.equal(overlapHeadline([f('emaxis-slim-topix')]), '2本以上選ぶと、重なりを確認できます')

assert.ok(searchFunds('ｓ＆ｐ５００').map((x) => x.id).includes('emaxis-slim-sp500'))
assert.deepEqual(searchFunds('voo').map((x) => x.id), ['voo'])
assert.ok(searchFunds('オルカン').map((x) => x.id).includes('emaxis-slim-acwi'))
assert.equal(shareUrl([f('emaxis-slim-acwi'), f('voo')]), 'https://www.moneymart.co.jp/check?f=emaxis-slim-acwi,voo')
assert.deepEqual(parseFundIds('emaxis-slim-acwi-vs-emaxis-slim-sp500').map((x) => x.id), ['emaxis-slim-acwi', 'emaxis-slim-sp500'])
assert.deepEqual(parseFundIds('voo,unknown,voo,<script>').map((x) => x.id), ['voo'])
for (const [a, b] of POPULAR_PAIRS) assert.ok(fundById(a) && fundById(b), `${a} ${b}`)
console.log('overlap check: all assertions passed')
