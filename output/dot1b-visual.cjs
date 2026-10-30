const fs=require('fs'),path=require('path'),puppeteer=require('../_screenshots/node_modules/puppeteer-core');
const fixture=require('../_screenshots/workflow-fixture'),{CHROME_PATH,ROOT_URL}=require('../_screenshots/test-env');
(async()=>{
const server=await fixture.fixtureServer();let browser;
try {
const base='http://localhost:3001',customer=await fixture.login(base,'0900000001','khach123');
const album=await fixture.sourceAlbum(base,{customer,code:'#ABVISUAL01'});
browser=await puppeteer.launch({executablePath:CHROME_PATH,headless:'new',args:['--no-sandbox']});
const metrics=[];
async function pageFor(phone,pw,width){const ctx=await browser.createBrowserContext(),page=await ctx.newPage();await page.setViewport({width,height:1000});await page.setRequestInterception(true);page.on('request',async r=>{if(!await fixture.thumbnail(page,r))await r.continue();});await page.evaluateOnNewDocument(()=>{window.ALOHA_FEATURES={editSync:true};sessionStorage.setItem('aloha_chat_ui',JSON.stringify({dismissed:true}));});await page.goto(ROOT_URL+'login.html',{waitUntil:'networkidle0'});await page.type('#loginPhone',phone);await page.type('#loginPassword',pw);await Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}),page.click('#loginSubmitBtn')]);return page;}
for(const width of [1440,390]){
const page=await pageFor('0900000001','khach123',width);await page.waitForSelector('.ps-heart');await page.evaluate(()=>{[...document.querySelectorAll('.ps-heart')].slice(0,3).forEach(b=>b.click());window.scrollTo(0,document.getElementById('psGrid').getBoundingClientRect().top+scrollY-110);});await new Promise(r=>setTimeout(r,500));
await page.screenshot({path:'output/dot1b-customer-'+width+'.png'});
metrics.push(await page.evaluate(()=>({view:'customer',width:innerWidth,scrollWidth:document.documentElement.scrollWidth,floating:document.querySelector('#psSummaryCard').classList.contains('is-floating'),selected:document.querySelectorAll('.ps-photo.selected').length,hearts:[...document.querySelectorAll('.ps-heart')].filter(b=>{const r=b.getBoundingClientRect();return r.top>document.querySelector('#psSummaryCard').getBoundingClientRect().bottom&&r.bottom<innerHeight;}).slice(0,4).map(b=>{const r=b.getBoundingClientRect();return {width:r.width,height:r.height,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.ps-heart')===b};})})));
await page.close();}
const body=fixture.requestFrom(album,{photos:[{note:'Giữ nét tự nhiên',editOptions:['Chỉnh da','Chỉnh màu']},{note:'',editOptions:['Ánh sáng']},{note:'',editOptions:[]}],extraFee:0});const result=await fixture.json(base,'/api/edit-requests/',customer,body);if(result.status!==201)throw Error(JSON.stringify(result));
for(const width of [1440,390]){
const page=await pageFor('0900000003','anh123',width);await page.goto(ROOT_URL+'crm/admin.html#anh',{waitUntil:'networkidle0'});await page.waitForSelector('.photo-row-card');await page.evaluate(()=>document.querySelector('.photo-row-card').click());await new Promise(r=>setTimeout(r,400));await page.screenshot({path:'output/dot1b-worker-'+width+'.png'});metrics.push(await page.evaluate(()=>({view:'worker',width:innerWidth,scrollWidth:document.documentElement.scrollWidth,copyHeight:document.getElementById('copyPhotoNames').getBoundingClientRect().height,drive:[...document.querySelectorAll('.photo-download-btn')].map(b=>({text:b.textContent.trim(),height:b.getBoundingClientRect().height,width:b.getBoundingClientRect().width})),filenames:[...document.querySelectorAll('.photo-filename')].map(b=>b.textContent)})));await page.close();}
fs.writeFileSync('output/dot1b-visual-metrics.json',JSON.stringify(metrics,null,2));if(metrics.some(m=>m.scrollWidth>m.width))throw Error('Horizontal overflow');
}finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
