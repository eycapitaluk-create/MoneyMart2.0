import assert from 'node:assert/strict'
import {runCrmQuery} from '../src/lib/crmQueryDeadline.js'
let signal
await assert.rejects(runCrmQuery(s=>{signal=s;return new Promise(()=>{})},{label:'Customer source',timeoutMs:10}),/Customer source timed out/)
assert.equal(signal.aborted,true)
assert.deepEqual(await runCrmQuery(()=>Promise.resolve({data:[1],error:null}),{timeoutMs:20}),{data:[1],error:null})
const error=new Error('source rejected')
await assert.rejects(runCrmQuery(()=>Promise.reject(error),{timeoutMs:20}),e=>e===error)
console.log('CRM deadlines passed: stalled reads abort, success stays success, source errors remain errors.')
