// Màn khớp tay của thợ (31/10/2026): file tên lạ trong DA-CHINH → chọn "Là bản sửa của…" → máy chủ ghi khớp;
// "Bỏ khớp" gỡ ra. Mở crm/admin.html thật (file://), máy chủ giả bằng chặn request. Chụp 390 + 1440.
// Chạy: node _screenshots/test-manual-match-ui.js
const assert = require('assert/strict');
const path = require('path');
const puppeteer = require('puppeteer-core');
const env = require('./test-env');
const OUT = path.join(__dirname);
let checks = 0; const ok = (v, label) => { assert.ok(v, label); checks++; console.log('  ✓', label); };

const photos = [{ id: 'p1', name: 'A.CR3', src: 'images/my-photos/1.jpg' }, { id: 'p2', name: 'B.JPG', src: 'images/my-photos/2.jpg' }];
const files = [{ id: 'fa', name: 'A_edit.jpg' }, { id: 'fz', name: 'IMG_9999.jpg' }];
let manual = {}, calls = [];
const req = () => ({ id: 'ER-matchui-1234abcd', rev: 3, phone: '0911111111', customerName: 'Khách TEST', orderCode: 'TEST01', serviceLabel: 'Newborn',
  photoCount: 2, photos, doneIds: [], status: 'Đang thực hiện', createdAt: Date.now() - 3600e3, updatedAt: Date.now(), messages: [], round: 1,
  editorPhone: '0900000003', driveJob: { status: 'done', inputFolderId: 'in', outputFolderId: 'out', roundFolderId: 'round', delivery: { status: 'waiting', matched: 1, total: 2 } } });
function outputList() {
  const matchedOf = (f) => manual[f.id] ? [photos.find((p) => p.id === manual[f.id]).name] : (f.id === 'fa' && !Object.values(manual).includes('p1') ? ['A.CR3'] : []);
  const list = files.map((f) => ({ ...f, mimeType: 'image/jpeg', size: '10', manual: !!manual[f.id], matchedPhotos: matchedOf(f) }));
  const taken = new Set(list.flatMap((f) => f.matchedPhotos));
  return { files: list, photos: photos.map((p) => ({ id: p.id, name: p.name, matched: taken.has(p.name) })), matched: taken.size, total: 2 };
}

(async () => {
  const browser = await env.launchAllFeatures(puppeteer, { executablePath: env.CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const timer = setTimeout(() => { console.error('TIMEOUT'); process.exit(2); }, 90000);
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      const u = r.url();
      if (!/^https?:/.test(u)) return r.continue();
      const m = u.match(/\/api\/edit-requests(\/[^?]*)?/);
      if (!m) return r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' });
      if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      const p = m[1] || '/'; calls.push(r.method() + ' ' + p);
      let body = {};
      const mm = p.match(/\/output-files\/([^/]+)\/match$/);
      if (mm && r.method() === 'POST') { const b = JSON.parse(r.postData() || '{}'); delete manual[mm[1]]; if (b.photoId) { for (const k of Object.keys(manual)) if (manual[k] === b.photoId) delete manual[k]; manual[mm[1]] = b.photoId; } body = { ok: true }; }
      else if (p.endsWith('/output-files')) body = outputList();
      else if (p === '/' || p === '') body = { requests: [req()], at: Date.now() };
      else if (p.startsWith('/ER-')) body = { request: req() };
      r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    });
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('aloha_auth', JSON.stringify({ phone: '0900000003', name: 'Thợ TEST', role: 'tho-anh', token: 't' }));
      localStorage.setItem('aloha_edit_sync', '1'); window.ALOHA_FEATURES = { booking: true, aiChat: true, albumPages: true, editSync: true };
    });
    for (const width of [1440, 390]) {
      manual = {}; calls = [];
      await page.setViewport({ width, height: 900 });
      await page.goto(env.ROOT_URL + 'crm/admin.html?editSync=1#anh', { waitUntil: 'domcontentloaded' });
      // Mở thẻ yêu cầu (thẻ có thể nằm trong hàng ưu tiên)
      await page.waitForFunction(() => [...document.querySelectorAll('#photoRows .photo-row-card')].some((el) => /Khách TEST/.test(el.textContent)), { timeout: 20000 }).catch(async (e) => { console.log('CALLS', calls, await page.evaluate(() => (document.getElementById('photoRows') || document.body).innerText.slice(0, 600))); throw e; });
      await page.evaluate(() => { document.querySelectorAll('.photo-row-more').forEach((b) => { if (!b.hidden && /Xem thêm/.test(b.textContent)) b.click(); }); const el = [...document.querySelectorAll('#photoRows .photo-row-card')].find((x) => /Khách TEST/.test(x.textContent)); el.scrollIntoView({ block: 'center' }); el.click(); });
      await page.waitForSelector('.drive-output-grid article', { timeout: 20000 });
      await page.waitForFunction(() => document.querySelector('.drive-match-select'), { timeout: 10000 });
      const opts = await page.$$eval('.drive-match-select option', (o) => o.map((x) => x.textContent));
      ok(opts.length === 2 && opts[1] === 'B.JPG', width + ': tên lạ có ô chọn, chỉ liệt kê ảnh còn thiếu');
      ok(await page.$$eval('.drive-match-select', (s) => s.length) === 1, width + ': file đã khớp tên không có ô chọn');
      if (width === 390) await page.screenshot({ path: path.join(OUT, 'manual-match-390.png') });
      await page.select('.drive-match-select', 'p2');
      await page.waitForFunction(() => [...document.querySelectorAll('.drive-output-grid p')].some((p) => p.textContent.includes('khớp tay: B.JPG')), { timeout: 10000 });
      ok(calls.includes('POST /ER-matchui-1234abcd/output-files/fz/match'), width + ': gọi máy chủ ghi khớp');
      ok(/Đã nhận 2\/2/.test(await page.$eval('[data-drive-count]', (e) => e.textContent)), width + ': số đếm lên 2/2');
      const box = await page.evaluate(() => { const b = [...document.querySelectorAll('.drive-output-grid button')].find((x) => x.textContent === 'Bỏ khớp'); const r = b.getBoundingClientRect(); return { h: r.height, over: document.documentElement.scrollWidth > innerWidth }; });
      ok(box.h >= 44 && !box.over, width + ': nút Bỏ khớp ≥44px, không cuộn ngang');
      await page.screenshot({ path: path.join(OUT, 'manual-match-' + width + '-matched.png') });
      await page.evaluate(() => [...document.querySelectorAll('.drive-output-grid button')].find((x) => x.textContent === 'Bỏ khớp').click());
      await page.waitForFunction(() => document.querySelector('.drive-match-select'), { timeout: 10000 });
      ok(!manual.fz, width + ': Bỏ khớp gỡ khỏi máy chủ');
    }
    ok(errors.length === 0, 'không lỗi trang: ' + errors.join(' | '));
    console.log(checks + '/' + checks + ' PASS manual match UI');
  } finally { clearTimeout(timer); await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
