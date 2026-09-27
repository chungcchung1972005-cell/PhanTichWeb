// Test tab "Ảnh đã chỉnh" (khách) + ô gửi link ảnh đã chỉnh & chat trong modal kanban (Thợ ảnh/Sếp).
// Khách và Thợ ảnh mở 2 trang trong CÙNG trình duyệt (dữ liệu demo nằm trong localStorage).
//   node _screenshots/test-edited-photos.js
const puppeteer = require('puppeteer-core');
const path = require('path');
const { CHROME_PATH, ROOT_URL } = require('./test-env');

let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '→ ' + extra : ''); }
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const LINK = 'https://drive.google.com/drive/folders/1AbCdEfGhIjK_test';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  let dialogs = 0;
  const aiCalls = [];
  // Trợ lý AI giả lập (không gọi Gemini thật, không tốn hạn mức): câu có "chỉnh"/"làm" thì
  // ghi nhận + chuyển thợ (forward), câu khác trả lời luôn. mode 'down' = server AI không phản hồi.
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
  async function mockAi(page, mode = 'ok') {
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      if (!r.url().includes('/api/edit-chat')) return r.continue();
      if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: CORS });
      if (mode === 'down') return r.abort();
      const body = JSON.parse(r.postData() || '{}');
      aiCalls.push(body);
      const last = (body.messages || []).slice(-1)[0] || {};
      const forward = /chỉnh|làm/i.test(last.content || '');
      setTimeout(() => r.respond({ status: 200, headers: { ...CORS, 'content-type': 'application/json' },
        body: JSON.stringify({ reply: forward ? 'Mình ghi lại yêu cầu làm sáng da cho bé rồi nhé, xong mình báo bạn.' : 'Dạ mình đây, bạn cần hỗ trợ gì cứ nhắn nhé.', forward }) }), 400);
    });
  }

  async function login(phone, pass, width = 1440) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900 });
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', async d => { dialogs++; await d.dismiss(); });
    await page.goto(ROOT_URL + 'login.html', { waitUntil: 'networkidle0' });
    await page.type('#loginPhone', phone);
    await page.type('#loginPassword', pass);
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('#loginSubmitBtn')]);
    await wait(600);
    return page;
  }

  // Xoá dữ liệu cũ
  const boot = await browser.newPage();
  await boot.goto(ROOT_URL + 'login.html', { waitUntil: 'networkidle0' });
  await boot.evaluate(() => localStorage.clear());
  await boot.close();

  // ---------- Khách: chưa gửi yêu cầu
  const cust = await login('0900000001', 'khach123');
  await mockAi(cust);
  if (!cust.url().includes('#/chon-anh')) { await cust.goto(cust.url().split('#')[0] + '#/chon-anh'); await wait(500); }
  const tabNames = await cust.$$eval('.ps-tab', els => els.map(e => e.textContent.trim()));
  check('Có tab "Ảnh đã chỉnh" ngay cạnh "Yêu thích"', tabNames.join('|').includes('Yêu thích|Ảnh đã chỉnh'), tabNames.join('|'));
  await cust.click('.ps-tab[data-filter="edited"]'); await wait(300);
  let v = await cust.evaluate(() => ({
    panel: !document.getElementById('psEditedPanel').hidden,
    grid: getComputedStyle(document.getElementById('psGrid')).display,
    submit: getComputedStyle(document.querySelector('.ps-submit-bar')).display,
    body: document.getElementById('psResultBody').textContent.trim(),
    chatDisabled: document.getElementById('psChatInput').disabled
  }));
  check('Mở tab: hiện ô link + chat, ẩn lưới ảnh và nút gửi yêu cầu', v.panel && v.grid === 'none' && v.submit === 'none', JSON.stringify(v));
  check('Chưa gửi yêu cầu: báo chưa có ảnh đã chỉnh, khoá ô chat', v.body.includes('chưa gửi yêu cầu') && v.chatDisabled, JSON.stringify(v));

  // ---------- Khách gửi yêu cầu rồi nhắn thợ
  await cust.click('.ps-tab[data-filter="all"]'); await wait(200);
  await cust.evaluate(() => ['ph-1', 'ph-2'].forEach(i => document.querySelector(`.ps-photo[data-id="${i}"] .ps-heart`).click()));
  await cust.evaluate(() => document.getElementById('psSubmitBtn').click()); await wait(400);
  await cust.click('.ps-tab[data-filter="edited"]'); await wait(300);
  v = await cust.evaluate(() => ({ body: document.getElementById('psResultBody').textContent.trim(), meta: document.getElementById('psResultMeta').textContent, chatDisabled: document.getElementById('psChatInput').disabled }));
  check('Đã gửi yêu cầu: báo thợ đang chỉnh, hiện mã đơn, mở ô chat', v.body.includes('Link ảnh đã chỉnh sẽ hiện ở đây') && v.meta.includes('#AB240915') && !v.chatDisabled, JSON.stringify(v));
  await cust.type('#psChatInput', 'Chào thợ, làm da bé sáng tự nhiên giúp em nhé');
  await cust.keyboard.press('Enter');
  await wait(150);
  v = await cust.evaluate(() => { const t = document.querySelector('#psChatList .is-typing'); return t ? t.textContent.replace(/\s+/g, ' ').trim() : null; });
  check('Đang chờ trả lời: hiện "Thợ chỉnh ảnh ALOHA" đang gõ, không nhắc AI', !!v && v.includes('Thợ chỉnh ảnh ALOHA') && !/\bAI\b/.test(v), v);
  await cust.waitForFunction(() => document.querySelectorAll('#psChatList .ps-msg.from-staff:not(.is-typing)').length === 1, { timeout: 8000 }).catch(() => {});
  await cust.type('#psChatInput', '<img src=x onerror=alert(1)>');
  await cust.click('#psChatSend');
  await cust.waitForFunction(() => document.querySelectorAll('#psChatList .ps-msg.from-staff:not(.is-typing)').length === 2, { timeout: 8000 }).catch(() => {});
  v = await cust.evaluate(() => ({
    mine: [...document.querySelectorAll('#psChatList .ps-msg.from-me p')].map(p => p.textContent),
    injected: document.querySelectorAll('#psChatList img').length,
    input: document.getElementById('psChatInput').value
  }));
  check('Khách gửi tin (Enter và nút gửi) -> hiện bong bóng bên phải, ô nhập được xoá', v.mine.length === 2 && v.mine[0].includes('làm da bé sáng') && v.input === '', JSON.stringify(v));
  check('Tin nhắn có mã HTML được hiện dạng chữ, không chạy mã', v.injected === 0 && v.mine[1] === '<img src=x onerror=alert(1)>', JSON.stringify(v));
  v = await cust.evaluate(() => ({
    replies: [...document.querySelectorAll('#psChatList .ps-msg.from-staff:not(.is-typing)')].map(b => ({ name: (b.querySelector('.ps-msg-name') || {}).textContent, text: b.querySelector('p').textContent })),
    card: document.querySelector('.ps-chat-card').textContent,
    title: document.querySelector('.ps-chat-head h3').textContent
  }));
  check('Tiêu đề "Chat với thợ chỉnh ảnh"; tin trả lời ngay mang tên "Thợ chỉnh ảnh ALOHA"', v.title === 'Chat với thợ chỉnh ảnh' && v.replies.length === 2 && v.replies.every(r => r.name === 'Thợ chỉnh ảnh ALOHA') && v.replies[0].text.includes('ghi lại yêu cầu'), JSON.stringify(v));
  check('Khung chat phía khách không có chữ "AI" / "trợ lý"', !/\bAI\b|trợ lý/i.test(v.card), v.card.slice(0, 200));
  v = await cust.evaluate(() => { const r = JSON.parse(localStorage.getItem('aloha_demo_db')).editRequests.slice(-1)[0]; return r.messages.filter(m => m.from === 'customer').map(m => m.needsStaff); });
  check('Yêu cầu chỉnh sửa cụ thể -> đánh dấu cần thợ; câu thường thì không', v[0] === true && v[1] === false, JSON.stringify(v));
  const ctx0 = (aiCalls[0] || {}).context || {};
  check('AI nhận đúng thông tin đơn (mã đơn, trạng thái, chưa có link)', ctx0.orderCode === '#AB240915' && ctx0.status === 'Chờ xử lý' && ctx0.hasLink === false && ctx0.photoCount === 2, JSON.stringify(ctx0));
  await cust.screenshot({ path: path.resolve(__dirname, 'edited-customer-waiting.png'), fullPage: false });

  // ---------- Thợ ảnh (cùng trình duyệt)
  const staff = await login('0900000003', 'anh123');
  const flags = await staff.evaluate(() => [...document.querySelectorAll('.kanban-card')].filter(c => c.textContent.includes('Mới')).map(c => c.textContent.replace(/\s+/g, ' ')));
  check('Thẻ kanban nhắc "Khách cần thợ trả lời"', flags.length === 1 && flags[0].includes('Khách cần thợ trả lời'), flags.join(' || '));
  await staff.evaluate(() => [...document.querySelectorAll('.kanban-card')].find(c => c.textContent.includes('Mới')).click());
  await wait(400);
  v = await staff.evaluate(() => ({
    section: !!document.querySelector('#kanbanModalBody .kanban-result'),
    msgs: [...document.querySelectorAll('#kanbanChatList .kanban-msg.from-customer p')].map(p => p.textContent),
    ai: document.querySelectorAll('#kanbanChatList .kanban-msg.from-ai').length,
    tags: document.querySelectorAll('#kanbanChatList .kanban-msg-tag').length,
    injected: document.querySelectorAll('#kanbanChatList img').length,
    form: !!document.getElementById('kanbanResultForm'), reply: !!document.getElementById('kanbanChatForm')
  }));
  await staff.waitForFunction(() => [...document.querySelectorAll('#kanbanModalBody .kanban-photo-tile img')].every(i => i.complete), { timeout: 15000 }).catch(() => {});
  const imgs = await staff.evaluate(() => [...document.querySelectorAll('#kanbanModalBody .kanban-photo-tile img')].map(i => i.naturalWidth > 0));
  check('Modal thợ: ảnh khách chọn (Google Photos) tải được', imgs.length === 2 && imgs.every(Boolean), JSON.stringify(imgs));
  check('Modal thợ: có ô gửi link + khung chat, thấy đủ tin của khách (dạng chữ)', v.section && v.form && v.reply && v.msgs.length === 2 && v.injected === 0, JSON.stringify(v));
  check('Thợ thấy cả câu trả lời của Trợ lý AI + nhãn "Cần thợ trả lời" đúng tin cần xử lý', v.ai === 2 && v.tags === 1, JSON.stringify(v));
  // Chờ xử lý -> Đang thực hiện, đánh dấu xong hết ảnh: chưa gửi link thì vẫn chưa được Hoàn thành
  await staff.evaluate(() => document.querySelector('#kanbanModalBody .kanban-modal-advance').click()); await wait(300);
  await staff.evaluate(() => [...document.querySelectorAll('.kanban-card')].find(c => c.textContent.includes('Mới')).click()); await wait(300);
  await staff.evaluate(() => document.querySelectorAll('#kanbanModalBody .photo-done-toggle')[0].click()); await wait(200);
  await staff.evaluate(() => document.querySelectorAll('#kanbanModalBody .photo-done-toggle')[1].click()); await wait(200);
  v = await staff.evaluate(() => ({
    status: document.querySelector('#kanbanModalBody .badge').textContent,
    disabled: document.querySelector('#kanbanModalBody .kanban-modal-advance').disabled,
    hint: (document.querySelector('#kanbanModalBody .kanban-advance-hint') || {}).textContent || ''
  }));
  check('Xong hết ảnh nhưng chưa gửi link -> chưa được chuyển "Hoàn thành", báo rõ lý do', v.status === 'Đang thực hiện' && v.disabled && v.hint.includes('gửi link'), JSON.stringify(v));
  await staff.type('#kanbanResultInput', 'javascript:alert(1)');
  await staff.evaluate(() => document.getElementById('kanbanResultForm').requestSubmit()); await wait(200);
  v = await staff.evaluate(() => ({ err: !document.getElementById('kanbanResultError').hidden, saved: (JSON.parse(localStorage.getItem('aloha_demo_db')).editRequests.slice(-1)[0].resultLink) }));
  check('Link không phải http(s) (vd javascript:) bị chặn, báo lỗi', v.err && v.saved === '', JSON.stringify(v));
  await staff.evaluate(() => { document.getElementById('kanbanResultInput').value = ''; });
  await staff.type('#kanbanResultInput', LINK);
  await staff.evaluate(() => document.getElementById('kanbanResultForm').requestSubmit()); await wait(300);
  v = await staff.evaluate(() => ({ current: document.getElementById('kanbanResultCurrent').textContent, href: (document.getElementById('kanbanResultAnchor') || {}).href }));
  check('Gửi link Drive hợp lệ -> lưu, modal hiện "Khách đang thấy: <link>"', v.current.includes('Khách đang thấy') && v.href === LINK, JSON.stringify(v));
  v = await staff.evaluate(() => !document.querySelector('#kanbanModalBody .kanban-modal-advance').disabled);
  check('Gửi link xong -> nút chuyển sang "Hoàn thành" mở khoá', v);
  await staff.type('#kanbanChatInput', 'Dạ em gửi link ảnh đã chỉnh rồi ạ, chị xem giúp em nhé');
  await staff.keyboard.press('Enter'); await wait(300);
  v = await staff.evaluate(() => [...document.querySelectorAll('#kanbanChatList .kanban-msg.from-staff p')].map(p => p.textContent));
  check('Thợ trả lời khách (Enter) -> hiện bong bóng của thợ', v.length === 1 && v[0].includes('gửi link ảnh'), JSON.stringify(v));
  await staff.screenshot({ path: path.resolve(__dirname, 'edited-staff-modal.png') });
  // Khách nhắn thêm trong lúc modal thợ đang mở -> khung chat tự làm mới
  await cust.bringToFront();
  await cust.type('#psChatInput', 'Em cảm ơn ạ');
  await cust.keyboard.press('Enter'); await wait(300);
  await staff.bringToFront();
  await staff.waitForFunction(() => document.querySelectorAll('#kanbanChatList .kanban-msg').length === 7, { timeout: 8000 }).catch(() => {});
  v = await staff.evaluate(() => document.querySelectorAll('#kanbanChatList .kanban-msg').length);
  check('Modal thợ đang mở tự hiện tin khách vừa nhắn + AI trả lời (không cần tải lại)', v === 7, v);

  // ---------- Khách thấy link + tin trả lời mà không tải lại trang
  await cust.bringToFront();
  await cust.waitForFunction(() => !!document.getElementById('psResultLink'), { timeout: 8000 }).catch(() => {});
  v = await cust.evaluate(() => {
    const a = document.getElementById('psResultLink');
    return {
      href: a && a.href, target: a && a.target, rel: a && a.rel,
      url: (document.getElementById('psResultUrl') || {}).textContent,
      staff: [...document.querySelectorAll('#psChatList .ps-msg.from-staff p')].map(p => p.textContent).filter(s => s.includes('gửi link ảnh'))
    };
  });
  check('Khách thấy nút mở link ảnh đã chỉnh (mở tab mới, an toàn)', v.href === LINK && v.target === '_blank' && /noopener/.test(v.rel) && v.url === LINK, JSON.stringify(v));
  check('Khách thấy tin trả lời của thợ', v.staff.length === 1 && v.staff[0].includes('gửi link ảnh'), JSON.stringify(v));
  await cust.screenshot({ path: path.resolve(__dirname, 'edited-customer-link.png') });

  // ---------- Chấm báo tin mới trên tab khi khách đang ở tab khác
  await cust.click('.ps-tab[data-filter="all"]'); await wait(200);
  await staff.bringToFront();
  await staff.type('#kanbanChatInput', 'Nếu cần chỉnh thêm chị cứ nhắn em nhé');
  await staff.keyboard.press('Enter'); await wait(300);
  await cust.bringToFront();
  await cust.waitForFunction(() => !!document.querySelector('.ps-tab[data-filter="edited"] .ps-tab-dot'), { timeout: 8000 }).catch(() => {});
  let dot = await cust.evaluate(() => !!document.querySelector('.ps-tab[data-filter="edited"] .ps-tab-dot'));
  check('Thợ nhắn khi khách ở tab khác -> tab "Ảnh đã chỉnh" hiện chấm báo', dot);
  await cust.click('.ps-tab[data-filter="edited"]'); await wait(300);
  dot = await cust.evaluate(() => !!document.querySelector('.ps-tab[data-filter="edited"] .ps-tab-dot'));
  check('Mở tab xem -> tắt chấm báo', !dot);
  await cust.reload({ waitUntil: 'networkidle0' }); await wait(500);
  dot = await cust.evaluate(() => !!document.querySelector('.ps-tab[data-filter="edited"] .ps-tab-dot'));
  check('Tải lại trang: đã xem rồi thì không hiện lại chấm báo', !dot);

  // ---------- Sếp: chỉ xem
  const boss = await login('0900000004', 'sep123');
  await boss.evaluate(() => [...document.querySelectorAll('.kanban-card')].find(c => c.textContent.includes('Mới')).click());
  await wait(400);
  v = await boss.evaluate(() => ({
    form: !!document.getElementById('kanbanResultForm'), reply: !!document.getElementById('kanbanChatForm'),
    msgs: document.querySelectorAll('#kanbanChatList .kanban-msg').length, href: (document.getElementById('kanbanResultAnchor') || {}).href
  }));
  check('Sếp xem được link + toàn bộ tin nhắn, không có ô gửi link/trả lời', !v.form && !v.reply && v.msgs === 8 && v.href === LINK, JSON.stringify(v));
  await boss.evaluate(() => [...document.querySelectorAll('.kanban-card')].find(c => !c.textContent.includes('Mới')).click());
  await wait(300);
  v = await boss.evaluate(() => document.querySelector('#kanbanModalBody .kanban-result').textContent);
  check('Thẻ minh hoạ (không phải khách thật) -> chỉ ghi chú, không có ô link/chat', v.includes('Thẻ minh hoạ'), v);

  // ---------- Chống chèn mã: tên/ghi chú khách chứa HTML không được chạy trên trang Thợ ảnh/Sếp
  await boss.evaluate(() => AlohaData.createEditRequest({
    phone: '0900000099', customerName: '<img src=x id=xssName onerror=alert(2)>', orderCode: '#XSS01', serviceLabel: 'Newborn',
    photoCount: 1, note: '<img src=x id=xssNote onerror=alert(3)>',
    photos: [{ id: 'ph-1', src: 'images/my-photos/photo-1.jpg', note: '<img src=x id=xssPhoto onerror=alert(4)>' }]
  }));
  await boss.reload({ waitUntil: 'networkidle0' }); await wait(500);
  await boss.evaluate(() => [...document.querySelectorAll('.kanban-card')].find(c => c.textContent.includes('#XSS01')).click());
  await wait(400);
  v = await boss.evaluate(() => ({
    injected: document.querySelectorAll('#xssName, #xssNote, #xssPhoto').length,
    shown: document.getElementById('kanbanModalBody').textContent.includes('<img src=x id=xssNote')
  }));
  check('Tên/ghi chú khách chứa mã HTML hiện dạng chữ trên thẻ + modal, không chạy mã', v.injected === 0 && v.shown, JSON.stringify(v));
  v = await boss.evaluate(() => {
    const r = AlohaData.createEditRequest({ phone: '0900000098', customerName: 'Kiểm tra', orderCode: '#GATE01', photos: [] });
    AlohaData.advanceRequestStatus(r.id); AlohaData.advanceRequestStatus(r.id);
    return AlohaData.getEditRequests().find(x => x.id === r.id).status;
  });
  check('Dữ liệu: yêu cầu chưa có link không chuyển được sang "Hoàn thành"', v === 'Đang thực hiện', v);

  // ---------- Điện thoại
  // (Đăng nhập Sếp ở trên đã thay phiên đăng nhập chung của trình duyệt -> đăng nhập lại khách)
  const mob = await login('0900000001', 'khach123', 390);
  if (!mob.url().includes('#/chon-anh')) { await mob.goto(mob.url().split('#')[0] + '#/chon-anh'); await wait(500); }
  await mob.evaluate(() => document.querySelector('.ps-tab[data-filter="edited"]').click()); await wait(400);
  await mob.evaluate(() => document.getElementById('psEditedPanel').scrollIntoView({ block: 'start', behavior: 'instant' }));
  await wait(300);
  v = await mob.evaluate(() => ({ hScroll: document.documentElement.scrollWidth > window.innerWidth, panelW: Math.round(document.getElementById('psEditedPanel').getBoundingClientRect().width) }));
  check('Điện thoại: ô link + chat không tràn ngang', !v.hScroll, JSON.stringify(v));
  await mob.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' })); await wait(400);
  const floatInEdited = await mob.evaluate(() => document.getElementById('psSummaryCard').classList.contains('is-floating'));
  check('Tab Ảnh đã chỉnh: ô Đã chọn không nổi che khung link', !floatInEdited);
  // Trợ lý tự động không phản hồi -> chỉ báo đã nhận tin (không nhắc AI, không bịa câu trả lời), tin chuyển cho thợ
  await mockAi(mob, 'down');
  await mob.type('#psChatInput', 'Cho mình hỏi chút');
  await mob.keyboard.press('Enter');
  await mob.waitForFunction(() => [...document.querySelectorAll('#psChatList .ps-msg.from-staff p')].some(p => p.textContent.includes('đã nhận được tin nhắn')), { timeout: 8000 }).catch(() => {});
  v = await mob.evaluate(() => {
    const r = JSON.parse(localStorage.getItem('aloha_demo_db')).editRequests.find(x => x.phone === '0900000001' && x.messages && x.messages.some(m => m.text === 'Cho mình hỏi chút'));
    const last = r && r.messages.filter(m => m.from === 'customer').slice(-1)[0];
    return {
      ack: [...document.querySelectorAll('#psChatList .ps-msg.from-staff p')].some(p => p.textContent.includes('Thợ chỉnh ảnh sẽ xem kỹ')),
      noAi: !/\bAI\b|trợ lý|đang bận/i.test(document.querySelector('.ps-chat-card').textContent),
      needsStaff: last && last.needsStaff, inputOn: !document.getElementById('psChatInput').disabled
    };
  });
  check('Không kết nối được trợ lý -> báo đã nhận tin (không nhắc AI), tin chuyển cho thợ, ô chat mở lại', v.ack && v.noAi && v.needsStaff === true && v.inputOn, JSON.stringify(v));
  await mob.screenshot({ path: path.resolve(__dirname, 'edited-customer-390-ai.png') });
  await mob.screenshot({ path: path.resolve(__dirname, 'edited-customer-390.png') });

  check('Không có lỗi JS, không bật hộp thoại do mã chèn', errors.length === 0 && dialogs === 0, errors.join(' | ') + ' dialogs=' + dialogs);
  await browser.close();
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
