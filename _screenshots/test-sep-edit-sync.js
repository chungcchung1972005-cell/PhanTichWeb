// Test khu ảnh chỉnh sửa của SẾP khi bật cờ editSync (crm/js/admin.js, chỉ đọc qua API) - KHÔNG chụp
// ảnh, chỉ dữ liệu giả. Tự bật server/server.js ở cổng 3001 với kho RAM (MONGODB_URI='', không nối
// MongoDB Atlas), tự tắt khi xong kể cả khi lỗi. Mỗi "máy" là 1 ngữ cảnh trình duyệt ẩn danh riêng;
// khách / Thợ ảnh thao tác bằng API với token giả. Tắt npm start trước khi chạy.
//   node _screenshots/test-sep-edit-sync.js
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
const EDIT = 'https://drive.google.com/drive/folders/sep-da-chinh';
const ORIG = 'https://drive.google.com/drive/folders/sep-goc-NOIBO';

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

const apiLogin = async (phone, pw) => (await (await fetch(API + '/api/sale-chat/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, password: pw }) })).json()).token;
async function api(p, token, body) {
  const r = await fetch(API + '/api/edit-requests' + p, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined });
  return [r.status, await r.json().catch(() => null)];
}
const newReq = (code) => ({ orderCode: code, serviceLabel: 'Newborn', note: 'Ghi chu chung', photos: [{ id: 'ph-1', src: 'images/my-photos/photo-1.jpg', note: 'Lam sang da' }, { id: 'ph-2', src: 'images/my-photos/photo-2.jpg' }], extraFee: 0, paymentStatus: 'Trong gói' });

(async () => {
  let browser = null;
  const errors = [];
  try {
    if (await portBusy()) throw new Error('Cổng 3001 đang có server khác chạy (có thể nối MongoDB thật) - tắt nó rồi chạy lại test.');
    await startServer();
    const khach = await apiLogin('0900000001', 'khach123');
    const tho = await apiLogin('0900000003', 'anh123');
    let [s, d] = await api('/', khach, newReq('#ABSEP01'));
    const r1 = d.request;
    [s, d] = await api('/' + r1.id + '/links', tho, { resultLink: EDIT, resultLinkOriginal: ORIG, rev: r1.rev });
    await api('/' + r1.id + '/messages', khach, { text: 'Khach hoi tien do' });
    await api('/' + r1.id + '/messages', tho, { text: 'Tho tra loi khach' });
    check('Dữ liệu giả: 1 yêu cầu có 2 link + 2 tin nhắn trên server RAM', s === 200);

    browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
    // seedLocal: đặt sẵn 1 yêu cầu GIẢ trong localStorage của máy này (để kiểm khi bật cờ KHÔNG hiện nó)
    async function machine(sync, seedLocal) {
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      await page.setViewport({ width: 1440, height: 1000 });
      const m = { page, ctx, calls: [], intercept: { mode: null } };
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('dialog', (dlg) => { errors.push('dialog: ' + dlg.message()); dlg.dismiss(); });
      await page.evaluateOnNewDocument((sy, seed) => {
        window.ALOHA_FEATURES = { booking: true, aiChat: true, albumPages: true, editSync: sy };
        if (seed && !localStorage.getItem('aloha_demo_db')) {
          localStorage.setItem('aloha_demo_db', JSON.stringify({ customers: {}, editRequests: [{ id: 'REQ-LOCAL1', phone: '0900000001', customerName: 'Khach local', orderCode: '#ABLOCAL1', serviceLabel: 'Bầu', photoCount: 1, photos: [{ id: 'ph-1', src: 'images/my-photos/photo-1.jpg', note: '' }], doneIds: [], status: 'Chờ xử lý', createdAt: Date.now(), staffSeen: false, messages: [] }] }));
        }
      }, sync, !!seedLocal);
      await page.setRequestInterception(true);
      page.on('request', (r) => {
        const url = r.url();
        if (url.includes('/api/edit-requests')) {
          m.calls.push(r.method() + ' ' + url.replace(API, ''));
          if (m.intercept.mode === 'abort-all' && r.method() !== 'OPTIONS') return r.abort();
        }
        r.continue();
      });
      return m;
    }
    async function loginSep(m) {
      await m.page.goto(ROOT_URL + 'login.html', { waitUntil: 'networkidle0' });
      await m.page.type('#loginPhone', '0900000004');
      await m.page.type('#loginPassword', 'sep123');
      await Promise.all([m.page.waitForNavigation({ waitUntil: 'networkidle0' }), m.page.click('#loginSubmitBtn')]);
      await wait(900);
    }
    const expandAll = (page) => page.evaluate(() => document.querySelectorAll('.photo-row-more').forEach((b) => { if (!b.hidden && /Xem thêm/.test(b.textContent)) b.click(); }));
    const rowCodes = async (page) => { await expandAll(page); return page.$$eval('#photoRows .photo-row-card-code', (els) => els.map((e) => e.textContent.trim())); };
    const doneCodes = (page) => page.$$eval('#completedTableBody .ct-code-val', (els) => els.map((e) => e.textContent.trim()));
    const statusTexts = (page) => page.$$eval('.photo-sync-status', (els) => els.filter((e) => !e.hidden).map((e) => e.textContent));
    const waitFor = (page, fn, arg, ms = 12000) => page.waitForFunction(fn, { timeout: ms, polling: 500 }, arg).then(() => true, () => false);

    // =============================================================== 1. Cờ TẮT: luồng cũ
    const off = await machine(false, true);
    await loginSep(off);
    let codes = await rowCodes(off.page);
    check('Cờ tắt: Sếp không gọi /api/edit-requests', off.calls.length === 0, off.calls);
    check('Cờ tắt: đọc localStorage như cũ (thấy yêu cầu local), không thấy yêu cầu server', codes.includes('#ABLOCAL1') && !codes.includes('#ABSEP01'), codes);
    await off.ctx.close();

    // =============================================================== 2. Cờ BẬT: đọc từ API
    const sp = await machine(true, true);
    await loginSep(sp);
    const loaded = await waitFor(sp.page, () => {
      document.querySelectorAll('.photo-row-more').forEach((b) => { if (!b.hidden && /Xem thêm/.test(b.textContent)) b.click(); });
      return [...document.querySelectorAll('#photoRows .photo-row-card-code')].some((e) => e.textContent.trim() === '#ABSEP01');
    });
    codes = await rowCodes(sp.page);
    check('Cờ bật: Sếp gọi GET /api/edit-requests/, thấy yêu cầu trên server', loaded && sp.calls.some((c) => c.startsWith('GET /api/edit-requests/')), sp.calls);
    check('Cờ bật: KHÔNG hiện yêu cầu trong localStorage như dữ liệu server', !codes.includes('#ABLOCAL1'), codes);
    check('Thẻ minh hoạ vẫn hiện; Sếp không có nút gửi link trên thẻ', codes.includes('#AB240701') && (await sp.page.$$('.photo-row-drive-btn')).length === 0);
    let card = await sp.page.evaluate(() => { const el = [...document.querySelectorAll('#photoRows .photo-row-card')].find((x) => x.querySelector('.photo-row-card-code').textContent.trim() === '#ABSEP01'); return el.textContent.replace(/\s+/g, ' '); });
    check('Thẻ: tên khách, 2 ảnh, "Chưa phân công", "Mới" (thợ chưa xem), "Khách cần thợ trả lời"? (thợ đã trả lời -> không)', /Khách demo/.test(card) && /2 ảnh/.test(card) && /Chưa phân công/.test(card) && /Mới/.test(card) && !/Khách cần thợ trả lời/.test(card) && /Đã gửi link ảnh/.test(card), card);
    // Bộ lọc thợ: Thợ chỉnh 1 vẫn thấy yêu cầu chưa phân công
    await sp.page.click('#workerBtn-tho1');
    await wait(200);
    check('Bộ lọc Thợ chỉnh 1: vẫn thấy yêu cầu chưa phân công từ server', (await rowCodes(sp.page)).includes('#ABSEP01'));
    await sp.page.click('#workerBtn-all');
    await wait(200);

    // Chi tiết (chỉ đọc). Đổi bộ lọc thợ làm các hàng thu gọn lại -> mở hết "Xem thêm" trước khi bấm
    await expandAll(sp.page);
    await sp.page.evaluate(() => [...document.querySelectorAll('#photoRows .photo-row-card')].find((x) => x.querySelector('.photo-row-card-code').textContent.trim() === '#ABSEP01').click());
    await wait(500);
    let v = await sp.page.evaluate(() => ({
      cur: document.getElementById('kanbanResultCurrent').textContent,
      msgs: [...document.querySelectorAll('#kanbanChatList .kanban-msg p')].map((p) => p.textContent),
      form: !!document.getElementById('kanbanLinkForm'), chat: !!document.getElementById('kanbanChatForm'), complete: !!document.getElementById('kanbanLinkComplete'),
      photos: document.querySelectorAll('#kanbanModalBody .kanban-photo-tile').length, note: document.getElementById('kanbanModalBody').textContent.includes('Lam sang da')
    }));
    check('Chi tiết từ API: 2 link (link gốc ghi rõ nội bộ), 2 ảnh + ghi chú, 2 tin nhắn', v.cur.includes(EDIT) && v.cur.includes(ORIG) && /nội bộ/.test(v.cur) && v.photos === 2 && v.note && v.msgs.join('|') === 'Khach hoi tien do|Tho tra loi khach', v);
    check('Chi tiết của Sếp: không có form link, không nút Hoàn tất, không ô trả lời', !v.form && !v.complete && !v.chat, v);
    await wait(800);
    [s, d] = await api('/' + r1.id, tho);
    check('Sếp mở chi tiết KHÔNG gửi "đã xem" (server cấm Sếp) -> staffSeen vẫn false', d.request.staffSeen === false);
    check('Từ đầu tới giờ Sếp không gửi lệnh ghi nào (không có POST)', !sp.calls.some((c) => c.startsWith('POST')), sp.calls.filter((c) => !c.startsWith('GET') && !c.startsWith('OPTIONS')));
    // Khách nhắn thêm khi chi tiết đang mở -> khung chat của Sếp tự cập nhật
    await api('/' + r1.id + '/messages', khach, { text: 'Khach nhan them' });
    const chatUpd = await waitFor(sp.page, () => [...document.querySelectorAll('#kanbanChatList .kanban-msg p')].some((p) => p.textContent === 'Khach nhan them'));
    check('Khách nhắn thêm -> khung chat Sếp đang mở tự cập nhật sau vòng làm mới', chatUpd);
    await sp.page.evaluate(() => document.getElementById('kanbanModalClose').click());

    // Thao tác ghi bị server từ chối kể cả khi gọi thẳng từ trang Sếp
    v = await sp.page.evaluate(async (id) => {
      const S = window.AlohaEditSync;
      const g = await S.get(id);
      const rev = g.data.request.rev;
      const res = await Promise.all([S.setLinks(id, { resultLink: 'https://drive.google.com/sep-ghi-de' }, rev), S.complete(id, rev), S.addMessage(id, 'Sep nhan'), S.markSeen(id), S.setPhotoDone(id, 'ph-1', true), S.create({ photos: [{ id: 'a', src: 'images/a.jpg' }] })]);
      return res.map((r) => r.error);
    }, r1.id);
    [s, d] = await api('/' + r1.id, tho);
    check('Sếp gọi thẳng setLinks/complete/addMessage/markSeen/setPhotoDone/create -> đều "forbidden"', v.every((e) => e === 'forbidden'), v);
    check('Server không đổi sau các lệnh ghi bị từ chối', d.request.resultLink === EDIT && d.request.status === 'Chờ xử lý' && d.request.messages.length === 3 && d.request.staffSeen === false && d.request.doneIds.length === 0);

    // =============================================================== 3. Thay đổi từ khách / Thợ ảnh xuất hiện sau vòng làm mới
    [s, d] = await api('/', khach, newReq('#ABSEP02'));
    const r2 = d.request;
    const got2 = await waitFor(sp.page, () => {
      document.querySelectorAll('.photo-row-more').forEach((b) => { if (!b.hidden && /Xem thêm/.test(b.textContent)) b.click(); });
      return [...document.querySelectorAll('#photoRows .photo-row-card-code')].some((e) => e.textContent.trim() === '#ABSEP02');
    });
    check('Khách gửi yêu cầu mới -> hiện ở trang Sếp sau vòng làm mới', got2);
    [s, d] = await api('/' + r1.id, tho);
    [s, d] = await api('/' + r1.id + '/complete', tho, { rev: d.request.rev });
    check('Thợ ảnh Hoàn tất yêu cầu 1 qua API', s === 200);
    const gotDone = await waitFor(sp.page, () => [...document.querySelectorAll('#completedTableBody .ct-code-val')].some((e) => e.textContent.trim() === '#ABSEP01'));
    v = await sp.page.evaluate(() => {
      const tr = [...document.querySelectorAll('#completedTableBody tr')].find((x) => x.textContent.includes('#ABSEP01'));
      return tr ? { links: [...tr.querySelectorAll('.ct-link-anchor')].map((a) => a.href), worker: tr.querySelector('.ct-worker-badge').textContent } : null;
    });
    check('Trạng thái Hoàn thành từ Thợ ảnh -> yêu cầu 1 sang bảng Đã hoàn tất của Sếp (2 link, "Chưa phân công")', gotDone && v && v.links.join('|') === EDIT + '|' + ORIG && v.worker === 'Chưa phân công', v);
    check('Yêu cầu 1 rời 3 hàng của Sếp', !(await rowCodes(sp.page)).includes('#ABSEP01'));
    v = await sp.page.evaluate(() => { const b = document.querySelector('#adminTabs a[href="#anh"] .admin-tab-badge'); return b ? b.textContent : ''; });
    check('Badge "chưa xem" trên menu Ảnh & chỉnh sửa đếm yêu cầu thợ chưa mở (2)', v === '2', v);
    check('Không có dòng báo lỗi kết nối khi server chạy bình thường', (await statusTexts(sp.page)).length === 0);

    // =============================================================== 4. Mất mạng: không trình bày như đã đồng bộ
    sp.intercept.mode = 'abort-all';
    const errShown = await waitFor(sp.page, () => [...document.querySelectorAll('.photo-sync-status')].some((e) => !e.hidden));
    let st = await statusTexts(sp.page);
    check('Mất mạng: hiện "Chưa cập nhật được... dữ liệu là lần tải gần nhất" ở cả 2 mục (Ảnh & chỉnh sửa + Đã hoàn tất)', errShown && st.length === 2 && st.every((t) => /Chưa cập nhật được/.test(t) && /lần tải được gần nhất/.test(t)), st);
    [s, d] = await api('/', khach, newReq('#ABSEP03'));
    await wait(6000);
    check('Mất mạng: yêu cầu mới trên server KHÔNG hiện (không giả vờ đã đồng bộ), giữ dữ liệu lần tải trước', !(await rowCodes(sp.page)).includes('#ABSEP03') && (await rowCodes(sp.page)).includes('#ABSEP02'));
    sp.intercept.mode = null;
    const back = await waitFor(sp.page, () => {
      document.querySelectorAll('.photo-row-more').forEach((b) => { if (!b.hidden && /Xem thêm/.test(b.textContent)) b.click(); });
      return [...document.querySelectorAll('#photoRows .photo-row-card-code')].some((e) => e.textContent.trim() === '#ABSEP03') && [...document.querySelectorAll('.photo-sync-status')].every((e) => e.hidden);
    });
    check('Kết nối lại: tự tải yêu cầu mới, ẩn dòng báo lỗi', back);

    // Mở trang khi mất mạng ngay từ đầu: không hiện dữ liệu localStorage thay thế
    const cold = await machine(true, true);
    cold.intercept.mode = 'abort-all';
    await loginSep(cold);
    await waitFor(cold.page, () => [...document.querySelectorAll('.photo-sync-status')].some((e) => !e.hidden));
    codes = await rowCodes(cold.page);
    st = await statusTexts(cold.page);
    check('Mở trang lúc mất mạng: báo lỗi, KHÔNG hiện yêu cầu server, KHÔNG lấy localStorage thay thế', st.length === 2 && !codes.includes('#ABSEP01') && !codes.includes('#ABLOCAL1') && codes.includes('#AB240701'), { st, codes });
    await cold.ctx.close();

    // =============================================================== 5. Các khu vực khác của Sếp vẫn như cũ
    v = await sp.page.evaluate(() => ({
      tabs: [...document.querySelectorAll('#adminTabs a span')].map((x) => x.textContent.trim()),
      cust: document.getElementById('custView') ? document.getElementById('custView').children.length : -1,
      cal: document.querySelectorAll('#calGrid > *').length, funnel: document.querySelectorAll('#funnelChart > *').length,
      revenue: !!document.getElementById('doanh-thu'), settings: document.body.textContent.includes('50% giá chụp')
    }));
    check('Sếp: menu đủ mục; Khách hàng, Lịch hẹn, Phễu, Doanh thu, Cài đặt vẫn dựng như cũ', ['Dashboard', 'Tin nhắn', 'Khách hàng', 'Lịch hẹn', 'Ảnh & chỉnh sửa', 'Đã hoàn tất', 'Doanh thu', 'Cài đặt'].every((t) => v.tabs.includes(t)) && v.cust > 0 && v.cal > 0 && v.funnel > 0 && v.revenue && v.settings, v);
    // Sale vào admin.html (cờ bật): không có khu ảnh, không gọi API ảnh
    const sl = await machine(true, false);
    await sl.page.goto(ROOT_URL + 'login.html', { waitUntil: 'networkidle0' });
    await sl.page.type('#loginPhone', '0900000002');
    await sl.page.type('#loginPassword', 'sale123');
    await Promise.all([sl.page.waitForNavigation({ waitUntil: 'networkidle0' }), sl.page.click('#loginSubmitBtn')]);
    await sl.page.goto(ROOT_URL + 'crm/admin.html', { waitUntil: 'networkidle0' });
    await wait(800);
    v = await sl.page.evaluate(() => ({ anh: !!document.getElementById('anh'), cust: document.getElementById('custView') ? document.getElementById('custView').children.length : -1 }));
    check('Sale (cờ bật) ở admin.html: không có khu ảnh, không gọi API ảnh, Khách hàng vẫn dựng', !v.anh && v.cust > 0 && sl.calls.length === 0, { v, calls: sl.calls });
    await sl.page.goto(ROOT_URL + 'crm/sale.html', { waitUntil: 'networkidle0' });
    await wait(800);
    check('Sale (cờ bật): Không gian Sale mở bình thường, không gọi API ảnh', await sl.page.evaluate(() => document.body.textContent.length > 500) && sl.calls.length === 0);
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
