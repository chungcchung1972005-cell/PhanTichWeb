// Test "tầng nội dung" của Trang chủ (js/content.js, route #/noi-dung/<slug> trong js/router.js):
// thẻ Album -> album concept, ô Concept / Video / Tin tức / Giới thiệu / Chụp tại nhà -> trang chi tiết,
// ảnh + video mở lightbox dùng chung (js/albums.js), video dừng khi rời trang.
// Chạy: node _screenshots/test-content-pages.js (không cần server, không cần đăng nhập).
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const ROOT = 'D:/PhanTichWeb/';
const BASE = 'file:///' + ROOT + 'index.html';
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

const go = async (page, hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await wait(250); };
const contentState = (page) => page.evaluate(() => {
  const vis = (el) => !!el && !el.closest('[hidden]') && el.getClientRects().length > 0;
  const blocks = document.getElementById('contentBlocks');
  return {
    hash: location.hash,
    url: location.href,
    viewShown: !document.getElementById('view-content').hidden,
    homeHidden: document.getElementById('view-home').hidden,
    title: document.getElementById('contentTitle').textContent,
    docTitle: document.title,
    missing: vis(document.getElementById('contentMissing')),
    found: vis(document.getElementById('contentFound')),
    galleryItems: blocks.querySelectorAll('.gallery-item').length,
    videoItems: blocks.querySelectorAll('.gallery-item.is-video').length,
    albums: blocks.querySelectorAll('.concept-album').length,
    videos: blocks.querySelectorAll('video').length,
    related: document.querySelectorAll('#contentRelated .related-card').length,
    // Mọi file ảnh/video trang đang tham chiếu (kiểm tra tồn tại trên đĩa ở phía Node).
    files: Array.from(document.querySelectorAll('#view-content img, #view-content video')).flatMap((el) =>
      [el.getAttribute('src'), el.getAttribute('poster')]).filter(Boolean),
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    emDash: /—/.test(document.getElementById('contentFound').innerText)
  };
});
const missingFiles = (files) => files.filter((f) => !fs.existsSync(path.join(ROOT, decodeURI(f))));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required']
  });

  for (const vp of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true }]) {
    const { page, errors } = await openHome(browser, vp);
    const P = (s) => `[${vp.name}] ${s}`;
    const pages = await page.evaluate(() => window.AlohaContent.list);

    // 1) Link trên Trang chủ trỏ đúng tầng nội dung, không còn gate đăng nhập.
    const links = await page.evaluate(() => ({
      album: Array.from(document.querySelectorAll('#album .album-card')).map((a) => a.getAttribute('href')),
      concept: Array.from(document.querySelectorAll('#concept .concept-tile')).map((a) => a.getAttribute('href')),
      video: document.querySelector('.video-frame').getAttribute('href'),
      news: Array.from(document.querySelectorAll('#tin-tuc .news-more')).map((a) => a.getAttribute('href')),
      more: Array.from(document.querySelectorAll('#view-home .more-link')).map((a) => a.getAttribute('href'))
    }));
    log(P('6 thẻ Album đều là link #/album/<dịch vụ>/<concept>'), links.album.length === 6 && links.album.every((h) => /^#\/album\/[a-z-]+\/[a-z-]+$/.test(h)), links.album.join(' '));
    log(P('5 ô Concept đều là link #/noi-dung/concept-*'), links.concept.length === 5 && links.concept.every((h) => /^#\/noi-dung\/concept-/.test(h)));
    log(P('Khung Video, 3 bài Tin tức, 4 link "xem thêm" trỏ tới trang nội dung'),
      links.video === '#/noi-dung/mot-ngay-tai-aloha' && links.news.length === 3 && links.more.length === 4 &&
      [...links.news, ...links.more].every((h) => h.startsWith('#/noi-dung/')), [links.video, ...links.news, ...links.more].join(' '));
    const allSlugs = pages.map((p) => p.slug);
    const linkedSlugs = [...links.concept, links.video, ...links.news, ...links.more].map((h) => h.split('/').pop());
    log(P('Mọi link nội dung trên Trang chủ đều có trang tương ứng'), linkedSlugs.every((s) => allSlugs.includes(s)), linkedSlugs.filter((s) => !allSlugs.includes(s)).join(','));

    // 2) Bấm thẻ Album khi CHƯA đăng nhập -> mở album concept, không bị đẩy sang login.
    await page.evaluate(() => window.scrollTo(0, document.getElementById('album').offsetTop - 80));
    await wait(200);
    await page.click('#album .album-card:nth-child(2)');
    await wait(400);
    const albumSt = await page.evaluate(() => ({
      url: location.href, albumShown: !document.getElementById('view-album').hidden,
      title: document.getElementById('galleryTitle').textContent,
      items: document.querySelectorAll('#galleryGrid .gallery-item').length
    }));
    log(P('Bấm "Gia đình sum vầy" (chưa đăng nhập) mở album Nhiều thế hệ'), albumSt.albumShown && !albumSt.url.includes('login.html') && albumSt.items > 0 && albumSt.title === 'Nhiều thế hệ', albumSt.title + ' / ' + albumSt.items + ' ảnh');
    // Lightbox dùng chung (đã chuyển ra ngoài view album) vẫn chạy ở album.
    await page.click('#galleryGrid .gallery-item');
    await wait(200);
    const lbAlbum = await page.evaluate(() => ({ open: !document.getElementById('lightbox').hidden, img: !document.getElementById('lightboxImg').hidden, counter: document.getElementById('lightboxCounter').textContent }));
    await page.keyboard.press('Escape');
    log(P('Lightbox ở album vẫn mở ảnh bình thường'), lbAlbum.open && lbAlbum.img && /^1 \/ \d+$/.test(lbAlbum.counter), lbAlbum.counter);

    // 3) Bấm ô Concept trên Trang chủ -> trang concept chi tiết.
    await go(page, '#/');
    await page.evaluate(() => window.scrollTo(0, document.getElementById('concept').offsetTop - 80));
    await wait(200);
    await page.click('#concept .concept-tile:nth-child(2)');
    await wait(400);
    let st = await contentState(page);
    log(P('Bấm ô Noel mở trang Concept Giáng sinh, không cần đăng nhập'), st.viewShown && st.homeHidden && !st.url.includes('login.html') && st.title === 'Concept Giáng sinh (Noel)', st.title);
    log(P('Trang concept có video, album ảnh tham khảo, thẻ album, bài liên quan'), st.videos >= 1 && st.galleryItems > 0 && st.albums > 0 && st.related === 3, `video ${st.videos}, ảnh ${st.galleryItems}, album ${st.albums}, liên quan ${st.related}`);
    log(P('Tiêu đề tab theo trang nội dung'), st.docTitle === 'Concept Giáng sinh (Noel) | ALOHA Baby', st.docTitle);

    // 4) Mọi trang nội dung: render được, file ảnh/video tồn tại, không tràn ngang, không có em-dash.
    for (const p of pages) {
      await go(page, p.href);
      st = await contentState(page);
      const miss = missingFiles(st.files);
      log(P(`#/noi-dung/${p.slug}: hiển thị đủ, ${st.files.length} file ảnh/video đều tồn tại`), st.found && !st.missing && st.title === p.title && st.related > 0 && miss.length === 0 && !st.overflow && !st.emDash,
        (miss.length ? 'thiếu ' + miss.join(',') : '') + (st.overflow ? ' tràn ngang' : '') + (st.emDash ? ' có em-dash' : ''));
    }

    // 5) Lightbox trong trang nội dung: ảnh và video, chuyển bằng phím, Esc đóng.
    await go(page, '#/noi-dung/mot-ngay-tai-aloha');
    st = await contentState(page);
    await page.evaluate(() => document.querySelector('#contentBlocks .gallery-item.is-video').scrollIntoView());
    await page.click('#contentBlocks .gallery-item.is-video');
    await wait(300);
    let lb = await page.evaluate(() => ({
      open: !document.getElementById('lightbox').hidden,
      video: !document.getElementById('lightboxVideo').hidden && /\.mp4$/.test(document.getElementById('lightboxVideo').getAttribute('src') || ''),
      imgHidden: document.getElementById('lightboxImg').hidden,
      counter: document.getElementById('lightboxCounter').textContent,
      locked: document.body.classList.contains('lightbox-open')
    }));
    log(P('Bấm ô video trong album trang nội dung -> lightbox phát video'), lb.open && lb.video && lb.imgHidden && lb.locked, lb.counter);
    await page.evaluate(() => document.getElementById('lightboxClose').focus());
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
    await wait(200);
    lb = await page.evaluate(() => ({ imgShown: !document.getElementById('lightboxImg').hidden, videoHidden: document.getElementById('lightboxVideo').hidden, videoPaused: document.getElementById('lightboxVideo').paused, counter: document.getElementById('lightboxCounter').textContent }));
    log(P('Phím mũi tên chuyển sang ảnh, video ẩn và dừng'), lb.imgShown && lb.videoHidden && lb.videoPaused && lb.counter.startsWith('3 /'), lb.counter);
    await page.keyboard.press('Escape');
    await wait(150);
    lb = await page.evaluate(() => ({ open: !document.getElementById('lightbox').hidden, locked: document.body.classList.contains('lightbox-open') }));
    log(P('Esc đóng lightbox, mở lại cuộn trang'), !lb.open && !lb.locked);

    // 6) Video trong bài đang phát -> rời trang thì dừng (không phát tiếng ngầm).
    const played = await page.evaluate(async () => {
      const v = document.querySelector('#contentBlocks .content-video video');
      v.muted = true;
      try { await v.play(); } catch (e) { return 'play-error: ' + e.message; }
      return !v.paused;
    });
    await go(page, '#/');
    const pausedAfter = await page.evaluate(() => document.querySelector('#view-content .content-video video').paused);
    log(P('Video đang phát sẽ dừng khi quay về Trang chủ'), played === true && pausedAfter, String(played));

    // 7) Link bài liên quan + breadcrumb quay về đúng section Trang chủ.
    await go(page, '#/noi-dung/newborn-thoi-diem');
    await page.evaluate(() => document.querySelector('#contentRelated .related-card').click());
    await wait(300);
    st = await contentState(page);
    log(P('Bấm bài liên quan mở trang tương ứng, cuộn lên đầu'), st.found && st.title !== 'Nên chụp ảnh newborn cho bé vào thời điểm nào?' && (await page.evaluate(() => window.scrollY)) === 0, st.title);
    await go(page, '#/noi-dung/concept-vintage');
    await page.evaluate(() => document.querySelector('#contentCrumb a').click());
    await wait(1500);
    const crumb = await page.evaluate(() => ({ home: !document.getElementById('view-home').hidden, hash: location.hash, top: Math.round(document.getElementById('concept').getBoundingClientRect().top) }));
    log(P('Breadcrumb "Concept" về Trang chủ và cuộn tới section Concept'), crumb.home && Math.abs(crumb.top) < 200, JSON.stringify(crumb));

    // 8) Slug sai -> báo không tìm thấy; Đặt lịch trong trang nội dung vẫn bắt đăng nhập.
    await go(page, '#/noi-dung/khong-ton-tai');
    st = await contentState(page);
    log(P('Slug không tồn tại hiện "Không tìm thấy nội dung"'), st.missing && !st.found);
    await go(page, '#/noi-dung/huong-dan-dat-lich');
    await page.click('#contentFound .gallery-actions .btn-primary');
    // Router đổi hash trước rồi mới chuyển sang login.html -> chờ URL đổi hẳn (tối đa 5 giây).
    for (let i = 0; i < 25 && !page.url().includes('login.html'); i++) await wait(200);
    log(P('Nút Đặt lịch trong trang nội dung vẫn bắt đăng nhập như cũ'), page.url().includes('login.html?next=dat-lich'), page.url());

    // 9) Ô Tìm kiếm tìm được bài viết và mở đúng trang.
    await page.goto(BASE + '#/', { waitUntil: 'networkidle0' });
    if (vp.name === 'desktop') {
      await page.click('#searchBtn');
      await page.type('#searchInput', 'newborn khi nao');
      await wait(150);
      await page.evaluate(() => document.querySelector('#searchResults button').click());
      await wait(300);
      st = await contentState(page);
      log(P('Tìm "newborn khi nao" mở bài Nên chụp ảnh newborn...'), st.found && st.hash === '#/noi-dung/newborn-thoi-diem', st.hash);
    }

    log(P('Không có lỗi JavaScript'), errors.length === 0, errors.join(' | '));
    await page.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
