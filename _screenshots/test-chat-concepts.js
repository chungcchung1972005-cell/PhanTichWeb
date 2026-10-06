const { CHROME_PATH, ROOT_URL } = require('./test-env');
// Test logo mới + kịch bản chatbot cho concept album (js/albums.js).
// Phản hồi AI là giả (chặn :3001) nên không cần server, không tốn hạn mức Gemini.
// Chạy: node _screenshots/test-chat-concepts.js
const puppeteer = require('puppeteer-core');
const BASE = ROOT_URL;
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
  const browser = await require('./test-env').launchAllFeatures(puppeteer, {
    executablePath: CHROME_PATH,
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
      // Logo chữ: "aloha" + trái tim + "BABY STUDIO", link có aria-label ALOHA Baby. Chỉ xét logo
      // đang hiện trên màn hình (vd trang quản trị có 1 logo ở thanh trên chỉ dành cho màn hẹp).
      logos: [...document.querySelectorAll('.logo')].filter((l) => l.getClientRects().length > 0).map((l) => {
        const name = l.querySelector('.wordmark-name');
        const box = name && name.getBoundingClientRect();
        return !!name && name.textContent.trim() === 'aloha' && !!l.querySelector('.wordmark-heart') &&
          (l.querySelector('.wordmark-sub') || {}).textContent === 'BABY STUDIO' && box.width > 40 &&
          /ALOHA Baby/.test(l.getAttribute('aria-label') || '');
      }),
      // Logo dùng đúng font tiêu đề đang khai báo trong CSS (--font-heading), không ghi cứng tên font
      font: (() => {
        const n = document.querySelector('.wordmark-name');
        const heading = getComputedStyle(document.documentElement).getPropertyValue('--font-heading').split(',')[0].replace(/['"]/g, '').trim();
        return !!n && !!heading && getComputedStyle(n).fontFamily.includes(heading);
      })(),
      avatar: [...document.querySelectorAll('.chat-avatar img')].every((m) => m.complete && m.naturalWidth > 0),
      // Logo cũ = ô chữ "A" (span.mark) + chữ "ALOHA Baby" (span.word không phải wordmark).
      // Menu dọc quản trị cố ý có img.mark (icon hiện khi thu gọn menu) nên không tính là logo cũ.
      oldLogo: [...document.querySelectorAll('.logo .mark')].some((m) => m.tagName !== 'IMG') ||
        [...document.querySelectorAll('.logo .word')].some((w) => !w.classList.contains('wordmark')) || [...document.querySelectorAll('.chat-avatar')].some((m) => m.textContent.trim() === 'A'),
      favicon: !!document.querySelector('link[rel="icon"][href$="logo-mark.svg"]') && !!document.querySelector('link[rel="apple-touch-icon"]')
    }));
    log(`[${name}] logo chữ "aloha · BABY STUDIO" hiện đúng (${r.logos.length} chỗ), dùng font tiêu đề của site, có favicon, không còn logo cũ`,
      r.logos.length > 0 && r.logos.every(Boolean) && r.font && r.avatar && !r.oldLogo && r.favicon);
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
      // AI chọn 2 gợi ý cho menu kịch bản (2026-09-28): test dùng thứ tự mặc định -> trả lỗi.
      if (r.url().includes('/api/chat-suggest')) return r.respond({ status: 503, headers: CORS, body: '{}' });
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

  // 2) Nhánh kịch bản "Concept & ảnh mẫu": dịch vụ -> concept -> ảnh + mô tả -> mở album.
  //    Từ 2026-09-28 mỗi menu tối đa 2 nút (AI chọn theo hoàn cảnh; ở đây AI lỗi nên là 2 nút mặc định).
  {
    const page = await openChat(null);
    const menu = await lastMenu(page);
    log('menu chính tối đa 2 nút, có "Concept & ảnh mẫu"', menu.length === 2 && menu.includes('Concept & ảnh mẫu'), menu.join(', '));
    await click(page, 'Concept & ảnh mẫu');
    const hasServices = await waitMenuHas(page, 'Sinh nhật');
    log('chọn "Concept & ảnh mẫu" -> hỏi chọn dịch vụ (2 nút)', hasServices && (await lastMenu(page)).length === 2, (await lastMenu(page)).join(', '));

    const sn = albums.find((x) => x.slug === 'sinh-nhat');
    const first = sn.concepts[0];
    await click(page, 'Sinh nhật');
    const allLabel = `Xem cả ${sn.concepts.length} concept`;
    await waitMenuHas(page, allLabel);
    const m = await lastMenu(page);
    log('"Sinh nhật" -> 2 nút: 1 concept gợi ý + "Xem cả N concept"', m.length === 2 && m[0] === first.name && m[1] === allLabel, m.join(' | '));
    const txt = await page.evaluate(() => document.getElementById('chatBody').textContent);
    log('  báo đủ số concept của dịch vụ', txt.includes(`có ${sn.concepts.length} concept`));
    await click(page, first.name);
    await waitMenuHas(page, 'Xem album concept này');
    const shown = await page.evaluate((c) => {
      const img = [...document.querySelectorAll('#chatBody .chat-media img')].pop();
      const text = document.getElementById('chatBody').textContent;
      return { imgOk: !!img && img.getAttribute('src') === c.cover && img.complete && img.naturalWidth > 0, desc: text.includes(c.desc), count: text.includes(`có ${c.count} ảnh mẫu`) };
    }, first);
    log(`chọn concept "${first.name}" -> gửi ảnh mẫu + mô tả + số ảnh album`, shown.imgOk && shown.desc && shown.count, JSON.stringify(shown));
    log('  2 nút: Xem album / Đặt lịch concept này', JSON.stringify(await lastMenu(page)) === JSON.stringify(['Xem album concept này', 'Đặt lịch concept này']), (await lastMenu(page)).join(' | '));
    await click(page, 'Xem album concept này');
    const went = await waitHash(page, first.href);
    const albumOk = went && await page.evaluate((c) => !document.getElementById('view-album').hidden && document.getElementById('galleryTitle').textContent === c.name && document.querySelectorAll('#galleryGrid .gallery-item').length === c.count, first);
    log(`bấm "Xem album concept này" -> mở đúng album ${first.name} với đủ ảnh`, albumOk);
    log('  sau khi mở album, chatbot vẫn cho xem các concept khác', await waitMenuHas(page, allLabel));
    await click(page, allLabel);
    log('  bấm "Xem cả N concept" -> mở trang album dịch vụ có đủ concept', await waitHash(page, sn.href, 6000) &&
      await page.evaluate((n) => document.querySelectorAll('#galleryConcepts .concept-album').length === n, sn.concepts.length));
    await page.close();
  }

  // 3) Nhánh "Tư vấn dịch vụ & báo giá" liệt kê đủ concept + nút xem ảnh mẫu.
  {
    const page = await openChat(null);
    await click(page, 'Tư vấn dịch vụ & báo giá');
    await waitMenuHas(page, 'Sinh nhật');
    await click(page, 'Sinh nhật');
    await waitMenuHas(page, 'Xem concept & ảnh mẫu', 8000);
    const sn = albums.find((x) => x.slug === 'sinh-nhat');
    const text = await page.evaluate(() => document.getElementById('chatBody').textContent);
    log('tư vấn "Sinh nhật" liệt kê đủ concept trong tin nhắn, menu tối đa 2 nút', text.includes(`có ${sn.concepts.length} concept`) && sn.concepts.every((c) => text.includes(c.name)) && (await lastMenu(page)).length === 2);
    await click(page, 'Xem concept & ảnh mẫu');
    log('  bấm "Xem concept & ảnh mẫu" -> gợi ý concept của Sinh nhật', await waitMenuHas(page, sn.concepts[0].name));
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
    log('AI lỗi, hỏi "công chúa" -> trả lời cục bộ về concept + nút album', has && r.text.includes('concept "Công chúa, hoàng tử"') && !r.error);
    await send(page, 'chụp gia đình có concept gì');
    await waitMenuHas(page, 'Xem album Gia đình');
    const t2 = await page.evaluate(() => document.getElementById('chatBody').textContent);
    const gd = albums.find((x) => x.slug === 'gia-dinh');
    log('AI lỗi, hỏi dịch vụ "gia đình" -> liệt kê đủ 7 concept + nút album dịch vụ', t2.includes(`có ${gd.concepts.length} concept`) && gd.concepts.every((c) => t2.includes(c.name)));
    await page.close();
  }

  // 7) AI chọn 2 gợi ý theo hoàn cảnh (/api/chat-suggest, 2026-09-28) - phản hồi giả.
  async function suggestPage(suggestFn, delayMs) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.setRequestInterception(true);
    const bodies = [];
    const asked = [];
    page.on('request', (r) => {
      if (!r.url().includes(':3001/')) return r.continue();
      if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: CORS });
      const body = JSON.parse(r.postData() || '{}');
      if (r.url().includes('/api/chat-suggest')) {
        bodies.push(body);
        const reply = () => r.respond({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(suggestFn(body)) });
        return delayMs ? setTimeout(reply, delayMs) : reply();
      }
      if (r.url().endsWith('/api/chat')) { asked.push(body.messages[body.messages.length - 1].content); return r.respond({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(PLAIN_REPLY) }); }
      return r.abort();
    });
    await page.goto(BASE + 'index.html', { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.setItem('aloha_auth', JSON.stringify({ role: 'khach-hang', name: 'Test KH', phone: '0900000001', loginAt: Date.now() })));
    await page.goto(BASE + 'index.html#/album/bau', { waitUntil: 'networkidle0' });
    await page.click('#chatToggle');
    return { page, bodies, asked };
  }
  {
    const { page, bodies, asked } = await suggestPage(() => ({ suggestions: [
      { id: 'khong-co-that', label: 'Nút bịa' },
      { id: 'luu-y', label: 'Tuần mấy chụp đẹp nhất?' },
      { id: 'ask', label: 'Chụp cùng chồng được không?' }] }), 800); // chậm 0.8 giây để kịp thấy ô "đang chọn gợi ý"
    const loading =await page.waitForFunction(() => !!document.querySelector('#chatBody .chat-quick.is-loading'), { timeout: 6000 }).then(() => true, () => false);
    await page.waitForFunction(() => { const w = [...document.querySelectorAll('#chatBody .chat-quick')].pop(); return w && !w.classList.contains('is-loading') && w.querySelector('button'); }, { timeout: 8000 });
    const m = await lastMenu(page);
    const b0 = bodies[0] || {};
    log('Lời chào album Bầu: gửi AI trang đang xem + danh sách lựa chọn, lúc chờ hiện ô "đang chọn gợi ý"',
      loading && /album dịch vụ Bầu/.test(b0.page || '') && Array.isArray(b0.candidates) && b0.candidates.some((c) => c.id === 'bao-gia') && b0.candidates.length >= 3, (b0.page || '') + ' / ' + (b0.candidates || []).map((c) => c.id).join(','));
    log('AI chọn -> đúng 2 nút theo AI (bỏ id không có thật, dùng chữ AI viết lại)', JSON.stringify(m) === JSON.stringify(['Tuần mấy chụp đẹp nhất?', 'Chụp cùng chồng được không?']), m.join(' | '));
    await click(page, 'Chụp cùng chồng được không?');
    await page.waitForFunction(() => document.querySelectorAll('#chatBody .chat-msg.user').length > 0, { timeout: 5000 }).catch(() => {});
    await wait(1200);
    const userMsgs = await page.evaluate(() => [...document.querySelectorAll('#chatBody .chat-msg.user')].map((e) => e.textContent));
    log('  nút câu hỏi AI tạo (id "ask") bấm vào là gửi câu đó cho trợ lý AI (hiện 1 lần)', asked.includes('Chụp cùng chồng được không?') && userMsgs.filter((t) => t === 'Chụp cùng chồng được không?').length === 1, JSON.stringify(asked));
    await page.close();
  }
  {
    const { page } = await suggestPage(() => ({ suggestions: [{ id: 'luu-y', label: 'Tuần mấy chụp đẹp nhất?' }, { id: 'sale', label: 'Nhắn Sale giữ lịch' }] }));
    await page.waitForFunction(() => { const w = [...document.querySelectorAll('#chatBody .chat-quick')].pop(); return w && !w.classList.contains('is-loading') && w.querySelector('button'); }, { timeout: 8000 });
    await click(page, 'Tuần mấy chụp đẹp nhất?');
    const note = await page.waitForFunction(() => document.getElementById('chatBody').textContent.includes('32-36 tuần'), { timeout: 5000 }).then(() => true, () => false);
    log('  bấm nút AI viết lại chữ -> chạy đúng việc của lựa chọn đó ("Lưu ý khi chụp")', note);
    await page.close();
  }
  {
    const { page } = await suggestPage(() => ({ suggestions: [{ id: 'luu-y', label: 'Đến muộn' }] }), 6000);
    await page.waitForFunction(() => { const w = [...document.querySelectorAll('#chatBody .chat-quick')].pop(); return w && !w.classList.contains('is-loading') && w.querySelector('button'); }, { timeout: 9000 });
    const m1 = await lastMenu(page);
    await wait(4000);
    const m2 = await lastMenu(page);
    log('AI chậm quá 3 giây -> 2 nút mặc định, AI trả về muộn cũng không đổi nút dưới tay khách',
      JSON.stringify(m1) === JSON.stringify(['Báo giá & gói chụp', 'Gợi ý concept']) && JSON.stringify(m2) === JSON.stringify(m1), m1.join(' | ') + ' -> ' + m2.join(' | '));
    await page.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r).length;
  console.log('\n' + (failed === 0 ? 'TẤT CẢ TEST PASS' : failed + ' TEST FAIL') + ` (${results.length} case)`);
  process.exit(failed === 0 ? 0 : 1);
})();
