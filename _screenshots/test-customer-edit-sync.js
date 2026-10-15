// Test tích hợp phía KHÁCH với AlohaEditSync (js/chon-anh.js + js/script.js) - KHÔNG chụp ảnh,
// chỉ dữ liệu giả. Tự bật server/server.js ở cổng 3001 với kho RAM (MONGODB_URI='', không nối
// MongoDB Atlas), tự tắt khi xong kể cả khi lỗi. Mỗi "máy" là 1 ngữ cảnh trình duyệt ẩn danh riêng
// (localStorage riêng). Tắt server local (npm start) trước khi chạy. Cần đã chạy `npm ci` trong server/.
//   node _screenshots/test-customer-edit-sync.js
const path = require('path');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');
const { CHROME_PATH, ROOT_URL } = require('./test-env');

const ROOT = path.resolve(__dirname, '..');
const API = 'http://localhost:3001';
let pass = 0, fail = 0;
const check = (name, ok, extra) => {
  if (ok) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '→ ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''); }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const MARK_ORIG = 'goc-NOIBO-khong-cho-khach';
const LINK_EDIT = 'https://drive.google.com/drive/folders/test-anh-da-chinh';
const LINK_ORIG = 'https://drive.google.com/drive/folders/' + MARK_ORIG;

// ---------------------------------------------------------------- Server RAM
let server = null, serverLog = '';
async function portBusy() { try { await fetch(API + '/api/health', { signal: AbortSignal.timeout(1500) }); return true; } catch (e) { return false; } }
async function startServer() {
  server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(ROOT, 'server'),
    env: { ...process.env, PORT: '3001', AUTH_SECRET: 'test-secret', MONGODB_URI: '', GEMINI_API_KEY: '', ALLOWED_ORIGINS: '',
      // Test này dùng Thợ ảnh/Sếp demo công khai -> bật ngoại lệ CHỈ DÀNH CHO TEST (mặc định server chặn họ)
      EDIT_REQUESTS_ALLOW_PUBLIC_DEMO_STAFF: '1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', (d) => { serverLog += d; });
  server.stderr.on('data', (d) => { serverLog += d; });
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(API + '/api/health')).ok) return; } catch (e) { /* chưa lên */ }
    await wait(150);
  }
  throw new Error('Không bật được server test ở cổng 3001');
}
function stopServer() { if (server) { server.kill(); server = null; } }
process.on('exit', stopServer);
process.on('SIGINT', () => { stopServer(); process.exit(1); });

async function apiLogin(phone, password) {
  return (await (await fetch(API + '/api/sale-chat/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, password }) })).json()).token;
}
async function api(p, token, body) {
  const r = await fetch(API + '/api/edit-requests' + p, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined });
  return [r.status, await r.json().catch(() => null)];
}

(async () => {
  let browser = null;
  const errors = [];
  try {
    if (await portBusy()) throw new Error('Cổng 3001 đang có server khác chạy (có thể nối MongoDB thật) - tắt nó rồi chạy lại test.');
    await startServer();
    const tho = await apiLogin('0900000003', 'anh123');
    browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });

    // 1 "máy" = 1 ngữ cảnh ẩn danh. sync = bật cờ editSync. Ghi lại mọi request/response tới
    // /api/edit-requests. intercept.mode: null | 'abort-post' | '401-post' | 'abort-me' (giả lập lỗi)
    async function machine(sync) {
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      await page.setViewport({ width: 1440, height: 1200 });
      const m = { page, ctx, calls: [], bodies: [], responses: [], intercept: { mode: null } };
      page.on('pageerror', (e) => errors.push(e.message));
      await page.evaluateOnNewDocument((s) => {
        window.ALOHA_FEATURES = { booking: true, aiChat: true, albumPages: true, editSync: s };
        try { if (!sessionStorage.getItem('aloha_chat_ui')) sessionStorage.setItem('aloha_chat_ui', JSON.stringify({ dismissed: true })); } catch (e) { /* bỏ qua */ }
      }, sync);
      await page.setRequestInterception(true);
      const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
      page.on('request', (r) => {
        const url = r.url();
        if (url.includes('/api/edit-requests')) {
          m.calls.push(r.method() + ' ' + url.replace(API, ''));
          if (r.method() === 'POST' && /\/api\/edit-requests\/$/.test(url)) m.bodies.push(r.postData());
          const mode = m.intercept.mode;
          const isMe = /\/api\/edit-requests\/me$/.test(url);
          if (r.method() === 'OPTIONS' && mode && mode !== 'abort-post' && mode !== 'abort-me') return r.respond({ status: 204, headers: CORS });
          if (mode === 'abort-post' && r.method() === 'POST') return r.abort();
          if (mode === 'abort-me' && isMe) return r.abort();
          if (mode === '401-post' && r.method() === 'POST') return r.respond({ status: 401, headers: { ...CORS, 'content-type': 'application/json' }, body: '{"error":"unauthorized"}' });
        }
        r.continue();
      });
      page.on('response', async (res) => {
        if (!res.url().includes('/api/edit-requests') || res.request().method() === 'OPTIONS') return;
        try { m.responses.push(await res.text()); } catch (e) { /* bỏ qua */ }
      });
      return m;
    }
    async function loginCustomer(m, phone = '0900000001', pw = 'khach123') {
      await m.page.goto(ROOT_URL + 'login.html', { waitUntil: 'networkidle0' });
      await m.page.type('#loginPhone', phone);
      await m.page.type('#loginPassword', pw);
      await Promise.all([m.page.waitForNavigation({ waitUntil: 'networkidle0' }), m.page.click('#loginSubmitBtn')]);
      await wait(600);
    }
    async function noteInLightbox(page, id, text) {
      await page.evaluate((i) => document.querySelector(`.ps-photo[data-id="${i}"] img`).click(), id);
      await page.waitForFunction(() => !document.getElementById('psLbNoteWrap').hidden, { timeout: 3000 });
      await wait(300);
      await page.type('#psLbNote', text);
      await page.keyboard.press('Escape');
      await wait(200);
    }
    const localReqs = (page) => page.evaluate(() => { try { return (JSON.parse(localStorage.getItem('aloha_demo_db')) || {}).editRequests || []; } catch (e) { return []; } });
    const btn = (page) => page.$eval('#psSubmitBtn', (b) => ({ text: b.textContent.trim(), disabled: b.disabled }));
    const bannerText = (page) => page.$eval('#psSubmittedBanner', (b) => (b.classList.contains('show') ? b.textContent.replace(/\s+/g, ' ').trim() : ''));
    const serverCount = async () => (await (await fetch(API + '/api/edit-requests/health')).json()).count;

    // =============================================================== 1. Cờ TẮT: luồng cũ
    const w = await machine(false);
    await loginCustomer(w);
    check('Cờ tắt: đăng nhập vào "Ảnh của tôi", AlohaEditSync tắt', await w.page.evaluate(() => location.hash === '#/chon-anh' && window.AlohaEditSync.enabled() === false));
    await w.page.click('.ps-photo[data-id="ph-1"] .ps-heart');
    await w.page.click('.ps-photo[data-id="ph-2"] .ps-heart');
    await noteInLightbox(w.page, 'ph-1', 'Ghi chu rieng anh 1');
    await w.page.click('.ps-tab[data-filter="liked"]');
    await w.page.type('#psNote', 'Ghi chu chung luong cu');
    await w.page.click('#psSubmitBtn');
    await wait(400);
    let lr = await localReqs(w.page);
    check('Cờ tắt: yêu cầu lưu localStorage như cũ (2 ảnh, ghi chú riêng + chung)', lr.length === 1 && lr[0].photos.length === 2 && lr[0].photoNotes.length === 1 && lr[0].note === 'Ghi chu chung luong cu', lr.length);
    check('Cờ tắt: banner "đã gửi" + nút khoá như cũ', /Đã gửi yêu cầu chỉnh sửa/.test(await bannerText(w.page)) && (await btn(w.page)).text === 'Đã gửi yêu cầu');
    check('Cờ tắt: KHÔNG gọi /api/edit-requests lần nào', w.calls.length === 0, w.calls);
    check('Cờ tắt: server không nhận yêu cầu nào', (await serverCount()) === 0);
    await w.ctx.close();

    // =============================================================== 2. Cờ BẬT, máy X: lỗi trước, gửi thành công sau
    const x = await machine(true);
    await loginCustomer(x);
    await x.page.waitForFunction(() => document.getElementById('psSubmitBtn').textContent.trim() === 'Gửi yêu cầu chỉnh sửa', { timeout: 8000 });
    check('Cờ bật: mở trang gọi GET /me trước, có token server', x.calls.some((c) => c.startsWith('GET /api/edit-requests/me')), x.calls);
    await x.page.click('.ps-photo[data-id="ph-1"] .ps-heart');
    await x.page.click('.ps-photo[data-id="ph-3"] .ps-heart');
    await noteInLightbox(x.page, 'ph-1', 'Xoa vet do tren ma');
    await noteInLightbox(x.page, 'ph-3', 'Lam sang vung mat');
    await x.page.click('.ps-tab[data-filter="liked"]');
    await x.page.type('#psNote', 'Giu tong mau am');

    // 2a. Mất mạng khi gửi
    x.intercept.mode = 'abort-post';
    await x.page.click('#psSubmitBtn');
    await x.page.waitForFunction(() => /CHƯA được gửi/.test(document.getElementById('psSubmittedBanner').textContent), { timeout: 8000 });
    let b = await btn(x.page);
    let st = await x.page.evaluate(() => ({ sel: document.querySelectorAll('.ps-photo.selected').length, hearts: [...document.querySelectorAll('.ps-heart')].every((h) => !h.disabled), note: document.getElementById('psNote').value }));
    check('Mất mạng: báo "CHƯA được gửi", không báo thành công', /CHƯA được gửi/.test(await bannerText(x.page)) && !/Đã gửi yêu cầu chỉnh sửa cho/.test(await bannerText(x.page)), await bannerText(x.page));
    check('Mất mạng: nút gửi mở lại, ảnh đã chọn + ghi chú giữ nguyên, lưới không bị khoá', !b.disabled && b.text === 'Gửi yêu cầu chỉnh sửa' && st.sel === 2 && st.hearts && st.note === 'Giu tong mau am', { b, st });
    check('Mất mạng: KHÔNG ghi yêu cầu vào localStorage', (await localReqs(x.page)).length === 0);
    check('Mất mạng: server không có yêu cầu nào', (await serverCount()) === 0);

    // 2b. 401 khi gửi
    x.intercept.mode = '401-post';
    await x.page.click('#psSubmitBtn');
    await x.page.waitForFunction(() => /đăng nhập lại/i.test(document.getElementById('psSubmittedBanner').textContent), { timeout: 8000 });
    check('401: báo phiên hết hạn / đăng nhập lại, không báo đã gửi', /đăng nhập lại/i.test(await bannerText(x.page)) && /CHƯA được gửi/.test(await bannerText(x.page)));
    check('401: vẫn không ghi localStorage', (await localReqs(x.page)).length === 0);

    // 2c. Kết nối lại -> gửi thành công
    x.intercept.mode = null;
    x.bodies.length = 0;
    await x.page.click('#psSubmitBtn');
    await x.page.waitForFunction(() => document.getElementById('psSubmitBtn').textContent.trim() === 'Đã gửi yêu cầu', { timeout: 8000 });
    check('Server xác nhận -> mới báo "đã gửi" + khoá lưới', /Đã gửi yêu cầu chỉnh sửa/.test(await bannerText(x.page)) && await x.page.evaluate(() => [...document.querySelectorAll('.ps-heart')].every((h) => h.disabled)));
    const sent = JSON.parse(x.bodies[0] || '{}');
    check('POST / gửi đúng cấu trúc: 2 ảnh có ghi chú riêng, ghi chú chung, mã đơn, phí 0', JSON.stringify(sent.photos.map((p) => [p.id, p.note, p.isExtra])) === JSON.stringify([['ph-1', 'Xoa vet do tren ma', false], ['ph-3', 'Lam sang vung mat', false]]) && sent.note === 'Giu tong mau am' && sent.orderCode === '#AB240915' && sent.extraFee === 0, sent);
    check('POST / không gửi phone / customerName / from (server lấy từ token)', !('phone' in sent) && !('customerName' in sent) && !('from' in sent));
    check('Thành công vẫn KHÔNG ghi localStorage (chỉ server lưu)', (await localReqs(x.page)).length === 0);
    let [s, d] = await api('/', tho);
    const reqA = d.requests[0];
    check('Server lưu đúng 1 yêu cầu của 0900000001, 2 ghi chú riêng', s === 200 && d.requests.length === 1 && reqA.phone === '0900000001' && reqA.photoNotes.length === 2, d.requests.length);

    // =============================================================== 3. Máy Y (khác máy X): thấy yêu cầu đã gửi
    const y = await machine(true);
    await loginCustomer(y);
    await y.page.waitForFunction(() => document.getElementById('psSubmitBtn').textContent.trim() === 'Đã gửi yêu cầu', { timeout: 8000 });
    st = await y.page.evaluate(() => ({ sel: [...document.querySelectorAll('.ps-photo.selected')].map((c) => c.dataset.id).join(','), locked: [...document.querySelectorAll('.ps-heart')].every((h) => h.disabled), note: document.getElementById('psNote').value, banner: document.getElementById('psSubmittedBanner').textContent }));
    check('Máy Y (localStorage khác): khôi phục từ server đúng 2 ảnh đã gửi, ghi chú chung, lưới khoá', st.sel === 'ph-1,ph-3' && st.locked && st.note === 'Giu tong mau am' && /Bạn đã gửi 2 ảnh/.test(st.banner), st);
    check('Máy Y: không có yêu cầu nào trong localStorage của máy này', (await localReqs(y.page)).length === 0);

    // Tin nhắn qua server
    await y.page.click('.ps-tab[data-filter="edited"]');
    await wait(300);
    await y.page.type('#psChatInput', 'Cho minh hoi bao gio xong a?');
    await y.page.keyboard.press('Enter');
    await y.page.waitForFunction(() => document.getElementById('psChatInput').value === '', { timeout: 8000 });
    [s, d] = await api('/' + reqA.id, tho);
    const msgs = d.request.messages;
    check('Tin nhắn khách lưu trên server (from customer), ô nhập được xoá', msgs.length === 1 && msgs[0].from === 'customer' && msgs[0].text === 'Cho minh hoi bao gio xong a?', msgs);
    await wait(1500);
    [s, d] = await api('/' + reqA.id, tho);
    check('Chế độ đồng bộ: không tự sinh tin trợ lý "ai" (không bịa trả lời)', !d.request.messages.some((mm) => mm.from === 'ai'), d.request.messages.map((mm) => mm.from));
    check('Không gửi lời gọi /api/edit-chat ở chế độ đồng bộ', !y.calls.some((c) => c.includes('edit-chat')));

    // Gửi tin lỗi -> giữ chữ đã gõ, báo lỗi
    y.intercept.mode = 'abort-post';
    await y.page.type('#psChatInput', 'Tin nay se loi');
    await y.page.keyboard.press('Enter');
    await y.page.waitForFunction(() => { const e = document.querySelector('.ps-sync-status'); return e && !e.hidden; }, { timeout: 8000 });
    check('Gửi tin lỗi: giữ nguyên chữ đã gõ + hiện báo lỗi', (await y.page.$eval('#psChatInput', (i) => i.value)) === 'Tin nay se loi' && /Tin nhắn CHƯA được gửi/.test(await y.page.$eval('.ps-sync-status', (e) => e.textContent)));
    [s, d] = await api('/' + reqA.id, tho);
    check('Gửi tin lỗi: server không có tin đó, localStorage cũng không', d.request.messages.length === 1 && (await localReqs(y.page)).length === 0);
    y.intercept.mode = null;
    await y.page.$eval('#psChatInput', (i) => { i.value = ''; });

    // Thợ ảnh (API) gửi link gốc + link đã chỉnh + trả lời -> máy Y tự cập nhật
    [s, d] = await api('/' + reqA.id + '/links', tho, { resultLink: LINK_EDIT, resultLinkOriginal: LINK_ORIG, rev: d.request.rev });
    check('Thợ ảnh lưu 2 link qua API', s === 200, d);
    await api('/' + reqA.id + '/messages', tho, { text: 'Tho da gui link roi nhe' });
    await y.page.waitForFunction((l) => { const a = document.getElementById('psResultLink'); return a && a.href === l; }, { timeout: 10000 }, LINK_EDIT);
    check('Máy Y tự hiện link ảnh đã chỉnh (vòng hỏi server)', true);
    await y.page.waitForFunction(() => [...document.querySelectorAll('#psChatList .ps-msg.from-staff p')].some((p) => p.textContent.includes('Tho da gui link')), { timeout: 10000 });
    check('Máy Y tự hiện tin trả lời của thợ', true);
    const html = await y.page.content();
    check('Trang khách KHÔNG chứa link ảnh gốc', !html.includes(MARK_ORIG));
    check('Mọi phản hồi /api/edit-requests gửi cho khách KHÔNG chứa link ảnh gốc', y.responses.length > 0 && y.responses.every((t) => !t.includes(MARK_ORIG) && !t.includes('resultLinkOriginal')), y.responses.length);
    [s, d] = await api('/' + reqA.id, tho);
    check('Đã xem tab Ảnh đã chỉnh -> lưu "đã xem" lên server (customerSeenEditedSig)', /test-anh-da-chinh/.test(d.request.customerSeenEditedSig || ''), d.request.customerSeenEditedSig);

    // Hoàn tất -> chuông thông báo
    [s, d] = await api('/' + reqA.id + '/complete', tho, { rev: d.request.rev });
    check('Thợ ảnh Hoàn tất qua API', s === 200 && d.request.status === 'Hoàn thành');
    await wait(5500); // chuông hỏi lại 5 giây/lần
    await y.page.click('#notifBtn');
    await y.page.waitForFunction(() => /Ảnh đã sửa xong/.test(document.getElementById('notifList').textContent), { timeout: 8000 }).catch(() => {});
    check('Chuông: hiện "Ảnh đã sửa xong" từ server', /Ảnh đã sửa xong/.test(await y.page.$eval('#notifList', (e) => e.textContent)));
    await wait(800);
    [s, d] = await api('/' + reqA.id, tho);
    check('Mở chuông -> server lưu customerSeenDone', d.request.customerSeenDone === true);

    // =============================================================== 4. Khách khác không đọc được yêu cầu của A
    const reg = await (await fetch(API + '/api/sale-chat/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '0911111111', name: 'Khach gia B', password: 'matkhau123' }) })).json();
    const z = await machine(true);
    await loginCustomer(z, '0911111111', 'matkhau123');
    const other = await z.page.evaluate(async (id) => {
      const mine = await window.AlohaEditSync.mine();
      const one = await window.AlohaEditSync.get(id);
      return { mineN: mine.ok ? mine.data.requests.length : -1, err: one.error };
    }, reqA.id);
    check('Khách B (đã đăng ký giả): mine() = 0 yêu cầu, get(yêu cầu của A) = not_found', reg.token && other.mineN === 0 && other.err === 'not_found', other);
    check('Khách B không có hồ sơ buổi chụp -> trang "Ảnh của tôi" không hiện ảnh (như cũ)', await z.page.evaluate(() => !document.getElementById('psEmptyState').hidden));

    // =============================================================== 5. Lỗi khi tải trang rồi tự phục hồi
    const v = await machine(true);
    v.intercept.mode = 'abort-me';
    await loginCustomer(v);
    await v.page.waitForFunction(() => document.getElementById('psSubmitBtn').textContent.trim() === 'Chưa kết nối được máy chủ', { timeout: 8000 });
    b = await btn(v.page);
    check('Không tải được dữ liệu: khoá nút gửi + báo lỗi, không đoán theo localStorage', b.disabled && /CHƯA được gửi/.test(await bannerText(v.page)), b);
    v.intercept.mode = null;
    await v.page.waitForFunction(() => document.getElementById('psSubmitBtn').textContent.trim() === 'Đã gửi yêu cầu', { timeout: 10000 });
    check('Kết nối lại: tự khôi phục trạng thái "đã gửi" từ server, bỏ banner lỗi', !/CHƯA được gửi/.test(await bannerText(v.page)) && /Bạn đã gửi 2 ảnh/.test(await bannerText(v.page)));

    check('Không có lỗi JS trên các trang', errors.length === 0, errors);
    check('Server test chỉ dùng kho RAM', (await (await fetch(API + '/api/health')).json()).chatStore === 'memory');
  } catch (e) {
    fail++;
    console.log('✗ Lỗi khi chạy test:', e.message);
    if (serverLog) console.log('--- log server ---\n' + serverLog.slice(-1500));
  } finally {
    if (browser) await browser.close().catch(() => {});
    stopServer();
  }
  console.log(`\n${pass}/${pass + fail} PASS`);
  process.exit(fail ? 1 : 0);
})();
