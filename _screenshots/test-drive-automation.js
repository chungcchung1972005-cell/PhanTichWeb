// Offline Google API double: no credentials or real Drive access.
const assert=require('assert/strict'),crypto=require('crypto');
process.env.AUTH_SECRET='drive-auto-test';process.env.EDIT_REQUESTS_MONGODB_URI='';process.env.MONGODB_URI='';
const {memoryStore}=require('../server/edit-requests-store');
const {createSyncStore}=require('../server/drive-sync-store');
const {createWriter}=require('../server/drive');
const {createService,syncHandler}=require('../server/drive-sync');
const express=require('../server/node_modules/express');
const {createEditRequestsRouter}=require('../server/edit-requests');
let checks=0;const check=(v)=>{assert.ok(v);checks++;};
const token=(role,phone)=>{const b=Buffer.from(JSON.stringify({role,phone,name:'Customer <&>',exp:Date.now()+60000})).toString('base64url');return b+'.'+crypto.createHmac('sha256',process.env.AUTH_SECRET).update(b).digest('base64url');};
(async()=>{
 let files=[{id:'aloha',name:'ALOHA',parents:['root'],mimeType:'application/vnd.google-apps.folder'},{id:'order-dir',name:' a b 0 1 ',parents:['aloha'],mimeType:'application/vnd.google-apps.folder'},{id:'goc',name:'GOC',parents:['order-dir'],mimeType:'application/vnd.google-apps.folder'},{id:'one',name:'<one>.jpg',parents:['goc'],mimeType:'image/jpeg',size:'10',modifiedTime:'1'},{id:'zero',name:'zero.jpg',parents:['goc'],mimeType:'image/jpeg',size:'0'},{id:'text',name:'ignore.txt',parents:['goc'],mimeType:'text/plain',size:'10'}];
 let copies=[],uploads=[],shares=[],fail=false,hold,started,seq=0,changes=0;
 const writer=createWriter({auth:{getAccessToken:async()=> 'fake'},fetch:async(url,init)=>{
   const u=new URL(url);let result={};const b=init.body;
   if(u.pathname.endsWith('startPageToken'))result={startPageToken:'first'};
   else if(u.pathname.endsWith('/changes')){changes++;if(hold){started();await hold;}result={changes:[],newStartPageToken:'cursor-'+changes};}
   else if(u.pathname.endsWith('/permissions')){shares.push(JSON.parse(b));result={id:'perm'};}
   else if(u.pathname.endsWith('/copy')){const id=u.pathname.split('/').at(-2);if(fail&&id==='edited')return new Response('{}',{status:403});const data=JSON.parse(b);result={...data,id:'copy-'+(++seq),mimeType:'image/jpeg'};files.push(result);copies.push({source:id,...result});}
   else if(u.pathname.startsWith('/upload')){uploads.push(b);result={id:'html-'+(++seq)};files.push({id:result.id,name:'YEU-CAU-CHINH.html',parents:[files.find(f=>f.name==='CAN-CHINH').id]});}
   else if(init.method==='POST'){result={id:'folder-'+(++seq),...JSON.parse(b)};files.push(result);}
   else {const q=u.searchParams.get('q');const parent=q.match(/^'([^']+)'/)[1];const name=q.match(/name = '([^']+)'/);result={files:files.filter(f=>f.parents?.includes(parent)&&(!name||f.name===name[1]))};}
   return new Response(JSON.stringify(result),{status:200,headers:{'content-type':'application/json'}});
 }});
 const store=memoryStore(),state=memoryStore(),syncStore=createSyncStore(state);
 const order={id:'o1',code:'AB01',phone:'0911111111',customerName:'Customer',shooterPhone:'0922222222',editorPhone:'0922222222',status:'shot'};
 const workflow={read:async()=>({orders:[order]}),attachRequestsStore(){},originalDelivered:async(id,album)=>{if(['shot','choosing'].includes(order.status)){order.status='choosing';order.sourceAlbumId=album;}} ,progress:async()=>{order.status='editing';}};
 const sync=createService({store,workflow,syncStore,drive:writer,enabled:()=>true,env:{}});
 await sync.syncOnce();check((await store.count())===0);check(await syncStore.getRoot()==='aloha');check(await syncStore.getFolder('o1')==='order-dir');check(await syncStore.getCursor()==='cursor-1');
 files.find(f=>f.id==='one').size='11';await sync.syncOnce();check(await store.count()===0);
 await sync.syncOnce();let album=(await store.listAll())[0];check(album.photos.length===1);check(album.photos[0].driveFileId==='one');check(order.status==='choosing');
 await sync.syncOnce();check(await store.count()===1);check((await store.get(album.id)).id===album.id);
 files.push({id:'two',name:'two.png',parents:['goc'],mimeType:'image/png',size:'3',modifiedTime:'2'});await sync.syncOnce();check((await store.get(album.id)).photos.length===1);await sync.syncOnce();check((await store.get(album.id)).photos.length===2);
 let release;hold=new Promise(r=>release=r);const ready=new Promise(r=>started=r);const first=sync.syncOnce();await ready;check((await sync.syncOnce()).locked);release();await first;hold=null;
 const off=createService({store,workflow,syncStore,drive:writer,enabled:()=>false});const before=changes;check((await off.syncOnce()).disabled);check(off.enqueue('x')===undefined);off.kick();check(changes===before);check(!off.start());
 const app=express();app.use(express.json());app.post('/sync',syncHandler(sync,{DRIVE_SYNC_KEY:'test-key'}));app.use('/edit',createEditRequestsRouter(store,{workflowService:workflow,driveSync:sync}));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const call=async(path,role,phone,data,key)=>{const r=await fetch('http://127.0.0.1:'+server.address().port+path,{method:'POST',headers:{authorization:'Bearer '+token(role,phone),'content-type':'application/json','x-sync-key':key||''},body:JSON.stringify(data||{})});return {status:r.status,body:await r.json()};};
 try {
  check((await call('/sync','sep','0933333333',{},'bad')).status===401);check((await call('/sync','sep','0933333333',{},'test-key')).status===200);
  const selected=[{...album.photos[0],note:'<script>x</script>',editOptions:['Chỉnh da']}];
  const r=await call('/edit','khach-hang',order.phone,{orderCode:order.code,sourceAlbumId:album.id,photos:selected,note:'<img onerror="x"> &',extraFee:0});check(r.status===201);check(!r.body.request.driveJob);await sync.enqueue(r.body.request.id);
  let rec=await store.get(r.body.request.id);check(rec.driveJob.status==='done');check(copies.length===1&&copies[0].source==='one');check(copies[0].name==='<one>.jpg');check(!!rec.driveJob.inputFolderId&&!!rec.driveJob.outputFolderId);check(files.some(f=>f.name==='LUOT-1'));check(files.filter(f=>f.parents?.includes(rec.driveJob.outputFolderId)).length===0);check(uploads.length===1);check(uploads[0].includes('&lt;script&gt;')&&!uploads[0].includes('<script>'));check(uploads[0].includes('&lt;img onerror=&quot;x&quot;&gt; &amp;'));check(uploads[0].includes('drive.google.com/thumbnail?id=one'));check(shares.every(p=>p.type==='anyone'&&p.role==='reader'));
  await sync.enqueue(rec.id);check(copies.length===1&&uploads.length===1);
  const retryId='ER-retry-1234abcd';await store.insert({...rec,id:retryId,round:2,rev:1,photos:[selected[0],{id:'drive-edited',driveFileId:'edited',name:'edited.jpg',note:'',editOptions:[]}],driveJob:{status:'pending'}});fail=true;
  const job=sync.enqueue(retryId);check(job===sync.enqueue(retryId));await job;rec=await store.get(retryId);check(rec.driveJob.status==='error');check(Object.keys(rec.driveJob.copies).length===1);
  check((await call('/edit/'+retryId+'/drive-retry','sep','0933333333')).status===403);check((await call('/edit/'+retryId+'/drive-retry','tho-anh','0944444444')).status===403);fail=false;
  check((await call('/edit/'+retryId+'/drive-retry','tho-anh',order.editorPhone)).status===202);await sync.enqueue(retryId);rec=await store.get(retryId);check(rec.driveJob.status==='done');check(copies.filter(c=>c.appProperties.alohaRequest===retryId&&c.source==='one').length===1);check(copies.some(c=>c.source==='edited'));check(files.some(f=>f.name==='LUOT-2'));
  // New originals still enter the source album after the order moved into editing.
  files.push({id:'late',name:'late.jpg',parents:['goc'],mimeType:'image/jpeg',size:'7'});
  await sync.syncOnce();check(!(await store.get(album.id)).photos.some(p=>p.driveFileId==='late'));
  await sync.syncOnce();check((await store.get(album.id)).photos.some(p=>p.driveFileId==='late'));check(order.status==='editing');
  const paidBefore=copies.length,recordsBefore=await store.count();
  const unpaid=await call('/edit','khach-hang',order.phone,{orderCode:order.code,sourceAlbumId:album.id,photos:[{id:'drive-two',src:'https://example.com/a.jpg'}],extraFee:50000});
  check(unpaid.status===402);check(copies.length===paidBefore && await store.count()===recordsBefore);

  // Recover after remote copy succeeded but local mapping was lost.
  await store.updateIfRev(retryId,rec.rev,{driveJob:{...rec.driveJob,status:'error',copies:{}}});const n=copies.length;await sync.enqueue(retryId);check(copies.length===n);
  let clock=0;const throttle=createService({store,workflow,syncStore,drive:writer,enabled:()=>true,env:{},now:()=>clock});const c=changes;throttle.kick();throttle.kick();await new Promise(r=>setTimeout(r,20));check(changes===c+1);clock=30001;throttle.kick();await new Promise(r=>setTimeout(r,20));check(changes===c+2);
  const overridden=createService({store,workflow,syncStore,drive:writer,enabled:()=>true,env:{ALOHA_DRIVE_ROOT_ID:'override'}});
  await overridden.syncOnce();check(await syncStore.getRoot()==='override');check(files.some(f=>f.parents?.includes('override')&&f.name==='AB01'));
  const freshStore=createSyncStore(memoryStore());files=files.filter(f=>f.id!=='aloha');
  const fresh=createService({store:memoryStore(),workflow:{read:async()=>({orders:[]})},syncStore:freshStore,drive:writer,enabled:()=>true,env:{}});
  await fresh.syncOnce();check(!!await freshStore.getRoot());
  const freshWithOrder=createService({store:memoryStore(),workflow:{read:async()=>({orders:[{...order,status:'shot'}]})},syncStore:freshStore,drive:writer,enabled:()=>true,env:{}});
  await freshWithOrder.syncOnce();check(!!await freshStore.getRoot());check(files.some(f=>f.name==='ALOHA'&&f.parents.includes('root')));
  console.log(`${checks}/${checks} PASS drive automation (offline)`);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
