// Audit responsive: chụp + kiểm tra overflow ngang ở nhiều kích thước cho
// mọi màn hình thật (kể cả các view cần đăng nhập) — không sửa gì, chỉ khảo sát.
const puppeteer = require('puppeteer-core');

const BASE = 'file:///D:/PhanTichWeb/';
const ACCOUNTS = {
  'khach-hang': { phone: '0900000001', password: 'khach123' },
  'sale': { phone: '0900000002', password: 'sale123' },
  'tho-anh': { phone: '0900000003', password: 'anh123' },
  'sep': { phone: '0900000004', password: 'sep123' }
};

const SIZES = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'small-320', width: 320, height: 700 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 900 },
];

async function loginAs(page, role) {
  const acc = ACCOUNTS[role];
  await page.goto(BASE + 'login.html', { waitUntil: 'networkidle0' });
  await page.type('#loginPhone', acc.phone);
  await page.type('#loginPassword', acc.password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('.login-submit')
  ]);
}

async function checkOverflow(page) {
  return page.evaluate(() => {
    const bad = [];
    const docW = document.documentElement.clientWidth;
    document.querySelectorAll('body *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > docW + 2 && r.width > 0) {
        bad.push({
          tag: el.tagName,
          cls: (el.className && el.className.toString().slice(0, 60)) || '',
          right: Math.round(r.right),
          width: Math.round(r.width)
        });
      }
    });
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: docW,
      overflowEls: bad.slice(0, 8)
    };
  });
}

async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = 400;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo({ top: y, left: 0, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 250));
  });
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox']
  });

  const targets = [
    { name: 'home', setup: async (page) => { await page.goto(BASE + 'index.html', { waitUntil: 'networkidle0' }); } },
    { name: 'dat-lich', setup: async (page) => {
        await loginAs(page, 'khach-hang');
        await page.goto(BASE + 'index.html#/dat-lich', { waitUntil: 'networkidle0' });
        await new Promise(r => setTimeout(r, 200));
      } },
    { name: 'chon-anh', setup: async (page) => {
        await loginAs(page, 'khach-hang');
        await page.goto(BASE + 'index.html#/chon-anh', { waitUntil: 'networkidle0' });
        await new Promise(r => setTimeout(r, 200));
      } },
    { name: 'login', setup: async (page) => { await page.goto(BASE + 'login.html', { waitUntil: 'networkidle0' }); } },
    { name: 'admin-sep', setup: async (page) => { await loginAs(page, 'sep'); } },
    { name: 'admin-sale', setup: async (page) => { await loginAs(page, 'sale'); } },
    { name: 'admin-thoanh', setup: async (page) => { await loginAs(page, 'tho-anh'); } },
  ];

  for (const t of targets) {
    for (const s of SIZES) {
      const page = await browser.newPage();
      const consoleErrors = [];
      page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));
      await page.setViewport({ width: s.width, height: s.height });
      await t.setup(page);
      await scrollThrough(page);
      const overflow = await checkOverflow(page);
      const flag = overflow.scrollWidth > overflow.clientWidth + 2 ? '*** OVERFLOW ***' : 'ok';
      console.log(`${t.name} / ${s.name}: ${flag} (scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth})`);
      if (overflow.overflowEls.length) {
        overflow.overflowEls.forEach(e => console.log(`    - <${e.tag} class="${e.cls}"> right=${e.right} width=${e.width}`));
      }
      if (consoleErrors.length) console.log('    console errors:', consoleErrors.slice(0, 3));
      await page.screenshot({ path: `D:\\PhanTichWeb\\_screenshots\\audit-${t.name}-${s.name}.png`, fullPage: true });
      await page.close();
    }
  }

  await browser.close();
})();
