// Chụp screenshot đáng tin cậy bằng Puppeteer (thay cho `chrome --headless --screenshot`
// CLI, vốn cho kết quả sai lệch trên máy này khi kết hợp --window-size nhỏ).
const puppeteer = require('puppeteer-core');

const targets = [
  { name: 'desktop', width: 1440, height: 900, fullPage: true },
  { name: 'tablet', width: 834, height: 900, fullPage: true },
  { name: 'mobile', width: 390, height: 844, fullPage: true },
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox']
  });

  for (const t of targets) {
    const page = await browser.newPage();
    await page.setViewport({ width: t.width, height: t.height });
    await page.goto('file:///D:/PhanTichWeb/index.html', { waitUntil: 'networkidle0' });
    // Cuộn chậm qua toàn trang để kích hoạt & chờ animation scroll-reveal hoàn tất.
    // QUAN TRỌNG: dùng behavior:'instant' — trang có CSS `scroll-behavior:smooth`
    // (đúng cho UX thật), nhưng gọi scrollTo(x,y) mặc định lặp lại nhanh trong 1
    // script sẽ bị animation mượt của lần gọi trước "nuốt" mất phần lớn quãng
    // đường, khiến scrollY thực tế không bao giờ đuổi kịp — đã xác nhận bằng debug
    // (actualScrollY chỉ đạt ~25% giá trị yêu cầu). Không phải lỗi trang.
    await page.evaluate(async () => {
      const step = 400;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo({ top: y, left: 0, behavior: 'instant' });
        await new Promise(r => setTimeout(r, 90));
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      await new Promise(r => setTimeout(r, 400));
    });
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    await page.screenshot({ path: `D:\\PhanTichWeb\\_screenshots\\final-${t.name}.png`, fullPage: t.fullPage });
    console.log(t.name, overflow, overflow.scrollWidth > overflow.clientWidth ? '*** HORIZONTAL OVERFLOW ***' : 'OK - no horizontal overflow');
    await page.close();
  }

  await browser.close();
})();
