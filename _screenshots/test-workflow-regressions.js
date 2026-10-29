const assert=require('assert/strict'),puppeteer=require('puppeteer-core'),env=require('./test-env');
(async()=>{
 const browser=await puppeteer.launch({executablePath:env.CHROME_PATH,headless:'new',args:['--no-sandbox']});
 try {
  for(const role of ['sale','sep','tho-anh','khach-hang']) {
   const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[];
   await page.setRequestInterception(true);page.on('request',r=>/^https?:/.test(r.url())?r.abort():r.continue());
   page.on('pageerror',e=>errors.push(e.message));
   await page.evaluateOnNewDocument(role=>{window.ALOHA_FEATURES={editSync:false};localStorage.setItem('aloha_auth',JSON.stringify({role,phone:role==='sale'?'0900000002':role==='sep'?'0900000004':role==='tho-anh'?'0900000003':'0900000001',name:'Kiểm tra'}));},role);
   const paths=role==='sale'?['crm/sale.html#lich-chup','crm/admin.html#tin-nhan']:role==='khach-hang'?['index.html#/chon-anh']:['crm/admin.html#quy-trinh','crm/admin.html#anh'];
   for(const path of paths) {
    await page.goto(env.ROOT_URL+path,{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    assert.deepEqual(errors,[],role+' '+path);
    for(const width of [1440,390]) {
     await page.setViewport({width,height:900});
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),role+' overflow '+path+' '+width);
    }
   }
   console.log('PASS entry routes:',role);await context.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
