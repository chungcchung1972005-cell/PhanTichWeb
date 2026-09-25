// Test luồng đăng nhập tài khoản/mật khẩu + phân quyền 3 vai trò nội bộ dùng
// chung crm/admin.html, và gate 2 trang khách hàng hiện có.
const puppeteer = require('puppeteer-core');

const BASE = 'file:///D:/PhanTichWeb/';

const ACCOUNTS = {
  'khach-hang': { phone: '0900000001', password: 'khach123' },
  'sale': { phone: '0900000002', password: 'sale123' },
  'tho-anh': { phone: '0900000003', password: 'anh123' },
  'sep': { phone: '0900000004', password: 'sep123' }
};

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox']
  });

  const results = [];
  function log(name, ok, detail) {
    results.push({ name, ok, detail });
    console.log((ok ? 'OK  ' : 'FAIL') + ' - ' + name + (detail ? ' :: ' + detail : ''));
  }

  async function loginAs(page, role) {
    const acc = ACCOUNTS[role];
    await page.goto(BASE + 'login.html', { waitUntil: 'networkidle0' });
    await page.type('#loginPhone', acc.phone);
    await page.type('#loginPassword', acc.password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.login-submit')
    ]);
  }

  // 1) Redirect khi chưa login (crm/admin.html là file riêng; dat-lich/chon-anh
  // giờ là route hash trong index.html, xem js/router.js)
  const gatedPages = ['crm/admin.html', 'index.html#/dat-lich', 'index.html#/chon-anh'];
  for (const p of gatedPages) {
    const page = await browser.newPage();
    await page.goto(BASE + p, { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    const url = page.url();
    log('redirect chưa login: ' + p, url.includes('login.html'), url);
    await page.close();
  }

  // 2) Sai tài khoản/mật khẩu -> báo lỗi inline, không điều hướng
  {
    const page = await browser.newPage();
    await page.goto(BASE + 'login.html', { waitUntil: 'networkidle0' });
    await page.type('#loginPhone', '0900000001');
    await page.type('#loginPassword', 'sai-mat-khau');
    await page.click('.login-submit');
    await new Promise(r => setTimeout(r, 300));
    const errorShown = await page.$eval('#loginError', el => el.classList.contains('show'));
    log('sai mật khẩu hiện lỗi inline, không điều hướng', errorShown && page.url().includes('login.html'));
    await page.close();
  }

  // 3) Login từng vai trò -> đúng đích, đúng tab hiển thị
  const ROLE_EXPECT = {
    'khach-hang': { urlIncludes: '#/chon-anh' },
    'sale': { urlIncludes: 'crm/admin.html', visibleTabs: ['Khách hàng', 'Lịch hẹn'] },
    'tho-anh': { urlIncludes: 'crm/admin.html', visibleTabs: ['Ảnh & chỉnh sửa'] },
    'sep': { urlIncludes: 'crm/admin.html', visibleTabs: ['Dashboard', 'Khách hàng', 'Lịch hẹn', 'Ảnh & chỉnh sửa', 'Doanh thu', 'Cài đặt'] }
  };

  for (const role of Object.keys(ROLE_EXPECT)) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await loginAs(page, role);
    const url = page.url();
    const expect = ROLE_EXPECT[role];
    log('login ' + role + ' -> đích đúng', url.includes(expect.urlIncludes), url);

    if (expect.visibleTabs) {
      const tabTexts = await page.$$eval('#adminTabs a', els => els.map(e => e.textContent.trim()));
      const match = JSON.stringify(tabTexts) === JSON.stringify(expect.visibleTabs);
      log('login ' + role + ' -> đúng tab hiển thị', match, tabTexts.join(', '));
    }

    if (role === 'sep') {
      const scrollReveal = async () => {
        await page.evaluate(async () => {
          const step = 400;
          for (let y = 0; y < document.body.scrollHeight; y += step) {
            window.scrollTo({ top: y, left: 0, behavior: 'instant' });
            await new Promise(r => setTimeout(r, 90));
          }
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
          await new Promise(r => setTimeout(r, 300));
        });
      };
      await scrollReveal();
      await page.screenshot({ path: 'D:\\PhanTichWeb\\_screenshots\\admin-sep-desktop.png', fullPage: true });
      await page.setViewport({ width: 390, height: 844 });
      await page.reload({ waitUntil: 'networkidle0' });
      await scrollReveal();
      await page.screenshot({ path: 'D:\\PhanTichWeb\\_screenshots\\admin-sep-mobile.png', fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      log('admin sếp mobile không tràn ngang', !overflow);
    }
    if (role === 'sale') {
      await page.screenshot({ path: 'D:\\PhanTichWeb\\_screenshots\\admin-sale-desktop.png', fullPage: true });
      // Sale không được thấy cột doanh thu/thanh toán trong bảng khách hàng
      const headText = await page.$eval('#custTableHead', el => el.textContent);
      const noRevenueLeak = !/doanh thu|thanh toán/i.test(headText);
      log('sale không thấy cột doanh thu/thanh toán', noRevenueLeak, headText.trim());
    }
    if (role === 'tho-anh') {
      await page.screenshot({ path: 'D:\\PhanTichWeb\\_screenshots\\admin-thoanh-desktop.png', fullPage: true });
      const hasKanban = await page.$('.kanban') !== null;
      const hasCustomerTable = await page.$('#khach-hang') !== null;
      log('thợ ảnh chỉ thấy kanban ảnh, không thấy CRM khách hàng', hasKanban && !hasCustomerTable);
    }
    await page.close();
  }

  // 4) Sai vai trò: khách hàng vào thẳng crm/admin.html -> bị đẩy về #/chon-anh
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await loginAs(page, 'khach-hang');
    await page.goto(BASE + 'crm/admin.html', { waitUntil: 'networkidle0' });
    log('khách hàng vào admin.html bị chặn', page.url().includes('#/chon-anh'), page.url());
    await page.close();
  }

  // 5) Luồng đặt lịch cũ vẫn hoạt động sau khi gate
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await loginAs(page, 'khach-hang');
    await page.goto(BASE + 'index.html#/dat-lich', { waitUntil: 'networkidle0' });
    await page.click('.bk-service[data-service="Newborn"]');
    await page.click('#bkNextBtn');
    await page.waitForSelector('#bkSlotGrid .bk-slot.free', { timeout: 5000 });
    await page.click('#bkSlotGrid .bk-slot.free');
    const nextEnabled = await page.$eval('#bkNextBtn', el => !el.disabled);
    log('luồng đặt lịch vẫn hoạt động sau khi gate', nextEnabled);
    await page.close();
  }

  // 6) Đăng xuất
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await loginAs(page, 'sep');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.admin-logout')
    ]);
    const authCleared = await page.evaluate(() => localStorage.getItem('aloha_auth') === null);
    log('đăng xuất về login.html + xoá localStorage', page.url().includes('login.html') && authCleared);
    await page.close();
  }

  await browser.close();

  const failed = results.filter(r => !r.ok);
  console.log('\n' + (failed.length === 0 ? 'TẤT CẢ TEST PASS' : failed.length + ' TEST FAIL'));
  process.exit(failed.length === 0 ? 0 : 1);
})();
