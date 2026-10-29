const assert=require('assert/strict'),puppeteer=require('puppeteer-core'),env=require('./test-env');
(async()=>{
 const browser=await puppeteer.launch({executablePath:env.CHROME_PATH,headless:'new',args:['--no-sandbox']});
 try {
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:1440,height:1000});
  await page.setRequestInterception(true);page.on('request',r=>/^https?:/.test(r.url())?r.abort():r.continue());
  await page.evaluateOnNewDocument(()=>localStorage.setItem('aloha_auth',JSON.stringify({role:'sale',phone:'0900000002',name:'Ngọc Anh',token:'fixture'})));
  await page.goto(env.ROOT_URL+'crm/sale.html#hop-thu',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{
   window.testSent=[];
   const chat={phone:'0912345678',customerName:'Khách kiểm tra',topic:'Newborn',updatedAt:Date.now(),staffUnread:1,messages:[{id:'message-1',from:'khach',text:'Tôi muốn xem lịch chụp.',at:Date.now()}]};
   AlohaAuth.api=async(path,opts)=>{
    if(path.endsWith('/messages')) {window.testSent.push(opts.body.text);return {ok:false,status:503,data:{}};}
    if(path.endsWith('/inbox'))return {ok:true,status:200,data:{chats:[chat]}};
    if(path.endsWith('/0912345678'))return {ok:true,status:200,data:{chat}};
    return {ok:true,status:200,data:{}};
   };
  });
  await page.waitForSelector('[data-act="open-conv"]');await page.$eval('[data-act="open-conv"]',e=>e.click());await page.waitForSelector('#ibInput');
  assert.equal(await page.$('.ib-quick'),null);
  assert.doesNotMatch(await page.$eval('#swView',e=>e.textContent),/Concept đang được chọn nhiều|\[Bảng giá gói/);
  const text='Nội dung do Sale tự soạn';await page.$eval('#ibInput',(e,t)=>e.value=t,text);await page.$eval('[data-form="send-msg"]',e=>e.requestSubmit());
  await page.waitForFunction(()=>window.testSent.length===1);
  assert.equal(await page.$eval('#ibInput',e=>e.value),text);
  assert.equal(await page.$$eval('.ib-msg.out',e=>e.length),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: real inbox messages only, no canned demo replies, failed send retains text and creates no outgoing message');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
