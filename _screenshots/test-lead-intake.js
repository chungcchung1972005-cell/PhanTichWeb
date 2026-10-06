// Test hỏi thông tin bé theo dịch vụ (2026-10-04): vào album 1 dịch vụ -> chat báo "anh/chị đang ở phần
// Chụp ảnh X" rồi hỏi tuổi -> giới tính -> cân nặng -> concept (mỗi concept 1 nút, bấm là mở album concept),
// cuối cùng "Cảm ơn ba mẹ đã cung cấp thông tin, ba mẹ hãy tham khảo album ạ." + nút "Chat với Sale" (không
// bắt đăng nhập). Bầu hỏi tuần thai (không hỏi cân nặng), Gia đình hỏi số người. Không cần server.
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
    sale: document.getElementById('chatPanel').classList.contains('sale-mode'),
    bot: Array.from(document.querySelectorAll('#chatBody > .chat-msg.bot')).map((m) => m.textContent),
    quick: Array.from(document.querySelectorAll('#chatBody .chat-quick button')).map((b) => b.textContent),
    teaser: (() => { const t = document.getElementById('chatTeaser'); return t && !t.hidden ? document.getElementById('chatTeaserText').textContent : ''; })(),
    hash: location.hash,
    url: location.href
  }));
  const lastBot = async (page) => { const s = await st(page); return s.bot[s.bot.length - 1] || ''; };
  const say = async (page, text) => { await page.type('#chatInput', text); await page.click('#chatInputForm button'); await wait(1300); };
  const tap = async (page, label) => {
    await page.evaluate((l) => Array.from(document.querySelectorAll('#chatBody .chat-quick button')).find((b) => b.textContent === l).click(), label);
    await wait(1300);
  };
  const conceptNames = (page, slug) => page.evaluate((s) => window.AlohaAlbums.list.find((x) => x.slug === s).concepts.map((c) => c.name), slug);
  // fresh = khách chưa đóng khung chat (để kiểm tra tự mở); mặc định test cũ coi như đã đóng lời chào.
  const newPage = async (width, height, fresh) => {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    if (fresh) await page.evaluateOnNewDocument(() => { try { if (!sessionStorage.getItem('t_init')) { sessionStorage.setItem('aloha_chat_ui', '{}'); sessionStorage.setItem('t_init', '1'); } } catch (e) { /* bỏ qua */ } });
    await page.setViewport({ width, height });
    return page;
  };
  try {
    // 1) Máy tính: trang chủ -> bấm ảnh dịch vụ Newborn -> album Newborn, khung chat tự mở và hỏi
    let page = await newPage(1440, 900, true);
    await page.goto(INDEX + '#/', { waitUntil: 'networkidle0' });
    await wait(600);
    await page.evaluate(() => { const c = document.getElementById('chatClose'); if (document.getElementById('chatPanel').classList.contains('open')) c.click(); sessionStorage.setItem('aloha_chat_ui', '{}'); });
    await page.evaluate(() => document.querySelector('#view-home a[href="#/album/newborn"]').click());
    await wait(4200);
    let s = await st(page);
    const nb = await conceptNames(page, 'newborn');
    log('Bấm Newborn ở trang chủ -> vào album Newborn, khung chat tự mở', s.hash === '#/album/newborn' && s.open, s.hash);
    log('Chat báo "đang ở phần Chụp ảnh Newborn" + câu 1 kèm dòng giải thích', s.bot.join(' ').includes('đang ở phần Chụp ảnh Newborn')
      && (await lastBot(page)).includes('Bé nhà mình được mấy tháng tuổi hoặc bao nhiêu tuổi rồi ạ?') && (await lastBot(page)).includes('(Giúp studio định hướng gói chụp'), s.bot.join(' | '));
    log('Câu 1: đúng 3 lựa chọn', s.quick.join('|') === 'Dưới 1 tháng tuổi (Newborn)|Từ 1 - 3 tháng tuổi|Từ 3 - 6 tháng tuổi', s.quick.join('|'));
    await page.screenshot({ path: ENV.shot('lead-intake-desktop-q1.png') });
    await tap(page, 'Dưới 1 tháng tuổi (Newborn)');
    s = await st(page);
    log('Câu 2: giới tính, 2 lựa chọn', (await lastBot(page)).includes('Giới tính của bé là gì ạ?') && s.quick.join('|') === 'Bé Trai 👦|Bé Gái 👧', s.quick.join('|'));
    await tap(page, 'Bé Gái 👧');
    s = await st(page);
    log('Câu 3: cân nặng, 4 lựa chọn', (await lastBot(page)).includes('Cân nặng hiện tại của bé khoảng bao nhiêu kg ạ?') && s.quick.join('|') === 'Dưới 3 kg|Từ 3kg - 5kg|Từ 5kg - 8kg|Từ 8kg - 12kg', s.quick.join('|'));
    await tap(page, 'Dưới 3 kg');
    s = await st(page);
    log('Câu 4: mỗi concept Newborn là 1 nút', (await lastBot(page)).includes('Ba mẹ đang quan tâm đến concept chụp nào dưới đây ạ?') && s.quick.join('|') === nb.join('|'), s.quick.length + ' nút');
    await tap(page, 'Hoa lá');
    await wait(1200);
    s = await st(page);
    log('Bấm concept -> mở album concept đó', s.hash === '#/album/newborn/hoa-la', s.hash);
    log('Cảm ơn + nút "Chat với Sale"', (await lastBot(page)) === 'Cảm ơn ba mẹ đã cung cấp thông tin, ba mẹ hãy tham khảo album ạ.' && s.quick.join() === 'Chat với Sale', s.quick.join());
    await page.screenshot({ path: ENV.shot('lead-intake-desktop-done.png') });

    // Sang dịch vụ khác: không hỏi lại tuổi/giới tính/cân nặng, hỏi luôn concept
    await page.evaluate(() => { location.hash = '/album/sinh-nhat'; });
    await wait(2600);
    s = await st(page);
    const sn = await conceptNames(page, 'sinh-nhat');
    log('Sang Sinh nhật: báo đang ở phần Sinh nhật, hỏi luôn concept (không hỏi lại tuổi)', s.bot.join(' ').includes('đang ở phần Chụp ảnh Sinh nhật')
      && (await lastBot(page)).includes('concept chụp nào') && s.quick.join('|') === sn.join('|'), s.quick.join('|'));
    await tap(page, sn[0]);
    await wait(1000);
    await tap(page, 'Chat với Sale');
    s = await st(page);
    log('Bấm "Chat với Sale" -> chuyển sang chat Sale ngay, không bắt đăng nhập', s.sale && !s.url.includes('login.html'), s.url.split('/').pop());

    // 2) Điện thoại, album Bầu: chỉ hiện bong bóng; mở ra hỏi tuần thai -> giới tính (có Chưa biết) -> concept
    page = await newPage(390, 844, true);
    await page.goto(INDEX + '#/album/bau', { waitUntil: 'networkidle0' });
    await wait(1500);
    s = await st(page);
    log('Điện thoại: không tự mở, hiện bong bóng mời trả lời', !s.open && s.teaser.includes('Chụp ảnh Bầu'), s.teaser);
    await page.click('#chatTeaserText');
    await wait(3000);
    s = await st(page);
    log('Bầu: câu 1 hỏi tuần thai', (await lastBot(page)).includes('tuần thai') && s.quick.join('|') === 'Dưới 28 tuần|Từ 28 - 34 tuần|Trên 34 tuần', s.quick.join('|'));
    await page.screenshot({ path: ENV.shot('lead-intake-mobile-q1.png') });
    await tap(page, 'Từ 28 - 34 tuần');
    s = await st(page);
    log('Bầu: giới tính có "Chưa biết"', s.quick.includes('Chưa biết'), s.quick.join('|'));
    await tap(page, 'Chưa biết');
    s = await st(page);
    log('Bầu: không hỏi cân nặng, sang concept', (await lastBot(page)).includes('concept chụp nào'), (await lastBot(page)).slice(0, 60));
    const bau = await conceptNames(page, 'bau');
    await tap(page, bau[0]);
    await wait(1200);
    s = await st(page);
    log('Điện thoại: mở album concept, khung chat thu lại', s.hash.startsWith('#/album/bau/') && !s.open, s.hash);
    await page.screenshot({ path: ENV.shot('lead-intake-mobile-album.png') });
    await page.click('#chatToggle');
    await wait(900);
    s = await st(page);
    log('Mở lại chat thấy lời cảm ơn + nút Chat với Sale', s.bot.join(' ').includes('Cảm ơn ba mẹ đã cung cấp thông tin') && s.quick.includes('Chat với Sale'));
    await page.screenshot({ path: ENV.shot('lead-intake-mobile-done.png') });

    // 3) Gia đình: hỏi số người -> concept
    page = await newPage(1440, 900, false);
    await page.goto(INDEX + '#/album/gia-dinh', { waitUntil: 'networkidle0' });
    await wait(700); await page.click('#chatToggle'); await wait(3000);
    s = await st(page);
    log('Gia đình: hỏi số người', (await lastBot(page)).includes('mấy người') && s.quick.join('|') === '3 người|4 - 5 người|Trên 5 người', s.quick.join('|'));
    await tap(page, '4 - 5 người');
    log('Gia đình: không hỏi giới tính/cân nặng, sang concept', (await lastBot(page)).includes('concept chụp nào'));

    // 4) Album Newborn, gõ tự do ở câu 1 + gõ tên concept
    page = await newPage(1440, 900, false);
    await page.goto(INDEX + '#/album/newborn', { waitUntil: 'networkidle0' });
    await wait(700); await page.click('#chatToggle'); await wait(3000);
    await say(page, '2 tháng');
    log('Gõ tự do "2 tháng" ở câu 1 -> sang câu giới tính', (await lastBot(page)).includes('Giới tính'));
    await say(page, 'con trai');
    await say(page, '4kg');
    await say(page, 'trăng sao');
    await wait(1200);
    s = await st(page);
    log('Gõ "trăng sao" ở câu 4 -> mở album Trăng sao cổ tích', s.hash === '#/album/newborn/trang-sao', s.hash);

    // 5) Trang chủ, khách tự gõ tuổi -> chọn đúng dịch vụ, bỏ qua câu tuổi
    page = await newPage(1440, 900, false);
    await page.goto(INDEX + '#/', { waitUntil: 'networkidle0' });
    await wait(700); await page.click('#chatToggle'); await wait(3500);
    await say(page, 'con tôi năm nay 3 tuổi');
    s = await st(page);
    log('Gõ "con tôi năm nay 3 tuổi" -> báo hợp Chụp ảnh Bé lớn + hỏi giới tính', s.bot.join(' ').includes('hợp với dịch vụ Chụp ảnh Bé lớn') && (await lastBot(page)).includes('Giới tính'), (await lastBot(page)).slice(0, 60));
    await tap(page, 'Bé Trai 👦');
    s = await st(page);
    log('Bé lớn: nút cân nặng bé lớn', s.quick.includes('Từ 12kg - 15kg'), s.quick.join('|'));

    // 6) Hỏi giá kèm tuổi: không bị kéo vào luồng hỏi
    page = await newPage(1440, 900, false);
    await page.goto(INDEX + '#/', { waitUntil: 'networkidle0' });
    await wait(700); await page.click('#chatToggle'); await wait(3500);
    await say(page, 'bé 3 tuổi chụp giá bao nhiêu');
    await wait(2500);
    s = await st(page);
    log('Câu hỏi giá kèm tuổi không bị kéo vào luồng hỏi', !s.bot.join(' ').includes('Giới tính của bé'));

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
