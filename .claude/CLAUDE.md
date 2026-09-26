# CLAUDE.md — ALOHA Baby

Bộ não trung tâm của dự án. Đọc trước mọi task. Chi tiết chuyên biệt nằm ở `.claude/rules/`, `.claude/agents/`, `.claude/skills/` — chỉ đọc file liên quan khi task thực sự chạm tới lĩnh vực đó.

## Project Overview

Website studio chụp ảnh **ALOHA Baby** (35 Lê Văn Thiêm, Thanh Xuân, Hà Nội — hotline 0938.125.222): nền tảng vận hành tích hợp CRM + đặt lịch/dời lịch + quản lý/chỉnh sửa ảnh, không phải website giới thiệu thuần túy. Hai phân hệ dùng chung một nguồn dữ liệu: **Phân hệ khách hàng** và **Phân hệ Admin/CRM** (Sales/CSKH, Điều phối, Photographer, Retoucher/QC, Quản lý).

Repo Git trên GitHub (`origin`), frontend public trên GitHub Pages + Vercel (`ahola-baby.vercel.app`), server chatbot trên Render. HTML/CSS/JS thuần, chưa có backend CRM/booking thật. Quy trình Git và cách làm việc với người dùng: xem "Ghi nhớ nhanh" ngay bên dưới.

## Ghi nhớ nhanh (đọc trước mỗi phiên, cập nhật 2026-09-25)

**Cách người dùng muốn Claude làm việc (áp dụng mặc định, không cần nhắc lại):**
- Sau mỗi lần sửa xong, tự mở trang web vừa sửa trong trình duyệt cho người dùng (yêu cầu ngày 2026-09-26).
- Câu hỏi dạng hỏi đáp/tư vấn ("làm sao để...", "sao nó lại...", "có nên...") -> **chỉ trả lời bằng chữ, KHÔNG tự sửa file/chạy thao tác** ("t hỏi m chỉ cần trả lời thôi, đừng làm"). Chỉ làm khi người dùng giao việc rõ ràng.
- **Không bịa, không đánh giá lạc quan.** Chưa kiểm chứng thì nói rõ là chưa kiểm chứng (từng bị hỏi "m có bịa thông tin không" khi báo model Gemini chạy ổn nhưng thực tế không).
- Trả lời tiếng Việt, ngắn gọn; thinking bằng tiếng Việt.
- Yêu cầu mới mâu thuẫn quyết định cũ -> hỏi 1 câu ngắn trước khi làm (vd: gate đăng nhập Album/Concept).
- Việc giao diện: làm xong phải test Puppeteer + chụp màn hình desktop/mobile, báo file đã sửa và cách thêm nội dung về sau.
- Ảnh/video stock (Pexels) phải xem bằng mắt trước khi dùng, ghi nguồn vào sources.json, trên trang ghi rõ "minh hoạ, không phải khách thật".
- Không commit/push khi chưa được yêu cầu; KHÔNG bao giờ commit `server/.env`.

**Quy trình Git hiện tại:** làm trên nhánh riêng (của người dùng: `Chungcook`), gửi Pull Request vào `main`. `main` có branch protection: cần 1 approve từ người có quyền Write (tác giả không tự duyệt được; Admin có ô "bypass rules" dùng từng lần). Nhóm 3 người. Người dùng tự commit bằng công cụ riêng -> luôn `git status`/`git log` trước khi đụng Git.

**Quyết định đã chốt gần đây:** logo là wordmark chữ "aloha ♥ BABY STUDIO" (không dùng biểu tượng máy ảnh); Hero đầu trang = 5 dịch vụ, không có danh sách 01-05; album 3 tầng Dịch vụ -> Concept -> Ảnh (`js/albums.js`); tầng nội dung chi tiết `#/noi-dung/<slug>` (`js/content.js`); **Album/Concept/nội dung xem công khai**, chỉ Đặt lịch + Ảnh của tôi bắt đăng nhập; chatbot "luôn trả lời" (server tự đổi model Gemini dự phòng + frontend trả lời cục bộ có ghi rõ khi AI bận).

**Việc người dùng tự làm, nhắc lại nếu chưa xong:** đổi `GEMINI_API_KEY` (đã lộ trong ảnh chụp dashboard Render gửi vào chat) trên Render + `server/.env`; push lên `main` (qua PR) để Render deploy server mới (prompt 35 concept, action `album-*`, chuỗi model dự phòng).

## Kiến trúc hệ thống & danh sách file (giữ nguyên — xem guardrail đầu tiên bên dưới)

Site tĩnh HTML/CSS/JS thuần, không framework, không build step. Mọi trạng thái/dữ liệu là mô phỏng phía client (localStorage), không có backend CRM/booking thật. Chỉ có **3 file HTML**: `index.html`, `login.html`, `crm/admin.html`.

**Trang khách hàng (public):**
- `index.html` — SPA nhỏ bằng `location.hash`, gồm các view: Trang chủ, Đặt lịch (`#/dat-lich`), Ảnh của tôi (`#/chon-anh`), Album (`#/album/...`), Nội dung chi tiết (`#/noi-dung/...`). Lightbox dùng chung nằm cuối `<main>`.
- `login.html` — cổng đăng nhập chung cho cả 4 vai trò demo (không chọn vai trò bằng tay).
- `js/router.js` — router hash-based (parse route, gate quyền, chuyển view, dừng video/đóng lightbox khi rời trang). Chỉ `#/dat-lich`, `#/chon-anh` bắt đăng nhập; album và nội dung xem công khai.
- `js/albums.js` — `window.AlohaAlbums`: dữ liệu album 3 tầng Dịch vụ → Concept → Ảnh (5 dịch vụ × 7 concept; thêm ảnh = thêm đường dẫn vào `photos` của concept; concept chưa có ảnh tự ẩn) + render view album + **lightbox dùng chung** (`openViewer(items, i)`, phát được cả video) + `lookup('dịch vụ/concept')` cho trang khác lấy ảnh. Cũng điền số concept/ảnh bìa cho Hero.
- `js/content.js` — `window.AlohaContent`: trang nội dung chi tiết `#/noi-dung/<slug>` (5 concept, video "Một ngày tại ALOHA Baby", giới thiệu studio, chụp tại nhà, 3 bài tin tức). Thêm trang = thêm 1 object vào `PAGES` (khối heading/text/list/steps/image/video/gallery/albums/note), xem skill `add-content`.
- `js/script.js` — tương tác trang chủ: nav/mobile menu, scroll-reveal, chatbot (kịch bản + AI thật + trả lời dự phòng cục bộ), Tìm kiếm, Thông báo.
- `js/auth.js` — `window.AlohaAuth`: session (`login/logout/getSession/requireRole/roleHome/roleLabel`).
- `js/data-store.js` — `window.AlohaData`: kho dữ liệu demo dùng chung Khách hàng ↔ Admin.
- `js/dat-lich.js` — logic đặt lịch, mô phỏng khung giờ real-time.
- `js/chon-anh.js` — logic chọn ảnh, ghi chú chung + riêng từng ảnh, gửi yêu cầu chỉnh sửa.
- `css/style.css` — design token (`--pink-*`, `--navy-*`, `--radius-*`, `--shadow-*`, `--caption-shadow`, `--font-heading`/`--font-body`) + style dùng chung (nav, hero, logo chữ `.wordmark`, footer, chatbot...).
- `css/pages.css` — style các view phụ: Đặt lịch, Ảnh của tôi, Album, Nội dung, lightbox.

**Ban quản trị (nội bộ, 1 file dùng chung 3 vai trò Sale/Thợ ảnh/Sếp):** `crm/admin.html`, `crm/js/admin.js`, `css/admin.css`.

**Server chat AI (tách biệt hoàn toàn khỏi CRM/booking):** `server/server.js` (proxy gọi **Gemini API**, chuỗi model dự phòng `MODEL_CHAIN`, whitelist action gợi ý) + `package.json`, `package-lock.json`, `.env.example`, `.gitignore`, `DEPLOY.md`. Deploy trên Render (`https://phantichweb.onrender.com`), chạy local bằng `npm start` (cổng 3001). `server/.env` chứa key thật, KHÔNG commit.

**Ảnh, video, logo:**
- `images/` — ảnh trang chủ (hero, service-*, concept-*, album-*, news-*, about-studio, services-main, video-poster).
- `images/albums/<dịch vụ>/<concept>/` — 256 ảnh album (~40MB), nguồn từng ảnh ở `images/albums/sources.json`.
- `images/videos/` — 3 video minh hoạ 720p + poster `.jpg` cùng tên, nguồn ở `sources.json`.
- `images/my-photos/` — 16 ảnh demo cho "Ảnh của tôi".
- `images/logo-mark.svg` (trái tim: favicon + ảnh đại diện chat), `images/logo.svg` (logo chữ dùng ngoài web), `images/favicon-32.png`, `images/apple-touch-icon.png`. Logo trên web là chữ HTML `.wordmark`, không phải file ảnh.
- Toàn bộ ảnh/video là **stock miễn phí bản quyền (Pexels License)**, là ảnh MINH HOẠ, không phải khách hàng thật.

**Test/tiện ích (`_screenshots/*.js`, chạy tay, Puppeteer điều khiển Chrome cài sẵn):**
- Test không cần server (ưu tiên chạy): `test-auth` (17 case), `test-interest-gate` (11), `test-photos-chat` (9), `test-photo-notes` (5), `test-ai-chat` (1), `test-suggestion-nav` (9), `test-service-albums` (130), `test-chat-concepts` (25), `test-content-pages` (59).
- Test cần server/AI thật (tốn hạn mức Gemini): `test-ai-faq-menu`, `test-chat-navigate`, `test-prod-chat` (chạy trên bản public).
- Chụp/kiểm tra: `shoot.js`, `shoot-all.js`, `shoot-viewport.js`, `audit-responsive.js`, `inspect.js`.
- Tải ảnh/xuất logo: `fetch-album-photos.js` (ảnh album), `fetch-images.js`, `fetch-my-photos.js` (đã dùng xong, giữ tham khảo), `make-logo-png.js` (xuất PNG favicon từ SVG).

**Có ở thư mục gốc nhưng KHÔNG thuộc kiến trúc trên:** `alohababy.vn.png` (ảnh chụp website thật của studio, người dùng cung cấp, dùng đối chiếu bố cục), `skills-lock.json` (hệ thống skill quản lý).

**2 "database" mô phỏng (localStorage, KHÔNG phải backend thật — xem guardrail real-time trong `rules/tech-defaults.md`):**
- **`aloha_auth`** (`js/auth.js`) — 1 object session hiện tại: `{ role: 'khach-hang'|'tho-anh'|'sale'|'sep', name, phone, loginAt }`.
- **`aloha_admin_ui`** (`crm/admin.html` + `crm/js/admin.js`, thêm 2026-09-25) — 1 chuỗi `collapsed`/`expanded`: cột menu khu quản trị đang thu gọn hay mở rộng. Chỉ là tuỳ chọn hiển thị, không phải dữ liệu nghiệp vụ, mất đi cũng không ảnh hưởng gì (mặc định là mở rộng).
- **`aloha_demo_db`** (`js/data-store.js`) — `{ customers: { [phone]: { hasShoot, orderCode, serviceLabel, packageLabel, packageCount, photoCount } }, editRequests: [{ id, phone, customerName, orderCode, serviceLabel, photoCount, note, photoNotes: [{id, note}], photos: [{id, src, note}], doneIds: [photoId], staffSeen, customerSeenDone, status, createdAt }] }`. `status` dùng đúng enum trong `rules/tech-defaults.md` — **chỉ còn 3 giá trị** (Chờ xử lý → Đang thực hiện → Hoàn thành; đã bỏ "Chờ QC" riêng ngày 2026-09-19, xem `docs/changelog.md`). `photos` là danh sách ĐẦY ĐỦ ảnh trong yêu cầu (khác `photoNotes` chỉ chứa ảnh có ghi chú riêng); `doneIds` là các `photo.id` Thợ ảnh đã đánh dấu xử lý xong, đổi qua `AlohaData.togglePhotoDone(requestId, photoId)`; `staffSeen`/`customerSeenDone` (thêm 2026-09-19) là 2 cờ thông báo 1 chiều độc lập nhau, đổi qua `AlohaData.markStaffSeen()`/`markCustomerSeenDone()` — xem `docs/changelog.md`.

## Trạng thái dự án (cập nhật 2026-09-25)

Chi tiết từng lượt thay đổi, lỗi đã gặp, lý do quyết định: **`docs/changelog.md`** (đọc khi cần bối cảnh; ghi mục mới lên đầu file đó sau mỗi thay đổi đáng kể).

**Đã có:**
- Trang chủ: Hero Banner 5 dịch vụ (collage 5 ảnh) → album 3 tầng; các thẻ Album/Concept/Video/Tin tức/Giới thiệu/Chụp tại nhà mở tầng nội dung chi tiết; Tìm kiếm + Thông báo dùng thật; logo chữ "aloha ♥ BABY STUDIO".
- Đăng nhập/phân quyền demo 4 vai trò (`login.html`, `js/auth.js`); Đặt lịch 3 bước (mô phỏng real-time); Ảnh của tôi (thả tim, ghi chú chung + riêng từng ảnh, gửi yêu cầu chỉnh sửa).
- Admin `crm/admin.html`: menu dọc bên trái thu gọn/mở rộng được (nhớ trạng thái trong `aloha_admin_ui`); Dashboard Sếp (KPI, phễu, biểu đồ) + mục Doanh thu (KPI sparkline, biểu đồ đường 3 tab, mục tiêu tháng), hiệu ứng chạy lại mỗi lần bấm menu; Lịch hẹn dạng lịch tháng có popup chi tiết, vừa khung màn hình, nổi bật ngày hôm nay; bảng Khách hàng có avatar chữ viết tắt tự sinh từ tên (màu theo SĐT); CRM + Lịch hẹn vẫn là dữ liệu tĩnh; đã bỏ mục Concept khỏi Admin; kanban chỉnh ảnh 3 bước nối dữ liệu thật (Thợ ảnh tick từng ảnh, Sếp xem chỉ đọc), thông báo 2 chiều Khách ↔ Thợ ảnh (polling 5 giây, chỉ trong cùng trình duyệt).
- Chatbot: kịch bản quick-reply (tư vấn dịch vụ, concept & ảnh mẫu, quy trình, FAQ, gọi Sale) + khung gõ tự do gọi Gemini qua server Render, AI trả kèm 3 nút gợi ý dẫn trang; AI lỗi thì trả lời cục bộ theo từ khoá (ghi rõ "Trợ lý AI đang bận").

**Quyết định đã chốt (không hỏi lại trừ khi người dùng đổi ý):**
- Đăng nhập 1 trang, KHÔNG chọn vai trò bằng tay (4 tài khoản demo hardcode trong `login.html`). Đăng ký mới không có `next` → vào `#/dat-lich`; có `next` thì tôn trọng `next`.
- 3 vai trò nội bộ dùng chung `crm/admin.html`, phân quyền bằng `data-roles`, phần không thuộc quyền bị **xoá khỏi DOM**.
- Khách hàng gộp 1 file `index.html` (SPA hash); giữ riêng `login.html` và `crm/admin.html`.
- Album/Concept/nội dung chi tiết xem **công khai** (đổi ngày 2026-09-25, thay cho gate "bấm là phải đăng nhập" trước đây). Nút chat nổi và "Tư vấn concept ngay" vẫn bắt đăng nhập.
- Chỉnh sửa ảnh chỉ 3 bước (Chờ xử lý → Đang thực hiện → Hoàn thành), KHÔNG có vai trò QC riêng.
- Chatbot dùng Gemini (free tier), không tự chuyển trang: chỉ chuyển khi khách BẤM nút gợi ý. Server tự thử chuỗi model dự phòng khi quá tải.
- Logo chỉ dùng chữ (wordmark); Hero không có danh sách 01-05.

**Việc còn mở (theo thứ tự ưu tiên gợi ý):**
1. Người dùng tự đổi `GEMINI_API_KEY` (đã lộ) trên Render + `server/.env`; merge PR vào `main` để Render deploy server mới.
2. Nối bảng CRM/Lịch hẹn của Sale (`CUSTOMERS`/`APPOINTMENTS` trong `crm/js/admin.js`, đang là mảng tĩnh) vào `aloha_demo_db`.
3. Thợ ảnh: chưa có tải ảnh gốc / công cụ chỉnh sửa thật. Sale: chưa có ghi chú tư vấn / đổi trạng thái phễu.
4. **Chưa chốt, không tự làm:** đồng bộ real-time đa thiết bị cần backend thật (server + database + WebSocket/SSE), người dùng nói "để sau".
5. Tab "Đổi lịch hẹn" chưa có màn hình thật.

## Mục tiêu & Context quan trọng

- **CRM là xương sống:** một thông tin khách hàng chỉ nhập một lần, tái sử dụng ở mọi khâu (tư vấn → đặt lịch → chụp → chỉnh ảnh → chăm sóc). Data model đầy đủ: `rules/tech-defaults.md`.
- Mục tiêu chuyển đổi: từ vận hành thủ công qua điện thoại/tin nhắn sang một hệ thống tập trung mà khách tự thao tác và nhân sự dùng chung dữ liệu. Studio hiện vận hành qua 9 khâu nối tiếp (marketing → sales → điều phối → concept/stylist → buổi chụp → chọn ảnh → hậu kỳ → in ấn → bàn giao); mỗi luồng trên website tương ứng với một khâu cụ thể. Chi tiết: `rules/operations.md`.
- 5 nhóm dịch vụ cố định: Bé lớn, Sinh nhật, Bầu, Gia đình, Newborn.
- Ngoài CRM/booking/ảnh cốt lõi, dự án còn có 3 tính năng: **chatbot AI tư vấn** (kịch bản → concept → báo giá → dẫn vào luồng đặt lịch), **giao diện chọn ảnh hậu kỳ** (đếm ảnh đã chọn so với gói, tính phí khi vượt), **đặt lịch real-time** (khung giờ cập nhật tức thời cho mọi người xem cùng lúc). Chi tiết: `rules/workflow.md`.

## Tech Stack

Chưa được chỉ định trong tài liệu nghiệp vụ. **Không tự chọn framework/database thay người dùng** — đề xuất kèm lý do hoặc hỏi lại. Nguyên tắc kiến trúc áp dụng bất kể stack nào: `rules/tech-defaults.md`.

## Nguyên tắc phát triển cốt lõi

- Đọc và hiểu context của task trước khi sửa code.
- Không tự ý thêm chức năng ngoài phạm vi yêu cầu, xóa file/thư mục, hay đổi kiến trúc nếu không có lý do kỹ thuật rõ ràng.
- Không đụng vào phần không liên quan đến task; giữ nhất quán giữa dữ liệu, UI và workflow.
- Thay đổi ảnh hưởng nhiều module → kiểm tra các module liên quan trước khi coi là xong.
- Task lớn/nhiều thay đổi → phân tích và lập kế hoạch trước khi code; task nhỏ → không cần plan dài dòng.
- Sau thay đổi lớn phải kiểm tra kết quả thực tế; không báo hoàn thành chỉ dựa trên giả định code chạy đúng. Với thay đổi giao diện: bắt buộc chụp screenshot và đối chiếu định hướng thiết kế — xem skill `verify-ui-change`.
- Lỗi phát sinh do chính thay đổi vừa thực hiện → phải xử lý trước khi báo hoàn thành.
- Yêu cầu mới mâu thuẫn với requirement hiện tại (kể cả trong file này) → chỉ rõ mâu thuẫn trước khi thực hiện thay đổi lớn, không âm thầm ghi đè.

## Guardrail bắt buộc

- **[Quyết định quan trọng nhất, do người dùng chốt trực tiếp] Giữ nguyên kiến trúc hệ thống hiện tại và các "database" (localStorage) đã thiết kế** — KHÔNG tái cấu trúc, đổi kiến trúc, đổi lược đồ dữ liệu, gộp/tách lại file nếu không có yêu cầu mới rõ ràng từ người dùng. Kiến trúc hiện tại: site tĩnh HTML/CSS/JS thuần (không framework), `index.html` là SPA nhỏ dùng `location.hash` cho 3 view khách hàng, `crm/admin.html` là 1 file dùng chung cho 3 vai trò nội bộ, `server/` là server Node/Express riêng chỉ phục vụ chatbot AI (tách biệt hoàn toàn khỏi CRM/booking), dữ liệu mô phỏng lưu trong 2 key localStorage `aloha_auth` và `aloha_demo_db`. Danh sách đầy đủ file đã tạo + lược đồ 2 "database" này: xem mục "Kiến trúc hệ thống & danh sách file" ngay bên dưới.
- **Thương hiệu luôn là ALOHA Baby**, không dùng tên/logo "Memory Studio".
- **Trạng thái (status) dùng chung một bộ tên** giữa Admin và khách hàng; số liệu dashboard/phễu phải giảm dần hợp lý và nhất quán.
- **Ảnh trẻ em là dữ liệu nhạy cảm** — chỉ xem qua tài khoản chính chủ, chỉ dùng marketing khi có văn bản đồng ý, không public không xác thực. Chi tiết: `rules/workflow.md`.
- **Không tự đặt thông số nghiệp vụ chưa xác định** (mức cọc, thời gian giữ chỗ, thời hạn dời lịch...) — để dạng cấu hình. Danh sách đầy đủ: `rules/tech-defaults.md`.
- **UI/UX theo đúng định hướng đã có** (hồng-trắng-navy, dashboard dạng card, mô tả trong `rules/design.md`) — không tự tạo design system khác. Chi tiết: `rules/design.md`.
- **Giao diện phải mobile-friendly và mọi section phải có animation khi scroll** — bắt buộc cho cả hai phân hệ, không phải tùy chọn. Chi tiết: `rules/design.md`.
- **Đặt lịch real-time hiện chỉ là UI + mô phỏng bằng JS phía client** (site tĩnh, chưa có backend CRM/booking) — không được báo cáo hay hiển thị như thể đã đồng bộ real-time thật giữa nhiều người dùng. **Chatbot AI:** quick-reply là kịch bản dựng sẵn; khung nhập tự do gọi **Gemini API thật** qua server riêng (`server/`, deploy trên Render, local chạy `npm start`, cần `GEMINI_API_KEY`). Chỉ được gọi là "AI thật" khi server chạy và key hợp lệ; khi AI lỗi, frontend trả lời cục bộ theo từ khoá và **phải ghi rõ "Trợ lý AI đang bận"**, không giả vờ đó là câu trả lời của AI. Chi tiết: `rules/tech-defaults.md`.

## Cách Claude nên làm việc với dự án

| Việc đang làm | Đọc / dùng |
|---|---|
| Giao diện, màn hình, phong cách thiết kế | `rules/design.md` |
| Quy trình đặt lịch/dời lịch/chọn-chỉnh ảnh, automation CRM, Git | `rules/workflow.md` |
| Data model, status enum, kiến trúc, config/phạm vi chưa chốt | `rules/tech-defaults.md` |
| Bối cảnh vận hành offline thực tế của studio (9 khâu) | `rules/operations.md` |
| Cần biết vì sao một thứ được làm vậy / lỗi cũ đã gặp; ghi nhật ký sau thay đổi | `docs/changelog.md` |
| Trước khi đổi một khái niệm dùng chung (status, field CRM, config) | agent `researcher` — rà soát mọi nơi đang phụ thuộc vào nó |
| Trước khi báo hoàn thành task đụng CRM/booking/ảnh | agent `reviewer` — rà soát tính nhất quán nghiệp vụ |
| Xây một tính năng CRM/booking/ảnh mới từ đầu | skill `implement-business-feature` |
| Thêm ảnh/concept album, trang nội dung, bài viết, video | skill `add-content` |
| Sau khi code/sửa bất kỳ màn hình nào | skill `verify-ui-change` — screenshot, đối chiếu định hướng thiết kế, kiểm tra mobile-friendly & animation |

## Ghi chú làm việc

Luôn thể hiện phần suy nghĩ (thinking) bằng tiếng Việt.
