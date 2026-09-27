const { CHROME_PATH, ROOT_URL } = require('./test-env');
// Test: "Ảnh của tôi" phân biệt đã/chưa chụp, request chỉnh sửa chuyển thật
// sang Thợ ảnh, chatbot đa nhánh, nút liên hệ Sale, khung chat tự do khi
// server AI tắt.
const puppeteer = require('puppeteer-core');
const BASE = ROOT_URL;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new', args: ['--no-sandbox']
  });
  const results = [];
  function log(name, ok, detail) {
    results.push({ name, ok, detail });
    console.log((ok ? 'OK  ' : 'FAIL') + ' - ' + name + (detail ? ' :: ' + detail : ''));
  }

  async function loginDemo(page) {
    await page.goto(BASE + 'login.html', { waitUntil: 'networkidle0' });
    await page.type('#loginPhone', '0900000001');
    await page.type('#loginPassword', 'khach123');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('#loginSubmitBtn')
    ]);
  }

  // 1) Khách demo (đã có seed hasShoot) -> thấy ảnh, không thấy trạng thái rỗng
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await loginDemo(page);
    const emptyHidden = await page.$eval('#psEmptyState', el => el.hidden);
    const gridCount = await page.$$eval('.ps-photo', els => els.length);
    log('khách demo (đã chụp) thấy lưới ảnh, không thấy trạng thái rỗng', emptyHidden && gridCount > 0, 'gridCount=' + gridCount);
    await page.close();
  }

  // 2) Khách mới đăng ký -> chưa có ảnh, thấy trạng thái rỗng
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + 'login.html?mode=register', { waitUntil: 'networkidle0' });
    await page.type('#loginName', 'Khách Mới');
    await page.type('#loginPhone', '0933444555');
    await page.type('#loginPassword', 'matkhau123');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('#loginSubmitBtn')
    ]);
    await page.goto(BASE + 'index.html#/chon-anh', { waitUntil: 'networkidle0' });
    const emptyShown = await page.$eval('#psEmptyState', el => !el.hidden);
    const contentHidden = await page.$eval('#psContent', el => getComputedStyle(el).display === 'none');
    const summaryHidden = await page.$eval('#psSummaryCard', el => getComputedStyle(el).display === 'none');
    const orderInfoNoFakeOrder = await page.$eval('#psOrderInfo', el => !el.textContent.includes('#AB240915'));
    log('khách mới đăng ký -> "Ảnh của tôi" báo chưa có ảnh nào (kể cả phần đầu trang)', emptyShown && contentHidden && summaryHidden && orderInfoNoFakeOrder);
    await page.close();
  }

  // 3) Khách demo chọn ảnh, gửi yêu cầu -> Thợ ảnh thấy request thật trong kanban
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await loginDemo(page);
    await page.click('.ps-photo[data-id="ph-1"] .ps-heart');
    await page.click('.ps-photo[data-id="ph-2"] .ps-heart');
    // Ô ghi chú chung chỉ hiện ở tab Yêu thích (ẩn ở tab Tất cả): gõ khi ô đang ẩn
    // thì chữ rơi vào nút tim vừa bấm, dấu cách bấm lại tim và bỏ chọn ảnh.
    await page.click('.ps-tab[data-filter="liked"]');
    await page.type('#psNote', 'Lam da be sang tu nhien');
    await page.click('#psSubmitBtn');
    await new Promise(r => setTimeout(r, 300));
    const submitted = await page.$eval('#psSubmittedBanner', el => el.classList.contains('show'));
    log('gửi yêu cầu chỉnh sửa -> hiện banner xác nhận', submitted);

    // Đăng xuất, đăng nhập vai trò Thợ ảnh, kiểm tra request xuất hiện
    await page.evaluate(() => { /* giữ nguyên localStorage aloha_demo_db, chỉ đổi session */ });
    await page.goto(BASE + 'login.html', { waitUntil: 'networkidle0' });
    await page.type('#loginPhone', '0900000003');
    await page.type('#loginPassword', 'anh123');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('#loginSubmitBtn')
    ]);
    const kanbanText = await page.$eval('#kanbanCol-cho-xu-ly', el => el.textContent);
    const hasRequest = kanbanText.includes('Khách demo') && kanbanText.includes('Mới') && kanbanText.includes('2 ảnh');
    log('Thợ ảnh thấy yêu cầu chỉnh sửa thật trong cột "Chờ xử lý"', hasRequest, kanbanText.replace(/\s+/g, ' ').trim());

    // Bấm "Chuyển sang bước tiếp theo" trên đúng thẻ request thật (có badge "Mới",
    // không phải thẻ minh hoạ tĩnh cũng nằm trong cùng cột) -> request rời khỏi cột Chờ xử lý
    await page.evaluate(() => {
      const card = Array.from(document.querySelectorAll('#kanbanCol-cho-xu-ly .kanban-card'))
        .find(c => c.textContent.includes('Mới'));
      const btn = card && card.querySelector('.kanban-advance-btn');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 200));
    const stillInColumn1 = await page.$eval('#kanbanCol-cho-xu-ly', el => el.textContent.includes('Mới'));
    const nowInColumn2 = await page.$eval('#kanbanCol-dang-thuc-hien', el => el.textContent.includes('Mới'));
    log('bấm chuyển bước -> request sang cột "Đang thực hiện"', !stillInColumn1 && nowInColumn2);
    await page.close();
  }

  // 4) Chatbot: menu chính có nhiều nhánh (không chỉ hỏi dịch vụ ngay)
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + 'index.html', { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.setItem('aloha_auth', JSON.stringify({ role: 'khach-hang', name: 'Test', phone: '0900000009', loginAt: Date.now() })));
    await page.reload({ waitUntil: 'networkidle0' });
    await page.click('#chatToggle');
    await new Promise(r => setTimeout(r, 1300));
    const quickReplies = await page.$$eval('.chat-quick button', els => els.map(e => e.textContent));
    const hasMenu = quickReplies.includes('Tư vấn dịch vụ & báo giá') && quickReplies.includes('Quy trình đặt lịch') && quickReplies.includes('Câu hỏi thường gặp');
    log('chatbot mở ra menu chính nhiều nhánh (không đi thẳng vào chọn dịch vụ)', hasMenu, quickReplies.join(', '));

    // Chọn "Quy trình đặt lịch" -> có nội dung trả lời + quay lại được menu
    const menuBtns = await page.$$('.chat-quick button');
    for (const b of menuBtns) {
      const t = await page.evaluate(el => el.textContent, b);
      if (t === 'Quy trình đặt lịch') { await b.click(); break; }
    }
    await new Promise(r => setTimeout(r, 1500));
    const bodyText = await page.evaluate(() => document.getElementById('chatBody').textContent);
    log('nhánh "Quy trình đặt lịch" trả lời đúng nội dung 5 bước', bodyText.includes('Đặt cọc'));
    await page.close();
  }

  // 5) Nút "Liên hệ Sale trực tiếp" (thanh cố định) tồn tại và trỏ tới tel:
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + 'index.html', { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.setItem('aloha_auth', JSON.stringify({ role: 'khach-hang', name: 'Test', phone: '0900000009', loginAt: Date.now() })));
    await page.reload({ waitUntil: 'networkidle0' });
    await page.click('#chatToggle');
    await new Promise(r => setTimeout(r, 300));
    const href = await page.$eval('.chat-sale-bar a', el => el.getAttribute('href'));
    log('thanh liên hệ Sale hiện sẵn trong khung chat, trỏ đúng hotline', href === 'tel:0938125222', href);
    await page.close();
  }

  // 6) Khung chat tự do khi server AI KHÔNG chạy -> trả lời cục bộ, không hiện lỗi
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.setRequestInterception(true);
    page.on('request', (r) => (r.url().includes(':3001/') ? r.abort() : r.continue()));
    await page.goto(BASE + 'index.html', { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.setItem('aloha_auth', JSON.stringify({ role: 'khach-hang', name: 'Test', phone: '0900000009', loginAt: Date.now() })));
    await page.reload({ waitUntil: 'networkidle0' });
    await page.click('#chatToggle');
    await new Promise(r => setTimeout(r, 300));
    await page.type('#chatInput', 'Chi phi chup newborn bao nhieu?');
    await page.click('.chat-send');
    await new Promise(r => setTimeout(r, 1500));
    const hasErrorMsg = await page.$('.chat-msg.error') !== null;
    const localReply = await page.evaluate(() => document.getElementById('chatBody').textContent.includes('2.200.000đ'));
    log('server AI tắt: khung nhập tự do trả lời cục bộ, không hiện lỗi', !hasErrorMsg && localReply);
    await page.close();
  }

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (failed.length === 0 ? 'TẤT CẢ TEST PASS' : failed.length + ' TEST FAIL'));
  process.exit(failed.length === 0 ? 0 : 1);
})();
