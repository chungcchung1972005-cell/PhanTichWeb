// Tải ảnh stock miễn phí bản quyền (Pexels License, dùng thương mại được, không bắt
// buộc ghi nguồn) cho album concept (js/albums.js). Mỗi concept 1 từ khoá tìm kiếm,
// lấy N ảnh đầu tiên trong KẾT QUẢ TÌM KIẾM thật (lọc a[href*="/photo/"], giống
// fetch-images.js), bỏ ảnh trùng giữa các concept theo id ảnh Pexels.
// Ảnh lưu tại images/albums/<dịch vụ>/<concept>/<concept>-NN.jpg, nguồn từng ảnh
// ghi vào images/albums/sources.json. Sau khi tải PHẢI xem lại bằng mắt (contact
// sheet) và loại ảnh sai chủ đề trước khi đưa vào js/albums.js.
// Chạy: node _screenshots/fetch-album-photos.js [số ảnh mỗi concept, mặc định 8] [độ rộng px, mặc định 1000]
const puppeteer = require('puppeteer-core');
const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = 'D:\\PhanTichWeb\\images\\albums';
const PER_CONCEPT = Number(process.argv[2]) || 8;
// Độ rộng ảnh tải về (px). Đợt 1 dùng 1200, từ đợt 2 dùng 1000 cho nhẹ repo.
const WIDTH = Number(process.argv[3]) || 1000;

const TARGETS = [
  { service: 'newborn', concept: 'cuon-u', query: 'newborn baby wrapped swaddle photography' },
  { service: 'newborn', concept: 'tu-nhien', query: 'newborn baby photography basket props' },
  { service: 'newborn', concept: 'cung-bo-me', query: 'parents holding newborn baby photoshoot' },
  { service: 'bau', concept: 'ngoai-canh', query: 'pregnant woman maternity photoshoot outdoor nature' },
  { service: 'bau', concept: 'vintage', query: 'maternity photoshoot studio gown' },
  { service: 'bau', concept: 'toi-gian', query: 'pregnant woman minimalist studio portrait' },
  { service: 'sinh-nhat', concept: 'bong-bay', query: 'baby first birthday balloons' },
  { service: 'sinh-nhat', concept: 'le-hoi', query: 'baby christmas photoshoot' },
  { service: 'sinh-nhat', concept: 'pastel', query: 'baby cake smash pastel' },
  { service: 'be-lon', concept: 'ngoai-canh', query: 'toddler playing outdoors park' },
  { service: 'be-lon', concept: 'han-quoc', query: 'child wearing hanbok' },
  { service: 'be-lon', concept: 'vintage', query: 'vintage child portrait black and white' },
  { service: 'gia-dinh', concept: 'dong-phuc', query: 'family matching outfits photoshoot studio' },
  { service: 'gia-dinh', concept: 'ngoai-canh', query: 'family photoshoot park with kids' },
  { service: 'gia-dinh', concept: 'vintage', query: 'family portrait cozy home' },
  // Đợt 2: thêm concept cho đa dạng (người dùng yêu cầu 2026-09-25).
  { service: 'newborn', concept: 'hoa-la', query: 'newborn baby flowers photography' },
  { service: 'newborn', concept: 'thu-ngo-nghinh', query: 'newborn baby animal costume photoshoot' },
  { service: 'newborn', concept: 'den-trang', query: 'newborn baby black and white photography' },
  { service: 'newborn', concept: 'trang-sao', query: 'newborn baby moon stars photography' },
  { service: 'bau', concept: 'cung-chong', query: 'pregnant couple maternity photoshoot' },
  { service: 'bau', concept: 'cung-be', query: 'pregnant mother with toddler maternity' },
  { service: 'bau', concept: 'vong-hoa', query: 'maternity photoshoot flower crown' },
  { service: 'bau', concept: 'bien', query: 'maternity photoshoot beach' },
  { service: 'sinh-nhat', concept: 'trung-thu', query: 'children mid autumn festival lantern' },
  { service: 'sinh-nhat', concept: 'cong-chua', query: 'little girl princess dress birthday' },
  { service: 'sinh-nhat', concept: 'tiec-gia-dinh', query: 'kids birthday party family celebration' },
  { service: 'sinh-nhat', concept: 'picnic', query: 'child birthday picnic outdoor' },
  { service: 'be-lon', concept: 'ao-dai', query: 'vietnamese child ao dai' },
  { service: 'be-lon', concept: 'nghe-nghiep', query: 'child dress up costume profession' },
  { service: 'be-lon', concept: 'mua-thu', query: 'child autumn leaves portrait' },
  { service: 'be-lon', concept: 'the-thao', query: 'kid playing sports outdoor' },
  { service: 'gia-dinh', concept: 'bien', query: 'family beach photoshoot with kids' },
  { service: 'gia-dinh', concept: 'nhieu-the-he', query: 'grandparents with grandchildren family portrait' },
  { service: 'gia-dinh', concept: 'anh-chi-em', query: 'siblings portrait photoshoot' },
  { service: 'gia-dinh', concept: 'da-ngoai', query: 'family picnic with children' }
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
  const sourcesPath = path.join(ROOT, 'sources.json');
  const sources = fs.existsSync(sourcesPath) ? JSON.parse(fs.readFileSync(sourcesPath, 'utf8')) : {};
  const usedIds = new Set(Object.values(sources).map((s) => s.pexelsId));

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new', args: ['--no-sandbox']
  });

  for (const t of TARGETS) {
    const dir = path.join(ROOT, t.service, t.concept);
    // Concept đã có ảnh thì bỏ qua (không ghi đè ảnh đã duyệt). Muốn tải lại: xoá thư mục đó trước.
    if (fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith('.jpg'))) { console.log('SKIP - ' + t.service + '/' + t.concept + ' (đã có ảnh)'); continue; }
    fs.mkdirSync(dir, { recursive: true });
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36');
    try {
      await page.goto('https://www.pexels.com/search/' + encodeURIComponent(t.query) + '/', { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise((r) => setTimeout(r, 2000));
      await page.evaluate(() => window.scrollBy(0, 2500));
      await new Promise((r) => setTimeout(r, 1500));
      const results = await page.evaluate(() => {
        const seen = new Set();
        return Array.from(document.querySelectorAll('a[href*="/photo/"]')).map((a) => {
          const img = a.querySelector('img');
          const m = (a.getAttribute('href') || '').match(/-(\d+)\/?$/);
          return { href: a.getAttribute('href'), id: m ? m[1] : null, src: img ? img.getAttribute('src') : null, alt: img ? img.getAttribute('alt') : '' };
        }).filter((r) => r.src && r.id && r.src.includes('images.pexels.com') && !seen.has(r.id) && seen.add(r.id));
      });

      let saved = 0;
      for (const r of results) {
        if (saved >= PER_CONCEPT) break;
        if (usedIds.has(r.id)) continue;
        const file = `${t.concept}-${String(saved + 1).padStart(2, '0')}.jpg`;
        const dest = path.join(dir, file);
        await download(r.src.split('?')[0] + '?auto=compress&cs=tinysrgb&w=' + WIDTH, dest);
        usedIds.add(r.id);
        sources[`${t.service}/${t.concept}/${file}`] = { pexelsId: r.id, page: 'https://www.pexels.com' + r.href, alt: r.alt, query: t.query };
        saved++;
      }
      console.log(`OK - ${t.service}/${t.concept}: ${saved} ảnh (tìm thấy ${results.length})`);
    } catch (e) {
      console.log(`FAIL - ${t.service}/${t.concept} :: ${e.message}`);
    }
    await ctx.close();
    await new Promise((r) => setTimeout(r, 800));
  }

  fs.writeFileSync(sourcesPath, JSON.stringify(sources, null, 2));
  await browser.close();
})();
