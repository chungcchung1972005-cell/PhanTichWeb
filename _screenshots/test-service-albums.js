// Test Hero Banner 5 dịch vụ + album 3 tầng (js/albums.js, route trong js/router.js):
//   Trang chủ -> #/album/<dịch vụ> (danh sách concept) -> #/album/<dịch vụ>/<concept> (ảnh).
// Chạy: node _screenshots/test-service-albums.js (không cần server, không cần đăng nhập).
const puppeteer = require('puppeteer-core');

const BASE = 'file:///D:/PhanTichWeb/index.html';
const results = [];
const log = (name, ok, extra) => { results.push({ name, ok }); console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name + (extra ? ' (' + extra + ')' : '')); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function openHome(browser, viewport) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setViewport(viewport);
  await page.goto(BASE + '#/', { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.removeItem('aloha_auth'));
  await page.reload({ waitUntil: 'networkidle0' });
  return { page, errors };
}

const visible = (el) => !!el && !el.closest('[hidden]') && el.getClientRects().length > 0;
const state = (page) => page.evaluate(() => {
  const vis = (el) => !!el && !el.closest('[hidden]') && el.getClientRects().length > 0;
  return {
    hash: location.hash,
    homeHidden: document.getElementById('view-home').hidden,
    albumHidden: document.getElementById('view-album').hidden,
    title: document.getElementById('galleryTitle').textContent,
    conceptsShown: vis(document.getElementById('galleryConcepts')),
    gridShown: vis(document.getElementById('galleryGrid')),
    upShown: vis(document.getElementById('galleryUp')),
    conceptCards: document.querySelectorAll('#galleryConcepts .concept-album').length,
    items: document.querySelectorAll('#galleryGrid .gallery-item').length,
    activeChip: (document.querySelector('.gallery-chip.active') || {}).textContent,
    missing: vis(document.getElementById('galleryMissing')),
    lightboxOpen: !document.getElementById('lightbox').hidden,
    bodyLocked: document.body.classList.contains('lightbox-open'),
    scrollY: window.scrollY,
    overflow: document.documentElement.scrollWidth > window.innerWidth
  };
});
const imgsLoaded = (page, sel) => page.evaluate((s) => Array.from(document.querySelectorAll(s)).every((i) => i.complete && i.naturalWidth > 0), sel);

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new', args: ['--no-sandbox']
  });

  for (const vp of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true }]) {
    const { page, errors } = await openHome(browser, vp);
    const services = await page.evaluate(() => window.AlohaAlbums.list);

    // 1) Hero Banner là section đầu tiên, nằm ngay dưới navbar, chiếm phần lớn màn hình đầu.
    const hero = await page.evaluate(() => {
      const first = document.querySelector('#view-home > section');
      const header = document.querySelector('.site-header').getBoundingClientRect();
      const r = first.getBoundingClientRect();
      const collage = document.querySelector('.svc-collage').getBoundingClientRect();
      return { id: first.id, cls: first.className, gap: Math.round(r.top - header.bottom), h1: document.querySelector('#view-home h1').textContent.trim(), h1Count: document.querySelectorAll('h1').length, visibleCollage: collage.top < window.innerHeight, height: r.height };
    });
    log(`[${vp.name}] Hero Banner 5 dịch vụ là section đầu tiên, ngay dưới navbar`, hero.id === 'dich-vu' && hero.cls.includes('svc-hero') && hero.gap === 0, `gap ${hero.gap}px`);
    log(`[${vp.name}] Tiêu đề h1 là "5 dịch vụ đồng hành cùng con lớn khôn", collage lộ ngay màn đầu`, hero.h1 === '5 dịch vụ đồng hành cùng con lớn khôn' && hero.visibleCollage);
    if (vp.name === 'desktop') log('[desktop] Hero chiếm gần trọn màn hình đầu', hero.height >= 900 - 112 - 10, `cao ${Math.round(hero.height)}px`);

    // 2) 5 ô dịch vụ đủ, trỏ đúng album, có số concept đọc từ dữ liệu album.
    const tiles = await page.evaluate(() => Array.from(document.querySelectorAll('.svc-tile')).map((t) => ({
      slug: t.dataset.album, href: t.getAttribute('href'), name: t.querySelector('.svc-tile-name').textContent,
      count: t.querySelector('[data-album-count]').textContent, imgOk: t.querySelector('img').naturalWidth > 0
    })));
    const tilesOk = tiles.length === 5 && tiles.every((t) => {
      const s = services.find((x) => x.slug === t.slug);
      return s && t.href === '#/album/' + t.slug && t.name === s.name && t.count === s.concepts.length + ' concept' && t.imgOk;
    });
    log(`[${vp.name}] 5 ô dịch vụ đủ tên, ảnh, số concept, trỏ đúng #/album/<dịch vụ>`, tilesOk);

    // 3) Mỗi dịch vụ -> danh sách concept album -> mỗi concept -> toàn bộ ảnh -> quay lên -> về trang chủ.
    for (const s of services) {
      await page.click(`.svc-tile[data-album="${s.slug}"]`);
      await wait(250);
      let st = await state(page);
      const coversOk = await imgsLoaded(page, '#galleryConcepts img');
      log(`[${vp.name}] Bấm "${s.name}" -> danh sách ${s.concepts.length} concept album`,
        st.hash === '#/album/' + s.slug && st.homeHidden && !st.albumHidden && st.title === 'Album ' + s.name &&
        st.conceptsShown && !st.gridShown && !st.upShown && st.conceptCards === s.concepts.length && st.activeChip === s.name && coversOk && !st.overflow,
        `${st.conceptCards} concept`);

      for (let i = 0; i < s.concepts.length; i++) {
        const c = s.concepts[i];
        await page.click(`#galleryConcepts .concept-album:nth-child(${i + 1})`);
        await wait(250);
        st = await state(page);
        const photosOk = await imgsLoaded(page, '#galleryGrid img');
        log(`[${vp.name}]   ${s.name} › "${c.name}" -> đủ ${c.count}/${c.count} ảnh, ảnh tải được`,
          st.hash === `#/album/${s.slug}/${c.slug}` && st.title === c.name && st.gridShown && !st.conceptsShown && st.upShown &&
          st.items === c.count && st.activeChip === c.name && photosOk && !st.overflow, `${st.items} ảnh`);
        await page.click('#galleryUp');
        await wait(250);
        st = await state(page);
        if (!(st.hash === '#/album/' + s.slug && st.conceptsShown)) log(`[${vp.name}]   "Tất cả concept" quay lên danh sách concept ${s.name}`, false, st.hash);
      }
      log(`[${vp.name}] "Tất cả concept" từ mọi concept của ${s.name} -> quay lên đúng danh sách`, true);

      await page.click('.gallery-header .gallery-back');
      await wait(250);
      st = await state(page);
      const heroTop = await page.evaluate(() => document.getElementById('dich-vu').getBoundingClientRect().top < window.innerHeight);
      log(`[${vp.name}] "Về trang chủ" từ album ${s.name} -> về Hero đầu trang`, st.hash === '#/' && !st.homeHidden && st.albumHidden && st.scrollY === 0 && heroTop);
    }

    // 4) Lightbox trong 1 concept: mở ảnh, chuyển ảnh, đóng.
    await page.goto(BASE + '#/album/newborn/cuon-u', { waitUntil: 'networkidle0' });
    const n = services.find((x) => x.slug === 'newborn').concepts.find((c) => c.slug === 'cuon-u').count;
    await page.click('#galleryGrid .gallery-item');
    await wait(150);
    let lb = await state(page);
    let counter = await page.$eval('#lightboxCounter', (el) => el.textContent);
    log(`[${vp.name}] Bấm ảnh mở lightbox xem lớn, khoá cuộn trang`, lb.lightboxOpen && lb.bodyLocked && counter === `1 / ${n}`);
    await page.click('#lightboxNext');
    counter = await page.$eval('#lightboxCounter', (el) => el.textContent);
    const nextOk = counter === `2 / ${n}`;
    await page.click('#lightboxPrev'); await page.click('#lightboxPrev');
    counter = await page.$eval('#lightboxCounter', (el) => el.textContent);
    log(`[${vp.name}] Nút ảnh sau/ảnh trước chuyển đúng, vòng về ảnh cuối`, nextOk && counter === `${n} / ${n}`);
    if (vp.name === 'desktop') {
      await page.keyboard.press('ArrowRight');
      counter = await page.$eval('#lightboxCounter', (el) => el.textContent);
      await page.keyboard.press('Escape');
      lb = await state(page);
      log('[desktop] Phím mũi tên chuyển ảnh, Esc đóng lightbox và mở khoá cuộn', counter === `1 / ${n}` && !lb.lightboxOpen && !lb.bodyLocked);
    } else {
      await page.click('#lightboxClose');
      lb = await state(page);
      log('[mobile] Nút đóng tắt lightbox và mở khoá cuộn', !lb.lightboxOpen && !lb.bodyLocked);
    }

    // 5) Chip ở tầng concept chuyển sang concept khác cùng dịch vụ; nút cuối trang quay lên danh sách concept.
    await page.click('.gallery-chip:last-child');
    await wait(200);
    let st = await state(page);
    const lastConcept = services.find((x) => x.slug === 'newborn').concepts.slice(-1)[0];
    log(`[${vp.name}] Chip chuyển thẳng sang concept khác cùng dịch vụ`, st.hash === '#/album/newborn/' + lastConcept.slug && st.activeChip === lastConcept.name);
    await page.click('#galleryUpBottom');
    await wait(200);
    st = await state(page);
    log(`[${vp.name}] Nút "Các concept Newborn" cuối trang quay lên danh sách concept`, st.hash === '#/album/newborn' && st.conceptsShown);

    // 6) Nút Back của trình duyệt khi đang mở lightbox -> lùi 1 tầng, không kẹt khoá cuộn.
    await page.click('#galleryConcepts .concept-album');
    await wait(200);
    await page.click('#galleryGrid .gallery-item');
    await wait(100);
    await page.goBack();
    await wait(250);
    st = await state(page);
    log(`[${vp.name}] Back của trình duyệt từ ảnh concept -> về danh sách concept, không kẹt lightbox`, st.hash === '#/album/newborn' && st.conceptsShown && !st.lightboxOpen && !st.bodyLocked);

    // 7) Link sai -> báo không tìm thấy, không vỡ trang.
    for (const bad of ['khong-co', 'newborn/khong-co']) {
      await page.goto(BASE + '#/album/' + bad, { waitUntil: 'networkidle0' });
      st = await state(page);
      log(`[${vp.name}] #/album/${bad} -> "Không tìm thấy album"`, st.missing);
    }

    // 8) Trang chủ không tràn ngang; các section khác vẫn còn đủ theo thứ tự.
    await page.goto(BASE + '#/', { waitUntil: 'networkidle0' });
    const home = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      order: Array.from(document.querySelectorAll('#view-home > section')).map((s) => s.id || s.className)
    }));
    log(`[${vp.name}] Trang chủ không tràn ngang, đủ section theo thứ tự mới`, !home.overflow &&
      home.order.join(',') === 'dich-vu,hero,album,concept,gioi-thieu,video,process,tin-tuc,cta-final', home.order.join(','));

    if (vp.name === 'mobile') {
      // Menu hamburger đang ĐÓNG: danh sách con "Dịch vụ" không được đè lên trang và cướp cú chạm
      // (lỗi thật đã gặp: chạm nút ở vùng giữa màn hình lại nhảy tới #dich-vu).
      const ctaHit = await page.$eval('.svc-hero-cta .btn-primary', (b) => {
        const r = b.getBoundingClientRect();
        return b.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      });
      log('[mobile] Menu đóng: nút "Đặt lịch chụp ngay" trong Hero nhận đúng cú chạm', ctaHit);
      await page.click('#navToggle');
      await wait(350);
      const menu = await page.evaluate(() => {
        const link = Array.from(document.querySelectorAll('.nav-links .dropdown a')).find((a) => a.textContent.includes('Newborn'));
        const r = link.getBoundingClientRect();
        return { open: document.getElementById('navLinks').classList.contains('open'), hit: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === link };
      });
      log('[mobile] Menu mở: danh sách con "Dịch vụ" hiện và bấm được', menu.open && menu.hit);
      await page.click('#navToggle');
      await wait(350);
    }

    log(`[${vp.name}] Không có lỗi JavaScript`, errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // 9) Ô tìm kiếm "Chụp ảnh Newborn" vẫn cuộn tới đúng ô Newborn trong Hero (goHomeThenFind).
  {
    const { page } = await openHome(browser, { width: 1440, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 3000));
    await page.click('#searchBtn');
    await page.type('#searchInput', 'Newborn');
    await page.click('#searchResults button');
    await wait(900);
    const inView = await page.evaluate(() => {
      const el = document.querySelector('.svc-tile--newborn .svc-tile-name').getBoundingClientRect();
      return el.top >= 0 && el.bottom <= window.innerHeight;
    });
    log('Tìm kiếm "Newborn" vẫn cuộn tới ô Newborn trong Hero', inView);
    await page.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log('\n' + (failed.length === 0 ? 'TẤT CẢ TEST PASS' : failed.length + ' TEST FAIL') + ` (${results.length} case)`);
  process.exit(failed.length === 0 ? 0 : 1);
})();
