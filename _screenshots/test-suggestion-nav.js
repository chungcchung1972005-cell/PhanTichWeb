const { CHROME_PATH, ROOT_URL } = require('./test-env');
// Test menu gợi ý dưới câu trả lời AI: gợi ý có action -> bấm là chuyển thẳng trang
// (KHÔNG gọi AI thêm), gợi ý action "none" -> gửi như khách gõ. Dùng phản hồi giả
// cho /api/chat nên không cần server và không tốn hạn mức Gemini.
const puppeteer = require('puppeteer-core');
const BASE = ROOT_URL;
const wait = (ms) => new Promise(r => setTimeout(r, ms));

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
const REPLIES = [
  { reply: 'Mình có thể giúp bạn đặt lịch, xem ảnh hoặc tư vấn thêm nhé.', suggestions: [
    { label: 'Đặt lịch chụp ngay', action: 'dat-lich' },
    { label: 'Xem ảnh của tôi', action: 'chon-anh' },
    { label: 'Studio có chụp tại nhà không?', action: 'none' }] },
  { reply: 'Có nhé, studio nhận chụp tại nhà.', suggestions: [
    { label: 'Xem các dịch vụ', action: 'dich-vu' },
    { label: 'Đặt lịch chụp ngay', action: 'dat-lich' },
    { label: 'Đặt cọc thế nào?', action: 'none' }] }
];

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
  let calls = 0;
  const sent = [];
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    if (!r.url().includes(':3001/api/chat')) return r.continue();
    if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: CORS });
    const msgs = JSON.parse(r.postData()).messages;
    sent.push(msgs[msgs.length - 1].content);
    const body = REPLIES[Math.min(calls++, REPLIES.length - 1)];
    r.respond({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  });
  await page.goto(BASE + 'index.html', { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.setItem('aloha_auth', JSON.stringify({ role: 'khach-hang', name: 'Test KH', phone: '0900000001', loginAt: Date.now() })));
  await page.reload({ waitUntil: 'networkidle0' });
  await page.click('#chatToggle');
  await wait(2500);

  const menu = () => page.evaluate(() => {
    const q = document.querySelectorAll('#chatBody .chat-quick');
    return { count: q.length, labels: q.length ? [...q[q.length - 1].querySelectorAll('button')].map(b => b.textContent) : [] };
  });
  const clickLabel = (label) => page.evaluate((l) => [...document.querySelectorAll('#chatBody .chat-quick button')].find(b => b.textContent === l).click(), label);
  const hash = () => page.evaluate(() => location.hash);

  await page.type('#chatInput', 'xin chào');
  await page.click('.chat-send');
  await page.waitForFunction(() => document.querySelectorAll('#chatBody .chat-quick').length === 1, { timeout: 5000 });
  let m = await menu();
  log('sau câu trả lời có đúng 1 menu, 3 gợi ý', m.count === 1 && m.labels.length === 3, JSON.stringify(m.labels));

  await clickLabel('Đặt lịch chụp ngay');
  await page.waitForFunction(() => location.hash === '#/dat-lich', { timeout: 5000 }).then(() => log('bấm "Đặt lịch chụp ngay" -> nhảy sang #/dat-lich', true), () => log('bấm "Đặt lịch chụp ngay" -> nhảy sang #/dat-lich', false));
  await wait(800);
  log('view Đặt lịch hiện', await page.evaluate(() => !document.getElementById('view-dat-lich').hidden));
  log('bấm gợi ý dẫn trang KHÔNG gọi AI thêm', sent.length === 1, 'số lần gọi AI = ' + sent.length);
  m = await menu();
  log('menu gợi ý vẫn còn sau khi chuyển trang (1 menu, 3 gợi ý)', m.count === 1 && m.labels.length === 3);

  await clickLabel('Xem ảnh của tôi');
  await page.waitForFunction(() => location.hash === '#/chon-anh', { timeout: 5000 }).then(() => log('bấm "Xem ảnh của tôi" -> nhảy sang #/chon-anh', true), () => log('bấm "Xem ảnh của tôi" -> nhảy sang #/chon-anh', false));

  await clickLabel('Studio có chụp tại nhà không?');
  await page.waitForFunction(() => document.querySelectorAll('#chatBody .chat-quick button').length === 3 && [...document.querySelectorAll('#chatBody .chat-quick button')].some(b => b.textContent === 'Xem các dịch vụ'), { timeout: 5000 })
    .then(() => log('bấm gợi ý câu hỏi (action none) -> gửi cho AI, hiện menu mới', sent.length === 2 && sent[1] === 'Studio có chụp tại nhà không?', JSON.stringify(sent)), () => log('bấm gợi ý câu hỏi (action none) -> gửi cho AI, hiện menu mới', false, JSON.stringify(sent)));
  const userMsgs = await page.evaluate(() => [...document.querySelectorAll('#chatBody .chat-msg.user')].map(e => e.textContent));
  log('câu hỏi bấm chỉ hiện 1 lần trong khung chat (không nhân đôi)', userMsgs.filter(t => t === 'Studio có chụp tại nhà không?').length === 1);

  await clickLabel('Xem các dịch vụ');
  await wait(2500);
  const inView = await page.evaluate(() => {
    const r = document.getElementById('dich-vu').getBoundingClientRect();
    return r.top < innerHeight && r.bottom > 0 && !document.getElementById('view-home').hidden;
  });
  log('bấm "Xem các dịch vụ" -> về trang chủ, cuộn tới mục Dịch vụ', inView);

  await page.screenshot({ path: 'suggestion-nav.png' });
  await browser.close();
  console.log('\n' + (results.every(Boolean) ? 'TẤT CẢ PASS' : 'CÓ FAIL'));
  process.exit(results.every(Boolean) ? 0 : 1);
})();
