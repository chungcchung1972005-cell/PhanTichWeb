const { CHROME_PATH, ROOT_URL, ROOT, shot } = require('./test-env');
// Test Không gian Sale lấy khách từ web (2026-10-15): sale-data.js không còn khách mẫu,
// khách nhắn ở màn chat trên website -> tự thành hồ sơ "Mới" + hội thoại trong Hộp thư
// của crm/sale.html; Sale trả lời qua server, sale trả lời đầu tiên nhận khách, sale khác
// chỉ xem. Khách và mỗi Sale ở 1 cửa sổ ẩn danh riêng (như các máy khác nhau).
//
// Test tự bật server/server.js ở cổng 3001 (lưu trong bộ nhớ) - tắt `npm start` trước.
// Chạy: node _screenshots/test-sale-web.js
const path = require('path');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const results = [];
const log = (name, ok, extra) => { results.push({ name, ok }); console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name + (extra ? ' (' + extra + ')' : '')); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const LOGIN = ROOT_URL + 'login.html';
const API = 'http://localhost:3001';
const ROUTES = ['tong-quan', 'hop-thu', 'khach-hang', 'lich-chup', 'dat-coc', 'don-anh', 'chuyen-giao', 'bao-cao'];

let server = null;
async function startServer() {
  server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(ROOT, 'server'),
    env: { ...process.env, PORT: '3001', AUTH_SECRET: 'test-secret', MONGODB_URI: '', ALLOWED_ORIGINS: '' },
    stdio: 'ignore'
  });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(API + '/api/health')).ok) return; } catch (e) { /* chưa lên */ }
    await wait(150);
  }
  throw new Error('Không bật được server test ở cổng 3001');
}
async function api(p, o = {}) {
  const r = await fetch(API + '/api/sale-chat' + p, { method: o.m || 'GET', headers: { 'content-type': 'application/json', ...(o.t ? { authorization: 'Bearer ' + o.t } : {}) }, body: o.b ? JSON.stringify(o.b) : undefined });
  return [r.status, await r.json().catch(() => null)];
}

async function saleTab(browser, phone, errors, viewport) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(phone + ': ' + e.message));
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setViewport(viewport || { width: 1440, height: 900 });
  await page.goto(LOGIN, { waitUntil: 'networkidle0' });
  await page.type('#loginPhone', phone);
  await page.type('#loginPassword', 'sale123');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('#loginSubmitBtn')]);
  await wait(600);
  return page;
}
const go = async (page, route) => { await page.evaluate((r) => { location.hash = '#' + r; }, route); await wait(350); };
const text = (page, sel) => page.$eval(sel, (el) => el.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
const waitText = (page, sel, needle, ms = 9000) => page.waitForFunction((s, n) => {
  const el = document.querySelector(s); return !!el && el.textContent.includes(n);
}, { timeout: ms }, sel, needle).then(() => true).catch(() => false);

(async () => {
  await startServer();
  const browser = await puppeteer.launch({ headless: 'new', executablePath: CHROME_PATH });
  const errors = [];
  try {
    // ---- 1. Chưa có khách nào: mọi trang trống, không lỗi
    const a = await saleTab(browser, '0900000002', errors);
    log('Ngọc Anh vào crm/sale.html', a.url().includes('crm/sale.html'), a.url());
    for (const r of ROUTES) {
      await go(a, r);
      const html = await a.$eval('#swView', (el) => el.innerHTML.length);
      log('Trang #' + r + ' hiển thị khi chưa có dữ liệu', html > 50);
    }
    await go(a, 'hop-thu');
    log('Hộp thư trống báo chưa có khách nhắn', (await text(a, '#swView')).includes('Chưa có khách nào nhắn'));
    await go(a, 'khach-hang');
    log('Bảng giai đoạn không còn khách mẫu', (await a.$$('.kb-card')).length === 0);
    const oldNames = await a.evaluate(() => document.body.textContent.includes('Thu Trang') || document.body.textContent.includes('Minh Đức'));
    log('Không còn tên khách mẫu cũ', !oldNames);
    await a.screenshot({ path: shot('sale-web-empty.png') });

    // ---- 2. Khách đăng ký + nhắn từ web
    const [st, reg] = await api('/auth/register', { m: 'POST', b: { name: 'Lan Phương', phone: '0912345678', password: 'matkhau1' } });
    log('Khách đăng ký tài khoản thật', st === 200 && !!reg.token, st);
    const kt = reg.token;
    await api('/me/messages', { m: 'POST', t: kt, b: { text: 'Cho em hỏi gói chụp newborn ạ', topic: 'Chụp ảnh Newborn' } });

    await go(a, 'hop-thu');
    log('Khách mới tự hiện trong Hộp thư (không tải lại trang)', await waitText(a, '.ib-items', 'Lan Phương'));
    log('Hội thoại ghi "Chưa có sale nhận"', (await text(a, '.ib-items')).includes('Chưa có sale nhận'));
    const navCount = await text(a, '#swNav a[href="#hop-thu"] em');
    log('Menu Hộp thư có số tin chưa trả lời', navCount === '1', navCount);
    await go(a, 'khach-hang');
    const card = await text(a, '.kb-col-moi');
    log('Khách hiện ở cột Mới, dịch vụ Newborn', card.includes('Lan Phương') && card.includes('Newborn'), card.slice(0, 120));
    await go(a, 'tong-quan');
    log('Tổng quan có việc "Chưa có sale nhận"', (await text(a, '.d-today')).includes('Chưa có sale nhận'));

    // ---- 3. Ngọc Anh mở hội thoại, trả lời -> nhận khách
    await go(a, 'hop-thu');
    await a.click('.ib-item');
    await wait(500);
    log('Mở hội thoại thấy tin của khách', (await text(a, '#ibMsgs')).includes('gói chụp newborn'));
    log('Có ô trả lời dù chưa có sale nhận', !!(await a.$('#ibInput')));
    await a.type('#ibInput', 'Dạ em chào chị Phương ạ');
    await a.click('.ib-form button[type="submit"]');
    log('Tin Sale hiện trong hội thoại', await waitText(a, '#ibMsgs', 'em chào chị Phương'));
    log('Báo đã nhận khách', (await text(a, '#swToast')).includes('đã nhận khách'));
    const [, me1] = await api('/me', { t: kt });
    const reply = me1.chat.messages.find((m) => m.from === 'sale');
    log('Khách nhận được trả lời qua server, tên Ngọc Anh', !!reply && reply.senderName === 'Ngọc Anh', reply && reply.senderName);
    log('Có nút Chuyển người khác sau khi nhận khách', !!(await a.$('[data-act="transfer"]')));

    // ---- 4. Đang gõ dở thì khách nhắn tiếp: không mất chữ, tin mới tự hiện
    await a.click('#ibInput');
    await a.type('#ibInput', 'Em đang gõ dở');
    await api('/me/messages', { m: 'POST', t: kt, b: { text: 'Bé nhà em dự sinh cuối tháng', topic: 'Chụp ảnh Newborn' } });
    log('Tin mới của khách tự hiện', await waitText(a, '#ibMsgs', 'dự sinh cuối tháng'));
    const typed = await a.$eval('#ibInput', (el) => el.value);
    log('Chữ đang gõ dở không bị mất', typed === 'Em đang gõ dở', typed);
    await a.screenshot({ path: shot('sale-web-inbox.png') });
    await go(a, 'khach-hang');
    log('Khách chuyển sang Đang tư vấn sau khi trả lời', (await text(a, '.kb-col-tu-van')).includes('Lan Phương'));
    await go(a, 'tong-quan');
    const src = await a.$$eval('.d-today .sw-bar-row', (rows) => rows.map((r) => r.textContent.replace(/\s+/g, ' ').trim()));
    log('Nguồn khách: TikTok, Facebook, Instagram, Website', src.join('|').replace(/ /g, '') === 'TikTok0|Facebook0|Instagram0|Website1', src.join('|'));
    const box = await a.$$('.d-today .sw-card.sw-pad');
    if (box.length) await box[box.length - 1].screenshot({ path: shot('sale-web-sources.png') });

    // ---- 4b. Chuyển giao: gửi quản lý duyệt, không còn nút "Mô phỏng: quản lý duyệt"
    await go(a, 'chuyen-giao');
    await a.click('[data-tr-pick="web-0912345678"]'); await wait(200);
    await a.click('[data-act="tr-next"]'); await wait(200);
    await a.click('[data-act="tr-to"][data-id="thu-ha"]'); await wait(200);
    await a.click('[data-act="tr-submit"]'); await wait(300);
    await a.click('[data-act="tr-tab"][data-id="gui"]'); await wait(300);
    const sent = await text(a, '#swView');
    log('Yêu cầu chuyển giao ở trạng thái Chờ quản lý duyệt', sent.includes('Lan Phương') && sent.includes('Chờ quản lý duyệt'));
    log('Không còn nút Mô phỏng: quản lý duyệt', !sent.includes('Mô phỏng') && !(await a.$('[data-act="tr-approve"]')));
    log('Vẫn huỷ được yêu cầu', !!(await a.$('[data-act="tr-cancel"]')));

    // ---- 5. Minh Thư (máy khác) chỉ xem
    const b = await saleTab(browser, '0900000005', errors);
    await go(b, 'hop-thu');
    await b.click('[data-act="inbox-filter"][data-id="cua-toi"]'); // Ngọc Anh đã đọc -> không còn ở "Chưa trả lời"
    await wait(300);
    log('Minh Thư thấy hội thoại', await waitText(b, '.ib-items', 'Lan Phương'));
    log('Ghi người phụ trách Ngọc Anh', (await text(b, '.ib-items')).includes('Ngọc Anh'));
    await b.click('.ib-item');
    await wait(500);
    log('Minh Thư không có ô trả lời', !(await b.$('#ibInput')));
    log('Minh Thư thấy câu trả lời của Ngọc Anh', (await text(b, '#ibMsgs')).includes('em chào chị Phương'));

    // ---- 6. Mobile 390
    const m = await saleTab(browser, '0900000006', errors, { width: 390, height: 844, isMobile: true, hasTouch: true });
    await go(m, 'hop-thu');
    await m.click('[data-act="inbox-filter"][data-id="cua-toi"]');
    log('Mobile: thấy hội thoại', await waitText(m, '.ib-items', 'Lan Phương'));
    const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    log('Mobile 390: không cuộn ngang', !overflow);
    await m.screenshot({ path: shot('sale-web-mobile.png') });

    log('Không có lỗi JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
    if (server) server.kill();
  }
  const pass = results.filter((r) => r.ok).length;
  console.log('\n' + pass + '/' + results.length + ' PASS');
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error(e); if (server) server.kill(); process.exit(1); });
