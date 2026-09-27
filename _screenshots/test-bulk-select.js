// Test nút "Chọn tất cả" / "Bỏ chọn tất cả" dưới bộ đếm "Đã chọn" (view "Ảnh của tôi"):
// hộp xác nhận báo phí ảnh vượt gói, Hoàn tác sau khi bỏ chọn, khoá khi đang chờ thanh
// toán / đã gửi, và bố cục không vỡ từ 320px tới 1440px.
//   node _screenshots/test-bulk-select.js
const puppeteer = require('puppeteer-core');
const path = require('path');
const { CHROME_PATH, ROOT_URL } = require('./test-env');

let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '→ ' + extra : ''); }
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];

  async function newCustomerPage(width = 1440) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900 });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(ROOT_URL + 'login.html', { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.type('#loginPhone', '0900000001');
    await page.type('#loginPassword', 'khach123');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('#loginSubmitBtn')]);
    if (!page.url().includes('#/chon-anh')) await page.goto(page.url().split('#')[0] + '#/chon-anh');
    await wait(600);
    return page;
  }

  const page = await newCustomerPage();
  const total = await page.evaluate(() => document.querySelectorAll('.ps-photo').length);
  const PACKAGE = 10, PRICE = 50000;
  const vnd = (n) => n.toLocaleString('vi-VN') + 'đ';
  const state = () => page.evaluate(() => ({
    count: +document.getElementById('selectedCount').textContent,
    selectedCards: document.querySelectorAll('.ps-photo.selected').length,
    extraCards: document.querySelectorAll('.ps-photo.ps-extra-photo').length,
    extraFee: document.getElementById('psExtra').hidden ? '' : document.getElementById('extraFee').textContent,
    selectAllDisabled: document.getElementById('psSelectAllBtn').disabled,
    clearDisabled: document.getElementById('psClearAllBtn').disabled,
    undo: document.getElementById('psBulkUndo').textContent.replace(/\s+/g, ' ').trim(),
    modal: document.getElementById('psSelectAllModal').classList.contains('show'),
    active: document.activeElement.id || document.activeElement.className
  }));
  const heart = (id) => page.evaluate((i) => document.querySelector(`.ps-photo[data-id="${i}"] .ps-heart`).click(), id);

  // ---------- Bố cục các cỡ màn hình (nút không bị cắt chữ, trang không tràn ngang)
  for (const w of [1440, 1280, 1024, 768, 390, 320]) {
    await page.setViewport({ width: w, height: 900 });
    await wait(250);
    const m = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('.ps-bulk-btn')];
      return {
        clipped: btns.filter(b => b.scrollWidth > b.clientWidth + 1).map(b => b.textContent.trim()),
        sameRow: btns.length === 2 && Math.abs(btns[0].getBoundingClientRect().top - btns[1].getBoundingClientRect().top) < 2,
        hScroll: document.documentElement.scrollWidth > window.innerWidth
      };
    });
    check(`${w}px: 2 nút không bị cắt chữ, trang không tràn ngang (${m.sameRow ? 'cùng 1 hàng' : 'xuống 2 hàng'})`, m.clipped.length === 0 && !m.hScroll, JSON.stringify(m));
    if (w === 1440 || w === 390) await (await page.$('#psSummaryCard')).screenshot({ path: path.resolve(__dirname, `bulk-card-${w}.png`) });
    if (w === 390 || w === 320) {
      await page.click('#psSelectAllBtn');
      await wait(350);
      const mm = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('#psSelectAllModal .ps-modal-btn')];
        const box = document.querySelector('#psSelectAllModal .ps-modal').getBoundingClientRect();
        return { clipped: btns.filter(b => b.scrollWidth > b.clientWidth + 1).length, inView: box.left >= 0 && box.right <= window.innerWidth && box.top >= 0 && box.bottom <= window.innerHeight };
      });
      check(`${w}px: hộp xác nhận nằm gọn màn hình, nút không bị cắt chữ`, mm.clipped === 0 && mm.inView, JSON.stringify(mm));
      if (w === 390) await page.screenshot({ path: path.resolve(__dirname, 'bulk-modal-390.png') });
      await page.keyboard.press('Escape');
      await wait(300);
    }
  }
  await page.setViewport({ width: 1440, height: 900 });
  await wait(300);

  // ---------- Trạng thái ban đầu
  let s = await state();
  check('Ban đầu: "Chọn tất cả" bấm được, "Bỏ chọn tất cả" bị khoá', !s.selectAllDisabled && s.clearDisabled, JSON.stringify(s));

  // ---------- Chọn tất cả luôn hỏi trước kèm chi phí
  const expectFee = vnd((total - PACKAGE) * PRICE);
  await page.click('#psSelectAllBtn');
  await wait(300);
  const modalInfo = await page.evaluate(() => ({
    title: document.getElementById('psSelectAllTitle').textContent,
    text: document.getElementById('psSelectAllText').textContent,
    fee: document.getElementById('psSelectAllFee').textContent
  }));
  s = await state();
  check('Bấm "Chọn tất cả" -> hiện hộp xác nhận, chưa chọn ảnh nào', s.modal && s.count === 0, JSON.stringify(s));
  check(`Hộp xác nhận ghi đúng tổng ${total} ảnh, ${total - PACKAGE} ảnh tính phí, chi phí ${expectFee}`,
    modalInfo.title === `Chọn tất cả ${total} ảnh?` && modalInfo.text.includes(`${total - PACKAGE} ảnh`) && modalInfo.fee === expectFee, JSON.stringify(modalInfo));
  check('Nút mặc định (được focus) là "Để mình tự chọn"', s.active === 'psSelectAllCancel', s.active);
  await page.click('#psSelectAllCancel');
  await wait(300);
  s = await state();
  check('"Để mình tự chọn" -> đóng hộp, không chọn ảnh nào', !s.modal && s.count === 0, JSON.stringify(s));

  await page.click('#psSelectAllBtn'); await wait(300);
  await page.keyboard.press('Escape'); await wait(300);
  s = await state();
  check('Esc -> đóng hộp, không chọn ảnh nào', !s.modal && s.count === 0);
  await page.click('#psSelectAllBtn'); await wait(300);
  await page.mouse.click(8, 450); await wait(300);
  s = await state();
  check('Bấm ra ngoài hộp -> đóng, không chọn ảnh nào', !s.modal && s.count === 0);

  // ---------- Đã chọn 3 ảnh rồi mới Chọn tất cả: 3 ảnh đó + 7 ảnh kế tiếp nằm trong gói
  await heart('ph-1'); await heart('ph-2'); await heart('ph-3');
  await page.click('#psSelectAllBtn'); await wait(300);
  await page.click('#psSelectAllConfirm'); await wait(400);
  s = await state();
  check(`Xác nhận -> chọn đủ ${total} ảnh, ${total - PACKAGE} ảnh đánh dấu chỉnh sửa thêm, phí ${expectFee}`,
    s.count === total && s.selectedCards === total && s.extraCards === total - PACKAGE && s.extraFee === expectFee, JSON.stringify(s));
  const pkg = await page.evaluate(() => ({
    ph3: document.querySelector('.ps-photo[data-id="ph-3"]').classList.contains('ps-extra-photo'),
    ph10: document.querySelector('.ps-photo[data-id="ph-10"]').classList.contains('ps-extra-photo'),
    ph11: document.querySelector('.ps-photo[data-id="ph-11"]').classList.contains('ps-extra-photo')
  }));
  check('10 ảnh chọn đầu tiên nằm trong gói, từ ảnh thứ 11 mới tính phí', !pkg.ph3 && !pkg.ph10 && pkg.ph11, JSON.stringify(pkg));
  check('Đã chọn hết -> "Chọn tất cả" bị khoá, "Bỏ chọn tất cả" bấm được', s.selectAllDisabled && !s.clearDisabled);

  // ---------- Bỏ chọn tất cả + Hoàn tác
  await page.click('#psClearAllBtn'); await wait(300);
  s = await state();
  check('"Bỏ chọn tất cả" -> về 0 ảnh, hết phí chọn thêm', s.count === 0 && s.selectedCards === 0 && s.extraCards === 0 && s.extraFee === '', JSON.stringify(s));
  check(`Hiện "Đã bỏ chọn ${total} ảnh" + nút Hoàn tác (được focus)`, s.undo.includes(`Đã bỏ chọn ${total} ảnh`) && s.undo.includes('Hoàn tác') && s.active === 'ps-bulk-undo-btn', JSON.stringify(s));
  await page.screenshot({ path: path.resolve(__dirname, 'bulk-undo-1440.png'), clip: { x: 900, y: 120, width: 540, height: 360 } });
  await page.click('.ps-bulk-undo-btn'); await wait(300);
  s = await state();
  check('Hoàn tác -> khôi phục đủ ảnh và đúng ảnh tính phí', s.count === total && s.extraCards === total - PACKAGE && s.extraFee === expectFee && s.undo === '', JSON.stringify(s));

  await page.click('#psClearAllBtn'); await wait(300);
  await heart('ph-5'); await wait(200);
  s = await state();
  check('Tự chọn ảnh khác sau khi bỏ chọn -> không còn Hoàn tác (tránh ghi đè lựa chọn mới)', s.undo === '' && s.count === 1, JSON.stringify(s));

  await heart('ph-5');
  await heart('ph-7');
  await page.click('#psClearAllBtn');
  await wait(8300);
  s = await state();
  check('Dòng Hoàn tác tự ẩn sau khoảng 8 giây', s.undo === '', s.undo);

  // ---------- Tab Yêu thích
  await heart('ph-1'); await heart('ph-2');
  await page.click('.ps-tab[data-filter="liked"]'); await wait(300);
  s = await state();
  check('Tab Yêu thích (ảnh nào cũng đã chọn) -> "Chọn tất cả" bị khoá', s.selectAllDisabled && !s.clearDisabled);
  await page.click('#psClearAllBtn'); await wait(300);
  let visible = await page.$$eval('.ps-photo:not(.hidden-by-filter)', els => els.length);
  check('Bỏ chọn tất cả ở tab Yêu thích -> lưới trống ngay', visible === 0, visible);
  await page.click('.ps-bulk-undo-btn'); await wait(300);
  visible = await page.$$eval('.ps-photo:not(.hidden-by-filter)', els => els.length);
  check('Hoàn tác ở tab Yêu thích -> 2 ảnh hiện lại', visible === 2, visible);
  await page.click('.ps-tab[data-filter="all"]'); await wait(300);

  // ---------- Khoá khi đang chờ thanh toán (vượt gói)
  await page.click('#psClearAllBtn'); await wait(200);
  for (let i = 1; i <= 10; i++) await heart('ph-' + i);
  await heart('ph-11'); await wait(300);
  await page.click('.ps-modal-overlay.show .ps-modal-yes'); await wait(300);
  await page.click('.ps-tab[data-filter="all"]'); await wait(200);
  await page.evaluate(() => document.getElementById('psSubmitBtn').click());
  await wait(500);
  s = await state();
  check('Đang chờ thanh toán -> cả 2 nút bị khoá', s.selectAllDisabled && s.clearDisabled, JSON.stringify(s));
  await page.close();

  // ---------- Khoá sau khi đã gửi yêu cầu (trong gói)
  const p2 = await newCustomerPage();
  await p2.evaluate(() => { ['ph-1', 'ph-2'].forEach(i => document.querySelector(`.ps-photo[data-id="${i}"] .ps-heart`).click()); });
  await p2.evaluate(() => document.getElementById('psSubmitBtn').click());
  await wait(400);
  const locked = await p2.evaluate(() => document.getElementById('psSelectAllBtn').disabled && document.getElementById('psClearAllBtn').disabled);
  check('Đã gửi yêu cầu -> cả 2 nút bị khoá', locked);
  await p2.close();

  check('Không có lỗi JS', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
