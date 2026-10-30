import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,can,verifyVoucher,undoVoucher,calculateWeight,collectWeight,transitionDrink,setProduct,saveCapacity,settleReward,refundOrder,ledger,getVoucher,validateState} from '../src/business-model.js';

test('完整验券 → 称重 → 独立收款闭环，重复操作不产生第二笔收款',()=>{
 const s=seed(),before=ledger(s),count=s.receipts.length;
 verifyVoucher(s,'front','DEMO-1001');
 assert.equal(getVoucher(s,'sy1001').state,'verified');
 assert.throws(()=>verifyVoucher(s,'front','DEMO-1001'),/重复/);
 const w=calculateWeight('1.850','0.150','40.00');
 assert.deepEqual(w,{gross:1850,tare:150,net:1700,price:4000,jin:3.4,amount:13600});
 const receipt=collectWeight(s,'front','DEMO-1001',w,'现场');
 assert.equal(receipt.amount,13600);
 assert.equal(getVoucher(s,'SY1001').state,'complete');
 assert.equal(s.receipts.length,count+1);
 assert.equal(ledger(s).received-before.received,13600);
 assert.equal(s.orders[0].amount,5800);
 assert.throws(()=>collectWeight(s,'front','DEMO-1001',w,'现场'),/重复/);
 assert.equal(s.receipts.length,count+1);
 assert.throws(()=>undoVoucher(s,'front','DEMO-1001','误选'),/仅可撤销/);
});
test('重量和金额精度：使用克与分，按斤计价，金额四舍五入到分',()=>{
 assert.equal(calculateWeight('0.503','0.100','39.90').amount,3216);
 assert.equal(calculateWeight('1.000','0','0.01').amount,2);
 assert.equal(calculateWeight('0.001','0','3.33').amount,1);
 assert.equal(calculateWeight('100','0','10000').amount,200000000);
});
for(const [name,args] of [
 ['负毛重',['-1','0.1','40']],['负皮重',['1','-0.1','40']],['负单价',['1','0','-1']],
 ['毛重为零',['0','0','40']],['皮重大于毛重',['1','1.1','40']],['净重为零',['1','1','40']],
 ['空值',['','0','40']],['缺失值',[undefined,'0','40']],['非数字',['abc','0','40']],
 ['无穷大',['Infinity','0','40']],['超范围',['101','0','40']],['超重量精度',['1.0001','0','40']],
 ['超单价精度',['1','0','40.001']],['科学计数法',['1e2','0','40']]
]) test('拒绝无效称重：'+name,()=>assert.throws(()=>calculateWeight(...args)));
test('过期、已退款、已核销券拒绝再核销；未知券不匹配',()=>{
 const s=seed();assert.equal(getVoucher(s,'UNKNOWN'),null);
 for(const id of ['DEMO-1004','DEMO-1005','DEMO-1006','DEMO-1007'])assert.throws(()=>verifyVoucher(s,'front',id));
 assert.throws(()=>collectWeight(s,'front','DEMO-1001',calculateWeight('1','0','40'),'现场'),/先完成/);
});
test('撤销原因必填，撤销不退款，可重新核销',()=>{
 const s=seed(),before=ledger(s);verifyVoucher(s,'front','DEMO-1001');
 assert.throws(()=>undoVoucher(s,'front','DEMO-1001',''),/原因/);
 undoVoucher(s,'front','DEMO-1001','误选演示订单');
 assert.equal(getVoucher(s,'SY1001').state,'valid');assert.deepEqual(ledger(s),before);
 assert.throws(()=>undoVoucher(s,'front','DEMO-1001','误选'));
 verifyVoucher(s,'front','DEMO-1001');assert.equal(getVoucher(s,'SY1001').state,'verified');
});
test('抖音示例撤销超过一小时拒绝；窗口内允许',()=>{
 const s=seed();verifyVoucher(s,'front','DEMO-1002');
 s.orders[1].verifiedEpoch=Date.now()-3600001;
 assert.throws(()=>undoVoucher(s,'front','DEMO-1002','误选'),/1 小时/);
 s.orders[1].verifiedEpoch=Date.now()-3599000;
 undoVoucher(s,'front','DEMO-1002','误选');assert.equal(s.orders[1].state,'valid');
});
test('演示角色限制：饮品员工无法验券，前台不能改商品、容量或退款',()=>{
 const s=seed();assert.equal(can('bar','ledger'),false);assert.equal(can('front','rewards'),false);
 assert.throws(()=>verifyVoucher(s,'bar','DEMO-1001'),/权限/);
 assert.throws(()=>collectWeight(s,'bar','DEMO-1004',calculateWeight('1','0','40'),'现场'),/权限/);
 assert.throws(()=>setProduct(s,'front','P01','off'),/权限/);
 assert.throws(()=>saveCapacity(s,'front','R01',30,true),/老板/);
 assert.throws(()=>refundOrder(s,'front','DEMO-1001'),/权限/);
 assert.throws(()=>settleReward(s,'front','RW01'),/权限/);
});
test('饮品制作按顺序流转，重复点击带旧状态会被拒绝',()=>{
 const s=seed();transitionDrink(s,'bar','DRINK-021','waiting');
 assert.throws(()=>transitionDrink(s,'bar','DRINK-021','waiting'),/重复/);
 transitionDrink(s,'bar','DRINK-021','making');transitionDrink(s,'bar','DRINK-021','ready');
 assert.equal(s.drinks[0].state,'done');assert.throws(()=>transitionDrink(s,'bar','DRINK-021','done'),/完成/);
});
test('商品上下架与售罄恢复；按斤商品不转换为计件库存',()=>{
 const s=seed();setProduct(s,'owner','P01','off');assert.equal(s.products[0].stock,40);
 setProduct(s,'owner','P01','soldout');assert.equal(s.products[0].stock,0);
 assert.throws(()=>setProduct(s,'owner','P01','on',0));
 assert.throws(()=>setProduct(s,'owner','P01','on',1.5));
 setProduct(s,'owner','P01','on',18);assert.equal(s.products[0].stock,18);
 setProduct(s,'owner','P02','soldout');assert.equal(s.products[1].stock,null);
 setProduct(s,'owner','P02','on');assert.equal(s.products[1].stock,null);
});
test('预约容量不能低于已约，不能负数/小数；暂停保留预约',()=>{
 const s=seed();for(const n of [21,-1,22.5,'',1000]) assert.throws(()=>saveCapacity(s,'owner','R01',n,false));
 saveCapacity(s,'owner','R01',22,false);assert.equal(s.reservations[0].booked,22);assert.equal(s.reservations[0].open,false);
 saveCapacity(s,'owner','R01',40,true);assert.equal(s.reservations[0].capacity,40);
});
test('退款冲回奖励、渠道账目和待结算，重复退款拒绝',()=>{
 const s=seed();refundOrder(s,'owner','DEMO-1001');
 assert.equal(s.rewards[0].status,'adjusted');assert.equal(s.rewards[0].adjustment,-580);
 assert.equal(s.receipts[0].refund,5800);assert.equal(s.receipts[0].received,0);
 assert.throws(()=>refundOrder(s,'owner','DEMO-1001'));
 refundOrder(s,'owner','DEMO-1002');assert.equal(s.receipts[1].pending,0);assert.equal(s.receipts[1].fee,0);
 const l=ledger(s);assert.equal(l.amount-l.refund-l.fee,l.received+l.pending);
});
test('奖励结算需要完成体验，结算操作幂等',()=>{
 const s=seed();assert.throws(()=>settleReward(s,'owner','RW01'),/完成/);
 verifyVoucher(s,'owner','DEMO-1001');collectWeight(s,'owner','DEMO-1001',calculateWeight('1','0','40'),'微信');
 settleReward(s,'owner','RW01');assert.equal(s.rewards[0].status,'settled');
 assert.throws(()=>settleReward(s,'owner','RW01'),/重复/);
});
test('账目恒等式逐渠道成立，实收与待结算没有重复累计',()=>{
 const s=seed();for(const channel of ['全部','微信','抖音','美团','现场']){const l=ledger(s,channel);assert.equal(l.amount-l.refund-l.fee,l.received+l.pending);}
 assert.equal(ledger(s,'抖音').received,0);assert.ok(ledger(s,'抖音').pending>0);
});
test('演示存储结构有版本校验；初始完整订单均具有关联采摘收款',()=>{
 const s=seed();assert.ok(validateState(s));assert.equal(validateState(null),false);assert.equal(validateState({version:2}),false);
 for(const row of s.orders.filter(x=>x.state==='complete'))assert.ok(s.receipts.some(p=>p.orderId===row.id&&p.type==='采摘称重'));
});
