// Màn làm việc Thợ ảnh "Khách của tôi" (crm/js/tho-workspace.js, 31/10/2026): menu 3 mục 1 lúc 1 mục,
// danh sách khách → khung chi tiết 3 tab (Ảnh gốc / Ảnh cần chỉnh / Chat), Thu nhập tách màu.
// Tự bật máy chủ RAM cổng 3001 (tắt npm start trước). Chụp 1440 + 390 vào _screenshots/tho-ws-*.png.
//   node _screenshots/test-tho-workspace.js
const path = require('path');
const puppeteer = require('puppeteer-core');
const fx = require('./workflow-fixture');
const { CHROME_PATH, ROOT_URL } = require('./test-env');
const API = 'http://localhost:3001';
let pass = 0, fail = 0;
const check = (name, ok, extra) => { if (ok) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra === undefined ? '' : '→ ' + JSON.stringify(extra)); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (page, name) => page.screenshot({ path: path.join(__dirname, 'tho-ws-' + name + '.png') });

(async () => {
  const timer = setTimeout(() => { console.log('TIMEOUT'); process.exit(2); }, 150000);
  const srv = await fx.fixtureServer();
  let browser;
  try {
    // Khách thường (khách demo bị xoá yêu cầu mỗi lần đăng nhập) có ảnh gốc + đã gửi 2 ảnh cần chỉnh + 1 tin nhắn
    const cust = (await fx.json(API, '/api/sale-chat/auth/register', null, { phone: '0933333333', name: 'Chị Lan TEST', password: 'matkhau123' })).data.token;
    const album = await fx.sourceAlbum(API, { customer: cust, code: 'WSTEST01' });
    const body = fx.requestFrom(album, { note: 'Giữ tông ấm', extraCount: 0, extraFee: 0, photos: [{ note: 'Xoá vết đỏ', editOptions: ['Chỉnh da'] }, { note: '', editOptions: ['Chỉnh màu'] }] });
    const created = await fx.json(API, '/api/edit-requests/', cust, body);
    check('Có yêu cầu thử', created.status === 201, created);
    await fx.json(API, '/api/edit-requests/' + created.data.request.id + '/messages', cust, { text: 'Anh ơi bao giờ xong ạ?' });
    // Khách thứ 2 mới đặt lịch, chưa chụp (để có mục "Chờ")
    const sale = await fx.login(API, '0900000002', 'sale123');
    await fx.json(API, '/api/workflow/commands', sale, { command: 'book', data: { id: 'ws-order-2', code: 'WSTEST02', phone: '0944444444', customerName: 'Anh Minh TEST', service: 'Gia đình', pkg: 'Cơ bản', price: 1500000, date: '2030-03-03', time: '10:00', shooterPhone: '0900000003', editorPhone: '0900000003' } });
    await fx.json(API, '/api/workflow/commands', sale, { command: 'payment', data: { id: 'ws-order-2', amount: 750000, reference: 'ws-coc-2' } });

    browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.evaluateOnNewDocument(() => { window.ALOHA_FEATURES = { booking: true, aiChat: true, albumPages: true, editSync: true }; });
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(ROOT_URL + 'login.html', { waitUntil: 'networkidle0' });
    await page.type('#loginPhone', '0900000003'); await page.type('#loginPassword', 'anh123');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('#loginSubmitBtn')]);
    await page.goto(ROOT_URL + 'crm/admin.html?editSync=1', { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.querySelectorAll('.tho-cust').length >= 1, { timeout: 15000 });
    await wait(800);

    const menu = await page.$$eval('#adminTabs a', (as) => as.map((a) => a.textContent.trim().replace(/\s+/g, ' ')));
    check('Menu thợ 3 mục: Khách của tôi · Thu nhập · Đã hoàn tất', /^Khách của tôi/.test(menu[0]) && /^Thu nhập/.test(menu[1]) && /^Đã hoàn tất/.test(menu[2]) && menu.length === 3, menu);
    const visible = await page.$$eval('.admin-section', (ss) => ss.filter((s) => !s.hidden && s.offsetParent !== null).map((s) => s.id));
    check('Chỉ hiện 1 mục: Khách của tôi', visible.length === 1 && visible[0] === 'khach-cua-toi', visible);
    const cards = await page.$$eval('.tho-cust', (cs) => cs.map((c) => c.textContent.replace(/\s+/g, ' ').trim()));
    check('Mục "Cần làm": khách có ảnh cần chỉnh + tin chờ trả lời đứng đầu', /Chị Lan TEST/.test(cards[0]) && /Cần chỉnh 2 ảnh/.test(cards[0]) && /💬 1/.test(cards[0]), cards);
    await shot(page, '1440-list');

    await page.click('.tho-cust[data-key]');
    await page.waitForFunction(() => !document.querySelector('.tho-detail').hidden, { timeout: 5000 });
    await wait(800);
    let tab = await page.$eval('.tho-detail', (d) => d.dataset.tab);
    check('Khách có tin chờ trả lời → mở thẳng tab Chat', tab === 'chat', tab);
    check('Tab Chat: thấy tin khách, không thấy lưới ảnh', await page.evaluate(() => /bao giờ xong/.test(document.getElementById('kanbanChatList').textContent) && !document.querySelector('.kanban-photo-grid').offsetParent));
    await shot(page, '1440-chat');
    await page.type('#kanbanChatInput', 'Chiều mai xong nhé chị');
    await page.click('#kanbanChatForm button[type=submit]');
    await page.waitForFunction(() => /Chiều mai xong/.test(document.getElementById('kanbanChatList').textContent), { timeout: 8000 });
    check('Trả lời khách trong tab Chat', true);

    await page.click('[data-t="chinh"]'); await wait(500);
    check('Tab Ảnh cần chỉnh: lưới 2 ảnh, ghi chú, không thấy chat', await page.evaluate(() => document.querySelectorAll('.kanban-photo-grid .kanban-photo-tile').length === 2 && !document.querySelector('.kanban-chat-block').offsetParent && /Xoá vết đỏ/.test(document.querySelector('.tho-req-host').textContent)));
    await shot(page, '1440-chinh');

    await page.click('[data-t="goc"]'); await wait(500);
    const goc = await page.$eval('[data-pane="goc"]', (p) => p.textContent.replace(/\s+/g, ' '));
    check('Tab Ảnh gốc: trạng thái + ô gửi thêm ảnh + bộ đã gửi', /Gửi thêm ảnh gốc/.test(goc) && /24 ảnh gốc/.test(goc), goc.slice(0, 200));
    check('Ô kéo thả ảnh gốc có sẵn', await page.$('[data-pane="goc"] .drive-upload input[type=file]') !== null);
    await shot(page, '1440-goc');

    await page.click('.tho-ws-filter [data-f="wait"]'); await wait(300);
    const waitCards = await page.$$eval('.tho-cust', (cs) => cs.map((c) => c.textContent.replace(/\s+/g, ' ')));
    check('Lọc "Chờ khách": không có khách đang cần làm', !waitCards.some((t) => /Chị Lan/.test(t)), waitCards);
    await page.click('.tho-ws-filter [data-f="all"]'); await wait(300);
    check('Lọc "Tất cả": thấy khách mới cọc chờ chụp', (await page.$$eval('.tho-cust', (cs) => cs.map((c) => c.textContent).join('|'))).includes('Anh Minh TEST'));
    await page.evaluate(() => [...document.querySelectorAll('.tho-cust')].find((c) => /Anh Minh/.test(c.textContent)).click()); await wait(500);
    check('Khách chưa gửi ảnh chỉnh → mở tab Ảnh gốc, Chat báo chưa có', await page.$eval('.tho-detail', (d) => d.dataset.tab) === 'goc');
    await page.click('[data-t="chat"]'); await wait(300);
    check('Chat khi chưa có yêu cầu: lời nhắc rõ ràng', /chưa gửi ảnh cần chỉnh/.test(await page.$eval('[data-pane="req"] .tho-empty', (e) => e.textContent)));

    await page.click('#adminTabs a[href="#quy-trinh"]'); await wait(600);
    const inc = await page.evaluate(() => ({ vis: [...document.querySelectorAll('.admin-section')].filter((s) => !s.hidden && s.offsetParent).map((s) => s.id), h: document.querySelector('#quy-trinh h2')?.textContent, kpi: [...document.querySelectorAll('#quy-trinh .wf-kpis article')].map((a) => a.className + ':' + getComputedStyle(a).backgroundColor), tabs: getComputedStyle(document.querySelector('#quy-trinh .wf-tabs')).display }));
    check('Thu nhập: mục riêng, tiêu đề "Thu nhập", ẩn tab Việc của tôi', inc.vis.length === 1 && inc.vis[0] === 'quy-trinh' && inc.h === 'Thu nhập' && inc.tabs === 'none', inc);
    check('Thu nhập: 3 ô màu khác nhau (dự kiến / đã chốt / đã nhận)', new Set(inc.kpi.map((k) => k.split(':')[1])).size === 3, inc.kpi);
    await shot(page, '1440-thunhap');

    // Điện thoại
    await page.setViewport({ width: 390, height: 844 });
    await page.evaluate(() => document.querySelector('#adminTabs a[href="#khach-cua-toi"]').click()); await wait(500);
    await page.evaluate(() => document.querySelector('.tho-detail-back').click()); await wait(300);
    await wait(400);
    await shot(page, '390-list');
    await page.evaluate(() => document.querySelector('.tho-cust').click()); await wait(800);
    const m = await page.evaluate(() => { const d = document.querySelector('.tho-detail').getBoundingClientRect(); return { full: d.width >= 389 && d.top <= 1, over: document.documentElement.scrollWidth > innerWidth, back: document.querySelector('.tho-detail-back').getBoundingClientRect().height }; });
    check('390: chi tiết phủ kín màn, có nút quay lại ≥44px, không cuộn ngang', m.full && !m.over && m.back >= 44, m);
    await shot(page, '390-detail');
    await page.click('[data-t="chinh"]'); await wait(400); await shot(page, '390-chinh');
    await page.click('.tho-detail-back'); await wait(300);
    check('390: quay lại danh sách', await page.$eval('.tho-detail', (d) => d.hidden));
    check('Không lỗi JS', errors.length === 0, errors);
  } catch (e) { fail++; console.log('✗ Lỗi khi chạy:', e.message, (e.stack || '').split('\n').find((l) => l.includes('test-tho-workspace'))); }
  finally { if (browser) await browser.close().catch(() => {}); srv.close(); clearTimeout(timer); }
  console.log(`\n${pass}/${pass + fail} PASS tho workspace`);
  process.exit(fail ? 1 : 0);
})();
