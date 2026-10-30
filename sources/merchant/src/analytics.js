// Deterministic fictional events. No personal information, network, or live analytics.
export const TODAY = '2027-05-22';
export const CHANNELS = ['全部','H5','小程序','精选','App开店'];
export const METRICS = {
  visitors:{label:'访客数',unit:'人',tip:'演示：所选时段访问店铺的合成访客ID去重数。'},
  pv:{label:'浏览量',unit:'次',tip:'演示：所选时段产生的页面浏览次数，可大于访客数。'},
  newVisitors:{label:'新访客数',unit:'人',tip:'演示：首次访问日期在所选时段内的合成访客ID去重数。'},
  bounce:{label:'跳失率',unit:'%',tip:'演示口径：只浏览1页的访问次数 ÷ 全部访问次数。非有赞官方算法声明。'},
  duration:{label:'平均停留时长',unit:'秒',tip:'演示口径：全部访问停留秒数 ÷ 访问次数。'},
  depth:{label:'人均浏览量',unit:'次/人',tip:'浏览量 ÷ 去重访客数。'},
  orderRate:{label:'访问-下单转化率',unit:'%',tip:'去重下单人数 ÷ 去重访客数。'},
  payOrderRate:{label:'下单-支付转化率',unit:'%',tip:'去重支付人数 ÷ 去重下单人数。'},
  payRate:{label:'访问-支付转化率',unit:'%',tip:'去重支付人数 ÷ 去重访客数。'},
  orderers:{label:'下单人数',unit:'人',tip:'所选时段产生下单行为的合成访客ID去重数，不是订单数。'},
  orderAmount:{label:'下单金额',unit:'元',tip:'合成订单金额之和；不是实收，也不代表利润。'},
  orders:{label:'下单订单数',unit:'笔',tip:'合成订单数量；同一人可以下多笔订单。'},
  payers:{label:'支付人数',unit:'人',tip:'所选时段有支付行为的合成访客ID去重数。'},
  payAmount:{label:'支付金额',unit:'元',tip:'合成已支付订单金额；不扣退款/佣金，不等于经营实收。'},
  paidOrders:{label:'支付订单数',unit:'笔',tip:'合成已支付订单数量，不是支付人数。'},
  aov:{label:'客单价',unit:'元/人',tip:'合成支付金额 ÷ 去重支付人数。'},
  uvValue:{label:'UV价值',unit:'元/人',tip:'合成支付金额 ÷ 去重访客数。'},
  cart:{label:'加购人数',unit:'人',tip:'所选时段有加购行为的合成访客ID去重数。'}
};
export const VISIT_KEYS=['visitors','pv','newVisitors','bounce','duration','depth'];
export const TRADE_KEYS=['orderRate','payOrderRate','payRate','orderers','orderAmount','orders','payers','payAmount','paidOrders','aov'];
export const SOURCE_KEYS=['uvValue','cart','orderers','orderAmount','orders','orderRate','payOrderRate','payers','payAmount','paidOrders','payRate','aov'];
export const percent=(a,b)=>b ? a/b*100 : 0;
export const iso=d=>new Date(d).toISOString().slice(0,10);
export const addDays=(date,n)=>iso(new Date(date+'T00:00:00Z').getTime()+n*86400000);
export const fmt=(v,key)=>METRICS[key]?.unit==='%' ? `${v.toFixed(2)}%` : ['元','元/人','次/人'].includes(METRICS[key]?.unit) ? v.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}) : Math.round(v).toLocaleString('zh-CN');
const cache=new Map();
const sourceTree={H5:[['浏览器',['直接访问','链接分享']],['微信',['朋友圈','公众号文章','扫一扫']],['APP',['外部应用']],['搜索',['搜索引擎']]],小程序:[['扫码',['小程序码','二维码']],['微信',['聊天会话','发现-小程序','历史列表']],['搜索',['微信搜索']],['其他',['其他入口']]],精选:[['精选',['精选首页','商品推荐']]],App开店:[['App开店',['店铺首页','活动入口']]],其他:[['其他',['其他来源']]]};
export const sourcesFor=channel=>sourceTree[channel]||sourceTree.H5;
export function dailyEvents(date){
  if(cache.has(date))return cache.get(date);
  const day=Math.floor(new Date(date+'T00:00:00Z').getTime()/86400000);
  const events=[];
  // Most people revisit over several days; channel totals must be deduplicated.
  for(let i=0,n=115+(day*37%113);i<n;i++){
    const person=(day*41+i*17)%620;
    const p=(i*31+day*7)%100;
    const channel=p<34?'H5':p<81?'小程序':p<90?'精选':p<95?'App开店':'其他';
    const groups=sourceTree[channel],group=groups[(person+day)%groups.length];
    const source=group[0],detail=group[1][(person+day)%group[1].length];
    const order=(person+day)%9===0,paid=order&&(person+day)%5!==0;
    const orders=order?1+(person%4===0?1:0):0,paidOrders=paid?orders:0;
    const amount=(2900+person%7*1000)*orders;
    const isNew=i%5===0;
    events.push({id:isNew?`N-${date}-${person}`:`V-${person}`,date,channel,source,detail,pv:1+(person+day)%6,seconds:18+(person*7+day)%225,new:isNew,cart:order||person%6===day%6,orders,paidOrders,orderCents:amount,payCents:paid?amount:0});
    // Repeated session of an existing person: page views increase, people don't.
    if(i%11===0)events.push({...events.at(-1),pv:1,seconds:12,new:false,orders:0,paidOrders:0,orderCents:0,payCents:0,cart:false});
  }
  cache.set(date,events);return events;
}
export function eventsBetween(start,end,channel='全部'){
  if(!validDate(start)||!validDate(end)||start>end)return [];
  const list=[];
  for(let day=start,count=0;day<=end&&count<366;day=addDays(day,1),count++)for(const e of dailyEvents(day))if(channel==='全部'||e.channel===channel)list.push(e);
  return list;
}
export const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&iso(s)===s;
export function summarize(events){
  const people=new Set(events.map(e=>e.id)),orderers=new Set(events.filter(e=>e.orders).map(e=>e.id)),payers=new Set(events.filter(e=>e.paidOrders).map(e=>e.id));
  const sums=k=>events.reduce((s,e)=>s+e[k],0),visitors=people.size;
  // A first-visit marker is counted once in the selected period.
  const newVisitors=new Set(events.filter(e=>e.new).map(e=>e.id)).size;
  const pv=sums('pv'),payAmount=sums('payCents')/100,orderAmount=sums('orderCents')/100;
  return {visitors,pv,newVisitors,bounce:percent(events.filter(e=>e.pv===1).length,events.length),duration:events.length?sums('seconds')/events.length:0,depth:visitors?pv/visitors:0,orderers:orderers.size,payers:payers.size,orders:sums('orders'),paidOrders:sums('paidOrders'),orderAmount,payAmount,orderRate:percent(orderers.size,visitors),payOrderRate:percent(payers.size,orderers.size),payRate:percent(payers.size,visitors),aov:payers.size?payAmount/payers.size:0,uvValue:visitors?payAmount/visitors:0,cart:new Set(events.filter(e=>e.cart).map(e=>e.id)).size};
}
export function resolveRange(mode,date=TODAY,custom=[addDays(TODAY,-6),TODAY]){
  if(mode==='custom')return {start:custom[0],end:custom[1]};
  if(mode==='7'||mode==='30')return {start:addDays(TODAY,mode==='7'?-6:-29),end:TODAY};
  if(mode==='live')return {start:TODAY,end:TODAY};
  if(mode==='week'){
    const weekday=(new Date(date+'T00:00:00Z').getUTCDay()+6)%7,start=addDays(date,-weekday);
    return {start,end:addDays(start,6)>TODAY?TODAY:addDays(start,6)};
  }
  if(mode==='month')return {start:date.slice(0,7)+'-01',end:iso(new Date(Date.UTC(+date.slice(0,4),+date.slice(5,7),0)))>TODAY?TODAY:iso(new Date(Date.UTC(+date.slice(0,4),+date.slice(5,7),0)))};
  return {start:date,end:date};
}
export function previousRange({start,end}){const length=Math.round((Date.parse(end)-Date.parse(start))/86400000)+1;return {start:addDays(start,-length),end:addDays(start,-1)};}
export function trendBuckets(mode,range,channel,filter=()=>true){
  const buckets=[];
  if(mode==='month'){
    for(let i=11;i>=0;i--){const d=new Date(range.end+'T00:00:00Z');d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-i);const start=iso(d),end=iso(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)));buckets.push({label:start.slice(0,7),...summarize(eventsBetween(start,end>TODAY?TODAY:end,channel).filter(filter))});}
  }else if(mode==='week'){
    for(let i=12;i>=0;i--){const start=addDays(range.start,-i*7),end=addDays(start,6);buckets.push({label:start,...summarize(eventsBetween(start,end>TODAY?TODAY:end,channel).filter(filter))});}
  }else{
    const start=['7','30','custom'].includes(mode)?range.start:addDays(range.end,-30);
    for(let d=start;d<=range.end;d=addDays(d,1))buckets.push({label:d,...summarize(eventsBetween(d,d,channel).filter(filter))});
  }
  return buckets;
}
export function sourceRows(range,channel){
  const events=eventsBetween(range.start,range.end,channel),totals=summarize(events);
  const row=(id,label,ev,children)=>({id,label,...summarize(ev),share:percent(summarize(ev).visitors,totals.visitors),children});
  return [row('all','全部',events,sourcesFor(channel).map(([source,details],i)=>row(`source-${i}`,source,events.filter(e=>e.source===source),details.map((detail,j)=>row(`source-${i}-${j}`,detail,events.filter(e=>e.source===source&&e.detail===detail))))))];
}
export function pageRanks(range,channel='全部'){
  const ev=eventsBetween(range.start,range.end,channel);
  const pages=['春日采摘预约','店铺首页','亲子活动','入园指南','个人主页'];
  const products=['树莓采摘入园票','山野树莓气泡饮','亲子植物拓印DIY','山野拿铁','山野午餐'];
  const hash=id=>[...id].reduce((s,c)=>(s*31+c.charCodeAt(0))%100000,0)%100;
  const ranks=names=>names.map((name,i)=>({name,visitors:new Set(ev.filter(e=>hash(e.id)<[90,71,52,34,19][i]).map(e=>e.id)).size})).sort((a,b)=>b.visitors-a.visitors);
  return {pages:ranks(pages),products:ranks(products)};
}
export function toggleMetric(selected,key,max){if(selected.includes(key))return selected.length===1?selected:selected.filter(x=>x!==key);return selected.length>=max?selected:[...selected,key];}
