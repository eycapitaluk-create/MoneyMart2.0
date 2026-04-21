import { createClient } from '@supabase/supabase-js'

/** Local / CI only: set env vars — never commit real keys. */
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GEMINI_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-3-5-haiku-20241022'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!GEMINI_KEY && !CLAUDE_KEY) {
  console.error('Set GEMINI_API_KEY and/or ANTHROPIC_API_KEY')
  process.exit(1)
}

const TOP_SYMBOLS = {
  US: ['AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','TSM','NFLX','JPM','V','MA','AVGO','WMT','JNJ','XOM','PG','BAC','COST','HD'],
  JP: ['7203.T','8306.T','8035.T','6758.T','9984.T','6857.T','7974.T','4568.T','9432.T','7267.T','7751.T','8411.T','6954.T','9433.T','4063.T','6367.T','7011.T','6902.T','4519.T','6501.T'],
}
const COMPANY_NAMES = {
  AAPL:'アップル',MSFT:'マイクロソフト',NVDA:'エヌビディア',GOOGL:'アルファベット',
  AMZN:'アマゾン',META:'メタ・プラットフォームズ',TSLA:'テスラ',TSM:'TSMC',
  NFLX:'ネットフリックス',JPM:'JPモルガン・チェース',V:'ビザ',MA:'マスターカード',
  AVGO:'ブロードコム',WMT:'ウォルマート',JNJ:'ジョンソン＆ジョンソン',
  XOM:'エクソンモービル',PG:'P&G',BAC:'バンク・オブ・アメリカ',COST:'コストコ',HD:'ホーム・デポ',
  '7203.T':'トヨタ自動車','8306.T':'三菱UFJフィナンシャル・グループ',
  '8035.T':'東京エレクトロン','6758.T':'ソニーグループ','9984.T':'ソフトバンク',
  '6857.T':'アドバンテスト','7974.T':'任天堂','4568.T':'第一三共','9432.T':'NTT',
  '7267.T':'ホンダ','7751.T':'キヤノン','8411.T':'みずほフィナンシャルグループ',
  '6954.T':'ファナック','9433.T':'KDDI','4063.T':'信越化学工業',
  '6367.T':'ダイキン工業','7011.T':'三菱重工業','6902.T':'デンソー',
  '4519.T':'中外製薬','6501.T':'日立製作所',
}

function jstDateSlug() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const y = parts.find(p=>p.type==='year')?.value, m = parts.find(p=>p.type==='month')?.value, d = parts.find(p=>p.type==='day')?.value
  return y&&m&&d ? `${y}-${m}-${d}` : new Date().toISOString().slice(0,10)
}

function extractJsonObject(text='') {
  const cleaned = String(text).replace(/```json|```/gi,'').trim()
  try { const v=JSON.parse(cleaned); if(v&&typeof v==='object'&&!Array.isArray(v)) return v } catch {}
  const s=cleaned.indexOf('{'), e=cleaned.lastIndexOf('}')
  if(s>=0&&e>s) { try { const v=JSON.parse(cleaned.slice(s,e+1)); if(v&&typeof v==='object'&&!Array.isArray(v)) return v } catch {} }
  return null
}

function calcAnnualizedVolatility(rows) {
  if(rows.length<2) return null
  const returns=[]
  for(let i=1;i<rows.length;i++) {
    const prev=Number(rows[i-1]?.close), cur=Number(rows[i]?.close)
    if(!prev||!cur||prev<=0) continue
    returns.push(Math.log(cur/prev))
  }
  if(returns.length<2) return null
  const mean=returns.reduce((a,b)=>a+b,0)/returns.length
  const variance=returns.reduce((a,b)=>a+(b-mean)**2,0)/returns.length
  return Math.sqrt(variance)*Math.sqrt(252)*100
}

function calcMaxWeeklyDrop(rows) {
  if(rows.length<2) return null
  let maxDrop=0
  for(let i=1;i<rows.length;i++) {
    const prev=Number(rows[i-1]?.close), cur=Number(rows[i]?.close)
    if(!prev||!cur||prev<=0) continue
    const drop=(cur-prev)/prev*100
    if(drop<maxDrop) maxDrop=drop
  }
  return maxDrop
}

function fmt(n,d=2) { return n==null||!Number.isFinite(n)?'N/A':n.toFixed(d) }
function fmtVol(v) {
  if(v==null||!Number.isFinite(v)) return 'N/A'
  if(v>=1e9) return `${(v/1e9).toFixed(1)}B`
  if(v>=1e6) return `${(v/1e6).toFixed(1)}M`
  if(v>=1e3) return `${(v/1e3).toFixed(0)}K`
  return String(Math.round(v))
}

function buildPrompt(symbol, company, region, dateSlug, rows) {
  const latest=rows[0], prev=rows[1]
  const open=Number(latest?.open), high=Number(latest?.high), low=Number(latest?.low), close=Number(latest?.close)
  const volume=Number(latest?.volume), prevClose=Number(prev?.close)
  const dayChange=prevClose>0?((close-prevClose)/prevClose*100):null
  const currency=region==='JP'?'円':'USD'
  const recentTable=rows.slice(0,5).map((r,i)=>{
    const pClose=rows[i+1]?.close
    const chg=(pClose&&pClose>0)?((Number(r.close)-Number(pClose))/Number(pClose)*100):null
    return `  ${r.trade_date}: 終値${fmt(Number(r.close))}${currency}（前日比${chg!=null?(chg>=0?'+':'')+fmt(chg):'N/A'}%）`
  }).join('\n')
  const volatility=calcAnnualizedVolatility(rows)
  const maxDrop=calcMaxWeeklyDrop(rows.slice(0,5))
  return `あなたは日本の個人投資家向け金融メディアのアナリストです。以下の株価データをもとに、Trading 212 スタイルのAI分析を日本語で生成してください。

銘柄: ${symbol}（${company}）
地域: ${region==='JP'?'日本':'米国'}
分析基準日: ${dateSlug}

【最新セッション（${latest?.trade_date}）】
始値: ${fmt(open)}${currency} / 高値: ${fmt(high)}${currency} / 安値: ${fmt(low)}${currency} / 終値: ${fmt(close)}${currency}
前日比: ${dayChange!=null?(dayChange>=0?'+':'')+fmt(dayChange):'N/A'}% / 出来高: ${fmtVol(volume)}

【直近5営業日終値推移】
${recentTable}

【テクニカル】
20日ボラティリティ（年率）: ${volatility!=null?fmt(volatility):'N/A'}% / 直近5日最大1日下落: ${maxDrop!=null?fmt(maxDrop):'N/A'}%

以下JSON形式のみで返してください（説明・Markdown不要）:
{"last_session":["3〜4文の箇条書き"],"weekly_trends":["3〜4文"],"fundamentals":["2〜3文"],"summary":["2〜3文"]}
全て日本語。断定的な売買推奨は禁止。`
}

async function callGemini(prompt) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not set')
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`
  const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.3,maxOutputTokens:2048}})})
  const data=await res.json().catch(()=>({}))
  if(!res.ok) throw new Error(data?.error?.message||`Gemini ${res.status}`)
  const parts=data?.candidates?.[0]?.content?.parts||[]
  const text=parts.map(p=>String(p?.text||'')).join('')
  if(!text.trim()) throw new Error('Gemini empty response')
  return extractJsonObject(text)
}

async function callClaude(prompt) {
  if (!CLAUDE_KEY) throw new Error('ANTHROPIC_API_KEY not set')
  const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':CLAUDE_KEY,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:CLAUDE_MODEL,max_tokens:2048,temperature:0.3,messages:[{role:'user',content:prompt}]})})
  const data=await res.json().catch(()=>({}))
  if(!res.ok) throw new Error(data?.error?.message||`Claude ${res.status}`)
  const text=Array.isArray(data?.content)?data.content.map(r=>String(r?.text||'')).join('\n'):''
  return extractJsonObject(text)
}

function normalize(obj) {
  const toArr=v=>Array.isArray(v)?v.map(s=>String(s||'').trim()).filter(s=>s.length>0):[]
  return { last_session:toArr(obj?.last_session), weekly_trends:toArr(obj?.weekly_trends), fundamentals:toArr(obj?.fundamentals), summary:toArr(obj?.summary) }
}

// ── MAIN ──
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const dateSlug = jstDateSlug()
console.log('Date slug:', dateSlug)

const allSymbols = [...TOP_SYMBOLS.US.map(s=>({sym:s,region:'US'})), ...TOP_SYMBOLS.JP.map(s=>({sym:s,region:'JP'}))]
const symbolList = allSymbols.map(s=>s.sym)

console.log(`Fetching OHLCV for ${symbolList.length} symbols...`)
const { data: priceRows, error: priceError } = await admin
  .from('stock_daily_prices')
  .select('symbol, trade_date, open, high, low, close, volume')
  .in('symbol', symbolList)
  .order('trade_date', { ascending: false })
  .limit(symbolList.length * 25)

if(priceError) { console.error('Price fetch error:', priceError.message); process.exit(1) }
console.log(`Got ${priceRows?.length||0} price rows`)

const bySymbol = new Map()
for(const row of (priceRows||[])) {
  const sym=String(row.symbol||'').trim()
  if(!bySymbol.has(sym)) bySymbol.set(sym,[])
  bySymbol.get(sym).push(row)
}
for(const [sym,rows] of bySymbol) {
  rows.sort((a,b)=>b.trade_date.localeCompare(a.trade_date))
  bySymbol.set(sym, rows.slice(0,22))
}

// Check coverage
const withData = allSymbols.filter(({sym})=>(bySymbol.get(sym)||[]).length>=2)
const noData = allSymbols.filter(({sym})=>(bySymbol.get(sym)||[]).length<2).map(s=>s.sym)
console.log(`Symbols with data: ${withData.length} / ${allSymbols.length}`)
if(noData.length>0) console.log('No data:', noData.join(', '))

const results=[], errors=[]
const BATCH=3
for(let i=0;i<withData.length;i+=BATCH) {
  const batch=withData.slice(i,i+BATCH)
  await Promise.all(batch.map(async({sym,region})=>{
    const rows=bySymbol.get(sym)||[]
    const company=COMPANY_NAMES[sym]||sym
    const prompt=buildPrompt(sym,company,region,dateSlug,rows)
    let analysis=null, provider=''
    try { const raw=await callGemini(prompt); if(raw){analysis=normalize(raw);provider='gemini'} } catch(e){errors.push(`${sym} gemini: ${e.message}`)}
    if(!analysis) { try { const raw=await callClaude(prompt); if(raw){analysis=normalize(raw);provider='claude'} } catch(e){errors.push(`${sym} claude: ${e.message}`)} }
    if(!analysis) { errors.push(`${sym}: all AI failed`); return }
    const {error:upsertErr}=await admin.from('stock_ai_analysis').upsert({symbol:sym,region,company,date_slug:dateSlug,last_session:analysis.last_session,weekly_trends:analysis.weekly_trends,fundamentals:analysis.fundamentals,summary:analysis.summary,provider,generated_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'symbol'})
    if(upsertErr){errors.push(`${sym} upsert: ${upsertErr.message}`)}
    else{results.push({symbol:sym,region,provider});process.stdout.write(`✓ ${sym}(${provider}) `)}
  }))
  console.log(`  [${Math.min(i+BATCH,withData.length)}/${withData.length}]`)
}

console.log('\n\n=== RESULT ===')
console.log(`Generated: ${results.length}`)
console.log(`Errors: ${errors.length}`)
if(errors.length>0) console.log('Errors:', errors.slice(0,10))
