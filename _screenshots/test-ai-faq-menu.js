const { CHROME_PATH, ROOT_URL } = require('./test-env');
// Test: sau mỗi câu trả lời của AI (kể cả lỗi) phải hiện menu gợi ý FAQ; chọn 1 câu
// thì trả lời từ FAQ cục bộ rồi hiện lại menu. Cần server/ đang chạy để test nhánh AI thật.
const puppeteer = require('puppeteer-core');
const BASE = ROOT_URL;

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
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  const page = await browser.newPage();
  await page.setViewport({ width: 420, height: 800 });
  await page.goto(BASE + 'index.html', { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.setItem('aloha_auth', JSON.stringify({ role: 'khach-hang', name: 'Test KH', phone: '0900000001', loginAt: Date.now() })));
  await page.reload({ waitUntil: 'networkidle0' });
  await page.click('#chatToggle');
  await wait(2500);

  await page.type('#chatInput', 'Studio o dau?');
  await page.click('.chat-send');
  await page.waitForSelector('.chat-msg.bot:not(.chat-typing)', { timeout: 5000 });
  await wait(15000);

  const menu = () => page.evaluate(() => {
    const q = document.querySelectorAll('#chatBody .chat-quick');
    return { count: q.length, labels: q.length ? [...q[q.length - 1].querySelectorAll('button')].map(b => b.textContent) : [] };
  });

  let m = await menu();
  log('sau câu trả lời AI có đúng 1 menu', m.count === 1, JSON.stringify(m.labels));
  log('menu có đúng 3 gợi ý', m.labels.length === 3);
  const chatText = await page.evaluate(() => [...document.querySelectorAll('#chatBody .chat-msg.bot')].pop().textContent);
  log('gợi ý là câu hỏi khách, không rỗng', m.labels.every(l => l.length > 3 && l.length <= 80));
  console.log('Trả lời AI:', chatText);

  const first = m.labels[0];
  await page.evaluate(() => document.querySelector('#chatBody .chat-quick button').click());
  await page.waitForFunction((f) => [...document.querySelectorAll('#chatBody .chat-msg.user')].pop().textContent === f, { timeout: 5000 }, first);
  await wait(15000);
  m = await menu();
  log('bấm gợi ý -> gửi như khách gõ, có trả lời mới và menu mới (1 menu, 3 gợi ý)', m.count === 1 && m.labels.length === 3, JSON.stringify(m.labels));

  await page.screenshot({ path: 'ai-faq-menu.png' });
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})();
