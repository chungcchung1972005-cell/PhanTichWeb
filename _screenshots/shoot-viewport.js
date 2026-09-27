const { CHROME_PATH, ROOT_URL, shot } = require('./test-env');
const puppeteer = require('puppeteer-core');
const targets = [
  { name: 'top-desktop', width: 1440, height: 900 },
  { name: 'top-tablet', width: 834, height: 900 },
  { name: 'top-mobile', width: 390, height: 844 },
];
(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new', args: ['--no-sandbox']
  });
  for (const t of targets) {
    const page = await browser.newPage();
    await page.setViewport({ width: t.width, height: t.height });
    await page.goto(ROOT_URL + 'index.html', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 900));
    await page.screenshot({ path: shot(`final-${t.name}.png`) });
    await page.close();
  }
  await browser.close();
})();
