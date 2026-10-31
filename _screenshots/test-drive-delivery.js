// Offline Drive delivery: fake Google, real stores, router and conditional writes.
const assert=require('assert/strict'),crypto=require('crypto');
process.env.AUTH_SECRET='delivery-test';process.env.EDIT_REQUESTS_MONGODB_URI='';process.env.MONGODB_URI='';
const {memoryStore}=require('../server/edit-requests-store');
const {createSyncStore}=require('../server/drive-sync-store');
const {createService}=require('../server/drive-sync');
const {matchPhotos}=require('../server/drive-delivery');
const {createEditRequestsRouter}=require('../server/edit-requests');
const express=require('../server/node_modules/express');
let checks=0;function check(v,label){assert.ok(v,label);checks++;}
(async()=>{
 let clock=1000000, files=[], listed=0, events=[];
 const store=memoryStore(), syncStore=createSyncStore(memoryStore());
 const workflow={read:async()=>({orders:[]}),attachRequestsStore(){},progress:async(r,e)=>events.push([r,e])};
 const drive={getStartPageToken:async()=>({startPageToken:'x'}),listChanges:async()=>({newStartPageToken:'x'}),listFiles:async()=>{listed++;return files;}};
 const options={store,syncStore,workflow,drive,enabled:()=>true,env:{ALOHA_DRIVE_ROOT_ID:'root'},now:()=>clock};
 let sync=createService(options);
 const req={id:'ER-delivery-1234abcd',rev:1,phone:'0911111111',workflowOrderId:'order',photos:[{id:'p1',name:'A.CR3'},{id:'p2',name:'B.JPG'}],photoCount:2,status:'Đang thực hiện',driveJob:{status:'done',outputFolderId:'output-folder'},messages:[],createdAt:1,updatedAt:1};
 const file=(id,name,extra={})=>({id,name,mimeType:'image/jpeg',size:'10',modifiedTime:new Date(clock-180000).toISOString(),...extra});
 await store.insert(req);
 files=[file('a','a_edit.JPG'),file('empty','B.jpg',{size:'0'}),file('text','B.jpg',{mimeType:'text/plain'})];
 await sync.syncOnce();let r=await store.get(req.id);
 check(r.driveJob.delivery.matched===1,'extension and suffix');check(r.driveJob.delivery.missing[0]==='B.JPG','missing reported');check(r.status!=='Hoàn thành','missing never delivers');
 files.push(file('b','b-final.png'),file('unknown','stranger.jpg'));
 await sync.syncOnce();check((await store.get(req.id)).status!=='Hoàn thành','first scan waits');
 clock+=59000;await sync.syncOnce();check((await store.get(req.id)).status!=='Hoàn thành','less than 60 seconds waits');
 // A changed signature starts the observation interval again.
 files[0].size='11';clock+=1000;await sync.syncOnce();clock+=60000;
 files[0].modifiedTime=new Date(clock-10000).toISOString();await sync.syncOnce();clock+=60000;
 await sync.syncOnce();check((await store.get(req.id)).status!=='Hoàn thành','recent modification waits even after 60 seconds');
 clock+=60000;
 // Separate service instances model concurrent workers; only one CAS wins.
 sync=createService(options);const second=createService(options);
 await Promise.all([sync.syncOnce(),second.syncOnce()]);r=await store.get(req.id);
 check(r.status==='Hoàn thành','stable complete delivers');check(events.length===1&&events[0][1]==='delivered','workflow delivered exactly once');
 check(r.doneIds.join(',')==='p1,p2','all done ids');check(r.resultPhotos.map(p=>p.driveFileId).join(',')==='a,b','request order retained');
 check(r.resultLink.endsWith('/output-folder')&&r.completedAt===clock&&r.resultLinkAt===clock,'folder link and times');
 check(r.driveJob.delivery.status==='delivered'&&r.driveJob.delivery.unknown[0]==='stranger.jpg','unknown does not block');
 await sync.syncOnce();check(events.length===1,'subsequent scans skip completed');
 const app=express();app.use(express.json());app.use('/edit',createEditRequestsRouter(store,{workflowService:workflow,driveSync:sync}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try {
 const b=Buffer.from(JSON.stringify({role:'khach-hang',phone:req.phone,exp:Date.now()+60000})).toString('base64url');
 const token=b+'.'+crypto.createHmac('sha256',process.env.AUTH_SECRET).update(b).digest('base64url');
 const response=await fetch('http://127.0.0.1:'+server.address().port+'/edit/me',{headers:{authorization:'Bearer '+token}});
 const data=await response.json();check(response.status===200,'customer me succeeds');
 check(JSON.stringify(data).includes('drive-a')&&!JSON.stringify(data).includes('driveJob'),'customer sees result photos without internal job');
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 // Ambiguous output and duplicate original basenames both block delivery.
 await store.insert({...req,id:'ER-duplicate-1234abcd',driveJob:{...req.driveJob,outputFolderId:'dupe-folder'}});
 files=[file('a','a.jpg'),file('a2','a_edit.png'),file('b','b.jpg')];await sync.syncOnce();clock+=180000;await sync.syncOnce();
 r=await store.get('ER-duplicate-1234abcd');check(r.status!=='Hoàn thành'&&r.driveJob.delivery.error.includes('Nhiều file khớp'),'ambiguous output blocks');
 await store.insert({...req,id:'ER-basenames-1234abcd',photos:[{id:'a',name:'A.CR3'},{id:'b',name:'a.JPG'}]});
 files=[file('a','a.jpg')];await sync.syncOnce();clock+=180000;await sync.syncOnce();
 r=await store.get('ER-basenames-1234abcd');check(r.status!=='Hoàn thành'&&r.driveJob.delivery.error.includes('Trùng tên gốc'),'duplicate original basenames block');
 check(matchPhotos([{name:'X.CR3'},{name:'X_edit.CR3'}],[file('x','x.jpg'),file('xe','x_edit.jpg')]).errors.length>0,'overlapping suffix names block ambiguous delivery');
 check(matchPhotos([{name:'X.CR3'}],[file('x','x_CUSTOM.jpg')],['_custom']).matches[0].length===1,'custom literal suffix');
 for(const suffix of ['_edit','-edit','_final','-final','_retouch',' (1)'])check(matchPhotos([{name:'X.CR3'}],[file('x','x'+suffix+'.jpg')]).matches[0].length===1,'default suffix '+suffix);
 await store.insert({...req,id:'ER-manual-1234abcd',status:'Hoàn thành',resultLink:'https://example.com/manual'});
 // Remove other pending fixtures, so any Google listing would be a failure.
 for(const id of ['ER-duplicate-1234abcd','ER-basenames-1234abcd']){const current=await store.get(id);await store.updateIfRev(id,current.rev,{status:'Hoàn thành'});}
 const before=listed;await sync.syncOnce();check(listed===before,'manual delivery skipped');
 check((await store.get('ER-manual-1234abcd')).resultLink==='https://example.com/manual','manual link retained');
 // A manual completion while Google is listing must win without being overwritten.
 await store.insert({...req,id:'ER-race-1234abcd'});files=[file('a','a.jpg'),file('b','b.jpg')];
 await sync.syncOnce();clock+=180000;
 let release, entered;const gate=new Promise(resolve=>release=resolve), ready=new Promise(resolve=>entered=resolve);
 const racing=createService({...options,drive:{...drive,listFiles:async()=>{entered();await gate;return files;}}});
 const scanning=racing.syncOnce();await ready;
 const current=await store.get('ER-race-1234abcd');
 await require('../server/edit-delivery').complete({store,workflow,request:current,set:{resultLink:'https://example.com/manual-race'}});
 const eventCount=events.length;release();await scanning;
 check((await store.get(current.id)).resultLink==='https://example.com/manual-race','manual completion during scan wins');
 check(events.length===eventCount,'losing automatic writer never calls workflow');
 // Khớp tay: thợ đổi tên khác hẳn, tự chỉ file nào là bản sửa của ảnh nào.
 const P=[{id:'p1',name:'A.CR3'},{id:'p2',name:'B.JPG'}];
 let mm=matchPhotos(P,[file('z','IMG_9999.jpg'),file('b','B_final.jpg')],undefined,{z:'p1'});
 check(mm.matches[0][0]?.id==='z'&&mm.matches[1][0]?.id==='b'&&!mm.unknown.length&&!mm.errors.length,'manual match fills photo, name match still works');
 mm=matchPhotos(P,[file('z','IMG_9999.jpg'),file('a','A_edit.jpg')],undefined,{z:'p1'});
 check(mm.matches[0].length===1&&mm.matches[0][0].id==='z'&&mm.unknown[0]==='A_edit.jpg','manual match wins over name match');
 mm=matchPhotos(P,[file('z','IMG_9999.jpg')],undefined,{z:'nope'});
 check(mm.unknown[0]==='IMG_9999.jpg','manual to unknown photo ignored');
 mm=matchPhotos(P,[file('z','x.jpg'),file('y','y.jpg')],undefined,{z:'p1',y:'p1'});
 check(mm.errors.some(e=>e.includes('Nhiều file khớp')),'two manual files to one photo blocks');
 // Route + tự giao sau khi khớp tay
 const mreq={...req,id:'ER-matchtay-1234abcd',editorPhone:'0911000003',status:'Đang thực hiện',driveJob:{status:'done',outputFolderId:'match-folder'}};
 await store.insert(mreq);
 files=[file('z','IMG_9999.jpg'),file('w','DSC_1.jpg')];
 const app2=express();app2.use(express.json());app2.use('/edit',createEditRequestsRouter(store,{workflowService:workflow,driveSync:sync,drive}));
 const srv2=app2.listen(0,'127.0.0.1');await new Promise(r2=>srv2.once('listening',r2));
 const tok=(role,phone)=>{const x=Buffer.from(JSON.stringify({role,phone,exp:Date.now()+60000})).toString('base64url');return x+'.'+crypto.createHmac('sha256',process.env.AUTH_SECRET).update(x).digest('base64url');};
 const call=(path,role,phone,body)=>fetch('http://127.0.0.1:'+srv2.address().port+'/edit/'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+tok(role,phone),'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
 try{
  let res=await call(mreq.id+'/output-files/z/match','khach-hang',mreq.phone,{photoId:'p1'});check(res.status===403||res.status===404,'customer cannot match');
  res=await call(mreq.id+'/output-files/z/match','tho-anh','0911000099',{photoId:'p1'});check(res.status===403,'other editor cannot match');
  res=await call(mreq.id+'/output-files/z/match','tho-anh','0911000003',{photoId:'evil'});check(res.status===422,'photo outside request rejected');
  res=await call(mreq.id+'/output-files/ghost/match','tho-anh','0911000003',{photoId:'p1'});check(res.status===404,'file outside folder rejected');
  res=await call(mreq.id+'/output-files/z/match','tho-anh','0911000003',{photoId:'p1'});check(res.status===200,'editor matches');
  res=await call(mreq.id+'/output-files/w/match','tho-anh','0911000003',{photoId:'p2'});check(res.status===200,'editor matches second');
  let list=await (await call(mreq.id+'/output-files','tho-anh','0911000003')).json();
  check(list.matched===2&&list.files.every(f=>f.manual)&&list.photos.every(p=>p.matched),'output list shows manual matches');
  res=await call(mreq.id+'/output-files/w/match','tho-anh','0911000003',{photoId:null});check(res.status===200,'unmatch ok');
  list=await (await call(mreq.id+'/output-files','tho-anh','0911000003')).json();
  check(list.matched===1&&list.files.find(f=>f.id==='w').manual===false,'unmatch removes manual');
  res=await call(mreq.id+'/output-files/w/match','tho-anh','0911000003',{photoId:'p1'});check(res.status===200,'re-point to p1');
  r=await store.get(mreq.id);check(r.driveJob.manualMatches.w==='p1'&&!('z' in r.driveJob.manualMatches),'one file per photo kept');
  await call(mreq.id+'/output-files/z/match','tho-anh','0911000003',{photoId:'p2'});
  clock+=200000;await sync.syncOnce();clock+=70000;await sync.syncOnce();
  r=await store.get(mreq.id);check(r.status==='Hoàn thành'&&r.resultPhotos.map(p=>p.driveFileId).join(',')==='w,z','manual matches auto-deliver');
  res=await call(mreq.id+'/output-files/z/match','tho-anh','0911000003',{photoId:null});check(res.status===409,'completed request locked');
 }finally{srv2.closeAllConnections();await new Promise(r2=>srv2.close(r2));}
 console.log(`${checks}/${checks} PASS drive delivery (offline)`);
})().catch(e=>{console.error(e);process.exitCode=1;});
