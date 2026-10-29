const fixture=require('./workflow-fixture');
// Test TỔNG THỂ 3 vai trò (Khách, Thợ ảnh, Sếp) qua CÙNG 1 server RAM khi bật cờ editSync - KHÔNG chụp
// ảnh, chỉ dữ liệu giả, MONGODB_URI='' (không nối MongoDB Atlas). Tự bật/tắt server/server.js ở cổng 3001.
//
// GIỚI HẠN (ghi rõ để không hiểu nhầm): mỗi vai trò là 1 ngữ cảnh trình duyệt ẨN DANH riêng (localStorage,
// sessionStorage, cookie tách biệt hoàn toàn - như 3 trình duyệt khác nhau) nhưng cùng chạy trên MỘT máy,
// MỘT tiến trình Chrome, server ở localhost. Đây là bằng chứng dữ liệu đi qua server chứ không qua
// localStorage chung; KHÔNG phải bằng chứng đồng bộ giữa các máy thật qua mạng thật (Render, Internet).
//   node _screenshots/test-e2e-edit-sync.js
const path = require('path');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');
const { CHROME_PATH, ROOT_URL } = require('./test-env');

const ROOT = path.resolve(__dirname, '..');
const API = 'http://localhost:3001';
let pass = 0, fail = 0;
const check = (name, ok, extra) => {
  if (ok) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '→ ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''); }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const EDIT = 'https://drive.google.com/drive/folders/e2e-anh-da-chinh';
const ORIG_MARK = 'e2e-anh-goc-NOIBO';
const ORIG = 'https://drive.google.com/drive/folders/' + ORIG_MARK;

let server = null, serverLog = '';
async function portBusy() { try { await fetch(API + '/api/health', { signal: AbortSignal.timeout(1500) }); return true; } catch (e) { return false; } }
async function startServer() {
  await fixture.driveFixture();
  server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(ROOT, 'server'),
    env: { ...process.env, PORT: '3001', AUTH_SECRET: 'test-secret', MONGODB_URI: '', GEMINI_API_KEY: '', ALLOWED_ORIGINS: '',
      // Test này dùng Thợ ảnh/Sếp demo công khai -> bật ngoại lệ CHỈ DÀNH CHO TEST (mặc định server chặn họ)
      EDIT_REQUESTS_ALLOW_PUBLIC_DEMO_STAFF: '1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', (d) => { serverLog += d; });
  server.stderr.on('data', (d) => { serverLog += d; });
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(API + '/api/health')).ok) return; } catch (e) { /* chưa lên */ }
    await wait(150);
  }
  throw new Error('Không bật được server test ở cổng 3001');
}
function stopServer() { if (server) { server.kill(); server = null; } }
process.on('exit', stopServer);
process.on('SIGINT', () => { stopServer(); process.exit(1); });
const serverCount = async () => (await (await fetch(API + '/api/edit-requests/health')).json()).count - 1;

(async () => {
  let browser = null;
  const errors = [];
  try {
    if (await portBusy()) throw new Error('Cổng 3001 đang có server khác chạy (có thể nối MongoDB thật) - tắt nó rồi chạy lại test.');
    await startServer();
    const sourceCustomer=await fixture.login(API,'0900000001','khach123');
    const album=await fixture.sourceAlbum(API,{customer:sourceCustomer,code:'#ABFIXTURE01'});
    check('Server test: kho chỉnh ảnh RAM, chat Sale memory (không MongoDB)', (await (await fetch(API + '/api/edit-requests/health')).json()).store === 'memory' && (await (await fetch(API + '/api/health')).json()).chatStore === 'memory');
    browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });

    // 1 vai trò = 1 ngữ cảnh ẩn danh riêng. Ghi lại request + phản hồi /api/edit-requests.
    async function session(name, sync) {
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      if (!sync) await fixture.installLocalAlbum(page,album);
      await page.setViewport({ width: 1440, height: 1000 });
      const m = { name, page, ctx, calls: [], responses: [], intercept: { mode: null } };
      page.on('pageerror', (e) => errors.push(name + ': ' + e.message));
      page.on('dialog', (dlg) => { errors.push(name + ' dialog: ' + dlg.message()); dlg.dismiss(); });
      await page.evaluateOnNewDocument((sy) => {
        window.ALOHA_FEATURES = { booking: true, aiChat: true, albumPages: true, editSync: sy };
        try { if (!sessionStorage.getItem('aloha_chat_ui')) sessionStorage.setItem('aloha_chat_ui', JSON.stringify({ dismissed: true })); } catch (e) { /* */ }
      }, sync);
      await page.setRequestInterception(true);
      page.on('request', async (r) => {
        if(await fixture.thumbnail(page,r)) return;
        if (r.url().includes('/api/edit-requests')) {
          m.calls.push(r.method() + ' ' + r.url().replace(API, ''));
          if (m.intercept.mode === 'abort' && r.method() !== 'OPTIONS') return r.abort();
        }
        r.continue();
      });
      page.on('response', async (res) => {
        if (!res.url().includes('/api/edit-requests') || res.request().method() === 'OPTIONS') return;
        try { m.responses.push(await res.text()); } catch (e) { /* */ }
      });
      return m;
    }
    async function login(m, phone, pw) {
      await m.page.goto(ROOT_URL + 'login.html', { waitUntil: 'networkidle0' });
      await m.page.type('#loginPhone', phone);
      await m.page.type('#loginPassword', pw);
      await Promise.all([m.page.waitForNavigation({ waitUntil: 'networkidle0' }), m.page.click('#loginSubmitBtn')]);
      await wait(800);
    }
    const expand = 'document.querySelectorAll(".photo-row-more").forEach((b) => { if (!b.hidden && /Xem thêm/.test(b.textContent)) b.click(); });';
    // Chờ (qua các vòng polling) tới khi fn đúng; fn chạy trong trang
    const until = (m, fn, arg, ms = 15000) => m.page.waitForFunction(fn, { timeout: ms, polling: 500 }, arg).then(() => true, () => false);
    const hasCard = (m, code) => until(m, new Function('code', expand + ' return [...document.querySelectorAll("#photoRows .photo-row-card-code")].some((e) => e.textContent.trim() === code);'), code);
    async function openCard(m, code) {
      await m.page.evaluate(new Function('code', expand + ' [...document.querySelectorAll("#photoRows .photo-row-card")].find((x) => x.querySelector(".photo-row-card-code").textContent.trim() === code).click();'), code);
      await wait(500);
    }
    async function noteInLightbox(page, id, text) {
      await page.evaluate((i) => document.querySelector(`.ps-photo[data-id="${i}"] img`).click(), id);
      await page.waitForFunction(() => !document.getElementById('psLbNoteWrap').hidden, { timeout: 3000 });
      await wait(300);
      await page.type('#psLbNote', text);
      await page.keyboard.press('Escape');
      await wait(200);
    }
    const localReqs = (page) => page.evaluate(() => { try { return (JSON.parse(localStorage.getItem('aloha_demo_db')) || {}).editRequests || []; } catch (e) { return []; } });

    // =============================================================== A. editSync = false: luồng cũ, không gọi API
    const k0 = await session('Khách(tắt)', false);
    const t0 = await session('Thợ(tắt)', false);
    const s0 = await session('Sếp(tắt)', false);
    await login(k0, '0900000001', 'khach123');
    await k0.page.click('.ps-photo[data-id="drive-fixture-file-1"] .ps-heart');
    await k0.page.click('#psSubmitBtn');
    await wait(500);
    await login(t0, '0900000003', 'anh123');
    await login(s0, '0900000004', 'sep123');
    const offCode = (await localReqs(k0.page))[0];
    check('Cờ tắt: khách gửi yêu cầu -> lưu localStorage CỦA TRÌNH DUYỆT KHÁCH như cũ', !!offCode && offCode.photos.length === 1);
    check('Cờ tắt: không vai trò nào gọi /api/edit-requests, server không nhận gì', [k0, t0, s0].every((m) => m.calls.length === 0) && (await serverCount()) === 0, [k0, t0, s0].map((m) => m.calls.length));
    const offSeen = await t0.page.evaluate(new Function(expand + ' return [...document.querySelectorAll("#photoRows .photo-row-card")].some((c) => /^REQ-/.test(c.dataset.reqId));'));
    check('Cờ tắt: Thợ ảnh ở trình duyệt khác KHÔNG thấy yêu cầu đó (luồng cũ chỉ trong 1 trình duyệt - đúng giới hạn cũ)', offSeen === false);
    await Promise.all([k0.ctx.close(), t0.ctx.close(), s0.ctx.close()]);

    // =============================================================== B. editSync = true: 3 vai trò qua server
    const K = await session('Khách', true);
    const T = await session('Thợ', true);
    const S = await session('Sếp', true);
    await login(K, '0900000001', 'khach123');
    await login(T, '0900000003', 'anh123');
    await login(S, '0900000004', 'sep123');

    // B1. Khách gửi yêu cầu bằng giao diện
    await K.page.waitForFunction(() => /^Gửi (ảnh|yêu cầu)/.test(document.getElementById('psSubmitBtn').textContent.trim()) && document.querySelectorAll('.ps-heart').length > 0, { timeout: 8000 });
    await K.page.click('.ps-photo[data-id="drive-fixture-file-2"] .ps-heart');
    await K.page.click('.ps-photo[data-id="drive-fixture-file-4"] .ps-heart');
    await noteInLightbox(K.page, 'drive-fixture-file-2', 'Lam min da be');
    await K.page.click('.ps-tab[data-filter="liked"]');
    await K.page.type('#psNote', 'Giu mau tu nhien');
    await K.page.click('#psSubmitBtn');
    const sentOk = await until(K, () => document.getElementById('psSubmitBtn').textContent.trim() === 'Đã gửi yêu cầu');
    check('Khách gửi yêu cầu qua giao diện -> server xác nhận mới báo "đã gửi"', sentOk && /Đã gửi yêu cầu chỉnh sửa/.test(await K.page.$eval('#psSubmittedBanner', (b) => b.textContent)));
    check('Khách: yêu cầu KHÔNG nằm trong localStorage (chỉ trên server)', (await localReqs(K.page)).length === 0 && (await serverCount()) === 1);
    const CODE = '#ABFIXTURE01';
    check('Thợ ảnh (trình duyệt khác) thấy yêu cầu mới sau vòng polling', await hasCard(T, CODE));
    check('Sếp (trình duyệt khác) thấy yêu cầu mới sau vòng polling', await hasCard(S, CODE));
    const tCard = await T.page.evaluate(new Function(expand + ' const c = [...document.querySelectorAll("#photoRows .photo-row-card")].find((x) => x.querySelector(".photo-row-card-code").textContent.trim() === "#ABFIXTURE01"); return c ? c.textContent.replace(/\\s+/g, " ") : "";'));
    check('Thẻ ở Thợ ảnh: tên khách, 2 ảnh, 1 ảnh có ghi chú riêng, "Mới", "Thợ ảnh demo"', /Khách demo/.test(tCard) && /2 ảnh/.test(tCard) && /1 ảnh có ghi chú riêng/.test(tCard) && /Mới/.test(tCard) && /Thợ ảnh demo/.test(tCard), tCard);

    // B2. Thợ ảnh mở chi tiết, lưu 2 link + nhắn bằng giao diện
    await openCard(T, CODE);
    let v = await T.page.evaluate(() => ({ note: document.getElementById('kanbanModalBody').textContent, photos: document.querySelectorAll('#kanbanModalBody .kanban-photo-tile').length }));
    check('Chi tiết Thợ ảnh: đúng 2 ảnh, ghi chú riêng + ghi chú chung của khách', v.photos === 2 && v.note.includes('Lam min da be') && v.note.includes('Giu mau tu nhien'));
    await T.page.type('#kanbanLinkEdit', EDIT);
    await T.page.type('#kanbanLinkOrig', ORIG);
    await T.page.evaluate(() => document.getElementById('kanbanLinkForm').requestSubmit());
    check('Thợ ảnh lưu 2 link -> server xác nhận (hiện nút Hoàn tất)', await until(T, () => !!document.getElementById('kanbanLinkComplete')));
    await T.page.type('#kanbanChatInput', 'Tho da gui link anh da chinh');
    await T.page.keyboard.press('Enter');
    check('Thợ ảnh nhắn khách -> server xác nhận (ô nhập được xoá)', await until(T, () => document.getElementById('kanbanChatInput').value === ''));
    await T.page.evaluate(() => document.getElementById('kanbanModalClose').click());

    // Khách nhận link + tin (không có link gốc)
    await K.page.click('.ps-tab[data-filter="edited"]');
    check('Khách thấy link ảnh đã chỉnh sau vòng polling', await until(K, (l) => { const a = document.getElementById('psResultLink'); return a && a.href === l; }, EDIT));
    check('Khách thấy tin nhắn của thợ', await until(K, () => [...document.querySelectorAll('#psChatList .ps-msg.from-staff > div')].some((p) => p.textContent.includes('Tho da gui link'))));
    // Khách trả lời
    await K.page.type('#psChatInput', 'Cam on tho a');
    await K.page.keyboard.press('Enter');
    check('Khách nhắn lại -> server xác nhận', await until(K, () => document.getElementById('psChatInput').value === ''));

    // Sếp nhận link (cả link gốc, nội bộ) + tin của 2 bên
    await openCard(S, CODE);
    const sepOk = await until(S, () => { const c = document.getElementById('kanbanResultCurrent'); return c && c.textContent.includes('e2e-anh-da-chinh'); });
    v = await S.page.evaluate(() => ({ cur: document.getElementById('kanbanResultCurrent').textContent, form: !!document.getElementById('kanbanLinkForm'), chat: !!document.getElementById('kanbanChatForm') }));
    check('Sếp thấy link ảnh đã chỉnh + link ảnh gốc (ghi rõ nội bộ), không có form ghi', sepOk && v.cur.includes(EDIT) && v.cur.includes(ORIG) && /nội bộ/.test(v.cur) && !v.form && !v.chat, v);
    check('Sếp thấy tin của thợ và tin khách vừa trả lời (khung chat tự làm mới)', await until(S, () => { const t = [...document.querySelectorAll('#kanbanChatList .kanban-msg > div')].map((p) => p.textContent); return t.includes('Tho da gui link anh da chinh') && t.includes('Cam on tho a'); }));
    await S.page.evaluate(() => document.getElementById('kanbanModalClose').click());

    // B3. 409: phiên Thợ ảnh thứ 2 (trình duyệt khác, cùng tài khoản) lưu link trước
    const T2 = await session('Thợ-2', true);
    await login(T2, '0900000003', 'anh123');
    await hasCard(T, CODE);
    await openCard(T, CODE); // Thợ 1 mở chi tiết (giữ rev hiện tại)
    await hasCard(T2, CODE);
    await openCard(T2, CODE);
    await T2.page.$eval('#kanbanLinkEdit', (i) => { i.value = ''; });
    await T2.page.type('#kanbanLinkEdit', EDIT + '-tho2');
    await T2.page.evaluate(() => document.getElementById('kanbanLinkForm').requestSubmit());
    await until(T2, () => document.getElementById('kanbanResultCurrent').textContent.includes('-tho2'));
    await T.page.$eval('#kanbanLinkEdit', (i) => { i.value = ''; });
    await T.page.type('#kanbanLinkEdit', EDIT + '-tho1');
    await T.page.evaluate(() => document.getElementById('kanbanLinkForm').requestSubmit());
    const conflictShown = await until(T, () => { const e = document.getElementById('kanbanLinkError'); return e && !e.hidden && /người khác cập nhật/.test(e.textContent); });
    v = await T.page.evaluate(() => ({ typed: document.getElementById('kanbanLinkEdit').value, cur: document.getElementById('kanbanResultCurrent').textContent }));
    check('409 giữa 2 trình duyệt Thợ ảnh: báo dữ liệu đã đổi, giữ chữ đã gõ, hiện link của phiên kia', conflictShown && v.typed === EDIT + '-tho1' && v.cur.includes('-tho2'), v);
    await wait(1200);
    const linkNow = (await (await fetch(API + '/api/edit-requests/health')).json()) && await T2.page.evaluate(async () => { const r = await window.AlohaEditSync.list(); return r.data.requests[0].resultLink; });
    check('409: không ghi đè, không tự gửi lại (server vẫn giữ link của Thợ 2)', linkNow === EDIT + '-tho2', linkNow);
    await T.page.evaluate(() => document.getElementById('kanbanModalClose').click());
    await T2.page.evaluate(() => document.getElementById('kanbanModalClose').click());
    await T2.ctx.close();

    // B4. Mất mạng: không báo thành công giả
    K.intercept.mode = 'abort';
    await K.page.type('#psChatInput', 'Tin khi mat mang');
    await K.page.keyboard.press('Enter');
    check('Khách mất mạng khi nhắn: báo "Tin nhắn CHƯA được gửi", giữ chữ', await until(K, () => { const e = document.querySelector('.ps-sync-status'); return e && !e.hidden && /CHƯA được gửi/.test(e.textContent); }) && (await K.page.$eval('#psChatInput', (i) => i.value)) === 'Tin khi mat mang');
    K.intercept.mode = null;
    await K.page.$eval('#psChatInput', (i) => { i.value = ''; });
    S.intercept.mode = 'abort';
    check('Sếp mất mạng: hiện "Chưa cập nhật được... lần tải được gần nhất"', await until(S, () => [...document.querySelectorAll('.photo-sync-status')].some((e) => !e.hidden && /lần tải được gần nhất/.test(e.textContent))));
    S.intercept.mode = null;
    check('Sếp có mạng lại: dòng báo lỗi tự ẩn', await until(S, () => [...document.querySelectorAll('.photo-sync-status')].every((e) => e.hidden)));

    // B5. Thợ ảnh Hoàn tất bằng giao diện (cửa sổ Drive) -> cả 3 vai trò cập nhật
    await hasCard(T, CODE);
    await T.page.evaluate(new Function(expand + ' [...document.querySelectorAll("#photoRows .photo-row-card")].find((x) => x.querySelector(".photo-row-card-code").textContent.trim() === "#ABFIXTURE01").querySelector(".photo-row-drive-btn").click();'));
    await wait(300);
    await T.page.click('#driveModalCompleteBtn');
    check('Thợ ảnh Hoàn tất -> cửa sổ đóng sau khi server xác nhận', await until(T, () => !document.getElementById('driveModalOverlay').classList.contains('open')));
    check('Thợ ảnh: đơn sang bảng Đã hoàn tất', await until(T, () => [...document.querySelectorAll('#completedTableBody .ct-code-val')].some((e) => e.textContent.trim() === '#ABFIXTURE01')));
    check('Sếp: đơn sang bảng Đã hoàn tất sau vòng polling', await until(S, () => [...document.querySelectorAll('#completedTableBody .ct-code-val')].some((e) => e.textContent.trim() === '#ABFIXTURE01')));
    await K.page.click('.ps-tab[data-filter="all"]');
    await wait(5600); // chuông thông báo của khách hỏi lại 5 giây/lần
    await K.page.click('#notifBtn');
    check('Khách: chuông báo "Ảnh đã sửa xong" sau vòng polling', await until(K, () => /Ảnh đã sửa xong/.test(document.getElementById('notifList').textContent)));
    await K.page.click('#notifBtn').catch(() => {});
    await K.page.click('.ps-tab[data-filter="edited"]');
    check('Khách: tiến độ đủ 3 bước, link ảnh đã chỉnh mới nhất (của Thợ 2)', await until(K, (l) => { const a = document.getElementById('psResultLink'); return a && a.href === l && [...document.querySelectorAll('#psResultBody .ps-progress-steps li')].every((li) => li.classList.contains('done')); }, EDIT + '-tho2'));

    // B6. Link ảnh gốc chỉ ở giao diện nhân viên
    const kHtml = await K.page.content();
    check('Khách: HTML không chứa link ảnh gốc', !kHtml.includes(ORIG_MARK));
    check('Khách: mọi phản hồi /api/edit-requests không chứa link ảnh gốc', K.responses.length > 0 && K.responses.every((t) => !t.includes(ORIG_MARK) && !t.includes('resultLinkOriginal')), K.responses.length);
    check('Nhân viên: phản hồi API cho Thợ ảnh / Sếp có link ảnh gốc', T.responses.some((t) => t.includes(ORIG_MARK)) && S.responses.some((t) => t.includes(ORIG_MARK)));

    // B7. Quyền truy cập (gọi thẳng từ trang)
    v = await K.page.evaluate(async () => {
      const S = window.AlohaEditSync;
      const r = (await S.mine()).data.requests[0];
      return [(await S.list()).error, (await S.setLinks(r.id, { resultLink: 'https://x.y/z' }, r.rev)).error, (await S.complete(r.id, r.rev)).error];
    });
    check('Khách gọi list/setLinks/complete -> "forbidden"', v.every((e) => e === 'forbidden'), v);
    v = await S.page.evaluate(async () => { const S = window.AlohaEditSync; const r = (await S.list()).data.requests[0]; return [(await S.addMessage(r.id, 'x')).error, (await S.markSeen(r.id)).error]; });
    check('Sếp gọi addMessage/markSeen -> "forbidden"', v.every((e) => e === 'forbidden'), v);
    const regB = await (await fetch(API + '/api/sale-chat/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '0922222222', name: 'Khach gia C', password: 'matkhau123' }) })).json();
    const KB = await session('Khách-B', true);
    await login(KB, '0922222222', 'matkhau123');
    v = await KB.page.evaluate(async () => { const S = window.AlohaEditSync; const mine = await S.mine(); return { n: mine.data.requests.length }; });
    const idA = await K.page.evaluate(async () => (await window.AlohaEditSync.mine()).data.requests[0].id);
    const getA = await KB.page.evaluate(async (id) => (await window.AlohaEditSync.get(id)).error, idA);
    check('Khách khác (đăng ký giả): không thấy yêu cầu của khách A, get -> not_found', regB.token && v.n === 0 && getA === 'not_found', { v, getA });

    check('Toàn bộ quá trình bật cờ: không yêu cầu nào trong localStorage của 3 vai trò', (await localReqs(K.page)).length === 0 && (await localReqs(T.page)).length === 0 && (await localReqs(S.page)).length === 0);
    check('Không có lỗi JS / hộp thoại trên mọi trang', errors.length === 0, errors);
  } catch (e) {
    fail++;
    console.log('✗ Lỗi khi chạy test:', e.message);
    if (serverLog) console.log('--- log server ---\n' + serverLog.slice(-1500));
  } finally {
    if (browser) await browser.close().catch(() => {});
    stopServer();
  }
  console.log(`\n${pass}/${pass + fail} PASS`);
  process.exit(fail ? 1 : 0);
})();
