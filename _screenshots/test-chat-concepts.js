// Test logo mới + kịch bản chatbot cho concept album (js/albums.js).
// Phản hồi AI là giả (chặn :3001) nên không cần server, không tốn hạn mức Gemini.
// Chạy: node _screenshots/test-chat-concepts.js
const puppeteer = require('puppeteer-core');
const BASE = 'file:///D:/PhanTichWeb/';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
// AI trả lời chung chung, KHÔNG có nút album -> nút album concept phải do frontend tự gắn.
const PLAIN_REPLY = { reply: 'Studio có concept này nhé, bạn xem thêm ảnh mẫu hoặc đặt lịch.', suggestions: [
  { label: 'Đặt lịch chụp ngay', action: 'dat-lich' },
  { label: 'Giá chụp bao nhiêu?', action: 'none' },
  { label: 'Đặt cọc thế nào?', action: 'none' }] };
// AI gợi ý nút album theo dịch vụ (action mới album-<dịch vụ>).
const ALBUM_REPLY = { reply: 'Sinh nhật có 7 concept, bạn xem album nhé.', suggestions: [
  { label: 'Xem album Sinh nhật', action: 'album-sinh-nhat' },
  { label: 'Đặt lịch chụp ngay', action: 'dat-lich' },
  { label: 'Đặt cọc thế nào?', action: 'none' }] };

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new', args: ['--no-sandbox']
  });
  const results = [];
  const log = (name, ok, detail) => { results.push(ok); console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name + (detail ? ' :: ' + detail : '')); };

  // ---------------------------------------------------------------- 1) Logo
  for (const [name, url] of [['Trang chủ', 'index.html'], ['Đăng nhập', 'login.html'], ['Quản trị', 'crm/admin.html']]) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    if (name === 'Quản trị') {
      await page.goto(BASE + 'login.html', { waitUntil: 'networkidle0' });
      await page.evaluate(() => localStorage.setItem('aloha_auth', JSON.stringify({ role: 'sep', name: 'Sếp', phone: '0900000004', loginAt: Date.now() })));
    }
    await page.goto(BASE + url, { waitUntil: 'networkidle0' });
    const r = await page.evaluate(() => ({
      // Logo chữ: "aloha" + trái tim + "BABY STUDIO", nhìn thấy được, link có aria-label ALOHA Baby.
      logos: [...document.querySelectorAll('.logo')].map((l) => {
        const name = l.querySelector('.wordmark-name');
        const box = name && name.getBoundingClientRect();
        return !!name && name.textContent.trim() === 'aloha' && !!l.querySelector('.wordmark-heart') &&
          (l.querySelector('.wordmark-sub') || {}).textContent === 'BABY STUDIO' && box.width > 40 &&
          /ALOHA Baby/.test(l.getAttribute('aria-label') || '');
      }),
      font: (() => { const n = document.querySelector('.wordmark-name'); return n ? getComputedStyle(n).fontFamily : ''; })(),
      avatar: [...document.querySelectorAll('.chat-avatar img')].every((m) => m.complete && m.naturalWidth > 0),
      oldLogo: !!document.querySelector('.logo .mark, .logo .word') || [...document.querySelectorAll('.chat-avatar')].some((m) => m.textContent.trim() === 'A'),
      favicon: !!document.querySelector('link[rel="icon"][href$="logo-mark.svg"]') && !!document.querySelector('link[rel="apple-touch-icon"]')
    }));
    log(`[${name}] logo chữ "aloha · BABY STUDIO" hiện đúng (${r.logos.length} chỗ), font Quicksand, có favicon, không còn logo cũ`,
      r.logos.length > 0 && r.logos.every(Boolean) && r.font.includes('Quicksand') && r.avatar && !r.oldLogo && r.favicon);
    await page.close();
  }

  // ---------------------------------------------------------------- Chat
  async function openChat(replyFn) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      if (!r.url().includes(':3001/')) return r.continue();
      if (!replyFn) return r.abort(); // AI không dùng được
      if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: CORS });
      const msgs = JSON.parse(r.postData()).messages;
      r.respond({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(replyFn(msgs[msgs.length - 1].content)) });
    });
    await page.goto(BASE + 'index.html', { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.setItem('aloha_auth', JSON.stringify({ role: 'khach-hang', name: 'Test KH', phone: '0900000001', loginAt: Date.now() })));
    await page.reload({ waitUntil: 'networkidle0' });
    await page.click('#chatToggle');
    await page.waitForFunction(() => document.querySelectorAll('#chatBody .chat-quick button').length > 0, { timeout: 8000 });
    return page;
  }
  const lastMenu = (page) => page.evaluate(() => {
    const q = document.querySelectorAll('#chatBody .chat-quick');
    return q.length ? [...q[q.length - 1].querySelectorAll('button')].map((b) => b.textContent) : [];
  });
  const click = (page, label) => page.evaluate((l) => {
    const b = [...document.querySelectorAll('#chatBody .chat-quick button')].reverse().find((x) => x.textContent === l);
    if (b) b.click();
    return !!b;
  }, label);
  const waitMenuHas = (page, label, ms = 6000) => page.waitForFunction((l) => [...document.querySelectorAll('#chatBody .chat-quick button')].some((b) => b.textContent === l), { timeout: ms }, label).then(() => true, () => false);
  const waitHash = (page, h, ms = 5000) => page.waitForFunction((x) => location.hash === x, { timeout: ms }, h).then(() => true, () => false);
  const send = async (page, text) => { await page.type('#chatInput', text); await page.click('.chat-send'); };

  const albums = await (async () => {
    const p = await browser.newPage();
    await p.goto(BASE + 'index.html', { waitUntil: 'networkidle0' });
    const l = await p.evaluate(() => window.AlohaAlbums.list);
    await p.close();
    return l;
  })();

  // 2) Nhánh kịch bản "Concept & ảnh mẫu": dịch vụ -> 7 concept -> ảnh + mô tả -> mở album.
  {
    const page = await openChat(null);
    const menu = await lastMenu(page);
    log('menu chính có nhánh "Concept & ảnh mẫu"', menu.includes('Concept & ảnh mẫu'), menu.join(', '));
    await click(page, 'Concept & ảnh mẫu');
    const hasServices = await waitMenuHas(page, 'Sinh nhật');
    log('chọn "Concept & ảnh mẫu" -> hỏi chọn dịch vụ (đủ 5 dịch vụ)', hasServices && (await lastMenu(page)).length === 5, (await lastMenu(page)).join(', '));

    for (const s of albums) {
      await click(page, s.name);
      await waitMenuHas(page, 'Dịch vụ khác');
      const m = await lastMenu(page);
      const ok = s.concepts.every((c) => m.includes(c.name)) && m.length === s.concepts.length + 1;
      log(`  "${s.name}" -> hiện đủ ${s.concepts.length} concept để chọn`, ok, m.join(' | '));
      await click(page, 'Dịch vụ khác');
      await waitMenuHas(page, 'Newborn');
    }

    const sn = albums.find((x) => x.slug === 'sinh-nhat');
    const tt = sn.concepts.find((c) => c.slug === 'trung-thu');
    await click(page, 'Sinh nhật');
    await waitMenuHas(page, tt.name);
    await click(page, tt.name);
    await waitMenuHas(page, 'Xem album concept này');
    const shown = await page.evaluate((c) => {
      const img = [...document.querySelectorAll('#chatBody .chat-media img')].pop();
      const text = document.getElementById('chatBody').textContent;
      return { imgOk: !!img && img.getAttribute('src') === c.cover && img.complete && img.naturalWidth > 0, desc: text.includes(c.desc), count: text.includes(`có ${c.count} ảnh mẫu`) };
    }, tt);
    log('chọn concept "Trung thu" -> gửi ảnh mẫu + mô tả + số ảnh album', shown.imgOk && shown.desc && shown.count, JSON.stringify(shown));
    log('  có nút Xem album / Đặt lịch / Concept khác / Về menu', JSON.stringify(await lastMenu(page)) === JSON.stringify(['Xem album concept này', 'Đặt lịch concept này', 'Concept khác', 'Về menu chính']));
    await click(page, 'Xem album concept này');
    const went = await waitHash(page, tt.href);
    const albumOk = went && await page.evaluate((c) => !document.getElementById('view-album').hidden && document.getElementById('galleryTitle').textContent === c.name && document.querySelectorAll('#galleryGrid .gallery-item').length === c.count, tt);
    log('bấm "Xem album concept này" -> mở đúng album Trung thu với đủ ảnh', albumOk);
    log('  sau khi mở album, chatbot vẫn cho chọn concept khác', await waitMenuHas(page, 'Dịch vụ khác'));
    await page.close();
  }

  // 3) Nhánh "Tư vấn dịch vụ & báo giá" giờ liệt kê đủ concept + nút xem ảnh mẫu.
  {
    const page = await openChat(null);
    await click(page, 'Tư vấn dịch vụ & báo giá');
    await waitMenuHas(page, 'Newborn');
    await click(page, 'Newborn');
    await waitMenuHas(page, 'Xem concept & ảnh mẫu', 8000);
    const nb = albums.find((x) => x.slug === 'newborn');
    const text = await page.evaluate(() => document.getElementById('chatBody').textContent);
    log('tư vấn "Newborn" liệt kê đủ 7 concept', text.includes(`có ${nb.concepts.length} concept`) && nb.concepts.every((c) => text.includes(c.name)));
    await click(page, 'Xem concept & ảnh mẫu');
    log('  bấm "Xem concept & ảnh mẫu" -> chọn concept của Newborn', await waitMenuHas(page, 'Trăng sao cổ tích'));
    await page.close();
  }

  // 4) Khách gõ tự do nhắc tới concept -> chatbot tự gắn nút mở đúng album concept (AI không gợi ý).
  {
    const page = await openChat(() => PLAIN_REPLY);
    const cases = [
      ['bé nhà mình 5 tuổi muốn chụp áo dài', 'Xem album Áo dài truyền thống', '#/album/be-lon/ao-dai'],
      ['có chụp concept trung thu không?', 'Xem album Trung thu, đèn lồng', '#/album/sinh-nhat/trung-thu'],
      ['mình đang bầu muốn chụp ở biển', 'Xem album Biển', '#/album/bau/bien'],
      ['cả nhà muốn đi biển chụp gia đình', 'Xem album Biển', '#/album/gia-dinh/bien'],
      ['bé sơ sinh chụp đen trắng được không', 'Xem album Đen trắng tinh tế', '#/album/newborn/den-trang'],
      ['chụp cùng ông bà được không', 'Xem album Nhiều thế hệ', '#/album/gia-dinh/nhieu-the-he']
    ];
    for (const [q, btn, href] of cases) {
      await page.goto(BASE + 'index.html#/', { waitUntil: 'networkidle0' });
      await page.click('#chatToggle');
      await page.waitForFunction(() => document.querySelectorAll('#chatBody .chat-quick button').length > 0, { timeout: 8000 });
      await send(page, q);
      const has = await waitMenuHas(page, btn);
      await click(page, btn);
      const went = await waitHash(page, href);
      log(`gõ "${q}" -> có nút "${btn}", bấm mở ${href}`, has && went, (await lastMenu(page)).join(' | '));
    }
    await page.close();
  }

  // 5) AI gợi ý action mới album-<dịch vụ> -> bấm mở trang danh sách concept của dịch vụ.
  {
    const page = await openChat(() => ALBUM_REPLY);
    await send(page, 'sinh nhật có những concept nào');
    const has = await waitMenuHas(page, 'Xem album Sinh nhật');
    await click(page, 'Xem album Sinh nhật');
    log('AI gợi ý "album-sinh-nhat" -> mở #/album/sinh-nhat', has && await waitHash(page, '#/album/sinh-nhat'));
    await page.close();
  }

  // 6) AI không dùng được -> vẫn trả lời được về concept + nút xem album.
  {
    const page = await openChat(null);
    await send(page, 'studio có chụp công chúa không?');
    const has = await waitMenuHas(page, 'Xem album Công chúa, hoàng tử');
    const r = await page.evaluate(() => ({ text: document.getElementById('chatBody').textContent, error: !!document.querySelector('.chat-msg.error') }));
    log('AI lỗi, hỏi "công chúa" -> trả lời cục bộ về concept + nút album', has && r.text.includes('Concept "Công chúa, hoàng tử"') && !r.error);
    await send(page, 'chụp gia đình có concept gì');
    await waitMenuHas(page, 'Xem album Gia đình');
    const t2 = await page.evaluate(() => document.getElementById('chatBody').textContent);
    const gd = albums.find((x) => x.slug === 'gia-dinh');
    log('AI lỗi, hỏi dịch vụ "gia đình" -> liệt kê đủ 7 concept + nút album dịch vụ', t2.includes(`có ${gd.concepts.length} concept`) && gd.concepts.every((c) => t2.includes(c.name)));
    await page.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r).length;
  console.log('\n' + (failed === 0 ? 'TẤT CẢ TEST PASS' : failed + ' TEST FAIL') + ` (${results.length} case)`);
  process.exit(failed === 0 ? 0 : 1);
})();
