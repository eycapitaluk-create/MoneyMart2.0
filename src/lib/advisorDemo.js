const JP_NAMES = ['佐藤','鈴木','高橋','田中','伊藤','渡辺','山本','中村','小林','加藤','吉田','山田','佐々木','山口','松本','井上','木村','林','斎藤','清水']
const GIVEN = ['健太','美咲','翔太','陽子','大輔','結衣','直樹','恵','拓也','由美']
const SYMBOLS = [
  ['1321.T','NEXT FUNDS 日経225連動型上場投信','fund','日本株'],['1655.T','iシェアーズ S&P 500 米国株 ETF','fund','米国株'],
  ['2559.T','MAXIS 全世界株式上場投信','fund','グローバル株'],['BKR','ベーカー・ヒューズ','stock','エネルギー'],
  ['AAPL','Apple','stock','テクノロジー'],['MSFT','Microsoft','stock','テクノロジー'],['NVDA','NVIDIA','stock','テクノロジー'],
  ['7203.T','トヨタ自動車','stock','自動車'],['8306.T','三菱UFJフィナンシャル・グループ','stock','金融'],
  ['1482.T','iシェアーズ・コア 米国債7-10年 ETF','fund','債券'],['2510.T','NEXT FUNDS 国内債券 ETF','fund','債券'],
  ['CASH_RESERVE','現金・待機資金','fund','現金']
]
const ADVISORS = [
  {id:'a1',name:'山田 智也',role:'チームリーダー',clients:28},{id:'a2',name:'佐々木 彩',role:'シニアアドバイザー',clients:25},
  {id:'a3',name:'中村 健',role:'アドバイザー',clients:24},{id:'a4',name:'高橋 美穂',role:'アドバイザー',clients:23}
]
function rng(seed){let x=seed|0; return()=>{x=(x*1664525+1013904223)|0;return (x>>>0)/4294967296}}
function targetAllocation(profile){return profile==='conservative'?{equity:20,bond:60,cash:15,other:5}:profile==='aggressive'?{equity:75,bond:15,cash:5,other:5}:{equity:50,bond:35,cash:10,other:5}}
function allocation(holdings){const sums={equity:0,bond:0,cash:0,other:0};let total=0;for(const h of holdings){total+=h.value;if(h.sector==='債券')sums.bond+=h.value;else if(h.sector==='現金')sums.cash+=h.value;else if(['日本株','米国株','グローバル株','テクノロジー','自動車','金融','エネルギー'].includes(h.sector))sums.equity+=h.value;else sums.other+=h.value}const p={};for(const k of Object.keys(sums))p[k]=total?Math.round(sums[k]/total*100):0;p.other=Math.max(0,100-p.equity-p.bond-p.cash);return{...p,total}}
function riskDrift(a,profile){const t=targetAllocation(profile);return Math.floor((Math.abs(a.equity-t.equity)+Math.abs(a.bond-t.bond)+Math.abs(a.cash-t.cash)+Math.abs(a.other-t.other))/2)}
function concentration(holdings){const total=holdings.reduce((s,h)=>s+h.value,0);const bySector={};let max=0;holdings.forEach(h=>{const pct=Math.round(h.value/total*100);max=Math.max(max,pct);bySector[h.sector]=(bySector[h.sector]||0)+h.value});const maxSector=Math.max(...Object.values(bySector).map(v=>Math.round(v/total*100)));return{maxHolding:max,maxSector,severity:max>=20||maxSector>=40?'high':max>=12||maxSector>=30?'medium':'low'}}
function priorityScore(c){const parts=[];if(c.reviewDays<0)parts.push(['年次レビュー超過',30]);else if(c.reviewDays<30)parts.push(['レビュー期日近接',15]);if(c.drift>=20)parts.push(['リスクドリフト大',20]);else if(c.drift>=10)parts.push(['リスクドリフト中',12]);if(c.concentration.severity==='high')parts.push(['集中リスク検出',20]);else if(c.concentration.severity==='medium')parts.push(['集中傾向あり',12]);if(c.allocation.cash>=25)parts.push(['現金比率が高い',10]);if(c.monthsSinceReview>=10)parts.push(['10ヶ月以上面談なし',18]);else if(c.monthsSinceReview>=6)parts.push(['6ヶ月以上面談なし',10]);if(c.aum>=100000000)parts.push(['上位資産サイズ顧客',8]);if(c.returnPct<=-10)parts.push(['大幅マイナス',25]);else if(c.returnPct<=-5)parts.push(['マイナス継続',15]);else if(c.returnPct<=-2)parts.push(['軽微マイナス',5]);let raw=parts.reduce((s,p)=>s+p[1],0);return{total:Math.min(raw,100),parts}}
export function createDemoData(){const r=rng(20260919);const clients=[];for(let i=0;i<100;i++){const profile=['conservative','moderate','aggressive'][Math.floor(r()*3)];const advisor=ADVISORS[i%ADVISORS.length];const count=3+Math.floor(r()*6);let remaining=7000000+Math.floor(r()*145000000);const holdings=[];for(let j=0;j<count;j++){const src=SYMBOLS[(i*3+j*5+Math.floor(r()*SYMBOLS.length))%SYMBOLS.length];const value=j===count-1?remaining:Math.max(300000,Math.floor(remaining*(0.12+r()*0.3)));remaining=Math.max(0,remaining-value);holdings.push({symbol:src[0],name:src[1],type:src[2],sector:src[3],value})}if(remaining>0)holdings[holdings.length-1].value+=remaining;const a=allocation(holdings);const reviewDays=Math.floor(r()*240)-80;const monthsSinceReview=Math.floor(r()*15);const returnPct=Math.round((r()*30-12)*10)/10;const c={id:`C-${String(i+1).padStart(4,'0')}`,name:`${JP_NAMES[i%JP_NAMES.length]} ${GIVEN[Math.floor(i/JP_NAMES.length)%GIVEN.length]}`,kana:'デモコキャク',advisorId:advisor.id,advisorName:advisor.name,profile,aum:a.total,holdings,allocation:a,drift:riskDrift(a,profile),concentration:concentration(holdings),reviewDays,monthsSinceReview,returnPct,email:`demo${String(i+1).padStart(3,'0')}@example.jp`,phone:`090-${String(1000+i).slice(-4)}-${String(7000+i).slice(-4)}`,nextMeeting:i%3===0?`${(i%12)+1}日後 14:00`:'未設定'};
// デモでは4つのリスク帯を25名ずつ配置。各スコアはアプリと同じ加点式から算出する。
const demoBand=i%4;
if(demoBand===0){c.reviewDays=90;c.monthsSinceReview=2;c.returnPct=4.0+((i%5)*0.7);c.drift=4+(i%5);c.concentration={...c.concentration,severity:'low',maxHolding:9+(i%3),maxSector:22+(i%5)};c.aum=18000000+(i*310000)%68000000}
if(demoBand===1){c.reviewDays=14;c.monthsSinceReview=4;c.returnPct=-1+(i%5)*0.4;c.drift=10+(i%8);c.concentration={...c.concentration,severity:'low',maxHolding:10+(i%2),maxSector:24+(i%5)};c.aum=30000000+(i*470000)%70000000}
if(demoBand===2){c.reviewDays=-10;c.monthsSinceReview=3;c.returnPct=1+(i%3);c.drift=20+(i%6);c.concentration={...c.concentration,severity:'medium',maxHolding:14+(i%5),maxSector:31+(i%7)};c.aum=55000000+(i*830000)%65000000}
if(demoBand===3){c.reviewDays=-45;c.monthsSinceReview=11;c.returnPct=-11-(i%5);c.drift=24+(i%8);c.concentration={...c.concentration,severity:'high',maxHolding:22+(i%9),maxSector:42+(i%9)};c.aum=105000000+(i*1900000)%95000000}
c.priority=priorityScore(c);
c.meetings=[{id:`M-${i+1}-1`,date:`2026-09-${String(20+(i%9)).padStart(2,'0')}`,time:`${String(9+(i%8)).padStart(2,'0')}:00`,type:['定期レビュー','オンボーディング','フォローアップ'][i%3],status:['準備中','予定','AI下書き済み','承認待ち'][i%4],agenda:['パフォーマンスレビュー','リスク配分の確認','次期投資戦略'],notes:i%2===0?'NISA枠と生活資金の確認':'リバランス案の説明'}];
c.recommendations=[{title:i%2===0?'単一銘柄集中の緩和':'目標配分へのリバランス',status:['下書き','承認','修正','見送り'][i%4],impact:`ドリフト ${c.drift}pt → ${Math.max(3,c.drift-8)}pt`}];
c.documents=[{name:`${c.name}_定期レビュー資料.pdf`,status:i%3===0?'共有済み':'下書き'}];
c.followUps=[{label:i%2===0?'投資方針確認書を送付':'次回面談候補日を確認',due:`9/${21+(i%8)}`,status:i%5===0?'完了':'未完了'}];
clients.push(c)}
const meetings=clients.flatMap(c=>c.meetings.map(m=>({...m,clientId:c.id,clientName:c.name,advisorName:c.advisorName})));
const alerts=clients.filter(c=>c.priority.total>=50).map((c,i)=>({id:`A-${i+1}`,clientId:c.id,clientName:c.name,severity:c.priority.total>=75?'高':'中',title:c.priority.parts[0]?.[0]||'ポートフォリオ確認',status:i%3===0?'対応中':'未対応'}));
const audit=clients.slice(0,40).map((c,i)=>({id:`L-${i+1}`,at:`2026-09-${String(19-(i%7)).padStart(2,'0')} ${String(9+(i%9)).padStart(2,'0')}:20`,advisor:c.advisorName,action:['顧客情報を更新','AI提案を承認','面談記録を保存','PDFを共有'][i%4],client:c.name}));
return{advisors:ADVISORS,clients,meetings,alerts,audit}}
export const formatYen=v=>v>=100000000?`¥${(v/100000000).toFixed(2)}億`:v>=10000?`¥${Math.round(v/10000).toLocaleString()}万`:`¥${Math.round(v).toLocaleString()}`
export const riskLabel={conservative:'安定型',moderate:'バランス型',aggressive:'積極型'}
