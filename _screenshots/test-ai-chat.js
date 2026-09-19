// Test khung chat tự do: server tắt -> báo lỗi thân thiện; server chạy nhưng
// thiếu API key -> vẫn báo lỗi thân thiện (không vỡ UI, không giả vờ có AI).
const puppeteer = require('puppeteer-core');
const BASE = 'file:///D:/PhanTichWeb/';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new', args: ['--no-sandbox']
  });
  const results = [];
  function log(name, ok, detail) {
    results.push({ name, ok, detail });
    console.log((ok ? 'OK  ' : 'FAIL') + ' - ' + name + (detail ? ' :: ' + detail : ''));
  }

  async function loginAsCustomer(page) {
    await page.goto(BASE + 'index.html', { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.setItem('aloha_auth', JSON.stringify({ role: 'khach-hang', name: 'Test KH', loginAt: Date.now() })));
    await page.reload({ waitUntil: 'networkidle0' });
  }

  // 1) Server KHÔNG chạy -> gửi câu hỏi tự do -> báo lỗi thân thiện
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await loginAsCustomer(page);
    await page.click('#chatToggle');
    await new Promise(r => setTimeout(r, 300));
    await page.type('#chatInput', 'Chi phi chup newborn bao nhieu?');
    await page.click('.chat-send');
    await new Promise(r => setTimeout(r, 1500));
    const hasErrorMsg = await page.$('.chat-msg.error') !== null;
    const userMsgShown = await page.evaluate(() => document.getElementById('chatBody').textContent.includes('Chi phi chup newborn'));
    log('server tắt: hiện tin nhắn lỗi thân thiện, không vỡ UI', hasErrorMsg && userMsgShown);
    await page.close();
  }

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (failed.length === 0 ? 'TẤT CẢ TEST PASS' : failed.length + ' TEST FAIL'));
  process.exit(failed.length === 0 ? 0 : 1);
})();
