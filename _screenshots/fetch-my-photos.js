const { CHROME_PATH, fromRoot } = require('./test-env');
// Tải 16 ảnh newborn thật (Pexels License, miễn phí thương mại) làm ảnh "gốc"
// cho buổi chụp demo của tài khoản khách hàng mẫu trong chon-anh.html.
const puppeteer = require('puppeteer-core');
const https = require('https');
const fs = require('fs');
const path = require('path');

const OUT_DIR = fromRoot('images', 'my-photos');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const QUERIES = [
  'newborn baby portrait studio',
  'newborn baby sleeping photography',
  'newborn baby close up hands',
  'newborn baby wrapped blanket',
  'newborn baby with parents',
  'newborn baby feet close up',
  'newborn baby black and white photography',
  'newborn baby yawning photography'
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new', args: ['--no-sandbox']
  });

  let photoIndex = 1;
  for (const query of QUERIES) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36');
    try {
      await page.goto('https://www.pexels.com/search/' + encodeURIComponent(query) + '/', { waitUntil: 'networkidle2', timeout: 45000 });
      await new Promise(r => setTimeout(r, 2000));
      const results = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/photo/"]'));
        return links.map(a => {
          const img = a.querySelector('img');
          return { href: a.getAttribute('href'), src: img ? img.getAttribute('src') : null };
        }).filter(r => r.src);
      });
      // Lấy 2 ảnh khác nhau từ mỗi truy vấn để đủ 16 ảnh từ 8 query
      for (const idx of [0, 1]) {
        const chosen = results[idx];
        if (!chosen) { console.log('MISS', query, idx); continue; }
        const cleanUrl = chosen.src.split('?')[0] + '?auto=compress&cs=tinysrgb&w=900';
        const dest = path.join(OUT_DIR, 'photo-' + photoIndex + '.jpg');
        await download(cleanUrl, dest);
        console.log('OK photo-' + photoIndex + '.jpg <- ' + chosen.href);
        photoIndex++;
      }
    } catch (e) {
      console.log('FAIL', query, e.message);
    }
    await ctx.close();
    await new Promise(r => setTimeout(r, 700));
  }

  await browser.close();
})();
