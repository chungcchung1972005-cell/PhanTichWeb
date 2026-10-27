const puppeteer = require('puppeteer-core');
const { CHROME_PATH, ROOT_URL, shot } = require('./test-env');

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const sizes = [{ name: 'mobile-320', width: 320, height: 700 }, { name: 'mobile-390', width: 390, height: 844 }, { name: 'desktop', width: 1440, height: 900 }];

  for (const size of sizes) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport(size);
    await page.goto(ROOT_URL + 'index.html', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 1800));

    const autoOpen = await page.$eval('#chatPanel', el => el.classList.contains('open'));
    await page.click('#chatToggle');
    await new Promise(resolve => setTimeout(resolve, 300));
    const opened = await page.$eval('#chatPanel', el => el.classList.contains('open') && el.getAttribute('aria-hidden') === 'false');
    await page.click('#chatClose');
    const closedByButton = await page.$eval('#chatPanel', el => !el.classList.contains('open') && el.getAttribute('aria-hidden') === 'true');
    await page.click('#chatToggle');
    await page.keyboard.press('Escape');
    const closedByEscape = await page.$eval('#chatPanel', el => !el.classList.contains('open'));
    const layout = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));

    await page.click('#chatToggle');
    await new Promise(resolve => setTimeout(resolve, 300));
    await page.screenshot({ path: shot(`chat-fixed-${size.name}.png`), fullPage: false });
    console.log(JSON.stringify({ size: size.name, autoOpen, opened, closedByButton, closedByEscape, layout, errors }));
    await page.close();
  }
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
