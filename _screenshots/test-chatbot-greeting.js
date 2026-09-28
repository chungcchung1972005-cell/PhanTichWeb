// Test chatbot AI (2026-09-28): trang chủ máy tính tự mở chatbot hỏi "cần tư vấn gì"; điện thoại chỉ
// hiện bong bóng lời chào; vào album dịch vụ / concept thì lời chào đổi theo; khách chưa đăng nhập
// bấm vào chatbot -> đăng nhập -> quay lại mở tiếp; "Nhắn Sale" -> chat với Sale ngay trong khung
// đó, Sale nhận bản tóm tắt khách đã xem / đã hỏi (tin hệ thống, khách không thấy).
// Tự bật server/server.js ở cổng 3001 (lưu bộ nhớ, KHÔNG gọi Gemini: GEMINI_API_KEY rỗng) - tắt
// npm start của bạn trước. Chạy: node _screenshots/test-chatbot-greeting.js
const path = require('path');
const { spawn } = require('child_process');
const ENV = require('./test-env');
const puppeteer = require('puppeteer-core');

const INDEX = ENV.ROOT_URL + 'index.html';
const API = 'http://localhost:3001';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const log = (n, ok, x) => { results.push(ok); console.log((ok ? 'PASS' : 'FAIL') + ' - ' + n + (x ? ' (' + x + ')' : '')); };

(async () => {
  const server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(ENV.ROOT, 'server'),
    env: { ...process.env, PORT: '3001', AUTH_SECRET: 'test-secret', MONGODB_URI: '', ALLOWED_ORIGINS: '', GEMINI_API_KEY: '' },
    stdio: 'ignore'
  });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(API + '/api/health')).ok) break; } catch (e) { /* chưa lên */ } await wait(150); }
  const browser = await puppeteer.launch({ executablePath: ENV.CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  try {
    // ---------------- 1) Máy tính, khách chưa đăng nhập ----------------
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(INDEX + '#/', { waitUntil: 'networkidle0' });
    await wait(3200);
    const st = () => page.evaluate(() => ({
      open: document.getElementById('chatPanel').classList.contains('open'),
      sale: document.getElementById('chatPanel').classList.contains('sale-mode'),
      bot: Array.from(document.querySelectorAll('#chatBody > .chat-msg.bot')).map((m) => m.textContent),
      quick: Array.from(document.querySelectorAll('#chatBody .chat-quick button')).map((b) => b.textContent),
      hash: location.hash
    }));
    let s = await st();
    log('Trang chủ máy tính: chatbot tự mở, chào + hỏi cần tư vấn gì, có nút gợi ý', s.open && s.bot.join(' ').includes('cần tư vấn gì') && s.quick.length > 0, s.bot.join(' | '));
    await page.screenshot({ path: ENV.shot('chatbot-home-guest.png') });
    await Promise.all([page.waitForNavigation(), page.click('#chatBody .chat-quick button')]);
    log('Chưa đăng nhập bấm nút trong chatbot -> sang đăng nhập (quay lại Trang chủ)', page.url().includes('login.html?next=home'), page.url().split('/').pop());
    await page.type('#loginPhone', '0900000001');
    await page.type('#loginPassword', 'khach123');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('#loginSubmitBtn')]);
    await wait(1800);
    s = await st();
    log('Đăng nhập xong về Trang chủ, khung chat mở tiếp', s.open && s.hash === '#/' && s.bot.length >= 2, s.hash);

    // ---------------- 2) Album dịch vụ -> concept: lời chào đổi theo ----------------
    await page.evaluate(() => { location.hash = '/album/bau'; });
    await wait(1800);
    s = await st();
    log('Vào album Bầu (chưa trò chuyện): lời chào thay bằng lời chào dịch vụ Bầu, khung vẫn mở',
      s.open && s.bot.length === 2 && s.bot.join(' ').includes('album Bầu') && s.bot.join(' ').includes('tuần thai') && s.quick.includes('Báo giá & gói chụp'), s.bot.join(' | '));
    await page.screenshot({ path: ENV.shot('chatbot-album-bau.png') });
    await page.click('#galleryConcepts .concept-album');
    await wait(1800);
    s = await st();
    log('Vào sâu 1 concept: khung vẫn mở ở góc, lời chào theo concept', s.open && s.bot.join(' ').includes('concept "') && s.quick.includes('Tư vấn concept này'), s.bot.join(' | '));
    // Khách bấm 1 gợi ý (đã trò chuyện) -> sang dịch vụ khác thì chỉ nói thêm, không xoá cuộc trò chuyện
    await page.evaluate(() => Array.from(document.querySelectorAll('#chatBody .chat-quick button')).find((b) => b.textContent === 'Tư vấn concept này').click());
    await wait(1600);
    const before = (await st()).bot.length;
    await page.evaluate(() => { location.hash = '/album/newborn'; });
    await wait(1800);
    s = await st();
    log('Đã trò chuyện rồi sang album Newborn: giữ tin cũ, nói thêm lời chào Newborn', s.bot.length > before && s.bot.join(' ').includes('Ngoại cảnh') && s.bot[s.bot.length - 1].includes('newborn'), `${before} -> ${s.bot.length} tin`);
    await page.evaluate(() => { location.hash = '/album/bau'; });
    await wait(1800);

    // ---------------- 3) Chuyển sang Sale trong cùng khung ----------------
    await page.click('#chatToSale');
    await page.waitForSelector('#chatBody .chat-sale-live .sc-chip', { timeout: 10000 });
    s = await st();
    log('Bấm "Nhắn Sale": cùng khung chat (tin trợ lý còn phía trên), chuyển chế độ Sale', s.sale && s.open && s.bot.length > 2);
    await page.type('#chatInput', 'Cho mình hỏi lịch trống tuần sau');
    await page.keyboard.press('Enter');
    await wait(1500);
    const token = await page.evaluate(() => JSON.parse(localStorage.getItem('aloha_auth')).token);
    const me = await (await fetch(API + '/api/sale-chat/me', { headers: { authorization: 'Bearer ' + token } })).json();
    const msgs = me.chat.messages;
    log('Server có tin tóm tắt (hệ thống) trước tin của khách', msgs[0].from === 'he-thong' && msgs[1].from === 'khach', msgs.map((m) => m.from).join(','));
    log('Tóm tắt có dịch vụ đang hỏi, concept đã xem, câu đã hỏi trợ lý',
      /Đang hỏi về: Chụp ảnh bầu/.test(msgs[0].text) && /Concept đã xem/.test(msgs[0].text) && /Đã hỏi trợ lý AI: .*Tư vấn concept này/.test(msgs[0].text), msgs[0].text.replace(/\n/g, ' / '));
    const shown = await page.evaluate(() => ({ mine: Array.from(document.querySelectorAll('#chatBody .chat-sale-live .from-me .sc-bubble')).map((b) => b.textContent), leak: document.getElementById('chatBody').textContent.includes('Quan tâm nhiều nhất') }));
    log('Khách không thấy tin tóm tắt, thấy tin mình gửi', shown.mine.length === 1 && !shown.leak, shown.mine.join('|'));
    await page.screenshot({ path: ENV.shot('chatbot-sale-mode.png') });

    // Sale xem + trả lời
    const sctx = await browser.createBrowserContext();
    const sp = await sctx.newPage();
    await sp.setViewport({ width: 1440, height: 900 });
    await sp.goto(ENV.ROOT_URL + 'login.html', { waitUntil: 'networkidle0' });
    await sp.type('#loginPhone', '0900000005');
    await sp.type('#loginPassword', 'sale123');
    await Promise.all([sp.waitForNavigation({ waitUntil: 'networkidle0' }), sp.click('#loginSubmitBtn')]);
    await sp.waitForSelector('.inbox-item', { timeout: 8000 });
    await sp.click('.inbox-item');
    const card = await sp.waitForSelector('#inboxMsgs .from-system', { timeout: 8000 }).then(() => true, () => false);
    log('Sale thấy thẻ tóm tắt tự động trong hộp thư', card);
    await sp.evaluate(() => document.getElementById('tin-nhan').scrollIntoView());
    await wait(300);
    await sp.screenshot({ path: ENV.shot('chatbot-admin-summary.png') });
    await sp.type('#inboxInput', 'Dạ tuần sau còn sáng thứ 3 ạ');
    await sp.keyboard.press('Enter');
    const got = await page.waitForFunction(() => document.querySelectorAll('#chatBody .chat-sale-live .from-sale:not(.sc-auto)').length === 1, { timeout: 8000 }).then(() => true, () => false);
    log('Khách nhận câu trả lời của Sale ngay trong khung chatbot', got);
    await page.click('#chatToSale');
    await wait(900);
    s = await st();
    log('Quay lại trợ lý AI: tin Sale vẫn còn, hiện menu', !s.sale && s.quick.length > 0 && await page.evaluate(() => document.querySelectorAll('#chatBody .chat-sale-live .sc-bubble').length > 0));
    // Đóng khung -> không tự mở lại khi về Trang chủ
    await page.click('#chatClose');
    await page.evaluate(() => { location.hash = '/'; });
    await wait(2500);
    log('Khách đã đóng khung chat -> về Trang chủ không tự mở lại', !(await st()).open);

    // ---------------- 4) Điện thoại ----------------
    const mctx = await browser.createBrowserContext();
    const m = await mctx.newPage();
    m.on('pageerror', (e) => errors.push(e.message));
    await m.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await m.goto(INDEX + '#/', { waitUntil: 'networkidle0' });
    await wait(2500);
    const mob = await m.evaluate(() => ({ open: document.getElementById('chatPanel').classList.contains('open'), teaser: !document.getElementById('chatTeaser').hidden, text: document.getElementById('chatTeaserText').textContent, over: document.documentElement.scrollWidth > innerWidth }));
    log('[mobile] không tự mở, hiện bong bóng lời chào, không tràn ngang', !mob.open && mob.teaser && !mob.over, mob.text);
    await m.screenshot({ path: ENV.shot('chatbot-mobile-home.png') });
    await m.evaluate(() => { location.hash = '/album/newborn'; });
    await wait(600);
    const mob2 = await m.evaluate(() => document.getElementById('chatTeaserText').textContent);
    log('[mobile] sang album Newborn: bong bóng đổi lời chào', mob2.includes('Newborn'), mob2);
    await m.click('#chatTeaserClose');
    await m.evaluate(() => { location.hash = '/album/bau'; });
    await wait(600);
    log('[mobile] bấm × ẩn bong bóng, sang trang khác không hiện lại', await m.evaluate(() => document.getElementById('chatTeaser').hidden));
    log('Không lỗi JavaScript', errors.length === 0, errors.join(' | '));
  } catch (e) {
    log('Test chạy hết không bị lỗi giữa chừng', false, e.message);
  } finally {
    await browser.close();
    server.kill();
  }
  const failed = results.filter((x) => !x).length;
  console.log('\n' + (failed ? failed + ' TEST FAIL' : 'TẤT CẢ TEST PASS') + ` (${results.length} case)`);
  process.exit(failed ? 1 : 0);
})();
