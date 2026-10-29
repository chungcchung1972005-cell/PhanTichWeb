const fixture=require('./workflow-fixture');
// Test nhánh đồng bộ của trang Thợ ảnh (crm/js/admin.js khi bật cờ editSync) - KHÔNG chụp ảnh,
// chỉ dữ liệu giả. Tự bật server/server.js ở cổng 3001 với kho RAM (MONGODB_URI='', không nối
// MongoDB Atlas), tự tắt khi xong kể cả khi lỗi. Mỗi "máy" là 1 ngữ cảnh trình duyệt ẩn danh riêng.
// "Phiên khác" (khách / Thợ ảnh thứ 2) gọi thẳng API bằng token giả. Tắt npm start trước khi chạy.
//   node _screenshots/test-tho-anh-edit-sync.js
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
const EDIT = 'https://drive.google.com/drive/folders/sync-da-chinh';
const ORIG_MARK = 'sync-goc-NOIBO';
const ORIG = 'https://drive.google.com/drive/folders/' + ORIG_MARK;

let server = null, serverLog = '';
async function portBusy() { try { await fetch(API + '/api/health', { signal: AbortSignal.timeout(1500) }); return true; } catch (e) { return false; } }
async function startServer() {
  await fixture.driveFixture();
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

const apiLogin = async (phone, pw) => (await (await fetch(API + '/api/sale-chat/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, password: pw }) })).json()).token;
async function api(p, token, body) {
  const r = await fetch(API + '/api/edit-requests' + p, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let data = null; try { data = JSON.parse(text); } catch (e) { /* */ }
  return [r.status, data, text];
}
const newReq = (code) => ({ orderCode: code, serviceLabel: 'Newborn', note: 'Giu tong am', photos: [{ id: 'ph-1', src: 'images/my-photos/photo-1.jpg', note: 'Lam sang da' }, { id: 'ph-2', src: 'images/my-photos/photo-2.jpg' }], extraFee: 0, paymentStatus: 'Trong gói' });

(async () => {
  let browser = null;
  const errors = [];
  try {
    if (await portBusy()) throw new Error('Cổng 3001 đang có server khác chạy (có thể nối MongoDB thật) - tắt nó rồi chạy lại test.');
    await startServer();
    const khach = await apiLogin('0900000001', 'khach123');
    const tho2 = await apiLogin('0900000003', 'anh123'); // "phiên Thợ ảnh khác" (máy khác)
    let [s, d] = await api('/', khach, fixture.requestFrom(await fixture.sourceAlbum(API,{customer:khach,code:'#ABSYNC01'}),newReq('#ABSYNC01')));
    const r1 = d.request;
    [s, d] = await api('/', khach, fixture.requestFrom(await fixture.sourceAlbum(API,{customer:khach,code:'#ABSYNC02'}),newReq('#ABSYNC02')));
    const r2 = d.request;
    check('Dữ liệu giả: khách tạo 2 yêu cầu trên server RAM', !!(r1 && r2));

    browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
    async function machine(sync) {
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      await page.setViewport({ width: 1440, height: 1000 });
      const m = { page, ctx, calls: [], intercept: { mode: null } };
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('dialog', (dlg) => { errors.push('dialog: ' + dlg.message()); dlg.dismiss(); });
      await page.evaluateOnNewDocument((sy) => { window.ALOHA_FEATURES = { booking: true, aiChat: true, albumPages: true, editSync: sy }; }, sync);
      await page.setRequestInterception(true);
      page.on('request', async (r) => {
        if(await fixture.thumbnail(page,r)) return;
        const url = r.url();
        if (url.includes('/api/edit-requests')) {
          m.calls.push(r.method() + ' ' + url.replace(API, ''));
          if (m.intercept.mode === 'abort-post' && r.method() === 'POST') return r.abort();
        }
        r.continue();
      });
      return m;
    }
    async function login(m, phone, pw) {
      await m.page.goto(ROOT_URL + 'login.html', { waitUntil: 'networkidle0' });
      await m.page.type('#loginPhone', phone);
      await m.page.type('#loginPassword', pw);
      await Promise.all([m.page.waitForNavigation({ waitUntil: 'networkidle0' }), m.page.click('#loginSubmitBtn')]);
      await wait(800);
    }
    const expandAll = (page) => page.evaluate(() => document.querySelectorAll('.photo-row-more').forEach((b) => { if (!b.hidden && /Xem thêm/.test(b.textContent)) b.click(); }));
    const cardText = (page, code) => page.evaluate((c) => { const el = [...document.querySelectorAll('#photoRows .photo-row-card')].find((x) => x.querySelector('.photo-row-card-code').textContent.trim() === c); return el ? el.textContent.replace(/\s+/g, ' ') : null; }, code);
    async function openCard(page, code) {
      await expandAll(page);
      await page.evaluate((c) => [...document.querySelectorAll('#photoRows .photo-row-card')].find((x) => x.querySelector('.photo-row-card-code').textContent.trim() === c).click(), code);
      await wait(400);
    }
    const localReqs = (page) => page.evaluate(() => { try { return (JSON.parse(localStorage.getItem('aloha_demo_db')) || {}).editRequests || []; } catch (e) { return []; } });

    // =============================================================== 1. Cờ TẮT: luồng cũ
    const off = await machine(false);
    await login(off, '0900000003', 'anh123');
    await expandAll(off.page);
    check('Cờ tắt: trang Thợ ảnh không gọi /api/edit-requests', off.calls.length === 0, off.calls);
    check('Cờ tắt: yêu cầu trên server KHÔNG hiện (đọc localStorage như cũ), không tự sinh thẻ minh họa', (await cardText(off.page, '#ABSYNC01')) === null && (await cardText(off.page, '#AB240701')) === null);
    await off.ctx.close();

    // =============================================================== 2. Cờ BẬT: đọc từ API
    const t = await machine(true);
    await login(t, '0900000003', 'anh123');
    await t.page.waitForFunction(() => [...document.querySelectorAll('#photoRows .photo-row-card-code')].length > 0, { timeout: 8000 });
    await wait(600);
    await expandAll(t.page);
    check('Cờ bật: trang gọi GET /api/edit-requests/', t.calls.some((c) => /^GET \/api\/edit-requests\/$/.test(c)), t.calls);
    let card = await cardText(t.page, '#ABSYNC01');
    check('Yêu cầu từ server hiện ở 3 hàng: "Thợ ảnh demo", "Mới", tên khách, 2 ảnh', !!card && /Thợ ảnh demo/.test(card) && /Mới/.test(card) && /Khách demo/.test(card) && /2 ảnh/.test(card), card);
    check('Không tự sinh thẻ minh họa', (await cardText(t.page, '#AB240701')) === null);
    check('Không ghi yêu cầu nào vào localStorage', (await localReqs(t.page)).length === 0);

    // Mở chi tiết -> server lưu "đã xem"
    await openCard(t.page, '#ABSYNC01');
    await wait(500);
    [s, d] = await api('/' + r1.id, tho2);
    check('Mở chi tiết -> server lưu staffSeen', d.request.staffSeen === true);
    let v = await t.page.evaluate(() => ({ photos: document.querySelectorAll('#kanbanModalBody .kanban-photo-tile').length, note: document.getElementById('kanbanModalBody').textContent.includes('Lam sang da'), form: !!document.getElementById('kanbanLinkForm'), complete: !!document.getElementById('kanbanLinkComplete') }));
    check('Chi tiết: 2 ảnh + ghi chú riêng của khách, có form link, chưa có Hoàn tất', v.photos === 2 && v.note && v.form && !v.complete, v);

    // Lưu 2 link qua form dưới ảnh
    await t.page.type('#kanbanLinkEdit', EDIT);
    await t.page.type('#kanbanLinkOrig', ORIG);
    await t.page.evaluate(() => document.getElementById('kanbanLinkForm').requestSubmit());
    await t.page.waitForFunction(() => !!document.getElementById('kanbanLinkComplete'), { timeout: 8000 });
    [s, d] = await api('/' + r1.id, tho2);
    check('Lưu link -> server có 2 link, rev tăng', d.request.resultLink === EDIT && d.request.resultLinkOriginal === ORIG && d.request.rev === r1.rev + 1, d.request);
    v = await t.page.evaluate(() => document.getElementById('kanbanResultCurrent').textContent);
    check('Chi tiết hiện 2 link (link gốc ghi rõ nội bộ) + nút Hoàn tất', v.includes(EDIT) && v.includes(ORIG) && /nội bộ/.test(v));
    [s, d, v] = await api('/' + r1.id, khach);
    check('Phản hồi API cho khách KHÔNG có link ảnh gốc', s === 200 && d.request.resultLink === EDIT && !('resultLinkOriginal' in d.request) && !v.includes(ORIG_MARK));

    // Nhắn khách
    await t.page.type('#kanbanChatInput', 'Tho da gui link roi a');
    await t.page.keyboard.press('Enter');
    await t.page.waitForFunction(() => document.getElementById('kanbanChatInput').value === '', { timeout: 8000 });
    [s, d] = await api('/' + r1.id, tho2);
    const lastMsg = d.request.messages.slice(-1)[0];
    check('Nhắn khách -> server lưu tin "staff", tên Thợ ảnh từ token', lastMsg && lastMsg.from === 'staff' && lastMsg.text === 'Tho da gui link roi a' && lastMsg.name === 'Thợ ảnh demo', lastMsg);
    [s, d] = await api('/' + r1.id, khach);
    check('Khách đọc được tin của thợ qua API', d.request.messages.some((m) => m.from === 'staff' && m.text === 'Tho da gui link roi a'));

    // 409: phiên Thợ ảnh khác đổi link sau khi trang này đã mở chi tiết
    [s, d] = await api('/' + r1.id, tho2);
    [s, d] = await api('/' + r1.id + '/links', tho2, { resultLink: EDIT + '-phien-khac', rev: d.request.rev });
    check('Phiên Thợ ảnh khác lưu link mới (rev tăng)', s === 200);
    await t.page.$eval('#kanbanLinkEdit', (i) => { i.value = ''; });
    await t.page.type('#kanbanLinkEdit', EDIT + '-trang-nay');
    await t.page.evaluate(() => document.getElementById('kanbanLinkForm').requestSubmit());
    await t.page.waitForFunction(() => { const e = document.getElementById('kanbanLinkError'); return e && !e.hidden && e.textContent.length > 0; }, { timeout: 8000 });
    v = await t.page.evaluate(() => ({ err: document.getElementById('kanbanLinkError').textContent, typed: document.getElementById('kanbanLinkEdit').value, cur: document.getElementById('kanbanResultCurrent').textContent }));
    [s, d] = await api('/' + r1.id, tho2);
    check('409: báo dữ liệu đã đổi + đã tải bản mới nhất, kèm link hiện có trên server', /người khác cập nhật/.test(v.err) && /bản mới nhất/.test(v.err) && v.err.includes('-phien-khac'), v.err);
    check('409: KHÔNG ghi đè - server giữ link của phiên khác', d.request.resultLink === EDIT + '-phien-khac', d.request.resultLink);
    check('409: giữ nguyên chữ thợ đã gõ, khung link hiện bản mới nhất của server', v.typed === EDIT + '-trang-nay' && v.cur.includes('-phien-khac'), v);
    const revAfterConflict = d.request.rev;
    await wait(1500);
    [s, d] = await api('/' + r1.id, tho2);
    check('409: trang KHÔNG tự gửi lại thao tác', d.request.rev === revAfterConflict && d.request.resultLink === EDIT + '-phien-khac');
    // Thợ kiểm tra xong, chủ động lưu lại -> dùng rev mới, thành công
    await t.page.evaluate(() => document.getElementById('kanbanLinkForm').requestSubmit());
    await wait(800);
    [s, d] = await api('/' + r1.id, tho2);
    check('Sau khi kiểm tra, thợ lưu lại -> thành công với rev mới', d.request.resultLink === EDIT + '-trang-nay' && d.request.rev === revAfterConflict + 1, d.request.resultLink);
    await t.page.evaluate(() => document.getElementById('kanbanModalClose').click());

    // Mất mạng khi lưu link: báo lỗi, không ghi local, server không đổi
    await openCard(t.page, '#ABSYNC02');
    t.intercept.mode = 'abort-post';
    await t.page.type('#kanbanLinkEdit', EDIT + '-mat-mang');
    await t.page.evaluate(() => document.getElementById('kanbanLinkForm').requestSubmit());
    await t.page.waitForFunction(() => { const e = document.getElementById('kanbanLinkError'); return e && !e.hidden; }, { timeout: 8000 });
    v = await t.page.evaluate(() => ({ err: document.getElementById('kanbanLinkError').textContent, typed: document.getElementById('kanbanLinkEdit').value, complete: !!document.getElementById('kanbanLinkComplete') }));
    [s, d] = await api('/' + r2.id, tho2);
    check('Mất mạng: báo không kết nối được, giữ chữ đã gõ, không hiện Hoàn tất', /kết nối/.test(v.err) && v.typed === EDIT + '-mat-mang' && !v.complete, v);
    check('Mất mạng: server không có link, localStorage không có yêu cầu', d.request.resultLink === '' && (await localReqs(t.page)).length === 0);
    // Mất mạng khi nhắn
    await t.page.type('#kanbanChatInput', 'Tin se loi');
    await t.page.keyboard.press('Enter');
    await t.page.waitForFunction(() => { const e = document.getElementById('kanbanChatError'); return e && !e.hidden; }, { timeout: 8000 });
    check('Mất mạng khi nhắn: báo "Tin nhắn CHƯA được gửi", giữ chữ đã gõ', /CHƯA được gửi/.test(await t.page.$eval('#kanbanChatError', (e) => e.textContent)) && (await t.page.$eval('#kanbanChatInput', (i) => i.value)) === 'Tin se loi');
    t.intercept.mode = null;
    await t.page.$eval('#kanbanChatInput', (i) => { i.value = ''; });

    // Hoàn tất bị server chặn khi link ảnh đã chỉnh bị gỡ ở phiên khác (trang còn hiện nút Hoàn tất)
    await t.page.$eval('#kanbanLinkEdit', (i) => { i.value = ''; });
    await t.page.type('#kanbanLinkEdit', EDIT + '-r2');
    await t.page.evaluate(() => document.getElementById('kanbanLinkForm').requestSubmit());
    await t.page.waitForFunction(() => !!document.getElementById('kanbanLinkComplete'), { timeout: 8000 });
    [s, d] = await api('/' + r2.id, tho2);
    [s, d] = await api('/' + r2.id + '/links', tho2, { resultLink: '', rev: d.request.rev });
    check('Phiên khác gỡ link ảnh đã chỉnh của yêu cầu 2', s === 200 && d.request.resultLink === '');
    await t.page.evaluate(() => document.getElementById('kanbanLinkComplete').click());
    await t.page.waitForFunction(() => { const e = document.getElementById('kanbanLinkError'); return e && !e.hidden && e.textContent; }, { timeout: 8000 });
    v = await t.page.evaluate(() => ({ err: document.getElementById('kanbanLinkError').textContent, open: document.getElementById('kanbanModalOverlay').classList.contains('open') }));
    [s, d] = await api('/' + r2.id, tho2);
    check('Hoàn tất khi server không còn link ảnh đã chỉnh -> báo lỗi, chi tiết vẫn mở, KHÔNG Hoàn thành', /link ảnh đã chỉnh/.test(v.err) && v.open && d.request.status === 'Chờ xử lý', v);
    await t.page.evaluate(() => document.getElementById('kanbanModalClose').click());

    // Hoàn tất thành công từ cửa sổ Drive trên thẻ
    await expandAll(t.page);
    await t.page.evaluate(() => [...document.querySelectorAll('#photoRows .photo-row-card')].find((x) => x.querySelector('.photo-row-card-code').textContent.trim() === '#ABSYNC01').querySelector('.photo-row-drive-btn').click());
    await wait(300);
    check('Cửa sổ Drive: điền sẵn link hiện có trên server, có nút Hoàn tất', (await t.page.$eval('#driveModalInput', (i) => i.value)) === EDIT + '-trang-nay' && !(await t.page.$eval('#driveModalCompleteBtnWrap', (w) => w.hidden)));
    await t.page.click('#driveModalCompleteBtn');
    await t.page.waitForFunction(() => !document.getElementById('driveModalOverlay').classList.contains('open'), { timeout: 8000 });
    [s, d] = await api('/' + r1.id, tho2);
    check('Hoàn tất -> server Hoàn thành, mọi ảnh xong; cửa sổ chỉ đóng sau khi server xác nhận', d.request.status === 'Hoàn thành' && d.request.doneIds.length === 2);
    await wait(300);
    v = await t.page.evaluate(() => ({ inRows: [...document.querySelectorAll('#photoRows .photo-row-card-code')].some((e) => e.textContent.trim() === '#ABSYNC01'), inDone: [...document.querySelectorAll('#completedTableBody .ct-code-val')].some((e) => e.textContent.trim() === '#ABSYNC01') }));
    check('Đơn rời 3 hàng, có trong bảng Đã hoàn tất', !v.inRows && v.inDone, v);
    [s, d] = await api('/' + r1.id, khach);
    check('Khách thấy Hoàn thành qua API, vẫn không có link gốc', d.request.status === 'Hoàn thành' && !('resultLinkOriginal' in d.request));

    // Phiên khác đổi dữ liệu -> trang tự cập nhật qua vòng hỏi
    [s, d] = await api('/', khach, fixture.requestFrom(await fixture.sourceAlbum(API,{customer:khach,code:'#ABSYNC03'}),newReq('#ABSYNC03')));
    // Chờ vòng hỏi 5 giây: mỗi lần kiểm mở hết "Xem thêm" rồi tìm thẻ mới
    await t.page.waitForFunction(() => {
      document.querySelectorAll('.photo-row-more').forEach((b) => { if (!b.hidden && /Xem thêm/.test(b.textContent)) b.click(); });
      return [...document.querySelectorAll('#photoRows .photo-row-card-code')].some((e) => e.textContent.trim() === '#ABSYNC03');
    }, { timeout: 12000, polling: 500 }).catch(() => {});
    check('Khách gửi yêu cầu mới -> trang Thợ ảnh tự hiện trong vài giây', (await cardText(t.page, '#ABSYNC03')) !== null);
    check('Toàn bộ quá trình không ghi yêu cầu nào vào localStorage', (await localReqs(t.page)).length === 0);

    // =============================================================== 3. Sếp (chưa tích hợp): giữ luồng cũ kể cả khi bật cờ
    const sep = await machine(true);
    await login(sep, '0900000004', 'sep123');
    await sep.page.goto(ROOT_URL + 'crm/admin.html#anh', { waitUntil: 'networkidle0' });
    await wait(800);
    await expandAll(sep.page);
    v = await sep.page.evaluate(() => ({ flag: window.ALOHA_FEATURES.editSync, cust: document.getElementById('custView') ? document.getElementById('custView').children.length : -1, cal: document.querySelectorAll('#calGrid > *').length, funnel: document.querySelectorAll('#funnelChart > *').length }));
    // Sếp đã tích hợp CHỈ ĐỌC (bước sau, 2026-10-15): bật cờ thì đọc GET từ API, không có lệnh ghi nào
    // (trước đó kiểm "Sếp chưa tích hợp, không gọi API" - đổi theo yêu cầu tích hợp Sếp; chi tiết ở test-sep-edit-sync.js)
    check('Sếp (cờ bật): chỉ ĐỌC qua API (GET), không có lệnh ghi, thấy yêu cầu trên server', v.flag === true && sep.calls.some((c) => c.startsWith('GET /api/edit-requests/')) && !sep.calls.some((c) => c.startsWith('POST')) && (await cardText(sep.page, '#ABSYNC03')) !== null, sep.calls);
    check('Sếp: Khách hàng / Lịch hẹn / Phễu vẫn dựng như cũ', v.cust > 0 && v.cal > 0 && v.funnel > 0, v);
    check('Không có lỗi JS / hộp thoại trên các trang', errors.length === 0, errors);
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
