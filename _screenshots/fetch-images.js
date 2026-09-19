// Tải ảnh stock miễn phí bản quyền (Pexels License) đúng theo kết quả tìm kiếm
// thật (không lấy nhầm khối "Discover/Featured" cố định) - lọc qua a[href*="/photo/"].
const puppeteer = require('puppeteer-core');
const https = require('https');
const fs = require('fs');
const path = require('path');

const OUT_DIR = 'D:\\PhanTichWeb\\images';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const TARGETS = [
  { name: 'services-main', query: 'newborn baby photography studio session', index: 0 },
  { name: 'service-gia-dinh', query: 'family with newborn baby portrait', index: 0 },
  { name: 'service-newborn', query: 'newborn baby sleeping swaddle photography', index: 0 },
  { name: 'album-1', query: 'newborn baby studio portrait', index: 0 },
  { name: 'album-2', query: 'baby portrait photography close up', index: 0 },
  { name: 'album-3', query: 'mother holding newborn baby portrait', index: 0 },
  { name: 'album-4', query: 'pregnant belly maternity photography', index: 0 },
  { name: 'concept-bien', query: 'toddler playing beach sand', index: 1 },
  { name: 'concept-vintage', query: 'vintage style baby photography sepia', index: 0 }
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
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new', args: ['--no-sandbox']
  });

  for (const t of TARGETS) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36');
    try {
      const searchUrl = 'https://www.pexels.com/search/' + encodeURIComponent(t.query) + '/';
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 45000 });
      await new Promise(r => setTimeout(r, 2000));

      const results = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/photo/"]'));
        return links.map(a => {
          const img = a.querySelector('img');
          return { href: a.getAttribute('href'), src: img ? img.getAttribute('src') : null };
        }).filter(r => r.src);
      });

      const chosen = results[t.index];
      if (!chosen) {
        console.log('MISS - ' + t.name + ' :: ' + t.query);
        continue;
      }
      const cleanUrl = chosen.src.split('?')[0] + '?auto=compress&cs=tinysrgb&w=1200';
      const dest = path.join(OUT_DIR, t.name + '.jpg');
      await download(cleanUrl, dest);
      const size = fs.statSync(dest).size;
      console.log('OK - ' + t.name + '.jpg (' + Math.round(size / 1024) + ' KB) <- ' + chosen.href);
    } catch (e) {
      console.log('FAIL - ' + t.name + ' :: ' + e.message);
    }
    await ctx.close();
    await new Promise(r => setTimeout(r, 800));
  }

  await browser.close();
})();
