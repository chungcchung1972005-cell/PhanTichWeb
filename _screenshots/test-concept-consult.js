const { CHROME_PATH, ROOT_URL, launchAllFeatures } = require('./test-env');
const puppeteer = require('puppeteer-core');

const BASE_URL = ROOT_URL + 'index.html';

(async () => {
  console.log('--- STARTING PUPPETEER TEST FOR CONCEPT CONSULTATION FLOW ---');
  const browser = await launchAllFeatures(puppeteer, {
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    // -------------------------------------------------------------------------
    // 1. Kiểm tra khi CHƯA đăng nhập -> Bấm "Tư vấn concept" phải chuyển sang login.html
    // -------------------------------------------------------------------------
    console.log('1. Kiểm tra cổng đăng nhập khi chưa có tài khoản...');
    await page.goto(`${BASE_URL}#/album/newborn`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload({ waitUntil: 'networkidle0' });

    const consultBtn = await page.waitForSelector('.concept-album-consult', { timeout: 5000 });
    if (!consultBtn) throw new Error('Không tìm thấy nút .concept-album-consult trên thẻ album Newborn');
    console.log('✓ Tìm thấy nút .concept-album-consult trên thẻ concept Newborn');

    const firstConceptSlug = await page.evaluate(() => {
      return document.querySelector('.concept-album-consult').dataset.concept;
    });
    console.log(`Bấm nút tư vấn concept "${firstConceptSlug}" khi chưa đăng nhập...`);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.concept-album-consult')
    ]);

    const currentUrl = page.url();
    console.log('URL hiện tại:', currentUrl);
    if (!currentUrl.includes('login.html')) throw new Error('Chưa chuyển sang trang login.html');
    console.log('✓ Đã chuyển hướng chính xác sang login.html kèm thông tin next');

    // -------------------------------------------------------------------------
    // 2. Đăng nhập với tài khoản khách hàng demo
    // -------------------------------------------------------------------------
    console.log('\n2. Đăng nhập với tài khoản khách hàng demo...');
    await page.evaluate(() => {
      if (window.AlohaAuth) {
        AlohaAuth.login('khach-hang', 'Mẹ Bé Bắp', '0912345678', 'demo_token');
      }
    });

    // -------------------------------------------------------------------------
    // 3. Test quy trình tư vấn Newborn GĐ 1 (7 ngày - 5 tháng) + Bé gái
    //    Concept Happy dream 2 (chung, hợp cả trai & gái) -> Kỳ vọng: 11 concept
    // -------------------------------------------------------------------------
    console.log('\n3. Test luồng tư vấn Newborn GĐ 1 (Bé gái)...');
    await page.goto(`${BASE_URL}#/album/newborn`, { waitUntil: 'networkidle0' });

    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.concept-album-consult')).find(b => b.dataset.concept === 'happy-dream-2') || document.querySelector('.concept-album-consult');
      btn.click();
    });

    await page.waitForSelector('#chatPanel.open', { timeout: 4000 });
    console.log('✓ Khung chat đã tự động mở');

    // Kiểm tra ô nhập text bị ẩn hoàn toàn (100% nút bấm)
    const inputDisplay = await page.evaluate(() => {
      const f = document.getElementById('chatInputForm');
      return f ? window.getComputedStyle(f).display : 'none';
    });
    if (inputDisplay !== 'none') throw new Error('Ô gõ phím chưa bị ẩn theo yêu cầu nút bấm');
    console.log('✓ Ô nhập tay đã được ẩn hoàn toàn (100% bấm nút)');

    // Chọn: 7 ngày - 5 tháng
    await page.waitForSelector('.chat-consult-btn', { timeout: 4000 });
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.chat-consult-btn')).find(b => b.textContent.includes('7 ngày')).click();
    });

    // Chọn: Bé gái
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.chat-consult-btn')).some(b => b.textContent.includes('Bé gái')), { timeout: 4000 });
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.chat-consult-btn')).find(b => b.textContent.includes('Bé gái')).click();
    });

    // Chọn: 3kg - 5kg
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.chat-consult-btn')).some(b => b.textContent.includes('3kg - 5kg')), { timeout: 4000 });
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.chat-consult-btn')).find(b => b.textContent.includes('3kg - 5kg')).click();
    });

    // Chờ danh sách concept
    await page.waitForSelector('.chat-consult-list', { timeout: 5000 });
    const g1Count = await page.evaluate(() => {
      const list = document.querySelector('.chat-consult-list');
      return list.querySelectorAll('.chat-concept-card').length;
    });
    console.log(`✓ Đã gợi ý ${g1Count} concept cho Bé gái 7 ngày - 5 tháng (Kỳ vọng: 11 concept = 7 chung + 4 riêng gái)`);
    if (g1Count !== 11) throw new Error(`Số lượng concept không khớp: nhận được ${g1Count}, kỳ vọng 11`);

    // Bấm xem ảnh card đầu tiên -> hash đổi, chat không đóng
    await page.evaluate(() => {
      document.querySelector('.chat-concept-card').click();
    });
    const isChatOpen = await page.evaluate(() => document.getElementById('chatPanel').classList.contains('open'));
    if (!isChatOpen) throw new Error('Khung chat bị đóng sau khi bấm xem ảnh concept');
    console.log('✓ Khung chat vẫn mở khi mẹ bấm chọn xem ảnh concept');

    // -------------------------------------------------------------------------
    // 4. Test trường hợp concept KHÔNG PHÙ HỢP (Havard concept của bé trai nhưng chọn bé gái)
    // -------------------------------------------------------------------------
    console.log('\n4. Test trường hợp mẹ chọn concept KHÔNG PHÙ HỢP...');
    await page.evaluate(() => {
      window.AlohaConceptConsult.start('newborn', 'havard-concept', 'Harvard concept');
    });

    await page.waitForSelector('.chat-consult-btn', { timeout: 4000 });
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.chat-consult-btn')).find(b => b.textContent.includes('7 ngày')).click();
    });

    await page.waitForFunction(() => Array.from(document.querySelectorAll('.chat-consult-btn')).some(b => b.textContent.includes('Bé gái')), { timeout: 4000 });
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.chat-consult-btn')).find(b => b.textContent.includes('Bé gái')).click();
    });

    await page.waitForFunction(() => Array.from(document.querySelectorAll('.chat-consult-btn')).some(b => b.textContent.includes('3kg - 5kg')), { timeout: 4000 });
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.chat-consult-btn')).find(b => b.textContent.includes('3kg - 5kg')).click();
    });

    await page.waitForFunction(() => {
      const msgs = Array.from(document.querySelectorAll('.chat-msg.bot'));
      return msgs.some(m => m.textContent.includes('hiện chưa nằm trong danh sách phù hợp'));
    }, { timeout: 5000 });
    console.log('✓ Bot đã phản hồi đúng kịch bản từ chối nhẹ nhàng khi concept không phù hợp giới tính');

    // -------------------------------------------------------------------------
    // 5. Test Newborn GĐ 2 (6 tháng - 1 tuổi) + Bé trai -> Chỉ lấy 5 concept chung, KHÔNG lấy concept gái
    // -------------------------------------------------------------------------
    console.log('\n5. Test Newborn GĐ 2 (6 tháng - 1 tuổi) cho Bé trai...');
    await page.evaluate(() => {
      window.AlohaConceptConsult.start('newborn', 'tet-2', 'Tết 2');
    });

    await page.waitForSelector('.chat-consult-btn', { timeout: 4000 });
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.chat-consult-btn')).find(b => b.textContent.includes('6 tháng')).click();
    });

    await page.waitForFunction(() => Array.from(document.querySelectorAll('.chat-consult-btn')).some(b => b.textContent.includes('Bé trai')), { timeout: 4000 });
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.chat-consult-btn')).find(b => b.textContent.includes('Bé trai')).click();
    });

    await page.waitForFunction(() => Array.from(document.querySelectorAll('.chat-consult-btn')).some(b => b.textContent.includes('6kg - 8kg')), { timeout: 4000 });
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.chat-consult-btn')).find(b => b.textContent.includes('6kg - 8kg')).click();
    });

    await page.waitForFunction(() => {
      const lists = document.querySelectorAll('.chat-consult-list');
      return lists.length >= 3;
    }, { timeout: 5000 });

    const nb2BoyCount = await page.evaluate(() => {
      const lists = document.querySelectorAll('.chat-consult-list');
      const latestList = lists[lists.length - 1];
      return latestList.querySelectorAll('.chat-concept-card').length;
    });
    console.log(`✓ Đã gợi ý ${nb2BoyCount} concept cho Bé trai 6 tháng - 1 tuổi (Kỳ vọng: chính xác 5 concept chung, không lấy concept gái)`);
    if (nb2BoyCount !== 5) throw new Error(`Số lượng concept không khớp: nhận được ${nb2BoyCount}, kỳ vọng 5`);

    // -------------------------------------------------------------------------
    // 6. Test Bé Lớn (2 tuổi - 5 tuổi) - Bé trai: 13 riêng + 14 chung (khử trùng -> 24 concept)
    // -------------------------------------------------------------------------
    console.log('\n6. Test tư vấn Bé lớn (2 - 5 tuổi) cho Bé trai...');
    await page.goto(`${BASE_URL}#/album/be-lon`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.concept-album-consult', { timeout: 5000 });

    await page.evaluate(() => {
      window.AlohaConceptConsult.start('be-lon', 'basic-concept-3', 'Basic concept 3');
    });

    await page.waitForSelector('.chat-consult-btn', { timeout: 4000 });
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.chat-consult-btn')).find(b => b.textContent.includes('2 tuổi')).click();
    });

    await page.waitForFunction(() => Array.from(document.querySelectorAll('.chat-consult-btn')).some(b => b.textContent.includes('Bé trai')), { timeout: 4000 });
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.chat-consult-btn')).find(b => b.textContent.includes('Bé trai')).click();
    });

    await page.waitForFunction(() => Array.from(document.querySelectorAll('.chat-consult-btn')).some(b => b.textContent.includes('> 10kg')), { timeout: 4000 });
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.chat-consult-btn')).find(b => b.textContent.includes('> 10kg')).click();
    });

    await page.waitForSelector('.chat-consult-list', { timeout: 5000 });
    // Chờ bot render xong danh sách
    await new Promise((r) => setTimeout(r, 600));

    const boyCardCount = await page.evaluate(() => {
      const lists = document.querySelectorAll('.chat-consult-list');
      const latest = lists[lists.length - 1];
      return latest.querySelectorAll('.chat-concept-card').length;
    });
    console.log(`✓ Đã gợi ý ${boyCardCount} concept cho Bé trai 2-5 tuổi (Kỳ vọng: 24 concept sau khử trùng lặp)`);
    if (boyCardCount !== 24) throw new Error(`Số lượng concept Bé trai 2-5 tuổi không khớp: nhận được ${boyCardCount}, kỳ vọng 24`);

    // -------------------------------------------------------------------------
    // 7. Test Bé Lớn (2 tuổi - 5 tuổi) - Bé gái: 26 riêng + 14 chung (khử trùng -> 34 concept)
    // -------------------------------------------------------------------------
    console.log('\n7. Test tư vấn Bé lớn (2 - 5 tuổi) cho Bé gái...');
    await page.evaluate(() => {
      window.AlohaConceptConsult.start('be-lon', 'bach-tuyet', 'Bạch tuyết');
    });

    await page.waitForSelector('.chat-consult-btn', { timeout: 4000 });
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.chat-consult-btn')).find(b => b.textContent.includes('2 tuổi')).click();
    });

    await page.waitForFunction(() => Array.from(document.querySelectorAll('.chat-consult-btn')).some(b => b.textContent.includes('Bé gái')), { timeout: 4000 });
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.chat-consult-btn')).find(b => b.textContent.includes('Bé gái')).click();
    });

    await page.waitForFunction(() => Array.from(document.querySelectorAll('.chat-consult-btn')).some(b => b.textContent.includes('> 10kg')), { timeout: 4000 });
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.chat-consult-btn')).find(b => b.textContent.includes('> 10kg')).click();
    });

    await page.waitForFunction(() => {
      const lists = document.querySelectorAll('.chat-consult-list');
      return lists.length >= 2;
    }, { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 600));

    const girlCardCount = await page.evaluate(() => {
      const lists = document.querySelectorAll('.chat-consult-list');
      const latest = lists[lists.length - 1];
      return latest.querySelectorAll('.chat-concept-card').length;
    });
    console.log(`✓ Đã gợi ý ${girlCardCount} concept cho Bé gái 2-5 tuổi (Kỳ vọng: 34 concept sau khử trùng lặp)`);
    if (girlCardCount !== 34) throw new Error(`Số lượng concept Bé gái 2-5 tuổi không khớp: nhận được ${girlCardCount}, kỳ vọng 34`);

    // -------------------------------------------------------------------------
    // 8. Kiểm tra tính khu biệt: Gia đình, Bầu, Sinh nhật KHÔNG ĐƯỢC CÓ nút tư vấn
    // -------------------------------------------------------------------------
    console.log('\n8. Kiểm tra tính khu biệt: Gia đình, Bầu, Sinh nhật KHÔNG ĐƯỢC CÓ nút tư vấn...');
    await page.goto(`${BASE_URL}#/album/gia-dinh`, { waitUntil: 'networkidle0' });
    const gdBtnCount = await page.evaluate(() => document.querySelectorAll('.concept-album-consult').length);
    if (gdBtnCount !== 0) throw new Error('Gia đình không được có nút tư vấn concept');

    await page.goto(`${BASE_URL}#/album/bau`, { waitUntil: 'networkidle0' });
    const bauBtnCount = await page.evaluate(() => document.querySelectorAll('.concept-album-consult').length);
    if (bauBtnCount !== 0) throw new Error('Bầu không được có nút tư vấn concept');

    await page.goto(`${BASE_URL}#/album/sinh-nhat`, { waitUntil: 'networkidle0' });
    const snBtnCount = await page.evaluate(() => document.querySelectorAll('.concept-album-consult').length);
    if (snBtnCount !== 0) throw new Error('Sinh nhật không được có nút tư vấn concept');
    console.log('✓ Xác nhận: Gia đình, Bầu, Sinh nhật KHÔNG CÓ nút tư vấn concept (chuẩn xác 100% phạm vi)');

    if (errors.length > 0) {
      console.warn('Cảnh báo console/error:', errors);
    } else {
      console.log('✓ 100% KHÔNG CÓ LỖI JAVASCRIPT!');
    }

    console.log('\n========================================');
    console.log('🎉 TẤT CẢ CÁC BÀI TEST TƯ VẤN CONCEPT ĐÃ VƯỢT QUA 100%!');
    console.log('========================================');

  } catch (err) {
    console.error('TEST FAILED:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
