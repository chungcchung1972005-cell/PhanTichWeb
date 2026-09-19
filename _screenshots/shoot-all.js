const puppeteer = require('puppeteer-core');

// Đặt lịch/Ảnh của tôi đã gộp vào index.html (route hash, xem js/router.js)
// và luôn yêu cầu đăng nhập -> không chụp trực tiếp ở đây (sẽ chỉ thấy màn
// đăng nhập); dùng test-auth.js/test-photos-chat.js để chụp các view đó sau
// khi đăng nhập đúng vai trò.
const pages = [
  { name: 'index', url: 'file:///D:/PhanTichWeb/index.html' },
];
const sizes = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox']
  });

  for (const p of pages) {
    for (const s of sizes) {
      const page = await browser.newPage();
      const consoleErrors = [];
      page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));
      await page.setViewport({ width: s.width, height: s.height });
      await page.goto(p.url, { waitUntil: 'networkidle0' });
      // behavior:'instant' bắt buộc — xem ghi chú trong shoot.js (scroll-behavior:
      // smooth trên trang + scrollTo lặp nhanh khiến scrollY thực tế không đuổi kịp).
      await page.evaluate(async () => {
        const step = 400;
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo({ top: y, left: 0, behavior: 'instant' });
          await new Promise((r) => setTimeout(r, 90));
        }
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        await new Promise((r) => setTimeout(r, 350));
      });
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      await page.screenshot({ path: `D:\\PhanTichWeb\\_screenshots\\${p.name}-${s.name}.png`, fullPage: true });
      const overflowFlag = overflow.scrollWidth > overflow.clientWidth ? '*** OVERFLOW ***' : 'OK';
      console.log(`${p.name} / ${s.name}: ${overflowFlag} (scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth})`);
      if (consoleErrors.length) {
        console.log(`  console errors on ${p.name}/${s.name}:`, consoleErrors);
      }
      await page.close();
    }
  }

  await browser.close();
})();
