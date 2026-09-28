// Test "Ảnh chọn thêm chờ thanh toán 30 phút" (Ảnh của tôi, người dùng chốt 2026-09-28):
// gửi yêu cầu -> 10 ảnh trong gói tới thợ NGAY, ảnh chọn thêm chờ thanh toán mã QR trong 30 phút;
// thanh toán trong hạn -> ảnh chọn thêm tự gửi tiếp cho thợ; quá hạn -> không được gửi đi.
// Không cần server: máy chủ báo thanh toán (:3001/api/payment-status) được giả lập ngay trong test.
//   node _screenshots/test-extra-pay.js
const puppeteer = require('puppeteer-core');
const path = require('path');
const { CHROME_PATH, ROOT_URL } = require('./test-env');

let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '→ ' + extra : ''); }
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const shot = (name) => path.resolve(__dirname, name);

// Kết quả máy chủ trả cho mỗi lần trang hỏi "đã có tiền chưa": 'unpaid' | 'paid' | 'abort' (mất mạng)
let payMode = 'unpaid';
let payPolls = 0;
let lastPayUrl = '';
const LATE = 2 * 60 * 1000; // thời gian chờ báo chậm sau hạn (AlohaData.EXTRA_PAY_LATE_MS)

async function preparePage(browser, errors) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.dismiss());
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const url = r.url();
    if (url.includes(':3001/api/payment-status')) {
      payPolls++;
      lastPayUrl = url;
      if (payMode === 'abort') return r.abort();
      return r.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ paid: payMode === 'paid' }) });
    }
    if (url.includes(':3001') || url.includes('onrender.com')) return r.abort();
    return r.continue();
  });
  return page;
}

async function login(page, phone, pass) {
  await page.goto(ROOT_URL + 'login.html', { waitUntil: 'networkidle0' });
  await page.type('#loginPhone', phone);
  await page.type('#loginPassword', pass);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('#loginSubmitBtn')]);
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const page = await preparePage(browser, errors);

  const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('aloha_demo_db')) || {});
  const req0 = async () => ((await db()).editRequests || [])[0] || null;
  const shown = (sel) => page.$eval(sel, el => el.classList.contains('show'));
  const heart = (id) => page.evaluate((i) => document.querySelector(`.ps-photo[data-id="${i}"] .ps-heart`).click(), id);
  const text = (sel) => page.$eval(sel, el => el.textContent.replace(/\s+/g, ' ').trim());
  const setDeadline = (ms) => page.evaluate((ms) => {
    const d = JSON.parse(localStorage.getItem('aloha_demo_db'));
    d.editRequests[0].extraPending.deadline = Date.now() + ms;
    localStorage.setItem('aloha_demo_db', JSON.stringify(d));
  }, ms);

  // Khách mới tinh: xoá dữ liệu, đăng nhập, chọn 10 ảnh gói + 2 ảnh chọn thêm (#11, #12)
  async function freshCustomerWith12() {
    await page.goto(ROOT_URL + 'login.html', { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await login(page, '0900000001', 'khach123');
    if (!page.url().includes('#/chon-anh')) await page.goto(page.url().split('#')[0] + '#/chon-anh');
    await wait(700);
    for (let n = 1; n <= 10; n++) await heart('ph-' + n);
    await heart('ph-11'); await wait(250);
    await page.evaluate(() => document.querySelector('.ps-modal-overlay.show .ps-modal-yes').click()); await wait(250);
    await heart('ph-12'); await wait(250);
  }
  async function sendWithExtras() {
    await page.evaluate(() => document.getElementById('psSubmitBtn').click()); await wait(300);
    await page.click('#psReviewConfirm'); await wait(600);
  }

  // ================= A. Gửi -> 10 ảnh gói tới thợ ngay, ảnh chọn thêm chờ thanh toán =================
  payMode = 'unpaid';
  await freshCustomerWith12();
  // Ghi chú riêng cho ảnh chọn thêm #12 (phải đi theo ảnh khi được gửi)
  await page.evaluate(() => document.querySelector('.ps-photo[data-id="ph-12"] img').click());
  await page.waitForFunction(() => !document.getElementById('psLbNoteWrap').hidden, { timeout: 3000 });
  await page.type('#psLbNote', 'Xoá vết đỏ trên má');
  await page.keyboard.press('Escape'); await wait(300);

  let v = await text('#psExtra');
  check('Ô "Vượt 2 ảnh" nhắc trước: thanh toán trong 30 phút sau khi gửi, quá hạn không được gửi', v.includes('Vượt 2 ảnh') && v.includes('30 phút') && v.includes('không được gửi'), v);

  await page.evaluate(() => document.getElementById('psSubmitBtn').click()); await wait(300);
  v = await page.evaluate(() => ({
    pay: document.getElementById('psReviewPay').hidden ? '' : document.getElementById('psReviewPay').textContent.replace(/\s+/g, ' '),
    confirm: document.getElementById('psReviewConfirm').textContent
  }));
  check('Xem lại: báo 10 ảnh gói gửi ngay + 2 ảnh chọn thêm (100.000đ) thanh toán trong 30 phút', v.pay.includes('10 ảnh trong gói được gửi cho thợ ngay') && v.pay.includes('2 ảnh chọn thêm (100.000đ)') && v.pay.includes('30 phút') && v.pay.includes('không được gửi đi'), v.pay);
  check('Xem lại: nút chính "Gửi & thanh toán 100.000đ"', v.confirm === 'Gửi & thanh toán 100.000đ', v.confirm);
  check('Chưa bấm xác nhận -> chưa gửi gì', ((await db()).editRequests || []).length === 0);
  await page.screenshot({ path: shot('pay-review-desktop.png') });
  await page.setViewport({ width: 360, height: 640 }); await wait(300);
  v = await page.evaluate(() => {
    const m = document.querySelector('#psReviewModal .ps-modal').getBoundingClientRect();
    const b = document.getElementById('psReviewConfirm').getBoundingClientRect();
    return { l: m.left, r: m.right, btn: Math.round(b.bottom), btnTop: Math.round(b.top), vw: innerWidth, vh: innerHeight };
  });
  check('Màn 360x640: hộp xem lại có lời nhắc thanh toán vẫn thấy nút gửi', v.l >= 0 && v.r <= v.vw && v.btn <= v.vh && v.btnTop > 0, JSON.stringify(v));
  await page.screenshot({ path: shot('pay-review-small.png') });
  await page.setViewport({ width: 1440, height: 900 }); await wait(300);

  const tSend = Date.now();
  await page.click('#psReviewConfirm'); await wait(600);
  let r = await req0();
  v = r && { n: (await db()).editRequests.length, ids: r.photos.map(p => p.id).join(','), count: r.photoCount, extraCount: r.extraCount,
    pend: r.extraPending && { count: r.extraPending.count, fee: r.extraPending.fee, ids: r.extraPending.photos.map(p => p.id + ':' + (p.note || '')).join(','), left: r.extraPending.deadline - tSend },
    notes: r.photoNotes.map(n => n.id).join(',') };
  check('Bấm xác nhận -> tạo NGAY 1 yêu cầu chỉ gồm 10 ảnh trong gói (#1..#10)', !!v && v.n === 1 && v.ids === Array.from({ length: 10 }, (_, i) => 'ph-' + (i + 1)).join(',') && v.count === 10 && v.extraCount === 0, JSON.stringify(v));
  check('2 ảnh chọn thêm (#11, #12 kèm ghi chú) nằm chờ thanh toán 100.000đ, hạn 30 phút', !!v && !!v.pend && v.pend.count === 2 && v.pend.fee === 100000 && v.pend.ids === 'ph-11:,ph-12:Xoá vết đỏ trên má' && v.pend.left > 29.5 * 60000 && v.pend.left <= 30 * 60000 + 1000, JSON.stringify(v && v.pend));
  check('Ghi chú của ảnh chọn thêm chưa vào yêu cầu thợ đang thấy', !!v && !v.notes.includes('ph-12'), v && v.notes);

  v = await page.evaluate(() => ({
    qr: document.getElementById('psQrModalOverlay').classList.contains('show'),
    sub: document.getElementById('psQrSubtitle').textContent.replace(/\s+/g, ' '),
    label: document.getElementById('psQrCountdownLabel').textContent,
    time: document.getElementById('psQrCountdownTime').textContent,
    total: document.getElementById('psQrTotalAmount').textContent,
    code: document.getElementById('psBankContent').textContent,
    promise: document.querySelector('.ps-qr-promise p').textContent.replace(/\s+/g, ' '),
    locked: [...document.querySelectorAll('.ps-heart')].every(b => b.disabled),
    sub2: document.getElementById('psSubmitBtn').disabled
  }));
  check('Mở mã QR ngay: "10 ảnh trong gói đã được gửi cho thợ", 2 ảnh chọn thêm cần thanh toán trong 30 phút', v.qr && v.sub.includes('10 ảnh trong gói đã được gửi cho thợ') && v.sub.includes('2 ảnh chọn thêm') && v.sub.includes('30 phút') && v.sub.includes('không được gửi đi'), v.sub);
  check('Đồng hồ "Thời gian thanh toán còn lại" 30:00', v.label === 'Thời gian thanh toán còn lại' && /^(30:00|29:5\d)$/.test(v.time), v.label + ' ' + v.time);
  check('Mã QR đúng số tiền 100.000đ + nội dung CK là mã thanh toán của yêu cầu', v.total === '100.000đ' && v.code === r.extraPending.code, v.total + ' ' + v.code);
  check('Lời nhắc cuối modal không còn nói "yêu cầu sẽ chưa được gửi"', v.promise.includes('10 ảnh trong gói đã được gửi') && v.promise.includes('quá 30 phút') && !v.promise.includes('yêu cầu sẽ chưa được gửi'), v.promise);
  check('Gửi xong -> khoá chọn ảnh + nút gửi', v.locked && v.sub2);
  await page.screenshot({ path: shot('pay-qr-desktop.png') });
  await page.setViewport({ width: 390, height: 844 }); await wait(300);
  v = await page.evaluate(() => ({ hScroll: document.documentElement.scrollWidth > innerWidth, r: document.querySelector('.ps-qr-modal').getBoundingClientRect().right, vw: innerWidth }));
  check('Điện thoại: modal QR không tràn ngang', !v.hScroll && v.r <= v.vw, JSON.stringify(v));
  await page.screenshot({ path: shot('pay-qr-mobile.png') });
  await page.setViewport({ width: 1440, height: 900 }); await wait(300);

  payMode = 'abort';
  await wait(5000);
  v = await page.evaluate(() => ({ err: document.getElementById('psQrPayStatus').classList.contains('is-error'), t: document.getElementById('psQrPayStatusText').textContent }));
  check('Mất kết nối máy chủ thanh toán -> báo đang thử lại + hotline, chưa huỷ gì', v.err && v.t.includes('0938.125.222') && !!(await req0()).extraPending, v.t);
  payMode = 'unpaid';
  await wait(4500);
  v = await page.evaluate(() => document.getElementById('psQrPayStatus').classList.contains('is-error'));
  check('Kết nối lại -> trở về "Đang chờ tiền về"', !v);

  await page.click('#psQrCloseBtn'); await wait(300);
  v = await page.evaluate(() => {
    const b = document.getElementById('psSubmittedBanner');
    return { cls: b.className, t: b.textContent.replace(/\s+/g, ' '), left: (b.querySelector('[data-pay-left]') || {}).textContent, pay: !!b.querySelector('[data-open-pay]') };
  });
  check('Đóng mã QR -> thông báo đầu trang: đã gửi 10 ảnh gói, còn 2 ảnh chọn thêm chờ thanh toán', v.cls.includes('is-pending') && v.t.includes('Đã gửi 10 ảnh trong gói cho thợ') && v.t.includes('Còn 2 ảnh chọn thêm chờ thanh toán'), v.t);
  check('Thông báo nói rõ quá 30 phút ảnh chọn thêm không được gửi, ảnh gói vẫn chỉnh bình thường', v.t.includes('Quá 30 phút chưa thanh toán') && v.t.includes('không được gửi đi') && v.t.includes('10 ảnh trong gói vẫn được chỉnh bình thường'), v.t);
  const left1 = v.left;
  await wait(2100);
  const left2 = await page.$eval('#psSubmittedBanner [data-pay-left]', el => el.textContent);
  check('Có đồng hồ đếm ngược chạy trên thông báo + nút "Thanh toán ngay"', /^\d\d:\d\d$/.test(left1) && left1 !== left2 && v.pay, left1 + ' -> ' + left2);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.$eval('#psSubmittedBanner', el => el.scrollIntoView({ block: 'center' })); await wait(300);
  await page.screenshot({ path: shot('pay-banner-desktop.png') });
  await page.setViewport({ width: 390, height: 844 }); await wait(400);
  await page.$eval('#psSubmittedBanner', el => el.scrollIntoView({ block: 'center' })); await wait(300);
  v = await page.evaluate(() => ({ hScroll: document.documentElement.scrollWidth > innerWidth }));
  check('Điện thoại: thông báo chờ thanh toán không tràn ngang', !v.hScroll);
  await page.screenshot({ path: shot('pay-banner-mobile.png') });
  await page.setViewport({ width: 1440, height: 900 }); await wait(300);

  await page.click('#psSubmittedBanner [data-open-pay]'); await wait(300);
  v = await page.evaluate(() => ({ qr: document.getElementById('psQrModalOverlay').classList.contains('show'), code: document.getElementById('psBankContent').textContent }));
  check('"Thanh toán ngay" mở lại đúng mã QR cũ (không cấp mã mới)', v.qr && v.code === r.extraPending.code, v.code);
  await page.click('#psQrCloseBtn'); await wait(250);

  await page.click('.ps-tab[data-filter="edited"]'); await wait(400);
  v = await page.evaluate(() => { const b = document.querySelector('#psResultBody .ps-extra-pay'); return b ? { cls: b.className, t: b.textContent.replace(/\s+/g, ' '), btn: !!b.querySelector('[data-open-pay]') } : null; });
  check('Tab "Ảnh đã chỉnh": ô "2 ảnh chọn thêm đang chờ thanh toán" + đồng hồ + nút thanh toán', !!v && v.cls.includes('is-pending') && v.t.includes('2 ảnh chọn thêm đang chờ thanh toán') && v.btn, JSON.stringify(v));
  await page.$eval('#psEditedPanel', el => el.scrollIntoView({ block: 'start' })); await wait(300);
  await page.screenshot({ path: shot('pay-edited-pending.png') });
  await page.click('.ps-tab[data-filter="all"]'); await wait(300);

  // Chuông thông báo ở Trang chủ
  await page.evaluate(() => { location.hash = '#/'; }); await wait(600);
  await page.waitForFunction(() => !!document.querySelector('#notifList .notif-go-pay'), { timeout: 8000 }).catch(() => {});
  await page.click('#notifBtn'); await wait(300);
  v = await page.evaluate(() => { const b = document.querySelector('#notifList .notif-go-pay'); return b ? b.textContent.replace(/\s+/g, ' ') : ''; });
  check('Chuông thông báo: "Còn 2 ảnh chọn thêm chờ thanh toán", hạn giờ, quá hạn không được gửi', v.includes('Còn 2 ảnh chọn thêm chờ thanh toán') && v.includes('100.000đ') && v.includes('không được gửi đi'), v);
  await page.screenshot({ path: shot('pay-bell.png') });
  await page.click('#notifList .notif-go-pay'); await wait(900);
  v = await page.evaluate(() => ({ hash: location.hash, qr: document.getElementById('psQrModalOverlay').classList.contains('show') }));
  check('Bấm tin trên chuông -> sang "Ảnh của tôi" và mở mã QR', v.hash === '#/chon-anh' && v.qr, JSON.stringify(v));

  // Phía Thợ ảnh khi ảnh chọn thêm còn chờ (cùng trình duyệt, tạm đổi phiên sang Thợ ảnh)
  const custAuth = await page.evaluate(() => localStorage.getItem('aloha_auth'));
  const admin = await preparePage(browser, errors);
  await login(admin, '0900000003', 'anh123');
  await admin.goto(ROOT_URL + 'crm/admin.html#anh', { waitUntil: 'networkidle0' }); await wait(600);
  v = await admin.evaluate(() => { const f = document.querySelector('.kanban-card .kanban-card-flag.pay'); return f ? f.textContent : ''; });
  check('Thợ ảnh: thẻ yêu cầu có nhãn "+2 ảnh thêm chờ khách thanh toán"', v === '+2 ảnh thêm chờ khách thanh toán', v);
  await admin.evaluate(() => [...document.querySelectorAll('.kanban-card')].find(c => c.querySelector('.kanban-card-flag.pay')).click()); await wait(400);
  v = await admin.evaluate(() => document.querySelector('.kanban-modal-note[style*="ea580c"]') ? document.querySelector('.kanban-modal-note[style*="ea580c"]').textContent.replace(/\s+/g, ' ') : '');
  check('Thợ ảnh: chi tiết yêu cầu ghi rõ 2 ảnh chọn thêm chờ khách thanh toán + hạn', v.includes('+2 ảnh chọn thêm đang chờ khách thanh toán') && v.includes('100.000đ') && v.includes('hạn'), v);
  await admin.screenshot({ path: shot('pay-admin-pending.png') });
  // Đang chờ thanh toán thì chưa cho Hoàn thành (dù đã xong ảnh + gửi link)
  v = await admin.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('aloha_demo_db')); const rq = d.editRequests[0];
    rq.status = 'Đang thực hiện'; rq.resultLink = 'https://drive.google.com/drive/folders/test'; rq.doneIds = rq.photos.map(p => p.id);
    localStorage.setItem('aloha_demo_db', JSON.stringify(d));
    return AlohaData.advanceRequestStatus(rq.id).status;
  });
  await admin.reload({ waitUntil: 'networkidle0' }); await wait(600);
  const blockTitle = await admin.evaluate(() => { const card = [...document.querySelectorAll('#kanbanCol-dang-thuc-hien .kanban-card')].find(c => c.querySelector('.kanban-card-flag.pay')); const b = card && card.querySelector('.kanban-advance-btn'); return b ? (b.disabled ? b.title : 'ENABLED') : 'NONE'; });
  check('Còn trong hạn thanh toán -> chưa chuyển Hoàn thành được (dữ liệu + nút bị khoá kèm lý do)', v === 'Đang thực hiện' && blockTitle.includes('chờ thanh toán'), v + ' | ' + blockTitle);
  await admin.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('aloha_demo_db')); const rq = d.editRequests[0];
    rq.status = 'Chờ xử lý'; rq.resultLink = ''; rq.doneIds = []; rq.staffSeen = true;
    localStorage.setItem('aloha_demo_db', JSON.stringify(d));
  });
  await admin.close();
  await page.evaluate((a) => localStorage.setItem('aloha_auth', a), custAuth);

  // Máy chủ báo đã nhận đủ tiền -> ảnh chọn thêm tự gửi tới thợ
  payMode = 'paid';
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem('aloha_demo_db')).editRequests[0].extraPending, { timeout: 12000 }).catch(() => {});
  await wait(400);
  r = await req0();
  v = { ids: r.photos.map(p => p.id + (p.isExtra ? '*' : '')).slice(-3).join(','), count: r.photoCount, ec: r.extraCount, fee: r.extraFee, ps: r.paymentStatus, seen: r.staffSeen, pend: r.extraPending, drop: r.extraDropped, notes: r.photoNotes.map(n => n.id + ':' + n.note).join(',') };
  check('Đã thanh toán -> #11, #12 được thêm vào yêu cầu (12 ảnh, +2 ảnh 100.000đ, đã thanh toán)', v.ids === 'ph-10,ph-11*,ph-12*' && v.count === 12 && v.ec === 2 && v.fee === 100000 && /Đã thanh toán/.test(v.ps) && !v.pend && !v.drop, JSON.stringify(v));
  check('Ghi chú ảnh #12 đi theo, Thợ ảnh được báo lại có ảnh mới', v.notes.includes('ph-12:Xoá vết đỏ trên má') && v.seen === false, JSON.stringify(v));
  v = await page.evaluate(() => ({
    qr: document.getElementById('psQrModalOverlay').classList.contains('show'),
    cls: document.getElementById('psSubmittedBanner').className,
    t: document.getElementById('psSubmittedBanner').textContent.replace(/\s+/g, ' '),
    extra: [...document.querySelectorAll('.ps-photo.selected.ps-extra-photo')].map(c => c.dataset.id).join(',')
  }));
  check('Mã QR tự đóng, thông báo "Đã nhận thanh toán, 2 ảnh chọn thêm đã được gửi tới thợ"', !v.qr && !v.cls.includes('is-pending') && v.t.includes('Đã nhận thanh toán, 2 ảnh chọn thêm đã được gửi tới thợ') && v.t.includes('12 ảnh'), v.t);
  check('#11, #12 vẫn hiện đã chọn (viền cam)', v.extra === 'ph-11,ph-12', v.extra);
  await page.$eval('#psSubmittedBanner', el => el.scrollIntoView({ block: 'center' })); await wait(300);
  await page.screenshot({ path: shot('pay-paid-desktop.png') });
  const pollsAfterPaid = payPolls; await wait(5000);
  check('Đã chốt -> ngừng hỏi máy chủ thanh toán', payPolls === pollsAfterPaid, payPolls - pollsAfterPaid);
  await page.reload({ waitUntil: 'networkidle0' }); await wait(800);
  v = await page.evaluate(() => ({ t: document.getElementById('psSubmittedBanner').textContent.replace(/\s+/g, ' '), sel: document.querySelectorAll('.ps-photo.selected').length }));
  check('Tải lại: "Bạn đã gửi 12 ảnh", 12 ảnh vẫn đã chọn', v.t.includes('Bạn đã gửi 12 ảnh') && v.sel === 12, JSON.stringify(v));

  // ================= B. Quá hạn chưa thanh toán (đang mở mã QR) =================
  // Sau hạn còn chờ thêm LATE (2 phút) cho ngân hàng báo chậm rồi mới bỏ -> tua tới 4 giây trước khi hết chờ
  payMode = 'unpaid';
  await freshCustomerWith12();
  await sendWithExtras();
  await setDeadline(-LATE + 4000);
  const dlB = (await req0()).extraPending.deadline;
  await wait(1500);
  v = await page.evaluate(() => ({
    kind: document.getElementById('psSubmittedBanner').dataset.kind,
    t: document.getElementById('psSubmittedBanner').textContent.replace(/\s+/g, ' '),
    label: document.getElementById('psQrCountdownLabel').textContent
  }));
  check('Vừa hết hạn: thông báo "đang xác nhận thanh toán", mã QR báo đang xác nhận lần cuối (chưa bỏ ngay)', v.kind === 'checking' && v.t.includes('đang xác nhận thanh toán 2 ảnh chọn thêm') && v.label.includes('đang xác nhận thanh toán lần cuối') && !!(await req0()).extraPending, JSON.stringify(v));
  await page.waitForFunction(() => !!JSON.parse(localStorage.getItem('aloha_demo_db')).editRequests[0].extraDropped, { timeout: 15000 }).catch(() => {});
  await wait(400);
  check('Hỏi máy chủ kèm mốc "before" = hạn + thời gian chờ báo chậm', lastPayUrl.includes('before=' + (dlB + LATE)), lastPayUrl);
  r = await req0();
  v = { pend: r.extraPending, drop: r.extraDropped, n: r.photos.length, count: r.photoCount, ec: r.extraCount };
  check('Hết thời gian chờ vẫn chưa có tiền -> ảnh chọn thêm KHÔNG vào yêu cầu (vẫn 10 ảnh), ghi lại 2 ảnh không được gửi', !v.pend && v.drop && v.drop.count === 2 && v.drop.fee === 100000 && v.n === 10 && v.count === 10 && v.ec === 0, JSON.stringify(v));
  v = await page.evaluate(() => ({
    qr: document.getElementById('psQrModalOverlay').classList.contains('show'),
    exp: document.querySelector('.ps-qr-modal').classList.contains('is-expired'),
    label: document.getElementById('psQrCountdownLabel').textContent
  }));
  check('Mã QR đang mở chuyển sang "Đã hết 30 phút, 2 ảnh chọn thêm không được gửi đi"', v.qr && v.exp && v.label === 'Đã hết 30 phút, 2 ảnh chọn thêm không được gửi đi', JSON.stringify(v));
  await page.screenshot({ path: shot('pay-expired-qr.png') });
  await page.click('#psQrCloseBtn'); await wait(300);
  v = await page.evaluate(() => ({
    cls: document.getElementById('psSubmittedBanner').className,
    t: document.getElementById('psSubmittedBanner').textContent.replace(/\s+/g, ' '),
    sel: [...document.querySelectorAll('.ps-photo.selected')].map(c => c.dataset.id),
    count: document.getElementById('selectedCount').textContent,
    extraBox: document.getElementById('psExtra').hidden
  }));
  check('Thông báo "2 ảnh chọn thêm không được gửi đi" + 10 ảnh gói vẫn chỉnh + hotline', v.cls.includes('is-dropped') && v.t.includes('2 ảnh chọn thêm không được gửi đi') && v.t.includes('10 ảnh trong gói vẫn được chỉnh bình thường') && v.t.includes('0938.125.222'), v.t);
  check('Lưới ảnh bỏ chọn #11, #12 (khớp đúng 10 ảnh thợ nhận), hết báo phí', !v.sel.includes('ph-11') && !v.sel.includes('ph-12') && v.sel.length === 10 && v.count === '10' && v.extraBox, JSON.stringify(v));
  await page.$eval('#psSubmittedBanner', el => el.scrollIntoView({ block: 'center' })); await wait(300);
  await page.screenshot({ path: shot('pay-dropped-desktop.png') });
  await page.setViewport({ width: 390, height: 844 }); await wait(400);
  await page.$eval('#psSubmittedBanner', el => el.scrollIntoView({ block: 'center' })); await wait(300);
  await page.screenshot({ path: shot('pay-dropped-mobile.png') });
  await page.setViewport({ width: 1440, height: 900 }); await wait(300);
  await page.click('.ps-tab[data-filter="edited"]'); await wait(400);
  v = await page.evaluate(() => { const b = document.querySelector('#psResultBody .ps-extra-pay'); return b ? b.className + ' | ' + b.textContent.replace(/\s+/g, ' ') : ''; });
  check('Tab "Ảnh đã chỉnh": ghi "2 ảnh chọn thêm không được gửi đi"', v.includes('is-dropped') && v.includes('2 ảnh chọn thêm không được gửi đi'), v);
  await page.click('.ps-tab[data-filter="all"]'); await wait(300);
  await page.evaluate(() => { location.hash = '#/'; }); await wait(5600);
  v = await page.evaluate(() => ({ pay: !!document.querySelector('#notifList .notif-go-pay'), t: document.getElementById('notifList').textContent.replace(/\s+/g, ' ') }));
  check('Chuông: hết nhắc thanh toán, ghi "2 ảnh chọn thêm không được gửi (quá hạn thanh toán)"', !v.pay && v.t.includes('2 ảnh chọn thêm không được gửi (quá hạn thanh toán)'), v.t);
  await page.evaluate(() => { location.hash = '#/chon-anh'; }); await wait(400);
  await page.reload({ waitUntil: 'networkidle0' }); await wait(800);
  v = await page.evaluate(() => ({ cls: document.getElementById('psSubmittedBanner').className, t: document.getElementById('psSubmittedBanner').textContent.replace(/\s+/g, ' '), sel11: document.querySelector('.ps-photo[data-id="ph-11"]').classList.contains('selected') }));
  check('Tải lại: "Bạn đã gửi 10 ảnh..." kèm dòng "2 ảnh chọn thêm không được gửi vì quá 30 phút"', !v.cls.includes('is-dropped') && v.t.includes('Bạn đã gửi 10 ảnh') && v.t.includes('2 ảnh chọn thêm không được gửi vì quá 30 phút chưa thanh toán') && !v.sel11, JSON.stringify(v));
  const admin2 = await preparePage(browser, errors);
  const custAuth2 = await page.evaluate(() => localStorage.getItem('aloha_auth'));
  await login(admin2, '0900000003', 'anh123');
  await admin2.goto(ROOT_URL + 'crm/admin.html#anh', { waitUntil: 'networkidle0' }); await wait(600);
  v = await admin2.evaluate(() => { const f = document.querySelector('.kanban-card .kanban-card-flag.dropped'); return f ? f.textContent : ''; });
  check('Thợ ảnh: thẻ ghi "2 ảnh thêm không gửi (khách không thanh toán)"', v === '2 ảnh thêm không gửi (khách không thanh toán)', v);
  await admin2.screenshot({ path: shot('pay-admin-dropped.png') });
  await admin2.close();
  await page.evaluate((a) => localStorage.setItem('aloha_auth', a), custAuth2);

  // ================= C. Tiền về chậm sau hạn (trong thời gian chờ) vẫn được gửi =================
  payMode = 'unpaid';
  await freshCustomerWith12();
  await sendWithExtras();
  await page.click('#psQrCloseBtn'); await wait(200);
  await setDeadline(-10000); // hết hạn 10 giây trước, ngân hàng chưa báo
  await wait(5500);
  r = await req0();
  check('Hết hạn nhưng còn trong thời gian chờ báo chậm -> chưa bỏ ảnh', !!r.extraPending && !r.extraDropped);
  payMode = 'paid'; // ngân hàng/SePay báo tiền về muộn vài giây
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem('aloha_demo_db')).editRequests[0].extraPending, { timeout: 10000 }).catch(() => {});
  await wait(400);
  r = await req0();
  v = await text('#psSubmittedBanner');
  check('Tiền về muộn (trong 2 phút chờ) -> ảnh chọn thêm vẫn được gửi', r.photos.length === 12 && r.extraCount === 2 && !r.extraDropped && v.includes('Đã nhận thanh toán'), r.photos.length + ' | ' + v);

  // ================= D. Khách đóng trình duyệt: quay lại / trang quản trị chốt thay =================
  // D1: quay lại sau hạn (còn trong thời gian chờ), lần kiểm tra cuối thấy đã có tiền -> vẫn gửi
  payMode = 'unpaid';
  await freshCustomerWith12();
  await sendWithExtras();
  await page.click('#psQrCloseBtn'); await wait(200);
  await page.goto(ROOT_URL + 'login.html', { waitUntil: 'networkidle0' }); // rời trang (không còn đồng hồ thanh toán)
  await setDeadline(-60000);
  payMode = 'paid';
  await page.goto(ROOT_URL + 'index.html#/chon-anh', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem('aloha_demo_db')).editRequests[0].extraPending, { timeout: 8000 }).catch(() => {});
  await wait(400);
  r = await req0();
  v = await text('#psSubmittedBanner');
  check('Quay lại sau hạn, lần kiểm tra cuối thấy đã thanh toán -> ảnh chọn thêm vẫn được gửi', r.photos.length === 12 && r.extraCount === 2 && !r.extraDropped && v.includes('Đã nhận thanh toán'), r.photos.length + ' | ' + v);

  // D2: quay lại sau khi hết cả thời gian chờ, không kết nối được máy chủ -> không gửi, báo hotline
  payMode = 'unpaid';
  await freshCustomerWith12();
  await sendWithExtras();
  await page.click('#psQrCloseBtn'); await wait(200);
  await page.goto(ROOT_URL + 'login.html', { waitUntil: 'networkidle0' });
  await setDeadline(-LATE - 1000);
  payMode = 'abort';
  await page.goto(ROOT_URL + 'index.html#/chon-anh', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem('aloha_demo_db')).editRequests[0].extraPending, { timeout: 8000 }).catch(() => {});
  await wait(400);
  r = await req0();
  v = await text('#psSubmittedBanner');
  check('Quay lại sau khi hết thời gian chờ, không xác nhận được thanh toán -> không gửi, báo hotline', r.photos.length === 10 && r.extraDropped && r.extraDropped.count === 2 && v.includes('không được gửi đi') && v.includes('0938.125.222'), r.photos.length + ' | ' + v);

  // D3: khách đã trả tiền rồi đóng trình duyệt, không quay lại -> trang quản trị tự chốt thay
  payMode = 'unpaid';
  await freshCustomerWith12();
  await sendWithExtras();
  await page.click('#psQrCloseBtn'); await wait(200);
  const custAuth3 = await page.evaluate(() => localStorage.getItem('aloha_auth'));
  await page.goto(ROOT_URL + 'login.html', { waitUntil: 'networkidle0' });
  await setDeadline(-10000);
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('aloha_demo_db')); d.editRequests[0].status = 'Đang thực hiện'; d.editRequests[0].resultLink = 'https://drive.google.com/drive/folders/x'; d.editRequests[0].doneIds = d.editRequests[0].photos.map(p => p.id); localStorage.setItem('aloha_demo_db', JSON.stringify(d)); });
  const admin3 = await preparePage(browser, errors);
  await login(admin3, '0900000003', 'anh123');
  await admin3.goto(ROOT_URL + 'crm/admin.html#anh', { waitUntil: 'networkidle0' }); await wait(1500);
  v = await admin3.evaluate(() => {
    const card = [...document.querySelectorAll('.kanban-card')].find(c => c.querySelector('.kanban-card-flag.pay'));
    const b = card && card.querySelector('.kanban-advance-btn');
    return { flag: card ? card.querySelector('.kanban-card-flag.pay').textContent : '', block: b ? (b.disabled ? b.title : 'ENABLED') : 'NONE',
      data: AlohaData.advanceRequestStatus(AlohaData.getEditRequests()[0].id).status };
  });
  check('Hết hạn, đang chờ xác nhận: Thợ ảnh thấy "đang xác nhận thanh toán", CHƯA chuyển Hoàn thành được', v.flag === '+2 ảnh thêm đang xác nhận thanh toán' && v.block.includes('Đang xác nhận thanh toán') && v.data === 'Đang thực hiện', JSON.stringify(v));
  await admin3.screenshot({ path: shot('pay-admin-checking.png') });
  payMode = 'paid';
  await admin3.waitForFunction(() => !AlohaData.getEditRequests()[0].extraPending, { timeout: 12000 }).catch(() => {});
  await wait(600);
  v = await admin3.evaluate(() => { const rq = AlohaData.getEditRequests()[0]; return { n: rq.photos.length, ec: rq.extraCount, drop: !!rq.extraDropped, status: rq.status, badge: document.body.textContent.includes('+2 ảnh thêm (100.000đ)') }; });
  check('Khách không quay lại: trang quản trị tự xác nhận đã trả tiền -> thêm 2 ảnh cho thợ, vẫn "Đang thực hiện"', v.n === 12 && v.ec === 2 && !v.drop && v.status === 'Đang thực hiện' && v.badge, JSON.stringify(v));
  await admin3.close();
  await page.evaluate((a) => localStorage.setItem('aloha_auth', a), custAuth3);

  // E. Chốt 2 lần (vd 2 tab cùng chốt) không thêm ảnh trùng, không đổi kết quả đã chốt
  await page.goto(ROOT_URL + 'index.html#/chon-anh', { waitUntil: 'networkidle0' });
  v = await page.evaluate(() => {
    const id = AlohaData.getEditRequests()[0].id;
    const sig = (q) => [q.photos.length, q.extraCount, q.extraFee, !!q.extraDropped, q.paymentStatus].join('|');
    const before = sig(AlohaData.getEditRequests()[0]);
    AlohaData.settleExtraPayment(id, true, 'x');
    const again = AlohaData.settleExtraPayment(id, false, 'x');
    return { before, after: sig(again) };
  });
  check('Chốt lại lần nữa không làm gì (không thêm trùng, không đổi kết quả)', v.before === v.after && v.before.startsWith('12|2|100000|false'), JSON.stringify(v));

  check('Không có lỗi JavaScript', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(`\n${pass}/${pass + fail} PASS`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
