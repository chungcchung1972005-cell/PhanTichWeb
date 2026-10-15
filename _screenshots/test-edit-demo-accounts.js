// Test cách ly tài khoản THỬ NGHIỆM + chặn Thợ ảnh/Sếp demo CÔNG KHAI ở API chỉnh ảnh. Test cách ly tài khoản THỬ NGHIỆM đồng bộ chỉnh ảnh (EDIT_DEMO_ACCOUNTS, server/sale-chat.js) khỏi
// chat Sale - CHỈ gọi API, không mở trình duyệt, không chụp ảnh, chỉ dữ liệu giả, kho RAM
// (MONGODB_URI='', không kết nối Atlas). Mật khẩu thử nghiệm sinh NGẪU NHIÊN mỗi lần chạy (không
// có trong mã nguồn). Tự bật server/server.js ở cổng 3001, tự tắt khi xong.
// Tắt server local của bạn (npm start) trước khi chạy. Cần đã chạy `npm ci` trong server/.
//   node _screenshots/test-edit-demo-accounts.js
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const API = 'http://localhost:3001';
let pass = 0, fail = 0;
const check = (name, ok, extra) => {
  if (ok) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '→ ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''); }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- Tài khoản thử nghiệm (giả, ngẫu nhiên)
const secretOf = () => crypto.randomBytes(9).toString('base64url');
function hashed(password) { // giống hashPassword trong server/sale-chat.js
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}
const PW = { tho: secretOf(), sep: secretOf(), khach: secretOf(), bad: secretOf() };
const PHONE = { tho: '0911000101', sep: '0911000102', khach: '0911000103', khach2: '0911000104' };
const H = { tho: hashed(PW.tho), sep: hashed(PW.sep), khach: hashed(PW.khach), khach2: hashed(PW.khach), bad: hashed(PW.bad) };
const ACCOUNTS = [
  { phone: PHONE.tho, role: 'tho-anh', name: 'Thợ thử nghiệm', ...H.tho },
  { phone: PHONE.sep, role: 'sep', name: 'Sếp thử nghiệm', ...H.sep },
  { phone: PHONE.khach, role: 'khach-hang', name: 'Khách thử nghiệm', ...H.khach },
  { phone: PHONE.khach2, role: 'khach-hang', name: 'Khách thử nghiệm 2', ...H.khach2 },
  // Các mục SAI phải bị bỏ qua:
  { phone: '0900000004', role: 'sep', name: 'Trùng Sếp demo', ...H.bad },           // trùng tài khoản demo công khai
  { phone: '0911000105', role: 'sale', name: 'Sale thử nghiệm', ...H.bad },          // vai trò sale không được phép
  { phone: '0911000106', role: 'tho-anh', name: 'Hash sai', salt: 'xyz', hash: 'abc' }, // salt/hash sai định dạng
  { phone: PHONE.tho, role: 'sep', name: 'Trùng SĐT', ...H.bad }                    // trùng SĐT trong danh sách
];
const SECRETS = [...Object.values(PW), ...Object.values(H).flatMap((h) => [h.salt, h.hash])];

// ---------------------------------------------------------------- Server test
let server = null;
let serverLog = '';
async function portBusy() {
  try { await fetch(API + '/api/health', { signal: AbortSignal.timeout(1500) }); return true; } catch (e) { return false; }
}
async function startServer(extraEnv) {
  server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(ROOT, 'server'),
    env: { ...process.env, PORT: '3001', AUTH_SECRET: 'test-secret', MONGODB_URI: '', GEMINI_API_KEY: '', ALLOWED_ORIGINS: '', EDIT_REQUESTS_MONGODB_URI: '', ...extraEnv },
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

// [status, json]
async function call(p, o = {}) {
  const headers = { 'content-type': 'application/json' };
  if (o.t) headers.authorization = 'Bearer ' + o.t;
  const r = await fetch(API + p, { method: o.m || (o.b ? 'POST' : 'GET'), headers, body: o.b ? JSON.stringify(o.b) : undefined });
  let data = null;
  try { data = await r.json(); } catch (e) { /* không phải JSON */ }
  return [r.status, data];
}
const login = (phone, password) => call('/api/sale-chat/auth/login', { b: { phone, password } });
const tokenOf = async (phone, password) => (await login(phone, password))[1].token;
const sc = (p) => '/api/sale-chat' + p;
const er = (p) => '/api/edit-requests' + p;

const newReq = () => ({
  orderCode: '#ABDEMO01', serviceLabel: 'Newborn', note: 'Ghi chú thử nghiệm',
  photos: [1, 2].map((i) => ({ id: 'ph-' + i, src: 'images/my-photos/photo-' + i + '.jpg', note: '', isExtra: false })),
  extraFee: 0, paymentStatus: 'Trong gói'
});

(async () => {
  try {
    if (await portBusy()) throw new Error('Cổng 3001 đang có server khác chạy - tắt nó rồi chạy lại test.');

    // ================================================================ A. Không đặt biến -> như cũ
    await startServer({ EDIT_DEMO_ACCOUNTS: '' });
    let [s, d] = await login(PHONE.tho, PW.tho);
    check('A1 không đặt EDIT_DEMO_ACCOUNTS: SĐT thử nghiệm không đăng nhập được', s === 401, [s, d]);
    [s] = await call(sc('/auth/register'), { b: { phone: PHONE.tho, name: 'Khách giả', password: 'matkhau123' } });
    check('A2 không đặt biến: đăng ký SĐT đó vẫn được như cũ', s === 200, s);
    stopServer();
    await wait(300);
    check('A3 không có log tài khoản thử nghiệm khi không đặt biến', !/Tài khoản thử nghiệm chỉnh ảnh/.test(serverLog));

    // ================================================================ B. JSON hỏng -> bỏ qua, server vẫn chạy
    serverLog = '';
    await startServer({ EDIT_DEMO_ACCOUNTS: '{khong-phai-json' });
    [s] = await login(PHONE.tho, PW.tho);
    check('B1 EDIT_DEMO_ACCOUNTS hỏng: server vẫn chạy, không cấp tài khoản nào', s === 401, s);
    check('B2 log báo JSON không hợp lệ', /EDIT_DEMO_ACCOUNTS không phải JSON hợp lệ/.test(serverLog));
    stopServer();
    await wait(300);

    // ================================================================ C. Có tài khoản thử nghiệm
    serverLog = '';
    await startServer({ EDIT_DEMO_ACCOUNTS: JSON.stringify(ACCOUNTS) });
    check('C0 log: đúng 4 tài khoản hợp lệ', /Tài khoản thử nghiệm chỉnh ảnh: 4 /.test(serverLog), serverLog);
    check('C0 log: 4 mục sai bị bỏ qua có lý do', ['#5 bị bỏ qua: trùng tài khoản demo công khai', '#6 bị bỏ qua: vai trò không được phép', '#7 bị bỏ qua: salt/hash sai định dạng', '#8 bị bỏ qua: trùng SĐT']
      .every((t) => serverLog.includes(t)), serverLog);

    // ---- Đăng nhập
    let r = await login(PHONE.tho, PW.tho);
    check('C1 Thợ thử nghiệm đăng nhập: role tho-anh, scope edit-demo', r[0] === 200 && r[1].session.role === 'tho-anh' && r[1].session.scope === 'edit-demo', r[1] && r[1].session);
    const tTho = r[1].token;
    r = await login(PHONE.sep, PW.sep);
    check('C2 Sếp thử nghiệm đăng nhập: role sep, scope edit-demo', r[0] === 200 && r[1].session.role === 'sep' && r[1].session.scope === 'edit-demo', r[1] && r[1].session);
    const tSep = r[1].token;
    const tKhach = await tokenOf(PHONE.khach, PW.khach);
    const tKhach2 = await tokenOf(PHONE.khach2, PW.khach);
    check('C3 Khách thử nghiệm đăng nhập được', !!tKhach && !!tKhach2);
    [s] = await login(PHONE.tho, PW.sep);
    check('C4 sai mật khẩu -> 401', s === 401, s);
    [s] = await login('0911000105', PW.bad);
    check('C5 mục vai trò sale (bị bỏ qua) không đăng nhập được', s === 401, s);
    [s] = await login('0911000106', PW.bad);
    check('C6 mục hash sai (bị bỏ qua) không đăng nhập được', s === 401, s);
    r = await login('0900000004', PW.bad);
    check('C7 mục trùng Sếp demo không chiếm được tài khoản demo (mật khẩu thử nghiệm bị từ chối)', r[0] === 401, r[0]);

    // Tài khoản hiện có (đăng nhập như cũ, token KHÔNG có scope)
    r = await login('0900000002', 'sale123');
    const tSale = r[1].token;
    check('C8 Sale demo đăng nhập như cũ, không có scope', r[0] === 200 && r[1].session.role === 'sale' && !r[1].session.scope);
    r = await login('0900000004', 'sep123');
    const tSepDemo = r[1].token;
    check('C9 Sếp demo đăng nhập như cũ, không có scope', r[0] === 200 && !r[1].session.scope);
    const tThoDemo = await tokenOf('0900000003', 'anh123');
    const tKhachDemo = await tokenOf('0900000001', 'khach123');
    const tGuest = (await call(sc('/auth/guest'), { b: {} }))[1].token;

    // ---- Dữ liệu chat "thật" (giả lập trong RAM): khách demo nhắn, Sale trả lời
    [s] = await call(sc('/me/messages'), { t: tKhachDemo, b: { text: 'Tin chat Sale (dữ liệu giả)', topic: 'Newborn' } });
    check('D0 khách demo vẫn nhắn Sale được (200)', s === 200, s);
    [s, d] = await call(sc('/inbox/0900000001/messages'), { t: tSale, b: { text: 'Sale trả lời (giả)' } });
    check('D0 Sale demo vẫn trả lời được (200)', s === 200, s);
    const before = (await call(sc('/inbox/0900000001'), { t: tSale }))[1].chat;

    // ---- Tài khoản thử nghiệm KHÔNG vào được chat Sale (mọi route có xác thực)
    const denied = [
      ['Sếp thử nghiệm GET /inbox', sc('/inbox'), { t: tSep }],
      ['Sếp thử nghiệm GET /inbox/:phone', sc('/inbox/0900000001'), { t: tSep }],
      ['Sếp thử nghiệm POST /inbox/:phone/messages', sc('/inbox/0900000001/messages'), { t: tSep, b: { text: 'x' } }],
      ['Sếp thử nghiệm POST /inbox/:phone/read', sc('/inbox/0900000001/read'), { t: tSep, b: {} }],
      ['Thợ thử nghiệm GET /inbox', sc('/inbox'), { t: tTho }],
      ['Thợ thử nghiệm GET /inbox/:phone', sc('/inbox/0900000001'), { t: tTho }],
      ['Thợ thử nghiệm POST /inbox/:phone/messages', sc('/inbox/0900000001/messages'), { t: tTho, b: { text: 'x' } }],
      ['Khách thử nghiệm GET /me', sc('/me'), { t: tKhach }],
      ['Khách thử nghiệm POST /me/messages', sc('/me/messages'), { t: tKhach, b: { text: 'x' } }],
      ['Khách thử nghiệm POST /me/handoff', sc('/me/handoff'), { t: tKhach, b: { summary: 'x' } }],
      ['Khách thử nghiệm POST /me/read', sc('/me/read'), { t: tKhach, b: {} }],
      ['Khách thử nghiệm GET /inbox', sc('/inbox'), { t: tKhach }]
    ];
    for (const [name, p, o] of denied) {
      [s, d] = await call(p, o);
      check('D1 ' + name + ' -> 403', s === 403 && d && d.error === 'forbidden', [s, d]);
    }
    const after = (await call(sc('/inbox/0900000001'), { t: tSale }))[1].chat;
    check('D2 chat Sale không bị đổi bởi tài khoản thử nghiệm (số tin, chưa đọc giữ nguyên)',
      after.messages.length === before.messages.length && after.staffUnread === before.staffUnread && after.customerUnread === before.customerUnread);
    const inbox = (await call(sc('/inbox'), { t: tSale }))[1].chats;
    check('D3 không có cuộc trò chuyện nào của SĐT thử nghiệm trong hộp thư Sale',
      !inbox.some((c) => Object.values(PHONE).includes(c.phone)), inbox.map((c) => c.phone));

    // Sửa token để bỏ scope -> chữ ký sai -> 401
    const [bodyPart, sigPart] = tSep.split('.');
    const payload = JSON.parse(Buffer.from(bodyPart, 'base64url').toString('utf8'));
    delete payload.scope;
    const forged = Buffer.from(JSON.stringify(payload)).toString('base64url') + '.' + sigPart;
    [s] = await call(sc('/inbox'), { t: forged });
    check('D4 tự xoá scope khỏi token (không có khoá ký) -> 401', s === 401, s);

    // ---- Đăng ký / Google không chiếm được SĐT thử nghiệm
    [s, d] = await call(sc('/auth/register'), { b: { phone: PHONE.sep, name: 'Kẻ lạ', password: 'matkhau123' } });
    check('E1 đăng ký bằng SĐT thử nghiệm -> 409 phone_taken', s === 409 && d.error === 'phone_taken', [s, d]);
    [s] = await call(sc('/auth/register'), { b: { phone: '0911000199', name: 'Khách giả mới', password: 'matkhau123' } });
    check('E2 đăng ký SĐT thường vẫn được (200)', s === 200, s);

    // ---- Quyền ở luồng hiện có giữ nguyên
    check('F1 Sale demo đọc hộp thư (200)', (await call(sc('/inbox'), { t: tSale }))[0] === 200);
    check('F2 Sếp demo vẫn xem hộp thư (200)', (await call(sc('/inbox'), { t: tSepDemo }))[0] === 200);
    check('F3 Sếp demo vẫn KHÔNG trả lời được (403)', (await call(sc('/inbox/0900000001/messages'), { t: tSepDemo, b: { text: 'x' } }))[0] === 403);
    check('F4 Thợ ảnh demo vẫn không vào hộp thư (403)', (await call(sc('/inbox'), { t: tThoDemo }))[0] === 403);
    check('F5 Khách demo đọc chat của mình (200)', (await call(sc('/me'), { t: tKhachDemo }))[0] === 200);
    check('F6 Khách vãng lai vẫn chat Sale được (200)', (await call(sc('/me'), { t: tGuest }))[0] === 200);
    check('F7 Sale demo vẫn bị chặn ở API chỉnh ảnh (403)', (await call(er('/'), { t: tSale }))[0] === 403);
    check('F8 Khách vãng lai vẫn bị chặn ở API chỉnh ảnh (403)', (await call(er('/me'), { t: tGuest }))[0] === 403);
    // C (2026-10-15): Thợ ảnh/Sếp demo CÔNG KHAI bị chặn ở API chỉnh ảnh (mặc định, không đặt cờ test)
    for (const [name, p, o] of [['Thợ ảnh demo GET /', er('/'), { t: tThoDemo }], ['Sếp demo GET /', er('/'), { t: tSepDemo }],
      ['Thợ ảnh demo GET /health không cần token', er('/health'), {}]]) {
      [s, d] = await call(p, o);
      if (p.endsWith('/health')) check('F9 ' + name + ' (200, không lộ dữ liệu)', s === 200, s);
      else check('F9 ' + name + ' -> 403 public_demo_staff_blocked', s === 403 && d && d.error === 'public_demo_staff_blocked', [s, d]);
    }
    check('F10 Khách demo 0900000001 KHÔNG bị chặn ở API chỉnh ảnh (200)', (await call(er('/me'), { t: tKhachDemo }))[0] === 200);

    // ---- Tài khoản thử nghiệm dùng được API chỉnh ảnh, đúng vai trò
    [s, d] = await call(er('/'), { t: tKhach, b: newReq() });
    check('G1 Khách thử nghiệm tạo yêu cầu (201), SĐT lấy từ token', s === 201 && d.request.phone === PHONE.khach, [s, d && d.error]);
    const id = d.request.id;
    check('G2 Khách thử nghiệm xem yêu cầu của mình (200)', (await call(er('/me'), { t: tKhach }))[1].requests.length === 1);
    check('G3 Khách thử nghiệm khác không xem được yêu cầu này (404)', (await call(er('/' + id), { t: tKhach2 }))[0] === 404);
    check('G4 Khách thử nghiệm không xem danh sách của thợ (403)', (await call(er('/'), { t: tKhach }))[0] === 403);
    check('G5 Sếp thử nghiệm đọc danh sách (200)', (await call(er('/'), { t: tSep }))[0] === 200);
    check('G6 Thợ thử nghiệm đọc danh sách (200)', (await call(er('/'), { t: tTho }))[0] === 200);
    const rev = (await call(er('/' + id), { t: tTho }))[1].request.rev;
    for (const [name, p, b] of [['nhắn tin', '/messages', { text: 'x' }], ['đánh dấu ảnh', '/done-photos', { photoId: 'ph-1', done: true }],
      ['lưu link', '/links', { resultLink: 'https://drive.google.com/drive/folders/test-demo', rev }], ['Hoàn tất', '/complete', { rev }]]) {
      check('G7 Sếp thử nghiệm KHÔNG ' + name + ' (403)', (await call(er('/' + id + p), { t: tSep, b }))[0] === 403);
    }
    check('G8 Thợ thử nghiệm nhắn khách (200)', (await call(er('/' + id + '/messages'), { t: tTho, b: { text: 'Thợ thử nghiệm nhắn' } }))[0] === 200);
    [s, d] = await call(er('/' + id + '/links'), { t: tTho, b: { resultLink: 'https://drive.google.com/drive/folders/test-demo', rev } });
    check('G9 Thợ thử nghiệm lưu link (200)', s === 200, [s, d && d.error]);
    [s, d] = await call(er('/' + id + '/complete'), { t: tTho, b: { rev: d.request.rev } });
    check('G10 Thợ thử nghiệm Hoàn tất (200)', s === 200 && d.request.status === 'Hoàn thành', [s, d && d.error]);
    check('G11 Sếp thử nghiệm thấy trạng thái mới', (await call(er('/' + id), { t: tSep }))[1].request.status === 'Hoàn thành');
    [s, d] = await call(er('/' + id), { t: tSepDemo });
    check('G12 Sếp demo công khai KHÔNG xem được yêu cầu đó (403)', s === 403 && d.error === 'public_demo_staff_blocked', [s, d]);
    for (const [name, p, b] of [['nhắn tin', '/messages', { text: 'x' }], ['lưu link', '/links', { resultLink: 'https://drive.google.com/drive/folders/x', rev: 0 }], ['Hoàn tất', '/complete', { rev: 0 }]]) {
      check('G13 Thợ ảnh demo công khai KHÔNG ' + name + ' (403)', (await call(er('/' + id + p), { t: tThoDemo, b }))[0] === 403);
    }
    check('G14 dữ liệu không đổi sau các lần bị chặn', (await call(er('/' + id), { t: tSep }))[1].request.messages.length === 1);

    // ---- Log không lộ bí mật
    stopServer();
    await wait(300);
    const allTokens = [tTho, tSep, tKhach, tKhach2, tSale, tSepDemo, tThoDemo, tKhachDemo, tGuest];
    check('H1 log server không chứa mật khẩu / salt / hash / token', ![...SECRETS, ...allTokens].some((x) => x && serverLog.includes(x)));
    check('H2 log server không ghi SĐT thử nghiệm', !Object.values(PHONE).some((p) => serverLog.includes(p)));

    // ================================================================ I. Cờ CHỈ DÀNH CHO TEST mở lại Thợ ảnh/Sếp demo
    serverLog = '';
    await startServer({ EDIT_DEMO_ACCOUNTS: '', EDIT_REQUESTS_ALLOW_PUBLIC_DEMO_STAFF: '1' });
    check('I1 log cảnh báo đang bật ngoại lệ demo công khai', /EDIT_REQUESTS_ALLOW_PUBLIC_DEMO_STAFF=1/.test(serverLog));
    const tTho2 = await tokenOf('0900000003', 'anh123');
    const tSep2 = await tokenOf('0900000004', 'sep123');
    check('I2 có cờ: Thợ ảnh demo đọc API chỉnh ảnh (200)', (await call(er('/'), { t: tTho2 }))[0] === 200);
    check('I3 có cờ: Sếp demo đọc API chỉnh ảnh (200)', (await call(er('/'), { t: tSep2 }))[0] === 200);
    check('I4 có cờ: Sếp demo vẫn KHÔNG ghi được (403 forbidden do vai trò)', (await call(er('/x/messages'), { t: tSep2, b: { text: 'x' } }))[0] === 403);
    check('I5 cờ không mở chat Sale cho Thợ ảnh demo (403)', (await call(sc('/inbox'), { t: tTho2 }))[0] === 403);
    stopServer();
    await wait(300);
    serverLog = '';
    await startServer({ EDIT_DEMO_ACCOUNTS: '', EDIT_REQUESTS_ALLOW_PUBLIC_DEMO_STAFF: 'true' });
    check('I6 giá trị khác "1" (vd "true") KHÔNG mở ngoại lệ (403)', (await call(er('/'), { t: await tokenOf('0900000003', 'anh123') }))[0] === 403);
    stopServer();
    await wait(300);

    // ================================================================ J. Thu hồi token thử nghiệm khi đổi EDIT_DEMO_ACCOUNTS
    // Cấp token với danh sách cũ, khởi động lại server (cùng AUTH_SECRET) với danh sách mới rồi dùng lại token cũ.
    const OLD = [ACCOUNTS[0], ACCOUNTS[1], ACCOUNTS[2]]; // Thợ, Sếp, Khách thử nghiệm
    await startServer({ EDIT_DEMO_ACCOUNTS: JSON.stringify(OLD) });
    const jTho = await tokenOf(PHONE.tho, PW.tho);
    const jSep = await tokenOf(PHONE.sep, PW.sep);
    const jKhach = await tokenOf(PHONE.khach, PW.khach);
    check('J0 cấp được token cho 3 tài khoản thử nghiệm và đều dùng được API', !!(jTho && jSep && jKhach)
      && (await call(er('/'), { t: jTho }))[0] === 200 && (await call(er('/'), { t: jSep }))[0] === 200 && (await call(er('/me'), { t: jKhach }))[0] === 200);
    stopServer();
    await wait(300);
    // Danh sách mới: XOÁ Thợ thử nghiệm; Sếp thử nghiệm ĐỔI vai trò thành tho-anh (giữ mật khẩu); Khách giữ nguyên
    await startServer({ EDIT_DEMO_ACCOUNTS: JSON.stringify([{ ...ACCOUNTS[1], role: 'tho-anh' }, ACCOUNTS[2]]) });
    [s, d] = await call(er('/'), { t: jTho });
    check('J1 tài khoản đã XOÁ: token cũ bị từ chối (401)', s === 401 && d && d.error === 'unauthorized', [s, d]);
    [s] = await call(er('/x/messages'), { t: jTho, b: { text: 'x' } });
    check('J1 tài khoản đã XOÁ: không ghi được (401)', s === 401, s);
    [s] = await login(PHONE.tho, PW.tho);
    check('J1 tài khoản đã XOÁ: không đăng nhập lại được (401)', s === 401, s);
    [s, d] = await call(er('/'), { t: jSep });
    check('J2 tài khoản ĐỔI vai trò (sep -> tho-anh): token cũ vai trò sep bị từ chối (401)', s === 401 && d && d.error === 'unauthorized', [s, d]);
    r = await login(PHONE.sep, PW.sep);
    check('J2 đăng nhập lại nhận vai trò MỚI tho-anh, scope edit-demo', r[0] === 200 && r[1].session.role === 'tho-anh' && r[1].session.scope === 'edit-demo', r[1] && r[1].session);
    check('J2 token mới dùng được API với vai trò mới (200)', (await call(er('/'), { t: r[1].token }))[0] === 200);
    check('J3 tài khoản KHÔNG đổi: token cũ vẫn dùng được (200)', (await call(er('/me'), { t: jKhach }))[0] === 200);
    check('J4 token thử nghiệm còn hiệu lực vẫn bị chat Sale chặn (403)', (await call(sc('/me'), { t: jKhach }))[0] === 403);
    const jSale = await tokenOf('0900000002', 'sale123');
    check('J5 token thường (Sale demo) không bị ảnh hưởng: hộp thư 200', (await call(sc('/inbox'), { t: jSale }))[0] === 200);
    check('J5 token thường (khách demo) không bị ảnh hưởng: API chỉnh ảnh 200', (await call(er('/me'), { t: await tokenOf('0900000001', 'khach123') }))[0] === 200);
  } catch (e) {
    fail++;
    console.log('✗ LỖI:', e.message);
  } finally {
    stopServer();
  }
  console.log('\n' + pass + '/' + (pass + fail) + ' PASS');
  process.exit(fail ? 1 : 0);
})();
