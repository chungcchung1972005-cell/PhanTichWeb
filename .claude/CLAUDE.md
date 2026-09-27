# CLAUDE.md — ALOHA Baby

Bộ não trung tâm của dự án. Đọc trước mọi task. Chi tiết chuyên biệt nằm ở `.claude/rules/`, `.claude/agents/`, `.claude/skills/` — chỉ đọc file liên quan khi task thực sự chạm tới lĩnh vực đó.

## Project Overview

Website studio chụp ảnh **ALOHA Baby** (35 Lê Văn Thiêm, Thanh Xuân, Hà Nội — hotline 0938.125.222): nền tảng vận hành tích hợp CRM + đặt lịch/dời lịch + quản lý/chỉnh sửa ảnh, không phải website giới thiệu thuần túy. Hai phân hệ dùng chung một nguồn dữ liệu: **Phân hệ khách hàng** và **Phân hệ Admin/CRM** (Sales/CSKH, Điều phối, Photographer, Retoucher/QC, Quản lý).

Repo Git trên GitHub (`origin`), frontend public trên GitHub Pages + Vercel (`ahola-baby.vercel.app`), server chatbot trên Render. HTML/CSS/JS thuần, chưa có backend CRM/booking thật. Quy trình Git và cách làm việc với người dùng: xem "Ghi nhớ nhanh" ngay bên dưới.

## Ghi nhớ nhanh (đọc trước mỗi phiên, cập nhật 2026-09-27)

**Cách người dùng muốn Claude làm việc (áp dụng mặc định, không cần nhắc lại):**
- Sau mỗi lần sửa xong, tự mở trang web vừa sửa trong trình duyệt cho người dùng (yêu cầu ngày 2026-09-26).
- Câu hỏi dạng hỏi đáp/tư vấn ("làm sao để...", "sao nó lại...", "có nên...") -> **chỉ trả lời bằng chữ, KHÔNG tự sửa file/chạy thao tác** ("t hỏi m chỉ cần trả lời thôi, đừng làm"). Chỉ làm khi người dùng giao việc rõ ràng.
- **Không bịa, không đánh giá lạc quan.** Chưa kiểm chứng thì nói rõ là chưa kiểm chứng (từng bị hỏi "m có bịa thông tin không" khi báo model Gemini chạy ổn nhưng thực tế không).
- Trả lời tiếng Việt, ngắn gọn; thinking bằng tiếng Việt.
- Yêu cầu mới mâu thuẫn quyết định cũ -> hỏi 1 câu ngắn trước khi làm (vd: gate đăng nhập Album/Concept).
- Việc giao diện: làm xong phải test Puppeteer + chụp màn hình desktop/mobile, báo file đã sửa và cách thêm nội dung về sau.
- Ảnh/video stock (Pexels) phải xem bằng mắt trước khi dùng, ghi nguồn vào sources.json, trên trang ghi rõ "minh hoạ, không phải khách thật".
- Không commit/push khi chưa được yêu cầu; KHÔNG bao giờ commit `server/.env`.
- **KHÔNG nhắc đổi mật khẩu/key** (`GEMINI_API_KEY`, mật khẩu user MongoDB `chungcchung1972005_db_user`) dù từng lộ trong chat: người dùng chốt 2026-09-27 "không cần đổi, đừng nhắc lại nữa".

**Quy trình Git hiện tại:** làm trên nhánh riêng (của người dùng: `Chungcook`), gửi Pull Request vào `main`. `main` có branch protection: cần 1 approve từ người có quyền Write (tác giả không tự duyệt được; Admin có ô "bypass rules" dùng từng lần). Nhóm 3 người. Người dùng tự commit bằng công cụ riêng -> luôn `git status`/`git log` trước khi đụng Git.

**Quyết định đã chốt gần đây:** logo là wordmark chữ "aloha ♥ BABY STUDIO" (không dùng biểu tượng máy ảnh); khối đầu trang = "DỊCH VỤ" theo bố cục alohababy.vn (tiêu đề giữa, dòng 5 dịch vụ, lưới ảnh 3 cột ô Bầu cao gấp đôi; đổi 2026-09-27), không có danh sách đánh số 01-05; album 3 tầng Dịch vụ -> Concept -> Ảnh (`js/albums.js`); tầng nội dung chi tiết `#/noi-dung/<slug>` (`js/content.js`); nội dung chi tiết xem công khai; **từ 2026-09-27: 5 ảnh + dòng dịch vụ đầu trang dẫn tới `#/chat-sale/<dịch vụ>` (bắt đăng nhập) -> vào thẳng chat trực tiếp với Sale; Đặt lịch, trang album, chatbot AI TẠM TẮT bằng cờ `js/features.js`** (chỉ ẩn, code giữ nguyên để bật lại).

**Phiên 2026-09-27 đã làm (chi tiết từng lượt: `docs/changelog.md`):**
1. Khối đầu trang chủ theo bố cục "DỊCH VỤ" của alohababy.vn (tiêu đề giữa + dòng 5 dịch vụ + lưới ảnh 3 cột).
2. Tạm tắt Đặt lịch, trang album, chatbot AI bằng cờ `js/features.js` (chỉ ẩn; bật lại = đổi `false` -> `true`).
3. Bấm 5 ảnh / dòng dịch vụ -> đăng nhập -> màn chat riêng `#/chat-sale/<dịch vụ>` với Sale: ảnh phóng to chuyển trang, 3 tin chào tự động đến lần lượt có "Tư vấn viên đang trả lời…", 4 nút gợi ý; đã bỏ cột trái theo yêu cầu.
4. **Chat THẬT qua server** (`server/sale-chat.js` + MongoDB Atlas, người dùng chọn): đăng nhập/đăng ký kiểm tra ở server, Admin có mục "Tin nhắn" (Sale trả lời, Sếp chỉ xem), thêm 2 tài khoản Sale demo `0900000005`/`0900000006` (`sale123`).
5. Git: commit `188ca83` + merge `origin/main` (13 commit của nhóm: "Chat với thợ chỉnh ảnh", tab "Ảnh đã chỉnh"...) thành `55aed00`, xử lý conflict giữ cả 2 phía, đã push, **PR #15 đã merge vào `main`** (`e7a8b95`), Vercel/GitHub Pages/Render đã chạy bản mới.
6. **MongoDB Atlas đã cài xong, chat Sale chạy thật trên bản public:** cluster M0 `Chungcook` (AWS Hong Kong), IP `0.0.0.0/0`; Render đã có `MONGODB_URI`, `AUTH_SECRET`, `ALLOWED_ORIGINS` (Vercel + GitHub Pages). `/api/health` → `"chatStore":"mongodb"`. Claude đã test bằng trình duyệt thật trên cả Vercel lẫn GitHub Pages: khách ↔ Sale 2 cửa sổ ẩn danh chat qua lại, tải lại trang tin vẫn còn, không lỗi CORS (16/16 PASS).
7. **Đăng nhập/đăng ký bằng Google** (người dùng chọn: Google trước, Facebook sau; Google lần đầu bắt nhập SĐT 1 lần; giữ SĐT + mật khẩu như cũ, không OTP): nút Google trên `login.html`, server kiểm tra token qua Google tokeninfo, SĐT đã có tài khoản không gắn Google được (chống chiếm tài khoản). Test `test-google-login` 19/19 (giả lập Google). **Code CHƯA commit/push; bản public chưa có nút Google** cho tới khi người dùng tạo OAuth Client ID + đặt `GOOGLE_CLIENT_ID` trên Render (`server/DEPLOY.md` mục "Đăng nhập bằng Google"). Luồng với Google thật CHƯA kiểm chứng.

**Việc cần làm tiếp theo:** (1) người dùng commit + đưa code Google lên `main` (qua PR), tạo OAuth Client ID Google, đặt `GOOGLE_CLIENT_ID` trên Render, rồi nhờ Claude kiểm tra bằng Google thật; (2) làm đăng nhập Facebook (người dùng đã chọn làm sau Google); (3) xem mục "Việc còn mở" trong phần Trạng thái dự án (đã sắp theo thứ tự ưu tiên). Việc nhỏ người dùng tự làm khi muốn: xoá 5 tin test Claude gửi trong chat của `0900000001` (Atlas → Browse Collections → `aloha_baby.chats`) cho hộp thư Sale sạch; cài SePay (mục "Việc còn mở").

## Kiến trúc hệ thống & danh sách file (giữ nguyên — xem guardrail đầu tiên bên dưới)

Site tĩnh HTML/CSS/JS thuần, không framework, không build step. Mọi trạng thái/dữ liệu là mô phỏng phía client (localStorage), không có backend CRM/booking thật. Chỉ có **3 file HTML**: `index.html`, `login.html`, `crm/admin.html`.

**Trang khách hàng (public):**
- `index.html` — SPA nhỏ bằng `location.hash`, gồm các view: Trang chủ, Đặt lịch (`#/dat-lich`), Ảnh của tôi (`#/chon-anh`), Album (`#/album/...`), Nội dung chi tiết (`#/noi-dung/...`), Chat với Sale (`#/chat-sale/...`). Lightbox dùng chung nằm cuối `<main>`.
- `login.html` — cổng đăng nhập chung cho cả 4 vai trò demo (không chọn vai trò bằng tay). Có thêm nút "Đăng nhập bằng Google" cho khách (2026-09-27, chỉ hiện khi server có `GOOGLE_CLIENT_ID`; lần đầu hiện bước nhập SĐT `#googleForm`).
- `js/features.js` (thêm 2026-09-27, nạp trong `<head>` của `index.html` + `login.html`) — `window.ALOHA_FEATURES = { booking, aiChat, albumPages }`, mặc định cả 3 `false` (tạm tắt), đặt class `feat-no-*` lên `<html>` để CSS cuối `style.css` ẩn nút. Test cũ bật lại bằng `launchAllFeatures` trong `_screenshots/test-env.js`.
- `js/router.js` — router hash-based (parse route, gate quyền, chuyển view, dừng video/đóng lightbox khi rời trang). `#/dat-lich`, `#/chon-anh`, `#/chat-sale[/<dịch vụ>]` bắt đăng nhập khách; route đang tắt theo cờ (`#/dat-lich`, `#/album/...`) về Trang chủ.
- `js/sale-chat.js` (thêm 2026-09-27) — `window.AlohaSaleChat.show(slug)/hide()`: màn hình chat riêng Khách ↔ Sale (view `#view-chat`, route `#/chat-sale[/<dịch vụ>]`): 1 khung trò chuyện ở giữa (đã bỏ cột trái). Đã đăng nhập bấm ảnh dịch vụ thì ảnh phóng to phủ màn hình rồi mở màn chat (`zoomToChat`). Mở đầu là 3 **tin chào tự động** của Sale đến lần lượt, mỗi tin có nhịp "đang nhập" tuỳ độ dài câu (chỉ hiển thị, không lưu, ghi "Tin nhắn tự động"), rồi 4 nút gợi ý câu hỏi theo dịch vụ. **Tin nhắn đi qua server** (`AlohaAuth.api` → `server/sale-chat.js`), hỏi tin mới mỗi 2.5 giây khi mở màn chat (20 giây ở trang khác, để bật chấm đỏ nút chat); tin gửi lỗi có nút "Gửi lại", dòng trạng thái báo "Đang kết nối…" / "Đăng nhập lại". Khi `aiChat` tắt, nút chat nổi + các lối vào chatbot cũ dẫn tới màn này.
- `js/albums.js` — `window.AlohaAlbums`: dữ liệu album 3 tầng Dịch vụ → Concept → Ảnh (5 dịch vụ × 7 concept; thêm ảnh = thêm đường dẫn vào `photos` của concept; concept chưa có ảnh tự ẩn) + render view album + **lightbox dùng chung** (`openViewer(items, i)`, phát được cả video) + `lookup('dịch vụ/concept')` cho trang khác lấy ảnh. Cũng điền số concept/ảnh bìa cho Hero.
- `js/content.js` — `window.AlohaContent`: trang nội dung chi tiết `#/noi-dung/<slug>` (5 concept, video "Một ngày tại ALOHA Baby", giới thiệu studio, chụp tại nhà, 3 bài tin tức). Thêm trang = thêm 1 object vào `PAGES` (khối heading/text/list/steps/image/video/gallery/albums/note), xem skill `add-content`.
- `js/script.js` — tương tác trang chủ: nav/mobile menu, scroll-reveal, chatbot (kịch bản + AI thật + trả lời dự phòng cục bộ), Tìm kiếm, Thông báo.
- `js/auth.js` — `window.AlohaAuth`: session (`login/logout/getSession/requireRole/roleHome/roleLabel`) + gọi server chat (`api`, `serverLogin`, `serverRegister`, `wakeServer`, `serverConfig`, `serverGoogle`, `serverGoogleComplete`; `API_BASE` = `localhost:3001` khi mở từ máy, Render khi public).
- `js/data-store.js` — `window.AlohaData`: kho dữ liệu demo dùng chung Khách hàng ↔ Admin.
- `js/dat-lich.js` — logic đặt lịch, mô phỏng khung giờ real-time.
- `js/chon-anh.js` — logic chọn ảnh, ghi chú chung + riêng từng ảnh, gửi yêu cầu chỉnh sửa.
- `css/style.css` — design token (`--pink-*`, `--navy-*`, `--radius-*`, `--shadow-*`, `--caption-shadow`, `--font-heading`/`--font-body`) + style dùng chung (nav, hero, logo chữ `.wordmark`, footer, chatbot...).
- `css/pages.css` — style các view phụ: Đặt lịch, Ảnh của tôi, Album, Nội dung, lightbox.

**Ban quản trị (nội bộ, 1 file dùng chung 3 vai trò Sale/Thợ ảnh/Sếp):** `crm/admin.html`, `crm/js/admin.js`, `css/admin.css`.

**Server (tách biệt khỏi CRM/booking):** `server/server.js` (proxy gọi **Gemini API**, chuỗi model dự phòng `MODEL_CHAIN`, whitelist action gợi ý; webhook SePay) + `server/sale-chat.js` (thêm 2026-09-27, mount `/api/sale-chat`: **chat thật Khách ↔ Sale + đăng nhập kiểm tra ở server** - tài khoản demo khớp `login.html` + khách đăng ký thật (mật khẩu scrypt), cấp token HMAC ký bằng `AUTH_SECRET`; khách chỉ đọc chat của mình, Sale đọc/trả lời mọi chat, Sếp chỉ xem; lưu **MongoDB Atlas** (`MONGODB_URI`, collection `users` + `chats`, `_id` = SĐT), không có thì lưu bộ nhớ) + `package.json` (express, cors, dotenv, mongodb), `package-lock.json`, `.env.example`, `.gitignore`, `DEPLOY.md`. Deploy trên Render (`https://phantichweb.onrender.com`), chạy local bằng `npm start` (cổng 3001). `server/.env` chứa key thật, KHÔNG commit.

**Ảnh, video, logo:**
- `images/` — ảnh trang chủ (hero, service-*, concept-*, album-*, news-*, about-studio, services-main, video-poster).
- `images/albums/<dịch vụ>/<concept>/` — 256 ảnh album (~40MB), nguồn từng ảnh ở `images/albums/sources.json`.
- `images/videos/` — 3 video minh hoạ 720p + poster `.jpg` cùng tên, nguồn ở `sources.json`.
- `images/my-photos/` — 16 ảnh demo cho "Ảnh của tôi".
- `images/logo-mark.svg` (trái tim: favicon + ảnh đại diện chat), `images/logo.svg` (logo chữ dùng ngoài web), `images/favicon-32.png`, `images/apple-touch-icon.png`. Logo trên web là chữ HTML `.wordmark`, không phải file ảnh.
- Toàn bộ ảnh/video là **stock miễn phí bản quyền (Pexels License)**, là ảnh MINH HOẠ, không phải khách hàng thật.

**Test/tiện ích (`_screenshots/*.js`, chạy tay, Puppeteer điều khiển Chrome cài sẵn):**
- Test không cần server (ưu tiên chạy): `test-auth` (17 case), `test-interest-gate` (11), `test-photos-chat` (9), `test-photo-notes` (5), `test-ai-chat` (1), `test-suggestion-nav` (9), `test-service-albums` (130), `test-chat-concepts` (25), `test-content-pages` (59), `test-booking-required` (68), `test-google-login` (19, tự bật server cổng 3001 + máy chủ Google giả cổng 3009, nút Google giả; tắt `npm start` trước), `test-sale-chat` (43, tự bật `server/server.js` ở cổng 3001 lưu bộ nhớ - tắt `npm start` của bạn trước; khách/Sale ở các cửa sổ ẩn danh riêng như 2 máy; chạy với cờ mặc định đang tắt, các test còn lại bật lại đủ cờ qua `launchAllFeatures`).
- Test cần server/AI thật (tốn hạn mức Gemini): `test-ai-faq-menu`, `test-chat-navigate`, `test-prod-chat` (chạy trên bản public).
- Chụp/kiểm tra: `shoot.js`, `shoot-all.js`, `shoot-viewport.js`, `audit-responsive.js`, `inspect.js`.
- Tải ảnh/xuất logo: `fetch-album-photos.js` (ảnh album), `fetch-images.js`, `fetch-my-photos.js` (đã dùng xong, giữ tham khảo), `make-logo-png.js` (xuất PNG favicon từ SVG).

**Có ở thư mục gốc nhưng KHÔNG thuộc kiến trúc trên:** `alohababy.vn.png` (ảnh chụp website thật của studio, người dùng cung cấp, dùng đối chiếu bố cục), `skills-lock.json` (hệ thống skill quản lý).

**2 "database" mô phỏng (localStorage, KHÔNG phải backend thật — xem guardrail real-time trong `rules/tech-defaults.md`):**
- **`aloha_auth`** (`js/auth.js`) — 1 object session hiện tại: `{ role: 'khach-hang'|'tho-anh'|'sale'|'sep', name, phone, loginAt, token? }`. `token` (thêm 2026-09-27) là mã đăng nhập server cấp cho chat thật; không có (đăng nhập lúc server tắt) thì mọi phần khác vẫn chạy, riêng chat báo "Đăng nhập lại".
- **`aloha_admin_ui`** (`crm/admin.html` + `crm/js/admin.js`, thêm 2026-09-25) — 1 chuỗi `collapsed`/`expanded`: cột menu khu quản trị đang thu gọn hay mở rộng. Chỉ là tuỳ chọn hiển thị, không phải dữ liệu nghiệp vụ, mất đi cũng không ảnh hưởng gì (mặc định là mở rộng).
- **`aloha_demo_db`** (`js/data-store.js`) — `{ customers: { [phone]: { hasShoot, orderCode, serviceLabel, packageLabel, packageCount, photoCount } }, editRequests: [{ id, phone, customerName, orderCode, serviceLabel, photoCount, note, photoNotes: [{id, note}], extraCount, extraFee, paymentStatus, photos: [{id, src, note, isExtra}], doneIds: [photoId], staffSeen, customerSeenDone, status, createdAt, resultLink, resultLinkAt, messages: [{id, from: 'customer'|'staff'|'ai', name, text, at, needsStaff}], customerSeenEditedSig }] }`. `resultLink` (chỉ https) là link thư mục Drive ảnh đã chỉnh Thợ ảnh gửi, `messages` là chat Khách ↔ Thợ ảnh của đúng yêu cầu đó, `customerSeenEditedSig` là dấu khách đã xem link/tin mới (tắt chấm báo trên tab "Ảnh đã chỉnh"); bản ghi cũ thiếu các field này thì nơi đọc tự coi như rỗng (thêm 2026-09-27). `status` dùng đúng enum trong `rules/tech-defaults.md` — **chỉ còn 3 giá trị** (Chờ xử lý → Đang thực hiện → Hoàn thành; đã bỏ "Chờ QC" riêng ngày 2026-09-19, xem `docs/changelog.md`). `photos` là danh sách ĐẦY ĐỦ ảnh trong yêu cầu (khác `photoNotes` chỉ chứa ảnh có ghi chú riêng); `doneIds` là các `photo.id` Thợ ảnh đã đánh dấu xử lý xong, đổi qua `AlohaData.togglePhotoDone(requestId, photoId)`; `staffSeen`/`customerSeenDone` (thêm 2026-09-19) là 2 cờ thông báo 1 chiều độc lập nhau, đổi qua `AlohaData.markStaffSeen()`/`markCustomerSeenDone()` — xem `docs/changelog.md`. (Chat Khách ↔ Sale từng lưu ở đây dạng `chats` trong 1 buổi 2026-09-27, nay đã chuyển lên server; `readDb()` tự xoá key `chats` cũ.)

**Dữ liệu chat trên server** (MongoDB, `server/sale-chat.js`): `chats` = `{ _id: phone, phone, customerName, topic, messages: [{ id, from: 'khach'|'sale', senderName, text, at }] (giữ 500 tin gần nhất), staffUnread, customerUnread, updatedAt, createdAt }`; `users` (khách tự đăng ký) = `{ _id: phone, phone, name, salt, hash, role: 'khach-hang', createdAt }`; khách đăng ký bằng Google (2026-09-27) không có `salt/hash`, có thêm `provider: 'google', googleSub, email` (index unique sparse trên `googleSub`: 1 tài khoản Google chỉ gắn 1 SĐT). **Chưa nối vào hồ sơ CRM** (`customers`/bảng Khách hàng tĩnh), cùng việc mở #2.

## Trạng thái dự án (cập nhật 2026-09-27)

Chi tiết từng lượt thay đổi, lỗi đã gặp, lý do quyết định: **`docs/changelog.md`** (đọc khi cần bối cảnh; ghi mục mới lên đầu file đó sau mỗi thay đổi đáng kể).

**Đã có:**
- Trang chủ: khối "DỊCH VỤ" 5 dịch vụ (bố cục alohababy.vn, lưới 3 cột) → album 3 tầng; các thẻ Album/Concept/Video/Tin tức/Giới thiệu/Chụp tại nhà mở tầng nội dung chi tiết; Tìm kiếm + Thông báo dùng thật; logo chữ "aloha ♥ BABY STUDIO".
- Đăng nhập/phân quyền demo 4 vai trò (`login.html`, `js/auth.js`); Đặt lịch 4 bước: Dịch vụ & concept (giá riêng từng concept + "Khác" tự lên ý tưởng cùng Sale), Ngày giờ, Xác nhận (validate ô bắt buộc), Đặt cọc 50% (tự nhận diện thanh toán nhưng là MÔ PHỎNG, chưa có cổng/webhook thật, xem `docs/tich-hop-thanh-toan.md`); Ảnh của tôi (toàn bộ album Google Photos, lightbox xem/thu phóng/lướt, thả tim + ghi chú ngay trong lightbox, nút Chọn tất cả (báo phí trước) / Bỏ chọn tất cả (có Hoàn tác), gửi yêu cầu chỉnh sửa; tab "Ảnh đã chỉnh": link Drive Thợ ảnh gửi (công khai) + "Chat với thợ chỉnh ảnh" (trợ lý tự động trả lời trước với giọng thợ, câu khó mới chuyển thợ thật; không nói dối nếu khách hỏi thẳng là người hay máy); chọn quá 10 ảnh thì phải thanh toán qua QR, SePay báo tiền về thì ảnh tự gửi tới Thợ ảnh).
- Admin `crm/admin.html`: menu dọc bên trái thu gọn/mở rộng được (nhớ trạng thái trong `aloha_admin_ui`); Dashboard Sếp (KPI, phễu, biểu đồ) + mục Doanh thu (KPI sparkline, biểu đồ đường 3 tab, mục tiêu tháng), hiệu ứng chạy lại mỗi lần bấm menu; Lịch hẹn dạng lịch tháng có popup chi tiết, vừa khung màn hình, nổi bật ngày hôm nay; bảng Khách hàng có avatar chữ viết tắt tự sinh từ tên (màu theo SĐT); CRM + Lịch hẹn vẫn là dữ liệu tĩnh; đã bỏ mục Concept khỏi Admin; kanban chỉnh ảnh 3 bước nối dữ liệu thật (Thợ ảnh tick từng ảnh, Sếp xem chỉ đọc), thông báo 2 chiều Khách ↔ Thợ ảnh (polling 5 giây, chỉ trong cùng trình duyệt).
- Chatbot (đang TẠM TẮT từ 2026-09-27, code giữ nguyên): kịch bản quick-reply (tư vấn dịch vụ, concept & ảnh mẫu, quy trình, FAQ, gọi Sale) + khung gõ tự do gọi Gemini qua server Render, AI trả kèm 3 nút gợi ý dẫn trang; AI lỗi thì trả lời cục bộ theo từ khoá (ghi rõ "Trợ lý AI đang bận").
- Chat trực tiếp Khách ↔ Sale (2026-09-27): khách bấm ảnh dịch vụ đầu trang / nút chat nổi -> đăng nhập -> vào màn hình chat riêng `#/chat-sale/<dịch vụ>` (ẩn footer + nút nổi), mở đầu bằng lời chào tự động + nút gợi ý câu hỏi; Admin có mục "Tin nhắn" (Sale trả lời, Sếp chỉ xem, Thợ ảnh không có), badge tin chưa đọc. **Chat THẬT qua server** (người dùng chọn 2026-09-27, MongoDB Atlas): khác máy/khác trình duyệt vẫn chat qua lại, tự cập nhật vài giây một lần (polling, chưa phải WebSocket). Đăng ký khách giờ tạo tài khoản thật trên server (chặn trùng SĐT, đăng nhập lại được). Test: `test-sale-chat` (43 case). Bản public đã nối MongoDB Atlas và kiểm chứng chat thật trên Vercel + GitHub Pages (2026-09-27).

**Quyết định đã chốt (không hỏi lại trừ khi người dùng đổi ý):**
- Đăng nhập 1 trang, KHÔNG chọn vai trò bằng tay (6 tài khoản demo hardcode trong `login.html`: 1 khách, 3 Sale `0900000002/05/06`, 1 Thợ ảnh, 1 Sếp). Đăng ký mới không có `next` → vào `#/dat-lich` (hoặc `#/chat-sale` khi Đặt lịch đang tắt); có `next` thì tôn trọng `next`.
- 3 vai trò nội bộ dùng chung `crm/admin.html`, phân quyền bằng `data-roles`, phần không thuộc quyền bị **xoá khỏi DOM**.
- Khách hàng gộp 1 file `index.html` (SPA hash); giữ riêng `login.html` và `crm/admin.html`.
- Nội dung chi tiết xem **công khai** (2026-09-25). Từ 2026-09-27: trang album tạm tắt (thẻ album còn ảnh bìa nhưng không bấm được); 5 ảnh + dòng dịch vụ đầu trang bắt đăng nhập rồi vào chat Sale (người dùng chọn phạm vi "cả 5 ảnh lẫn dòng chữ 5 dịch vụ", không gate các ảnh khác). Nút chat nổi và "Tư vấn concept ngay" vẫn bắt đăng nhập (giờ mở chat Sale).
- Chỉnh sửa ảnh chỉ 3 bước (Chờ xử lý → Đang thực hiện → Hoàn thành), KHÔNG có vai trò QC riêng. Yêu cầu thật chỉ được chuyển sang Hoàn thành khi Thợ ảnh đã gửi link ảnh đã chỉnh (2026-09-27).
- Link ảnh đã chỉnh để CÔNG KHAI cho khách gửi người thân: ngoại lệ có chủ đích với nguyên tắc riêng tư ảnh trẻ em, người dùng chốt 2026-09-27 (chi tiết `rules/workflow.md`).
- Chatbot dùng Gemini (free tier), không tự chuyển trang: chỉ chuyển khi khách BẤM nút gợi ý. Server tự thử chuỗi model dự phòng khi quá tải.
- Logo chỉ dùng chữ (wordmark); khối Dịch vụ đầu trang theo bố cục alohababy.vn, không có danh sách đánh số 01-05.

**Việc còn mở (theo thứ tự ưu tiên gợi ý):**
(Đã xong 2026-09-27: merge PR #15, cài MongoDB Atlas + biến Render, chat Sale public đã kiểm chứng trên Vercel + GitHub Pages.)
1. Sau khi tạm tắt Đặt lịch/album/chatbot (2026-09-27), vẫn còn chữ nhắc tới chúng, **cần hỏi người dùng có sửa không**: chip "Đặt lịch & cọc online" ở phần giới thiệu, section "Đặt lịch chỉ trong 4 bước", meta description, các bài trong `js/content.js` ("đặt lịch online", "trợ lý trong khung chat"), thẻ "Xem trọn album" trong trang nội dung còn mũi tên nhưng không bấm được.
2. Đăng nhập Facebook (sau Google, người dùng đã chọn thứ tự này): cần người dùng tạo app Meta for Developers + trang Chính sách bảo mật + chuyển app sang Live; làm cùng cách "lần đầu nhập SĐT" như Google. Chưa có "quên mật khẩu" / lấy lại tài khoản.
3. Chat Sale (đã chạy thật trên public), phần chưa làm: tin nhắn ghi vào hồ sơ CRM, tài khoản nhân viên thật thay tài khoản demo (mật khẩu demo đang công khai trên trang đăng nhập), thông báo đẩy khi Sale không mở trang.
4. Nối bảng CRM/Lịch hẹn của Sale (`CUSTOMERS`/`APPOINTMENTS` trong `crm/js/admin.js`, đang là mảng tĩnh) vào `aloha_demo_db`.
5. Thợ ảnh: chưa có tải ảnh gốc / công cụ chỉnh sửa thật. Sale: chưa có ghi chú tư vấn / đổi trạng thái phễu.
6. Người dùng tự cài SePay (không gấp, `/api/health` đang `"hasSepayKey":false`): liên kết MB `0967237146`, tạo webhook `https://phantichweb.onrender.com/api/sepay-webhook`, đặt `SEPAY_WEBHOOK_KEY` trên Render (từng bước: `server/DEPLOY.md`).
7. Tab "Đổi lịch hẹn" chưa có màn hình thật.
8. **Chưa chốt, không tự làm:** đồng bộ real-time đa thiết bị cho ĐẶT LỊCH/CRM cần backend thật (server + database + WebSocket/SSE), người dùng nói "để sau". (Riêng chat Sale đã có server + MongoDB từ 2026-09-27, cập nhật bằng polling 2.5-3 giây.)
9. `test-qr-flow` cần server thanh toán chạy ở cổng 3001 (không thuộc nhóm test không cần server); `test-sale-chat` tự bật server nên phải tắt `npm start` trước khi chạy.

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

- **[Quyết định quan trọng nhất, do người dùng chốt trực tiếp] Giữ nguyên kiến trúc hệ thống hiện tại và các "database" (localStorage) đã thiết kế** — KHÔNG tái cấu trúc, đổi kiến trúc, đổi lược đồ dữ liệu, gộp/tách lại file nếu không có yêu cầu mới rõ ràng từ người dùng. Kiến trúc hiện tại: site tĩnh HTML/CSS/JS thuần (không framework), `index.html` là SPA nhỏ dùng `location.hash` cho 3 view khách hàng, `crm/admin.html` là 1 file dùng chung cho 3 vai trò nội bộ, `server/` là server Node/Express riêng phục vụ chatbot AI + nhận webhook thanh toán SePay cho phí ảnh chọn thêm (người dùng chọn 2026-09-25) + chat thật Khách ↔ Sale có đăng nhập kiểm tra ở server và database MongoDB Atlas chỉ cho chat (người dùng chọn 2026-09-27; vẫn tách biệt khỏi CRM/booking, CRM/booking vẫn chưa có database), dữ liệu mô phỏng lưu trong 2 key localStorage `aloha_auth` và `aloha_demo_db`. Danh sách đầy đủ file đã tạo + lược đồ 2 "database" này: xem mục "Kiến trúc hệ thống & danh sách file" ngay bên dưới.
- **Thương hiệu luôn là ALOHA Baby**, không dùng tên/logo "Memory Studio".
- **Trạng thái (status) dùng chung một bộ tên** giữa Admin và khách hàng; số liệu dashboard/phễu phải giảm dần hợp lý và nhất quán.
- **Ảnh trẻ em là dữ liệu nhạy cảm** — chỉ xem qua tài khoản chính chủ, chỉ dùng marketing khi có văn bản đồng ý, không public không xác thực. Chi tiết: `rules/workflow.md`.
- **Không tự đặt thông số nghiệp vụ chưa xác định** (thời gian giữ chỗ, thời hạn dời lịch...) — để dạng cấu hình. Danh sách đầy đủ: `rules/tech-defaults.md`.
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
