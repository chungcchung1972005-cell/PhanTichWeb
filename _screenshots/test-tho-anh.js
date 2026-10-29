const fixture=require('./workflow-fixture');
// Test trang Thợ ảnh (crm/admin.html #anh + #hoan-tat), lấy từ nhánh Thợ ảnh (7ee735d) và sửa
// theo quyết định tích hợp vào trang Sếp 2026-10-15:
//  - Hoàn thành chỉ bắt buộc link ẢNH ĐÃ CHỈNH; link ẢNH GỐC tuỳ chọn, chỉ nội bộ, khách không thấy.
//  - Không còn nút đánh dấu từng ảnh / chuyển bước; nút Hoàn tất đánh dấu xong mọi ảnh.
//  - Thợ chỉnh 1/2/3 (tên tạm), nhận diện theo SĐT; đơn chưa phân công hiện "Chưa phân công".
//  - Mã đơn minh hoạ dải #AB240701..#AB240713.
//   node _screenshots/test-tho-anh.js   (ghi 4 ảnh: tho-anh-drive-modal/chi-tiet/desktop/mobile.png)
const puppeteer = require('puppeteer-core');
const { CHROME_PATH, ROOT_URL, shot } = require('./test-env');

let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '→ ' + extra : ''); }
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const LINK_ORIG = 'https://drive.google.com/drive/folders/goc_test';
const LINK_EDIT = 'https://drive.google.com/drive/folders/da_chinh_test';
const CODE = '#ABTEST01';

(async () => {
  const fixtureProcess=await fixture.fixtureServer();
  const customerToken=await fixture.login('http://localhost:3001','0900000001','khach123');
  const other=(await fixture.json('http://localhost:3001','/api/sale-chat/auth/register',null,{phone:'0911111111',name:'Fixture other',password:'fixture123'})).data.token;
  const sample2=await fixture.sourceAlbum('http://localhost:3001',{customer:other,code:'#AB240702'});
  const sample3=await fixture.sourceAlbum('http://localhost:3001',{customer:other,code:'#AB240703'});
  const album=await fixture.sourceAlbum('http://localhost:3001',{customer:customerToken,code:'#ABTEST01'});
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];

  async function login(phone, pw, width = 1440) {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(()=>{window.ALOHA_FEATURES={editSync:false};});
    await fixture.installLocalAlbum(page,album);
    await page.setRequestInterception(true);
    page.on('request',async r=>{if(!await fixture.thumbnail(page,r))await r.continue();});
    await page.setViewport({ width, height: 900 });
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.dismiss());
    await page.goto(ROOT_URL + 'login.html', { waitUntil: 'networkidle0' });
    await page.type('#loginPhone', phone);
    await page.type('#loginPassword', pw);
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('#loginSubmitBtn')]);
    await wait(500);
    return page;
  }
  const rowCodes = (page) => page.$$eval('#photoRows .photo-row-card-code', els => els.map(e => e.textContent.trim()));
  const doneCodes = (page) => page.$$eval('#completedTableBody .ct-code-val', els => els.map(e => e.textContent.trim()));
  async function expandAll(page) {
    for (const k of ['urgent', 'medium', 'normal']) {
      const hidden = await page.$eval('#photoRowMore-' + k, b => b.hidden);
      const txt = await page.$eval('#photoRowMore-' + k, b => b.textContent);
      if (!hidden && /Xem thêm/.test(txt)) await page.click('#photoRowMore-' + k);
    }
  }
  async function cardByCode(page, code) {
    const cards = await page.$$('#photoRows .photo-row-card');
    for (const c of cards) {
      if ((await c.$eval('.photo-row-card-code', e => e.textContent.trim())) === code) return c;
    }
    return null;
  }

  // Dữ liệu sạch + 1 yêu cầu thật của khách 0900000001 (2 ảnh, chưa phân công thợ)
  const boot = await browser.newPage();
  await boot.goto(ROOT_URL + 'login.html', { waitUntil: 'networkidle0' });
  await boot.evaluate(() => localStorage.clear());
  await boot.close();

  const tho = await login('0900000003', 'anh123');
  await tho.goto(ROOT_URL + 'crm/admin.html#anh', { waitUntil: 'networkidle0' });
  await fixture.localRequest(tho,sample2,5);
  const finished=await fixture.localRequest(tho,sample3,3);
  await tho.evaluate(id=>(AlohaData.setResultLink(id,'https://drive.google.com/edited','https://drive.google.com/original'),AlohaData.advanceRequestStatus(id),AlohaData.advanceRequestStatus(id)),finished.id);
  await tho.evaluate(({code,album}) => AlohaData.createEditRequest({
    sourceAlbumId:album.id,
    phone: '0900000001', customerName: 'Khách test', orderCode: code, serviceLabel: 'Newborn', photoCount: 2,
    photos: album.photos.slice(0,2).map((p,i)=>({...p,note:i?'Làm sáng da':''}))
  }), {code:CODE,album});
  await tho.reload({ waitUntil: 'networkidle0' });
  await wait(400);

  // 1. Thợ ảnh 0900000003 = Thợ chỉnh 1 (theo SĐT); thấy đơn của mình + đơn chưa phân công
  const active = await tho.$eval('.photo-worker-card.active', b => b.dataset.worker);
  check('Thợ ảnh 0900000003 tự chọn ô "Thợ chỉnh 1" (nhận diện theo SĐT)', active === '0900000003', active);
  const moreState = await tho.evaluate(() => ['urgent', 'medium', 'normal'].map(k => ({
    cards: document.querySelectorAll('#photoRowCards-' + k + ' .photo-row-card').length,
    shown: getComputedStyle(document.getElementById('photoRowMore-' + k)).display !== 'none',
    text: document.getElementById('photoRowMore-' + k).textContent
  })));
  check('Nút "Xem thêm" chỉ hiện khi hàng còn đơn ẩn, không bao giờ "-N đơn"', moreState.every(r => !r.shown || (/Xem thêm \d+ đơn|Thu gọn/.test(r.text) && !/-/.test(r.text))) && moreState.every(r => r.cards < 3 ? !r.shown : true), JSON.stringify(moreState));
  await expandAll(tho);
  let rows = await rowCodes(tho);
  const workers = await tho.$$eval('#photoRows .photo-row-card-worker', els => els.map(e => e.textContent.trim()));
  check('Ô Thợ chỉnh 1: chỉ đơn của Thợ chỉnh 1 hoặc "Chưa phân công"', workers.length > 0 && workers.every(w => w === 'Thợ ảnh demo' || w === 'Chưa phân công'), workers.join(','));
  check('Yêu cầu thật (chưa phân công) hiện ở ô Thợ chỉnh 1', rows.includes(CODE), rows.join(','));
  check('Số đơn trên ô Thợ chỉnh 1 = số thẻ đang hiện', +(await tho.$eval('#workerCount-0900000003', e => e.textContent)) === rows.length);
  await tho.click('#workerBtn-all'); await wait(200);
  await expandAll(tho);
  rows = await rowCodes(tho);
  check('Ô "Tất cả": có yêu cầu chưa phân công, số đơn = số thẻ', rows.includes(CODE) && +(await tho.$eval('#workerCount-all', e => e.textContent)) === rows.length, rows.length);
  check('Đơn minh hoạ đã Hoàn thành (#AB240703) không ở 3 hàng, nằm ở bảng Đã hoàn tất', !rows.includes('#AB240703') && (await doneCodes(tho)).includes('#AB240703'));
  check('Mọi mã đơn minh hoạ thuộc dải #AB240701..#AB240713', rows.concat(await doneCodes(tho)).filter(c => c !== CODE).every(c => /^#AB2407(0[1-9]|1[0-3])$/.test(c)));
  const realCardText = await (await cardByCode(tho, CODE)).evaluate(c => c.textContent);
  check('Thẻ yêu cầu thật ghi "Chưa phân công" + nhãn "Mới"', realCardText.includes('Chưa phân công') && realCardText.includes('Mới'), realCardText.replace(/\s+/g, ' '));

  // 2. Mở cửa sổ Drive từ thẻ
  let card = await cardByCode(tho, CODE);
  check('Thẻ có nút "Gửi link Drive"', card && /Gửi link Drive/.test(await card.$eval('.photo-row-drive-btn', b => b.textContent)));
  await tho.evaluate(code=>[...document.querySelectorAll('#photoRows .photo-row-card')].find(c=>c.querySelector('.photo-row-card-code').textContent.trim()===code).querySelector('.photo-row-drive-btn').click(),CODE);
  await wait(300);
  check('Cửa sổ Drive mở, chưa có nút Hoàn tất', await tho.$eval('#driveModalOverlay', o => o.classList.contains('open'))
    && await tho.$eval('#driveModalCompleteBtnWrap', w => w.hidden));
  const hints = await tho.$$eval('#driveModalForm .drive-modal-hint', els => els.map(e => e.textContent));
  check('Gợi ý: thư mục ảnh gốc để Hạn chế, KHÔNG hướng dẫn công khai ảnh gốc', hints.some(h => /ảnh gốc/.test(h) && /Hạn chế/.test(h)) && !hints.some(h => /ảnh gốc/.test(h) && /Bất kỳ ai/.test(h)), JSON.stringify(hints));

  // Chỉ link ảnh gốc -> lưu được nhưng CHƯA Hoàn tất
  await tho.type('#driveModalInputOriginal', LINK_ORIG);
  await tho.click('#driveModalSubmit');
  await wait(300);
  check('Chỉ link ảnh gốc: lưu được, cửa sổ vẫn mở, chưa hiện Hoàn tất', await tho.$eval('#driveModalOverlay', o => o.classList.contains('open'))
    && await tho.$eval('#driveModalCompleteBtnWrap', w => w.hidden) && await tho.$eval('#driveModalError', e => e.hidden));

  // Link sai -> báo lỗi
  await tho.type('#driveModalInput', 'http://khong-an-toan');
  await tho.click('#driveModalSubmit');
  await wait(200);
  check('Link không https bị báo lỗi', !(await tho.$eval('#driveModalError', e => e.hidden)));

  // Có link ảnh đã chỉnh -> hiện Hoàn tất
  await tho.$eval('#driveModalInput', i => { i.value = ''; });
  await tho.type('#driveModalInput', LINK_EDIT);
  await tho.click('#driveModalSubmit');
  await wait(400);
  check('Có link ảnh đã chỉnh: hiện nút Hoàn tất', !(await tho.$eval('#driveModalCompleteBtnWrap', w => w.hidden)));
  let stored = await tho.evaluate((c) => AlohaData.getEditRequests().find(r => r.orderCode === c), CODE);
  check('Lưu đủ 2 link vào aloha_demo_db', stored.resultLink === LINK_EDIT && stored.resultLinkOriginal === LINK_ORIG);
  await tho.screenshot({ path: require('path').resolve(__dirname, '../output/dot1b-tho-anh-drive-modal.png') });

  // 3. Modal chi tiết: hiện cả 2 link (link gốc ghi rõ nội bộ)
  await tho.click('#driveModalClose');
  card = await cardByCode(tho, CODE);
  await tho.evaluate(code=>[...document.querySelectorAll('#photoRows .photo-row-card')].find(c=>c.querySelector('.photo-row-card-code').textContent.trim()===code).click(),CODE);
  await wait(300);
  const resultTxt = await tho.$eval('#kanbanResultCurrent', e => e.textContent);
  check('Modal chi tiết hiện link ảnh gốc (nội bộ) + ảnh đã chỉnh', resultTxt.includes(LINK_ORIG) && resultTxt.includes(LINK_EDIT) && resultTxt.includes('nội bộ'), resultTxt.replace(/\s+/g, ' '));
  check('Modal chi tiết không còn form 1 link cũ', !(await tho.$('#kanbanResultForm')));
  await tho.click('#kanbanModalClose');

  // 4. Bấm Hoàn tất từ cửa sổ Drive (Chờ xử lý -> Hoàn thành, đi lần lượt từng bước)
  card = await cardByCode(tho, CODE);
  await tho.evaluate(code=>[...document.querySelectorAll('#photoRows .photo-row-card')].find(c=>c.querySelector('.photo-row-card-code').textContent.trim()===code).querySelector('.photo-row-drive-btn').click(),CODE);
  await wait(300);
  check('Mở lại: nút thẻ đổi thành "Cập nhật link Drive"', /Cập nhật/.test(await card.$eval('.photo-row-drive-btn', b => b.textContent)));
  await tho.click('#driveModalCompleteBtn');
  await wait(400);
  stored = await tho.evaluate((c) => AlohaData.getEditRequests().find(r => r.orderCode === c), CODE);
  check('Bấm Hoàn tất: trạng thái Hoàn thành', stored.status === 'Hoàn thành', stored.status);
  check('Hoàn tất tự đánh dấu xong hết ảnh', stored.doneIds.length === 2);
  check('Link ảnh gốc vẫn còn sau Hoàn tất', stored.resultLinkOriginal === LINK_ORIG);
  check('Cửa sổ Drive đã đóng', !(await tho.$eval('#driveModalOverlay', o => o.classList.contains('open'))));
  await expandAll(tho);
  rows = await rowCodes(tho);
  check('Đơn vừa Hoàn tất rời khỏi 3 hàng', !rows.includes(CODE));
  check('Đơn vừa Hoàn tất có trong bảng Đã hoàn tất', (await doneCodes(tho)).includes(CODE));

  // 5. Thẻ minh hoạ #AB240702 (Thợ chỉnh 2, Đang thực hiện) trong chi tiết: không còn nút đánh
  //    dấu / chuyển bước; thanh tiến độ chỉ để xem + giải thích; ảnh + mã ảnh + nút tải; form 2 link dưới ảnh
  await tho.evaluate(() => [...document.querySelectorAll('#photoRows .photo-row-card')].find(c => c.querySelector('.photo-row-card-code').textContent.trim() === '#AB240702').click());
  await wait(300);
  let m = await tho.evaluate(() => ({
    toggles: document.querySelectorAll('#kanbanModalBody .photo-done-toggle, #kanbanModalBody .photo-done-flag').length,
    adv: document.querySelectorAll('#kanbanModalBody .kanban-modal-advance').length,
    progress: document.querySelectorAll('#kanbanModalBody .kanban-modal-progress').length,
    note: document.getElementById('kanbanModalBody').textContent.includes('Tiến độ đếm số ảnh'),
    tiles: document.querySelectorAll('#kanbanModalBody .kanban-photo-tile').length,
    names: document.querySelectorAll('#kanbanModalBody .photo-filename').length,
    dl: document.querySelectorAll('#kanbanModalBody .photo-download-btn').length,
    formAfterGrid: (() => { const g = document.querySelector('#kanbanModalBody .kanban-photo-grid'), f = document.getElementById('kanbanLinkForm'); return !!(g && f && (g.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING)); })()
  }));
  check('Chi tiết: không còn nút "Đánh dấu đã xong" / "Chuyển sang bước tiếp theo"; tiến độ chỉ xem + có giải thích', m.toggles === 0 && m.adv === 0 && m.progress === 1 && m.note, JSON.stringify(m));
  check('Chi tiết: giữ 5 ảnh + mã ảnh + nút tải xuống', m.tiles === 5 && m.names === 5 && m.dl === 5, JSON.stringify(m));
  check('Chi tiết: form gửi link Drive hiện sẵn ngay dưới ảnh', m.formAfterGrid);
  await tho.type('#kanbanLinkEdit', 'http://sai');
  await tho.evaluate(() => document.getElementById('kanbanLinkForm').requestSubmit()); await wait(200);
  check('Form dưới ảnh: link không https bị báo lỗi', !(await tho.$eval('#kanbanLinkError', e => e.hidden)));
  await tho.$eval('#kanbanLinkEdit', i => { i.value = ''; });
  await tho.type('#kanbanLinkOrig', LINK_ORIG);
  await tho.evaluate(() => document.getElementById('kanbanLinkForm').requestSubmit()); await wait(300);
  check('Form dưới ảnh: chỉ link ảnh gốc -> chưa có nút Hoàn tất', !(await tho.$('#kanbanLinkComplete')));
  await tho.type('#kanbanLinkEdit', LINK_EDIT);
  await tho.evaluate(() => document.getElementById('kanbanLinkForm').requestSubmit()); await wait(300);
  m = await tho.evaluate(() => ({ cur: document.getElementById('kanbanResultCurrent').textContent, done: !!document.getElementById('kanbanLinkComplete') }));
  check('Form dưới ảnh: thêm link ảnh đã chỉnh -> hiện 2 link + nút Hoàn tất', m.cur.includes('goc_test') && m.cur.includes('da_chinh_test') && m.done, JSON.stringify(m));
  await tho.screenshot({ path: require('path').resolve(__dirname, '../output/dot1b-tho-anh-chi-tiet.png') });
  await tho.click('#kanbanLinkComplete'); await wait(400);
  check('Hoàn tất từ form dưới ảnh -> #AB240702 sang bảng Đã hoàn tất', (await doneCodes(tho)).includes('#AB240702') && !(await rowCodes(tho)).includes('#AB240702'));

  // Ảnh chụp desktop + mobile
  await tho.goto(ROOT_URL + 'crm/admin.html#anh', { waitUntil: 'networkidle0' });
  await wait(500);
  await tho.screenshot({ path: require('path').resolve(__dirname, '../output/dot1b-tho-anh-desktop.png'), fullPage: false });
  await tho.setViewport({ width: 390, height: 844, isMobile: true });
  await wait(500);
  const overflow = await tho.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check('Mobile 390px không cuộn ngang', !overflow);
  await tho.screenshot({ path: require('path').resolve(__dirname, '../output/dot1b-tho-anh-mobile.png'), fullPage: false });
  await tho.close();

  // 6. Khách 0900000001: thấy link ảnh đã chỉnh, KHÔNG thấy link ảnh gốc
  const cust = await login('0900000001', 'khach123');
  if (!cust.url().includes('#/chon-anh')) { await cust.goto(cust.url().split('#')[0] + '#/chon-anh', { waitUntil: 'networkidle0' }); await wait(500); }
  await cust.evaluate(() => document.querySelector('.ps-tab[data-filter="edited"]').click()); await wait(400);
  m = await cust.evaluate((o) => ({ edit: (document.getElementById('psResultLink') || {}).href, leak: document.body.innerHTML.includes(o) || document.body.innerHTML.includes('goc_test') }), LINK_ORIG);
  check('Khách thấy link ảnh đã chỉnh, KHÔNG thấy link ảnh gốc', m.edit === LINK_EDIT && !m.leak, JSON.stringify(m));
  await cust.close();

  // 7. Sếp: chỉ xem, không có nút gửi link / Hoàn tất
  const sep = await login('0900000004', 'sep123');
  await sep.goto(ROOT_URL + 'crm/admin.html#anh', { waitUntil: 'networkidle0' });
  await wait(400);
  check('Sếp không thấy nút Gửi link Drive trên thẻ', (await sep.$$('.photo-row-drive-btn')).length === 0);
  check('Sếp thấy đơn đã Hoàn tất trong bảng', (await doneCodes(sep)).includes(CODE));
  m = await sep.evaluate((code) => {
    const row = [...document.querySelectorAll('#completedTableBody tr')].find(tr => tr.textContent.includes(code));
    return row ? row.querySelector('.ct-worker-badge').textContent : '';
  }, CODE);
  check('Bảng Đã hoàn tất: yêu cầu thật ghi "Chưa phân công"', m === 'Chưa phân công', m);
  m = await sep.evaluate(() => {
    const row = [...document.querySelectorAll('#completedTableBody tr')].find(tr => tr.textContent.includes('#AB240703'));
    return row ? [...row.querySelectorAll('.ct-link-anchor')].map(a => a.href) : [];
  });
  check('Đã hoàn tất: đơn demo #AB240703 hiện đủ 2 link Drive demo', m.length === 2 && m.every(h => h.startsWith('https://drive.google.com/')), JSON.stringify(m));
  check('Không còn chữ "Khách đang thấy" trên trang', !(await sep.evaluate(() => document.body.innerHTML.includes('Khách đang thấy'))));
  await sep.close();

  check('Không có lỗi JS', errors.length === 0, errors.join(' | '));
  console.log(`\n${pass}/${pass + fail} PASS`);
  await browser.close();
  fixtureProcess.close();
  process.exit(fail ? 1 : 0);
})().catch(e=>{console.error(e);process.exit(1);});
