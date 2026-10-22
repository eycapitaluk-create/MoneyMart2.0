import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { nasdaqRegularClose, fetchNasdaqRegularClose } from '../api/_lib/nasdaqRegularClose.js'
import { assessUnadjustedBar } from '../api/_lib/yahooUnadjustedBar.js'
import { decidePriceWrite, yahooSymbolForStorage } from '../api/_lib/yahooPricePlan.js'

const args = {symbol:'A',expectedDate:'2026-10-21',expectedPreviousDate:'2026-10-20',now:new Date('2026-10-22T00:00:00Z')}
const data = {data:{symbol:'A',marketStatus:'After-Hours',primaryData:{lastSalePrice:'$999',lastTradeTimestamp:'Oct 21, 2026 7:00 PM ET'},secondaryData:{lastSalePrice:'$177.73',lastTradeTimestamp:'Closed at Oct 21, 2026 4:00 PM ET'}}}
const valid = nasdaqRegularClose(data,args)
assert.equal(valid.close,177.73)
assert.equal(valid.volume,null)
assert.equal(decidePriceWrite({assessment:valid,dbPreviousClose:173.01}).action,'insert')
for (const bad of [
  {...data,data:{...data.data,secondaryData:null}},
  {...data,data:{...data.data,marketStatus:'Market Open'}},
  {...data,data:{...data.data,symbol:'OTHER'}},
  {...data,data:{...data.data,secondaryData:{...data.data.secondaryData,lastTradeTimestamp:'Closed at Oct 20, 2026 4:00 PM ET'}}},
  {...data,data:{...data.data,secondaryData:{...data.data.secondaryData,lastTradeTimestamp:'Closed at Oct 21, 2026 4:01 PM ET'}}},
]) assert.equal(nasdaqRegularClose(bad,args),null)
assert.equal(nasdaqRegularClose(data,{...args,now:new Date('2026-10-21T17:00:00Z')}),null)
let calls=0
assert.equal((await fetchNasdaqRegularClose({symbol:'A',yahoo:'A',expectedDate:args.expectedDate},{fetchImpl:async()=>{calls++;return {ok:false,status:403}}})).assessment,null)
assert.equal(calls,1)
const bar={date:'2026-10-21',open:100,high:102,low:99,close:101,volume:1}
const params={bars:[bar],events:{},timeZone:'Asia/Tokyo',expectedDate:args.expectedDate,expectedPreviousDate:args.expectedPreviousDate,requireOhlc:true}
const sparse=assessUnadjustedBar(params)
assert.equal(sparse.trade_date,'2026-10-21')
assert.equal(sparse.previous_close,null)
assert.equal(sparse.change_pct,null)
assert.equal(decidePriceWrite({assessment:{...sparse,verified_symbol_transition:{storage_symbol:'SATS',provider_symbol:'ECHO'}},dbPreviousClose:100}).action,'insert')
assert.equal(decidePriceWrite({assessment:sparse,dbPreviousClose:null}).action,'insert')
assert.equal(decidePriceWrite({assessment:{...sparse,regular_close_verified:true},dbPreviousClose:null,dbLatestClose:100,dbLatestDate:'2026-10-06'}).action,'insert')
assert.equal(decidePriceWrite({assessment:{...sparse,regular_close_verified:true,close:22},dbPreviousClose:null,dbLatestClose:100,dbLatestDate:'2026-10-06'}).reason,'missing_db_previous_session')
const splitTs=Date.parse('2026-10-20T16:00:00Z')/1000
const afterSplit=assessUnadjustedBar({
  bars:[
    {date:'2026-10-20',open:20,high:22,low:19,close:20,volume:100},
    {date:'2026-10-21',open:21,high:23,low:20,close:22,volume:100},
  ],
  events:{splits:{[splitTs]:{date:splitTs,numerator:2,denominator:1}}},
  timeZone:'America/New_York',
  expectedDate:'2026-10-21',
  expectedPreviousDate:'2026-10-20',
  requireOhlc:true,
})
assert.equal(afterSplit.status,'ok')
assert.equal(afterSplit.regular_close_verified,true)
assert.ok(afterSplit.split_dates.includes('2026-10-20'))
assert.equal(decidePriceWrite({assessment:afterSplit,dbPreviousClose:null,dbLatestClose:40,dbLatestDate:'2026-10-17'}).reason,'prior_split_unapplied')
assert.equal(decidePriceWrite({assessment:{...afterSplit,provider:'Nasdaq',ohlc_ok:false,open:null,high:null,low:null},dbPreviousClose:null,dbLatestClose:40,dbLatestDate:'2026-10-17'}).reason,'prior_split_unapplied')
assert.equal(decidePriceWrite({assessment:afterSplit,dbPreviousClose:null,dbLatestClose:21,dbLatestDate:'2026-10-20'}).action,'insert')
assert.equal(decidePriceWrite({assessment:afterSplit,dbPreviousClose:null,latestAnchorKnown:false}).reason,'missing_db_previous_session')
assert.equal(assessUnadjustedBar({...params,bars:[{...bar,open:101,high:101,low:101,volume:0}]}).status,'unverified_carried_price')
const ts=Date.parse('2026-10-21T00:00:00Z')/1000
assert.equal(assessUnadjustedBar({...params,events:{splits:{[ts]:{date:ts}}}}).status,'corporate_action_isolated')
assert.equal(assessUnadjustedBar({...params,events:{dividends:{[ts]:{date:ts,amount:1}}}}).status,'ok')
for(const [s,t] of Object.entries({EQR:'VMRK',PSKY:'SKYD',SATS:'ECHO','1553.T':'1553.N'})) assert.equal(yahooSymbolForStorage(s),t)

// Optional actual, already-reviewed source fixtures. No network / DB calls.
if(process.env.MONEYMART_CLOSE_FIXTURES){
 const dir=process.env.MONEYMART_CLOSE_FIXTURES
 const payload=JSON.parse(readFileSync(`${dir}/verified-payload.json`))
 const rows=Array.isArray(payload)?payload:payload.rows
 let checked=0
 for(const symbol of ['A','AIG','AJG','BDX','CAT','CRL','DECK','DHR','DVA','EPAM','EQR','EXR','FRT','GNRC','GPC','JPM','KIM','LOW','MHK','RMD','SHW','UDR','UNH','VWO','GPN','PSKY','SATS','TXT']){
  const raw=JSON.parse(readFileSync(`${dir}/nasdaq-${symbol}-info.json`))
  const a=nasdaqRegularClose(raw,{...args,symbol:yahooSymbolForStorage(symbol)})
  assert.ok(a,`regular close ${symbol}`)
  assert.equal(a.close,rows.find(r=>r.symbol===symbol).close)
  checked++
 }
 console.log(`Actual cached regular closes replayed: ${checked}`)
}
console.log('Automatic root fix: sparse sessions, cash distributions, splits, aliases, regular-close provenance and unsafe quote rejection passed')
