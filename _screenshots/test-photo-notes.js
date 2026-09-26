const { CHROME_PATH, ROOT_URL } = require('./test-env');
// Test: ảnh thật hiển thị trong "Ảnh của tôi" (không còn icon/gradient), và
// ghi chú riêng cho từng ảnh (nhập trong lightbox, 2026-09-26 đã bỏ khung danh
// sách ghi chú riêng dưới lưới ảnh) + ghi chú chung được lưu đúng vào request
// gửi sang Thợ ảnh.
const puppeteer = require('puppeteer-core');
const BASE = ROOT_URL;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new', args: ['--no-sandbox']
  });
  const results = [];
  function log(name, ok, detail) {
    results.push({ name, ok, detail });
    console.log((ok ? 'OK  ' : 'FAIL') + ' - ' + name + (detail ? ' :: ' + detail : ''));
  }

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1200 });
  await page.goto(BASE + 'login.html', { waitUntil: 'networkidle0' });
  await page.type('#loginPhone', '0900000001');
  await page.type('#loginPassword', 'khach123');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('#loginSubmitBtn')]);

  // 1) Ảnh thật (thẻ <img>) thay vì icon/gradient placeholder: đủ số ảnh của album
  //    Google Photos (js/google-photos-data.js), hoặc bộ ảnh demo local nếu không có album
  const imgCheck = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('.ps-photo img'));
    const expected = typeof GOOGLE_PHOTOS_DATA !== 'undefined' ? GOOGLE_PHOTOS_DATA.length : 16;
    return {
      count: imgs.length,
      expected,
      allHaveRealSrc: imgs.every(img => /googleusercontent\.com\/|images\/my-photos\/photo-\d+\.jpg$/.test(img.getAttribute('src'))),
      noPlaceholderDiv: document.querySelectorAll('.ps-photo-ph').length === 0
    };
  });
  log('hiện đủ ảnh thật của album, không còn icon/gradient placeholder', imgCheck.count === imgCheck.expected && imgCheck.allHaveRealSrc && imgCheck.noPlaceholderDiv, JSON.stringify(imgCheck));

  // 2) Không còn khung danh sách "Ghi chú riêng cho từng ảnh" dưới lưới ảnh
  const noNotesList = await page.$eval('body', () => !document.getElementById('psPhotoNotes') && !document.querySelector('.ps-photo-note-row'));
  log('đã bỏ khung danh sách ghi chú riêng từng ảnh', noNotesList);

  // 3) Chọn 2 ảnh, ghi chú riêng từng ảnh ngay trong lightbox
  await page.click('.ps-photo[data-id="ph-1"] .ps-heart');
  await page.click('.ps-photo[data-id="ph-5"] .ps-heart');
  async function noteInLightbox(id, text) {
    await page.evaluate((i) => document.querySelector(`.ps-photo[data-id="${i}"] img`).click(), id);
    await page.waitForFunction(() => !document.getElementById('psLbNoteWrap').hidden, { timeout: 3000 });
    await page.type('#psLbNote', text);
    await page.keyboard.press('Escape');
  }
  await noteInLightbox('ph-1', 'Xoa vet do tren ma');
  await noteInLightbox('ph-5', 'Lam sang vung mat');
  log('ảnh đã chọn -> lightbox hiện ô ghi chú riêng cho ảnh đó', true);

  // 4) Ghi chú chung (hiện ở tab Yêu thích), gửi yêu cầu
  await page.click('.ps-tab[data-filter="liked"]');
  await page.type('#psNote', 'Giu tong mau am cho ca bo');
  await page.click('#psSubmitBtn');
  await new Promise(r => setTimeout(r, 300));

  const db = await page.evaluate(() => JSON.parse(localStorage.getItem('aloha_demo_db')));
  const req = db.editRequests[db.editRequests.length - 1];
  const hasGeneralNote = req.note === 'Giu tong mau am cho ca bo';
  const hasPerPhotoNotes = req.photoNotes && req.photoNotes.length === 2 &&
    req.photoNotes.some(n => n.id === 'ph-1' && n.note === 'Xoa vet do tren ma') &&
    req.photoNotes.some(n => n.id === 'ph-5' && n.note === 'Lam sang vung mat');
  log('request lưu đúng cả ghi chú chung lẫn ghi chú riêng từng ảnh', hasGeneralNote && hasPerPhotoNotes, JSON.stringify(req));

  // 5) Thợ ảnh thấy gợi ý "+2 ảnh có ghi chú riêng" trên thẻ kanban
  await page.goto(BASE + 'login.html', { waitUntil: 'networkidle0' });
  await page.type('#loginPhone', '0900000003');
  await page.type('#loginPassword', 'anh123');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('#loginSubmitBtn')]);
  const kanbanText = await page.$eval('#kanbanCol-cho-xu-ly', el => el.textContent);
  log('Thợ ảnh thấy gợi ý số ảnh có ghi chú riêng trên thẻ kanban', kanbanText.includes('2 ảnh có ghi chú riêng'), kanbanText.replace(/\s+/g, ' ').trim());

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (failed.length === 0 ? 'TẤT CẢ TEST PASS' : failed.length + ' TEST FAIL'));
  process.exit(failed.length === 0 ? 0 : 1);
})();
