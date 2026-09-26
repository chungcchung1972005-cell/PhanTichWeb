// Lấy danh sách ảnh THẬT từ album Google Photos chia sẻ, ghi ra
// js/google-photos-data.js (dùng cho view "Ảnh của tôi", xem js/chon-anh.js)
// và js/google-photos-data.json. Chạy lại khi album thêm/bớt ảnh:
//   node _screenshots/fetch-google-photos.js
//
// Cách làm: trang chia sẻ của Google Photos nhúng sẵn dữ liệu album trong khối
// AF_initDataCallback({key: 'ds:1', ...}); mỗi ảnh có dạng
// [photoId, [urlGốc, rộng, cao, ...], ...]. urlGốc (lh3.googleusercontent.com/pw/AP1Gcz...)
// thêm hậu tố "=w..-h.." để lấy đúng kích thước cần.
const fs = require('fs');
const path = require('path');

const ALBUM_URL = 'https://photos.google.com/share/AF1QipO_gMEnUdlOWKT3MUoGnqmKfyJv0cCF-_ZzSF-m0uSQpXEHQL7zwCG4aBa86UP6UQ?key=U3dFWWNVZHREVTkzeURwQnRvTVJLMzQ5SVdhTUJR';

(async () => {
  const res = await fetch(ALBUM_URL, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
      'accept-language': 'vi,en'
    }
  });
  if (!res.ok) throw new Error('Không tải được album: HTTP ' + res.status);
  const html = await res.text();

  const keyAt = html.indexOf("key: 'ds:1'");
  if (keyAt < 0) throw new Error('Không thấy dữ liệu album (ds:1) - Google có thể đã đổi cấu trúc trang.');
  const start = html.indexOf('data:', keyAt) + 5;
  const end = html.indexOf(', sideChannel:', start);
  const data = JSON.parse(html.slice(start, end));
  const items = data[1] || [];
  if (data[2]) console.warn('CẢNH BÁO: album còn trang tiếp theo chưa lấy (album quá lớn), chỉ lấy được', items.length, 'ảnh đầu.');

  const photos = items
    .filter(it => Array.isArray(it) && Array.isArray(it[1]) && typeof it[1][0] === 'string')
    .map((it, i) => {
      const [base, w, h] = it[1];
      return {
        id: 'ph-' + (i + 1),
        photoId: it[0],
        width: w,
        height: h,
        thumb: `${base}=w480-h480-c`,       // ô vuông trong lưới
        medium: `${base}=w1600-h1600`,      // xem trong lightbox
        full: `${base}=w${w}-h${h}`         // kích thước gốc, dùng khi phóng to
      };
    });
  if (!photos.length) throw new Error('Không tìm thấy ảnh nào trong album.');

  // Kiểm tra nhanh 1 ảnh tải được thật
  const probe = await fetch(photos[0].thumb);
  if (!probe.ok || !String(probe.headers.get('content-type')).startsWith('image/')) {
    throw new Error('Link ảnh không tải được: HTTP ' + probe.status);
  }

  const root = path.resolve(__dirname, '..');
  const header = `// Tự sinh bởi _screenshots/fetch-google-photos.js - ${new Date().toISOString()}
// Album: ${ALBUM_URL.split('?')[0]}
// Tổng số ảnh: ${photos.length}
`;
  fs.writeFileSync(path.join(root, 'js/google-photos-data.js'),
    header + 'const GOOGLE_PHOTOS_DATA = ' + JSON.stringify(photos, null, 2) + ';\n', 'utf8');
  fs.writeFileSync(path.join(root, 'js/google-photos-data.json'), JSON.stringify(photos, null, 2) + '\n', 'utf8');
  console.log('Đã ghi', photos.length, 'ảnh vào js/google-photos-data.js và .json');
})().catch(err => { console.error(err.message); process.exit(1); });
