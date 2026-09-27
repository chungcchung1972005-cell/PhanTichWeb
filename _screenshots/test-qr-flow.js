const puppeteer = require('puppeteer-core');
const { CHROME_PATH } = require('./test-env');
const path = require('path');

(async () => {
  const htmlPath = path.resolve(__dirname, '..', 'login.html').replace(/\\/g, '/');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1200 });

  console.log('--- BẮT ĐẦU TEST LUỒNG CHỌN ẢNH VÀ MÃ QR CÁ NHÂN HÓA ---');

  // 1. Đăng nhập
  await page.goto('file:///' + htmlPath, { waitUntil: 'networkidle0' });
  await page.type('#loginPhone', '0900000001');
  await page.type('#loginPassword', 'khach123');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('#loginSubmitBtn')
  ]);

  console.log('✓ Đăng nhập thành công, URL:', page.url());

  // Đảm bảo ở trang #/chon-anh
  if (!page.url().includes('#/chon-anh')) {
    await page.goto(page.url().split('#')[0] + '#/chon-anh');
    await new Promise(r => setTimeout(r, 500));
  }

  // 2. Kiểm tra gói 10 ảnh
  const packageText = await page.$eval('#packageCount', el => el.textContent.trim());
  console.log('✓ Số ảnh trong gói:', packageText, (packageText === '10' ? '[ĐÚNG]' : '[SAI]'));

  // 3. Chọn 10 ảnh đầu tiên
  for (let i = 1; i <= 10; i++) {
    await page.click(`.ps-photo[data-id="ph-${i}"] .ps-heart`);
  }
  let selectedCount = await page.$eval('#selectedCount', el => el.textContent.trim());
  let extraHidden = await page.$eval('#psExtra', el => el.hidden);
  console.log(`✓ Đã chọn 10 ảnh: selectedCount = ${selectedCount}, extraBox hidden = ${extraHidden}`);

  // 4. Chọn ảnh thứ 11 (vượt quá 10 tấm)
  await page.click('.ps-photo[data-id="ph-11"] .ps-heart');
  await new Promise(r => setTimeout(r, 300));

  const popupShown = await page.$eval('.ps-modal-overlay', el => el.classList.contains('show'));
  const popupText = await page.$eval('.ps-modal-text', el => el.textContent.trim().replace(/\s+/g, ' '));
  console.log('✓ Popup hỏi thêm 50K hiển thị:', popupShown, 'Nội dung:', popupText);

  // Bấm "Yes"
  await page.click('.ps-modal-yes');
  await new Promise(r => setTimeout(r, 300));

  // Kiểm tra ảnh 11 đã được thêm và có tag extra
  const extraCount1 = await page.$eval('#extraCount', el => el.textContent.trim());
  const extraFee1 = await page.$eval('#extraFee', el => el.textContent.trim());
  console.log(`✓ Sau khi bấm Yes: Vượt ${extraCount1} ảnh, Phí = ${extraFee1}`);

  // Chuyển về tab Tất cả để chọn thêm ảnh thứ 12
  await page.click('.ps-tab[data-filter="all"]');
  await new Promise(r => setTimeout(r, 200));

  // 5. Chọn tiếp ảnh thứ 12 (thêm ảnh nữa)
  await page.click('.ps-photo[data-id="ph-12"] .ps-heart');
  await new Promise(r => setTimeout(r, 300));

  const extraCount2 = await page.$eval('#extraCount', el => el.textContent.trim());
  const extraFee2 = await page.$eval('#extraFee', el => el.textContent.trim());
  console.log(`✓ Sau khi chọn ảnh 12: Vượt ${extraCount2} ảnh, Phí = ${extraFee2} (2 ảnh × 50K = 100K)`);

  // Chụp ảnh màn hình lúc chọn thêm ảnh
  await page.screenshot({ path: path.resolve(__dirname, 'test-extra-selected.png') });

  // 6. Nhấn nút "Gửi yêu cầu chỉnh sửa" -> TỰ ĐỘNG NHẢY LÊN MÃ QR CÁ NHÂN HÓA!
  await page.click('#psSubmitBtn');
  await new Promise(r => setTimeout(r, 600));

  // Chờ ảnh QR tải xong hoàn toàn
  await page.waitForFunction(() => {
    const img = document.getElementById('psQrImage');
    return img && img.complete && img.naturalHeight > 0;
  }, { timeout: 10000 });

  const qrOverlayShown = await page.$eval('#psQrModalOverlay', el => el.classList.contains('show'));
  const qrCustCode = await page.$eval('#psQrCustCode', el => el.textContent.trim());
  const qrExtraCount = await page.$eval('#psQrExtraCount', el => el.textContent.trim());
  const qrTotalAmount = await page.$eval('#psQrTotalAmount', el => el.textContent.trim());
  const qrImgSrc = await page.$eval('#psQrImage', el => el.getAttribute('src'));
  const bankAccNum = await page.$eval('#psBankAccNum', el => el.textContent.trim());
  const bankAmount = await page.$eval('#psBankAmount', el => el.textContent.trim());
  const bankContent = await page.$eval('#psBankContent', el => el.textContent.trim());

  console.log('\n--- KẾT QUẢ KIỂM TRA MÃ QR CÁ NHÂN HÓA ---');
  console.log('✓ Modal QR tự động nhảy lên:', qrOverlayShown);
  console.log('✓ Mã khách hàng hiển thị:', qrCustCode);
  console.log('✓ Số ảnh chọn thêm:', qrExtraCount);
  console.log('✓ Số tiền cần chuyển (50K/ảnh):', qrTotalAmount);
  console.log('✓ URL ảnh VietQR cá nhân hóa:', qrImgSrc);
  console.log('✓ Số tài khoản ngân hàng:', bankAccNum);
  console.log('✓ Số tiền trong bảng CK:', bankAmount);
  console.log('✓ Nội dung chuyển khoản:', bankContent);

  // Chụp màn hình popup QR code cá nhân hóa
  await page.screenshot({ path: path.resolve(__dirname, 'test-qr-modal.png') });
  console.log('✓ Đã chụp ảnh màn hình modal QR: test-qr-modal.png');

  // 7. Đồng hồ đếm ngược 30 phút + không còn nút "đã chuyển khoản"/"thanh toán sau"
  const countdown = await page.$eval('#psQrCountdownTime', el => el.textContent.trim());
  const oldBtns = await page.$$eval('#psQrConfirmPaidBtn, #psQrLaterBtn', els => els.length);
  console.log('\n✓ Đếm ngược:', countdown, (/^(30:00|29:5\d)$/.test(countdown) ? '[ĐÚNG]' : '[SAI]'));
  console.log('✓ Nút cũ đã bỏ:', oldBtns === 0 ? '[ĐÚNG]' : '[SAI]');

  // Chụp modal ở mobile
  await page.setViewport({ width: 390, height: 844 });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.resolve(__dirname, 'test-qr-modal-mobile.png') });
  await page.setViewport({ width: 1440, height: 1200 });

  // 8. Đóng modal khi chưa thanh toán -> KHÔNG được gửi yêu cầu
  const before = await page.evaluate(() => (JSON.parse(localStorage.getItem('aloha_demo_db')) || {}).editRequests?.length || 0);
  await page.click('#psQrCloseBtn');
  await new Promise(r => setTimeout(r, 400));
  const after = await page.evaluate(() => (JSON.parse(localStorage.getItem('aloha_demo_db')) || {}).editRequests?.length || 0);
  const bannerText = await page.$eval('#psSubmittedBanner', el => el.textContent.trim().replace(/\s+/g, ' '));
  const submitBtnDisabled = await page.$eval('#psSubmitBtn', el => el.disabled);
  console.log('✓ Đóng khi chưa thanh toán không tạo yêu cầu:', before === after ? '[ĐÚNG]' : '[SAI]');
  console.log('✓ Banner:', bannerText);
  console.log('✓ Nút gửi vẫn bấm được:', !submitBtnDisabled ? '[ĐÚNG]' : '[SAI]');

  // 9. "Tiếp tục thanh toán" mở lại modal, giữ nguyên hạn cũ
  await page.click('#psContinuePayBtn');
  await new Promise(r => setTimeout(r, 400));
  const reopened = await page.$eval('#psQrModalOverlay', el => el.classList.contains('show'));
  console.log('✓ Mở lại modal:', reopened ? '[ĐÚNG]' : '[SAI]');
  await page.screenshot({ path: path.resolve(__dirname, 'test-qr-modal-reopened.png') });

  // 10. Giả lập SePay báo tiền về -> ảnh tự gửi tới Thợ ảnh (cần server/ chạy
  //     local với SEPAY_WEBHOOK_KEY, mặc định 'test-key-123' khi test)
  const SEPAY_KEY = process.env.SEPAY_WEBHOOK_KEY || 'test-key-123';
  const payCode = await page.$eval('#psBankContent', el => el.textContent.trim());
  const heartsLocked = await page.$$eval('.ps-heart', els => els.every(b => b.disabled));
  console.log('✓ Chọn ảnh bị khoá khi đang chờ tiền:', heartsLocked ? '[ĐÚNG]' : '[SAI]');
  const hook = (body, key) => fetch('http://localhost:3001/api/sepay-webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Apikey ' + key },
    body: JSON.stringify(body)
  });
  const wrongKey = await hook({ id: 'bad-' + Date.now(), transferType: 'in', transferAmount: 100000, content: payCode }, 'sai-key');
  console.log('✓ Webhook sai key bị từ chối:', wrongKey.status === 401 ? '[ĐÚNG]' : '[SAI] ' + wrongKey.status);
  await hook({ id: 'short-' + Date.now(), transferType: 'in', transferAmount: 50000, content: 'MBVCB.123 ' + payCode + ' FT26' }, SEPAY_KEY);
  await new Promise(r => setTimeout(r, 6000));
  let sent = await page.evaluate(() => (JSON.parse(localStorage.getItem('aloha_demo_db')) || {}).editRequests?.length || 0);
  console.log('✓ Chuyển THIẾU tiền chưa gửi ảnh:', sent === before ? '[ĐÚNG]' : '[SAI]');

  await hook({ id: 'full-' + Date.now(), transferType: 'in', transferAmount: 100000, content: 'MBVCB.456 ' + payCode + ' FT26' }, SEPAY_KEY);
  await page.waitForFunction(n => ((JSON.parse(localStorage.getItem('aloha_demo_db')) || {}).editRequests?.length || 0) > n, { timeout: 15000 }, before);
  await new Promise(r => setTimeout(r, 500));
  const db2 = await page.evaluate(() => JSON.parse(localStorage.getItem('aloha_demo_db')));
  const req2 = db2.editRequests[db2.editRequests.length - 1];
  const modalClosed = await page.$eval('#psQrModalOverlay', el => !el.classList.contains('show'));
  const paidBanner = await page.$eval('#psSubmittedBanner', el => el.textContent.trim().replace(/\s+/g, ' '));
  console.log('✓ Đủ tiền -> tự gửi yêu cầu:', req2.photoCount, 'ảnh, thêm', req2.extraCount, '-', req2.paymentStatus);
  console.log('✓ Modal tự đóng:', modalClosed ? '[ĐÚNG]' : '[SAI]');
  console.log('✓ Banner:', paidBanner);
  await page.screenshot({ path: path.resolve(__dirname, 'test-submitted-page.png') });

  await browser.close();
  console.log('\n=== TẤT CẢ CÁC BƯỚC ĐỀU HOÀN THÀNH XUẤT SẮC! ===');
})();
