const { CHROME_PATH } = require('./test-env');
// Xuất PNG từ images/logo-mark.svg cho những nơi không nhận SVG:
//   images/apple-touch-icon.png (180x180, icon khi lưu web ra màn hình iPhone)
//   images/favicon-32.png (32x32, favicon dự phòng cho trình duyệt cũ)
// Chạy lại mỗi khi sửa logo-mark.svg: node _screenshots/make-logo-png.js
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const IMAGES = path.join(__dirname, '..', 'images');
const svg = fs.readFileSync(path.join(IMAGES, 'logo-mark.svg'), 'utf8');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new', args: ['--no-sandbox']
  });
  for (const [file, size, pad] of [['apple-touch-icon.png', 180, 0], ['favicon-32.png', 32, 0]]) {
    const page = await browser.newPage();
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.setContent(`<html><body style="margin:0;background:transparent">
      <div style="width:${size}px;height:${size}px;padding:${pad}px;box-sizing:border-box">${svg.replace('<svg ', `<svg width="${size - pad * 2}" height="${size - pad * 2}" `)}</div></body></html>`);
    await page.screenshot({ path: path.join(IMAGES, file), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
    console.log('OK - images/' + file);
  }
  await browser.close();
})();
