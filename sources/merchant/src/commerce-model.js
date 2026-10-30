import * as legacy from './business-model.js';
export * from './business-model.js';
export const CATALOG_VERSION=2;
export const PRODUCT_KINDS={weighed:'称重水果',packaged:'固定包装',reservation:'预约票 / 活动'};
export const FLOW_NAMES={opening:'期初',restock:'补货入库',loss:'报损出库',count:'盘点纠正',reserve:'订单占用',release:'取消释放',fulfill:'提货出库',weigh:'采摘出库',capacity:'名额调整',redeem:'核销确认',undo:'撤销核销'};
export const GOODS_STATES={reserved:'待模拟收款',ready:'待提货 / 核销',fulfilled:'已交付',cancelled:'已取消',refunded:'已退款'};
const fail=message=>{throw Error(message)};
const now=()=>new Date().toLocaleTimeString('zh-CN',{hour12:false});
const byId=(list,id)=>list.find(x=>x.id===id)||fail('记录不存在，请返回列表刷新');
const requireOwner=role=>{if(role!=='owner')fail('商品和库存管理仅限老板演示岗位')};
const requireSales=role=>{if(!['owner','front'].includes(role))fail('当前岗位不能处理此订单')};
const id=(s,prefix)=>`${prefix}-${++s.seq}`;
const log=(s,role,text)=>{s.audit.unshift({id:id(s,'LOG'),time:now(),actor:legacy.roles[role]||'系统演示',text});s.audit=s.audit.slice(0,100)};
export function parseQuantity(value,kind,{allowZero=false}={}){
  const text=String(value??'').trim();
  if(!(kind==='weighed'?/^\d+(\.\d{1,3})?$/:/^\d+$/).test(text))fail(kind==='weighed'?'重量请输入非负数字，最多三位小数（kg）':'数量请输入非负整数，不接受小数或负值');
  const n=Number(text)*(kind==='weighed'?1000:1);
  if(!Number.isFinite(n)||n>100000000||(!allowZero&&n<=0))fail(allowZero?'数量须在0至100,000,000之间':'数量必须大于0，且不能超出范围');
  return Math.round(n);
}
export const quantityText=(raw,kind)=>kind==='weighed'?(raw/1000).toFixed(3):String(raw);
export const unitFor=sku=>sku.kind==='weighed'?'kg':sku.stockUnit;
export const formatQuantity=(raw,sku)=>`${quantityText(raw,sku.kind)} ${unitFor(sku)}`;
function priceCents(value){const text=String(value??'').trim();if(!/^\d+(\.\d{1,2})?$/.test(text)||Number(text)<=0||Number(text)>10000)fail('SKU价格须大于0、不超过10,000元，最多两位小数');return Math.round(Number(text)*100)}
export function getStock(state,sku){
  if(sku.kind==='reservation'){const r=byId(state.reservations,sku.slotId);return {onHand:r.capacity,reserved:r.booked,available:r.capacity-r.booked,revision:r.stockRev||0,open:r.open,unit:r.unit};}
  return {onHand:sku.onHand,reserved:sku.reserved,available:sku.onHand-sku.reserved,revision:sku.rev||0,open:true,unit:unitFor(sku)};
}
export const stockStatus=(state,sku)=>{const n=getStock(state,sku);return !n.open?'closed':n.available===0?'out':n.available<sku.lowStock?'low':'normal'};
export function activeSkus(state,product){return state.skus.filter(x=>x.productId===product.id&&x.active!==false)}
export function skuRows(state){return state.skus.filter(x=>x.active!==false).map(sku=>({...sku,product:byId(state.products,sku.productId),stock:getStock(state,sku),stockStatus:stockStatus(state,sku)}))}
function flow(s,role,sku,kind,before,after,reason,orderId=''){
  const p=s.products.find(p=>p.id===sku.productId)||{id:'',name:sku.label},f={id:id(s,'STOCK-DEMO'),time:now(),date:legacy.DEMO_DATE,actor:legacy.roles[role]||'系统演示',skuId:sku.id,skuCode:sku.code,productId:p.id,productName:p.name,spec:sku.label,unit:unitFor(sku),kind,productKind:sku.kind,beforeOnHand:before.onHand,afterOnHand:after.onHand,beforeReserved:before.reserved,afterReserved:after.reserved,deltaOnHand:after.onHand-before.onHand,deltaReserved:after.reserved-before.reserved,reason,orderId};s.stockFlows.unshift(f);return f;
}
function validateReason(reason){const v=String(reason||'').trim();if(v.length<2||v.length>120)fail('请填写2–120字的库存变更原因');return v}
function atomic(state,role,scope,token,fn){
  scope==='sales'?requireSales(role):requireOwner(role);
  if(token&&state.catalogOps?.[token])return structuredClone(state.catalogOps[token].result);
  const draft=structuredClone(state),result=fn(draft);if(!validateState(draft))fail('库存状态校验失败，操作未保存');
  if(token)draft.catalogOps[token]={scope,result:structuredClone(result)};
  draft.dataRevision=(draft.dataRevision||0)+1;Object.assign(state,draft);return result;
}
function syncLegacy(s,p){const skus=activeSkus(s,p);if(!skus.length)return;p.price=Math.min(...skus.map(x=>x.price));p.unit=skus[0].saleUnit;p.stock=p.kind==='weighed'?null:skus.length===1?getStock(s,skus[0]).available:null;}
function physicalChange(s,sku,onHand,reserved){if(!Number.isSafeInteger(onHand)||!Number.isSafeInteger(reserved)||reserved<0||onHand<reserved)fail('在库不能为负或小于订单占用，操作未保存');sku.onHand=onHand;sku.reserved=reserved;sku.rev=(sku.rev||0)+1;}
export function upgradeState(input,{fresh=false}={}){
  if(input.catalogVersion===CATALOG_VERSION)return input;
  const s=structuredClone(input);s.catalogVersion=CATALOG_VERSION;s.dataRevision=0;s.skus=[];s.stockFlows=[];s.goodsOrders=[];s.catalogOps={};
  s.reservations.forEach(r=>{r.date=r.date||legacy.DEMO_DATE;r.stockRev=0});
  const known={P01:['reservation','ticket'],P02:['weighed','berry'],P03:['packaged','drink'],P04:['packaged','coffee'],P05:['packaged','meal'],P06:['reservation','diy']};
  s.products.forEach(p=>{const [kind,image]=known[p.id]||[p.unit==='斤'?'weighed':'packaged','box'];Object.assign(p,{kind,image,description:'虚构商品，仅用于商户操作演示。',rev:0});});
  const addProduct=(id,name,category,kind,image,description)=>{if(!s.products.some(p=>p.id===id))s.products.push({id,name,category,kind,image,description,state:'on',price:0,stock:null,unit:'',rev:0})};
  addProduct('P07','鲜树莓 · 当日采摘盒装','鲜果与包装','packaged','box','独立盒装库存；125g、250g、500g各自计数，不与现场称重库存自动换算。');
  addProduct('P08','山野蜂蜜 · 伴手礼','农场伴手礼','packaged','honey','虚构伴手礼样本，不代表实际在售。每种包装独立维护瓶数。');
  addProduct('P09','单人入园券','入园采摘','reservation','ticket','按日期及场次共享入园名额，核销不会再次扣名额。');
  addProduct('P10','亲子采摘体验券','入园采摘','reservation','ticket','每张3人，按场次占用3个人次；果品采摘另付。');
  function add(productId,suffix,label,price,onHand,lowStock,options={}){
    const p=byId(s.products,productId),kind=p.kind,slot=options.slotId?s.reservations.find(r=>r.id===options.slotId):null;
    const sku={id:`${productId}-${suffix}`,productId,code:`LF-${productId}-${suffix}`,label,price,kind,saleUnit:kind==='weighed'?'斤':kind==='reservation'?(slot?.unit==='组'?'组':'张'):(p.unit||'盒'),stockUnit:kind==='weighed'?'g':kind==='reservation'?slot.unit:(p.unit||'盒'),onHand:kind==='reservation'?null:onHand,reserved:0,lowStock,slotId:options.slotId||'',peoplePerUnit:options.peoplePerUnit||1,active:true,rev:0,...options};
    s.skus.push(sku);return sku;
  }
  for(const p of s.products){
    if(p.id==='P01'){add(p.id,'AM','上午场 · 双人',p.price,0,6,{slotId:'R01',peoplePerUnit:2});add(p.id,'PM','下午场 · 双人',p.price,0,6,{slotId:'R02',peoplePerUnit:2});}
    else if(p.id==='P02')add(p.id,'FRESH','现场鲜采 · 按净重',p.price,32000,5000);
    else if(p.id==='P06')add(p.id,'DIY','拓印体验 · 14:00场',p.price,0,3,{slotId:'R03'});
    else if(p.id==='P07'){add(p.id,'125','125g / 盒',1600,48,8,{saleUnit:'盒',stockUnit:'盒'});add(p.id,'250','250g / 盒',2800,12,5,{saleUnit:'盒',stockUnit:'盒'});add(p.id,'500','500g / 盒',4800,0,4,{saleUnit:'盒',stockUnit:'盒'});}
    else if(p.id==='P08'){add(p.id,'250','250g / 瓶',3800,16,5,{saleUnit:'瓶',stockUnit:'瓶'});add(p.id,'500','500g / 瓶',6800,3,5,{saleUnit:'瓶',stockUnit:'瓶'});}
    else if(p.id==='P09')add(p.id,'AM','上午场 · 单人',2900,0,6,{slotId:'R01'});
    else if(p.id==='P10')add(p.id,'AM','上午场 · 亲子3人',9800,0,6,{slotId:'R01',peoplePerUnit:3});
    else add(p.id,'STD','标准规格',p.price,p.stock||0,5);
  }
  // Existing admission examples already belong to the seeded booked count; never deduct twice.
  for(const o of s.orders)if(!['expired','refunded'].includes(o.state))o.stockReservation={slotId:'R01',units:o.people,active:true};
  const seen=new Set();for(const sku of s.skus){if(sku.kind==='reservation'&&seen.has(sku.slotId))continue;if(sku.kind==='reservation')seen.add(sku.slotId);const current=getStock(s,sku);flow(s,'system',sku,'opening',{onHand:0,reserved:0},current,'演示期初；历史样本已包含，不重复扣减');}
  for(const [suffix,skuId,qty] of [['9001','P07-125',6],['9002','P07-250',10]]){
    const sku=byId(s.skus,skuId),before=getStock(s,sku),order={id:`GOODS-DEMO-${suffix}`,skuId,productId:sku.productId,productName:byId(s.products,sku.productId).name,spec:sku.label,quantity:qty,units:qty,unit:sku.saleUnit,price:sku.price,amount:sku.price*qty,state:'reserved',paid:false,time:'09:30',kind:'packaged',reservationActive:true,admissionId:'',refund:0};
    physicalChange(s,sku,sku.onHand,sku.reserved+qty);s.goodsOrders.push(order);flow(s,'system',sku,'reserve',before,getStock(s,sku),'虚构样本订单预占',order.id);
  }
  s.products.forEach(p=>syncLegacy(s,p));return s;
}
export const seed=()=>upgradeState(legacy.seed(),{fresh:true});
export function validateState(s){
  if(!legacy.validateState(s)||s.catalogVersion!==CATALOG_VERSION||!Array.isArray(s.skus)||!Array.isArray(s.stockFlows)||!Array.isArray(s.goodsOrders))return false;
  const codes=new Set();for(const sku of s.skus){if(codes.has(sku.code.toLowerCase())||!s.products.some(p=>p.id===sku.productId)||!Number.isInteger(sku.price)||sku.price<=0)return false;codes.add(sku.code.toLowerCase());if(sku.kind==='reservation'){const r=s.reservations.find(x=>x.id===sku.slotId);if(!r||r.booked<0||r.capacity<r.booked||!Number.isInteger(r.booked)||!Number.isInteger(r.capacity))return false;}else if(!Number.isSafeInteger(sku.onHand)||!Number.isSafeInteger(sku.reserved)||sku.reserved<0||sku.onHand<sku.reserved)return false;}
  for(const sku of s.skus.filter(x=>x.kind!=='reservation')){const held=s.goodsOrders.filter(o=>o.skuId===sku.id&&o.reservationActive).reduce((n,o)=>n+o.units,0);if(held!==sku.reserved)return false;}
  return true;
}
export function makeProductDraft(state,product){
  if(!product)return {name:'',category:'鲜果与包装',kind:'packaged',image:'box',description:'',state:'off',skus:[{id:'',code:'',label:'标准规格',priceYuan:'',saleUnit:'盒',stockUnit:'盒',initial:'0',lowStock:'5',slotId:'R01',peoplePerUnit:'1'}]};
  return {id:product.id,expectedRev:product.rev,name:product.name,category:product.category,kind:product.kind,image:product.image,description:product.description||'',state:product.state,skus:activeSkus(state,product).map(sku=>({...sku,priceYuan:(sku.price/100).toFixed(2),initial:quantityText(getStock(state,sku).onHand,sku.kind),lowStock:quantityText(sku.lowStock,sku.kind),peoplePerUnit:String(sku.peoplePerUnit)}))};
}
export function saveCatalogProduct(state,role,draft,token){return atomic(state,role,'owner',token,s=>{
  const name=String(draft.name||'').trim(),category=String(draft.category||'').trim();if(name.length<2||name.length>60)fail('商品名称请填写2–60字');if(!category||category.length>24)fail('请填写不超过24字的商品分类');if(!PRODUCT_KINDS[draft.kind])fail('请选择商品类型');if(!Array.isArray(draft.skus)||!draft.skus.length||draft.skus.length>12)fail('每件商品需要1–12个SKU');
  if(!['berry','box','ticket','drink','coffee','meal','diy','honey'].includes(draft.image)&&!/^data:image\/(png|jpeg|webp);base64,/.test(draft.image||''))fail('请选择演示图片或本地PNG/JPEG/WebP图片');if((draft.image||'').length>1500000)fail('图片超过本地演示大小限制');
  let p=draft.id?byId(s.products,draft.id):null;if(p&&p.rev!==draft.expectedRev)fail('商品已被修改，请返回详情刷新后重新编辑');if(p&&p.kind!==draft.kind)fail('已建商品不能改变库存类型，请新建商品避免单位混用');
  const productId=p?.id||id(s,'P-DEMO'),keep=new Set(),seen=new Set();
  for(const line of draft.skus){const code=String(line.code||'').trim().toUpperCase(),label=String(line.label||'').trim();if(!/^[A-Z0-9_-]{2,36}$/.test(code))fail('SKU编码须为2–36位字母、数字、下划线或短横线');if(seen.has(code)||s.skus.some(x=>x.code.toUpperCase()===code&&x.id!==line.id))fail('SKU编码重复，请使用唯一编码');seen.add(code);if(!label||label.length>40)fail('规格名称须填写1–40字');
    const old=line.id?byId(s.skus,line.id):null;if(old&&old.productId!==productId)fail('SKU不属于此商品');if(old&&(old.saleUnit!==line.saleUnit||old.slotId!==line.slotId||old.kind==='reservation'&&old.peoplePerUnit!==Number(line.peoplePerUnit)))fail('已有SKU的单位、每份占用和预约场次不可直接改变');
    const kind=draft.kind,slot=kind==='reservation'?byId(s.reservations,line.slotId):null,people=Number(line.peoplePerUnit||1);if(kind==='reservation'&&(!Number.isInteger(people)||people<1||people>20||slot.unit!=='人'&&people!==1))fail('每份占用名额须为1–20整数，组/团场次每份占用1个名额');
    if(kind!=='weighed'&&!['盒','瓶','袋','份','杯','张','组','件'].includes(line.saleUnit))fail('请选择明确的计价单位');
    const sku={...(old||{}),id:old?.id||id(s,'SKU-DEMO'),productId,code,label,kind,price:priceCents(line.priceYuan),saleUnit:kind==='weighed'?'斤':line.saleUnit,stockUnit:kind==='weighed'?'g':kind==='reservation'?slot.unit:line.saleUnit,slotId:kind==='reservation'?slot.id:'',peoplePerUnit:people,lowStock:parseQuantity(line.lowStock,kind,{allowZero:true}),onHand:kind==='reservation'?null:old?.onHand??parseQuantity(line.initial,kind,{allowZero:true}),reserved:old?.reserved||0,rev:old?.rev||0,active:true};
    keep.add(sku.id);if(old)Object.assign(old,sku);else s.skus.push(sku);
  }
  if(p)for(const sku of activeSkus(s,p).filter(x=>!keep.has(x.id))){const stock=getStock(s,sku);if(sku.kind!=='reservation'&&(stock.onHand||stock.reserved)||s.goodsOrders.some(o=>o.skuId===sku.id&&o.reservationActive))fail('有在库或未履约订单的SKU不能移除');sku.active=false;}
  const wasNew=!p,wasOn=p?.state==='on';if(!p){p={id:productId,rev:0};s.products.push(p);}Object.assign(p,{name,category,kind:draft.kind,image:draft.image,description:String(draft.description||'').slice(0,400),state:draft.state||'off',rev:(p.rev||0)+1});
  if(!['on','off','soldout'].includes(p.state))fail('商品销售状态无效');
  for(const sku of activeSkus(s,p))if(!state.skus.some(x=>x.id===sku.id)){const current=getStock(s,sku);if(sku.kind!=='reservation')flow(s,role,sku,'opening',{onHand:0,reserved:0},current,'新增SKU期初库存');}
  if((wasNew||!wasOn)&&p.state==='on'&&!activeSkus(s,p).some(x=>getStock(s,x).available>0&&getStock(s,x).open))fail('可售库存为0，不能立即上架；可先保存为下架商品');
  syncLegacy(s,p);log(s,role,`${wasNew?'新建':'编辑'}演示商品 ${name}，${draft.skus.length}个SKU`);return p;
});}
export function setSellingState(state,role,ids,value,token){return atomic(state,role,'owner',token,s=>{if(!['on','off','soldout'].includes(value)||!ids.length)fail('请选择商品及有效状态');for(const pid of ids){const p=byId(s.products,pid);if(value==='on'&&!activeSkus(s,p).some(x=>getStock(s,x).available>0&&getStock(s,x).open))fail(`${p.name}没有可售库存或开放名额，不能上架`);p.state=value;p.rev=(p.rev||0)+1;}log(s,role,`演示批量${{on:'上架',off:'下架',soldout:'标售罄'}[value]} ${ids.length}件商品，未改动在库`);return {ids,value};});}
export const setProduct=(state,role,id,value)=>setSellingState(state,role,[id],value);
export function previewAdjustment(state,skuId,mode,value){
  const sku=byId(state.skus,skuId),before=getStock(state,sku);if(sku.kind==='reservation'&&mode!=='capacity')fail('预约票调整的是场次总名额，不是实物补货');if(sku.kind!=='reservation'&&!['restock','loss','count'].includes(mode))fail('请选择补货、报损或盘点');
  const n=parseQuantity(value,sku.kind,{allowZero:['count','capacity'].includes(mode)}),onHand=mode==='restock'?before.onHand+n:mode==='loss'?before.onHand-n:n;
  if(mode==='capacity'&&onHand>999)fail('场次总名额不能超过999');
  if(onHand<before.reserved)fail('调整后在库/总名额不能少于订单占用；请先处理占用订单');
  return {sku,before,after:{...before,onHand,available:onHand-before.reserved}};
}
export function adjustStock(state,role,{skuId,mode,value,reason,expectedRevision,token}){return atomic(state,role,'owner',token,s=>{
  const checked=previewAdjustment(s,skuId,mode,value),why=validateReason(reason),{sku,before,after}=checked;if(before.revision!==expectedRevision)fail('库存已变化，请关闭后刷新库存再调整');if(after.onHand===before.onHand)fail('调整前后数量相同，没有需要记录的变更');
  if(sku.kind==='reservation'){const r=byId(s.reservations,sku.slotId);r.capacity=after.onHand;r.stockRev=(r.stockRev||0)+1;}else physicalChange(s,sku,after.onHand,before.reserved);
  const result=flow(s,role,sku,mode,before,getStock(s,sku),why);syncLegacy(s,byId(s.products,sku.productId));log(s,role,`库存${FLOW_NAMES[mode]} ${sku.code}：${why}`);return result;
});}
export function createGoodsOrder(state,role,{skuId,quantity,token}){return atomic(state,role,'sales',token,s=>{
  const sku=byId(s.skus,skuId),p=byId(s.products,sku.productId),before=getStock(s,sku);if(p.state!=='on'||sku.active===false||!before.open)fail('此商品未开放销售');if(sku.kind==='weighed')fail('称重水果请在采摘称重页按实际净重收款出库');const qty=parseQuantity(quantity,'packaged'),units=qty*(sku.kind==='reservation'?sku.peoplePerUnit:1);if(units>before.available)fail('可售库存/名额不足，订单未创建');
  const o={id:id(s,'GOODS-DEMO'),skuId,productId:p.id,productName:p.name,spec:sku.label,quantity:qty,units,unit:sku.saleUnit,price:sku.price,amount:qty*sku.price,state:'reserved',paid:false,kind:sku.kind,time:now(),reservationActive:true,refund:0,admissionId:''};
  if(sku.kind==='reservation'){const r=byId(s.reservations,sku.slotId);r.booked+=units;r.stockRev=(r.stockRev||0)+1;}
  else physicalChange(s,sku,before.onHand,before.reserved+units);
  s.goodsOrders.unshift(o);flow(s,role,sku,'reserve',before,getStock(s,sku),'创建虚构订单，占用可售库存',o.id);syncLegacy(s,p);log(s,role,`创建模拟订单 ${o.id}，未发生真实支付`);return o;
});}
export function payGoodsOrder(state,role,orderId,token){return atomic(state,role,'sales',token,s=>{const o=byId(s.goodsOrders,orderId);if(o.paid)return o;if(o.state!=='reserved')fail('此订单不能再标记模拟收款');o.paid=true;o.state='ready';if(o.kind==='reservation'&&!o.admissionId){const a={id:id(s,'DEMO-CATALOG'),code:id(s,'SY'),title:o.productName,channel:'现场',amount:o.amount,state:'valid',people:o.units,time:now(),refund:0,verifiedAt:null,goodsOrderId:o.id,paymentPending:false,stockReservation:{slotId:byId(s.skus,o.skuId).slotId,units:o.units,active:true}};s.orders.unshift(a);o.admissionId=a.id;}s.receipts.unshift({id:id(s,'PAY-GOODS'),orderId:o.admissionId||o.id,goodsOrderId:o.id,type:o.kind==='reservation'?'入园券':'包装商品',channel:'现场',amount:o.amount,received:o.amount,refund:0,pending:0,fee:0,time:now()});log(s,role,`模拟确认订单收款 ${o.id}，没有真实资金流转`);return o;});}
function releaseOrder(s,role,o,reason){
  const sku=byId(s.skus,o.skuId),before=getStock(s,sku);if(o.reservationActive){if(sku.kind==='reservation'){const r=byId(s.reservations,sku.slotId);r.booked-=o.units;r.stockRev=(r.stockRev||0)+1;}else physicalChange(s,sku,before.onHand,before.reserved-o.units);o.reservationActive=false;flow(s,role,sku,'release',before,getStock(s,sku),reason,o.id);}
}
function reverseReceipt(s,o){const r=s.receipts.find(r=>r.goodsOrderId===o.id);if(r){r.refund=r.amount;r.received=0;r.pending=0;r.fee=0;}o.refund=o.paid?o.amount:0;}
export function cancelGoodsOrder(state,role,orderId,token){return atomic(state,role,'sales',token,s=>{const o=byId(s.goodsOrders,orderId);if(o.state==='cancelled')return o;if(!['reserved','ready'].includes(o.state))fail('已交付订单不能取消；退款不会自动回补生鲜库存');releaseOrder(s,role,o,'取消未履约的虚构订单，释放占用');reverseReceipt(s,o);o.state='cancelled';if(o.admissionId){const a=byId(s.orders,o.admissionId);a.state='refunded';a.refund=o.refund;a.stockReservation.active=false;}log(s,role,`取消模拟订单 ${o.id}，占用已释放`);return o;});}
export function fulfillGoodsOrder(state,role,orderId,token){return atomic(state,role,'sales',token,s=>{const o=byId(s.goodsOrders,orderId);if(o.state==='fulfilled')return o;if(o.kind==='reservation')fail('预约票请进入验券页面核销，不再次扣减名额');if(o.state!=='ready')fail('请先标记模拟收款，再确认提货');const sku=byId(s.skus,o.skuId),before=getStock(s,sku);physicalChange(s,sku,before.onHand-o.units,before.reserved-o.units);o.reservationActive=false;o.state='fulfilled';flow(s,role,sku,'fulfill',before,getStock(s,sku),'模拟提货，扣减在库并解除订单占用',o.id);log(s,role,`模拟提货 ${o.id}`);return o;});}
export function refundGoodsOrder(state,role,orderId,token){return atomic(state,role,'owner',token,s=>{const o=byId(s.goodsOrders,orderId);if(o.state==='refunded')return o;if(o.state!=='fulfilled'||o.kind==='reservation')fail('此入口仅处理已交付包装商品的模拟退款');reverseReceipt(s,o);o.state='refunded';log(s,role,`已交付商品模拟退款 ${o.id}，未自动回补生鲜库存`);return o;});}
export function collectWeight(state,role,orderId,weight,method){return atomic(state,role,'sales',null,s=>{const sku=byId(s.skus,'P02-FRESH'),before=getStock(s,sku),checked=legacy.calculateWeight((weight.gross/1000).toFixed(3),(weight.tare/1000).toFixed(3),(weight.price/100).toFixed(2));if(checked.net>before.available)fail('称重水果可售库存不足，请核对库存后再收款');const result=legacy.collectWeight(s,role,orderId,checked,method);physicalChange(s,sku,before.onHand-checked.net,before.reserved);flow(s,role,sku,'weigh',before,getStock(s,sku),'采摘称重演示收款，按净重出库',orderId);return result;});}
export function verifyVoucher(state,role,orderId){return atomic(state,role,'sales',null,s=>{const a=byId(s.orders,orderId);if(a.paymentPending)fail('此模拟订单尚未标记模拟收款，不能核销');const result=legacy.verifyVoucher(s,role,orderId);if(a.goodsOrderId){const o=byId(s.goodsOrders,a.goodsOrderId);o.state='fulfilled';const sku=byId(s.skus,o.skuId),before=getStock(s,sku);flow(s,role,sku,'redeem',before,before,'入园核销确认；已预占名额不再扣一次',o.id);}return result;});}
export function undoVoucher(state,role,orderId,reason){return atomic(state,role,'sales',null,s=>{const result=legacy.undoVoucher(s,role,orderId,reason),a=byId(s.orders,orderId);if(a.goodsOrderId)byId(s.goodsOrders,a.goodsOrderId).state='ready';return result;});}
export function refundOrder(state,role,orderId){return atomic(state,role,'owner',null,s=>{const a=byId(s.orders,orderId),result=legacy.refundOrder(s,role,orderId);if(a.goodsOrderId){const o=byId(s.goodsOrders,a.goodsOrderId);releaseOrder(s,role,o,'入园券模拟退款，释放预占名额');o.state='cancelled';o.refund=o.amount;}else if(a.stockReservation?.active){const r=byId(s.reservations,a.stockReservation.slotId),sku=s.skus.find(x=>x.slotId===r.id),before=getStock(s,sku);r.booked-=a.stockReservation.units;r.stockRev=(r.stockRev||0)+1;flow(s,role,sku,'release',before,getStock(s,sku),'未核销入园券模拟退款，释放名额',a.id);}if(a.stockReservation)a.stockReservation.active=false;return result;});}
export function saveCapacity(state,role,slotId,value,open,reason){return atomic(state,role,'owner',null,s=>{const why=validateReason(reason),slot=byId(s.reservations,slotId),sku=s.skus.find(x=>x.slotId===slotId)||{id:'SLOT-'+slotId,code:'LF-SLOT-'+slotId,label:slot.title,kind:'reservation',slotId,stockUnit:slot.unit},before=getStock(s,sku),result=legacy.saveCapacity(s,role,slotId,value,open);result.stockRev=(result.stockRev||0)+1;flow(s,role,sku,'capacity',before,getStock(s,sku),why+'；'+(open?'开放预约':'暂停预约'));return result;});}
