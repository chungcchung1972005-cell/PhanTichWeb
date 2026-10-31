// Test "tiền về thì máy chủ tự gửi ảnh cho thợ" + "Tiền chưa khớp" (2026-10-31). Chỉ gọi API, dữ liệu giả,
// kho RAM. Tự bật server/server.js ở cổng 3011 rồi tự tắt (không đụng npm start ở cổng 3001).
//   node _screenshots/test-pending-payment.js
const path = require('path');
const { spawn } = require('child_process');
const fixture = require('./workflow-fixture');

const ROOT = path.resolve(__dirname, '..');
const API = 'http://localhost:3011';
const BASE = '/api/edit-requests';
const KEY = 'test-sepay-key';
let pass = 0, fail = 0;
const check = (name, ok, extra) => {
  if (ok) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '→ ' + JSON.stringify(extra) : ''); }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let server = null, serverLog = '';
async function startServer() {
  await fixture.driveFixture();
  server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(ROOT, 'server'),
    env: { ...process.env, PORT: '3011', AUTH_SECRET: 'test-secret', MONGODB_URI: '', EDIT_REQUESTS_MONGODB_URI: '', GEMINI_API_KEY: '',
      ALLOWED_ORIGINS: '', SEPAY_WEBHOOK_KEY: KEY, EDIT_REQUESTS_ALLOW_PUBLIC_DEMO_STAFF: '1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', (d) => { serverLog += d; });
  server.stderr.on('data', (d) => { serverLog += d; });
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(API + '/api/health')).ok) return; } catch (e) { /* chưa lên */ }
    await wait(150);
  }
  throw new Error('Không bật được server test ở cổng 3011');
}
function stopServer() { if (server) { server.kill(); server = null; } }
process.on('exit', stopServer);

const call = (route, token, body) => fixture.json(API, route, token, body);
async function webhook(tx, key = KEY) {
  const r = await fetch(API + '/api/sepay-webhook', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Apikey ' + key },
    body: JSON.stringify({ transferType: 'in', ...tx }) });
  return { status: r.status, data: await r.json() };
}
const mine = async (t) => (await call(BASE + '/me', t)).data.requests;

(async () => {
  const timer = setTimeout(() => { console.log('✗ Hết giờ (90 giây)'); stopServer(); process.exit(1); }, 90000);
  try {
    await startServer();
    const customer = await fixture.login(API, '0900000001', 'khach123');
    const other = (await call('/api/sale-chat/auth/register', null, { phone: '0912345678', name: 'Khách khác', password: 'matkhau123' })).data.token;
    const sale = await fixture.login(API, '0900000002', 'sale123');
    const boss = await fixture.login(API, '0900000004', 'sep123');
    const worker = await fixture.login(API, '0900000003', 'anh123');
    const album = await fixture.sourceAlbum(API, { customer, worker, boss, sale, code: 'ABPAY01' });
    const pick = (a, b) => album.photos.slice(a, b).map((p) => ({ id: p.id, src: p.src }));
    const body = (photos, extraFee, paymentCode, extra) => ({ orderCode: album.orderCode, sourceAlbumId: album.id, photos, extraFee, paymentCode, ...extra });

    // ---- Lượt 1: 12 ảnh = 2 ảnh vượt = 100.000đ
    const code1 = 'ABPAY01CS2ABCD';
    let r = await call(BASE + '/pending', customer, body(pick(0, 12), 100000));
    check('Bản nháp thiếu mã thanh toán -> 402', r.status === 402, r);
    r = await call(BASE + '/pending', customer, body(pick(0, 12), 50000, code1));
    check('Bản nháp sai số tiền -> 400', r.status === 400 && r.data.error === 'bad_extra_fee', r);
    r = await call(BASE + '/pending', customer, body(pick(0, 12), 100000, 'ABPAY01CS9ZZZZ'));
    check('Bản nháp mã không đúng số ảnh -> 402', r.status === 402, r);
    r = await call(BASE + '/pending', customer, body(pick(0, 5), 0, ''));
    check('Trong gói miễn phí thì không cần bản nháp -> 400', r.status === 400 && r.data.error === 'no_payment_needed', r);
    r = await call(BASE + '/pending', other, body(pick(0, 12), 100000, code1));
    check('Khách khác không dùng được bộ ảnh của người khác', r.status === 400, r);
    r = await call(BASE + '/pending', customer, body(pick(0, 12), 100000, code1, { note: 'Làm da sáng' }));
    check('Lưu bản nháp chờ thanh toán', r.status === 201 && r.data.pending.status === 'waiting', r);
    check('Chưa có tiền thì chưa có yêu cầu', (await mine(customer)).length === 0);

    r = await webhook({ id: 'tx-sai-khoa', transferAmount: 100000, content: code1 }, 'sai-khoa');
    check('Webhook sai khoá -> 401', r.status === 401, r);
    r = await webhook({ id: 'tx-thieu', transferAmount: 50000, content: 'CK ' + code1 });
    check('Webhook chuyển thiếu được nhận', r.status === 200, r);
    check('Chuyển thiếu thì không tạo yêu cầu', (await mine(customer)).length === 0);

    r = await webhook({ id: 'tx-du', transferAmount: 100000, content: 'MBVCB.123 ' + code1.toLowerCase() + ' chuyen tien' });
    check('Webhook đủ tiền', r.status === 200 && r.data.success, r);
    let list = await mine(customer);
    check('Tiền về -> máy chủ tự tạo yêu cầu (khách không gọi gì thêm)', list.length === 1, list.length);
    const req1 = list[0] || {};
    check('Yêu cầu tự tạo đúng 12 ảnh, phí 100.000đ, đã xác nhận tiền', req1.photoCount === 12 && req1.extraFee === 100000 && req1.verifiedPayment && req1.verifiedPayment.reference === 'sepay:tx-du', req1);
    check('Giữ đúng ghi chú khách gõ', req1.note === 'Làm da sáng', req1.note);
    r = await call(BASE, worker);
    check('Thợ thấy yêu cầu ngay', r.status === 200 && r.data.requests.some((x) => x.id === req1.id), r.status);

    r = await webhook({ id: 'tx-du', transferAmount: 100000, content: code1 });
    check('SePay gửi lại cùng giao dịch -> báo trùng, không tạo thêm', r.data.duplicate === true && (await mine(customer)).length === 1, r);
    r = await call(BASE, customer, body(pick(0, 12), 100000, code1));
    check('Trang khách gửi lại cùng mã -> trả yêu cầu đã có, không tạo trùng', r.status === 200 && r.data.request.id === req1.id && r.data.existing === true, r);
    check('Vẫn chỉ 1 yêu cầu', (await mine(customer)).length === 1);
    r = await call(BASE + '/pending', customer, body(pick(0, 12), 100000, code1));
    check('Mở lại QR sau khi đã xong -> báo đã xong', r.status === 200 && r.data.pending.status === 'done' && r.data.pending.requestId === req1.id, r);

    // ---- Tiền về trước khi bản nháp tới (lượt 2, 2 ảnh mới = 100.000đ)
    const code2 = 'ABPAY01CS2WXYZ';
    r = await webhook({ id: 'tx-som', transferAmount: 100000, content: code2 });
    check('Tiền về sớm được ghi nhận', r.status === 200, r);
    r = await call(BASE + '/pending', customer, body(pick(12, 14), 100000, code2, { parentRequestId: req1.id }));
    check('Bản nháp tới sau tiền -> tạo yêu cầu ngay', r.status === 201 && r.data.pending.status === 'done' && r.data.request, r);
    check('Có 2 yêu cầu', (await mine(customer)).length === 2);

    // ---- Trang khách và SePay cùng lúc (lượt 3)
    const code3 = 'ABPAY01CS2PQRS';
    r = await call(BASE + '/pending', customer, body(pick(14, 16), 100000, code3));
    check('Bản nháp lượt 3', r.status === 201, r);
    await webhook({ id: 'tx-ba', transferAmount: 100000, content: code3 });
    const both = await Promise.all([call(BASE, customer, body(pick(14, 16), 100000, code3)), webhook({ id: 'tx-ba', transferAmount: 100000, content: code3 })]);
    const withCode3 = (await mine(customer)).filter((x) => x.paymentCode === code3);
    check('Gửi đồng thời vẫn chỉ 1 yêu cầu cho 1 mã', withCode3.length === 1 && both[0].status < 300, { n: withCode3.length, s: both[0].status });

    // ---- Tiền chưa khớp
    await webhook({ id: 'tx-trung', transferAmount: 100000, content: code1 });
    await webhook({ id: 'tx-la', transferAmount: 200000, content: 'chuyen tien an trua' });
    await webhook({ id: 'tx-thua', transferAmount: 150000, content: 'ABPAY01CS2MNOP' });
    r = await call(BASE + '/unmatched-payments', customer);
    check('Khách không xem được Tiền chưa khớp', r.status === 403, r.status);
    r = await call(BASE + '/unmatched-payments', worker);
    check('Thợ không xem được Tiền chưa khớp', r.status === 403, r.status);
    r = await call(BASE + '/unmatched-payments', sale);
    const byId = Object.fromEntries((r.data.payments || []).map((p) => [p.id, p]));
    check('Sale xem được Tiền chưa khớp', r.status === 200, r.status);
    check('Chuyển thiếu có lý do + tên khách', /thiếu 50\.000đ/.test(byId['tx-thieu']?.reason) && byId['tx-thieu']?.phone === '0900000001', byId['tx-thieu']);
    check('Chuyển trùng được báo', /trùng/.test(byId['tx-trung']?.reason), byId['tx-trung']);
    check('Nội dung lạ được báo không khớp', /không khớp/.test(byId['tx-la']?.reason), byId['tx-la']);
    check('Mã chưa có bản nháp được báo không khớp', /không khớp/.test(byId['tx-thua']?.reason), byId['tx-thua']);
    check('Khoản đã dùng đúng không nằm trong danh sách', !byId['tx-du'] && !byId['tx-som'] && !byId['tx-ba'], Object.keys(byId));
    check('Số khoản cần xử lý = 4', r.data.open === 4, r.data.open);
    r = await call(BASE + '/unmatched-payments', boss);
    check('Sếp xem được Tiền chưa khớp', r.status === 200 && r.data.open === 4, r.status);

    r = await call(BASE + '/unmatched-payments/tx-la/resolve', sale, {});
    check('Sale đánh dấu Đã xử lý', r.status === 200, r);
    r = await call(BASE + '/unmatched-payments/tx-khong-co/resolve', sale, {});
    check('Đánh dấu khoản không tồn tại -> 404', r.status === 404, r.status);
    r = await call(BASE + '/unmatched-payments', sale);
    check('Khoản đã xử lý ẩn khỏi danh sách mặc định', r.data.open === 3 && !r.data.payments.some((p) => p.id === 'tx-la'), r.data.open);
    r = await call(BASE + '/unmatched-payments?all=1', sale);
    const done = (r.data.payments || []).find((p) => p.id === 'tx-la');
    check('Xem tất cả vẫn thấy khoản đã xử lý kèm người xử lý', done && done.resolved && done.resolved.by, done);

    // ---- Mở QR mới thì bản nháp cũ thôi chờ
    const code4 = 'ABPAY01CS2EFGH', code5 = 'ABPAY01CS2JKLM';
    await call(BASE + '/pending', customer, body(pick(16, 18), 100000, code4));
    await call(BASE + '/pending', customer, body(pick(16, 18), 100000, code5));
    await webhook({ id: 'tx-ma-cu', transferAmount: 100000, content: code4 });
    check('Tiền về mã cũ đã thay -> không tạo yêu cầu', !(await mine(customer)).some((x) => x.paymentCode === code4));
    r = await call(BASE + '/unmatched-payments', sale);
    check('Tiền về mã cũ hiện trong Tiền chưa khớp', /đổi sang mã/.test((r.data.payments.find((p) => p.id === 'tx-ma-cu') || {}).reason), r.data.payments.find((p) => p.id === 'tx-ma-cu'));
  } catch (e) {
    fail++; console.log('✗ Lỗi không mong đợi:', e && e.stack || e);
    console.log(serverLog.slice(-2000));
  } finally {
    clearTimeout(timer);
    stopServer();
    console.log(`\n${pass} PASS, ${fail} FAIL`);
    process.exit(fail ? 1 : 0);
  }
})();
