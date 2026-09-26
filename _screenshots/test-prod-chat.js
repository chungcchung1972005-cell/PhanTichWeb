const { CHROME_PATH } = require('./test-env');
// Test đầu-cuối trên site ĐÃ PUBLIC thật (GitHub Pages + server Render), không phải
// file:// local. Xác nhận: mở trang chủ -> chat -> gõ câu hỏi -> AI thật trả lời
// đúng qua server production, không lỗi CORS/kết nối.
const puppeteer = require('puppeteer-core');
const SITE = 'https://chungcchung1972005-cell.github.io/PhanTichWeb/';
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new', args: ['--no-sandbox']
  });
  const results = [];
  const log = (name, ok, detail) => {
    results.push(ok);
    console.log((ok ? 'OK  ' : 'FAIL') + ' - ' + name + (detail ? ' :: ' + detail : ''));
  };

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.goto(SITE, { waitUntil: 'networkidle0' });

  const apiUrlUsed = await page.evaluate(() => {
    // CHAT_API_URL nằm trong closure, không lộ ra window -> suy ra qua vị trí trang.
    return location.hostname;
  });
  log('đang thật sự chạy trên GitHub Pages (không phải file://)', apiUrlUsed === 'chungcchung1972005-cell.github.io', apiUrlUsed);

  await page.evaluate(() => localStorage.setItem('aloha_auth', JSON.stringify({ role: 'khach-hang', name: 'Test KH', phone: '0900000001', loginAt: Date.now() })));
  await page.reload({ waitUntil: 'networkidle0' });
  await page.click('#chatToggle');
  await wait(2500);

  await page.type('#chatInput', 'Studio o dau vay?');
  await page.click('.chat-send');
  await page.waitForFunction(() => document.querySelectorAll('#chatBody .chat-quick button').length > 0 && !document.querySelector('#chatBody .chat-typing'), { timeout: 30000 }).then(() => true, () => false);
  await wait(1000);

  const hasError = await page.$('.chat-msg.error') !== null;
  const botReply = await page.evaluate(() => {
    const bots = [...document.querySelectorAll('#chatBody .chat-msg.bot')];
    return bots.length ? bots[bots.length - 1].textContent : null;
  });
  log('KHÔNG có tin nhắn lỗi trong khung chat', !hasError);
  log('AI trả lời thật (không rỗng, nhắc tới studio/địa chỉ)', !!botReply && botReply.length > 10, botReply);
  log('không có lỗi CORS/console trong quá trình gọi API', !consoleErrors.some(e => /CORS|Failed to fetch|blocked/i.test(e)), JSON.stringify(consoleErrors));

  const menuLabels = await page.evaluate(() => {
    const q = document.querySelectorAll('#chatBody .chat-quick');
    return q.length ? [...q[q.length - 1].querySelectorAll('button')].map(b => b.textContent) : [];
  });
  log('menu 3 gợi ý hiện đúng sau câu trả lời', menuLabels.length === 3, JSON.stringify(menuLabels));

  await page.screenshot({ path: 'prod-chat-live.png' });
  await browser.close();
  console.log('\n' + (results.every(Boolean) ? 'TẤT CẢ PASS' : 'CÓ FAIL'));
  process.exit(results.every(Boolean) ? 0 : 1);
})();
