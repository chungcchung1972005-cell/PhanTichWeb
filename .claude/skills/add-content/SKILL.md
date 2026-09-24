---
name: add-content
description: Quy trình thêm nội dung cho website ALOHA Baby — thêm ảnh vào album concept, thêm concept mới, thêm trang nội dung/bài viết (#/noi-dung/...), thêm video, tải ảnh/video stock mới. Dùng khi người dùng yêu cầu "thêm ảnh", "thêm concept", "đa dạng ảnh", "viết bài", "thêm video", "thêm nội dung chi tiết".
---

# Add Content — ALOHA Baby

Nội dung là **dữ liệu trong file JS**, không phải HTML. Thêm nội dung = sửa mảng dữ liệu, không sửa `index.html`/CSS (trừ khi thêm link mới trên Trang chủ).

| Muốn thêm | Sửa ở đâu |
|---|---|
| Ảnh vào 1 concept album | `js/albums.js` → mảng `photos` của concept |
| Concept mới cho 1 dịch vụ | `js/albums.js` → mảng `concepts` của dịch vụ |
| Trang nội dung / bài viết / trang concept chi tiết | `js/content.js` → mảng `PAGES` |
| Video | file vào `images/videos/`, rồi dùng trong khối `video`/`gallery` của `js/content.js` |

## 1. Ảnh và concept album (`js/albums.js`)

- Chép ảnh vào `images/albums/<dịch vụ>/<concept>/<concept>-NN.jpg` (slug viết thường, không dấu, nối gạch ngang; rộng ~1000px để nhẹ repo).
- Thêm đường dẫn vào `photos` của đúng concept: chuỗi `'images/albums/...jpg'` hoặc `{ src, alt }` nếu cần mô tả riêng. Không giới hạn số ảnh; ảnh đầu tiên là ảnh bìa concept.
- Concept mới: thêm `{ slug, name, desc, photos: [...] }` vào `concepts`. Concept chưa có ảnh tự ẩn. Số concept trên Hero, chatbot ("Concept & ảnh mẫu") và trang nội dung dùng `lookup()` đều **tự cập nhật** vì đọc từ `window.AlohaAlbums`.
- Concept mới nên thêm vào: `SERVICE_INFO.concepts` trong `server/server.js` (để AI biết), và nếu có từ khoá riêng thì `CONCEPT_KEYWORDS` trong `js/script.js` (để chat gõ tự do gắn nút mở album).

## 2. Trang nội dung (`js/content.js`)

Thêm 1 object vào `PAGES`: `{ slug, crumb: { label, href }, eyebrow, title, lead, cover | coverFrom | thumb, blocks: [...], related: [...] }`. Loại khối và ý nghĩa từng trường: xem comment đầu file `js/content.js`. Mẹo:
- Ảnh gallery lấy thẳng từ album bằng `from: ['dịch vụ/concept', ...]` thay vì chép đường dẫn; `limit` để giới hạn số ô.
- Thẻ dẫn sang album: khối `{ type: 'albums', refs: [...] }` (ref chỉ có dịch vụ = thẻ dịch vụ).
- Link tới trang: `#/noi-dung/<slug>`. Thêm link trên Trang chủ thì dùng class `.more-link` (đã có style); nên thêm mục vào `SEARCH_INDEX` trong `js/script.js` để ô Tìm kiếm tìm được.
- Nhớ thêm `related` (2-3 trang) để khách đi tiếp.

## 3. Tải ảnh/video stock mới

- Chỉ dùng nguồn cho phép dùng thương mại (Pexels License). **Không** tải ảnh từ alohababy.vn hay web khác.
- Ảnh album: sửa `TARGETS` (từ khoá tìm kiếm tiếng Anh cho từng concept) trong `_screenshots/fetch-album-photos.js` rồi chạy `node _screenshots/fetch-album-photos.js [số ảnh] [độ rộng]` — concept đã có ảnh sẽ bị bỏ qua; nguồn tự ghi vào `images/albums/sources.json`.
- Video: trang tìm `https://www.pexels.com/search/videos/<từ khoá>/` (Puppeteer) có link mp4 trực tiếp; bản 720p thường có dạng `.../video-files/<id>/<fileId>_720_1280_<fps>fps.mp4` (dò bằng `curl -r 0-0`). Lưu vào `images/videos/<ten>.mp4` + poster `<ten>.jpg` (`https://images.pexels.com/videos/<id>/pexels-photo-<id>.jpeg?w=720`), ghi nguồn vào `images/videos/sources.json`. Giữ video ngắn, 720p (vài MB).
- **Bắt buộc xem lại bằng mắt trước khi dùng:** ảnh → contact sheet (ghép nhiều ảnh vào 1 trang HTML rồi chụp bằng Puppeteer); video → trích 4 khung hình ở 5/30/55/80% thời lượng. Loại ảnh: sai chủ đề (vd "gia đình" không có trẻ em), trang phục hở/nhạy cảm, nhiều tấm gần giống nhau cùng 1 buổi chụp, trùng concept khác, có chữ/logo/watermark.

## 4. Quy tắc nội dung

- Viết lại bằng lời của mình, không copy câu chữ marketing của web khác; không dùng em-dash "—" trong chữ hiển thị.
- **Không đặt số liệu nghiệp vụ chưa chốt** (mức cọc, thời gian giữ chỗ, chính sách dời/hủy, đơn giá ảnh vượt gói...) → ghi "theo chính sách hiện hành, Sale báo rõ" (danh sách: `rules/tech-defaults.md`). Không bịa số liệu (số khách, đánh giá...).
- Trang có ảnh/video stock phải có ghi chú "tư liệu minh hoạ, không phải khách hàng thật" (hằng `NOTE_STOCK` trong `js/content.js`). Không bao giờ dùng ảnh "Ảnh của tôi" (`images/my-photos/`) ở trang công khai.
- Mô tả tính năng trong bài viết phải khớp đúng web thật (vd Đặt lịch hiện có 3 bước: Dịch vụ → Ngày & giờ → Thông tin bé & xác nhận, sau đó Sale liên hệ đặt cọc) — đọc code/view tương ứng trước khi viết.

## 5. Kiểm tra trước khi báo xong

- `node _screenshots/test-content-pages.js` (kiểm tra mọi trang trong `PAGES`: hiển thị, file ảnh/video tồn tại, không tràn ngang, không em-dash, lightbox, video dừng khi rời trang) và `node _screenshots/test-service-albums.js` (mọi concept album tải đủ ảnh). Thêm trang/concept mới thì 2 test này tự bao phủ, không cần sửa test.
- Chụp màn hình desktop + mobile theo skill `verify-ui-change` (cuộn hết trang để ảnh lazy tải xong trước khi chụp).
- Báo lại cho người dùng: đã thêm gì, số ảnh/video, file đã sửa, và cách tự thêm tiếp.
