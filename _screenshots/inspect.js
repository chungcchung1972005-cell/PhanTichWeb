const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 700 });
  await page.goto('file:///D:/PhanTichWeb/index.html', { waitUntil: 'networkidle0' });

  const info = await page.evaluate(() => {
    function rectOf(sel) {
      const el = document.querySelector(sel);
      if (!el) return { sel, found: false };
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        sel, found: true,
        rect: { x: r.x, y: r.y, w: r.width, h: r.height },
        display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
        flexShrink: cs.flexShrink, position: cs.position, zIndex: cs.zIndex
      };
    }
    return {
      nav: rectOf('.nav'),
      logo: rectOf('.logo'),
      navLinks: rectOf('.nav-links'),
      navActions: rectOf('.nav-actions'),
      iconBtns: Array.from(document.querySelectorAll('.icon-btn')).map(el => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return { rect: { x: r.x, y: r.y, w: r.width, h: r.height }, display: cs.display };
      }),
      navToggle: rectOf('.nav-toggle'),
      bodyWidth: document.body.getBoundingClientRect().width,
      docScrollWidth: document.documentElement.scrollWidth,
      windowInnerWidth: window.innerWidth
    };
  });

  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
