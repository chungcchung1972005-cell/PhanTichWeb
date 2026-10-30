const assert=require('assert/strict'),path=require('path'),fs=require('fs');
const puppeteer=require('puppeteer-core'),env=require('./test-env');
const out=env.fromRoot('output','dot2');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await puppeteer.launch({executablePath:env.CHROME_PATH,headless:true,args:['--no-sandbox']});
 const errors=[];
 async function pageFor(role,url,features={editSync:false},blockStorage=false) {
  const ctx=await browser.createBrowserContext(),page=await ctx.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.setRequestInterception(true);page.on('request',r=>/^https?:/.test(r.url())?r.abort():r.continue());
  await page.evaluateOnNewDocument((role,features,blockStorage)=>{
   window.ALOHA_FEATURES=features;
   if(blockStorage){const get=Storage.prototype.getItem;Storage.prototype.getItem=function(key){if(key==='aloha_admin_ui_wf')throw Error('blocked');return get.call(this,key);};}
   localStorage.setItem('aloha_auth',JSON.stringify({role,phone:role==='tho-anh'?'0900000003':'0900000004',name:'ALOHA'}));
   sessionStorage.setItem('aloha_chat_ui',JSON.stringify({dismissed:true}));
  },role,features,blockStorage);
  await page.goto(env.ROOT_URL+url,{waitUntil:'domcontentloaded'});return page;
 }
 async function seed(page) {
  await page.waitForFunction(()=>window.AlohaWorkflow&&AlohaWorkflow.get());
  await page.evaluate(()=>{
   const s=structuredClone(AlohaWorkflow.get()),now=Date.now();
   s.orders=['cancelled','delivered','editing','shot','shooting','confirmed'].map((status,i)=>({id:'visual-'+i,code:'AL0'+(21+i),customerName:['Mẹ Linh','Mẹ Ngọc','Mẹ Mai','Mẹ Hà','Mẹ Vy','Mẹ An'][i],date:'2026-10-30',time:['08:00','08:30','09:00','10:00','13:00','15:00'][i],status,service:'Newborn',pkg:'Cơ bản',price:1500000,collected:750000,salePhone:'0900000002',shooterPhone:'0900000003',editorPhone:'0900000003',myEstimate:450000,policy:null}));
   s.entries=['pending','approved','paid'].map((status,i)=>({id:'entry-'+i,phone:'0900000003',kind:'shoot',amount:[300000,600000,900000][i],status,createdAt:now,orderCode:'AL0'+(21+i),customerName:'Mẹ An'}));
   window.visualState=s;window.dispatchEvent(new CustomEvent('aloha:workflow',{detail:s}));
  });
 }
 async function frame(page) {await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';window.scrollTo({top:0,left:0,behavior:'instant'});});await new Promise(r=>setTimeout(r,400));}
 async function noOverflow(page) {assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 try {
  for(const role of ['tho-anh','sep']) {
   const page=await pageFor(role,'crm/admin.html#quy-trinh');await seed(page);
   assert.equal(await page.$$eval('[data-wf-tab]',e=>e.length),role==='sep'?3:2);
   assert.equal(await page.$eval('[data-wf-pane=income]',e=>e.hidden),true);
   assert.deepEqual(await page.$$eval('.wf-orders .wf-actions',e=>e.map(x=>x.children.length)),[1,1,1,1]);
   assert.equal(await page.$eval('.wf-done summary',e=>e.textContent),'Đã xong (2)');
   assert.equal(await page.$eval('.wf-done',e=>e.open),false);
   for(const width of [360,390,1440]) {
    await page.setViewport({width,height:1100});await noOverflow(page);
    const targets=await page.$$eval('.wf-tabs button,.wf-orders .wf-actions>*',e=>e.filter(x=>x.getClientRects().length).map(x=>x.getBoundingClientRect().height));
    assert.ok(targets.every(h=>h>=44));
    await frame(page);if(width!==360)await page.screenshot({path:path.join(out,`${role}-${width}.png`)});
    await page.click('[data-wf-tab=income]');await noOverflow(page);
    assert.equal(await page.$$eval('.wf-kpis article',e=>e.length),3);
    await frame(page);if(width!==360)await page.screenshot({path:path.join(out,`${role}-income-${width}.png`)});
    if(role==='sep'){await page.click('[data-wf-tab=settings]');await noOverflow(page);}
    await page.click('[data-wf-tab=orders]');
   }
   await page.click('[data-wf-tab=income]');await page.reload({waitUntil:'domcontentloaded'});await seed(page);
   assert.equal(await page.$eval('[data-wf-tab=income]',e=>e.getAttribute('aria-selected')),'true');
   // Storage failures must not prevent switching or rendering.
   await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw Error('blocked');};});
   await page.$eval('[data-wf-tab=orders]',b=>b.click());
   assert.equal(await page.$eval('[data-wf-pane=orders]',e=>e.hidden),false);
   const blocked=await pageFor(role,'crm/admin.html#quy-trinh',{editSync:false},true);await seed(blocked);
   assert.equal(await blocked.$eval('[data-wf-tab=orders]',e=>e.getAttribute('aria-selected')),'true');
   console.log('PASS tabs, role access, one action, done group, income, storage and widths:',role);
  }
  const sale=await pageFor('sale','crm/sale.html');
  await sale.waitForSelector('#swNav a[href="admin.html#tin-nhan"]');
  assert.equal(await sale.$$eval('a[href="admin.html#tin-nhan"]',e=>e.length),2);
  await sale.evaluate(async()=>{AlohaAuth.api=async()=>({ok:true,data:{chats:[{staffUnread:2},{staffUnread:3}]}});await refreshChatBadge();});
  assert.deepEqual(await sale.$$eval('.sw-chat-unread',e=>e.map(x=>[x.hidden,x.textContent])),[[false,'5'],[false,'5']]);
  for(const width of [360,390,1440]) {
   await sale.setViewport({width,height:950});await noOverflow(sale);
   if(width!==360)await sale.screenshot({path:path.join(out,`sale-menu-${width}.png`)});
  }
  await sale.setViewport({width:390,height:950});await sale.click('#swMenuBtn');await new Promise(r=>setTimeout(r,300));await sale.screenshot({path:path.join(out,'sale-sidebar-390.png')});
  await sale.evaluate(async()=>{AlohaAuth.api=async()=>{throw Error('offline');};await refreshChatBadge();});
  assert.ok(await sale.$$eval('.sw-chat-unread',e=>e.every(x=>x.hidden)));
  console.log('PASS Sale inbox destinations, unread sum, silent error, mobile menu');
  for(const booking of [false,true]) {
   const home=await pageFor('khach-hang','index.html',{booking,editSync:false});
   await home.setViewport({width:390,height:1000});await noOverflow(home);
   assert.equal(await home.$eval('[data-booking-process]',e=>getComputedStyle(e).display==='none'),!booking);
   assert.equal(await home.$eval('.booking-off-copy',e=>getComputedStyle(e).display!=='none'),!booking);
   assert.equal(await home.$eval('.booking-on-copy',e=>getComputedStyle(e).display!=='none'),booking);
   if(!booking)await home.screenshot({path:path.join(out,'home-390.png')});
  }
  assert.deepEqual(errors,[]);console.log('PASS booking off/on; no JavaScript errors');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
