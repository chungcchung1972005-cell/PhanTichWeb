const { CHROME_PATH, ROOT_URL, ROOT, shot } = require('./test-env');
// Test chat THẬT Khách <-> Sale qua server (2026-09-27): khách chưa đăng nhập vẫn lướt web;
// bấm ảnh / dòng dịch vụ đầu trang -> đăng nhập (server cấp mã) -> màn chat #/chat-sale;
// tin nhắn đi qua server/sale-chat.js tới mục "Tin nhắn" của crm/admin.html. Khách và Sale
// ở 2 cửa sổ ẩn danh RIÊNG (khác bộ nhớ trình duyệt = như 2 máy khác nhau) vẫn chat qua lại
// được mà không tải lại trang. Đặt lịch, trang album, chatbot AI tạm tắt (js/features.js).
//
// Test tự bật server/server.js ở cổng 3001 (lưu trong bộ nhớ, không cần MongoDB) - tắt
// server local của bạn (npm start) trước khi chạy. Chạy: node _screenshots/test-sale-chat.js
const path = require('path');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const results = [];
const log = (name, ok, extra) => { results.push({ name, ok }); console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name + (extra ? ' (' + extra + ')' : '')); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const INDEX = ROOT_URL + 'index.html';
const LOGIN = ROOT_URL + 'login.html';
const API = 'http://localhost:3001';

// ---------------------------------------------------------------- Server test
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
function stopServer() { if (server) { server.kill(); server = null; } }
async function api(p, o = {}) {
  const r = await fetch(API + '/api/sale-chat' + p, { method: o.m || 'GET', headers: { 'content-type': 'application/json', ...(o.t ? { authorization: 'Bearer ' + o.t } : {}) }, body: o.b ? JSON.stringify(o.b) : undefined });
  return [r.status, await r.json().catch(() => null)];
}

// ---------------------------------------------------------------- Tiện ích trang
async function newTab(ctx, errors, viewport) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setViewport(viewport || { width: 1440, height: 900 });
  return page;
}
async function login(page, phone, pw, next) {
  await page.goto(LOGIN + (next ? '?next=' + encodeURIComponent(next) : ''), { waitUntil: 'networkidle0' });
  await page.type('#loginPhone', phone);
  await page.type('#loginPassword', pw);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('#loginSubmitBtn')]);
  await wait(400);
}
// Bấm link #/chat-sale: địa chỉ đổi hash trước rồi router mới sang login.html -> chờ đúng trang login.
async function clickToLogin(page, sel) {
  await page.click(sel);
  await page.waitForFunction(() => location.pathname.endsWith('login.html') && document.readyState === 'complete', { timeout: 8000 });
  await page.waitForSelector('#loginPhone');
}
const chatState = (page) => page.evaluate(() => {
  const vis = (el) => !!el && el.getClientRects().length > 0;
  const auto = document.querySelector('#scThread .sc-auto');
  const st = document.getElementById('scStatus');
  return {
    url: location.href, hash: location.hash, title: document.title,
    chatView: !document.getElementById('view-chat').hidden,
    home: !document.getElementById('view-home').hidden,
    footer: vis(document.querySelector('.site-footer')), fab: vis(document.getElementById('chatToggle')),
    autoName: auto ? auto.querySelector('.sc-name').textContent : '',
    autoText: auto ? Array.from(auto.querySelectorAll('.sc-bubble')).map((b) => b.textContent).join(' | ') : '',
    chips: Array.from(document.querySelectorAll('#scThread .sc-chip')).map((c) => c.textContent),
    topicLine: document.getElementById('scTopicLine').textContent,
    mine: Array.from(document.querySelectorAll('#scThread .from-me .sc-bubble')).map((b) => b.textContent),
    sale: Array.from(document.querySelectorAll('#scThread .sc-row.from-sale:not(.sc-auto)')).map((r) => r.textContent.replace(/\s+/g, ' ').trim()),
    failed: document.querySelectorAll('#scThread .sc-failed').length,
    status: st && !st.hidden ? st.textContent.trim() : '',
    inputDisabled: document.getElementById('scInput').disabled,
    sendDisabled: document.getElementById('scSend').disabled,
    focused: document.activeElement && document.activeElement.id
  };
});
const inboxState = (page) => page.evaluate(() => {
  const tab = document.querySelector('#adminTabs a[href="#tin-nhan"]');
  const st = document.getElementById('inboxStatus');
  return {
    url: location.href,
    tab: !!tab,
    badge: tab && tab.querySelector('.admin-tab-badge') ? tab.querySelector('.admin-tab-badge').textContent : '',
    items: Array.from(document.querySelectorAll('.inbox-item')).map((i) => i.textContent.replace(/\s+/g, ' ').trim()),
    khach: Array.from(document.querySelectorAll('#inboxMsgs .inbox-msg.from-khach .inbox-msg-text')).map((e) => e.textContent),
    sale: Array.from(document.querySelectorAll('#inboxMsgs .inbox-msg.from-sale')).map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
    head: (document.getElementById('inboxHead') || {}).textContent || '',
    replyHidden: document.getElementById('inboxReply').hidden,
    status: st && !st.hidden ? st.textContent.trim() : ''
  };
});
async function waitFor(page, fn, arg, timeout = 8000) {
  try { await page.waitForFunction(fn, { timeout, polling: 200 }, arg); return true; } catch (e) { return false; }
}

(async () => {
  await startServer();
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  // 3 "máy" riêng biệt: mỗi cửa sổ ẩn danh có localStorage riêng, đăng nhập riêng.
  const khachCtx = await browser.createBrowserContext();
  const saleCtx = await browser.createBrowserContext();
  const page = await newTab(khachCtx, errors);

  try {
    // ---------------- 1) Khách chưa đăng nhập: lướt được, không còn nút đặt lịch / chatbot AI ----------------
    await page.goto(INDEX + '#/', { waitUntil: 'networkidle0' });
    // Dữ liệu chat cũ bản localStorage (db.chats) bị bỏ khi trang nạp
    await page.evaluate(() => localStorage.setItem('aloha_demo_db', JSON.stringify({ customers: {}, editRequests: [], chats: { '0900000001': { messages: [] } } })));
    await page.reload({ waitUntil: 'networkidle0' });
    const guest = await page.evaluate(() => {
      const vis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
      return {
        home: !document.getElementById('view-home').hidden,
        bookingVisible: Array.from(document.querySelectorAll('a[href="#/dat-lich"]')).filter(vis).length,
        ctaFinal: vis(document.querySelector('.cta-final')),
        fab: vis(document.getElementById('chatToggle')),
        tiles: Array.from(document.querySelectorAll('.svc-tile')).map((a) => a.getAttribute('href')),
        list: Array.from(document.querySelectorAll('.svc-list a')).map((a) => a.getAttribute('href')),
        albumCardPE: getComputedStyle(document.querySelector('.album-card')).pointerEvents,
        oldChats: 'chats' in JSON.parse(localStorage.getItem('aloha_demo_db') || '{}')
      };
    });
    log('Khách chưa đăng nhập vẫn xem được Trang chủ', guest.home);
    log('Không còn nút/link Đặt lịch nào hiện trên trang, khối CTA cuối trang ẩn', guest.bookingVisible === 0 && !guest.ctaFinal, `${guest.bookingVisible} nút`);
    log('Nút chat nổi vẫn còn (dẫn tới chat với Sale)', guest.fab);
    const slugs = ['be-lon', 'sinh-nhat', 'bau', 'gia-dinh', 'newborn'];
    log('5 ảnh + 5 dòng dịch vụ đầu trang trỏ #/chat-sale/<dịch vụ>',
      guest.tiles.join() === slugs.map((s) => '#/chat-sale/' + s).join() && guest.list.join() === guest.tiles.join());
    log('Thẻ album trên Trang chủ không bấm được (trang album đang tắt)', guest.albumCardPE === 'none');
    log('Dữ liệu chat cũ lưu trong trình duyệt (db.chats) đã bị bỏ', !guest.oldChats);

    for (const [route, name] of [['#/album/newborn', 'album'], ['#/dat-lich', 'đặt lịch']]) {
      await page.goto(INDEX + route, { waitUntil: 'networkidle0' });
      await wait(200);
      const st = await page.evaluate(() => ({ hash: location.hash, home: !document.getElementById('view-home').hidden }));
      log(`Gõ thẳng ${route} (${name}) -> về Trang chủ`, st.hash === '#/' && st.home, st.hash);
    }

    await page.goto(INDEX + '#/', { waitUntil: 'networkidle0' });
    await clickToLogin(page, '#chatToggle');
    log('Chưa đăng nhập bấm nút chat nổi -> sang đăng nhập (next=chat-sale)', page.url().includes('login.html?next=chat-sale'), page.url().split('/').pop());
    await page.goto(INDEX + '#/', { waitUntil: 'networkidle0' });
    await clickToLogin(page, '.svc-tile--bau');
    log('Chưa đăng nhập bấm ảnh "Chụp ảnh bầu" -> sang trang đăng nhập', page.url().includes('login.html?next=chat-sale%2Fbau'), page.url().split('/').pop());

    // ---------------- 2) Đăng nhập -> server cấp mã -> màn chat, lời chào đến lần lượt ----------------
    await page.type('#loginPhone', '0900000001');
    await page.type('#loginPassword', 'khach123');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('#loginSubmitBtn')]);
    const session = await page.evaluate(() => JSON.parse(localStorage.getItem('aloha_auth') || '{}'));
    log('Đăng nhập lấy được mã đăng nhập từ server', typeof session.token === 'string' && session.token.length > 20);
    await wait(150);
    const early = await page.evaluate(() => ({
      n: document.querySelectorAll('#scThread .sc-auto .sc-bubble:not(.sc-typing)').length,
      typing: !!document.querySelector('#scThread .sc-typing'),
      note: (document.querySelector('#scThread .sc-typing-note') || {}).textContent || ''
    }));
    log('Mới vào: chưa có tin chào nào, dấu "..." + "Tư vấn viên đang trả lời…" ở dưới', early.n === 0 && early.typing && early.note === 'Tư vấn viên đang trả lời…', `${early.n} tin`);
    await page.waitForSelector('#scThread .sc-chip', { timeout: 10000 });
    let chat = await chatState(page);
    log('Vào màn chat riêng #/chat-sale/bau, ẩn footer + nút nổi',
      chat.hash === '#/chat-sale/bau' && chat.chatView && !chat.home && !chat.footer && !chat.fab && chat.title === 'Chat với Sale | ALOHA Baby', chat.hash);
    log('Lời chào tự động đủ 3 tin, đúng tên + dịch vụ, ghi "Tin nhắn tự động", 4 nút gợi ý',
      chat.autoName.includes('Tin nhắn tự động') && chat.autoText.includes('Chào Khách demo') && chat.autoText.includes('Chụp ảnh bầu') &&
      chat.chips.length === 4 && chat.chips[0] === 'Bảng giá Chụp ảnh bầu' && chat.topicLine === 'Chụp ảnh bầu');
    log('Kết nối server ổn (không báo lỗi), ô nhập dùng được, nút gửi khoá khi trống', !chat.status && !chat.inputDisabled && chat.sendDisabled);
    const [, me0] = await api('/me', { t: session.token });
    log('Lời chào tự động không tạo tin giả trên server', me0 && me0.chat === null);

    // ---------------- 3) Sale ở "máy" khác mở Admin ----------------
    const sale = await newTab(saleCtx, errors);
    await login(sale, '0900000005', 'sale123');
    // Sale đăng nhập mặc định vào Không gian Sale (crm/sale.html); mục Tin nhắn nằm ở crm/admin.html.
    await sale.goto(ROOT_URL + 'crm/admin.html#tin-nhan', { waitUntil: 'networkidle0' });
    await wait(400);
    let inbox = await inboxState(sale);
    log('Sale đăng nhập (máy khác) vào Admin, có mục Tin nhắn, chưa có cuộc trò chuyện', inbox.url.includes('crm/admin.html') && inbox.tab && inbox.items.length === 0 && !inbox.status);

    // Khách gửi 2 tin
    await page.click('.sc-chip');
    await page.type('#scInput', 'Studio còn lịch cuối tuần không ạ?');
    await page.keyboard.press('Enter');
    await waitFor(page, () => document.querySelectorAll('#scThread .from-me .sc-bubble:not(.sc-sending)').length === 2);
    chat = await chatState(page);
    const [, me1] = await api('/me', { t: session.token });
    log('Khách gửi 2 tin (bấm gợi ý + gõ Enter) -> lên server, hiện bên phải, ẩn nút gợi ý',
      chat.mine.length === 2 && chat.chips.length === 0 && me1.chat && me1.chat.messages.length === 2 &&
      me1.chat.messages[0].text === 'Cho mình xin bảng giá dịch vụ Chụp ảnh bầu ạ.' && me1.chat.topic === 'Chụp ảnh bầu');

    // Sale thấy tin mới KHÔNG cần tải lại trang
    const saleSaw = await waitFor(sale, () => document.querySelectorAll('.inbox-item').length === 1, null, 6000);
    inbox = await inboxState(sale);
    log('Sale (không tải lại trang) thấy cuộc trò chuyện mới trong vài giây, badge 2 tin chưa đọc',
      saleSaw && inbox.badge === '2' && inbox.items[0].includes('Khách demo') && inbox.items[0].includes('Chụp ảnh bầu') && inbox.items[0].includes('cuối tuần'), inbox.items[0]);
    await sale.click('.inbox-item');
    await waitFor(sale, () => document.querySelectorAll('#inboxMsgs .inbox-msg').length === 2);
    inbox = await inboxState(sale);
    log('Sale mở cuộc trò chuyện: đủ 2 tin, SĐT + dịch vụ, badge tắt, có ô trả lời',
      inbox.khach.length === 2 && inbox.head.includes('0900000001') && inbox.head.includes('Chụp ảnh bầu') && !inbox.badge && !inbox.replyHidden);
    await sale.type('#inboxInput', 'Dạ chào chị, cuối tuần này studio còn khung 9:30 sáng Chủ nhật ạ.');
    await sale.keyboard.press('Enter');
    await waitFor(sale, () => document.querySelectorAll('#inboxMsgs .inbox-msg.from-sale').length === 1);
    await sale.screenshot({ path: shot('sale-chat-admin.png') });

    // Khách đang mở màn chat nhận được câu trả lời KHÔNG cần tải lại trang
    const gotReply = await waitFor(page, () => document.querySelectorAll('#scThread .sc-row.from-sale:not(.sc-auto)').length === 1, null, 6000);
    chat = await chatState(page);
    log('Khách (máy khác, không tải lại trang) nhận câu trả lời trong vài giây, kèm tên Sale',
      gotReply && chat.sale[0].includes('Minh Thư') && chat.sale[0].includes('9:30'), chat.sale[0]);
    const [, me2] = await api('/me', { t: session.token });
    log('Khách đang xem -> câu trả lời được đánh dấu đã đọc trên server', me2.chat.customerUnread === 0);
    await page.screenshot({ path: shot('sale-chat-customer-reply.png') });

    // Khách nhắn tiếp -> Sale đang mở cuộc trò chuyện thấy ngay
    await page.type('#scInput', 'Vậy mình đặt khung 9:30 nhé');
    await page.keyboard.press('Enter');
    const saleGot = await waitFor(sale, () => Array.from(document.querySelectorAll('#inboxMsgs .inbox-msg-text')).some((e) => e.textContent.includes('9:30 nhé')), null, 6000);
    log('Sale đang mở cuộc trò chuyện thấy tin mới của khách trong vài giây', saleGot);

    // Sale khác + Sếp + Thợ ảnh (máy thứ 3)
    const otherCtx = await browser.createBrowserContext();
    const other = await newTab(otherCtx, errors);
    await login(other, '0900000002', 'sale123');
    await other.goto(ROOT_URL + 'crm/admin.html#tin-nhan', { waitUntil: 'networkidle0' });
    await wait(400);
    await waitFor(other, () => document.querySelectorAll('.inbox-item').length === 1);
    log('Tài khoản Sale khác thấy chung cuộc trò chuyện', (await inboxState(other)).items.length === 1);
    await login(other, '0900000004', 'sep123');
    await waitFor(other, () => document.querySelectorAll('.inbox-item').length === 1);
    await other.click('.inbox-item');
    await waitFor(other, () => document.querySelectorAll('#inboxMsgs .inbox-msg').length === 4);
    const sep = await inboxState(other);
    log('Sếp xem được đủ 4 tin nhưng không có ô trả lời', sep.replyHidden && sep.khach.length + sep.sale.length === 4);
    await login(other, '0900000003', 'anh123');
    log('Thợ ảnh không có mục Tin nhắn', !(await inboxState(other).catch(() => ({ tab: false }))).tab);
    await otherCtx.close();

    // Quyền ở tầng server: khách không đọc được hộp thư Sale, không có mã thì bị chặn
    log('Server chặn khách đọc hộp thư Sale (403) và yêu cầu không có mã (401)',
      (await api('/inbox', { t: session.token }))[0] === 403 && (await api('/me'))[0] === 401);

    // ---------------- 4) Chấm đỏ trên nút chat khi Sale trả lời lúc khách ở trang khác ----------------
    await page.click('.sc-head-back');
    await wait(300);
    await sale.type('#inboxInput', 'Em giữ khung 9:30 cho chị rồi ạ.');
    await sale.keyboard.press('Enter');
    const dot = await waitFor(page, () => !document.querySelector('#chatToggle .dot').hidden, null, 25000);
    log('Khách ở Trang chủ: Sale trả lời thì nút chat nổi hiện chấm đỏ', dot);
    await page.click('#chatToggle');
    await waitFor(page, () => document.querySelectorAll('#scThread .sc-row.from-sale:not(.sc-auto) .sc-bubble').length === 2);
    await wait(300);
    log('Mở chat thấy tin mới, chấm đỏ tắt khi về trang chủ', (await page.evaluate(() => { location.hash = '/'; return true; })) &&
      await waitFor(page, () => document.querySelector('#chatToggle .dot').hidden, null, 3000));

    // ---------------- 5) Mất kết nối server: báo trạng thái, tin lỗi có nút gửi lại ----------------
    await page.evaluate(() => { location.hash = '/chat-sale'; });
    await wait(500);
    stopServer();
    await page.type('#scInput', 'Tin gửi lúc mất mạng');
    await page.keyboard.press('Enter');
    await waitFor(page, () => document.querySelectorAll('#scThread .sc-failed').length === 1);
    chat = await chatState(page);
    log('Server tắt: tin gửi lỗi hiện "Chưa gửi được · Gửi lại", có dòng báo đang kết nối', chat.failed === 1 && chat.status.includes('Đang kết nối'), chat.status.slice(0, 40));
    await startServer(); // bật lại (bộ nhớ trống, mã đăng nhập vẫn hợp lệ vì cùng AUTH_SECRET)
    await page.click('.sc-retry');
    await waitFor(page, () => !document.querySelector('#scThread .sc-failed') && !document.querySelector('#scThread .sc-sending'));
    await waitFor(page, () => document.getElementById('scStatus').hidden, null, 6000);
    chat = await chatState(page);
    const [, me3] = await api('/me', { t: session.token });
    log('Server bật lại: bấm Gửi lại -> tin lên server, hết báo lỗi', chat.failed === 0 && !chat.status && me3.chat && me3.chat.messages.some((m) => m.text === 'Tin gửi lúc mất mạng'));

    // ---------------- 6) Phiên đăng nhập không có mã (đăng nhập lúc server tắt) ----------------
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('aloha_auth')); delete s.token; localStorage.setItem('aloha_auth', JSON.stringify(s)); });
    await page.goto(INDEX + '#/chat-sale', { waitUntil: 'networkidle0' });
    await page.reload({ waitUntil: 'networkidle0' });
    await waitFor(page, () => !document.getElementById('scStatus').hidden, null, 4000);
    chat = await chatState(page);
    log('Không có mã đăng nhập: báo "Đăng nhập lại", khoá ô nhập', chat.status.includes('Đăng nhập lại') && chat.inputDisabled);
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('#scRelogin')]);
    log('Bấm "Đăng nhập lại" -> trang đăng nhập, quay lại đúng màn chat', page.url().includes('login.html?next=chat-sale'), page.url().split('/').pop());

    // ---------------- 7) Đăng ký thật trên server ----------------
    const regCtx = await browser.createBrowserContext();
    const reg = await newTab(regCtx, errors);
    await reg.goto(LOGIN + '?mode=register', { waitUntil: 'networkidle0' });
    await reg.type('#loginName', 'Nguyễn Thu Hà');
    await reg.type('#loginPhone', '0911222333');
    await reg.type('#loginPassword', 'abc123');
    await Promise.all([reg.waitForNavigation({ waitUntil: 'networkidle0' }), reg.click('#loginSubmitBtn')]);
    await reg.waitForSelector('#scThread .sc-chip', { timeout: 10000 });
    const regState = await chatState(reg);
    const regSession = await reg.evaluate(() => JSON.parse(localStorage.getItem('aloha_auth') || '{}'));
    log('Đăng ký mới -> tài khoản tạo trên server (có mã), vào màn chat, lời chào đúng tên',
      regState.hash === '#/chat-sale' && regState.autoText.includes('Nguyễn Thu Hà') && !!regSession.token);
    await reg.evaluate(() => localStorage.removeItem('aloha_auth'));
    await reg.goto(LOGIN + '?mode=register', { waitUntil: 'networkidle0' });
    await reg.type('#loginName', 'Người khác');
    await reg.type('#loginPhone', '0911222333');
    await reg.type('#loginPassword', 'xyz789');
    await reg.click('#loginSubmitBtn');
    await waitFor(reg, () => document.getElementById('loginError').classList.contains('show'));
    const dupMsg = await reg.$eval('#loginError', (e) => e.textContent);
    log('Đăng ký trùng SĐT bị chặn (không chiếm được tài khoản/tin nhắn của người khác)', dupMsg.includes('đã có tài khoản') && reg.url().includes('login.html'), dupMsg);
    await reg.goto(LOGIN, { waitUntil: 'networkidle0' });
    await reg.type('#loginPhone', '0911222333');
    await reg.type('#loginPassword', 'sai-mat-khau');
    await reg.click('#loginSubmitBtn');
    await waitFor(reg, () => document.getElementById('loginError').classList.contains('show'));
    log('Khách đã đăng ký: sai mật khẩu bị từ chối', reg.url().includes('login.html'));
    await login(reg, '0911222333', 'abc123', 'chat-sale');
    log('Khách đã đăng ký đăng nhập lại được (mật khẩu kiểm tra ở server)', reg.url().includes('index.html#/chat-sale'));
    await regCtx.close();

    // ---------------- 8) Không giảm hiệu ứng: ảnh phóng to + tin chào lần lượt ----------------
    {
      const ctx = await browser.createBrowserContext();
      const p2 = await ctx.newPage();
      p2.on('pageerror', (e) => errors.push(e.message));
      await p2.setViewport({ width: 1280, height: 800 });
      await login(p2, '0900000001', 'khach123');
      // Khách demo đã có tin -> dùng khách mới để thấy lời chào
      await p2.evaluate(() => localStorage.removeItem('aloha_auth'));
      await p2.goto(LOGIN + '?mode=register', { waitUntil: 'networkidle0' });
      await p2.type('#loginName', 'Mẹ Bống');
      await p2.type('#loginPhone', '0977000111');
      await p2.type('#loginPassword', 'abc123');
      await Promise.all([p2.waitForNavigation({ waitUntil: 'networkidle0' }), p2.click('#loginSubmitBtn')]);
      await p2.goto(INDEX + '#/', { waitUntil: 'networkidle0' });
      await p2.click('.svc-tile--sinh-nhat');
      await wait(200);
      const mid = await p2.evaluate(() => ({ ghost: !!document.querySelector('.sc-zoom'), home: !document.getElementById('view-home').hidden }));
      log('Bấm ảnh -> ảnh phóng to phủ dần màn hình, trang chủ vẫn còn phía dưới trong lúc chuyển', mid.ghost && mid.home);
      await wait(900);
      const landed = await p2.evaluate(() => ({ ghost: !!document.querySelector('.sc-zoom'), hash: location.hash, card: document.querySelector('.sc-main').classList.contains('sc-in') }));
      log('Hết hiệu ứng -> ở màn chat #/chat-sale/sinh-nhat, lớp ảnh phóng đã gỡ, khung chat trượt lên', !landed.ghost && landed.hash === '#/chat-sale/sinh-nhat' && landed.card, landed.hash);
      const timeline = await p2.evaluate(() => new Promise((resolve) => {
        const out = []; const t0 = Date.now();
        const iv = setInterval(() => {
          const auto = document.querySelector('#scThread .sc-auto');
          out.push([auto ? auto.querySelectorAll('.sc-bubble:not(.sc-typing)').length : 0, !!document.querySelector('#scThread .sc-typing'), !!document.querySelector('#scThread .sc-chips')]);
          if (Date.now() - t0 > 7000) { clearInterval(iv); resolve(out); }
        }, 100);
      }));
      const counts = timeline.map((s) => s[0]);
      const firstIdx = (n) => counts.indexOf(n);
      const typingBefore = (n) => { const i = firstIdx(n); return i > 0 && timeline.slice(Math.max(0, firstIdx(n - 1)), i).some((s) => s[1]); };
      log('Tin chào đến lần lượt 1 -> 2 -> 3, trước mỗi tin có "đang trả lời…", nút gợi ý sau tin cuối',
        firstIdx(2) > firstIdx(1) + 3 && firstIdx(3) > firstIdx(2) + 3 && typingBefore(2) && typingBefore(3) &&
        timeline.findIndex((s) => s[2]) > firstIdx(3), `tin 2 @${firstIdx(2) * 100}ms, tin 3 @${firstIdx(3) * 100}ms`);
      await p2.screenshot({ path: shot('sale-chat-greeting.png') });
      await ctx.close();
    }

    // ---------------- 9) Điện thoại ----------------
    const mCtx = await browser.createBrowserContext();
    const m = await newTab(mCtx, errors, { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await login(m, '0900000001', 'khach123', 'chat-sale');
    await waitFor(m, () => document.querySelectorAll('#scThread .from-me .sc-bubble').length >= 3);
    const mob = await m.evaluate(() => {
      const comp = document.getElementById('scForm').getBoundingClientRect();
      return { overflow: document.documentElement.scrollWidth > window.innerWidth, composerInView: comp.bottom <= window.innerHeight && comp.top > 0, focused: document.activeElement && document.activeElement.id };
    });
    log('[mobile] Màn chat không tràn ngang, ô nhập trong màn hình, không tự bật bàn phím, thấy lịch sử từ máy khác',
      !mob.overflow && mob.composerInView && mob.focused !== 'scInput');
    await m.screenshot({ path: shot('sale-chat-mobile.png') });
    await login(m, '0900000002', 'sale123');
    await m.goto(ROOT_URL + 'crm/admin.html#tin-nhan', { waitUntil: 'networkidle0' });
    await wait(400);
    await waitFor(m, () => document.querySelectorAll('.inbox-item').length >= 1);
    await m.click('.inbox-item');
    await waitFor(m, () => !document.getElementById('inboxReply').hidden);
    const mAdmin = await m.evaluate(() => ({ overflow: document.documentElement.scrollWidth > window.innerWidth, reply: !document.getElementById('inboxReply').hidden }));
    log('[mobile] Hộp thư Admin không tràn ngang, trả lời được', !mAdmin.overflow && mAdmin.reply);
    await m.evaluate(() => document.getElementById('tin-nhan').scrollIntoView());
    await wait(300);
    await m.screenshot({ path: shot('sale-chat-admin-mobile.png') });
    await mCtx.close();

    log('Không có lỗi JavaScript', errors.length === 0, errors.join(' | '));
  } catch (err) {
    log('Test chạy hết không bị lỗi giữa chừng', false, err.message);
  } finally {
    await browser.close();
    stopServer();
  }
  const failed = results.filter((r) => !r.ok);
  console.log('\n' + (failed.length === 0 ? 'TẤT CẢ TEST PASS' : failed.length + ' TEST FAIL') + ` (${results.length} case)`);
  process.exit(failed.length === 0 ? 0 : 1);
})();
