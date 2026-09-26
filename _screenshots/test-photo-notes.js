const { CHROME_PATH, ROOT_URL } = require('./test-env');
// Test: ảnh thật hiển thị trong "Ảnh của tôi" (không còn icon/gradient), và
// ghi chú riêng cho từng ảnh đã chọn (cạnh ghi chú chung) được lưu đúng vào
// request gửi sang Thợ ảnh.
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

  // 2) Chưa chọn ảnh -> chưa thấy khối ghi chú riêng từng ảnh
  const notesHiddenInitially = await page.$eval('#psPhotoNotes', el => el.hidden);
  log('chưa chọn ảnh nào -> khối ghi chú riêng đang ẩn', notesHiddenInitially);

  // 3) Chọn 2 ảnh -> hiện 2 dòng ghi chú riêng, kèm đúng ảnh
  await page.click('.ps-photo[data-id="ph-1"] .ps-heart');
  await page.click('.ps-photo[data-id="ph-5"] .ps-heart');
  // Ghi chú riêng từng ảnh + ghi chú chung chỉ hiện ở tab Yêu thích
  await page.click('.ps-tab[data-filter="liked"]');
  const rows = await page.$$eval('.ps-photo-note-row', els => els.map(el => el.dataset.id));
  log('chọn 2 ảnh -> hiện đúng 2 dòng ghi chú riêng tương ứng', rows.length === 2 && rows.includes('ph-1') && rows.includes('ph-5'), rows.join(','));

  // 4) Nhập ghi chú riêng cho từng ảnh + ghi chú chung, gửi yêu cầu
  const textareas = await page.$$('.ps-photo-note-row textarea');
  await textareas[0].type('Xoa vet do tren ma');
  await textareas[1].type('Lam sang vung mat');
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
