const assert=require('assert/strict'),crypto=require('crypto'),puppeteer=require('puppeteer-core'),env=require('./test-env');
process.env.AUTH_SECRET='multidevice-test';process.env.EDIT_REQUESTS_ALLOW_PUBLIC_DEMO_STAFF='1';process.env.MONGODB_URI='';process.env.EDIT_REQUESTS_MONGODB_URI='';
const express=require('../server/node_modules/express'),{memoryStore}=require('../server/edit-requests-store');
const {createService,createRouter}=require('../server/workflow'),{createEditRequestsRouter}=require('../server/edit-requests');
const token=(role,phone)=>{const b=Buffer.from(JSON.stringify({role,phone,exp:Date.now()+600000})).toString('base64url');return b+'.'+crypto.createHmac('sha256',process.env.AUTH_SECRET).update(b).digest('base64url');};
(async()=>{
 const drive=await require('./drive-fixture').startDrive(),service=createService(memoryStore()),app=express();
 app.use((req,res,next)=>{res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','content-type,authorization');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');if(req.method==='OPTIONS')return res.sendStatus(204);next();});
 app.use(express.json());app.use('/api/workflow',createRouter(service));app.use('/api/edit-requests',createEditRequestsRouter(memoryStore(),{workflowService:service,allowPublicDemoStaff:true}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const browser=await puppeteer.launch({executablePath:env.CHROME_PATH,headless:'new',args:['--no-sandbox']}),errors=[];
 async function machine(role,phone,path){
  const ctx=await browser.createBrowserContext(),page=await ctx.newPage();
  await page.setRequestInterception(true);
  page.on('request',r=>{if(r.url().startsWith('http://localhost:3001/'))r.continue({url:r.url().replace('http://localhost:3001','http://127.0.0.1:'+server.address().port)});else if(/^https?:/.test(r.url()))r.abort();else r.continue();});
  page.on('pageerror',e=>errors.push(e.message));
  await page.evaluateOnNewDocument((role,phone,t)=>{localStorage.setItem('aloha_auth',JSON.stringify({role,phone,name:'Demo',token:t}));navigator.clipboard.writeText=async value=>{window.copiedNames=value;};},role,phone,token(role,phone));
  await page.goto(env.ROOT_URL+path,{waitUntil:'domcontentloaded'});return page;
 }
 try {
  await service.change({role:'sep',phone:'0900000004'},'employee',{phone:'0913333333',name:'Second worker',role:'tho-anh'});
  const sale=await machine('sale','0900000002','crm/sale.html#lich-chup');
  await sale.waitForFunction(()=>window.AlohaWorkflow&&AlohaWorkflow.get());
  assert.equal(await sale.evaluate(()=>AlohaWorkflow.enabled()),true);
  await sale.click('#swQuickBtn');await sale.waitForSelector('[data-qb=shooterPhone]');
  assert.match(await sale.$eval('[data-qb=shooterPhone]',e=>e.textContent),/Thợ ảnh demo.*0900000003/);
  await sale.select('[data-qb=shooterPhone]','0900000003');assert.equal(await sale.$eval('[data-qb=editorPhone]',e=>e.value),'0900000003');
  await sale.select('[data-qb=shooterPhone]','0913333333');assert.equal(await sale.$eval('[data-qb=editorPhone]',e=>e.value),'0913333333');
  await sale.select('[data-qb=editorPhone]','0900000003');await sale.select('[data-qb=shooterPhone]','');assert.equal(await sale.$eval('[data-qb=editorPhone]',e=>e.value),'0900000003');
  console.log('PASS Sale roster includes demo worker; editor follows shooter and preserves manual choice');
  await sale.evaluate(()=>AlohaWorkflow.command('book',{id:'multi-1',code:'MULTI01',phone:'0912222222',customerName:'Multi customer',service:'Newborn',pkg:'Cơ bản',price:1500000,date:'2026-12-01',time:'09:00',shooterPhone:'0900000003',editorPhone:'0900000003'}));
  await sale.evaluate(()=>AlohaWorkflow.command('payment',{id:'multi-1',amount:750000,reference:'multi-deposit'}));
  const worker=await machine('tho-anh','0900000003','crm/admin.html#quy-trinh');
  await worker.waitForSelector('[data-wf=checkin]');await worker.click('[data-wf=checkin]');await worker.waitForSelector('[data-wf=shot]');await worker.click('[data-wf=shot]');
  await worker.waitForSelector('#sourceOrderSelect option[value="multi-1"]');
  const imported=await worker.evaluate(async()=>{const manifest=await AlohaDrive.readFolder('https://drive.google.com/drive/folders/test-folder-12345');return AlohaAuth.api('/api/edit-requests/albums',{method:'POST',body:{workflowOrderId:'multi-1',folderUrl:manifest.folderUrl,photos:[{id:'forged'}]}});});assert.equal(imported.status,201);
  console.log('PASS machine A booking -> machine B assigned shoot and server Drive import');
  const customer=await machine('khach-hang','0912222222','index.html#/chon-anh');
  await customer.waitForSelector('.ps-photo[data-id="drive-test-file-0001"]');
  assert.equal(await customer.$('#psDriveConnect'),null);
  const photo=await customer.$eval('.ps-photo img',img=>img.src);assert.match(photo,/thumbnail.*sz=w1000/);
  await customer.click('.ps-photo .ps-heart');
  await customer.click('.ps-photo img');await customer.waitForSelector('#psEditOptions');
  await customer.click('#psEditOptions input[value="Chỉnh da"]');
  await customer.type('#psLbNote','Giữ nét bé');
  assert.match(await customer.$eval('#psLbImg',e=>e.src),/sz=w2000/);
  await customer.click('#psLbClose');await customer.click('#psSubmitBtn');
  await customer.waitForFunction(async()=>{const r=await AlohaEditSync.mine();return r.ok && r.data.requests.length===1;});
  const created=await customer.evaluate(async()=>(await AlohaEditSync.mine()).data.requests[0]);assert.deepEqual(created.photos[0].editOptions,['Chỉnh da']);
  await worker.goto(env.ROOT_URL+'crm/admin.html#anh',{waitUntil:'domcontentloaded'});
  await worker.waitForSelector('.photo-row-card');await worker.click('.photo-row-card');await worker.waitForSelector('#copyPhotoNames');
  const detail=await worker.$eval('#kanbanModalBody',e=>e.textContent);assert.match(detail,/IMG_0001.JPG/);assert.match(detail,/Chỉnh da/);assert.match(detail,/Giữ nét bé/);
  assert.match(await worker.$eval('#kanbanModalBody .photo-download-btn',e=>e.href),/file\/d\/test-file-0001\/view/);
  await worker.click('#copyPhotoNames');await worker.waitForFunction(()=>window.copiedNames==='IMG_0001.JPG');assert.match(await worker.$eval('#copyPhotoStatus',e=>e.textContent),/Đã chép 1 tên file/);
  assert.deepEqual(errors,[]);console.log('PASS machine C public photos + edit options -> machine B file identity, labels, note and clipboard');
 } finally {await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));await new Promise(r=>drive.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
