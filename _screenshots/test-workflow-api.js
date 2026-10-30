const assert=require('assert/strict'),crypto=require('crypto');
process.env.AUTH_SECRET='workflow-api-test';process.env.MONGODB_URI='';process.env.EDIT_REQUESTS_MONGODB_URI='';
const express=require('../server/node_modules/express'),{memoryStore}=require('../server/edit-requests-store');
const {createService,createRouter}=require('../server/workflow'),{createEditRequestsRouter}=require('../server/edit-requests');
const token=(role,phone)=>{const body=Buffer.from(JSON.stringify({role,phone,name:role,exp:Date.now()+60000})).toString('base64url');return body+'.'+crypto.createHmac('sha256',process.env.AUTH_SECRET).update(body).digest('base64url');};
(async()=>{
 const drive=await require('./drive-fixture').startDrive([{id:'test-file-0001',name:'IMG_0001.JPG'},{id:'test-file-0002',name:'IMG_0002.JPG'}]);
 const service=createService(memoryStore()),store=memoryStore(),app=express();app.use(express.json());app.use('/workflow',createRouter(service));app.use('/edit',createEditRequestsRouter(store,{workflowService:service}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const boss=token('sep','0910000004'),sale=token('sale','0910000002'),worker=token('tho-anh','0910000003'),stranger=token('tho-anh','0910000005'),customer=token('khach-hang','0910000001');
 const call=async(path,t,data)=>{const r=await fetch('http://127.0.0.1:'+server.address().port+path,{method:data?'POST':'GET',headers:{authorization:'Bearer '+t,'content-type':'application/json'},body:data?JSON.stringify(data):undefined});return {status:r.status,body:await r.json()};};
 const command=(t,c,d)=>call('/workflow/commands',t,{command:c,data:d});
 try {
  assert.equal((await call('/workflow',customer)).status,403);
  assert.equal((await command(worker,'employee',{phone:'0910000003',name:'Worker',role:'tho-anh'})).status,400);
  assert.equal((await command(boss,'employee',{phone:'0910000003',name:'Worker',role:'tho-anh'})).status,200);
  const order={id:'wf-api',code:'ABAPI01',phone:'0910000001',customerName:'Customer',service:'Newborn',pkg:'Cơ bản',price:1500000,date:'2026-11-01',time:'09:00',shooterPhone:'0910000003',editorPhone:'0910000003',salePhone:'0919999999'};
  assert.equal((await command(sale,'book',order)).status,200);
  assert.equal((await service.read()).orders[0].salePhone,'0910000002');
  const album={workflowOrderId:order.id,phone:'0919999999',orderCode:'WRONG',folderUrl:'https://drive.google.com/drive/folders/test-folder-12345',photos:[{id:'drive-test-file-0001',driveFileId:'test-file-0001',name:'IMG_0001.JPG'}]};
  assert.equal((await call('/edit/albums',worker,album)).status,400);
  const payments=await Promise.all([command(sale,'payment',{id:order.id,amount:750000,reference:'deposit-api'}),command(sale,'payment',{id:order.id,amount:750000,reference:'deposit-api'})]);
  assert.deepEqual(payments.map(r=>r.status).sort(),[200,400]);
  assert.equal((await command(worker,'checkin',{id:order.id})).status,200);assert.equal((await command(worker,'shot',{id:order.id})).status,200);
  assert.equal((await call('/edit/albums',stranger,album)).status,400);
  let r=await call('/edit/albums',worker,album);assert.equal(r.status,201);assert.equal(r.body.album.phone,order.phone);assert.equal(r.body.album.orderCode,order.code);
  const source=r.body.album;
  r=await call('/edit',customer,{orderCode:order.code,sourceAlbumId:source.id,photos:[{id:source.photos[0].id,src:source.photos[0].src,note:'Chỉnh da'}],extraFee:0});assert.equal(r.status,201);
  let req=r.body.request;
  const duplicate=await call('/edit/'+req.id+'/links',worker,{rev:req.rev,resultLink:album.folderUrl+'?usp=sharing'});
  assert.equal(duplicate.status,400);assert.equal(duplicate.body.error,'result_is_original');
  assert.equal((await store.get(req.id)).rev,req.rev);

  assert.equal((await call('/edit/'+req.id+'/links',stranger,{rev:req.rev,resultLink:'https://drive.google.com/drive/folders/edited-folder-123'})).status,403);
  r=await call('/edit/'+req.id+'/links',worker,{rev:req.rev,resultLink:'https://drive.google.com/drive/folders/edited-folder-123'});assert.equal(r.status,200);req=r.body.request;
  assert.equal(req.resultPhotos.length,2);
  const customerResults=await call('/edit/me',customer);
  assert.deepEqual(customerResults.body.requests[0].resultPhotos,req.resultPhotos);
  assert.equal((await call('/edit/'+req.id+'/complete',worker,{rev:req.rev})).status,200);
  const edited={id:'drive-edited-file-0001',name:'EDITED.JPG',src:'https://drive.google.com/thumbnail?id=edited-file-0001&sz=w1000',driveUrl:'https://drive.google.com/file/d/edited-file-0001/view'};
  const current=await store.get(req.id);await store.updateIfRev(req.id,current.rev,{resultPhotos:[edited]});
  const revise={orderCode:order.code,sourceAlbumId:source.id,photos:[{id:edited.id,src:'https://example.com/forged.jpg',fromEdited:false}],extraFee:50000};
  assert.equal((await call('/edit',customer,revise)).status,402);
  const foreign=await call('/edit',customer,{...revise,photos:[{id:'unknown-file',src:edited.src}]});
  assert.equal(foreign.status,400);assert.equal(foreign.body.error,'photo_not_in_album');

  r=await call('/workflow',worker);assert.equal(r.body.state.entries.length,2);assert.equal(r.body.state.entries.find(e=>e.kind==='edit').amount,150000);
  assert.deepEqual(r.body.state.rules,[]);assert.equal(r.body.state.orders.some(o=>o.policy),false);
  const saleView=await call('/workflow',sale);assert.equal(saleView.body.state.rules.some(r=>r.sale||r.shoot||r.edit||r.extraEditPerPhoto),false);
  assert.deepEqual((await call('/workflow',stranger)).body.state.entries,[]);
  assert.equal((await command(boss,'approve-entry',{id:order.id+':shoot'})).status,400);
  assert.equal((await command(sale,'payment',{id:order.id,amount:750000,reference:'balance-api'})).status,200);
  assert.equal((await call('/edit/'+req.id+'/feedback',customer,{feedback:'satisfied'})).status,200);
  const month=(await service.read()).entries[0].confirmedMonth;
  const payouts=await Promise.all([command(boss,'pay-month',{phone:'0910000003',month,reference:'pay-api'}),command(boss,'pay-month',{phone:'0910000003',month,reference:'pay-api'})]);assert.deepEqual(payouts.map(r=>r.status).sort(),[200,400]);
  await call('/workflow',boss);await call('/workflow',boss);
  const final=await service.read();assert.equal(final.entries.length,3);assert.equal(final.orders[0].status,'delivered');
  assert.equal((await call('/edit',customer,{orderCode:order.code,sourceAlbumId:source.id,parentRequestId:req.id,photos:[{id:source.photos[0].id,src:source.photos[0].src}],extraFee:50000})).status,402);
  const paymentCode=order.code+'CS1ABCD';
  require('../server/payment-receipts').incomingTx.push({id:'extra-bank-tx',content:paymentCode,amount:50000,at:Date.now()});
  r=await call('/edit',customer,{...revise,parentRequestId:req.id,paymentCode});assert.equal(r.status,201);
  assert.equal(r.body.request.extraFee,50000);assert.equal(r.body.request.photos[0].fromEdited,true);
  assert.equal(r.body.request.photos[0].src,edited.src);assert.equal(r.body.request.photos[0].name,edited.name);
  // A failed Drive read must retain the usable result link and clear the old preview.
  const driveModule=require('../server/drive'),readFolder=driveModule.readFolder;
  driveModule.readFolder=async()=>{throw new Error('fixture failure');};
  let fallback;
  try { fallback=await call('/edit/'+req.id+'/links',worker,{rev:(await store.get(req.id)).rev,resultLink:'https://drive.google.com/drive/folders/unavailable-folder'}); }
  finally { driveModule.readFolder=readFolder; }
  assert.equal(fallback.status,200);assert.equal(fallback.body.request.resultPreviewUnavailable,true);
  assert.deepEqual(fallback.body.request.resultPhotos,[]);assert.match(fallback.body.request.resultLink,/unavailable-folder/);

  assert.equal((await service.read()).orders[0].collected,1550000);assert.equal((await service.read()).orders[0].extraFees,50000);
  await call('/workflow',boss);assert.equal((await service.read()).orders[0].collected,1550000);
  // Independent order exercises two rounds in flight, without a parent request.
  const parallel={...order,id:'wf-parallel',code:'ABPARALLEL',date:'2026-11-02'};
  assert.equal((await command(sale,'book',parallel)).status,200);
  assert.equal((await command(sale,'payment',{id:parallel.id,amount:1500000,reference:'parallel-package'})).status,200);
  await command(worker,'checkin',{id:parallel.id});await command(worker,'shot',{id:parallel.id});
  const pa=(await call('/edit/albums',worker,{...album,workflowOrderId:parallel.id})).body.album;
  const payload=i=>({orderCode:parallel.code,sourceAlbumId:pa.id,photos:[{id:pa.photos[i].id,src:pa.photos[i].src}],extraFee:i?50000:0});
  let first=(await call('/edit',customer,payload(0))).body.request;
  assert.equal(first.round,1);assert.equal(first.extraFee,0);
  assert.equal((await call('/edit',customer,{...payload(0),extraFee:50000})).body.error,'photo_already_submitted');
  assert.equal((await call('/edit',customer,payload(1))).status,402);
  const parallelCode=parallel.code+'CS1EFGH';
  require('../server/payment-receipts').incomingTx.push({id:'parallel-bank-tx',content:parallelCode,amount:50000,at:Date.now()});
  const secondResponse=await call('/edit',customer,{...payload(1),paymentCode:parallelCode});assert.equal(secondResponse.status,201);
  let second=secondResponse.body.request;assert.equal(second.round,2);assert.equal(second.extraFee,50000);assert.equal(second.parentRequestId,'');
  async function finish(request) {
    const linked=await call('/edit/'+request.id+'/links',worker,{rev:request.rev,resultLink:'https://drive.google.com/drive/folders/parallel-edited'});assert.equal(linked.status,200);
    const done=await call('/edit/'+request.id+'/complete',worker,{rev:linked.body.request.rev});assert.equal(done.status,200);return done.body.request;
  }
  second=await finish(second);
  assert.equal((await service.reconcile()).orders.find(o=>o.id===parallel.id).status,'editing');
  assert.notEqual((await store.get(first.id)).status,'Hoàn thành');
  await call('/edit/'+second.id+'/feedback',customer,{feedback:'satisfied'});
  let ledger=await service.reconcile();
  assert.equal(ledger.entries.find(e=>e.id===second.id+':extra-edit').status,'approved');
  assert.equal(ledger.entries.find(e=>e.orderId===parallel.id && e.kind==='shoot').status,'pending');
  first=await finish(first);
  ledger=await service.reconcile();assert.equal(ledger.orders.find(o=>o.id===parallel.id).status,'delivered');
  assert.equal(ledger.entries.find(e=>e.id===first.id+':edit').status,'pending');
  await call('/edit/'+first.id+'/feedback',customer,{feedback:'satisfied'});
  ledger=await service.reconcile();assert.equal(ledger.entries.find(e=>e.id===first.id+':edit').status,'approved');
  assert.equal(ledger.entries.find(e=>e.id===second.id+':extra-edit').status,'approved');
  console.log('PASS: round 2 before round 1 delivery, 402 without payment, duplicate photo blocked, independent completion and satisfaction settlement');
  console.log('PASS: real authenticated booking → deposit → assigned shoot → authoritative source delivery → editing → ledger → boss payout; concurrent duplicates and role restrictions');
 } finally {await new Promise(r=>server.close(r));await new Promise(r=>drive.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
