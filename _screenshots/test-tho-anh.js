// Test trang Thợ ảnh (crm/admin.html #anh + #hoan-tat): gửi 2 link Drive (ảnh gốc + đã chỉnh),
// nút Hoàn tất, đơn chuyển từ 3 hàng ưu tiên sang bảng "Đã hoàn tất", Sếp chỉ xem.
//   node _screenshots/test-tho-anh.js
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
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];

  async function login(phone, pw, width = 1440) {
    const page = await browser.newPage();
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

  // Dữ liệu sạch + 1 yêu cầu thật của khách (2 ảnh)
  const boot = await browser.newPage();
  await boot.goto(ROOT_URL + 'login.html', { waitUntil: 'networkidle0' });
  await boot.evaluate(() => localStorage.clear());
  await boot.close();

  const tho = await login('0900000003', 'anh123');
  await tho.goto(ROOT_URL + 'crm/admin.html#anh', { waitUntil: 'networkidle0' });
  await tho.evaluate((code) => AlohaData.createEditRequest({
    phone: '0900000001', customerName: 'Khách test', orderCode: code, serviceLabel: 'Newborn', photoCount: 2,
    photos: [{ id: 'p1', src: 'images/my-photos/photo-1.jpg', note: '' }, { id: 'p2', src: 'images/my-photos/photo-2.jpg', note: 'Làm sáng da' }]
  }), CODE);
  await tho.reload({ waitUntil: 'networkidle0' });
  await wait(400);

  // 1. Đơn Hoàn thành không nằm ở 3 hàng, nằm ở bảng Đã hoàn tất
  await expandAll(tho);
  let rows = await rowCodes(tho);
  check('Đơn minh hoạ đã Hoàn thành (#AB240888) không còn ở 3 hàng', !rows.includes('#AB240888'));
  check('Đơn #AB240888 nằm ở bảng Đã hoàn tất', (await doneCodes(tho)).includes('#AB240888'));
  check('Yêu cầu thật mới hiện ở 3 hàng', rows.includes(CODE), rows.join(','));
  const allCount = await tho.$eval('#workerCount-all', e => +e.textContent);
  check('Số đơn ô "Tất cả" = số thẻ ở 3 hàng', allCount === rows.length, allCount + ' vs ' + rows.length);

  // 2. Mở modal Drive từ thẻ
  let card = await cardByCode(tho, CODE);
  check('Thẻ có nút "Gửi link Drive cho khách"', card && /Gửi link Drive/.test(await card.$eval('.photo-row-drive-btn', b => b.textContent)));
  await (await card.$('.photo-row-drive-btn')).click();
  await wait(300);
  check('Modal Drive mở, chưa có nút Hoàn tất', await tho.$eval('#driveModalOverlay', o => o.classList.contains('open'))
    && await tho.$eval('#driveModalCompleteBtnWrap', w => w.hidden));

  // Chỉ 1 link -> chưa Hoàn tất được
  await tho.type('#driveModalInput', LINK_EDIT);
  await tho.click('#driveModalSubmit');
  await wait(300);
  check('Gửi 1 link: modal vẫn mở, chưa hiện Hoàn tất', await tho.$eval('#driveModalOverlay', o => o.classList.contains('open'))
    && await tho.$eval('#driveModalCompleteBtnWrap', w => w.hidden));

  // Link sai -> báo lỗi
  await tho.type('#driveModalInputOriginal', 'http://khong-an-toan');
  await tho.click('#driveModalSubmit');
  await wait(200);
  check('Link không https bị báo lỗi', !(await tho.$eval('#driveModalError', e => e.hidden)));

  // Đủ 2 link -> hiện Hoàn tất + nhắc còn ảnh chưa tick
  await tho.$eval('#driveModalInputOriginal', i => { i.value = ''; });
  await tho.type('#driveModalInputOriginal', LINK_ORIG);
  await tho.click('#driveModalSubmit');
  await wait(400);
  check('Đủ 2 link: hiện nút Hoàn tất', !(await tho.$eval('#driveModalCompleteBtnWrap', w => w.hidden)));
  let stored = await tho.evaluate((c) => AlohaData.getEditRequests().find(r => r.orderCode === c), CODE);
  check('Lưu đủ 2 link vào aloha_demo_db', stored.resultLink === LINK_EDIT && stored.resultLinkOriginal === LINK_ORIG);
  await tho.screenshot({ path: shot('tho-anh-drive-modal.png') });

  // 3. Modal chi tiết: hiện cả 2 link, nút "Chuyển bước" bị chặn khi chưa xong ảnh
  await tho.click('#driveModalClose');
  card = await cardByCode(tho, CODE);
  await card.click();
  await wait(300);
  const resultTxt = await tho.$eval('#kanbanResultCurrent', e => e.textContent);
  check('Modal chi tiết hiện link ảnh gốc + ảnh đã chỉnh', resultTxt.includes(LINK_ORIG) && resultTxt.includes(LINK_EDIT));
  check('Modal chi tiết không còn form 1 link cũ', !(await tho.$('#kanbanResultForm')));
  await tho.click('#kanbanModalClose');

  // 4. Bấm Hoàn tất từ modal Drive
  card = await cardByCode(tho, CODE);
  await (await card.$('.photo-row-drive-btn')).click();
  await wait(300);
  check('Mở lại: nút thẻ đổi thành "Cập nhật link Drive"', /Cập nhật/.test(await card.$eval('.photo-row-drive-btn', b => b.textContent)));
  await tho.click('#driveModalCompleteBtn');
  await wait(400);
  stored = await tho.evaluate((c) => AlohaData.getEditRequests().find(r => r.orderCode === c), CODE);
  check('Bấm Hoàn tất: trạng thái Hoàn thành', stored.status === 'Hoàn thành', stored.status);
  check('Hoàn tất tự đánh dấu xong hết ảnh', stored.doneIds.length === 2);
  check('Link ảnh gốc vẫn còn sau Hoàn tất', stored.resultLinkOriginal === LINK_ORIG);
  check('Modal Drive đã đóng', !(await tho.$eval('#driveModalOverlay', o => o.classList.contains('open'))));
  await expandAll(tho);
  rows = await rowCodes(tho);
  check('Đơn vừa Hoàn tất rời khỏi 3 hàng', !rows.includes(CODE));
  check('Đơn vừa Hoàn tất có trong bảng Đã hoàn tất', (await doneCodes(tho)).includes(CODE));

  // 5. Thẻ minh hoạ #AB240902 trong chi tiết: không còn nút đánh dấu / chuyển bước;
  //    giữ ảnh + mã ảnh + nút tải; form 2 link nằm ngay dưới ảnh, gửi + Hoàn tất được
  await tho.evaluate(() => [...document.querySelectorAll('#photoRows .photo-row-card')].find(c => c.querySelector('.photo-row-card-code').textContent.trim() === '#AB240902').click());
  await wait(300);
  let m = await tho.evaluate(() => ({
    toggles: document.querySelectorAll('#kanbanModalBody .photo-done-toggle, #kanbanModalBody .photo-done-flag').length,
    adv: document.querySelectorAll('#kanbanModalBody .kanban-modal-advance').length,
    progress: document.querySelectorAll('#kanbanModalBody .kanban-modal-progress').length,
    tiles: document.querySelectorAll('#kanbanModalBody .kanban-photo-tile').length,
    names: document.querySelectorAll('#kanbanModalBody .photo-filename').length,
    dl: document.querySelectorAll('#kanbanModalBody .photo-download-btn').length,
    formAfterGrid: (() => { const g = document.querySelector('#kanbanModalBody .kanban-photo-grid'), f = document.getElementById('kanbanLinkForm'); return !!(g && f && (g.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING)); })()
  }));
  check('Chi tiết: không còn nút "Đánh dấu đã xong" và "Chuyển sang bước tiếp theo"', m.toggles === 0 && m.adv === 0 && m.progress === 0, JSON.stringify(m));
  check('Chi tiết: giữ 5 ảnh + mã ảnh + nút tải xuống', m.tiles === 5 && m.names === 5 && m.dl === 5, JSON.stringify(m));
  check('Chi tiết: form gửi link Drive hiện sẵn ngay dưới ảnh', m.formAfterGrid);
  await tho.type('#kanbanLinkEdit', 'http://sai');
  await tho.evaluate(() => document.getElementById('kanbanLinkForm').requestSubmit()); await wait(200);
  check('Form dưới ảnh: link không https bị báo lỗi', !(await tho.$eval('#kanbanLinkError', e => e.hidden)));
  await tho.$eval('#kanbanLinkEdit', i => { i.value = ''; });
  await tho.type('#kanbanLinkOrig', LINK_ORIG);
  await tho.type('#kanbanLinkEdit', LINK_EDIT);
  await tho.evaluate(() => document.getElementById('kanbanLinkForm').requestSubmit()); await wait(300);
  m = await tho.evaluate(() => ({ cur: document.getElementById('kanbanResultCurrent').textContent, done: !!document.getElementById('kanbanLinkComplete') }));
  check('Form dưới ảnh: gửi đủ 2 link -> hiện "Khách đang thấy" + nút Hoàn tất', m.cur.includes('goc_test') && m.cur.includes('da_chinh_test') && m.done, JSON.stringify(m));
  await tho.screenshot({ path: shot('tho-anh-chi-tiet.png') });
  await tho.click('#kanbanLinkComplete'); await wait(400);
  check('Hoàn tất từ form dưới ảnh -> #AB240902 sang bảng Đã hoàn tất', (await doneCodes(tho)).includes('#AB240902') && !(await rowCodes(tho)).includes('#AB240902'));

  // Ảnh chụp desktop + mobile
  await tho.goto(ROOT_URL + 'crm/admin.html#anh', { waitUntil: 'networkidle0' });
  await wait(500);
  await tho.screenshot({ path: shot('tho-anh-desktop.png'), fullPage: false });
  await tho.setViewport({ width: 390, height: 844, isMobile: true });
  await wait(500);
  const overflow = await tho.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check('Mobile 390px không cuộn ngang', !overflow);
  await tho.screenshot({ path: shot('tho-anh-mobile.png'), fullPage: false });
  await tho.close();

  // 6. Sếp: chỉ xem, không có nút gửi link
  const sep = await login('0900000004', 'sep123');
  await sep.goto(ROOT_URL + 'crm/admin.html#anh', { waitUntil: 'networkidle0' });
  await wait(400);
  check('Sếp không thấy nút Gửi link Drive trên thẻ', (await sep.$$('.photo-row-drive-btn')).length === 0);
  check('Sếp thấy đơn đã Hoàn tất trong bảng', (await doneCodes(sep)).includes(CODE));
  await sep.close();

  check('Không có lỗi JS', errors.length === 0, errors.join(' | '));
  console.log(`\n${pass}/${pass + fail} PASS`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
