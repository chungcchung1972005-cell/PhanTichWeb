// Tài khoản khách demo: làm mới về "vừa nhận ảnh gốc" (xoá yêu cầu chỉnh, đơn về choosing, bỏ tiền công chỉnh chưa trả).
const assert=require('assert/strict');
process.env.AUTH_SECRET='demo-reset-test';process.env.MONGODB_URI='';process.env.EDIT_REQUESTS_MONGODB_URI='';
const {memoryStore}=require('../server/edit-requests-store');
const {createService}=require('../server/workflow'),{resetCustomer}=require('../server/edit-requests');
(async()=>{
  let checks=0;const ok=(c,m)=>{assert.ok(c,m);checks++;};
  const rs=memoryStore(),ws=memoryStore(),wf=createService(ws);
  const order={id:'o1',code:'X1',status:'delivered',rounds:{r1:{deliveredAt:1}},requestIds:['request:r1'],firstRequestId:'r1',extraFees:50000,deliveredAt:1,customerFeedback:'satisfied',payments:[],collected:0};
  const other={...order,id:'o2',code:'X2'};
  const entries=[{id:'e1',orderId:'o1',kind:'edit',status:'approved'},{id:'e2',orderId:'o1',kind:'edit',status:'paid'},{id:'e3',orderId:'o1',kind:'shoot',status:'pending'},{id:'e4',orderId:'o2',kind:'edit',status:'pending'}];
  const base=await wf.read();await ws.updateIfRev(base.id,base.rev,{orders:[order,other],entries});
  await rs.insert({id:'AL1',kind:'source-album',phone:'0900000001',workflowOrderId:'o1',createdAt:1,updatedAt:1,rev:1});
  await rs.insert({id:'R1',phone:'0900000001',status:'Hoàn thành',createdAt:2,updatedAt:2,rev:1});
  await rs.insert({id:'R2',phone:'0911111111',status:'Hoàn thành',createdAt:3,updatedAt:3,rev:1});
  await resetCustomer(rs,wf,'0900000001');
  const after=await wf.read();
  const o1=after.orders.find(o=>o.id==='o1'),o2=after.orders.find(o=>o.id==='o2');
  ok(o1.status==='choosing'&&o1.requestIds.length===0&&!o1.customerFeedback&&o1.extraFees===0,'đơn demo về đang chọn ảnh');
  ok(o2.status==='delivered','đơn khác giữ nguyên');
  ok(after.entries.map(e=>e.id).sort().join()==='e2,e3,e4','chỉ bỏ tiền công chỉnh chưa trả của đơn demo');
  ok(!(await rs.get('R1')),'xoá yêu cầu chỉnh của khách demo');
  ok(!!(await rs.get('AL1')),'giữ bộ ảnh gốc');
  ok(!!(await rs.get('R2')),'không đụng khách khác');
  console.log('PASS demo reset: '+checks+' checks');
})().catch(e=>{console.error(e);process.exitCode=1;});
