---
name: verify-ui-change
description: Quy trình xác minh giao diện sau khi code hoặc sửa bất kỳ màn hình nào trên dự án ALOHA Baby — chụp screenshot, so sánh với 4 ảnh thiết kế gốc, kiểm tra mobile-friendly và animation khi scroll. Dùng skill này sau mỗi thay đổi UI lớn, trước khi báo hoàn thành task.
---

# Verify UI Change — ALOHA Baby

Sau mỗi thay đổi giao diện lớn (thêm/sửa một trang, một component, một luồng có UI), thực hiện đủ các bước sau trước khi báo hoàn thành:

1. **Chụp screenshot** bằng công cụ Puppeteer đã thiết lập sẵn tại `_screenshots/` (xem "Công cụ chụp ảnh" bên dưới) — không dùng `chrome --headless --screenshot` CLI trực tiếp, đã xác nhận cho kết quả sai lệch trên máy này.
2. **So sánh với thiết kế gốc:** đối chiếu screenshot với 4 ảnh tham chiếu (`w (1).jpg` – `w (4).jpg` ở thư mục gốc dự án) theo tiêu chí trong `rules/design.md` — màu sắc (hồng/rose + trắng + navy), bố cục dạng card, typography, bo góc, component pattern. Nêu rõ điểm khớp/lệch cụ thể, không chỉ kết luận chung chung "giống" hay "ổn".
3. **Kiểm tra mobile-friendly:** chụp ở tối thiểu 3 kích thước (mobile ~390px, tablet ~834px, desktop ~1440px). Đừng chỉ nhìn ảnh — đọc thêm `document.documentElement.scrollWidth` so với `clientWidth` (script `shoot.js` đã tự log điều này); nếu `scrollWidth > clientWidth` là có tràn ngang thật, kể cả khi ảnh chụp trông có vẻ ổn.
4. **Kiểm tra animation khi scroll:** dùng `shoot.js` (đã tự cuộn chậm qua toàn trang trước khi chụp) để đảm bảo animation `.reveal`/`.stagger-item` có đủ thời gian hoàn tất — chụp ngay lập tức sau khi load sẽ cho thấy nhiều phần tử ở trạng thái "chưa hiện" (mờ/lệch vị trí) và dễ bị hiểu nhầm là lỗi.
5. Nếu phát hiện lệch thiết kế gốc, hoặc thiếu responsive/animation → sửa trước khi báo hoàn thành. Không báo "xong" khi bước kiểm tra ở trên còn phát hiện vấn đề (nguyên tắc trong `CLAUDE.md`).

## Công cụ chụp ảnh (đã thiết lập, dùng lại thay vì viết mới)

Máy này **không có** `chromium-cli` (theo gợi ý mặc định của skill `run`) và **không có** Playwright cài sẵn — chỉ có Chrome tại `C:\Program Files\Google\Chrome\Application\chrome.exe` và Node.js. Đã cài `puppeteer-core` cục bộ trong `_screenshots/` (package.json riêng, không phải dependency của website) để điều khiển Chrome đó qua `executablePath`.

- `_screenshots/shoot.js` — chụp full-page ở 3 kích thước (desktop 1440, tablet 834, mobile 390), tự cuộn chậm qua toàn trang trước khi chụp (để animation kịp hoàn tất) và tự log cảnh báo tràn ngang. Kết quả: `_screenshots/final-{desktop,tablet,mobile}.png`.
- `_screenshots/shoot-viewport.js` — chụp đúng viewport đầu trang (không cuộn), dùng để xem chính xác header/nav. **Bắt buộc dùng bản này khi cần đánh giá nav/header** — bản full-page của Puppeteer "đóng băng" `position: sticky` tại vị trí cuộn cuối cùng thay vì luôn ở trên cùng, nên ảnh full-page thường cho thấy nav ở giữa trang thay vì đầu trang (không phải lỗi thật).
- Chạy: `cd _screenshots && node shoot.js` hoặc `node shoot-viewport.js`. Chỉnh sửa URL trong file nếu cần chụp trang khác `index.html`.
- `_screenshots/inspect.js` — khi ảnh chụp gây nghi ngờ (phần tử "biến mất" không rõ lý do), đừng đoán qua ảnh nhiều lần — sửa script này để `page.evaluate(() => el.getBoundingClientRect() + getComputedStyle(el))` cho phần tử nghi vấn. Đây là cách duy nhất đã chứng minh đáng tin cậy trên máy này để xác nhận một phần tử thực sự bị ẩn/tràn hay chỉ là ảnh chụp bị lỗi.

## Bài học từ lần build `index.html` đầu tiên

- `chrome --headless=new --screenshot=... --window-size=W,H` qua CLI từng cho ảnh chụp thiếu hẳn cả một nhóm phần tử (nav-actions) dù `getBoundingClientRect()` qua Puppeteer xác nhận chúng render đúng vị trí, đúng kích thước, không bị tràn. Không tự tin kết luận "lỗi UI" chỉ từ một kiểu chụp ảnh — nếu kết quả trông vô lý (phần tử biến mất hoàn toàn, không phải bị cắt một phần), nghi ngờ công cụ chụp trước khi sửa code.
- Flexbox không tự động ngăn tràn ngang: một hàng nav nhiều phần tử (logo, icon, nút CTA, hamburger) cần `flex-shrink: 0` trên các nhóm không nên bị bóp méo, và `white-space: nowrap` trên logo — nếu không, các phần tử có thể bị co/tràn ra ngoài viewport ở màn hình hẹp mà không có cảnh báo rõ ràng.
- Với `.reveal`/stagger animation có `transition-delay`, luôn chờ đủ thời gian (`shoot.js` cuộn dần + delay) trước khi chụp — chụp ngay lập tức là nguyên nhân phổ biến khiến ảnh trông như "thiếu nội dung".
- **`html { scroll-behavior: smooth }` (CSS hợp lệ, giữ nguyên cho UX thật) phá vỡ script cuộn lập trình nếu gọi `window.scrollTo(0, y)` mặc định nhiều lần liên tiếp nhanh** — mỗi lệnh cuộn mới bắt đầu một animation mượt mới, ngắt animation cũ giữa chừng, nên vị trí cuộn thực tế (`window.scrollY`) không bao giờ đuổi kịp giá trị `y` yêu cầu (đã đo được: sau 26 bước × 90ms, chỉ đạt ~25% quãng đường). Hậu quả: các section ở nửa dưới trang không bao giờ vào viewport thật sự, `.reveal` không kích hoạt, và ảnh chụp cho thấy nội dung "biến mất" dù code hoàn toàn đúng. Luôn dùng `window.scrollTo({ top: y, left: 0, behavior: 'instant' })` trong mọi script cuộn-để-chụp-ảnh, không dùng cú pháp `scrollTo(x, y)` hai-tham-số (nó luôn tôn trọng CSS `scroll-behavior`). `shoot.js`/`shoot-all.js` đã sửa theo cách này.
- Khi một trang dài không "chịu" hiện đủ nội dung dù đã sửa CSS/JS nhiều lần mà kết quả không đổi: đừng tiếp tục đoán qua ảnh — patch trực tiếp để log số bước cuộn thực tế (`window.scrollY` mỗi vòng lặp) hoặc wrap `IntersectionObserver` để log mọi lần fire. Đây là cách duy nhất phân biệt được "code sai" với "kịch bản test sai".
