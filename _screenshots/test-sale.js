// Test Không gian Sale (crm/sale.html): 5 tài khoản, phân quyền dữ liệu theo
// sale phụ trách, lịch chung cả studio, các luồng chính (xác nhận cọc, tạo lịch
// nhanh, kéo lead, hộp thư, chuyển giao khách qua duyệt), trang cọc cho khách (coc.html).
// Chạy: node _screenshots/test-sale.js
const puppeteer = require('puppeteer-core');
const path = require('path');

const ROOT = 'file:///' + path.resolve(__dirname, '..').replace(/\\/g, '/');
const OUT = (name) => path.join(__dirname, name);
const SALES = [
  { phone: '0900000002', name: 'Ngọc Anh', own: 'Chị Thu Trang', notOwn: 'Chị Diệu Linh' },
  { phone: '0900000005', name: 'Minh Thư', own: 'Chị Diệu Linh', notOwn: 'Chị Thu Trang' },
  { phone: '0900000006', name: 'Thu Hà', own: 'Chị Minh Hằng', notOwn: 'Chị Thu Trang' },
  { phone: '0900000007', name: 'Quốc Bảo', own: 'Chị Bảo Ngọc', notOwn: 'Chị Thu Trang' },
  { phone: '0900000008', name: 'Hải Yến', own: 'Chị Như Quỳnh', notOwn: 'Chị Thu Trang' }
];

let pass = 0, fail = 0;
function log(name, ok, extra) { ok ? pass++ : fail++; console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name + (extra && !ok ? ' :: ' + extra : '')); }

async function login(page, phone) {
  await page.goto(ROOT + '/login.html');
  await page.evaluate(() => localStorage.clear());
  await page.goto(ROOT + '/login.html');
  await page.type('#loginPhone', phone);
  await page.type('#loginPassword', 'sale123');
  await Promise.all([page.waitForNavigation(), page.click('#loginForm button[type=submit]')]);
}
const text = (page) => page.evaluate(() => document.getElementById('swView').innerText);
const go = async (page, hash) => { await page.evaluate(h => { location.hash = h; }, hash); await new Promise(r => setTimeout(r, 150)); };

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(m.text()); });
  await page.setViewport({ width: 1440, height: 900 });

  for (const s of SALES) {
    await login(page, s.phone);
    log(s.name + ': vào đúng crm/sale.html', page.url().includes('crm/sale.html'), page.url());
    const title = await page.$eval('#swTitle', el => el.textContent);
    log(s.name + ': lời chào đúng tên', title.includes('Chào ' + s.name), title);
    const me = await page.$eval('#swMeName', el => el.textContent);
    log(s.name + ': tên ở sidebar', me === s.name, me);

    await go(page, '#khach-tiem-nang');
    let t = await text(page);
    log(s.name + ': thấy khách của mình', t.includes(s.own));
    log(s.name + ': KHÔNG thấy khách sale khác', !t.includes(s.notOwn));
    log(s.name + ': link cũ #khach-tiem-nang mở Khách hàng dạng Bảng giai đoạn', page.url().endsWith('#khach-hang') && !!(await page.$('.kb')), page.url());

    await page.click('[data-act="cus-mode"][data-id="danh-sach"]');
    t = await text(page);
    log(s.name + ': danh sách khách không lộ khách sale khác', t.includes(s.own) && !t.includes(s.notOwn));
    await page.click('[data-act="cus-mode"][data-id="bang"]');

    await go(page, '#dat-coc');
    const codes = await page.$$eval('.dp-code', els => els.map(e => e.textContent));
    const expected = await page.evaluate((phone) => {
      const d = window.ALOHA_SALE_DATA; const me = d.sales.find(x => x.phone === phone);
      return d.deposits.filter(x => x.owner === me.id).map(x => x.code).sort();
    }, s.phone);
    log(s.name + ': chỉ thấy cọc do mình phụ trách', JSON.stringify(codes.slice().sort()) === JSON.stringify(expected), codes + ' vs ' + expected);

    await go(page, '#lich-chup');
    const evCount = await page.$$eval('.cal-ev', els => els.length);
    const weekTotal = await page.evaluate(() => window.ALOHA_SALE_DATA.appointments.filter(a => a.date >= '2026-09-21' && a.date <= '2026-09-27').length);
    log(s.name + ': lịch tuần thấy tất cả khách studio (' + weekTotal + ')', evCount === weekTotal, evCount);
  }

  // ---- Luồng chính với Ngọc Anh ----
  await login(page, '0900000002');
  await page.screenshot({ path: OUT('sale-overview-desktop.png') });

  // Xác nhận cọc Hà Linh từ "Việc cần làm ngay"
  await page.click('[data-act="confirm-deposit"][data-code="AB240931"]');
  await new Promise(r => setTimeout(r, 150));
  let t = await text(page);
  log('Xác nhận cọc: task biến mất', !t.includes('Xác nhận cọc'));
  await go(page, '#lich-chup');
  const haLinh = await page.$eval('[data-id="ap17"]', el => el.className);
  log('Xác nhận cọc: lịch 27/09 chuyển Đã cọc (hết đỏ)', !haLinh.includes('ev-hold'), haLinh);
  await page.screenshot({ path: OUT('sale-calendar-desktop.png') });

  // Mở lịch của sale khác: không lộ SĐT
  await page.click('[data-id="ap1"]');
  t = await page.$eval('#swModalBody', el => el.innerText);
  log('Lịch sale khác: hiện người phụ trách, ẩn liên hệ', t.includes('Minh Thư') && !t.includes('Liên hệ'));
  await page.click('[data-act="close-modal"]');

  // Tạo lịch nhanh: SĐT khách của sale khác bị chặn
  await page.type('[data-qb="phone"]', '0913555666');
  t = await page.$eval('#qbLookup', el => el.innerText);
  log('Tạo lịch nhanh: chặn khách của sale khác', t.includes('Minh Thư'), t);
  await page.$eval('[data-qb="phone"]', el => { el.value = ''; });
  await page.evaluate(() => { const el = document.querySelector('[data-qb="phone"]'); el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.type('[data-qb="phone"]', '0912456456');
  t = await page.$eval('#qbLookup', el => el.innerText);
  log('Tạo lịch nhanh: tìm thấy Chị Thu Trang', t.includes('Chị Thu Trang'), t);
  const before = await page.$$eval('.cal-ev', els => els.length);
  await page.click('.qb-submit');
  await new Promise(r => setTimeout(r, 200));
  const after = await page.$$eval('.cal-ev', els => els.length);
  log('Tạo lịch nhanh: thêm giữ chỗ lên lịch', after === before + 1, before + '->' + after);
  const toastText = await page.$eval('#swToast', el => el.innerText);
  log('Tạo lịch nhanh: sinh mã AB240935', toastText.includes('AB240935'), toastText);
  // Trùng phòng: đặt lại đúng khung vừa giữ
  await page.type('[data-qb="phone"]', '0912456456');
  await page.$eval('[data-qb="room"]', el => el.value);
  const opts = await page.$$eval('#qbRoom option', os => os.map(o => o.textContent + (o.disabled ? '[x]' : '')));
  log('Tạo lịch nhanh: phòng 1 đã kín ở 27/09 16:00', opts.some(o => o.includes('Phòng 1') && o.includes('[x]')), opts.join('|'));

  await go(page, '#dat-coc');
  t = await text(page);
  log('Đặt cọc: yêu cầu AB240935 xuất hiện', t.includes('AB240935'));
  await page.screenshot({ path: OUT('sale-deposit-desktop.png') });

  // Kanban: nút chuyển bước
  await go(page, '#khach-tiem-nang');
  await page.click('[data-act="lead-next"][data-id="na-nhung"]');
  const col = await page.evaluate(() => { const c = document.querySelector('[data-drag="na-nhung"]'); return c && c.closest('[data-drop]').dataset.drop; });
  log('Kanban: chuyển Chị Hồng Nhung sang Đang tư vấn', col === 'tu-van', col);
  await page.screenshot({ path: OUT('sale-leads-desktop.png') });

  // Khách hàng: Danh sách (nhóm tự suy ra + hồ sơ bên phải)
  await page.click('[data-act="cus-mode"][data-id="danh-sach"]');
  t = await text(page);
  log('Danh sách: đủ nhóm Tiềm năng/Khách quen/Không mua', t.includes('Tiềm năng') && t.includes('Khách quen 1') && t.includes('Không mua 1'));
  await page.click('[data-act="cus-group"][data-id="khach-quen"]');
  t = await text(page);
  log('Danh sách: lọc Khách quen ra Chị Lan, hồ sơ có 2 đơn đã chụp', t.includes('Chị Lan') && t.includes('Bé Su tròn 1 tuổi 10/10') && t.includes('Ưu đãi sinh nhật 1 tuổi') && !t.includes('Anh Tùng'));
  await page.click('[data-act="cus-group"][data-id="all"]');
  await page.click('[data-act="cus-select"][data-id="na-duc"]');
  t = await page.$eval('.cu-aside', el => el.innerText);
  log('Danh sách: bấm khách mở hồ sơ bên phải', t.includes('Anh Minh Đức') && t.includes('Phụ trách: Ngọc Anh'), t.slice(0, 80));
  await page.click('[data-act="cus-bday"]');
  const bdayRows = await page.$$eval('.cu-row', rs => rs.map(r => r.dataset.id).sort().join(','));
  log('Danh sách: lọc Có bé sắp sinh nhật', bdayRows === 'na-duc,na-lan', bdayRows);
  await page.click('[data-act="cus-bday"]');
  await page.screenshot({ path: OUT('sale-customers-desktop.png') });
  await page.click('[data-act="cus-mode"][data-id="bang"]');

  // Hộp thư: gửi tin + chuyển khách cho sale khác
  await go(page, '#hop-thu');
  await page.click('[data-act="open-conv"][data-id="cv-na4"]');
  await page.type('#ibInput', 'Dạ được ạ, chị cứ mang thêm váy nhé');
  await page.click('.ib-form button[type=submit]');
  t = await page.$eval('#ibMsgs', el => el.innerText);
  log('Hộp thư: gửi tin nhắn', t.includes('mang thêm váy nhé'));
  await page.screenshot({ path: OUT('sale-inbox-desktop.png') });
  // "Chuyển người khác" giờ dẫn sang màn Chuyển giao (phải qua Quản lý duyệt)
  await page.click('[data-act="transfer"]');
  await new Promise(r => setTimeout(r, 150));
  log('Chuyển khách: mở màn Chuyển giao', page.url().endsWith('#chuyen-giao'), page.url());
  const preChecked = await page.$eval('[data-tr-pick="na-ngan"]', el => el.checked);
  log('Chuyển giao: Chị Ngân được chọn sẵn', preChecked);
  t = await text(page);
  log('Chuyển giao: người nghỉ phép không chọn được', await page.$eval('[data-act="tr-to"][data-id="hai-yen"]', el => el.disabled));
  log('Chuyển giao: ghi chú bàn giao gợi ý sẵn', (await page.$eval('[data-tr-note]', el => el.value)).includes('Chị Ngân'));
  await page.click('[data-tr-pick="na-duc"]');
  await page.click('[data-act="tr-to"][data-id="thu-ha"]');
  await page.click('[data-act="tr-reason"][data-id="Quá tải"]');
  t = await page.$eval('.tr-submit', el => el.innerText);
  log('Chuyển giao: nút gửi đếm đúng 2 khách', t.includes('(2 khách)'), t);
  await page.screenshot({ path: OUT('sale-transfer-desktop.png') });
  await page.click('.tr-submit');
  await new Promise(r => setTimeout(r, 150));
  t = await text(page);
  log('Chuyển giao: yêu cầu chờ quản lý duyệt', t.includes('Chờ quản lý duyệt') && t.includes('Anh Minh Đức, Chị Ngân → Thu Hà'));
  await go(page, '#khach-hang');
  t = await text(page);
  log('Chuyển giao: chưa duyệt thì khách vẫn thuộc mình', t.includes('Chị Ngân'));
  await go(page, '#chuyen-giao');
  await page.click('[data-act="tr-tab"][data-id="tao"]');
  log('Chuyển giao: khách đang chờ chuyển bị khoá chọn', await page.$eval('[data-tr-pick="na-ngan"]', el => el.disabled));
  await page.click('[data-act="tr-tab"][data-id="gui"]');
  await page.click('[data-act="tr-approve"]');
  await page.click('.tr-demo[data-act="tr-accept"]');
  await go(page, '#khach-hang');
  t = await text(page);
  log('Chuyển giao: sau khi Thu Hà nhận, Chị Ngân không còn trong danh sách', !t.includes('Chị Ngân') && !t.includes('Anh Minh Đức'));
  // Nhận khách Minh Thư chuyển đến (đã duyệt)
  await go(page, '#chuyen-giao');
  await page.click('[data-act="tr-tab"][data-id="den"]');
  await page.click('[data-act="tr-accept"][data-id="tr-1"]');
  await go(page, '#khach-hang');
  t = await text(page);
  log('Chuyển giao: nhận Anh Hoàng Nam vào danh sách của mình', t.includes('Anh Hoàng Nam'));

  await go(page, '#don-anh');
  await page.screenshot({ path: OUT('sale-orders-desktop.png') });
  await go(page, '#bao-cao');
  await page.screenshot({ path: OUT('sale-report-desktop.png') });

  // Tìm kiếm không lộ khách sale khác
  await page.type('#swSearch', 'Diệu Linh');
  t = await page.$eval('#swSearchResults', el => el.innerText);
  log('Tìm kiếm: không ra khách của sale khác', !t.includes('Chị Diệu Linh'), t);

  // ---- Mobile ----
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  for (const [hash, file] of [['#tong-quan', 'sale-overview-mobile.png'], ['#hop-thu', 'sale-inbox-mobile.png'], ['#khach-tiem-nang', 'sale-leads-mobile.png'], ['#khach-hang', 'sale-customers-mobile.png'], ['#lich-chup', 'sale-calendar-mobile.png'], ['#dat-coc', 'sale-deposit-mobile.png'], ['#don-anh', 'sale-orders-mobile.png'], ['#chuyen-giao', 'sale-transfer-mobile.png']]) {
    await go(page, hash);
    await new Promise(r => setTimeout(r, 300));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    log('Mobile ' + hash + ': không tràn ngang', overflow <= 0, overflow + 'px');
    await page.screenshot({ path: OUT(file) });
  }
  for (const w of [320, 768]) {
    await page.setViewport({ width: w, height: 800 });
    for (const hash of ['#tong-quan', '#lich-chup', '#dat-coc', '#khach-hang', '#chuyen-giao']) {
      await go(page, hash);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      log(w + 'px ' + hash + ': không tràn ngang', overflow <= 0, overflow + 'px');
    }
  }

  // ---- Trang cọc cho khách ----
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.goto(ROOT + '/coc.html?ma=AB240933');
  t = await page.evaluate(() => document.body.innerText);
  log('coc.html: hiện lịch Anh Minh Đức đang chờ tiền', t.includes('anh Đức') && t.includes('Đang chờ tiền về'), t.slice(0, 200));
  await page.screenshot({ path: OUT('coc-pending-mobile.png') });
  await page.click('#cocSimulate');
  t = await page.evaluate(() => document.body.innerText);
  log('coc.html: chuyển sang đã xác nhận', t.includes('đã được xác nhận') && t.includes('Ngọc Anh'));
  await page.screenshot({ path: OUT('coc-confirmed-mobile.png') });

  // Sale vào admin.html bị đẩy về sale.html
  await login(page, '0900000006');
  await page.goto(ROOT + '/crm/admin.html');
  await new Promise(r => setTimeout(r, 300));
  log('Sale mở admin.html bị đẩy về sale.html', page.url().includes('sale.html'), page.url());

  log('Không có lỗi JS/console', errors.length === 0, errors.join(' | '));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
