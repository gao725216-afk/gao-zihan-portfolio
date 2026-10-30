// All records below are fictional. No network, payment or platform verification code.
export const DEMO_DATE = '2027-05-22';
export const STORAGE_KEY = 'shanye-merchant-demo-v1';
export const money = cents => '¥' + (cents / 100).toLocaleString('zh-CN', {minimumFractionDigits:2,maximumFractionDigits:2});
export const channels = ['微信','抖音','美团','现场'];
export const roles = {owner:'老板',front:'前台员工',bar:'饮品员工'};
export const allowedViews = {
  owner:['dashboard','orders','verify','weigh','drinks','products','reservations','ledger','rewards','settings'],
  front:['dashboard','orders','verify','weigh','reservations'],
  bar:['dashboard','drinks']
};
export function seed() {
  const order = (id, code, title, channel, amount, state, people, time, extra={}) => ({id:'DEMO-'+id,code,title,channel,amount,state,people,time,refund:0,verifiedAt:state==='verified'?'10:02':null,...extra});
  return {
    version:1,
    orders:[
      order('1001','SY1001','双人入园券','微信',5800,'valid',2,'09:12'),
      order('1002','SY1002','亲子采摘体验券','抖音',9800,'valid',3,'09:26'),
      order('1003','SY1003','单人入园券','美团',2900,'valid',1,'09:41'),
      order('1004','SY1004','双人入园券','现场',5800,'verified',2,'10:02',{verifiedEpoch:Date.now()-18*60*1000}),
      order('1005','SY1005','单人入园券','微信',2900,'expired',1,'昨日', {validUntil:'2027-05-21'}),
      order('1006','SY1006','亲子采摘体验券','美团',9800,'complete',3,'09:08',{verifiedAt:'09:18'}),
      order('1007','SY1007','双人入园券','抖音',5800,'refunded',2,'08:55',{refund:5800}),
      order('1008','SY1008','单人入园券','微信',2900,'complete',1,'08:42',{verifiedAt:'09:05'})
    ],
    receipts:[
      {id:'PAY-001',orderId:'DEMO-1001',type:'入园券',channel:'微信',amount:5800,refund:0,fee:0,received:5800,pending:0,time:'09:12'},
      {id:'PAY-002',orderId:'DEMO-1002',type:'入园券',channel:'抖音',amount:9800,refund:0,fee:294,received:0,pending:9506,time:'09:26'},
      {id:'PAY-003',orderId:'DEMO-1003',type:'入园券',channel:'美团',amount:2900,refund:0,fee:87,received:0,pending:2813,time:'09:41'},
      {id:'PAY-004',orderId:'DEMO-1004',type:'入园券',channel:'现场',amount:5800,refund:0,fee:0,received:5800,pending:0,time:'10:02'},
      {id:'PAY-005',orderId:'DEMO-1005',type:'入园券',channel:'微信',amount:2900,refund:0,fee:0,received:2900,pending:0,time:'昨日'},
      {id:'PAY-006',orderId:'DEMO-1006',type:'入园券',channel:'美团',amount:9800,refund:0,fee:294,received:9506,pending:0,time:'09:08'},
      {id:'PAY-007',orderId:'DEMO-1007',type:'入园券',channel:'抖音',amount:5800,refund:5800,fee:0,received:0,pending:0,time:'08:55'},
      {id:'PAY-008',orderId:'DEMO-1008',type:'入园券',channel:'微信',amount:2900,refund:0,fee:0,received:2900,pending:0,time:'08:42'},
      {id:'PAY-009',orderId:'DEMO-1006',type:'采摘称重',channel:'现场',amount:13600,refund:0,fee:0,received:13600,pending:0,time:'10:10',gross:1800,tare:100,net:1700,price:4000},
      {id:'PAY-010',orderId:'DRINK-021',type:'饮品',channel:'微信',amount:4600,refund:0,fee:0,received:4600,pending:0,time:'10:15'},
      {id:'PAY-011',orderId:'DRINK-022',type:'饮品',channel:'现场',amount:2800,refund:0,fee:0,received:2800,pending:0,time:'10:18'},
      {id:'PAY-012',orderId:'DRINK-020',type:'饮品',channel:'现场',amount:1800,refund:0,fee:0,received:1800,pending:0,time:'10:05'},
      {id:'PAY-013',orderId:'DRINK-019',type:'饮品',channel:'现场',amount:2400,refund:0,fee:0,received:2400,pending:0,time:'09:58'},
      {id:'PAY-014',orderId:'DEMO-1008',type:'采摘称重',channel:'现场',amount:6400,refund:0,fee:0,received:6400,pending:0,time:'09:50',gross:900,tare:100,net:800,price:4000}
    ],
    drinks:[
      {id:'DRINK-021',number:'A021',time:'10:15',items:'树莓气泡 × 1 · 山野拿铁 × 1',note:'少冰 / 正常糖',state:'waiting',amount:4600},
      {id:'DRINK-022',number:'A022',time:'10:18',items:'鲜乳茶 × 1',note:'去冰 / 三分糖',state:'waiting',amount:2800},
      {id:'DRINK-020',number:'A020',time:'10:05',items:'美式咖啡 × 1',note:'冰 / 无糖',state:'making',amount:1800},
      {id:'DRINK-019',number:'A019',time:'09:58',items:'山野拿铁 × 1',note:'热 / 无糖',state:'ready',amount:2400}
    ],
    products:[
      {id:'P01',name:'双人入园券',category:'入园采摘',unit:'张',price:5800,state:'on',stock:40,color:'leaf'},
      {id:'P02',name:'树莓采摘',category:'入园采摘',unit:'斤',price:4000,state:'on',stock:null,color:'berry'},
      {id:'P03',name:'树莓气泡',category:'咖啡饮品',unit:'杯',price:2200,state:'on',stock:18,color:'rose'},
      {id:'P04',name:'山野拿铁',category:'咖啡饮品',unit:'杯',price:2400,state:'soldout',stock:0,color:'coffee'},
      {id:'P05',name:'山野午餐',category:'山野餐饮',unit:'份',price:6800,state:'off',stock:20,color:'sand'},
      {id:'P06',name:'亲子植物拓印',category:'亲子 DIY',unit:'组',price:4800,state:'on',stock:8,color:'leaf'}
    ],
    reservations:[
      {id:'R01',title:'入园采摘 · 上午场',time:'09:00–12:00',unit:'人',capacity:30,booked:22,open:true},
      {id:'R02',title:'入园采摘 · 下午场',time:'13:00–17:00',unit:'人',capacity:30,booked:10,open:true},
      {id:'R03',title:'亲子植物拓印',time:'14:00–15:00',unit:'组',capacity:8,booked:6,open:true},
      {id:'R04',title:'研学团建咨询',time:'按团队另约',unit:'团',capacity:2,booked:0,open:false}
    ],
    rewards:[
      {id:'RW01',alias:'推荐人 A（虚构）',orderId:'DEMO-1001',base:5800,reward:580,adjustment:0,status:'pending'},
      {id:'RW02',alias:'推荐人 B（虚构）',orderId:'DEMO-1006',base:9800,reward:980,adjustment:0,status:'settled'},
      {id:'RW03',alias:'推荐人 A（虚构）',orderId:'DEMO-1007',base:5800,reward:580,adjustment:-580,status:'adjusted'}
    ],
    audit:[{id:'LOG-1',text:'打开模拟营业日，载入虚构订单',time:'10:20',actor:'系统演示'}],
    seq:20
  };
}
export function can(role, view) { return !!allowedViews[role]?.includes(view); }
function fail(message) { throw new Error(message); }
function permit(role, view) { if (!can(role, view)) fail('当前演示角色没有此项操作权限'); }
function find(list,id) { const row=list.find(x=>x.id===id); if(!row) fail('记录不存在'); return row; }
function log(state,role,text) {state.audit.unshift({id:'LOG-'+(++state.seq),text,time:new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}),actor:roles[role]});state.audit=state.audit.slice(0,80);}
export function getVoucher(state, code) {
  return state.orders.find(x=>x.code===String(code).trim().toUpperCase()) || null;
}
export function verifyVoucher(state, role, id) {
  permit(role,'verify'); const row=find(state.orders,id);
  if(row.state!=='valid') fail(row.state==='expired'?'此演示券已过期':row.state==='refunded'?'此演示券已退款':'此演示券已核销，请勿重复操作');
  row.state='verified'; row.verifiedEpoch=Date.now();row.verifiedAt='演示 '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});
  log(state,role,`演示核销 ${id}，${row.people} 人入园（未调用平台）`);return row;
}
export function undoVoucher(state,role,id,reason) {
  permit(role,'verify'); const row=find(state.orders,id);
  if(!String(reason||'').trim()) fail('请填写撤销原因');
  if(row.state!=='verified') fail('仅可撤销尚未称重收款的演示核销');
  if(row.channel==='抖音' && (!row.verifiedEpoch || Date.now()-row.verifiedEpoch>60*60*1000)) fail('超过抖音误核销撤销的 1 小时时间窗口；本演示不支持继续撤销');
  if(state.receipts.some(x=>x.orderId===id&&x.type==='采摘称重'&&!x.refund)) fail('已有称重收款，请先处理相关账目');
  row.state='valid';row.verifiedAt=null;row.verifiedEpoch=null;log(state,role,`撤销演示核销 ${id}：${reason}`);return row;
}
// Convert decimal kilograms into integer grams before calculating; 1 斤 = 500 克.
export function calculateWeight(grossKg,tareKg,priceYuan) {
  const vals=[grossKg,tareKg,priceYuan];
  if(vals.some(v=>v===null||v===undefined||String(v).trim()===''||!Number.isFinite(Number(v)))) fail('请完整填写有效的毛重、皮重和单价');
  const [grossNum,tareNum,priceNum]=vals.map(Number);
  if(grossNum<=0||tareNum<0||priceNum<=0) fail('毛重、单价须大于 0，皮重不能为负值');
  if(grossNum>100||tareNum>100||priceNum>10000) fail('超出本演示范围：重量不超过 100 kg，单价不超过 10,000 元/斤');
  if(!/^\d+(\.\d{1,3})?$/.test(String(grossKg))||!/^\d+(\.\d{1,3})?$/.test(String(tareKg))) fail('重量最多填写三位小数（精确到克）');
  if(!/^\d+(\.\d{1,2})?$/.test(String(priceYuan))) fail('单价最多填写两位小数');
  const gross=Math.round(grossNum*1000),tare=Math.round(tareNum*1000),price=Math.round(priceNum*100);
  if(tare>=gross) fail('皮重必须小于毛重');
  const net=gross-tare;
  return {gross,tare,net,price,jin:net/500,amount:Math.round(net*price/500)};
}
export function collectWeight(state,role,id,weight,method) {
  permit(role,'weigh');const row=find(state.orders,id);
  if(row.state!=='verified') fail(row.state==='complete'?'该订单已完成收款，请勿重复操作':'请先完成演示验券');
  if(!['现场','微信'].includes(method)) fail('请选择演示收款方式');
  const checked=calculateWeight((weight.gross/1000).toFixed(3),(weight.tare/1000).toFixed(3),(weight.price/100).toFixed(2));
  if(state.receipts.some(x=>x.orderId===id&&x.type==='采摘称重')) fail('此订单已有称重记录');
  const receipt={id:'PAY-DEMO-'+(++state.seq),orderId:id,type:'采摘称重',channel:method,...checked,received:checked.amount,refund:0,fee:0,pending:0,time:new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false})};
  state.receipts.unshift(receipt);row.state='complete';log(state,role,`演示收款 ${id}，净重 ${checked.jin.toFixed(3)} 斤，${money(checked.amount)}（未发生真实支付）`);return receipt;
}
export function transitionDrink(state,role,id,expected) {
  permit(role,'drinks');const row=find(state.drinks,id);
  if(row.state!==expected) fail('订单状态已变化，请勿重复操作');
  const next={waiting:'making',making:'ready',ready:'done'}[row.state];
  if(!next) fail('此饮品单已完成');row.state=next;log(state,role,`饮品 ${row.number} → ${{making:'制作中',ready:'待取餐',done:'已取餐'}[next]}`);return row;
}
export function setProduct(state,role,id,value,stock) {
  permit(role,'products');const row=find(state.products,id);
  if(!['on','off','soldout'].includes(value)) fail('商品状态无效');
  if(row.stock!==null && value==='on') {
    if(!Number.isInteger(Number(stock))||Number(stock)<=0||Number(stock)>9999) fail('上架前请填写 1–9999 的可售库存');
    row.stock=Number(stock);
  }
  if(value==='soldout' && row.stock!==null) row.stock=0;row.state=value;log(state,role,`${row.name} → ${{on:'上架',off:'下架',soldout:'售罄'}[value]}`);return row;
}
export function saveCapacity(state,role,id,value,open) {
  permit(role,'reservations');if(role!=='owner') fail('容量调整仅限老板，员工可查看预约');
  const row=find(state.reservations,id),n=Number(value);
  if(String(value).trim()===''||!Number.isInteger(n)||n<row.booked||n>999) fail(`容量须为 ${row.booked}–999 的整数，不能少于已预约数量`);
  row.capacity=n;row.open=!!open;log(state,role,`${row.title} 容量 ${n} ${row.unit}，${open?'开放预约':'暂停预约'}`);return row;
}
export function settleReward(state,role,id) {
  permit(role,'rewards');const row=find(state.rewards,id);
  if(row.status!=='pending') fail('此奖励已处理，请勿重复操作');
  const order=find(state.orders,row.orderId);
  if(order.state!=='complete') fail('示例条件：关联订单完成体验后才能演示结算');
  row.status='settled';log(state,role,`演示标记推荐奖励 ${id} 已结算，${money(row.reward+row.adjustment)}（不转账）`);return row;
}
export function refundOrder(state,role,id) {
  permit(role,'ledger');const row=find(state.orders,id);
  if(row.state!=='valid') fail('本演示仅支持未核销入园券的全额退款');
  row.state='refunded';row.refund=row.amount;
  const pay=state.receipts.find(x=>x.orderId===id&&x.type==='入园券');
  if(pay) {pay.refund=pay.amount;pay.received=0;pay.pending=0;pay.fee=0;}
  for(const reward of state.rewards.filter(x=>x.orderId===id)) {reward.adjustment=-reward.reward;reward.status='adjusted';}
  log(state,role,`演示退款 ${id} ${money(row.amount)}，关联奖励同步冲回（未调用平台）`);return row;
}
export function ledger(state,channel='全部') {
  const rows=state.receipts.filter(x=>channel==='全部'||x.channel===channel);
  return rows.reduce((a,r)=>{a.amount+=r.amount;a.refund+=r.refund;a.received+=r.received;a.pending+=r.pending;a.fee+=r.fee;return a;},{amount:0,refund:0,received:0,pending:0,fee:0});
}
export function validateState(state) {
  return !!(state&&state.version===1&&['orders','receipts','drinks','products','reservations','rewards','audit'].every(k=>Array.isArray(state[k]))&&Number.isInteger(state.seq));
}
