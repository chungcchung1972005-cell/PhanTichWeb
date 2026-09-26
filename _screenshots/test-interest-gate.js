const { CHROME_PATH, ROOT_URL } = require('./test-env');
// Test: nút Đăng nhập/Đăng ký ở trang chủ, gate các thao tác thể hiện quan tâm
// (album, concept, chat) về login.html khi chưa đăng nhập, và luồng đăng ký demo.
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

  // 1) Trang chủ (chưa đăng nhập) hiện đúng nút Đăng nhập/Đăng ký
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + 'index.html', { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    const hasLogin = await page.$('#navAuthArea a[href="login.html"]') !== null;
    const hasRegister = await page.$('#navAuthArea a[href="login.html?mode=register"]') !== null;
    log('trang chủ hiện nút Đăng nhập/Đăng ký khi chưa đăng nhập', hasLogin && hasRegister);

    // 2) Click album-card -> mở album concept công khai, KHÔNG về login.html
    // (người dùng đổi yêu cầu 2026-09-25: Album/Concept xem công khai, chỉ Đặt lịch/Ảnh của tôi mới gate).
    await page.click('.album-card');
    await new Promise(r => setTimeout(r, 300));
    log('click album-card chưa đăng nhập -> mở album công khai, không về login', page.url().includes('#/album/') && !page.url().includes('login.html'), page.url());
    await page.close();
  }

  // 3) Click concept-tile -> mở trang concept chi tiết công khai (xem ghi chú ở case 2)
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + 'index.html', { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.click('.concept-tile');
    await new Promise(r => setTimeout(r, 300));
    log('click concept-tile chưa đăng nhập -> mở trang concept, không về login', page.url().includes('#/noi-dung/concept-') && !page.url().includes('login.html'), page.url());
    await page.close();
  }

  // 4) Click nút chat nổi -> về login.html (không mở panel chat)
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + 'index.html', { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.click('#chatToggle');
    await new Promise(r => setTimeout(r, 300));
    log('click chat nổi chưa đăng nhập -> về login.html', page.url().includes('login.html'), page.url());
    await page.close();
  }

  // 5) Click "Tư vấn concept ngay" -> về login.html
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + 'index.html', { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.click('#conceptChatBtn');
    await new Promise(r => setTimeout(r, 300));
    log('click "Tư vấn concept ngay" chưa đăng nhập -> về login.html', page.url().includes('login.html'), page.url());
    await page.close();
  }

  // 6) Đã đăng nhập khách hàng: chat mở bình thường, không bị đẩy đi
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + 'index.html', { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.setItem('aloha_auth', JSON.stringify({ role: 'khach-hang', name: 'Test KH', loginAt: Date.now() })));
    await page.reload({ waitUntil: 'networkidle0' });
    const navShowsBooking = await page.$('#navAuthArea a[href="#/dat-lich"]') !== null;
    log('đã đăng nhập KH -> nav hiện Đặt lịch/Ảnh của tôi', navShowsBooking);
    await page.click('#chatToggle');
    await new Promise(r => setTimeout(r, 300));
    const chatOpened = await page.$eval('#chatPanel', el => el.classList.contains('open'));
    log('đã đăng nhập KH -> click chat mở panel, không bị đẩy đi', chatOpened && page.url().includes('index.html'));
    await page.close();
  }

  // 7) Luồng đăng ký demo (nút Đăng ký trên trang chủ -> điền form -> vào #/dat-lich)
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + 'index.html', { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('#navAuthArea a[href="login.html?mode=register"]')
    ]);
    const isRegisterUI = await page.$eval('#loginTitle', el => el.textContent.includes('Đăng ký'));
    log('vào login.html?mode=register hiện đúng form đăng ký', isRegisterUI);

    await page.type('#loginName', 'Nguyễn Test');
    await page.type('#loginPhone', '0911222333');
    await page.type('#loginPassword', 'matkhau123');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('#loginSubmitBtn')
    ]);
    const session = await page.evaluate(() => JSON.parse(localStorage.getItem('aloha_auth') || '{}'));
    log('đăng ký demo (không qua next) tạo phiên khách hàng + vào #/dat-lich (chưa có ảnh nên không vào #/chon-anh)', session.role === 'khach-hang' && session.name === 'Nguyễn Test' && page.url().includes('#/dat-lich'), JSON.stringify(session) + ' ' + page.url());
    await page.close();
  }

  // 8) Đăng ký khi đến từ next=chon-anh (vd click album) -> vẫn tôn trọng next
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + 'index.html', { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    // Album giờ xem công khai -> lối vào "Ảnh của tôi" khi chưa đăng nhập là route #/chon-anh (router gate).
    await page.goto(BASE + 'index.html#/chon-anh', { waitUntil: 'networkidle0' });
    for (let i = 0; i < 25 && !page.url().includes('login.html'); i++) await new Promise(r => setTimeout(r, 200));
    log('mở #/chon-anh chưa đăng nhập -> login.html?next=chon-anh', page.url().includes('next=chon-anh'), page.url());
    await page.click('#switchToRegister');
    await page.type('#loginName', 'Trần Test 2');
    await page.type('#loginPhone', '0922333444');
    await page.type('#loginPassword', 'matkhau123');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('#loginSubmitBtn')
    ]);
    log('đăng ký từ next=chon-anh -> tôn trọng next, vào #/chon-anh', page.url().includes('#/chon-anh'), page.url());
    await page.close();
  }

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (failed.length === 0 ? 'TẤT CẢ TEST PASS' : failed.length + ' TEST FAIL'));
  process.exit(failed.length === 0 ? 0 : 1);
})();
