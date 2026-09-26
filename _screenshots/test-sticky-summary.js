// Test ô "Đã chọn" nổi theo khi khách cuộn xuống lướt ảnh (view "Ảnh của tôi").
//   node _screenshots/test-sticky-summary.js
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

  async function open(width, height) {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
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
  // Cuộn tức thì (trang đặt scroll-behavior: smooth)
  const scrollTo = (page, y) => page.evaluate((yy) => window.scrollTo({ top: yy, behavior: 'instant' }), y);
  const info = (page) => page.evaluate(() => {
    const c = document.getElementById('psSummaryCard');
    const r = c.getBoundingClientRect();
    const h = document.querySelector('.site-header').getBoundingClientRect();
    return {
      floating: c.classList.contains('is-floating'), pos: getComputedStyle(c).position,
      top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height),
      headerBottom: Math.round(h.bottom), vw: window.innerWidth, vh: window.innerHeight,
      count: document.getElementById('selectedCount').textContent,
      hScroll: document.documentElement.scrollWidth > window.innerWidth
    };
  });

  // ---------- Máy tính
  const page = await open(1440, 900);
  const start = await info(page);
  check('Đầu trang: ô "Đã chọn" nằm đúng chỗ, chưa nổi', !start.floating && start.pos === 'static', JSON.stringify(start));
  await scrollTo(page, 3000); await wait(400);
  let s = await info(page);
  check('Cuộn xuống: ô nổi, ghim ngay dưới thanh menu', s.floating && s.pos === 'fixed' && s.top >= s.headerBottom && s.top <= s.headerBottom + 20, JSON.stringify(s));
  check('Ô nổi giữ đúng cột bên phải như vị trí gốc', Math.abs(s.left - start.left) <= 1 && Math.abs(s.width - start.width) <= 1, JSON.stringify({ start, s }));
  // Bấm tim một ảnh đang hiện trên màn hình (không bị ô nổi che) -> số trên ô nổi cập nhật
  const target = await page.evaluate(() => {
    const card = document.getElementById('psSummaryCard').getBoundingClientRect();
    const heart = [...document.querySelectorAll('.ps-photo .ps-heart')].find(h => {
      const r = h.getBoundingClientRect();
      return r.top > card.bottom + 10 && r.bottom < window.innerHeight - 10;
    });
    const r = heart.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.click(target.x, target.y); await wait(300);
  s = await info(page);
  check('Bấm tim khi đang cuộn -> số trên ô nổi cập nhật ngay (1 / 10)', s.floating && s.count === '1', JSON.stringify(s));
  await page.screenshot({ path: path.resolve(__dirname, 'sticky-summary-1440.png') });
  // Nút trong ô nổi vẫn bấm được
  await page.click('#psClearAllBtn'); await wait(300);
  const undoShown = await page.$eval('#psBulkUndo', el => el.textContent.includes('Hoàn tác'));
  s = await info(page);
  check('Nút "Bỏ chọn tất cả" trong ô nổi bấm được, hiện Hoàn tác', s.count === '0' && undoShown, JSON.stringify(s));
  await scrollTo(page, 0); await wait(400);
  s = await info(page);
  check('Cuộn lên đầu: ô về lại vị trí cũ, không lệch', !s.floating && s.pos === 'static' && Math.abs(s.left - start.left) <= 1 && Math.abs(s.top - start.top) <= 1, JSON.stringify(s));
  // Tab Yêu thích (lưới ngắn) -> không cần nổi
  await page.click('.ps-tab[data-filter="liked"]'); await wait(300);
  await scrollTo(page, 99999); await wait(400);
  s = await info(page);
  check('Tab Yêu thích trang ngắn -> ô không nổi đè nội dung', !s.floating || s.top >= s.headerBottom, JSON.stringify(s));
  await page.close();

  // ---------- Điện thoại
  const m = await open(390, 844);
  for (let i = 1; i <= 11; i++) await m.evaluate((id) => document.querySelector(`.ps-photo[data-id="ph-${id}"] .ps-heart`).click(), i);
  await wait(300);
  await m.evaluate(() => { const b = document.querySelector('.ps-modal-overlay.show .ps-modal-yes'); if (b) b.click(); });
  await m.evaluate(() => document.querySelector('.ps-tab[data-filter="all"]').click());
  await scrollTo(m, 4000); await wait(400);
  s = await info(m);
  check('Điện thoại: cuộn xuống ô nổi dưới menu, trải ngang cách mép 12px', s.floating && s.left === 12 && s.right === s.vw - 12 && s.top >= s.headerBottom, JSON.stringify(s));
  check('Điện thoại: ô nổi gọn (kể cả khi có dòng phí), không tràn ngang', s.height <= 170 && !s.hScroll, JSON.stringify(s));
  await m.screenshot({ path: path.resolve(__dirname, 'sticky-summary-390.png') });
  await m.close();

  check('Không có lỗi JS', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
