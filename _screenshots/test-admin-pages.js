// Khu quản trị Sếp / Sale mỗi lúc 1 mục (crm/js/admin-pages.js, 31/10/2026). Không cần máy chủ (file://).
// Chụp từng mục của Sếp ở 1440 + vài mục ở 390 vào _screenshots/admin-page-*.png.
//   node _screenshots/test-admin-pages.js
const path = require('path');
const puppeteer = require('puppeteer-core');
const env = require('./test-env');
let pass = 0, fail = 0;
const check = (n, ok, x) => { if (ok) { pass++; console.log('✓', n); } else { fail++; console.log('✗', n, x === undefined ? '' : '→ ' + JSON.stringify(x)); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const timer = setTimeout(() => { console.log('TIMEOUT'); process.exit(2); }, 120000);
  const browser = await env.launchAllFeatures(puppeteer, { executablePath: env.CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  try {
    for (const [role, phone] of [['sep', '0900000004'], ['sale', '0900000002']]) {
      const page = await browser.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
      await page.setRequestInterception(true); page.on('request', (r) => /^https?:/.test(r.url()) ? r.abort() : r.continue());
      await page.evaluateOnNewDocument((role, phone) => localStorage.setItem('aloha_auth', JSON.stringify({ role, phone, name: 'Test ' + role })), role, phone);
      await page.setViewport({ width: 1440, height: 900 });
      await page.goto(env.ROOT_URL + 'crm/admin.html', { waitUntil: 'domcontentloaded' }); await wait(1200);
      const links = await page.$$eval('#adminTabs a', (as) => as.map((a) => a.getAttribute('href')));
      for (const href of links) {
        await page.click('#adminTabs a[href="' + href + '"]'); await wait(500);
        const st = await page.evaluate((h) => {
          const vis = [...document.querySelectorAll('.admin-body .admin-section')].filter((s) => !s.hidden);
          return { ids: vis.map((s) => s.id || '(khối phụ)'), target: !!document.querySelector(h) && !document.querySelector(h).hidden, active: document.querySelector('#adminTabs a.active')?.getAttribute('href'), over: document.documentElement.scrollWidth > innerWidth, y: scrollY };
        }, href);
        check(role + ' ' + href + ': chỉ hiện mục đó (+ khối phụ), menu sáng đúng, về đầu trang', st.target && st.active === href && !st.over && st.y === 0 && st.ids.filter((x) => x !== '(khối phụ)' && x !== 'sale-team-section').length === 1, st);
        if (role === 'sep') await page.screenshot({ path: path.join(__dirname, 'admin-page-' + href.slice(1) + '.png') });
      }
      if (role === 'sep') {
        await page.click('#adminTabs a[href="#kpi"]'); await wait(1500);
        const charts = await page.evaluate(() => [...document.querySelectorAll('#kpi svg, #kpi canvas')].filter((e) => e.getBoundingClientRect().width > 50).length);
        check('Sếp Tổng quan: biểu đồ vẽ đủ bề ngang sau khi đổi mục', charts > 0, charts);
        await page.click('#adminTabs a[href="#doanh-thu"]'); await wait(1500);
        check('Sếp Doanh thu: biểu đồ có bề ngang', await page.evaluate(() => { const c = document.querySelector('#doanh-thu .rev-chart'); return !!c && c.getBoundingClientRect().width > 200; }));
        await page.evaluate(() => { location.hash = 'tin-nhan'; }); await wait(400);
        check('Link trong trang "#tin-nhan" đổi đúng mục', await page.evaluate(() => !document.getElementById('tin-nhan').hidden && document.getElementById('kpi').hidden));
        await page.setViewport({ width: 390, height: 844 });
        await page.evaluate(() => document.querySelector('#adminTabs a[href="#khach-hang"]').click()); await wait(500);
        check('390: không cuộn ngang', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: path.join(__dirname, 'admin-page-390-khach-hang.png') });
        await page.goto(env.ROOT_URL + 'crm/admin.html#lich-hen', { waitUntil: 'domcontentloaded' }); await wait(800);
        check('Mở thẳng link #lich-hen: hiện đúng mục', await page.evaluate(() => !document.getElementById('lich-hen').hidden && document.getElementById('kpi').hidden));
      }
      check(role + ': không lỗi JS', errors.length === 0, errors);
      await page.close();
    }
  } catch (e) { fail++; console.log('✗ Lỗi khi chạy:', e.message); }
  finally { clearTimeout(timer); await browser.close(); }
  console.log(`\n${pass}/${pass + fail} PASS admin pages`);
  process.exit(fail ? 1 : 0);
})();
