export const DEMO_DAY = '2026-09-19'
export const classNames = { equity:'株式', bond:'債券', cash:'現金', other:'その他' }
export const targetFor = p => p === 'conservative' ? {equity:20,bond:60,cash:15,other:5} : p === 'aggressive' ? {equity:75,bond:15,cash:5,other:5} : {equity:50,bond:35,cash:10,other:5}
export const assetClass = h => h.sector === '現金' ? 'cash' : h.sector === '債券' ? 'bond' : h.sector === 'その他' ? 'other' : 'equity'
export function exposure(c) {
  const total=c.holdings.reduce((s,h)=>s+h.value,0)
  const grouped=Object.values(c.holdings.reduce((r,h)=>{r[h.symbol] = {...h,value:(r[h.symbol]?.value||0)+h.value};return r},{})).sort((a,b)=>b.value-a.value)
  const a={equity:0,bond:0,cash:0,other:0}, sectors={}, regions={日本:0,米国:0,グローバル:0,現金:0}
  grouped.forEach(h=>{const w=total?h.value/total*100:0;a[assetClass(h)]+=w;sectors[h.sector]=(sectors[h.sector]||0)+w;const region=assetClass(h)==='cash'?'現金':h.symbol==='2559.T'?'グローバル':h.symbol==='1655.T'||h.symbol==='1482.T'||!h.symbol.endsWith('.T')?'米国':'日本';regions[region]+=w})
  const target=targetFor(c.profile),drift=Object.keys(a).reduce((s,k)=>s+Math.abs(a[k]-target[k]),0)/2
  const invested=grouped.filter(h=>assetClass(h)!=='cash'), maxHolding=total?(invested[0]?.value||0)/total*100:0
  const top3=total?invested.slice(0,3).reduce((s,h)=>s+h.value,0)/total*100:0
  return {total,grouped,a,target,drift,maxHolding,top3,sectors,regions}
}
export function enrichClient(c) {
  const e=exposure(c), sectorMax=Math.max(0,...Object.entries(e.sectors).filter(([k])=>k!=='現金').map(([,v])=>v))
  return {...c,aum:e.total,priority:priority(c,e),holdings:e.grouped,allocation:{...Object.fromEntries(Object.entries(e.a).map(([k,v])=>[k,Math.round(v*10)/10])),total:e.total},drift:Math.floor(e.drift),concentration:{maxHolding:Math.round(e.maxHolding),maxSector:Math.round(sectorMax),severity:e.maxHolding>=20||sectorMax>=40?'high':e.maxHolding>=12||sectorMax>=30?'medium':'low'}}
}
export function normalizeData(seed) {
 const clients=seed.clients.map((c,i)=>{
  const sum=c.holdings.reduce((s,h)=>s+h.value,0);let assigned=0
  const holdings=c.holdings.map((h,j)=>{const value=j===c.holdings.length-1?c.aum-assigned:Math.round(h.value/sum*c.aum);assigned+=value;return {...h,value}})
  return enrichClient({...c,holdings,goal:['退職後の生活資金','教育資金と資産形成','事業承継と資産保全','長期成長と住宅資金'][i%4],annualSpend:2400000+(i%8)*600000})
 })
 const meetings=seed.meetings.map((m,i)=>({...m,date:`2026-09-${String(14+Math.floor(i/8)).padStart(2,'0')}`,time:`${String(9+(i%8)).padStart(2,'0')}:00`,duration:45,advisorId:clients.find(c=>c.id===m.clientId)?.advisorId,channel:i%3===0?'オンライン':'対面',status:i<40?'完了':m.status,completed:i<40,notes:m.notes||'',agenda:m.agenda||[],checked:[],tasks:[]}))
 return {...seed,clients,meetings}
}
export function proposals(c) {
 const e=exposure(c),main=e.grouped.find(h=>assetClass(h)!=='cash'),spend=c.annualSpend||3600000
 return [
 {id:'allocation',title:e.drift>=10?'目標配分との乖離を確認':'目標配分を維持する方針を確認',tag:'配分・適合性',why:`${c.profile==='conservative'?'安定型':c.profile==='aggressive'?'積極型':'バランス型'}の目標と現在配分の乖離は${e.drift.toFixed(1)}pt。株式は${e.a.equity.toFixed(1)}%、目標は${e.target.equity}%。`,action:'目標への接近率を変更し、資産クラスごとの移動額を面談で比較します。',question:'この配分で、下落時も保有を続けられますか？',limit:'税金・手数料・商品別の売買制約は試算に含みません。',evidence:`保有${e.grouped.length}資産とリスク許容度`,priority:e.drift>=20?'優先':'定期'},
 {id:'concentration',title:e.maxHolding>20?'集中保有の理由と分散余地を整理':'集中度の維持方針を記録',tag:'集中・分散',why:`${main?.name||'投資資産なし'}の構成比${e.maxHolding.toFixed(1)}%。投資資産上位3銘柄は全体の${e.top3.toFixed(1)}%。`,action:'最大保有資産の投資理由、売却制約、段階的な見直し候補を確認します。',question:'この銘柄を多く保有する理由や売却できない事情はありますか？',limit:'ファンド内部の重複保有は未集計。銘柄数だけでは分散を評価できません。',evidence:main?`${main.symbol} / 評価額 ¥${main.value.toLocaleString()}`:'保有明細',priority:e.maxHolding>20?'優先':'確認'},
 {id:'liquidity',title:'生活資金と運用資金の境界を確認',tag:'資金需要',why:`現金${e.a.cash.toFixed(1)}%。年間支出のデモ設定は¥${spend.toLocaleString()}、現金で約${(e.total*e.a.cash/100/spend*12).toFixed(1)}か月分。`,action:'12か月以内の教育費・住宅費・生活費を確認し、投資対象外の現金を合意します。',question:'今後1年以内に大きな支出や収入の変化はありますか？',limit:'年間支出はデモ設定です。面談で実額を確認してください。',evidence:'現金保有明細・顧客目標',priority:e.total*e.a.cash/100<spend?'優先':'確認'},
 {id:'review',title:'投資目的・リスク許容度の更新',tag:'面談準備',why:`目的：${c.goal||'長期資産形成'}。前回面談から${c.monthsSinceReview}か月、レビュー期限${c.reviewDays<0?`${-c.reviewDays}日超過`:`まで${c.reviewDays}日`}。`,action:'家族構成、運用期間、許容損失、NISA利用状況を確認し、変更点を記録します。',question:'前回のご相談から、生活や投資への考え方に変化はありますか？',limit:'投資目的の変更は顧客同意後にプロフィールへ反映します。',evidence:'顧客プロフィール・面談履歴',priority:c.reviewDays<0?'優先':'定期'}
 ]
}
export function allocationPlan(c,ratio) {
 const e=exposure(c),after=Object.fromEntries(Object.keys(e.a).map(k=>[k,e.a[k]+(e.target[k]-e.a[k])*ratio/100]))
 return {before:e.a,after,driftBefore:e.drift,driftAfter:Object.keys(after).reduce((s,k)=>s+Math.abs(after[k]-e.target[k]),0)/2,amounts:Object.fromEntries(Object.keys(after).map(k=>[k,Math.round((after[k]-e.a[k])*e.total/100)]))}
}
export function dayPlus(iso,days) {const d=new Date(`${iso}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}

function priority(c,e){
 const parts=[];if(c.reviewDays<0)parts.push(['年次レビュー超過',30]);else if(c.reviewDays<30)parts.push(['レビュー期日近接',15]);
 if(e.drift>=20)parts.push(['リスクドリフト大',20]);else if(e.drift>=10)parts.push(['リスクドリフト中',12]);
 const sec=Math.max(0,...Object.entries(e.sectors).filter(([k])=>k!=='現金').map(([,v])=>v));if(e.maxHolding>=20||sec>=40)parts.push(['集中リスク検出',20]);else if(e.maxHolding>=12||sec>=30)parts.push(['集中傾向あり',12]);
 if(e.a.cash>=25)parts.push(['現金比率が高い',10]);if(c.monthsSinceReview>=10)parts.push(['10ヶ月以上面談なし',18]);else if(c.monthsSinceReview>=6)parts.push(['6ヶ月以上面談なし',10]);
 if(e.total>=100000000)parts.push(['上位資産サイズ顧客',8]);if(c.returnPct<=-10)parts.push(['大幅マイナス',25]);else if(c.returnPct<=-5)parts.push(['マイナス継続',15]);else if(c.returnPct<=-2)parts.push(['軽微マイナス',5]);return {parts,total:Math.min(100,parts.reduce((s,p)=>s+p[1],0))}
}
