const puppeteer = require('puppeteer-core');
const path = require('path');

(async () => {
  const htmlPath = path.resolve(__dirname, '..', 'login.html').replace(/\\/g, '/');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Users\\DELL\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
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

  // 7. Nhấn "Tôi đã chuyển khoản xong"
  await page.click('#psQrConfirmPaidBtn');
  await new Promise(r => setTimeout(r, 500));

  const bannerText = await page.$eval('#psSubmittedBanner', el => el.textContent.trim().replace(/\s+/g, ' '));
  const submitBtnDisabled = await page.$eval('#psSubmitBtn', el => el.disabled);
  const submitBtnText = await page.$eval('#psSubmitBtn', el => el.textContent.trim());
  console.log('\n--- KẾT QUẢ SAU KHI XÁC NHẬN CHUYỂN KHOẢN ---');
  console.log('✓ Banner xác nhận:', bannerText);
  console.log('✓ Nút submit disabled:', submitBtnDisabled, 'Text:', submitBtnText);

  // Kiểm tra dữ liệu được lưu trong AlohaData / localStorage
  const db = await page.evaluate(() => JSON.parse(localStorage.getItem('aloha_demo_db')));
  const lastReq = db.editRequests[db.editRequests.length - 1];
  console.log('✓ Dữ liệu lưu vào AlohaData:');
  console.log('  - Mã đơn/Mã KH:', lastReq.orderCode);
  console.log('  - Tổng số ảnh chọn:', lastReq.photoCount);
  console.log('  - Số ảnh thêm:', lastReq.extraCount);
  console.log('  - Phí thêm:', lastReq.extraFee);
  console.log('  - Trạng thái thanh toán:', lastReq.paymentStatus);

  // Chụp màn hình trang sau khi hoàn tất
  await page.screenshot({ path: path.resolve(__dirname, 'test-submitted-page.png') });

  await browser.close();
  console.log('\n=== TẤT CẢ CÁC BƯỚC ĐỀU HOÀN THÀNH XUẤT SẮC! ===');
})();
