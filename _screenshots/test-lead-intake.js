// Test "Tư vấn theo bé nhà mình" (2026-09-30): khách tự gõ tuổi bé ("con tôi năm nay 3 tuổi") ->
// chatbot hỏi tiếp bé trai/gái -> mấy kg -> phong cách, rồi tự mở album concept hợp với bé, trong
// khung chat có tin "Em gửi album ... mẹ tham khảo nhé". Không cần server (không gọi AI).
// Chạy: node _screenshots/test-lead-intake.js
const ENV = require('./test-env');
const puppeteer = require('puppeteer-core');

const INDEX = ENV.ROOT_URL + 'index.html';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const log = (n, ok, x) => { results.push(ok); console.log((ok ? 'PASS' : 'FAIL') + ' - ' + n + (x ? ' (' + x + ')' : '')); };

(async () => {
  const browser = await ENV.launchAllFeatures(puppeteer, { executablePath: ENV.CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const st = (page) => page.evaluate(() => ({
    open: document.getElementById('chatPanel').classList.contains('open'),
    bot: Array.from(document.querySelectorAll('#chatBody > .chat-msg.bot')).map((m) => m.textContent),
    quick: Array.from(document.querySelectorAll('#chatBody .chat-quick button')).map((b) => b.textContent),
    hash: location.hash
  }));
  const lastBot = async (page) => { const s = await st(page); return s.bot[s.bot.length - 1] || ''; };
  const say = async (page, text) => { await page.type('#chatInput', text); await page.click('#chatInputForm button[type="submit"], #chatInputForm button'); await wait(1300); };
  const tap = async (page, label) => {
    await page.evaluate((l) => Array.from(document.querySelectorAll('#chatBody .chat-quick button')).find((b) => b.textContent === l).click(), label);
    await wait(1300);
  };
  const open = async (width, height, hash) => {
    const page = await browser.newPage(); // launchAllFeatures chỉ gắn cờ cho browser.newPage
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewport({ width, height });
    await page.goto(INDEX + hash, { waitUntil: 'networkidle0' });
    await wait(900);
    await page.click('#chatToggle');
    await wait(3500); // chờ lời chào mở đầu gõ xong
    return page;
  };
  try {
    // 1) Máy tính, album Bé lớn: đúng kịch bản người dùng đưa
    let page = await open(1440, 900, '#/album/be-lon');
    await say(page, 'con tôi năm nay 3 tuổi');
    let s = await st(page);
    log('Gõ "con tôi năm nay 3 tuổi" -> hỏi bé trai hay bé gái (không hỏi lại tuổi)', (await lastBot(page)).includes('bé trai hay bé gái') && s.quick.join() === 'Bé trai,Bé gái', s.quick.join());
    await tap(page, 'Bé trai');
    s = await st(page);
    log('Tiếp theo hỏi mấy kg, nút cân nặng theo tuổi bé lớn', (await lastBot(page)).includes('mấy kg') && s.quick.includes('12-15kg'), s.quick.join());
    await say(page, '14');
    s = await st(page);
    log('Gõ tự do "14" -> hỏi phong cách', (await lastBot(page)).includes('phong cách như thế nào') && s.quick.includes('Hàn Quốc, tối giản'), s.quick.join());
    await tap(page, 'Hàn Quốc, tối giản');
    await wait(1500);
    s = await st(page);
    const all = s.bot.join(' | ');
    log('Tự mở album concept Phong cách Hàn Quốc', s.hash === '#/album/be-lon/han-quoc', s.hash);
    log('Khung chat có "Em gửi album ... mẹ tham khảo nhé" + tóm tắt thông tin bé',
      all.includes('Em gửi album "Phong cách Hàn Quốc" mẹ tham khảo nhé') && all.includes('Bé trai, 3 tuổi, khoảng 14kg'), all.slice(-260));
    log('Máy tính: khung chat vẫn mở, có 2 nút tiếp theo', s.open && s.quick.length === 2, s.quick.join());
    await wait(1500); // chờ ảnh bìa concept trong tin nhắn tải xong
    await page.screenshot({ path: ENV.shot('lead-intake-desktop.png') });

    // 2) Bé gái + "Chưa biết, gợi ý giúp mình" -> Mùa thu lá vàng
    page = await open(1440, 900, '#/album/be-lon');
    await say(page, 'bé nhà mình 4 tuổi');
    await tap(page, 'Bé gái');
    await tap(page, '15-18kg');
    await tap(page, 'Chưa biết, gợi ý giúp mình');
    await wait(1500);
    s = await st(page);
    log('Bé gái 4 tuổi + nhờ gợi ý -> album Mùa thu lá vàng', s.hash === '#/album/be-lon/mua-thu', s.hash);

    // 3) Điện thoại, trang chủ: bé mới sinh -> Newborn; khung chat tự thu lại để thấy album
    page = await open(390, 844, '#/');
    await say(page, 'bé nhà em mới sinh được 10 ngày');
    await tap(page, 'Bé gái');
    s = await st(page);
    log('Newborn: nút cân nặng theo sơ sinh', s.quick.includes('Dưới 3kg'), s.quick.join());
    await page.screenshot({ path: ENV.shot('lead-intake-mobile-chat.png') });
    await tap(page, 'Dưới 3kg');
    await tap(page, 'Chưa biết, gợi ý giúp mình');
    await wait(1500);
    s = await st(page);
    log('Bé dưới 3kg nhờ gợi ý -> album Newborn Cuộn ủ', s.hash === '#/album/newborn/cuon-u', s.hash);
    log('Điện thoại: khung chat tự thu lại sau khi mở album', !s.open);
    await page.screenshot({ path: ENV.shot('lead-intake-mobile-album.png') });
    await page.click('#chatToggle');
    await wait(900);
    s = await st(page);
    log('Mở lại khung chat vẫn thấy tin "Em gửi album ..."', s.bot.join(' ').includes('Em gửi album "Cuộn ủ (wrap) cổ điển" mẹ tham khảo nhé'));

    // 4) Mẹ bầu: không hỏi cân nặng
    page = await open(1440, 900, '#/');
    await say(page, 'em đang bầu, dự sinh tháng 12');
    s = await st(page);
    log('Mẹ bầu -> hỏi đã biết trai/gái chưa (có nút Chưa biết)', s.quick.includes('Chưa biết'), s.quick.join());
    await tap(page, 'Chưa biết');
    log('Mẹ bầu: bỏ qua câu cân nặng, hỏi luôn phong cách', (await lastBot(page)).includes('phong cách'));
    await tap(page, 'Tự nhiên, ngoài trời');
    await wait(1500);
    s = await st(page);
    log('Mẹ bầu + tự nhiên -> album Bầu Ngoại cảnh thiên nhiên', s.hash === '#/album/bau/ngoai-canh', s.hash);

    // 5) Hỏi giá có kèm tuổi: không vào luồng hỏi thông tin (để AI / trả lời dự phòng)
    page = await open(1440, 900, '#/');
    await say(page, 'bé 3 tuổi chụp giá bao nhiêu');
    await wait(2500);
    s = await st(page);
    log('Câu hỏi giá kèm tuổi không bị chặn vào luồng hỏi trai/gái', !s.bot.join(' ').includes('bé trai hay bé gái'));

    // 6) Nút menu "Tư vấn theo bé nhà mình" vẫn hỏi tuổi trước
    page = await open(1440, 900, '#/');
    const hasBtn = await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('#chatBody .chat-quick button')).find((x) => x.textContent === 'Tư vấn theo bé nhà mình');
      if (b) b.click();
      return !!b;
    });
    if (hasBtn) {
      await wait(1300);
      log('Nút "Tư vấn theo bé nhà mình" -> hỏi tuổi trước', (await lastBot(page)).includes('mấy tháng/mấy tuổi'));
      await tap(page, '1-3 tuổi');
      log('Chọn "1-3 tuổi" -> hỏi trai/gái', (await lastBot(page)).includes('bé trai hay bé gái'));
    } else {
      console.log('SKIP - menu mở đầu không hiện nút "Tư vấn theo bé nhà mình" (AI chọn 2 nút khác)');
    }

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
