const fixture=require('./workflow-fixture');
// Test bật editSync THEO TRÌNH DUYỆT (?editSync=1 / ?editSync=0, localStorage "aloha_edit_sync",
// js/features.js), hồ sơ buổi chụp giả của KHÁCH THỬ NGHIỆM (js/chon-anh.js) và giao diện khi
// Thợ ảnh demo công khai bị server chặn. KHÔNG chụp ảnh, chỉ dữ liệu giả, kho RAM (MONGODB_URI='').
// Trang KHÔNG đặt sẵn window.ALOHA_FEATURES (khác các test cũ) để kiểm đúng mặc định thật.
// Mật khẩu tài khoản thử nghiệm sinh ngẫu nhiên mỗi lần chạy. Tự bật/tắt server cổng 3001.
// Tắt server local (npm start) trước khi chạy. Cần đã chạy `npm ci` trong server/.
//   node _screenshots/test-edit-sync-optin.js
const path = require('path');
const crypto = require('crypto');
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

// ---------------------------------------------------------------- Tài khoản thử nghiệm (giả, ngẫu nhiên)
const pwOf = () => crypto.randomBytes(9).toString('base64url');
function acc(phone, role, name) {
  const pw = pwOf();
  const salt = crypto.randomBytes(16).toString('hex');
  return { pw, entry: { phone, role, name, salt, hash: crypto.scryptSync(pw, salt, 64).toString('hex') } };
}
const K1 = acc('09000000103', 'khach-hang', 'Khách thử nghiệm 1');
const K2 = acc('09000000104', 'khach-hang', 'Khách thử nghiệm 2');
const THO = acc('09000000101', 'tho-anh', 'Thợ thử nghiệm');
const SEP = acc('09000000102', 'sep', 'Sếp thử nghiệm');

// ---------------------------------------------------------------- Server RAM (KHÔNG bật ngoại lệ demo công khai)
let server = null, serverLog = '';
async function portBusy() { try { await fetch(API + '/api/health', { signal: AbortSignal.timeout(1500) }); return true; } catch (e) { return false; } }
async function startServer() {
  await fixture.driveFixture();
  server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(ROOT, 'server'),
    env: { ...process.env, PORT: '3001', AUTH_SECRET: 'test-secret', MONGODB_URI: '', GEMINI_API_KEY: '', ALLOWED_ORIGINS: '',
      EDIT_REQUESTS_MONGODB_URI: '', EDIT_REQUESTS_ALLOW_PUBLIC_DEMO_STAFF: '',
      EDIT_DEMO_ACCOUNTS: JSON.stringify([K1.entry, K2.entry, THO.entry, SEP.entry]) },
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
const health = async () => (await (await fetch(API + '/api/edit-requests/health')).json());

(async () => {
  let browser = null;
  const errors = [];
  try {
    if (await portBusy()) throw new Error('Cổng 3001 đang có server khác chạy - tắt nó rồi chạy lại test.');
    await startServer();
    const worker=await fixture.login(API,THO.entry.phone,THO.pw),boss=await fixture.login(API,SEP.entry.phone,SEP.pw);
    const customer1=await fixture.login(API,K1.entry.phone,K1.pw),customer2=await fixture.login(API,K2.entry.phone,K2.pw);
    await fixture.sourceAlbum(API,{customer:customer1,worker,boss,code:'#ABTN0103'});
    await fixture.sourceAlbum(API,{customer:customer2,worker,boss,code:'#ABTN0104'});
    browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });

    // 1 "máy" = 1 ngữ cảnh ẩn danh (localStorage riêng). KHÔNG đặt window.ALOHA_FEATURES.
    async function machine() {
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      await page.setViewport({ width: 1440, height: 1000 });
      const m = { page, ctx, calls: [] };
      page.on('pageerror', (e) => errors.push(e.message));
      await page.evaluateOnNewDocument(() => {
        try { if (!sessionStorage.getItem('aloha_chat_ui')) sessionStorage.setItem('aloha_chat_ui', JSON.stringify({ dismissed: true })); } catch (e) { /* bỏ qua */ }
      });
      await page.setRequestInterception(true);
      page.on('request', async r=>{if(!await fixture.thumbnail(page,r)) await r.continue();});
      page.on('request', (r) => { if (r.url().includes('/api/edit-requests')) m.calls.push(r.method() + ' ' + r.url().replace(API, '')); });
      return m;
    }
    async function login(m, phone, pw, query = '') {
      await m.page.goto(ROOT_URL + 'login.html' + query, { waitUntil: 'networkidle0' });
      await m.page.type('#loginPhone', phone);
      await m.page.type('#loginPassword', pw);
      await Promise.all([m.page.waitForNavigation({ waitUntil: 'networkidle0' }), m.page.click('#loginSubmitBtn')]);
      await wait(800);
    }
    const state = (page) => page.evaluate(() => ({
      flag: !!(window.ALOHA_FEATURES && window.ALOHA_FEATURES.editSync),
      sync: !!(window.AlohaEditSync && window.AlohaEditSync.enabled()),
      key: localStorage.getItem('aloha_edit_sync')
    }));
    const orderInfo = (page) => page.$eval('#psOrderInfo', (el) => el.textContent.replace(/\s+/g, ' ').trim());
    const localDb = (page) => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('aloha_demo_db')) || {}; } catch (e) { return {}; } });

    // =============================================================== A. Mặc định BẬT; kiểm tra local bằng opt-out tường minh
    const plain = await machine();
    await plain.page.goto(ROOT_URL + 'index.html', {waitUntil:'networkidle0'});
    check('Default editSync ON', (await state(plain.page)).flag);
    await plain.page.goto(ROOT_URL + 'index.html?editSync=0', {waitUntil:'networkidle0'});
    for (const p of ['index.html', 'login.html', 'index.html#/chon-anh']) {
      await plain.page.goto(ROOT_URL + p, { waitUntil: 'networkidle0' });
      const st = await state(plain.page);
      check('A1 khách thường mở ' + p + ': editSync TẮT sau opt-out, key 0', !st.flag && !st.sync && st.key === '0', st);
    }
    await login(plain, '0900000001', 'khach123');
    let st = await state(plain.page);
    check('A2 khách demo không có ?editSync: vẫn TẮT sau đăng nhập', !st.sync && st.key === '0', st);
    check('A3 khách demo chưa có album: chờ thợ gửi ảnh gốc', /Chờ thợ gửi ảnh gốc/.test(await orderInfo(plain.page)), await orderInfo(plain.page));
    check('A4 không gọi /api/edit-requests lần nào khi TẮT', plain.calls.length === 0, plain.calls);
    await plain.page.goto(ROOT_URL + 'index.html?editSync=abc', { waitUntil: 'networkidle0' });
    st = await state(plain.page);
    check('A5 ?editSync=abc (giá trị lạ) không bật', !st.sync && st.key === '0', st);

    // =============================================================== B. Khách thử nghiệm 1 bật bằng ?editSync=1
    const k1 = await machine();
    await k1.page.goto(ROOT_URL + 'login.html?editSync=1', { waitUntil: 'networkidle0' });
    st = await state(k1.page);
    // login.html không nạp js/edit-sync.js -> chỉ kiểm cờ + key ở trang này
    check('B1 login.html?editSync=1: cờ bật + xóa lựa chọn tắt', st.flag && st.key === null, st);
    await login(k1, K1.entry.phone, K1.pw);
    st = await state(k1.page);
    check('B2 sau đăng nhập (địa chỉ không còn tham số) vẫn BẬT mặc định', st.sync && k1.page.url().includes('#/chon-anh') && !k1.page.url().includes('editSync'), [st, k1.page.url()]);
    const info1 = await orderInfo(k1.page);
    check('B3 khách thử nghiệm thấy album từ workflow (#ABTN0103), không dùng hồ sơ demo cũ', /#ABTN0103/.test(info1) && !/AB240915/.test(info1), info1);
    check('B4 có lưới ảnh để chọn', (await k1.page.$$('.ps-photo')).length > 0);
    let db = await localDb(k1.page);
    check('B5 hồ sơ giả KHÔNG ghi vào aloha_demo_db', !(db.customers || {})[K1.entry.phone], db.customers);
    await k1.page.waitForFunction(() => /^Gửi (ảnh|yêu cầu)/.test(document.getElementById('psSubmitBtn').textContent.trim()) && document.querySelectorAll('.ps-heart').length > 0, { timeout: 10000 });
    await k1.page.click('.ps-photo[data-id="drive-fixture-file-1"] .ps-heart');
    await k1.page.click('.ps-photo[data-id="drive-fixture-file-2"] .ps-heart');
    await k1.page.click('#psSubmitBtn');
    await k1.page.waitForFunction(() => document.querySelectorAll('.ps-sent-label').length===2 && document.getElementById('selectedCount').textContent==='0', {timeout:10000});
    const h1 = await health();
    check('B6 gửi yêu cầu qua server thành công (server có 1 yêu cầu và 2 album gốc)', h1.count === 3, h1);
    db = await localDb(k1.page);
    check('B7 yêu cầu KHÔNG ghi localStorage', !(db.editRequests || []).length, (db.editRequests || []).length);

    // Khách thử nghiệm 2: không thấy yêu cầu của khách 1
    const k2 = await machine();
    await login(k2, K2.entry.phone, K2.pw, '?editSync=1');
    await k2.page.waitForFunction(() => /^G/.test(document.getElementById('psSubmitBtn').textContent.trim()), {timeout:10000});
    const mine2 = await k2.page.evaluate(async () => (await window.AlohaEditSync.mine()).data.requests.length);
    check('B8 khách thử nghiệm 2 không thấy yêu cầu của khách 1 (GET /me = 0, nút gửi chưa khoá)', mine2 === 0, mine2);
    check('B9 khách thử nghiệm 2 thấy album riêng #ABTN0104', /#ABTN0104/.test(await orderInfo(k2.page)));
    const otherId = (await k1.page.evaluate(async () => (await window.AlohaEditSync.mine()).data.requests[0].id));
    const peek = await k2.page.evaluate(async (id) => { const r = await window.AlohaEditSync.get(id); return [r.ok, r.status || r.error]; }, otherId);
    check('B10 khách thử nghiệm 2 mở thẳng id yêu cầu của khách 1 -> bị từ chối (404)', peek[0] === false, peek);

    // Khách đăng ký thường (token không có scope) -> KHÔNG được hồ sơ giả
    const reg = await machine();
    const rr = await fetch(API + '/api/sale-chat/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '0911222333', name: 'Khách giả đăng ký', password: 'matkhau123' }) });
    check('B11 đăng ký khách giả thường (200)', rr.ok);
    await login(reg, '0911222333', 'matkhau123', '?editSync=1');
    await reg.page.goto(ROOT_URL + 'index.html#/chon-anh', { waitUntil: 'networkidle0' });
    await wait(500);
    check('B12 khách thường chưa có album: chờ thợ gửi ảnh gốc, không nhận hồ sơ giả', /Chờ thợ gửi ảnh gốc/.test(await orderInfo(reg.page)), await orderInfo(reg.page));
    // Sửa token trong localStorage thành có scope (không có chữ ký đúng) -> giao diện có thể hiện hồ sơ giả
    // nhưng server vẫn từ chối mọi lệnh gọi (chữ ký sai).
    const forged = await reg.page.evaluate(async () => {
      const s = JSON.parse(localStorage.getItem('aloha_auth'));
      const [body, sig] = s.token.split('.');
      const p = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((body.length + 3) % 4)));
      p.scope = 'edit-demo';
      s.token = btoa(JSON.stringify(p)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') + '.' + sig;
      localStorage.setItem('aloha_auth', JSON.stringify(s));
      return true;
    });
    await reg.page.reload({ waitUntil: 'networkidle0' });
    await wait(800);
    const forgedRes = await reg.page.evaluate(async () => { const r = await window.AlohaEditSync.mine(); return [r.ok, r.status || r.error]; });
    check('B13 tự sửa token thêm scope -> server từ chối (401), không đọc được gì', forged && forgedRes[0] === false && forgedRes[1] === 401, forgedRes);

    // =============================================================== Thợ ảnh / Sếp thử nghiệm thấy yêu cầu
    const tho = await machine();
    await login(tho, THO.entry.phone, THO.pw, '?editSync=1');
    await tho.page.waitForFunction(() => { document.querySelectorAll('.photo-row-more').forEach((b) => { if (!b.hidden && /Xem thêm/.test(b.textContent)) b.click(); }); return /ABTN0103/.test((document.getElementById('photoRows') || {}).textContent || ''); }, { timeout: 12000 }).catch(() => {});
    st = await state(tho.page);
    check('C1 Thợ thử nghiệm (crm/admin.html, bật bằng key) thấy yêu cầu #ABTN0103', st.sync && await tho.page.evaluate(() => /ABTN0103/.test(document.getElementById('photoRows').textContent)), st);
    const sep = await machine();
    await login(sep, SEP.entry.phone, SEP.pw, '?editSync=1');
    await sep.page.waitForFunction(() => { document.querySelectorAll('.photo-row-more').forEach((b) => { if (!b.hidden && /Xem thêm/.test(b.textContent)) b.click(); }); return /ABTN0103/.test((document.getElementById('photoRows') || {}).textContent || ''); }, { timeout: 12000 }).catch(() => {});
    check('C2 Sếp thử nghiệm thấy yêu cầu #ABTN0103', await sep.page.evaluate(() => /ABTN0103/.test(document.getElementById('photoRows').textContent)));

    // =============================================================== Thợ ảnh demo CÔNG KHAI bị server chặn
    const pub = await machine();
    await login(pub, '0900000003', 'anh123', '?editSync=1');
    await pub.page.waitForFunction(() => { const el = document.querySelector('.photo-sync-status'); return el && !el.hidden; }, { timeout: 12000 }).catch(() => {});
    const pubState = await pub.page.evaluate(() => {
      document.querySelectorAll('.photo-row-more').forEach((b) => { if (!b.hidden && /Xem thêm/.test(b.textContent)) b.click(); });
      const el = document.querySelector('.photo-sync-status');
      return { status: el && !el.hidden ? el.textContent : '', shows: /ABTN0103/.test(document.getElementById('photoRows').textContent) };
    });
    check('C3 Thợ ảnh demo công khai bật editSync: báo không có quyền, KHÔNG thấy yêu cầu thử nghiệm', /không có quyền/.test(pubState.status) && !pubState.shows, pubState);

    // =============================================================== ?editSync=0 tắt lại
    await k1.page.goto(ROOT_URL + 'index.html?editSync=0#/chon-anh', { waitUntil: 'networkidle0' });
    st = await state(k1.page);
    check('D1 ?editSync=0: ghi key 0, TẮT', !st.sync && st.key === '0', st);
    await k1.page.goto(ROOT_URL + 'index.html#/chon-anh', { waitUntil: 'networkidle0' });
    st = await state(k1.page);
    check('D2 mở lại không tham số: vẫn TẮT', !st.sync && st.key === '0', st);
    st = await state(tho.page);
    check('D3 máy khác (Thợ thử nghiệm) không bị ảnh hưởng: vẫn BẬT', st.sync && st.key === null, st);

    check('E1 không có lỗi JavaScript trên trang', errors.length === 0, errors);
  } catch (e) {
    fail++;
    console.log('✗ LỖI:', e.message);
  } finally {
    if (browser) await browser.close().catch(() => {});
    stopServer();
  }
  const secrets = [K1.pw, K2.pw, THO.pw, SEP.pw];
  check('E2 log server không chứa mật khẩu thử nghiệm', !secrets.some((x) => serverLog.includes(x)));
  console.log('\n' + pass + '/' + (pass + fail) + ' PASS');
  process.exit(fail ? 1 : 0);
})();
