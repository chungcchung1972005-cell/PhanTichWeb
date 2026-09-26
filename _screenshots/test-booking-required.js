// Test bước 3-4 Đặt lịch: chỉ ô bắt buộc (Tên bé, Ngày sinh/dự sinh, Số người, SĐT)
// mới chặn xác nhận; Lưu ý sức khỏe + Ghi chú để trống được. Xác nhận -> bước Đặt cọc
// (cọc 50% giá tham khảo, 4 phương thức thanh toán), hết giờ giữ chỗ -> về bước 2.
const puppeteer = require('puppeteer-core');

const BASE = 'file:///D:/PhanTichWeb/';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox']
  });

  let fails = 0;
  function log(name, ok, detail) {
    if (!ok) fails++;
    console.log((ok ? 'OK  ' : 'FAIL') + ' - ' + name + (detail ? ' :: ' + detail : ''));
  }

  async function openStep3(viewport, fastClock) {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    if (fastClock) {
      await page.evaluateOnNewDocument(() => {
        const orig = window.setInterval;
        window.setInterval = (fn, ms, ...args) => orig(fn, Math.max(1, (ms || 0) / 30), ...args);
      });
    }
    await page.goto(BASE + 'login.html', { waitUntil: 'networkidle0' });
    await page.type('#loginPhone', '0900000001');
    await page.type('#loginPassword', 'khach123');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('.login-submit')]);
    await page.goto(BASE + 'index.html#/dat-lich', { waitUntil: 'networkidle0' });
    await page.$eval('.bk-service[data-service="Newborn"]', (el) => el.click());
    await page.$eval('.bk-concept[data-concept="cuon-u"] .bk-concept-pick', (el) => el.click());
    await page.$eval('#bkNextBtn', (el) => el.click());
    // Chọn khung giờ còn trống (thử các ngày cho tới khi có)
    // (click ngay trong trang: lưới giờ vẽ lại liên tục nên handle Puppeteer dễ bị "detached")
    for (let d = 0; d < 7; d++) {
      const picked = await page.evaluate((i) => {
        const free = document.querySelector('.bk-slot.free:not([disabled])');
        if (free) { free.click(); return true; }
        document.querySelectorAll('.bk-date')[i + 1]?.click();
        return false;
      }, d);
      if (picked) break;
    }
    if (viewport.isMobile) {
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > 392);
      log('Mobile bước 2: hàng ngày không làm tràn ngang trang', !wide);
    }
    await page.$eval('#bkNextBtn', (el) => el.click());
    return page;
  }

  const errVisible = (page, id) => page.$eval('#' + id + 'Err', (el) => !el.hidden && el.textContent.trim().length > 0);
  const successShown = (page) => page.$eval('#bkSuccess', (el) => el.classList.contains('show'));

  // --- Desktop ---
  const page = await openStep3({ width: 1366, height: 900 });
  log('Đang ở bước 3', await page.$eval('#step3', (el) => !el.hidden));

  // 1) Để trống, bấm xác nhận -> báo lỗi, không đặt được
  await page.$eval('#bkNextBtn', (el) => el.click());
  log('Trống: không hiện thành công', !(await successShown(page)));
  log('Trống: lỗi Tên bé', await errVisible(page, 'bkChildName'));
  log('Trống: lỗi Ngày sinh', await errVisible(page, 'bkChildDob'));
  log('Trống: lỗi SĐT', await errVisible(page, 'bkPhone'));
  log('Trống: Số người mặc định 1 không báo lỗi', !(await errVisible(page, 'bkPeople')));
  log('Focus vào ô lỗi đầu tiên', (await page.evaluate(() => document.activeElement.id)) === 'bkChildName');
  await page.screenshot({ path: 'bk-required-errors-desktop.png', fullPage: false });

  // 2) Sửa ô thì lỗi ô đó biến mất ngay
  await page.type('#bkChildName', 'Bé Sữa');
  log('Gõ tên bé -> hết lỗi tên', !(await errVisible(page, 'bkChildName')));

  // 3) SĐT sai định dạng -> vẫn chặn
  await page.$eval('#bkChildDob', (el) => { el.value = '2026-08-01'; el.dispatchEvent(new Event('change')); });
  await page.type('#bkPhone', '12345');
  await page.$eval('#bkNextBtn', (el) => el.click());
  log('SĐT sai: vẫn chặn', !(await successShown(page)) && (await errVisible(page, 'bkPhone')));

  // 4) Số người = 0 -> chặn
  await page.$eval('#bkPeople', (el) => { el.value = '0'; });
  await page.$eval('#bkNextBtn', (el) => el.click());
  log('Số người 0: báo lỗi', await errVisible(page, 'bkPeople'));
  await page.$eval('#bkPeople', (el) => { el.value = '2'; el.dispatchEvent(new Event('input')); });

  // 5) Nhấn Enter trong form không tải lại trang
  await page.$eval('#bkPhone', (el) => { el.value = ''; });
  await page.type('#bkPhone', '0987 654 321');
  log('Gõ SĐT đúng -> hết lỗi SĐT', !(await errVisible(page, 'bkPhone')));
  const urlBefore = page.url();
  await page.keyboard.press('Enter');
  await new Promise((r) => setTimeout(r, 400));
  log('Enter không tải lại trang', page.url() === urlBefore);

  // 6) Đủ ô bắt buộc, Lưu ý sức khỏe + Ghi chú để trống -> sang bước Đặt cọc
  const optEmpty = await page.evaluate(() => !document.getElementById('bkHealth').value && !document.getElementById('bkNote').value);
  log('Lưu ý sức khỏe + Ghi chú đang trống', optEmpty);
  const onStep4 = () => page.$eval('#step4', (el) => !el.hidden);
  if (!(await onStep4())) await page.$eval('#bkNextBtn', (el) => el.click());
  const leftErrs = await page.$$eval('.bk-err', (els) => els.filter((e) => !e.hidden).map((e) => e.id + ': ' + e.textContent));
  log('Đủ ô bắt buộc (bỏ trống ô tuỳ chọn) -> sang bước Đặt cọc', await onStep4(), leftErrs.join(' | '));
  log('Chưa báo thành công khi chưa cọc', !(await successShown(page)));

  // 7) Bước Đặt cọc: Newborn giá tham khảo 2.200.000đ -> cọc 50% = 1.100.000đ
  const dep = await page.evaluate(() => ({
    code: document.getElementById('depOrderCode').textContent,
    price: document.getElementById('depPrice').textContent,
    amount: document.getElementById('depAmount').textContent,
    remain: document.getElementById('depRemain').textContent,
    sum: document.getElementById('sumDeposit').textContent,
    step4Active: document.querySelector('.bk-step[data-step="4"]').classList.contains('active'),
    methods: document.querySelectorAll('.bk-pay').length,
  }));
  log('Có mã đơn', /^#AB\d{8}$/.test(dep.code), dep.code);
  log('Giá chụp 2.200.000đ', dep.price.includes('2.200.000'), dep.price);
  log('Tiền cọc 50% = 1.100.000đ', dep.amount === '1.100.000đ', dep.amount);
  log('Còn lại 1.100.000đ', dep.remain === '1.100.000đ', dep.remain);
  log('Ô tóm tắt hiện tiền cọc', dep.sum === '1.100.000đ', dep.sum);
  log('Stepper sáng bước 4 Đặt cọc', dep.step4Active);
  log('Có 4 phương thức thanh toán', dep.methods === 4);

  // 8) Chưa chọn phương thức -> nút chính khóa, không có nút "Tôi đã chuyển khoản"
  const noMethod = await page.$eval('#bkNextBtn', (el) => ({ dis: el.disabled, text: el.textContent }));
  log('Chưa chọn phương thức: nút khóa', noMethod.dis && !/đã (chuyển|thanh toán)/i.test(noMethod.text), noMethod.text);

  // 9) Chọn từng phương thức -> hiện chi tiết đúng; QR thì tự chờ tiền, thẻ thì có nút sang VNPay
  for (const [method, hasQr] of [['momo', true], ['zalopay', true], ['card', false], ['bank', true]]) {
    await page.$eval(`.bk-pay[data-method="${method}"]`, (el) => el.click());
    const d = await page.evaluate(() => ({
      shown: !document.getElementById('bkPayDetail').hidden,
      qr: !document.getElementById('bkPayQr').hidden && !!document.querySelector('#bkPayQr svg'),
      text: document.getElementById('bkPayInfo').textContent,
      waiting: !document.getElementById('bkPayStatus').hidden,
      btn: document.getElementById('bkNextBtn').textContent,
      btnDis: document.getElementById('bkNextBtn').disabled,
    }));
    log(`Chọn ${method}: hiện chi tiết + số tiền`, d.shown && d.text.includes('1.100.000đ'));
    log(`Chọn ${method}: ${hasQr ? 'có' : 'không có'} QR`, d.qr === hasQr);
    if (hasQr) log(`Chọn ${method}: tự chờ tiền, không có nút bấm xác nhận`, d.waiting && d.btnDis && !/đã (chuyển|thanh toán)/i.test(d.btn), d.btn);
    else log('Chọn thẻ: chưa chờ, có nút "Thanh toán qua VNPay"', !d.waiting && !d.btnDis && d.btn === 'Thanh toán qua VNPay', d.btn);
  }
  log('Chuyển khoản: nội dung CK = mã đơn', (await page.$eval('#bkPayInfo', (el) => el.textContent)).includes(dep.code.slice(1)));
  log('Khung chờ ghi rõ là mô phỏng demo', (await page.$eval('#bkPayStatus', (el) => el.textContent)).includes('mô phỏng'));
  await page.$eval('#step4', (el) => el.scrollIntoView());
  await page.screenshot({ path: 'bk-deposit-desktop.png', fullPage: false });

  // 10) Quay lại bước 3 khi đang chờ -> thôi chờ (không tự báo thành công ở bước 3); tiến lại giữ mã đơn + phương thức
  await page.$eval('#bkBackBtn', (el) => el.click());
  log('Quay lại về bước 3', await page.$eval('#step3', (el) => !el.hidden));
  await new Promise((r) => setTimeout(r, 11000));
  log('Đang ở bước 3 thì không tự báo đã nhận tiền', !(await successShown(page)));
  await page.$eval('#bkNextBtn', (el) => el.click());
  const again = await page.evaluate(() => ({ code: document.getElementById('depOrderCode').textContent, sel: document.querySelector('.bk-pay.selected')?.dataset.method, waiting: !document.getElementById('bkPayStatus').hidden }));
  log('Tiến lại bước 4: giữ mã đơn + phương thức, tiếp tục chờ tiền', again.code === dep.code && again.sel === 'bank' && again.waiting);

  // 11) Không bấm gì: hệ thống tự nhận diện đã nhận tiền (mô phỏng ~8 giây) -> thành công
  log('Chưa tới lúc báo có: chưa thành công', !(await successShown(page)));
  const autoOk = await page.waitForFunction(() => document.getElementById('bkSuccess').classList.contains('show'), { timeout: 15000 }).then(() => true).catch(() => false);
  const okText = await page.$eval('#bkSuccessText', (el) => el.textContent);
  log('Tự nhận diện đã nhận tiền -> thành công, không cần bấm', autoOk);
  log('Thông báo thành công có mã đơn + số tiền + Chờ xác nhận + ghi mô phỏng', okText.includes(dep.code) && okText.includes('1.100.000đ') && okText.includes('Chờ xác nhận') && okText.includes('mô phỏng'), okText);
  log('Thành công thì dừng chờ + ẩn đồng hồ giữ chỗ', await page.evaluate(() => document.getElementById('bkPayStatus').hidden && document.getElementById('bkHoldTimer').hidden));
  await page.screenshot({ path: 'bk-deposit-auto-success-desktop.png', fullPage: false });
  await page.close();

  // 12) Thẻ: bấm "Thanh toán qua VNPay" -> chờ kết quả cổng -> tự thành công
  const k = await openStep3({ width: 1366, height: 900 });
  await k.type('#bkChildName', 'Bé Sữa');
  await k.$eval('#bkChildDob', (el) => { el.value = '2026-08-01'; });
  await k.type('#bkPhone', '0987654321');
  await k.$eval('#bkNextBtn', (el) => el.click());
  await k.$eval('.bk-pay[data-method="card"]', (el) => el.click());
  await k.$eval('#bkNextBtn', (el) => el.click());
  const kw = await k.evaluate(() => ({ waiting: !document.getElementById('bkPayStatus').hidden, text: document.getElementById('bkPayStatus').textContent, dis: document.getElementById('bkNextBtn').disabled }));
  log('Thẻ: bấm sang VNPay -> chờ kết quả cổng, khóa nút', kw.waiting && kw.text.includes('VNPay') && kw.dis);
  log('Thẻ: tự thành công khi cổng báo đã thanh toán', await k.waitForFunction(() => document.getElementById('bkSuccess').classList.contains('show'), { timeout: 15000 }).then(() => true).catch(() => false));
  await k.close();

  // --- Mobile: trạng thái lỗi bước 3 + bước Đặt cọc ---
  const m = await openStep3({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await m.$eval('#bkNextBtn', (el) => el.click());
  await m.$eval('#step3', (el) => el.scrollIntoView());
  await m.screenshot({ path: 'bk-required-errors-mobile.png', fullPage: false });
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  log('Mobile: không cuộn ngang', !overflow);
  await m.type('#bkChildName', 'Bé Sữa');
  await m.$eval('#bkChildDob', (el) => { el.value = '2026-08-01'; });
  await m.type('#bkPhone', '0987654321');
  await m.$eval('#bkNextBtn', (el) => el.click());
  await m.$eval('.bk-pay[data-method="bank"]', (el) => el.click());
  await new Promise((r) => setTimeout(r, 400));
  await m.$eval('#step4', (el) => el.scrollIntoView());
  await m.screenshot({ path: 'bk-deposit-mobile.png', fullPage: false });
  await m.$eval('#bkPayDetail', (el) => el.scrollIntoView({ block: 'center' }));
  await new Promise((r) => setTimeout(r, 800));
  log('Mobile: chọn chuyển khoản -> hiện khung chờ tiền', await m.$eval('#bkPayStatus', (el) => !el.hidden));
  await m.screenshot({ path: 'bk-deposit-mobile-qr.png', fullPage: false });
  const overflow4 = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  log('Mobile bước Đặt cọc: không cuộn ngang', !overflow4);
  await m.close();

  // --- Hết giờ giữ chỗ khi đang ở bước Đặt cọc -> về bước 2 ---
  // --- Bước 1: chọn concept sau dịch vụ, giá khác nhau, concept "Khác" ---
  const c = await browser.newPage();
  await c.setViewport({ width: 1366, height: 900 });
  await c.goto(BASE + 'index.html#/dat-lich', { waitUntil: 'networkidle0' }); // phiên khách còn từ lần đăng nhập trên
  log('Chưa chọn gì: ẩn khu concept, khóa Tiếp tục', await c.evaluate(() => document.getElementById('bkConceptWrap').hidden && document.getElementById('bkNextBtn').disabled));
  await c.$eval('.bk-service[data-service="Gia đình"]', (el) => el.click());
  await new Promise((r) => setTimeout(r, 500));
  const cs = await c.evaluate(() => ({
    shown: !document.getElementById('bkConceptWrap').hidden,
    names: [...document.querySelectorAll('.bk-concept:not(.bk-concept-custom) .bk-concept-name')].map((e) => e.textContent),
    prices: [...document.querySelectorAll('.bk-concept:not(.bk-concept-custom) .bk-concept-price')].map((e) => e.textContent),
    imgs: [...document.querySelectorAll('.bk-concept img')].every((i) => i.complete && i.naturalWidth > 0),
    custom: !!document.querySelector('.bk-concept-custom'),
    next: document.getElementById('bkNextBtn').disabled,
    albumNames: window.AlohaAlbums.list.find((s) => s.name === 'Gia đình').concepts.map((x) => x.name),
  }));
  log('Chọn dịch vụ -> hiện concept', cs.shown);
  log('Concept khớp đúng danh sách album trang chủ', JSON.stringify(cs.names) === JSON.stringify(cs.albumNames), cs.names.length + ' concept');
  log('Mỗi concept có giá, giá đa dạng', cs.prices.every((p) => /\d\.\d{3}\.000đ/.test(p)) && new Set(cs.prices).size > 3, cs.prices.join(', '));
  log('Ảnh bìa concept tải được', cs.imgs);
  log('Có ô "Khác"', cs.custom);
  log('Chưa chọn concept: vẫn khóa Tiếp tục', cs.next);

  await c.$eval('.bk-concept[data-concept="bien"] .bk-concept-pick', (el) => el.click());
  const s1 = await c.evaluate(() => ({
    next: document.getElementById('bkNextBtn').disabled,
    concept: document.getElementById('sumConcept').textContent,
    price: document.getElementById('sumPrice').textContent,
    dep: document.getElementById('sumDeposit').textContent,
  }));
  log('Chọn concept Biển -> mở Tiếp tục + tóm tắt đúng giá/cọc', !s1.next && s1.concept === 'Biển' && s1.price === '3.500.000đ' && s1.dep === '1.750.000đ', JSON.stringify(s1));

  await c.$eval('.bk-concept[data-concept="bien"] .bk-concept-view', (el) => el.click());
  await new Promise((r) => setTimeout(r, 300));
  log('Nút "Xem ảnh mẫu" mở lightbox', await c.evaluate(() => !document.getElementById('lightbox').hidden));
  await c.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 300));
  await c.screenshot({ path: 'bk-concept-desktop.png', fullPage: false });

  // Đổi dịch vụ -> bỏ chọn concept cũ
  await c.$eval('.bk-service[data-service="Newborn"]', (el) => el.click());
  await new Promise((r) => setTimeout(r, 300));
  log('Đổi dịch vụ -> phải chọn lại concept', await c.evaluate(() => document.getElementById('bkNextBtn').disabled && document.getElementById('sumConcept').textContent === '—'));

  // Concept "Khác": bắt mô tả ý tưởng, cọc tạm tính theo giá khởi điểm
  await c.$eval('.bk-concept-custom .bk-concept-pick', (el) => el.click());
  log('Chọn "Khác" -> hiện ô mô tả ý tưởng', await c.evaluate(() => !document.getElementById('bkCustomBox').hidden));
  const s2 = await c.evaluate(() => ({ price: document.getElementById('sumPrice').textContent, dep: document.getElementById('sumDeposit').textContent }));
  log('"Khác": giá = Sale báo giá, cọc tạm tính 1.100.000đ', s2.price === 'Sale báo giá' && s2.dep === '1.100.000đ (tạm tính)', JSON.stringify(s2));
  await c.$eval('#bkNextBtn', (el) => el.click());
  log('"Khác" chưa mô tả -> báo lỗi, không sang bước 2', await c.evaluate(() => !document.getElementById('bkCustomIdeaErr').hidden && document.getElementById('step2').hidden));
  await c.screenshot({ path: 'bk-concept-custom-desktop.png', fullPage: false });
  await c.type('#bkCustomIdea', 'Chủ đề khủng long, tông xanh lá, có ông bà');
  log('Gõ mô tả -> hết lỗi', await c.evaluate(() => document.getElementById('bkCustomIdeaErr').hidden));
  await c.$eval('#bkNextBtn', (el) => el.click());
  const free = await c.$('.bk-slot.free:not([disabled])');
  if (free) await free.click();
  await c.$eval('#bkNextBtn', (el) => el.click());
  await c.type('#bkChildName', 'Bé Na');
  await c.$eval('#bkChildDob', (el) => { el.value = '2026-08-01'; });
  await c.type('#bkPhone', '0987654321');
  await c.$eval('#bkNextBtn', (el) => el.click());
  const d4 = await c.evaluate(() => ({
    svc: document.getElementById('depServiceName').textContent,
    price: document.getElementById('depPrice').textContent,
    label: document.getElementById('depRateLabel').textContent,
    amount: document.getElementById('depAmount').textContent,
    remain: document.getElementById('depRemain').textContent,
  }));
  log('"Khác" ở bước Đặt cọc: giá Sale báo, cọc tạm tính 50% giá khởi điểm', d4.svc.includes('Khác') && d4.price.includes('Sale báo giá') && d4.label.includes('tạm tính') && d4.amount === '1.100.000đ' && d4.remain === 'Sale báo sau', JSON.stringify(d4));
  await c.$eval('#step4', (el) => el.scrollIntoView());
  await c.screenshot({ path: 'bk-deposit-custom-desktop.png', fullPage: false });
  await c.close();

  // Mobile: lưới concept 2 cột, không tràn ngang
  const cm = await browser.newPage();
  await cm.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await cm.goto(BASE + 'index.html#/dat-lich', { waitUntil: 'networkidle0' });
  await cm.$eval('.bk-service[data-service="Bầu"]', (el) => el.click());
  await cm.$eval('.bk-concept[data-concept="vong-hoa"] .bk-concept-pick', (el) => el.click());
  await new Promise((r) => setTimeout(r, 900));
  await cm.screenshot({ path: 'bk-concept-mobile.png', fullPage: false });
  log('Mobile chọn concept: không cuộn ngang', await cm.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await cm.close();

  // Tua nhanh đồng hồ: mọi setInterval chạy nhanh gấp 30 lần (giữ chỗ 5 phút còn ~10 giây)
  const e = await openStep3({ width: 1366, height: 900 }, true);
  await e.type('#bkChildName', 'Bé Sữa');
  await e.$eval('#bkChildDob', (el) => { el.value = '2026-08-01'; });
  await e.type('#bkPhone', '0987654321');
  await e.$eval('#bkNextBtn', (el) => el.click());
  log('Hết giờ: đang ở bước Đặt cọc', await e.$eval('#step4', (el) => !el.hidden));
  await e.waitForFunction(() => !document.getElementById('step2').hidden, { timeout: 20000 }).catch(() => {});
  const exp = await e.evaluate(() => ({
    step2: !document.getElementById('step2').hidden,
    next: document.getElementById('bkNextBtn').disabled,
    success: document.getElementById('bkSuccess').classList.contains('show'),
  }));
  log('Hết giờ giữ chỗ ở bước Đặt cọc -> về bước 2, khóa nút Tiếp tục', exp.step2 && exp.next && !exp.success);
  await e.close();

  await browser.close();
  console.log(fails ? `\n${fails} case FAIL` : '\nTất cả OK');
  process.exit(fails ? 1 : 0);
})();
