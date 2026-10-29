const assert=require('assert/strict'),http=require('http'),crypto=require('crypto');
process.env.AUTH_SECRET='drive-test';process.env.MONGODB_URI='';process.env.EDIT_REQUESTS_MONGODB_URI='';
const express=require('../server/node_modules/express');
const {memoryStore}=require('../server/edit-requests-store');
const {createEditRequestsRouter}=require('../server/edit-requests');
const {readFolder}=require('../server/drive');
const token=(role)=>{const b=Buffer.from(JSON.stringify({role,phone:'0911111111',exp:Date.now()+60000})).toString('base64url');return b+'.'+crypto.createHmac('sha256',process.env.AUTH_SECRET).update(b).digest('base64url');};
(async()=>{
 let mode='pages',calls=[],pass=0;
 const google=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://fixture');calls.push({url,headers:req.headers});
  if(mode==='timeout')return;
  res.setHeader('content-type','application/json');
  if(mode==='403'||mode==='404'){res.statusCode=+mode;return res.end('{}');}
  if(mode==='empty')return res.end('{"files":[]}');
  const next=url.searchParams.get('pageToken');
  res.end(JSON.stringify({files:[{id:next?'file-0000002':'file-0000001',name:next?'IMG_0002.jpg':'IMG_0001.jpg',resourceKey:'file-key'}],...(!next?{nextPageToken:'page2'}:{})}));
 });
 google.listen(0,'127.0.0.1');await new Promise(r=>google.once('listening',r));
 process.env.GOOGLE_DRIVE_API_BASE='http://127.0.0.1:'+google.address().port;
 process.env.GOOGLE_DRIVE_API_KEY='test-key';
 const url='https://drive.google.com/drive/folders/folder-0000001?resourcekey=folder-key';
 const app=express(),store=memoryStore();app.use(express.json());
 app.use('/edit',createEditRequestsRouter(store,{workflowService:{attachRequestsStore(){},progress:async()=>{},sourceOrder:async()=>({id:'wf',phone:'0911111111',code:'TEST01',customerName:'Test',service:'Newborn',shooterPhone:'0911111111',editorPhone:'0911111111'}),originalDelivered:async()=>{}}}));
 const api=app.listen(0,'127.0.0.1');await new Promise(r=>api.once('listening',r));
 const call=async(path,role,body)=>{const r=await fetch('http://127.0.0.1:'+api.address().port+'/edit'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+token(role),'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
 const check=(name,fn)=>{fn();pass++;console.log('PASS',name);};
 try {
  let r=await call('/drive-folder?url='+encodeURIComponent(url),'tho-anh');
  check('two pages and public manifest',()=>{assert.equal(r.status,200);assert.equal(r.data.photos.length,2);assert.equal(r.data.photos[1].name,'IMG_0002.jpg');assert.match(r.data.photos[0].driveUrl,/resourcekey=file-key/);});
  check('key, resource key, query and pagination',()=>{const meta=calls.filter(c=>c.url.pathname!=='/drive/v3/files'),list=calls.filter(c=>c.url.pathname==='/drive/v3/files');assert.equal(meta.length,1);assert.equal(meta[0].url.pathname,'/drive/v3/files/folder-0000001');assert.equal(meta[0].url.searchParams.get('key'),'test-key');assert.equal(meta[0].headers['x-goog-drive-resource-keys'],'folder-0000001/folder-key');assert.equal(list.length,2);for(const c of list){assert.equal(c.headers['x-goog-drive-resource-keys'],'folder-0000001/folder-key');assert.equal(c.url.searchParams.get('key'),'test-key');assert.equal(c.url.searchParams.get('q'),"'folder-0000001' in parents and trashed = false and mimeType contains 'image/'");assert.equal(c.url.searchParams.get('pageSize'),'1000');assert.equal(c.url.searchParams.get('fields'),'nextPageToken,files(id,name,resourceKey)');assert.equal(c.url.searchParams.get('orderBy'),'name');assert.equal(c.url.searchParams.get('supportsAllDrives'),'true');assert.equal(c.url.searchParams.get('includeItemsFromAllDrives'),'true');}});
  r=await call('/drive-folder?url='+encodeURIComponent(url),'sale');check('Sale denied preview',()=>assert.equal(r.status,403));
  r=await call('/drive-folder?url='+encodeURIComponent(url),'sep');check('boss allowed preview',()=>assert.equal(r.status,200));
  r=await call('/albums','tho-anh',{workflowOrderId:'wf',folderUrl:url,photos:[{id:'forged',name:'FORGED.jpg'}]});
  check('POST ignores browser photos',()=>{assert.equal(r.status,201);assert.equal(r.data.album.photos.length,2);assert.equal(r.data.album.photos[0].name,'IMG_0001.jpg');});
  const album=r.data.album;
  r=await call('/','khach-hang',{orderCode:album.orderCode,sourceAlbumId:album.id,extraFee:0,photos:[{...album.photos[0],name:'forged.jpg',note:'Giữ nét tự nhiên',editOptions:['Chỉnh da','Chỉnh màu','Ánh sáng','Xóa chi tiết thừa','Khác','invalid','Chỉnh da']}]});
  check('authoritative filename, individual note and five allowed options persisted',()=>{assert.equal(r.status,201);assert.equal(r.data.request.photos[0].name,'IMG_0001.jpg');assert.equal(r.data.request.photos[0].note,'Giữ nét tự nhiên');assert.deepEqual(r.data.request.photos[0].editOptions,['Chỉnh da','Chỉnh màu','Ánh sáng','Xóa chi tiết thừa','Khác']);});
  for(mode of ['403','404','empty']) {await assert.rejects(readFolder(url),mode==='empty'?/Thư mục chưa có ảnh/:/Bất kỳ ai có đường liên kết/);pass++;console.log('PASS',mode);}
  delete process.env.GOOGLE_DRIVE_API_KEY;await assert.rejects(readFolder(url),/Studio chưa cấu hình mã Google Drive trên máy chủ/);pass++;console.log('PASS missing key');
  process.env.GOOGLE_DRIVE_API_KEY='test-key';mode='timeout';const started=Date.now();await assert.rejects(readFolder(url),/Google Drive không phản hồi, thử lại sau/);assert.ok(Date.now()-started<12000);pass++;console.log('PASS 10s timeout');
  const context={URL,URLSearchParams,Map,window:{AlohaAuth:{api:async()=>({status:0,ok:false})}}};context.AlohaAuth=context.window.AlohaAuth;
  require('vm').createContext(context);require('vm').runInContext(require('fs').readFileSync(require('path').join(__dirname,'../js/drive.js'),'utf8'),context);
  await assert.rejects(context.window.AlohaDrive.readFolder(url),/Không kết nối được máy chủ/);pass++;console.log('PASS browser-local mode reports offline server');
  context.window.AlohaDrive.attach({querySelector(){throw new Error('Picker UI should stay hidden');}},{});pass++;console.log('PASS Picker hidden without complete browser config');
  console.log(`${pass} PASS / 0 FAIL`);
 } finally {api.closeAllConnections();google.closeAllConnections();await Promise.all([new Promise(r=>api.close(r)),new Promise(r=>google.close(r))]);}
})().catch(e=>{console.error(e);process.exitCode=1;});
