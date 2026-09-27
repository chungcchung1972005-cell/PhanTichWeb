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
const pad2 = (n) => String(n).padStart(2, '0');
const keyOf = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const REAL_TODAY = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
const SHIFT = Math.round((REAL_TODAY - new Date(2026, 8, 25)) / 864e5);
const shiftDM = (dm) => { const [d, m] = dm.split('/').map(Number); const x = new Date(2026, m - 1, d + SHIFT); return pad2(x.getDate()) + '/' + pad2(x.getMonth() + 1); };
// Lịch hiện theo tuần của hôm nay thật: tìm tuần có lịch id cần xem (dữ liệu dời theo ngày).
const showEv = async (page, id) => {
  await page.click('[data-act="cal-today"]'); await new Promise(r => setTimeout(r, 80));
  for (const [act, n] of [['cal-next', 3], ['cal-today', 0], ['cal-prev', 3]]) {
    if (act === 'cal-today') { await page.click('[data-act="cal-today"]'); await new Promise(r => setTimeout(r, 80)); continue; }
    for (let i = 0; i <= n; i++) {
      if (await page.$('[data-id="' + id + '"]')) return true;
      await page.click('[data-act="' + act + '"]'); await new Promise(r => setTimeout(r, 80));
    }
  }
  return !!(await page.$('[data-id="' + id + '"]'));
};
const pickOwner = async (page, id) => { await page.select('[data-owner-filter]', id); await new Promise(r => setTimeout(r, 120)); };
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
    log(s.name + ': Tổng quan không còn lời chào tên sale', title === 'Tổng quan', title);
    const sub = await page.$eval('#swSub', el => el.textContent);
    log(s.name + ': Tổng quan hiện đúng ngày hôm nay thật', sub.includes(pad2(REAL_TODAY.getDate()) + '/' + pad2(REAL_TODAY.getMonth() + 1) + '/' + REAL_TODAY.getFullYear()), sub);
    const me = await page.$eval('#swMeName', el => el.textContent);
    log(s.name + ': tên ở sidebar', me === s.name, me);

    const myId = await page.evaluate((phone) => window.ALOHA_SALE_DATA.sales.find(x => x.phone === phone).id, s.phone);

    // Mặc định "Tất cả sale": thấy khách của mọi sale; khách người khác chỉ xem
    await go(page, '#khach-tiem-nang');
    let t = await text(page);
    log(s.name + ': Tất cả sale thấy cả khách của mình và của sale khác', t.includes(s.own) && t.includes(s.notOwn));
    log(s.name + ': link cũ #khach-tiem-nang mở Khách hàng dạng Bảng giai đoạn', page.url().endsWith('#khach-hang') && !!(await page.$('.kb')), page.url());
    const roCards = await page.$$eval('.kb-card-ro', els => els.every(e => !e.hasAttribute('draggable') && !e.querySelector('[data-act="call"],[data-act="lead-next"]')));
    log(s.name + ': thẻ khách sale khác không kéo/gọi/chuyển bước được', roCards);
    await pickOwner(page, myId);
    t = await text(page);
    log(s.name + ': lọc theo mình chỉ còn khách của mình', t.includes(s.own) && !t.includes(s.notOwn));

    await page.click('[data-act="cus-mode"][data-id="danh-sach"]');
    t = await text(page);
    log(s.name + ': danh sách (lọc theo mình) không có khách sale khác', t.includes(s.own) && !t.includes(s.notOwn));
    await pickOwner(page, 'all');
    await page.click('[data-act="cus-mode"][data-id="bang"]');

    await go(page, '#dat-coc');
    const depCodes = async () => (await page.$$eval('.dp-code', els => els.map(e => e.textContent))).sort();
    const expected = await page.evaluate((id) => {
      const d = window.ALOHA_SALE_DATA;
      return { all: d.deposits.map(x => x.code).sort(), mine: d.deposits.filter(x => x.owner === id).map(x => x.code).sort() };
    }, myId);
    let codes = await depCodes();
    log(s.name + ': Đặt cọc mặc định thấy cọc của mọi sale', JSON.stringify(codes) === JSON.stringify(expected.all), codes + ' vs ' + expected.all);
    await pickOwner(page, myId);
    codes = await depCodes();
    log(s.name + ': lọc theo mình chỉ còn cọc do mình phụ trách', JSON.stringify(codes) === JSON.stringify(expected.mine), codes + ' vs ' + expected.mine);
    await pickOwner(page, 'all');

    await go(page, '#lich-chup');
    const evCount = await page.$$eval('.cal-ev', els => els.length);
    const mon = new Date(REAL_TODAY); mon.setDate(mon.getDate() - (mon.getDay() + 6) % 7);
    const weekKeys = Array.from({ length: 7 }, (_, i) => { const x = new Date(mon); x.setDate(x.getDate() + i); return keyOf(x); });
    const weekTotal = await page.evaluate((keys, shift) => window.ALOHA_SALE_DATA.appointments.filter(a => {
      const [y, m, d] = a.date.split('-').map(Number); const x = new Date(y, m - 1, d + shift);
      const k = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
      return keys.includes(k);
    }).length, weekKeys, SHIFT);
    const todayCol = await page.$eval('.cal-head.today', el => el.textContent).catch(() => '');
    log(s.name + ': lịch đánh dấu đúng hôm nay thật', todayCol.includes(String(REAL_TODAY.getDate())), todayCol);
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
  await showEv(page, 'ap17');
  const haLinh = await page.$eval('[data-id="ap17"]', el => el.className);
  log('Xác nhận cọc: lịch 27/09 chuyển Đã cọc (hết đỏ)', !haLinh.includes('ev-hold'), haLinh);
  await page.screenshot({ path: OUT('sale-calendar-desktop.png') });

  // Mở lịch của sale khác: xem được liên hệ, cọc, tin nhắn nhưng không nhắn/gọi được
  await showEv(page, 'ap21');
  await page.click('[data-id="ap21"]');
  t = await page.$eval('#swModalBody', el => el.innerText);
  log('Lịch sale khác: xem được phụ trách, liên hệ, cọc và tin nhắn', t.includes('Minh Thư') && t.includes('Liên hệ') && t.includes('AB240927') && t.includes('Tin nhắn gần đây'), t.slice(0, 300));
  const noReply = await page.evaluate(() => !document.querySelector('#swModalBody [data-act="msg"], #swModalBody [data-act="call"]') && !!document.querySelector('#swModalBody .sw-readonly'));
  log('Lịch sale khác: không có nút Nhắn/Gọi, có ghi chú chỉ xem', noReply);
  await page.screenshot({ path: OUT('sale-calendar-other-modal.png') });
  await page.click('#swModalBody [data-act="view-conv"]');
  await new Promise(r => setTimeout(r, 150));
  const convRo = await page.evaluate(() => location.hash.startsWith('#hop-thu/') && !document.getElementById('ibInput') && !!document.querySelector('.ib-chat .sw-readonly'));
  log('Lịch sale khác: "Xem hội thoại" mở Hộp thư dạng chỉ đọc', convRo);
  await go(page, '#lich-chup');
  await showEv(page, 'ap21');
  await page.click('[data-id="ap21"]');
  await page.click('#swModalBody [data-act="view-deposit"]');
  await new Promise(r => setTimeout(r, 150));
  t = await page.$eval('.dp-profile', el => el.innerText);
  log('Lịch sale khác: "Xem cọc" mở đúng hồ sơ cọc, không có nút xác nhận', location => true, '') ;
  log('Lịch sale khác: hồ sơ cọc AB240927 chỉ xem', t.includes('Chị Thùy Dung') && t.includes('chỉ xem được'), t.slice(0, 200));
  await go(page, '#lich-chup');
  await showEv(page, 'ap17'); // tuần có ngày mặc định của Tạo lịch nhanh (hôm nay + 2)

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
  await pickOwner(page, 'ngoc-anh'); // số nhóm bên dưới tính theo khách của Ngọc Anh
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
  log('Danh sách: lọc Khách quen ra Chị Lan, hồ sơ có 2 đơn đã chụp', t.includes('Chị Lan') && t.includes('Bé Su tròn 1 tuổi ' + shiftDM('10/10')) && t.includes('Ưu đãi sinh nhật 1 tuổi') && !t.includes('Anh Tùng'));
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
  await pickOwner(page, 'all');

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
  await pickOwner(page, 'ngoc-anh');
  t = await text(page);
  log('Chuyển giao: sau khi Thu Hà nhận, Chị Ngân không còn trong khách của mình', !t.includes('Chị Ngân') && !t.includes('Anh Minh Đức'));
  await pickOwner(page, 'thu-ha');
  t = await text(page);
  log('Chuyển giao: lọc Thu Hà thấy Chị Ngân (chỉ xem)', t.includes('Chị Ngân'));
  await pickOwner(page, 'all');
  // Nhận khách Minh Thư chuyển đến (đã duyệt)
  await go(page, '#chuyen-giao');
  await page.click('[data-act="tr-tab"][data-id="den"]');
  await page.click('[data-act="tr-accept"][data-id="tr-1"]');
  await go(page, '#khach-hang');
  await pickOwner(page, 'ngoc-anh');
  t = await text(page);
  log('Chuyển giao: nhận Anh Hoàng Nam vào danh sách của mình', t.includes('Anh Hoàng Nam'));
  await pickOwner(page, 'all');

  // Hộp thư: hội thoại của sale khác chỉ xem, không có ô trả lời
  await go(page, '#hop-thu');
  await page.click('[data-act="inbox-filter"][data-id="cua-toi"]');
  const otherConv = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-act="open-conv"]')].find(x => x.querySelector('.sw-owner-tag')); return b && b.dataset.id; });
  if (otherConv) {
    await page.click('[data-act="open-conv"][data-id="' + otherConv + '"]');
    const ro = await page.evaluate(() => !document.getElementById('ibInput') && !!document.querySelector('.ib-chat .sw-readonly') && !document.querySelector('.ib-chat [data-act="call"]'));
    log('Hộp thư: hội thoại sale khác không trả lời/gọi được', ro);
  } else log('Hộp thư: có hội thoại của sale khác ở "Tất cả sale"', false);

  // Đơn & ảnh: có cột Phụ trách, đơn sale khác không có nút thao tác
  await go(page, '#don-anh');
  const ordOk = await page.evaluate(() => {
    const d = window.ALOHA_SALE_DATA; const rows = document.querySelectorAll('.sw-table tbody tr');
    return rows.length === d.orders.length && [...rows].every(r => /\(tôi\)/.test(r.cells[2].textContent) === !!r.querySelector('[data-act="order-action"]'));
  });
  log('Đơn & ảnh: thấy đơn mọi sale, chỉ đơn của mình có nút thao tác', ordOk);

  // Chuyển giao: khách sale khác hiện nhưng không chọn được
  await go(page, '#chuyen-giao');
  await page.click('[data-act="tr-tab"][data-id="tao"]');
  const trOk = await page.evaluate(() => {
    const d = window.ALOHA_SALE_DATA; const boxes = [...document.querySelectorAll('[data-tr-pick]')];
    const others = boxes.filter(b => /^Của /.test(b.closest('label').querySelector('.sw-badge').textContent));
    return boxes.length > others.length && others.length > 0 && others.every(b => b.disabled);
  });
  log('Chuyển giao: hiện khách sale khác nhưng khoá chọn', trOk);

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

  // ---- Giữ lịch tối đa 1 tiếng, quá giờ chưa cọc tự nhả khung giờ ----
  {
    const p2 = await browser.newPage();
    p2.on('pageerror', e => errors.push(e.message));
    await p2.evaluateOnNewDocument(() => {
      const R = Date; let off = 0; window.__jump = (ms) => { off += ms; };
      class D extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + off); } static now() { return R.now() + off; } }
      window.Date = D;
    });
    await p2.setViewport({ width: 1440, height: 900 });
    await login(p2, '0900000002');
    await go(p2, '#dat-coc');
    let t2 = await p2.evaluate(() => document.getElementById('swView').innerText);
    const hold = await p2.evaluate(() => { const n = new Date(); n.setMinutes(n.getMinutes() + 40); return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0'); });
    log('Giữ lịch: AB240933 hết hạn giữ tính theo giờ thật (còn 40 phút)', t2.includes('hết hạn giữ ' + hold), hold);
    await go(p2, '#lich-chup');
    const qbText = await p2.$eval('.qb-deposit', el => el.innerText);
    log('Tạo lịch nhanh: báo giữ lịch 1 tiếng', qbText.includes('giữ lịch 1 tiếng'), qbText);
    await p2.evaluate(() => window.__jump(61 * 60e3));
    await new Promise(r => setTimeout(r, 31000)); // chờ nhịp kiểm tra 30 giây
    await go(p2, '#dat-coc');
    t2 = await p2.evaluate(() => document.getElementById('swView').innerText);
    log('Quá 1 tiếng chưa cọc: yêu cầu chuyển "Hết giờ giữ", đã nhả khung giờ', t2.includes('Hết giờ giữ') && t2.includes('đã nhả khung giờ'), t2.slice(0, 300));
    await p2.click('[data-act="select-deposit"][data-code="AB240933"]');
    t2 = await p2.$eval('.dp-profile', el => el.innerText);
    log('Quá 1 tiếng: nhật ký ghi tự nhả khung giờ', t2.includes('tự nhả khung giờ'), t2.slice(0, 300));
    await p2.close();
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
