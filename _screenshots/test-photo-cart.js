const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const fixture = require('./workflow-fixture');
const env = require('./test-env');
let checks = 0;
function check(name, ok) { assert.ok(ok, name); checks++; console.log('PASS ' + name); }
(async () => {
  const server = await fixture.fixtureServer();
  const browser = await puppeteer.launch({executablePath:env.CHROME_PATH,headless:'new',args:['--no-sandbox']});
  try {
    const token = await fixture.login('http://localhost:3001','0900000001','khach123');
    const album = await fixture.sourceAlbum('http://localhost:3001',{customer:token,code:'#CART01'});
    const errors = [];
    fs.mkdirSync(path.join(env.ROOT,'output/gio'),{recursive:true});
    fs.mkdirSync(path.join(env.ROOT,'output/ghichu'),{recursive:true});
    for (const width of [390,1440,360]) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      await page.setViewport({width,height:900});
      await fixture.installLocalAlbum(page,album);
      await page.evaluateOnNewDocument(() => {
        window.ALOHA_FEATURES={editSync:false};
        localStorage.setItem('aloha_auth',JSON.stringify({phone:'0900000001',name:'Khách giỏ ảnh',role:'khach-hang'}));
        sessionStorage.setItem('aloha_chat_ui',JSON.stringify({dismissed:true}));
      });
      let paid = false, originalOpened = false;
      await page.setRequestInterception(true);
      page.on('request',async r => {
        if(await fixture.thumbnail(page,r)) return;
        if(r.url().includes('/api/payment-status')) return r.respond({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({paid})});
        if(/^https?:/.test(r.url())) return r.abort();
        return r.continue();
      });
      page.on('popup',async p=>{originalOpened=true;await p.close();});
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(env.ROOT_URL+'index.html#/chon-anh',{waitUntil:'networkidle0'});
      await page.waitForSelector('.ps-heart');
      check(width+' empty cart hidden',await page.$eval('#psCart',e=>e.hidden));
      const select = ids=>page.evaluate(ids=>ids.forEach(i=>document.querySelectorAll('.ps-heart')[i].click()),ids);
      await select([0,1]);
      check(width+' hearts reveal editors immediately',await page.evaluate(()=>[...document.querySelectorAll('.ps-photo')].slice(0,2).every(c=>!c.querySelector('.ps-grid-editor').hidden&&c.querySelectorAll('.ps-edit-chip').length===5)));
      check(width+' cart reminds without blocking submit',await page.evaluate(()=>document.getElementById('psCartMissing').textContent==='2 ảnh chưa ghi cách sửa'&&!document.getElementById('psSubmitBtn').disabled));
      await page.click('.ps-photo .ps-edit-chip');
      check(width+' chip keeps selection and does not open lightbox',await page.evaluate(()=>!document.getElementById('psLightbox').classList.contains('show')&&document.getElementById('selectedCount').textContent==='2'&&document.querySelector('.ps-edit-chip').getAttribute('aria-pressed')==='true'));
      // "Khác" là ô ghi chú: bật Khác mới gõ được
      await page.click('.ps-photo .ps-edit-chip[value="Khác"]');
      await page.type('.ps-grid-editor input','Giữ nét tự nhiên');
      await page.click('.ps-photo img');
      check(width+' grid note and chip shared with lightbox; first quota retained',await page.evaluate(()=>document.getElementById('psLbNote').value==='Giữ nét tự nhiên'&&document.querySelector('#psEditOptions button[value="Chỉnh da"]').getAttribute('aria-pressed')==='true'&&document.getElementById('psLbFavInfo').textContent==='Đã chọn 2/10 ảnh trong gói'));
      await page.waitForFunction(()=>{const i=document.getElementById('psLbImg');return i.complete&&i.naturalWidth>0;});
      await new Promise(r=>setTimeout(r,350));
      if(width===390) await page.screenshot({path:path.join(env.ROOT,'output/ghichu/lightbox-390.png')});
      await page.click('#psEditOptions button[value="Chỉnh màu"]');
      await page.type('#psLbNote',' nhé');
      await page.click('#psLbClose');
      check(width+' lightbox changes shared back to grid',await page.evaluate(()=>document.querySelector('.ps-grid-editor input').value==='Giữ nét tự nhiên nhé'&&document.querySelector('.ps-grid-editor button[value="Chỉnh màu"]').getAttribute('aria-pressed')==='true'));
      await page.click('.ps-grid-editor button[value="Chỉnh màu"]');
      await page.evaluate(()=>document.querySelector('.ps-heart').click());
      check(width+' unheart hides editor retaining session data',await page.$eval('.ps-grid-editor',e=>e.hidden));
      await page.evaluate(()=>document.querySelector('.ps-heart').click());
      check(width+' reheart restores chip and note',await page.evaluate(()=>!document.querySelector('.ps-grid-editor').hidden&&document.querySelector('.ps-grid-editor input').value==='Giữ nét tự nhiên nhé'&&document.querySelector('.ps-edit-chip').getAttribute('aria-pressed')==='true'));
      check(width+' chip targets at least 36px and font 13px',await page.$$eval('.ps-grid-editor:not([hidden]) .ps-edit-chip',bs=>bs.every(b=>b.getBoundingClientRect().height>=36&&getComputedStyle(b).fontSize==='13px')));
      await page.$eval('#psGrid',e=>e.scrollIntoView({behavior:'instant',block:'start'}));
      await new Promise(r=>setTimeout(r,350));
      if(width!==360) await page.screenshot({path:path.join(env.ROOT,'output/ghichu/grid-'+width+'.png')});
      check(width+' first round free',await page.$eval('#psCartTotal',e=>e.textContent==='Miễn phí'));
      check(width+' free submit label',await page.$eval('#psSubmitBtn',e=>e.textContent==='Gửi cho thợ'&&!e.disabled));
      await select([2,3,4,5,6,7,8,9]);
      check(width+' first-round 10-photo boundary remains free',await page.evaluate(()=>document.getElementById('selectedCount').textContent==='10'&&document.getElementById('psCartTotal').textContent==='Miễn phí'&&document.getElementById('psSubmitBtn').textContent==='Gửi cho thợ'));
      await select([2,3,4,5,6,7,8,9]);
      check(width+' fixed bottom, safe width, buttons and chat',await page.evaluate(()=>{
        const c=document.getElementById('psCart'),r=c.getBoundingClientRect();
        const b=document.getElementById('psSubmitBtn').getBoundingClientRect();
        const chat=document.getElementById('chatToggle').getBoundingClientRect();
        return getComputedStyle(c).position==='fixed'&&Math.abs(r.bottom-innerHeight)<1&&r.left>=0&&r.right<=innerWidth&&b.height>=44&&chat.bottom<=r.top;
      }));
      await page.$eval('#psGrid',e=>e.scrollIntoView({behavior:'instant',block:'start'}));
      check(width+' cart remains fixed when scrolled, old counter hidden',await page.evaluate(()=>getComputedStyle(document.getElementById('psSummaryCard')).display==='none'&&Math.abs(document.getElementById('psCart').getBoundingClientRect().bottom-innerHeight)<1));
      await page.evaluate(()=>document.querySelector('.ps-tab[data-filter="edited"]').click());
      check(width+' edited tab hides cart and restores chat',await page.evaluate(()=>document.getElementById('psCart').hidden&&!document.body.classList.contains('ps-cart-open')));
      await page.evaluate(()=>document.querySelector('.ps-tab[data-filter="all"]').click());
      check(width+' return to grid restores cart, select all stays in toolbar',await page.evaluate(()=>!document.getElementById('psCart').hidden&&document.getElementById('psSelectAllBtn').parentElement.classList.contains('ps-cart-toolbar')));
      if(width!==360) await page.screenshot({path:path.join(env.ROOT,'output/gio',width+'-luot-1.png')});
      await page.click('#psClearAllBtn');
      check(width+' clear and undo',await page.$eval('#psCart',e=>e.hidden)&&await page.$eval('#psBulkUndo',e=>e.textContent.includes('Hoàn tác')));
      await page.click('#psBulkUndo button');
      check(width+' undo restores count',await page.$eval('#selectedCount',e=>e.textContent==='2'));
      await page.click('#psSubmitBtn');
      check(width+' free submit hides cart and labels sent',await page.evaluate(()=>document.getElementById('psCart').hidden&&document.querySelectorAll('.ps-sent-label').length===2));
      check(width+' request persists grid editOptions and note',await page.evaluate(()=>AlohaData.getEditRequests().some(r=>r.photos.some(p=>p.editOptions?.join()==='Chỉnh da,Khác'&&p.note==='Giữ nét tự nhiên nhé'))));
      check(width+' submitted editors hidden',await page.$$eval('.ps-photo:has(.ps-sent-label) .ps-grid-editor',es=>es.every(e=>e.hidden)));
      await select([2,3]);
      check(width+' second round total 100.000đ',await page.$eval('#psCartTotal',e=>e.textContent==='100.000đ'));
      check(width+' paid action label',await page.$eval('#psSubmitBtn',e=>e.textContent==='Thanh toán'));
      const badge=await page.$eval('.ps-extra-photo',e=>{
        const s=getComputedStyle(e,'::after');const r=e.getBoundingClientRect();
        e.scrollIntoView({behavior:'instant',block:'center'});
        return {text:s.content,pointer:s.pointerEvents,top:s.top,width:parseFloat(s.width)};
      });
      check(width+' compact +50K badge ignores pointer',badge.text.includes('+50K')&&!badge.text.includes('Chỉnh')&&badge.pointer==='none'&&badge.top==='8px'&&badge.width<70);
      const spot=await page.$eval('.ps-extra-photo',e=>{const r=e.getBoundingClientRect();return {x:r.left+20,y:r.top+16};});
      await page.mouse.click(spot.x,spot.y);
      check(width+' badge click opens photo, never original link',!originalOpened&&await page.$eval('#psLightbox',e=>e.classList.contains('show')));
      check(width+' second round lightbox has price without /0',await page.$eval('#psLbFavInfo',e=>e.textContent==='Đã chọn 2 ảnh · 50.000đ/ảnh'&&!/\/\s*0/.test(e.textContent)));
      await page.click('#psLbClose');
      if(width!==360) await page.screenshot({path:path.join(env.ROOT,'output/gio',width+'-luot-2.png')});
      check(width+' no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.evaluate(()=>window.scrollTo({top:document.body.scrollHeight,behavior:'instant'}));
      check(width+' last grid image can scroll above cart',await page.evaluate(()=>[...document.querySelectorAll('.ps-photo')].at(-1).getBoundingClientRect().bottom<=document.getElementById('psCart').getBoundingClientRect().top));
      await page.click('#psSubmitBtn');
      check(width+' checkout opens existing QR',await page.$eval('#psQrModalOverlay',e=>e.classList.contains('show')));
      await page.click('#psQrCloseBtn');
      check(width+' waiting cart shows QR action',await page.evaluate(()=>document.getElementById('psCartDetail').textContent==='Đang chờ thanh toán…'&&!document.getElementById('psCartQr').hidden&&document.getElementById('psSubmitBtn').hidden));
      await page.click('#psCartQr');
      check(width+' reopen same QR',await page.$eval('#psQrModalOverlay',e=>e.classList.contains('show')));
      paid=true;
      await page.waitForFunction(()=>document.querySelectorAll('.ps-sent-label').length===4,{timeout:20000});
      check(width+' SePay paid automatically sends selected photos and hides cart',await page.evaluate(()=>document.getElementById('psCart').hidden&&AlohaData.getEditRequests().some(r=>r.extraFee===100000&&r.photos.length===2)));
      await context.close();
    }
    check('no JavaScript errors',errors.length===0);
    console.log(checks+' PASS');
  } finally { await browser.close();server.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});

