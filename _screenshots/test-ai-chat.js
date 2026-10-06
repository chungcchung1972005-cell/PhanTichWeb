const { CHROME_PATH, ROOT_URL } = require('./test-env');
// Test khung chat tự do: server tắt -> báo lỗi thân thiện; server chạy nhưng
// thiếu API key -> vẫn báo lỗi thân thiện (không vỡ UI, không giả vờ có AI).
const puppeteer = require('puppeteer-core');
const BASE = ROOT_URL;

(async () => {
  const browser = await require('./test-env').launchAllFeatures(puppeteer, {
    executablePath: CHROME_PATH,
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

  // 1) Server KHÔNG chạy -> gửi câu hỏi tự do -> trả lời cục bộ, không hiện lỗi
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.setRequestInterception(true);
    page.on('request', (r) => (r.url().includes(':3001/') ? r.abort() : r.continue()));
    await loginAsCustomer(page);
    await page.click('#chatToggle');
    await new Promise(r => setTimeout(r, 300));
    await page.type('#chatInput', 'Chi phi chup newborn bao nhieu?');
    await page.click('.chat-send');
    await new Promise(r => setTimeout(r, 1500));
    const hasErrorMsg = await page.$('.chat-msg.error') !== null;
    const body = await page.evaluate(() => document.getElementById('chatBody').textContent);
    const userMsgShown = body.includes('Chi phi chup newborn');
    // Từ 2026-10-04: trả lời dự phòng cùng giọng Sale, KHÔNG báo bận/lỗi (người dùng chốt).
    const localReply = body.includes('2.200.000đ') && body.includes('Dạ') && !/đang bận|Trợ lý AI|\blỗi\b/.test(body);
    log('server tắt: trả lời cục bộ giọng Sale đúng giá Newborn, không báo bận/lỗi, không vỡ UI', !hasErrorMsg && userMsgShown && localReply);
    await page.close();
  }

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (failed.length === 0 ? 'TẤT CẢ TEST PASS' : failed.length + ' TEST FAIL'));
  process.exit(failed.length === 0 ? 0 : 1);
})();
