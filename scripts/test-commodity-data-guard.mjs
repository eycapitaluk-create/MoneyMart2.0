import assert from 'node:assert/strict'
import { latestUsableCommodityRows, omitUnverifiedSpreadsheetCommodities } from '../src/lib/commodityDataGuard.js'
const row = (name, date, pct, verified = true) => ({ commodity_name: name, trade_date: date, percentage_day: pct, raw: { validation_status: verified ? 'verified' : undefined } })
const rows = [row('silver', '2026-10-08', -0.04, false), row('silver', '2026-10-07', -2.1), row('gold', '2026-10-08', null), row('gold', '2026-10-07', 0), row('copper', '2026-08-21', 1.7, false)]
const latest = latestUsableCommodityRows(rows)
assert.equal(latest.get('silver').trade_date, '2026-10-07')
assert.equal(latest.get('silver').percentage_day, -2.1)
assert.equal(latest.get('gold').trade_date, '2026-10-07')
assert.equal(latest.get('gold').percentage_day, 0)
assert.equal(latest.get('copper').trade_date, '2026-08-21')
assert.equal(latestUsableCommodityRows([row('gold', '2026-10-08', NaN)]).size, 0)
assert.equal(latestUsableCommodityRows([row('silver', '2026-10-08', -1.44), ...rows]).get('silver').percentage_day, -1.44)
assert.deepEqual(omitUnverifiedSpreadsheetCommodities(['Gold','Silver','WTI','Brent','Risk-On/Off Score','USD/JPY','TOPIX'].map(item => ({item}))).map(x => x.item), ['USD/JPY','TOPIX'])
console.log('Commodity source protection and dated selection checks passed')
