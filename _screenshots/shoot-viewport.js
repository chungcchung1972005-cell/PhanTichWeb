const puppeteer = require('puppeteer-core');
const targets = [
  { name: 'top-desktop', width: 1440, height: 900 },
  { name: 'top-tablet', width: 834, height: 900 },
  { name: 'top-mobile', width: 390, height: 844 },
];
(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new', args: ['--no-sandbox']
  });
  for (const t of targets) {
    const page = await browser.newPage();
    await page.setViewport({ width: t.width, height: t.height });
    await page.goto('file:///D:/PhanTichWeb/index.html', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 900));
    await page.screenshot({ path: `D:\\PhanTichWeb\\_screenshots\\final-${t.name}.png` });
    await page.close();
  }
  await browser.close();
})();
