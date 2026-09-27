// Test view "Ảnh của tôi": lưới ảnh từ album Google Photos (không giới hạn số
// ảnh) + lightbox xem ảnh lớn (lướt, thu phóng) + yêu thích và ghi chú chỉnh
// sửa ngay trong lightbox. Cần mạng (ảnh tải từ lh3.googleusercontent.com).
//   node _screenshots/test-lightbox.js
const puppeteer = require('puppeteer-core');
const { CHROME_PATH } = require('./test-env');
const path = require('path');

let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '→ ' + extra : ''); }
}

(async () => {
  const root = path.resolve(__dirname, '..').replace(/\\/g, '/');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('file:///' + root + '/login.html', { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.type('#loginPhone', '0900000001');
  await page.type('#loginPassword', 'khach123');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('#loginSubmitBtn')]);
  if (!page.url().includes('#/chon-anh')) {
    await page.goto(page.url().split('#')[0] + '#/chon-anh');
  }
  await new Promise(r => setTimeout(r, 800));

  const total = await page.evaluate(() => GOOGLE_PHOTOS_DATA.length);
  const cards = await page.$$eval('.ps-photo', els => els.length);
  check(`Tab Tất cả hiện đủ ${total} ảnh của album`, cards === total && total > 16, cards);
  await page.waitForFunction(() => { const i = document.querySelector('.ps-photo img'); return i.complete && i.naturalWidth > 0; }, { timeout: 15000 });
  check('Ảnh đầu tiên tải được từ Google Photos', true);

  await page.click('.ps-tab[data-filter="original"]');
  const originalVisible = await page.$$eval('.ps-photo:not(.hidden-by-filter)', els => els.length);
  check('Tab Ảnh gốc cũng hiện đủ ảnh', originalVisible === total, originalVisible);
  await page.click('.ps-tab[data-filter="all"]');

  // Mở lightbox ở ảnh số 5
  await page.click('.ps-photo[data-id="ph-5"] img');
  await new Promise(r => setTimeout(r, 400));
  check('Bấm vào ảnh mở lightbox', await page.$eval('#psLightbox', el => el.classList.contains('show')));
  check('Bộ đếm hiện 5 / ' + total, (await page.$eval('#psLbCounter', el => el.textContent)) === `5 / ${total}`);
  await page.waitForFunction(() => { const i = document.getElementById('psLbImg'); return i.complete && i.naturalWidth > 0; }, { timeout: 15000 });
  check('Ảnh lớn tải được', true);

  await page.click('#psLbNext');
  check('Nút › sang ảnh 6', (await page.$eval('#psLbCounter', el => el.textContent)) === `6 / ${total}`);
  await page.keyboard.press('ArrowRight');
  check('Phím → sang ảnh 7', (await page.$eval('#psLbCounter', el => el.textContent)) === `7 / ${total}`);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  check('Phím ← về ảnh 5', (await page.$eval('#psLbCounter', el => el.textContent)) === `5 / ${total}`);

  await page.click('#psLbZoomIn');
  check('Nút + phóng to 150%', (await page.$eval('#psLbZoomReset', el => el.textContent)) === '150%');
  const stage = await page.$('#psLbStage');
  const box = await stage.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel({ deltaY: -200 });
  await new Promise(r => setTimeout(r, 200));
  check('Cuộn chuột phóng to thêm (180%)', (await page.$eval('#psLbZoomReset', el => el.textContent)) === '180%');
  await page.screenshot({ path: path.resolve(__dirname, 'test-lightbox-zoom.png') });
  await page.click('#psLbZoomReset');
  check('Bấm % về lại 100%', (await page.$eval('#psLbZoomReset', el => el.textContent)) === '100%');

  // Yêu thích + ghi chú trong lightbox
  check('Chưa chọn thì ẩn ô ghi chú', await page.$eval('#psLbNoteWrap', el => el.hidden));
  await page.click('#psLbFav');
  check('Bấm Chọn làm yêu thích -> ảnh được chọn', (await page.$eval('#selectedCount', el => el.textContent)) === '1');
  check('Ô tim trên lưới cũng được chọn', await page.$eval('.ps-photo[data-id="ph-5"]', el => el.classList.contains('selected')));
  check('Hiện ô ghi chú chỉnh sửa', !(await page.$eval('#psLbNoteWrap', el => el.hidden)));
  await page.type('#psLbNote', 'Làm sáng da, xoá vết đỏ trên má');
  await page.keyboard.press('ArrowRight'); // đang gõ ghi chú: phím mũi tên không được chuyển ảnh
  check('Đang gõ ghi chú thì phím → không chuyển ảnh', (await page.$eval('#psLbCounter', el => el.textContent)) === `5 / ${total}`);
  await page.screenshot({ path: path.resolve(__dirname, 'test-lightbox-note.png') });

  await page.click('#psLbNext');
  check('Ảnh 6 chưa chọn nên ẩn ghi chú', await page.$eval('#psLbNoteWrap', el => el.hidden));
  await page.click('#psLbPrev');
  check('Quay lại ảnh 5 thấy đúng ghi chú đã nhập', (await page.$eval('#psLbNote', el => el.value)) === 'Làm sáng da, xoá vết đỏ trên má');

  await page.keyboard.press('Escape');
  check('Esc đóng lightbox', !(await page.$eval('#psLightbox', el => el.classList.contains('show'))));

  // Bấm vùng tối quanh ảnh thì đóng; bấm vào ảnh, vuốt, bấm hơi lệch nút › thì không đóng
  const isOpen = () => page.$eval('#psLightbox', el => el.classList.contains('show'));
  const counterText = () => page.$eval('#psLbCounter', el => el.textContent);
  const rectOf = (sel) => page.$eval(sel, el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  async function openAt(id) {
    await page.evaluate((i) => document.querySelector(`.ps-photo[data-id="${i}"] img`).click(), id);
    await page.waitForFunction(() => { const i = document.getElementById('psLbImg'); return i.complete && i.naturalWidth > 0; }, { timeout: 15000 });
    await new Promise(r => setTimeout(r, 350));
  }
  await openAt('ph-5');
  const img = await rectOf('#psLbImg');
  const stageBox = await rectOf('#psLbStage');
  await page.mouse.click(img.x + img.w / 2, img.y + img.h / 2);
  await new Promise(r => setTimeout(r, 200));
  check('Bấm vào ảnh không đóng lightbox', await isOpen());

  const bx = stageBox.x + (img.x - stageBox.x) / 2, by = stageBox.y + stageBox.h * 0.2; // vùng tối bên trái ảnh, tránh nút ‹
  await page.mouse.move(bx, by);
  await page.mouse.down();
  await page.mouse.move(bx - 60, by, { steps: 4 });
  await page.mouse.move(bx - 120, by, { steps: 4 });
  await page.mouse.up();
  await new Promise(r => setTimeout(r, 300));
  check('Vuốt bắt đầu từ vùng tối thì chuyển ảnh, không đóng', (await isOpen()) && (await counterText()) === `6 / ${total}`, await counterText());

  const nextBtn = await rectOf('#psLbNext');
  await page.mouse.click(nextBtn.x - 6, nextBtn.y + nextBtn.h / 2);
  await new Promise(r => setTimeout(r, 300));
  check('Bấm hơi lệch nút › vẫn chuyển ảnh, không đóng', (await isOpen()) && (await counterText()) === `7 / ${total}`, await counterText());

  await page.mouse.click(bx, by);
  await new Promise(r => setTimeout(r, 350));
  check('Bấm vùng tối quanh ảnh thì đóng lightbox', !(await isOpen()));
  check('Đóng xong bấm được ngay vào lưới ảnh', await page.evaluate(() => { const c = document.querySelector('.ps-photo[data-id="ph-2"]').getBoundingClientRect(); const el = document.elementFromPoint(c.x + c.width / 2, c.y + c.height / 2); return !!el && !!el.closest('.ps-photo'); }));

  await openAt('ph-5');
  const cnt = await rectOf('#psLbCounter');
  const actionsBox = await rectOf('.ps-lb-actions');
  await page.mouse.click((cnt.x + cnt.w + actionsBox.x) / 2, cnt.y + cnt.h / 2);
  await new Promise(r => setTimeout(r, 350));
  check('Bấm chỗ trống trên thanh trên cùng cũng đóng', !(await isOpen()));

  await page.click('.ps-tab[data-filter="liked"]');
  await new Promise(r => setTimeout(r, 200));
  check('Không còn khung danh sách ghi chú riêng dưới lưới ảnh', await page.evaluate(() => !document.getElementById('psPhotoNotes') && !document.querySelector('.ps-photo-note-row')));

  // Gửi yêu cầu: ghi chú đi kèm tới Thợ ảnh
  await page.click('#psSubmitBtn');
  await new Promise(r => setTimeout(r, 400));
  const req = await page.evaluate(() => { const db = JSON.parse(localStorage.getItem('aloha_demo_db')); return db.editRequests[db.editRequests.length - 1]; });
  check('Yêu cầu gửi đi có đúng ảnh + ghi chú', req && req.photos.length === 1 && req.photos[0].note === 'Làm sáng da, xoá vết đỏ trên má' && req.photos[0].src.includes('googleusercontent'), JSON.stringify(req && req.photos));

  // Sau khi gửi: lightbox vẫn xem được nhưng không đổi lựa chọn được nữa
  await page.click('.ps-tab[data-filter="all"]');
  await page.click('.ps-photo[data-id="ph-9"] img');
  await new Promise(r => setTimeout(r, 300));
  check('Sau khi gửi, nút yêu thích bị khoá', await page.$eval('#psLbFav', el => el.disabled));
  await page.keyboard.press('Escape');

  // Mobile
  await page.setViewport({ width: 390, height: 844 });
  await page.evaluate(() => document.querySelector('.ps-photo[data-id="ph-5"] img').scrollIntoView({ block: 'center' }));
  await new Promise(r => setTimeout(r, 1200)); // trang dùng cuộn mượt
  await page.click('.ps-photo[data-id="ph-5"] img');
  check('Mobile: bấm ảnh mở lightbox', await page.$eval('#psLightbox', el => el.classList.contains('show')));
  await new Promise(r => setTimeout(r, 600));
  const overflow = await page.evaluate(() => document.getElementById('psLightbox').scrollWidth > window.innerWidth);
  check('Mobile: lightbox không tràn ngang', !overflow);
  await page.screenshot({ path: path.resolve(__dirname, 'test-lightbox-mobile.png') });
  await page.waitForFunction(() => { const i = document.getElementById('psLbImg'); return i.complete && i.naturalWidth > 0; }, { timeout: 15000 });
  const mStage = await rectOf('#psLbStage'), mImg = await rectOf('#psLbImg');
  await page.mouse.click(mStage.x + mStage.w / 2, mStage.y + Math.max(3, (mImg.y - mStage.y) / 2));
  await new Promise(r => setTimeout(r, 350));
  check('Mobile: chạm vùng tối phía trên ảnh thì đóng', !(await isOpen()));

  check('Không có lỗi JS', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
