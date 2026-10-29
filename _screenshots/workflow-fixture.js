const assert = require('assert/strict');
const { startDrive } = require('./drive-fixture');
let sequence = 0;
const files = Array.from({length: 24}, (_, i) => ({id: 'fixture-file-' + (i + 1), name: 'IMG_' + String(i + 1).padStart(4, '0') + '.JPG'}));
async function driveFixture() { return startDrive(files); }
async function json(base, route, token, body) {
  const r = await fetch(base + route, {method: body === undefined ? 'GET' : 'POST', headers: {'content-type':'application/json', ...(token ? {authorization:'Bearer '+token} : {})}, body: body === undefined ? undefined : JSON.stringify(body)});
  return {status:r.status, data:await r.json()};
}
async function login(base, phone, password) { return (await json(base, '/api/sale-chat/auth/login', null, {phone,password})).data.token; }
function identity(token) { return JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString()); }
async function sourceAlbum(base, {customer, worker, boss, sale, code, editBase='/api/edit-requests'}) {
  worker ||= await login(base, '0900000003','anh123');
  boss ||= await login(base, '0900000004','sep123');
  sale ||= await login(base, '0900000002','sale123');
  const n=++sequence, id='fixture-order-'+n;
  const who=identity(customer), photographer=identity(worker);
  const command=async(t,command,data)=>{const r=await json(base,'/api/workflow/commands',t,{command,data});assert.equal(r.status,200,JSON.stringify({command,...r}));};
  await command(boss,'employee',{phone:photographer.phone,name:photographer.name || 'Fixture worker',role:'tho-anh'});
  await command(sale,'book',{id,code,phone:who.phone,customerName:who.name || 'Fixture customer',service:'Newborn',pkg:'Cơ bản',price:1500000,date:new Date(Date.UTC(2030,0,n)).toISOString().slice(0,10),time:'09:00',shooterPhone:photographer.phone,editorPhone:photographer.phone});
  await command(sale,'payment',{id,amount:750000,reference:'fixture-deposit-'+n});
  await command(worker,'checkin',{id});
  await command(worker,'shot',{id});
  const r=await json(base,editBase+'/albums',worker,{workflowOrderId:id,folderUrl:'https://drive.google.com/drive/folders/fixture-folder-'+n});
  assert.equal(r.status,201,JSON.stringify(r));return r.data.album;
}
function requestFrom(album, body) {
  return {...body, orderCode:album.orderCode,sourceAlbumId:album.id,photos:body.photos.map((p,i)=>({...album.photos[i],...p,id:album.photos[i].id,src:album.photos[i].src}))};
}
module.exports={driveFixture,sourceAlbum,requestFrom,json,login,identity};

async function installLocalAlbum(page, album) {
  const boss=await login('http://localhost:3001','0900000004','sep123');
  const state=(await json('http://localhost:3001','/api/workflow',boss)).data.state;
  await page.evaluateOnNewDocument(({a,state})=>{
    if(!localStorage.getItem('aloha_workflow_v1'))localStorage.setItem('aloha_workflow_v1',JSON.stringify(state));
    const db=JSON.parse(localStorage.getItem('aloha_demo_db') || '{}');
    db.sourceAlbums=(db.sourceAlbums || []).filter(x=>x.id!==a.id).concat([a]);
    localStorage.setItem('aloha_demo_db',JSON.stringify(db));
  },{a:album,state});
}
async function fixtureServer() {
  let busy=false;try{await fetch('http://localhost:3001/api/health',{signal:AbortSignal.timeout(1000)});busy=true;}catch{}
  if(busy)throw new Error('Port 3001 is already in use; fixture will not reuse another server.');
  const drive=await driveFixture();drive.unref();
  const child=require('child_process').spawn(process.execPath,['server.js'],{cwd:require('path').join(__dirname,'../server'),env:{...process.env,PORT:'3001',AUTH_SECRET:'test-secret',MONGODB_URI:'',EDIT_REQUESTS_MONGODB_URI:'',EDIT_REQUESTS_ALLOW_PUBLIC_DEMO_STAFF:'1',GEMINI_API_KEY:''},stdio:'ignore'});
  child.unref();process.on('exit',()=>child.kill());
  for(let i=0;i<80;i++){try{if((await fetch('http://localhost:3001/api/health')).ok)return {close:()=>{child.kill();drive.close();}};}catch{}await new Promise(r=>setTimeout(r,150));}
  throw new Error('Fixture server failed');
}
async function thumbnail(page, request) {
  if (/^https:\/\/(fonts.googleapis.com|fonts.gstatic.com)\//.test(request.url())) { await request.respond({status:200,contentType:'text/css',body:''}); return true; }
  if(!request.url().startsWith('https://drive.google.com/thumbnail'))return false;
  await request.respond({status:200,contentType:'image/jpeg',body:require('fs').readFileSync(require('path').join(__dirname,'../images/my-photos/photo-1.jpg'))});return true;
}
module.exports.installLocalAlbum=installLocalAlbum;
module.exports.fixtureServer=fixtureServer;
module.exports.thumbnail=thumbnail;

async function localRequest(page, album, count, extra={}) {
  await new Promise(r=>setTimeout(r,5));
  const body=requestFrom(album,{phone:album.phone,customerName:album.customerName,photoCount:count,photos:album.photos.slice(0,count),extraFee:0,...extra});
  return page.evaluate(b=>AlohaData.createEditRequest(b),body);
}
module.exports.localRequest=localRequest;
