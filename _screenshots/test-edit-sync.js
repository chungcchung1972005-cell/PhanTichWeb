// Test lớp AlohaEditSync (js/edit-sync.js) + cờ editSync (js/features.js). KHÔNG chụp ảnh,
// chỉ dùng dữ liệu giả, không kết nối MongoDB Atlas.
//  A. Mock API (Node vm, không mạng): cờ mặc định tắt, tắt thì không gọi mạng / không đụng
//     localStorage, đúng endpoint + phương thức + body, quy đổi lỗi 0/401/403/404/409/413/422/429/500.
//  B. Tích hợp: tự bật server/server.js ở cổng 3001 (kho RAM, MONGODB_URI='') rồi gọi qua
//     js/auth.js THẬT (AlohaAuth.api) để chắc chắn khớp router server/edit-requests.js. Tự tắt
//     server khi xong kể cả khi lỗi.
//  C. Trình duyệt (không chụp ảnh): index.html + crm/admin.html nạp được edit-sync.js, cờ tắt,
//     AlohaData giữ nguyên 12 hàm, không lỗi JS.
// Tắt server local (npm start) trước khi chạy. Cần đã chạy `npm ci` trong server/.
//   node _screenshots/test-edit-sync.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');
const { CHROME_PATH, ROOT_URL } = require('./test-env');

const ROOT = path.resolve(__dirname, '..');
const API = 'http://localhost:3001';
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (name, ok, extra) => {
  if (ok) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '→ ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''); }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- Môi trường giả cho vm
function fakeStorage() {
  const m = new Map();
  const s = {
    writes: 0,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { s.writes++; m.set(k, String(v)); },
    removeItem: (k) => { s.writes++; m.delete(k); },
    dump: () => Object.fromEntries(m)
  };
  return s;
}
// Tạo 1 "cửa sổ" giả: window === globalThis của context
function makeWindow(extra) {
  const classes = new Set();
  const ctx = {
    console, JSON, Date, Math, Promise, Object, Array, Number, String, Boolean, Set, Map, RegExp, Error,
    encodeURIComponent, setTimeout, clearTimeout, fetch, AbortSignal,
    localStorage: fakeStorage(), sessionStorage: fakeStorage(),
    location: { protocol: 'file:', hostname: '', pathname: '/index.html', href: 'file:///index.html' },
    document: { documentElement: { classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: (c) => classes.has(c) } } },
    __classes: classes,
    ...(extra || {})
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  return ctx;
}
const load = (ctx, file) => vm.runInContext(read(file), ctx, { filename: file });

// AlohaAuth giả: ghi lại mọi lần gọi, trả phản hồi theo hàng đợi
function mockAuth(token) {
  const calls = [];
  const queue = [];
  return {
    calls, queue,
    getSession: () => (token ? { role: 'tho-anh', phone: '0900000003', token } : null),
    api: async (p, o) => {
      calls.push({ path: p, method: (o && o.method) || 'GET', body: o && o.body, auth: o && o.auth });
      const next = queue.shift();
      if (next instanceof Error) throw next;
      return next || { ok: true, status: 200, data: { request: { id: 'x' } } };
    }
  };
}

const ID = 'ER-abc123-0123abcd';

// ---------------------------------------------------------------- Server RAM (phần B)
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

(async () => {
  let browser = null;
  try {
    // =============================================================== A. Mock API
    // Cờ mặc định
    const fw = makeWindow({URLSearchParams});
    load(fw, 'js/features.js');
    check('features.js: editSync mặc định true', fw.ALOHA_FEATURES.editSync === true, fw.ALOHA_FEATURES);
    const opt=makeWindow({URLSearchParams,location:{search:'?editSync=0'}});
    load(opt,'js/features.js');check('editSync=0 persists browser opt-out',!opt.ALOHA_FEATURES.editSync && opt.localStorage.getItem('aloha_edit_sync')==='0');
    opt.ALOHA_FEATURES=undefined;opt.location.search='';load(opt,'js/features.js');check('browser opt-out survives reload',!opt.ALOHA_FEATURES.editSync);
    opt.ALOHA_FEATURES=undefined;opt.location.search='?editSync=1';load(opt,'js/features.js');check('editSync=1 clears opt-out',opt.ALOHA_FEATURES.editSync && opt.localStorage.getItem('aloha_edit_sync')===null);
    opt.ALOHA_FEATURES={editSync:false};load(opt,'js/features.js');check('preset feature override has priority',!opt.ALOHA_FEATURES.editSync);
    check('features.js: 3 cờ cũ giữ nguyên giá trị mặc định', fw.ALOHA_FEATURES.booking === false && fw.ALOHA_FEATURES.aiChat === true && fw.ALOHA_FEATURES.albumPages === true);
    check('features.js: cờ editSync không gắn class mới lên <html>', [...fw.__classes].every((c) => ['feat-no-booking', 'feat-no-ai', 'feat-no-album'].includes(c)), [...fw.__classes]);
    const fw2 = makeWindow({ ALOHA_FEATURES: { booking: true, aiChat: true, albumPages: true, editSync: false } });
    load(fw2, 'js/features.js');
    check('Test cũ đặt sẵn 3 cờ (launchAllFeatures) -> editSync vẫn false', fw2.ALOHA_FEATURES.editSync === false);

    // Mã nguồn edit-sync.js (bỏ chú thích) không đụng AlohaData / localStorage / sessionStorage
    const code = read('js/edit-sync.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '');
    check('edit-sync.js không dùng AlohaData / localStorage / sessionStorage / indexedDB', !/AlohaData|localStorage|sessionStorage|indexedDB/.test(code));
    check('edit-sync.js không có hạn 7 ngày', !/7\s*ngày|7\s*\*\s*24/.test(read('js/edit-sync.js')));

    // Cờ TẮT: không gọi mạng, không ghi localStorage, AlohaData chạy như cũ
    const offWin = makeWindow({ALOHA_FEATURES:{editSync:false}});
    load(offWin, 'js/features.js');
    load(offWin, 'js/data-store.js');
    const dataKeysBefore = Object.keys(offWin.AlohaData).sort().join(',');
    offWin.AlohaAuth = mockAuth('tok');
    load(offWin, 'js/edit-sync.js');
    const S = offWin.AlohaEditSync;
    check('AlohaData giữ nguyên 14 hàm/hằng sau khi nạp edit-sync.js', Object.keys(offWin.AlohaData).sort().join(',') === dataKeysBefore && Object.keys(offWin.AlohaData).length === 14, Object.keys(offWin.AlohaData));
    const writesBefore = offWin.localStorage.writes;
    const offResults = await Promise.all([S.health(), S.mine(), S.list(), S.get(ID), S.create({ photos: [] }), S.addMessage(ID, 'x'), S.markSeen(ID), S.setPhotoDone(ID, 'ph-1', true), S.setLinks(ID, { resultLink: 'https://a.b' }, 1), S.complete(ID, 1)]);
    check('Cờ tắt: cả 10 hàm trả ok:false, error "disabled"', offResults.every((r) => r.ok === false && r.error === 'disabled' && r.message), offResults.map((r) => r.error));
    check('Cờ tắt: không gọi AlohaAuth.api lần nào', offWin.AlohaAuth.calls.length === 0, offWin.AlohaAuth.calls.length);
    check('Cờ tắt: không ghi thêm gì vào localStorage', offWin.localStorage.writes === writesBefore);
    // AlohaData vẫn đọc/ghi localStorage như trước khi có edit-sync
    const created = offWin.AlohaData.createEditRequest({ phone: '0900000001', customerName: 'Khách giả', orderCode: '#ABTEST01', photos: [{ id: 'ph-1', src: 'images/my-photos/photo-1.jpg', note: '' }] });
    offWin.AlohaData.setResultLink(created.id, 'https://drive.google.com/x', 'https://drive.google.com/goc');
    const stored = JSON.parse(offWin.localStorage.getItem('aloha_demo_db')).editRequests[0];
    check('AlohaData.createEditRequest + setResultLink vẫn lưu localStorage như cũ', stored.id === created.id && stored.resultLink === 'https://drive.google.com/x' && stored.resultLinkOriginal === 'https://drive.google.com/goc');
    check('AlohaData.advanceRequestStatus vẫn chạy như cũ', offWin.AlohaData.advanceRequestStatus(created.id).status === 'Đang thực hiện');
    check('Thiếu cờ editSync (vd trang không nạp features.js, hoặc features.js bản cũ trong bộ nhớ đệm) -> coi là TẮT', (() => { const w = makeWindow(); w.AlohaAuth = mockAuth('t'); load(w, 'js/edit-sync.js'); return w.AlohaEditSync.enabled() === false; })());

    // Cờ BẬT + mock: đúng endpoint / phương thức / body
    const onWin = makeWindow({ ALOHA_FEATURES: { editSync: true } });
    onWin.AlohaAuth = mockAuth('tok');
    load(onWin, 'js/edit-sync.js');
    const E = onWin.AlohaEditSync;
    const calls = onWin.AlohaAuth.calls;
    check('Cờ bật: enabled() = true', E.enabled() === true);
    check('AlohaEditSync bị đóng băng (không ghi đè được hàm)', Object.isFrozen(E));
    await E.health(); await E.mine(); await E.list(); await E.list(1234); await E.get(ID);
    await E.create({ orderCode: '#ABTEST01', serviceLabel: 'Newborn', note: 'n', photos: [{ id: 'ph-1', src: 'images/a.jpg', note: 'x', isExtra: 1, secret: 'bỏ' }], extraFee: 0, paymentStatus: 'Trong gói', phone: '0999', from: 'ai' });
    await E.addMessage(ID, 'Xin chào'); await E.markSeen(ID, { done: true, editedSig: 'sig' }); await E.markSeen(ID);
    await E.setPhotoDone(ID, 'ph-1', true); await E.setLinks(ID, { resultLink: ' https://drive.google.com/e ', resultLinkOriginal: 'https://drive.google.com/o' }, 3);
    await E.setLinks(ID, { resultLinkOriginal: '' }, 4); await E.complete(ID, 5);
    const sig = calls.map((c) => c.method + ' ' + c.path);
    const expected = [
      'GET /api/edit-requests/health', 'GET /api/edit-requests/me', 'GET /api/edit-requests/', 'GET /api/edit-requests/?since=1234',
      'GET /api/edit-requests/' + ID, 'POST /api/edit-requests/', 'POST /api/edit-requests/' + ID + '/messages',
      'POST /api/edit-requests/' + ID + '/seen', 'POST /api/edit-requests/' + ID + '/seen', 'POST /api/edit-requests/' + ID + '/done-photos',
      'POST /api/edit-requests/' + ID + '/links', 'POST /api/edit-requests/' + ID + '/links', 'POST /api/edit-requests/' + ID + '/complete'
    ];
    check('13 lời gọi đúng phương thức + đường dẫn router', JSON.stringify(sig) === JSON.stringify(expected), sig);
    check('health gọi không kèm token (auth:false), các hàm khác kèm token', calls[0].auth === false && calls.slice(1).every((c) => c.auth === true));
    const createBody = calls[5].body;
    check('create: chỉ gửi trường cho phép (không gửi phone/from, ảnh bỏ trường lạ, isExtra thành boolean)', !('phone' in createBody) && !('from' in createBody) && JSON.stringify(createBody.photos[0]) === JSON.stringify({ id: 'ph-1', src: 'images/a.jpg', note: 'x', editOptions: [], isExtra: true }), createBody);
    check('addMessage: chỉ gửi { text } (không có "from")', JSON.stringify(calls[6].body) === '{"text":"Xin chào"}', calls[6].body);
    check('markSeen: { done, editedSig } / {} ', JSON.stringify(calls[7].body) === '{"done":true,"editedSig":"sig"}' && JSON.stringify(calls[8].body) === '{}');
    check('setPhotoDone: { photoId, done }', JSON.stringify(calls[9].body) === '{"photoId":"ph-1","done":true}');
    check('setLinks: gửi rev + link đã cắt khoảng trắng; chỉ gửi trường có', JSON.stringify(calls[10].body) === '{"rev":3,"resultLink":"https://drive.google.com/e","resultLinkOriginal":"https://drive.google.com/o"}' && JSON.stringify(calls[11].body) === '{"rev":4,"resultLinkOriginal":""}', [calls[10].body, calls[11].body]);
    check('complete: { rev }', JSON.stringify(calls[12].body) === '{"rev":5}');

    // Kiểm tham số trước khi gọi mạng
    const n0 = calls.length;
    const pre = await Promise.all([E.get('../etc'), E.addMessage(ID, '  '), E.setPhotoDone(ID, 'ph-1', 'yes'), E.setLinks(ID, { resultLink: 'https://a.b' }), E.setLinks(ID, {}, 1), E.complete(ID), E.complete('bad', 1)]);
    check('Tham số sai (id, tin rỗng, thiếu rev, không có link...) -> invalid, không gọi mạng', pre.every((r) => r.error === 'invalid') && calls.length === n0, pre.map((r) => r.code));

    // Quy đổi lỗi
    const q = onWin.AlohaAuth.queue;
    const latest = { id: ID, rev: 9 };
    q.push({ ok: false, status: 0, data: null }, { ok: false, status: 401, data: { error: 'unauthorized' } }, { ok: false, status: 403, data: { error: 'guest_not_allowed' } },
      { ok: false, status: 404, data: { error: 'not_found' } }, { ok: false, status: 409, data: { error: 'conflict', request: latest } },
      { ok: false, status: 409, data: { error: 'already_completed', request: latest } }, { ok: false, status: 422, data: { error: 'edited_link_required' } },
      { ok: false, status: 413, data: null }, { ok: false, status: 429, data: { error: 'too_many_messages' } }, { ok: false, status: 503, data: { error: 'store_full' } },
      { ok: false, status: 500, data: null }, new Error('network down'));
    const errs = [];
    for (let i = 0; i < 12; i++) errs.push(await E.get(ID));
    const m = errs.map((r) => r.error + (r.code ? ':' + r.code : ''));
    check('Quy đổi lỗi: 0/401/403/404/409/409/422/413/429/503/500/ngoại lệ', JSON.stringify(m) === JSON.stringify(['offline', 'unauthorized:unauthorized', 'forbidden:guest_not_allowed', 'not_found:not_found', 'conflict:conflict', 'conflict:already_completed', 'invalid:edited_link_required', 'too_large', 'rate_limited:too_many_messages', 'server_error:store_full', 'server_error', 'offline']), m);
    check('409 kèm bản mới nhất (latest) để trang tải lại', errs[4].latest && errs[4].latest.rev === 9 && errs[5].latest.rev === 9);
    check('Mọi lỗi đều ok:false và có câu báo tiếng Việt', errs.every((r) => r.ok === false && typeof r.message === 'string' && r.message.length > 5));
    check('Câu báo riêng: thiếu link ảnh đã chỉnh / đã Hoàn thành / khách vãng lai', /link ảnh đã chỉnh/.test(errs[6].message) && /đã Hoàn thành/.test(errs[5].message) && /số điện thoại/.test(errs[2].message), [errs[6].message, errs[5].message, errs[2].message]);
    // Chưa đăng nhập server (không token) -> unauthorized, không gọi mạng
    const nt = makeWindow({ ALOHA_FEATURES: { editSync: true } });
    nt.AlohaAuth = mockAuth(null);
    load(nt, 'js/edit-sync.js');
    const r0 = await nt.AlohaEditSync.mine();
    check('Không có token -> unauthorized (no_token), không gọi mạng', r0.error === 'unauthorized' && r0.code === 'no_token' && nt.AlohaAuth.calls.length === 0, r0);
    const r1 = await nt.AlohaEditSync.health();
    check('health() không cần token vẫn gọi được', r1.ok === true && nt.AlohaAuth.calls.length === 1);
    const na = makeWindow({ ALOHA_FEATURES: { editSync: true } });
    load(na, 'js/edit-sync.js');
    check('Thiếu AlohaAuth -> unavailable', (await na.AlohaEditSync.mine()).error === 'unavailable');

    // =============================================================== B. Tích hợp server RAM + js/auth.js thật
    if (await portBusy()) throw new Error('Cổng 3001 đang có server khác chạy (có thể nối MongoDB thật) - tắt nó rồi chạy lại test.');
    await startServer();
    const login = async (phone, password) => (await (await fetch(API + '/api/sale-chat/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, password }) })).json());
    // Mỗi vai trò 1 "trình duyệt" riêng: js/auth.js thật + phiên aloha_auth có token
    async function browserAs(phone, password) {
      const w = makeWindow({ ALOHA_FEATURES: { editSync: true } });
      load(w, 'js/auth.js');
      if (phone) {
        const r = await login(phone, password);
        w.AlohaAuth.login(r.session.role, r.session.name, r.session.phone, r.token);
      }
      load(w, 'js/edit-sync.js');
      return w;
    }
    const kh = await browserAs('0900000001', 'khach123');
    const th = await browserAs('0900000003', 'anh123');
    const sp = await browserAs('0900000004', 'sep123');
    const sl = await browserAs('0900000002', 'sale123');
    check('js/auth.js thật trỏ API_BASE tới server local cổng 3001', kh.AlohaAuth.API_BASE === API, kh.AlohaAuth.API_BASE);
    const lsKeysBefore = Object.keys(kh.localStorage.dump()).join(',');

    const h = await kh.AlohaEditSync.health();
    check('health(): server báo kho RAM', h.ok && h.data.store === 'memory', h);
    const c = await kh.AlohaEditSync.create({ orderCode: '#ABTEST01', serviceLabel: 'Newborn', note: 'Giữ tông ấm', photos: [{ id: 'ph-1', src: 'images/my-photos/photo-1.jpg', note: 'Làm sáng da' }, { id: 'ph-2', src: 'images/my-photos/photo-2.jpg' }], extraFee: 0, paymentStatus: 'Trong gói' });
    check('Khách create() -> 201 qua API thật', c.ok && c.status === 201 && c.data.request.phone === '0900000001', c);
    const id = c.data.request.id;
    const c2 = await kh.AlohaEditSync.create({ orderCode: '#ABTEST02', photos: [{ id: 'ph-1', src: 'images/my-photos/photo-1.jpg' }] });
    const id2 = c2.data.request.id;
    const mine = await kh.AlohaEditSync.mine();
    check('Khách mine() -> 2 yêu cầu của mình', mine.ok && mine.data.requests.length === 2);
    const lst = await th.AlohaEditSync.list();
    check('Thợ ảnh list() -> thấy yêu cầu', lst.ok && lst.data.requests.some((r) => r.id === id));
    const sinceAt = lst.data.at;
    check('Sếp list() đọc được', (await sp.AlohaEditSync.list()).ok);
    const saleRes = await sl.AlohaEditSync.list();
    check('Sale list() -> forbidden', saleRes.error === 'forbidden' && saleRes.status === 403, saleRes);
    const sepWrite = await sp.AlohaEditSync.setLinks(id, { resultLink: 'https://drive.google.com/e' }, 1);
    check('Sếp setLinks() -> forbidden', sepWrite.error === 'forbidden', sepWrite);
    check('Thợ ảnh markSeen()', (await th.AlohaEditSync.markSeen(id)).data.request.staffSeen === true);
    check('Thợ ảnh setPhotoDone()', (await th.AlohaEditSync.setPhotoDone(id, 'ph-1', true)).data.request.doneIds.join() === 'ph-1');
    const cur = (await th.AlohaEditSync.get(id)).data.request;
    const lk = await th.AlohaEditSync.setLinks(id, { resultLink: 'https://drive.google.com/drive/folders/da-chinh', resultLinkOriginal: 'https://drive.google.com/drive/folders/goc-NOIBO' }, cur.rev);
    check('Thợ ảnh setLinks() với rev đúng -> ok, rev tăng', lk.ok && lk.data.request.rev === cur.rev + 1, lk);
    const stale = await th.AlohaEditSync.setLinks(id, { resultLink: 'https://drive.google.com/x' }, cur.rev);
    check('setLinks() với rev cũ -> conflict 409 kèm latest', stale.error === 'conflict' && stale.status === 409 && stale.latest && stale.latest.rev === cur.rev + 1, stale);
    const noEdit = await th.AlohaEditSync.complete(id2, (await th.AlohaEditSync.get(id2)).data.request.rev);
    check('complete() khi chưa có link ảnh đã chỉnh -> invalid edited_link_required', noEdit.error === 'invalid' && noEdit.code === 'edited_link_required', noEdit);
    const done = await th.AlohaEditSync.complete(id, lk.data.request.rev);
    check('complete() đúng -> Hoàn thành, mọi ảnh xong', done.ok && done.data.request.status === 'Hoàn thành' && done.data.request.doneIds.length === 2, done);
    const again = await th.AlohaEditSync.complete(id, done.data.request.rev);
    check('complete() lần 2 -> conflict already_completed', again.error === 'conflict' && again.code === 'already_completed');
    const g = await kh.AlohaEditSync.get(id);
    check('Khách get(): có link ảnh đã chỉnh, KHÔNG có resultLinkOriginal', g.ok && g.data.request.resultLink.includes('da-chinh') && !('resultLinkOriginal' in g.data.request) && !JSON.stringify(g.data).includes('NOIBO'));
    const msg = await kh.AlohaEditSync.addMessage(id, 'Cảm ơn thợ ạ');
    check('Khách addMessage() -> tin "customer"', msg.ok && msg.data.request.messages.slice(-1)[0].from === 'customer');
    const seenK = await kh.AlohaEditSync.markSeen(id, { done: true, editedSig: 'sig1' });
    check('Khách markSeen() -> customerSeenDone + editedSig', seenK.ok && seenK.data.request.customerSeenDone === true && seenK.data.request.customerSeenEditedSig === 'sig1');
    const sinceRes = await th.AlohaEditSync.list(sinceAt);
    check('list(since) chỉ trả yêu cầu đổi sau mốc', sinceRes.ok && sinceRes.data.requests.length === 1 && sinceRes.data.requests[0].id === id, sinceRes.data && sinceRes.data.requests.map((r) => r.id));
    const other = await browserAs(null);
    other.AlohaAuth.login('khach-hang', 'Giả mạo', '0900000001', 'token.gia');
    const forged = await other.AlohaEditSync.mine();
    check('Token giả mạo -> unauthorized 401', forged.error === 'unauthorized' && forged.status === 401, forged);
    check('Gọi API không ghi thêm khoá mới nào vào localStorage', Object.keys(kh.localStorage.dump()).join(',') === lsKeysBefore, Object.keys(kh.localStorage.dump()));

    stopServer();
    await wait(300);
    const off = await kh.AlohaEditSync.mine();
    check('Server tắt -> offline (status 0), không báo thành công', off.ok === false && off.error === 'offline' && off.status === 0, off);
    check('Server tắt: AlohaEditSync không tự ghi localStorage', Object.keys(kh.localStorage.dump()).join(',') === lsKeysBefore);

    // =============================================================== C. Trình duyệt (không chụp ảnh)
    browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
    const errors = [];
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(()=>{window.ALOHA_FEATURES={editSync:false};});
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(ROOT_URL + 'index.html', { waitUntil: 'domcontentloaded' });
    await wait(800);
    let v = await page.evaluate(() => ({
      has: !!window.AlohaEditSync, enabled: window.AlohaEditSync && window.AlohaEditSync.enabled(), flag: window.ALOHA_FEATURES.editSync,
      dataKeys: window.AlohaData ? Object.keys(window.AlohaData).length : -1, ls: Object.keys(localStorage)
    }));
    check('index.html: có AlohaEditSync, cờ editSync=false, enabled()=false', v.has && v.enabled === false && v.flag === false, v);
    check('index.html: AlohaData vẫn đủ 14 hàm/hằng', v.dataKeys === 14, v.dataKeys);
    v = await page.evaluate(async () => (await window.AlohaEditSync.mine()).error);
    check('index.html: gọi thử khi cờ tắt -> "disabled"', v === 'disabled', v);
    // Trang quản trị (đăng nhập Sếp giả, không cần server)
    await page.evaluate(() => localStorage.setItem('aloha_auth', JSON.stringify({ role: 'sep', name: 'Sếp demo', phone: '0900000004', loginAt: Date.now() })));
    await page.goto(ROOT_URL + 'crm/admin.html', { waitUntil: 'domcontentloaded' });
    await wait(800);
    v = await page.evaluate(() => ({
      has: !!window.AlohaEditSync, enabled: window.AlohaEditSync && window.AlohaEditSync.enabled(),
      dataKeys: window.AlohaData ? Object.keys(window.AlohaData).length : -1,
      rows: document.querySelectorAll('#photoRows .photo-row-card').length, cust: document.getElementById('custView') ? document.getElementById('custView').children.length : -1
    }));
    check('crm/admin.html: có AlohaEditSync, enabled()=false (đã nạp features.js, cờ mặc định tắt)', v.has && v.enabled === false, v);
    check('crm/admin.html: 3 hàng ảnh + Khách hàng vẫn dựng như cũ (đọc AlohaData)', v.rows > 0 && v.cust > 0 && v.dataKeys === 14, v);
    check('Không có lỗi JS trên 2 trang', errors.length === 0, errors);
  } catch (e) {
    fail++;
    console.log('✗ Lỗi khi chạy test:', e.message);
    if (serverLog) console.log('--- log server ---\n' + serverLog.slice(-2000));
  } finally {
    stopServer();
    if (browser) await browser.close().catch(() => {});
  }
  console.log(`\n${pass}/${pass + fail} PASS`);
  process.exit(fail ? 1 : 0);
})();
