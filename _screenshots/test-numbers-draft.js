// Test "Ảnh của tôi": đánh số ảnh (#N) ở lưới / xem ảnh lớn / trang Thợ ảnh, gộp tab Tất cả + Ảnh gốc,
// ô tải ảnh gốc ghi đúng Google Photos, và nhớ ảnh đang chọn dở khi tải lại trang.
//   node _screenshots/test-numbers-draft.js
const puppeteer = require('puppeteer-core');
const path = require('path');
const { CHROME_PATH, ROOT_URL } = require('./test-env');

let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '→ ' + extra : ''); }
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const CUSTOMER = { role: 'khach-hang', name: 'Khách demo', phone: '0900000001' };

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.on('pageerror', e => errors.push(e.message));
  // Chặn server chat AI (không cần cho test này)
  await page.goto(ROOT_URL + 'login.html', { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.type('#loginPhone', '0900000001');
  await page.type('#loginPassword', 'khach123');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('#loginSubmitBtn')]);
  if (!page.url().includes('#/chon-anh')) await page.goto(page.url().split('#')[0] + '#/chon-anh');
  await wait(600);
  const reloadAsCustomer = async () => {
    await page.evaluate((c) => localStorage.setItem('aloha_auth', JSON.stringify({ ...c, loginAt: Date.now() })), CUSTOMER);
    await page.reload({ waitUntil: 'networkidle0' });
    await wait(700);
  };
  const total = await page.$$eval('.ps-photo', els => els.length);

  // ---------- Đánh số ảnh
  let v = await page.evaluate(() => ({
    b1: document.querySelector('.ps-photo[data-id="ph-1"] .ps-photo-badge').textContent,
    b37: document.querySelector('.ps-photo[data-id="ph-37"] .ps-photo-badge').textContent,
    anyGoc: [...document.querySelectorAll('.ps-photo-badge')].some(b => b.textContent.includes('Ảnh gốc'))
  }));
  check('Lưới ảnh: mỗi ô có số #N (ô 1 là #1, ô 37 là #37), không còn nhãn "Ảnh gốc" lặp lại', v.b1 === '#1' && v.b37 === '#37' && !v.anyGoc, JSON.stringify(v));

  // ---------- Tab gộp + số đếm
  v = await page.evaluate(() => ({
    tabs: [...document.querySelectorAll('.ps-tab')].map(t => t.dataset.filter),
    allLabel: document.querySelector('.ps-tab[data-filter="all"]').textContent.replace(/\s+/g, ' ').trim(),
    likedCount: document.getElementById('psLikedCount').textContent
  }));
  check('Còn 3 tab: Ảnh gốc / Yêu thích / Ảnh đã chỉnh', v.tabs.join(',') === 'all,liked,edited', JSON.stringify(v));
  check(`Tab "Ảnh gốc" có số ${total}, "Yêu thích" có số 0`, v.allLabel === `Ảnh gốc ${total}` && v.likedCount === '0', JSON.stringify(v));

  // ---------- Ô tải ảnh gốc
  v = await page.evaluate(() => ({ text: document.getElementById('psDriveLink').textContent.replace(/\s+/g, ' ').trim(), href: document.getElementById('psDriveLink').href }));
  check('Ô tải ảnh gốc ghi đúng "Google Photos" (link là album Google Photos), không còn "Google Drive"', v.text.includes('Google Photos') && !v.text.includes('Google Drive') && v.href.includes('photos.google.com'), JSON.stringify(v));

  v = await page.evaluate(() => {
    const t = document.querySelector('.ps-head-row h1').getBoundingClientRect(), c = document.getElementById('psSummaryCard').getBoundingClientRect(), d = document.getElementById('psDriveLink').getBoundingClientRect();
    return { titleTop: Math.round(t.top), cardTop: Math.round(c.top), cardLeft: Math.round(c.left), driveLeft: Math.round(d.left) };
  });
  check('Máy tính 1440px: ô "Đã chọn" nằm cùng hàng tiêu đề, bên phải ô tải ảnh gốc (không bị đẩy xuống)', v.cardTop === v.titleTop && v.cardLeft > v.driveLeft, JSON.stringify(v));
  // ---------- Xem ảnh lớn: hiện số ảnh
  await page.evaluate(() => document.querySelector('.ps-photo[data-id="ph-5"] img').click());
  await wait(400);
  v = await page.$eval('#psLbCounter', el => el.textContent);
  check(`Xem ảnh lớn ở tab Ảnh gốc: "Ảnh #5 · 5 / ${total}"`, v === `Ảnh #5 · 5 / ${total}`, v);
  await page.keyboard.press('Escape'); await wait(300);

  // ---------- Chọn dở: 3 ảnh + ghi chú ảnh #40 + ghi chú chung -> tải lại vẫn còn
  for (const id of ['ph-2', 'ph-5', 'ph-40']) await page.evaluate((i) => document.querySelector(`.ps-photo[data-id="${i}"] .ps-heart`).click(), id);
  check('Chọn 3 ảnh -> số trên tab Yêu thích thành 3', (await page.$eval('#psLikedCount', el => el.textContent)) === '3');
  await page.evaluate(() => document.querySelector('.ps-photo[data-id="ph-40"] img').click());
  await page.waitForFunction(() => !document.getElementById('psLbNoteWrap').hidden, { timeout: 3000 });
  await wait(300);
  await page.type('#psLbNote', 'Làm sáng da ảnh 40');
  await page.keyboard.press('Escape'); await wait(300);
  await page.click('.ps-tab[data-filter="liked"]'); await wait(200);
  v = await page.$eval('#psLbCounter', el => el.textContent);
  await page.evaluate(() => document.querySelector('.ps-photo[data-id="ph-40"] img').click()); await wait(300);
  v = await page.$eval('#psLbCounter', el => el.textContent);
  check('Xem ảnh lớn ở tab Yêu thích: vẫn hiện đúng số ảnh gốc "Ảnh #40 · 3 / 3"', v === 'Ảnh #40 · 3 / 3', v);
  await page.keyboard.press('Escape'); await wait(300);
  await page.type('#psNote', 'Tông màu ấm cho cả bộ');
  await wait(600); // chờ lưu nháp (300ms)
  await reloadAsCustomer();
  v = await page.evaluate(() => ({
    sel: [...document.querySelectorAll('.ps-photo.selected')].map(c => c.dataset.id).join(','),
    count: document.getElementById('selectedCount').textContent,
    liked: document.getElementById('psLikedCount').textContent,
    general: document.getElementById('psNote').value,
    msg: document.getElementById('psBulkUndo').textContent.trim(),
    unlocked: [...document.querySelectorAll('.ps-heart')].every(b => !b.disabled),
    submit: !document.getElementById('psSubmitBtn').disabled
  }));
  check('Tải lại trang: vẫn giữ 3 ảnh đã chọn + ghi chú chung, vẫn chọn/gửi tiếp được', v.sel === 'ph-2,ph-5,ph-40' && v.count === '3' && v.liked === '3' && v.general === 'Tông màu ấm cho cả bộ' && v.unlocked && v.submit, JSON.stringify(v));
  check('Tải lại trang: báo "Đã giữ lại 3 ảnh bạn chọn lần trước"', v.msg.includes('Đã giữ lại 3 ảnh'), v.msg);
  await page.evaluate(() => document.querySelector('.ps-photo[data-id="ph-40"] img').click());
  await page.waitForFunction(() => !document.getElementById('psLbNoteWrap').hidden, { timeout: 3000 }).catch(() => {});
  v = await page.$eval('#psLbNote', el => el.value);
  check('Tải lại trang: ghi chú riêng ảnh #40 vẫn còn', v === 'Làm sáng da ảnh 40', v);
  await page.keyboard.press('Escape'); await wait(300);

  // ---------- Bỏ chọn hết -> tải lại không còn gì
  await page.click('#psClearAllBtn'); await wait(200);
  await page.evaluate(() => { document.getElementById('psNote').value = ''; document.getElementById('psNote').dispatchEvent(new Event('input')); });
  await page.evaluate(() => { const n = document.getElementById('psLbNote'); }); // ghi chú ảnh #40 vẫn giữ trong nháp là chấp nhận được
  await wait(600);
  await reloadAsCustomer();
  v = await page.evaluate(() => document.querySelectorAll('.ps-photo.selected').length);
  check('Bỏ chọn tất cả rồi tải lại -> không còn ảnh nào được chọn', v === 0, v);

  // ---------- Nháp có ảnh vượt gói (11 ảnh) -> tải lại vẫn đúng ảnh tính phí
  for (let i = 1; i <= 10; i++) await page.evaluate((n) => document.querySelector(`.ps-photo[data-id="ph-${n}"] .ps-heart`).click(), i);
  await page.evaluate(() => document.querySelector('.ps-photo[data-id="ph-11"] .ps-heart').click()); await wait(300);
  await page.evaluate(() => document.querySelector('.ps-modal-overlay.show .ps-modal-yes').click()); await wait(600);
  await reloadAsCustomer();
  v = await page.evaluate(() => ({ count: document.getElementById('selectedCount').textContent, extra: [...document.querySelectorAll('.ps-photo.ps-extra-photo')].map(c => c.dataset.id).join(','), fee: document.getElementById('psExtra').hidden ? '' : document.getElementById('extraFee').textContent }));
  check('Nháp 11 ảnh: tải lại vẫn 11 ảnh, ảnh #11 là ảnh tính phí 50.000đ', v.count === '11' && v.extra === 'ph-11' && v.fee === '50.000đ', JSON.stringify(v));

  // ---------- Gửi yêu cầu (trong gói) -> xoá nháp, thợ thấy số ảnh
  await page.evaluate(() => document.querySelector('.ps-photo[data-id="ph-11"] .ps-heart').click()); await wait(300);
  await page.evaluate(() => { document.getElementById('psSubmitBtn').click(); document.getElementById('psReviewConfirm').click(); }); await wait(500);
  v = await page.evaluate(() => { const db = JSON.parse(localStorage.getItem('aloha_demo_db')); return { draft: (db.selectionDrafts || {})['0900000001'] || null, req: db.editRequests.length }; });
  check('Gửi yêu cầu xong -> xoá nháp chọn dở', v.draft === null && v.req === 1, JSON.stringify(v));

  const staff = await browser.newPage();
  await staff.setViewport({ width: 1440, height: 900 });
  staff.on('pageerror', e => errors.push(e.message));
  await staff.goto(ROOT_URL + 'login.html', { waitUntil: 'networkidle0' });
  await staff.type('#loginPhone', '0900000003');
  await staff.type('#loginPassword', 'anh123');
  await Promise.all([staff.waitForNavigation({ waitUntil: 'networkidle0' }), staff.click('#loginSubmitBtn')]);
  await wait(600);
  await staff.evaluate(() => [...document.querySelectorAll('.kanban-card')].find(c => c.textContent.includes('Mới')).click());
  await wait(400);
  v = await staff.evaluate(() => [...document.querySelectorAll('#kanbanModalBody .kanban-photo-num')].map(s => s.textContent));
  check('Trang Thợ ảnh: mỗi ảnh khách gửi hiện đúng số #1..#10 như khách thấy', v.length === 10 && v[0] === '#1' && v[9] === '#10', JSON.stringify(v));
  await staff.screenshot({ path: path.resolve(__dirname, 'numbers-staff-modal.png') });

  // ---------- Điện thoại
  await page.setViewport({ width: 390, height: 844 }); await wait(400);
  v = await page.evaluate(() => ({ hScroll: document.documentElement.scrollWidth > window.innerWidth, tabsW: Math.round(document.querySelector('.ps-tabs').scrollWidth), vw: window.innerWidth }));
  check('Điện thoại: không tràn ngang (3 tab + số đếm)', !v.hScroll, JSON.stringify(v));
  await page.evaluate(() => document.querySelector('.ps-tabs').scrollIntoView({ block: 'start', behavior: 'instant' }));
  await wait(300);
  await page.screenshot({ path: path.resolve(__dirname, 'numbers-mobile.png') });

  check('Không có lỗi JS', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
