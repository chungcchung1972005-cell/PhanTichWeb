const assert=require('assert/strict'),puppeteer=require('puppeteer-core'),env=require('./test-env');
(async()=>{
 const browser=await env.launchAllFeatures(puppeteer,{executablePath:env.CHROME_PATH,headless:'new',args:['--no-sandbox']});
 const errors=[];
 try {
  const page=await browser.newPage();await page.setViewport({width:1440,height:1050});
  await page.setRequestInterception(true);page.on('request',r=>/^https?:/.test(r.url())?r.abort():r.continue());page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
  await page.evaluateOnNewDocument(()=>localStorage.setItem('aloha_auth',JSON.stringify({phone:sessionStorage.getItem('test-role')==='worker'?'0900000003':sessionStorage.getItem('test-role')==='boss'?'0900000004':'0900000002',name:'Test',role:sessionStorage.getItem('test-role')==='worker'?'tho-anh':sessionStorage.getItem('test-role')==='boss'?'sep':'sale'})));
  await page.goto(env.ROOT_URL+'crm/sale.html#lich-chup',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.AlohaWorkflow&&AlohaWorkflow.get());
  await page.$eval('#swQuickBtn',e=>e.click());await page.waitForSelector('[data-qb=phone]');
  await page.evaluate(()=>{const p=document.querySelector('[data-qb=phone]');p.value='0900000001';p.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.evaluate(()=>{const p=document.querySelector('[data-qb=name]');p.value='Khách liên kết';p.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.select('[data-qb=pkg]','Cơ bản');
  await page.$eval('[data-form=quick-book]',f=>f.requestSubmit());
  await page.waitForFunction(()=>AlohaWorkflow.get().orders.length===1);
  const id=await page.evaluate(()=>AlohaWorkflow.get().orders[0].id);
  assert.equal(await page.evaluate(()=>AlohaWorkflow.get().orders[0].price),1500000);
  await page.evaluate(()=>AlohaWorkflow.command('payment',{id:AlohaWorkflow.get().orders[0].id,amount:750000,reference:'deposit-ui'}));
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>AlohaWorkflow.get()&&AlohaWorkflow.get().orders.length===1);
  // Lịch nhanh mặc định "hôm nay + 2 ngày": chạy vào thứ Bảy/Chủ nhật thì rơi sang tuần sau -> lật lịch tới tuần đó
  for(let i=0;i<2&&!/Khách liên kết/.test(await page.$eval('#swView',e=>e.textContent));i++){await page.$eval('[data-act=cal-next]',e=>e.click());await new Promise(r=>setTimeout(r,200));}
  assert.match(await page.$eval('#swView',e=>e.textContent),/Khách liên kết/);
  console.log('Sale booking persists and feeds calendar');
  await page.evaluate(()=>sessionStorage.setItem('test-role','worker'));
  await page.goto(env.ROOT_URL+'crm/admin.html#quy-trinh',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-wf=checkin]');
  assert.equal(await page.$eval('#sourceOrderSelect',e=>e.options.length),1);
  await page.$eval('[data-wf=checkin]',e=>e.click());await page.waitForSelector('[data-wf=shot]');
  await page.$eval('[data-wf=shot]',e=>e.click());await page.waitForSelector('#sourceOrderSelect option[value="'+id+'"]');
  assert.equal(await page.$('[name=phone]'),null);
  await page.select('#sourceOrderSelect',id);
  assert.match(await page.$eval('#sourceOrderSummary',e=>e.textContent),/Khách liên kết.*0900000001/);
  await page.evaluate(()=>{
   AlohaDrive.readFolder=async url=>({folderId:'test-folder-12345',folderUrl:url,photos:[{id:'drive-test-image-0001',driveFileId:'test-image-0001',name:'IMG_0001.JPG',src:'images/my-photos/photo-1.jpg',driveUrl:'https://drive.google.com/file/d/test-image-0001/view'}]});
   document.querySelector('[name=folderUrl]').value='https://drive.google.com/drive/folders/test-folder-12345';document.getElementById('sourceDeliveryForm').requestSubmit();
  });
  await page.waitForFunction(()=>document.getElementById('sourceDeliveryStatus').textContent.includes('Đã gửi'));
  assert.match(await page.$eval('.wf-table-wrap',e=>e.textContent),/300.000/);
  assert.equal(await page.$$eval('.wf-kpis article',els=>els.length),3);
  assert.doesNotMatch(await page.$eval('#quy-trinh',e=>e.textContent),/Hoa hồng Sale|Cơ bản chia Sale|Premium 200k/);
  assert.deepEqual(await page.evaluate(()=>AlohaWorkflow.get().rules),[]);
  assert.doesNotMatch(await page.$eval('.wf-table-wrap',e=>e.textContent),/Hoa hồng Sale/);
  const req=await page.evaluate(()=>{
   const album=AlohaData.getSourceAlbums()[0];
   const r=AlohaData.createEditRequest({phone:album.phone,customerName:album.customerName,orderCode:album.orderCode,sourceAlbumId:album.id,workflowOrderId:album.workflowOrderId,editorPhone:album.editorPhone,photos:album.photos,photoCount:1,round:1});
   AlohaData.setResultLink(r.id,'https://drive.google.com/drive/folders/edited-folder-123');AlohaData.advanceRequestStatus(r.id);AlohaData.advanceRequestStatus(r.id);return r.id;
  });
  await page.evaluate(()=>AlohaWorkflow.refresh());
  assert.match(await page.$eval('.wf-table-wrap',e=>e.textContent),/150.000/);
  console.log('Worker chooses existing shot customer, sends only Drive link; shooting/edit earnings separated');
  await page.screenshot({path:env.shot('workflow-worker-desktop.png'),fullPage:false});
  await page.evaluate(()=>sessionStorage.setItem('test-role','boss'));
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>AlohaWorkflow.get()&&AlohaWorkflow.get().entries.length===3);
  assert.match(await page.$eval('#custView',e=>e.textContent),/Khách liên kết/);
  await page.evaluate(async()=>{
   const o=AlohaWorkflow.get().orders[0];await AlohaWorkflow.command('payment',{id:o.id,amount:750000,reference:'balance-ui'});
   const request=AlohaData.getEditRequests().find(r=>r.workflowOrderId===o.id);AlohaWorkflow.progress(AlohaData.setCustomerFeedback(request.id,'satisfied'),'delivered');await AlohaWorkflow.refresh();const shoot=AlohaWorkflow.get().entries.find(e=>e.kind==='shoot');await AlohaWorkflow.command('pay-month',{phone:shoot.phone,month:shoot.confirmedMonth,reference:'payout-ui'});
  });
  assert.match(await page.$eval('#quy-trinh',e=>e.textContent),/payout-ui/);
  assert.equal(await page.evaluate(()=>AlohaWorkflow.get().entries.find(e=>e.kind==='sale').amount),75000);
  await page.setViewport({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  console.log('PASS: Sale booking → retained order → assigned shoot → original delivery → edit completion → separate commissions → boss payout; desktop/mobile');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
