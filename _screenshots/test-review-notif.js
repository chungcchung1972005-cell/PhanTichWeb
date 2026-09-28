// Test "Xem lại trước khi gửi cho thợ" (Ảnh của tôi) + chuông thông báo khi Thợ ảnh gửi link
// ảnh đã chỉnh / trả lời chat. Không cần server (chặn mọi request tới :3001).
//   node _screenshots/test-review-notif.js
const puppeteer = require('puppeteer-core');
const path = require('path');
const { CHROME_PATH, ROOT_URL } = require('./test-env');

let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '→ ' + extra : ''); }
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const LINK = 'https://drive.google.com/drive/folders/1Review_notif_test';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  let dialogs = 0;
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => { dialogs++; d.dismiss(); });
  await page.setRequestInterception(true);
  page.on('request', r => (r.url().includes(':3001') ? r.abort() : r.continue()));

  await page.goto(ROOT_URL + 'login.html', { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.type('#loginPhone', '0900000001');
  await page.type('#loginPassword', 'khach123');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('#loginSubmitBtn')]);
  if (!page.url().includes('#/chon-anh')) await page.goto(page.url().split('#')[0] + '#/chon-anh');
  await wait(700);

  const reqCount = () => page.evaluate(() => ((JSON.parse(localStorage.getItem('aloha_demo_db')) || {}).editRequests || []).length);
  const shown = (id) => page.$eval(id, el => el.classList.contains('show'));
  const heart = (id) => page.evaluate((i) => document.querySelector(`.ps-photo[data-id="${i}"] .ps-heart`).click(), id);
  const submit = () => page.evaluate(() => document.getElementById('psSubmitBtn').click());

  // ================= (4) Xem lại trước khi gửi =================
  for (const id of ['ph-7', 'ph-1', 'ph-3']) await heart(id);
  await page.evaluate(() => document.querySelector('.ps-photo[data-id="ph-3"] img').click());
  await page.waitForFunction(() => !document.getElementById('psLbNoteWrap').hidden, { timeout: 3000 });
  await wait(300);
  await page.type('#psLbNote', '<b>đậm</b> làm sáng da');
  await page.keyboard.press('Escape'); await wait(300);
  await page.click('.ps-tab[data-filter="liked"]'); await wait(300); // ô ghi chú chung nằm ở tab Yêu thích
  await page.type('#psNote', 'Tông ấm cho cả bộ');

  await page.click('#psSubmitBtn'); await wait(300);
  let v = await page.evaluate(() => {
    const grid = document.getElementById('psReviewGrid');
    return {
      nums: [...grid.querySelectorAll('figcaption')].map(f => f.textContent).join(','),
      sum: document.getElementById('psReviewSum').textContent.replace(/\s+/g, ' '),
      notes: [...grid.querySelectorAll('.ps-review-photo-note')].map(n => n.textContent),
      bold: !!grid.querySelector('b'),
      general: document.getElementById('psReviewNote').textContent,
      confirm: document.getElementById('psReviewConfirm').textContent,
      extras: grid.querySelectorAll('.is-extra').length,
      focus: document.activeElement && document.activeElement.id
    };
  });
  check('Bấm "Gửi yêu cầu" -> mở bước xem lại, CHƯA gửi gì cho thợ', (await shown('#psReviewModal')) && (await reqCount()) === 0);
  check('Xem lại: ảnh xếp theo số #1, #3, #7 (không theo thứ tự bấm chọn)', v.nums === '#1,#3,#7', v.nums);
  check('Xem lại: tóm tắt "3 ảnh · 3 ảnh trong gói", không có phí', v.sum.includes('3 ảnh ·') && v.sum.includes('3 ảnh trong gói') && !v.sum.includes('chọn thêm'), v.sum);
  check('Xem lại: hiện ghi chú riêng ảnh #3 dạng chữ (không chạy HTML)', v.notes.length === 1 && v.notes[0] === '<b>đậm</b> làm sáng da' && !v.bold, JSON.stringify(v.notes));
  check('Xem lại: hiện ghi chú chung', v.general.includes('Tông ấm cho cả bộ'), v.general);
  check('Xem lại: nút chính "Gửi cho thợ", đang được focus', v.confirm === 'Gửi cho thợ' && v.focus === 'psReviewConfirm' && v.extras === 0, JSON.stringify(v));

  await page.click('#psReviewBack'); await wait(250);
  v = await page.evaluate(() => ({
    sel: document.querySelectorAll('.ps-photo.selected').length,
    unlocked: [...document.querySelectorAll('.ps-heart')].every(b => !b.disabled),
    focus: document.activeElement && document.activeElement.id
  }));
  check('"Quay lại chỉnh" -> đóng, chưa gửi, vẫn giữ 3 ảnh và chọn tiếp được', !(await shown('#psReviewModal')) && (await reqCount()) === 0 && v.sel === 3 && v.unlocked && v.focus === 'psSubmitBtn', JSON.stringify(v));
  await submit(); await wait(250);
  await page.keyboard.press('Escape'); await wait(250);
  check('Phím Esc đóng bước xem lại, không gửi', !(await shown('#psReviewModal')) && (await reqCount()) === 0);
  await submit(); await wait(250);
  await page.mouse.click(12, 450); await wait(250);
  check('Bấm vùng tối bên ngoài đóng bước xem lại, không gửi', !(await shown('#psReviewModal')) && (await reqCount()) === 0);

  // Vượt gói: 11 ảnh -> xem lại báo đúng ảnh tính phí, nút chuyển sang thanh toán
  for (const n of [2, 4, 5, 6, 8, 9, 10]) await heart('ph-' + n);
  await heart('ph-11'); await wait(300);
  await page.evaluate(() => document.querySelector('.ps-modal-overlay.show .ps-modal-yes').click()); await wait(300);
  await heart('ph-12'); await heart('ph-2'); await wait(300);
  v = await page.evaluate(() => ({
    extra: [...document.querySelectorAll('.ps-photo.ps-extra-photo')].map(c => c.dataset.id).join(','),
    fee: document.getElementById('psExtra').hidden ? '' : document.getElementById('extraFee').textContent
  }));
  check('Đang có 2 ảnh chọn thêm, bỏ 1 ảnh trong gói -> chỉ còn 1 ảnh viền cam, khớp phí 50.000đ', v.extra === 'ph-11' && v.fee === '50.000đ', JSON.stringify(v));
  await submit(); await wait(300);
  v = await page.evaluate(() => ({
    count: document.querySelectorAll('#psReviewGrid .ps-review-item').length,
    sum: document.getElementById('psReviewSum').textContent.replace(/\s+/g, ' '),
    extra: [...document.querySelectorAll('#psReviewGrid .is-extra figcaption')].map(f => f.textContent).join(','),
    confirm: document.getElementById('psReviewConfirm').textContent,
    pay: document.getElementById('psReviewPay').hidden ? '' : document.getElementById('psReviewPay').textContent.replace(/s+/g, ' ')
  }));
  check('Xem lại 11 ảnh: báo "1 ảnh chọn thêm (50.000đ)", ảnh #11 viền cam', v.count === 11 && v.sum.includes('10 ảnh trong gói') && v.sum.includes('1 ảnh chọn thêm (50.000đ)') && v.extra === '#11', JSON.stringify(v));
  check('Xem lại 11 ảnh: nút chính "Gửi & thanh toán 50.000đ"', v.confirm === 'Gửi & thanh toán 50.000đ', v.confirm);
  check('Xem lại 11 ảnh: báo trước 10 ảnh gói gửi ngay, ảnh chọn thêm phải thanh toán trong 30 phút', v.pay.includes('10 ảnh trong gói được gửi cho thợ ngay') && v.pay.includes('30 phút') && v.pay.includes('không được gửi đi'), v.pay);
  await page.screenshot({ path: path.resolve(__dirname, 'review-modal-desktop.png') });

  await page.setViewport({ width: 390, height: 844 }); await wait(400);
  v = await page.evaluate(() => {
    const m = document.querySelector('#psReviewModal .ps-modal').getBoundingClientRect();
    const b = document.getElementById('psReviewConfirm').getBoundingClientRect();
    return { l: m.left, r: m.right, bottom: m.bottom, btn: b.bottom, vw: innerWidth, vh: innerHeight, hScroll: document.documentElement.scrollWidth > innerWidth };
  });
  check('Điện thoại: hộp xem lại nằm gọn trong màn hình, thấy nút gửi không cần cuộn trang', v.l >= 0 && v.r <= v.vw && v.bottom <= v.vh && v.btn <= v.vh && !v.hScroll, JSON.stringify(v));
  await page.screenshot({ path: path.resolve(__dirname, 'review-modal-mobile.png') });
  await page.keyboard.press('Escape'); await wait(200);
  await page.evaluate(() => { const n = document.getElementById('psNote'); n.value = 'Làm sáng da, giữ tông ấm, xoá vết đỏ trên má bé. '.repeat(30); n.dispatchEvent(new Event('input')); });
  await page.setViewport({ width: 360, height: 640 }); await wait(300);
  await submit(); await wait(300);
  v = await page.evaluate(() => {
    const m = document.querySelector('#psReviewModal .ps-modal').getBoundingClientRect();
    const b = document.getElementById('psReviewConfirm').getBoundingClientRect();
    return { bottom: Math.round(m.bottom), btnTop: Math.round(b.top), btn: Math.round(b.bottom), vh: innerHeight };
  });
  check('Màn 360x640 + ghi chú chung rất dài: nút gửi vẫn nằm trong màn hình', v.bottom <= v.vh && v.btn <= v.vh && v.btnTop > 0, JSON.stringify(v));
  await page.screenshot({ path: path.resolve(__dirname, 'review-modal-small.png') });
  await page.keyboard.press('Escape'); await wait(200);
  await page.evaluate(() => { const n = document.getElementById('psNote'); n.value = 'Tông ấm cho cả bộ'; n.dispatchEvent(new Event('input')); });
  await page.setViewport({ width: 1440, height: 900 }); await wait(300);
  await submit(); await wait(300);

  // Gửi khi có ảnh chọn thêm (ảnh gói gửi ngay, ảnh chọn thêm chờ thanh toán 30 phút) kiểm tra ở
  // test-extra-pay.js. Ở đây chỉ đóng lại rồi gửi trong gói.
  await page.keyboard.press('Escape'); await wait(250);
  check('Đóng bước xem lại khi vượt gói -> chưa gửi gì', !(await shown('#psReviewModal')) && (await reqCount()) === 0);

  // Tải lại (ảnh chọn dở vẫn giữ), bỏ ảnh #11 -> gửi trong gói
  await page.reload({ waitUntil: 'networkidle0' }); await wait(700);
  await heart('ph-11'); await wait(300);
  await submit(); await wait(300);
  v = await page.$eval('#psReviewConfirm', el => el.textContent);
  await page.click('#psReviewConfirm'); await wait(600);
  const db = await page.evaluate(() => JSON.parse(localStorage.getItem('aloha_demo_db')));
  const req = db.editRequests[0];
  v = { btn: v, n: db.editRequests.length, photos: req && req.photos.length, note: req && req.note, pn: req && req.photoNotes.map(p => p.id + ':' + p.note).join(';'),
    locked: await page.$$eval('.ps-heart', els => els.every(b => b.disabled)), sub: await page.$eval('#psSubmitBtn', el => el.disabled) };
  check('Xác nhận "Gửi cho thợ" -> tạo đúng 1 yêu cầu 10 ảnh, giữ ghi chú chung + ghi chú ảnh #3', v.btn === 'Gửi cho thợ' && v.n === 1 && v.photos === 10 && v.note === 'Tông ấm cho cả bộ' && v.pn === 'ph-3:<b>đậm</b> làm sáng da', JSON.stringify(v));
  check('Gửi xong -> khoá chọn ảnh + nút gửi', v.locked && v.sub, JSON.stringify(v));
  await submit(); await wait(250);
  check('Đã gửi rồi -> không mở lại bước xem lại', !(await shown('#psReviewModal')));

  // ================= (3) Chuông thông báo =================
  const reqId = req.id, orderCode = req.orderCode;
  const bellItems = () => page.evaluate(() => [...document.querySelectorAll('#notifList .nav-util-item')].map(el => ({
    go: el.classList.contains('notif-go-edited'), hi: el.classList.contains('notif-highlight'), btn: el.tagName === 'BUTTON',
    title: el.querySelector('strong').textContent, sub: (el.querySelector('.sub') || {}).textContent || ''
  })));
  const hasReplyItem = () => page.evaluate(() => [...document.querySelectorAll('#notifList strong')].some(s => s.textContent.includes('vừa trả lời')));
  await page.waitForFunction(() => document.querySelectorAll('#notifList .nav-util-item').length > 0, { timeout: 9000 }).catch(() => {});
  let items = await bellItems();
  check('Chưa có tin từ thợ -> chuông chỉ có dòng trạng thái yêu cầu', items.length === 1 && !items[0].go && items[0].title.includes('Yêu cầu chỉnh sửa'), JSON.stringify(items));
  check('Yêu cầu đang chờ xử lý nhưng chưa có tin mới -> chấm đỏ chuông KHÔNG sáng', await page.$eval('#notifDot', el => el.hidden));

  // Khách đang ở Trang chủ, Thợ ảnh gửi link + trả lời (có HTML độc, câu dài)
  await page.evaluate(() => { location.hash = '#/'; }); await wait(500);
  await page.evaluate((id, link) => {
    AlohaData.setResultLink(id, link);
    AlohaData.addRequestMessage(id, 'staff', 'Thợ Minh', '<img src=x onerror=alert(1)> Ảnh của bé xong rồi nhé, bạn xem giúp mình tông màu đã ưng chưa, chỗ nào chưa ổn cứ nhắn mình sửa tiếp nha');
  }, reqId, LINK);
  await page.waitForFunction(() => document.querySelectorAll('#notifList .notif-go-edited').length === 2, { timeout: 9000 }).catch(() => {});
  items = await bellItems();
  v = await page.evaluate(() => ({ dot: !document.getElementById('notifDot').hidden, imgs: document.querySelectorAll('#notifList img').length }));
  check('Tự hiện (không tải lại trang): "Thợ chỉnh ảnh vừa trả lời bạn" nổi bật, lên đầu', items.length === 3 && items[0].title === 'Thợ chỉnh ảnh vừa trả lời bạn' && items[0].hi && items[0].btn, JSON.stringify(items));
  check('Tin trả lời: trích nội dung dạng chữ, rút gọn, không chạy HTML', !!items[0] && items[0].sub.startsWith('"<img src=x') && items[0].sub.endsWith('..."') && items[0].sub.length <= 76 && v.imgs === 0, items[0] && items[0].sub);
  check(`"Ảnh đã chỉnh đã sẵn sàng · ${orderCode}" nổi bật`, !!items[1] && items[1].title === `Ảnh đã chỉnh đã sẵn sàng · ${orderCode}` && items[1].hi && items[1].btn, JSON.stringify(items[1]));
  check('Chấm đỏ trên chuông đang bật', v.dot);
  v = await page.evaluate((id) => AlohaData.getEditRequests().find(r => r.id === id).customerSeenEditedSig || '', reqId);
  check('Đang ở Trang chủ -> chưa bị tính là "đã xem" dù tab Ảnh đã chỉnh chạy nền', v === '', v);

  await page.click('#notifBtn'); await wait(300);
  await page.screenshot({ path: path.resolve(__dirname, 'notif-edited-desktop.png') });
  v = await page.evaluate(() => [...document.querySelectorAll('#notifList button.nav-util-item')].map(b => {
    const t = b.querySelector('strong').getBoundingClientRect(), sub = b.querySelector('.sub').getBoundingClientRect(), st = b.querySelector('.notif-status').getBoundingClientRect();
    return getComputedStyle(b).display === 'flex' && t.bottom <= sub.top + 1 && sub.bottom <= st.top + 1;
  }));
  check('Dòng thông báo bấm được: tiêu đề / trích dẫn / "Bấm để..." mỗi thứ một dòng như dòng thường', v.length === 2 && v.every(Boolean), JSON.stringify(v));
  v = await page.evaluate((id) => AlohaData.getEditRequests().find(r => r.id === id).customerSeenEditedSig, reqId);
  check('Mở chuông -> ghi nhận đã xem tin mới (link + 1 tin của thợ)', v === LINK + '|1', v);
  check('Mở chuông xem tin -> chấm đỏ tắt ngay', await page.$eval('#notifDot', el => el.hidden));
  await wait(5600);
  items = await bellItems();
  check('Đang mở chuông qua 1 vòng cập nhật 5 giây: màu nổi bật vẫn giữ để khách đọc', items.length === 3 && items[0].hi && items[1].hi, JSON.stringify(items));
  await page.click('#notifList .notif-go-edited'); await wait(900);
  v = await page.evaluate(() => ({
    hash: location.hash, open: document.getElementById('notifPanel').classList.contains('open'),
    tab: (document.querySelector('.ps-tab.active') || {}).dataset.filter,
    panel: getComputedStyle(document.getElementById('psEditedPanel')).display,
    chat: document.getElementById('psChatList').textContent.includes('Ảnh của bé xong rồi nhé')
  }));
  check('Bấm tin -> đóng chuông, chuyển sang "Ảnh của tôi", mở đúng tab "Ảnh đã chỉnh" có tin của thợ', v.hash === '#/chon-anh' && !v.open && v.tab === 'edited' && v.panel !== 'none' && v.chat, JSON.stringify(v));

  await page.click('#notifBtn'); await wait(300);
  items = await bellItems();
  check('Mở lại chuông: hết nổi bật, còn dòng "Ảnh đã chỉnh" để bấm mở nhanh', items.length === 2 && items[0].title === `Ảnh đã chỉnh · ${orderCode}` && !items[0].hi && items[0].go && !items.some(i => i.title.includes('vừa trả lời')), JSON.stringify(items));
  await page.click('#notifBtn'); await wait(200);

  // Đang mở sẵn tab "Ảnh đã chỉnh" -> thợ nhắn thêm: khách thấy ngay trong chat, chuông không báo trùng
  await page.evaluate((id) => AlohaData.addRequestMessage(id, 'staff', 'Thợ Minh', 'Mình gửi thêm 2 ảnh ghép nhé'), reqId);
  await page.waitForFunction(() => document.getElementById('psChatList').textContent.includes('Mình gửi thêm 2 ảnh ghép'), { timeout: 9000 }).catch(() => {});
  await wait(5500);
  check('Đang xem tab "Ảnh đã chỉnh" khi thợ nhắn -> chuông không báo trùng', !(await hasReplyItem()));

  // Từ Trang chủ: thợ nhắn tiếp -> bấm chuông mở thẳng tab "Ảnh đã chỉnh"
  await page.evaluate(() => { location.hash = '#/'; }); await wait(500);
  await page.evaluate(() => document.querySelector('.ps-tab[data-filter="all"]').click()); // view ẩn đang ở tab khác
  await page.evaluate((id) => AlohaData.addRequestMessage(id, 'staff', 'Thợ Minh', 'Bạn muốn giữ tông ấm hay chuyển tông lạnh?'), reqId);
  await page.waitForFunction(() => [...document.querySelectorAll('#notifList strong')].some(s => s.textContent.includes('vừa trả lời')), { timeout: 9000 }).catch(() => {});
  await page.click('#notifBtn'); await wait(300);
  await page.click('#notifList .notif-go-edited'); await wait(900);
  v = await page.evaluate(() => ({ hash: location.hash, tab: (document.querySelector('.ps-tab.active') || {}).dataset.filter }));
  check('Từ Trang chủ bấm "Thợ chỉnh ảnh vừa trả lời bạn" -> mở đúng tab "Ảnh đã chỉnh"', v.hash === '#/chon-anh' && v.tab === 'edited', JSON.stringify(v));

  // Điện thoại
  await page.setViewport({ width: 390, height: 844 }); await wait(400);
  await page.evaluate(() => { location.hash = '#/'; window.scrollTo(0, 0); }); await wait(500);
  await page.evaluate((id) => AlohaData.addRequestMessage(id, 'staff', 'Thợ Minh', 'Ảnh ghép đã xong rồi bạn nhé'), reqId);
  await page.waitForFunction(() => [...document.querySelectorAll('#notifList strong')].some(s => s.textContent.includes('vừa trả lời')), { timeout: 9000 }).catch(() => {});
  await page.click('#notifBtn'); await wait(400);
  v = await page.evaluate(() => {
    const p = document.getElementById('notifPanel').getBoundingClientRect();
    return { l: Math.round(p.left), r: Math.round(p.right), vw: innerWidth, hScroll: document.documentElement.scrollWidth > innerWidth };
  });
  check('Điện thoại: bảng thông báo nằm gọn trong màn hình', v.l >= 0 && v.r <= v.vw && !v.hScroll, JSON.stringify(v));
  await page.screenshot({ path: path.resolve(__dirname, 'notif-edited-mobile.png') });
  await page.click('#notifBtn'); await wait(200);
  await page.setViewport({ width: 1440, height: 900 }); await wait(300);
  await page.evaluate((id) => { AlohaData.advanceRequestStatus(id); AlohaData.advanceRequestStatus(id); }, reqId);
  await page.waitForFunction(() => [...document.querySelectorAll('#notifList strong')].some(s => s.textContent.includes('sẵn sàng')), { timeout: 9000 }).catch(() => {});
  items = await bellItems();
  v = await page.evaluate((id) => AlohaData.getEditRequests().find(r => r.id === id).status, reqId);
  check('Thợ chuyển Hoàn thành: chỉ 1 dòng nổi bật "Ảnh đã chỉnh đã sẵn sàng", không trùng dòng "Ảnh đã sửa xong"', v === 'Hoàn thành' && items.filter(i => i.hi).length === 1 && items.find(i => i.hi).title.startsWith('Ảnh đã chỉnh đã sẵn sàng') && !items.some(i => i.title.includes('Ảnh đã sửa xong')), v + ' ' + JSON.stringify(items));
  await page.click('#notifBtn'); await wait(300); await page.click('#notifBtn'); await wait(200);
  await page.evaluate((id) => AlohaData.setResultLink(id, ''), reqId);
  await wait(5600);
  items = await bellItems();
  v = await page.evaluate(() => ({ tabDot: !!document.querySelector('.ps-tab[data-filter="edited"] .ps-tab-dot'), bellDot: !document.getElementById('notifDot').hidden }));
  check('Thợ gỡ link: chuông không nổi bật, chấm trên tab "Ảnh đã chỉnh" cũng không sáng (khớp nhau)', !items.some(i => i.hi) && !v.tabDot && !v.bellDot, JSON.stringify({ v, items }));

  check('Không có lỗi JS / hộp thoại lạ', errors.length === 0 && dialogs === 0, errors.join(' | ') + ' dialogs=' + dialogs);
  await browser.close();
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
