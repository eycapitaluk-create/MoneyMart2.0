import assert from 'node:assert/strict'
import { fetchNasdaqRegularClose } from '../api/_lib/nasdaqRegularClose.js'
// Verify routing plus dated close parsing together, without live provider calls.
for (const [symbol, assetClass] of [['CPER','etf'],['IDU','etf'],['IYF','etf'],['VWO','etf'],['AAPL','stocks'],['BLK','stocks'],['IVZ','stocks']]) {
 let calls = 0
 const result = await fetchNasdaqRegularClose({symbol,yahoo:symbol,expectedDate:'2026-10-22'}, {
  now:new Date('2026-10-23T00:00:00Z'),
  fetchImpl:async url => {
   calls++
   assert.equal(new URL(url).searchParams.get('assetclass'),assetClass)
   return {ok:true,status:200,json:async()=>({data:{symbol,marketStatus:'After-Hours',primaryData:{lastSalePrice:'$999',lastTradeTimestamp:'Oct 22, 2026 7:00 PM ET'},secondaryData:{lastSalePrice:'$38.52',lastTradeTimestamp:'Closed at Oct 22, 2026 4:00 PM ET'}}})}
  }
 })
 assert.equal(calls,1)
 assert.equal(result.assessment.close,38.52)
 assert.equal(result.assessment.close_evidence.extended_hours_price_used,false)
 assert.equal(result.assessment.open,null)
 assert.equal(result.assessment.volume,null)
}
console.log('Nasdaq ETF catalog routing and regular-close parsing passed; single request, no extended-hours substitution')
