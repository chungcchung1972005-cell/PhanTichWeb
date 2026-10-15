// Test API yêu cầu chỉnh ảnh (server/edit-requests.js) - CHỈ gọi API, không mở trình duyệt, không
// chụp ảnh, chỉ dùng dữ liệu giả. Tự bật server/server.js ở cổng 3001 với kho RAM
// (MONGODB_URI='', không kết nối MongoDB Atlas), tự tắt server khi xong kể cả khi lỗi.
// Tắt server local của bạn (npm start) trước khi chạy. Cần đã chạy `npm ci` trong server/.
//   node _screenshots/test-edit-requests-api.js
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const API = 'http://localhost:3001';
const BASE = API + '/api/edit-requests';
let pass = 0, fail = 0;
const check = (name, ok, extra) => {
  if (ok) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '→ ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''); }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- Server test (RAM)
let server = null;
let serverLog = '';
async function portBusy() {
  try { await fetch(API + '/api/health', { signal: AbortSignal.timeout(1500) }); return true; } catch (e) { return false; }
}
async function startServer() {
  server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(ROOT, 'server'),
    env: { ...process.env, PORT: '3001', AUTH_SECRET: 'test-secret', MONGODB_URI: '', GEMINI_API_KEY: '', ALLOWED_ORIGINS: '' },
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

// [status, json] ; o.t = token, o.m = method, o.b = body (object) hoặc o.raw = chuỗi thô
async function call(p, o = {}) {
  const headers = { 'content-type': 'application/json' };
  if (o.t) headers.authorization = 'Bearer ' + o.t;
  const r = await fetch(BASE + p, { method: o.m || (o.b || o.raw ? 'POST' : 'GET'), headers, body: o.raw !== undefined ? o.raw : (o.b ? JSON.stringify(o.b) : undefined) });
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch (e) { /* không phải JSON */ }
  return [r.status, data, text];
}
async function login(phone, password) {
  const r = await fetch(API + '/api/sale-chat/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, password }) });
  return (await r.json()).token;
}

// Dữ liệu giả
const EDIT = 'https://drive.google.com/drive/folders/test-anh-da-chinh';
const ORIG = 'https://drive.google.com/drive/folders/test-anh-goc-NOIBO';
const photos = (n, extra = 0) => Array.from({ length: n }, (_, i) => ({ id: 'ph-' + (i + 1), src: 'images/my-photos/photo-' + (i + 1) + '.jpg', note: i === 0 ? 'Làm sáng da' : '', isExtra: i >= n - extra }));
const newReq = (over = {}) => Object.assign({ orderCode: '#ABTEST01', serviceLabel: 'Newborn', note: 'Ghi chú chung', photos: photos(3), extraFee: 0, paymentStatus: 'Trong gói' }, over);

(async () => {
  try {
    if (await portBusy()) throw new Error('Cổng 3001 đang có server khác chạy (có thể là npm start nối MongoDB thật) - tắt nó rồi chạy lại test.');
    // Router mới không được dùng MongoDB
    const src = fs.readFileSync(path.join(ROOT, 'server/edit-requests.js'), 'utf8');
    check('server/edit-requests.js không nạp thư viện mongodb', !/require\(['"]mongodb['"]\)/.test(src) && !/MongoClient/.test(src));
    await startServer();

    const [hs, health] = await call('/health');
    check('Router yêu cầu chỉnh ảnh báo kho RAM', hs === 200 && health.store === 'memory', health);
    const chatHealth = await (await fetch(API + '/api/health')).json();
    check('Server test không nối MongoDB (chat Sale cũng ở chế độ memory)', chatHealth.chatStore === 'memory', chatHealth);

    // Tài khoản (demo có sẵn trong server, khách thứ 2 đăng ký giả trong RAM, khách vãng lai)
    const khach = await login('0900000001', 'khach123');
    const tho = await login('0900000003', 'anh123');
    const sep = await login('0900000004', 'sep123');
    const sale = await login('0900000002', 'sale123');
    const reg = await (await fetch(API + '/api/sale-chat/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '0911111111', name: 'Khách giả B', password: 'matkhau123' }) })).json();
    const khachB = reg.token;
    const guest = (await (await fetch(API + '/api/sale-chat/auth/guest', { method: 'POST' })).json()).token;
    check('Lấy được token giả cho 6 tài khoản', [khach, tho, sep, sale, khachB, guest].every(Boolean));

    // ---------- 401 / 403 theo vai trò
    let s;
    [s] = await call('/'); check('Không token: GET / -> 401', s === 401, s);
    [s] = await call('/me'); check('Không token: GET /me -> 401', s === 401, s);
    [s] = await call('/', { b: newReq() }); check('Không token: POST / -> 401', s === 401, s);
    [s] = await call('/', { t: 'abc.def' }); check('Token giả mạo -> 401', s === 401, s);
    [s] = await call('/', { t: sale }); check('Sale: GET / -> 403', s === 403, s);
    [s] = await call('/me', { t: sale }); check('Sale: GET /me -> 403', s === 403, s);
    [s] = await call('/', { t: sale, b: newReq() }); check('Sale: POST / -> 403', s === 403, s);
    [s] = await call('/me', { t: guest }); check('Khách vãng lai: GET /me -> 403', s === 403, s);
    [s] = await call('/', { t: guest, b: newReq() }); check('Khách vãng lai: POST / -> 403', s === 403, s);
    [s] = await call('/', { t: khach }); check('Khách: GET / (danh sách nhân viên) -> 403', s === 403, s);

    // ---------- Khách tạo yêu cầu
    let d;
    [s, d] = await call('/', { t: khach, b: newReq({ phone: '0999999999', customerName: 'Giả mạo', from: 'ai' }) });
    check('Khách tạo yêu cầu -> 201', s === 201, s);
    const rA = d.request;
    check('SĐT + tên lấy từ token, bỏ qua phone/customerName gửi lên', rA.phone === '0900000001' && rA.customerName === 'Khách demo', { phone: rA.phone, name: rA.customerName });
    check('Yêu cầu mới: Chờ xử lý, rev 1, chưa phân công, 3 ảnh, 1 ghi chú riêng', rA.status === 'Chờ xử lý' && rA.rev === 1 && rA.photoCount === 3 && rA.photoNotes.length === 1, rA);
    check('Phản hồi tạo cho khách không có resultLinkOriginal / photographer', !('resultLinkOriginal' in rA) && !('photographer' in rA));
    [s, d] = await call('/', { t: khachB, b: newReq({ orderCode: '#ABTEST02', photos: photos(2) }) });
    const rB = d.request;
    check('Khách B tạo yêu cầu riêng -> 201', s === 201, s);

    // ---------- Khách không đọc được yêu cầu của khách khác
    [s, d] = await call('/me', { t: khach });
    check('Khách A: GET /me chỉ có yêu cầu của A', s === 200 && d.requests.length === 1 && d.requests[0].id === rA.id, d && d.requests.map((r) => r.phone));
    [s] = await call('/' + rB.id, { t: khach }); check('Khách A đọc yêu cầu của B -> 404', s === 404, s);
    [s] = await call('/' + rB.id + '/messages', { t: khach, b: { text: 'xin chào' } }); check('Khách A nhắn vào yêu cầu của B -> 404', s === 404, s);
    [s] = await call('/' + rB.id + '/seen', { t: khach, b: { done: true } }); check('Khách A đánh dấu đã xem yêu cầu của B -> 404', s === 404, s);
    [s] = await call('/ER-khongco-00000000', { t: tho }); check('Mã yêu cầu không tồn tại -> 404', s === 404, s);
    [s] = await call('/..%2F..%2Fetc', { t: tho }); check('Mã yêu cầu sai định dạng -> 404', s === 404, s);

    // ---------- Thợ ảnh + Sếp
    [s, d] = await call('/', { t: tho });
    check('Thợ ảnh: thấy cả 2 yêu cầu', s === 200 && d.requests.length === 2, d && d.requests.length);
    [s, d] = await call('/', { t: sep });
    check('Sếp: đọc được danh sách', s === 200 && d.requests.length === 2, s);
    [s] = await call('/' + rA.id + '/links', { t: sep, b: { resultLink: EDIT, rev: 1 } }); check('Sếp lưu link -> 403', s === 403, s);
    [s] = await call('/' + rA.id + '/complete', { t: sep, b: { rev: 1 } }); check('Sếp Hoàn tất -> 403', s === 403, s);
    [s] = await call('/' + rA.id + '/messages', { t: sep, b: { text: 'x' } }); check('Sếp nhắn khách -> 403', s === 403, s);
    [s] = await call('/' + rA.id + '/done-photos', { t: sep, b: { photoId: 'ph-1', done: true } }); check('Sếp đánh dấu ảnh -> 403', s === 403, s);
    [s] = await call('/' + rA.id + '/links', { t: sale, b: { resultLink: EDIT, rev: 1 } }); check('Sale lưu link -> 403', s === 403, s);
    [s] = await call('/' + rA.id + '/links', { t: khach, b: { resultLink: EDIT, rev: 1 } }); check('Khách tự lưu link -> 403', s === 403, s);
    [s] = await call('/' + rA.id + '/complete', { t: khach, b: { rev: 1 } }); check('Khách tự Hoàn tất -> 403', s === 403, s);

    // ---------- Link + rev (409) + link gốc không lộ cho khách
    [s, d] = await call('/' + rA.id + '/links', { t: tho, b: { resultLink: EDIT } }); check('Lưu link thiếu rev -> 400', s === 400 && d.error === 'rev_required', d);
    [s, d] = await call('/' + rA.id + '/links', { t: tho, b: { resultLink: 'javascript:alert(1)', rev: 1 } }); check('Link javascript: -> 400', s === 400 && d.error === 'bad_link', d);
    [s, d] = await call('/' + rA.id + '/links', { t: tho, b: { resultLinkOriginal: 'http://drive.google.com/x', rev: 1 } }); check('Link http (không s) -> 400', s === 400, d);
    [s, d] = await call('/' + rA.id + '/links', { t: tho, b: { resultLink: EDIT, resultLinkOriginal: ORIG, rev: 1 } });
    check('Thợ ảnh lưu 2 link với rev đúng -> 200, rev tăng', s === 200 && d.request.rev === 2 && d.request.resultLinkOriginal === ORIG && d.request.resultLinkAt > 0, d && d.request && d.request.rev);
    [s, d] = await call('/' + rA.id + '/links', { t: tho, b: { resultLink: EDIT + '-moi', rev: 1 } });
    check('Lưu link với rev cũ -> 409 kèm bản mới nhất', s === 409 && d.error === 'conflict' && d.request.rev === 2 && d.request.resultLink === EDIT, d);
    let raw;
    [s, d, raw] = await call('/me', { t: khach });
    check('Khách GET /me: thấy link ảnh đã chỉnh', d.requests[0].resultLink === EDIT);
    check('Khách GET /me: KHÔNG có resultLinkOriginal (kể cả trong chuỗi JSON thô)', !('resultLinkOriginal' in d.requests[0]) && !raw.includes('NOIBO'));
    [s, d, raw] = await call('/' + rA.id, { t: khach });
    check('Khách GET /:id: KHÔNG có resultLinkOriginal', s === 200 && !('resultLinkOriginal' in d.request) && !raw.includes('NOIBO'), s);
    [s, d] = await call('/' + rA.id, { t: sep });
    check('Sếp đọc được link ảnh gốc (nội bộ)', d.request.resultLinkOriginal === ORIG);

    // ---------- Hoàn tất
    [s, d] = await call('/' + rB.id + '/links', { t: tho, b: { resultLinkOriginal: ORIG, rev: 1 } });
    check('Yêu cầu B: chỉ lưu link ảnh gốc -> 200', s === 200, d);
    [s, d] = await call('/' + rB.id + '/complete', { t: tho, b: { rev: d.request.rev } });
    check('Hoàn tất khi chưa có link ảnh đã chỉnh -> 422, vẫn Chờ xử lý', s === 422 && d.error === 'edited_link_required', d);
    [s, d] = await call('/' + rB.id, { t: tho }); check('Yêu cầu B vẫn "Chờ xử lý"', d.request.status === 'Chờ xử lý', d.request.status);
    [s, d] = await call('/' + rA.id + '/complete', { t: tho, b: { rev: 1 } }); check('Hoàn tất với rev cũ -> 409', s === 409 && d.error === 'conflict', d);
    [s, d] = await call('/' + rA.id + '/complete', { t: tho, b: {} }); check('Hoàn tất thiếu rev -> 400', s === 400, d);
    [s, d] = await call('/' + rA.id + '/complete', { t: tho, b: { rev: 2 } });
    check('Hoàn tất đúng -> Hoàn thành, mọi ảnh tính là xong', s === 200 && d.request.status === 'Hoàn thành' && d.request.doneIds.length === 3, d && d.request);
    [s, d] = await call('/' + rA.id + '/complete', { t: tho, b: { rev: d.request.rev } }); check('Hoàn tất lần 2 -> 409 already_completed', s === 409 && d.error === 'already_completed', d);
    [s, d] = await call('/' + rA.id, { t: tho });
    [s] = await call('/' + rA.id + '/links', { t: tho, b: { resultLink: '', rev: d.request.rev } }); check('Không gỡ được link ảnh đã chỉnh sau Hoàn tất -> 409', s === 409, s);
    [s] = await call('/' + rA.id + '/done-photos', { t: tho, b: { photoId: 'ph-1', done: false } }); check('Không bỏ đánh dấu ảnh sau Hoàn tất -> 409', s === 409, s);

    // ---------- Tin nhắn: không giả được 'ai'
    [s, d] = await call('/' + rA.id + '/messages', { t: khach, b: { text: 'Giả trợ lý', from: 'ai', name: 'Trợ lý AI' } });
    let last = d.request.messages.slice(-1)[0];
    check('Khách gửi from:"ai" -> lưu là "customer", tên từ token', s === 200 && last.from === 'customer' && last.name === 'Khách demo', last);
    check('Tin trả cho khách không có cờ nội bộ needsStaff', !('needsStaff' in last));
    [s, d] = await call('/' + rA.id + '/messages', { t: tho, b: { text: 'Thợ trả lời', from: 'ai' } });
    last = d.request.messages.slice(-1)[0];
    check('Thợ ảnh gửi from:"ai" -> lưu là "staff"', s === 200 && last.from === 'staff', last);
    [s, d] = await call('/' + rA.id, { t: tho });
    check('Không có tin "ai" nào trong yêu cầu', !d.request.messages.some((m) => m.from === 'ai'));
    check('Tin của khách có needsStaff=true phía nhân viên', d.request.messages.find((m) => m.from === 'customer').needsStaff === true);

    // ---------- Đầu vào độc hại / sai
    [s, d] = await call('/', { t: khach, b: newReq({ photos: [{ id: 'ph-1', src: 'javascript:alert(1)' }] }) }); check('Ảnh src javascript: -> 400', s === 400 && d.error === 'bad_photos', d);
    [s] = await call('/', { t: khach, b: newReq({ photos: [{ id: 'ph-1', src: '../../server/.env' }] }) }); check('Ảnh src đường dẫn lạ -> 400', s === 400, s);
    [s] = await call('/', { t: khach, b: newReq({ photos: [{ id: '<img>', src: 'images/a.jpg' }] }) }); check('Mã ảnh chứa ký tự lạ -> 400', s === 400, s);
    [s] = await call('/', { t: khach, b: newReq({ photos: [] }) }); check('Không có ảnh -> 400', s === 400, s);
    [s] = await call('/', { t: khach, b: newReq({ photos: photos(201) }) }); check('Quá 200 ảnh -> 400', s === 400, s);
    [s] = await call('/', { t: khach, b: newReq({ photos: [{ id: 'a', src: 'images/a.jpg' }, { id: 'a', src: 'images/b.jpg' }] }) }); check('Mã ảnh trùng -> 400', s === 400, s);
    [s] = await call('/', { t: khach, b: newReq({ orderCode: '<script>' }) }); check('Mã đơn có ký tự lạ -> 400', s === 400, s);
    [s] = await call('/', { t: khach, b: newReq({ extraFee: -5 }) }); check('Phí âm -> 400', s === 400, s);
    [s] = await call('/', { t: khach, raw: '{"photos": [' }); check('JSON hỏng -> 400', s === 400, s);
    [s] = await call('/', { t: khach, raw: JSON.stringify(newReq({ note: 'x'.repeat(300 * 1024) })) }); check('Dữ liệu quá 200kb -> 413', s === 413, s);
    [s, d] = await call('/' + rA.id + '/messages', { t: khach, b: { text: 'x'.repeat(1501) } }); check('Tin quá 1500 ký tự -> 400', s === 400, d);
    [s] = await call('/' + rA.id + '/messages', { t: khach, b: { text: '   ' } }); check('Tin rỗng -> 400', s === 400, s);
    [s] = await call('/' + rA.id + '/messages', { t: khach, b: { text: 123 } }); check('Tin không phải chuỗi -> 400', s === 400, s);
    [s] = await call('/' + rA.id + '/messages', { t: khach, raw: '[1,2]' }); check('Thân là mảng -> 400', s === 400, s);
    const xss = '<img src=x onerror=alert(1)>';
    [s, d] = await call('/', { t: khachB, b: newReq({ orderCode: '#ABTEST03', note: xss + '\u0000\u0007', photos: [{ id: 'p1', src: 'images/my-photos/photo-1.jpg', note: xss }] }) });
    check('HTML lưu dạng chữ thuần (trả nguyên văn), ký tự điều khiển bị bỏ', s === 201 && d.request.note === xss && d.request.photos[0].note === xss, d && d.request && d.request.note);
    [s] = await call('/', { t: khachB, raw: '{"__proto__": {"polluted": "yes"}, "constructor": {"prototype": {"polluted2": "yes"}}, "photos": [{"id": "p1", "src": "images/a.jpg"}]}' });
    [, d] = await call('/health');
    check('Gửi __proto__/constructor không làm nhiễm đối tượng chung', ({}).polluted === undefined && d.polluted === undefined && d.polluted2 === undefined, s);

    // ---------- Thao tác đồng thời cơ bản
    [s, d] = await call('/', { t: khachB, b: newReq({ orderCode: '#ABTEST04', photos: photos(4) }) });
    const rC = d.request;
    const both = await Promise.all([
      call('/' + rC.id + '/links', { t: tho, b: { resultLink: EDIT + '-thoA', rev: rC.rev } }),
      call('/' + rC.id + '/links', { t: tho, b: { resultLink: EDIT + '-thoB', rev: rC.rev } })
    ]);
    const codes = both.map((x) => x[0]).sort();
    check('2 người lưu link cùng lúc với cùng rev -> 1 người 200, 1 người 409', JSON.stringify(codes) === '[200,409]', codes);
    [, d] = await call('/' + rC.id, { t: tho });
    const winner = both.find((x) => x[0] === 200)[1].request.resultLink;
    check('Link được giữ là của người thắng, không bị đè ngầm', d.request.resultLink === winner, d.request.resultLink);
    await Promise.all(['ph-1', 'ph-2', 'ph-3', 'ph-4'].map((id) => call('/' + rC.id + '/done-photos', { t: tho, b: { photoId: id, done: true } })));
    [, d] = await call('/' + rC.id, { t: tho });
    check('4 lượt đánh dấu 4 ảnh khác nhau cùng lúc -> đủ 4 ảnh', d.request.doneIds.length === 4 && new Set(d.request.doneIds).size === 4, d.request.doneIds);
    await Promise.all(Array.from({ length: 10 }, (_, i) => call('/' + rC.id + '/messages', { t: i % 2 ? tho : khachB, b: { text: 'tin ' + i } })));
    [, d] = await call('/' + rC.id, { t: tho });
    check('10 tin nhắn gửi cùng lúc -> đủ 10 tin, không mất', d.request.messages.length === 10, d.request.messages.length);
    const revBefore = d.request.rev;
    [s, d] = await call('/' + rC.id + '/links', { t: tho, b: { resultLink: EDIT, rev: revBefore - 1 } });
    check('Sau loạt thao tác, rev cũ hơn 1 bậc vẫn bị 409', s === 409, s);

    // ---------- Đánh dấu đã xem + ?since
    const t0 = Date.now();
    await wait(5);
    [s, d] = await call('/' + rB.id + '/seen', { t: tho, b: {} }); check('Thợ ảnh đánh dấu đã xem -> staffSeen', s === 200 && d.request.staffSeen === true, d);
    [s, d] = await call('/?since=' + t0, { t: tho });
    check('GET /?since=<mốc> chỉ trả yêu cầu đổi sau mốc', s === 200 && d.requests.length === 1 && d.requests[0].id === rB.id, d && d.requests.map((r) => r.id));
    [s, d] = await call('/' + rA.id + '/seen', { t: khach, b: { done: true, editedSig: 'abc' } });
    check('Khách đánh dấu đã xem thông báo Hoàn thành', s === 200 && d.request.customerSeenDone === true && d.request.customerSeenEditedSig === 'abc', d);
    [s, d] = await call('/' + rA.id + '/seen', { t: khach, b: { done: true } });
    check('Phản hồi đánh dấu đã xem của khách vẫn không có link gốc', !('resultLinkOriginal' in d.request));

    // ---------- "Đã xem" không tăng rev (sửa 2026-10-15), nhưng vẫn lưu cờ + vẫn bắt xung đột thật
    [s, d] = await call('/', { t: khachB, b: newReq({ orderCode: '#ABTEST05', photos: photos(2) }) });
    const rD = d.request;
    [s, d] = await call('/' + rD.id, { t: tho });
    const R = d.request.rev;
    const upd0 = d.request.updatedAt;
    await wait(5);
    [s, d] = await call('/' + rD.id + '/seen', { t: khachB, b: { editedSig: 'sig-khach-1' } });
    check('Khách đánh dấu đã xem -> 200, rev KHÔNG đổi', s === 200 && d.request.rev === R, d && d.request && d.request.rev);
    [s, d] = await call('/' + rD.id, { t: tho });
    check('Cờ đã xem của khách được lưu trên server, updatedAt có đổi', d.request.customerSeenEditedSig === 'sig-khach-1' && d.request.updatedAt > upd0, { sig: d.request.customerSeenEditedSig });
    [s, d] = await call('/' + rD.id + '/seen', { t: tho, b: {} });
    check('Thợ ảnh đánh dấu đã xem -> staffSeen lưu, rev KHÔNG đổi', s === 200 && d.request.staffSeen === true && d.request.rev === R, d.request.rev);
    const upd1 = d.request.updatedAt;
    await wait(5);
    [s, d] = await call('/' + rD.id + '/seen', { t: tho, b: {} });
    check('Đã xem lại lần nữa (không có gì đổi) -> updatedAt giữ nguyên', d.request.updatedAt === upd1);
    [s, d] = await call('/' + rD.id + '/seen', { t: khach, b: { editedSig: 'gia' } });
    check('Khách A đánh dấu đã xem yêu cầu của khách B -> 404, cờ của B không đổi', s === 404);
    [s, d] = await call('/' + rD.id, { t: tho });
    check('Cờ đã xem của B vẫn là của B', d.request.customerSeenEditedSig === 'sig-khach-1');
    // Phiên Thợ ảnh mở yêu cầu (rev R) TRƯỚC khi khách/thợ đánh dấu đã xem -> lưu link vẫn được
    [s, d] = await call('/' + rD.id + '/links', { t: tho, b: { resultLink: EDIT, rev: R } });
    check('Lưu link với rev đọc TRƯỚC lúc đánh dấu đã xem -> 200, không 409 giả', s === 200 && d.request.rev === R + 1, s);
    [s, d] = await call('/' + rD.id + '/seen', { t: khachB, b: { editedSig: 'sig-khach-2' } });
    check('Khách xem link mới -> rev vẫn R+1', d.request.rev === R + 1);
    // Xung đột THẬT vẫn bị bắt: phiên giữ rev R (cũ hơn lần lưu link) -> 409
    [s, d] = await call('/' + rD.id + '/links', { t: tho, b: { resultLinkOriginal: ORIG, rev: R } });
    check('Phiên Thợ ảnh khác còn giữ rev cũ (trước lần lưu link) -> 409', s === 409 && d.error === 'conflict' && d.request.rev === R + 1, s);
    // 2 phiên Thợ ảnh cùng sửa dữ liệu nghiệp vụ với cùng rev, xen giữa là "đã xem" -> đúng 1 phiên thắng
    await call('/' + rD.id + '/seen', { t: khachB, b: { editedSig: 'sig-khach-3' } });
    const duo = await Promise.all([
      call('/' + rD.id + '/links', { t: tho, b: { resultLink: EDIT + '-phien1', rev: R + 1 } }),
      call('/' + rD.id + '/links', { t: tho, b: { resultLink: EDIT + '-phien2', rev: R + 1 } })
    ]);
    check('2 phiên cùng lưu link (cùng rev, có "đã xem" xen giữa) -> 1 phiên 200, 1 phiên 409', JSON.stringify(duo.map((x) => x[0]).sort()) === '[200,409]', duo.map((x) => x[0]));
    [s, d] = await call('/' + rD.id, { t: tho });
    [s, d] = await call('/' + rD.id + '/seen', { t: khachB, b: { editedSig: 'sig-khach-4' } });
    const revBeforeComplete = d.request.rev;
    [s, d] = await call('/' + rD.id + '/complete', { t: tho, b: { rev: revBeforeComplete } });
    check('Hoàn tất với rev đọc trước lúc khách đánh dấu đã xem -> 200', s === 200 && d.request.status === 'Hoàn thành', s);
    [s, d] = await call('/' + rD.id + '/seen', { t: khachB, b: { done: true } });
    check('Khách xem thông báo Hoàn thành -> customerSeenDone lưu, rev không đổi', s === 200 && d.request.customerSeenDone === true && d.request.rev === revBeforeComplete + 1);

    // ---------- Tin nhắn không tăng rev (sửa 2026-10-15), vẫn lưu đúng thứ tự + vẫn bắt xung đột thật
    [s, d] = await call('/', { t: khach, b: newReq({ orderCode: '#ABTEST06', photos: photos(2) }) });
    const rE = d.request;
    [s, d] = await call('/' + rE.id, { t: tho });
    const RE = d.request.rev;
    const updE = d.request.updatedAt;
    await wait(5);
    [s, d] = await call('/' + rE.id + '/messages', { t: khach, b: { text: 'Tin 1 cua khach' } });
    check('Khách nhắn -> 200, rev KHÔNG đổi', s === 200 && d.request.rev === RE, d && d.request && d.request.rev);
    [s, d] = await call('/' + rE.id + '/messages', { t: tho, b: { text: 'Tin 2 cua tho' } });
    check('Thợ ảnh nhắn -> 200, rev KHÔNG đổi', s === 200 && d.request.rev === RE, d.request.rev);
    [s, d] = await call('/' + rE.id + '/messages', { t: khach, b: { text: 'Tin 3 gia tro ly', from: 'ai', name: 'Tro ly' } });
    check('Khách gửi from:"ai" -> vẫn lưu là "customer", tên từ token, rev không đổi', s === 200 && d.request.messages.slice(-1)[0].from === 'customer' && d.request.messages.slice(-1)[0].name === 'Khách demo' && d.request.rev === RE);
    [s, d] = await call('/' + rE.id, { t: tho });
    const ms = d.request.messages;
    check('3 tin lưu đúng thứ tự gửi, đúng người gửi', JSON.stringify(ms.map((m) => [m.from, m.text])) === JSON.stringify([['customer', 'Tin 1 cua khach'], ['staff', 'Tin 2 cua tho'], ['customer', 'Tin 3 gia tro ly']]) && ms.every((m, i) => i === 0 || m.at >= ms[i - 1].at), ms.map((m) => m.text));
    check('Có tin mới -> updatedAt đổi, rev giữ nguyên', d.request.updatedAt > updE && d.request.rev === RE);
    [s, d] = await call('/?since=' + updE, { t: tho });
    check('GET /?since= lấy được yêu cầu vừa có tin mới', d.requests.some((r) => r.id === rE.id));
    [s, d] = await call('/' + rE.id + '/links', { t: tho, b: { resultLink: EDIT, rev: RE } });
    check('Lưu link bằng rev đọc TRƯỚC khi có tin nhắn -> 200, không 409 giả', s === 200 && d.request.rev === RE + 1, s);
    [s, d] = await call('/' + rE.id + '/links', { t: tho, b: { resultLinkOriginal: ORIG, rev: RE } });
    check('Phiên giữ rev cũ hơn lần lưu link -> 409 như trước', s === 409 && d.error === 'conflict', s);
    const trio = await Promise.all([
      call('/' + rE.id + '/links', { t: tho, b: { resultLink: EDIT + '-p1', rev: RE + 1 } }),
      call('/' + rE.id + '/messages', { t: khach, b: { text: 'Tin xen giua' } }),
      call('/' + rE.id + '/links', { t: tho, b: { resultLink: EDIT + '-p2', rev: RE + 1 } })
    ]);
    check('2 phiên cùng lưu link (có tin nhắn xen giữa) -> 1 phiên 200, 1 phiên 409; tin nhắn vẫn 200', JSON.stringify([trio[0][0], trio[2][0]].sort()) === '[200,409]' && trio[1][0] === 200, trio.map((x) => x[0]));
    [s, d] = await call('/' + rE.id, { t: tho });
    check('Tin xen giữa được lưu, rev chỉ tăng 1 (từ lần lưu link thắng)', d.request.messages.slice(-1)[0].text === 'Tin xen giua' && d.request.rev === RE + 2, d.request.rev);
    // Phân quyền + kiểm tra nội dung của /messages vẫn giữ nguyên
    [s] = await call('/' + rE.id + '/messages', { b: { text: 'x' } }); check('Nhắn không token -> 401', s === 401, s);
    [s] = await call('/' + rE.id + '/messages', { t: sale, b: { text: 'x' } }); check('Sale nhắn -> 403', s === 403, s);
    [s] = await call('/' + rE.id + '/messages', { t: sep, b: { text: 'x' } }); check('Sếp nhắn -> 403', s === 403, s);
    [s] = await call('/' + rE.id + '/messages', { t: guest, b: { text: 'x' } }); check('Khách vãng lai nhắn -> 403', s === 403, s);
    [s] = await call('/' + rE.id + '/messages', { t: khachB, b: { text: 'x' } }); check('Khách B nhắn vào yêu cầu của khách A -> 404', s === 404, s);
    [s] = await call('/' + rE.id + '/messages', { t: khach, b: { text: 'x'.repeat(1501) } }); check('Tin quá dài -> 400', s === 400, s);
    [s, d] = await call('/' + rE.id, { t: tho });
    check('Các lượt bị từ chối không thêm tin, không đổi rev', d.request.messages.length === 4 && d.request.rev === RE + 2, { n: d.request.messages.length, rev: d.request.rev });
    let got429m = false, n429 = 0;
    for (let i = 0; i < 35 && !got429m; i++) { [s] = await call('/' + rE.id + '/messages', { t: khach, b: { text: 'spam ' + i } }); if (s === 429) { got429m = true; n429 = i; } }
    [s, d] = await call('/' + rE.id, { t: tho });
    check('Nhắn dồn dập -> 429 (giới hạn 30 tin/phút vẫn còn), rev vẫn không đổi', got429m && d.request.rev === RE + 2, { n429, rev: d.request.rev });

    // ---------- Giới hạn tần suất tạo yêu cầu (5 lượt HỢP LỆ/phút/tài khoản; A đã tạo 1, lượt gửi sai không bị đếm)
    let got429 = false;
    for (let i = 0; i < 8 && !got429; i++) { [s] = await call('/', { t: khach, b: newReq() }); if (s === 429) got429 = true; }
    check('Tạo yêu cầu dồn dập -> bị chặn 429', got429);

    // ---------- Chat Sale không bị ảnh hưởng
    const r = await fetch(API + '/api/sale-chat/inbox', { headers: { authorization: 'Bearer ' + sale } });
    check('API chat Sale vẫn chạy (Sale đọc hộp thư -> 200)', r.status === 200, r.status);
  } catch (e) {
    fail++;
    console.log('✗ Lỗi khi chạy test:', e.message);
    if (serverLog) console.log('--- log server ---\n' + serverLog.slice(-2000));
  } finally {
    stopServer();
  }
  console.log(`\n${pass}/${pass + fail} PASS`);
  process.exit(fail ? 1 : 0);
})();
