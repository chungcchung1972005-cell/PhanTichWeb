// Offline: local Google HTTP fixture and Mongo collection double, no real credentials.
const assert = require('assert/strict'), http = require('http');
const {createAuth} = require('../server/drive-auth');
const {createWriter} = require('../server/drive');
const {mongoStoreFromCollection, memoryStore} = require('../server/edit-requests-store');
const {createReceiptStore} = require('../server/payment-receipts');
const {createSyncStore} = require('../server/drive-sync-store');
let checks=0;
function check(ok) {assert.ok(ok);checks++;}
(async () => {
  let now=0, refreshes=0, copies=0, mode='', folders=[], bodies=[], requests=[];
  const server=http.createServer(async(req,res)=>{
    let body='';for await(const chunk of req) body+=chunk;
    bodies.push(body);requests.push({url:req.url,auth:req.headers.authorization});
    res.setHeader('content-type','application/json');
    if(req.url==='/token') {
      refreshes++;const params=new URLSearchParams(body);
      assert.equal(params.get('grant_type'),'refresh_token');assert.equal(params.get('refresh_token'),'refresh-secret');
      return res.end(JSON.stringify({access_token:'token-'+refreshes,expires_in:3600}));
    }
    if(mode==='403') {res.statusCode=403;return res.end('{"error":{"errors":[{"reason":"forbidden"}]}}');}
    if(mode==='rate403' || mode==='500') {res.statusCode=mode==='500'?503:403;mode='';return res.end('{"error":{"errors":[{"reason":"rateLimitExceeded"}]}}');}
    if(mode==='401') {mode='';res.statusCode=401;return res.end('{}');}
    if(req.url.includes('/copy')) {copies++;if(copies===1){res.statusCode=429;res.setHeader('retry-after','0');return res.end('{}');}return res.end(JSON.stringify({id:'copy',...JSON.parse(body)}));}
    if(req.url.startsWith('/upload/')) return res.end('{"id":"text"}');
    if(req.url.includes('startPageToken')) return res.end('{"startPageToken":"start"}');
    if(req.url.includes('/changes?')) return res.end('{"changes":[],"nextPageToken":"next","newStartPageToken":"end"}');
    if(req.method==='GET') return res.end(JSON.stringify({files:folders}));
    folders.push({id:'folder',...JSON.parse(body)});res.end(JSON.stringify(folders[0]));
  });
  server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  try {
    const base='http://127.0.0.1:'+server.address().port;
    const env={GOOGLE_DRIVE_CLIENT_ID:'client',GOOGLE_DRIVE_CLIENT_SECRET:'secret',GOOGLE_DRIVE_REFRESH_TOKEN:'refresh-secret'};
    const auth=createAuth(env,{tokenUrl:base+'/token',now:()=>now});
    check(!createAuth({}).isConnected());
    await assert.rejects(createAuth({}).getAccessToken(),/drive_not_connected/);checks++;
    check((await Promise.all([auth.getAccessToken(),auth.getAccessToken()])).every(t=>t==='token-1') && refreshes===1);
    now=3600000;check(await auth.getAccessToken()==='token-2' && refreshes===2);
    let waits=[];const drive=createWriter({auth,base,sleep:async ms=>waits.push(ms)});
    const copy=await drive.copyFile('source','parent','new.jpg');
    check(copy.id==='copy' && copy.parents[0]==='parent' && copy.name==='new.jpg' && copies===2 && waits.length===1);
    check((await drive.ensureFolder('parent',"A'B")).id==='folder');
    check((await drive.ensureFolder('parent',"A'B")).id==='folder' && folders.length===1);
    check((await drive.uploadText('parent','note.txt','text/plain','Xin chào')).id==='text' && bodies.some(b=>b.includes('Xin chào') && b.includes('note.txt')));
    check((await drive.getStartPageToken()).startPageToken==='start');
    check((await drive.listChanges('cursor &1')).nextPageToken==='next' && requests.at(-1).url.includes('pageToken=cursor+%261'));
    mode='401';await drive.getStartPageToken();check(refreshes===3 && requests.at(-1).auth==='Bearer token-3');
    for(const m of ['rate403','500']) {mode=m;const n=waits.length;await drive.getStartPageToken();check(waits.length===n+1);}
    mode='403';const n=waits.length;await assert.rejects(drive.getStartPageToken(),e=>e.status===403);check(waits.length===n);mode='';
    // Recreate repositories around the same fake collection, like a process restart.
    const docs=new Map();
    const col={async insertOne(d){if(docs.has(d._id))throw Object.assign(new Error('duplicate'),{code:11000});docs.set(d._id,structuredClone(d));},
      async findOne(q){return structuredClone(docs.get(q._id)||null);},
      find(){return {sort(){return this;},async toArray(){return [...docs.values()].map(d=>structuredClone(d));}};},
      async findOneAndUpdate(q,u){const d=docs.get(q._id);if(!d||d.rev!==q.rev)return null;Object.assign(d,u.$set);d.rev+=u.$inc.rev;return structuredClone(d);}};
    const storage=()=>mongoStoreFromCollection(async()=>col);
    const receipts=createReceiptStore(storage());
    check((await Promise.all([receipts.add({id:123,content:'ORDERCS01',amount:50000}),receipts.add({id:123,content:'ORDERCS01',amount:50000})])).filter(Boolean).length===1);
    const restarted=createReceiptStore(storage());check(!await restarted.add({id:'123',content:'ORDERCS01',amount:50000}) && docs.size===1);
    check((await restarted.find('ORDERCS01',50000)).id==='123' && !await restarted.find('ORDERCS01',50001));
    const sync=createSyncStore(storage());await sync.setCursor('page1');await sync.setCursor('page2');await sync.setFolder('order1','folder1');
    const sync2=createSyncStore(storage());check(await sync2.getCursor()==='page2' && await sync2.getFolder('order1')==='folder1');
    const ram=createReceiptStore(memoryStore());
    check((await Promise.all([ram.add({id:'ram',content:'PAYMENT01',amount:10}),ram.add({id:'ram',content:'PAYMENT01',amount:10})])).filter(Boolean).length===1);
    check(!!await ram.find('PAYMENT01',10));
    // Real server endpoints, ephemeral local port, no external services configured.
    for(const connected of [false,true]) {
      const child=require('child_process').spawn(process.execPath,['-e',`const http=require('http');const original=http.Server.prototype.listen;http.Server.prototype.listen=function(...args){this.once('listening',()=>process.send(this.address().port));return original.apply(this,args)};require('./server/server');`],{
        cwd:require('path').resolve(__dirname,'..'),stdio:['ignore','ignore','ignore','ipc'],
        env:{...process.env,PORT:'0',MONGODB_URI:'',EDIT_REQUESTS_MONGODB_URI:'',SEPAY_WEBHOOK_KEY:'local-webhook',
          GOOGLE_DRIVE_CLIENT_ID:connected?'client':'',GOOGLE_DRIVE_CLIENT_SECRET:connected?'secret':'',GOOGLE_DRIVE_REFRESH_TOKEN:connected?'refresh-secret':''}
      });
      try {
        const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('server_start_timeout')),10000);child.once('message',p=>{clearTimeout(timer);resolve(p);});child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',()=>{clearTimeout(timer);reject(new Error('server_exited'));});});
        const base='http://127.0.0.1:'+port;
        const health=await (await fetch(base+'/api/health')).json();check(health.driveWrite===connected && !JSON.stringify(health).includes('secret'));
        const webhook=async id=>fetch(base+'/api/sepay-webhook',{method:'POST',headers:{authorization:'Apikey local-webhook','content-type':'application/json'},body:JSON.stringify({id,transferType:'in',transferAmount:100,content:'PAYMENT01'})});
        check((await (await webhook('tx1')).json()).success===true);
        check((await (await webhook('tx1')).json()).duplicate===true);
        check((await (await fetch(base+'/api/payment-status?code=PAYMENT01&amount=100')).json()).paid===true);
        check((await webhook(null)).status===400);
      } finally {child.kill();await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));}
    }
    console.log(`${checks}/${checks} PASS drive foundation (offline)`);
  } finally {server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
