const { CHROME_PATH, ROOT_URL, ROOT, shot } = require('./test-env');
// Test đăng nhập bằng Google (2026-09-27): nút Google trên login.html, lần đầu bắt nhập SĐT
// một lần, lần sau vào thẳng; SĐT đã có tài khoản không gắn Google được (chống chiếm tài khoản).
//
// Không đăng nhập Google thật được trong test -> giả lập 2 thứ:
// - Máy chủ kiểm tra token của Google (tokeninfo): server/sale-chat.js đọc GOOGLE_TOKENINFO_URL,
//   test trỏ nó về máy chủ giả ở cổng 3009. "Token" giả = JSON thông tin tài khoản mã hoá base64url.
// - Thư viện nút Google (accounts.google.com/gsi/client): chặn request, trả về script giả vẽ 1 nút,
//   bấm nút là gọi callback với token giả đặt sẵn trong window.__nextCred.
// Phần gọi Google thật chỉ kiểm chứng được trên bản public sau khi đặt GOOGLE_CLIENT_ID.
//
// Test tự bật server/server.js ở cổng 3001 (lưu trong bộ nhớ) - tắt npm start của bạn trước.
// Chạy: node _screenshots/test-google-login.js
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const results = [];
const log = (name, ok, extra) => { results.push({ name, ok }); console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name + (extra ? ' (' + extra + ')' : '')); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const LOGIN = ROOT_URL + 'login.html';
const API = 'http://localhost:3001';
const CLIENT_ID = 'test-client.apps.googleusercontent.com';

const cred = (claims) => Buffer.from(JSON.stringify({ aud: CLIENT_ID, iss: 'https://accounts.google.com', ...claims })).toString('base64url');

// ---------------------------------------------------------------- Máy chủ Google giả + server test
const fakeGoogle = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  try {
    const claims = JSON.parse(Buffer.from(u.searchParams.get('id_token') || '', 'base64url').toString('utf8'));
    if (claims.invalid) throw new Error('invalid');
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(claims));
  } catch (e) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end('{"error":"invalid_token"}');
  }
});
let server = null;
async function startServer() {
  await new Promise((r) => fakeGoogle.listen(3009, r));
  server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(ROOT, 'server'),
    env: { ...process.env, PORT: '3001', AUTH_SECRET: 'test-secret', MONGODB_URI: '', ALLOWED_ORIGINS: '',
      GOOGLE_CLIENT_ID: CLIENT_ID, GOOGLE_TOKENINFO_URL: 'http://localhost:3009/tokeninfo' },
    stdio: 'ignore'
  });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(API + '/api/health')).ok) return; } catch (e) { /* chưa lên */ }
    await wait(150);
  }
  throw new Error('Không bật được server test ở cổng 3001');
}
function stopServer() { if (server) { server.kill(); server = null; } fakeGoogle.close(); }
async function api(p, o = {}) {
  const r = await fetch(API + '/api/sale-chat' + p, { method: o.m || 'GET', headers: { 'content-type': 'application/json', ...(o.t ? { authorization: 'Bearer ' + o.t } : {}) }, body: o.b ? JSON.stringify(o.b) : undefined });
  return [r.status, await r.json().catch(() => null)];
}

// ---------------------------------------------------------------- Thư viện nút Google giả
const FAKE_GIS = `window.google = { accounts: { id: {
  initialize: function (o) { window.__gis = o; },
  renderButton: function (el, opts) {
    el.innerHTML = '<button type="button" id="fakeGoogle" data-text="' + opts.text + '" style="height:40px;width:' + opts.width + 'px;border:1px solid #dadce0;border-radius:20px;background:#fff;font:500 14px Arial">G  ' + (opts.text === 'signup_with' ? 'Đăng ký bằng Google' : 'Đăng nhập bằng Google') + '</button>';
    el.firstChild.onclick = function () { window.__gis.callback({ credential: window.__nextCred }); };
  }
} } };`;
async function newTab(ctx, errors, viewport, blockConfig) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setViewport(viewport || { width: 1280, height: 900 });
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.url().startsWith('https://accounts.google.com/gsi/client')) return req.respond({ status: 200, contentType: 'text/javascript', body: FAKE_GIS });
    if (blockConfig && req.url().includes('/auth/config')) return req.abort();
    req.continue();
  });
  return page;
}
const loginState = (page) => page.evaluate(() => {
  const vis = (id) => { const el = document.getElementById(id); return !!el && !el.hidden && el.getClientRects().length > 0; };
  const btn = document.getElementById('fakeGoogle');
  return {
    social: vis('socialBox'), form: vis('loginForm'), gForm: vis('googleForm'), demo: vis('loginDemoBox'), sw: vis('loginModeSwitch'),
    btnText: btn ? btn.dataset.text : '', title: document.getElementById('loginTitle').textContent,
    email: document.getElementById('googleEmail').textContent, name: document.getElementById('googleName').value,
    focused: document.activeElement && document.activeElement.id,
    error: document.getElementById('loginError').classList.contains('show') ? document.getElementById('loginError').textContent : ''
  };
});
async function openLogin(page, qs) {
  await page.goto(LOGIN + (qs || ''), { waitUntil: 'networkidle0' });
  await page.waitForSelector('#fakeGoogle', { timeout: 8000 }).catch(() => {});
}
async function clickGoogle(page, claims) {
  await page.evaluate((c) => { window.__nextCred = c; }, cred(claims));
  await page.click('#fakeGoogle');
}
const session = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('aloha_auth') || 'null'));

(async () => {
  await startServer();
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const USER = { sub: 'g-111', email: 'me.test@gmail.com', name: 'Nguyễn Thị Test' };
  try {
    // ---------------- 1) Server bật Google -> trang hiện nút
    const [cs, cfg] = await api('/auth/config');
    log('Server trả Client ID cho trang (/auth/config)', cs === 200 && cfg.googleClientId === CLIENT_ID);

    const ctx = await browser.createBrowserContext();
    const page = await newTab(ctx, errors);
    await openLogin(page);
    let st = await loginState(page);
    log('Trang đăng nhập hiện "hoặc" + nút "Đăng nhập bằng Google"', st.social && st.form && st.btnText === 'signin_with');
    await page.screenshot({ path: shot('google-1-login-desktop.png') });
    await page.click('#switchToRegister');
    st = await loginState(page);
    log('Chuyển sang Đăng ký -> nút đổi thành "Đăng ký bằng Google"', st.social && st.btnText === 'signup_with');
    await page.click('#switchToLogin');

    // Server không trả cấu hình (tắt/ngủ/chưa đặt GOOGLE_CLIENT_ID) -> không hiện nút, form thường vẫn dùng
    const ctxB = await browser.createBrowserContext();
    const pageB = await newTab(ctxB, errors, null, true);
    await pageB.goto(LOGIN, { waitUntil: 'networkidle0' });
    await wait(300);
    const stB = await loginState(pageB);
    log('Không lấy được cấu hình -> ẩn khối Google, form SĐT + mật khẩu vẫn còn', !stB.social && stB.form && !stB.btnText);
    await ctxB.close();

    // ---------------- 2) Lần đầu Google -> bắt nhập SĐT
    await clickGoogle(page, USER);
    await page.waitForFunction(() => !document.getElementById('googleForm').hidden, { timeout: 8000 });
    st = await loginState(page);
    log('Lần đầu bấm Google -> bước "Hoàn tất đăng ký": hiện email, điền sẵn tên, con trỏ ở ô SĐT',
      st.gForm && !st.form && !st.social && !st.demo && !st.sw && st.title === 'Hoàn tất đăng ký' &&
      st.email === USER.email && st.name === USER.name && st.focused === 'googlePhone', JSON.stringify({ t: st.title, f: st.focused }));
    await page.screenshot({ path: shot('google-2-phone-step-desktop.png') });

    await page.type('#googlePhone', '0900000001');
    await page.click('#googleSubmitBtn');
    await page.waitForFunction(() => document.getElementById('loginError').classList.contains('show'), { timeout: 8000 });
    st = await loginState(page);
    log('Nhập SĐT đã có tài khoản (tài khoản demo) -> báo đã có tài khoản, không vào', st.error.includes('đã có tài khoản') && st.gForm);

    await page.$eval('#googlePhone', (el) => { el.value = ''; });
    await page.type('#googlePhone', '12345');
    await page.click('#googleSubmitBtn');
    await wait(500);
    st = await loginState(page);
    log('Nhập SĐT sai định dạng -> báo lỗi rõ ràng', st.error.includes('Số điện thoại chưa đúng'), st.error);

    await page.$eval('#googlePhone', (el) => { el.value = ''; });
    await page.type('#googlePhone', '0912 345 678');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('#googleSubmitBtn')]);
    let s = await session(page);
    log('Nhập SĐT mới -> đăng nhập khách, vào màn chat Sale (Đặt lịch đang tắt)',
      s && s.role === 'khach-hang' && s.phone === '0912345678' && s.name === USER.name && s.token && page.url().endsWith('index.html#/chat-sale'), page.url().split('/').pop());
    await page.waitForSelector('#scThread .sc-chip', { timeout: 12000 }).catch(() => {});
    const chatOk = await page.evaluate(() => { const st = document.getElementById('scStatus'); return !document.getElementById('view-chat').hidden && !(st && !st.hidden) && !document.getElementById('scInput').disabled; });
    log('Màn chat kết nối server bình thường với tài khoản Google', chatOk);
    await page.type('#scInput', 'Chào shop, mình đăng ký bằng Google');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('#scThread .from-me .sc-bubble:not(.sc-sending)').length === 1, { timeout: 8000 }).catch(() => {});
    const [, saleLogin] = await api('/auth/login', { m: 'POST', b: { phone: '0900000002', password: 'sale123' } });
    const [, inbox] = await api('/inbox', { t: saleLogin.token });
    const item = inbox.chats.find((c) => c.phone === '0912345678');
    log('Tin khách Google gửi tới hộp thư Sale, đúng tên + SĐT', !!item && item.customerName === USER.name && item.last.text.includes('Google'));

    // ---------------- 3) Lần sau: bấm Google là vào thẳng
    await page.evaluate(() => localStorage.removeItem('aloha_auth'));
    await openLogin(page, '?next=chat-sale%2Fbau');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), clickGoogle(page, USER)]);
    s = await session(page);
    log('Lần sau bấm Google -> vào thẳng (không hỏi SĐT), tôn trọng next',
      s && s.phone === '0912345678' && s.token && page.url().endsWith('index.html#/chat-sale/bau'), page.url().split('/').pop());

    // Tài khoản Google không có mật khẩu -> đăng nhập bằng SĐT báo dùng Google
    await page.evaluate(() => localStorage.removeItem('aloha_auth'));
    await openLogin(page);
    await page.type('#loginPhone', '0912345678');
    await page.type('#loginPassword', 'baygio123');
    await page.click('#loginSubmitBtn');
    await page.waitForFunction(() => document.getElementById('loginError').classList.contains('show'), { timeout: 8000 });
    st = await loginState(page);
    log('Đăng nhập SĐT + mật khẩu vào tài khoản Google -> nhắc bấm nút Google', st.error.includes('đăng ký bằng Google'), st.error);

    // "Dùng cách khác" quay về form thường
    await page.$eval('#loginPhone', (el) => { el.value = ''; });
    await clickGoogle(page, { sub: 'g-cancel', email: 'khac@gmail.com', name: '' });
    await page.waitForFunction(() => !document.getElementById('googleForm').hidden, { timeout: 8000 });
    const noName = await loginState(page);
    await page.click('#googleCancel');
    st = await loginState(page);
    log('Google không có tên -> con trỏ ở ô Họ tên; "Dùng cách khác" quay lại form thường + nút Google',
      noName.focused === 'googleName' && !st.gForm && st.form && st.social && st.demo && st.title === 'Đăng nhập ALOHA Baby');

    // ---------------- 4) Mobile
    const m = await newTab(await browser.createBrowserContext(), errors, { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await openLogin(m);
    const mOverflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    await m.screenshot({ path: shot('google-3-login-mobile.png'), fullPage: true });
    await clickGoogle(m, { sub: 'g-mobile', email: 'mobile.user.with.a.long.email@gmail.com', name: 'Trần Mobile' });
    await m.waitForFunction(() => !document.getElementById('googleForm').hidden, { timeout: 8000 });
    const mOverflow2 = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    await m.screenshot({ path: shot('google-4-phone-step-mobile.png'), fullPage: true });
    log('Mobile 390px: nút Google + bước nhập SĐT không tràn ngang', !mOverflow && !mOverflow2);

    // ---------------- 5) Bảo mật ở server
    const [a1] = await api('/auth/google', { m: 'POST', b: { credential: cred({ sub: 'g-x', aud: 'web-khac.apps.googleusercontent.com' }) } });
    const [a2] = await api('/auth/google', { m: 'POST', b: { credential: cred({ sub: 'g-x', invalid: true }) } });
    const [a3] = await api('/auth/google', { m: 'POST', b: { credential: cred({ sub: 'g-x', iss: 'https://gia-mao.com' }) } });
    log('Token Google cấp cho web khác / không hợp lệ / sai nơi cấp -> từ chối (401)', a1 === 401 && a2 === 401 && a3 === 401, [a1, a2, a3].join());

    const [, reg] = await api('/auth/register', { m: 'POST', b: { name: 'Chủ thật', phone: '0977777777', password: 'matkhau1' } });
    const [, g2] = await api('/auth/google', { m: 'POST', b: { credential: cred({ sub: 'g-ke-gian', email: 'x@gmail.com', name: 'Kẻ gian' }) } });
    const [c1] = await api('/auth/google/complete', { m: 'POST', b: { ticket: g2.ticket, phone: '0977777777', name: 'Kẻ gian' } });
    const [l1] = await api('/auth/login', { m: 'POST', b: { phone: '0977777777', password: 'matkhau1' } });
    log('Gõ SĐT của tài khoản đã đăng ký bằng mật khẩu -> KHÔNG gắn Google được, chủ thật vẫn đăng nhập', !!reg.token && c1 === 409 && l1 === 200, `${c1}/${l1}`);

    const [m1] = await api('/me', { t: g2.ticket });
    const fake = g2.ticket.split('.')[0] + '.chu-ky-gia';
    const [c2] = await api('/auth/google/complete', { m: 'POST', b: { ticket: fake, phone: '0966666666', name: 'A' } });
    log('Vé nhập SĐT không dùng thay mã đăng nhập được; vé giả chữ ký bị từ chối', (m1 === 401 || m1 === 403) && c2 === 401, `${m1}/${c2}`);

    const [, again] = await api('/auth/google', { m: 'POST', b: { credential: cred(USER) } });
    const [c3, d3] = await api('/auth/google/complete', { m: 'POST', b: { ticket: g2.ticket, phone: '0955555555', name: 'Kẻ gian' } });
    const [, dup] = await api('/auth/google/complete', { m: 'POST', b: { ticket: g2.ticket, phone: '0944444444', name: 'Kẻ gian' } });
    log('Tài khoản Google đã có -> không hỏi lại SĐT; 1 tài khoản Google chỉ gắn 1 SĐT',
      !!again.token && again.session.phone === '0912345678' && c3 === 200 && dup.session.phone === d3.session.phone, `${d3 && d3.session.phone}/${dup && dup.session.phone}`);

    log('Không có lỗi JavaScript trên trang', errors.length === 0, errors.slice(0, 3).join(' | '));
  } catch (e) {
    log('Test chạy hết không bị lỗi', false, e.message);
  } finally {
    await browser.close();
    stopServer();
    const pass = results.filter((r) => r.ok).length;
    console.log(`\n${pass}/${results.length} PASS`);
    process.exit(pass === results.length ? 0 : 1);
  }
})();
