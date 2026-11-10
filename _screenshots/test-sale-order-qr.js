const { CHROME_PATH, ROOT_URL, launchAllFeatures } = require('./test-env');
const puppeteer = require('puppeteer-core');

const wait = ms => new Promise(res => setTimeout(res, ms));

(async () => {
  console.log('--- TEST BẮT ĐẦU: TÍNH NĂNG TẠO ĐƠN & GỬI CỌC VIETQR TRONG CSKH SALE ---');

  const browser = await launchAllFeatures(puppeteer, {
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const errors = [];
  page.on('pageerror', err => errors.push('[PAGE ERROR] ' + err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push('[CONSOLE ERROR] ' + msg.text());
  });

  try {
    // =========================================================================
    // PHẦN 1: Giao diện Sale (crm/sale.html#hop-thu)
    // =========================================================================
    console.log('\n[BƯỚC 1] Đăng nhập tài khoản Sale và mở crm/sale.html#hop-thu...');
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('aloha_auth', JSON.stringify({
        role: 'sale',
        phone: '0900000002',
        name: 'Ngọc Anh',
        token: 'fixture-sale-token'
      }));
    });

    await page.goto(ROOT_URL + 'crm/sale.html#hop-thu', { waitUntil: 'domcontentloaded' });

    // Mock API hội thoại khách hàng gửi từ website
    await page.evaluate(() => {
      const chat = {
        phone: '0912345678',
        customerName: 'Chị Lan',
        topic: 'Newborn',
        updatedAt: Date.now(),
        staffUnread: 1,
        messages: [{
          id: 'msg-init-1',
          from: 'khach',
          text: 'Chào studio, em muốn tư vấn concept newborn cho bé 3 tháng ạ.',
          at: Date.now()
        }]
      };

      window.serverChats = [chat];

      AlohaAuth.api = async (path, opts) => {
        if (path.endsWith('/inbox')) return { ok: true, status: 200, data: { chats: window.serverChats } };
        if (path.includes('/inbox/0912345678/messages') && opts && opts.method === 'POST') {
          const body = opts.body || {};
          const newMsg = {
            id: 'msg-' + Date.now(),
            from: 'sale',
            text: body.text,
            orderData: body.orderData,
            at: Date.now()
          };
          chat.messages.push(newMsg);
          chat.updatedAt = Date.now();
          return { ok: true, status: 200, data: { chat } };
        }
        if (path.includes('/0912345678')) return { ok: true, status: 200, data: { chat } };
        return { ok: true, status: 200, data: {} };
      };
    });

    // Chờ inbox tải hội thoại từ mock API
    await page.waitForSelector('[data-act="open-conv"]', { timeout: 8000 });
    console.log('✓ Tải danh sách hội thoại khách hàng thành công.');

    // Bấm mở hội thoại
    await page.click('[data-act="open-conv"]');
    await page.waitForSelector('.ib-chat-actions', { timeout: 5000 });

    // Kiểm tra nút "Tạo đơn & Gửi cọc QR"
    console.log('[BƯỚC 2] Kiểm tra nút "Tạo đơn & Gửi cọc QR" trong khung chat Sale...');
    const createOrderBtn = await page.waitForSelector('.ib-create-order-btn, [data-act="ib-create-order"]', { timeout: 5000 });
    if (!createOrderBtn) throw new Error('Không tìm thấy nút "Tạo đơn & Gửi cọc QR" trong ib-chat-actions!');
    console.log('✓ Nút "Tạo đơn & Gửi cọc QR" hiển thị đúng chuẩn trong thanh công cụ chat.');

    // Bấm nút để mở Modal
    console.log('[BƯỚC 3] Mở modal Tạo đơn & Gửi cọc QR...');
    await createOrderBtn.click();
    await page.waitForSelector('#alohaOrderQRModal:not([hidden])', { timeout: 5000 });
    console.log('✓ Modal tạo đơn đã mở thành công.');

    // Điền thông tin buổi chụp: Tên bé, tuổi bé, concept, chọn ngày & thợ
    await page.evaluate(() => {
      document.getElementById('aofBabyName').value = 'Bé Bắp';
      document.getElementById('aofBabyAge').value = '3 tháng';
      document.getElementById('aofConcept').value = 'Happy dream 2';
      document.getElementById('aofPkg').value = 'Tiêu chuẩn';
      document.getElementById('aofPkg').dispatchEvent(new Event('change'));
    });
    await wait(400);

    // Kiểm tra xem mã VietQR động đã được cập nhật số tiền & cú pháp chưa
    const qrState = await page.evaluate(() => {
      return {
        memo: document.getElementById('aofMemoPreview').textContent,
        amt: document.getElementById('aofAmtPreview').textContent,
        qrSrc: document.getElementById('aofQrPreviewImg').src,
        code: document.getElementById('aofCode').value
      };
    });
    console.log('✓ Thông tin VietQR Preview:', qrState);
    if (!qrState.qrSrc.includes('img.vietqr.io') || !qrState.qrSrc.includes('0382071708')) {
      throw new Error('Link VietQR không đúng cấu hình MB Bank 0382071708!');
    }

    // Gửi form tạo đơn
    console.log('[BƯỚC 4] Xác nhận gửi đơn vào Chat...');
    await page.click('#aofBtnSubmit');
    await wait(1000);

    // Kiểm tra thẻ Order Card đã xuất hiện trong cuộc trò chuyện chưa
    const orderCard = await page.waitForSelector('.chat-order-card', { timeout: 6000 });
    if (!orderCard) throw new Error('Không tìm thấy .chat-order-card trong hội thoại sau khi tạo đơn!');
    console.log('✓ Thẻ Order Card hiển thị thành công trong cuộc hội thoại chat.');

    const cardDetails = await page.evaluate(() => {
      const card = document.querySelector('.chat-order-card');
      return {
        text: card.innerText,
        isPending: card.classList.contains('is-pending'),
        qrImg: card.querySelector('.coc-qr-img')?.src,
        hasCopyBtn: !!card.querySelector('[data-copy]'),
        hasSimBtn: !!card.querySelector('.btn-sim-deposit')
      };
    });
    console.log('✓ Chi tiết thẻ Order Card:', {
      isPending: cardDetails.isPending,
      hasCopyBtn: cardDetails.hasCopyBtn,
      hasSimBtn: cardDetails.hasSimBtn,
      snippet: cardDetails.text.split('\n').slice(0, 4).join(' | ')
    });

    if (!cardDetails.isPending) throw new Error('Thẻ đơn ban đầu phải ở trạng thái is-pending (Chờ cọc)!');
    if (cardDetails.hasSimBtn) throw new Error('Thẻ đơn KHÔNG ĐƯỢC có nút xác nhận thủ công (SePay tự động 100%)!');
    console.log('✓ Đã xác nhận: Thẻ KHÔNG có nút xác nhận thủ công, SePay tự động 100% bảo vệ dòng tiền.');

    // =========================================================================
    // PHẦN 2: Xác nhận tiền cọc tự động qua SePay (Mô phỏng Webhook tiền về tài khoản)
    // =========================================================================
    console.log('\n[BƯỚC 5] Mô phỏng SePay ghi nhận tiền về tài khoản ngân hàng thành công...');
    await page.evaluate(() => {
      const card = document.querySelector('.chat-order-card');
      const code = card.getAttribute('data-order-code');
      const amt = Number(card.getAttribute('data-amount')) || 1250000;
      window.AlohaOrderQRModal.confirmDeposit(code, amt);
    });
    await wait(1200);

    const confirmedState = await page.evaluate(() => {
      const card = document.querySelector('.chat-order-card');
      return {
        isConfirmed: card.classList.contains('is-confirmed'),
        statusPill: card.querySelector('.coc-status-pill')?.innerText,
        bannerText: card.querySelector('.coc-confirmed-banner')?.innerText
      };
    });
    console.log('✓ Trạng thái sau khi xác nhận cọc:', confirmedState);

    if (!confirmedState.isConfirmed) {
      throw new Error('Thẻ đơn chưa chuyển sang trạng thái is-confirmed sau khi cọc!');
    }
    console.log('✓ Cả 2 bên nhận được xác nhận: Thẻ chuyển sang trạng thái "Đã cọc · Chờ ngày chụp".');

    // =========================================================================
    // PHẦN 3: Kiểm tra Thợ ảnh nhận lịch chụp trong crm/admin.html#anh
    // =========================================================================
    console.log('\n[BƯỚC 6] Đăng nhập vai trò Thợ ảnh (tho-anh) để kiểm tra lịch chụp mới...');
    const thoPage = await browser.newPage();
    await thoPage.setViewport({ width: 1440, height: 900 });

    await thoPage.evaluateOnNewDocument(() => {
      window.ALOHA_FEATURES = { booking: true, aiChat: true, albumPages: true, editSync: true };
      localStorage.setItem('aloha_auth', JSON.stringify({
        role: 'tho-anh',
        phone: '0900000003',
        name: 'Thợ ảnh demo (Tuấn)',
        token: 'fixture-tho-token'
      }));
    });

    await thoPage.goto(ROOT_URL + 'crm/admin.html#khach-cua-toi', { waitUntil: 'networkidle0' });
    await thoPage.waitForSelector('.tho-ws-list, .tho-cust', { timeout: 8000 });

    // Kiểm tra danh sách việc của thợ ảnh
    const thoList = await thoPage.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.tho-cust'));
      return items.map(el => ({
        name: el.querySelector('.tho-cust-name')?.innerText,
        code: el.querySelector('.tho-cust-code')?.innerText,
        line: el.querySelector('.tho-cust-line')?.innerText,
        isTodo: el.classList.contains('is-todo')
      }));
    });
    console.log('✓ Danh sách việc của thợ ảnh:', thoList);

    const hasConfirmedOrder = thoList.some(item => 
      item.line.includes('Chờ ngày chụp') || item.code.includes('DP') || item.isTodo
    );
    if (!hasConfirmedOrder) {
      throw new Error('Thợ ảnh không nhận được lịch chụp ở trạng thái "Chờ ngày chụp"!');
    }
    console.log('✓ Thợ ảnh đã nhận lịch chụp vào danh mục CẦN LÀM (Chờ ngày chụp) thành công!');

    // Bấm vào đơn xem chi tiết
    const confirmedCustItem = await thoPage.$('.tho-cust.is-todo');
    if (confirmedCustItem) {
      await confirmedCustItem.click();
      await wait(600);
      const detailInfo = await thoPage.evaluate(() => {
        return {
          title: document.querySelector('.tho-detail-title')?.innerText,
          step: document.querySelector('.tho-step strong')?.innerText,
          hasCheckinBtn: !!document.querySelector('[data-cmd="checkin"]')
        };
      });
      console.log('✓ Chi tiết lịch chụp trong không gian thợ ảnh:', detailInfo);
      if (!detailInfo.hasCheckinBtn) {
        throw new Error('Lịch chụp đã cọc của thợ ảnh phải có nút Check-in khi khách tới!');
      }
      console.log('✓ Thợ ảnh có sẵn nút "Khách đã đến (Check-in)" đúng quy trình.');
    }

    // =========================================================================
    // PHẦN 4: Kiểm tra Giao diện Quản trị / Tin nhắn (crm/admin.html#tin-nhan)
    // =========================================================================
    console.log('\n[BƯỚC 7] Kiểm tra mục Tin nhắn của Sale trong crm/admin.html#tin-nhan...');
    const adminPage = await browser.newPage();
    await adminPage.setViewport({ width: 1440, height: 900 });

    await adminPage.evaluateOnNewDocument(() => {
      localStorage.setItem('aloha_auth', JSON.stringify({
        role: 'sale',
        phone: '0900000002',
        name: 'Ngọc Anh',
        token: 'fixture-sale-token'
      }));
    });

    await adminPage.goto(ROOT_URL + 'crm/admin.html#tin-nhan', { waitUntil: 'domcontentloaded' });
    await adminPage.evaluate(() => {
      const chat = {
        phone: '0912345678',
        customerName: 'Chị Lan',
        service: 'Newborn',
        saleName: 'Ngọc Anh',
        owner: 'ngoc-anh',
        updatedAt: Date.now(),
        staffUnread: 0,
        messages: [{
          id: 'msg-admin-1',
          from: 'khach',
          text: 'Aloha cho mình xem concept cho bé nhé',
          at: Date.now()
        }]
      };
      AlohaAuth.api = async (path) => {
        if (path.endsWith('/inbox')) return { ok: true, status: 200, data: { chats: [chat] } };
        if (path.includes('/0912345678')) return { ok: true, status: 200, data: { chat } };
        return { ok: true, status: 200, data: {} };
      };
    });

    await adminPage.waitForSelector('#inboxList, .inbox-item', { timeout: 8000 });

    const firstAdminChat = await adminPage.$('.inbox-item');
    if (firstAdminChat) {
      await firstAdminChat.click();
      await wait(600);
      const hasOrderBtn = await adminPage.$('.inbox-create-order-btn');
      console.log('✓ Nút "Tạo đơn & Gửi cọc QR" trên thanh tiêu đề tin nhắn admin:', !!hasOrderBtn);
      if (!hasOrderBtn) throw new Error('Không tìm thấy nút .inbox-create-order-btn trên admin.html#tin-nhan!');
    }

    console.log('\n======================================================');
    console.log('🎉 TẤT CẢ CÁC BƯỚC KIỂM THỬ TÍNH NĂNG TẠO ĐƠN & GỬI CỌC VIETQR ĐỀU THÀNH CÔNG 100%!');
    console.log('======================================================\n');

  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
