const { CHROME_PATH, ROOT_URL, ROOT, shot } = require('./test-env');
// Test chat THẬT Khách <-> Sale qua server (2026-09-27, sửa 2026-09-28): khách chưa đăng nhập
// vẫn lướt web; bấm ảnh / dòng dịch vụ đầu trang -> đăng nhập -> album dịch vụ đó (concept ->
// ảnh). Nút chat nổi mở chatbot AI ở góc; bấm "Nhắn Sale" thì chat tiếp với Sale NGAY TRONG
// khung đó, Sale nhận kèm bản tóm tắt khách đã xem gì (tin hệ thống). Tin nhắn đi qua
// server/sale-chat.js tới mục "Tin nhắn" của crm/admin.html. Khách và Sale ở 2 cửa sổ ẩn danh
// RIÊNG (khác bộ nhớ trình duyệt = như 2 máy khác nhau) vẫn chat qua lại được mà không tải lại
// trang. Đặt lịch tạm tắt (js/features.js). Lời chào tự mở của chatbot: test-chatbot-greeting.js.
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
// Bấm nút chat / ảnh dịch vụ khi chưa đăng nhập -> sang login.html -> chờ đúng trang login.
async function clickToLogin(page, sel) {
  await page.click(sel);
  await page.waitForFunction(() => location.pathname.endsWith('login.html') && document.readyState === 'complete', { timeout: 8000 });
  await page.waitForSelector('#loginPhone');
}
const chatState = (page) => page.evaluate(() => {
  const vis = (el) => !!el && el.getClientRects().length > 0;
  const auto = document.querySelector('#chatBody .chat-sale-live .sc-auto');
  const st = document.getElementById('chatSaleStatus');
  return {
    url: location.href, hash: location.hash, title: document.title,
    open: document.getElementById('chatPanel').classList.contains('open') && document.getElementById('chatPanel').classList.contains('sale-mode'),
    panel: (() => { const r = document.getElementById('chatPanel').getBoundingClientRect(); return { w: r.width, h: r.height, right: window.innerWidth - r.right, bottom: window.innerHeight - r.bottom }; })(),
    aiBefore: document.querySelectorAll('#chatBody > .chat-msg.bot').length,
    home: !document.getElementById('view-home').hidden,
    album: !document.getElementById('view-album').hidden,
    footer: vis(document.querySelector('.site-footer')), fab: vis(document.getElementById('chatToggle')),
    autoName: auto ? auto.querySelector('.sc-name').textContent : '',
    autoText: auto ? Array.from(auto.querySelectorAll('.sc-bubble')).map((b) => b.textContent).join(' | ') : '',
    chips: Array.from(document.querySelectorAll('#chatBody .chat-sale-live .sc-chip')).map((c) => c.textContent),
    subtitle: document.getElementById('chatSubtitle').textContent,
    mine: Array.from(document.querySelectorAll('#chatBody .chat-sale-live .from-me .sc-bubble')).map((b) => b.textContent),
    sale: Array.from(document.querySelectorAll('#chatBody .chat-sale-live .sc-row.from-sale:not(.sc-auto)')).map((r) => r.textContent.replace(/\s+/g, ' ').trim()),
    failed: document.querySelectorAll('#chatBody .chat-sale-live .sc-failed').length,
    status: st && !st.hidden ? st.textContent.trim() : '',
    inputDisabled: document.getElementById('chatInput').disabled,
    sendDisabled: document.querySelector('#chatInputForm .chat-send').disabled,
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
    log('Nút chat nổi vẫn còn (mở chat với Sale)', guest.fab);
    const slugs = ['be-lon', 'sinh-nhat', 'bau', 'gia-dinh', 'newborn'];
    log('5 ảnh + 5 dòng dịch vụ đầu trang trỏ album #/album/<dịch vụ>',
      guest.tiles.join() === slugs.map((s) => '#/album/' + s).join() && guest.list.join() === guest.tiles.join());
    log('Thẻ album khác trên Trang chủ bấm được lại (trang album đã bật)', guest.albumCardPE !== 'none');
    log('Dữ liệu chat cũ lưu trong trình duyệt (db.chats) đã bị bỏ', !guest.oldChats);

    await page.goto(INDEX + '#/album/newborn', { waitUntil: 'networkidle0' });
    await wait(200);
    let st0 = await page.evaluate(() => ({ hash: location.hash, album: !document.getElementById('view-album').hidden, n: document.querySelectorAll('#galleryConcepts .concept-album').length }));
    log('Gõ thẳng #/album/newborn khi chưa đăng nhập -> xem công khai được', st0.hash === '#/album/newborn' && st0.album && st0.n > 0, `${st0.n} concept`);
    await page.goto(INDEX + '#/dat-lich', { waitUntil: 'networkidle0' });
    await wait(200);
    st0 = await page.evaluate(() => ({ hash: location.hash, home: !document.getElementById('view-home').hidden }));
    log('Gõ thẳng #/dat-lich (đặt lịch đang tắt) -> về Trang chủ', st0.hash === '#/' && st0.home, st0.hash);

    await page.goto(INDEX + '#/', { waitUntil: 'networkidle0' });
    await clickToLogin(page, '#chatToggle');
    log('Chưa đăng nhập bấm nút chat nổi -> sang đăng nhập (quay lại Trang chủ)', page.url().includes('login.html?next=home'), page.url().split('/').pop());
    await page.goto(INDEX + '#/', { waitUntil: 'networkidle0' });
    await clickToLogin(page, '.svc-list a[href="#/album/gia-dinh"]');
    log('Chưa đăng nhập bấm dòng "Chụp ảnh gia đình" -> sang đăng nhập (next=album/gia-dinh)', page.url().includes('login.html?next=album%2Fgia-dinh'), page.url().split('/').pop());
    await page.goto(INDEX + '#/', { waitUntil: 'networkidle0' });
    await clickToLogin(page, '.svc-tile--bau');
    log('Chưa đăng nhập bấm ảnh "Chụp ảnh bầu" -> sang trang đăng nhập (next=album/bau)', page.url().includes('login.html?next=album%2Fbau'), page.url().split('/').pop());

    // ---------------- 2) Đăng nhập -> album dịch vụ vừa bấm -> concept -> ảnh; mở chat ở góc ----------------
    await page.type('#loginPhone', '0900000001');
    await page.type('#loginPassword', 'khach123');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('#loginSubmitBtn')]);
    const session = await page.evaluate(() => JSON.parse(localStorage.getItem('aloha_auth') || '{}'));
    log('Đăng nhập lấy được mã đăng nhập từ server', typeof session.token === 'string' && session.token.length > 20);
    const alb = await page.evaluate(() => ({ hash: location.hash, album: !document.getElementById('view-album').hidden, title: document.getElementById('galleryTitle').textContent, n: document.querySelectorAll('#galleryConcepts .concept-album').length }));
    log('Đăng nhập xong vào thẳng album Bầu, thấy các concept', alb.hash === '#/album/bau' && alb.album && alb.n > 0, `${alb.title}: ${alb.n} concept`);
    await page.click('#galleryConcepts .concept-album');
    await waitFor(page, () => !document.getElementById('galleryGrid').hidden && document.querySelectorAll('#galleryGrid .gallery-item').length > 0);
    const photos = await page.evaluate(() => ({ hash: location.hash, n: document.querySelectorAll('#galleryGrid .gallery-item').length }));
    log('Bấm 1 concept -> thấy ảnh bên trong', /^#\/album\/bau\/[a-z-]+$/.test(photos.hash) && photos.n > 0, `${photos.hash}: ${photos.n} ảnh`);
    await page.click('#galleryGrid .gallery-item');
    await waitFor(page, () => !document.getElementById('lightbox').hidden);
    log('Bấm 1 ảnh -> mở xem ảnh lớn', await page.evaluate(() => !document.getElementById('lightbox').hidden));
    await page.keyboard.press('Escape');
    await wait(200);
    await page.screenshot({ path: shot('sale-chat-album.png') });

    // Mở chatbot ở góc ngay trên trang album -> lời chào theo concept đang xem -> bấm "Nhắn Sale"
    // Lúc chưa đăng nhập khách đã bấm nút chat (bị đưa sang đăng nhập) -> đăng nhập xong khung chat
    // tự mở tiếp; chưa mở thì bấm nút chat.
    await wait(300);
    if (!(await page.evaluate(() => document.getElementById('chatPanel').classList.contains('open')))) await page.click('#chatToggle');
    await waitFor(page, () => document.querySelectorAll('#chatBody .chat-quick button').length > 0);
    const ai = await page.evaluate(() => ({ open: document.getElementById('chatPanel').classList.contains('open'), text: document.getElementById('chatBody').textContent }));
    log('Bấm nút chat -> chatbot AI mở ở góc, lời chào theo concept Bầu đang xem', ai.open && ai.text.includes('của dịch vụ Bầu'), ai.text.slice(0, 80));
    await page.click('#chatToSale');
    await wait(700); // lời chào: nghỉ 450ms rồi mới "đang trả lời…", tin 1 đến sau ≥ 1.1 giây
    const early = await page.evaluate(() => ({
      n: document.querySelectorAll('#chatBody .chat-sale-live .sc-auto .sc-bubble:not(.sc-typing)').length,
      typing: !!document.querySelector('#chatBody .chat-sale-live .sc-typing'),
      note: (document.querySelector('#chatBody .chat-sale-live .sc-typing-note') || {}).textContent || ''
    }));
    log('Mới mở: chưa có tin chào nào, dấu "..." + "Tư vấn viên đang trả lời…" ở dưới', early.n === 0 && early.typing && early.note === 'Tư vấn viên đang trả lời…', `${early.n} tin`);
    await page.waitForSelector('#chatBody .chat-sale-live .sc-chip', { timeout: 10000 });
    let chat = await chatState(page);
    log('"Nhắn Sale" -> vẫn cùng khung chat ở góc (tin trợ lý AI còn phía trên), chuyển sang chat với Sale, vẫn ở trang album',
      chat.open && chat.aiBefore >= 2 && chat.subtitle === 'Đang chat trực tiếp với Sale' && chat.album && /^#\/album\/bau/.test(chat.hash) && chat.fab &&
      chat.panel.w <= 400 && chat.panel.right < 40 && chat.panel.bottom > 60, `${Math.round(chat.panel.w)}x${Math.round(chat.panel.h)}, ${chat.hash}`);
    log('Lời chào tự động đủ 3 tin, đúng tên + dịch vụ, ghi "Tin nhắn tự động", 4 nút gợi ý',
      chat.autoName.includes('Tin nhắn tự động') && chat.autoText.includes('Chào Khách demo') && chat.autoText.includes('Chụp ảnh bầu') &&
      chat.chips.length === 4 && chat.chips[0] === 'Bảng giá Chụp ảnh bầu');
    log('Kết nối server ổn (không báo lỗi), ô nhập dùng được, nút gửi khoá khi trống', !chat.status && !chat.inputDisabled && chat.sendDisabled);
    const [, me0] = await api('/me', { t: session.token });
    const sum0 = me0 && me0.chat ? me0.chat.messages : [];
    log('Chuyển sang Sale -> server lưu 1 bản tóm tắt (tin hệ thống): dịch vụ Bầu, concept đã xem, số ảnh đã mở; lời chào tự động không tạo tin giả',
      sum0.length === 1 && sum0[0].from === 'he-thong' && sum0[0].text.includes('Chụp ảnh bầu') && sum0[0].text.includes('Concept đã xem') && sum0[0].text.includes('Đã mở xem lớn 1 ảnh'), sum0[0] && sum0[0].text.replace(/\n/g, ' / '));
    log('Khách không thấy bản tóm tắt trong khung chat', !(await page.evaluate(() => document.getElementById('chatBody').textContent.includes('Quan tâm nhiều nhất'))));

    // ---------------- 3) Sale ở "máy" khác mở Admin ----------------
    const sale = await newTab(saleCtx, errors);
    await login(sale, '0900000005', 'sale123');
    await waitFor(sale, () => document.querySelectorAll('.inbox-item').length === 1);
    let inbox = await inboxState(sale);
    log('Sale đăng nhập (máy khác) vào Admin, thấy ngay cuộc trò chuyện mới (chưa có tin khách, chỉ có tóm tắt)',
      inbox.url.includes('crm/admin.html') && inbox.tab && inbox.items.length === 1 && inbox.items[0].includes('Tóm tắt') && !inbox.status, inbox.items[0]);

    // Khách gửi 2 tin
    await page.click('#chatBody .sc-chip');
    await page.type('#chatInput', 'Studio còn lịch cuối tuần không ạ?');
    await page.keyboard.press('Enter');
    await waitFor(page, () => document.querySelectorAll('#chatBody .chat-sale-live .from-me .sc-bubble:not(.sc-sending)').length === 2);
    chat = await chatState(page);
    const [, me1] = await api('/me', { t: session.token });
    log('Khách gửi 2 tin (bấm gợi ý + gõ Enter) -> lên server, hiện bên phải, ẩn nút gợi ý',
      chat.mine.length === 2 && chat.chips.length === 0 && me1.chat && me1.chat.messages.length === 3 &&
      me1.chat.messages[1].text === 'Cho mình xin bảng giá dịch vụ Chụp ảnh bầu ạ.' && me1.chat.topic === 'Chụp ảnh bầu');

    // Sale thấy tin mới KHÔNG cần tải lại trang
    const saleSaw = await waitFor(sale, () => /cuối tuần/.test(document.querySelector('.inbox-item').textContent), null, 6000);
    inbox = await inboxState(sale);
    log('Sale (không tải lại trang) thấy tin mới trong vài giây, badge 3 chưa đọc (tóm tắt + 2 tin)',
      saleSaw && inbox.badge === '3' && inbox.items[0].includes('Khách demo') && inbox.items[0].includes('Chụp ảnh bầu') && inbox.items[0].includes('cuối tuần'), inbox.items[0]);
    await sale.click('.inbox-item');
    await waitFor(sale, () => document.querySelectorAll('#inboxMsgs .inbox-msg').length === 3);
    inbox = await inboxState(sale);
    const sysCard = await sale.evaluate(() => { const c = document.querySelector('#inboxMsgs .inbox-msg.from-system'); return c ? c.textContent : ''; });
    log('Sale mở cuộc trò chuyện: thẻ tóm tắt ở đầu (khách xem gì), 2 tin khách, SĐT + dịch vụ, badge tắt, có ô trả lời',
      sysCard.includes('tóm tắt tự động') && sysCard.includes('Concept đã xem') && inbox.khach.length === 2 && inbox.head.includes('0900000001') && inbox.head.includes('Chụp ảnh bầu') && !inbox.badge && !inbox.replyHidden);
    await sale.type('#inboxInput', 'Dạ chào chị, cuối tuần này studio còn khung 9:30 sáng Chủ nhật ạ.');
    await sale.keyboard.press('Enter');
    await waitFor(sale, () => document.querySelectorAll('#inboxMsgs .inbox-msg.from-sale').length === 1);
    await sale.screenshot({ path: shot('sale-chat-admin.png') });

    // Khách đang mở màn chat nhận được câu trả lời KHÔNG cần tải lại trang
    const gotReply = await waitFor(page, () => document.querySelectorAll('#chatBody .chat-sale-live .sc-row.from-sale:not(.sc-auto)').length === 1, null, 6000);
    chat = await chatState(page);
    log('Khách (máy khác, không tải lại trang) nhận câu trả lời trong vài giây, kèm tên Sale',
      gotReply && chat.sale[0].includes('Sale demo 2') && chat.sale[0].includes('9:30'), chat.sale[0]);
    const [, me2] = await api('/me', { t: session.token });
    log('Khách đang xem -> câu trả lời được đánh dấu đã đọc trên server', me2.chat.customerUnread === 0);
    await page.screenshot({ path: shot('sale-chat-customer-reply.png') });

    // Khách nhắn tiếp -> Sale đang mở cuộc trò chuyện thấy ngay
    await page.type('#chatInput', 'Vậy mình đặt khung 9:30 nhé');
    await page.keyboard.press('Enter');
    const saleGot = await waitFor(sale, () => Array.from(document.querySelectorAll('#inboxMsgs .inbox-msg-text')).some((e) => e.textContent.includes('9:30 nhé')), null, 6000);
    log('Sale đang mở cuộc trò chuyện thấy tin mới của khách trong vài giây', saleGot);

    // Sale khác + Sếp + Thợ ảnh (máy thứ 3)
    const otherCtx = await browser.createBrowserContext();
    const other = await newTab(otherCtx, errors);
    await login(other, '0900000002', 'sale123');
    await waitFor(other, () => document.querySelectorAll('.inbox-item').length === 1);
    log('Tài khoản Sale khác thấy chung cuộc trò chuyện', (await inboxState(other)).items.length === 1);
    await login(other, '0900000004', 'sep123');
    await waitFor(other, () => document.querySelectorAll('.inbox-item').length === 1);
    await other.click('.inbox-item');
    await waitFor(other, () => document.querySelectorAll('#inboxMsgs .inbox-msg').length === 5); // tóm tắt + 4 tin
    const sep = await inboxState(other);
    log('Sếp xem được đủ 4 tin nhưng không có ô trả lời', sep.replyHidden && sep.khach.length + sep.sale.length === 4);
    await login(other, '0900000003', 'anh123');
    log('Thợ ảnh không có mục Tin nhắn', !(await inboxState(other).catch(() => ({ tab: false }))).tab);
    await otherCtx.close();

    // Quyền ở tầng server: khách không đọc được hộp thư Sale, không có mã thì bị chặn
    log('Server chặn khách đọc hộp thư Sale (403) và yêu cầu không có mã (401)',
      (await api('/inbox', { t: session.token }))[0] === 403 && (await api('/me'))[0] === 401);

    // ---------------- 4) Chấm đỏ trên nút chat khi Sale trả lời lúc khách đã thu nhỏ khung chat ----------------
    await page.click('#chatClose');
    await wait(300);
    log('Bấm × -> khung chat thu nhỏ lại', !(await chatState(page)).open);
    await sale.type('#inboxInput', 'Em giữ khung 9:30 cho chị rồi ạ.');
    await sale.keyboard.press('Enter');
    const dot = await waitFor(page, () => !document.querySelector('#chatToggle .dot').hidden, null, 25000);
    log('Khung chat đang thu nhỏ: Sale trả lời thì nút chat nổi hiện chấm đỏ', dot);
    await page.click('#chatToggle');
    await waitFor(page, () => document.querySelectorAll('#chatBody .chat-sale-live .sc-row.from-sale:not(.sc-auto) .sc-bubble').length === 2);
    await wait(300);
    await page.click('#chatToggle'); // bấm lần nữa -> thu nhỏ
    await wait(300);
    const reopened = await chatState(page);
    log('Mở chat thấy tin mới, bấm nút chat lần nữa thì thu nhỏ, chấm đỏ đã tắt',
      !reopened.open && await page.evaluate(() => document.querySelector('#chatToggle .dot').hidden));

    // ---------------- 5) Mất kết nối server: báo trạng thái, tin lỗi có nút gửi lại ----------------
    await page.evaluate(() => { location.hash = '/'; });
    await wait(200);
    await page.evaluate(() => { location.hash = '/chat-sale'; }); // link #/chat-sale mở khung chat, ở lại trang
    await wait(500);
    const viaLink = await chatState(page);
    log('Link #/chat-sale (đã đăng nhập) -> mở khung chat ở góc, địa chỉ trở lại trang đang xem', viaLink.open && viaLink.hash === '#/' && viaLink.home, viaLink.hash);
    stopServer();
    await page.type('#chatInput', 'Tin gửi lúc mất mạng');
    await page.keyboard.press('Enter');
    await waitFor(page, () => document.querySelectorAll('#chatBody .chat-sale-live .sc-failed').length === 1);
    chat = await chatState(page);
    log('Server tắt: tin gửi lỗi hiện "Chưa gửi được · Gửi lại", có dòng báo đang kết nối', chat.failed === 1 && chat.status.includes('Đang kết nối'), chat.status.slice(0, 40));
    await startServer(); // bật lại (bộ nhớ trống, mã đăng nhập vẫn hợp lệ vì cùng AUTH_SECRET)
    await page.click('.sc-retry');
    await waitFor(page, () => !document.querySelector('#chatBody .chat-sale-live .sc-failed') && !document.querySelector('#chatBody .chat-sale-live .sc-sending'));
    await waitFor(page, () => document.getElementById('chatSaleStatus').hidden, null, 6000);
    chat = await chatState(page);
    const [, me3] = await api('/me', { t: session.token });
    log('Server bật lại: bấm Gửi lại -> tin lên server, hết báo lỗi', chat.failed === 0 && !chat.status && me3.chat && me3.chat.messages.some((m) => m.text === 'Tin gửi lúc mất mạng'));

    // ---------------- 6) Phiên đăng nhập không có mã (đăng nhập lúc server tắt) ----------------
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('aloha_auth')); delete s.token; localStorage.setItem('aloha_auth', JSON.stringify(s)); });
    await page.goto(INDEX + '#/', { waitUntil: 'networkidle0' });
    await page.reload({ waitUntil: 'networkidle0' });
    await page.evaluate(() => { location.hash = '/chat-sale'; });
    await waitFor(page, () => !document.getElementById('chatSaleStatus').hidden, null, 4000);
    chat = await chatState(page);
    log('Không có mã đăng nhập: báo "Đăng nhập lại", khoá ô nhập', chat.status.includes('Đăng nhập lại') && chat.inputDisabled);
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('#scRelogin')]);
    log('Bấm "Đăng nhập lại" -> trang đăng nhập, quay lại mở khung chat', page.url().includes('login.html?next=chat-sale'), page.url().split('/').pop());

    // ---------------- 7) Đăng ký thật trên server ----------------
    const regCtx = await browser.createBrowserContext();
    const reg = await newTab(regCtx, errors);
    await reg.goto(LOGIN + '?mode=register', { waitUntil: 'networkidle0' });
    await reg.type('#loginName', 'Nguyễn Thu Hà');
    await reg.type('#loginPhone', '0911222333');
    await reg.type('#loginPassword', 'abc123');
    await Promise.all([reg.waitForNavigation({ waitUntil: 'networkidle0' }), reg.click('#loginSubmitBtn')]);
    await reg.waitForSelector('#chatBody .chat-sale-live .sc-chip', { timeout: 10000 });
    const regState = await chatState(reg);
    const regSession = await reg.evaluate(() => JSON.parse(localStorage.getItem('aloha_auth') || '{}'));
    log('Đăng ký mới -> tài khoản tạo trên server (có mã), Trang chủ + khung chat mở sẵn, lời chào đúng tên',
      regState.hash === '#/' && regState.home && regState.open && regState.autoText.includes('Nguyễn Thu Hà') && !!regSession.token, regState.hash);
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
    log('Khách đã đăng ký đăng nhập lại được (mật khẩu kiểm tra ở server)', reg.url().includes('index.html') && (await chatState(reg)).open);
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
      // Khách mới đăng ký (Đặt lịch đang tắt) -> khung chat mở ở chế độ Sale, lời chào đến lần lượt.
      const timeline = await p2.evaluate(() => new Promise((resolve) => {
        const out = []; const t0 = Date.now();
        const iv = setInterval(() => {
          const auto = document.querySelector('#chatBody .chat-sale-live .sc-auto');
          out.push([auto ? auto.querySelectorAll('.sc-bubble:not(.sc-typing)').length : 0, !!document.querySelector('#chatBody .chat-sale-live .sc-typing'), !!document.querySelector('#chatBody .chat-sale-live .sc-chips')]);
          if (Date.now() - t0 > 6000) { clearInterval(iv); resolve(out); }
        }, 100);
      }));
      const counts = timeline.map((x) => x[0]);
      const firstIdx = (n) => counts.indexOf(n);
      const typingBefore = (n) => { const i = firstIdx(n); return i > 0 && timeline.slice(Math.max(0, firstIdx(n - 1)), i).some((x) => x[1]); };
      log('Tin chào đến lần lượt 1 -> 2 -> 3, trước mỗi tin có "đang trả lời…", nút gợi ý sau tin cuối',
        firstIdx(2) > firstIdx(1) + 3 && firstIdx(3) > firstIdx(2) + 3 && typingBefore(2) && typingBefore(3) &&
        timeline.findIndex((x) => x[2]) > firstIdx(3), `tin 2 @${firstIdx(2) * 100}ms, tin 3 @${firstIdx(3) * 100}ms`);
      await p2.screenshot({ path: shot('sale-chat-greeting.png') });
      await p2.click('#chatClose');
      await p2.evaluate(() => window.scrollTo(0, 0));
      await wait(300);
      await p2.click('.svc-tile--sinh-nhat');
      await wait(200);
      const mid = await p2.evaluate(() => ({ ghost: !!document.querySelector('.svc-zoom'), home: !document.getElementById('view-home').hidden }));
      log('Đã đăng nhập bấm ảnh -> ảnh phóng to phủ dần màn hình, trang chủ vẫn còn phía dưới trong lúc chuyển', mid.ghost && mid.home);
      await wait(900);
      const landed = await p2.evaluate(() => ({ ghost: !!document.querySelector('.svc-zoom'), hash: location.hash, album: !document.getElementById('view-album').hidden, title: document.getElementById('galleryTitle').textContent }));
      log('Hết hiệu ứng -> ở album #/album/sinh-nhat, lớp ảnh phóng đã gỡ', !landed.ghost && landed.hash === '#/album/sinh-nhat' && landed.album, `${landed.hash} ${landed.title}`);
      await p2.click('#chatToggle');
      await wait(400);
      const reopen = await p2.evaluate(() => ({ sale: document.getElementById('chatPanel').classList.contains('sale-mode'), auto: (document.querySelector('#chatBody .chat-sale-live .sc-auto') || {}).textContent || '' }));
      log('Đang chat với Sale thì mở lại vẫn ở chế độ Sale; xem album Sinh nhật -> lời chào đổi sang "Chụp ảnh sinh nhật"', reopen.sale && reopen.auto.includes('Chụp ảnh sinh nhật'));
      await ctx.close();
    }

    // ---------------- 9) Điện thoại ----------------
    const mCtx = await browser.createBrowserContext();
    const m = await newTab(mCtx, errors, { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await login(m, '0900000001', 'khach123', 'chat-sale');
    await waitFor(m, () => document.querySelectorAll('#chatBody .chat-sale-live .from-me .sc-bubble').length >= 3);
    const mob = await m.evaluate(() => {
      const comp = document.getElementById('chatInputForm').getBoundingClientRect();
      const panel = document.getElementById('chatPanel').getBoundingClientRect();
      const head = document.querySelector('#chatPanel .chat-header').getBoundingClientRect();
      return { overflow: document.documentElement.scrollWidth > window.innerWidth, composerInView: comp.bottom <= window.innerHeight && comp.top > 0,
        panelIn: panel.left >= 0 && panel.right <= window.innerWidth && head.top >= 0, focused: document.activeElement && document.activeElement.id };
    });
    log('[mobile] Khung chat nằm trọn màn hình, không tràn ngang, ô nhập trong màn hình, không tự bật bàn phím, thấy lịch sử từ máy khác',
      !mob.overflow && mob.composerInView && mob.panelIn && mob.focused !== 'chatInput');
    await m.screenshot({ path: shot('sale-chat-mobile.png') });
    await login(m, '0900000002', 'sale123');
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
