// Test chatbot với AI thật (cần server/ đang chạy): khách nhắn ý muốn -> bot chỉ trả
// lời bằng chữ, KHÔNG tự chuyển trang; menu 3 gợi ý có nút dẫn tới đúng trang, bấm nút
// mới chuyển. Kiểm tra thêm: dự phòng khi AI lỗi, nút chat có ở mọi view khách hàng,
// khung chat tự đóng trên mobile sau khi chuyển trang.
const puppeteer = require('puppeteer-core');
const BASE = 'file:///D:/PhanTichWeb/';
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new', args: ['--no-sandbox']
  });
  const results = [];
  const log = (name, ok, detail) => {
    results.push(ok);
    console.log((ok ? 'OK  ' : 'FAIL') + ' - ' + name + (detail ? ' :: ' + detail : ''));
  };

  async function open(width, height, blockApi) {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    if (blockApi) {
      await page.setRequestInterception(true);
      page.on('request', (r) => (r.url().includes(':3001/') ? r.abort() : r.continue()));
    }
    await page.goto(BASE + 'index.html', { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.setItem('aloha_auth', JSON.stringify({ role: 'khach-hang', name: 'Test KH', phone: '0900000001', loginAt: Date.now() })));
    await page.reload({ waitUntil: 'networkidle0' });
    return page;
  }
  const say = async (page, text) => {
    await page.evaluate(() => { document.getElementById('chatInput').value = ''; });
    await page.type('#chatInput', text);
    await page.click('.chat-send');
  };
  // Đợi menu gợi ý mới xuất hiện sau khi gửi (menu cũ bị xoá lúc gửi).
  const waitMenu = (page, ms = 40000) =>
    page.waitForFunction(() => document.querySelectorAll('#chatBody .chat-quick button').length > 0 && !document.querySelector('#chatBody .chat-typing'), { timeout: ms }).then(() => true, () => false);
  const labels = (page) => page.evaluate(() => [...document.querySelectorAll('#chatBody .chat-quick button')].map(b => b.textContent));
  const clickMatch = (page, re) => page.evaluate((src) => {
    const b = [...document.querySelectorAll('#chatBody .chat-quick button')].find(x => new RegExp(src, 'i').test(x.textContent));
    if (b) b.click();
    return !!b;
  }, re.source);
  const hashIs = (page, h, ms = 8000) =>
    page.waitForFunction((x) => location.hash === x, { timeout: ms }, h).then(() => true, () => false);
  const fabVisible = (page) => page.evaluate(() => {
    const el = document.getElementById('chatToggle');
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width > 0 && r.bottom <= innerHeight && r.right <= innerWidth && (top === el || el.contains(top));
  });

  // ---- Desktop, AI thật ----
  let page = await open(1440, 900);
  log('trang chủ: nút chat hiện, bấm được', await fabVisible(page));
  await page.click('#chatToggle');
  await wait(2500);

  await say(page, 'đặt lịch');
  log('gửi "đặt lịch": có menu gợi ý', await waitMenu(page));
  await wait(2500);
  log('KHÔNG tự chuyển trang, vẫn ở trang chủ', await page.evaluate(() => location.hash === '' || location.hash === '#/'));
  const l1 = await labels(page);
  log('menu có đúng 3 gợi ý, trong đó có nút Đặt lịch', l1.length === 3 && l1.some(t => /đặt lịch/i.test(t)), JSON.stringify(l1));
  await page.screenshot({ path: 'chat-menu-datlich.png' });
  await clickMatch(page, /đặt lịch/);
  log('bấm nút Đặt lịch -> nhảy sang #/dat-lich', await hashIs(page, '#/dat-lich'));
  log('view Đặt lịch đang hiện', await page.evaluate(() => !document.getElementById('view-dat-lich').hidden));
  log('đặt lịch: nút chat vẫn hiện, khung chat vẫn mở (desktop)', (await fabVisible(page)) && await page.evaluate(() => document.getElementById('chatPanel').classList.contains('open')));

  await wait(5000);
  await say(page, 'cho mình xem ảnh của tôi để chọn ảnh chỉnh sửa');
  await waitMenu(page);
  await wait(2500);
  log('gửi ý "ảnh của tôi": không tự chuyển, vẫn ở #/dat-lich', await page.evaluate(() => location.hash === '#/dat-lich'));
  log('menu có nút Ảnh của tôi', (await labels(page)).some(t => /ảnh của tôi|chọn ảnh/i.test(t)), JSON.stringify(await labels(page)));
  await clickMatch(page, /ảnh của tôi|chọn ảnh/);
  log('bấm nút -> nhảy sang #/chon-anh', await hashIs(page, '#/chon-anh'));
  log('ảnh của tôi: nút chat vẫn hiện', await fabVisible(page));

  await wait(5000);
  await say(page, 'cho mình xem album ảnh đẹp');
  await waitMenu(page);
  await wait(2500);
  await clickMatch(page, /album/);
  log('bấm nút Album -> về trang chủ', await hashIs(page, '#/'));
  await wait(2500);
  log('đã cuộn tới mục Album', await page.evaluate(() => {
    const r = document.getElementById('album').getBoundingClientRect();
    return r.top < innerHeight && r.bottom > 0 && !document.getElementById('view-home').hidden;
  }));
  await page.close();

  // ---- Mobile: bấm gợi ý -> chuyển trang, khung chat tự đóng, nút chat vẫn hiện ----
  page = await open(390, 844);
  await page.click('#chatToggle');
  await wait(2500);
  await say(page, 'đặt lịch');
  await waitMenu(page);
  await wait(2500);
  await clickMatch(page, /đặt lịch/);
  log('mobile: bấm nút -> nhảy sang #/dat-lich', await hashIs(page, '#/dat-lich'));
  await wait(1500);
  log('mobile: khung chat tự đóng để thấy trang đặt lịch', await page.evaluate(() => !document.getElementById('chatPanel').classList.contains('open')));
  log('mobile đặt lịch: nút chat vẫn hiện, không bị che', await fabVisible(page));
  await page.evaluate(() => { location.hash = '/chon-anh'; });
  await wait(600);
  log('mobile ảnh của tôi: nút chat vẫn hiện', await fabVisible(page));
  await page.close();

  // ---- AI lỗi (chặn request tới server): menu dự phòng vẫn dẫn được ----
  page = await open(1440, 900, true);
  await page.click('#chatToggle');
  await wait(2500);
  await say(page, 'đặt lịch giúp mình');
  await waitMenu(page, 8000);
  await wait(1200);
  const l2 = await labels(page);
  log('AI lỗi: không tự chuyển trang', await page.evaluate(() => location.hash === '' || location.hash === '#/'));
  log('AI lỗi: nút Đặt lịch đứng đầu menu', /đặt lịch/i.test(l2[0] || ''), JSON.stringify(l2));
  await clickMatch(page, /đặt lịch/);
  log('AI lỗi: bấm nút -> nhảy sang #/dat-lich', await hashIs(page, '#/dat-lich'));
  await page.close();

  await browser.close();
  console.log('\n' + (results.every(Boolean) ? 'TẤT CẢ PASS' : 'CÓ FAIL'));
  process.exit(results.every(Boolean) ? 0 : 1);
})();
