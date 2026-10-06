// Test chatbot đóng vai Sale (2026-10-04): ô nhập "Nhập tin nhắn...", đầu khung "Tư vấn viên ALOHA Baby",
// nút "Chat để tư vấn thêm", lời chào/câu trả lời giọng Sale (xưng em, "Dạ"), AI không phản hồi thì
// trả lời dự phòng KHÔNG báo bận/lỗi, khách không thấy chữ "Trợ lý"/"AI" trong khung chat.
// Không cần server (AI không chạy -> kiểm tra luôn câu trả lời dự phòng). Chạy: node _screenshots/test-sale-tone.js
const ENV = require('./test-env');
const puppeteer = require('puppeteer-core');

const INDEX = ENV.ROOT_URL + 'index.html';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const log = (n, ok, x) => { results.push(ok); console.log((ok ? 'PASS' : 'FAIL') + ' - ' + n + (x ? ' (' + x + ')' : '')); };

(async () => {
  const browser = await ENV.launchAllFeatures(puppeteer, { executablePath: ENV.CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const open = async (width, height, hash) => {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    // Chặn server chat để chắc chắn đi nhánh trả lời dự phòng (giống lúc server tắt / AI lỗi).
    await page.setRequestInterception(true);
    page.on('request', (r) => (/\/api\/chat/.test(r.url()) ? r.abort() : r.continue()));
    await page.setViewport({ width, height });
    await page.goto(INDEX + hash, { waitUntil: 'networkidle0' });
    await wait(900);
    await page.click('#chatToggle');
    await wait(3500);
    return page;
  };
  const visibleChatText = (page) => page.evaluate(() => {
    const p = document.getElementById('chatPanel');
    return Array.from(p.querySelectorAll('.chat-body, #chatSubtitle, #chatToSaleText')).map((e) => e.innerText).join(' ')
      + ' ' + document.getElementById('chatInput').placeholder;
  });
  const say = async (page, text) => { await page.type('#chatInput', text); await page.click('#chatInputForm button'); await wait(2500); };
  try {
    const page = await open(1440, 900, '#/');
    const head = await page.evaluate(() => ({
      ph: document.getElementById('chatInput').placeholder,
      sub: document.getElementById('chatSubtitle').textContent,
      btn: document.getElementById('chatToSaleText').textContent,
      bot: Array.from(document.querySelectorAll('#chatBody > .chat-msg.bot')).map((m) => m.textContent).join(' | ')
    }));
    log('Ô nhập là "Nhập tin nhắn..."', head.ph === 'Nhập tin nhắn...', head.ph);
    log('Đầu khung "Tư vấn viên", nút "Chat để tư vấn thêm"', head.sub === 'Tư vấn viên' && head.btn === 'Chat để tư vấn thêm', head.sub + ' / ' + head.btn);
    const clip = await page.evaluate(() => {
      const s = document.getElementById('chatSubtitle');
      const w = document.querySelector('.chat-wordmark').getBoundingClientRect();
      const b = document.getElementById('chatToSale').getBoundingClientRect();
      return { subCut: s.scrollWidth > s.clientWidth + 1, logoUnderBtn: w.right > b.left };
    });
    log('Máy tính: chữ "Tư vấn viên" không bị cắt, logo không bị nút đè', !clip.subCut && !clip.logoUnderBtn, JSON.stringify(clip));
    log('Lời chào giọng Sale (Dạ, em, anh/chị)', /Dạ em chào anh\/chị/.test(head.bot) && /tư vấn viên/.test(head.bot), head.bot);
    await say(page, 'Chi phí chụp newborn bao nhiêu vậy em');
    let last = await page.evaluate(() => { const b = document.querySelectorAll('#chatBody > .chat-msg.bot'); return b[b.length - 1].textContent; });
    log('Hỏi giá khi AI không phản hồi: trả lời giọng Sale có giá Newborn + câu hỏi lại', last.startsWith('Dạ') && last.includes('2.200.000đ') && last.trim().endsWith('?'), last.slice(0, 160));
    await say(page, 'bên mình có bãi đỗ ô tô không');
    last = await page.evaluate(() => { const b = document.querySelectorAll('#chatBody > .chat-msg.bot'); return b[b.length - 1].textContent; });
    log('Câu ngoài kịch bản khi AI không phản hồi: mời chat tư vấn thêm / hotline, không báo bận', last.startsWith('Dạ') && last.includes('Chat để tư vấn thêm') && last.includes('0938.125.222'), last);
    const txt = await visibleChatText(page);
    log('Khách không thấy "Trợ lý", "AI", "đang bận", "lỗi" trong khung chat', !/Trợ lý|trợ lý|\bAI\b|đang bận|\blỗi\b/.test(txt), (txt.match(/.{0,30}(Trợ lý|trợ lý|\bAI\b|đang bận|\blỗi\b).{0,30}/) || [''])[0]);
    await page.screenshot({ path: ENV.shot('sale-tone-desktop.png') });

    // Album Bé lớn: lời chào theo dịch vụ giọng Sale
    const p2 = await open(1440, 900, '#/album/be-lon');
    const g2 = await p2.evaluate(() => Array.from(document.querySelectorAll('#chatBody > .chat-msg.bot')).map((m) => m.textContent).join(' | '));
    log('Album Bé lớn: chào giọng Sale + hỏi tuổi bé', g2.includes('Dạ anh/chị đang ở phần Chụp ảnh Bé lớn') && g2.includes('bao nhiêu tuổi'), g2);

    // Điện thoại: đầu khung chat không tràn, nút "Chat để tư vấn thêm" nằm gọn trong khung
    const m = await open(390, 844, '#/');
    const fit = await m.evaluate(() => {
      const panel = document.getElementById('chatPanel').getBoundingClientRect();
      const btn = document.getElementById('chatToSale').getBoundingClientRect();
      const close = document.getElementById('chatClose').getBoundingClientRect();
      const text = document.getElementById('chatToSaleText');
      const sub = document.getElementById('chatSubtitle');
      const logo = document.querySelector('.chat-wordmark').getBoundingClientRect();
      return { inside: btn.left >= panel.left && close.right <= panel.right + 0.5, oneLine: text.getBoundingClientRect().height < 24,
        subOk: sub.scrollWidth <= sub.clientWidth + 1, logoOk: logo.right <= btn.left,
        noScroll: document.documentElement.scrollWidth <= window.innerWidth, open: document.getElementById('chatPanel').classList.contains('open') };
    });
    log('Điện thoại: đầu khung gọn 1 hàng, nút không tràn, không cuộn ngang', fit.open && fit.inside && fit.oneLine && fit.noScroll && fit.subOk && fit.logoOk, JSON.stringify(fit));
    await m.screenshot({ path: ENV.shot('sale-tone-mobile.png') });

    log('Không có lỗi JS trên trang', errors.length === 0, errors.join(' | '));
  } catch (e) {
    log('Lỗi khi chạy test', false, e.message);
  } finally {
    await browser.close();
    const pass = results.filter(Boolean).length;
    console.log(`\n${pass}/${results.length} PASS`);
    process.exit(pass === results.length ? 0 : 1);
  }
})();
