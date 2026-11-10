const puppeteer = require('puppeteer-core');
const path = require('path');
const assert = require('assert/strict');
const { CHROME_PATH, ROOT_URL } = require('./test-env');

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

const REPORT = {
  timestamp: new Date().toISOString(),
  sections: {}
};

function logHeader(title) {
  console.log('\n======================================================================');
  console.log(`  ${title}`);
  console.log('======================================================================');
}

(async () => {
  console.log('KHỞI CHẠY KIỂM TOÁN VIÊN ĐỘC LẬP (INDEPENDENT UI & WORKFLOW AUDIT)');
  console.log('Target URL:', ROOT_URL);
  console.log('Chrome:', CHROME_PATH);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    // =========================================================================
    // PHẦN 1: GIAO DIỆN HỘP THƯ (crm/sale.html#hop-thu)
    // =========================================================================
    logHeader('PHẦN 1: KIỂM TOÁN GIAO DIỆN HỘP THƯ (crm/sale.html#hop-thu)');
    REPORT.sections.inbox = {};

    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900 });

      // Mock auth for Sale
      await page.evaluateOnNewDocument(() => {
        localStorage.setItem(
          'aloha_auth',
          JSON.stringify({
            role: 'sale',
            name: 'Ngọc Anh',
            phone: '0900000002',
            token: 'fixture-audit-sale'
          })
        );
      });

      await page.goto(ROOT_URL + 'crm/sale.html#hop-thu', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => typeof window.AlohaOrderQRModal !== 'undefined');

      console.log('\n[1.1] Kiểm tra thứ tự sắp xếp danh sách hội thoại...');
      // Test sorting with 4 conversations: 21/10, 20/10, 16/10, 13/10
      const sortResult = await page.evaluate(async () => {
        // Timestamps in milliseconds
        // 13/10/2026: 1791829748600
        // 16/10/2026: 1792116976102
        // 20/10/2026: 1792514071307
        // 21/10/2026: 1792517450783
        const mockChats = [
          { phone: '0900000013', customerName: 'Khách 13/10 (Cũ nhất)', topic: 'Newborn', updatedAt: 1791829748600, staffUnread: 1, last: { text: 'Nội dung tin nhắn 13/10', at: 1791829748600 } },
          { phone: '0900000016', customerName: 'Khách 16/10', topic: 'Sinh nhật', updatedAt: 1792116976102, staffUnread: 1, last: { text: 'Nội dung tin nhắn 16/10', at: 1792116976102 } },
          { phone: '0900000020', customerName: 'Khách 20/10', topic: 'Gia đình', updatedAt: 1792514071307, staffUnread: 1, last: { text: 'Nội dung tin nhắn 20/10', at: 1792514071307 } },
          { phone: '0900000021', customerName: 'Khách 21/10 (Mới nhất)', topic: 'Bé lớn', updatedAt: 1792517450783, staffUnread: 1, last: { text: 'Nội dung tin nhắn 21/10', at: 1792517450783 } }
        ];

        window.AlohaAuth.api = async (url) => {
          if (url.endsWith('/inbox')) return { ok: true, status: 200, data: { chats: mockChats } };
          for (const c of mockChats) {
            if (url.includes(c.phone)) return { ok: true, status: 200, data: { chat: { ...c, messages: [{ from: 'khach', text: c.last.text, at: c.updatedAt }] } } };
          }
          return { ok: true, status: 200, data: {} };
        };

        // Poll interval is 3s, let's wait 3.5s for inbox liveRefresh
        await new Promise((r) => setTimeout(r, 3600));

        const getRenderedOrder = () => {
          return Array.from(document.querySelectorAll('.ib-item')).map((el) => ({
            name: el.querySelector('strong')?.textContent?.trim(),
            time: el.querySelector('small')?.textContent?.trim(),
            preview: el.querySelector('.ib-preview')?.textContent?.trim()
          }));
        };

        const initialOrder = getRenderedOrder();

        // Now test reactive jump to top:
        // Khách 13/10 (đang ở đáy) gửi tin nhắn mới toanh NGAY BÂY GIỜ!
        const nowTs = Date.now() + 100000;
        mockChats[0].updatedAt = nowTs;
        mockChats[0].last = { text: 'Khách 13/10 vừa nhắn thêm tin mới!', at: nowTs };

        // Wait for next poll
        await new Promise((r) => setTimeout(r, 3600));

        const orderAfterNewMsg = getRenderedOrder();

        return { initialOrder, orderAfterNewMsg };
      });

      console.log('Thứ tự ban đầu (Newest on top):');
      sortResult.initialOrder.forEach((item, idx) => console.log(`  [${idx}] ${item.name} | ${item.time} | ${item.preview}`));

      const isInitiallySorted =
        sortResult.initialOrder.length === 4 &&
        sortResult.initialOrder[0].name.includes('21/10') &&
        sortResult.initialOrder[1].name.includes('20/10') &&
        sortResult.initialOrder[2].name.includes('16/10') &&
        sortResult.initialOrder[3].name.includes('13/10');

      console.log('Kết quả kiểm tra sắp xếp ban đầu:', isInitiallySorted ? 'PASS ✅' : 'FAIL ❌');

      console.log('\nThứ tự sau khi khách 13/10 gửi tin nhắn mới (Reactive Jump to Top):');
      sortResult.orderAfterNewMsg.forEach((item, idx) => console.log(`  [${idx}] ${item.name} | ${item.time} | ${item.preview}`));

      const isJumpToTopSuccess =
        sortResult.orderAfterNewMsg.length === 4 &&
        sortResult.orderAfterNewMsg[0].name.includes('13/10') &&
        sortResult.orderAfterNewMsg[0].preview === 'Khách 13/10 vừa nhắn thêm tin mới!' &&
        sortResult.orderAfterNewMsg[1].name.includes('21/10') &&
        sortResult.orderAfterNewMsg[2].name.includes('20/10') &&
        sortResult.orderAfterNewMsg[3].name.includes('16/10');

      console.log('Kết quả kiểm tra nhảy lên đầu:', isJumpToTopSuccess ? 'PASS ✅' : 'FAIL ❌');

      REPORT.sections.inbox.sorting = {
        initialSorted: isInitiallySorted,
        initialOrder: sortResult.initialOrder,
        jumpToTopSuccess: isJumpToTopSuccess,
        orderAfterNewMsg: sortResult.orderAfterNewMsg
      };

      await page.close();
    }

    // [1.2] Mobile Viewport Test (390x844)
    {
      console.log('\n[1.2] Kiểm tra Hộp thư trên Mobile (390x844)...');
      const mobilePage = await browser.newPage();
      await mobilePage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

      await mobilePage.evaluateOnNewDocument(() => {
        localStorage.setItem(
          'aloha_auth',
          JSON.stringify({
            role: 'sale',
            name: 'Ngọc Anh',
            phone: '0900000002',
            token: 'fixture-audit-sale-mobile'
          })
        );
      });

      await mobilePage.goto(ROOT_URL + 'crm/sale.html#hop-thu', { waitUntil: 'domcontentloaded' });
      await mobilePage.waitForFunction(() => typeof window.AlohaOrderQRModal !== 'undefined');

      // Seed 2 mock conversations
      await mobilePage.evaluate(async () => {
        const chats = [
          { phone: '0988888888', customerName: 'Chị Mai Linh', topic: 'Newborn', updatedAt: Date.now() - 60000, staffUnread: 1, last: { text: 'Em muốn tư vấn gói Newborn ạ', at: Date.now() - 60000 } },
          { phone: '0977777777', customerName: 'Anh Tuấn', topic: 'Bé lớn', updatedAt: Date.now() - 120000, staffUnread: 0, last: { text: 'Cảm ơn em nhé', at: Date.now() - 120000 } }
        ];
        window.AlohaAuth.api = async (url) => {
          if (url.endsWith('/inbox')) return { ok: true, status: 200, data: { chats } };
          const c = chats.find(x => url.includes(x.phone));
          if (c) return { ok: true, status: 200, data: { chat: { ...c, messages: [{ from: 'khach', text: c.last.text, at: c.updatedAt }] } } };
          return { ok: true, status: 200, data: {} };
        };
        await new Promise((r) => setTimeout(r, 3600));
      });

      // Screenshot inbox list on mobile
      await mobilePage.screenshot({ path: '_screenshots/audit_inbox_mobile_list.png', fullPage: true });

      // Click to open conversation
      console.log('Bấm mở hội thoại Chị Mai Linh...');
      await mobilePage.click('.ib-item');
      await wait(500);

      const chatMetrics = await mobilePage.evaluate(() => {
        const bodyClass = document.body.className;
        const hasChatOpen = document.body.classList.contains('chat-open');
        const swHead = document.getElementById('swHead');
        const swBottom = document.getElementById('swBottom');
        const wfPanel = document.querySelector('.sw-main > .wf-panel');
        const ibChatHead = document.querySelector('.ib-chat-head');
        const ibMsgs = document.getElementById('ibMsgs');
        const ibCompose = document.querySelector('.ib-compose');
        const backBtn = document.querySelector('.ib-back');
        const inputEl = document.getElementById('ibInput');

        const isVisible = (el) => {
          if (!el) return false;
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        };

        const getBox = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const s = window.getComputedStyle(el);
          return {
            top: Math.round(r.top),
            bottom: Math.round(r.bottom),
            left: Math.round(r.left),
            right: Math.round(r.right),
            width: Math.round(r.width),
            height: Math.round(r.height),
            display: s.display,
            position: s.position,
            zIndex: s.zIndex
          };
        };

        return {
          hasChatOpen,
          swHeadVisible: isVisible(swHead),
          swBottomVisible: isVisible(swBottom),
          wfPanelVisible: isVisible(wfPanel),
          headBox: getBox(ibChatHead),
          msgsBox: getBox(ibMsgs),
          composeBox: getBox(ibCompose),
          backBtnBox: getBox(backBtn),
          viewport: { width: window.innerWidth, height: window.innerHeight }
        };
      });

      console.log('Chat Metrics trên Mobile:', JSON.stringify(chatMetrics, null, 2));

      // Assertions for mobile chat view:
      const mobileChatSafe =
        chatMetrics.hasChatOpen === true &&
        chatMetrics.swHeadVisible === false && // Header hidden
        chatMetrics.swBottomVisible === false && // Bottom nav hidden (not blocking chat!)
        chatMetrics.composeBox &&
        chatMetrics.composeBox.bottom <= 845 && // Within viewport
        chatMetrics.composeBox.top >= 700 && // Positioned at bottom
        chatMetrics.backBtnBox &&
        chatMetrics.backBtnBox.width >= 32; // Accessible back button

      console.log('Kiểm tra Mobile Chat không bị đè bởi thanh menu dưới:', !chatMetrics.swBottomVisible ? 'PASS ✅' : 'FAIL ❌');
      console.log('Kiểm tra Ô soạn tin nhắn ở đáy màn hình & không bị kẹt:', mobileChatSafe ? 'PASS ✅' : 'FAIL ❌');

      await mobilePage.screenshot({ path: '_screenshots/audit_inbox_mobile_chat.png' });

      // Test Back button `<`
      console.log('Bấm nút quay lại `<` (ib-back)...');
      await mobilePage.click('.ib-back');
      await wait(500);

      const afterBackMetrics = await mobilePage.evaluate(() => {
        const swBottom = document.getElementById('swBottom');
        const ibItems = document.querySelector('.ib-items');
        const styleBottom = swBottom ? window.getComputedStyle(swBottom) : null;
        return {
          hasChatOpen: document.body.classList.contains('chat-open'),
          swBottomVisible: styleBottom && styleBottom.display !== 'none',
          ibItemsVisible: ibItems ? ibItems.getBoundingClientRect().height > 0 : false
        };
      });

      console.log('Sau khi bấm quay lại:', afterBackMetrics);
      const isBackSuccess =
        afterBackMetrics.hasChatOpen === false &&
        afterBackMetrics.swBottomVisible === true &&
        afterBackMetrics.ibItemsVisible === true;

      console.log('Kết quả kiểm tra nút quay lại `<`:', isBackSuccess ? 'PASS ✅' : 'FAIL ❌');

      REPORT.sections.inbox.mobile = {
        mobileChatSafe,
        chatMetrics,
        isBackSuccess,
        afterBackMetrics
      };

      await mobilePage.close();
    }

    // =========================================================================
    // PHẦN 2: THẺ ĐƠN HÀNG TRONG CHAT (.chat-order-card)
    // =========================================================================
    logHeader('PHẦN 2: KIỂM TOÁN THẺ ĐƠN HÀNG TRONG CHAT (.chat-order-card)');
    REPORT.sections.orderCard = {};

    // [2.1] Visual Overlap & Bounding Box Check on Desktop (1440px) and Mobile (390px)
    for (const vp of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
      console.log(`\n[2.1] Kiểm tra Bounding Box & Overlap trên ${vp.name.toUpperCase()} (${vp.width}x${vp.height})...`);
      const cardPage = await browser.newPage();
      await cardPage.setViewport({ width: vp.width, height: vp.height, isMobile: vp.name === 'mobile' });

      await cardPage.evaluateOnNewDocument(() => {
        localStorage.setItem(
          'aloha_auth',
          JSON.stringify({
            role: 'sale',
            name: 'Ngọc Anh',
            phone: '0900000002',
            token: 'fixture-audit-sale'
          })
        );
      });

      await cardPage.goto(ROOT_URL + 'crm/sale.html#hop-thu', { waitUntil: 'domcontentloaded' });
      await cardPage.waitForFunction(() => typeof window.AlohaOrderQRModal !== 'undefined');

      const cardMetrics = await cardPage.evaluate((isMobile) => {
        const orderData = {
          code: 'DP2026',
          customerName: 'Nguyễn Thị Thu Hằng',
          phone: '0987654321',
          babyName: 'Bé Sóc',
          babyAge: '6 tháng',
          service: 'Bé lớn & Gia đình',
          pkg: 'Gói Tiêu chuẩn Cao cấp (2.500.000đ)',
          concept: 'Mùa thu ấm áp và Tết sum vầy',
          date: '2026-11-20',
          time: '14:30',
          room: 'Studio ALOHA (Phòng 1)',
          shooterName: 'Tuấn (Thợ chính)',
          depositAmount: 1250000,
          price: 2500000,
          memo: 'ALOHA DP2026'
        };

        const html = AlohaOrderQRModal.renderOrderCardHtml(orderData, { isSale: true });

        // Tạo container giả lập tin nhắn chat
        let msgs = document.getElementById('ibMsgs');
        if (!msgs) {
          msgs = document.createElement('div');
          msgs.className = 'ib-msgs';
          document.body.appendChild(msgs);
        }
        const msgWrap = document.createElement('div');
        msgWrap.className = 'ib-msg out';
        msgWrap.style.margin = '20px auto';
        msgWrap.style.maxWidth = isMobile ? '350px' : '460px';
        msgWrap.innerHTML = html + '<small>15:00 · Ngọc Anh</small>';
        msgs.appendChild(msgWrap);

        const card = msgWrap.querySelector('.chat-order-card');
        const badge = card.querySelector('.coc-badge');
        const details = card.querySelector('.coc-details');
        const qrSection = card.querySelector('.coc-qr-section');
        const qrImgWrap = card.querySelector('.coc-qr-img-wrap');
        const qrImg = card.querySelector('.coc-qr-img');
        const bankInfo = card.querySelector('.coc-bank-info');
        const simBtn = card.querySelector('.btn-sim-deposit');

        // Check rows inside details
        const rows = Array.from(details.querySelectorAll('.coc-row')).map((r) => {
          const lbl = r.querySelector('.coc-label');
          const val = r.querySelector('.coc-val');
          const rBox = r.getBoundingClientRect();
          const lBox = lbl ? lbl.getBoundingClientRect() : null;
          const vBox = val ? val.getBoundingClientRect() : null;
          return {
            text: r.textContent.trim(),
            top: Math.round(rBox.top),
            bottom: Math.round(rBox.bottom),
            labelRight: lBox ? Math.round(lBox.right) : 0,
            valLeft: vBox ? Math.round(vBox.left) : 0,
            hasOverlap: lBox && vBox ? lBox.right > vBox.left + 2 : false
          };
        });

        const getBox = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return {
            top: Math.round(r.top),
            bottom: Math.round(r.bottom),
            left: Math.round(r.left),
            right: Math.round(r.right),
            width: Math.round(r.width),
            height: Math.round(r.height)
          };
        };

        const bBox = getBox(badge);
        const dBox = getBox(details);
        const qBox = getBox(qrSection);
        const qiBox = getBox(qrImg);
        const bkBox = getBox(bankInfo);
        const sBox = getBox(simBtn);

        // Check vertical overlap:
        // 1. Details vs QR section
        const isDetailsOverlapsQR = dBox.bottom > qBox.top + 1;
        // 2. Badge vs Details
        const isBadgeOverlapsDetails = bBox.bottom > dBox.top + 1;
        // 3. QR section vs Sim button
        const isQROverlapsSim = sBox ? qBox.bottom > sBox.top + 1 : false;

        // Inside QR Section: QR img vs Bank Info
        // Horizontal layout: qrImg on left, bankInfo on right
        const isQrOverlapsBank = qiBox.right > bkBox.left + 1;

        return {
          badge: bBox,
          details: dBox,
          qrSection: qBox,
          qrImg: qiBox,
          bankInfo: bkBox,
          simBtn: sBox,
          rows,
          isBadgeOverlapsDetails,
          isDetailsOverlapsQR,
          isQROverlapsSim,
          isQrOverlapsBank
        };
      }, vp.name === 'mobile');

      console.log(`Kết quả ${vp.name.toUpperCase()}:`);
      console.log('  Details Bottom:', cardMetrics.details.bottom, 'vs QR Section Top:', cardMetrics.qrSection.top);
      console.log('  QR Image Right:', cardMetrics.qrImg.right, 'vs Bank Info Left:', cardMetrics.bankInfo.left);
      console.log('  Overlap Details/QR:', cardMetrics.isDetailsOverlapsQR ? 'CÓ LỖI OVERLAP ❌' : 'KHÔNG (HOÀN TOÀN TÁCH BẠCH) ✅');
      console.log('  Overlap QR/BankInfo:', cardMetrics.isQrOverlapsBank ? 'CÓ LỖI OVERLAP ❌' : 'KHÔNG (HOÀN TOÀN TÁCH BẠCH) ✅');

      const rowOverlaps = cardMetrics.rows.filter((r) => r.hasOverlap);
      console.log('  Số hàng bị đè chữ trong chi tiết đơn:', rowOverlaps.length);

      const isCardLayoutClean =
        !cardMetrics.isDetailsOverlapsQR &&
        !cardMetrics.isBadgeOverlapsDetails &&
        !cardMetrics.isQROverlapsSim &&
        !cardMetrics.isQrOverlapsBank &&
        rowOverlaps.length === 0;

      console.log(`Kết luận Layout ${vp.name.toUpperCase()}:`, isCardLayoutClean ? 'PASS ✅' : 'FAIL ❌');

      await cardPage.screenshot({ path: `_screenshots/audit_order_card_${vp.name}.png` });

      REPORT.sections.orderCard[vp.name] = {
        isCardLayoutClean,
        cardMetrics
      };

      await cardPage.close();
    }

    // [2.2] Phía Khách hàng (index.html khung chat)
    {
      console.log('\n[2.2] Kiểm tra Phía Khách hàng (index.html): Ẩn hoàn toàn nút mô phỏng & thông tin nội bộ...');
      const custPage = await browser.newPage();
      await custPage.setViewport({ width: 390, height: 844, isMobile: true });

      await custPage.goto(ROOT_URL + 'index.html', { waitUntil: 'domcontentloaded' });
      await custPage.waitForFunction(() => typeof window.AlohaOrderQRModal !== 'undefined');

      const custCheck = await custPage.evaluate(() => {
        const orderData = {
          code: 'DP9999',
          customerName: 'Chị Hạnh (Phụ huynh)',
          phone: '0912345678',
          babyName: 'Bé Miu',
          babyAge: '1 tuổi',
          service: 'Sinh nhật',
          pkg: 'Tiêu chuẩn',
          concept: 'Hàn Quốc',
          date: '2026-11-25',
          time: '10:00',
          room: 'Phòng 2',
          shooterName: 'Hùng (Thợ chụp)',
          depositAmount: 1250000,
          price: 2500000
        };

        // Render với quyền Khách hàng: isSale: false
        const html = AlohaOrderQRModal.renderOrderCardHtml(orderData, { isSale: false });

        const div = document.createElement('div');
        div.innerHTML = html;
        document.body.appendChild(div);

        const card = div.querySelector('.chat-order-card');
        const text = card.innerText;

        return {
          hasSimBtn: !!card.querySelector('.btn-sim-deposit'),
          hasShooterInfo: text.includes('Thợ phụ trách') || text.includes('Hùng (Thợ chụp)'),
          hasParentPhone: text.includes('Phụ huynh') || text.includes('0912345678'),
          hasWaitNote: !!card.querySelector('.coc-wait-note') || text.includes('tự động kích hoạt'),
          hasQR: !!card.querySelector('.coc-qr-img')
        };
      });

      console.log('Kết quả kiểm tra phía khách hàng:');
      console.log('  Nút "Xác nhận đã nhận cọc (Mô phỏng tiền về)":', custCheck.hasSimBtn ? 'XUẤT HIỆN (LỖI) ❌' : 'ĐÃ ẨN HOÀN TOÀN ✅');
      console.log('  Thông tin thợ phụ trách:', custCheck.hasShooterInfo ? 'XUẤT HIỆN (LỖI LỘ NỘI BỘ) ❌' : 'ĐÃ ẨN HOÀN TOÀN ✅');
      console.log('  Thông tin SĐT phụ huynh:', custCheck.hasParentPhone ? 'XUẤT HIỆN (LỖI LỘ NỘI BỘ) ❌' : 'ĐÃ ẨN HOÀN TOÀN ✅');
      console.log('  Lưu ý chờ kích hoạt tự động:', custCheck.hasWaitNote ? 'HIỂN THỊ ĐÚNG CHUẨN ✅' : 'THIẾU ❌');

      const isCustomerViewClean =
        !custCheck.hasSimBtn &&
        !custCheck.hasShooterInfo &&
        !custCheck.hasParentPhone &&
        custCheck.hasWaitNote &&
        custCheck.hasQR;

      console.log('Kết luận Phía Khách hàng:', isCustomerViewClean ? 'PASS ✅' : 'FAIL ❌');
      await custPage.screenshot({ path: '_screenshots/audit_customer_order_card.png' });

      REPORT.sections.orderCard.customerView = {
        isCustomerViewClean,
        custCheck
      };

      await custPage.close();
    }

    // [2.3] Phía Sale (crm/sale.html): Thẻ đầy đủ & Nút mô phỏng nhận cọc hoạt động
    {
      console.log('\n[2.3] Kiểm tra Phía Sale (crm/sale.html): Thẻ đầy đủ thông tin nội bộ & Nút nhận cọc...');
      const salePage = await browser.newPage();
      await salePage.setViewport({ width: 1440, height: 900 });

      await salePage.evaluateOnNewDocument(() => {
        localStorage.setItem(
          'aloha_auth',
          JSON.stringify({
            role: 'sale',
            name: 'Ngọc Anh',
            phone: '0900000002',
            token: 'fixture-audit-sale'
          })
        );
      });

      await salePage.goto(ROOT_URL + 'crm/sale.html#hop-thu', { waitUntil: 'domcontentloaded' });
      await salePage.waitForFunction(() => typeof window.AlohaOrderQRModal !== 'undefined');

      const saleCardResult = await salePage.evaluate(async () => {
        const orderData = {
          code: 'DP7788',
          customerName: 'Chị Hoàng Yến',
          phone: '0933221100',
          babyName: 'Bé Bơ',
          babyAge: '2 tuổi',
          service: 'Bé lớn',
          pkg: 'Tiêu chuẩn',
          concept: 'Vintage',
          date: '2026-11-28',
          time: '15:00',
          room: 'P1',
          shooterName: 'Minh',
          depositAmount: 1250000,
          price: 2500000
        };

        const html = AlohaOrderQRModal.renderOrderCardHtml(orderData, { isSale: true });
        const container = document.createElement('div');
        container.className = 'ib-msgs';
        container.innerHTML = `<div class="ib-msg out">${html}</div>`;
        document.body.appendChild(container);

        const card = container.querySelector('.chat-order-card');
        const textBefore = card.innerText;

        const hasShooter = textBefore.includes('Thợ phụ trách') && textBefore.includes('Minh');
        const hasParent = textBefore.includes('Phụ huynh') && textBefore.includes('0933221100');
        const simBtn = card.querySelector('.btn-sim-deposit');

        // SePay tự động 100%: không được có nút bấm thủ công
        const hasSimBtn = !!simBtn;

        // Mô phỏng SePay ghi nhận tiền về tự động
        window.AlohaOrderQRModal.confirmDeposit(orderData.code, orderData.depositAmount);
        await new Promise((r) => setTimeout(r, 600));

        const isConfirmedNow = card.classList.contains('is-confirmed');
        const statusPill = card.querySelector('.coc-status-pill')?.innerText;
        const bannerText = card.querySelector('.coc-confirmed-banner')?.innerText;

        return {
          hasShooter,
          hasParent,
          hasSimBtn,
          isConfirmedNow,
          statusPill,
          bannerText
        };
      });

      console.log('Kết quả kiểm tra phía Sale:');
      console.log('  Hiển thị Thợ phụ trách:', saleCardResult.hasShooter ? 'CÓ ✅' : 'KHÔNG ❌');
      console.log('  Hiển thị Phụ huynh & SĐT:', saleCardResult.hasParent ? 'CÓ ✅' : 'KHÔNG ❌');
      console.log('  Nút bấm xác nhận thủ công (phải ẩn hoàn toàn vì SePay tự động):', !saleCardResult.hasSimBtn ? 'ĐÃ ẨN HOÀN TOÀN ✅' : 'VẪN CÒN (LỖI) ❌');
      console.log('  SePay tự động kích hoạt Đã cọc khi có tiền về:', saleCardResult.isConfirmedNow ? 'CÓ ✅' : 'KHÔNG ❌');
      console.log('  Banner xác nhận thành công:', saleCardResult.bannerText);

      const isSaleCardFunctioning =
        saleCardResult.hasShooter &&
        saleCardResult.hasParent &&
        !saleCardResult.hasSimBtn &&
        saleCardResult.isConfirmedNow;

      console.log('Kết luận Phía Sale:', isSaleCardFunctioning ? 'PASS ✅' : 'FAIL ❌');
      await salePage.screenshot({ path: '_screenshots/audit_sale_order_card_confirmed.png' });

      REPORT.sections.orderCard.saleView = {
        isSaleCardFunctioning,
        saleCardResult
      };

      await salePage.close();
    }

    // =========================================================================
    // PHẦN 3: MODAL TẠO ĐƠN & GỬI CỌC VIETQR
    // =========================================================================
    logHeader('PHẦN 3: KIỂM TOÁN MODAL TẠO ĐƠN & GỬI CỌC VIETQR');
    REPORT.sections.modal = {};

    {
      const modalPage = await browser.newPage();
      await modalPage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

      await modalPage.evaluateOnNewDocument(() => {
        localStorage.setItem(
          'aloha_auth',
          JSON.stringify({
            role: 'sale',
            name: 'Ngọc Anh',
            phone: '0900000002',
            token: 'fixture-audit-sale'
          })
        );
      });

      await modalPage.goto(ROOT_URL + 'crm/sale.html#hop-thu', { waitUntil: 'domcontentloaded' });
      await modalPage.waitForFunction(() => typeof window.AlohaOrderQRModal !== 'undefined');

      console.log('\n[3.1] Kiểm tra mở Modal trên Mobile (390x844): Vị trí cuộn ban đầu & Nút bấm...');

      const openState = await modalPage.evaluate(() => {
        AlohaOrderQRModal.open({
          customerId: 'KH-AUDIT',
          customerName: 'Chị Mai',
          phone: '0988776655',
          service: 'Newborn',
          pkg: 'Tiêu chuẩn',
          concept: 'Giấc mơ thiên thần'
        });

        const modal = document.getElementById('alohaOrderQRModal');
        const card = modal.querySelector('.aloha-order-modal-card');
        const formGrid = modal.querySelector('.aloha-form-grid');
        const submitBtn = document.getElementById('aofBtnSubmit');
        const btnShort = submitBtn.querySelector('.btn-text-short');
        const btnFull = submitBtn.querySelector('.btn-text-full');

        const styleShort = btnShort ? window.getComputedStyle(btnShort).display : 'none';
        const styleFull = btnFull ? window.getComputedStyle(btnFull).display : 'none';
        const submitBtnBox = submitBtn.getBoundingClientRect();

        return {
          modalHidden: modal.hidden,
          gridScrollTop: formGrid ? formGrid.scrollTop : -1,
          cardScrollTop: card ? card.scrollTop : -1,
          styleShort,
          styleFull,
          submitBtnText: submitBtn.innerText.replace(/\s+/g, ' ').trim(),
          submitBtnWidth: submitBtnBox.width,
          submitBtnHeight: submitBtnBox.height
        };
      });

      console.log('Trạng thái mở modal:', openState);
      const isTopScrolled = openState.gridScrollTop === 0 && openState.cardScrollTop === 0;
      const isButtonTextOptimized = openState.styleShort !== 'none' && openState.styleFull === 'none';

      console.log('  Vị trí cuộn bắt đầu từ đỉnh (scrollTop === 0):', isTopScrolled ? 'PASS ✅' : 'FAIL ❌');
      console.log('  Nút bấm tự co ngắn văn bản thành "Tạo đơn & Gửi cọc QR" trên mobile (không mất chữ):', isButtonTextOptimized ? 'PASS ✅' : 'FAIL ❌');

      await modalPage.screenshot({ path: '_screenshots/audit_modal_mobile_top.png' });

      // Scroll smoothly down to QR preview
      console.log('Cuộn mượt xuống phần QR Preview...');
      await modalPage.evaluate(() => {
        const formGrid = document.querySelector('.aloha-form-grid');
        if (formGrid) formGrid.scrollTop = formGrid.scrollHeight;
      });
      await wait(300);
      await modalPage.screenshot({ path: '_screenshots/audit_modal_mobile_scrolled.png' });

      // [3.2] Kiểm tra 4 cơ chế đóng modal
      console.log('\n[3.2] Kiểm tra 4 cơ chế đóng modal (X, Hủy bỏ, Esc, Click backdrop)...');

      // Helper check modal closed
      const isModalClosed = async () => {
        return await modalPage.evaluate(() => {
          const m = document.getElementById('alohaOrderQRModal');
          if (!m) return true;
          const style = window.getComputedStyle(m);
          const hasOpenClass = document.body.classList.contains('aloha-modal-open');
          return (m.hidden || style.display === 'none') && !hasOpenClass;
        });
      };

      const reopenModal = async () => {
        await modalPage.evaluate(() => {
          AlohaOrderQRModal.open({ customerName: 'Test Reopen' });
        });
        await wait(200);
      };

      // 1. Nút "X"
      console.log('  Test 1: Bấm nút "X" (#alohaOrderModalClose)...');
      await modalPage.click('#alohaOrderModalClose');
      await wait(200);
      const closeXSuccess = await isModalClosed();
      console.log('  Đóng bằng nút "X":', closeXSuccess ? 'PASS ✅' : 'FAIL ❌');

      // 2. Nút "Hủy bỏ"
      await reopenModal();
      console.log('  Test 2: Bấm nút "Hủy bỏ" (#aofBtnCancel)...');
      await modalPage.click('#aofBtnCancel');
      await wait(200);
      const closeCancelSuccess = await isModalClosed();
      console.log('  Đóng bằng nút "Hủy bỏ":', closeCancelSuccess ? 'PASS ✅' : 'FAIL ❌');

      // 3. Phím Escape
      await reopenModal();
      console.log('  Test 3: Nhấn phím Escape...');
      await modalPage.keyboard.press('Escape');
      await wait(200);
      const closeEscSuccess = await isModalClosed();
      console.log('  Đóng bằng phím Escape:', closeEscSuccess ? 'PASS ✅' : 'FAIL ❌');

      // 4. Click Backdrop ngoài card
      await reopenModal();
      console.log('  Test 4: Click backdrop ngoài card...');
      await modalPage.evaluate(() => {
        const m = document.getElementById('alohaOrderQRModal');
        // Dispatch click directly on backdrop element
        m.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });
      await wait(200);
      const closeBackdropSuccess = await isModalClosed();
      console.log('  Đóng bằng Click backdrop:', closeBackdropSuccess ? 'PASS ✅' : 'FAIL ❌');

      const allDismissMethodsPass =
        closeXSuccess && closeCancelSuccess && closeEscSuccess && closeBackdropSuccess;

      console.log('Kết luận 4 cơ chế đóng modal:', allDismissMethodsPass ? 'PASS ✅' : 'FAIL ❌');

      REPORT.sections.modal = {
        isTopScrolled,
        isButtonTextOptimized,
        closeXSuccess,
        closeCancelSuccess,
        closeEscSuccess,
        closeBackdropSuccess,
        allDismissMethodsPass
      };

      await modalPage.close();
    }

    // =========================================================================
    // PHẦN 4: MÀN HÌNH ĐĂNG NHẬP (login.html)
    // =========================================================================
    logHeader('PHẦN 4: KIỂM TOÁN MÀN HÌNH ĐĂNG NHẬP (login.html)');
    REPORT.sections.login = {};

    {
      const loginPage = await browser.newPage();
      await loginPage.setViewport({ width: 1440, height: 900 });

      await loginPage.goto(ROOT_URL + 'login.html', { waitUntil: 'domcontentloaded' });

      console.log('\n[4.1] Kiểm tra chữ "Tài khoản demo để xem thử:" đã ẩn hoàn toàn chưa...');
      const demoBoxVisibility = await loginPage.evaluate(() => {
        const demoBox = document.getElementById('loginDemoBox');
        const style = demoBox ? window.getComputedStyle(demoBox) : null;
        const rect = demoBox ? demoBox.getBoundingClientRect() : null;
        const pageText = document.body.innerText;

        return {
          exists: !!demoBox,
          display: style ? style.display : null,
          height: rect ? rect.height : 0,
          width: rect ? rect.width : 0,
          textVisibleOnPage: pageText.includes('Tài khoản demo để xem thử:')
        };
      });

      console.log('Trạng thái khối Demo Box:', demoBoxVisibility);
      const isDemoTextHidden =
        demoBoxVisibility.display === 'none' &&
        demoBoxVisibility.height === 0 &&
        !demoBoxVisibility.textVisibleOnPage;

      console.log('Kết quả chữ Demo đã ẩn hoàn toàn:', isDemoTextHidden ? 'PASS ✅' : 'FAIL ❌');
      await loginPage.screenshot({ path: '_screenshots/audit_login_page.png' });

      // [4.2] Kiểm tra đăng nhập với 6 tài khoản demo
      console.log('\n[4.2] Kiểm tra tính năng đăng nhập của 6 tài khoản demo (0900000001 - 0900000006)...');

      const DEMO_TEST_SUITE = [
        { phone: '0900000001', pass: 'khach123', role: 'khach-hang', expectedUrlPart: 'index.html', desc: 'Khách hàng' },
        { phone: '0900000002', pass: 'sale123', role: 'sale', expectedUrlPart: 'crm/sale.html', desc: 'Sale · Ngọc Anh' },
        { phone: '0900000005', pass: 'sale123', role: 'sale', expectedUrlPart: 'crm/sale.html', desc: 'Sale · Minh Thư' },
        { phone: '0900000006', pass: 'sale123', role: 'sale', expectedUrlPart: 'crm/sale.html', desc: 'Sale · Thu Hà' },
        { phone: '0900000003', pass: 'anh123', role: 'tho-anh', expectedUrlPart: 'crm/admin.html', desc: 'Thợ ảnh' },
        { phone: '0900000004', pass: 'sep123', role: 'sep', expectedUrlPart: 'crm/admin.html', desc: 'Sếp' }
      ];

      const loginResults = [];

      for (const account of DEMO_TEST_SUITE) {
        process.stdout.write(`  Đăng nhập ${account.desc} (${account.phone} / ${account.pass})... `);

        // Mở lại trang login mới cho mỗi account để sạch session
        await loginPage.goto(ROOT_URL + 'login.html', { waitUntil: 'domcontentloaded' });
        await loginPage.evaluate(() => localStorage.clear());

        // Điền form
        await loginPage.type('#loginPhone', account.phone);
        await loginPage.type('#loginPassword', account.pass);

        // Submit form và chờ chuyển trang
        await Promise.all([
          loginPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => null),
          loginPage.click('#loginSubmitBtn')
        ]);

        await wait(500);

        const currentUrl = loginPage.url();
        const authData = await loginPage.evaluate(() => {
          try {
            return JSON.parse(localStorage.getItem('aloha_auth') || '{}');
          } catch (e) {
            return null;
          }
        });

        const urlMatches = currentUrl.includes(account.expectedUrlPart);
        const roleMatches = authData && authData.role === account.role;
        const pass = urlMatches && roleMatches;

        console.log(pass ? `PASS ✅ (${currentUrl.split('/').pop()})` : `FAIL ❌ (Url: ${currentUrl}, Auth: ${JSON.stringify(authData)})`);

        loginResults.push({
          account: account.desc,
          phone: account.phone,
          expectedRole: account.role,
          actualRole: authData?.role,
          targetUrl: currentUrl,
          pass
        });
      }

      const allLoginsPass = loginResults.every((r) => r.pass);
      console.log('\nKết luận Kiểm tra Đăng nhập 6 tài khoản demo:', allLoginsPass ? 'PASS (100% HOẠT ĐỘNG HOÀN HẢO) ✅' : 'FAIL ❌');

      REPORT.sections.login = {
        isDemoTextHidden,
        demoBoxVisibility,
        allLoginsPass,
        loginResults
      };

      await loginPage.close();
    }

    // =========================================================================
    // TỔNG HỢP BÁO CÁO TOÀN DIỆN
    // =========================================================================
    logHeader('TỔNG HỢP KẾT QUẢ AUDIT ĐỘC LẬP');
    console.log(JSON.stringify(REPORT, null, 2));

  } catch (err) {
    console.error('\n❌ LỖI TRONG QUÁ TRÌNH THỰC THI AUDIT:', err);
  } finally {
    await browser.close();
    console.log('\n--- HOÀN TẤT PHIÊN KIỂM TOÁN ĐỘC LẬP ---');
  }
})();
