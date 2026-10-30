const assert = require('assert/strict');
const puppeteer = require('puppeteer-core');
const env = require('./test-env');
(async () => {
  const browser = await env.launchAllFeatures(puppeteer, {executablePath:env.CHROME_PATH,headless:'new',args:['--no-sandbox']});
  let checks = 0;
  const check = (ok, label) => {assert.ok(ok,label);checks++;};
  try {
    for (const width of [360,390,1440]) {
      const page = await browser.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.setViewport({width,height:900});
      await page.setRequestInterception(true);
      page.on('request',r=>/^https?:/.test(r.url())?r.abort():r.continue());
      await page.evaluateOnNewDocument(()=>{
        localStorage.clear();
        localStorage.setItem('aloha_auth',JSON.stringify({phone:'0900000001',name:'Test',role:'khach-hang'}));
        const original={id:'original-1',name:'ORIGINAL.JPG',src:'images/my-photos/photo-1.jpg'};
        const edited={id:'edited-1',name:'EDITED.JPG',src:'images/my-photos/photo-2.jpg',driveUrl:'https://drive.google.com/file/d/edited-1/view'};
        localStorage.setItem('aloha_demo_db',JSON.stringify({sourceAlbums:[{id:'AL-test',phone:'0900000001',orderCode:'#GALLERY',folderUrl:'https://drive.google.com/drive/folders/original-folder',photos:[original],createdAt:1}],editRequests:[{id:'REQ-test',phone:'0900000001',sourceAlbumId:'AL-test',orderCode:'#GALLERY',status:'Hoàn thành',round:1,photos:[original],photoCount:1,resultLink:'https://drive.google.com/drive/folders/edited-folder',resultPhotos:[edited],createdAt:2,messages:[]}]}));
      });
      await page.goto(env.ROOT_URL+'index.html#/chon-anh',{waitUntil:'domcontentloaded'});
      await page.waitForSelector('#psDrivePanel');
      check(await page.$eval('#psSourceAlbum',e=>e.hidden),'single album selector hidden');
      check(await page.$eval('#psJourney [aria-current]',e=>e.textContent.startsWith('3')),'completed journey');
      await page.$eval('.ps-tab[data-filter="edited"]',e=>e.click());
      check(await page.$$eval('.ps-result-gallery .ps-photo',e=>e.length===1),'result preview');
      await page.click('.ps-revise');
      await page.click('.ps-result-gallery .ps-heart');
      check(await page.$eval('#psCart',e=>!e.hidden&&e.textContent.includes('50.000')),'paid shared cart');
      await page.click('.ps-result-gallery .ps-edit-chip');
      check(await page.$eval('.ps-result-gallery .ps-edit-chip',e=>e.getAttribute('aria-pressed')==='true'),'shared options');
      await page.click('.ps-result-gallery img');
      check(await page.$eval('#psLightbox',e=>e.classList.contains('show')),'shared lightbox');
      await page.keyboard.press('Escape');
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal scroll');
      check(await page.$eval('.ps-result-gallery .ps-heart',e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44;}),'44px target');
      check(errors.length===0,errors.join(';'));
      await page.close();
    }
    console.log('PASS result gallery: '+checks+' checks');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
